'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string;
};

async function removeBackground(file: File, tolerance: number, feather: number) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('tolerance', String(tolerance));
  formData.append('feather', String(feather));

  const response = await fetch('/api/remove-background', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Background removal failed');
  }

  return response.blob();
}

export function BackgroundRemover() {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [tolerance, setTolerance] = useState(42);
  const [feather, setFeather] = useState(32);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      if (file) URL.revokeObjectURL(file.previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl, file]);

  function setSelectedFile(sourceFile: File | null) {
    if (!sourceFile) return;

    setFile((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return {
        id: `${sourceFile.name}-${sourceFile.size}-${sourceFile.lastModified}-${crypto.randomUUID()}`,
        file: sourceFile,
        previewUrl: URL.createObjectURL(sourceFile)
      };
    });
    setError(null);
  }

  function addFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
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
    setSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  function clearFile() {
    if (file) URL.revokeObjectURL(file.previewUrl);
    setFile(null);
    setError(null);
  }

  async function handleRemoveBackground() {
    if (!file || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = await removeBackground(file.file, tolerance, feather);
      const objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${file.file.name.replace(/\.[^/.]+$/, '')}-no-background.png`;
      anchor.click();
    } catch (removalError) {
      setError(removalError instanceof Error ? removalError.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-white/10 bg-[var(--panel)] p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Upload image</h2>
            <p className="text-sm text-slate-400">Best for plain or near-uniform backgrounds.</p>
          </div>
          <label className="cursor-pointer rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/15">
            Add image
            <input className="hidden" type="file" accept="image/*" onChange={addFile} />
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
            {isDragging ? 'Drop the image here' : 'Drag and drop an image here'}
          </p>
          <p className="mt-1 text-sm">The output will be a transparent PNG.</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
          <div className="flex min-h-[300px] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(125,211,252,0.08),_transparent_42%)] p-4">
            {file ? (
              <img className="max-h-[360px] w-full rounded-2xl object-contain" src={file.previewUrl} alt={file.file.name} />
            ) : (
              <div className="max-w-sm text-center text-sm leading-6 text-slate-400">
                Upload an image with a visible background and the tool will try to cut the subject out.
              </div>
            )}
          </div>
          {file ? (
            <div className="flex items-start justify-between gap-3 border-t border-white/10 p-4">
              <div>
                <h3 className="truncate text-sm font-semibold text-white">{file.file.name}</h3>
                <p className="text-xs text-slate-400">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/5"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <h2 className="text-xl font-semibold text-white">Removal settings</h2>
        <div className="mt-5 space-y-5">
          <label className="grid gap-3 text-sm text-slate-300">
            Tolerance: <span className="text-slate-100">{tolerance}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={tolerance}
              onChange={(event) => setTolerance(Number(event.target.value))}
              className="accent-sky-300"
            />
          </label>

          <label className="grid gap-3 text-sm text-slate-300">
            Feather: <span className="text-slate-100">{feather}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={feather}
              onChange={(event) => setFeather(Number(event.target.value))}
              className="accent-sky-300"
            />
          </label>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Selected image</span>
              <span className="text-white">{file ? '1' : '0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Output</span>
              <span className="text-white">Transparent PNG</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Style</span>
              <span className="text-white">Best effort</span>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || busy}
              onClick={handleRemoveBackground}
              className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Removing...' : 'Remove background'}
            </button>
            <button
              type="button"
              disabled={!file || busy}
              onClick={clearFile}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear image
            </button>
          </div>

          <p className="text-xs leading-6 text-slate-400">
            This route is a local approximation of remove.bg behavior. It performs best on photos with simple, solid, or lightly textured backgrounds.
          </p>
        </div>
      </aside>
    </section>
  );
}