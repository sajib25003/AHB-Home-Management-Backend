import { model, Schema } from 'mongoose';

import { IApartment } from './apartment.interface';

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
