import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const optionalAuth = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (optionalAuth) {
      const req = this.getRequest(context);
      const header = (
        req?.headers as unknown as Record<string, string | undefined>
      ).authorization;
      const hasToken =
        typeof header === 'string' &&
        header.startsWith('Bearer ') &&
        header.slice('Bearer '.length).length > 0;

      if (hasToken) {
        return super.canActivate(context);
      }

      return true;
    }

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override getRequest(context: ExecutionContext): Request {
    try {
      const ctx = GqlExecutionContext.create(context);
      const gqlContext = ctx.getContext<{ req: Request }>();
      return gqlContext.req;
    } catch {
      return context.switchToHttp().getRequest();
    }
  }
}
