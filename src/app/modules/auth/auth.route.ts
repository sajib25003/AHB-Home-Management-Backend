import { Router } from 'express';
import { AuthController } from './auth.controller';
import authMiddleware from '../../middleware/authMiddleware';

const authRouter = Router();

authRouter.post('/login', AuthController.loginUser);
authRouter.get('/me', authMiddleware, AuthController.getCurrentUser);
authRouter.post('/logout', AuthController.logoutUser);

export default authRouter;
