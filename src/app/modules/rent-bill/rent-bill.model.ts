import { model, Schema } from 'mongoose';

import {
  IMonthlyRentBill,
  PAYMENT_METHODS,
  RENT_BILL_ITEM_TYPES,
  RENT_BILL_STATUSES,
} from './rent-bill.interface';

const rentBillItemSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ChargeCategory',
      default: null,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    amount: {
      type: Number,
      default: null,
      min: 0,
    },
    type: {
      type: String,
      enum: RENT_BILL_ITEM_TYPES,
      required: true,
    },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: RENT_BILL_STATUSES,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
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

const monthlyRentBillSchema = new Schema<IMonthlyRentBill>(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    billingPeriod: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Billing period is invalid.'],
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    apartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenancy',
      required: true,
      index: true,
    },
    ownerSnapshot: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, default: null, trim: true },
    },
    propertySnapshot: {
      name: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },
    apartmentSnapshot: {
      apartmentNumber: { type: String, required: true, trim: true },
    },
    tenantSnapshot: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, default: null, trim: true },
    },
    submeterManaged: { type: Boolean, default: false },
    submeterReading: { type: Schema.Types.Mixed, default: null },
    items: {
      type: [rentBillItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0 && items.length <= 30,
        message: 'A bill must contain between 1 and 30 items.',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    adjustmentAmount: { type: Number, required: true, default: 0 },
    adjustmentNote: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: RENT_BILL_STATUSES,
      required: true,
      default: 'due',
      index: true,
    },
    issuedAt: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: [...PAYMENT_METHODS, null],
      default: null,
    },
    paymentNote: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

monthlyRentBillSchema.index(
  { tenantAssignmentId: 1, billingPeriod: 1 },
  { unique: true, name: 'one_bill_per_tenancy_period' },
);
monthlyRentBillSchema.index({ ownerId: 1, billingPeriod: -1, status: 1 });
monthlyRentBillSchema.index({ tenantId: 1, billingPeriod: -1, status: 1 });
monthlyRentBillSchema.index({ propertyId: 1, apartmentId: 1, billingPeriod: -1 });

export const MonthlyRentBillModel = model<IMonthlyRentBill>(
  'MonthlyRentBill',
  monthlyRentBillSchema,
);
