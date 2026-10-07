import { Types } from 'mongoose';

import type { TPropertyActor } from '../property/property.service';
import { PropertyModel } from '../property/property.model';
import {
  TCreateChargeCategoryPayload,
  TUpdateChargeCategoryPayload,
} from './charge-category.interface';
import { ChargeCategoryModel } from './charge-category.model';

const DEFAULT_CHARGE_CATEGORIES = [
  ['Electricity Bill', 'ELECTRICITY', 'monthlyVariable'],
  ['Water Charge', 'WATER', 'fixed'],
  ['Gas Bill', 'GAS', 'fixed'],
  ['Maintenance / Service Charge', 'MAINTENANCE', 'fixed'],
  ['Garbage Cleaning Bill', 'GARBAGE_CLEANING', 'fixed'],
  ['Caretaker Bill', 'CARETAKER', 'fixed'],
  ['Staircase Cleaning Bill', 'STAIRCASE_CLEANING', 'fixed'],
  ['Common Electricity / Lift', 'COMMON_ELECTRICITY_LIFT', 'monthlyVariable'],
  ['Parking', 'PARKING', 'fixed'],
  ['Internet', 'INTERNET', 'fixed'],
  ['Other Charge', 'OTHER', 'monthlyVariable'],
] as const;

const validateObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensureManager = (actor: TPropertyActor) => {
  validateObjectId(actor.id, 'Authenticated user ID');

  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage charge categories.');
  }
};

const resolveProperty = async (
  propertyId: string | undefined,
  actor: TPropertyActor,
) => {
  ensureManager(actor);

  if (!propertyId) {
    throw new Error('Property ID is required.');
  }

  validateObjectId(propertyId, 'Property ID');

  const property = await PropertyModel.findOne({
    _id: propertyId,
    isDeleted: { $ne: true },
    ...(actor.role === 'owner'
      ? { ownerId: new Types.ObjectId(actor.id) }
      : {}),
  }).select('_id ownerId');

  if (!property) {
    throw new Error('Property not found or access was denied.');
  }

  return property;
};

const normalizeCode = (code: string) => {
  const normalizedCode = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalizedCode) {
    throw new Error('Charge category code is invalid.');
  }

  return normalizedCode;
};

const ensureDefaultCategories = async (
  ownerId: Types.ObjectId,
  propertyId: Types.ObjectId,
  actorId: string,
) => {
  await ChargeCategoryModel.bulkWrite(
    DEFAULT_CHARGE_CATEGORIES.map(([name, code, defaultMode], index) => ({
      updateOne: {
        filter: { propertyId, code },
        update: {
          $setOnInsert: {
            ownerId,
            propertyId,
            name,
            code,
            defaultMode,
            isSystemDefault: true,
            isActive: true,
            sortOrder: index + 1,
            createdBy: new Types.ObjectId(actorId),
          },
        },
        upsert: true,
      },
    })),
  );
};

const getChargeCategoriesFromDB = async (
  actor: TPropertyActor,
  propertyId?: string,
  includeInactive = false,
) => {
  const property = await resolveProperty(propertyId, actor);
  await ensureDefaultCategories(property.ownerId, property._id, actor.id);

  return ChargeCategoryModel.find({
    propertyId: property._id,
    ...(includeInactive ? {} : { isActive: true }),
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
};

const createChargeCategoryIntoDB = async (
  payload: TCreateChargeCategoryPayload,
  actor: TPropertyActor,
) => {
  const property = await resolveProperty(payload.propertyId, actor);
  const name = payload.name?.trim();

  if (!name) {
    throw new Error('Charge category name is required.');
  }

  const code = normalizeCode(payload.code || name);

  return ChargeCategoryModel.create({
    ownerId: property.ownerId,
    propertyId: property._id,
    name,
    code,
    defaultMode: payload.defaultMode,
    isSystemDefault: false,
    isActive: true,
    sortOrder: payload.sortOrder ?? 100,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const updateChargeCategoryInDB = async (
  categoryId: string,
  payload: TUpdateChargeCategoryPayload,
  actor: TPropertyActor,
) => {
  ensureManager(actor);
  validateObjectId(categoryId, 'Charge category ID');

  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(categoryId),
  };

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  }

  const updateData: TUpdateChargeCategoryPayload = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw new Error('Charge category name cannot be empty.');
    updateData.name = name;
  }

  if (payload.defaultMode !== undefined) {
    updateData.defaultMode = payload.defaultMode;
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') {
      throw new Error('Charge category status is invalid.');
    }

    updateData.isActive = payload.isActive;
  }

  if (payload.sortOrder !== undefined) {
    updateData.sortOrder = payload.sortOrder;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid charge category fields were provided.');
  }

  return ChargeCategoryModel.findOneAndUpdate(
    filter,
    { $set: updateData },
    { new: true, runValidators: true },
  );
};

export const ChargeCategoryServices = {
  getChargeCategoriesFromDB,
  createChargeCategoryIntoDB,
  updateChargeCategoryInDB,
};
