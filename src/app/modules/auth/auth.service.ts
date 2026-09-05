import { UserModel } from '../user/user.model';

const getUserByEmailFromDB = async (email: string) => {
  return UserModel.findOne({
    email: email.trim().toLowerCase(),

    // পুরোনো document-এ isActive না থাকলেও user পাওয়া যাবে
    isActive: {
      $ne: false,
    },
  })
    .select('+password +refreshTokenHash')
    .exec();
};

const getUserByIdFromDB = async (userId: string) => {
  return UserModel.findById(userId).select('+refreshTokenHash').exec();
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
  updateRefreshTokenHashInDB,
  removeRefreshTokenFromDB,
};
