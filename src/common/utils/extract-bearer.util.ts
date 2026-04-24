/**
 * Parses `Authorization: Bearer <token>`. Returns null if missing or malformed.
 */
export function extractBearer(
  authorization: string | undefined,
): string | null {
  if (!authorization) return null;
  const trimmedHeader = authorization.trim();
  if (!trimmedHeader.startsWith('Bearer ')) return null;
  const tokenAfterBearerPrefix = trimmedHeader.slice('Bearer '.length).trim();
  return tokenAfterBearerPrefix.length > 0 ? tokenAfterBearerPrefix : null;
}
