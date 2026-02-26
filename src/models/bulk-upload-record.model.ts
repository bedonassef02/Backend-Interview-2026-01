/**
 * Model for a single record in a bulk upload (e.g. one row from a CSV).
 * Used when persisting or processing bulk uploads via the temp DB.
 */
export interface BulkUploadRecord {
  /** Unique id for this record (e.g. UUID or row index). */
  id: string;
  /** Raw or normalized field values keyed by column/field name. */
  data: Record<string, string | number | boolean | null>;
  /** Optional status for processing (e.g. 'pending' | 'processed' | 'failed'). */
  status?: 'pending' | 'processed' | 'failed';
  /** When this record was added to the bulk upload. */
  createdAt: string; // ISO 8601
  /** Optional error message if status is 'failed'. */
  error?: string;
}
