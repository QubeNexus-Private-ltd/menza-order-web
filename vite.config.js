import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import 'dotenv/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      tailwindcss(),
      react(),
    ],
    define: {
      global: 'window',
    },
    resolve: {
      alias: {
        'react-native': 'react-native-web',
      },
      extensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx', '.json'],
    },
    server: {
      port: Number(env.PORT || env.VITE_PORT) || 3000,
      open: true,
    },
  };
});
