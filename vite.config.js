import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: resolve(__dirname, 'beta-src'),
  plugins: [react()],
  base: './',
  build: {
    outDir: resolve(__dirname, 'beta'),
    emptyOutDir: true,
  }
});
