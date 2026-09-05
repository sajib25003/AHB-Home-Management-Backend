import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { RequestHandler, Response } from 'express';
import { AuthServices } from './auth.service';
import config from '../../config';

if (!config.jwt_secret) {
  throw new Error('JWT_SECRET is not defined in config.');
}

if (!config.jwt_refresh_secret) {
  throw new Error('JWT_REFRESH_SECRET is not defined in config.');
}

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
            role: user.role,
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
        // Token invalid/expired হলেও browser cookies clear হবে।
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
      message: 'Logout failed, but local authentication was cleared.',
    });
  }
};

export const AuthController = {
  loginUser,
  logoutUser,
};
