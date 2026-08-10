import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { HttpError } from './http';

/**
 * Where one signature goes. Coordinates are fractions of the page box so the
 * browser can send whatever preview scale it happened to render at.
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
  signaturePng: Buffer;
  placements: SignaturePlacement[];
};

const MAX_PLACEMENTS = 50;

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates the placement list that arrives as JSON from the browser. */
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
      // Clamped rather than rejected: rounding in the browser can land a hair outside.
      x: Math.min(1, Math.max(0, candidate.x)),
      y: Math.min(1, Math.max(0, candidate.y)),
      width: Math.min(1, Math.max(0.01, candidate.width))
    };
  });
}

export async function signPdf({ pdfBytes, signaturePng, placements }: SignPdfOptions) {
  let document: PDFDocument;

  try {
    document = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'could not be read';
    throw new HttpError(422, `The PDF could not be opened. ${reason}`);
  }

  // Normalise whatever the browser drew (or the user uploaded) to a clean alpha PNG.
  const normalized = await sharp(signaturePng, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const image = await document.embedPng(normalized);
  const aspectRatio = image.height / image.width;
  const pages = document.getPages();

  for (const placement of placements) {
    const page = pages[placement.page - 1];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const drawWidth = pageWidth * placement.width;
    const drawHeight = drawWidth * aspectRatio;

    // The browser measures y from the top; PDF user space measures it from the bottom.
    const top = pageHeight * placement.y;
    const y = pageHeight - top - drawHeight;

    page.drawImage(image, {
      x: pageWidth * placement.x,
      y,
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
