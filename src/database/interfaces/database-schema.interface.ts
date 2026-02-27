import { BulkUploadRecord } from '../../models/bulk-upload-record.model';

export interface DatabaseSchema {
  records: BulkUploadRecord[];
  metadata: {
    createdAt: string | null;
    updatedAt: string | null;
    description: string;
  };
}
