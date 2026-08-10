import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { parsePlacements, signPdf } from '@/lib/sign-pdf';

/**
 * Decodes a page's content stream so the drawing operators can be asserted on.
 * Contents is an array of (usually Flate-compressed) stream references.
 */
async function contentStream(bytes: Uint8Array, pageIndex = 0) {
  const document = await PDFDocument.load(bytes);
  const contents = document.getPage(pageIndex).node.Contents();
  const items =
    contents && typeof (contents as { asArray?: () => unknown[] }).asArray === 'function'
      ? (contents as { asArray: () => unknown[] }).asArray()
      : [contents];

  return items
    .map((item) => {
      const stream = document.context.lookup(item as never) as { getContents?: () => Uint8Array };
      if (!stream?.getContents) return '';

      const raw = Buffer.from(stream.getContents());

      try {
        return inflateSync(raw).toString('latin1');
      } catch {
        return raw.toString('latin1');
      }
    })
    .join('\n');
}

/** The y translation pdf-lib emits for a drawn image. */
function translationY(stream: string) {
  const match = stream.match(/1 0 0 1 [\d.-]+ ([\d.-]+) cm/);

  return match ? Number(match[1]) : null;
}

async function makePdf(pageCount = 2, width = 400, height = 600) {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([width, height]);
  }

  return document.save();
}

/** A wide, short signature so aspect-ratio handling is observable. */
function makeSignature(width = 300, height = 100) {
  return sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite([
      {
        input: Buffer.from(`<svg width="${width}" height="${height}"><rect x="10" y="30" width="${width - 20}" height="20" fill="#0f172a"/></svg>`),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();
}

describe('parsePlacements', () => {
  it('accepts a well-formed list', () => {
    const placements = parsePlacements('[{"page":1,"x":0.1,"y":0.2,"width":0.3}]', 3);

    expect(placements).toEqual([{ page: 1, x: 0.1, y: 0.2, width: 0.3 }]);
  });

  it('clamps fractions that land just outside the page', () => {
    const [placement] = parsePlacements('[{"page":1,"x":-0.2,"y":1.4,"width":9}]', 1);

    expect(placement.x).toBe(0);
    expect(placement.y).toBe(1);
    expect(placement.width).toBe(1);
  });

  it('rejects malformed JSON', () => {
    expect(() => parsePlacements('not json', 1)).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('rejects an empty list', () => {
    expect(() => parsePlacements('[]', 1)).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('rejects a page outside the document', () => {
    expect(() => parsePlacements('[{"page":7,"x":0,"y":0,"width":0.2}]', 3)).toThrowError(
      expect.objectContaining({ status: 400 })
    );
    expect(() => parsePlacements('[{"page":0,"x":0,"y":0,"width":0.2}]', 3)).toThrowError(
      expect.objectContaining({ status: 400 })
    );
  });

  it('rejects entries missing coordinates', () => {
    expect(() => parsePlacements('[{"page":1,"x":0.5}]', 1)).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('refuses an absurd number of placements', () => {
    const many = JSON.stringify(Array.from({ length: 51 }, () => ({ page: 1, x: 0, y: 0, width: 0.1 })));

    expect(() => parsePlacements(many, 1)).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('signPdf', () => {
  it('keeps the page count and reports how many signatures were applied', async () => {
    const result = await signPdf({
      pdfBytes: await makePdf(3),
      signaturePng: await makeSignature(),
      placements: [
        { page: 1, x: 0.1, y: 0.8, width: 0.3 },
        { page: 3, x: 0.5, y: 0.1, width: 0.2 }
      ]
    });

    expect(result.pageCount).toBe(3);
    expect(result.signatureCount).toBe(2);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(3);
  });

  it('grows the output because page content was added', async () => {
    const original = await makePdf(1);
    const result = await signPdf({
      pdfBytes: original,
      signaturePng: await makeSignature(),
      placements: [{ page: 1, x: 0.2, y: 0.5, width: 0.4 }]
    });

    expect(result.bytes.byteLength).toBeGreaterThan(original.byteLength);
  });

  it('converts top-down browser coordinates into PDF user space', async () => {
    // y = 0 means the top of the page, so the drawn image must sit near the top.
    const pdfBytes = await makePdf(1, 400, 600);
    const signaturePng = await makeSignature(300, 100);

    const top = await signPdf({ pdfBytes, signaturePng, placements: [{ page: 1, x: 0, y: 0, width: 0.5 }] });
    const bottom = await signPdf({ pdfBytes, signaturePng, placements: [{ page: 1, x: 0, y: 0.9, width: 0.5 }] });

    const topY = translationY(await contentStream(top.bytes));
    const bottomY = translationY(await contentStream(bottom.bytes));

    expect(topY).not.toBeNull();
    expect(bottomY).not.toBeNull();
    expect(topY as number).toBeGreaterThan(bottomY as number);
    // width 0.5 of 400pt = 200pt wide, aspect 1/3 => ~66.7pt tall, anchored at the top edge.
    expect(topY as number).toBeCloseTo(600 - 200 / 3, 0);
  });

  it('rejects a file that is not a PDF with 422', async () => {
    await expect(
      signPdf({
        pdfBytes: new TextEncoder().encode('hello'),
        signaturePng: await makeSignature(),
        placements: [{ page: 1, x: 0, y: 0, width: 0.2 }]
      })
    ).rejects.toThrowError(expect.objectContaining({ status: 422 }));
  });

  it('rejects a signature that is not an image', async () => {
    await expect(
      signPdf({
        pdfBytes: await makePdf(1),
        signaturePng: Buffer.from('not an image'),
        placements: [{ page: 1, x: 0, y: 0, width: 0.2 }]
      })
    ).rejects.toThrow();
  });
});
