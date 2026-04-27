import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/kyc': 'http://localhost:8080',
      '/wallet': 'http://localhost:8080',
      '/trading': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
});
