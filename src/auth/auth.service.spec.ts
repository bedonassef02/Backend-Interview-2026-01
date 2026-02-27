import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let service: AuthService;
    let jwtService: jest.Mocked<JwtService>;
    let configService: jest.Mocked<ConfigService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('signed-jwt-token'),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            const config: Record<string, string> = {
                                ADMIN_USERNAME: 'admin',
                                ADMIN_PASSWORD: 'admin123',
                                API_KEY: 'test-api-key-secret',
                            };
                            return config[key];
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        jwtService = module.get(JwtService);
        configService = module.get(ConfigService);
    });

    describe('login()', () => {
        it('should return an access_token for valid credentials', async () => {
            const result = await service.login('admin', 'admin123');

            expect(result).toEqual({ access_token: 'signed-jwt-token' });
            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: 'admin',
                role: 'admin',
            });
        });

        it('should throw UnauthorizedException for wrong password', async () => {
            await expect(service.login('admin', 'wrongpass')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException for wrong username', async () => {
            await expect(service.login('hacker', 'admin123')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException when both username and password are wrong', async () => {
            await expect(service.login('hacker', 'wrongpass')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException for empty username', async () => {
            await expect(service.login('', 'admin123')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException for empty password', async () => {
            await expect(service.login('admin', '')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should include "Invalid credentials" in the UnauthorizedException message', async () => {
            await expect(service.login('bad', 'bad')).rejects.toThrow(
                'Invalid credentials',
            );
        });

        it('should not call jwtService.sign on failed login', async () => {
            try {
                await service.login('bad', 'bad');
            } catch {
                // expected
            }
            expect(jwtService.sign).not.toHaveBeenCalled();
        });

        it('should use ADMIN_USERNAME and ADMIN_PASSWORD from configService', async () => {
            await service.login('admin', 'admin123');
            expect(configService.get).toHaveBeenCalledWith('ADMIN_USERNAME');
            expect(configService.get).toHaveBeenCalledWith('ADMIN_PASSWORD');
        });
    });

    describe('validateApiKey()', () => {
        it('should return true for a valid API key', () => {
            expect(service.validateApiKey('test-api-key-secret')).toBe(true);
        });

        it('should return false for an invalid API key', () => {
            expect(service.validateApiKey('wrong-key')).toBe(false);
        });

        it('should return false for an empty string', () => {
            expect(service.validateApiKey('')).toBe(false);
        });

        it('should return false for a key with extra whitespace', () => {
            expect(service.validateApiKey('test-api-key-secret ')).toBe(false);
        });

        it('should use API_KEY from configService', () => {
            service.validateApiKey('anything');
            expect(configService.get).toHaveBeenCalledWith('API_KEY');
        });
    });
});
