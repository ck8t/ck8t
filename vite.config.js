import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const defaultBasePath = process.env.NODE_ENV === 'production' ? '/ck8t/' : '/'
const rawBasePath = process.env.VITE_BASE_PATH ?? defaultBasePath
const normalizedBasePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`

export default defineConfig({
  base: normalizedBasePath,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // CK8T routes → ck8t-server (port 3001)
      '/api/v1/ck8t': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ''),
      },
      '/api/v1/mcp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ''),
      },
    },
  },
})
