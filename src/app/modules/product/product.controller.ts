import { Request, Response } from 'express';
import { ProductServices } from './product.service';

const createProduct = async (req: Request, res: Response) => {
  try {
    const { product: productData } = req.body;

    const result = await ProductServices.createProductIntoDB(productData);
    res.status(200).json({
      success: true,
      message: 'Product created successfully!',
      data: result,
    });
  } catch (error: unknown) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Something went wrong',
      error,
    });
  }
};

const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { page, limit, search, type, category } = req.query;

    // console.log('Search from query:', search);
    const validTypes = ['new', 'featured', 'limited'] as const;

    type ProductType = (typeof validTypes)[number];

    let parsedType: ProductType | undefined;

    if (typeof type === 'string') {
      const cleaned = type.trim().toLowerCase();

      if (validTypes.includes(cleaned as ProductType)) {
        parsedType = cleaned as ProductType;
      }
    }

    //category query
    const validCategories = [
      'perfume_spray',
      'oudh_oil',
      'bakhoor',
      'air_freshener',
      'body_deodorant_spray',
      'bakhoor_burner',
    ] as const;
    type ProductCategory = (typeof validCategories)[number];

    let parsedCategory: ProductCategory | undefined;

    if (typeof category === 'string') {
      const cleaned = category.trim().toLowerCase();

      if (validCategories.includes(cleaned as ProductCategory)) {
        parsedCategory = cleaned as ProductCategory;
      }
    }

    const result = await ProductServices.getAllProductsFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: (search as string) || '',
      type: parsedType,
      category: parsedCategory,
    });

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
};

const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.productId;
    const result = await ProductServices.getSingleProductFromDB(id);

    res.send({
      status: true,
      message: 'Product fetched successfully',
      data: result,
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to fetch product',
      error,
    });
  }
};

const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.productId;
    const data = req.body;

    let result;

    if (req.method === 'PUT') {
      result = await ProductServices.updateProductInDB(id, data);
    }

    if (req.method === 'PATCH') {
      result = await ProductServices.updateProductPatch(id, data);
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error,
    });
  }
};

const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.productId;
    await ProductServices.deleteProductFromDB(id);

    res.send({
      status: true,
      message: 'Product deleted successfully',
      data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete product',
      error,
    });
  }
};

export const ProductController = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};
