'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { openPdf, type PdfDocumentProxy } from '@/lib/browser/pdfjs';

type PageImage = {
  url: string;
  width: number;
  height: number;
};

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
        document = await openPdf(new Uint8Array(await file.arrayBuffer()));

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
