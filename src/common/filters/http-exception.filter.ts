import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type RequestWithContext = Request & { requestId?: string };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };

    const message =
      typeof responseBody === 'string'
        ? responseBody
        : Array.isArray((responseBody as any)?.message)
          ? (responseBody as any).message[0]
          : (responseBody as any)?.message ?? 'Unexpected error';

    const payload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      path: request.url,
      method: request.method,
      error: message,
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} requestId=${request.requestId ?? 'unknown'} - ${message}`,
      exception instanceof Error ? exception.name : undefined,
    );

    response.status(status).json(payload);
  }
}
