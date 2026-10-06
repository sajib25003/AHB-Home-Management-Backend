import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { TenancyController } from './tenancy.controller';

const tenancyRouter = Router();

tenancyRouter.get(
  '/my-current',
  authMiddleware,
  authorizeRoles('tenant'),
  TenancyController.getMyCurrentTenancy,
);

tenancyRouter.post(
  '/',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner'),
  TenancyController.createTenancy,
);

tenancyRouter.get(
  '/',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner'),
  TenancyController.getAllTenancies,
);

tenancyRouter.get(
  '/:tenancyId',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner', 'tenant'),
  TenancyController.getSingleTenancy,
);

tenancyRouter.patch(
  '/:tenancyId/end',
  authMiddleware,
  authorizeRoles('superAdmin', 'owner'),
  TenancyController.endTenancy,
);

export default tenancyRouter;
