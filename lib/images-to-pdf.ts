import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { mapWithConcurrency } from './concurrency';
import { decodeHeicIfNeeded } from './decode-heic';
import { MAX_PDF_IMAGE_DIMENSION } from './limits';

export const pdfPageSizes = {
  fit: null,
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008]
} as const satisfies Record<string, readonly [number, number] | null>;

export type PdfPageSize = keyof typeof pdfPageSizes;
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

/** Browsers and phone cameras describe images in CSS pixels; PDF works in points. */
const PIXELS_TO_POINTS = 72 / 96;

export type ImageToPdfOptions = {
  pageSize?: string;
  orientation?: string;
  margin?: number;
  quality?: number;
};

export type ImageToPdfInput = {
  name: string;
  type?: string;
  buffer: Buffer;
};

export function normalizePageSize(value: string | undefined): PdfPageSize {
  return value && value in pdfPageSizes ? (value as PdfPageSize) : 'a4';
}

export function normalizeOrientation(value: string | undefined): PdfOrientation {
  return value === 'portrait' || value === 'landscape' ? value : 'auto';
}

/**
 * Rasterises each image onto its own page. Images are flattened onto white and
 * re-encoded as JPEG, which keeps the PDF small and sidesteps the alpha and
 * colour-space cases `embedPng` is fussy about.
 */
export async function imagesToPdf(inputs: ImageToPdfInput[], options: ImageToPdfOptions = {}) {
  const pageSize = normalizePageSize(options.pageSize);
  const orientation = normalizeOrientation(options.orientation);
  const margin = Math.max(0, Math.min(200, options.margin ?? 24));
  const quality = Math.max(30, Math.min(100, Math.round(options.quality ?? 85)));

  const failures: string[] = [];

  const encoded = await mapWithConcurrency(inputs, async (input) => {
    const decoded = await decodeHeicIfNeeded(input.buffer, input.name, input.type);

    return sharp(decoded, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_PDF_IMAGE_DIMENSION,
        height: MAX_PDF_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  });

  const document = await PDFDocument.create();

  for (const [index, result] of encoded.entries()) {
    const name = inputs[index].name;

    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : 'could not be read';
      failures.push(`${name}: ${reason}`);
      continue;
    }

    const image = await document.embedJpg(result.value);
    const imageWidth = image.width * PIXELS_TO_POINTS;
    const imageHeight = image.height * PIXELS_TO_POINTS;

    let pageWidth: number;
    let pageHeight: number;

    if (pageSize === 'fit') {
      pageWidth = imageWidth + margin * 2;
      pageHeight = imageHeight + margin * 2;

      if (orientation === 'portrait' && pageWidth > pageHeight) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      } else if (orientation === 'landscape' && pageHeight > pageWidth) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }
    } else {
      const [shortEdge, longEdge] = pdfPageSizes[pageSize];
      const landscape = orientation === 'landscape' || (orientation === 'auto' && imageWidth > imageHeight);

      pageWidth = landscape ? longEdge : shortEdge;
      pageHeight = landscape ? shortEdge : longEdge;
    }

    const availableWidth = Math.max(1, pageWidth - margin * 2);
    const availableHeight = Math.max(1, pageHeight - margin * 2);
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight, 1);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;

    const page = document.addPage([pageWidth, pageHeight]);

    page.drawImage(image, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
  }

  if (document.getPageCount() === 0) {
    throw new Error(failures.join('\n') || 'None of the selected images could be added to a PDF.');
  }

  return {
    bytes: await document.save(),
    mime: 'application/pdf',
    extension: 'pdf',
    pageCount: document.getPageCount(),
    failures
  };
}
