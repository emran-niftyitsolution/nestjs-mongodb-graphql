import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

type RequestLike = Record<string, unknown> & {
  ips?: unknown;
  ip?: unknown;
};

type RawWithSetHeader = {
  setHeader?: (name: string, value: string) => void;
};

type ResponseLike = Record<string, unknown> & {
  header?: (name: string, value: string) => unknown;
  setHeader?: (name: string, value: string) => void;
  raw?: RawWithSetHeader;
};

type HeaderEnabledResponse = ResponseLike & {
  header: (name: string, value: string) => unknown;
};

interface GraphQLHttpContext {
  req?: RequestLike;
  res?: ResponseLike;
  request?: RequestLike;
  reply?: ResponseLike;
}

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  private ensureHeaderMethod(response: ResponseLike): HeaderEnabledResponse {
    if (typeof response?.header === 'function') {
      return response as HeaderEnabledResponse;
    }

    if (typeof response?.setHeader === 'function') {
      return {
        ...response,
        header(name: string, value: string) {
          response.setHeader?.(name, value);
          return response;
        },
      };
    }

    if (response?.raw && typeof response.raw.setHeader === 'function') {
      return {
        ...response,
        header(name: string, value: string) {
          response.raw?.setHeader?.(name, value);
          return response;
        },
      };
    }

    return {
      ...response,
      header() {
        return response;
      },
    };
  }

  getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext<GraphQLHttpContext>();

    const req: RequestLike =
      gqlCtx.req ??
      gqlCtx.request ??
      context.switchToHttp().getRequest<RequestLike>() ??
      {};

    const res = this.ensureHeaderMethod(
      gqlCtx.res ??
        gqlCtx.reply ??
        context.switchToHttp().getResponse<ResponseLike>() ??
        {},
    );

    return { req, res };
  }

  protected async getTracker(req: RequestLike): Promise<string> {
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
