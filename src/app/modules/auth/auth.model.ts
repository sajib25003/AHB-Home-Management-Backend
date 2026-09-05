import { model, Schema } from 'mongoose';
import { IAuth } from './auth.interface';

const authSchema = new Schema<IAuth>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
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

export const AuthModel = model<IAuth>('Auth', authSchema);
