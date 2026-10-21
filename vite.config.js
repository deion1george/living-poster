import { defineConfig } from 'vite';

export default defineConfig({
  build: { chunkSizeWarningLimit: 2500 }, // MindAR bundles TensorFlow.js
});
