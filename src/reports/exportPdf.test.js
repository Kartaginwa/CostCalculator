import { describe, it, expect, vi, afterEach } from 'vitest';
import { suggestedReportName, saveReportPdf, hasPrintBridge } from './exportPdf.js';

// Côté application : nom proposé et choix entre le pont Electron et le repli. (Le repli par cadre caché demande un DOM : testé par Playwright.)
afterEach(() => { delete globalThis.window; });

describe('suggestedReportName', () => {
    it('« Rapport - entreprise - date.pdf », sans caractère interdit', () => {
        expect(suggestedReportName('Boréal Mets Préparés inc.', new Date(2026, 10, 22))).toBe('Rapport - Boréal Mets Préparés inc. - 2026-11-22.pdf');
        expect(suggestedReportName('A/B:C*', new Date(2026, 0, 5))).toBe('Rapport - A B C - 2026-01-05.pdf');
        expect(suggestedReportName('', new Date(2026, 0, 5))).toBe('Rapport - 2026-01-05.pdf');
    });
});

describe('saveReportPdf', () => {
    it('utilise le pont Electron quand il existe', async () => {
        const printToPdf = vi.fn(async () => ({ status: 'saved', path: 'C:/r.pdf' }));
        globalThis.window = { reportBridge: { printToPdf } };
        expect(hasPrintBridge()).toBe(true);
        expect(await saveReportPdf('<html></html>', 'r.pdf')).toEqual({ status: 'saved', path: 'C:/r.pdf' });
        expect(printToPdf).toHaveBeenCalledWith('<html></html>', 'r.pdf');
    });
    it('une exception du pont devient une erreur lisible, jamais une exception', async () => {
        globalThis.window = { reportBridge: { printToPdf: async () => { throw new Error('canal fermé'); } } };
        const r = await saveReportPdf('<html></html>', 'r.pdf');
        expect(r.status).toBe('error');
        expect(r.message).toContain('canal fermé');
    });
    it('sans pont ni fenêtre, pas de pont détecté', () => {
        expect(hasPrintBridge()).toBe(false);
        globalThis.window = {};
        expect(hasPrintBridge()).toBe(false);
    });
});
