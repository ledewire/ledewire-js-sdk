import { defineConfig } from 'vitest/config'

/**
 * Root Vitest config — discovered automatically when running `vitest` from the
 * repo root. Each package runs tests with its own environment:
 * - @ledewire/node → node environment
 * - @ledewire/browser → jsdom (simulates browser APIs)
 * - @ledewire/core → node environment
 */
export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/node', 'packages/browser', 'packages/x402-client'],
  },
})
