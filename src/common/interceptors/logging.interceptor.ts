import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Global logging interceptor.
 *
 * Logs every inbound HTTP request and its outcome (status code, duration).
 *
 * Design decision:
 *   - We log at the interceptor level (not middleware) so that NestJS route
 *     metadata (controller name, etc.) is available if needed in the future.
 *   - Duration is measured precisely using Date.now() deltas.
 *   - Errors are NOT logged here; the HttpExceptionFilter handles error logging
 *     so we avoid double-logging.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const { method, url, ip } = req;
        const startTime = Date.now();

        return next.handle().pipe(
            tap(() => {
                const res = context.switchToHttp().getResponse();
                const duration = Date.now() - startTime;
                this.logger.log(
                    `${method} ${url} ${res.statusCode} — ${duration}ms [${ip}]`,
                );
            }),
        );
    }
}
