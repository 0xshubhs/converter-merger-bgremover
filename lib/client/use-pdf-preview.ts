'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};

type PageImage = {
  url: string;
  width: number;
  height: number;
};

/** pdf.js is ~350 kB, so it is only pulled in when the signing tool actually opens a file. */
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  return pdfjs;
}

/**
 * Renders every page of a PDF to a PNG object URL for on-screen placement.
 * Rendering happens once per file; the URLs are revoked when it changes.
 */
export function usePdfPreview(file: File | null, renderWidth = 900) {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!file) {
      releaseUrls();
      setPages([]);
      setError(null);

      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      let document: PdfDocumentProxy | null = null;

      try {
        const pdfjs = await loadPdfJs();
        const data = new Uint8Array(await file.arrayBuffer());
        document = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocumentProxy;

        const rendered: PageImage[] = [];

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) break;

          const page = await document.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: renderWidth / base.width });

          const canvas = window.document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          const canvasContext = canvas.getContext('2d');
          if (!canvasContext) throw new Error('This browser could not render the PDF preview.');

          await page.render({ canvasContext, viewport }).promise;

          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('The PDF preview could not be created.');

          rendered.push({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
        }

        if (cancelled) {
          rendered.forEach((page) => URL.revokeObjectURL(page.url));

          return;
        }

        releaseUrls();
        urlsRef.current = rendered.map((page) => page.url);
        setPages(rendered);
      } catch (thrown) {
        if (!cancelled) {
          setError(thrown instanceof Error ? thrown.message : 'The PDF could not be opened.');
          setPages([]);
        }
      } finally {
        await document?.destroy().catch(() => undefined);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, releaseUrls, renderWidth]);

  useEffect(() => releaseUrls, [releaseUrls]);

  return { pages, loading, error };
}
