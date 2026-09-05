import { Request, Response } from 'express';
import { settingsServices } from './settings.service';

//banner related controllers
const createBanner = async (req: Request, res: Response) => {
  try {
    const { banner: bannerData } = req.body;

    const result = await settingsServices.createBannerIntoDB(bannerData);
    res.status(200).json({
      success: true,
      message: 'Banner created successfully!',
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

// const getBanner = async (req: Request, res: Response) => {
//   try {
//     const result = await settingsServices.getAllBannersFromDB();

//     res.status(200).json({
//       success: true,
//       message: 'Banner retrieved successfully',
//       data: result,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to retrieve banner',
//       error,
//     });
//   }
// };

const getAllBanners = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await settingsServices.getAllBannersFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'All Banners fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve banner',
      error,
    });
  }
};

const updateBanner = async (req: Request, res: Response) => {
  try {
    const id = req.params.bannerId;
    const data = req.body;

    const result = await settingsServices.updateBannerInDB(id, data);

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error,
    });
  }
};

const deleteBanner = async (req: Request, res: Response) => {
  try {
    const id = req.params.bannerId;
    await settingsServices.deleteBanner(id);

    res.send({
      status: true,
      message: 'Banner deleted successfully',
      data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete banner',
      error,
    });
  }
};

//logo related controllers
const createLogo = async (req: Request, res: Response) => {
  try {
    const { logo: logoData } = req.body;

    const result = await settingsServices.createLogoIntoDB(logoData);
    res.status(200).json({
      success: true,
      message: 'Logo created successfully!',
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

const getLogo = async (req: Request, res: Response) => {
  try {
    const result = await settingsServices.getLogoFromDB();

    res.status(200).json({
      success: true,
      message: 'Logo retrieved successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve banner',
      error,
    });
  }
};

const updateLogo = async (req: Request, res: Response) => {
  try {
    const id = req.params.logoId;
    const data = req.body;

    const result = await settingsServices.updateLogoInDB(id, data);

    res.status(200).json({
      success: true,
      message: 'Logo updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update logo',
      error,
    });
  }
};

const deleteLogo = async (req: Request, res: Response) => {
  try {
    const id = req.params.logoId;
    await settingsServices.deleteLogo(id);

    res.send({
      status: true,
      message: 'Logo deleted successfully',
      // data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete logo',
      error,
    });
  }
};

//social link related controllers
const createSocialLink = async (req: Request, res: Response) => {
  try {
    const { socialLink: socialLinkData } = req.body;

    const result =
      await settingsServices.createSocialLinkIntoDB(socialLinkData);
    res.status(200).json({
      success: true,
      message: 'Social link created successfully!',
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

const getSocialLink = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await settingsServices.getSocialLinkFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'All Social Links fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve social link',
      error,
    });
  }
};

const updateSocialLink = async (req: Request, res: Response) => {
  try {
    const id = req.params.socialLinkId;
    const data = req.body;

    const result = await settingsServices.updateSocialLinkInDB(id, data);

    res.status(200).json({
      success: true,
      message: 'Social link updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update social link',
      error,
    });
  }
};

const deleteSocialLink = async (req: Request, res: Response) => {
  try {
    const id = req.params.socialLinkId;
    await settingsServices.deleteSocialLink(id);

    res.send({
      status: true,
      message: 'Social link deleted successfully',
      // data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete social link',
      error,
    });
  }
};

//info related controllers
const createInfo = async (req: Request, res: Response) => {
  try {
    const { info: infoData } = req.body;

    const result = await settingsServices.createInfoIntoDB(infoData);
    res.status(200).json({
      success: true,
      message: 'Info created successfully!',
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

const getInfo = async (req: Request, res: Response) => {
  try {
    const result = await settingsServices.getInfoFromDB();

    res.status(200).json({
      success: true,
      message: 'Info retrieved successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve info',
      error,
    });
  }
};

const updateInfo = async (req: Request, res: Response) => {
  try {
    const { infoId } = req.params;
    const payload = req.body;

    const result = await settingsServices.updateInfoInDB(infoId, payload);

    res.status(200).json({
      success: true,
      message: 'Info updated successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
};

//brand related controllers
const createBrand = async (req: Request, res: Response) => {
  try {
    const { brand: brandData } = req.body;

    const result = await settingsServices.createBrandIntoDB(brandData);
    res.status(200).json({
      success: true,
      message: 'Brand created successfully!',
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

const getAllBrands = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await settingsServices.getAllBrandsFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'All Brands fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve brand',
      error,
    });
  }
};

const updateBrand = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const payload = req.body;

    const result = await settingsServices.updateBrandInDB(brandId, payload);

    res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
};

const deleteBrand = async (req: Request, res: Response) => {
  try {
    const id = req.params.brandId;
    await settingsServices.deleteBrandFromDB(id);

    res.send({
      status: true,
      message: 'Brand deleted successfully',
      // data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete brand',
      error,
    });
  }
};

//service list related controllers
const createServiceList = async (req: Request, res: Response) => {
  try {
    const { service: serviceData } = req.body;

    const result = await settingsServices.createServiceListIntoDB(serviceData);
    res.status(200).json({
      success: true,
      message: 'Service list created successfully!',
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

const getAllServiceLists = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await settingsServices.getAllServiceListsFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'All Service Lists fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service lists',
      error,
    });
  }
};

const updateServiceList = async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const payload = req.body;

    const result = await settingsServices.updateServiceListInDB(
      serviceId,
      payload,
    );

    res.status(200).json({
      success: true,
      message: 'Service list updated successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
};

const deleteServiceList = async (req: Request, res: Response) => {
  try {
    const id = req.params.serviceId;
    await settingsServices.deleteServiceListFromDB(id);

    res.send({
      status: true,
      message: 'Service list deleted successfully',
      // data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete service list',
      error,
    });
  }
};

//announcement list related controllers
const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcement: announcementData } = req.body;

    const result =
      await settingsServices.createAnnouncementIntoDB(announcementData);
    res.status(200).json({
      success: true,
      message: 'Announcement created successfully!',
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

const getAllAnnouncements = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await settingsServices.getAllAnnouncementsFromDB({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.status(200).json({
      success: true,
      message: 'All Announcements fetched successfully!',
      meta: result.meta,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve announcements',
      error,
    });
  }
};

const getAllActiveAnnouncements = async (req: Request, res: Response) => {
  try {
    const result = await settingsServices.getAllActiveAnnouncementsFromDB();

    res.status(200).json({
      success: true,
      message: 'All Announcements fetched successfully!',
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve announcements',
      error,
    });
  }
};

const getSingleAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = req.params.announcementId;
    const result = await settingsServices.getSingleAnnouncementFromDB(id);

    res.send({
      status: true,
      message: 'Announcement fetched successfully',
      data: result,
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to fetch announcement',
      error,
    });
  }
};

const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;
    const payload = req.body;

    const result = await settingsServices.updateAnnouncementInDB(
      announcementId,
      payload,
    );

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
};

const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = req.params.announcementId;
    await settingsServices.deleteAnnouncementFromDB(id);

    res.send({
      status: true,
      message: 'Announcement deleted successfully',
      // data: {},
    });
  } catch (error: unknown) {
    res.json({
      status: false,
      message: 'Failed to delete announcement',
      error,
    });
  }
};

export const SettingsController = {
  //banner related
  createBanner,
  getAllBanners,
  updateBanner,
  deleteBanner,
  //logo related
  createLogo,
  getLogo,
  updateLogo,
  deleteLogo,
  //social link related
  createSocialLink,
  getSocialLink,
  updateSocialLink,
  deleteSocialLink,
  //info related
  createInfo,
  getInfo,
  updateInfo,
  //brand related
  createBrand,
  getAllBrands,
  updateBrand,
  deleteBrand,
  //service list related
  createServiceList,
  getAllServiceLists,
  updateServiceList,
  deleteServiceList,
  //announcement related
  createAnnouncement,
  getAllAnnouncements,
  getAllActiveAnnouncements,
  getSingleAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
