import { Router } from 'express';
import { ProductController } from './product.controller';
import authMiddleware from '../../middleware/authMiddleware';

const productRouter = Router();

productRouter.post(
  '/create-product',
  authMiddleware,
  ProductController.createProduct,
);
productRouter.get('/all-products', ProductController.getAllProducts);
productRouter.get('/:productId', ProductController.getSingleProduct);
productRouter.put(
  '/:productId',
  authMiddleware,
  ProductController.updateProduct,
);
productRouter.patch(
  '/:productId',
  authMiddleware,
  ProductController.updateProduct,
);
productRouter.delete(
  '/:productId',
  authMiddleware,
  ProductController.deleteProduct,
);

export default productRouter;
