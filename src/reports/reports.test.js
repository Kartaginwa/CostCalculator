import { describe, it, expect, vi, afterEach } from 'vitest';
import XLSXLib from 'xlsx-js-style';
import { exportToExcel } from './exportToExcel.js';
import { demoInputs } from '../engine/testing/demoFindingsContext.js';

// Ces tests valident deux choses : (1) que les modules de rapport s'importent sans erreur (ils
// tirent utils.js, initialState.js, calculateCosts.js, les moteurs de constats — donc une régression
// d'import serait attrapée ici), et (2) que le garde-fou « bibliothèque non chargée » de l'export Excel
// se comporte proprement (notification d'erreur + retour anticipé, sans planter). Le rapport PDF
// (composition, impression, fenêtre d'export) est couvert par src/reports/report/*.test.js et par les
// tests Playwright e2e/report-*.spec.js et e2e/electron-report.spec.js ; l'export Excel de bout en bout
// par e2e/smoke.spec.js, e2e/excel-export.spec.js et src/reports/excel/model.test.js.

afterEach(() => {
    delete globalThis.window;
    delete globalThis.XLSX;
});

describe('modules du rapport PDF : importables sans navigateur', () => {
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

describe('exportToExcel — export de bout en bout (bibliothèque présente)', () => {
    it("écrit un classeur nommé d'après l'entreprise et notifie le succès", () => {
        const writeFile = vi.fn();
        globalThis.window = { XLSX: { ...XLSXLib, writeFile } };
        const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
        const showNotification = vi.fn();
        exportToExcel({ showNotification, analysisData, calculatedGeneralInfo, companyName: 'Ma Transfo', project: { ...state, baseIngredients: state.ingredientsList, trackingPoints } });
        expect(showNotification).toHaveBeenCalledTimes(1);
        expect(showNotification.mock.calls[0][0]).toMatchObject({ type: 'success' });
        expect(writeFile).toHaveBeenCalledTimes(1);
        const [wb, fileName] = writeFile.mock.calls[0];
        expect(fileName).toBe('base_de_donnees_Ma_Transfo.xlsx');
        expect(wb.SheetNames[0]).toBe('Lisez-moi');
    });
    it("une panne à l'écriture du fichier est signalée dans la notification, sans exception", () => {
        globalThis.window = { XLSX: { ...XLSXLib, writeFile: () => { throw new Error('disque plein'); } } };
        const showNotification = vi.fn();
        const { state, analysisData, calculatedGeneralInfo } = demoInputs();
        expect(() => exportToExcel({ showNotification, analysisData, calculatedGeneralInfo, companyName: '', project: state })).not.toThrow();
        expect(showNotification.mock.calls[0][0]).toMatchObject({ type: 'error' });
        expect(showNotification.mock.calls[0][0].message).toContain('disque plein');
    });
});
