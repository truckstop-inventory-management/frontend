import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';


// --- Dev-only mock for /api/metrics/lookup -------------------------------
function metricsMockApi() {
  return {
    name: 'metrics-mock-api',
    configureServer(server) {
      server.middlewares.use('/api/metrics/lookup', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            // eslint-disable-next-line no-console
            console.log('[metrics mock] received metrics payload:', {
              count: Array.isArray(payload.items) ? payload.items.length : 0,
              exportedAt: payload.exportedAt,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[metrics mock] failed to parse payload', err);
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        });
      });
    },
  };
}


export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '^/api': 'https://backend-nlxq.onrender.com',
      '^/inventory': 'https://backend-nlxq.onrender.com'
    }
  }
})
