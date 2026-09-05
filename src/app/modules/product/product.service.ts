import { FilterQuery } from 'mongoose';
import { Product, QueryOptions } from './product.interface';
import { ProductModel } from './product.model';

const createProductIntoDB = async (product: Product): Promise<Product> => {
  const result = await ProductModel.create(product);
  return result;
};

const getAllProductsFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10, search, type, category } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<Product> = {};

  // 🔍 search (example: name + description)
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) {
    query.type = category;
  }

  if (type === 'featured') {
    query.isFeatured = true;
  }

  if (type === 'limited') {
    query.is_limited_edition = true;
  }

  let mongoQuery = ProductModel.find(query);

  // 🆕 latest products
  if (type === 'new') {
    mongoQuery = mongoQuery.sort({ createdAt: -1 });
  } else {
    mongoQuery = mongoQuery.sort({ createdAt: -1 }); // default
  }

  const result = await mongoQuery.skip(skip).limit(limit);

  //   const result = await ProductModel.find(query)
  //     .skip(skip)
  //     .limit(limit)
  //     .sort({ createdAt: -1 });

  const totalItems = await ProductModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    meta: {
      page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: result,
  };
};

const getSingleProductFromDB = async (id: string) => {
  const result = await ProductModel.findById(id);
  return result;
};

const updateProductInDB = async (id: string, data: Product) => {
  const result = await ProductModel.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  return result;
};

const updateProductPatch = async (id: string, payload: Partial<Product>) => {
  const result = await ProductModel.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
      runValidators: true,
    },
  );

  return result;
};

const deleteProductFromDB = async (id: string) => {
  const result = await ProductModel.findByIdAndDelete(id);
  return result;
};

export const ProductServices = {
  createProductIntoDB,
  getAllProductsFromDB,
  getSingleProductFromDB,
  updateProductInDB,
  updateProductPatch,
  deleteProductFromDB,
};
