import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    { ignores: ['dist/**', 'release/**', 'node_modules/**', 'public/libs/**'] },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            // jsPDF, jspdf-autotable et XLSX sont chargés via des balises <script> dans
            // index.html (voir scripts/copy-libs.cjs) plutôt qu'importés comme modules.
            globals: { ...globals.browser, ...globals.es2021, XLSX: 'readonly' },
        },
        plugins: { react, 'react-hooks': reactHooks },
        rules: {
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            // App entièrement en français : les apostrophes dans le texte UI (d'œuvre,
            // l'ingrédient, etc.) sont légitimes et beaucoup trop fréquentes pour être échappées.
            'react/no-unescaped-entities': 'off',
            // Règle orientée React Compiler, trop stricte pour ce code : synchroniser un état
            // local sur l'ouverture d'une modale (useEffect(() => { if (isOpen) setX(...) },
            // [isOpen])) est un pattern correct et très répandu ici. Signalé mais non bloquant.
            'react-hooks/set-state-in-effect': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
        settings: { react: { version: 'detect' } },
    },
    {
        files: ['src/**/*.test.js'],
        languageOptions: {
            globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', vi: 'readonly' },
        },
    },
    {
        files: ['electron/**/*.cjs', 'scripts/**/*.cjs', '*.config.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },
    {
        files: ['*.config.mjs', 'eslint.config.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },
];
