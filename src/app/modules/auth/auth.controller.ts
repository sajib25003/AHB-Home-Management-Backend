import bcrypt from 'bcrypt';
import { RequestHandler, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import config from '../../config';
import { AuthServices } from './auth.service';

const JWT_SECRET = config.jwt_secret;
const JWT_REFRESH_SECRET = config.jwt_refresh_secret;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in config.');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is not defined in config.');
}

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  path: '/',
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
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

    const userId = user._id.toString();

    const accessToken = jwt.sign(
      {
        id: userId,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        subject: userId,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      },
    );

    const refreshToken = jwt.sign(
      {
        id: userId,
        email: user.email,
        role: user.role,
      },
      JWT_REFRESH_SECRET,
      {
        subject: userId,
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await AuthServices.updateRefreshTokenHashInDB(userId, refreshTokenHash);

    res
      .cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE,
      })
      .cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      })
      .status(200)
      .json({
        success: true,
        message: 'Login successful.',
        data: {
          user: {
            id: userId,
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
 * GET /api/v1/auth/me
 *
 * authMiddleware accessToken verify করে req.user set করবে।
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
      /*
       * Token valid হলেও user delete/inactive হয়ে থাকলে
       * পুরোনো authentication cookies clear করা হবে।
       */
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

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          JWT_REFRESH_SECRET,
        ) as JwtPayload;

        const userId = decoded.sub;

        if (typeof userId === 'string') {
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
        /*
         * Refresh token invalid বা expired হলেও
         * browser cookies clear হবে।
         */
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
  getCurrentUser,
  logoutUser,
};
