import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Request, Response } from "express";
import { AlertService } from "../../health/alert.service";

type RequestWithContext = Request & { requestId?: string };

interface HttpExceptionResponseBody {
  message?: string | string[];
}

function isHttpExceptionResponseBody(
  value: unknown,
): value is HttpExceptionResponseBody {
  return typeof value === "object" && value !== null;
}

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(@Optional() private readonly alertService?: AlertService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody: unknown =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: "Internal server error" };

    const message =
      typeof responseBody === "string"
        ? responseBody
        : isHttpExceptionResponseBody(responseBody) &&
            Array.isArray(responseBody.message)
          ? responseBody.message[0]
          : ((isHttpExceptionResponseBody(responseBody)
              ? responseBody.message
              : undefined) ?? "Unexpected error");

    const payload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      path: request.url,
      method: request.method,
      error: message,
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} requestId=${request.requestId ?? "unknown"} - ${message}`,
      exception instanceof Error ? exception.name : undefined,
    );

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      try {
        Sentry.captureException(exception);
      } catch (sentryError) {
        this.logger.warn(
          `Failed to report exception to Sentry: ${sentryError instanceof Error ? sentryError.message : String(sentryError)}`,
        );
      }

      // Check for DB connection errors or unhandled application exceptions
      const errString = exception instanceof Error ? `${exception.name}: ${exception.message}\n${exception.stack ?? ""}` : String(exception);
      const isDbError = errString.toLowerCase().includes("prisma") || errString.toLowerCase().includes("database") || errString.toLowerCase().includes("connection");

      const alertKey = isDbError ? "DATABASE_FAILURE" : "UNHANDLED_EXCEPTION";
      const subject = isDbError ? "Database Connection Failure" : `Unhandled Exception on ${request.method} ${request.url}`;
      const details = `Path: ${request.method} ${request.url}\nStatus Code: ${status}\nRequest ID: ${request.requestId ?? "N/A"}\nError Message: ${message}\n\nStack Trace:\n${errString}`;

      if (this.alertService) {
        void this.alertService.sendAlert(alertKey, subject, details);
      }
    }

    response.status(status).json(payload);
  }
}
