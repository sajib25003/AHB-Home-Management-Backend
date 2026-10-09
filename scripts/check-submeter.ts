import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { ApartmentModel } from '../src/app/modules/apartment/apartment.model';
import { PropertyModel } from '../src/app/modules/property/property.model';
import { TenancyModel } from '../src/app/modules/tenancy/tenancy.model';
import { MonthlyRentBillModel } from '../src/app/modules/rent-bill/rent-bill.model';
import { ElectricityTariffScheduleModel } from '../src/app/modules/electricity/electricity.model';
import { SubmeterReadingModel } from '../src/app/modules/electricity/submeter.model';
import { RentBillServices } from '../src/app/modules/rent-bill/rent-bill.service';
import { UserModel } from '../src/app/modules/user/user.model';
import { SubmeterServices } from '../src/app/modules/electricity/submeter.service';

// Exercise service authorization and the real tariff calculator without touching a database.
const ownerId = new Types.ObjectId();
const apartmentId = new Types.ObjectId();
const propertyId = new Types.ObjectId();
const actor = { id: ownerId.toString(), role: 'owner' as const };
let previous: Record<string, unknown> | null = null;
let existing: Record<string, unknown> | null = null;
let dueBills: Array<Record<string, unknown>> = [];
let syncFilter: Record<string, unknown> = {};
let syncPipeline: unknown[] = [];
let config = {
  billingType: 'submeter',
  paymentResponsibility: 'ownerCollects',
  meterNumber: 'TEST-001',
};
let saved: Record<string, unknown> | null = null;
const query = (value: unknown) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  populate() {
    return this;
  },
  lean() {
    return Promise.resolve(value);
  },
  then(resolve: (value: unknown) => unknown) {
    return Promise.resolve(value).then(resolve);
  },
});
TenancyModel.findOne = (() => {
  throw new Error('Submeter readings must not depend on tenants.');
}) as never;
ApartmentModel.findOne = (() =>
  query({ _id: apartmentId, propertyId, electricityConfig: config })) as never;
PropertyModel.findOne = ((filter: { ownerId?: string }) =>
  query(
    filter.ownerId && String(filter.ownerId) !== actor.id
      ? null
      : {
          _id: propertyId,
          ownerId,
          electricitySettings: { providerId: new Types.ObjectId() },
        },
  )) as never;
SubmeterReadingModel.findOne = ((filter: { billingPeriod: unknown }) =>
  query(
    typeof filter.billingPeriod === 'string' ? existing : previous,
  )) as never;
MonthlyRentBillModel.find = (() => query(dueBills)) as never;
MonthlyRentBillModel.updateMany = ((
  filter: Record<string, unknown>,
  pipeline: unknown[],
) => {
  syncFilter = filter;
  syncPipeline = pipeline;
  return Promise.resolve({ modifiedCount: dueBills.length });
}) as never;
SubmeterReadingModel.findOneAndUpdate = ((
  _filter: unknown,
  update: { $set: Record<string, unknown> },
) => {
  saved = {
    ...existing,
    ...update.$set,
    revision: Number(existing?.revision ?? 0) + 1,
  };
  return Promise.resolve({ toObject: () => saved });
}) as never;
SubmeterReadingModel.create = ((value: Record<string, unknown>) => {
  saved = value;
  return Promise.resolve({ toObject: () => value });
}) as never;
ElectricityTariffScheduleModel.findOne = (() =>
  query({
    _id: new Types.ObjectId(),
    name: 'Synthetic test tariff',
    effectiveFrom: new Date('2019-01-01'),
    effectiveTo: null,
    lifeline: { maximumUnit: 50, rate: 4 },
    slabs: [
      { fromUnit: 0, toUnit: 75, rate: 5 },
      { fromUnit: 76, toUnit: null, rate: 6 },
    ],
    vatPercentage: 5,
    meterCharges: [],
  })) as never;

async function run() {
  const payload = {
    apartmentId: apartmentId.toString(),
    billingPeriod: '2020-01',
    currentReadingDate: '2020-02-01',
    previousReadingDate: '2020-01-01',
    previousReading: 1000,
    currentReading: 1100,
    meterCharge: 10,
    adjustmentAmount: -5,
  };
  const preview = await SubmeterServices.preview(payload, actor);
  assert.equal(preview.consumedUnit, 100);
  assert.equal(preview.energyCharge, 525); // 75 × 5 + 25 × 6
  assert.equal(preview.vatAmount, 26.75);
  assert.equal(preview.totalAmount, 556.75);
  await SubmeterServices.save(payload, actor);
  assert.equal(saved?.['currentReading'], 1100);
  assert.equal(saved?.['createdBy'], actor.id);
  assert.equal(String(saved?.['apartmentId']), apartmentId.toString());
  assert.equal(saved?.['tenantAssignmentId'], undefined);
  const zero = await SubmeterServices.preview(
    { ...payload, currentReading: 1000, meterCharge: 0, adjustmentAmount: 0 },
    actor,
  );
  assert.equal(zero.totalAmount, 0);
  const fractional = await SubmeterServices.preview(
    {
      ...payload,
      currentReading: 1000.25,
      meterCharge: 0,
      adjustmentAmount: 0,
    },
    actor,
  );
  assert.equal(fractional.consumedUnit, 0.25);
  assert.equal(fractional.totalAmount, 1.05);
  await assert.rejects(
    SubmeterServices.preview({ ...payload, currentReading: 999 }, actor),
    /cannot be less/,
  );
  await assert.rejects(
    SubmeterServices.preview({ ...payload, currentReading: Number.NaN }, actor),
    /valid non-negative/,
  );
  await assert.rejects(
    SubmeterServices.preview({ ...payload, billingPeriod: '2020-13' }, actor),
    /invalid/,
  );
  await assert.rejects(
    SubmeterServices.preview({ ...payload, billingPeriod: '2200-01' }, actor),
    /future/,
  );
  await assert.rejects(
    SubmeterServices.preview(payload, { ...actor, role: 'tenant' }),
    /not authorized/,
  );
  await assert.rejects(
    SubmeterServices.preview(payload, {
      id: new Types.ObjectId().toString(),
      role: 'owner',
    }),
    /access was denied/,
  );
  await SubmeterServices.preview(payload, {
    id: new Types.ObjectId().toString(),
    role: 'superAdmin',
  });
  previous = {
    currentReading: 1000,
    currentReadingDate: '2019-12-31',
    billingPeriod: '2019-12',
    calculation: { meterCharge: 124 },
  };
  // A manual baseline is allowed even when it differs from the last saved reading.
  await SubmeterServices.preview({ ...payload, previousReading: 999 }, actor);
  const context = await SubmeterServices.getContext(
    payload.apartmentId,
    payload.billingPeriod,
    actor,
  );
  assert.equal(context.previousReading, 1000);
  assert.equal(context.previousReadingDate, '2019-12-31');
  assert.equal(context.previousMeterCharge, 124);
  await assert.rejects(
    SubmeterServices.preview({ ...payload, currentReadingDate: '' }, actor),
    /valid date/,
  );
  await assert.rejects(
    SubmeterServices.preview(
      { ...payload, currentReadingDate: '2020-02-30' },
      actor,
    ),
    /valid date/,
  );
  await assert.rejects(
    SubmeterServices.preview(
      { ...payload, previousReadingDate: '2020-03-01' },
      actor,
    ),
    /cannot be after/,
  );
  const originalTariffLookup = ElectricityTariffScheduleModel.findOne;
  ElectricityTariffScheduleModel.findOne = (() => {
    throw new Error('Manual average must not use provider tariff');
  }) as never;
  const average = await SubmeterServices.preview(
    { ...payload, useAverageRate: true, averageRate: 8.1234 },
    actor,
  );
  assert.equal(average.energyCharge, 812.34);
  assert.equal(average.vatAmount, 0);
  assert.equal(average.totalAmount, 817.34); // 100 units + meter 10 + adjustment -5
  for (const rate of [0, -1, NaN, Infinity, null]) {
    await assert.rejects(
      SubmeterServices.preview(
        { ...payload, useAverageRate: true, averageRate: rate },
        actor,
      ),
      /Average rate/,
    );
  }
  await assert.rejects(
    SubmeterServices.preview(
      {
        ...payload,
        useAverageRate: true,
        averageRate: 8,
        adjustmentAmount: NaN,
      },
      actor,
    ),
    /adjustment/,
  );
  const manualSaved = await SubmeterServices.save(
    { ...payload, useAverageRate: true, averageRate: 8.1234 },
    actor,
  );
  assert.equal(manualSaved.useAverageRate, true);
  assert.equal(manualSaved.averageRate, 8.1234);
  assert.equal(manualSaved.calculation.breakdown[0].rate, 8.1234);
  ElectricityTariffScheduleModel.findOne = originalTariffLookup;
  existing = { _id: new Types.ObjectId(), apartmentId, revision: 0 };
  await assert.rejects(SubmeterServices.save(payload, actor), /has changed/);
  dueBills = [
    {
      items: [
        { key: 'BASE_RENT', amount: 2000 },
        { key: 'ELECTRICITY', amount: null },
      ],
      adjustmentAmount: 0,
    },
  ];
  const updated = await SubmeterServices.save(
    { ...payload, expectedRevision: 0 },
    actor,
  );
  assert.equal(updated.revision, 1);
  assert.equal(updated.syncedRentBills, 1);
  assert.equal(syncFilter.status, 'due');
  assert.equal(syncFilter.billingPeriod, '2020-01');
  assert.equal(syncPipeline.length, 3);
  assert.equal(saved?.currentReadingDate, '2020-02-01');
  dueBills = [
    { items: [{ key: 'BASE_RENT', amount: 10 }], adjustmentAmount: -1000 },
  ];
  await assert.rejects(
    SubmeterServices.preview(payload, actor),
    /total negative/,
  );
  dueBills = [];
  config = { ...config, paymentResponsibility: 'tenantPaysDirectly' };
  await assert.rejects(
    SubmeterServices.preview(payload, actor),
    /owner collection/,
  );
  config = { ...config, paymentResponsibility: 'ownerCollects' };
  // The real bill service must auto-fill electricity and preserve a missing bill as null.
  const tenancyId = new Types.ObjectId();
  TenancyModel.findOne = (() =>
    query({
      _id: tenancyId,
      apartmentId,
      propertyId,
      ownerId,
      tenantId: new Types.ObjectId(),
      startDate: new Date('2019-01-01'),
    })) as never;
  UserModel.findOne = (() =>
    query({
      name: { firstName: 'Test', lastName: 'User' },
      email: 'test@example.test',
    })) as never;
  let createdBill: Record<string, unknown> = {};
  MonthlyRentBillModel.create = ((data: Record<string, unknown>) => {
    createdBill = data;
    return Promise.resolve({ ...data, populate: async () => null });
  }) as never;
  const billPayload = {
    tenantAssignmentId: tenancyId.toString(),
    billingPeriod: '2020-01',
    items: [
      { key: 'BASE_RENT', label: 'Rent', amount: 2000, type: 'fixed' as const },
      {
        key: 'ELECTRICITY',
        label: 'Electricity',
        amount: 9999,
        type: 'variable' as const,
      },
    ],
  };
  existing = null;
  await RentBillServices.createRentBillIntoDB(billPayload, actor);
  assert.equal(
    (createdBill.items as Array<{ amount: number | null }>)[1].amount,
    null,
  );
  assert.equal(createdBill.totalAmount, 2000);
  existing = { calculation: { totalAmount: 556.75 } };
  await RentBillServices.createRentBillIntoDB(billPayload, actor);
  assert.equal(
    (createdBill.items as Array<{ amount: number | null }>)[1].amount,
    556.75,
  );
  assert.equal(createdBill.totalAmount, 2556.75);
  console.log(
    'PASS: manual average rate without provider tariff or extra VAT, validation and persistence; dated readings, editable baseline, next-month reading date, revisions, owner isolation, automatic due-bill sync, tariff math, blank and auto-filled electricity in real bill service',
  );
}
void run();
