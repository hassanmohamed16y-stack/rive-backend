import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('HttpRequest');
// Augments Express's Request with fields set by this middleware (requestId) and by
// JwtAuthGuard/OptionalJwtAuthGuard (user) earlier in the pipeline. The cast below is safe
// because every read of these fields uses optional chaining (`?.`), so a request that hasn't
// gone through auth yet (user undefined) is handled without a runtime error.
type RequestWithContext = Request & { requestId?: string; user?: { userId?: string } };

export function requestLoggingMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = randomUUID();
  const requestWithContext = request as RequestWithContext;
  requestWithContext.requestId = requestId;
  const startedAt = Date.now();
  response.setHeader('X-Request-Id', requestId);

  response.on('finish', () => {
    const userId = requestWithContext.user?.userId;
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: request.method,
      route: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      ...(userId ? { userId } : {}),
      ...(request.ip ? { ip: request.ip } : {}),
    });
    if (response.statusCode >= 500) logger.error(entry);
    else logger.log(entry);
  });

  next();
}
