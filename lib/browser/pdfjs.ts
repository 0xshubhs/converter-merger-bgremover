'use client';

export type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};

export type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};

/** pdf.js is ~350 kB, so it is only fetched when a tool actually opens a PDF. */
export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  return pdfjs;
}

export async function openPdf(data: Uint8Array): Promise<PdfDocumentProxy> {
  const pdfjs = await loadPdfJs();

  return (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocumentProxy;
}
