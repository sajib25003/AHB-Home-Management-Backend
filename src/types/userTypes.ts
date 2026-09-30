import type { TUserRole } from '../app/modules/user/user.interface';

export interface UserPayload {
  id: string;
  email: string;
  role: TUserRole;
}
