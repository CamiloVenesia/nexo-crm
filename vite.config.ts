
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    sourcemap: false,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const path = id.replace(/\\/g, '/');

          if (!path.includes('/node_modules/')) {
            return;
          }

          // React y sus dependencias principales.
          if (
            path.includes('/node_modules/react/') ||
            path.includes('/node_modules/react-dom/') ||
            path.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          // Supabase.
          if (path.includes('/node_modules/@supabase/')) {
            return 'supabase-vendor';
          }

          // Biblioteca de iconos.
          if (path.includes('/node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },
});
