/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default defineConfig(env => mergeConfig(viteConfig(env), {
  test: {
    globals: true,
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-e2e/**', 'e2e/**', 'e2e-artifacts/**', 'scripts/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/**/__tests__/**', 'src/setupTests.ts', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage/unit',
    },
  },
}));
