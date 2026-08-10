import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { imagesToPdf, normalizeOrientation, normalizePageSize } from '@/lib/images-to-pdf';
import { makeImage } from './helpers';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;

async function pagesOf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);

  return document.getPages().map((page) => ({ width: page.getWidth(), height: page.getHeight() }));
}

describe('option normalisation', () => {
  it('defaults unknown page sizes to A4', () => {
    expect(normalizePageSize('tabloid')).toBe('a4');
    expect(normalizePageSize(undefined)).toBe('a4');
    expect(normalizePageSize('letter')).toBe('letter');
  });

  it('defaults unknown orientations to auto', () => {
    expect(normalizeOrientation('sideways')).toBe('auto');
    expect(normalizeOrientation('landscape')).toBe('landscape');
  });
});

describe('imagesToPdf', () => {
  it('creates one page per image', async () => {
    const result = await imagesToPdf([
      { name: 'a.png', buffer: await makeImage(200, 100) },
      { name: 'b.png', buffer: await makeImage(100, 200) },
      { name: 'c.png', buffer: await makeImage(150, 150) }
    ]);

    expect(result.pageCount).toBe(3);
    expect(result.failures).toEqual([]);
  });

  it('orients A4 pages to match each image when set to auto', async () => {
    const result = await imagesToPdf(
      [
        { name: 'wide.png', buffer: await makeImage(800, 600) },
        { name: 'tall.png', buffer: await makeImage(600, 800) }
      ],
      { pageSize: 'a4', orientation: 'auto' }
    );

    const [wide, tall] = await pagesOf(result.bytes);

    expect(wide.width).toBeCloseTo(A4_LONG, 1);
    expect(wide.height).toBeCloseTo(A4_SHORT, 1);
    expect(tall.width).toBeCloseTo(A4_SHORT, 1);
    expect(tall.height).toBeCloseTo(A4_LONG, 1);
  });

  it('forces the requested orientation over the image aspect', async () => {
    const result = await imagesToPdf([{ name: 'wide.png', buffer: await makeImage(800, 600) }], {
      pageSize: 'a4',
      orientation: 'portrait'
    });

    const [page] = await pagesOf(result.bytes);

    expect(page.height).toBeGreaterThan(page.width);
  });

  it('sizes the page to the image when fitting, converting pixels to points', async () => {
    const result = await imagesToPdf([{ name: 'wide.png', buffer: await makeImage(800, 600) }], {
      pageSize: 'fit',
      margin: 0
    });

    const [page] = await pagesOf(result.bytes);

    expect(page.width).toBeCloseTo(600, 1);
    expect(page.height).toBeCloseTo(450, 1);
  });

  it('adds the margin to both edges when fitting', async () => {
    const result = await imagesToPdf([{ name: 'wide.png', buffer: await makeImage(800, 600) }], {
      pageSize: 'fit',
      margin: 20
    });

    const [page] = await pagesOf(result.bytes);

    expect(page.width).toBeCloseTo(640, 1);
    expect(page.height).toBeCloseTo(490, 1);
  });

  it('skips unreadable images but still returns a PDF of the rest', async () => {
    const result = await imagesToPdf([
      { name: 'good.png', buffer: await makeImage(100, 100) },
      { name: 'broken.png', buffer: Buffer.from('not an image') }
    ]);

    expect(result.pageCount).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('broken.png');
  });

  it('throws when no image could be used', async () => {
    await expect(imagesToPdf([{ name: 'broken.png', buffer: Buffer.from('nope') }])).rejects.toThrow();
  });

  it('shrinks the PDF at lower image quality', async () => {
    const image = await makeImage(600, 600, '#227766', 'jpeg');
    const high = await imagesToPdf([{ name: 'a.jpg', buffer: image }], { quality: 100 });
    const low = await imagesToPdf([{ name: 'a.jpg', buffer: image }], { quality: 40 });

    expect(low.bytes.byteLength).toBeLessThan(high.bytes.byteLength);
  });
});
