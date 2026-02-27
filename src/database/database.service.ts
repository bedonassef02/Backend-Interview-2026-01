import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BulkUploadRecord } from '../models/bulk-upload-record.model';
import { DatabaseSchema } from './interfaces/database-schema.interface';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly dbPath = path.join(
    process.cwd(),
    'data',
    'bulk-upload-temp.json',
  );

  async onModuleInit() {
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.dbPath);
    } catch {
      await this.resetDatabase();
    }
  }

  async read(): Promise<DatabaseSchema> {
    const raw = await fs.readFile(this.dbPath, 'utf-8');
    return JSON.parse(raw);
  }

  async write(data: DatabaseSchema): Promise<void> {
    data.metadata.updatedAt = new Date().toISOString();
    if (!data.metadata.createdAt) {
      data.metadata.createdAt = data.metadata.updatedAt;
    }
    await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async bulkInsert(
    records: BulkUploadRecord[],
  ): Promise<{ inserted: number; total: number }> {
    const db = await this.read();
    db.records.push(...records);
    await this.write(db);
    this.logger.log(
      `Bulk inserted ${records.length} records. Total: ${db.records.length}`,
    );
    return { inserted: records.length, total: db.records.length };
  }

  async getAllRecords(): Promise<BulkUploadRecord[]> {
    const db = await this.read();
    return db.records;
  }

  async getRecordCount(): Promise<number> {
    const db = await this.read();
    return db.records.length;
  }

  async resetDatabase(): Promise<void> {
    const emptyDb: DatabaseSchema = {
      records: [],
      metadata: {
        createdAt: null,
        updatedAt: null,
        description: 'Temporary store for bulk upload records',
      },
    };
    await this.write(emptyDb);
    this.logger.log('Database reset');
  }
}
