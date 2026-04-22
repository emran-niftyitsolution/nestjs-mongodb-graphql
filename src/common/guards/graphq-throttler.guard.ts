import { type ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  override getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext<{ req: Request; res: Response }>();
    return { req: gqlCtx.req, res: gqlCtx.res };
  }

  override async getTracker(
    req: Request & { ips?: string[]; ip?: string },
  ): Promise<string> {
    if (
      Array.isArray(req?.ips) &&
      req.ips.length > 0 &&
      typeof req.ips[0] === 'string'
    ) {
      return req.ips[0];
    }
    if (typeof req?.ip === 'string') {
      return req.ip;
    }
    return '';
  }
}
