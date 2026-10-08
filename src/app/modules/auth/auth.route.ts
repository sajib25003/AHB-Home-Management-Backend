import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import {
  loginAccountLimiter,
  loginIpLimiter,
  refreshTokenLimiter,
} from '../../middleware/rateLimiters';
import { validateBody } from '../../middleware/validateRequest';
import { AuthController } from './auth.controller';
import { loginRequestSchema } from './auth.validation';

const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

authRouter.post(
  '/login',
  loginIpLimiter,
  validateBody(loginRequestSchema),
  loginAccountLimiter,
  AuthController.loginUser,
);

authRouter.post(
  '/refresh-token',
  refreshTokenLimiter,
  AuthController.refreshAccessToken,
);

authRouter.get('/me', authMiddleware, AuthController.getCurrentUser);

authRouter.post('/logout', AuthController.logoutUser);

export default authRouter;
