import { Router } from 'express';
import authMiddleware from '../../middleware/authMiddleware';
import { SettingsController } from './settings.controller';

const settingsRouter = Router();

// banner related api
settingsRouter.post(
  '/create-banner',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createBanner,
);
settingsRouter.get('/banners', SettingsController.getAllBanners);
settingsRouter.put(
  '/banner/:bannerId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateBanner,
);
settingsRouter.delete(
  '/banner/:bannerId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteBanner,
);

// logo related api
settingsRouter.post(
  '/create-logo',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createLogo,
);
settingsRouter.get('/logo', SettingsController.getLogo);
settingsRouter.put(
  '/logo/:logoId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateLogo,
);
settingsRouter.delete(
  '/logo/:logoId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteLogo,
);

// social link related api
settingsRouter.post(
  '/create-social-link',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createSocialLink,
);
settingsRouter.get('/social-link', SettingsController.getSocialLink);
settingsRouter.put(
  '/social-link/:socialLinkId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateSocialLink,
);
settingsRouter.delete(
  '/social-link/:socialLinkId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteSocialLink,
);

// info related api
settingsRouter.post(
  '/create-info',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createInfo,
);
settingsRouter.get('/info', SettingsController.getInfo);
settingsRouter.patch(
  '/info/:infoId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateInfo,
);

// brand related api
settingsRouter.post(
  '/create-brand',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createBrand,
);
settingsRouter.get('/brands', SettingsController.getAllBrands);
settingsRouter.patch(
  '/brands/:brandId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateBrand,
);
settingsRouter.delete(
  '/brands/:brandId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteBrand,
);

// service list related api
settingsRouter.post(
  '/create-service-list',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createServiceList,
);
settingsRouter.get('/service-lists', SettingsController.getAllServiceLists);
settingsRouter.patch(
  '/service-lists/:serviceId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateServiceList,
);
settingsRouter.delete(
  '/service-lists/:serviceId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteServiceList,
);

// announcement related api
settingsRouter.post(
  '/create-announcement',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.createAnnouncement,
);
settingsRouter.get(
  '/announcements', // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.getAllAnnouncements,
);
settingsRouter.get(
  '/announcements/active',
  SettingsController.getAllActiveAnnouncements,
);
settingsRouter.get(
  '/announcements/:announcementId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.getSingleAnnouncement,
);
settingsRouter.patch(
  '/announcements/:announcementId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.updateAnnouncement,
);
settingsRouter.delete(
  '/announcements/:announcementId',
  // @ts-expect-error: no error here. manually checked!
  authMiddleware,
  SettingsController.deleteAnnouncement,
);

export default settingsRouter;
