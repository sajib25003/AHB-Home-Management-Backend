import { Types } from 'mongoose';

export const CHARGE_CALCULATION_MODES = [
  'fixed',
  'monthlyVariable',
  'submeter',
  'includedInRent',
  'tenantManaged',
  'notApplicable',
] as const;

export type TChargeCalculationMode = (typeof CHARGE_CALCULATION_MODES)[number];

export interface IChargeCategory {
  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  name: string;
  code: string;
  defaultMode: TChargeCalculationMode;
  isSystemDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TCreateChargeCategoryPayload = {
  propertyId: string;
  name: string;
  code?: string;
  defaultMode: TChargeCalculationMode;
  sortOrder?: number;
};

export type TUpdateChargeCategoryPayload = Partial<
  Pick<
    IChargeCategory,
    'name' | 'defaultMode' | 'isActive' | 'sortOrder'
  >
>;
