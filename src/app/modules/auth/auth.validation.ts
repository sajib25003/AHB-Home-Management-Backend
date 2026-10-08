import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
