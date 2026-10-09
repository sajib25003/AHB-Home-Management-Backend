import { Types } from 'mongoose';
import { ApartmentModel } from '../apartment/apartment.model';
import { PropertyModel } from '../property/property.model';
import type { TPropertyActor } from '../property/property.service';
import { MonthlyRentBillModel } from '../rent-bill/rent-bill.model';
import { ElectricityServices } from './electricity.service';
import {
  type SubmeterCalculation,
  SubmeterReadingModel,
} from './submeter.model';

export type SubmeterPayload = {
  apartmentId: string;
  billingPeriod: string;
  previousReadingDate: string;
  currentReadingDate: string;
  expectedRevision?: number | null;
  meterPhase?: 'singlePhase' | 'threePhase';
  connectedLoad?: number;
  useAverageRate?: boolean;
  averageRate?: number | null;
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
  if (!Types.ObjectId.isValid(actor.id) || !Types.ObjectId.isValid(apartmentId))
    throw new Error('Apartment ID is invalid.');
  if (
    typeof billingPeriod !== 'string' ||
    !/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(billingPeriod)
  )
    throw new Error('Billing period is invalid.');
  const apartment = await ApartmentModel.findOne({
    _id: apartmentId,
    isDeleted: { $ne: true },
  });
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
  const [existing, previous] = await Promise.all([
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
  ]);
  return {
    apartment,
    property,
    meterNumber,
    existing,
    previous,
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
    previousReadingDate: context.previous?.currentReadingDate ?? null,
    previousMeterCharge: context.previous?.calculation.meterCharge ?? null,
    meterPhase: context.previous?.meterPhase ?? null,
    connectedLoad: context.previous?.connectedLoad ?? null,
    locked: false,
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
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const date of [
    payload.previousReadingDate,
    payload.currentReadingDate,
  ]) {
    if (
      typeof date !== 'string' ||
      !datePattern.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    )
      throw new Error('A valid date is required for each reading.');
  }
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const today = `${todayParts.find((part) => part.type === 'year')?.value}-${todayParts.find((part) => part.type === 'month')?.value}-${todayParts.find((part) => part.type === 'day')?.value}`;
  if (payload.currentReadingDate > today)
    throw new Error('Current reading date cannot be in the future.');
  if (payload.previousReadingDate > payload.currentReadingDate)
    throw new Error(
      'Previous reading date cannot be after current reading date.',
    );
  const consumedUnit = Number(
    (payload.currentReading - payload.previousReading).toFixed(2),
  );
  if (
    payload.useAverageRate !== undefined &&
    typeof payload.useAverageRate !== 'boolean'
  )
    throw new Error('Average rate option is invalid.');
  if (
    payload.meterPhase !== undefined &&
    !['singlePhase', 'threePhase'].includes(payload.meterPhase)
  )
    throw new Error('Meter phase is invalid.');
  if (
    payload.connectedLoad !== undefined &&
    (typeof payload.connectedLoad !== 'number' ||
      !Number.isFinite(payload.connectedLoad) ||
      payload.connectedLoad <= 0)
  )
    throw new Error('Sanctioned load must be a valid positive number in kW.');
  if (
    !payload.useAverageRate &&
    payload.meterCharge === undefined &&
    (!payload.meterPhase || payload.connectedLoad === undefined)
  )
    throw new Error(
      'Meter phase and sanctioned load are required for automatic tariff charges.',
    );
  let calculation: SubmeterCalculation;
  if (payload.useAverageRate) {
    const rate = payload.averageRate;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)
      throw new Error('Average rate must be a valid positive amount per unit.');
    const adjustment = payload.adjustmentAmount ?? 0;
    if (typeof adjustment !== 'number' || !Number.isFinite(adjustment))
      throw new Error('Electricity adjustment amount is invalid.');
    const round = (value: number) => Number(value.toFixed(2));
    const energyCharge = round(consumedUnit * rate);
    const meterCharge = round(payload.meterCharge ?? 0);
    const adjustmentAmount = round(adjustment);
    calculation = {
      tariff: {
        id: null,
        name: `Manual average rate · ৳${rate}/unit`,
        effectiveFrom: context.start,
        effectiveTo: null,
        lifeline: { maximumUnit: 0, rate },
        slabs: [],
        demandChargePerKw: 0,
        vatPercentage: 0,
      },
      consumedUnit,
      breakdown: [
        {
          label: 'Average rate',
          unit: consumedUnit,
          rate,
          amount: energyCharge,
        },
      ],
      energyCharge,
      demandCharge: 0,
      meterCharge,
      vatAmount: 0,
      adjustmentAmount,
      totalAmount: round(energyCharge + meterCharge + adjustmentAmount),
    };
    if (!Number.isFinite(calculation.totalAmount))
      throw new Error('Electricity total is invalid.');
  } else {
    if (!context.property.electricitySettings?.providerId)
      throw new Error('Electricity provider is required in property settings.');
    calculation = await ElectricityServices.calculateElectricityBill(
      {
        providerId: context.property.electricitySettings.providerId.toString(),
        consumedUnit,
        applicableDate: context.start,
        meterPhase: payload.meterPhase,
        connectedLoad: payload.connectedLoad,
        ...(payload.meterCharge !== undefined
          ? { meterChargeOverride: payload.meterCharge }
          : {}),
        adjustmentAmount: payload.adjustmentAmount ?? 0,
      },
      actor,
    );
  }
  if (calculation.totalAmount < 0)
    throw new Error('Electricity total cannot be negative.');
  const dueBills = await MonthlyRentBillModel.find({
    apartmentId: context.apartment._id,
    billingPeriod: payload.billingPeriod,
    status: 'due',
  }).lean();
  for (const bill of dueBills) {
    const otherCharges = bill.items
      .filter((item) => item.key !== 'ELECTRICITY')
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    if (otherCharges + calculation.totalAmount + bill.adjustmentAmount < 0)
      throw new Error(
        'This correction would make a rent bill total negative. Update its adjustment first.',
      );
  }

  return { context, calculation, consumedUnit };
};

const preview = async (payload: SubmeterPayload, actor: TPropertyActor) =>
  (await prepare(payload, actor)).calculation;
const syncRentBills = async (
  reading: Record<string, unknown>,
  apartmentId: Types.ObjectId,
  ownerId: Types.ObjectId,
  actorId: string,
  billingPeriod: string,
  totalAmount: number,
) => {
  // Pipeline updates preserve concurrently edited non-electricity charges and paid receipts.
  return MonthlyRentBillModel.updateMany(
    {
      apartmentId,
      ownerId,
      billingPeriod,
      status: 'due',
      $or: [
        { 'submeterReading.revision': { $lte: Number(reading.revision ?? 0) } },
        { 'submeterReading.revision': { $exists: false } },
      ],
    },
    [
      {
        $set: {
          items: {
            $cond: [
              {
                $in: [
                  'ELECTRICITY',
                  { $map: { input: '$items', as: 'item', in: '$$item.key' } },
                ],
              },
              {
                $map: {
                  input: '$items',
                  as: 'item',
                  in: {
                    $cond: [
                      { $eq: ['$$item.key', 'ELECTRICITY'] },
                      { $mergeObjects: ['$$item', { amount: totalAmount }] },
                      '$$item',
                    ],
                  },
                },
              },
              {
                $concatArrays: [
                  '$items',
                  [
                    {
                      categoryId: null,
                      key: 'ELECTRICITY',
                      label: 'Electricity Bill',
                      type: 'variable',
                      amount: totalAmount,
                    },
                  ],
                ],
              },
            ],
          },
          submeterReading: { $literal: reading },
          submeterManaged: true,
          updatedBy: new Types.ObjectId(actorId),
          updatedAt: new Date(),
        },
      },
      {
        $set: {
          subtotal: {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: { $ifNull: ['$$item.amount', 0] },
              },
            },
          },
        },
      },
      {
        $set: {
          totalAmount: {
            $round: [
              { $add: ['$subtotal', { $ifNull: ['$adjustmentAmount', 0] }] },
              2,
            ],
          },
        },
      },
    ],
  );
};

const save = async (payload: SubmeterPayload, actor: TPropertyActor) => {
  const { context, calculation, consumedUnit } = await prepare(payload, actor);
  const data = {
    ownerId: context.property.ownerId,
    propertyId: context.property._id,
    apartmentId: context.apartment._id,
    billingPeriod: payload.billingPeriod,
    meterNumber: context.meterNumber,
    previousReading: payload.previousReading,
    currentReading: payload.currentReading,
    previousReadingDate: payload.previousReadingDate,
    currentReadingDate: payload.currentReadingDate,
    consumedUnit,
    calculation,
    meterPhase: payload.meterPhase ?? null,
    connectedLoad: payload.connectedLoad ?? null,
    meterChargeOverride: payload.meterCharge ?? null,
    useAverageRate: payload.useAverageRate ?? false,
    averageRate: payload.useAverageRate ? payload.averageRate : null,
    updatedBy: actor.id,
  };
  let record;
  if (context.existing) {
    if (payload.expectedRevision !== (context.existing.revision ?? 0))
      throw new Error('This reading has changed. Reload before editing.');
    record = await SubmeterReadingModel.findOneAndUpdate(
      {
        _id: context.existing._id,
        $or: [
          { revision: payload.expectedRevision },
          ...(payload.expectedRevision === 0
            ? [{ revision: { $exists: false } }]
            : []),
        ],
      },
      { $set: data, $inc: { revision: 1 } },
      { new: true, runValidators: true },
    );
    if (!record)
      throw new Error('This reading has changed. Reload before editing.');
  } else {
    record = await SubmeterReadingModel.create({
      ...data,
      createdBy: actor.id,
      revision: 0,
    });
  }
  const reading = record.toObject();
  try {
    const result = await syncRentBills(
      reading as unknown as Record<string, unknown>,
      context.apartment._id,
      context.property.ownerId,
      actor.id,
      payload.billingPeriod,
      calculation.totalAmount,
    );
    return { ...reading, syncedRentBills: result.modifiedCount };
  } catch (error) {
    console.error('Submeter saved but rent bill sync failed', error);
    return {
      ...reading,
      syncWarning:
        'Reading saved, but rent bill sync failed. Reload and save again to retry.',
    };
  }
};

const history = async (
  apartmentId: string,
  year: number,
  actor: TPropertyActor,
) => {
  if (!Number.isInteger(year) || year < 2000 || year > 2200)
    throw new Error('Billing year is invalid.');
  const { apartment } = await loadContext(apartmentId, `${year}-01`, actor);
  const [readings, bills] = await Promise.all([
    SubmeterReadingModel.find({
      apartmentId: apartment._id,
      billingPeriod: { $regex: `^${year}-` },
    })
      .sort({ billingPeriod: 1 })
      .lean(),
    MonthlyRentBillModel.find({
      apartmentId: apartment._id,
      billingPeriod: { $regex: `^${year}-` },
      status: { $ne: 'void' },
    })
      .select('billingPeriod status')
      .lean(),
  ]);
  return readings.map((reading) => ({
    ...reading,
    status: bills.some(
      (bill) =>
        bill.billingPeriod === reading.billingPeriod && bill.status === 'due',
    )
      ? 'due'
      : bills.some(
            (bill) =>
              bill.billingPeriod === reading.billingPeriod &&
              bill.status === 'paid',
          )
        ? 'paid'
        : 'notBilled',
  }));
};
export const SubmeterServices = { getContext, preview, save, history };
