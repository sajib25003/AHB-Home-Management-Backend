import bcrypt from 'bcrypt';
import { FilterQuery, Types } from 'mongoose';

import {
  IUser,
  TAuthProvider,
  TUserRole,
  TUserStatus,
  UserFeatures,
  UserName,
} from './user.interface';
import { UserModel } from './user.model';

export type TAuthenticatedUser = {
  id: string;
  role: TUserRole;
};

export type TCreateUserPayload = {
  name: UserName;
  email: string;

  phone?: string;
  photo?: string | null;
  address?: string;
  dateOfBirth?: Date;

  password?: string;
  provider?: TAuthProvider;

  role?: TUserRole;
  ownerId?: string | Types.ObjectId | null;

  features?: Partial<UserFeatures>;
};

export type TUpdateUserPayload = Partial<
  Pick<
    IUser,
    | 'name'
    | 'phone'
    | 'photo'
    | 'address'
    | 'dateOfBirth'
    | 'userStatus'
    | 'role'
  >
> & {
  ownerId?: string | Types.ObjectId | null;
  features?: Partial<UserFeatures>;
};

const GLOBAL_ROLES: TUserRole[] = ['superAdmin', 'admin'];

const CREATABLE_ROLES: Record<TUserRole, TUserRole[]> = {
  superAdmin: ['superAdmin', 'admin', 'owner', 'tenant', 'user'],

  admin: ['owner', 'tenant', 'user'],

  owner: ['tenant'],

  tenant: [],
  user: [],
};

const validateObjectId = (id: string, fieldName = 'User ID') => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const isGlobalRole = (role: TUserRole) => {
  return GLOBAL_ROLES.includes(role);
};

const getDefaultCreatedRole = (actorRole: TUserRole): TUserRole => {
  if (actorRole === 'owner') {
    return 'tenant';
  }

  return 'user';
};

const resolveTenantOwnerId = async (
  requestedOwnerId: string | Types.ObjectId | null | undefined,
  actor: TAuthenticatedUser,
) => {
  const ownerId =
    actor.role === 'owner' ? actor.id : requestedOwnerId?.toString();

  if (!ownerId) {
    throw new Error('An owner must be assigned to the tenant.');
  }

  validateObjectId(ownerId, 'Owner ID');

  const owner = await UserModel.findOne({
    _id: ownerId,
    role: 'owner',
    userStatus: 'active',
  }).select('_id');

  if (!owner) {
    throw new Error('A valid active owner was not found.');
  }

  return owner._id;
};

const buildAccessibleUserFilter = (
  id: string,
  actor: TAuthenticatedUser,
): FilterQuery<IUser> => {
  validateObjectId(id);
  validateObjectId(actor.id);

  if (isGlobalRole(actor.role)) {
    return {
      _id: id,
    };
  }

  if (actor.role === 'owner') {
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

const canManageTargetStatus = (
  actor: TAuthenticatedUser,
  target: IUser & {
    _id: Types.ObjectId;
  },
) => {
  if (actor.role === 'superAdmin') {
    return true;
  }

  if (actor.role === 'admin') {
    return !['superAdmin', 'admin'].includes(target.role);
  }

  if (actor.role === 'owner') {
    return target.role === 'tenant' && target.ownerId?.toString() === actor.id;
  }

  return false;
};

const createUserIntoDB = async (
  payload: TCreateUserPayload,
  actor: TAuthenticatedUser,
) => {
  validateObjectId(actor.id, 'Creator ID');

  const requestedRole = payload.role ?? getDefaultCreatedRole(actor.role);

  const allowedRoles = CREATABLE_ROLES[actor.role];

  if (!allowedRoles.includes(requestedRole)) {
    throw new Error(
      `You are not authorized to create a ${requestedRole} account.`,
    );
  }

  if (!payload.name) {
    throw new Error('User name is required.');
  }

  if (typeof payload.email !== 'string' || !payload.email.trim()) {
    throw new Error('Email is required.');
  }

  if (!payload.password) {
    throw new Error('Password is required for credentials account.');
  }

  let ownerId: Types.ObjectId | null = null;

  if (requestedRole === 'tenant') {
    ownerId = await resolveTenantOwnerId(payload.ownerId, actor);
  }

  const personalCashflow =
    requestedRole === 'user' ||
    (actor.role === 'superAdmin' &&
      payload.features?.personalCashflow === true);

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const userData: Partial<IUser> = {
    name: payload.name,

    email: payload.email.trim().toLowerCase(),

    phone: payload.phone,
    photo: payload.photo,
    address: payload.address,
    dateOfBirth: payload.dateOfBirth,

    password: passwordHash,
    provider: 'credentials',

    role: requestedRole,
    userStatus: 'active',

    createdBy: new Types.ObjectId(actor.id),
    ownerId,

    features: {
      personalCashflow,
    },

    refreshTokenHash: null,
  };

  return UserModel.create(userData);
};

const getAllUsersFromDB = async (actor: TAuthenticatedUser) => {
  validateObjectId(actor.id);

  let filter: FilterQuery<IUser>;

  if (isGlobalRole(actor.role)) {
    filter = {};
  } else if (actor.role === 'owner') {
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
    filter = {
      _id: actor.id,
    };
  }

  return UserModel.find(filter)
    .populate('createdBy', 'name email role')
    .populate('ownerId', 'name email phone role')
    .sort({
      createdAt: -1,
    })
    .lean();
};

const getSingleUserFromDB = async (id: string, actor: TAuthenticatedUser) => {
  const filter = buildAccessibleUserFilter(id, actor);

  return UserModel.findOne(filter)
    .populate('createdBy', 'name email role')
    .populate('ownerId', 'name email phone role')
    .exec();
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

  const isOwnAccount = existingUser._id.toString() === actor.id;

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
    if (isOwnAccount && data.userStatus === 'inactive') {
      throw new Error('You cannot deactivate your own account.');
    }

    if (!canManageTargetStatus(actor, existingUser)) {
      throw new Error('You are not authorized to change user status.');
    }

    updateData.userStatus = data.userStatus as TUserStatus;
  }

  if (data.role !== undefined && data.role !== existingUser.role) {
    if (isOwnAccount) {
      throw new Error('You cannot change your own role.');
    }

    const canChangeRole =
      actor.role === 'superAdmin' ||
      (actor.role === 'admin' &&
        !['superAdmin', 'admin'].includes(existingUser.role) &&
        ['owner', 'tenant', 'user'].includes(data.role));

    if (!canChangeRole) {
      throw new Error('You are not authorized to change this user role.');
    }

    updateData.role = data.role;

    if (data.role === 'tenant') {
      updateData.ownerId = await resolveTenantOwnerId(
        data.ownerId ?? existingUser.ownerId,
        actor,
      );
    } else {
      updateData.ownerId = null;
    }
  } else if (data.ownerId !== undefined && existingUser.role === 'tenant') {
    if (actor.role !== 'superAdmin' && actor.role !== 'admin') {
      throw new Error('You are not authorized to reassign tenant ownership.');
    }

    updateData.ownerId = await resolveTenantOwnerId(data.ownerId, actor);
  }

  if (data.features?.personalCashflow !== undefined) {
    if (actor.role !== 'superAdmin') {
      throw new Error(
        'Only a super admin can change personal cashflow access.',
      );
    }

    updateData.features = {
      personalCashflow: data.features.personalCashflow,
    };
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
  )
    .populate('createdBy', 'name email role')
    .populate('ownerId', 'name email phone role')
    .exec();
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

  if (!canManageTargetStatus(actor, existingUser)) {
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
  ).exec();
};

export const UserServices = {
  createUserIntoDB,
  getAllUsersFromDB,
  getSingleUserFromDB,
  updateUserInDB,
  deleteUserFromDB,
};
