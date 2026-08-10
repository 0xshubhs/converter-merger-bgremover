'use client';

import { MAX_PDF_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION } from '@/lib/limits';
import { mergePdfs } from '@/lib/merge-pdf';
import { planImagePage } from '@/lib/pdf-page-layout';
import { removeBackgroundPixels } from '@/lib/remove-background-pixels';
import { signPdf, type SignaturePlacement } from '@/lib/sign-pdf';
import { createNameDeduper, zipEntries } from '@/lib/zip';
import { canvasToBlob, decodeImageFile, drawToCanvas, flattenOntoWhite } from './canvas';

export type ToolResult = {
  blob: Blob;
  filename: string;
  warning: string | null;
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

export async function compressFilesInBrowser(files: File[], level: number, onProgress: ProgressReporter = noop) {
  const nextName = createNameDeduper();
  const entries = [];

  for (const [index, file] of files.entries()) {
    onProgress(index, files.length, file.name);
    await tick();
    entries.push({ name: nextName(file.name || 'file'), data: await file.arrayBuffer() });
  }

  onProgress(files.length, files.length, 'Building archive');
  const archive = await zipEntries(entries, { level });

  return {
    blob: new Blob([new Uint8Array(archive.buffer as ArrayBuffer, archive.byteOffset, archive.byteLength)], {
      type: 'application/zip'
    }),
    filename: `compressed-files-${files.length}.zip`,
    warning: null
  } satisfies ToolResult;
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
