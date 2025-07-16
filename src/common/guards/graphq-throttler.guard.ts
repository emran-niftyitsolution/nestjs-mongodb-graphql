import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext<{ req: Request; res: Response }>();
    return { req: gqlCtx.req, res: gqlCtx.res };
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (
      Array.isArray(req?.ips) &&
      req.ips.length > 0 &&
      typeof req.ips[0] === 'string'
    ) {
      return Promise.resolve(req.ips[0]);
    }
    if (typeof req?.ip === 'string') {
      return Promise.resolve(req.ip);
    }
    return '';
  }
}
