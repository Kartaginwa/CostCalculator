// Enregistrement du rapport PDF côté application (phase 5 de la refonte de l'export, 22/11).
// Dans l'application Electron : le pont du préchargement (window.reportBridge) fait imprimer le rapport par une fenêtre cachée locale, puis ouvre « Enregistrer sous ».
// Hors Electron (navigateur de développement, tests) : repli par la boîte d'impression du navigateur, sur un cadre caché qui ne contient que le rapport.
// Résultat : { status: 'saved' | 'canceled' | 'browser-print' | 'error', path?, message? } : jamais d'exception pour l'appelant.

/** Nom de fichier proposé : « Rapport - <entreprise> - 2026-11-22.pdf ». */
export function suggestedReportName(companyName, date = new Date()) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const company = String(companyName || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return `${company ? `Rapport - ${company} - ` : 'Rapport - '}${day}.pdf`;
}

export const hasPrintBridge = () => typeof window !== 'undefined' && !!window.reportBridge && typeof window.reportBridge.printToPdf === 'function';

function printInHiddenFrame(html) {
    return new Promise((resolve) => {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:210mm;height:297mm;border:0';
        const cleanup = () => setTimeout(() => frame.remove(), 1000);
        frame.onload = () => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
                resolve({ status: 'browser-print' });
            } catch (err) {
                resolve({ status: 'error', message: `L’impression du rapport a échoué : ${err.message}` });
            }
            cleanup();
        };
        frame.srcdoc = html;
        document.body.appendChild(frame);
    });
}

/** Imprime et enregistre le rapport. `html` : le document complet produit par buildReport. */
export async function saveReportPdf(html, suggestedName) {
    try {
        if (hasPrintBridge()) return await window.reportBridge.printToPdf(html, suggestedName);
        return await printInHiddenFrame(html);
    } catch (err) {
        return { status: 'error', message: `L’impression du rapport a échoué : ${err && err.message ? err.message : 'erreur inconnue'}` };
    }
}

/**
 * Une image sous forme d'URL « data: » : la fenêtre d'impression n'a aucun accès au réseau ni aux fichiers de l'application, les logos doivent donc être intégrés au rapport.
 * Renvoie null (pas de logo, jamais une erreur) si l'image est absente ou illisible.
 */
export async function toDataUrl(url) {
    if (!url) return null;
    if (/^data:/i.test(url)) return url;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null); reader.onerror = () => resolve(null); reader.readAsDataURL(blob); });
    } catch {
        return null;
    }
}
