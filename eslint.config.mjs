import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            // Desabilitado para MVP - habilitar gradualmente com strict mode
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',

            // Boas práticas
            'no-console': 'off',
            'no-debugger': 'warn',
            'prefer-const': 'warn',
            'no-var': 'error',
            'no-unused-vars': 'off',

            // TypeScript específico
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            'coverage/',
            '*.config.*',
            'scripts/',
        ],
    }
);
