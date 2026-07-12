import { describe, it, expect, vi, afterEach } from 'vitest';
import { generatePdf } from './generatePdf.js';
import { exportToExcel } from './exportToExcel.js';

// Ces tests valident deux choses : (1) que les modules de rapport s'importent sans erreur (ils
// tirent utils.js, initialState.js, calculateCosts.js — donc une régression d'import serait
// attrapée ici), et (2) que le garde-fou « bibliothèque non chargée » se comporte proprement
// (notification d'erreur + retour anticipé, sans planter). La génération complète avec les vraies
// bibliothèques jsPDF/XLSX est couverte de bout en bout par le test E2E (e2e/smoke.spec.js).

afterEach(() => {
    delete globalThis.window;
    delete globalThis.XLSX;
});

describe('generatePdf — garde-fou bibliothèque PDF', () => {
    it("notifie une erreur et n'émet aucune exception si jsPDF est absent", () => {
        globalThis.window = {}; // window existe mais window.jspdf est indéfini
        const showNotification = vi.fn();

        expect(() => generatePdf({}, { showNotification })).not.toThrow();
        expect(showNotification).toHaveBeenCalledTimes(1);
        expect(showNotification.mock.calls[0][0]).toMatchObject({ type: 'error' });
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
