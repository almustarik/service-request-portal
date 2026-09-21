import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Data layer, API route handlers and pure utilities run against a real
        // SQLite file created per worker by the setup file.
        resolve: { alias },
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          include: ['tests/server/**/*.test.ts'],
          setupFiles: ['tests/setup/database.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          globals: true,
          include: ['tests/ui/**/*.test.tsx'],
          setupFiles: ['tests/setup/dom.ts'],
        },
      },
    ],
  },
});
