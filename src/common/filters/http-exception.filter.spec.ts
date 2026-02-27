import {
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, ExecutionContext } from '@nestjs/common';

// Helper to create a mock ArgumentsHost
const createMockHost = (method = 'GET', url = '/test') => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    return {
        switchToHttp: () => ({
            getResponse: () => ({ status: mockStatus }),
            getRequest: () => ({ method, url }),
        }),
        mockStatus,
        mockJson,
    };
};

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;

    beforeEach(() => {
        filter = new HttpExceptionFilter();
        // Suppress logger output during tests
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ── Status code mapping ──────────────────────────────────────────────────

    it('should use the HttpException status code for HttpException errors', () => {
        const { switchToHttp, mockStatus, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

        expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should use 500 for non-HttpException errors', () => {
        const { switchToHttp, mockStatus } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new Error('Unexpected internal error'), host);

        expect(mockStatus).toHaveBeenCalledWith(500);
    });

    it('should use 500 for plain objects thrown as errors', () => {
        const { switchToHttp, mockStatus } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch({ something: 'odd' }, host);

        expect(mockStatus).toHaveBeenCalledWith(500);
    });

    // ── Response body shape ──────────────────────────────────────────────────

    it('should include success: false in the response', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('error', 400), host);

        const response = mockJson.mock.calls[0][0];
        expect(response.success).toBe(false);
    });

    it('should include statusCode in the response', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('error', 404), host);

        const response = mockJson.mock.calls[0][0];
        expect(response.statusCode).toBe(404);
    });

    it('should include a timestamp in ISO format', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('error', 400), host);

        const response = mockJson.mock.calls[0][0];
        expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });

    it('should include the request path', () => {
        const { switchToHttp, mockJson } = createMockHost('POST', '/api/upload') as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('error', 400), host);

        const response = mockJson.mock.calls[0][0];
        expect(response.path).toBe('/api/upload');
    });

    // ── Message extraction ───────────────────────────────────────────────────

    it('should use a string message directly from HttpException', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('Simple string message', 400), host);

        const response = mockJson.mock.calls[0][0];
        expect(response.message).toBe('Simple string message');
    });

    it('should extract .message from an object HttpException response', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(
            new HttpException({ message: 'Extracted message', error: 'Bad Request' }, 400),
            host,
        );

        const response = mockJson.mock.calls[0][0];
        expect(response.message).toBe('Extracted message');
    });

    it('should use "Internal server error" as message for unknown errors', () => {
        const { switchToHttp, mockJson } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new Error('Something crashed'), host);

        const response = mockJson.mock.calls[0][0];
        expect(response.message).toBe('Internal server error');
    });

    // ── Logging behaviour ────────────────────────────────────────────────────

    it('should call logger.warn (not logger.error) for 4xx errors', () => {
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        const { switchToHttp } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('Forbidden', 403), host);

        expect(warnSpy).toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should call logger.error (not logger.warn) for 5xx errors', () => {
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        const { switchToHttp } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new HttpException('Server error', 500), host);

        expect(errorSpy).toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should call logger.error for generic (non-HttpException) errors', () => {
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        const { switchToHttp } = createMockHost() as any;
        const host = { switchToHttp } as unknown as ArgumentsHost;

        filter.catch(new Error('Crash'), host);

        expect(errorSpy).toHaveBeenCalled();
    });
});
