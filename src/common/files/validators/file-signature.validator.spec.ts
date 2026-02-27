import { FileSignatureValidator } from './file-signature.validator';

describe('FileSignatureValidator', () => {
    let validator: FileSignatureValidator;

    beforeEach(() => {
        validator = new FileSignatureValidator();
    });

    // ── buildErrorMessage ────────────────────────────────────────────────────

    describe('buildErrorMessage()', () => {
        it('should return the expected error message string', () => {
            expect(validator.buildErrorMessage()).toBe(
                'validation failed (file type does not match file signature)',
            );
        });
    });

    // ── isValid — null / undefined / missing buffer ───────────────────────────

    describe('isValid() — invalid inputs', () => {
        it('should return false for null', () => {
            expect(validator.isValid(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(validator.isValid(undefined)).toBe(false);
        });

        it('should return false when file.buffer is missing', () => {
            expect(validator.isValid({ mimetype: 'text/csv' })).toBe(false);
        });

        it('should return false when file.buffer is null', () => {
            expect(validator.isValid({ buffer: null, mimetype: 'text/csv' })).toBe(false);
        });
    });

    // ── isValid — CSV (text, no magic bytes) ─────────────────────────────────

    describe('isValid() — CSV / plaintext files', () => {
        it('should return true for a plain CSV buffer with mimetype text/csv', () => {
            const file = {
                buffer: Buffer.from('name,email\nAlice,alice@test.com'),
                mimetype: 'text/csv',
            };
            expect(validator.isValid(file)).toBe(true);
        });

        it('should return true for a plain CSV buffer with mimetype text/plain', () => {
            const file = {
                buffer: Buffer.from('col1,col2\n1,2'),
                mimetype: 'text/plain',
            };
            expect(validator.isValid(file)).toBe(true);
        });

        it('should return false for a plaintext buffer claiming to be application/pdf', () => {
            const file = {
                buffer: Buffer.from('name,email\nAlice,alice@test.com'),
                mimetype: 'application/pdf',
            };
            expect(validator.isValid(file)).toBe(false);
        });

        it('should return false for a plaintext buffer claiming to be image/png', () => {
            const file = {
                buffer: Buffer.from('some random text'),
                mimetype: 'image/png',
            };
            expect(validator.isValid(file)).toBe(false);
        });

        it('should return false for a plaintext buffer claiming to be application/octet-stream', () => {
            const file = {
                buffer: Buffer.from('some text data'),
                mimetype: 'application/octet-stream',
            };
            expect(validator.isValid(file)).toBe(false);
        });
    });

    // ── isValid — binary PNG file (has magic bytes) ───────────────────────────

    describe('isValid() — binary files with magic bytes', () => {
        // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
        const pngBuffer = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        ]);

        it('should return true for a real PNG buffer with mimetype image/png', () => {
            const file = { buffer: pngBuffer, mimetype: 'image/png' };
            // magic-bytes will detect 'image/png' for PNG magic
            expect(validator.isValid(file)).toBe(true);
        });

        it('should return false for a PNG buffer claiming to be text/csv', () => {
            const file = { buffer: pngBuffer, mimetype: 'text/csv' };
            expect(validator.isValid(file)).toBe(false);
        });

        it('should return false for a PNG buffer claiming to be application/pdf', () => {
            const file = { buffer: pngBuffer, mimetype: 'application/pdf' };
            expect(validator.isValid(file)).toBe(false);
        });
    });
});
