import { model, Schema } from 'mongoose';
import {
  AUTH_PROVIDERS,
  IUser,
  USER_ROLES,
  USER_STATUSES,
} from './user.interface';

const userSchema = new Schema<IUser>(
  {
    name: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [80, 'First name cannot exceed 80 characters'],
      },
      middleName: {
        type: String,
        default: null,
        trim: true,
        maxlength: [80, 'Middle name cannot exceed 80 characters'],
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [80, 'Last name cannot exceed 80 characters'],
      },
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is invalid'],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
    },

    photo: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2048, 'Photo URL cannot exceed 2048 characters'],
    },

    userStatus: {
      type: String,
      enum: USER_STATUSES,
      required: true,
      default: 'active',
      index: true,
    },

    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      default: 'user',
      index: true,
    },

    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },

    dateOfBirth: {
      type: Date,
    },

    password: {
      type: String,
      required: function (this: IUser): boolean {
        return this.provider === 'credentials';
      },
      select: false,
    },

    provider: {
      type: String,
      enum: AUTH_PROVIDERS,
      required: true,
      default: 'credentials',
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      required: function (this: IUser): boolean {
        return this.role === 'tenant';
      },
    },

    features: {
      personalCashflow: {
        type: Boolean,
        default: false,
      },
    },

    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({
  isDeleted: 1,
  role: 1,
  userStatus: 1,
});

userSchema.index({
  isDeleted: 1,
  ownerId: 1,
  role: 1,
  userStatus: 1,
});

export const UserModel = model<IUser>('User', userSchema);
