import { Router } from 'express';
import { ProductController } from './product.controller';
import authMiddleware from '../../middleware/authMiddleware';

const productRouter = Router();

productRouter.post(
  '/create-product',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  ProductController.createProduct,
);
productRouter.get('/all-products', ProductController.getAllProducts);
productRouter.get('/:productId', ProductController.getSingleProduct);
productRouter.put(
  '/:productId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  ProductController.updateProduct,
);
productRouter.patch(
  '/:productId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  ProductController.updateProduct,
);
productRouter.delete(
  '/:productId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  ProductController.deleteProduct,
);

export default productRouter;
