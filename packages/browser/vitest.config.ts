import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'browser',
    // jsdom simulates browser APIs (localStorage, fetch, etc.) in Node.js
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test-helpers.ts', 'src/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
