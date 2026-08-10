import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/lib/concurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of completion order', async () => {
    const items = [30, 5, 20, 1];

    const results = await mapWithConcurrency(items, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));

      return value;
    });

    expect(results.map((result) => (result.status === 'fulfilled' ? result.value : null))).toEqual(items);
  });

  it('isolates failures instead of rejecting the batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], async (value) => {
      if (value === 2) throw new Error('boom');

      return value;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await tick();
        active -= 1;
      },
      3
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], async () => 1)).toEqual([]);
  });
});
