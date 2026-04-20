export interface JwtPayload {
  sub: number;
  email: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
