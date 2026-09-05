import { Schema, model } from 'mongoose';
import { Product, SizePrice } from './product.interface';

const sizePriceSchema = new Schema<SizePrice>({
  size: { type: Number, required: true },
  price: { type: Number, required: true },
});

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: [true, 'Product title is required!'] },
    type: {
      type: String,
      enum: [
        'perfume_spray',
        'oudh_oil',
        'bakhoor',
        'air_freshener',
        'body_deodorant_spray',
        'bakhoor_burner',
      ],
      required: true,
    },
    sizeAndPrice: [sizePriceSchema],
    group: {
      type: String,
      enum: ['attar', 'perfume', 'air_freshener'],
      required: true,
    },
    product_code: { type: String, required: true },
    available_qty: { type: Number, required: true },
    isAvailable: { type: Boolean, required: true, default: true },
    isFeatured: { type: Boolean, required: true },
    description: { type: String, required: true },
    main_image: { type: String, required: true },
    image_album: [{ type: String }],
    is_limited_edition: { type: Boolean, required: true },
  },
  { timestamps: true, strict: true },
);

export const ProductModel = model<Product>('Product', productSchema);
