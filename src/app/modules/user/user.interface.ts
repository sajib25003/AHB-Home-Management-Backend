import { Types } from 'mongoose';

export const USER_ROLES = [
  'user',
  'tenant',
  'owner',
  'admin',
  'superAdmin',
] as const;

export const USER_STATUSES = ['active', 'inactive'] as const;

export const AUTH_PROVIDERS = ['credentials'] as const;

export type TUserRole = (typeof USER_ROLES)[number];

export type TUserStatus = (typeof USER_STATUSES)[number];

export type TAuthProvider = (typeof AUTH_PROVIDERS)[number];

export type UserName = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
};

export type UserFeatures = {
  personalCashflow: boolean;
};

export interface IUser {
  name: UserName;

  email: string;
  phone?: string;
  photo?: string | null;

  userStatus: TUserStatus;
  role: TUserRole;

  address?: string;
  dateOfBirth?: Date;

  password?: string;
  provider: TAuthProvider;

  createdBy?: Types.ObjectId | null;

  /*
   * শুধু tenant-এর ক্ষেত্রে থাকবে।
   * এটি tenant-এর property owner-কে নির্দেশ করবে।
   */
  ownerId?: Types.ObjectId | null;

  features?: UserFeatures;

  refreshTokenHash?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}
