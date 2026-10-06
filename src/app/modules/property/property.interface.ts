import { Types } from 'mongoose';

export interface IProperty {
  name: string;
  address: string;
  note?: string | null;

  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;

  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreatePropertyPayload = {
  name: string;
  address: string;
  note?: string | null;
  ownerId?: string | null;
};

export type TUpdatePropertyPayload = Partial<
  Pick<IProperty, 'name' | 'address' | 'note'>
>;
