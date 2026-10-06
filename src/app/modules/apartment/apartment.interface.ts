import { Types } from 'mongoose';

export interface IApartment {
  propertyId: Types.ObjectId;
  apartmentNumber: string;
  note?: string | null;

  createdBy: Types.ObjectId;

  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreateApartmentPayload = {
  apartmentNumber: string;
  note?: string | null;
};

export type TUpdateApartmentPayload = Partial<
  Pick<IApartment, 'apartmentNumber' | 'note'>
>;
