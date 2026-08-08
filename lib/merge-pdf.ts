import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(files: File[]) {
  const merged = await PDFDocument.create();

  for (const file of files) {
    const input = await file.arrayBuffer();
    const source = await PDFDocument.load(input, { ignoreEncryption: false });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  const bytes = await merged.save();

  return {
    buffer: Buffer.from(bytes),
    mime: 'application/pdf',
    extension: 'pdf'
  };
}