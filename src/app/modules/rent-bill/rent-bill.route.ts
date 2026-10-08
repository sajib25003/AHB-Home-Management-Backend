import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { RentBillController } from './rent-bill.controller';

const rentBillRouter = Router();

rentBillRouter.use(authMiddleware);

rentBillRouter.get(
  '/generation-context',
  authorizeRoles('superAdmin', 'owner'),
  RentBillController.getGenerationContext,
);
rentBillRouter.post(
  '/',
  authorizeRoles('superAdmin', 'owner'),
  RentBillController.createRentBill,
);
rentBillRouter.get(
  '/',
  authorizeRoles('superAdmin', 'owner', 'tenant'),
  RentBillController.getAllRentBills,
);
rentBillRouter.get(
  '/:billId',
  authorizeRoles('superAdmin', 'owner', 'tenant'),
  RentBillController.getSingleRentBill,
);
rentBillRouter.patch(
  '/:billId',
  authorizeRoles('superAdmin', 'owner'),
  RentBillController.updateRentBill,
);
rentBillRouter.patch(
  '/:billId/status',
  authorizeRoles('superAdmin', 'owner'),
  RentBillController.updateRentBillStatus,
);

export default rentBillRouter;
