'use client';

import {
  canRecompressImage,
  detectType,
  imageMaxDimension,
  pdfRenderScale,
  type ResolutionPreset
} from '@/lib/compression-presets';
import { MAX_PDF_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION } from '@/lib/limits';
import { mergePdfs } from '@/lib/merge-pdf';
import { planImagePage } from '@/lib/pdf-page-layout';
import { removeBackgroundPixels } from '@/lib/remove-background-pixels';
import { signPdf, type SignaturePlacement } from '@/lib/sign-pdf';
import { createNameDeduper, zipEntries } from '@/lib/zip';
import { canvasToBlob, decodeImageFile, drawToCanvas, flattenOntoWhite } from './canvas';
import { openPdf } from './pdfjs';

export type ToolResult = {
  blob: Blob;
  filename: string;
  warning: string | null;
  /** Set when the result replaces an input, so savings can be shown. */
  originalSize?: number;
  note?: string | null;
};

/** Reports how far through a multi-file job we are, for the progress bar. */
export type ProgressReporter = (done: number, total: number, label: string) => void;

const noop: ProgressReporter = () => undefined;

/** Yields to the event loop so progress actually paints between files. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function pdfBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)], {
    type: 'application/pdf'
  });
}

export type CompressionSettings = {
  quality: number;
  resolution: ResolutionPreset;
};

/** Re-encodes an image at a lower quality and/or size, keeping its format. */
async function compressImage(file: File, type: string, settings: CompressionSettings): Promise<ToolResult> {
  const decoded = await decodeImageFile(file);

  try {
    const { canvas, width, height } = drawToCanvas(decoded, imageMaxDimension(settings.resolution));
    // PNG has no quality parameter; its only saving comes from the resize above.
    const blob = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : settings.quality / 100);

    const shrank = blob.size < file.size;

    return {
      blob: shrank ? blob : file,
      filename: file.name,
      warning: null,
      originalSize: file.size,
      note: shrank
        ? width < decoded.width
          ? `Resized to ${width}×${height}`
          : null
        : 'Already smaller than the re-encoded version, so the original was kept'
    };
  } finally {
    decoded.release();
  }
}

/**
 * Rasterises each page and rebuilds the document from JPEGs. This is what makes
 * scanned PDFs collapse in size; the cost is that text stops being selectable.
 */
async function compressPdf(
  file: File,
  settings: CompressionSettings,
  onProgress: ProgressReporter,
  fileLabel: string
): Promise<ToolResult> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await openPdf(new Uint8Array(await file.arrayBuffer()));
  const output = await PDFDocument.create();
  const scale = pdfRenderScale(settings.resolution);
  const canvas = document.createElement('canvas');

  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      onProgress(pageNumber - 1, source.numPages, `${fileLabel} — page ${pageNumber} of ${source.numPages}`);
      await tick();

      const page = await source.getPage(pageNumber);
      const pageBox = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) throw new Error('This browser could not provide a 2D canvas.');

      canvasContext.fillStyle = '#ffffff';
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext, viewport }).promise;

      const jpeg = await canvasToBlob(canvas, 'image/jpeg', settings.quality / 100);
      const image = await output.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));

      // Keep the original page dimensions so the document prints the same.
      output.addPage([pageBox.width, pageBox.height]).drawImage(image, {
        x: 0,
        y: 0,
        width: pageBox.width,
        height: pageBox.height
      });
    }

    const bytes = await output.save();
    const blob = pdfBlob(bytes);
    const shrank = blob.size < file.size;

    return {
      blob: shrank ? blob : file,
      filename: file.name,
      warning: null,
      originalSize: file.size,
      note: shrank
        ? 'Pages were rasterised, so text is no longer selectable'
        : 'Recompressing made it larger, so the original was kept'
    };
  } finally {
    await source.destroy().catch(() => undefined);
    // Release the backing store rather than waiting for GC.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Compresses each file in place, returning one result per input in the same
 * format it arrived as. Files the browser cannot re-encode are passed through
 * untouched with an explanation rather than being silently archived.
 */
export async function compressFilesInBrowser(
  files: File[],
  settings: CompressionSettings,
  onProgress: ProgressReporter = noop
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    onProgress(index, files.length, file.name);
    await tick();

    const type = detectType(file.name, file.type);

    try {
      if (type === 'application/pdf') {
        results.push(await compressPdf(file, settings, onProgress, file.name));
      } else if (canRecompressImage(type)) {
        results.push(await compressImage(file, type, settings));
      } else {
        results.push({
          blob: file,
          filename: file.name,
          warning: null,
          originalSize: file.size,
          note: `${type || 'This file type'} cannot be compressed in place — the original is unchanged`
        });
      }
    } catch (error) {
      results.push({
        blob: file,
        filename: file.name,
        warning: null,
        originalSize: file.size,
        note: error instanceof Error ? `Could not compress: ${error.message}` : 'Could not compress this file'
      });
    }
  }

  onProgress(files.length, files.length, 'Done');

  return results;
}

/** Bundles several results into one archive, only when the user asks for it. */
export async function archiveResults(results: ToolResult[]) {
  const nextName = createNameDeduper();
  const entries = [];

  for (const result of results) {
    entries.push({ name: nextName(result.filename), data: await result.blob.arrayBuffer() });
  }

  const archive = await zipEntries(entries, { store: true });

  return new Blob([new Uint8Array(archive.buffer as ArrayBuffer, archive.byteOffset, archive.byteLength)], {
    type: 'application/zip'
  });
}

export async function mergePdfsInBrowser(files: File[], onProgress: ProgressReporter = noop) {
  const inputs = [];

  for (const [index, file] of files.entries()) {
    onProgress(index, files.length, file.name);
    await tick();
    inputs.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  }

  onProgress(files.length, files.length, 'Merging');
  const result = await mergePdfs(inputs);

  return {
    blob: pdfBlob(result.bytes),
    filename: 'merged.pdf',
    warning: null
  } satisfies ToolResult;
}

export type ImagesToPdfSettings = {
  pageSize: string;
  orientation: string;
  margin: number;
  quality: number;
};

export async function imagesToPdfInBrowser(
  files: File[],
  settings: ImagesToPdfSettings,
  onProgress: ProgressReporter = noop
) {
  const { PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const failures: string[] = [];
  const quality = Math.max(30, Math.min(100, settings.quality)) / 100;

  for (const [index, file] of files.entries()) {
    onProgress(index, files.length, file.name);
    await tick();

    let decoded;

    try {
      decoded = await decodeImageFile(file);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `"${file.name}" could not be read.`);
      continue;
    }

    try {
      const { canvas, context, width, height } = drawToCanvas(decoded, MAX_PDF_IMAGE_DIMENSION);
      flattenOntoWhite(context, width, height);

      const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
      const image = await document.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      const layout = planImagePage(width, height, settings);

      document.addPage([layout.pageWidth, layout.pageHeight]).drawImage(image, {
        x: layout.x,
        y: layout.y,
        width: layout.drawWidth,
        height: layout.drawHeight
      });
    } finally {
      decoded.release();
    }
  }

  if (document.getPageCount() === 0) {
    throw new Error(failures.join('\n') || 'None of the selected images could be added to a PDF.');
  }

  onProgress(files.length, files.length, 'Writing PDF');

  return {
    blob: pdfBlob(await document.save()),
    filename: `images-${document.getPageCount()}-pages.pdf`,
    warning: failures.length ? failures.join(' | ') : null
  } satisfies ToolResult;
}

export async function removeBackgroundInBrowser(file: File, tolerance: number, feather: number) {
  const decoded = await decodeImageFile(file);

  try {
    const { canvas, context, width, height } = drawToCanvas(decoded, MAX_IMAGE_DIMENSION);
    const imageData = context.getImageData(0, 0, width, height);

    removeBackgroundPixels(imageData.data, width, height, { tolerance, feather });
    context.putImageData(imageData, 0, 0);

    return {
      blob: await canvasToBlob(canvas, 'image/png'),
      filename: `${file.name.replace(/\.[^/.]+$/, '')}-no-background.png`,
      warning: null
    } satisfies ToolResult;
  } finally {
    decoded.release();
  }
}

export async function signPdfInBrowser(file: File, signature: Blob, placements: SignaturePlacement[]) {
  const result = await signPdf({
    pdfBytes: new Uint8Array(await file.arrayBuffer()),
    signaturePng: new Uint8Array(await signature.arrayBuffer()),
    placements
  });

  return {
    blob: pdfBlob(result.bytes),
    filename: `${file.name.replace(/\.[^/.]+$/, '')}-signed.pdf`,
    warning: null
  } satisfies ToolResult;
}
