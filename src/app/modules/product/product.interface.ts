export type SizePrice = {
  size: number;
  price: number;
};

export type Product = {
  name: string;
  type:
    | 'perfume_spray'
    | 'oudh_oil'
    | 'bakhoor'
    | 'air_freshener'
    | 'body_deodorant_spray'
    | 'bakhoor_burner';
  sizeAndPrice: SizePrice[];
  group: 'attar' | 'perfume' | 'air_freshener';
  product_code: string;
  available_qty: number;
  isAvailable: boolean;
  isFeatured: boolean;
  description: string;
  main_image: string;
  image_album?: Array<string>;
  is_limited_edition: boolean;
};

export type QueryOptions = {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'new' | 'featured' | 'limited';
  category?: Product['type'];
};
