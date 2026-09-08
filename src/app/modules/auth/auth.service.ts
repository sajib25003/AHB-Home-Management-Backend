import { Types } from 'mongoose';

import { UserModel } from '../user/user.model';

const getUserByEmailFromDB = async (email: string) => {
  return UserModel.findOne({
    email: email.trim().toLowerCase(),

    userStatus: 'active',

    // পুরোনো document-এ isActive না থাকলেও user পাওয়া যাবে
    isActive: {
      $ne: false,
    },
  })
    .select('+password')
    .exec();
};

/*
 * Logout-এর সময় refreshTokenHash প্রয়োজন।
 */
const getUserByIdFromDB = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  return UserModel.findById(userId).select('+refreshTokenHash').exec();
};

/*
 * GET /auth/me endpoint-এর জন্য।
 *
 * এখানে password এবং refreshTokenHash return হবে না।
 */
const getCurrentUserFromDB = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  return UserModel.findOne({
    _id: userId,
    userStatus: 'active',
  })
    .select(
      [
        'name',
        'email',
        'phone',
        'photo',
        'role',
        'provider',
        'userStatus',
        'ownerId',
        'features',
      ].join(' '),
    )
    .lean()
    .exec();
};

const updateRefreshTokenHashInDB = async (
  userId: string,
  refreshTokenHash: string,
) => {
  return UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        refreshTokenHash,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).exec();
};

const removeRefreshTokenFromDB = async (userId: string) => {
  return UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        refreshTokenHash: null,
      },
    },
    {
      new: true,
    },
  ).exec();
};

export const AuthServices = {
  getUserByEmailFromDB,
  getUserByIdFromDB,
  getCurrentUserFromDB,
  updateRefreshTokenHashInDB,
  removeRefreshTokenFromDB,
};
