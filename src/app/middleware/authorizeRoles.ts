import { RequestHandler } from 'express';
import { TUserRole } from '../modules/user/user.interface';

const authorizeRoles = (...allowedRoles: TUserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'You must be logged in.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action.',
      });
      return;
    }

    next();
  };
};

export default authorizeRoles;
