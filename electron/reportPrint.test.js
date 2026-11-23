/* global Buffer, setTimeout */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import nodePath from 'path';
import nodeOs from 'os';
import nodeFs from 'fs';

// Impression du rapport PDF, côté processus principal (phase 5, 22/11) : testée avec des doublures d'Electron, sans lancer l'application.
const require = createRequire(import.meta.url);
const { registerReportPrint, safeFileName, CHANNEL, MAX_HTML_BYTES } = require('./reportPrint.cjs');

function makeEnv({ filePath = nodePath.join(nodeOs.tmpdir(), `transfo-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`), canceled = false, printError = null, loadError = null } = {}) {
    const mainContents = { id: 'main' };
    const main = { webContents: mainContents, isDestroyed: () => false };
    const created = [];
    class FakeWindow {
        constructor(opts) {
            this.opts = opts; this.destroyed = false; this.handlers = {};
            this.webContents = {
                setWindowOpenHandler: (fn) => { this.openHandler = fn; },
                on: (name, fn) => { this.handlers[name] = fn; },
                printToPDF: vi.fn(async () => { if (printError) throw new Error(printError); return Buffer.from('%PDF-1.4 fake'); }),
            };
            created.push(this);
        }
        loadFile(p) { this.loaded = p; this.loadedHtml = nodeFs.readFileSync(p, 'utf8'); return loadError ? Promise.reject(new Error(loadError)) : Promise.resolve(); }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; }
    }
    const sessionRequests = [];
    const ses = { webRequest: { onBeforeRequest: (fn) => { ses.filter = fn; } } };
    const dialog = { showSaveDialog: vi.fn(async () => ({ canceled, filePath: canceled ? undefined : filePath })) };
    const handlers = {};
    const reg = registerReportPrint({
        app: { getPath: () => nodeOs.tmpdir() }, BrowserWindow: FakeWindow, dialog, ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } },
        session: { fromPartition: (name) => { ses.partition = name; return ses; } }, fs: nodeFs, os: nodeOs, path: nodePath, getMainWindow: () => main,
    });
    return { reg, handlers, mainContents, created, dialog, ses, filePath, sessionRequests };
}
const call = (env, payload, sender) => env.reg.handle({ sender: sender || env.mainContents }, payload);

describe('safeFileName', () => {
    it('retire les caractères interdits et force .pdf', () => {
        expect(safeFileName('Rapport - Boréal / 2026:11?')).toBe('Rapport - Boréal 2026 11.pdf');
        expect(safeFileName('..\\..\\secret')).toBe('secret.pdf');
        expect(safeFileName('déjà.PDF')).toBe('déjà.PDF');
        expect(safeFileName('')).toBe('rapport.pdf');
        expect(safeFileName(undefined)).toBe('rapport.pdf');
    });
});

describe('impression du rapport', () => {
    it('enregistre le canal IPC de l\'impression', () => {
        const env = makeEnv();
        expect(CHANNEL).toBe('report:print-pdf');
        expect(typeof env.handlers[CHANNEL]).toBe('function');
    });

    it('chemin nominal : boîte « Enregistrer sous », impression en fenêtre cachée, fichier écrit, fenêtre et fichier temporaire détruits', async () => {
        const env = makeEnv();
        const r = await call(env, { html: '<html><body>Rapport</body></html>', suggestedName: 'Rapport - Boréal.pdf' });
        expect(r.status).toBe('saved');
        expect(r.path).toBe(env.filePath);
        expect(nodeFs.readFileSync(env.filePath, 'utf8')).toContain('%PDF');
        const win = env.created[0];
        expect(win.loadedHtml).toContain('Rapport');
        expect(win.destroyed).toBe(true);
        await new Promise(res => setTimeout(res, 50));
        expect(nodeFs.existsSync(win.loaded)).toBe(false); // fichier temporaire supprimé
        expect(win.webContents.printToPDF).toHaveBeenCalledWith(expect.objectContaining({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4' }));
        expect(env.dialog.showSaveDialog.mock.calls[0][1].defaultPath.endsWith('Rapport - Boréal.pdf')).toBe(true);
        nodeFs.rmSync(env.filePath, { force: true });
    });

    it('la fenêtre d\'impression est cachée, en bac à sable, sans Node ni JavaScript, sans réseau, sans nouvelle fenêtre ni navigation', async () => {
        const env = makeEnv();
        await call(env, { html: '<p>x</p>' });
        const win = env.created[0], prefs = win.opts.webPreferences;
        expect(win.opts.show).toBe(false);
        expect(prefs).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true });
        expect(win.openHandler()).toEqual({ action: 'deny' });
        const nav = { preventDefault: vi.fn() };
        win.handlers['will-navigate'](nav);
        expect(nav.preventDefault).toHaveBeenCalled();
        // réseau refusé : seuls file:, data: et blob: passent
        const verdict = (url) => { let out; env.ses.filter({ url }, (x) => { out = x; }); return out.cancel; };
        expect(verdict('https://exemple.com/a.png')).toBe(true);
        expect(verdict('http://localhost:5173/x')).toBe(true);
        expect(verdict('file:///tmp/rapport.html')).toBe(false);
        expect(verdict('data:image/png;base64,AAA')).toBe(false);
        expect(env.ses.partition).toMatch(/^rapport-/);
        nodeFs.rmSync(env.filePath, { force: true });
    });

    it('annulation de la boîte « Enregistrer sous » : rien n\'est imprimé ni écrit', async () => {
        const env = makeEnv({ canceled: true });
        const r = await call(env, { html: '<p>x</p>' });
        expect(r).toEqual({ status: 'canceled' });
        expect(env.created).toHaveLength(0);
    });

    it('une demande qui ne vient pas de la fenêtre principale est refusée', async () => {
        const env = makeEnv();
        const r = await call(env, { html: '<p>x</p>' }, { id: 'autre' });
        expect(r.status).toBe('error');
        expect(env.dialog.showSaveDialog).not.toHaveBeenCalled();
        expect(env.created).toHaveLength(0);
    });

    it('un rapport vide, absent ou trop volumineux est refusé', async () => {
        const env = makeEnv();
        for (const payload of [undefined, {}, { html: '' }, { html: 42 }]) expect((await call(env, payload)).status).toBe('error');
        expect(MAX_HTML_BYTES).toBeGreaterThan(10 * 1024 * 1024);
        expect(env.dialog.showSaveDialog).not.toHaveBeenCalled();
    });

    it('un échec d\'impression renvoie une erreur claire et nettoie la fenêtre et le fichier temporaire', async () => {
        const env = makeEnv({ printError: 'mémoire insuffisante' });
        const r = await call(env, { html: '<p>x</p>' });
        expect(r.status).toBe('error');
        expect(r.message).toContain('mémoire insuffisante');
        expect(env.created[0].destroyed).toBe(true);
        await new Promise(res => setTimeout(res, 50));
        expect(nodeFs.existsSync(env.created[0].loaded)).toBe(false);
        expect(nodeFs.existsSync(env.filePath)).toBe(false);
    });

    it('un échec de chargement renvoie une erreur et libère l\'impression suivante', async () => {
        const env = makeEnv({ loadError: 'chargement impossible' });
        expect((await call(env, { html: '<p>x</p>' })).status).toBe('error');
        const env2 = makeEnv();
        expect((await call(env2, { html: '<p>x</p>' })).status).toBe('saved');
        nodeFs.rmSync(env2.filePath, { force: true });
    });

    it('une seule impression à la fois', async () => {
        const env = makeEnv();
        const first = call(env, { html: '<p>1</p>' });
        const second = await call(env, { html: '<p>2</p>' });
        expect(second).toMatchObject({ status: 'error', message: 'Une impression est déjà en cours.' });
        expect((await first).status).toBe('saved');
        nodeFs.rmSync(env.filePath, { force: true });
    });

    it('ajoute .pdf au chemin choisi s\'il manque', async () => {
        const base = nodePath.join(nodeOs.tmpdir(), `transfo-sans-ext-${Date.now()}`);
        const env = makeEnv({ filePath: base });
        const r = await call(env, { html: '<p>x</p>' });
        expect(r.path).toBe(`${base}.pdf`);
        nodeFs.rmSync(r.path, { force: true });
    });
});
