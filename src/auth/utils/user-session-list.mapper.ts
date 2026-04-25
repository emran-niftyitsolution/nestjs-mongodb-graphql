import type { UserSessionListEntry } from '../dtos/auth.input';
import type { UserSession } from '../schemas/user-session.schema';

export function mapUserSessionsToListEntries(
  userSessions: UserSession[],
  currentSessionId: string | null,
): UserSessionListEntry[] {
  return userSessions.map((userSession): UserSessionListEntry => {
    const sessionIdString = userSession._id.toString();
    const listEntry: UserSessionListEntry = {
      _id: sessionIdString,
      createdAt:
        userSession.createdAt != null ? userSession.createdAt : new Date(),
      updatedAt:
        userSession.updatedAt != null ? userSession.updatedAt : new Date(),
      isCurrent:
        currentSessionId !== null && sessionIdString === currentSessionId,
    };
    if (userSession.userAgent !== undefined) {
      listEntry.userAgent = userSession.userAgent;
    }
    if (userSession.ipAddress !== undefined) {
      listEntry.ipAddress = userSession.ipAddress;
    }
    if (userSession.deviceName !== undefined) {
      listEntry.deviceName = userSession.deviceName;
    }
    if (userSession.lastActiveAt !== undefined) {
      listEntry.lastActiveAt = userSession.lastActiveAt;
    }
    return listEntry;
  });
}
