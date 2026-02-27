import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('test-secret-key-min-16-chars'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate()', () => {
    it('should return { username, role } for a valid payload', async () => {
      const payload = { sub: 'admin', role: 'admin' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({ username: 'admin', role: 'admin' });
    });

    it('should return username mapped from payload.sub', async () => {
      const payload = { sub: 'testuser', role: 'viewer' };
      const result = await strategy.validate(payload);

      expect(result.username).toBe('testuser');
    });

    it('should return role from payload', async () => {
      const payload = { sub: 'user', role: 'admin' };
      const result = await strategy.validate(payload);

      expect(result.role).toBe('admin');
    });

    it('should throw UnauthorizedException when payload.sub is missing', async () => {
      const payload = { role: 'admin' }; // no sub
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when payload.sub is null', async () => {
      const payload = { sub: null, role: 'admin' };
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when payload.sub is empty string', async () => {
      const payload = { sub: '', role: 'admin' };
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include "Invalid JWT payload" in the UnauthorizedException', async () => {
      await expect(strategy.validate({ role: 'admin' })).rejects.toThrow(
        'Invalid JWT payload',
      );
    });

    it('should handle payload with undefined role gracefully', async () => {
      const payload = { sub: 'admin' }; // no role
      const result = await strategy.validate(payload);
      expect(result.username).toBe('admin');
      expect(result.role).toBeUndefined();
    });
  });
});
