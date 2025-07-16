import { Types } from 'mongoose';

export interface JwtPayload {
  sub: Types.ObjectId;
  email: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
