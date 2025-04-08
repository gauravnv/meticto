// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use global APIs like describe, it, expect
    environment: 'node', // Specify Node environment
    // setupFiles: ['./src/test/setup.ts'], // If you need setup files
    // include: ['src/**/*.test.ts'], // Default pattern
  },
});