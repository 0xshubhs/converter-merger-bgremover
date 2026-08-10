'use client';

import { useState } from 'react';
import { SecondaryButton } from '@/components/ui';
import { archiveResults } from '@/lib/browser/tools';
import { downloadBlob, formatBytes } from '@/lib/client/transfer';
import type { PreparedResult } from '@/lib/client/use-tool-run';

function savingsOf(result: PreparedResult) {
  if (!result.originalSize) return null;

  const delta = result.originalSize - result.blob.size;

  if (delta <= 0) return null;

  return Math.round((delta / result.originalSize) * 100);
}

function ResultBody({ result }: { result: PreparedResult }) {
  const type = result.blob.type;

  if (type.startsWith('image/')) {
    return (
      <div className="flex max-h-[420px] items-center justify-center bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:20px_20px] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        <img src={result.url} alt={result.filename} className="max-h-[396px] w-auto max-w-full object-contain" />
      </div>
    );
  }

  if (type === 'application/pdf') {
    return (
      <iframe
        src={result.url}
        title={result.filename}
        className="h-[420px] w-full border-0 bg-white"
      />
    );
  }

  return (
    <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-slate-400">
      <span className="break-all">{type || 'File'} — no preview available</span>
    </div>
  );
}

export function ResultPreview({ results, onClear }: { results: PreparedResult[]; onClear: () => void }) {
  const [archiving, setArchiving] = useState(false);

  if (!results.length) return null;

  const total = results.reduce((sum, result) => sum + result.blob.size, 0);
  const originalTotal = results.reduce((sum, result) => sum + (result.originalSize ?? 0), 0);

  async function downloadEverything() {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].filename);

      return;
    }

    setArchiving(true);

    try {
      downloadBlob(await archiveResults(results), `files-${results.length}.zip`);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="mt-6 rounded-[1.75rem] border border-sky-300/25 bg-sky-400/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {results.length === 1 ? 'Result' : `${results.length} results`}
          </h3>
          <p className="text-sm text-slate-400">
            {formatBytes(total)}
            {originalTotal > 0 && total < originalTotal
              ? ` — down from ${formatBytes(originalTotal)} (${Math.round(((originalTotal - total) / originalTotal) * 100)}% smaller)`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadEverything}
            disabled={archiving}
            className="rounded-full bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:opacity-50"
          >
            {archiving ? 'Preparing...' : results.length === 1 ? 'Download' : 'Download all as ZIP'}
          </button>
          <SecondaryButton onClick={onClear}>Discard</SecondaryButton>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {results.map((result) => {
          const savings = savingsOf(result);

          return (
            <article key={result.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
              <ResultBody result={result} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-white" title={result.filename}>
                    {result.filename}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {formatBytes(result.blob.size)}
                    {result.originalSize ? ` of ${formatBytes(result.originalSize)}` : ''}
                    {savings !== null ? ` — ${savings}% smaller` : ''}
                  </p>
                  {result.note ? <p className="mt-1 text-xs text-amber-200/80">{result.note}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(result.blob, result.filename)}
                  className="shrink-0 rounded-full border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/20"
                >
                  Download
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
