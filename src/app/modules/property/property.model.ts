import { model, Schema } from 'mongoose';

import { IProperty } from './property.interface';

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
