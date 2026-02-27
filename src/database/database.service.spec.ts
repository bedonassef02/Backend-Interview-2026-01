import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import { DatabaseService } from './database.service';
import { BulkUploadRecord } from '../models/bulk-upload-record.model';
import { DatabaseSchema } from './interfaces/database-schema.interface';

// Mock the entire fs/promises module
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// ─── helpers ────────────────────────────────────────────────────────────────

const makeEmptyDb = (): DatabaseSchema => ({
  records: [],
  metadata: {
    createdAt: null,
    updatedAt: null,
    description: 'Temporary store for bulk upload records',
  },
});

const makeRecord = (id: string): BulkUploadRecord => ({
  id,
  data: { name: `User-${id}` },
  status: 'processed',
  createdAt: new Date().toISOString(),
});

// ────────────────────────────────────────────────────────────────────────────

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: directory exists, file exists and contains empty db
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined); // file exists
    mockFs.readFile.mockResolvedValue(JSON.stringify(makeEmptyDb()) as any);
    mockFs.writeFile.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  // ── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('should create the data directory', async () => {
      await service.onModuleInit();
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true },
      );
    });

    it('should NOT call resetDatabase when the file already exists', async () => {
      mockFs.access.mockResolvedValue(undefined); // file exists

      const writeSpy = jest.spyOn(service, 'write');
      await service.onModuleInit();

      // write should not be called during init if file exists
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('should call resetDatabase (write) when the file does NOT exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await service.onModuleInit();

      // resetDatabase calls write which calls writeFile
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  // ── read ─────────────────────────────────────────────────────────────────

  describe('read()', () => {
    it('should parse the JSON file and return a DatabaseSchema', async () => {
      const db: DatabaseSchema = {
        records: [makeRecord('abc')],
        metadata: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          description: 'test',
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(db) as any);

      const result = await service.read();

      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('abc');
    });

    it('should throw a SyntaxError on malformed JSON', async () => {
      mockFs.readFile.mockResolvedValue('not-valid-json' as any);

      await expect(service.read()).rejects.toThrow(SyntaxError);
    });
  });

  // ── write ─────────────────────────────────────────────────────────────────

  describe('write()', () => {
    it('should call fs.writeFile with pretty-printed JSON', async () => {
      const db = makeEmptyDb();
      await service.write(db);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'utf-8',
      );
      // Verify it's pretty-printed (contains newlines)
      const written = mockFs.writeFile.mock.calls[0][1] as string;
      expect(written).toContain('\n');
    });

    it('should set metadata.updatedAt to a current ISO timestamp', async () => {
      const db = makeEmptyDb();
      const before = Date.now();
      await service.write(db);
      const after = Date.now();

      const written = JSON.parse(
        mockFs.writeFile.mock.calls[0][1] as string,
      ) as DatabaseSchema;
      const updatedAt = new Date(written.metadata.updatedAt!).getTime();
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
    });

    it('should set metadata.createdAt when it is null', async () => {
      const db = makeEmptyDb(); // createdAt is null
      await service.write(db);

      const written = JSON.parse(
        mockFs.writeFile.mock.calls[0][1] as string,
      ) as DatabaseSchema;
      expect(written.metadata.createdAt).not.toBeNull();
    });

    it('should NOT overwrite metadata.createdAt when it already has a value', async () => {
      const db = makeEmptyDb();
      db.metadata.createdAt = '2026-01-01T00:00:00.000Z';

      await service.write(db);

      const written = JSON.parse(
        mockFs.writeFile.mock.calls[0][1] as string,
      ) as DatabaseSchema;
      expect(written.metadata.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  // ── bulkInsert ───────────────────────────────────────────────────────────

  describe('bulkInsert()', () => {
    it('should append records to the existing db and return inserted count', async () => {
      const existing: DatabaseSchema = {
        ...makeEmptyDb(),
        records: [makeRecord('existing-1')],
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(existing) as any);

      const newRecords = [makeRecord('new-1'), makeRecord('new-2')];
      const result = await service.bulkInsert(newRecords);

      expect(result.inserted).toBe(2);
      expect(result.total).toBe(3); // 1 existing + 2 new
    });

    it('should return inserted: 0 and total: 0 when inserting into empty db', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(makeEmptyDb()) as any);
      const result = await service.bulkInsert([]);

      expect(result.inserted).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should call write() after inserting records', async () => {
      const writeSpy = jest.spyOn(service, 'write');
      mockFs.readFile.mockResolvedValue(JSON.stringify(makeEmptyDb()) as any);

      await service.bulkInsert([makeRecord('r1')]);

      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('should produce correct total when inserting many records', async () => {
      const existing: DatabaseSchema = {
        ...makeEmptyDb(),
        records: Array.from({ length: 5 }, (_, i) => makeRecord(String(i))),
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(existing) as any);

      const newRecords = Array.from({ length: 3 }, (_, i) =>
        makeRecord(`new-${i}`),
      );
      const result = await service.bulkInsert(newRecords);

      expect(result.total).toBe(8);
    });
  });

  // ── getAllRecords ─────────────────────────────────────────────────────────

  describe('getAllRecords()', () => {
    it('should return all records from the db file', async () => {
      const db: DatabaseSchema = {
        ...makeEmptyDb(),
        records: [makeRecord('a'), makeRecord('b')],
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(db) as any);

      const records = await service.getAllRecords();

      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('a');
    });

    it('should return an empty array when no records exist', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(makeEmptyDb()) as any);

      const records = await service.getAllRecords();

      expect(records).toEqual([]);
    });
  });

  // ── getRecordCount ───────────────────────────────────────────────────────

  describe('getRecordCount()', () => {
    it('should return the count of records in the db', async () => {
      const db: DatabaseSchema = {
        ...makeEmptyDb(),
        records: [makeRecord('1'), makeRecord('2'), makeRecord('3')],
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(db) as any);

      const count = await service.getRecordCount();

      expect(count).toBe(3);
    });

    it('should return 0 when there are no records', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(makeEmptyDb()) as any);

      const count = await service.getRecordCount();

      expect(count).toBe(0);
    });
  });

  // ── resetDatabase ────────────────────────────────────────────────────────

  describe('resetDatabase()', () => {
    it('should call fs.writeFile with an empty records array', async () => {
      await service.resetDatabase();

      expect(mockFs.writeFile).toHaveBeenCalled();
      const written = JSON.parse(
        mockFs.writeFile.mock.calls[0][1] as string,
      ) as DatabaseSchema;
      expect(written.records).toEqual([]);
    });

    it('should write a valid description in the metadata', async () => {
      await service.resetDatabase();

      const written = JSON.parse(
        mockFs.writeFile.mock.calls[0][1] as string,
      ) as DatabaseSchema;
      expect(typeof written.metadata.description).toBe('string');
      expect(written.metadata.description.length).toBeGreaterThan(0);
    });
  });
});
