export interface IBanner {
  url: string;
  isActive: boolean;
}

export interface ILogo {
  url: string;
}

export type SocialType =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';

export interface ISocialLink {
  type: SocialType;
  url: string;
}

export interface IInfo {
  site_name: string;
  email: string;
  phone: string;
  address: string;
  google_map_iframe_link: string;
}

export interface IBrand {
  name: string;
  logo_url: string;
  description: string;
}

export interface IServiceList {
  title: string;
  description: string;
}

export interface IAnnouncement {
  title: string;
  isActive: boolean;
}
