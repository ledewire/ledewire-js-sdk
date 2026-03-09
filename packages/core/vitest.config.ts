import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/api.gen.ts',
        'src/test-utils/**',
        'src/index.ts',
        'src/types.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
