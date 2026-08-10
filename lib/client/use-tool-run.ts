'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressReporter, ToolResult } from '@/lib/browser/tools';

export type Progress = {
  done: number;
  total: number;
  label: string;
};

export type PreparedResult = ToolResult & {
  id: number;
  /** Object URL for previewing in the page. Revoked when results are replaced. */
  url: string;
};

let resultId = 0;

/**
 * Shared busy/error/progress plumbing. Results are held for preview and saved
 * only when the user asks — nothing downloads on its own.
 */
export function useToolRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [results, setResults] = useState<PreparedResult[]>([]);
  const inFlight = useRef(false);
  const urlsRef = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  }, []);

  useEffect(() => releaseUrls, [releaseUrls]);

  const clearResults = useCallback(() => {
    releaseUrls();
    setResults([]);
    setNotice(null);
  }, [releaseUrls]);

  const run = useCallback(
    async (job: (report: ProgressReporter) => Promise<ToolResult | ToolResult[]>) => {
      if (inFlight.current) return null;

      inFlight.current = true;
      setBusy(true);
      setError(null);
      setNotice(null);
      setProgress(null);
      releaseUrls();
      setResults([]);

      const report: ProgressReporter = (done, total, label) => setProgress({ done, total, label });

      try {
        const produced = await job(report);
        const list = Array.isArray(produced) ? produced : [produced];

        const prepared = list.map((result) => {
          resultId += 1;
          const url = URL.createObjectURL(result.blob);
          urlsRef.current.push(url);

          return { ...result, id: resultId, url };
        });

        setResults(prepared);

        const warning = list.find((result) => result.warning)?.warning ?? null;
        if (warning) setNotice(warning);

        return prepared;
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : 'Something went wrong');

        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
        setProgress(null);
      }
    },
    [releaseUrls]
  );

  return { busy, error, notice, progress, results, setError, setNotice, clearResults, run };
}
