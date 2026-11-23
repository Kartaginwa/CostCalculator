import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToExcel } from './exportToExcel.js';

// Ces tests valident deux choses : (1) que les modules de rapport s'importent sans erreur (ils
// tirent utils.js, initialState.js, calculateCosts.js, les moteurs de constats — donc une régression
// d'import serait attrapée ici), et (2) que le garde-fou « bibliothèque non chargée » de l'export Excel
// se comporte proprement (notification d'erreur + retour anticipé, sans planter). Le rapport PDF
// (composition, impression, fenêtre d'export) est couvert par src/reports/report/*.test.js et par les
// tests Playwright e2e/report-*.spec.js et e2e/electron-report.spec.js ; l'export Excel de bout en bout
// par e2e/smoke.spec.js.

afterEach(() => {
    delete globalThis.window;
    delete globalThis.XLSX;
});

describe('modules du rapport PDF : importables sans navigateur', () => {
    it('le modèle, les gabarits, le flux d\'export et le pont d\'impression se chargent', async () => {
        const [model, build, flow, print] = await Promise.all([import('./report/model.js'), import('./report/buildReport.js'), import('./exportFlow.js'), import('./exportPdf.js')]);
        expect(typeof model.buildReportModel).toBe('function');
        expect(typeof build.buildReport).toBe('function');
        expect(typeof build.buildUnits).toBe('function');
        expect(typeof flow.prepareReportModel).toBe('function');
        expect(typeof flow.runReportExport).toBe('function');
        expect(typeof print.saveReportPdf).toBe('function');
    });
});

describe('exportToExcel — garde-fou bibliothèque Excel', () => {
    it("notifie une erreur et n'émet aucune exception si XLSX est absent", () => {
        // XLSX n'est pas défini dans l'environnement de test (node) : le garde-fou doit se déclencher.
        const showNotification = vi.fn();

        expect(() => exportToExcel({ showNotification })).not.toThrow();
        expect(showNotification).toHaveBeenCalledTimes(1);
        expect(showNotification.mock.calls[0][0]).toMatchObject({ type: 'error' });
    });
});
