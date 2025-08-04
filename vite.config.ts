import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from "@tailwindcss/vite" 
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [
        react(),
        tailwindcss(),
      ],
      server: {
        host: '0.0.0.0', // Listen on all network interfaces
        port: 5173, // Default Vite port
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@prisma/client': path.resolve(__dirname, './src/lib/prisma-browser.ts')
        }
      },
      optimizeDeps: {
        exclude: ['@prisma/client']
      },
      build: {
        rollupOptions: {
          external: ['@prisma/client'],
        }
      }
    };
});
