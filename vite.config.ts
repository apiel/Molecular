
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base path so it works on any GitHub Pages URL (e.g. username.github.io/repo-name/)
  base: './',
  build: {
    outDir: 'docs',
    sourcemap: true
  }
});
