import { model, Schema } from 'mongoose';

import {
  ITenancy,
  NOTICE_PERIOD_UNITS,
  TENANCY_STATUSES,
} from './tenancy.interface';

const rentTermsSchema = new Schema(
  {
    baseRent: {
      type: Number,
      required: true,
      min: [0, 'Base rent cannot be negative.'],
    },
    dueDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
      default: 10,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    noticePeriod: {
      value: {
        type: Number,
        required: true,
        min: 0,
        default: 1,
      },
      unit: {
        type: String,
        enum: NOTICE_PERIOD_UNITS,
        required: true,
        default: 'months',
      },
    },
    rentRevision: {
      intervalMonths: {
        type: Number,
        default: null,
        min: 1,
      },
      nextRevisionDate: {
        type: Date,
        default: null,
      },
      note: {
        type: String,
        trim: true,
        default: null,
        maxlength: 1000,
      },
    },
    securityDeposit: {
      type: Number,
      default: null,
      min: 0,
    },
    advanceAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    agreementStartDate: {
      type: Date,
      default: null,
    },
    agreementEndDate: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
  },
  { _id: false },
);

const rentRateHistorySchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
  },
  { _id: false },
);

const tenancySchema = new Schema<ITenancy>(
  {
    apartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment is required.'],
    },

    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property is required.'],
    },

    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tenant is required.'],
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required.'],
    },

    startDate: {
      type: Date,
      required: [true, 'Tenancy start date is required.'],
    },

    endDate: {
      type: Date,
      default: null,
      required: function (this: ITenancy) {
        return this.status === 'ended';
      },
    },

    status: {
      type: String,
      enum: TENANCY_STATUSES,
      required: true,
      default: 'active',
    },

    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, 'Tenancy note cannot exceed 2000 characters.'],
    },

    moveOutNote: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, 'Move-out note cannot exceed 2000 characters.'],
    },

    rentTerms: {
      type: rentTermsSchema,
      default: null,
    },

    rentRateHistory: {
      type: [rentRateHistorySchema],
      default: [],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    endedBy: {
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

tenancySchema.index({
  ownerId: 1,
  status: 1,
  createdAt: -1,
});

tenancySchema.index({
  propertyId: 1,
  status: 1,
  startDate: -1,
});

tenancySchema.index({
  apartmentId: 1,
  startDate: -1,
});

tenancySchema.index({
  tenantId: 1,
  startDate: -1,
});

/*
 * একই apartment-এ একসঙ্গে একাধিক active tenant আটকায়।
 * Pre-check race condition হলেও MongoDB এই constraint enforce করবে।
 */
tenancySchema.index(
  { apartmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_tenant_per_apartment',
  },
);

/* একই tenant-কে একসঙ্গে একাধিক apartment-এ assign করা যাবে না। */
tenancySchema.index(
  { tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_apartment_per_tenant',
  },
);

export const TenancyModel = model<ITenancy>('Tenancy', tenancySchema);
