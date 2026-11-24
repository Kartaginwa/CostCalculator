import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: false,
    reporter: 'list',
    // Les tests Electron ouvrent de vraies fenêtres Chromium : lancés en même temps que les tests du navigateur, ils ralentissent la
    // machine au point de faire échouer, au hasard, des tests sensibles au temps (visite guidée, sélecteur de sous-recettes). Ils
    // forment donc un second projet qui ne démarre qu'une fois le premier terminé (24/11, montée d'Electron).
    // Pour lancer UN fichier Electron seul, sans refaire tous les tests du navigateur : `npx playwright test --no-deps e2e/electron-xxx.spec.js`.
    projects: [
        { name: 'navigateur', testIgnore: /electron-.*\.spec\.js/ },
        { name: 'electron', testMatch: /electron-.*\.spec\.js/, dependencies: ['navigateur'] },
    ],
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
    },
});
