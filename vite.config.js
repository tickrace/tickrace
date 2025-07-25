import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-leaflet': path.resolve(__dirname, 'node_modules/react-leaflet'),
    },
  },
  optimizeDeps: {
    include: [
      'react-leaflet',
      'leaflet',
      'uuid',
      'xlsx',
      'file-saver',
      'jspdf',
      'jspdf-autotable',
    ],
  },
  build: {
    rollupOptions: {
      external: [
        'xlsx',
        'file-saver',
        'jspdf',
        'jspdf-autotable'
      ],
    },
  },
});
