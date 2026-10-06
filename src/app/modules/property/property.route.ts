import { Router } from 'express';

import authMiddleware from '../../middleware/authMiddleware';
import authorizeRoles from '../../middleware/authorizeRoles';
import { ApartmentController } from '../apartment/apartment.controller';
import { PropertyController } from './property.controller';

const propertyRouter = Router();

propertyRouter.use(authMiddleware);
propertyRouter.use(authorizeRoles('superAdmin', 'owner'));

propertyRouter.post('/', PropertyController.createProperty);
propertyRouter.get('/', PropertyController.getAllProperties);

propertyRouter.post(
  '/:propertyId/apartments',
  ApartmentController.createApartment,
);

propertyRouter.get(
  '/:propertyId/apartments',
  ApartmentController.getApartmentsByProperty,
);

propertyRouter.get('/:propertyId', PropertyController.getSingleProperty);
propertyRouter.patch('/:propertyId', PropertyController.updateProperty);
propertyRouter.delete('/:propertyId', PropertyController.deleteProperty);

export default propertyRouter;
