// Impression du rapport PDF dans la VRAIE application Electron (phase 5 de la refonte de l'export, 22/11) : le renderer compose le rapport du démo, le pont du
// préchargement le fait imprimer par une fenêtre cachée locale, le PDF est enregistré. Vérifie aussi que le durcissement de la fenêtre principale est intact
// (renderer en bac à sable, rien d'exposé sauf le pont d'impression, pas de nouvelles fenêtres).
import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const launch = () => {
    const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' };
    delete env.ELECTRON_RUN_AS_NODE; // hérité de VS Code : empêche Electron de démarrer (voir les pièges de l'environnement)
    return electron.launch({ args: ['.'], env });
};

test('Electron : le rapport du démo s\'imprime en PDF dans un fichier, et le durcissement reste intact', async () => {
    test.setTimeout(180000);
    const target = path.join(os.tmpdir(), `transfo-rapport-e2e-${Date.now()}.pdf`);
    const app = await launch();
    try {
        const win = await app.firstWindow();
        await win.waitForLoadState('domcontentloaded');

        // Durcissement : rien n'est exposé sauf le pont d'impression ; pas de Node dans le renderer
        const exposed = await win.evaluate(() => ({ bridge: Object.keys(window.reportBridge || {}), nodeRequire: typeof require, nodeProcess: typeof process, electron: typeof window.electron, ipc: typeof window.ipcRenderer }));
        expect(exposed).toEqual({ bridge: ['printToPdf'], nodeRequire: 'undefined', nodeProcess: 'undefined', electron: 'undefined', ipc: 'undefined' });
        const opened = await win.evaluate(() => window.open('https://example.com') === null);
        expect(opened).toBe(true);
        expect(app.windows()).toHaveLength(1);

        // La boîte « Enregistrer sous » est remplacée par un chemin imposé
        await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);

        const out = await win.evaluate(async () => {
            const { demoInputs } = await import('/src/engine/testing/demoFindingsContext.js');
            const { buildReport } = await import('/src/reports/report/buildReport.js');
            const { saveReportPdf, suggestedReportName } = await import('/src/reports/exportPdf.js');
            const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
            const r = await buildReport({ project: { ...state, trackingPoints, companyName: 'Boréal Mets Préparés inc.' }, analysisData, calculatedGeneralInfo }, { generatedOn: new Date(2026, 10, 22) });
            const t0 = performance.now();
            const saved = await saveReportPdf(r.html, suggestedReportName('Boréal Mets Préparés inc.', new Date(2026, 10, 22)));
            return { saved, pages: r.totalPages, printMs: Math.round(performance.now() - t0), htmlKb: Math.round(r.html.length / 1024) };
        });
        expect(out.saved.status).toBe('saved');
        expect(out.saved.path).toBe(target);
        expect(out.printMs).toBeLessThan(30000);

        const buf = fs.readFileSync(target);
        expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
        expect(doc.numPages).toBe(out.pages); // une feuille composée = une page imprimée
        const texts = [];
        for (let i = 1; i <= doc.numPages; i++) texts.push((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
        const all = texts.join('\n');
        expect(all).not.toMatch(/NaN|undefined/);
        expect(all).toContain('Boréal Mets Préparés inc.');
        expect(all).toContain('Synthèse de direction');
        expect(texts[3]).toContain(`Page 4 sur ${out.pages}`);

        // Annulation : rien n'est écrit
        await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
        const cancelPath = path.join(os.tmpdir(), `transfo-annule-${Date.now()}.pdf`);
        const canceled = await win.evaluate(async () => (await window.reportBridge.printToPdf('<html><body>x</body></html>', 'x.pdf')));
        expect(canceled).toEqual({ status: 'canceled' });
        expect(fs.existsSync(cancelPath)).toBe(false);

        // Une impression vide est refusée proprement
        const empty = await win.evaluate(async () => (await window.reportBridge.printToPdf('', 'x.pdf')));
        expect(empty.status).toBe('error');
    } finally {
        await app.close();
        fs.rmSync(target, { force: true });
    }
});

test('Electron en mode production (application construite, chargée depuis dist) : pont présent et impression locale', async () => {
    test.setTimeout(120000);
    test.skip(!fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')), 'dist absent : lancer « npm run build » d\'abord');
    const target = path.join(os.tmpdir(), `transfo-prod-e2e-${Date.now()}.pdf`);
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.VITE_DEV_SERVER_URL;
    const app = await electron.launch({ args: ['.'], env });
    try {
        const win = await app.firstWindow();
        await win.waitForLoadState('domcontentloaded');
        expect(win.url()).toMatch(/^file:/);
        const exposed = await win.evaluate(() => ({ bridge: Object.keys(window.reportBridge || {}), nodeRequire: typeof require, nodeProcess: typeof process }));
        expect(exposed).toEqual({ bridge: ['printToPdf'], nodeRequire: 'undefined', nodeProcess: 'undefined' });
        await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);
        const html = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}</style></head><body><h1>Essai d’impression</h1><p>Texte sélectionnable.</p></body></html>';
        const res = await win.evaluate(async (h) => window.reportBridge.printToPdf(h, 'essai.pdf'), html);
        expect(res.status).toBe('saved');
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(target)), useSystemFonts: true }).promise;
        expect(doc.numPages).toBe(1);
        expect((await (await doc.getPage(1)).getTextContent()).items.map(t => t.str).join(' ')).toContain('Essai d’impression');
    } finally {
        await app.close();
        fs.rmSync(target, { force: true });
    }
});

test('Electron, de bout en bout par l\'interface : bouton, fenêtre d\'export, choix, PDF enregistré', async () => {
    test.setTimeout(240000);
    const target = path.join(os.tmpdir(), `transfo-ui-e2e-${Date.now()}.pdf`);
    const app = await launch();
    try {
        const win = await app.firstWindow();
        await win.waitForLoadState('domcontentloaded');
        await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);

        await win.getByText('Explorer un projet démo').click();
        await expect(win.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();
        await win.locator('#tab-summary').click();
        await win.getByText('Générer un rapport PDF').click();
        const dialog = win.getByRole('dialog', { name: 'Exporter le rapport PDF' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('checkbox', { name: 'Inclure le chapitre 7' }).uncheck(); // sans les fiches : rapport plus court
        await dialog.getByRole('button', { name: /1\. Synthèse/ }).click();
        await dialog.getByLabel(/Commentaire de la direction/).fill('Commentaire de bout en bout.');
        await dialog.getByRole('button', { name: 'Générer le PDF' }).click();
        await expect(win.getByText(/Rapport enregistré :/)).toBeVisible({ timeout: 120000 });
        await expect(dialog).toHaveCount(0);

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(target)), useSystemFonts: true }).promise;
        expect(doc.numPages).toBeGreaterThan(15);
        const texts = [];
        for (let i = 1; i <= doc.numPages; i++) texts.push((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
        const all = texts.join('\n');
        expect(all).toContain('Commentaire de la direction');
        expect(all).toContain('Commentaire de bout en bout.');
        expect(all).not.toContain('Comment lire une fiche'); // chapitre 7 décoché
        expect(all).not.toMatch(/NaN|undefined/);
        expect(texts.at(-1)).toContain(`Page ${doc.numPages} sur ${doc.numPages}`);
    } finally {
        // Les choix d'export enregistrés avec le projet le rendent « modifié » : une fermeture normale déclencherait la confirmation de sortie. On quitte directement.
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
        fs.rmSync(target, { force: true });
    }
});

test('Application EMPAQUETÉE (exécutable construit par electron-builder, code dans l\'archive asar) : export de bout en bout par l\'interface', async () => {
    test.setTimeout(240000);
    const exe = path.join(process.cwd(), 'release', 'win-unpacked', 'RestoCalculateur.exe');
    test.skip(!fs.existsSync(exe), 'application empaquetée absente : lancer « npm run build » puis « npx electron-builder --win --dir »');
    const target = path.join(os.tmpdir(), `transfo-paquet-e2e-${Date.now()}.pdf`);
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.VITE_DEV_SERVER_URL;
    const app = await electron.launch({ executablePath: exe, env });
    try {
        const win = await app.firstWindow();
        await win.waitForLoadState('domcontentloaded');
        expect(win.url()).toMatch(/^file:/);
        expect(await win.evaluate(() => ({ bridge: Object.keys(window.reportBridge || {}), nodeRequire: typeof require, nodeProcess: typeof process }))).toEqual({ bridge: ['printToPdf'], nodeRequire: 'undefined', nodeProcess: 'undefined' });
        await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);
        await win.getByText('Explorer un projet démo').click();
        await expect(win.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();
        await win.locator('#tab-summary').click();
        await win.getByText('Générer un rapport PDF').click();
        const dialog = win.getByRole('dialog', { name: 'Exporter le rapport PDF' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Générer le PDF' }).click();
        await expect(win.getByText(/Rapport enregistré :/)).toBeVisible({ timeout: 120000 });
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(target)), useSystemFonts: true }).promise;
        expect(doc.numPages).toBeGreaterThan(35);
        const texts = [];
        for (let i = 1; i <= doc.numPages; i++) texts.push((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
        const all = texts.join('\n');
        expect(all).toContain('Synthèse de direction');
        expect(all).toContain('Annexe D');
        expect(all).not.toMatch(/NaN|undefined/);
        expect(texts.at(-1)).toContain(`Page ${doc.numPages} sur ${doc.numPages}`);
    } finally {
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
        fs.rmSync(target, { force: true });
    }
});
