// Préchargement (renderer en bac à sable, contexte isolé) : l'UNIQUE pont exposé à l'application est l'impression du rapport PDF (phase 5, 22/11).
// Rien d'autre n'est exposé : ni Node, ni système de fichiers, ni ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reportBridge', {
    /** Fait imprimer en PDF un rapport HTML déjà paginé, après une boîte « Enregistrer sous ». Renvoie { status: 'saved' | 'canceled' | 'error', path?, message? }. */
    printToPdf: (html, suggestedName) => ipcRenderer.invoke('report:print-pdf', { html: String(html), suggestedName: suggestedName == null ? '' : String(suggestedName) }),
});
