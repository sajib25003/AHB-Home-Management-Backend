import { Types } from 'mongoose';

export const APARTMENT_ELECTRICITY_BILLING_TYPES = [
  'postpaid',
  'prepaid',
  'submeter',
  'includedInRent',
  'notApplicable',
] as const;

export const ELECTRICITY_PAYMENT_RESPONSIBILITIES = [
  'ownerCollects',
  'tenantPaysDirectly',
  'notApplicable',
] as const;

export type TApartmentElectricityBillingType =
  (typeof APARTMENT_ELECTRICITY_BILLING_TYPES)[number];
export type TElectricityPaymentResponsibility =
  (typeof ELECTRICITY_PAYMENT_RESPONSIBILITIES)[number];

export interface IApartmentElectricityConfig {
  billingType: TApartmentElectricityBillingType;
  paymentResponsibility: TElectricityPaymentResponsibility;
  meterNumber?: string | null;
  note?: string | null;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

export interface IApartment {
  propertyId: Types.ObjectId;
  apartmentNumber: string;
  note?: string | null;

  createdBy: Types.ObjectId;

  electricityConfig?: IApartmentElectricityConfig | null;

  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;

  // Populated virtual; MongoDB document-এ আলাদা করে save হয় না।
  currentTenancy?: unknown;
}

export type TCreateApartmentPayload = {
  apartmentNumber: string;
  note?: string | null;
};

export type TUpdateApartmentPayload = Partial<
  Pick<IApartment, 'apartmentNumber' | 'note'>
>;

export type TUpdateApartmentElectricityConfigPayload = {
  billingType: TApartmentElectricityBillingType;
  paymentResponsibility?: TElectricityPaymentResponsibility;
  meterNumber?: string | null;
  note?: string | null;
};
