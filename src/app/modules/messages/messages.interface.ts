export interface IMessage {
  name: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  isRead: boolean;
}

export type QueryOptions = {
  page?: number;
  limit?: number;
};
