import { Types } from 'mongoose';

export const RENT_BILL_STATUSES = ['due', 'paid', 'void'] as const;
export const RENT_BILL_ITEM_TYPES = [
  'fixed',
  'variable',
  'adjustment',
  'custom',
] as const;
export const PAYMENT_METHODS = [
  'cash',
  'bank',
  'mobileBanking',
  'other',
] as const;

export type TRentBillStatus = (typeof RENT_BILL_STATUSES)[number];
export type TRentBillItemType = (typeof RENT_BILL_ITEM_TYPES)[number];
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface IRentBillItem {
  categoryId?: Types.ObjectId | null;
  key: string;
  label: string;
  amount: number;
  type: TRentBillItemType;
}

export interface IRentBillStatusHistory {
  status: TRentBillStatus;
  changedBy: Types.ObjectId;
  changedAt: Date;
  note?: string | null;
}

export interface IMonthlyRentBill {
  receiptNumber: string;
  billingPeriod: string;

  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId: Types.ObjectId;
  tenantId: Types.ObjectId;
  tenantAssignmentId: Types.ObjectId;

  ownerSnapshot: {
    name: string;
    phone?: string | null;
  };
  propertySnapshot: {
    name: string;
    address: string;
  };
  apartmentSnapshot: {
    apartmentNumber: string;
  };
  tenantSnapshot: {
    name: string;
    email: string;
    phone?: string | null;
  };

  items: IRentBillItem[];
  subtotal: number;
  adjustmentAmount: number;
  adjustmentNote?: string | null;
  totalAmount: number;

  status: TRentBillStatus;
  issuedAt: Date;
  dueDate?: Date | null;
  paidAt?: Date | null;
  paymentMethod?: TPaymentMethod | null;
  paymentNote?: string | null;
  note?: string | null;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  statusHistory: IRentBillStatusHistory[];

  createdAt?: Date;
  updatedAt?: Date;
}

export type TRentBillItemPayload = {
  categoryId?: string | null;
  key?: string;
  label: string;
  amount: number;
  type: TRentBillItemType;
};

export type TCreateRentBillPayload = {
  tenantAssignmentId: string;
  billingPeriod: string;
  items: TRentBillItemPayload[];
  adjustmentAmount?: number;
  adjustmentNote?: string | null;
  dueDate?: string | Date | null;
  note?: string | null;
};

export type TUpdateRentBillPayload = Pick<
  TCreateRentBillPayload,
  | 'items'
  | 'adjustmentAmount'
  | 'adjustmentNote'
  | 'dueDate'
  | 'note'
>;

export type TUpdateRentBillStatusPayload = {
  status: TRentBillStatus;
  paidAt?: string | Date | null;
  paymentMethod?: TPaymentMethod | null;
  paymentNote?: string | null;
  reason?: string | null;
};

export type TRentBillListQuery = {
  year?: number;
  ownerId?: string;
  propertyId?: string;
  apartmentId?: string;
  tenantId?: string;
  status?: TRentBillStatus;
  page?: number;
  limit?: number;
};
