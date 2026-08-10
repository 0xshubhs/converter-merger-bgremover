import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { convertImage } from '@/lib/convert-image';
import { makeImage } from './helpers';

describe('convertImage', () => {
  it('encodes to each requested format', async () => {
    const source = await makeImage(120, 90);
    // AVIF lives in the HEIF container, which is how Sharp reports it back.
    const detected: Record<string, string> = { avif: 'heif' };

    for (const format of ['jpeg', 'png', 'webp', 'avif', 'tiff'] as const) {
      const result = await convertImage(source, { format, quality: 80 });
      const metadata = await sharp(result.buffer).metadata();

      expect(metadata.format).toBe(detected[format] ?? format);
      expect(result.mime).toBe(`image/${format}`);
    }
  });

  it('maps the jpg alias and reports the .jpg extension', async () => {
    const result = await convertImage(await makeImage(40, 40), { format: 'jpg', quality: 70 });

    expect(result.extension).toBe('jpg');
    expect((await sharp(result.buffer).metadata()).format).toBe('jpeg');
  });

  it('preserves dimensions for images under the cap', async () => {
    const result = await convertImage(await makeImage(320, 240), { format: 'webp', quality: 80 });
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
  });

  it('scales down images beyond the dimension cap while keeping aspect ratio', async () => {
    const result = await convertImage(await makeImage(800, 400), { format: 'jpeg', quality: 80, maxDimension: 200 });
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it('produces a smaller file at lower quality', async () => {
    const source = await makeImage(400, 400, '#8844cc', 'jpeg');
    const high = await convertImage(source, { format: 'jpeg', quality: 95 });
    const low = await convertImage(source, { format: 'jpeg', quality: 40 });

    expect(low.buffer.byteLength).toBeLessThan(high.buffer.byteLength);
  });

  it('clamps out-of-range quality instead of failing', async () => {
    const source = await makeImage(40, 40);

    await expect(convertImage(source, { format: 'jpeg', quality: 0 })).resolves.toBeTruthy();
    await expect(convertImage(source, { format: 'jpeg', quality: 500 })).resolves.toBeTruthy();
  });

  it('rejects data that is not an image', async () => {
    await expect(convertImage(Buffer.from('definitely not an image'), { format: 'png', quality: 80 })).rejects.toThrow();
  });
});
