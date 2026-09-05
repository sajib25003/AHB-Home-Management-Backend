import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import config from '../app/config';
import { UserModel } from '../app/modules/user/user.model';

const seedSuperAdmin = async () => {
  try {
    if (!config.database_url) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required.',
      );
    }

    await mongoose.connect(config.database_url);

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await UserModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      console.log('Super admin already exists.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await UserModel.create({
      name: {
        firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
        middleName: null,
        lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
      },

      email: normalizedEmail,
      phone: process.env.SUPER_ADMIN_PHONE,

      password: hashedPassword,
      provider: 'credentials',

      role: 'superAdmin',
      userStatus: 'active',

      createdBy: null,
      ownerId: null,

      features: {
        personalCashflow: false,
      },

      refreshTokenHash: null,
    });

    console.log('Super admin created successfully.');
  } catch (error) {
    console.error('Super admin seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedSuperAdmin();
