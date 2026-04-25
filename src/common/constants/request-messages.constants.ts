export const REQUEST_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  MISSING_ACCESS_TOKEN: 'Missing access token',
  INVALID_ACCESS_TOKEN: 'Invalid access token',
  USER_NOT_FOUND: 'User not found',
  SESSION_NOT_FOUND: 'Session not found',
  SUPER_ADMIN_ONLY: 'Super admin only',
  INVALID_TOKEN: 'Invalid token',
  SESSION_HAS_ENDED: 'Session has ended',
  ACCESS_TOKEN_SECRET_NOT_DEFINED:
    'ACCESS_TOKEN_SECRET is not defined in configuration',
} as const;
