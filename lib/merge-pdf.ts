import type { PDFDocument as PDFDocumentInstance } from 'pdf-lib';
import { HttpError } from './errors';

type MergeInput = {
  name: string;
  bytes: Uint8Array;
};

export async function mergePdfs(inputs: MergeInput[]) {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  let pageCount = 0;

  for (const input of inputs) {
    let source: PDFDocumentInstance;

    try {
      source = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'could not be read';

      // A file the user picked, not a server fault: report it as unprocessable.
      throw new HttpError(422, `"${input.name}" could not be opened as a PDF. ${reason}`);
    }

    const pages = await merged.copyPages(source, source.getPageIndices());

    for (const page of pages) {
      merged.addPage(page);
      pageCount += 1;
    }
  }

  if (pageCount === 0) {
    throw new HttpError(422, 'The selected PDFs contain no pages.');
  }

  return {
    bytes: await merged.save(),
    mime: 'application/pdf',
    extension: 'pdf',
    pageCount
  };
}
