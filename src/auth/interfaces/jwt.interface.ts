export interface JwtPayload {
  sub: string;
  email: string;
  /** Server-issued session id (MongoDB ObjectId string) */
  sessionId: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
