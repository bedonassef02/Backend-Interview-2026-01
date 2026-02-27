import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BulkUploadRecord } from '../models/bulk-upload-record.model';
import { UploadResponseDto } from './dto/upload-response.dto';
import * as csvParserImport from 'csv-parser';
const csvParser = (csvParserImport as any).default || csvParserImport;
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async processCSV(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<UploadResponseDto> {
    const startTime = Date.now();

    this.logger.log(
      `Processing CSV file: ${filename} (${fileBuffer.length} bytes)`,
    );

    const records: BulkUploadRecord[] = [];
    const errors: string[] = [];
    let rowIndex = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null); // End of stream

        const MAX_RECORDS = 10000;

        stream
          .pipe(csvParser())
          .on('data', (row: Record<string, string>) => {
            if (records.length >= MAX_RECORDS) return; // Stop pushing after limit

            rowIndex++;
            try {
              // Skip empty rows
              const hasData = Object.values(row).some(
                (v) => v && v.trim() !== '',
              );
              if (!hasData) {
                errors.push(`Row ${rowIndex}: empty row skipped`);
                return;
              }

              const record: BulkUploadRecord = {
                id: uuidv4(),
                data: this.normalizeRow(row),
                status: 'processed',
                createdAt: new Date().toISOString(),
              };
              records.push(record);

              if (records.length === MAX_RECORDS) {
                errors.push(
                  `Warning: Upload truncated. Maximum limit of ${MAX_RECORDS} records reached.`,
                );
              }
            } catch (err: any) {
              errors.push(`Row ${rowIndex}: ${err.message}`);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse CSV: ${err.message}`);
    }

    if (records.length === 0 && errors.length === 0) {
      throw new BadRequestException('No valid records found in the CSV file');
    }

    let inserted = 0;
    let total = 0;

    if (records.length > 0) {
      const result = await this.databaseService.bulkInsert(records);
      inserted = result.inserted;
      total = result.total;
    } else {
      total = await this.databaseService.getRecordCount();
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Processed ${records.length} records in ${processingTime}ms`,
    );

    return {
      success: true,
      message: `Successfully uploaded ${records.length} records from ${filename}`,
      recordsInserted: inserted,
      recordsFailed: errors.length,
      totalRecordsInDb: total,
      processingTime: `${processingTime}ms`,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private normalizeRow(
    row: Record<string, string>,
  ): Record<string, string | number | boolean | null> {
    const normalized: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(row)) {
      const trimKey = key.trim();
      const trimVal = value?.trim();

      if (!trimVal || trimVal === '') {
        normalized[trimKey] = null;
      } else if (trimVal.toLowerCase() === 'true') {
        normalized[trimKey] = true;
      } else if (trimVal.toLowerCase() === 'false') {
        normalized[trimKey] = false;
      } else if (!isNaN(Number(trimVal)) && trimVal !== '') {
        normalized[trimKey] = Number(trimVal);
      } else {
        normalized[trimKey] = trimVal;
      }
    }
    return normalized;
  }

  async getRecords(): Promise<BulkUploadRecord[]> {
    return this.databaseService.getAllRecords();
  }

  async resetDatabase(): Promise<{ message: string }> {
    await this.databaseService.resetDatabase();
    return { message: 'Database has been reset successfully' };
  }
}
