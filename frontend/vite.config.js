import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Frontend on 3000, backend on 5000
    proxy: {
      '/api': {
        target: 'http://localhost:5500',
        changeOrigin: true,
        secure: false,
      },
      // Socket.io (live interviewer reaction in Mock Interview) needs both
      // its HTTP handshake and WebSocket upgrade proxied to the backend.
      '/socket.io': {
        target: 'http://localhost:5500',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
});
