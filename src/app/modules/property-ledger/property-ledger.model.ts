import { model, Schema } from 'mongoose';

import {
  IPropertyExpense,
  IPropertyExpenseCategory,
  IPropertyExpenseTemplate,
  IPropertyIncome,
  LEDGER_ENTRY_STATUSES,
  LEDGER_INCOME_STATUSES,
  LEDGER_TEMPLATE_FREQUENCIES,
} from './property-ledger.interface';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const expenseCategorySchema = new Schema<IPropertyExpenseCategory>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true, index: true },
    isSystemDefault: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);
expenseCategorySchema.index({ ownerId: 1, key: 1 }, { unique: true });

const expenseTemplateSchema = new Schema<IPropertyExpenseTemplate>(
  {
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
      default: null,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'PropertyExpenseCategory',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    defaultAmount: { type: Number, default: null, min: 0 },
    frequency: {
      type: String,
      enum: LEDGER_TEMPLATE_FREQUENCIES,
      default: 'monthly',
    },
    months: [{ type: Number, min: 1, max: 12 }],
    activeFrom: { type: String, required: true, match: monthPattern },
    activeTo: { type: String, default: null, match: monthPattern },
    dueDay: { type: Number, default: null, min: 1, max: 31 },
    note: { type: String, trim: true, default: null, maxlength: 2000 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);
expenseTemplateSchema.index({ ownerId: 1, propertyId: 1, isDeleted: 1 });

const expenseSchema = new Schema<IPropertyExpense>(
  {
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
      default: null,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'PropertyExpenseCategory',
      required: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'PropertyExpenseTemplate',
      default: null,
    },
    period: { type: String, required: true, match: monthPattern, index: true },
    expenseDate: { type: Date, default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: LEDGER_ENTRY_STATUSES,
      default: 'pending',
      index: true,
    },
    source: { type: String, enum: ['template', 'manual'], required: true },
    note: { type: String, trim: true, default: null, maxlength: 2000 },
    paymentMethod: { type: String, trim: true, default: null, maxlength: 100 },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);
expenseSchema.index(
  { templateId: 1, period: 1 },
  {
    unique: true,
    partialFilterExpression: { templateId: { $type: 'objectId' } },
  },
);
expenseSchema.index({ ownerId: 1, propertyId: 1, period: -1, status: 1 });

const incomeSchema = new Schema<IPropertyIncome>(
  {
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
      default: null,
    },
    period: { type: String, required: true, match: monthPattern, index: true },
    receivedDate: { type: Date, default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: LEDGER_INCOME_STATUSES,
      default: 'received',
      index: true,
    },
    note: { type: String, trim: true, default: null, maxlength: 2000 },
    paymentMethod: { type: String, trim: true, default: null, maxlength: 100 },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);
incomeSchema.index({ ownerId: 1, propertyId: 1, period: -1, status: 1 });

export const PropertyExpenseCategoryModel = model<IPropertyExpenseCategory>(
  'PropertyExpenseCategory',
  expenseCategorySchema,
);
export const PropertyExpenseTemplateModel = model<IPropertyExpenseTemplate>(
  'PropertyExpenseTemplate',
  expenseTemplateSchema,
);
export const PropertyExpenseModel = model<IPropertyExpense>(
  'PropertyExpense',
  expenseSchema,
);
export const PropertyIncomeModel = model<IPropertyIncome>(
  'PropertyIncome',
  incomeSchema,
);
