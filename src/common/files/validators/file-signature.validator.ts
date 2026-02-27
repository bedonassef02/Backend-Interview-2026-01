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
    // Note: magicBytes returns an array empty for plaintext formats like CSV
    const fileSignatures = magicBytes(file.buffer).map(
      (entry: any) => entry.mime,
    );

    // For purely text-based formats like CSV which do not have a binary magic number:
    if (fileSignatures.length === 0) {
      // Allow execution to pass if the claimed type is text/csv
      // The FileTypeValidator already enforces that only 'text/csv' can get this far
      if (file.mimetype === 'text/csv' || file.mimetype === 'text/plain') {
        return true;
      }
      return false;
    }

    // Normal binary validation (e.g., png, jpg, pdf)
    return fileSignatures.includes(file.mimetype);
  }
}
