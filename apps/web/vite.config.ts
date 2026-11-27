import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    manifest: true,
    cssMinify: 'lightningcss',
    // rollupOptions: {
    //   plugins: [
    //     corejsPlugin({
    //       targets: ['baseline widely available', 'Firefox ESR'],
    //       exclude: [/^esnext\./],
    //     }),
    //   ],
    // },
  },
  plugins: [tailwindcss(), reactRouter(), reactRouterHonoServer()],
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
});
