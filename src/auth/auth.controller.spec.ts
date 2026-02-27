import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('login()', () => {
    it('should call authService.login with the provided credentials', async () => {
      const token = { access_token: 'jwt-token-abc' };
      authService.login.mockResolvedValue(token);

      const loginDto: LoginDto = { username: 'admin', password: 'admin123' };
      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith('admin', 'admin123');
      expect(result).toEqual(token);
    });

    it('should propagate UnauthorizedException thrown by authService.login', async () => {
      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      const loginDto: LoginDto = { username: 'wrong', password: 'wrong' };
      await expect(controller.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should return exactly what authService.login returns', async () => {
      const payload = { access_token: 'my-specific-token' };
      authService.login.mockResolvedValue(payload);

      const result = await controller.login({
        username: 'admin',
        password: 'pass',
      });
      expect(result).toBe(payload);
    });
  });

  describe('getProfile()', () => {
    it('should return the user from the request object', () => {
      const mockRequest = {
        user: { username: 'admin', role: 'admin' },
      };

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual({ username: 'admin', role: 'admin' });
    });

    it('should return whatever user object is attached to req', () => {
      const customUser = {
        username: 'testuser',
        role: 'viewer',
        sub: 'testuser',
      };
      const result = controller.getProfile({ user: customUser });
      expect(result).toBe(customUser);
    });
  });
});
