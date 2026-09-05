import { QueryOptions } from '../product/product.interface';
import {
  IAnnouncement,
  IBanner,
  IBrand,
  IInfo,
  ILogo,
  IServiceList,
  ISocialLink,
} from './settings.interface';
import {
  AnnouncementModel,
  BannerModel,
  BrandModel,
  InfoModel,
  LogoModel,
  ServiceListModel,
  SocialLinkModel,
} from './settings.model';
import { FilterQuery } from 'mongoose';

// banner related services

const createBannerIntoDB = async (banner: IBanner): Promise<IBanner> => {
  const result = await BannerModel.create(banner);
  return result;
};

// const getBannerFromDB = async (): Promise<IBanner | null> => {
//   const result = await BannerModel.findOne();

//   return result;
// };

const getAllBannersFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<IBanner> = {};
  const result = await BannerModel.find(query).skip(skip).limit(limit);

  const totalItems = await BannerModel.countDocuments(query);
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

const updateBannerInDB = async (id: string, data: IBanner) => {
  const result = await BannerModel.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteBanner = async (id: string) => {
  const result = await BannerModel.findByIdAndDelete(id);
  return result;
};

// Logo related services

const createLogoIntoDB = async (logo: ILogo): Promise<ILogo> => {
  const result = await LogoModel.create(logo);
  return result;
};

const getLogoFromDB = async (): Promise<ILogo | null> => {
  const result = await LogoModel.findOne();

  return result;
};

const updateLogoInDB = async (id: string, data: ILogo) => {
  const result = await LogoModel.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteLogo = async (id: string) => {
  const result = await LogoModel.findByIdAndDelete(id);
  return result;
};

// Social links related services

const createSocialLinkIntoDB = async (
  socialLink: ISocialLink,
): Promise<ISocialLink> => {
  const result = await SocialLinkModel.create(socialLink);
  return result;
};

const getSocialLinkFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<ISocialLink> = {};
  const result = await SocialLinkModel.find(query).skip(skip).limit(limit);

  const totalItems = await SocialLinkModel.countDocuments(query);
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

const updateSocialLinkInDB = async (id: string, data: ISocialLink) => {
  const result = await SocialLinkModel.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteSocialLink = async (id: string) => {
  const result = await SocialLinkModel.findByIdAndDelete(id);
  return result;
};

// info related services

const createInfoIntoDB = async (info: IInfo): Promise<IInfo> => {
  const result = await InfoModel.create(info);
  return result;
};

const getInfoFromDB = async (): Promise<IInfo | null> => {
  const result = await InfoModel.findOne();

  return result;
};

const updateInfoInDB = async (id: string, payload: Partial<IInfo>) => {
  const result = await InfoModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

// brand related services

const createBrandIntoDB = async (brand: IBrand): Promise<IBrand> => {
  const result = await BrandModel.create(brand);
  return result;
};

const getAllBrandsFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<IBrand> = {};
  const result = await BrandModel.find(query).skip(skip).limit(limit);

  const totalItems = await BrandModel.countDocuments(query);
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

const updateBrandInDB = async (id: string, payload: Partial<IBrand>) => {
  const result = await BrandModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteBrandFromDB = async (id: string) => {
  const result = await BrandModel.findByIdAndDelete(id);
  return result;
};

// service list related services

const createServiceListIntoDB = async (
  service: IServiceList,
): Promise<IServiceList> => {
  const result = await ServiceListModel.create(service);
  return result;
};

const getAllServiceListsFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<IServiceList> = {};
  const result = await ServiceListModel.find(query).skip(skip).limit(limit);

  const totalItems = await ServiceListModel.countDocuments(query);
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

const updateServiceListInDB = async (
  id: string,
  payload: Partial<IServiceList>,
) => {
  const result = await ServiceListModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteServiceListFromDB = async (id: string) => {
  const result = await ServiceListModel.findByIdAndDelete(id);
  return result;
};

// announcement related services

const createAnnouncementIntoDB = async (
  announcement: IAnnouncement,
): Promise<IAnnouncement> => {
  const result = await AnnouncementModel.create(announcement);
  return result;
};

const getAllAnnouncementsFromDB = async (options: QueryOptions) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const query: FilterQuery<IAnnouncement> = {};
  const result = await AnnouncementModel.find(query)
    .sort({ createdAt: -1 }) // last one will come first
    .skip(skip)
    .limit(limit);

  const totalItems = await AnnouncementModel.countDocuments(query);
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

const getAllActiveAnnouncementsFromDB = async () => {
  const result = await AnnouncementModel.find({
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    data: result,
  };
};

const getSingleAnnouncementFromDB = async (id: string) => {
  const result = await AnnouncementModel.findById(id);
  return result;
};

const updateAnnouncementInDB = async (
  id: string,
  payload: Partial<IAnnouncement>,
) => {
  const result = await AnnouncementModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteAnnouncementFromDB = async (id: string) => {
  const result = await AnnouncementModel.findByIdAndDelete(id);
  return result;
};

export const settingsServices = {
  createBannerIntoDB,
  getAllBannersFromDB,
  updateBannerInDB,
  deleteBanner,
  //logo related
  createLogoIntoDB,
  getLogoFromDB,
  updateLogoInDB,
  deleteLogo,
  // social link related
  createSocialLinkIntoDB,
  getSocialLinkFromDB,
  updateSocialLinkInDB,
  deleteSocialLink,
  // info related
  createInfoIntoDB,
  getInfoFromDB,
  updateInfoInDB,
  // brand related
  createBrandIntoDB,
  getAllBrandsFromDB,
  updateBrandInDB,
  deleteBrandFromDB,
  // service list related
  createServiceListIntoDB,
  getAllServiceListsFromDB,
  updateServiceListInDB,
  deleteServiceListFromDB,
  //announcement related
  createAnnouncementIntoDB,
  getAllAnnouncementsFromDB,
  getAllActiveAnnouncementsFromDB,
  getSingleAnnouncementFromDB,
  updateAnnouncementInDB,
  deleteAnnouncementFromDB,
};
