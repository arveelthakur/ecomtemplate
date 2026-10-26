import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';


const port = Number(process.env.PORT || '5000');

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'nura-preloader-supabase-settings',
      apply: 'serve',
      async transformIndexHtml(html) {
        if (!html.includes('id="nura-preloader-config"')) return html;
        try {
          const { renderAppShellWithCurrentPreloader } = await import('./scripts/prerender-seo.mjs');
          return await renderAppShellWithCurrentPreloader(html);
        } catch (error) {
          const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownError';
          console.warn(
            '[preloader] Could not read saved settings for the development page; using its safe HTML defaults:',
            reason,
          );
          return html;
        }
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(import.meta.dirname, 'src'),
      },
      {
        find: /^lucide-react$/,
        replacement: path.resolve(import.meta.dirname, 'src/lib/lucide-icons.ts'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          const packages = [...id.matchAll(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/g)];
          const packageName = packages.at(-1)?.[1];
          if (['react', 'react-dom', 'react-router', 'react-router-dom', '@remix-run/router', 'scheduler'].includes(packageName ?? '')) return 'react-vendor';
          if (packageName === '@supabase/supabase-js' || packageName?.startsWith('@supabase/')) return 'supabase-vendor';
          if (packageName === 'react-icons') return 'social-icons';
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
