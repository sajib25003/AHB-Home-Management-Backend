import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { ElectricityController } from './electricity.controller';

const electricityRouter = Router();

electricityRouter.use(authMiddleware);

electricityRouter.post(
  '/calculate',
  authorizeRoles('superAdmin', 'owner'),
  ElectricityController.calculateElectricityBill,
);

electricityRouter.get(
  '/providers',
  authorizeRoles('superAdmin', 'owner'),
  ElectricityController.getProviders,
);

electricityRouter.post(
  '/providers',
  authorizeRoles('superAdmin'),
  ElectricityController.createProvider,
);

electricityRouter.patch(
  '/providers/:providerId',
  authorizeRoles('superAdmin'),
  ElectricityController.updateProvider,
);

electricityRouter.get(
  '/tariffs/applicable',
  authorizeRoles('superAdmin', 'owner'),
  ElectricityController.getApplicableTariff,
);

electricityRouter.get(
  '/tariffs',
  authorizeRoles('superAdmin', 'owner'),
  ElectricityController.getTariffSchedules,
);

electricityRouter.post(
  '/tariffs',
  authorizeRoles('superAdmin'),
  ElectricityController.createTariffSchedule,
);

electricityRouter.patch(
  '/tariffs/:tariffId/deactivate',
  authorizeRoles('superAdmin'),
  ElectricityController.deactivateTariffSchedule,
);

export default electricityRouter;
