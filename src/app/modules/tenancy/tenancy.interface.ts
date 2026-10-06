import { Types } from 'mongoose';

export const TENANCY_STATUSES = ['active', 'ended'] as const;

export type TTenancyStatus = (typeof TENANCY_STATUSES)[number];

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
