import bcrypt from 'bcrypt';
import type { CookieOptions, RequestHandler, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import config from '../../config';
import type { TUserRole } from '../user/user.interface';
import { AuthServices } from './auth.service';

const JWT_SECRET = config.jwt_secret;
const JWT_REFRESH_SECRET = config.jwt_refresh_secret;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in config.');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is not defined in config.');
}

// for testing
// const ACCESS_TOKEN_EXPIRES_IN = '20s' as const;
// const ACCESS_TOKEN_MAX_AGE = 20 * 1000;

const ACCESS_TOKEN_EXPIRES_IN = '15m' as const;
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;

const REFRESH_TOKEN_EXPIRES_IN = '7d' as const;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isProduction = config.node_env === 'production';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

type TTokenUser = {
  id: string;
  email: string;
  role: TUserRole;
};

type TDecodedToken = JwtPayload & {
  id?: string;
};

const createAccessToken = (user: TTokenUser) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      subject: user.id,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    },
  );
};

const createRefreshToken = (user: TTokenUser) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_REFRESH_SECRET,
    {
      subject: user.id,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    },
  );
};

const getUserIdFromToken = (token: string, secret: string): string | null => {
  const decoded = jwt.verify(token, secret) as TDecodedToken;

  const userId = typeof decoded.sub === 'string' ? decoded.sub : decoded.id;

  return typeof userId === 'string' ? userId : null;
};

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

const sendRefreshUnauthorized = (
  res: Response,
  message = 'Your session has expired. Please log in again.',
) => {
  clearAuthCookies(res);

  res.status(401).json({
    success: false,
    message,
  });
};

/*
 * POST /api/v1/auth/login
 */
const loginUser: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });

      return;
    }

    const user = await AuthServices.getUserByEmailFromDB(email);

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });

      return;
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });

      return;
    }

    const tokenUser: TTokenUser = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = createAccessToken(tokenUser);
    const refreshToken = createRefreshToken(tokenUser);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await AuthServices.updateRefreshTokenHashInDB(
      tokenUser.id,
      refreshTokenHash,
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: tokenUser.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photo: user.photo,
          role: user.role,
          provider: user.provider,
          userStatus: user.userStatus,
          ownerId: user.ownerId,
          features: user.features,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      success: false,
      message: 'Something went wrong while logging in.',
    });
  }
};

/*
 * POST /api/v1/auth/refresh-token
 */
const refreshAccessToken: RequestHandler = async (req, res) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken;

    if (typeof currentRefreshToken !== 'string') {
      sendRefreshUnauthorized(res, 'Refresh token was not provided.');
      return;
    }

    let userId: string | null = null;

    try {
      userId = getUserIdFromToken(currentRefreshToken, JWT_REFRESH_SECRET);
    } catch {
      sendRefreshUnauthorized(res, 'Refresh token is invalid or expired.');
      return;
    }

    if (!userId) {
      sendRefreshUnauthorized(res, 'Refresh token payload is invalid.');
      return;
    }

    const user = await AuthServices.getUserByIdFromDB(userId);

    if (!user || !user.refreshTokenHash) {
      sendRefreshUnauthorized(res);
      return;
    }

    const isRefreshTokenMatched = await bcrypt.compare(
      currentRefreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenMatched) {
      sendRefreshUnauthorized(res, 'Refresh token is no longer valid.');
      return;
    }

    const tokenUser: TTokenUser = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    /*
     * Refresh token rotation:
     * নতুন access এবং refresh token দুটোই দেওয়া হচ্ছে।
     */
    const newAccessToken = createAccessToken(tokenUser);
    const newRefreshToken = createRefreshToken(tokenUser);

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 12);

    await AuthServices.updateRefreshTokenHashInDB(
      tokenUser.id,
      newRefreshTokenHash,
    );

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Session refreshed successfully.',
    });
  } catch (error) {
    console.error('Refresh token error:', error);

    clearAuthCookies(res);

    res.status(500).json({
      success: false,
      message: 'Failed to refresh authentication session.',
    });
  }
};

/*
 * GET /api/v1/auth/me
 */
const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: No authenticated user.',
      });

      return;
    }

    const user = await AuthServices.getCurrentUserFromDB(userId);

    if (!user) {
      clearAuthCookies(res);

      res.status(401).json({
        success: false,
        message: 'User not found or inactive.',
      });

      return;
    }

    res.status(200).json({
      success: true,
      message: 'Current user fetched successfully.',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          photo: user.photo,
          role: user.role,
          provider: user.provider,
          userStatus: user.userStatus,
          ownerId: user.ownerId,
          features: user.features,
        },
      },
    });
  } catch (error) {
    console.error('Current user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load current user.',
    });
  }
};

/*
 * POST /api/v1/auth/logout
 */
const logoutUser: RequestHandler = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (typeof refreshToken === 'string') {
      try {
        const userId = getUserIdFromToken(refreshToken, JWT_REFRESH_SECRET);

        if (userId) {
          const user = await AuthServices.getUserByIdFromDB(userId);

          if (user?.refreshTokenHash) {
            const isRefreshTokenMatched = await bcrypt.compare(
              refreshToken,
              user.refreshTokenHash,
            );

            if (isRefreshTokenMatched) {
              await AuthServices.removeRefreshTokenFromDB(userId);
            }
          }
        }
      } catch {
        // Invalid বা expired হলেও cookies clear হবে।
      }
    }

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: 'Logout successful.',
    });
  } catch (error) {
    console.error('Logout error:', error);

    clearAuthCookies(res);

    res.status(500).json({
      success: false,
      message: 'Logout failed, but authentication cookies were cleared.',
    });
  }
};

export const AuthController = {
  loginUser,
  refreshAccessToken,
  getCurrentUser,
  logoutUser,
};
