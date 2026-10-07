import { Types } from 'mongoose';

export const TENANCY_STATUSES = ['active', 'ended'] as const;

export type TTenancyStatus = (typeof TENANCY_STATUSES)[number];

export const NOTICE_PERIOD_UNITS = ['days', 'months'] as const;
export type TNoticePeriodUnit = (typeof NOTICE_PERIOD_UNITS)[number];

export interface IRentTerms {
  baseRent: number;
  dueDay: number;
  effectiveFrom: Date;
  noticePeriod: {
    value: number;
    unit: TNoticePeriodUnit;
  };
  rentRevision: {
    intervalMonths?: number | null;
    nextRevisionDate?: Date | null;
    note?: string | null;
  };
  securityDeposit?: number | null;
  advanceAmount?: number | null;
  agreementStartDate?: Date | null;
  agreementEndDate?: Date | null;
  note?: string | null;
}

export interface IRentRateHistory {
  amount: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  changedBy: Types.ObjectId;
  note?: string | null;
}

export interface ITenancy {
  apartmentId: Types.ObjectId;
  propertyId: Types.ObjectId;
  tenantId: Types.ObjectId;
  ownerId: Types.ObjectId;

  startDate: Date;
  endDate?: Date | null;
  status: TTenancyStatus;

  note?: string | null;
  moveOutNote?: string | null;

  rentTerms?: IRentTerms | null;
  rentRateHistory: IRentRateHistory[];

  createdBy: Types.ObjectId;
  endedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreateTenancyPayload = {
  apartmentId: string;
  tenantId: string;
  startDate: string | Date;
  note?: string | null;
  rentTerms?: TUpsertRentTermsPayload;
};

export type TUpsertRentTermsPayload = {
  baseRent: number;
  dueDay?: number;
  effectiveFrom?: string | Date;
  noticePeriod?: {
    value: number;
    unit: TNoticePeriodUnit;
  };
  rentRevision?: {
    intervalMonths?: number | null;
    nextRevisionDate?: string | Date | null;
    note?: string | null;
  };
  securityDeposit?: number | null;
  advanceAmount?: number | null;
  agreementStartDate?: string | Date | null;
  agreementEndDate?: string | Date | null;
  note?: string | null;
  rateChangeNote?: string | null;
};

export type TEndTenancyPayload = {
  endDate: string | Date;
  moveOutNote?: string | null;
};

export type TTenancyListQuery = {
  ownerId?: string;
  propertyId?: string;
  apartmentId?: string;
  tenantId?: string;
  status?: TTenancyStatus;
  page?: number;
  limit?: number;
};
