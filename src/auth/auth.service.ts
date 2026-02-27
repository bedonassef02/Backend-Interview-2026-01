import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const adminUser = this.configService.get<string>('ADMIN_USERNAME');
    const adminPass = this.configService.get<string>('ADMIN_PASSWORD');

    if (username !== adminUser || password !== adminPass) {
      this.logger.warn(`Failed login attempt for user: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: username, role: 'admin' };
    const access_token = this.jwtService.sign(payload);

    this.logger.log(`User '${username}' logged in successfully`);
    return { access_token };
  }

  validateApiKey(apiKey: string): boolean {
    const validKey = this.configService.get<string>('API_KEY');
    return apiKey === validKey;
  }
}
