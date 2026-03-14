import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/js/**/*.test.js'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text'],
      include: ['mee6/web/static/js/**/*.js'],
      exclude: [
        'mee6/web/static/js/rendering-sandbox.html',
        'mee6/web/static/js/state-sandbox.html',
        '**/*.test.js'
      ],
      all: false,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  },
});
