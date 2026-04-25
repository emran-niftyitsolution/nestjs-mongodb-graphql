/**
 * Optional session metadata from the client (login / signup) and the HTTP request.
 */
export interface SessionClientMeta {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}
