import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

import config from '../config';
import { UserModel } from '../modules/user/user.model';

const JWT_SECRET = config.jwt_secret;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured.');
}

type TAccessTokenPayload = JwtPayload & {
  id?: string;
  email?: string;
};

const authMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : undefined;

    const token = req.cookies?.accessToken || bearerToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: No access token provided.',
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as TAccessTokenPayload;

    const userId = typeof decoded.sub === 'string' ? decoded.sub : decoded.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token payload.',
      });
      return;
    }

    const user = await UserModel.findOne({
      _id: userId,
      userStatus: 'active',
    }).select('_id email role');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User is inactive or unavailable.',
      });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired access token.',
    });
  }
};

export default authMiddleware;
