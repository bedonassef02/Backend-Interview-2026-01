import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

@Module({
  imports: [
    // ─── Load .env globally ────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Rate Limiting (DoS / DDoS Prevention) ────────────────────────────
    // Applied globally via APP_GUARD below.
    // Default: 10 requests per 60 s per IP — configurable via .env
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000, // convert s → ms (NestJS v6+)
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
      },
    ]),

    // ─── Serve static frontend ────────────────────────────────────────────
    // Serves everything in /public at the root URL "/"
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
  ],
  providers: [
    // ─── Apply rate limiter to every route globally ────────────────────────
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
