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

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const route = `${request?.method ?? '?'} ${request?.originalUrl ?? '?'}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        const rawMessage = obj.message;
        message =
          typeof rawMessage === 'string'
            ? rawMessage
            : Array.isArray(rawMessage)
              ? rawMessage.join(', ')
              : exception.message;
        if (typeof obj.code === 'string') code = obj.code;
        if (obj.qel !== undefined) extra = { qel: obj.qel };
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // `fetch failed` hides the real transport error in `cause`; surface it for triage.
      const cause = (exception as Error & { cause?: unknown }).cause;
      const causeText =
        cause instanceof Error
          ? ` (cause: ${(cause as Error & { code?: string }).code ?? cause.name} — ${cause.message})`
          : '';
      this.logger.error(
        `${route} — ${exception.message}${causeText}`,
        exception.stack,
      );
      message = exception.message || message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      ...extra,
      timestamp: new Date().toISOString(),
    });
  }
}
