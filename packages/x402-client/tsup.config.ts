import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/axios.ts'],
  format: ['esm', 'cjs'],
  dts: { resolve: ['@ledewire/core'] },
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  outDir: 'dist',
})
