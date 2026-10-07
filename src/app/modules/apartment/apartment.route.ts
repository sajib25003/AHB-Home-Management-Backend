import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { ApartmentController } from './apartment.controller';

const apartmentRouter = Router();

apartmentRouter.use(authMiddleware);
apartmentRouter.use(authorizeRoles('superAdmin', 'owner'));

apartmentRouter.get('/:apartmentId', ApartmentController.getSingleApartment);
apartmentRouter.patch(
  '/:apartmentId/electricity-config',
  ApartmentController.updateApartmentElectricityConfig,
);
apartmentRouter.patch(
  '/:apartmentId/charge-settings',
  ApartmentController.updateApartmentChargeSettings,
);
apartmentRouter.patch('/:apartmentId', ApartmentController.updateApartment);
apartmentRouter.delete('/:apartmentId', ApartmentController.deleteApartment);

export default apartmentRouter;
