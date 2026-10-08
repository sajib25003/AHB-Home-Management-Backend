import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { validateBody, validateParams } from '../../middleware/validateRequest';
import { UserController } from './user.controller';
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  userIdParamsSchema,
} from './user.validation';

const userRouter = Router();

userRouter.post(
  '/',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner'),
  validateBody(createUserRequestSchema),
  UserController.createUser,
);

userRouter.get('/', authMiddleware, UserController.getAllUsers);

userRouter.get(
  '/:userId',
  authMiddleware,
  validateParams(userIdParamsSchema),
  UserController.getSingleUser,
);

userRouter.patch(
  '/:userId',
  authMiddleware,
  validateParams(userIdParamsSchema),
  validateBody(updateUserRequestSchema),
  UserController.updateUser,
);

userRouter.delete(
  '/:userId',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner'),
  validateParams(userIdParamsSchema),
  UserController.deleteUser,
);

export default userRouter;
