import { FilterQuery, Types } from 'mongoose';

import { ApartmentModel } from '../apartment/apartment.model';
import { PropertyModel } from '../property/property.model';
import { MonthlyRentBillModel } from '../rent-bill/rent-bill.model';
import { TUserRole } from '../user/user.interface';
import { UserModel } from '../user/user.model';
import {
  IPropertyExpense,
  IPropertyExpenseTemplate,
  IPropertyIncome,
  LEDGER_ENTRY_STATUSES,
  LEDGER_INCOME_STATUSES,
  LEDGER_TEMPLATE_FREQUENCIES,
  TCreateExpenseCategoryPayload,
  TCreateExpensePayload,
  TCreateExpenseTemplatePayload,
  TCreateIncomePayload,
} from './property-ledger.interface';
import {
  PropertyExpenseCategoryModel,
  PropertyExpenseModel,
  PropertyExpenseTemplateModel,
  PropertyIncomeModel,
} from './property-ledger.model';

export type TPropertyLedgerActor = { id: string; role: TUserRole };

const DEFAULT_CATEGORIES = [
  ['ELECTRICITY', 'Electricity Bill'],
  ['GAS', 'Gas Bill'],
  ['WATER', 'WASA / Water Bill'],
  ['CARETAKER', 'Caretaker Salary'],
  ['COMMON_CLEANING', 'Staircase / Common Area Cleaning'],
  ['GARBAGE', 'Garbage Cleaning'],
  ['LIFT_GENERATOR', 'Lift / Generator Expense'],
  ['MAINTENANCE', 'Maintenance / Servicing'],
  ['REPAIR', 'Repair'],
  ['PAINTING', 'Painting'],
  ['CONSTRUCTION', 'Construction / Improvement'],
  ['HOLDING_TAX', 'Holding Tax'],
  ['LAND_TAX', 'Land Development Tax'],
  ['SECURITY', 'Internet / Security / CCTV'],
  ['OTHER', 'Other Expense'],
] as const;

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const validateObjectId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new Error(`${name} is invalid.`);
};

const requireManagementRole = (actor: TPropertyLedgerActor) => {
  if (!['superAdmin', 'owner'].includes(actor.role)) {
    throw new Error('You are not authorized to manage the property ledger.');
  }
  validateObjectId(actor.id, 'Authenticated user ID');
};

const requireMonth = (value: string, name = 'Period') => {
  if (!monthPattern.test(value))
    throw new Error(`${name} must use YYYY-MM format.`);
  return value;
};

const normalizeText = (value: unknown, name: string, max = 160) => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${name} is required.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${name} is too long.`);
  return normalized;
};

const normalizeNullableText = (value: unknown, max = 2000) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Text value is invalid.');
  const normalized = value.trim();
  if (normalized.length > max) throw new Error('Text value is too long.');
  return normalized || null;
};

const normalizeAmount = (value: unknown, name: string, nullable = false) => {
  if (nullable && (value === undefined || value === null || value === ''))
    return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error(`${name} must be zero or more.`);
  return Math.round(amount * 100) / 100;
};

const resolveOwnerId = async (
  actor: TPropertyLedgerActor,
  requested?: string,
) => {
  requireManagementRole(actor);
  const ownerId = actor.role === 'owner' ? actor.id : requested?.trim();
  if (!ownerId) throw new Error('Owner ID is required.');
  validateObjectId(ownerId, 'Owner ID');
  const owner = await UserModel.findOne({
    _id: ownerId,
    role: 'owner',
    userStatus: 'active',
    isDeleted: { $ne: true },
  }).select('_id');
  if (!owner) throw new Error('A valid active owner was not found.');
  return owner._id;
};

const ensureProperty = async (propertyId: string, ownerId: Types.ObjectId) => {
  validateObjectId(propertyId, 'Property ID');
  const property = await PropertyModel.findOne({
    _id: propertyId,
    ownerId,
    isDeleted: { $ne: true },
  }).select('_id name address ownerId');
  if (!property) throw new Error('An accessible property was not found.');
  return property;
};

const ensureApartment = async (
  apartmentId: string | null | undefined,
  propertyId: Types.ObjectId,
) => {
  if (!apartmentId) return null;
  validateObjectId(apartmentId, 'Apartment ID');
  const apartment = await ApartmentModel.findOne({
    _id: apartmentId,
    propertyId,
    isDeleted: { $ne: true },
  }).select('_id apartmentNumber');
  if (!apartment) throw new Error('An accessible apartment was not found.');
  return apartment._id;
};

const seedDefaultCategories = async (
  ownerId: Types.ObjectId,
  actorId: Types.ObjectId,
) => {
  await PropertyExpenseCategoryModel.bulkWrite(
    DEFAULT_CATEGORIES.map(([key, name]) => ({
      updateOne: {
        filter: { ownerId, key },
        update: {
          $setOnInsert: {
            ownerId,
            key,
            name,
            isActive: true,
            isSystemDefault: true,
            createdBy: actorId,
            updatedBy: null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
};

const getCategories = async (
  actor: TPropertyLedgerActor,
  ownerIdInput?: string,
  includeInactive = false,
) => {
  const ownerId = await resolveOwnerId(actor, ownerIdInput);
  await seedDefaultCategories(ownerId, new Types.ObjectId(actor.id));
  return PropertyExpenseCategoryModel.find({
    ownerId,
    ...(includeInactive ? {} : { isActive: true }),
  })
    .sort({ isSystemDefault: -1, name: 1 })
    .lean();
};

const createCategory = async (
  payload: TCreateExpenseCategoryPayload & { ownerId?: string },
  actor: TPropertyLedgerActor,
) => {
  const ownerId = await resolveOwnerId(actor, payload.ownerId);
  const name = normalizeText(payload.name, 'Category name', 120);
  const key = `CUSTOM_${name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')}`;
  return PropertyExpenseCategoryModel.create({
    ownerId,
    key,
    name,
    isActive: true,
    isSystemDefault: false,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const updateCategory = async (
  categoryId: string,
  payload: { name?: string; isActive?: boolean },
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(categoryId, 'Category ID');
  const category = await PropertyExpenseCategoryModel.findById(categoryId);
  if (!category) return null;
  if (actor.role === 'owner' && category.ownerId.toString() !== actor.id) {
    throw new Error('You are not authorized to update this category.');
  }
  if (payload.name !== undefined)
    category.name = normalizeText(payload.name, 'Category name', 120);
  if (payload.isActive !== undefined)
    category.isActive = Boolean(payload.isActive);
  category.updatedBy = new Types.ObjectId(actor.id);
  return category.save();
};

const validateTemplatePayload = async (
  payload: TCreateExpenseTemplatePayload,
  actor: TPropertyLedgerActor,
) => {
  const ownerId = await resolveOwnerId(actor, payload.ownerId);
  const property = await ensureProperty(payload.propertyId, ownerId);
  const apartmentId = await ensureApartment(payload.apartmentId, property._id);
  validateObjectId(payload.categoryId, 'Category ID');
  const category = await PropertyExpenseCategoryModel.findOne({
    _id: payload.categoryId,
    ownerId,
  }).select('_id');
  if (!category)
    throw new Error('An accessible expense category was not found.');
  const frequency = payload.frequency ?? 'monthly';
  if (!LEDGER_TEMPLATE_FREQUENCIES.includes(frequency))
    throw new Error('Template frequency is invalid.');
  const months = [...new Set(payload.months ?? [])]
    .map(Number)
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b);
  requireMonth(payload.activeFrom, 'Active from');
  if (payload.activeTo) {
    requireMonth(payload.activeTo, 'Active to');
    if (payload.activeTo < payload.activeFrom)
      throw new Error('Active to cannot be before active from.');
  }
  if (frequency === 'custom' && months.length === 0)
    throw new Error('Select at least one month for a custom template.');
  const dueDay = payload.dueDay == null ? null : Number(payload.dueDay);
  if (
    dueDay !== null &&
    (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
  ) {
    throw new Error('Due day must be between 1 and 31.');
  }
  return {
    ownerId,
    propertyId: property._id,
    apartmentId,
    categoryId: category._id,
    title: normalizeText(payload.title, 'Template title'),
    defaultAmount: normalizeAmount(
      payload.defaultAmount,
      'Default amount',
      true,
    ),
    frequency,
    months,
    activeFrom: payload.activeFrom,
    activeTo: payload.activeTo || null,
    dueDay,
    note: normalizeNullableText(payload.note),
    isActive: payload.isActive ?? true,
  };
};

const createTemplate = async (
  payload: TCreateExpenseTemplatePayload,
  actor: TPropertyLedgerActor,
) => {
  const data = await validateTemplatePayload(payload, actor);
  return PropertyExpenseTemplateModel.create({
    ...data,
    isDeleted: false,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const listTemplates = async (
  actor: TPropertyLedgerActor,
  query: { ownerId?: string; propertyId?: string; includeInactive?: boolean },
) => {
  const ownerId = await resolveOwnerId(actor, query.ownerId);
  const filter: FilterQuery<IPropertyExpenseTemplate> = {
    ownerId,
    isDeleted: { $ne: true },
  };
  if (query.propertyId) {
    await ensureProperty(query.propertyId, ownerId);
    filter.propertyId = new Types.ObjectId(query.propertyId);
  }
  if (!query.includeInactive) filter.isActive = true;
  return PropertyExpenseTemplateModel.find(filter)
    .populate('propertyId', 'name address')
    .populate('apartmentId', 'apartmentNumber')
    .populate('categoryId', 'key name isActive')
    .sort({ createdAt: -1 })
    .lean();
};

const updateTemplate = async (
  templateId: string,
  payload: Partial<TCreateExpenseTemplatePayload>,
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(templateId, 'Template ID');
  const existing = await PropertyExpenseTemplateModel.findOne({
    _id: templateId,
    isDeleted: { $ne: true },
  });
  if (!existing) return null;
  if (actor.role === 'owner' && existing.ownerId.toString() !== actor.id) {
    throw new Error('You are not authorized to update this template.');
  }
  const merged: TCreateExpenseTemplatePayload = {
    ownerId: existing.ownerId.toString(),
    propertyId: payload.propertyId ?? existing.propertyId.toString(),
    apartmentId:
      payload.apartmentId === undefined
        ? (existing.apartmentId?.toString() ?? null)
        : payload.apartmentId,
    categoryId: payload.categoryId ?? existing.categoryId.toString(),
    title: payload.title ?? existing.title,
    defaultAmount:
      payload.defaultAmount === undefined
        ? existing.defaultAmount
        : payload.defaultAmount,
    frequency: payload.frequency ?? existing.frequency,
    months: payload.months ?? existing.months,
    activeFrom: payload.activeFrom ?? existing.activeFrom,
    activeTo:
      payload.activeTo === undefined ? existing.activeTo : payload.activeTo,
    dueDay: payload.dueDay === undefined ? existing.dueDay : payload.dueDay,
    note: payload.note === undefined ? existing.note : payload.note,
    isActive: payload.isActive ?? existing.isActive,
  };
  const data = await validateTemplatePayload(merged, actor);
  existing.set({ ...data, updatedBy: new Types.ObjectId(actor.id) });
  return existing.save();
};

const deleteTemplate = async (
  templateId: string,
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(templateId, 'Template ID');
  const filter: FilterQuery<IPropertyExpenseTemplate> = {
    _id: templateId,
    isDeleted: { $ne: true },
  };
  if (actor.role === 'owner') filter.ownerId = new Types.ObjectId(actor.id);
  return PropertyExpenseTemplateModel.findOneAndUpdate(
    filter,
    {
      $set: {
        isDeleted: true,
        isActive: false,
        updatedBy: new Types.ObjectId(actor.id),
      },
    },
    { new: true },
  );
};

const templateAppliesToPeriod = (
  template: IPropertyExpenseTemplate,
  period: string,
) => {
  if (
    period < template.activeFrom ||
    (template.activeTo && period > template.activeTo)
  )
    return false;
  const month = Number(period.slice(5, 7));
  const startMonth = Number(template.activeFrom.slice(5, 7));
  if (template.frequency === 'monthly') return true;
  if (template.frequency === 'custom') return template.months.includes(month);
  if (template.frequency === 'yearly')
    return template.months.length > 0
      ? template.months.includes(month)
      : month === startMonth;
  if (template.months.length > 0) return template.months.includes(month);
  const startIndex =
    Number(template.activeFrom.slice(0, 4)) * 12 + startMonth - 1;
  const currentIndex = Number(period.slice(0, 4)) * 12 + month - 1;
  return (currentIndex - startIndex) % 3 === 0;
};

const prepareMonth = async (
  payload: { ownerId?: string; propertyId: string; period: string },
  actor: TPropertyLedgerActor,
) => {
  const ownerId = await resolveOwnerId(actor, payload.ownerId);
  const property = await ensureProperty(payload.propertyId, ownerId);
  const period = requireMonth(payload.period);
  await seedDefaultCategories(ownerId, new Types.ObjectId(actor.id));
  const templates = await PropertyExpenseTemplateModel.find({
    ownerId,
    propertyId: property._id,
    isActive: true,
    isDeleted: { $ne: true },
  }).lean();
  const applicable = templates.filter((template) =>
    templateAppliesToPeriod(template, period),
  );
  if (applicable.length > 0) {
    await PropertyExpenseModel.bulkWrite(
      applicable.map((template) => ({
        updateOne: {
          filter: { templateId: template._id, period },
          update: {
            $setOnInsert: {
              ownerId,
              propertyId: property._id,
              apartmentId: template.apartmentId ?? null,
              categoryId: template.categoryId,
              templateId: template._id,
              period,
              expenseDate: null,
              title: template.title,
              amount: template.defaultAmount ?? null,
              status: 'pending',
              source: 'template',
              note: template.note ?? null,
              paymentMethod: null,
              isDeleted: false,
              createdBy: new Types.ObjectId(actor.id),
              updatedBy: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return { prepared: applicable.length, period };
};

const validateExpensePayload = async (
  payload: TCreateExpensePayload,
  actor: TPropertyLedgerActor,
) => {
  const ownerId = await resolveOwnerId(actor, payload.ownerId);
  const property = await ensureProperty(payload.propertyId, ownerId);
  const apartmentId = await ensureApartment(payload.apartmentId, property._id);
  validateObjectId(payload.categoryId, 'Category ID');
  const category = await PropertyExpenseCategoryModel.findOne({
    _id: payload.categoryId,
    ownerId,
  }).select('_id');
  if (!category)
    throw new Error('An accessible expense category was not found.');
  const status = payload.status ?? 'pending';
  if (!LEDGER_ENTRY_STATUSES.includes(status))
    throw new Error('Expense status is invalid.');
  return {
    ownerId,
    propertyId: property._id,
    apartmentId,
    categoryId: category._id,
    period: requireMonth(payload.period),
    expenseDate: payload.expenseDate ? new Date(payload.expenseDate) : null,
    title: normalizeText(payload.title, 'Expense title'),
    amount: normalizeAmount(payload.amount, 'Expense amount', true),
    status,
    note: normalizeNullableText(payload.note),
    paymentMethod: normalizeNullableText(payload.paymentMethod, 100),
  };
};

const createExpense = async (
  payload: TCreateExpensePayload,
  actor: TPropertyLedgerActor,
) => {
  const data = await validateExpensePayload(payload, actor);
  return PropertyExpenseModel.create({
    ...data,
    source: 'manual',
    templateId: null,
    isDeleted: false,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const updateExpense = async (
  expenseId: string,
  payload: Partial<TCreateExpensePayload>,
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(expenseId, 'Expense ID');
  const existing = await PropertyExpenseModel.findOne({
    _id: expenseId,
    isDeleted: { $ne: true },
  });
  if (!existing) return null;
  if (actor.role === 'owner' && existing.ownerId.toString() !== actor.id)
    throw new Error('You are not authorized to update this expense.');
  const merged: TCreateExpensePayload = {
    ownerId: existing.ownerId.toString(),
    propertyId: existing.propertyId.toString(),
    apartmentId: existing.apartmentId?.toString() ?? null,
    categoryId: payload.categoryId ?? existing.categoryId.toString(),
    period: payload.period ?? existing.period,
    expenseDate:
      payload.expenseDate === undefined
        ? existing.expenseDate
        : payload.expenseDate,
    title: payload.title ?? existing.title,
    amount: payload.amount === undefined ? existing.amount : payload.amount,
    status: payload.status ?? existing.status,
    note: payload.note === undefined ? existing.note : payload.note,
    paymentMethod:
      payload.paymentMethod === undefined
        ? existing.paymentMethod
        : payload.paymentMethod,
  };
  const data = await validateExpensePayload(merged, actor);
  existing.set({ ...data, updatedBy: new Types.ObjectId(actor.id) });
  return existing.save();
};

const deleteExpense = async (
  expenseId: string,
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(expenseId, 'Expense ID');
  const filter: FilterQuery<IPropertyExpense> = {
    _id: expenseId,
    isDeleted: { $ne: true },
  };
  if (actor.role === 'owner') filter.ownerId = new Types.ObjectId(actor.id);
  return PropertyExpenseModel.findOneAndUpdate(
    filter,
    { $set: { isDeleted: true, updatedBy: new Types.ObjectId(actor.id) } },
    { new: true },
  );
};

const validateIncomePayload = async (
  payload: TCreateIncomePayload,
  actor: TPropertyLedgerActor,
) => {
  const ownerId = await resolveOwnerId(actor, payload.ownerId);
  const property = await ensureProperty(payload.propertyId, ownerId);
  const apartmentId = await ensureApartment(payload.apartmentId, property._id);
  const status = payload.status ?? 'received';
  if (!LEDGER_INCOME_STATUSES.includes(status))
    throw new Error('Income status is invalid.');
  return {
    ownerId,
    propertyId: property._id,
    apartmentId,
    period: requireMonth(payload.period),
    receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : null,
    title: normalizeText(payload.title, 'Income title'),
    amount: normalizeAmount(payload.amount, 'Income amount'),
    status,
    note: normalizeNullableText(payload.note),
    paymentMethod: normalizeNullableText(payload.paymentMethod, 100),
  };
};

const createIncome = async (
  payload: TCreateIncomePayload,
  actor: TPropertyLedgerActor,
) => {
  const data = await validateIncomePayload(payload, actor);
  return PropertyIncomeModel.create({
    ...data,
    isDeleted: false,
    createdBy: new Types.ObjectId(actor.id),
  });
};

const updateIncome = async (
  incomeId: string,
  payload: Partial<TCreateIncomePayload>,
  actor: TPropertyLedgerActor,
) => {
  requireManagementRole(actor);
  validateObjectId(incomeId, 'Income ID');
  const existing = await PropertyIncomeModel.findOne({
    _id: incomeId,
    isDeleted: { $ne: true },
  });
  if (!existing) return null;
  if (actor.role === 'owner' && existing.ownerId.toString() !== actor.id)
    throw new Error('You are not authorized to update this income.');
  const merged: TCreateIncomePayload = {
    ownerId: existing.ownerId.toString(),
    propertyId: existing.propertyId.toString(),
    apartmentId: existing.apartmentId?.toString() ?? null,
    period: payload.period ?? existing.period,
    receivedDate:
      payload.receivedDate === undefined
        ? existing.receivedDate
        : payload.receivedDate,
    title: payload.title ?? existing.title,
    amount: payload.amount ?? existing.amount,
    status: payload.status ?? existing.status,
    note: payload.note === undefined ? existing.note : payload.note,
    paymentMethod:
      payload.paymentMethod === undefined
        ? existing.paymentMethod
        : payload.paymentMethod,
  };
  const data = await validateIncomePayload(merged, actor);
  existing.set({ ...data, updatedBy: new Types.ObjectId(actor.id) });
  return existing.save();
};

const deleteIncome = async (incomeId: string, actor: TPropertyLedgerActor) => {
  requireManagementRole(actor);
  validateObjectId(incomeId, 'Income ID');
  const filter: FilterQuery<IPropertyIncome> = {
    _id: incomeId,
    isDeleted: { $ne: true },
  };
  if (actor.role === 'owner') filter.ownerId = new Types.ObjectId(actor.id);
  return PropertyIncomeModel.findOneAndUpdate(
    filter,
    { $set: { isDeleted: true, updatedBy: new Types.ObjectId(actor.id) } },
    { new: true },
  );
};

const ledgerPopulate = [
  { path: 'propertyId', select: 'name address' },
  { path: 'apartmentId', select: 'apartmentNumber' },
];

const getOverview = async (
  actor: TPropertyLedgerActor,
  query: { ownerId?: string; propertyId: string; period: string },
) => {
  const ownerId = await resolveOwnerId(actor, query.ownerId);
  const property = await ensureProperty(query.propertyId, ownerId);
  const period = requireMonth(query.period);
  const [rentBills, otherIncome, expenses] = await Promise.all([
    MonthlyRentBillModel.find({
      ownerId,
      propertyId: property._id,
      billingPeriod: period,
      status: { $ne: 'void' },
    })
      .select(
        'receiptNumber apartmentId tenantId apartmentSnapshot tenantSnapshot totalAmount status paidAt paymentMethod',
      )
      .sort({ 'apartmentSnapshot.apartmentNumber': 1 })
      .lean(),
    PropertyIncomeModel.find({
      ownerId,
      propertyId: property._id,
      period,
      isDeleted: { $ne: true },
    })
      .populate(ledgerPopulate)
      .sort({ createdAt: 1 })
      .lean(),
    PropertyExpenseModel.find({
      ownerId,
      propertyId: property._id,
      period,
      isDeleted: { $ne: true },
    })
      .populate([...ledgerPopulate, { path: 'categoryId', select: 'key name' }])
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const rentBilled = rentBills.reduce((sum, row) => sum + row.totalAmount, 0);
  const rentCollected = rentBills
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + row.totalAmount, 0);
  const otherIncomeReceived = otherIncome
    .filter((row) => row.status === 'received')
    .reduce((sum, row) => sum + row.amount, 0);
  const expensePaid = expenses
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const expensePending = expenses
    .filter((row) => row.status === 'pending')
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);
  return {
    property,
    period,
    summary: {
      rentBilled,
      rentCollected,
      rentOutstanding: rentBilled - rentCollected,
      otherIncomeReceived,
      totalCashIncome: rentCollected + otherIncomeReceived,
      expensePaid,
      expensePending,
      netCashFlow: rentCollected + otherIncomeReceived - expensePaid,
    },
    rentBills,
    otherIncome,
    expenses,
  };
};

const monthCount = (start: string, end: string) => {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  return (ey - sy) * 12 + em - sm + 1;
};

const getReport = async (
  actor: TPropertyLedgerActor,
  query: {
    ownerId?: string;
    propertyId?: string;
    startPeriod: string;
    endPeriod: string;
  },
) => {
  const ownerId = await resolveOwnerId(actor, query.ownerId);
  const startPeriod = requireMonth(query.startPeriod, 'Start period');
  const endPeriod = requireMonth(query.endPeriod, 'End period');
  const rangeSize = monthCount(startPeriod, endPeriod);
  if (rangeSize < 1)
    throw new Error('End period cannot be before start period.');
  if (rangeSize > 60) throw new Error('Report range cannot exceed 60 months.');
  const propertyFilter: {
    ownerId: Types.ObjectId;
    propertyId?: Types.ObjectId;
  } = { ownerId };
  let selectedProperty = null;
  if (query.propertyId) {
    selectedProperty = await ensureProperty(query.propertyId, ownerId);
    propertyFilter.propertyId = selectedProperty._id;
  }
  const periodFilter = { $gte: startPeriod, $lte: endPeriod };
  const [rentBills, incomes, expenses, properties] = await Promise.all([
    MonthlyRentBillModel.find({
      ...propertyFilter,
      billingPeriod: periodFilter,
      status: { $ne: 'void' },
    })
      .select(
        'receiptNumber billingPeriod propertyId apartmentSnapshot tenantSnapshot totalAmount status paidAt paymentMethod',
      )
      .populate('propertyId', 'name address')
      .sort({ billingPeriod: 1 })
      .lean(),
    PropertyIncomeModel.find({
      ...propertyFilter,
      period: periodFilter,
      isDeleted: { $ne: true },
    })
      .populate(ledgerPopulate)
      .sort({ period: 1 })
      .lean(),
    PropertyExpenseModel.find({
      ...propertyFilter,
      period: periodFilter,
      isDeleted: { $ne: true },
      status: { $ne: 'skipped' },
    })
      .populate([...ledgerPopulate, { path: 'categoryId', select: 'key name' }])
      .sort({ period: 1 })
      .lean(),
    PropertyModel.find({
      ownerId,
      isDeleted: { $ne: true },
      ...(query.propertyId ? { _id: query.propertyId } : {}),
    })
      .select('name address')
      .sort({ name: 1 })
      .lean(),
  ]);
  const months: Record<
    string,
    {
      period: string;
      rentBilled: number;
      rentCollected: number;
      otherIncome: number;
      expenses: number;
      netCashFlow: number;
    }
  > = {};
  const ensureMonth = (period: string) => {
    months[period] ??= {
      period,
      rentBilled: 0,
      rentCollected: 0,
      otherIncome: 0,
      expenses: 0,
      netCashFlow: 0,
    };
    return months[period];
  };
  let cursor = startPeriod;
  while (cursor <= endPeriod) {
    ensureMonth(cursor);
    const [year, month] = cursor.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cursor = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  rentBills.forEach((row) => {
    const month = ensureMonth(row.billingPeriod);
    month.rentBilled += row.totalAmount;
    if (row.status === 'paid') month.rentCollected += row.totalAmount;
  });
  incomes.forEach((row) => {
    if (row.status === 'received')
      ensureMonth(row.period).otherIncome += row.amount;
  });
  expenses.forEach((row) => {
    if (row.status === 'paid')
      ensureMonth(row.period).expenses += row.amount ?? 0;
  });
  Object.values(months).forEach((month) => {
    month.netCashFlow =
      month.rentCollected + month.otherIncome - month.expenses;
  });
  const monthly = Object.values(months).sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  const summary = monthly.reduce(
    (total, row) => ({
      rentBilled: total.rentBilled + row.rentBilled,
      rentCollected: total.rentCollected + row.rentCollected,
      otherIncome: total.otherIncome + row.otherIncome,
      expenses: total.expenses + row.expenses,
      netCashFlow: total.netCashFlow + row.netCashFlow,
    }),
    {
      rentBilled: 0,
      rentCollected: 0,
      otherIncome: 0,
      expenses: 0,
      netCashFlow: 0,
    },
  );
  return {
    ownerId,
    selectedProperty,
    properties,
    startPeriod,
    endPeriod,
    summary,
    monthly,
    rentBills,
    incomes,
    expenses,
  };
};

export const PropertyLedgerServices = {
  getCategories,
  createCategory,
  updateCategory,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  prepareMonth,
  createExpense,
  updateExpense,
  deleteExpense,
  createIncome,
  updateIncome,
  deleteIncome,
  getOverview,
  getReport,
};
