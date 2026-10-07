import { Types } from 'mongoose';

import type {
  TElectricityConsumerCategory,
  TElectricityMeterPhase,
} from '../electricity/electricity.interface';

export interface IPropertyElectricitySettings {
  providerId: Types.ObjectId;
  consumerCategory: TElectricityConsumerCategory;
  accountNumber?: string | null;
  defaultMeterPhase: TElectricityMeterPhase;
  tariffSelection: 'automatic';
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

export interface IProperty {
  name: string;
  address: string;
  note?: string | null;

  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;

  electricitySettings?: IPropertyElectricitySettings | null;

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

export type TUpdatePropertyElectricitySettingsPayload = {
  providerId: string;
  consumerCategory?: TElectricityConsumerCategory;
  accountNumber?: string | null;
  defaultMeterPhase?: TElectricityMeterPhase;
};
