import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const FRAMEWORK_CLASS_MESSAGE =
  /^[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*(?:\s+Exception)?$/;

function isFrameworkClassMessage(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (t === 'Service Unavailable Exception') return true;
  if (t === 'Internal Server Error' || t === 'Bad Request Exception') return true;
  return FRAMEWORK_CLASS_MESSAGE.test(t) && t.includes('Exception');
}

function sanitizePublicMessage(
  candidate: string | undefined,
  status: number,
): string {
  const raw = (candidate ?? '').trim();
  if (raw && !isFrameworkClassMessage(raw)) return raw;
  if (status === HttpStatus.GATEWAY_TIMEOUT || status === HttpStatus.REQUEST_TIMEOUT) {
    return 'استغرق التحليل وقتًا أطول من المتوقع. حاول مرة أخرى.';
  }
  if (status === HttpStatus.SERVICE_UNAVAILABLE) {
    return 'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.';
  }
  if (status >= 500) {
    return 'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.';
  }
  return 'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.';
}

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
    let category: string | undefined;
    let retryable: boolean | undefined;
    let requiresRecapture: boolean | undefined;
    let userAction: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        const rawMessage = obj.message;
        if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else if (Array.isArray(rawMessage)) {
          message = rawMessage.join(', ');
        } else if (rawMessage && typeof rawMessage === 'object') {
          const nested = rawMessage as Record<string, unknown>;
          message =
            typeof nested.message === 'string'
              ? nested.message
              : exception.message;
        } else {
          message = exception.message;
        }
        if (typeof obj.code === 'string') code = obj.code;
        if (typeof obj.category === 'string') category = obj.category;
        if (typeof obj.retryable === 'boolean') retryable = obj.retryable;
        if (typeof obj.requiresRecapture === 'boolean') {
          requiresRecapture = obj.requiresRecapture;
        }
        if (typeof obj.userAction === 'string') userAction = obj.userAction;
        if (typeof obj.captureCode === 'string' && !code) {
          code = obj.captureCode;
        }
        if (obj.qel !== undefined) extra = { qel: obj.qel };
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      const cause = (exception as Error & { cause?: unknown }).cause;
      const causeText =
        cause instanceof Error
          ? ` (cause: ${(cause as Error & { code?: string }).code ?? cause.name} — ${cause.message})`
          : '';
      this.logger.error(
        `${route} — ${exception.message}${causeText}`,
        exception.stack,
      );
      message = 'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.';
    }

    message = sanitizePublicMessage(message, status);

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      ...(category ? { category } : {}),
      ...(retryable !== undefined ? { retryable } : {}),
      ...(requiresRecapture !== undefined ? { requiresRecapture } : {}),
      ...(userAction ? { userAction } : {}),
      ...extra,
      timestamp: new Date().toISOString(),
    });
  }
}
