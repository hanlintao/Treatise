import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Zod v4 uses subpath imports that rolldown has trouble resolving during pre-bundling
    include: ['zod', '@json-render/core', '@json-render/react'],
  },
})
