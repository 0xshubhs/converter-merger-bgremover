export const pdfPageSizes = {
  fit: null,
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008]
} as const satisfies Record<string, readonly [number, number] | null>;

export type PdfPageSize = keyof typeof pdfPageSizes;
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

/** Browsers and cameras describe images in CSS pixels; PDF works in points. */
export const PIXELS_TO_POINTS = 72 / 96;

export type PageLayoutOptions = {
  pageSize?: string;
  orientation?: string;
  margin?: number;
};

export type PageLayout = {
  pageWidth: number;
  pageHeight: number;
  /** Draw box in PDF user space, where y grows upward from the bottom edge. */
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
};

export function normalizePageSize(value: string | undefined): PdfPageSize {
  return value && value in pdfPageSizes ? (value as PdfPageSize) : 'a4';
}

export function normalizeOrientation(value: string | undefined): PdfOrientation {
  return value === 'portrait' || value === 'landscape' ? value : 'auto';
}

export function normalizeMargin(value: number | undefined) {
  return Math.max(0, Math.min(200, value ?? 24));
}

/**
 * Works out the page box and where the image sits on it. Pure arithmetic, so the
 * geometry is identical whether the image was decoded by Sharp or by a canvas.
 */
export function planImagePage(
  imageWidthPx: number,
  imageHeightPx: number,
  options: PageLayoutOptions = {}
): PageLayout {
  const pageSize = normalizePageSize(options.pageSize);
  const orientation = normalizeOrientation(options.orientation);
  const margin = normalizeMargin(options.margin);

  const imageWidth = imageWidthPx * PIXELS_TO_POINTS;
  const imageHeight = imageHeightPx * PIXELS_TO_POINTS;

  let pageWidth: number;
  let pageHeight: number;

  if (pageSize === 'fit') {
    pageWidth = imageWidth + margin * 2;
    pageHeight = imageHeight + margin * 2;

    const shouldSwap =
      (orientation === 'portrait' && pageWidth > pageHeight) ||
      (orientation === 'landscape' && pageHeight > pageWidth);

    if (shouldSwap) {
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

  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    drawWidth,
    drawHeight
  };
}
