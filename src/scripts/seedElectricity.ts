import mongoose from 'mongoose';

import config from '../app/config';
import {
  ElectricityProviderModel,
  ElectricityTariffScheduleModel,
} from '../app/modules/electricity/electricity.model';
import { UserModel } from '../app/modules/user/user.model';

const providers = [
  { name: 'Dhaka Electric Supply Company', code: 'DESCO' },
  { name: 'Dhaka Power Distribution Company', code: 'DPDC' },
  { name: 'Bangladesh Power Development Board', code: 'BPDB' },
  { name: 'Northern Electricity Supply Company', code: 'NESCO' },
  { name: 'West Zone Power Distribution Company', code: 'WZPDCL' },
  { name: 'Bangladesh Rural Electrification Board / PBS', code: 'BREB_PBS' },
];

const seedElectricity = async () => {
  try {
    if (!config.database_url) {
      throw new Error('DATABASE_URL is not configured.');
    }

    await mongoose.connect(config.database_url);

    const superAdmin = await UserModel.findOne({
      role: 'superAdmin',
      userStatus: 'active',
      isDeleted: { $ne: true },
    }).select('_id');

    if (!superAdmin) {
      throw new Error(
        'Create the super admin before seeding electricity data.',
      );
    }

    await ElectricityProviderModel.bulkWrite(
      providers.map((provider) => ({
        updateOne: {
          filter: { code: provider.code },
          update: {
            $setOnInsert: {
              ...provider,
              isActive: true,
              createdBy: superAdmin._id,
            },
          },
          upsert: true,
        },
      })),
    );

    const effectiveFrom = new Date('2026-06-01T00:00:00.000Z');
    const existingTariff = await ElectricityTariffScheduleModel.findOne({
      scope: 'national',
      providerId: null,
      consumerCategory: 'LT_A_RESIDENTIAL',
      effectiveFrom,
    }).select('_id');

    if (!existingTariff) {
      await ElectricityTariffScheduleModel.create({
        name: 'Bangladesh LT-A Residential Tariff - June 2026',
        consumerCategory: 'LT_A_RESIDENTIAL',
        scope: 'national',
        providerId: null,
        effectiveFrom,
        effectiveTo: null,
        lifeline: {
          maximumUnit: 50,
          rate: 4.63,
        },
        slabs: [
          { fromUnit: 0, toUnit: 75, rate: 5.26 },
          { fromUnit: 76, toUnit: 200, rate: 8.5 },
          { fromUnit: 201, toUnit: 300, rate: 9.1 },
          { fromUnit: 301, toUnit: 400, rate: 9.62 },
          { fromUnit: 401, toUnit: 600, rate: 15.01 },
          { fromUnit: 601, toUnit: null, rate: 17.35 },
        ],
        vatPercentage: 5,
        meterCharges: [],
        isActive: true,
        createdBy: superAdmin._id,
      });
    }

    console.log('Electricity providers and tariff seeded successfully.');
  } catch (error) {
    console.error('Electricity seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedElectricity();
