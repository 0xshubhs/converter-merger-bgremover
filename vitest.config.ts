import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  },
  test: {
    // Everything under test is server-side: Sharp, pdf-lib, and Node buffers.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000
  }
});
