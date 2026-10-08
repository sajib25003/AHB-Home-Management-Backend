import { z } from 'zod';

import { AUTH_PROVIDERS, USER_ROLES, USER_STATUSES } from './user.interface';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ObjectId is required.');

const nameSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    middleName: z.string().trim().max(80).nullable().optional(),
    lastName: z.string().trim().min(1).max(80),
  })
  .strict();

const optionalProfileFields = {
  name: nameSchema,
  phone: z.string().trim().max(30).optional(),
  photo: z.string().trim().url().max(2_048).nullable().optional(),
  address: z.string().trim().max(500).optional(),
  dateOfBirth: z.coerce.date().optional(),
};

const createUserSchema = z
  .object({
    ...optionalProfileFields,
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    role: z.enum(USER_ROLES).optional(),
    provider: z.enum(AUTH_PROVIDERS),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[a-z]/, 'Password must include a lowercase letter.')
      .regex(/[A-Z]/, 'Password must include an uppercase letter.')
      .regex(/\d/, 'Password must include a number.')
      .regex(/[^A-Za-z0-9]/, 'Password must include a special character.')
      .regex(/^\S+$/, 'Password cannot contain whitespace.')
      .optional(),
    ownerId: objectIdSchema.nullable().optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.provider === 'credentials' && !data.password) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password is required for a credentials account.',
      });
    }
  });

const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    phone: optionalProfileFields.phone,
    photo: optionalProfileFields.photo,
    address: optionalProfileFields.address,
    dateOfBirth: optionalProfileFields.dateOfBirth,
    userStatus: z.enum(USER_STATUSES).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one supported field is required.',
  });

export const createUserRequestSchema = z
  .object({
    user: createUserSchema,
  })
  .strict();

export const updateUserRequestSchema = z.union([
  z.object({ user: updateUserSchema }).strict(),
  updateUserSchema,
]);

export const userIdParamsSchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();
