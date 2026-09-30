import express, { Application, Request, Response } from 'express';

import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';

import userRouter from './app/modules/user/user.route';
import authRouter from './app/modules/auth/auth.route';

const app: Application = express();

const allowedOrigins = [
  'http://localhost:3000',
  // "https://your-frontend.vercel.app",
];

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    console.error(`Blocked by CORS: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware অবশ্যই routes-এর আগে
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Application routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

const getAController = (req: Request, res: Response) => {
  res.send({
    success: true,
    message: 'Welcome To AHB Home Management Server.',
  });
};

app.get('/', getAController);

export default app;
