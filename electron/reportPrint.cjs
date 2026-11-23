// Impression du rapport PDF (phase 5 de la refonte de l'export, 22/11) : tout se passe EN LOCAL, dans l'application.
// Le renderer compose le rapport en HTML paginé (src/reports/report) et l'envoie ici ; une fenêtre CACHÉE, sans JavaScript, sans réseau et sans accès à Node,
// le charge depuis un fichier temporaire et le fait imprimer par Chromium (printToPDF) ; la boîte « Enregistrer sous » choisit la destination.
// Aucun navigateur externe, aucun serveur, aucun accès réseau. Le durcissement de la fenêtre principale (pas de nouvelles fenêtres, pas de navigation) est inchangé.
//
// La logique est séparée de main.cjs et reçoit ses dépendances (Electron, système de fichiers) pour pouvoir être testée sans lancer Electron (electron/reportPrint.test.js).
const CHANNEL = 'report:print-pdf';
const MAX_HTML_BYTES = 120 * 1024 * 1024; // un rapport de 50 produits avec logos reste très en dessous
const DEFAULT_NAME = 'rapport.pdf';

/** Nom de fichier proposé : sans chemin ni caractère interdit, toujours en .pdf. */
function safeFileName(name) {
    const base = Array.from(String(name || '')).map(ch => (ch.charCodeAt(0) < 32 ? ' ' : ch)).join('').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim();
    if (!base) return DEFAULT_NAME;
    return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/**
 * @param {object} deps  { app, BrowserWindow, dialog, ipcMain, session, fs, os, path, getMainWindow }
 * @returns {{ handle: Function, CHANNEL: string }}  `handle` est le gestionnaire IPC (exposé pour les tests)
 */
function registerReportPrint(deps) {
    const { app, BrowserWindow, dialog, ipcMain, session, fs, os, path, getMainWindow } = deps;
    let busy = false;

    async function handle(event, payload) {
        const main = getMainWindow();
        // Seule la fenêtre principale de l'application peut demander une impression (jamais une autre fenêtre ni un autre cadre).
        if (!main || main.isDestroyed() || event.sender !== main.webContents) return { status: 'error', message: 'Demande d’impression refusée.' };
        const { html, suggestedName } = payload || {};
        if (typeof html !== 'string' || html.length === 0) return { status: 'error', message: 'Le rapport est vide.' };
        if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return { status: 'error', message: 'Le rapport est trop volumineux pour être imprimé.' };
        if (busy) return { status: 'error', message: 'Une impression est déjà en cours.' };
        busy = true;
        let dir = null, win = null;
        try {
            const choice = await dialog.showSaveDialog(main, {
                title: 'Enregistrer le rapport',
                defaultPath: path.join(app.getPath('documents'), safeFileName(suggestedName)),
                filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
            });
            if (choice.canceled || !choice.filePath) return { status: 'canceled' };
            const target = /\.pdf$/i.test(choice.filePath) ? choice.filePath : `${choice.filePath}.pdf`;

            dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'transfo-rapport-'));
            const htmlPath = path.join(dir, 'rapport.html');
            await fs.promises.writeFile(htmlPath, html, 'utf8');

            // Fenêtre d'impression : cachée, bac à sable, sans Node, sans JavaScript, session isolée dont tout accès réseau est refusé.
            const ses = session.fromPartition(`rapport-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !/^(file|data|blob):/i.test(details.url) }));
            win = new BrowserWindow({
                show: false, width: 794, height: 1123,
                webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true, devTools: false },
            });
            win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            win.webContents.on('will-navigate', (e) => e.preventDefault());
            await win.loadFile(htmlPath);
            const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { marginType: 'none' } });
            await fs.promises.writeFile(target, pdf);
            return { status: 'saved', path: target, bytes: pdf.length };
        } catch (err) {
            return { status: 'error', message: `L’impression du rapport a échoué : ${err && err.message ? err.message : 'erreur inconnue'}` };
        } finally {
            busy = false;
            if (win && !win.isDestroyed()) win.destroy();
            if (dir) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    }

    ipcMain.handle(CHANNEL, handle);
    return { handle, CHANNEL };
}

module.exports = { registerReportPrint, safeFileName, CHANNEL, MAX_HTML_BYTES };
