import type { Request } from 'express';

/** Standard GraphQL context for `@nestjs/apollo` + express: `{ req, res }`. */
export interface GqlExpressRequestContext {
  req: Request;
}
