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
      },

      middleName: {
        type: String,
        default: null,
        trim: true,
      },

      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
      },
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    photo: {
      type: String,
      default: null,
      trim: true,
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
    },

    dateOfBirth: {
      type: Date,
    },

    password: {
      type: String,

      required: function () {
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

      required: function () {
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({
  role: 1,
  userStatus: 1,
});

userSchema.index({
  ownerId: 1,
  role: 1,
  userStatus: 1,
});

export const UserModel = model<IUser>('User', userSchema);
