import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react-leaflet',
      'leaflet',
      'uuid',
      'xlsx',
      'file-saver',
      'jspdf',
      'jspdf-autotable'
    ],
  },
  build: {
    rollupOptions: {
      external: [
        'xlsx',
        'file-saver',
        'jspdf',
        'jspdf-autotable'
        // IMPORTANT : on ne met pas react-leaflet ici
      ],
    },
  },
});
