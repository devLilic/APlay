import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    root: __dirname,
    include: ['tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'],
    testTimeout: 1000 * 29,
    passWithNoTests: false,
  },
})
