import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  // Tests do not need Tailwind, and postcss.config.mjs is in the shape Next
  // (Turbopack) reads, which Vite's loader does not accept.
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'scripts/**'],
    },
  },
});
