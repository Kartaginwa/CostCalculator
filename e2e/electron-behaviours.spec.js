// Comportements propres à Electron, que le navigateur de test ne voit pas (ajouté le 24/11 avec la montée d'Electron) :
//  1. la boîte « Modifications non sauvegardées » à la fermeture de la fenêtre (electron/main.cjs, événement will-prevent-unload) :
//     « Rester » garde la fenêtre ouverte, « Quitter sans sauvegarder » la ferme ;
//  2. la voix de la visite guidée se lance vraiment dans l'application (lecture automatique de Chromium, CSP, fichiers audio dans dist) ;
//  3. « Sauvegarder » écrit le fichier du projet (téléchargement Blob géré par Electron) et « Ouvrir » charge un projet depuis un fichier.
// Chaque test tourne contre l'application construite (dist, `npm run build`) et, si elle existe, contre l'exécutable empaqueté
// (`npx electron-builder --win --dir`), seul à prouver que les fichiers audio sont bien dans l'archive asar.
import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PACKAGED = path.join(process.cwd(), 'release', 'win-unpacked', 'RestoCalculateur.exe');
const MODES = [
    { name: 'application construite (dist)', options: () => ({ args: ['.'] }), available: () => fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')) },
    { name: 'application empaquetée', options: () => ({ executablePath: PACKAGED }), available: () => fs.existsSync(PACKAGED) },
];

const launch = (mode) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE; // hérité de VS Code : empêche Electron de démarrer
    delete env.VITE_DEV_SERVER_URL;  // on teste le code construit, pas le serveur de développement
    return electron.launch({ ...mode.options(), env });
};

for (const mode of MODES) {
    test.describe(mode.name, () => {
        test.skip(!mode.available(), `${mode.name} absente : lancer « npm run build » (et « npx electron-builder --win --dir »)`);

        test("La version d'Electron qui tourne est celle installée (jamais un ancien exécutable)", async () => {
            test.setTimeout(60000);
            const installed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules', 'electron', 'package.json'), 'utf8')).version;
            const app = await launch(mode);
            try {
                const versions = await app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }));
                console.log(`VERSIONS (${mode.name}) : Electron ${versions.electron}, Chromium ${versions.chrome}, Node ${versions.node}`);
                expect(versions.electron).toBe(installed);
            } finally {
                await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
            }
        });

        test('Fermeture avec des modifications : « Rester » garde la fenêtre, « Quitter » la ferme', async () => {
            test.setTimeout(120000);
            const app = await launch(mode);
            try {
                const win = await app.firstWindow();
                await win.getByText('Créer un nouveau projet').click();
                const skip = win.getByText('Explorer par moi-même');
                if (await skip.count() > 0) await skip.click();
                await win.locator('input[type="text"]').first().fill('Entreprise test');
                await expect(win.getByTestId('unsaved-indicator')).toBeVisible();

                // On remplace la boîte native (qui bloquerait le test) par un choix programmé, et on compte les appels.
                await app.evaluate(({ dialog }) => {
                    globalThis.__fermeture = { appels: 0, choix: 0 };
                    dialog.showMessageBoxSync = () => { globalThis.__fermeture.appels += 1; return globalThis.__fermeture.choix; };
                });

                // « Rester » (choix 0) : la boîte s'ouvre une fois, la fenêtre reste ouverte.
                await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
                await expect.poll(() => app.evaluate(() => globalThis.__fermeture.appels)).toBe(1);
                expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
                await expect(win.getByTestId('unsaved-indicator')).toBeVisible(); // le travail est intact

                // « Quitter sans sauvegarder » (choix 1) : la fenêtre se ferme.
                await app.evaluate(() => { globalThis.__fermeture.choix = 1; });
                const closed = win.waitForEvent('close');
                await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
                await closed;
            } finally {
                await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
            }
        });

        test('Sauvegarder écrit le fichier du projet, et Ouvrir charge un projet depuis un fichier', async () => {
            test.setTimeout(120000);
            const stamp = Date.now();
            const target = path.join(os.tmpdir(), `transfo-projet-${stamp}.json`);
            const modified = path.join(os.tmpdir(), `transfo-projet-modifie-${stamp}.json`);
            const app = await launch(mode);
            try {
                const win = await app.firstWindow();
                await win.getByText('Créer un nouveau projet').click();
                const skip = win.getByText('Explorer par moi-même');
                if (await skip.count() > 0) await skip.click();
                await win.locator('#tutorial-company-name').fill('Entreprise test');
                await expect(win.getByTestId('unsaved-indicator')).toBeVisible();

                // Le téléchargement (Blob + lien) est dirigé vers un fichier choisi, au lieu de la boîte native « Enregistrer sous ».
                await app.evaluate(({ session }, savePath) => {
                    globalThis.__telechargement = { etat: 'attente' };
                    session.defaultSession.once('will-download', (event, item) => {
                        item.setSavePath(savePath);
                        item.once('done', (e, state) => { globalThis.__telechargement = { etat: state, nom: item.getFilename() }; });
                    });
                }, target);
                await win.getByRole('button', { name: /Sauvegarder/ }).click();
                await expect.poll(() => app.evaluate(() => globalThis.__telechargement.etat), { timeout: 15000 }).toBe('completed');
                expect(await app.evaluate(() => globalThis.__telechargement.nom)).toBe('projet_cout_revient_Entreprise_test.json');
                const saved = JSON.parse(fs.readFileSync(target, 'utf8'));
                expect(saved.companyName).toBe('Entreprise test');
                await expect(win.getByTestId('unsaved-indicator')).toHaveCount(0);

                // Ouvrir : un fichier de projet (légèrement modifié) est chargé par le champ fichier de l'application.
                saved.companyName = 'Chargé depuis un fichier';
                fs.writeFileSync(modified, JSON.stringify(saved));
                await win.locator('input[type="file"][accept=".json"]').setInputFiles(modified);
                await expect(win.locator('#tutorial-company-name')).toHaveValue('Chargé depuis un fichier');
                await expect(win.getByTestId('unsaved-indicator')).toHaveCount(0);
            } finally {
                await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
                fs.rmSync(target, { force: true });
                fs.rmSync(modified, { force: true });
            }
        });

        test('La voix de la visite guidée se lance et avance dans l\'application', async () => {
            test.setTimeout(120000);
            const app = await launch(mode);
            try {
                const win = await app.firstWindow();
                // On observe chaque lecture audio demandée par la page (sans la modifier).
                await win.evaluate(() => {
                    window.__audio = [];
                    const original = HTMLMediaElement.prototype.play;
                    HTMLMediaElement.prototype.play = function (...args) {
                        const entry = { src: this.currentSrc || this.src, resolved: null, error: null, element: this };
                        window.__audio.push(entry);
                        const p = original.apply(this, args);
                        if (p && p.then) p.then(() => { entry.resolved = true; }, (e) => { entry.resolved = false; entry.error = String(e && e.message); });
                        return p;
                    };
                });
                await win.getByTestId('start-tour').click();
                await expect(win.getByTestId('tour-caption')).toContainText('combien coûte vraiment');
                await expect.poll(() => win.evaluate(() => window.__audio.length), { timeout: 15000 }).toBeGreaterThan(0);
                // la lecture est acceptée, sans erreur, et le temps de lecture avance
                await expect.poll(() => win.evaluate(() => window.__audio[0].resolved), { timeout: 15000 }).toBe(true);
                await expect.poll(() => win.evaluate(() => window.__audio[0].element.currentTime), { timeout: 15000 }).toBeGreaterThan(0.3);
                const info = await win.evaluate(() => ({ src: window.__audio[0].src, error: window.__audio[0].error, mediaError: window.__audio[0].element.error && window.__audio[0].element.error.code }));
                expect(info.error).toBeNull();
                expect(info.mediaError).toBeFalsy();
                expect(info.src).toMatch(/intro-bienvenue/); // la carte de titre du premier chapitre est parlée avant la première scène
                await win.keyboard.press('Escape');
            } finally {
                await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
            }
        });
    });
}
