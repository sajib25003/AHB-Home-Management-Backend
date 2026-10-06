import { FilterQuery, Types } from 'mongoose';

import { ApartmentModel } from '../apartment/apartment.model';
import { IProperty } from '../property/property.interface';
import { PropertyModel } from '../property/property.model';
import type { TPropertyActor } from '../property/property.service';
import { UserModel } from '../user/user.model';
import {
  ITenancy,
  TCreateTenancyPayload,
  TEndTenancyPayload,
  TTenancyListQuery,
} from './tenancy.interface';
import { TenancyModel } from './tenancy.model';

const validateObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensureAuthenticatedActor = (actor: TPropertyActor) => {
  validateObjectId(actor.id, 'Authenticated user ID');
};

const ensureManagerRole = (actor: TPropertyActor) => {
  ensureAuthenticatedActor(actor);

  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage tenancies.');
  }
};

const normalizeOptionalText = (value?: string | null) => {
  if (value === undefined) return undefined;

  const normalizedValue = value?.trim();
  return normalizedValue || null;
};

const parseDate = (value: string | Date, fieldName: string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
};

const ensureDateIsNotFuture = (date: Date, fieldName: string) => {
  const oneMinuteFromNow = Date.now() + 60 * 1000;

  if (date.getTime() > oneMinuteFromNow) {
    throw new Error(`${fieldName} cannot be in the future.`);
  }
};

const tenancyPopulate = [
  {
    path: 'tenantId',
    select: 'name email phone photo userStatus role ownerId',
  },
  {
    path: 'ownerId',
    select: 'name email phone role',
  },
  {
    path: 'propertyId',
    select: 'name address ownerId',
  },
  {
    path: 'apartmentId',
    select: 'apartmentNumber propertyId note',
  },
  {
    path: 'createdBy',
    select: 'name email role',
  },
  {
    path: 'endedBy',
    select: 'name email role',
  },
];

const getAccessibleApartmentAndProperty = async (
  apartmentId: string,
  actor: TPropertyActor,
) => {
  ensureManagerRole(actor);
  validateObjectId(apartmentId, 'Apartment ID');

  const apartment = await ApartmentModel.findOne({
    _id: new Types.ObjectId(apartmentId),
    isDeleted: { $ne: true },
  }).select('_id apartmentNumber propertyId');

  if (!apartment) {
    throw new Error('Apartment not found.');
  }

  const propertyFilter: FilterQuery<IProperty> = {
    _id: apartment.propertyId,
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

  return {
    apartment,
    property,
  };
};

const getValidTenantForOwner = async (
  tenantId: string,
  ownerId: Types.ObjectId,
) => {
  validateObjectId(tenantId, 'Tenant ID');

  const tenant = await UserModel.findOne({
    _id: new Types.ObjectId(tenantId),
    role: 'tenant',
    ownerId,
    userStatus: 'active',
    isDeleted: { $ne: true },
  }).select('_id name email phone role ownerId userStatus');

  if (!tenant) {
    throw new Error(
      'A valid active tenant belonging to this property owner was not found.',
    );
  }

  return tenant;
};

const buildAccessibleTenancyFilter = (
  tenancyId: string,
  actor: TPropertyActor,
): FilterQuery<ITenancy> => {
  ensureAuthenticatedActor(actor);
  validateObjectId(tenancyId, 'Tenancy ID');

  const filter: FilterQuery<ITenancy> = {
    _id: new Types.ObjectId(tenancyId),
  };

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  } else if (actor.role === 'tenant') {
    filter.tenantId = new Types.ObjectId(actor.id);
  } else if (actor.role !== 'superAdmin') {
    throw new Error('You are not authorized to view this tenancy.');
  }

  return filter;
};

const createTenancyIntoDB = async (
  payload: TCreateTenancyPayload,
  actor: TPropertyActor,
) => {
  if (!payload.apartmentId) {
    throw new Error('Apartment ID is required.');
  }

  if (!payload.tenantId) {
    throw new Error('Tenant ID is required.');
  }

  if (!payload.startDate) {
    throw new Error('Tenancy start date is required.');
  }

  const startDate = parseDate(payload.startDate, 'Tenancy start date');
  ensureDateIsNotFuture(startDate, 'Tenancy start date');

  const { apartment, property } = await getAccessibleApartmentAndProperty(
    payload.apartmentId,
    actor,
  );

  const tenant = await getValidTenantForOwner(
    payload.tenantId,
    property.ownerId,
  );

  const [activeApartmentTenancy, activeTenantTenancy] = await Promise.all([
    TenancyModel.findOne({
      apartmentId: apartment._id,
      status: 'active',
    }).select('_id tenantId'),
    TenancyModel.findOne({
      tenantId: tenant._id,
      status: 'active',
    }).select('_id apartmentId'),
  ]);

  if (activeApartmentTenancy) {
    throw new Error('This apartment already has an active tenant.');
  }

  if (activeTenantTenancy) {
    throw new Error('This tenant is already assigned to an active apartment.');
  }

  /*
   * Backdated assignment previous history-এর সঙ্গে overlap করতে পারবে না।
   * একই date-এ পুরোনো tenancy শেষ এবং নতুন tenancy শুরু করা যাবে।
   */
  const [apartmentHistoryConflict, tenantHistoryConflict] = await Promise.all([
    TenancyModel.findOne({
      apartmentId: apartment._id,
      status: 'ended',
      endDate: { $gt: startDate },
    }).select('_id endDate'),
    TenancyModel.findOne({
      tenantId: tenant._id,
      status: 'ended',
      endDate: { $gt: startDate },
    }).select('_id endDate'),
  ]);

  if (apartmentHistoryConflict) {
    throw new Error(
      'The start date overlaps with this apartment’s previous tenancy history.',
    );
  }

  if (tenantHistoryConflict) {
    throw new Error(
      'The start date overlaps with this tenant’s previous tenancy history.',
    );
  }

  const tenancy = await TenancyModel.create({
    apartmentId: apartment._id,
    propertyId: property._id,
    tenantId: tenant._id,
    ownerId: property.ownerId,
    startDate,
    endDate: null,
    status: 'active',
    note: normalizeOptionalText(payload.note) ?? null,
    moveOutNote: null,
    createdBy: new Types.ObjectId(actor.id),
    endedBy: null,
  });

  await tenancy.populate(tenancyPopulate);
  return tenancy;
};

const getAllTenanciesFromDB = async (
  actor: TPropertyActor,
  query: TTenancyListQuery = {},
) => {
  ensureManagerRole(actor);

  const filter: FilterQuery<ITenancy> = {};

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  } else if (query.ownerId) {
    validateObjectId(query.ownerId, 'Owner ID');
    filter.ownerId = new Types.ObjectId(query.ownerId);
  }

  if (query.propertyId) {
    validateObjectId(query.propertyId, 'Property ID');
    filter.propertyId = new Types.ObjectId(query.propertyId);
  }

  if (query.apartmentId) {
    validateObjectId(query.apartmentId, 'Apartment ID');
    filter.apartmentId = new Types.ObjectId(query.apartmentId);
  }

  if (query.tenantId) {
    validateObjectId(query.tenantId, 'Tenant ID');
    filter.tenantId = new Types.ObjectId(query.tenantId);
  }

  if (query.status) {
    filter.status = query.status;
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    TenancyModel.find(filter)
      .populate(tenancyPopulate)
      .sort({ status: 1, startDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TenancyModel.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const getSingleTenancyFromDB = async (
  tenancyId: string,
  actor: TPropertyActor,
) => {
  const filter = buildAccessibleTenancyFilter(tenancyId, actor);

  return TenancyModel.findOne(filter).populate(tenancyPopulate);
};

const getMyCurrentTenancyFromDB = async (actor: TPropertyActor) => {
  ensureAuthenticatedActor(actor);

  if (actor.role !== 'tenant') {
    throw new Error('Only a tenant can access the current tenancy endpoint.');
  }

  return TenancyModel.findOne({
    tenantId: new Types.ObjectId(actor.id),
    status: 'active',
  }).populate(tenancyPopulate);
};

const endTenancyInDB = async (
  tenancyId: string,
  payload: TEndTenancyPayload,
  actor: TPropertyActor,
) => {
  ensureManagerRole(actor);

  const filter = buildAccessibleTenancyFilter(tenancyId, actor);
  const tenancy = await TenancyModel.findOne(filter);

  if (!tenancy) return null;

  if (tenancy.status !== 'active') {
    throw new Error('This tenancy has already ended.');
  }

  if (!payload.endDate) {
    throw new Error('Move-out date is required.');
  }

  const endDate = parseDate(payload.endDate, 'Move-out date');
  ensureDateIsNotFuture(endDate, 'Move-out date');

  if (endDate.getTime() < tenancy.startDate.getTime()) {
    throw new Error('Move-out date cannot be before the tenancy start date.');
  }

  const endedTenancy = await TenancyModel.findOneAndUpdate(
    {
      ...filter,
      status: 'active',
    },
    {
      $set: {
        status: 'ended',
        endDate,
        moveOutNote: normalizeOptionalText(payload.moveOutNote) ?? null,
        endedBy: new Types.ObjectId(actor.id),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!endedTenancy) {
    throw new Error('This tenancy was already updated. Please try again.');
  }

  await endedTenancy.populate(tenancyPopulate);
  return endedTenancy;
};

export const TenancyServices = {
  createTenancyIntoDB,
  getAllTenanciesFromDB,
  getSingleTenancyFromDB,
  getMyCurrentTenancyFromDB,
  endTenancyInDB,
};
