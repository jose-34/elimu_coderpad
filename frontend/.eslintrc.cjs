module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/prop-types': 'off',
    'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
  },
  overrides: [
    {
      files: ['public/**/*.js'],
      env: { browser: false, worker: true },
      parserOptions: { sourceType: 'script' },
    },
    {
      files: ['*.config.js', '.eslintrc.cjs'],
      env: { node: true },
    },
  ],
};
