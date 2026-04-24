import { ForbiddenException } from '@nestjs/common';
import { User, UserRole } from '../../user/schema/user.schema';

export function isSuperAdmin(user: User): boolean {
  return user.role === UserRole.SUPER_ADMIN;
}

export function assertSuperAdmin(user: User): void {
  if (!isSuperAdmin(user)) {
    throw new ForbiddenException('Super admin only');
  }
}
