import { FilterQuery, Types } from 'mongoose';

import { ApartmentModel } from '../apartment/apartment.model';
import { ElectricityProviderModel } from '../electricity/electricity.model';
import { TenancyModel } from '../tenancy/tenancy.model';
import { TUserRole } from '../user/user.interface';
import { UserModel } from '../user/user.model';
import {
  IProperty,
  TCreatePropertyPayload,
  TUpdatePropertyElectricitySettingsPayload,
  TUpdatePropertyPayload,
} from './property.interface';
import { PropertyModel } from './property.model';

export type TPropertyActor = {
  id: string;
  role: TUserRole;
};

export type TPropertyListQuery = {
  ownerId?: string;
  search?: string;
};

const validateObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensurePropertyAccessRole = (actor: TPropertyActor) => {
  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage properties.');
  }

  validateObjectId(actor.id, 'Authenticated user ID');
};

const normalizeOptionalNote = (note?: string | null) => {
  if (note === undefined) return undefined;

  const normalizedNote = note?.trim();
  return normalizedNote || null;
};

const propertyPopulate = [
  {
    path: 'ownerId',
    select: 'name email phone role userStatus',
  },
  {
    path: 'createdBy',
    select: 'name email role',
  },
  {
    path: 'electricitySettings.providerId',
    select: 'name code isActive',
  },
];

const resolvePropertyOwnerId = async (
  payload: TCreatePropertyPayload,
  actor: TPropertyActor,
) => {
  const requestedOwnerId =
    actor.role === 'owner' ? actor.id : payload.ownerId?.trim();

  if (!requestedOwnerId) {
    throw new Error('An owner must be selected for the property.');
  }

  validateObjectId(requestedOwnerId, 'Owner ID');

  const owner = await UserModel.findOne({
    _id: requestedOwnerId,
    role: 'owner',
    userStatus: 'active',
    isDeleted: { $ne: true },
  }).select('_id');

  if (!owner) {
    throw new Error('A valid active owner was not found.');
  }

  return owner._id;
};

const buildAccessiblePropertyFilter = (
  propertyId: string,
  actor: TPropertyActor,
): FilterQuery<IProperty> => {
  ensurePropertyAccessRole(actor);
  validateObjectId(propertyId, 'Property ID');

  const filter: FilterQuery<IProperty> = {
    _id: new Types.ObjectId(propertyId),
    isDeleted: { $ne: true },
  };

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  }

  return filter;
};

const addApartmentCounts = async <T extends { _id: Types.ObjectId }>(
  properties: T[],
) => {
  if (properties.length === 0) return [];

  const propertyIds = properties.map((property) => property._id);

  const apartmentCounts = await ApartmentModel.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        propertyId: { $in: propertyIds },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$propertyId',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    apartmentCounts.map((item) => [item._id.toString(), item.count]),
  );

  return properties.map((property) => ({
    ...property,
    apartmentCount: countMap.get(property._id.toString()) ?? 0,
  }));
};

const createPropertyIntoDB = async (
  payload: TCreatePropertyPayload,
  actor: TPropertyActor,
) => {
  ensurePropertyAccessRole(actor);

  const name = payload.name?.trim();
  const address = payload.address?.trim();

  if (!name) {
    throw new Error('Property name is required.');
  }

  if (!address) {
    throw new Error('Property address is required.');
  }

  const ownerId = await resolvePropertyOwnerId(payload, actor);

  return PropertyModel.create({
    name,
    address,
    note: normalizeOptionalNote(payload.note) ?? null,
    ownerId,
    createdBy: new Types.ObjectId(actor.id),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  });
};

const getAllPropertiesFromDB = async (
  actor: TPropertyActor,
  query: TPropertyListQuery = {},
) => {
  ensurePropertyAccessRole(actor);

  const filter: FilterQuery<IProperty> = {
    isDeleted: { $ne: true },
  };

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  } else if (query.ownerId) {
    validateObjectId(query.ownerId, 'Owner ID');
    filter.ownerId = new Types.ObjectId(query.ownerId);
  }

  const search = query.search?.trim();

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { address: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const properties = await PropertyModel.find(filter)
    .populate(propertyPopulate)
    .sort({ createdAt: -1 })
    .lean();

  return addApartmentCounts(properties);
};

const getSinglePropertyFromDB = async (
  propertyId: string,
  actor: TPropertyActor,
) => {
  const filter = buildAccessiblePropertyFilter(propertyId, actor);

  const property = await PropertyModel.findOne(filter)
    .populate(propertyPopulate)
    .lean();

  if (!property) return null;

  const [propertyWithCount] = await addApartmentCounts([property]);
  return propertyWithCount;
};

const updatePropertyInDB = async (
  propertyId: string,
  payload: TUpdatePropertyPayload,
  actor: TPropertyActor,
) => {
  const filter = buildAccessiblePropertyFilter(propertyId, actor);
  const updateData: TUpdatePropertyPayload = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();

    if (!name) {
      throw new Error('Property name cannot be empty.');
    }

    updateData.name = name;
  }

  if (payload.address !== undefined) {
    const address = payload.address.trim();

    if (!address) {
      throw new Error('Property address cannot be empty.');
    }

    updateData.address = address;
  }

  if (payload.note !== undefined) {
    updateData.note = normalizeOptionalNote(payload.note);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid property fields were provided.');
  }

  return PropertyModel.findOneAndUpdate(
    filter,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    },
  ).populate(propertyPopulate);
};

const updatePropertyElectricitySettingsInDB = async (
  propertyId: string,
  payload: TUpdatePropertyElectricitySettingsPayload,
  actor: TPropertyActor,
) => {
  const filter = buildAccessiblePropertyFilter(propertyId, actor);

  if (!payload.providerId) {
    throw new Error('Electricity provider ID is required.');
  }

  validateObjectId(payload.providerId, 'Electricity provider ID');

  const provider = await ElectricityProviderModel.findOne({
    _id: payload.providerId,
    isActive: true,
  }).select('_id');

  if (!provider) {
    throw new Error('A valid active electricity provider was not found.');
  }

  return PropertyModel.findOneAndUpdate(
    filter,
    {
      $set: {
        electricitySettings: {
          providerId: provider._id,
          consumerCategory: payload.consumerCategory ?? 'LT_A_RESIDENTIAL',
          accountNumber: payload.accountNumber?.trim() || null,
          defaultMeterPhase: payload.defaultMeterPhase ?? 'singlePhase',
          tariffSelection: 'automatic',
          updatedBy: new Types.ObjectId(actor.id),
          updatedAt: new Date(),
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate(propertyPopulate);
};

const deletePropertyFromDB = async (
  propertyId: string,
  actor: TPropertyActor,
) => {
  const filter = buildAccessiblePropertyFilter(propertyId, actor);
  const property = await PropertyModel.findOne(filter);

  if (!property) return null;

  const activeTenancyCount = await TenancyModel.countDocuments({
    propertyId: property._id,
    status: 'active',
  });

  if (activeTenancyCount > 0) {
    throw new Error(
      'Cannot delete a property while one or more apartments have active tenants.',
    );
  }

  const apartmentDependencyCount = await ApartmentModel.countDocuments({
    propertyId: property._id,
  });

  if (apartmentDependencyCount === 0) {
    const deletedProperty = await PropertyModel.findOneAndDelete(filter);

    if (!deletedProperty) return null;

    return {
      deletionType: 'hard' as const,
      property: deletedProperty,
      apartmentDependencyCount,
      activeTenancyCount,
    };
  }

  const archivedProperty = await PropertyModel.findOneAndUpdate(
    filter,
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

  if (!archivedProperty) return null;

  return {
    deletionType: 'soft' as const,
    property: archivedProperty,
    apartmentDependencyCount,
    activeTenancyCount,
  };
};

export const PropertyServices = {
  createPropertyIntoDB,
  getAllPropertiesFromDB,
  getSinglePropertyFromDB,
  updatePropertyInDB,
  updatePropertyElectricitySettingsInDB,
  deletePropertyFromDB,
};
