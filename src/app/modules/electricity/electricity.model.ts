import { model, Schema } from 'mongoose';

import {
  ELECTRICITY_CONSUMER_CATEGORIES,
  ELECTRICITY_METER_PHASES,
  ELECTRICITY_TARIFF_SCOPES,
  IElectricityProvider,
  IElectricityTariffSchedule,
} from './electricity.interface';

const electricityProviderSchema = new Schema<IElectricityProvider>(
  {
    name: {
      type: String,
      required: [true, 'Electricity provider name is required.'],
      trim: true,
      maxlength: [120, 'Provider name cannot exceed 120 characters.'],
    },
    code: {
      type: String,
      required: [true, 'Electricity provider code is required.'],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [30, 'Provider code cannot exceed 30 characters.'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

const tariffLifelineSchema = new Schema(
  {
    maximumUnit: {
      type: Number,
      required: true,
      min: 1,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const tariffSlabSchema = new Schema(
  {
    fromUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    toUnit: {
      type: Number,
      default: null,
      min: 1,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const meterChargeSchema = new Schema(
  {
    meterPhase: {
      type: String,
      enum: ELECTRICITY_METER_PHASES,
      required: true,
    },
    loadFrom: {
      type: Number,
      default: null,
      min: 0,
    },
    loadTo: {
      type: Number,
      default: null,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const electricityTariffScheduleSchema = new Schema<IElectricityTariffSchedule>(
  {
    name: {
      type: String,
      required: [true, 'Tariff name is required.'],
      trim: true,
      maxlength: [160, 'Tariff name cannot exceed 160 characters.'],
    },
    consumerCategory: {
      type: String,
      enum: ELECTRICITY_CONSUMER_CATEGORIES,
      required: true,
      default: 'LT_A_RESIDENTIAL',
      index: true,
    },
    scope: {
      type: String,
      enum: ELECTRICITY_TARIFF_SCOPES,
      required: true,
      default: 'national',
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'ElectricityProvider',
      default: null,
      index: true,
      required: function (this: IElectricityTariffSchedule) {
        return this.scope === 'providerSpecific';
      },
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Tariff effective date is required.'],
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    lifeline: {
      type: tariffLifelineSchema,
      required: true,
    },
    slabs: {
      type: [tariffSlabSchema],
      required: true,
      validate: {
        validator: (value: unknown[]) => value.length > 0,
        message: 'At least one tariff slab is required.',
      },
    },
    vatPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    meterCharges: {
      type: [meterChargeSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

electricityTariffScheduleSchema.index({
  scope: 1,
  providerId: 1,
  consumerCategory: 1,
  effectiveFrom: -1,
});

export const ElectricityProviderModel = model<IElectricityProvider>(
  'ElectricityProvider',
  electricityProviderSchema,
);

export const ElectricityTariffScheduleModel = model<IElectricityTariffSchedule>(
  'ElectricityTariffSchedule',
  electricityTariffScheduleSchema,
);
