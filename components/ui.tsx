'use client';

import type { ChangeEvent, DragEventHandler, ReactNode } from 'react';
import { formatBytes } from '@/lib/client/transfer';
import type { SelectedFile } from '@/lib/client/use-file-selection';

type DropzoneHandlers = {
  onDragEnter: DragEventHandler<HTMLElement>;
  onDragOver: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
};

export function ToolLayout({ children }: { children: ReactNode }) {
  return <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">{children}</section>;
}

export function Panel({ children, tinted = false }: { children: ReactNode; tinted?: boolean }) {
  return (
    <div
      className={`rounded-[1.75rem] border border-white/10 p-5 shadow-glow backdrop-blur-xl sm:p-6 ${
        tinted ? 'bg-white/5' : 'bg-[var(--panel)]'
      }`}
    >
      {children}
    </div>
  );
}

export function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AddFilesButton({
  label,
  accept,
  multiple = true,
  onChange
}: {
  label: string;
  accept?: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="cursor-pointer rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/15">
      {label}
      <input className="hidden" type="file" accept={accept} multiple={multiple} onChange={onChange} />
    </label>
  );
}

export function Dropzone({
  isDragging,
  idleTitle,
  activeTitle,
  hint,
  handlers
}: {
  isDragging: boolean;
  idleTitle: string;
  activeTitle: string;
  hint: string;
  handlers: DropzoneHandlers;
}) {
  return (
    <div
      {...handlers}
      className={`mt-5 rounded-3xl border border-dashed p-6 text-center transition-all ${
        isDragging
          ? 'border-sky-300/80 bg-sky-400/12 text-slate-100 shadow-[0_0_0_1px_rgba(125,211,252,0.25)]'
          : 'border-white/15 bg-black/20 text-slate-400'
      }`}
    >
      <p className="text-base font-medium text-slate-200">{isDragging ? activeTitle : idleTitle}</p>
      <p className="mt-1 text-sm">{hint}</p>
    </div>
  );
}

export function StatList({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">{children}</div>
  );
}

export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {message}
    </div>
  );
}

export function NoticeBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>
  );
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-slate-400">
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-sky-300 transition-all duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function RangeField({
  label,
  valueLabel,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`grid gap-3 text-sm text-slate-300 ${disabled ? 'opacity-50' : ''}`}>
      <span>
        {label} <span className="text-slate-100">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-sky-300"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-3 text-sm text-slate-300">
      <span>{label}</span>
      <div className="grid rounded-2xl border border-white/10 bg-slate-950/60 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              value === option.value ? 'bg-sky-300 text-slate-950' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/5"
    >
      Remove
    </button>
  );
}

export function FileGrid({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function FileTile({
  item,
  badge,
  onRemove,
  children
}: {
  item: SelectedFile;
  badge?: ReactNode;
  onRemove: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
      <div className="relative aspect-[4/3] bg-slate-900">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URLs cannot use the image optimizer
          <img className="h-full w-full object-cover" src={item.previewUrl} alt={item.file.name} loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
            <span className="break-all">{item.file.type || 'unknown file type'}</span>
          </div>
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-sky-100">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white" title={item.file.name}>
              {item.file.name}
            </h3>
            <p className="text-xs text-slate-400">{formatBytes(item.file.size)}</p>
          </div>
          <RemoveButton onClick={onRemove} />
        </div>
        {children}
      </div>
    </article>
  );
}

export function ReorderButtons({
  index,
  count,
  onMove
}: {
  index: number;
  count: number;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onMove(index, -1)}
        disabled={index === 0}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Move up
      </button>
      <button
        type="button"
        onClick={() => onMove(index, 1)}
        disabled={index === count - 1}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Move down
      </button>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-6 text-slate-400">{children}</p>;
}
