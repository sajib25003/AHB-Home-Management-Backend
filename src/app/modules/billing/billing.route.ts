import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { ChargeCategoryController } from './charge-category.controller';

const billingRouter = Router();

billingRouter.use(authMiddleware);
billingRouter.use(authorizeRoles('superAdmin', 'owner'));

billingRouter.get(
  '/charge-categories',
  ChargeCategoryController.getChargeCategories,
);
billingRouter.post(
  '/charge-categories',
  ChargeCategoryController.createChargeCategory,
);
billingRouter.patch(
  '/charge-categories/:categoryId',
  ChargeCategoryController.updateChargeCategory,
);

export default billingRouter;
