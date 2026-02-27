import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { validationSchema } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { BulkUploadModule } from './bulk-upload/bulk-upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
      },
    ]),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),

    DatabaseModule,
    AuthModule,
    BulkUploadModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
