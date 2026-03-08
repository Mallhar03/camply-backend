import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/vitest.setup.ts'],
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/controllers/**',
        'src/middleware/**',
        'src/services/**',
        'src/utils/**',
      ],
      exclude: [
        'src/config/**',
        'src/server.ts',
      ],
    },
  },
})
