import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import { AuthController } from './auth.controller';

const authRouter = Router();

authRouter.post('/login', AuthController.loginUser);

authRouter.post('/refresh-token', AuthController.refreshAccessToken);

authRouter.get('/me', authMiddleware, AuthController.getCurrentUser);

authRouter.post('/logout', AuthController.logoutUser);

export default authRouter;
