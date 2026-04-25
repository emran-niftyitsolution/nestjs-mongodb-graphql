import type { Request } from 'express';
import type { SessionClientMeta } from '../interfaces/session-client-meta.interface';

/**
 * Build session metadata from the raw HTTP request (e.g. User-Agent, client IP).
 */
export function buildSessionMetaFromRequest(req: Request): SessionClientMeta {
  const userAgent = req.headers['user-agent'];
  const meta: SessionClientMeta = {};
  if (typeof userAgent === 'string' && userAgent.length > 0) {
    meta.userAgent = userAgent;
  }
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    meta.ipAddress = req.ip;
  }
  return meta;
}

/**
 * Merge optional `deviceName` from GraphQL input into base session metadata.
 */
export function mergeClientMeta(
  fromInput: { deviceName?: string },
  base?: SessionClientMeta,
): SessionClientMeta {
  const meta: SessionClientMeta = { ...base };
  if (fromInput.deviceName !== undefined) {
    const trimmedDeviceName = fromInput.deviceName.trim();
    if (trimmedDeviceName.length > 0) {
      meta.deviceName = trimmedDeviceName;
    }
  }
  return meta;
}
