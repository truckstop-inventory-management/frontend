import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '^/api': 'https://backend-nlxq.onrender.com',
      '^/inventory': 'https://backend-nlxq.onrender.com'
    }
  }
})
