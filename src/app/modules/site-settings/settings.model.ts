import { Schema, model } from 'mongoose';
import {
  IAnnouncement,
  IBanner,
  IBrand,
  IInfo,
  ILogo,
  IServiceList,
  ISocialLink,
} from './settings.interface';

const BannerSchema = new Schema<IBanner>(
  {
    url: { type: String, required: true },
    isActive: { type: Boolean, required: true },
  },
  { timestamps: true, strict: true },
);

export const BannerModel = model<IBanner>('Banner', BannerSchema);

// logo related
const LogoSchema = new Schema<ILogo>(
  {
    url: { type: String, required: true },
  },
  { timestamps: true, strict: true },
);

export const LogoModel = model<ILogo>('Logo', LogoSchema);

// social link related
const SocialLinkSchema = new Schema<ISocialLink>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'facebook',
        'instagram',
        'twitter',
        'linkedin',
        'youtube',
        'tiktok',
      ],
    },
    url: { type: String, required: true },
  },
  { timestamps: true, strict: true },
);

export const SocialLinkModel = model<ISocialLink>(
  'SocialLink',
  SocialLinkSchema,
);

const InfoSchema = new Schema<IInfo>(
  {
    site_name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    google_map_iframe_link: { type: String, required: true },
  },
  { timestamps: true, strict: true },
);

export const InfoModel = model<IInfo>('Info', InfoSchema);

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true },
    logo_url: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true, strict: true },
);

export const BrandModel = model<IBrand>('Brand', BrandSchema);

const ServiceListSchema = new Schema<IServiceList>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true, strict: true },
);

export const ServiceListModel = model<IServiceList>(
  'ServiceList',
  ServiceListSchema,
);

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    isActive: { type: Boolean, required: true },
  },
  { timestamps: true, strict: true },
);

export const AnnouncementModel = model<IAnnouncement>(
  'Announcement',
  AnnouncementSchema,
);
