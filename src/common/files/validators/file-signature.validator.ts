import { FileValidator } from '@nestjs/common/pipes/file/file-validator.interface';

// We must require magic-bytes and explicitly look for the default export for CJS/ESM interop
import * as magicBytesImport from 'magic-bytes.js';
const magicBytes = (magicBytesImport as any).default || magicBytesImport;

export class FileSignatureValidator extends FileValidator {
  constructor() {
    super({});
  }

  buildErrorMessage(): string {
    return 'validation failed (file type does not match file signature)';
  }

  isValid(file: any): boolean {
    if (!file || !file.buffer) return false;

    // Validate file signature using magic numbers
    const fileSignatures = magicBytes(file.buffer).map(
      (entry: any) => entry.mime,
    );

    // Binary file detected → check the actual signature matches the claimed MIME
    if (fileSignatures.length > 0) {
      return fileSignatures.includes(file.mimetype);
    }

    // Text-based file — magic bytes won't help (CSV/TXT have no binary signature).
    // Instead, perform content-based heuristic checks.
    if (file.mimetype === 'text/csv' || file.mimetype === 'text/plain') {
      return this.isLikelyCSV(file.buffer);
    }

    // Unknown type with no signature → reject
    return false;
  }

  /**
   * Heuristic check to verify a buffer is likely a valid CSV file.
   *
   * This replaces the previous "magic bytes" fallback that blindly trusted the
   * client-supplied MIME type. CSV has no binary magic signature, so we inspect
   * the actual content instead:
   *
   *  1. Reject null bytes (binary file disguised as text)
   *  2. Must be valid UTF-8 text
   *  3. Must have at least one line break (header + data)
   *  4. First line (header) should contain comma or tab delimiters
   *  5. Reject suspicious content patterns (scripts, HTML)
   */
  private isLikelyCSV(buffer: Buffer): boolean {
    // 1. Reject null bytes — binary files in disguise
    if (buffer.includes(0x00)) return false;

    // 2. Decode as UTF-8
    const text = buffer.toString('utf-8');

    // 3. Must have at least one line break (header + at least one data row)
    if (!text.includes('\n') && !text.includes('\r')) return false;

    // 4. First line should contain a CSV delimiter (comma or tab)
    const firstLine = text.split(/\r?\n/)[0];
    if (!firstLine.includes(',') && !firstLine.includes('\t')) return false;

    // 5. Reject suspicious content (HTML/scripts/shell)
    const lower = text.slice(0, 1024).toLowerCase();
    if (
      lower.includes('<script') ||
      lower.includes('<!doctype') ||
      lower.includes('<html') ||
      lower.startsWith('#!/')
    ) {
      return false;
    }

    return true;
  }
}
