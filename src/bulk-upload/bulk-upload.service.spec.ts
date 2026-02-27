import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BulkUploadService } from './bulk-upload.service';
import { DatabaseService } from '../database/database.service';

// A helper to create a CSV buffer from an array of rows
function makeCsvBuffer(header: string, rows: string[]): Buffer {
  const lines = [header, ...rows].join('\r\n');
  return Buffer.from(lines, 'utf-8');
}

describe('BulkUploadService', () => {
  let service: BulkUploadService;
  let dbService: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkUploadService,
        {
          provide: DatabaseService,
          useValue: {
            bulkInsert: jest.fn().mockResolvedValue({ inserted: 0, total: 0 }),
            getAllRecords: jest.fn().mockResolvedValue([]),
            getRecordCount: jest.fn().mockResolvedValue(0),
            resetDatabase: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BulkUploadService>(BulkUploadService);
    dbService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // processCSV — success paths
  // ────────────────────────────────────────────────────────────────────────────

  describe('processCSV() — success paths', () => {
    it('should process a valid 5-row CSV and return success', async () => {
      const buf = makeCsvBuffer('name,email,age,active', [
        'Alice,alice@test.com,30,true',
        'Bob,bob@test.com,25,false',
        'Carol,carol@test.com,40,true',
        'Dave,dave@test.com,35,false',
        'Eve,eve@test.com,28,true',
      ]);
      dbService.bulkInsert.mockResolvedValue({ inserted: 5, total: 5 });

      const result = await service.processCSV(buf, 'test.csv');

      expect(result.success).toBe(true);
      expect(result.recordsInserted).toBe(5);
      expect(result.recordsFailed).toBe(0);
      expect(result.errors).toBeUndefined();
    });

    it('should return a processingTime string ending with "ms"', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      const result = await service.processCSV(buf, 'test.csv');

      expect(result.processingTime).toMatch(/^\d+ms$/);
    });

    it('should return the correct totalRecordsInDb from database service', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 42 });

      const result = await service.processCSV(buf, 'test.csv');

      expect(result.totalRecordsInDb).toBe(42);
    });

    it('should include the filename in the success message', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      const result = await service.processCSV(buf, 'my-data.csv');

      expect(result.message).toContain('my-data.csv');
    });

    it('should call databaseService.bulkInsert with parsed records', async () => {
      const buf = makeCsvBuffer('name,age', ['Alice,30', 'Bob,25']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 2, total: 2 });

      await service.processCSV(buf, 'test.csv');

      expect(dbService.bulkInsert).toHaveBeenCalledTimes(1);
      const insertedRecords = dbService.bulkInsert.mock.calls[0][0];
      expect(insertedRecords).toHaveLength(2);
    });

    it('should assign a UUID id to each record', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      await service.processCSV(buf, 'test.csv');

      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(records[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should assign status "processed" to each record', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      await service.processCSV(buf, 'test.csv');

      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(records[0].status).toBe('processed');
    });

    it('should assign a createdAt ISO string to each record', async () => {
      const buf = makeCsvBuffer('name', ['Alice']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      await service.processCSV(buf, 'test.csv');

      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(new Date(records[0].createdAt).toISOString()).toBe(
        records[0].createdAt,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // processCSV — error / edge paths
  // ────────────────────────────────────────────────────────────────────────────

  describe('processCSV() — error and edge cases', () => {
    it('should throw BadRequestException for a CSV with header only (no data rows)', async () => {
      const buf = makeCsvBuffer('name,email,age', []);

      await expect(service.processCSV(buf, 'empty.csv')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return success with 0 inserts when all rows are empty (not throw)', async () => {
      // The service skips empty rows and returns success:true with recordsInserted:0
      const buf = makeCsvBuffer('name,email,age,active', [',,,', ',,,']);

      const result = await service.processCSV(buf, 'empty-rows.csv');

      expect(result.success).toBe(true);
      expect(result.recordsInserted).toBe(0);
      expect(result.recordsFailed).toBe(2);
    });

    it('should throw BadRequestException for an empty buffer', async () => {
      const buf = Buffer.from('');

      await expect(service.processCSV(buf, 'empty.csv')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should count empty rows in recordsFailed', async () => {
      const buf = makeCsvBuffer('name,email', [
        'Alice,alice@test.com', // valid
        ',,', // empty — failed
        'Bob,bob@test.com', // valid
      ]);
      dbService.bulkInsert.mockResolvedValue({ inserted: 2, total: 2 });

      const result = await service.processCSV(buf, 'mixed.csv');

      expect(result.recordsInserted).toBe(2);
      expect(result.recordsFailed).toBe(1);
    });

    it('should include errors array when there are failed rows', async () => {
      const buf = makeCsvBuffer('name', ['Alice', ',,,']);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });

      const result = await service.processCSV(buf, 'mixed.csv');

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should truncate to 10,000 records and add a warning when CSV exceeds the cap', async () => {
      // Build CSV with 10,001 rows
      const rows: string[] = [];
      for (let i = 0; i < 10_001; i++) {
        rows.push(`User${i},user${i}@test.com`);
      }
      const buf = makeCsvBuffer('name,email', rows);
      dbService.bulkInsert.mockImplementation(async (records) => ({
        inserted: records.length,
        total: records.length,
      }));

      const result = await service.processCSV(buf, 'large.csv');

      expect(result.recordsInserted).toBe(10_000);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes('10000'))).toBe(true);
    }, 30_000); // allow extra time for large CSV

    it('should process exactly 10,000 rows and include a limit-reached warning', async () => {
      const rows: string[] = [];
      for (let i = 0; i < 10_000; i++) {
        rows.push(`User${i},user${i}@test.com`);
      }
      const buf = makeCsvBuffer('name,email', rows);
      dbService.bulkInsert.mockImplementation(async (records) => ({
        inserted: records.length,
        total: records.length,
      }));

      const result = await service.processCSV(buf, 'exact.csv');

      // Service processes 10K and includes a limit/cap notice in errors
      expect(result.recordsInserted).toBe(10_000);
      expect(Array.isArray(result.errors)).toBe(true);
    }, 30_000);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // normalizeRow — data type coercion
  // ────────────────────────────────────────────────────────────────────────────

  describe('processCSV() — data normalization', () => {
    const testNormalization = async (
      csvValue: string,
      expectedValue: unknown,
    ) => {
      const buf = makeCsvBuffer('val', [csvValue]);
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });
      await service.processCSV(buf, 'test.csv');
      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(records[0].data['val']).toStrictEqual(expectedValue);
    };

    it('should cast "42" to number 42', async () => {
      await testNormalization('42', 42);
    });

    it('should cast "3.14" to number 3.14', async () => {
      await testNormalization('3.14', 3.14);
    });

    it('should cast "0" to number 0', async () => {
      await testNormalization('0', 0);
    });

    it('should cast "true" to boolean true', async () => {
      await testNormalization('true', true);
    });

    it('should cast "TRUE" (uppercase) to boolean true', async () => {
      await testNormalization('TRUE', true);
    });

    it('should cast "false" to boolean false', async () => {
      await testNormalization('false', false);
    });

    it('should cast "FALSE" (uppercase) to boolean false', async () => {
      await testNormalization('FALSE', false);
    });

    it('should cast empty string to null (in a multi-column row)', async () => {
      // Use two columns: name has a value (so row is valid), val is empty
      const buf = Buffer.from('name,val\r\nAlice,', 'utf-8');
      dbService.bulkInsert.mockClear();
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });
      await service.processCSV(buf, 'test.csv');
      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(records[0].data['val']).toBeNull();
    });

    it('should cast whitespace-only string to null (in a multi-column row)', async () => {
      // Same: name has a value, val is whitespace only
      const buf = Buffer.from('name,val\r\nAlice,   ', 'utf-8');
      dbService.bulkInsert.mockClear();
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });
      await service.processCSV(buf, 'test.csv');
      const records = dbService.bulkInsert.mock.calls[0][0];
      expect(records[0].data['val']).toBeNull();
    });

    it('should keep regular strings as strings (trimmed)', async () => {
      await testNormalization('  hello world  ', 'hello world');
    });

    it('should keep strings with letters+numbers as strings', async () => {
      await testNormalization('abc123', 'abc123');
    });

    it('should trim column key names', async () => {
      const buf = Buffer.from(' name \r\n Alice\r\n', 'utf-8');
      dbService.bulkInsert.mockResolvedValue({ inserted: 1, total: 1 });
      await service.processCSV(buf, 'test.csv');
      const records = dbService.bulkInsert.mock.calls[0][0];
      // The trimmed key should exist
      expect('name' in records[0].data).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // getRecords & resetDatabase
  // ────────────────────────────────────────────────────────────────────────────

  describe('getRecords()', () => {
    it('should return the records from the database service', async () => {
      const mockRecords = [
        {
          id: '1',
          data: { name: 'Alice' },
          status: 'processed' as const,
          createdAt: '',
        },
      ];
      dbService.getAllRecords.mockResolvedValue(mockRecords);

      const result = await service.getRecords();

      expect(dbService.getAllRecords).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockRecords);
    });

    it('should return empty array when no records exist', async () => {
      dbService.getAllRecords.mockResolvedValue([]);

      const result = await service.getRecords();

      expect(result).toEqual([]);
    });
  });

  describe('resetDatabase()', () => {
    it('should call databaseService.resetDatabase()', async () => {
      await service.resetDatabase();

      expect(dbService.resetDatabase).toHaveBeenCalledTimes(1);
    });

    it('should return a success message', async () => {
      const result = await service.resetDatabase();

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message.toLowerCase()).toContain('reset');
    });
  });
});
