import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Controllers validate with Schema.parse, whose ZodError is not an
 * HttpException and would otherwise surface as an opaque 500.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(error: ZodError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const issues = error.issues.map((issue) => ({
      field: issue.path.join('.') || undefined,
      message: issue.message,
    }));

    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message:
        issues
          .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
          .join('; ') || 'Invalid request body',
      issues,
    });
  }
}
