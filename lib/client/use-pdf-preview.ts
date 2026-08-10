'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { openPdf, renderPageToCanvas, type OpenedPdf } from '@/lib/browser/pdfjs';

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
      let opened: OpenedPdf | null = null;

      try {
        opened = await openPdf(new Uint8Array(await file.arrayBuffer()));

        const rendered: PageImage[] = [];

        for (let pageNumber = 1; pageNumber <= opened.document.numPages; pageNumber += 1) {
          if (cancelled) break;

          const page = await opened.document.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });

          const canvas = window.document.createElement('canvas');
          const { width, height } = await renderPageToCanvas(page, canvas, renderWidth / base.width);

          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('The PDF preview could not be created.');

          rendered.push({ url: URL.createObjectURL(blob), width, height });
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
        await opened?.close();
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
