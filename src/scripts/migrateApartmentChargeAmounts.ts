import mongoose, { Types } from 'mongoose';

import config from '../app/config';

type LegacyChargeCategory = {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  defaultMode: string;
  defaultAmount?: number | null;
};

type LegacyApartment = {
  propertyId: Types.ObjectId;
  isDeleted?: boolean;
  chargeSettings?: Array<{
    categoryId: Types.ObjectId;
    amount: number | null;
    updatedBy: Types.ObjectId;
    updatedAt: Date;
  }>;
};

const migrateApartmentChargeAmounts = async () => {
  try {
    if (!config.database_url) {
      throw new Error('DATABASE_URL is not configured.');
    }

    await mongoose.connect(config.database_url);

    const chargeCategories = mongoose.connection.collection(
      'chargecategories',
    );
    const apartments =
      mongoose.connection.collection<LegacyApartment>('apartments');

    const legacyCategories = (await chargeCategories
      .find({
        defaultMode: 'fixed',
        defaultAmount: { $type: 'number' },
      })
      .toArray()) as unknown as LegacyChargeCategory[];

    let updatedApartmentCount = 0;

    for (const category of legacyCategories) {
      const amount = category.defaultAmount;

      if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        continue;
      }

      const result = await apartments.updateMany(
        {
          propertyId: category.propertyId,
          isDeleted: { $ne: true },
          chargeSettings: {
            $not: {
              $elemMatch: {
                categoryId: category._id,
              },
            },
          },
        },
        {
          $push: {
            chargeSettings: {
              categoryId: category._id,
              amount,
              updatedBy: category.createdBy,
              updatedAt: new Date(),
            },
          },
        },
      );

      updatedApartmentCount += result.modifiedCount;
    }

    const cleanupResult = await chargeCategories.updateMany(
      { defaultAmount: { $exists: true } },
      { $unset: { defaultAmount: '' } },
    );

    console.log(
      `Migrated legacy amounts into ${updatedApartmentCount} apartment charge settings.`,
    );
    console.log(
      `Removed legacy defaultAmount from ${cleanupResult.modifiedCount} charge categories.`,
    );
  } catch (error) {
    console.error('Apartment charge amount migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void migrateApartmentChargeAmounts();
