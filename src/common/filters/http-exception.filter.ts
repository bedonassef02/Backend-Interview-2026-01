import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 *
 * Catches every thrown exception (HttpException subclasses AND unexpected
 * errors) and unifies them into a consistent JSON response shape.
 *
 * Design decision:
 *   - We NEVER expose raw stack traces or internal error details to the client,
 *     which prevents information leakage that could aid attackers.
 *   - All errors are logged server-side via NestJS Logger instead.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Determine the HTTP status code
        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // Extract the human-readable message
        let message: string | object = 'Internal server error';
        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                // Handles NestJS validation errors (array of messages)
                message = (exceptionResponse as any).message ?? exceptionResponse;
            }
        }

        // Log with full stack for 5xx; only message for 4xx (client errors)
        if (status >= 500) {
            this.logger.error(
                `[${request.method}] ${request.url} → ${status}`,
                exception instanceof Error ? exception.stack : String(exception),
            );
        } else {
            this.logger.warn(`[${request.method}] ${request.url} → ${status}: ${JSON.stringify(message)}`);
        }

        // Send the unified error response
        response.status(status).json({
            success: false,
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }
}
