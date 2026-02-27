import { createFileTypeRegex } from './file.util';

describe('createFileTypeRegex()', () => {
  it('should return a RegExp that matches text/csv for ["csv"]', () => {
    const regex = createFileTypeRegex(['csv']);
    expect(regex.test('text/csv')).toBe(true);
  });

  it('should return a RegExp that does NOT match image/png for ["csv"]', () => {
    const regex = createFileTypeRegex(['csv']);
    expect(regex.test('image/png')).toBe(false);
  });

  it('should match image/png for ["png"]', () => {
    const regex = createFileTypeRegex(['png']);
    expect(regex.test('image/png')).toBe(true);
  });

  it('should match image/jpeg for ["jpg"]', () => {
    const regex = createFileTypeRegex(['jpg']);
    expect(regex.test('image/jpeg')).toBe(true);
  });

  it('should match both image/png and image/jpeg for ["png", "jpg"]', () => {
    const regex = createFileTypeRegex(['png', 'jpg']);
    expect(regex.test('image/png')).toBe(true);
    expect(regex.test('image/jpeg')).toBe(true);
  });

  it('should NOT match text/csv for ["png", "jpg"]', () => {
    const regex = createFileTypeRegex(['png', 'jpg']);
    expect(regex.test('text/csv')).toBe(false);
  });

  it('should return a RegExp instance', () => {
    const regex = createFileTypeRegex(['csv']);
    expect(regex).toBeInstanceOf(RegExp);
  });

  it('should match application/pdf for ["pdf"]', () => {
    const regex = createFileTypeRegex(['pdf']);
    expect(regex.test('application/pdf')).toBe(true);
  });

  it('should match text/plain for ["txt"]', () => {
    const regex = createFileTypeRegex(['txt']);
    expect(regex.test('text/plain')).toBe(true);
  });
});
