import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { removeBackground } from '@/lib/remove-background';
import { makeImage, makeSubjectOnWhite, readPixel } from './helpers';

describe('removeBackground', () => {
  it('clears the background and keeps the subject opaque', async () => {
    const result = await removeBackground(await makeSubjectOnWhite(200, 80));

    expect(result.mime).toBe('image/png');

    const corner = await readPixel(result.buffer, 3, 3);
    const centre = await readPixel(result.buffer, 100, 100);

    expect(corner.a).toBe(0);
    expect(centre.a).toBe(255);
    expect(centre.r).toBeGreaterThan(180);
    expect(centre.g).toBeLessThan(60);
  });

  it('keeps the original dimensions', async () => {
    const result = await removeBackground(await makeSubjectOnWhite(160, 60));
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(160);
    expect(metadata.height).toBe(160);
  });

  it('erases everything when the whole image is one colour', async () => {
    const result = await removeBackground(await makeImage(60, 60, '#123456'));

    expect((await readPixel(result.buffer, 30, 30)).a).toBe(0);
  });

  it('removes nothing at zero tolerance and no feather', async () => {
    const result = await removeBackground(await makeSubjectOnWhite(120, 40), { tolerance: 0, feather: 0 });

    expect((await readPixel(result.buffer, 60, 60)).a).toBe(255);
  });

  it('rejects data that is not an image', async () => {
    await expect(removeBackground(Buffer.from('nope'))).rejects.toThrow();
  });
});
