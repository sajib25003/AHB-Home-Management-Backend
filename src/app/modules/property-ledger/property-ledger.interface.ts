import { Types } from 'mongoose';

export const LEDGER_ENTRY_STATUSES = ['pending', 'paid', 'skipped'] as const;
export const LEDGER_TEMPLATE_FREQUENCIES = [
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const;
export const LEDGER_INCOME_STATUSES = ['pending', 'received'] as const;

export type TLedgerEntryStatus = (typeof LEDGER_ENTRY_STATUSES)[number];
export type TLedgerIncomeStatus = (typeof LEDGER_INCOME_STATUSES)[number];
export type TLedgerTemplateFrequency =
  (typeof LEDGER_TEMPLATE_FREQUENCIES)[number];

export interface IPropertyExpenseCategory {
  ownerId: Types.ObjectId;
  key: string;
  name: string;
  isActive: boolean;
  isSystemDefault: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPropertyExpenseTemplate {
  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId?: Types.ObjectId | null;
  categoryId: Types.ObjectId;
  title: string;
  defaultAmount?: number | null;
  frequency: TLedgerTemplateFrequency;
  months: number[];
  activeFrom: string;
  activeTo?: string | null;
  dueDay?: number | null;
  note?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPropertyExpense {
  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId?: Types.ObjectId | null;
  categoryId: Types.ObjectId;
  templateId?: Types.ObjectId | null;
  period: string;
  expenseDate?: Date | null;
  title: string;
  amount?: number | null;
  status: TLedgerEntryStatus;
  source: 'template' | 'manual';
  note?: string | null;
  paymentMethod?: string | null;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPropertyIncome {
  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId?: Types.ObjectId | null;
  period: string;
  receivedDate?: Date | null;
  title: string;
  amount: number;
  status: TLedgerIncomeStatus;
  note?: string | null;
  paymentMethod?: string | null;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreateExpenseCategoryPayload = {
  name: string;
};

export type TCreateExpenseTemplatePayload = {
  ownerId?: string;
  propertyId: string;
  apartmentId?: string | null;
  categoryId: string;
  title: string;
  defaultAmount?: number | null;
  frequency?: TLedgerTemplateFrequency;
  months?: number[];
  activeFrom: string;
  activeTo?: string | null;
  dueDay?: number | null;
  note?: string | null;
  isActive?: boolean;
};

export type TCreateExpensePayload = {
  ownerId?: string;
  propertyId: string;
  apartmentId?: string | null;
  categoryId: string;
  period: string;
  expenseDate?: string | Date | null;
  title: string;
  amount?: number | null;
  status?: TLedgerEntryStatus;
  note?: string | null;
  paymentMethod?: string | null;
};

export type TCreateIncomePayload = {
  ownerId?: string;
  propertyId: string;
  apartmentId?: string | null;
  period: string;
  receivedDate?: string | Date | null;
  title: string;
  amount: number;
  status?: TLedgerIncomeStatus;
  note?: string | null;
  paymentMethod?: string | null;
};
