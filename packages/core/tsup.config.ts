import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { only: true },
  outDir: 'dist',
  clean: true,
})
