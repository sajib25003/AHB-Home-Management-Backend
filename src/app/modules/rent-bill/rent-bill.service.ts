import crypto from 'crypto';
import { FilterQuery, Types } from 'mongoose';

import { ApartmentModel } from '../apartment/apartment.model';
import { ChargeCategoryModel } from '../billing/charge-category.model';
import { ensureDefaultCategories } from '../billing/charge-category.service';
import { PropertyModel } from '../property/property.model';
import type { TPropertyActor } from '../property/property.service';
import { TenancyModel } from '../tenancy/tenancy.model';
import { UserModel } from '../user/user.model';
import {
  IMonthlyRentBill,
  IRentBillItem,
  PAYMENT_METHODS,
  RENT_BILL_ITEM_TYPES,
  RENT_BILL_STATUSES,
  TCreateRentBillPayload,
  TRentBillItemPayload,
  TRentBillListQuery,
  TUpdateRentBillPayload,
  TUpdateRentBillStatusPayload,
} from './rent-bill.interface';
import { MonthlyRentBillModel } from './rent-bill.model';

const BILL_POPULATE = [
  { path: 'ownerId', select: 'name email phone role' },
  { path: 'tenantId', select: 'name email phone role userStatus' },
  { path: 'propertyId', select: 'name address ownerId' },
  { path: 'apartmentId', select: 'apartmentNumber propertyId' },
  { path: 'tenantAssignmentId', select: 'startDate endDate status' },
  { path: 'createdBy', select: 'name email role' },
  { path: 'updatedBy', select: 'name email role' },
  { path: 'statusHistory.changedBy', select: 'name email role' },
];

const validateObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid.`);
  }
};

const ensureActor = (actor: TPropertyActor) => {
  validateObjectId(actor.id, 'Authenticated user ID');
};

const ensureManager = (actor: TPropertyActor) => {
  ensureActor(actor);

  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage rent bills.');
  }
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeText = (
  value: string | null | undefined,
  maximumLength: number,
) => {
  if (value === undefined) return undefined;

  const normalized = value?.trim() || null;

  if (normalized && normalized.length > maximumLength) {
    throw new Error('Text value is too long.');
  }

  return normalized;
};

const parseOptionalDate = (
  value: string | Date | null | undefined,
  fieldName: string,
) => {
  if (value === undefined || value === null || value === '') return null;

  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
};

const parseBillingPeriod = (billingPeriod: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingPeriod)) {
    throw new Error('Billing period must use YYYY-MM format.');
  }

  const [yearValue, monthValue] = billingPeriod.split('-').map(Number);
  const start = new Date(Date.UTC(yearValue, monthValue - 1, 1));
  const end = new Date(Date.UTC(yearValue, monthValue, 0, 23, 59, 59, 999));

  return { year: yearValue, month: monthValue, start, end };
};

const formatName = (name: {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
}) =>
  [name.firstName, name.middleName, name.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

const assertTenancyCoversPeriod = (
  tenancy: { startDate: Date; endDate?: Date | null },
  periodStart: Date,
  periodEnd: Date,
) => {
  if (
    tenancy.startDate.getTime() > periodEnd.getTime() ||
    (tenancy.endDate && tenancy.endDate.getTime() < periodStart.getTime())
  ) {
    throw new Error('The tenancy does not cover the selected billing period.');
  }
};

const findAccessibleTenancy = async (
  tenantAssignmentId: string,
  actor: TPropertyActor,
) => {
  ensureManager(actor);
  validateObjectId(tenantAssignmentId, 'Tenant assignment ID');

  const tenancy = await TenancyModel.findOne({
    _id: new Types.ObjectId(tenantAssignmentId),
    ...(actor.role === 'owner'
      ? { ownerId: new Types.ObjectId(actor.id) }
      : {}),
  }).lean();

  if (!tenancy) {
    throw new Error('Tenant assignment not found or access was denied.');
  }

  return tenancy;
};

const loadBillParties = async (tenancy: {
  ownerId: Types.ObjectId;
  tenantId: Types.ObjectId;
  propertyId: Types.ObjectId;
  apartmentId: Types.ObjectId;
}) => {
  const [owner, tenant, property, apartment] = await Promise.all([
    UserModel.findOne({
      _id: tenancy.ownerId,
      role: 'owner',
      isDeleted: { $ne: true },
    })
      .select('name phone')
      .lean(),
    UserModel.findOne({
      _id: tenancy.tenantId,
      role: 'tenant',
      isDeleted: { $ne: true },
    })
      .select('name email phone')
      .lean(),
    PropertyModel.findOne({
      _id: tenancy.propertyId,
      ownerId: tenancy.ownerId,
      isDeleted: { $ne: true },
    })
      .select('name address ownerId')
      .lean(),
    ApartmentModel.findOne({
      _id: tenancy.apartmentId,
      propertyId: tenancy.propertyId,
      isDeleted: { $ne: true },
    })
      .select('apartmentNumber propertyId chargeSettings')
      .lean(),
  ]);

  if (!owner || !tenant || !property || !apartment) {
    throw new Error('The tenancy has missing or archived related records.');
  }

  return { owner, tenant, property, apartment };
};

const resolveBaseRent = (
  tenancy: Awaited<ReturnType<typeof findAccessibleTenancy>>,
  periodStart: Date,
  periodEnd: Date,
) => {
  const applicableHistory = [...(tenancy.rentRateHistory ?? [])]
    .filter(
      (entry) =>
        new Date(entry.effectiveFrom).getTime() <= periodEnd.getTime() &&
        (!entry.effectiveTo ||
          new Date(entry.effectiveTo).getTime() >= periodStart.getTime()),
    )
    .sort(
      (a, b) =>
        new Date(b.effectiveFrom).getTime() -
        new Date(a.effectiveFrom).getTime(),
    )[0];

  if (applicableHistory) return roundMoney(applicableHistory.amount);

  if (
    tenancy.rentTerms &&
    new Date(tenancy.rentTerms.effectiveFrom).getTime() <= periodEnd.getTime()
  ) {
    return roundMoney(tenancy.rentTerms.baseRent);
  }

  throw new Error('Rent terms are not configured for this billing period.');
};

const getDefaultDueDate = (
  billingPeriod: string,
  dueDay: number | undefined,
) => {
  const { year, month } = parseBillingPeriod(billingPeriod);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const normalizedDay = Math.min(Math.max(dueDay ?? 10, 1), lastDay);

  return new Date(Date.UTC(year, month - 1, normalizedDay, 23, 59, 59, 999));
};

const getGenerationContextFromDB = async (
  tenantAssignmentId: string,
  billingPeriod: string,
  actor: TPropertyActor,
) => {
  const period = parseBillingPeriod(billingPeriod);
  const tenancy = await findAccessibleTenancy(tenantAssignmentId, actor);
  assertTenancyCoversPeriod(tenancy, period.start, period.end);

  const parties = await loadBillParties(tenancy);
  const baseRent = resolveBaseRent(tenancy, period.start, period.end);

  // Every active property category belongs in the monthly bill. Apartment
  // settings only provide the per-apartment amount; they must not decide
  // whether an otherwise active property category appears at all.
  await ensureDefaultCategories(
    tenancy.ownerId,
    tenancy.propertyId,
    actor.id,
  );

  const categories = await ChargeCategoryModel.find({
    propertyId: tenancy.propertyId,
    isActive: true,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  const settingsByCategory = new Map(
    (parties.apartment.chargeSettings ?? []).map((setting) => [
      setting.categoryId.toString(),
      setting,
    ]),
  );

  const items: Array<{
    categoryId: string | null;
    key: string;
    label: string;
    amount: number | null;
    type: 'fixed' | 'variable';
  }> = [
    {
      categoryId: null,
      key: 'BASE_RENT',
      label: 'Base Rent',
      amount: baseRent,
      type: 'fixed',
    },
  ];

  for (const category of categories) {
    if (
      ['includedInRent', 'tenantManaged', 'notApplicable'].includes(
        category.defaultMode,
      )
    ) {
      continue;
    }

    const setting = settingsByCategory.get(category._id.toString());
    const fixed = category.defaultMode === 'fixed';

    items.push({
      categoryId: category._id.toString(),
      key: category.code,
      label: category.name,
      amount: fixed ? (setting?.amount ?? null) : null,
      type: fixed ? 'fixed' : 'variable',
    });
  }

  return {
    billingPeriod,
    tenantAssignmentId: tenancy._id.toString(),
    owner: {
      id: parties.owner._id.toString(),
      name: formatName(parties.owner.name),
      phone: parties.owner.phone ?? null,
    },
    tenant: {
      id: parties.tenant._id.toString(),
      name: formatName(parties.tenant.name),
      email: parties.tenant.email,
      phone: parties.tenant.phone ?? null,
    },
    property: {
      id: parties.property._id.toString(),
      name: parties.property.name,
      address: parties.property.address,
    },
    apartment: {
      id: parties.apartment._id.toString(),
      apartmentNumber: parties.apartment.apartmentNumber,
    },
    dueDate: getDefaultDueDate(
      billingPeriod,
      tenancy.rentTerms?.dueDay,
    ).toISOString(),
    items,
  };
};

const normalizeItems = async (
  items: TRentBillItemPayload[],
  propertyId: Types.ObjectId,
) => {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    throw new Error('A bill must contain between 1 and 30 items.');
  }

  const categoryIds = items
    .map((item) => item.categoryId)
    .filter((value): value is string => Boolean(value));

  categoryIds.forEach((id) => validateObjectId(id, 'Charge category ID'));

  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new Error('Duplicate charge categories are invalid.');
  }

  if (categoryIds.length > 0) {
    const categoryCount = await ChargeCategoryModel.countDocuments({
      _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
      propertyId,
    });

    if (categoryCount !== categoryIds.length) {
      throw new Error('One or more charge categories are invalid.');
    }
  }

  const normalized: IRentBillItem[] = items.map((item, index) => {
    const label = item.label?.trim();

    if (!label || label.length > 120) {
      throw new Error('Every bill item must have a valid label.');
    }

    if (!RENT_BILL_ITEM_TYPES.includes(item.type)) {
      throw new Error('Bill item type is invalid.');
    }

    if (
      typeof item.amount !== 'number' ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    ) {
      throw new Error(`${label} amount is invalid.`);
    }

    const generatedKey = `CUSTOM_${index + 1}`;
    const key = (item.key?.trim() || generatedKey)
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_')
      .slice(0, 100);

    return {
      categoryId: item.categoryId
        ? new Types.ObjectId(item.categoryId)
        : null,
      key,
      label,
      amount: roundMoney(item.amount),
      type: item.type,
    };
  });

  if (!normalized.some((item) => item.key === 'BASE_RENT')) {
    throw new Error('Base rent is required in every monthly rent bill.');
  }

  if (new Set(normalized.map((item) => item.key)).size !== normalized.length) {
    throw new Error('Duplicate bill item keys are invalid.');
  }

  return normalized;
};

const calculateTotals = (items: IRentBillItem[], adjustmentAmount = 0) => {
  if (!Number.isFinite(adjustmentAmount)) {
    throw new Error('Adjustment amount is invalid.');
  }

  const subtotal = roundMoney(
    items.reduce((total, item) => total + item.amount, 0),
  );
  const normalizedAdjustment = roundMoney(adjustmentAmount);
  const totalAmount = roundMoney(subtotal + normalizedAdjustment);

  if (totalAmount < 0) {
    throw new Error('The bill total cannot be negative.');
  }

  return { subtotal, adjustmentAmount: normalizedAdjustment, totalAmount };
};

const createReceiptNumber = (billingPeriod: string) =>
  `RNT-${billingPeriod.replace('-', '')}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;

const createRentBillIntoDB = async (
  payload: TCreateRentBillPayload,
  actor: TPropertyActor,
) => {
  if (!payload.tenantAssignmentId) {
    throw new Error('Tenant assignment ID is required.');
  }

  const period = parseBillingPeriod(payload.billingPeriod);
  const tenancy = await findAccessibleTenancy(
    payload.tenantAssignmentId,
    actor,
  );
  assertTenancyCoversPeriod(tenancy, period.start, period.end);

  const parties = await loadBillParties(tenancy);
  const items = await normalizeItems(payload.items, tenancy.propertyId);
  const totals = calculateTotals(items, payload.adjustmentAmount ?? 0);
  const dueDate =
    parseOptionalDate(payload.dueDate, 'Due date') ??
    getDefaultDueDate(payload.billingPeriod, tenancy.rentTerms?.dueDay);
  const now = new Date();
  const actorId = new Types.ObjectId(actor.id);

  const createdBill = await MonthlyRentBillModel.create({
    receiptNumber: createReceiptNumber(payload.billingPeriod),
    billingPeriod: payload.billingPeriod,
    ownerId: tenancy.ownerId,
    propertyId: tenancy.propertyId,
    apartmentId: tenancy.apartmentId,
    tenantId: tenancy.tenantId,
    tenantAssignmentId: tenancy._id,
    ownerSnapshot: {
      name: formatName(parties.owner.name),
      phone: parties.owner.phone ?? null,
    },
    propertySnapshot: {
      name: parties.property.name,
      address: parties.property.address,
    },
    apartmentSnapshot: {
      apartmentNumber: parties.apartment.apartmentNumber,
    },
    tenantSnapshot: {
      name: formatName(parties.tenant.name),
      email: parties.tenant.email,
      phone: parties.tenant.phone ?? null,
    },
    items,
    ...totals,
    adjustmentNote:
      normalizeText(payload.adjustmentNote, 1000) ?? null,
    status: 'due',
    issuedAt: now,
    dueDate,
    paidAt: null,
    paymentMethod: null,
    paymentNote: null,
    note: normalizeText(payload.note, 2000) ?? null,
    createdBy: actorId,
    updatedBy: null,
    statusHistory: [
      {
        status: 'due',
        changedBy: actorId,
        changedAt: now,
        note: 'Monthly rent bill issued.',
      },
    ],
  });

  await createdBill.populate(BILL_POPULATE);
  return createdBill;
};

const buildAccessibleBillFilter = (
  billId: string,
  actor: TPropertyActor,
): FilterQuery<IMonthlyRentBill> => {
  ensureActor(actor);
  validateObjectId(billId, 'Rent bill ID');

  const filter: FilterQuery<IMonthlyRentBill> = {
    _id: new Types.ObjectId(billId),
  };

  if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  } else if (actor.role === 'tenant') {
    filter.tenantId = new Types.ObjectId(actor.id);
    filter.status = { $ne: 'void' };
  } else if (actor.role !== 'superAdmin') {
    throw new Error('You are not authorized to view rent bills.');
  }

  return filter;
};

const getAllRentBillsFromDB = async (
  actor: TPropertyActor,
  query: TRentBillListQuery = {},
) => {
  ensureActor(actor);

  if (!['superAdmin', 'owner', 'tenant'].includes(actor.role)) {
    throw new Error('You are not authorized to view rent bills.');
  }

  const filter: FilterQuery<IMonthlyRentBill> = {};

  if (query.year !== undefined) {
    if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2200) {
      throw new Error('Billing year is invalid.');
    }
    filter.billingPeriod = { $regex: `^${query.year}-` };
  }

  if (actor.role === 'tenant') {
    filter.tenantId = new Types.ObjectId(actor.id);
    filter.status = { $ne: 'void' };
  } else if (actor.role === 'owner') {
    filter.ownerId = new Types.ObjectId(actor.id);
  } else if (query.ownerId) {
    validateObjectId(query.ownerId, 'Owner ID');
    filter.ownerId = new Types.ObjectId(query.ownerId);
  }

  for (const [key, value, label] of [
    ['propertyId', query.propertyId, 'Property ID'],
    ['apartmentId', query.apartmentId, 'Apartment ID'],
    ['tenantId', query.tenantId, 'Tenant ID'],
  ] as const) {
    if (!value || actor.role === 'tenant') continue;
    validateObjectId(value, label);
    filter[key] = new Types.ObjectId(value);
  }

  if (query.status && actor.role !== 'tenant') {
    filter.status = query.status;
  } else if (query.status && query.status !== 'void') {
    filter.status = query.status;
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));
  const skip = (page - 1) * limit;

  const [items, total, summaryRows] = await Promise.all([
    MonthlyRentBillModel.find(filter)
      .populate(BILL_POPULATE)
      .sort({ billingPeriod: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MonthlyRentBillModel.countDocuments(filter),
    MonthlyRentBillModel.aggregate<{
      _id: string;
      count: number;
      amount: number;
    }>([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
    ]),
  ]);

  const summaryMap = new Map(
    summaryRows.map((row) => [row._id, { count: row.count, amount: row.amount }]),
  );

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary: {
      totalBills: total,
      dueCount: summaryMap.get('due')?.count ?? 0,
      outstandingAmount: roundMoney(summaryMap.get('due')?.amount ?? 0),
      paidCount: summaryMap.get('paid')?.count ?? 0,
      paidAmount: roundMoney(summaryMap.get('paid')?.amount ?? 0),
      voidCount: summaryMap.get('void')?.count ?? 0,
    },
  };
};

const getSingleRentBillFromDB = async (
  billId: string,
  actor: TPropertyActor,
) => {
  const filter = buildAccessibleBillFilter(billId, actor);
  return MonthlyRentBillModel.findOne(filter).populate(BILL_POPULATE);
};

const updateRentBillInDB = async (
  billId: string,
  payload: TUpdateRentBillPayload,
  actor: TPropertyActor,
) => {
  ensureManager(actor);
  const filter = buildAccessibleBillFilter(billId, actor);
  const bill = await MonthlyRentBillModel.findOne(filter);

  if (!bill) return null;

  if (bill.status !== 'due') {
    throw new Error('Only a due bill can be edited.');
  }

  const items = await normalizeItems(payload.items, bill.propertyId);
  const totals = calculateTotals(items, payload.adjustmentAmount ?? 0);

  bill.items = items;
  bill.subtotal = totals.subtotal;
  bill.adjustmentAmount = totals.adjustmentAmount;
  bill.totalAmount = totals.totalAmount;
  bill.adjustmentNote =
    normalizeText(payload.adjustmentNote, 1000) ?? null;
  bill.dueDate = parseOptionalDate(payload.dueDate, 'Due date');
  bill.note = normalizeText(payload.note, 2000) ?? null;
  bill.updatedBy = new Types.ObjectId(actor.id);

  await bill.save();
  await bill.populate(BILL_POPULATE);
  return bill;
};

const updateRentBillStatusInDB = async (
  billId: string,
  payload: TUpdateRentBillStatusPayload,
  actor: TPropertyActor,
) => {
  ensureManager(actor);
  const filter = buildAccessibleBillFilter(billId, actor);
  const bill = await MonthlyRentBillModel.findOne(filter);

  if (!bill) return null;

  if (!RENT_BILL_STATUSES.includes(payload.status)) {
    throw new Error('Rent bill status is invalid.');
  }

  if (bill.status === 'void') {
    throw new Error('A void bill cannot be changed.');
  }

  if (bill.status === payload.status) {
    throw new Error(`The bill is already ${payload.status}.`);
  }

  const reason = normalizeText(payload.reason, 1000) ?? null;

  if (payload.status === 'void' && !reason) {
    throw new Error('A reason is required to void a bill.');
  }

  if (bill.status === 'paid' && payload.status === 'due' && !reason) {
    throw new Error('A reason is required to reopen a paid bill.');
  }

  const actorId = new Types.ObjectId(actor.id);
  const now = new Date();

  if (payload.status === 'paid') {
    if (bill.status !== 'due') {
      throw new Error('Only a due bill can be marked as paid.');
    }

    if (
      payload.paymentMethod &&
      !PAYMENT_METHODS.includes(payload.paymentMethod)
    ) {
      throw new Error('Payment method is invalid.');
    }

    const paidAt = parseOptionalDate(payload.paidAt, 'Paid date') ?? now;

    if (paidAt.getTime() > Date.now() + 60 * 1000) {
      throw new Error('Paid date cannot be in the future.');
    }

    bill.paidAt = paidAt;
    bill.paymentMethod = payload.paymentMethod ?? 'cash';
    bill.paymentNote = normalizeText(payload.paymentNote, 1000) ?? null;
  } else {
    bill.paidAt = null;
    bill.paymentMethod = null;
    bill.paymentNote = null;
  }

  bill.status = payload.status;
  bill.updatedBy = actorId;
  bill.statusHistory.push({
    status: payload.status,
    changedBy: actorId,
    changedAt: now,
    note:
      reason ??
      normalizeText(payload.paymentNote, 1000) ??
      (payload.status === 'paid' ? 'Payment received.' : null),
  });

  await bill.save();
  await bill.populate(BILL_POPULATE);
  return bill;
};

export const RentBillServices = {
  getGenerationContextFromDB,
  createRentBillIntoDB,
  getAllRentBillsFromDB,
  getSingleRentBillFromDB,
  updateRentBillInDB,
  updateRentBillStatusInDB,
};
