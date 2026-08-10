import { describe, expect, it } from 'vitest';
import { collectFiles, contentDisposition, HttpError, readFormData, readNumber, stripExtension } from '@/lib/http';
import { makeFile } from './helpers';

function formWith(files: File[], key = 'files') {
  const formData = new FormData();
  files.forEach((file) => formData.append(key, file));

  return formData;
}

describe('contentDisposition', () => {
  it('strips quotes and control characters that could break the header', () => {
    const header = contentDisposition('in"jected\r\nX-Evil: 1.png');

    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
    expect(header.match(/filename="([^"]*)"/)?.[1]).not.toContain('"');
  });

  it('keeps the original name in the UTF-8 form', () => {
    expect(contentDisposition('café.png')).toContain(`filename*=UTF-8''${encodeURIComponent('café.png')}`);
  });

  it('drops directory components', () => {
    expect(contentDisposition('../../etc/passwd')).toContain('filename="passwd"');
  });

  it('falls back when nothing usable is left', () => {
    expect(contentDisposition('€€€')).toContain('filename="___"');
    expect(contentDisposition('')).toContain('filename="download"');
  });
});

describe('collectFiles', () => {
  it('returns the uploaded files', () => {
    const files = collectFiles(formWith([makeFile('a.png', 'aa'), makeFile('b.png', 'bb')]));

    expect(files.map((file) => file.name)).toEqual(['a.png', 'b.png']);
  });

  it('ignores empty parts', () => {
    expect(collectFiles(formWith([makeFile('a.png', 'aa'), makeFile('empty.png', '')]))).toHaveLength(1);
  });

  it('rejects an empty upload with 400', () => {
    expect(() => collectFiles(formWith([]))).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('enforces the minimum for tools that need several files', () => {
    try {
      collectFiles(formWith([makeFile('a.pdf', 'x')]), { minimum: 2, label: 'PDF' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toContain('2 PDFs');
    }
  });

  it('rejects too many files with 413', () => {
    const files = Array.from({ length: 5 }, (_, index) => makeFile(`f${index}.png`, 'x'));

    expect(() => collectFiles(formWith(files), { maxFiles: 4 })).toThrowError(
      expect.objectContaining({ status: 413 })
    );
  });

  it('rejects an oversized file with 413 and names it', () => {
    const big = makeFile('huge.png', new Uint8Array(2048));

    try {
      collectFiles(formWith([big]), { maxFileSize: 1024 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as HttpError).status).toBe(413);
      expect((error as HttpError).message).toContain('huge.png');
    }
  });

  it('rejects an oversized batch even when each file fits', () => {
    const files = [makeFile('a', new Uint8Array(600)), makeFile('b', new Uint8Array(600))];

    expect(() => collectFiles(formWith(files), { maxFileSize: 1024, maxTotalSize: 1000 })).toThrowError(
      expect.objectContaining({ status: 413 })
    );
  });
});

describe('readNumber', () => {
  const formData = new FormData();
  formData.set('low', '-5');
  formData.set('high', '999');
  formData.set('junk', 'abc');
  formData.set('ok', '42');

  it('clamps to the allowed range', () => {
    expect(readNumber(formData, 'low', 50, 1, 100)).toBe(1);
    expect(readNumber(formData, 'high', 50, 1, 100)).toBe(100);
  });

  it('falls back for missing or unparsable values', () => {
    expect(readNumber(formData, 'junk', 50, 1, 100)).toBe(50);
    expect(readNumber(formData, 'absent', 50, 1, 100)).toBe(50);
  });

  it('passes valid values through', () => {
    expect(readNumber(formData, 'ok', 50, 1, 100)).toBe(42);
  });
});

describe('readFormData', () => {
  it('turns a malformed body into a 400 rather than a 500', async () => {
    const request = new Request('http://test/api', { method: 'POST', body: 'not-a-form' });

    await expect(readFormData(request)).rejects.toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('stripExtension', () => {
  it('removes only the final extension', () => {
    expect(stripExtension('photo.jpg')).toBe('photo');
    expect(stripExtension('archive.tar.gz')).toBe('archive.tar');
    expect(stripExtension('no-extension')).toBe('no-extension');
  });
});
