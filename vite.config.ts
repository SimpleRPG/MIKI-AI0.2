import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function stableVendorChunk(id: string): string | undefined {
  if (!id.includes('/node_modules/')) return undefined
  if (id.includes('/node_modules/typescript/')) return 'vendor-typescript'
  if (id.includes('/node_modules/sql.js/')) return 'vendor-sqljs'
  if (id.includes('/node_modules/jszip/')) return 'vendor-jszip'
  if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'vendor-react'
  if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) return 'vendor-charts'
  return 'vendor-common'
}

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: stableVendorChunk,
      },
    },
  },
})
