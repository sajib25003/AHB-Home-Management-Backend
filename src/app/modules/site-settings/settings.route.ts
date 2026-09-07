import { Router } from 'express';
import authMiddleware from '../../middleware/authMiddleware';
import { SettingsController } from './settings.controller';

const settingsRouter = Router();

// banner related api
settingsRouter.post(
  '/create-banner',
  authMiddleware,
  SettingsController.createBanner,
);
settingsRouter.get('/banners', SettingsController.getAllBanners);
settingsRouter.put(
  '/banner/:bannerId',
  authMiddleware,
  SettingsController.updateBanner,
);
settingsRouter.delete(
  '/banner/:bannerId',
  authMiddleware,
  SettingsController.deleteBanner,
);

// logo related api
settingsRouter.post(
  '/create-logo',
  authMiddleware,
  SettingsController.createLogo,
);
settingsRouter.get('/logo', SettingsController.getLogo);
settingsRouter.put(
  '/logo/:logoId',
  authMiddleware,
  SettingsController.updateLogo,
);
settingsRouter.delete(
  '/logo/:logoId',
  authMiddleware,
  SettingsController.deleteLogo,
);

// social link related api
settingsRouter.post(
  '/create-social-link',
  authMiddleware,
  SettingsController.createSocialLink,
);
settingsRouter.get('/social-link', SettingsController.getSocialLink);
settingsRouter.put(
  '/social-link/:socialLinkId',
  authMiddleware,
  SettingsController.updateSocialLink,
);
settingsRouter.delete(
  '/social-link/:socialLinkId',
  authMiddleware,
  SettingsController.deleteSocialLink,
);

// info related api
settingsRouter.post(
  '/create-info',
  authMiddleware,
  SettingsController.createInfo,
);
settingsRouter.get('/info', SettingsController.getInfo);
settingsRouter.patch('/info/:infoId', SettingsController.updateInfo);

// brand related api
settingsRouter.post(
  '/create-brand',
  authMiddleware,
  SettingsController.createBrand,
);
settingsRouter.get('/brands', SettingsController.getAllBrands);
settingsRouter.patch(
  '/brands/:brandId',
  authMiddleware,
  SettingsController.updateBrand,
);
settingsRouter.delete(
  '/brands/:brandId',
  authMiddleware,
  SettingsController.deleteBrand,
);

// service list related api
settingsRouter.post(
  '/create-service-list',
  authMiddleware,
  SettingsController.createServiceList,
);
settingsRouter.get('/service-lists', SettingsController.getAllServiceLists);
settingsRouter.patch(
  '/service-lists/:serviceId',
  authMiddleware,
  SettingsController.updateServiceList,
);
settingsRouter.delete(
  '/service-lists/:serviceId',
  authMiddleware,
  SettingsController.deleteServiceList,
);

// announcement related api
settingsRouter.post(
  '/create-announcement',
  authMiddleware,
  SettingsController.createAnnouncement,
);
settingsRouter.get(
  '/announcements',
  authMiddleware,
  SettingsController.getAllAnnouncements,
);
settingsRouter.get(
  '/announcements/active',
  SettingsController.getAllActiveAnnouncements,
);
settingsRouter.get(
  '/announcements/:announcementId',
  authMiddleware,
  SettingsController.getSingleAnnouncement,
);
settingsRouter.patch(
  '/announcements/:announcementId',
  authMiddleware,
  SettingsController.updateAnnouncement,
);
settingsRouter.delete(
  '/announcements/:announcementId',
  SettingsController.deleteAnnouncement,
);

export default settingsRouter;
