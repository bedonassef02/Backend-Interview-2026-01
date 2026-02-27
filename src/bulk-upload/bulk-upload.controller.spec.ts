import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BulkUploadController } from './bulk-upload.controller';
import { BulkUploadService } from './bulk-upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-apikey.guard';

const mockUploadResponse: UploadResponseDto = {
  success: true,
  message: 'Successfully uploaded 3 records from test.csv',
  recordsInserted: 3,
  recordsFailed: 0,
  totalRecordsInDb: 3,
  processingTime: '12ms',
};

describe('BulkUploadController', () => {
  let controller: BulkUploadController;
  let bulkUploadService: jest.Mocked<BulkUploadService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkUploadController],
      providers: [
        {
          provide: BulkUploadService,
          useValue: {
            processCSV: jest.fn().mockResolvedValue(mockUploadResponse),
            getRecords: jest.fn().mockResolvedValue([]),
            resetDatabase: jest
              .fn()
              .mockResolvedValue({
                message: 'Database has been reset successfully',
              }),
          },
        },
      ],
    })
      .overrideGuard(JwtOrApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BulkUploadController>(BulkUploadController);
    bulkUploadService = module.get(BulkUploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── uploadCSV ────────────────────────────────────────────────────────────────

  describe('uploadCSV()', () => {
    it('should call bulkUploadService.processCSV with file buffer and filename', async () => {
      const mockFile: Express.Multer.File = {
        buffer: Buffer.from('name\nAlice'),
        originalname: 'records.csv',
        fieldname: 'file',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 12,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await controller.uploadCSV(mockFile);

      expect(bulkUploadService.processCSV).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.originalname,
      );
    });

    it('should return the UploadResponseDto from the service', async () => {
      const mockFile: Express.Multer.File = {
        buffer: Buffer.from('data'),
        originalname: 'test.csv',
        fieldname: 'file',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 4,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await controller.uploadCSV(mockFile);

      expect(result).toEqual(mockUploadResponse);
    });

    it('should throw BadRequestException when file is undefined', async () => {
      await expect(controller.uploadCSV(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with "No file provided" message when file is undefined', async () => {
      await expect(controller.uploadCSV(undefined as any)).rejects.toThrow(
        'No file provided',
      );
    });

    it('should propagate errors from bulkUploadService.processCSV', async () => {
      bulkUploadService.processCSV.mockRejectedValue(
        new BadRequestException('No valid records found in the CSV file'),
      );

      const mockFile = {
        buffer: Buffer.from(''),
        originalname: 'bad.csv',
      } as Express.Multer.File;

      await expect(controller.uploadCSV(mockFile)).rejects.toThrow(
        'No valid records found in the CSV file',
      );
    });
  });

  // ── getRecords ───────────────────────────────────────────────────────────────

  describe('getRecords()', () => {
    const defaultQuery = { page: 1, limit: 100 };

    it('should return paginated response with { success, count, total, page, totalPages, records }', async () => {
      const mockRecords = [
        {
          id: '1',
          data: { name: 'Alice' },
          status: 'processed' as const,
          createdAt: '',
        },
        {
          id: '2',
          data: { name: 'Bob' },
          status: 'processed' as const,
          createdAt: '',
        },
      ];
      bulkUploadService.getRecords.mockResolvedValue(mockRecords);

      const result = await controller.getRecords(defaultQuery);

      expect(result).toEqual({
        success: true,
        count: 2,
        total: 2,
        page: 1,
        totalPages: 1,
        records: mockRecords,
      });
    });

    it('should return count 0 and empty records array when no records exist', async () => {
      bulkUploadService.getRecords.mockResolvedValue([]);

      const result = await controller.getRecords(defaultQuery);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.records).toEqual([]);
    });

    it('should call bulkUploadService.getRecords once', async () => {
      await controller.getRecords(defaultQuery);
      expect(bulkUploadService.getRecords).toHaveBeenCalledTimes(1);
    });
  });

  // ── resetDatabase ────────────────────────────────────────────────────────────

  describe('resetDatabase()', () => {
    it('should call bulkUploadService.resetDatabase', async () => {
      await controller.resetDatabase();
      expect(bulkUploadService.resetDatabase).toHaveBeenCalledTimes(1);
    });

    it('should return the message from the service', async () => {
      const result = await controller.resetDatabase();
      expect(result).toEqual({
        message: 'Database has been reset successfully',
      });
    });
  });
});
