import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js needs WebGL2 (iOS 15+), so build for Safari 15 rather than Vite's newer default.
    target: ['es2020', 'safari15', 'chrome100'],
    chunkSizeWarningLimit: 2500, // MindAR bundles TensorFlow.js
    // The poster app, plus the scan dashboard at /stats.
    rollupOptions: { input: { main: 'index.html', stats: 'stats.html' } },
  },
});
