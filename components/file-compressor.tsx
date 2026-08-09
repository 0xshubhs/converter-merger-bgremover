'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string;
};

async function compressFiles(files: File[], level: number) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file, file.name);
  });

  formData.append('level', String(level));

  const response = await fetch('/api/compress', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Compression failed');
  }

  return response.blob();
}

export function FileCompressor() {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [level, setLevel] = useState(9);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const dragDepth = useRef(0);

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  useEffect(() => {
    return () => {
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl, files]);

  function createSelectedFiles(sourceFiles: File[]) {
    return sourceFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
  }

  function appendFiles(sourceFiles: File[]) {
    const nextFiles = createSelectedFiles(sourceFiles);

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

  function clearAll() {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    setError(null);
    setResultSize(null);
  }

  async function handleCompress() {
    if (!files.length || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = await compressFiles(files.map((item) => item.file), level);
      const objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);
      setResultSize(blob.size);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `compressed-files-${Date.now()}.zip`;
      anchor.click();
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const savings = resultSize && totalSize > 0 ? Math.max(0, 100 - Math.round((resultSize / totalSize) * 100)) : null;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-white/10 bg-[var(--panel)] p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Upload files</h2>
            <p className="text-sm text-slate-400">Compress documents, PDFs, images, and other files without changing their contents.</p>
          </div>
          <label className="cursor-pointer rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/15">
            Add files
            <input className="hidden" multiple type="file" onChange={addFiles} />
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
            {isDragging ? 'Drop files here to compress them' : 'Drag and drop files here'}
          </p>
          <p className="mt-1 text-sm">This creates a lossless ZIP archive, so the file contents stay unchanged.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
              <div className="flex min-h-[120px] items-center justify-center bg-slate-900 px-4 py-6 text-center text-xs text-slate-400">
                <span className="break-all">{item.file.type || 'unknown file type'}</span>
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="truncate text-sm font-semibold text-white">{item.file.name}</h3>
                    <p className="text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <h2 className="text-xl font-semibold text-white">Compression settings</h2>
        <div className="mt-5 space-y-5">
          <label className="grid gap-3 text-sm text-slate-300">
            Compression level: <span className="text-slate-100">{level}/9</span>
            <input
              type="range"
              min={1}
              max={9}
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
              className="accent-sky-300"
            />
          </label>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Files</span>
              <span className="text-white">{files.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total size</span>
              <span className="text-white">{(totalSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Mode</span>
              <span className="text-white">Lossless ZIP</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last result</span>
              <span className="text-white">{resultSize ? `${(resultSize / 1024 / 1024).toFixed(2)} MB` : 'Not created yet'}</span>
            </div>
            {savings !== null ? (
              <div className="flex items-center justify-between">
                <span>Reduction</span>
                <span className="text-white">{savings}%</span>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!files.length || busy}
              onClick={handleCompress}
              className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Compressing...' : 'Compress files'}
            </button>
            <button
              type="button"
              disabled={!files.length || busy}
              onClick={clearAll}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear files
            </button>
          </div>

          <p className="text-xs leading-6 text-slate-400">
            ZIP compression is lossless, so the files can be extracted back exactly as they were. Files that are already compressed, such as JPEG, PNG, or PDF, may not shrink much.
          </p>
        </div>
      </aside>
    </section>
  );
}