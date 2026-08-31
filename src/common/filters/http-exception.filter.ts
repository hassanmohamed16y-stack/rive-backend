import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const payload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error:
        typeof message === 'string'
          ? message
          : (message as any)?.message ?? 'Unexpected error',
      details:
        typeof message === 'string' ? undefined : (message as any)?.error ?? undefined,
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${JSON.stringify(payload)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(payload);
  }
}
