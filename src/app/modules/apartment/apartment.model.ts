import { model, Schema } from 'mongoose';

import {
  APARTMENT_ELECTRICITY_BILLING_TYPES,
  ELECTRICITY_PAYMENT_RESPONSIBILITIES,
  IApartment,
} from './apartment.interface';

const apartmentElectricityConfigSchema = new Schema(
  {
    billingType: {
      type: String,
      enum: APARTMENT_ELECTRICITY_BILLING_TYPES,
      required: true,
    },
    paymentResponsibility: {
      type: String,
      enum: ELECTRICITY_PAYMENT_RESPONSIBILITIES,
      required: true,
      default: 'ownerCollects',
    },
    meterNumber: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Electricity meter number is too long.'],
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, 'Electricity configuration note is too long.'],
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

const apartmentSchema = new Schema<IApartment>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property is required.'],
      index: true,
    },

    apartmentNumber: {
      type: String,
      required: [true, 'Apartment number is required.'],
      trim: true,
      maxlength: [100, 'Apartment number cannot exceed 100 characters.'],
    },

    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, 'Apartment note cannot exceed 2000 characters.'],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    electricityConfig: {
      type: apartmentElectricityConfigSchema,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

apartmentSchema.virtual('currentTenancy', {
  ref: 'Tenancy',
  localField: '_id',
  foreignField: 'apartmentId',
  justOne: true,
  match: {
    status: 'active',
  },
});

apartmentSchema.index({
  propertyId: 1,
  isDeleted: 1,
  createdAt: -1,
});

apartmentSchema.index(
  {
    propertyId: 1,
    apartmentNumber: 1,
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

export const ApartmentModel = model<IApartment>('Apartment', apartmentSchema);
