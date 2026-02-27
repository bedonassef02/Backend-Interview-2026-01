import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default ?? supertest;
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from './../src/common/interceptors/logging.interceptor';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Send a valid login request and return the JWT token */
const getAuthToken = async (app: INestApplication<App>): Promise<string> => {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(200);
  return res.body.access_token as string;
};

/** Build a valid CSV multipart upload request */
const validCsvBuffer = Buffer.from(
  'name,email,age,active\r\nAlice,alice@test.com,30,true\r\nBob,bob@test.com,25,false',
  'utf-8',
);

// ─────────────────────────────────────────────────────────────────────────────

describe('Bulk Upload Service — End-to-End', () => {
  let app: INestApplication<App>;

  /**
   * We use a separate temp DB file for e2e so we don't pollute the real one.
   * Override the DatabaseService's dbPath via a temp file.
   */
  beforeAll(async () => {
    // Point the e2e run at a test-specific JSON db file via env var override.
    // DatabaseService resolves the path from process.cwd() at init time so we
    // can't override it for the already-initialized module; instead we let it
    // use the real file and reset it before/after the suite.
    process.env.THROTTLE_LIMIT = '100'; // relax throttle for most e2e tests

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts setup so middleware is identical
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();
  });

  afterAll(async () => {
    // Reset the throttle env variable
    process.env.THROTTLE_LIMIT = '10';

    // Clean up: reset the database after all e2e tests
    await request(app.getHttpServer())
      .delete('/api/bulk-upload/records')
      .set('Authorization', `Bearer ${await getAuthToken(app)}`);

    await app.close();
  });

  // Reset records before each test that mutates state
  beforeEach(async () => {
    const token = await getAuthToken(app);
    await request(app.getHttpServer())
      .delete('/api/bulk-upload/records')
      .set('Authorization', `Bearer ${token}`);
  });

  // ── Static frontend ────────────────────────────────────────────────────────

  describe('GET /', () => {
    it('should respond with 200 (static HTML page)', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });
  });

  // ── Authentication ─────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should return 200 and an access_token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.length).toBeGreaterThan(10);
    });

    it('should return 401 for a wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 401 for a wrong username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'notadmin', password: 'admin123' })
        .expect(401);
    });

    it('should return 400 when the body is missing username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ password: 'admin123' })
        .expect(400);
    });

    it('should return 400 when the body is missing password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin' })
        .expect(400);
    });

    it('should return 400 when the body is completely empty', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);
    });

    it('should return 400 for extra unknown fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123', extraField: 'bad' })
        .expect(400);
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return 200 and the user payload for a valid JWT', async () => {
      const token = await getAuthToken(app);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('username', 'admin');
      expect(res.body).toHaveProperty('role', 'admin');
    });

    it('should return 401 when no JWT is provided', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return 401 for a malformed JWT', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this-is-not-a-valid-jwt')
        .expect(401);
    });

    it('should return 401 for a token with a tampered signature', async () => {
      const token = await getAuthToken(app);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });
  });

  // ── CSV Upload ─────────────────────────────────────────────────────────────

  describe('POST /api/bulk-upload/upload', () => {
    it('should return 401 when no JWT is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .attach('file', validCsvBuffer, {
          filename: 'test.csv',
          contentType: 'text/csv',
        })
        .expect(401);
    });

    it('should return 201 and upload results for a valid CSV', async () => {
      const token = await getAuthToken(app);

      const res = await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', validCsvBuffer, {
          filename: 'test.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.recordsInserted).toBe(2);
      expect(res.body.recordsFailed).toBe(0);
      expect(res.body.processingTime).toMatch(/^\d+ms$/);
    });

    it('should return the correct recordsInserted count', async () => {
      const token = await getAuthToken(app);
      const csv = Buffer.from('name,score\nA,1\nB,2\nC,3\nD,4\nE,5', 'utf-8');

      const res = await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', csv, { filename: 'multi.csv', contentType: 'text/csv' })
        .expect(201);

      expect(res.body.recordsInserted).toBe(5);
    });

    it('should return 400 when no file is attached', async () => {
      const token = await getAuthToken(app);

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 422 for a file with wrong MIME type (plain text claiming to be json)', async () => {
      const token = await getAuthToken(app);

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('{"not":"csv"}'), {
          filename: 'data.json',
          contentType: 'application/json',
        })
        .expect(422);
    });

    it('should return 422 for a PNG file uploaded instead of CSV', async () => {
      const token = await getAuthToken(app);
      // Minimal PNG magic bytes
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pngBuffer, {
          filename: 'image.png',
          contentType: 'image/png',
        })
        .expect(422);
    });

    it('should return 400 for a CSV with only a header and no data rows', async () => {
      const token = await getAuthToken(app);
      const headerOnly = Buffer.from('name,email,age\n', 'utf-8');

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', headerOnly, {
          filename: 'empty.csv',
          contentType: 'text/csv',
        })
        .expect(400);
    });

    it('should handle a CSV with some empty rows and report them as failed', async () => {
      const token = await getAuthToken(app);
      const mixedCsv = Buffer.from(
        'name,email\nAlice,alice@test.com\n,,\nBob,bob@test.com\n,,',
        'utf-8',
      );

      const res = await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', mixedCsv, {
          filename: 'mixed.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      expect(res.body.recordsInserted).toBe(2);
      expect(res.body.recordsFailed).toBeGreaterThan(0);
    });

    it('should type-cast numeric values correctly in uploaded data', async () => {
      const token = await getAuthToken(app);
      const csv = Buffer.from('name,age\nAlice,30', 'utf-8');

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', csv, { filename: 'types.csv', contentType: 'text/csv' })
        .expect(201);

      // Verify the stored record has a numeric age
      const recordsRes = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(recordsRes.body.records[0].data.age).toBe(30);
    });

    it('should type-cast boolean values correctly in uploaded data', async () => {
      const token = await getAuthToken(app);
      const csv = Buffer.from('name,active\nAlice,true', 'utf-8');

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', csv, {
          filename: 'booleans.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      const recordsRes = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(recordsRes.body.records[0].data.active).toBe(true);
    });

    it('should accumulate records across multiple uploads', async () => {
      const token = await getAuthToken(app);
      const csv1 = Buffer.from('name\nAlice', 'utf-8');
      const csv2 = Buffer.from('name\nBob', 'utf-8');

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', csv1, { filename: 'a.csv', contentType: 'text/csv' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', csv2, { filename: 'b.csv', contentType: 'text/csv' })
        .expect(201);

      expect(res.body.totalRecordsInDb).toBe(2);
    });
  });

  // ── GET records ───────────────────────────────────────────────────────────

  describe('GET /api/bulk-upload/records', () => {
    it('should return 401 when no JWT is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .expect(401);
    });

    it('should return 200 and an empty records array initially', async () => {
      const token = await getAuthToken(app);

      const res = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.records).toEqual([]);
    });

    it('should return all records after an upload', async () => {
      const token = await getAuthToken(app);

      // Upload first
      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', validCsvBuffer, {
          filename: 'test.csv',
          contentType: 'text/csv',
        });

      // Then fetch
      const res = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.count).toBe(2);
      expect(res.body.records).toHaveLength(2);
    });

    it('should include id, data, status, and createdAt on each record', async () => {
      const token = await getAuthToken(app);

      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('name\nAlice'), {
          filename: 'a.csv',
          contentType: 'text/csv',
        });

      const res = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const record = res.body.records[0];
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('data');
      expect(record).toHaveProperty('status', 'processed');
      expect(record).toHaveProperty('createdAt');
    });
  });

  // ── DELETE records ────────────────────────────────────────────────────────

  describe('DELETE /api/bulk-upload/records', () => {
    it('should return 401 when no JWT is provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/bulk-upload/records')
        .expect(401);
    });

    it('should return 200 and a success message', async () => {
      const token = await getAuthToken(app);

      const res = await request(app.getHttpServer())
        .delete('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
    });

    it('should clear all records from the database', async () => {
      const token = await getAuthToken(app);

      // Upload some records
      await request(app.getHttpServer())
        .post('/api/bulk-upload/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', validCsvBuffer, {
          filename: 'test.csv',
          contentType: 'text/csv',
        });

      // Delete all
      await request(app.getHttpServer())
        .delete('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify empty
      const res = await request(app.getHttpServer())
        .get('/api/bulk-upload/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.count).toBe(0);
      expect(res.body.records).toEqual([]);
    });
  });

  // ── Swagger docs ──────────────────────────────────────────────────────────

  describe('GET /api/docs', () => {
    it('should serve the Swagger UI HTML page', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/docs')
        .expect(200);

      // Swagger redirects to /api/docs/ or serves HTML
      expect([200, 301, 302]).toContain(res.status);
    });
  });

  // ── Rate limiter ──────────────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should return 429 after exceeding the rate limit', async () => {
      // Temporarily set a very low limit for this test
      // We restart with reduced throttle
      const lowLimitModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      // Override env to 3 requests per 60s
      process.env.THROTTLE_LIMIT = '3';

      const lowLimitApp = lowLimitModule.createNestApplication();
      lowLimitApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      lowLimitApp.useGlobalFilters(new HttpExceptionFilter());
      await lowLimitApp.init();

      let last429 = false;
      // Fire 5 requests quickly — the 4th or 5th should be throttled
      for (let i = 0; i < 5; i++) {
        const res = await (request(lowLimitApp.getHttpServer()) as any)
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'admin123' });
        if (res.status === 429) {
          last429 = true;
          break;
        }
      }

      await lowLimitApp.close();
      process.env.THROTTLE_LIMIT = '100';

      expect(last429).toBe(true);
    }, 15_000);
  });
});
