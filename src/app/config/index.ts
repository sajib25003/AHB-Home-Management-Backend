import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.join(process.cwd(), '.env'),
  quiet: true,
});

const nodeEnv = process.env.NODE_ENV ?? 'development';
const rawClientUrls =
  process.env.CLIENT_URLS ??
  process.env.CLIENT_URL ??
  (nodeEnv === 'production' ? undefined : 'http://localhost:3000');

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required.'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required.'),
  CLIENT_URLS: z.string().min(1, 'CLIENT_URL or CLIENT_URLS is required.'),
  JWT_ISSUER: z.string().min(1).default('ahb-home-management-api'),
  JWT_AUDIENCE: z.string().min(1).default('ahb-home-management-web'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),
});

const parsedEnvironment = environmentSchema.safeParse({
  ...process.env,
  NODE_ENV: nodeEnv,
  CLIENT_URLS: rawClientUrls,
});

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration: ${details}`);
}

const environment = parsedEnvironment.data;

if (environment.NODE_ENV === 'production') {
  if (environment.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters in production.',
    );
  }

  if (environment.JWT_REFRESH_SECRET.length < 32) {
    throw new Error(
      'JWT_REFRESH_SECRET must contain at least 32 characters in production.',
    );
  }

  if (environment.JWT_SECRET === environment.JWT_REFRESH_SECRET) {
    throw new Error('Access and refresh token secrets must be different.');
  }

  if (environment.TRUST_PROXY_HOPS === undefined) {
    throw new Error(
      'TRUST_PROXY_HOPS must be explicitly configured in production.',
    );
  }
}

const clientUrls = environment.CLIENT_URLS.split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

for (const clientUrl of clientUrls) {
  const parsedUrl = new URL(clientUrl);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Client URL must use HTTP or HTTPS: ${clientUrl}`);
  }

  if (
    environment.NODE_ENV === 'production' &&
    parsedUrl.protocol !== 'https:'
  ) {
    throw new Error(`Production client URL must use HTTPS: ${clientUrl}`);
  }
}

export default {
  port: environment.PORT,
  database_url: environment.DATABASE_URL,
  node_env: environment.NODE_ENV,
  client_urls: clientUrls,
  jwt_secret: environment.JWT_SECRET,
  jwt_refresh_secret: environment.JWT_REFRESH_SECRET,
  jwt_issuer: environment.JWT_ISSUER,
  jwt_audience: environment.JWT_AUDIENCE,
  cookie_same_site:
    environment.COOKIE_SAME_SITE ??
    (environment.NODE_ENV === 'production' ? 'none' : 'lax'),
  trust_proxy_hops: environment.TRUST_PROXY_HOPS ?? 0,
};
