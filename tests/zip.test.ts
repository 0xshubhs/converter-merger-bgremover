import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createNameDeduper, zipEntries } from '@/lib/zip';

describe('createNameDeduper', () => {
  it('keeps distinct names untouched', () => {
    const next = createNameDeduper();

    expect(next('a.png')).toBe('a.png');
    expect(next('b.png')).toBe('b.png');
  });

  it('suffixes duplicates before the extension', () => {
    const next = createNameDeduper();

    expect(next('photo.jpg')).toBe('photo.jpg');
    expect(next('photo.jpg')).toBe('photo-2.jpg');
    expect(next('photo.jpg')).toBe('photo-3.jpg');
  });

  it('does not collide when a suffixed name is also uploaded', () => {
    const next = createNameDeduper();
    const names = [next('photo.jpg'), next('photo-2.jpg'), next('photo.jpg')];

    expect(new Set(names).size).toBe(3);
  });

  it('handles names without an extension', () => {
    const next = createNameDeduper();

    expect(next('README')).toBe('README');
    expect(next('README')).toBe('README-2');
  });

  it('strips directory components and leading dots', () => {
    const next = createNameDeduper();

    expect(next('../../evil.png')).toBe('evil.png');
    expect(next('nested/dir/file.txt')).toBe('file.txt');
    expect(next('.hidden')).toBe('hidden');
  });
});

describe('zipEntries', () => {
  it('round-trips file contents', async () => {
    const archive = await zipEntries([
      { name: 'hello.txt', data: new TextEncoder().encode('hello') },
      { name: 'bytes.bin', data: new Uint8Array([1, 2, 3, 4]) }
    ]);

    const reopened = await JSZip.loadAsync(archive);

    expect(Object.keys(reopened.files).sort()).toEqual(['bytes.bin', 'hello.txt']);
    expect(await reopened.file('hello.txt')?.async('string')).toBe('hello');
  });

  it('stores without deflating when asked', async () => {
    const payload = new Uint8Array(4096).fill(7);
    const stored = await zipEntries([{ name: 'a.bin', data: payload }], { store: true });
    const deflated = await zipEntries([{ name: 'a.bin', data: payload }], { store: false });

    // Highly repetitive data compresses hard, so STORE must come out clearly larger.
    expect(stored.byteLength).toBeGreaterThan(deflated.byteLength);
  });
});
