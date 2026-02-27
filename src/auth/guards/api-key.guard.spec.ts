import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from '../auth.service';

const mockAuthService = {
  validateApiKey: jest.fn(),
};

const createMockContext = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ApiKeyGuard(mockAuthService as unknown as AuthService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when a valid API key is provided', () => {
    mockAuthService.validateApiKey.mockReturnValue(true);

    const ctx = createMockContext({ 'x-api-key': 'valid-key' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('valid-key');
  });

  it('should throw UnauthorizedException when x-api-key header is missing', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid or missing API key');
  });

  it('should throw UnauthorizedException when API key is invalid', () => {
    mockAuthService.validateApiKey.mockReturnValue(false);

    const ctx = createMockContext({ 'x-api-key': 'wrong-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid or missing API key');
  });

  it('should throw UnauthorizedException when x-api-key is an empty string', () => {
    // An empty string is falsy — should be rejected without calling validateApiKey
    const ctx = createMockContext({ 'x-api-key': '' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should not call validateApiKey if the header is missing', () => {
    const ctx = createMockContext({});
    try {
      guard.canActivate(ctx);
    } catch {
      // expected
    }
    expect(mockAuthService.validateApiKey).not.toHaveBeenCalled();
  });
});
