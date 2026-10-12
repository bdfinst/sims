import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import globals from 'globals'

export default [
  js.configs.recommended,
  react.configs.flat['jsx-runtime'],
  prettier,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      // JSX usage counts as a use of the identifier
      'react/jsx-uses-vars': 'error',

      // Functional style: no classes
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'Use functions and closures instead of classes.',
        },
        {
          selector: 'ClassExpression',
          message: 'Use functions and closures instead of classes.',
        },
        {
          selector: 'ThisExpression',
          message: 'Avoid "this" — use closures and explicit parameters instead.',
        },
      ],

      // Immutability
      'prefer-const': 'error',
      'no-var': 'error',
      'no-param-reassign': 'error',

      // Clean code
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
    },
  },
  // The engine and reducer are pure: no React, icons, components, or presentation config.
  {
    files: ['src/engine.js', 'src/reducer.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'lucide-react',
                'lucide-react/*',
                './components/*',
                '**/components/*',
                './laneConfig*',
                '**/laneConfig*',
              ],
              message:
                'engine.js and reducer.js must stay pure: no React, icons, components, or laneConfig.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'playwright-report/',
      'test-results/',
    ],
  },
]
