'use client';

import { useCallback, useRef, useState } from 'react';
import { downloadBlob, type DownloadPayload } from './transfer';

/**
 * Shared busy/error plumbing for the tools: runs one request at a time and
 * saves whatever the server sends back.
 */
export function useToolRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async (request: () => Promise<DownloadPayload>) => {
    if (inFlight.current) return null;

    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await request();
      downloadBlob(payload.blob, payload.filename);
      if (payload.warning) setNotice(payload.warning);

      return payload;
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Something went wrong');

      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, notice, setError, setNotice, run };
}
