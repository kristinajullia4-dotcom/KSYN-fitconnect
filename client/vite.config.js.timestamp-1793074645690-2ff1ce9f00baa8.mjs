// vite.config.js
import { defineConfig } from "file:///C:/Users/admin/OneDrive/Desktop/systems/ksyn-20260923T052834Z-1-001/ksyn/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/admin/OneDrive/Desktop/systems/ksyn-20260923T052834Z-1-001/ksyn/client/node_modules/@vitejs/plugin-react/dist/index.js";
import { spawn } from "child_process";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/admin/OneDrive/Desktop/systems/ksyn-20260923T052834Z-1-001/ksyn/client/vite.config.js";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = path.dirname(__filename);
function autoBackendPlugin() {
  let backendProc = null;
  return {
    name: "auto-backend-server",
    configureServer(server) {
      const pingBackend = () => {
        const req = http.get("http://127.0.0.1:5080/api/health", (res) => {
          if (res.statusCode === 200) {
            console.log("\u26A1 [KSYN Vite] Backend API is active on port 5080.");
          }
        });
        req.on("error", () => {
          console.log("\u{1F680} [KSYN Vite] Port 5080 offline. Auto-spawning Express backend server...");
          const serverDir = path.resolve(__dirname, "../server");
          backendProc = spawn("node", ["server.js"], {
            cwd: serverDir,
            stdio: "inherit",
            shell: true
          });
          backendProc.on("error", (err) => {
            console.error("\u274C [KSYN Vite] Failed to spawn backend process:", err.message);
          });
        });
      };
      pingBackend();
      server.httpServer?.on("close", () => {
        if (backendProc) {
          try {
            backendProc.kill();
          } catch (e) {
          }
        }
      });
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), autoBackendPlugin()],
  server: {
    host: true,
    // Listens on all local IPs (e.g. 0.0.0.0) so smartphones on the same Wi-Fi can connect
    port: 5180,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5080",
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.warn("[Vite Proxy] Backend connection warning:", err.message);
            if (res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                success: false,
                error: "BACKEND_OFFLINE",
                message: "KSYN API backend is offline or starting up on port 5080.",
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
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhZG1pblxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXHN5c3RlbXNcXFxca3N5bi0yMDI2MDkyM1QwNTI4MzRaLTEtMDAxXFxcXGtzeW5cXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhZG1pblxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXHN5c3RlbXNcXFxca3N5bi0yMDI2MDkyM1QwNTI4MzRaLTEtMDAxXFxcXGtzeW5cXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hZG1pbi9PbmVEcml2ZS9EZXNrdG9wL3N5c3RlbXMva3N5bi0yMDI2MDkyM1QwNTI4MzRaLTEtMDAxL2tzeW4vY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAndXJsJztcblxuY29uc3QgX19maWxlbmFtZSA9IGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKTtcbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShfX2ZpbGVuYW1lKTtcblxuLy8gQnVpbHQtaW4gcGx1Z2luOiBBdXRvbWF0aWNhbGx5IGVuc3VyZXMgdGhlIEtTWU4gRXhwcmVzcyBiYWNrZW5kIChwb3J0IDUwODApIGlzIHJ1bm5pbmdcbmZ1bmN0aW9uIGF1dG9CYWNrZW5kUGx1Z2luKCkge1xuICBsZXQgYmFja2VuZFByb2MgPSBudWxsO1xuXG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2F1dG8tYmFja2VuZC1zZXJ2ZXInLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIGNvbnN0IHBpbmdCYWNrZW5kID0gKCkgPT4ge1xuICAgICAgICBjb25zdCByZXEgPSBodHRwLmdldCgnaHR0cDovLzEyNy4wLjAuMTo1MDgwL2FwaS9oZWFsdGgnLCAocmVzKSA9PiB7XG4gICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI2QTEgW0tTWU4gVml0ZV0gQmFja2VuZCBBUEkgaXMgYWN0aXZlIG9uIHBvcnQgNTA4MC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlcS5vbignZXJyb3InLCAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1x1RDgzRFx1REU4MCBbS1NZTiBWaXRlXSBQb3J0IDUwODAgb2ZmbGluZS4gQXV0by1zcGF3bmluZyBFeHByZXNzIGJhY2tlbmQgc2VydmVyLi4uJyk7XG4gICAgICAgICAgY29uc3Qgc2VydmVyRGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uL3NlcnZlcicpO1xuICAgICAgICAgIGJhY2tlbmRQcm9jID0gc3Bhd24oJ25vZGUnLCBbJ3NlcnZlci5qcyddLCB7XG4gICAgICAgICAgICBjd2Q6IHNlcnZlckRpcixcbiAgICAgICAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgICAgICAgICBzaGVsbDogdHJ1ZVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgYmFja2VuZFByb2Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignXHUyNzRDIFtLU1lOIFZpdGVdIEZhaWxlZCB0byBzcGF3biBiYWNrZW5kIHByb2Nlc3M6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIC8vIENoZWNrIGltbWVkaWF0ZWx5IHdoZW4gVml0ZSBkZXYgc2VydmVyIHN0YXJ0c1xuICAgICAgcGluZ0JhY2tlbmQoKTtcblxuICAgICAgc2VydmVyLmh0dHBTZXJ2ZXI/Lm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgaWYgKGJhY2tlbmRQcm9jKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGJhY2tlbmRQcm9jLmtpbGwoKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBQcm9jZXNzIGNsZWFudXBcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBhdXRvQmFja2VuZFBsdWdpbigpXSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogdHJ1ZSwgLy8gTGlzdGVucyBvbiBhbGwgbG9jYWwgSVBzIChlLmcuIDAuMC4wLjApIHNvIHNtYXJ0cGhvbmVzIG9uIHRoZSBzYW1lIFdpLUZpIGNhbiBjb25uZWN0XG4gICAgcG9ydDogNTE4MCxcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NTA4MCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tWaXRlIFByb3h5XSBCYWNrZW5kIGNvbm5lY3Rpb24gd2FybmluZzonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBpZiAocmVzICYmICFyZXMuaGVhZGVyc1NlbnQpIHtcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDIsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdCQUNLRU5EX09GRkxJTkUnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdLU1lOIEFQSSBiYWNrZW5kIGlzIG9mZmxpbmUgb3Igc3RhcnRpbmcgdXAgb24gcG9ydCA1MDgwLicsXG4gICAgICAgICAgICAgICAgZGF0YTogW11cbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgaG9zdDogdHJ1ZSxcbiAgICBwb3J0OiA1MTgwLFxuICAgIHN0cmljdFBvcnQ6IGZhbHNlXG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpYixTQUFTLG9CQUFvQjtBQUM5YyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxhQUFhO0FBQ3RCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFMeVAsSUFBTSwyQ0FBMkM7QUFPeFUsSUFBTSxhQUFhLGNBQWMsd0NBQWU7QUFDaEQsSUFBTSxZQUFZLEtBQUssUUFBUSxVQUFVO0FBR3pDLFNBQVMsb0JBQW9CO0FBQzNCLE1BQUksY0FBYztBQUVsQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixnQkFBZ0IsUUFBUTtBQUN0QixZQUFNLGNBQWMsTUFBTTtBQUN4QixjQUFNLE1BQU0sS0FBSyxJQUFJLG9DQUFvQyxDQUFDLFFBQVE7QUFDaEUsY0FBSSxJQUFJLGVBQWUsS0FBSztBQUMxQixvQkFBUSxJQUFJLHdEQUFtRDtBQUFBLFVBQ2pFO0FBQUEsUUFDRixDQUFDO0FBRUQsWUFBSSxHQUFHLFNBQVMsTUFBTTtBQUNwQixrQkFBUSxJQUFJLGtGQUEyRTtBQUN2RixnQkFBTSxZQUFZLEtBQUssUUFBUSxXQUFXLFdBQVc7QUFDckQsd0JBQWMsTUFBTSxRQUFRLENBQUMsV0FBVyxHQUFHO0FBQUEsWUFDekMsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsT0FBTztBQUFBLFVBQ1QsQ0FBQztBQUVELHNCQUFZLEdBQUcsU0FBUyxDQUFDLFFBQVE7QUFDL0Isb0JBQVEsTUFBTSx1REFBa0QsSUFBSSxPQUFPO0FBQUEsVUFDN0UsQ0FBQztBQUFBLFFBQ0gsQ0FBQztBQUFBLE1BQ0g7QUFHQSxrQkFBWTtBQUVaLGFBQU8sWUFBWSxHQUFHLFNBQVMsTUFBTTtBQUNuQyxZQUFJLGFBQWE7QUFDZixjQUFJO0FBQ0Ysd0JBQVksS0FBSztBQUFBLFVBQ25CLFNBQVMsR0FBRztBQUFBLFVBRVo7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjtBQUdBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsa0JBQWtCLENBQUM7QUFBQSxFQUN0QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLFdBQVcsQ0FBQyxPQUFPLGFBQWE7QUFDOUIsZ0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFFBQVE7QUFDcEMsb0JBQVEsS0FBSyw0Q0FBNEMsSUFBSSxPQUFPO0FBQ3BFLGdCQUFJLE9BQU8sQ0FBQyxJQUFJLGFBQWE7QUFDM0Isa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGtCQUFJLElBQUksS0FBSyxVQUFVO0FBQUEsZ0JBQ3JCLFNBQVM7QUFBQSxnQkFDVCxPQUFPO0FBQUEsZ0JBQ1AsU0FBUztBQUFBLGdCQUNULE1BQU0sQ0FBQztBQUFBLGNBQ1QsQ0FBQyxDQUFDO0FBQUEsWUFDSjtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0g7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxFQUNkO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
