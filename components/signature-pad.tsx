'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SegmentedControl } from '@/components/ui';

const PAD_WIDTH = 600;
const PAD_HEIGHT = 200;

const modeOptions = [
  { value: 'draw', label: 'Draw' },
  { value: 'type', label: 'Type' },
  { value: 'upload', label: 'Upload' }
] as const;

type Mode = (typeof modeOptions)[number]['value'];

const fontOptions = [
  { value: '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive', label: 'Script' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { value: '"Helvetica Neue", Arial, sans-serif', label: 'Sans' }
] as const;

type Props = {
  /** Receives a transparent PNG of the signature, or null when it is cleared. */
  onChange: (signature: Blob | null) => void;
};

export function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);

  const [mode, setMode] = useState<Mode>('draw');
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState<string>(fontOptions[0].value);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasInk.current) {
      onChange(null);
      return;
    }

    canvas.toBlob((blob) => onChange(blob), 'image/png');
  }, [onChange]);

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return null;

    // Backing store is scaled for crisp strokes; drawing uses CSS pixel coordinates.
    const ratio = Math.min(3, window.devicePixelRatio || 1);

    // Round before comparing: canvas.width truncates on assignment, so a
    // fractional ratio (600 * 1.1 is 660.0000000000001) would never match and
    // the canvas would be resized — and therefore cleared — on every stroke.
    const width = Math.round(PAD_WIDTH * ratio);
    const height = Math.round(PAD_HEIGHT * ratio);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Resizing resets the transform, so it is always reapplied.
    ctx.setTransform(width / PAD_WIDTH, 0, 0, height / PAD_HEIGHT, 0, 0);

    return ctx;
  }, []);

  const clearCanvas = useCallback(() => {
    const ctx = context();
    if (!ctx) return;

    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    hasInk.current = false;
  }, [context]);

  /** Renders the typed name centred on the pad. */
  const renderTyped = useCallback(
    (text: string, fontFamily: string) => {
      const ctx = context();
      if (!ctx) return;

      ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);

      if (!text.trim()) {
        hasInk.current = false;
        emit();
        return;
      }

      let size = 96;
      ctx.fillStyle = '#0f172a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // Shrink until the name fits the pad width.
      do {
        ctx.font = `${size}px ${fontFamily}`;
        size -= 4;
      } while (size > 16 && ctx.measureText(text).width > PAD_WIDTH - 40);

      ctx.fillText(text, PAD_WIDTH / 2, PAD_HEIGHT / 2);
      hasInk.current = true;
      emit();
    },
    [context, emit]
  );

  useEffect(() => {
    if (mode === 'type') renderTyped(typed, font);
  }, [font, mode, renderTyped, typed]);

  useEffect(() => {
    return () => {
      if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    };
  }, [uploadUrl]);

  function pointFrom(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * PAD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PAD_HEIGHT
    };
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw') return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = pointFrom(event);
  }

  function extendStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || mode !== 'draw') return;

    const ctx = context();
    const from = lastPoint.current;
    const to = pointFrom(event);

    if (!ctx || !from) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    lastPoint.current = to;
    hasInk.current = true;
  }

  function endStroke() {
    if (!drawing.current) return;

    drawing.current = false;
    lastPoint.current = null;
    emit();
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    const url = URL.createObjectURL(file);
    setUploadUrl(url);

    // Re-draw the uploaded image into the pad so every mode emits the same shape.
    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('That image could not be read.'));
      image.src = url;
    });

    const ctx = context();
    if (!ctx) return;

    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    const scale = Math.min(PAD_WIDTH / image.width, PAD_HEIGHT / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, (PAD_WIDTH - width) / 2, (PAD_HEIGHT - height) / 2, width, height);
    hasInk.current = true;
    emit();
  }

  function handleClear() {
    clearCanvas();
    setTyped('');
    onChange(null);
  }

  function handleMode(next: Mode) {
    setMode(next);
    clearCanvas();
    onChange(null);
  }

  return (
    <div className="space-y-4">
      <SegmentedControl label="Signature" value={mode} options={modeOptions} onChange={handleMode} />

      {mode === 'type' ? (
        <div className="grid gap-3">
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Type your name"
            maxLength={60}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
          />
          <div className="flex flex-wrap gap-2">
            {fontOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setFont(option.value)}
                style={{ fontFamily: option.value }}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  font === option.value
                    ? 'border-sky-300/50 bg-sky-400/15 text-white'
                    : 'border-white/10 text-slate-300 hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'upload' ? (
        <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5">
          Choose a signature image
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
        </label>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={startStroke}
          onPointerMove={extendStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          style={{ width: '100%', aspectRatio: `${PAD_WIDTH} / ${PAD_HEIGHT}`, touchAction: 'none' }}
          className={mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {mode === 'draw' ? 'Draw with a mouse, trackpad, or finger.' : null}
          {mode === 'type' ? 'Your name is rendered in the chosen style.' : null}
          {mode === 'upload' ? 'A PNG with a transparent background works best.' : null}
        </p>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/5"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
