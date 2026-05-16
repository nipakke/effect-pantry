import type { OxlintConfig } from 'vite-plus/lint';
import type { OxfmtConfig } from 'vite-plus/fmt';

/**
 * Shared lint configuration for all packages.
 */
export const sharedLint: OxlintConfig = {
  plugins: ['typescript'],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['*.md'],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};

/**
 * Shared format configuration for all packages.
 */
export const sharedFmt: OxfmtConfig = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  ignorePatterns: ['*.md'],
};
