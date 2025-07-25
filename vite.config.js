import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'uuid',
      'xlsx',
      'file-saver',
      'jspdf',
      'jspdf-autotable',
      'react-leaflet',
      'leaflet'
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
