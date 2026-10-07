import { FilterQuery, Types } from 'mongoose';

import type { TPropertyActor } from '../property/property.service';
import {
  IElectricityTariffSchedule,
  TCalculateElectricityBillPayload,
  TCreateElectricityProviderPayload,
  TCreateElectricityTariffPayload,
  TElectricityConsumerCategory,
  TElectricityTariffListQuery,
  TUpdateElectricityProviderPayload,
} from './electricity.interface';
import {
  ElectricityProviderModel,
  ElectricityTariffScheduleModel,
} from './electricity.model';

const validateObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensureElectricityReader = (actor: TPropertyActor) => {
  validateObjectId(actor.id, 'Authenticated user ID');

  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error(
      'You are not authorized to view electricity configuration.',
    );
  }
};

const ensureSuperAdmin = (actor: TPropertyActor) => {
  validateObjectId(actor.id, 'Authenticated user ID');

  if (actor.role !== 'superAdmin') {
    throw new Error(
      'Only a super administrator can manage electricity providers and tariffs.',
    );
  }
};

const normalizeProviderCode = (code: string) => {
  const normalizedCode = code?.trim().toUpperCase().replace(/\s+/g, '_');

  if (!normalizedCode || !/^[A-Z0-9_]+$/.test(normalizedCode)) {
    throw new Error(
      'Provider code is required and may contain only letters, numbers and underscores.',
    );
  }

  return normalizedCode;
};

const parseDate = (value: string | Date, fieldName: string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
};

const validateTariffSlabs = (
  slabs: TCreateElectricityTariffPayload['slabs'],
) => {
  if (!Array.isArray(slabs) || slabs.length === 0) {
    throw new Error('At least one tariff slab is required.');
  }

  slabs.forEach((slab, index) => {
    if (
      !Number.isFinite(slab.fromUnit) ||
      slab.fromUnit < 0 ||
      !Number.isFinite(slab.rate) ||
      slab.rate < 0
    ) {
      throw new Error('Tariff slab values are invalid.');
    }

    if (
      slab.toUnit !== null &&
      (!Number.isFinite(slab.toUnit) || slab.toUnit < slab.fromUnit)
    ) {
      throw new Error('Tariff slab ending unit is invalid.');
    }

    if (index === 0 && slab.fromUnit !== 0) {
      throw new Error('The first tariff slab must start from unit 0.');
    }

    if (index > 0) {
      const previousSlab = slabs[index - 1];

      if (previousSlab.toUnit === null) {
        throw new Error('Only the last tariff slab may have no upper limit.');
      }

      if (slab.fromUnit !== previousSlab.toUnit + 1) {
        throw new Error('Tariff slabs must be continuous without gaps.');
      }
    }

    if (slab.toUnit === null && index !== slabs.length - 1) {
      throw new Error('Only the last tariff slab may have no upper limit.');
    }
  });
};

const createProviderIntoDB = async (
  payload: TCreateElectricityProviderPayload,
  actor: TPropertyActor,
) => {
  ensureSuperAdmin(actor);

  const name = payload.name?.trim();

  if (!name) {
    throw new Error('Electricity provider name is required.');
  }

  return ElectricityProviderModel.create({
    name,
    code: normalizeProviderCode(payload.code),
    isActive: true,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const getProvidersFromDB = async (
  actor: TPropertyActor,
  includeInactive = false,
) => {
  ensureElectricityReader(actor);

  const filter =
    includeInactive && actor.role === 'superAdmin' ? {} : { isActive: true };

  return ElectricityProviderModel.find(filter)
    .populate('createdBy', 'name email role')
    .sort({ name: 1 })
    .lean();
};

const updateProviderInDB = async (
  providerId: string,
  payload: TUpdateElectricityProviderPayload,
  actor: TPropertyActor,
) => {
  ensureSuperAdmin(actor);
  validateObjectId(providerId, 'Electricity provider ID');

  const updateData: TUpdateElectricityProviderPayload = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();

    if (!name) {
      throw new Error('Electricity provider name cannot be empty.');
    }

    updateData.name = name;
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') {
      throw new Error('Electricity provider status is invalid.');
    }

    updateData.isActive = payload.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid provider fields were provided.');
  }

  return ElectricityProviderModel.findByIdAndUpdate(
    providerId,
    { $set: updateData },
    { new: true, runValidators: true },
  );
};

const createTariffScheduleIntoDB = async (
  payload: TCreateElectricityTariffPayload,
  actor: TPropertyActor,
) => {
  ensureSuperAdmin(actor);

  const name = payload.name?.trim();

  if (!name) {
    throw new Error('Tariff schedule name is required.');
  }

  if (!['national', 'providerSpecific'].includes(payload.scope)) {
    throw new Error('Electricity tariff scope is invalid.');
  }

  if (payload.consumerCategory !== 'LT_A_RESIDENTIAL') {
    throw new Error('Electricity consumer category is invalid.');
  }

  if (
    !payload.lifeline ||
    !Number.isFinite(payload.lifeline.maximumUnit) ||
    payload.lifeline.maximumUnit < 1 ||
    !Number.isFinite(payload.lifeline.rate) ||
    payload.lifeline.rate < 0
  ) {
    throw new Error('Lifeline tariff is invalid.');
  }

  validateTariffSlabs(payload.slabs);

  if (
    !Number.isFinite(payload.vatPercentage) ||
    payload.vatPercentage < 0 ||
    payload.vatPercentage > 100
  ) {
    throw new Error('VAT percentage is invalid.');
  }

  for (const meterCharge of payload.meterCharges ?? []) {
    if (
      !['singlePhase', 'threePhase'].includes(meterCharge.meterPhase) ||
      !Number.isFinite(meterCharge.amount) ||
      meterCharge.amount < 0 ||
      (meterCharge.loadFrom !== undefined &&
        meterCharge.loadFrom !== null &&
        (!Number.isFinite(meterCharge.loadFrom) || meterCharge.loadFrom < 0)) ||
      (meterCharge.loadTo !== undefined &&
        meterCharge.loadTo !== null &&
        (!Number.isFinite(meterCharge.loadTo) || meterCharge.loadTo < 0))
    ) {
      throw new Error('Electricity meter charge is invalid.');
    }
  }

  const effectiveFrom = parseDate(
    payload.effectiveFrom,
    'Tariff effective date',
  );
  const effectiveTo = payload.effectiveTo
    ? parseDate(payload.effectiveTo, 'Tariff ending date')
    : null;

  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new Error('Tariff ending date cannot be before its effective date.');
  }

  let providerObjectId: Types.ObjectId | null = null;

  if (payload.scope === 'providerSpecific') {
    if (!payload.providerId) {
      throw new Error(
        'An electricity provider is required for a provider-specific tariff.',
      );
    }

    validateObjectId(payload.providerId, 'Electricity provider ID');

    const provider = await ElectricityProviderModel.findOne({
      _id: payload.providerId,
      isActive: true,
    }).select('_id');

    if (!provider) {
      throw new Error('A valid active electricity provider was not found.');
    }

    providerObjectId = provider._id;
  }

  const versionFilter: FilterQuery<IElectricityTariffSchedule> = {
    scope: payload.scope,
    providerId: providerObjectId,
    consumerCategory: payload.consumerCategory,
  };

  const newerOrSameSchedule = await ElectricityTariffScheduleModel.findOne({
    ...versionFilter,
    effectiveFrom: { $gte: effectiveFrom },
  }).select('_id effectiveFrom');

  if (newerOrSameSchedule) {
    throw new Error(
      'A tariff version with the same or a later effective date already exists.',
    );
  }

  const previousEffectiveTo = new Date(effectiveFrom.getTime() - 1);

  await ElectricityTariffScheduleModel.updateMany(
    {
      ...versionFilter,
      effectiveFrom: { $lt: effectiveFrom },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: effectiveFrom } }],
    },
    {
      $set: {
        effectiveTo: previousEffectiveTo,
      },
    },
  );

  return ElectricityTariffScheduleModel.create({
    name,
    consumerCategory: payload.consumerCategory,
    scope: payload.scope,
    providerId: providerObjectId,
    effectiveFrom,
    effectiveTo,
    lifeline: payload.lifeline,
    slabs: payload.slabs,
    vatPercentage: payload.vatPercentage,
    meterCharges: payload.meterCharges ?? [],
    isActive: true,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const getTariffSchedulesFromDB = async (
  actor: TPropertyActor,
  query: TElectricityTariffListQuery = {},
) => {
  ensureElectricityReader(actor);

  const filter: FilterQuery<IElectricityTariffSchedule> = {};

  if (query.providerId) {
    validateObjectId(query.providerId, 'Electricity provider ID');
    filter.providerId = new Types.ObjectId(query.providerId);
  }

  if (query.scope) filter.scope = query.scope;
  if (query.consumerCategory) {
    filter.consumerCategory = query.consumerCategory;
  }

  if (query.activeOnly !== false || actor.role !== 'superAdmin') {
    filter.isActive = true;
  }

  return ElectricityTariffScheduleModel.find(filter)
    .populate('providerId', 'name code isActive')
    .populate('createdBy', 'name email role')
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean();
};

export const findApplicableTariffSchedule = async (
  providerId: string,
  consumerCategory: TElectricityConsumerCategory,
  applicableDate: Date,
) => {
  validateObjectId(providerId, 'Electricity provider ID');

  const dateFilter = {
    effectiveFrom: { $lte: applicableDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: applicableDate } }],
    isActive: true,
    consumerCategory,
  };

  const providerSpecific = await ElectricityTariffScheduleModel.findOne({
    ...dateFilter,
    scope: 'providerSpecific',
    providerId: new Types.ObjectId(providerId),
  })
    .sort({ effectiveFrom: -1 })
    .populate('providerId', 'name code');

  if (providerSpecific) return providerSpecific;

  return ElectricityTariffScheduleModel.findOne({
    ...dateFilter,
    scope: 'national',
    providerId: null,
  }).sort({ effectiveFrom: -1 });
};

const getApplicableTariffFromDB = async (
  providerId: string,
  consumerCategory: TElectricityConsumerCategory,
  date: string | Date,
  actor: TPropertyActor,
) => {
  ensureElectricityReader(actor);

  return findApplicableTariffSchedule(
    providerId,
    consumerCategory,
    parseDate(date, 'Applicable date'),
  );
};

const deactivateTariffScheduleInDB = async (
  tariffId: string,
  actor: TPropertyActor,
) => {
  ensureSuperAdmin(actor);
  validateObjectId(tariffId, 'Tariff schedule ID');

  return ElectricityTariffScheduleModel.findByIdAndUpdate(
    tariffId,
    { $set: { isActive: false } },
    { new: true },
  );
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const calculateElectricityBill = async (
  payload: TCalculateElectricityBillPayload,
  actor: TPropertyActor,
) => {
  ensureElectricityReader(actor);

  if (!payload.providerId) {
    throw new Error('Electricity provider ID is required.');
  }

  if (!Number.isFinite(payload.consumedUnit) || payload.consumedUnit < 0) {
    throw new Error('Consumed electricity unit is invalid.');
  }

  const applicableDate = payload.applicableDate
    ? parseDate(payload.applicableDate, 'Applicable date')
    : new Date();
  const consumerCategory = payload.consumerCategory ?? 'LT_A_RESIDENTIAL';
  const tariff = await findApplicableTariffSchedule(
    payload.providerId,
    consumerCategory,
    applicableDate,
  );

  if (!tariff) {
    throw new Error('No applicable electricity tariff was found.');
  }

  const consumedUnit = Number(payload.consumedUnit.toFixed(2));
  const breakdown: Array<{
    label: string;
    unit: number;
    rate: number;
    amount: number;
  }> = [];

  if (consumedUnit <= tariff.lifeline.maximumUnit) {
    breakdown.push({
      label: `Lifeline 0-${tariff.lifeline.maximumUnit}`,
      unit: consumedUnit,
      rate: tariff.lifeline.rate,
      amount: roundMoney(consumedUnit * tariff.lifeline.rate),
    });
  } else {
    for (const slab of tariff.slabs) {
      const previousLimit = slab.fromUnit === 0 ? 0 : slab.fromUnit - 1;
      const upperLimit = slab.toUnit ?? consumedUnit;
      const unit = Math.max(
        0,
        Math.min(consumedUnit, upperLimit) - previousLimit,
      );

      if (unit <= 0) continue;

      breakdown.push({
        label: `${slab.fromUnit}-${slab.toUnit ?? 'above'}`,
        unit: roundMoney(unit),
        rate: slab.rate,
        amount: roundMoney(unit * slab.rate),
      });

      if (slab.toUnit === null || consumedUnit <= slab.toUnit) break;
    }
  }

  const energyCharge = roundMoney(
    breakdown.reduce((total, item) => total + item.amount, 0),
  );

  let meterCharge = 0;

  if (payload.meterChargeOverride !== undefined) {
    if (
      !Number.isFinite(payload.meterChargeOverride) ||
      payload.meterChargeOverride < 0
    ) {
      throw new Error('Meter charge override is invalid.');
    }

    meterCharge = roundMoney(payload.meterChargeOverride);
  } else if (payload.meterPhase) {
    const connectedLoad = payload.connectedLoad ?? 0;
    const matchedMeterCharge = tariff.meterCharges.find(
      (item) =>
        item.meterPhase === payload.meterPhase &&
        (item.loadFrom === null ||
          item.loadFrom === undefined ||
          connectedLoad >= item.loadFrom) &&
        (item.loadTo === null ||
          item.loadTo === undefined ||
          connectedLoad <= item.loadTo),
    );

    meterCharge = matchedMeterCharge?.amount ?? 0;
  }

  const adjustmentAmount = payload.adjustmentAmount ?? 0;

  if (!Number.isFinite(adjustmentAmount)) {
    throw new Error('Electricity adjustment amount is invalid.');
  }

  const vatAmount = roundMoney(
    ((energyCharge + meterCharge) * tariff.vatPercentage) / 100,
  );
  const totalAmount = roundMoney(
    energyCharge + meterCharge + vatAmount + adjustmentAmount,
  );

  return {
    tariff: {
      id: tariff._id,
      name: tariff.name,
      effectiveFrom: tariff.effectiveFrom,
      effectiveTo: tariff.effectiveTo,
      lifeline: tariff.lifeline,
      slabs: tariff.slabs,
      vatPercentage: tariff.vatPercentage,
    },
    consumedUnit,
    breakdown,
    energyCharge,
    meterCharge,
    vatAmount,
    adjustmentAmount: roundMoney(adjustmentAmount),
    totalAmount,
  };
};

export const ElectricityServices = {
  createProviderIntoDB,
  getProvidersFromDB,
  updateProviderInDB,
  createTariffScheduleIntoDB,
  getTariffSchedulesFromDB,
  getApplicableTariffFromDB,
  deactivateTariffScheduleInDB,
  calculateElectricityBill,
};
