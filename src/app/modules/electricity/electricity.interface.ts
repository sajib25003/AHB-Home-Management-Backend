import { Types } from 'mongoose';

export const ELECTRICITY_CONSUMER_CATEGORIES = ['LT_A_RESIDENTIAL'] as const;

export const ELECTRICITY_TARIFF_SCOPES = [
  'national',
  'providerSpecific',
] as const;

export const ELECTRICITY_METER_PHASES = ['singlePhase', 'threePhase'] as const;

export type TElectricityConsumerCategory =
  (typeof ELECTRICITY_CONSUMER_CATEGORIES)[number];
export type TElectricityTariffScope =
  (typeof ELECTRICITY_TARIFF_SCOPES)[number];
export type TElectricityMeterPhase = (typeof ELECTRICITY_METER_PHASES)[number];

export interface IElectricityProvider {
  name: string;
  code: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITariffLifeline {
  maximumUnit: number;
  rate: number;
}

export interface ITariffSlab {
  fromUnit: number;
  toUnit: number | null;
  rate: number;
}

export interface IMeterCharge {
  meterPhase: TElectricityMeterPhase;
  loadFrom?: number | null;
  loadTo?: number | null;
  amount: number;
}

export interface IElectricityTariffSchedule {
  name: string;
  consumerCategory: TElectricityConsumerCategory;
  scope: TElectricityTariffScope;
  providerId?: Types.ObjectId | null;

  effectiveFrom: Date;
  effectiveTo?: Date | null;

  lifeline: ITariffLifeline;
  slabs: ITariffSlab[];
  demandChargePerKw?: number;
  vatPercentage: number;
  meterCharges: IMeterCharge[];

  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreateElectricityProviderPayload = {
  name: string;
  code: string;
};

export type TUpdateElectricityProviderPayload = Partial<
  Pick<IElectricityProvider, 'name' | 'isActive'>
>;

export type TCreateElectricityTariffPayload = Omit<
  IElectricityTariffSchedule,
  'providerId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'isActive'
> & {
  providerId?: string | null;
};

export type TElectricityTariffListQuery = {
  providerId?: string;
  scope?: TElectricityTariffScope;
  consumerCategory?: TElectricityConsumerCategory;
  activeOnly?: boolean;
};

export type TCalculateElectricityBillPayload = {
  providerId: string;
  consumedUnit: number;
  applicableDate?: string | Date;
  consumerCategory?: TElectricityConsumerCategory;
  meterPhase?: TElectricityMeterPhase;
  connectedLoad?: number;
  meterChargeOverride?: number;
  adjustmentAmount?: number;
};
