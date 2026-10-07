import { model, Schema } from 'mongoose';

import {
  ELECTRICITY_CONSUMER_CATEGORIES,
  ELECTRICITY_METER_PHASES,
} from '../electricity/electricity.interface';
import { IProperty } from './property.interface';

const propertyElectricitySettingsSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'ElectricityProvider',
      required: true,
    },
    consumerCategory: {
      type: String,
      enum: ELECTRICITY_CONSUMER_CATEGORIES,
      required: true,
      default: 'LT_A_RESIDENTIAL',
    },
    accountNumber: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Electricity account number is too long.'],
    },
    defaultMeterPhase: {
      type: String,
      enum: ELECTRICITY_METER_PHASES,
      required: true,
      default: 'singlePhase',
    },
    tariffSelection: {
      type: String,
      enum: ['automatic'],
      required: true,
      default: 'automatic',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const propertySchema = new Schema<IProperty>(
  {
    name: {
      type: String,
      required: [true, 'Property name is required.'],
      trim: true,
      maxlength: [120, 'Property name cannot exceed 120 characters.'],
    },

    address: {
      type: String,
      required: [true, 'Property address is required.'],
      trim: true,
      maxlength: [500, 'Property address cannot exceed 500 characters.'],
    },

    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, 'Property note cannot exceed 2000 characters.'],
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Property owner is required.'],
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    electricitySettings: {
      type: propertyElectricitySettingsSchema,
      default: null,
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

propertySchema.index({
  ownerId: 1,
  isDeleted: 1,
  createdAt: -1,
});

propertySchema.index(
  {
    ownerId: 1,
    name: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
    collation: {
      locale: 'en',
      strength: 2,
    },
  },
);

export const PropertyModel = model<IProperty>('Property', propertySchema);
