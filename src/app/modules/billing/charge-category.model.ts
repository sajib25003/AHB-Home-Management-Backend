import { model, Schema } from 'mongoose';

import {
  CHARGE_CALCULATION_MODES,
  IChargeCategory,
} from './charge-category.interface';

const chargeCategorySchema = new Schema<IChargeCategory>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Charge category name is required.'],
      trim: true,
      maxlength: [100, 'Charge category name cannot exceed 100 characters.'],
    },
    code: {
      type: String,
      required: [true, 'Charge category code is required.'],
      trim: true,
      uppercase: true,
      maxlength: [80, 'Charge category code cannot exceed 80 characters.'],
    },
    defaultMode: {
      type: String,
      enum: CHARGE_CALCULATION_MODES,
      required: true,
    },
    defaultAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

chargeCategorySchema.index({ ownerId: 1, code: 1 }, { unique: true });

chargeCategorySchema.index({ ownerId: 1, isActive: 1, sortOrder: 1 });

export const ChargeCategoryModel = model<IChargeCategory>(
  'ChargeCategory',
  chargeCategorySchema,
);
