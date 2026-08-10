import type { PDFDocument as PDFDocumentInstance } from 'pdf-lib';
import { HttpError } from './errors';

/**
 * Where one signature goes. Coordinates are fractions of the page box so the
 * caller can work at whatever preview scale it happened to render at.
 * `x`/`y` are the top-left corner in screen orientation (y grows downward).
 */
export type SignaturePlacement = {
  page: number;
  x: number;
  y: number;
  width: number;
};

export type SignPdfOptions = {
  pdfBytes: Uint8Array;
  /** PNG bytes. The signature pad always produces one, in every input mode. */
  signaturePng: Uint8Array;
  placements: SignaturePlacement[];
};

const MAX_PLACEMENTS = 50;

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates a placement list, whether it came from JSON or straight from the UI. */
export function parsePlacements(raw: string | null, pageCount: number): SignaturePlacement[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw ?? '');
  } catch {
    throw new HttpError(400, 'Signature placement data was not valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpError(400, 'Place the signature on at least one page.');
  }

  if (parsed.length > MAX_PLACEMENTS) {
    throw new HttpError(400, `A signature can be placed at most ${MAX_PLACEMENTS} times.`);
  }

  return parsed.map((entry, index) => {
    const candidate = entry as Partial<SignaturePlacement>;

    if (!isFraction(candidate.page) || !isFraction(candidate.x) || !isFraction(candidate.y) || !isFraction(candidate.width)) {
      throw new HttpError(400, `Placement ${index + 1} is missing page, x, y, or width.`);
    }

    const page = Math.round(candidate.page);

    if (page < 1 || page > pageCount) {
      throw new HttpError(400, `Placement ${index + 1} points at page ${page}, which is outside this ${pageCount}-page document.`);
    }

    return {
      page,
      // Clamped rather than rejected: rounding in the UI can land a hair outside.
      x: Math.min(1, Math.max(0, candidate.x)),
      y: Math.min(1, Math.max(0, candidate.y)),
      width: Math.min(1, Math.max(0.01, candidate.width))
    };
  });
}

export async function signPdf({ pdfBytes, signaturePng, placements }: SignPdfOptions) {
  const { PDFDocument } = await import('pdf-lib');
  let document: PDFDocumentInstance;

  try {
    document = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'could not be read';
    throw new HttpError(422, `The PDF could not be opened. ${reason}`);
  }

  let image;

  try {
    image = await document.embedPng(signaturePng);
  } catch {
    throw new HttpError(422, 'The signature image could not be read.');
  }

  const aspectRatio = image.height / image.width;
  const pages = document.getPages();

  for (const placement of placements) {
    const page = pages[placement.page - 1];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const drawWidth = pageWidth * placement.width;
    const drawHeight = drawWidth * aspectRatio;

    // The UI measures y from the top; PDF user space measures it from the bottom.
    const top = pageHeight * placement.y;

    page.drawImage(image, {
      x: pageWidth * placement.x,
      y: pageHeight - top - drawHeight,
      width: drawWidth,
      height: drawHeight
    });
  }

  return {
    bytes: await document.save(),
    mime: 'application/pdf',
    extension: 'pdf',
    pageCount: pages.length,
    signatureCount: placements.length
  };
}
