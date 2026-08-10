import { cpus } from 'node:os';

/** Sharp releases the event loop while it works, so a small pool keeps every core busy. */
export const defaultConcurrency = Math.max(2, Math.min(8, cpus().length));

/**
 * Runs `task` over every item with a bounded number in flight, preserving input order.
 * Rejections are surfaced per item so one bad file cannot fail the whole batch.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
  limit = defaultConcurrency
): Promise<Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: unknown }>> {
  const results = new Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: unknown }>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;

      try {
        results[index] = { status: 'fulfilled', value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);

  return results;
}
