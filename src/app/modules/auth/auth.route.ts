import { Router } from 'express';
import { AuthController } from './auth.controller';

const authRouter = Router();

authRouter.post('/login', AuthController.loginUser);
authRouter.post('/logout', AuthController.logoutUser);

export default authRouter;
