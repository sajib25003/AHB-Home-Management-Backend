import { Request, RequestHandler, Response } from 'express';

import {
  TAuthenticatedUser,
  TCreateUserPayload,
  TUpdateUserPayload,
  UserServices,
} from './user.service';

const getActor = (req: Request, res: Response): TAuthenticatedUser | null => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'You must be logged in.',
    });
    return null;
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
};

const sendControllerError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(error);

  const databaseError = error as {
    code?: number;
    name?: string;
  };

  if (databaseError.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A user already exists with this email.',
    });
  }

  if (databaseError.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'User information is invalid.',
    });
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (normalizedMessage.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    const isBadRequest =
      normalizedMessage.includes('invalid') ||
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('cannot') ||
      normalizedMessage.includes('can only') ||
      normalizedMessage.includes('must be');

    if (isBadRequest) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const createUser: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const userData = req.body?.user as TCreateUserPayload | undefined;

    if (!userData) {
      res.status(400).json({
        success: false,
        message: 'User information is required.',
      });
      return;
    }

    const result = await UserServices.createUserIntoDB(userData, actor);
    const safeUser = result.toObject();

    delete safeUser.password;
    delete safeUser.refreshTokenHash;

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: safeUser,
    });
  } catch (error) {
    sendControllerError(
      res,
      error,
      'Something went wrong while creating user.',
    );
  }
};

const getAllUsers: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const result = await UserServices.getAllUsersFromDB(actor);

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendControllerError(res, error, 'Failed to fetch users.');
  }
};

const getSingleUser: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
      return;
    }

    const result = await UserServices.getSingleUserFromDB(userId, actor);

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User fetched successfully.',
      data: result,
    });
  } catch (error) {
    sendControllerError(res, error, 'Failed to fetch user.');
  }
};

const updateUser: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
      return;
    }

    const updateData = (req.body?.user ?? req.body) as TUpdateUserPayload;
    const result = await UserServices.updateUserInDB(userId, updateData, actor);

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: result,
    });
  } catch (error) {
    sendControllerError(res, error, 'Failed to update user.');
  }
};

const deleteUser: RequestHandler = async (req, res) => {
  try {
    const actor = getActor(req, res);
    if (!actor) return;

    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
      return;
    }

    const result = await UserServices.deleteUserFromDB(userId, actor);

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    const wasArchived = result.deletionType === 'soft';

    res.status(200).json({
      success: true,
      message: wasArchived
        ? 'User archived because connected records exist.'
        : 'User permanently deleted.',
      data: result,
    });
  } catch (error) {
    sendControllerError(res, error, 'Failed to delete user.');
  }
};

export const UserController = {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
};
