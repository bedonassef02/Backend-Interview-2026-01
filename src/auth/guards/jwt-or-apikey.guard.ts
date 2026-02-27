import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';

/**
 * Combined guard that accepts EITHER a valid JWT Bearer token
 * OR a valid x-api-key header.
 *
 * This lets the web UI use JWT tokens while programmatic clients
 * (cURL, Postman, CI scripts) can use a static API key.
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try JWT first
    try {
      const jwtResult = await this.jwtGuard.canActivate(context);
      if (jwtResult) return true;
    } catch {
      // JWT failed — fall through to API key
    }

    // Try API key
    try {
      return this.apiKeyGuard.canActivate(context);
    } catch {
      // Both failed — re-throw the JWT error for a standard 401
      // (this keeps the existing error format)
      return this.jwtGuard.canActivate(context) as Promise<boolean>;
    }
  }
}
