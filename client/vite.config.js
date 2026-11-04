import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Built-in plugin: Automatically ensures the KSYN Express backend (port 5080) is running
function autoBackendPlugin() {
  let backendProc = null;

  return {
    name: 'auto-backend-server',
    configureServer(server) {
      const pingBackend = () => {
        const req = http.get('http://127.0.0.1:5080/api/health', (res) => {
          if (res.statusCode === 200) {
            console.log('[KSYN Vite] Backend API is active on port 5080.');
          }
        });

        req.on('error', () => {
          console.log('[KSYN Vite] Port 5080 offline. Auto-spawning Express backend server...');
          const serverDir = path.resolve(__dirname, '../server');
          backendProc = spawn('node', ['server.js'], {
            cwd: serverDir,
            stdio: 'inherit',
            shell: true
          });

          backendProc.on('error', (err) => {
            console.error('[KSYN Vite] Failed to spawn backend process:', err.message);
          });
        });
      };

      // Check immediately when Vite dev server starts
      pingBackend();

      server.httpServer?.on('close', () => {
        if (backendProc) {
          try {
            backendProc.kill();
          } catch (e) {
            // Process cleanup
          }
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), autoBackendPlugin()],
  server: {
    host: true, // Listens on all local IPs (e.g. 0.0.0.0) so smartphones on the same Wi-Fi can connect
    port: 5180,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5080',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[Vite Proxy] Backend connection warning:', err.message);
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                error: 'BACKEND_OFFLINE',
                message: 'KSYN API backend is offline or starting up on port 5080.',
                data: []
              }));
            }
          });
        }
      }
    }
  },
  preview: {
    host: true,
    port: 5180,
    strictPort: false
  }
});
