import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Ledewire',
      // ESM for bundlers; IIFE for CDN <script> tags
      formats: ['es', 'iife'],
      fileName: (format) => format === 'iife' ? 'ledewire.min.js' : 'index.js',
    },
    rollupOptions: {
      // No external deps — bundle everything for CDN use
      external: [],
    },
    sourcemap: true,
    target: 'es2020',
  },
})
