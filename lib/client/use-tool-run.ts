'use client';

import { useCallback, useRef, useState } from 'react';
import type { ProgressReporter, ToolResult } from '@/lib/browser/tools';
import { downloadBlob } from './transfer';

export type Progress = {
  done: number;
  total: number;
  label: string;
};

/**
 * Shared busy/error/progress plumbing: runs one job at a time and saves whatever
 * it produces. Work happens in the browser now, so progress is real, not a spinner.
 */
export function useToolRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async (job: (report: ProgressReporter) => Promise<ToolResult>) => {
    if (inFlight.current) return null;

    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProgress(null);

    const report: ProgressReporter = (done, total, label) => setProgress({ done, total, label });

    try {
      const result = await job(report);
      downloadBlob(result.blob, result.filename);
      if (result.warning) setNotice(result.warning);

      return result;
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Something went wrong');

      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
      setProgress(null);
    }
  }, []);

  return { busy, error, notice, progress, setError, setNotice, run };
}
