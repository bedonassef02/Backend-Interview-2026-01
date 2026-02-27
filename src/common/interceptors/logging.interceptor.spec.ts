import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockContext = (
    method: string,
    url: string,
    statusCode = 200,
    ip = '127.0.0.1',
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, url, ip }),
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  const createMockHandler = (): CallHandler => ({
    handle: () => of('response'),
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log the HTTP method', (done) => {
    const ctx = createMockContext('POST', '/api/upload');
    const handler = createMockHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('POST'));
        done();
      },
    });
  });

  it('should log the URL', (done) => {
    const ctx = createMockContext('GET', '/api/bulk-upload/records');
    const handler = createMockHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/bulk-upload/records'),
        );
        done();
      },
    });
  });

  it('should log the status code', (done) => {
    const ctx = createMockContext('POST', '/api/upload', 201);
    const handler = createMockHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('201'));
        done();
      },
    });
  });

  it('should log the client IP', (done) => {
    const ctx = createMockContext('GET', '/test', 200, '192.168.1.1');
    const handler = createMockHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('192.168.1.1'),
        );
        done();
      },
    });
  });

  it('should log a duration in ms format', (done) => {
    const ctx = createMockContext('GET', '/test');
    const handler = createMockHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        const logMessage = logSpy.mock.calls[0][0] as string;
        expect(logMessage).toMatch(/\d+ms/);
        done();
      },
    });
  });

  it('should pass through the handler response unchanged', (done) => {
    const ctx = createMockContext('GET', '/test');
    const handler: CallHandler = { handle: () => of('my-response') };

    interceptor.intercept(ctx, handler).subscribe({
      next: (value) => {
        expect(value).toBe('my-response');
        done();
      },
    });
  });

  it('should call handler.handle() exactly once', (done) => {
    const ctx = createMockContext('GET', '/test');
    const handleSpy = jest.fn().mockReturnValue(of(null));
    const handler: CallHandler = { handle: handleSpy };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(handleSpy).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });
});
