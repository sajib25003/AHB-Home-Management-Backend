import { model, Schema, Types } from 'mongoose';
import type { ElectricityServices } from './electricity.service';

type ProviderCalculation = Awaited<
  ReturnType<typeof ElectricityServices.calculateElectricityBill>
>;
export type SubmeterCalculation = Omit<ProviderCalculation, 'tariff'> & {
  tariff: Omit<ProviderCalculation['tariff'], 'id'> & {
    id: Types.ObjectId | null;
  };
};
export interface ISubmeterReading {
  ownerId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId: Types.ObjectId;
  billingPeriod: string;
  meterNumber: string;
  previousReadingDate: string;
  currentReadingDate: string;
  revision: number;
  useAverageRate?: boolean;
  averageRate?: number | null;
  updatedBy?: Types.ObjectId;
  previousReading: number;
  currentReading: number;
  consumedUnit: number;
  calculation: SubmeterCalculation;
  createdBy: Types.ObjectId;
  createdAt?: Date;
}
const schema = new Schema<ISubmeterReading>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    apartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true,
    },
    billingPeriod: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    meterNumber: { type: String, required: true },
    previousReadingDate: { type: String, required: true },
    currentReadingDate: { type: String, required: true },
    revision: { type: Number, default: 0 },
    useAverageRate: { type: Boolean, default: false },
    averageRate: { type: Number, min: 0, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    previousReading: { type: Number, min: 0, required: true },
    currentReading: { type: Number, min: 0, required: true },
    consumedUnit: { type: Number, min: 0, required: true },
    calculation: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ apartmentId: 1, billingPeriod: 1 }, { unique: true });
schema.index({ apartmentId: 1, meterNumber: 1, billingPeriod: -1 });
export const SubmeterReadingModel = model<ISubmeterReading>(
  'SubmeterReading',
  schema,
);
