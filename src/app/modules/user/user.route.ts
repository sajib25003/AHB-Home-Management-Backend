import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { UserController } from './user.controller';

const userRouter = Router();

userRouter.post(
  '/',
  authMiddleware,
  authorizeRoles('superAdmin', 'admin', 'owner'),
  UserController.createUser,
);

userRouter.get('/', authMiddleware, UserController.getAllUsers);

userRouter.get('/:userId', authMiddleware, UserController.getSingleUser);

userRouter.patch('/:userId', authMiddleware, UserController.updateUser);

userRouter.delete(
  '/:userId',
  authMiddleware,
  authorizeRoles('superAdmin', 'admin', 'owner'),
  UserController.deleteUser,
);

export default userRouter;
