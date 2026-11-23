// Repli hors Electron (phase 5, 22/11) : sans pont d'impression, le rapport s'imprime par la boîte d'impression du navigateur, dans un cadre caché qui ne
// contient que le rapport (le reste de la page n'est pas imprimé).
import { test, expect } from '@playwright/test';

test('sans pont Electron : impression par un cadre caché, puis nettoyage', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(async () => {
        const { saveReportPdf, hasPrintBridge } = await import('/src/reports/exportPdf.js');
        let printed = null, frameCount = 0;
        const original = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
        // La boîte d'impression d'un navigateur ne se pilote pas : on observe l'appel à print() du cadre caché.
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            configurable: true,
            get() { const w = original.call(this); return new Proxy(w, { get: (t, k) => (k === 'print' ? () => { printed = t.document.body.textContent.trim(); frameCount = document.querySelectorAll('iframe[aria-hidden="true"]').length; } : k === 'focus' ? () => {} : t[k]) }); },
        });
        const bridge = hasPrintBridge();
        const r = await saveReportPdf('<!doctype html><html><body>Rapport de test</body></html>', 'r.pdf');
        await new Promise(res => setTimeout(res, 1300));
        return { bridge, r, printed, frameCount, left: document.querySelectorAll('iframe[aria-hidden="true"]').length };
    });
    expect(out.bridge).toBe(false);
    expect(out.r).toEqual({ status: 'browser-print' });
    expect(out.printed).toBe('Rapport de test');
    expect(out.frameCount).toBe(1);
    expect(out.left).toBe(0);
});
