'use strict';

const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/web-build/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.cjs',
      '**/eslint.config.js',
      '**/eslint.config.cjs',
    ],
  },
  ...tseslint.configs.recommended,
);