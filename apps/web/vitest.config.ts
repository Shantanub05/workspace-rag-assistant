import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.ts'],
    passWithNoTests: true,
  },
});
