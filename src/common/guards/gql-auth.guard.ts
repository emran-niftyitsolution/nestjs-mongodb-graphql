import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface RequestWithHeaders {
  headers?: { authorization?: string | string[] };
}

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
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
      const raw = req.headers?.authorization;
      const header =
        typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
      const hasToken =
        header.startsWith('Bearer ') && header.split(' ')[1]?.length > 0;

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

  getRequest(context: ExecutionContext): RequestWithHeaders {
    try {
      const ctx = GqlExecutionContext.create(context);
      const gqlContext = ctx.getContext<{ req: RequestWithHeaders }>();
      return gqlContext.req;
    } catch {
      return context.switchToHttp().getRequest<RequestWithHeaders>();
    }
  }
}
