import bcrypt from 'bcrypt';
import { FilterQuery, Types } from 'mongoose';

import { ApartmentModel } from '../apartment/apartment.model';
import { PropertyModel } from '../property/property.model';
import { TenancyModel } from '../tenancy/tenancy.model';
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
  | 'isDeleted'
  | 'deletedAt'
  | 'deletedBy'
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

export type TUserDependencySummary = {
  ownedUsers: number;
  createdUsers: number;
  relatedUsers: number;
  properties: number;
  apartments: number;
  tenancies: number;
  activeTenancies: number;
  total: number;
};

export type TDeleteUserResult = {
  deletionType: 'hard' | 'soft';
  user: IUser;
  dependencies: TUserDependencySummary;
};

const validateObjectId = (id: string, fieldName = 'User ID') => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const notDeletedFilter: FilterQuery<IUser> = {
  isDeleted: { $ne: true },
};

const hasGlobalAccess = (role: TUserRole) => role === 'superAdmin';

const buildAccessibleUserFilter = (
  id: string,
  actor: TAuthenticatedUser,
): FilterQuery<IUser> => {
  validateObjectId(id);
  validateObjectId(actor.id, 'Authenticated user ID');

  if (hasGlobalAccess(actor.role)) {
    return {
      _id: id,
      ...notDeletedFilter,
    };
  }

  if (actor.role === 'owner') {
    return {
      _id: id,
      ...notDeletedFilter,
      $or: [
        { _id: actor.id },
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
    ...notDeletedFilter,
  };
};

const validateRequestedRole = (
  requestedRole: TUserRole,
  actor: TAuthenticatedUser,
) => {
  if (actor.role === 'owner' && requestedRole !== 'tenant') {
    throw new Error('Owner can only create tenant accounts.');
  }

  if (actor.role !== 'superAdmin' && requestedRole === 'superAdmin') {
    throw new Error('Only a super admin can create another super admin.');
  }
};

const createUserIntoDB = async (
  payload: TCreateUserPayload,
  actor: TAuthenticatedUser,
) => {
  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to create users.');
  }

  validateObjectId(actor.id, 'Creator ID');

  const requestedRole =
    payload.role ?? (actor.role === 'owner' ? 'tenant' : 'user');

  validateRequestedRole(requestedRole, actor);

  let ownerId: Types.ObjectId | null = null;

  if (requestedRole === 'tenant') {
    const requestedOwnerId =
      actor.role === 'owner' ? actor.id : payload.ownerId?.toString();

    if (!requestedOwnerId) {
      throw new Error('An owner must be assigned to the tenant.');
    }

    validateObjectId(requestedOwnerId, 'Owner ID');

    const owner = await UserModel.findOne({
      _id: requestedOwnerId,
      role: 'owner',
      userStatus: 'active',
      isDeleted: { $ne: true },
    }).select('_id');

    if (!owner) {
      throw new Error('A valid active owner was not found.');
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
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  };

  if (payload.provider === 'credentials') {
    if (!payload.password) {
      throw new Error('Password is required for credentials account.');
    }

    userData.password = await bcrypt.hash(payload.password, 12);
  }

  return UserModel.create(userData);
};

const getAllUsersFromDB = async (actor: TAuthenticatedUser) => {
  validateObjectId(actor.id, 'Authenticated user ID');

  let filter: FilterQuery<IUser> = {
    ...notDeletedFilter,
  };

  if (actor.role === 'owner') {
    filter = {
      ...notDeletedFilter,
      $or: [
        { _id: actor.id },
        {
          role: 'tenant',
          ownerId: actor.id,
        },
      ],
    };
  } else if (!hasGlobalAccess(actor.role)) {
    filter = {
      _id: actor.id,
      ...notDeletedFilter,
    };
  }

  return UserModel.find(filter)
    .populate('createdBy', 'name email role')
    .populate('ownerId', 'name email phone role')
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
  const existingUser = await UserModel.findOne(filter);

  if (!existingUser) {
    return null;
  }

  const updateData: Partial<IUser> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.photo !== undefined) updateData.photo = data.photo;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = data.dateOfBirth;
  }

  if (data.userStatus !== undefined) {
    const isOwnAccount = existingUser._id.toString() === actor.id;
    const isOwnedTenant =
      actor.role === 'owner' &&
      existingUser.role === 'tenant' &&
      existingUser.ownerId?.toString() === actor.id;

    if (isOwnAccount) {
      throw new Error('You cannot change your own account status.');
    }

    if (!hasGlobalAccess(actor.role) && !isOwnedTenant) {
      throw new Error('You are not authorized to change user status.');
    }

    updateData.userStatus = data.userStatus;

    if (data.userStatus === 'inactive') {
      updateData.refreshTokenHash = null;
    }
  }

  return UserModel.findOneAndUpdate(
    filter,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    },
  );
};

const getUserDependencies = async (
  userId: string,
): Promise<TUserDependencySummary> => {
  const objectId = new Types.ObjectId(userId);

  const [
    ownedUsers,
    createdUsers,
    relatedUsers,
    properties,
    apartments,
    tenancies,
    activeTenancies,
  ] = await Promise.all([
    UserModel.countDocuments({
      ownerId: objectId,
    }),
    UserModel.countDocuments({
      createdBy: objectId,
    }),
    UserModel.countDocuments({
      _id: { $ne: objectId },
      $or: [{ ownerId: objectId }, { createdBy: objectId }],
    }),
    PropertyModel.countDocuments({
      $or: [{ ownerId: objectId }, { createdBy: objectId }],
    }),
    ApartmentModel.countDocuments({
      $or: [{ createdBy: objectId }, { deletedBy: objectId }],
    }),
    TenancyModel.countDocuments({
      $or: [
        { tenantId: objectId },
        { ownerId: objectId },
        { createdBy: objectId },
        { endedBy: objectId },
      ],
    }),
    TenancyModel.countDocuments({
      status: 'active',
      $or: [{ tenantId: objectId }, { ownerId: objectId }],
    }),
  ]);

  const total = relatedUsers + properties + apartments + tenancies;

  return {
    ownedUsers,
    createdUsers,
    relatedUsers,
    properties,
    apartments,
    tenancies,
    activeTenancies,
    total,
  };
};

const deleteUserFromDB = async (
  id: string,
  actor: TAuthenticatedUser,
): Promise<TDeleteUserResult | null> => {
  const filter = buildAccessibleUserFilter(id, actor);
  const existingUser = await UserModel.findOne(filter);

  if (!existingUser) {
    return null;
  }

  if (existingUser._id.toString() === actor.id) {
    throw new Error('You cannot delete your own account.');
  }

  const isOwnedTenant =
    actor.role === 'owner' &&
    existingUser.role === 'tenant' &&
    existingUser.ownerId?.toString() === actor.id;

  if (!hasGlobalAccess(actor.role) && !isOwnedTenant) {
    throw new Error('You are not authorized to delete this user.');
  }

  const dependencies = await getUserDependencies(id);

  if (dependencies.activeTenancies > 0) {
    throw new Error(
      'Cannot delete a user with an active tenancy. Complete the tenant move-out first.',
    );
  }

  if (dependencies.total === 0) {
    const deletedUser = await UserModel.findOneAndDelete(filter);

    if (!deletedUser) {
      return null;
    }

    return {
      deletionType: 'hard',
      user: deletedUser,
      dependencies,
    };
  }

  const archivedUser = await UserModel.findOneAndUpdate(
    filter,
    {
      $set: {
        isDeleted: true,
        userStatus: 'inactive',
        deletedAt: new Date(),
        deletedBy: new Types.ObjectId(actor.id),
        refreshTokenHash: null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!archivedUser) {
    return null;
  }

  return {
    deletionType: 'soft',
    user: archivedUser,
    dependencies,
  };
};

export const UserServices = {
  createUserIntoDB,
  getAllUsersFromDB,
  getSingleUserFromDB,
  updateUserInDB,
  getUserDependencies,
  deleteUserFromDB,
};
