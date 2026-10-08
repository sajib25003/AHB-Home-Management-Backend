import express, { Application, Request, Response } from 'express';

import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import config from './app/config';
import { globalApiLimiter } from './app/middleware/rateLimiters';
import {
  globalErrorHandler,
  notFoundHandler,
  protectStateChangingRequests,
  rejectDangerousInput,
  requestIdMiddleware,
} from './app/middleware/securityMiddleware';
import userRouter from './app/modules/user/user.route';
import authRouter from './app/modules/auth/auth.route';
import apartmentRouter from './app/modules/apartment/apartment.route';
import propertyRouter from './app/modules/property/property.route';
import tenancyRouter from './app/modules/tenancy/tenancy.route';
import electricityRouter from './app/modules/electricity/electricity.route';
import billingRouter from './app/modules/billing/billing.route';

const app: Application = express();

app.disable('x-powered-by');

if (config.trust_proxy_hops > 0) {
  app.set('trust proxy', config.trust_proxy_hops);
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');

    if (!normalizedOrigin || config.client_urls.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    console.error(`Blocked by CORS: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
  ],
  exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'X-Request-Id'],
  maxAge: 86_400,
};

app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb', strict: true }));
app.use(cookieParser());
app.use(rejectDangerousInput);
app.use(protectStateChangingRequests);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', globalApiLimiter);

// Application routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/properties', propertyRouter);
app.use('/api/v1/apartments', apartmentRouter);
app.use('/api/v1/tenancies', tenancyRouter);
app.use('/api/v1/electricity', electricityRouter);
app.use('/api/v1/billing', billingRouter);

const getAController = (req: Request, res: Response) => {
  res.send({
    success: true,
    message: 'Welcome To AHB Home Management Server.',
  });
};

app.get('/', getAController);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
