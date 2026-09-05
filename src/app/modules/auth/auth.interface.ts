export interface IAuth {
  email: string;
  password: string;
  refreshTokenHash?: string | null;
}
