import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../user/schema/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface UserWithRole {
  role: UserRole;
}

interface RequestWithUser {
  user?: UserWithRole;
}

interface GraphQLContext {
  req: {
    user: UserWithRole;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const user = this.extractUser(context);
    return user?.role ? requiredRoles.includes(user.role) : false;
  }

  private extractUser(context: ExecutionContext): UserWithRole | undefined {
    if (context.getType() === 'http') {
      const { user } = context.switchToHttp().getRequest<RequestWithUser>();
      return user;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const {
      req: { user },
    } = gqlContext.getContext<GraphQLContext>();
    return user;
  }
}
