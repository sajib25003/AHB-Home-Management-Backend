import { Types } from 'mongoose';
import { ApartmentModel } from '../apartment/apartment.model';
import { PropertyModel } from '../property/property.model';
import type { TPropertyActor } from '../property/property.service';
import { MonthlyRentBillModel } from '../rent-bill/rent-bill.model';
import { ElectricityServices } from './electricity.service';
import { SubmeterReadingModel } from './submeter.model';

export type SubmeterPayload = {
  apartmentId: string;
  billingPeriod: string;
  previousReading: number;
  currentReading: number;
  meterCharge?: number;
  adjustmentAmount?: number;
};

const loadContext = async (
  apartmentId: string,
  billingPeriod: string,
  actor: TPropertyActor,
) => {
  if (!['owner', 'superAdmin'].includes(actor.role))
    throw new Error('You are not authorized to manage submeter readings.');
  if (
    !Types.ObjectId.isValid(actor.id) ||
    !Types.ObjectId.isValid(apartmentId)
  )
    throw new Error('Apartment ID is invalid.');
  if (
    typeof billingPeriod !== 'string' ||
    !/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(billingPeriod)
  )
    throw new Error('Billing period is invalid.');
  const apartment = await ApartmentModel.findOne({ _id: apartmentId, isDeleted: { $ne: true } });
  if (!apartment) throw new Error('Apartment not found.');
  const property = await PropertyModel.findOne({
    _id: apartment.propertyId,
    isDeleted: { $ne: true },
    ...(actor.role === 'owner' ? { ownerId: actor.id } : {}),
  });
  const [year, month] = billingPeriod.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  if (!property) throw new Error('Property not found or access was denied.');
  if (
    apartment.electricityConfig?.billingType !== 'submeter' ||
    apartment.electricityConfig.paymentResponsibility !== 'ownerCollects'
  )
    throw new Error(
      'Apartment must use submeter billing with owner collection.',
    );
  const meterNumber = apartment.electricityConfig.meterNumber?.trim();
  if (!meterNumber)
    throw new Error(
      'Submeter number is required in apartment electricity settings.',
    );
  if (!property.electricitySettings?.providerId)
    throw new Error('Electricity provider is required in property settings.');
  const [existing, previous, later, issuedBill] = await Promise.all([
    SubmeterReadingModel.findOne({
      apartmentId: apartment._id,
      billingPeriod,
    }).lean(),
    SubmeterReadingModel.findOne({
      apartmentId: apartment._id,
      meterNumber,
      billingPeriod: { $lt: billingPeriod },
    })
      .sort({ billingPeriod: -1 })
      .lean(),
    SubmeterReadingModel.exists({
      apartmentId: apartment._id,
      meterNumber,
      billingPeriod: { $gt: billingPeriod },
    }),
    MonthlyRentBillModel.exists({ apartmentId: apartment._id, billingPeriod }),
  ]);
  return {
    apartment,
    property,
    meterNumber,
    existing,
    previous,
    later,
    issuedBill,
    start,
  };
};

const getContext = async (
  apartmentId: string,
  billingPeriod: string,
  actor: TPropertyActor,
) => {
  const context = await loadContext(apartmentId, billingPeriod, actor);
  return {
    meterNumber: context.meterNumber,
    previousReading: context.previous?.currentReading ?? null,
    previousPeriod: context.previous?.billingPeriod ?? null,
    existing: context.existing,
    locked: Boolean(context.later || context.issuedBill),
  };
};

const prepare = async (payload: SubmeterPayload, actor: TPropertyActor) => {
  const context = await loadContext(
    payload.apartmentId,
    payload.billingPeriod,
    actor,
  );
  const currentPeriod = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const nowPeriod = `${currentPeriod.find((part) => part.type === 'year')?.value}-${currentPeriod.find((part) => part.type === 'month')?.value}`;
  if (payload.billingPeriod > nowPeriod)
    throw new Error('Cannot save readings for a future billing month.');
  if (context.existing)
    throw new Error(
      'A submeter reading already exists for this apartment and month.',
    );
  if (context.later)
    throw new Error(
      'Cannot insert an earlier reading after a later month has been saved.',
    );
  if (context.issuedBill)
    throw new Error(
      'Cannot save a reading after a rent bill has been issued for this month.',
    );
  for (const value of [
    payload.previousReading,
    payload.currentReading,
    payload.meterCharge ?? 0,
  ]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      throw new Error(
        'Reading and meter charge must be valid non-negative numbers.',
      );
  }
  if (payload.currentReading < payload.previousReading)
    throw new Error('Current reading cannot be less than previous reading.');
  if (context.previous && payload.previousReading !== context.previous.currentReading) {
    throw new Error('Previous reading must match the last saved current reading for this apartment meter.');
  }
  const consumedUnit = Number(
    (payload.currentReading - payload.previousReading).toFixed(2),
  );
  const calculation = await ElectricityServices.calculateElectricityBill(
    {
      providerId: context.property.electricitySettings!.providerId.toString(),
      consumedUnit,
      applicableDate: context.start,
      meterChargeOverride: payload.meterCharge ?? 0,
      adjustmentAmount: payload.adjustmentAmount ?? 0,
    },
    actor,
  );
  if (calculation.totalAmount < 0)
    throw new Error('Electricity total cannot be negative.');
  return { context, calculation, consumedUnit };
};

const preview = async (payload: SubmeterPayload, actor: TPropertyActor) =>
  (await prepare(payload, actor)).calculation;
const save = async (payload: SubmeterPayload, actor: TPropertyActor) => {
  const { context, calculation, consumedUnit } = await prepare(payload, actor);
  return SubmeterReadingModel.create({
    ownerId: context.property.ownerId,
    propertyId: context.property._id,
    apartmentId: context.apartment._id,
    billingPeriod: payload.billingPeriod,
    meterNumber: context.meterNumber,
    previousReading: payload.previousReading,
    currentReading: payload.currentReading,
    consumedUnit,
    calculation,
    createdBy: actor.id,
  });
};
export const SubmeterServices = { getContext, preview, save };
