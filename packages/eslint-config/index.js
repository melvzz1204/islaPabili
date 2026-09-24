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
      '**/eslint.config.js',
    ],
  },
  ...tseslint.configs.recommended,
);