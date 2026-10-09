import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { ApartmentModel } from '../src/app/modules/apartment/apartment.model';
import { PropertyModel } from '../src/app/modules/property/property.model';
import { TenancyModel } from '../src/app/modules/tenancy/tenancy.model';
import { MonthlyRentBillModel } from '../src/app/modules/rent-bill/rent-bill.model';
import { ElectricityTariffScheduleModel } from '../src/app/modules/electricity/electricity.model';
import { SubmeterReadingModel } from '../src/app/modules/electricity/submeter.model';
import { SubmeterServices } from '../src/app/modules/electricity/submeter.service';

// Exercise service authorization and the real tariff calculator without touching a database.
const ownerId = new Types.ObjectId();
const apartmentId = new Types.ObjectId();
const propertyId = new Types.ObjectId();
const actor = { id: ownerId.toString(), role: 'owner' as const };
let previous: Record<string, unknown> | null = null;
let existing: Record<string, unknown> | null = null;
let later = false;
let issued = false;
let config = {
  billingType: 'submeter',
  paymentResponsibility: 'ownerCollects',
  meterNumber: 'TEST-001',
};
let saved: Record<string, unknown> | null = null;
const query = (value: unknown) => ({
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
TenancyModel.findOne = (() => { throw new Error('Submeter readings must not depend on tenants.'); }) as never;
ApartmentModel.findOne = (() => query({ _id: apartmentId, propertyId, electricityConfig: config })) as never;
PropertyModel.findOne = ((filter: { ownerId?: string }) => query(filter.ownerId && filter.ownerId !== actor.id ? null : {
  _id: propertyId, ownerId, electricitySettings: { providerId: new Types.ObjectId() },
})) as never;
SubmeterReadingModel.findOne = ((filter: { billingPeriod: unknown }) =>
  query(
    typeof filter.billingPeriod === 'string' ? existing : previous,
  )) as never;
SubmeterReadingModel.exists = (() => Promise.resolve(later)) as never;
MonthlyRentBillModel.exists = (() => Promise.resolve(issued)) as never;
SubmeterReadingModel.create = ((value: Record<string, unknown>) => {
  saved = value;
  return Promise.resolve(value);
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
    billingPeriod: '2019-12',
  };
  await assert.rejects(
    SubmeterServices.preview({ ...payload, previousReading: 999 }, actor),
    /must match/,
  );
  previous = { ...previous };
  await assert.rejects(
    SubmeterServices.preview({ ...payload, previousReading: 999 }, actor),
    /must match/,
  );
  existing = { apartmentId };
  await assert.rejects(SubmeterServices.save(payload, actor), /already exists/);
  existing = null;
  later = true;
  await assert.rejects(SubmeterServices.save(payload, actor), /later month/);
  later = false;
  issued = true;
  await assert.rejects(
    SubmeterServices.save(payload, actor),
    /rent bill has been issued/,
  );
  issued = false;
  config = { ...config, paymentResponsibility: 'tenantPaysDirectly' };
  await assert.rejects(
    SubmeterServices.preview(payload, actor),
    /owner collection/,
  );
  console.log(
    'PASS: consumption, slabs, VAT, adjustments, persistence, fractional/zero usage, role/owner scope, continuity, duplicate/future/issued-bill guards',
  );
}
void run();
