import bcrypt from 'bcrypt';
import { FilterQuery, Types } from 'mongoose';
import { IUser, TUserRole } from './user.interface';
import { UserModel } from './user.model';

export type TAuthenticatedUser = {
  id: string;
  role: TUserRole;
};

export type TCreateUserPayload = Omit<
  IUser,
  | 'role'
  | 'userStatus'
  | 'createdBy'
  | 'ownerId'
  | 'features'
  | 'refreshTokenHash'
  | 'createdAt'
  | 'updatedAt'
> & {
  role?: TUserRole;
  ownerId?: string | Types.ObjectId | null;
};

export type TUpdateUserPayload = Partial<
  Pick<
    IUser,
    'name' | 'phone' | 'photo' | 'address' | 'dateOfBirth' | 'userStatus'
  >
>;

const validateObjectId = (id: string, fieldName = 'User ID') => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const buildAccessibleUserFilter = (
  id: string,
  actor: TAuthenticatedUser,
): FilterQuery<IUser> => {
  validateObjectId(id);
  validateObjectId(actor.id);

  if (actor.role === 'superAdmin') {
    return {
      _id: id,
    };
  }

  if (actor.role === 'admin') {
    return {
      _id: id,

      $or: [
        {
          _id: actor.id,
        },
        {
          role: 'tenant',
          ownerId: actor.id,
        },
      ],
    };
  }

  if (id !== actor.id) {
    throw new Error('You are not authorized to access this user.');
  }

  return {
    _id: actor.id,
  };
};

const createUserIntoDB = async (
  payload: TCreateUserPayload,
  actor: TAuthenticatedUser,
) => {
  if (!['superAdmin', 'admin'].includes(actor.role)) {
    throw new Error('You are not authorized to create users.');
  }

  validateObjectId(actor.id, 'Creator ID');

  const requestedRole =
    payload.role || (actor.role === 'admin' ? 'tenant' : 'user');

  if (actor.role === 'admin' && requestedRole !== 'tenant') {
    throw new Error('Admin can only create tenant accounts.');
  }

  let ownerId: Types.ObjectId | null = null;

  if (requestedRole === 'tenant') {
    const requestedOwnerId =
      actor.role === 'admin' ? actor.id : payload.ownerId?.toString();

    if (!requestedOwnerId) {
      throw new Error('An admin/owner must be assigned to the tenant.');
    }

    validateObjectId(requestedOwnerId, 'Owner ID');

    const owner = await UserModel.findOne({
      _id: requestedOwnerId,
      role: 'admin',
      userStatus: 'active',
    }).select('_id');

    if (!owner) {
      throw new Error('A valid active admin/owner was not found.');
    }

    ownerId = owner._id;
  }

  const userData: Partial<IUser> = {
    name: payload.name,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone,
    photo: payload.photo,
    address: payload.address,
    dateOfBirth: payload.dateOfBirth,
    provider: payload.provider,

    role: requestedRole,
    userStatus: 'active',

    createdBy: new Types.ObjectId(actor.id),
    ownerId,

    features: {
      personalCashflow: false,
    },

    refreshTokenHash: null,
  };

  if (payload.provider === 'credentials') {
    if (!payload.password) {
      throw new Error('Password is required for credentials account.');
    }

    userData.password = await bcrypt.hash(payload.password, 12);
  } else {
    delete userData.password;
  }

  return UserModel.create(userData);
};

const getAllUsersFromDB = async (actor: TAuthenticatedUser) => {
  validateObjectId(actor.id);

  let filter: FilterQuery<IUser>;

  if (actor.role === 'superAdmin') {
    filter = {};
  } else if (actor.role === 'admin') {
    filter = {
      $or: [
        {
          _id: actor.id,
        },
        {
          role: 'tenant',
          ownerId: actor.id,
        },
      ],
    };
  } else {
    // Tenant এবং general user শুধু নিজের তথ্য পাবে
    filter = {
      _id: actor.id,
    };
  }

  return UserModel.find(filter)
    .populate('createdBy', 'name email role')
    .populate('ownerId', 'name email phone')
    .sort({ createdAt: -1 })
    .lean();
};

const getSingleUserFromDB = async (id: string, actor: TAuthenticatedUser) => {
  const filter = buildAccessibleUserFilter(id, actor);

  const user = await UserModel.findOne(filter);

  if (!user) {
    return null;
  }

  await user.populate([
    {
      path: 'createdBy',
      select: 'name email role',
    },
    {
      path: 'ownerId',
      select: 'name email phone role',
    },
  ]);

  return user;
};

const updateUserInDB = async (
  id: string,
  data: TUpdateUserPayload,
  actor: TAuthenticatedUser,
) => {
  const filter = buildAccessibleUserFilter(id, actor);

  /*
   * Authorization check করার সময় ownerId populate করছি না।
   */
  const existingUser = await UserModel.findOne(filter);

  if (!existingUser) {
    return null;
  }

  const updateData: Partial<IUser> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone;
  }

  if (data.photo !== undefined) {
    updateData.photo = data.photo;
  }

  if (data.address !== undefined) {
    updateData.address = data.address;
  }

  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = data.dateOfBirth;
  }

  if (data.userStatus !== undefined) {
    const canUpdateStatus =
      actor.role === 'superAdmin' ||
      (actor.role === 'admin' &&
        existingUser.role === 'tenant' &&
        existingUser.ownerId?.toString() === actor.id);

    if (!canUpdateStatus) {
      throw new Error('You are not authorized to change user status.');
    }

    updateData.userStatus = data.userStatus;
  }

  return UserModel.findOneAndUpdate(
    filter,
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    },
  );
};

const deleteUserFromDB = async (id: string, actor: TAuthenticatedUser) => {
  const filter = buildAccessibleUserFilter(id, actor);

  const existingUser = await UserModel.findOne(filter);

  if (!existingUser) {
    return null;
  }

  if (existingUser._id.toString() === actor.id) {
    throw new Error('You cannot deactivate your own account.');
  }

  const canDeactivate =
    actor.role === 'superAdmin' ||
    (actor.role === 'admin' &&
      existingUser.role === 'tenant' &&
      existingUser.ownerId?.toString() === actor.id);

  if (!canDeactivate) {
    throw new Error('You are not authorized to deactivate this user.');
  }

  return UserModel.findOneAndUpdate(
    filter,
    {
      $set: {
        userStatus: 'inactive',
        refreshTokenHash: null,
      },
    },
    {
      new: true,
    },
  );
};
export const UserServices = {
  createUserIntoDB,
  getAllUsersFromDB,
  getSingleUserFromDB,
  updateUserInDB,
  deleteUserFromDB,
};
