import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic', include: /src\/.*\.[jt]sx?$/ })],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  esbuild: { loader: 'jsx', include: /src\/.*\.[jt]sx?$/, jsx: 'automatic' },
  server: { port: 5174 }
})