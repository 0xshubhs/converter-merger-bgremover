'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

type SelectedPdf = {
  id: string;
  file: File;
  previewUrl: string;
};

async function mergePdfs(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch('/api/merge-pdf', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'PDF merge failed');
  }

  return response.blob();
}

export function PdfMerger() {
  const [files, setFiles] = useState<SelectedPdf[]>([]);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl, files]);

  function createFiles(sourceFiles: File[]) {
    return sourceFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
  }

  function appendFiles(sourceFiles: File[]) {
    const nextFiles = createFiles(sourceFiles.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')));

    if (!nextFiles.length) return;

    setFiles((current) => [...current, ...nextFiles]);
    setError(null);
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    appendFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    appendFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const updated = [...current];
      const [item] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, item);
      return updated;
    });
  }

  function clearAll() {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    setError(null);
  }

  async function handleMerge() {
    if (files.length < 2 || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = await mergePdfs(files.map((item) => item.file));
      const objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `merged-${Date.now()}.pdf`;
      anchor.click();
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-white/10 bg-[var(--panel)] p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Upload PDFs</h2>
            <p className="text-sm text-slate-400">Combine multiple PDFs into one file in the order you choose.</p>
          </div>
          <label className="cursor-pointer rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/15">
            Add PDFs
            <input className="hidden" multiple type="file" accept="application/pdf,.pdf" onChange={addFiles} />
          </label>
        </div>

        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-5 rounded-3xl border border-dashed p-6 text-center transition-all ${
            isDragging
              ? 'border-sky-300/80 bg-sky-400/12 text-slate-100 shadow-[0_0_0_1px_rgba(125,211,252,0.25)]'
              : 'border-white/15 bg-black/20 text-slate-400'
          }`}
        >
          <p className="text-base font-medium text-slate-200">
            {isDragging ? 'Drop PDFs here to queue them' : 'Drag and drop PDFs here'}
          </p>
          <p className="mt-1 text-sm">Files will merge from top to bottom in the list.</p>
        </div>

        <div className="mt-6 grid gap-3">
          {files.map((item, index) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-400/15 px-2 py-1 text-[11px] font-semibold text-sky-100">{index + 1}</span>
                    <h3 className="truncate text-sm font-semibold text-white">{item.file.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/5"
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => moveFile(index, -1)}
                  disabled={index === 0}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveFile(index, 1)}
                  disabled={index === files.length - 1}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Move down
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <h2 className="text-xl font-semibold text-white">Merge settings</h2>
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Selected PDFs</span>
              <span className="text-white">{files.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Output</span>
              <span className="text-white">Single PDF</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Order</span>
              <span className="text-white">Manual</span>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={files.length < 2 || busy}
              onClick={handleMerge}
              className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Merging...' : 'Merge PDFs'}
            </button>
            <button
              type="button"
              disabled={!files.length || busy}
              onClick={clearAll}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear list
            </button>
          </div>

          <p className="text-xs leading-6 text-slate-400">
            This merges PDF pages in the order shown above and downloads a single combined PDF.
          </p>
        </div>
      </aside>
    </section>
  );
}