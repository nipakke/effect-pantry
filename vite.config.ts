import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: {
    plugins: ['typescript'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
    ignorePatterns: ['.changeset/**', '.github/**', '.opencode/**', '.vite-hooks/**', '.vscode/**', '*.md'],
    overrides: [
      {
        files: ['**/*.test.ts', '**/*.spec.ts'],
        rules: {
          '@typescript-eslint/no-explicit-any': 'off',
        },
      },
    ],
  },
  fmt: {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    ignorePatterns: ['.changeset/**', '.github/**', '.opencode/**', '.vite-hooks/**', '.vscode/**', '*.md'],
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
  },
});
