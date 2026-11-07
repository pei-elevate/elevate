import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Imports internos com '@/…' em vez de caminhos relativos longos.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**'],
    },
  },
});
