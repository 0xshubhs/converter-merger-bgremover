import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { mergePdfs } from '@/lib/merge-pdf';

async function makePdf(pageCount: number, width = 200, height = 300) {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([width, height]);
  }

  return document.save();
}

describe('mergePdfs', () => {
  it('concatenates every page in order', async () => {
    const result = await mergePdfs([
      { name: 'two.pdf', bytes: await makePdf(2, 200, 300) },
      { name: 'one.pdf', bytes: await makePdf(1, 400, 500) }
    ]);

    expect(result.pageCount).toBe(3);

    const merged = await PDFDocument.load(result.bytes);
    const sizes = merged.getPages().map((page) => [page.getWidth(), page.getHeight()]);

    expect(sizes).toEqual([
      [200, 300],
      [200, 300],
      [400, 500]
    ]);
  });

  it('reports which file failed and marks it unprocessable', async () => {
    try {
      await mergePdfs([
        { name: 'good.pdf', bytes: await makePdf(1) },
        { name: 'not-a.pdf', bytes: new TextEncoder().encode('hello') }
      ]);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { status?: number }).status).toBe(422);
      expect((error as Error).message).toContain('not-a.pdf');
    }
  });

  // pdf-lib materialises a blank page when reloading a page-less document, so the
  // empty case cannot be produced this way. The guard in mergePdfs stays as defence.
  it('treats a page-less source as a single blank page', async () => {
    const result = await mergePdfs([{ name: 'empty.pdf', bytes: await makePdf(0) }]);

    expect(result.pageCount).toBe(1);
  });
});
