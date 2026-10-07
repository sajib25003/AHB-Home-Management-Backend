import { FilterQuery, Types } from 'mongoose';

import { IProperty } from '../property/property.interface';
import type { TPropertyActor } from '../property/property.service';
import { PropertyModel } from '../property/property.model';
import { TenancyModel } from '../tenancy/tenancy.model';
import { ChargeCategoryModel } from '../billing/charge-category.model';
import {
  IApartment,
  TCreateApartmentPayload,
  TUpdateApartmentChargeSettingsPayload,
  TUpdateApartmentElectricityConfigPayload,
  TUpdateApartmentPayload,
} from './apartment.interface';
import { ApartmentModel } from './apartment.model';

const currentTenancyPopulate = {
  path: 'currentTenancy',
  select:
    'tenantId startDate status note rentTerms rentRateHistory',
  populate: {
    path: 'tenantId',
    select: 'name email phone photo userStatus role',
  },
};

const chargeSettingsPopulate = {
  path: 'chargeSettings.categoryId',
  select: 'name code defaultMode isActive sortOrder',
};

const validateObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensureApartmentAccessRole = (actor: TPropertyActor) => {
  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage apartments.');
  }

  validateObjectId(actor.id, 'Authenticated user ID');
};

const normalizeOptionalNote = (note?: string | null) => {
  if (note === undefined) return undefined;

  const normalizedNote = note?.trim();
  return normalizedNote || null;
};

const getAccessibleProperty = async (
  propertyId: string,
  actor: TPropertyActor,
) => {
  ensureApartmentAccessRole(actor);
  validateObjectId(propertyId, 'Property ID');

  const propertyFilter: FilterQuery<IProperty> = {
    _id: new Types.ObjectId(propertyId),
    isDeleted: { $ne: true },
  };

  if (actor.role === 'owner') {
    propertyFilter.ownerId = new Types.ObjectId(actor.id);
  }

  const property = await PropertyModel.findOne(propertyFilter).select(
    '_id name address ownerId',
  );

  if (!property) {
    throw new Error('Property not found or access was denied.');
  }

  return property;
};

const getAccessibleApartment = async (
  apartmentId: string,
  actor: TPropertyActor,
) => {
  ensureApartmentAccessRole(actor);
  validateObjectId(apartmentId, 'Apartment ID');

  const apartment = await ApartmentModel.findOne({
    _id: new Types.ObjectId(apartmentId),
    isDeleted: { $ne: true },
  });

  if (!apartment) return null;

  await getAccessibleProperty(apartment.propertyId.toString(), actor);

  return apartment;
};

const createApartmentIntoDB = async (
  propertyId: string,
  payload: TCreateApartmentPayload,
  actor: TPropertyActor,
) => {
  const property = await getAccessibleProperty(propertyId, actor);
  const apartmentNumber = payload.apartmentNumber?.trim();

  if (!apartmentNumber) {
    throw new Error('Apartment number is required.');
  }

  return ApartmentModel.create({
    propertyId: property._id,
    apartmentNumber,
    note: normalizeOptionalNote(payload.note) ?? null,
    createdBy: new Types.ObjectId(actor.id),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  });
};

const getApartmentsByPropertyFromDB = async (
  propertyId: string,
  actor: TPropertyActor,
) => {
  const property = await getAccessibleProperty(propertyId, actor);

  const apartments = await ApartmentModel.find({
    propertyId: property._id,
    isDeleted: { $ne: true },
  })
    .populate('createdBy', 'name email role')
    .populate(chargeSettingsPopulate)
    .populate(currentTenancyPopulate)
    .sort({ apartmentNumber: 1 })
    .lean();

  return {
    property,
    apartments,
  };
};

const getSingleApartmentFromDB = async (
  apartmentId: string,
  actor: TPropertyActor,
) => {
  const apartment = await getAccessibleApartment(apartmentId, actor);

  if (!apartment) return null;

  await apartment.populate([
    {
      path: 'propertyId',
      select: 'name address ownerId',
    },
    {
      path: 'createdBy',
      select: 'name email role',
    },
    chargeSettingsPopulate,
    currentTenancyPopulate,
  ]);

  return apartment;
};

const updateApartmentInDB = async (
  apartmentId: string,
  payload: TUpdateApartmentPayload,
  actor: TPropertyActor,
) => {
  const apartment = await getAccessibleApartment(apartmentId, actor);

  if (!apartment) return null;

  const updateData: TUpdateApartmentPayload = {};

  if (payload.apartmentNumber !== undefined) {
    const apartmentNumber = payload.apartmentNumber.trim();

    if (!apartmentNumber) {
      throw new Error('Apartment number cannot be empty.');
    }

    updateData.apartmentNumber = apartmentNumber;
  }

  if (payload.note !== undefined) {
    updateData.note = normalizeOptionalNote(payload.note);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid apartment fields were provided.');
  }

  return ApartmentModel.findOneAndUpdate(
    {
      _id: apartment._id,
      isDeleted: { $ne: true },
    },
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('createdBy', 'name email role')
    .populate(chargeSettingsPopulate)
    .populate(currentTenancyPopulate);
};

const updateApartmentChargeSettingsInDB = async (
  apartmentId: string,
  payload: TUpdateApartmentChargeSettingsPayload,
  actor: TPropertyActor,
) => {
  const apartment = await getAccessibleApartment(apartmentId, actor);

  if (!apartment) return null;

  if (!Array.isArray(payload.charges)) {
    throw new Error('Apartment charge settings are required.');
  }

  const categoryIds = payload.charges.map((charge) => charge.categoryId);

  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new Error('Duplicate charge categories are invalid.');
  }

  categoryIds.forEach((categoryId) =>
    validateObjectId(categoryId, 'Charge category ID'),
  );

  const categories = await ChargeCategoryModel.find({
    _id: { $in: categoryIds },
    propertyId: apartment.propertyId,
    isActive: true,
  })
    .select('_id defaultMode')
    .lean();

  if (categories.length !== categoryIds.length) {
    throw new Error(
      'One or more active charge categories are invalid for this property.',
    );
  }

  const categoryModeById = new Map(
    categories.map((category) => [
      category._id.toString(),
      category.defaultMode,
    ]),
  );
  const now = new Date();
  const actorId = new Types.ObjectId(actor.id);
  const submittedCategoryIds = new Set(categoryIds);

  const retainedSettings = (apartment.chargeSettings ?? []).filter(
    (setting) => !submittedCategoryIds.has(setting.categoryId.toString()),
  );

  const submittedSettings = payload.charges.map((charge) => {
    const mode = categoryModeById.get(charge.categoryId);
    const supportsApartmentAmount = mode === 'fixed';
    const amount = supportsApartmentAmount ? (charge.amount ?? null) : null;

    if (
      amount !== null &&
      (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
    ) {
      throw new Error('Apartment charge amount is invalid.');
    }

    return {
      categoryId: new Types.ObjectId(charge.categoryId),
      amount,
      updatedBy: actorId,
      updatedAt: now,
    };
  });

  apartment.chargeSettings = [...retainedSettings, ...submittedSettings];
  await apartment.save();

  return apartment.populate([
    { path: 'createdBy', select: 'name email role' },
    chargeSettingsPopulate,
    currentTenancyPopulate,
  ]);
};

const updateApartmentElectricityConfigInDB = async (
  apartmentId: string,
  payload: TUpdateApartmentElectricityConfigPayload,
  actor: TPropertyActor,
) => {
  const apartment = await getAccessibleApartment(apartmentId, actor);

  if (!apartment) return null;

  if (!payload.billingType) {
    throw new Error('Electricity billing type is required.');
  }

  const paymentResponsibility =
    payload.billingType === 'includedInRent' ||
    payload.billingType === 'notApplicable'
      ? 'notApplicable'
      : (payload.paymentResponsibility ?? 'ownerCollects');

  return ApartmentModel.findOneAndUpdate(
    {
      _id: apartment._id,
      isDeleted: { $ne: true },
    },
    {
      $set: {
        electricityConfig: {
          billingType: payload.billingType,
          paymentResponsibility,
          meterNumber: payload.meterNumber?.trim() || null,
          note: payload.note?.trim() || null,
          updatedBy: new Types.ObjectId(actor.id),
          updatedAt: new Date(),
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('createdBy', 'name email role')
    .populate(currentTenancyPopulate);
};

const deleteApartmentFromDB = async (
  apartmentId: string,
  actor: TPropertyActor,
) => {
  const apartment = await getAccessibleApartment(apartmentId, actor);

  if (!apartment) return null;

  const [activeTenancyCount, tenancyHistoryCount] = await Promise.all([
    TenancyModel.countDocuments({
      apartmentId: apartment._id,
      status: 'active',
    }),
    TenancyModel.countDocuments({
      apartmentId: apartment._id,
    }),
  ]);

  if (activeTenancyCount > 0) {
    throw new Error(
      'Cannot delete an apartment with an active tenant. End the tenancy first.',
    );
  }

  if (tenancyHistoryCount === 0) {
    const deletedApartment = await ApartmentModel.findOneAndDelete({
      _id: apartment._id,
      isDeleted: { $ne: true },
    });

    if (!deletedApartment) return null;

    return {
      deletionType: 'hard' as const,
      apartment: deletedApartment,
      tenancyHistoryCount,
    };
  }

  const archivedApartment = await ApartmentModel.findOneAndUpdate(
    {
      _id: apartment._id,
      isDeleted: { $ne: true },
    },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: new Types.ObjectId(actor.id),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!archivedApartment) return null;

  return {
    deletionType: 'soft' as const,
    apartment: archivedApartment,
    tenancyHistoryCount,
  };
};

export const ApartmentServices = {
  createApartmentIntoDB,
  getApartmentsByPropertyFromDB,
  getSingleApartmentFromDB,
  updateApartmentInDB,
  updateApartmentElectricityConfigInDB,
  updateApartmentChargeSettingsInDB,
  deleteApartmentFromDB,
};
