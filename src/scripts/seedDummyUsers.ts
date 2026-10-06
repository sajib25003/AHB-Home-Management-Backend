import bcrypt from 'bcrypt';
import mongoose, { Types } from 'mongoose';

import config from '../app/config';
import { UserModel } from '../app/modules/user/user.model';
import type {
  TUserRole,
  TUserStatus,
} from '../app/modules/user/user.interface';

const DUMMY_EMAIL_DOMAIN = '@demo.ahb.test';
const DEFAULT_DUMMY_PASSWORD = 'Demo@123456';

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dummyEmailRegex = new RegExp(`${escapeRegex(DUMMY_EMAIL_DOMAIN)}$`, 'i');

type TDummyUser = {
  name: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
  email: string;
  phone: string;
  role: TUserRole;
  address: string;
  dateOfBirth?: Date;
  userStatus?: TUserStatus;
  createdBy?: Types.ObjectId | null;
  ownerId?: Types.ObjectId | null;
  personalCashflow?: boolean;
};

const upsertDummyUser = async (user: TDummyUser, passwordHash: string) => {
  const normalizedEmail = user.email.trim().toLowerCase();

  const result = await UserModel.findOneAndUpdate(
    {
      email: normalizedEmail,
    },
    {
      $set: {
        name: user.name,
        email: normalizedEmail,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        password: passwordHash,
        provider: 'credentials',
        role: user.role,
        userStatus: user.userStatus ?? 'active',
        createdBy: user.createdBy ?? null,
        ownerId: user.ownerId ?? null,
        features: {
          personalCashflow: user.personalCashflow ?? false,
        },
        refreshTokenHash: null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .select('_id name email phone role userStatus ownerId')
    .exec();

  if (!result) {
    throw new Error(`Failed to seed dummy user: ${normalizedEmail}`);
  }

  return result;
};

const seedDummyUsers = async () => {
  try {
    if (config.node_env === 'production') {
      throw new Error('Dummy users cannot be seeded in production.');
    }

    if (!config.database_url) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const dummyPassword =
      process.env.DUMMY_USER_PASSWORD || DEFAULT_DUMMY_PASSWORD;

    if (dummyPassword.length < 12) {
      throw new Error(
        'DUMMY_USER_PASSWORD must contain at least 12 characters.',
      );
    }

    await mongoose.connect(config.database_url);

    if (process.argv.includes('--clean')) {
      const deleteResult = await UserModel.deleteMany({
        email: dummyEmailRegex,
      });

      console.log(`${deleteResult.deletedCount} dummy users removed.`);
      return;
    }

    const passwordHash = await bcrypt.hash(dummyPassword, 12);

    /*
     * 1. Dummy Super Admin
     */
    const superAdmin = await upsertDummyUser(
      {
        name: {
          firstName: 'Demo',
          middleName: null,
          lastName: 'Super Admin',
        },
        email: `superadmin${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000001',
        role: 'superAdmin',
        address: 'Mirpur, Dhaka',
        dateOfBirth: new Date('1988-01-15'),
        createdBy: null,
        ownerId: null,
      },
      passwordHash,
    );

    /*
     * 2. System Admin
     */
    const admin = await upsertDummyUser(
      {
        name: {
          firstName: 'Demo',
          middleName: null,
          lastName: 'System Admin',
        },
        email: `admin${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000002',
        role: 'admin',
        address: 'Uttara, Dhaka',
        dateOfBirth: new Date('1990-03-20'),
        createdBy: superAdmin._id,
        ownerId: null,
      },
      passwordHash,
    );

    /*
     * 3. Property Owners
     */
    const ownerOne = await upsertDummyUser(
      {
        name: {
          firstName: 'Rahim',
          middleName: null,
          lastName: 'Uddin',
        },
        email: `owner.rahim${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000011',
        role: 'owner',
        address: 'Pallabi, Mirpur, Dhaka',
        dateOfBirth: new Date('1985-06-12'),
        createdBy: admin._id,
        ownerId: null,
      },
      passwordHash,
    );

    const ownerTwo = await upsertDummyUser(
      {
        name: {
          firstName: 'Karim',
          middleName: 'Ahmed',
          lastName: 'Khan',
        },
        email: `owner.karim${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000012',
        role: 'owner',
        address: 'Dhanmondi, Dhaka',
        dateOfBirth: new Date('1982-09-25'),
        createdBy: admin._id,
        ownerId: null,
      },
      passwordHash,
    );

    /*
     * 4. Owner One's Tenants
     */
    await upsertDummyUser(
      {
        name: {
          firstName: 'Hasan',
          middleName: null,
          lastName: 'Mahmud',
        },
        email: `tenant.hasan${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000021',
        role: 'tenant',
        address: 'Pallabi, Mirpur, Dhaka',
        dateOfBirth: new Date('1995-02-10'),
        createdBy: ownerOne._id,
        ownerId: ownerOne._id,
      },
      passwordHash,
    );

    await upsertDummyUser(
      {
        name: {
          firstName: 'Nusrat',
          middleName: 'Jahan',
          lastName: 'Mim',
        },
        email: `tenant.nusrat${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000022',
        role: 'tenant',
        address: 'Pallabi, Mirpur, Dhaka',
        dateOfBirth: new Date('1997-07-18'),
        createdBy: ownerOne._id,
        ownerId: ownerOne._id,
      },
      passwordHash,
    );

    /*
     * 5. Owner Two's Tenants
     */
    await upsertDummyUser(
      {
        name: {
          firstName: 'Shakil',
          middleName: null,
          lastName: 'Ahmed',
        },
        email: `tenant.shakil${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000023',
        role: 'tenant',
        address: 'Dhanmondi, Dhaka',
        dateOfBirth: new Date('1993-11-05'),
        createdBy: ownerTwo._id,
        ownerId: ownerTwo._id,
      },
      passwordHash,
    );

    await upsertDummyUser(
      {
        name: {
          firstName: 'Farzana',
          middleName: 'Akter',
          lastName: 'Riya',
        },
        email: `tenant.farzana${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000024',
        role: 'tenant',
        address: 'Dhanmondi, Dhaka',
        dateOfBirth: new Date('1998-04-28'),
        userStatus: 'inactive',
        createdBy: ownerTwo._id,
        ownerId: ownerTwo._id,
      },
      passwordHash,
    );

    /*
     * 6. General Cashflow Users
     */
    await upsertDummyUser(
      {
        name: {
          firstName: 'Sadia',
          middleName: null,
          lastName: 'Islam',
        },
        email: `user.sadia${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000031',
        role: 'user',
        address: 'Mohammadpur, Dhaka',
        dateOfBirth: new Date('1994-12-08'),
        createdBy: admin._id,
        ownerId: null,
        personalCashflow: true,
      },
      passwordHash,
    );

    await upsertDummyUser(
      {
        name: {
          firstName: 'Imran',
          middleName: 'Hossain',
          lastName: 'Shuvo',
        },
        email: `user.imran${DUMMY_EMAIL_DOMAIN}`,
        phone: '01700000032',
        role: 'user',
        address: 'Badda, Dhaka',
        dateOfBirth: new Date('1992-08-14'),
        createdBy: admin._id,
        ownerId: null,
        personalCashflow: true,
      },
      passwordHash,
    );

    const seededUsers = await UserModel.find({
      email: dummyEmailRegex,
    })
      .select('name email phone role userStatus ownerId')
      .sort({ role: 1, email: 1 })
      .lean();

    console.table(
      seededUsers.map((user) => ({
        email: user.email,
        role: user.role,
        status: user.userStatus,
        ownerId: user.ownerId?.toString() ?? '—',
      })),
    );

    console.log(`${seededUsers.length} dummy users seeded successfully.`);
    console.log('Password comes from DUMMY_USER_PASSWORD.');
  } catch (error) {
    console.error('Dummy user seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void seedDummyUsers();
