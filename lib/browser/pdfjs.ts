'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type { PDFDocumentProxy, PDFPageProxy };

export type OpenedPdf = {
  document: PDFDocumentProxy;
  /**
   * Tears down the worker. `destroy()` lives on the loading task, not on the
   * document proxy, and never throws out of here so it is safe in a finally.
   */
  close: () => Promise<void>;
};

/** pdf.js is ~350 kB, so it is only fetched when a tool actually opens a PDF. */
export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  return pdfjs;
}

export async function openPdf(data: Uint8Array): Promise<OpenedPdf> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data });

  try {
    const document = await task.promise;

    return {
      document,
      close: async () => {
        try {
          await task.destroy();
        } catch {
          // Cleanup failures must never mask the real result.
        }
      }
    };
  } catch (error) {
    await task.destroy().catch(() => undefined);

    const reason = error instanceof Error ? error.message : 'it could not be read';
    throw new Error(`The PDF could not be opened: ${reason}`);
  }
}

/**
 * Renders a page onto a canvas at the given scale, on an opaque white ground.
 * pdf.js wants the canvas itself; passing only a 2D context is deprecated.
 */
export async function renderPageToCanvas(page: PDFPageProxy, canvas: HTMLCanvasElement, scale: number) {
  const viewport = page.getViewport({ scale });

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('This browser could not provide a 2D canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, viewport }).promise;

  return { width: canvas.width, height: canvas.height };
}
