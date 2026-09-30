import type { UserPayload } from './userTypes';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
