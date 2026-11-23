import { describe, it, expect } from 'vitest';
import { defaultReportOptions, normalizeReportOptions, REPORT_CHAPTER_IDS, COMMENTABLE_CHAPTER_IDS, MAX_COMMENT_LENGTH, MAX_TITLE_LENGTH } from './reportOptions.js';
import { buildProjectData, parseProjectData } from './projectSerialization.js';
import { getDefaultState, getEmptyState } from './initialState.js';
import { CHAPTERS } from '../reports/report/strings.js';

// Options d'export du rapport PDF enregistrées avec le projet (phase 6, 22/11) : valeurs sûres, validation, anciens fichiers, aller-retour.
const asProjectState = (s) => ({
    companyName: s.companyName, logoUrl: s.logoUrl, generalInfo: s.generalInfo, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, products: s.products,
    trackingPoints: s.trackingPoints, laborDatabase: s.laborDatabase, productionActivities: s.productionActivities, salesChannels: s.salesChannels, activeUnits: s.activeUnits,
    expenseLines: s.expenseLines, revenueLines: s.revenueLines, directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys, uiSettings: s.uiSettings,
});

describe('valeurs par défaut', () => {
    it('tous les chapitres cochés, aucun commentaire, salaires décochés, titres vides', () => {
        expect(defaultReportOptions()).toEqual({ title: '', presentedTo: '', chapters: ['1', '2', '3', '4', '5', '6', '7', 'A'], comments: {}, includeSalaries: false });
    });
    it('chaque appel renvoie un nouvel objet (aucun partage entre projets)', () => {
        const a = defaultReportOptions(), b = defaultReportOptions();
        a.chapters.pop(); a.comments['1'] = 'x';
        expect(b.chapters).toHaveLength(8);
        expect(b.comments).toEqual({});
    });
    it('les chapitres connus sont ceux du rapport', () => {
        expect(REPORT_CHAPTER_IDS).toEqual(CHAPTERS.map(c => c.id));
        expect(COMMENTABLE_CHAPTER_IDS).toEqual(REPORT_CHAPTER_IDS.filter(id => id !== 'A'));
    });
    it('les projets neufs et le démo portent ces options', () => {
        expect(getEmptyState().uiSettings.reportOptions).toEqual(defaultReportOptions());
        expect(getDefaultState().uiSettings.reportOptions).toEqual(defaultReportOptions());
    });
});

describe('normalizeReportOptions', () => {
    it('une valeur absente ou d\'un mauvais type donne les valeurs par défaut', () => {
        for (const v of [undefined, null, 42, 'texte', [], true]) expect(normalizeReportOptions(v)).toEqual(defaultReportOptions());
    });
    it('conserve des options valides', () => {
        const o = { title: 'Rapport T3', presentedTo: 'la banque', chapters: ['1', '3', 'A'], comments: { 1: 'Bon trimestre.', 3: 'Voir le Chili.' }, includeSalaries: true };
        expect(normalizeReportOptions(o)).toEqual({ ...o, comments: { 1: 'Bon trimestre.', 3: 'Voir le Chili.' } });
    });
    it('retire les chapitres inconnus, garde l\'ordre du rapport, ignore les doublons', () => {
        expect(normalizeReportOptions({ chapters: ['A', '9', 'x', '3', '3', 1] }).chapters).toEqual(['1', '3', 'A']);
    });
    it('une liste de chapitres vide reste vide (l\'utilisateur a tout décoché)', () => {
        expect(normalizeReportOptions({ chapters: [] }).chapters).toEqual([]);
    });
    it('un commentaire est limité à 1 000 caractères, les vides et les annexes sont retirés, les types invalides ignorés', () => {
        const long = 'x'.repeat(MAX_COMMENT_LENGTH + 500);
        const r = normalizeReportOptions({ comments: { 1: long, 2: '   ', 3: 42, 4: null, A: 'pas de commentaire sur les annexes', 9: 'inconnu', 5: 'ok' } });
        expect(Object.keys(r.comments).sort()).toEqual(['1', '5']);
        expect(r.comments[1]).toHaveLength(MAX_COMMENT_LENGTH);
    });
    it('les titres sont limités et seuls les vrais booléens activent les salaires', () => {
        expect(normalizeReportOptions({ title: 'y'.repeat(500) }).title).toHaveLength(MAX_TITLE_LENGTH);
        expect(normalizeReportOptions({ title: 42, presentedTo: {} })).toMatchObject({ title: '', presentedTo: '' });
        for (const v of ['true', 1, 'oui', null]) expect(normalizeReportOptions({ includeSalaries: v }).includeSalaries).toBe(false);
        expect(normalizeReportOptions({ includeSalaries: true }).includeSalaries).toBe(true);
    });
    it('les sauts de ligne Windows deviennent des sauts de ligne simples', () => {
        expect(normalizeReportOptions({ comments: { 1: 'a\r\nb' } }).comments[1]).toBe('a\nb');
    });
});

describe('enregistrement avec le projet', () => {
    it('aller-retour : les options saisies sont retrouvées à la réouverture', () => {
        const state = asProjectState(getDefaultState());
        state.uiSettings = { ...state.uiSettings, reportOptions: { title: 'Rapport T3', presentedTo: 'Banque Nord', chapters: ['1', '2', '7'], comments: { 2: 'Le creux d’août suit la hausse du bœuf.' }, includeSalaries: true } };
        const json = JSON.parse(JSON.stringify(buildProjectData(state)));
        expect(json.uiSettings.reportOptions.comments[2]).toBe('Le creux d’août suit la hausse du bœuf.');
        const parsed = parseProjectData(json, getEmptyState());
        expect(parsed.uiSettings.reportOptions).toEqual({ title: 'Rapport T3', presentedTo: 'Banque Nord', chapters: ['1', '2', '7'], comments: { 2: 'Le creux d’août suit la hausse du bœuf.' }, includeSalaries: true });
    });
    it('un ancien projet (sans options d\'export) s\'ouvre avec les valeurs par défaut, et le reste est inchangé', () => {
        const state = asProjectState(getDefaultState());
        const json = JSON.parse(JSON.stringify(buildProjectData(state)));
        delete json.uiSettings.reportOptions;
        const parsed = parseProjectData(json, getEmptyState());
        expect(parsed.uiSettings.reportOptions).toEqual(defaultReportOptions());
        expect(parsed.uiSettings.infoItemsPerPage).toBe(10);
        expect(parsed.products).toHaveLength(state.products.length);
    });
    it('un fichier sans uiSettings du tout s\'ouvre aussi', () => {
        const json = JSON.parse(JSON.stringify(buildProjectData(asProjectState(getDefaultState()))));
        delete json.uiSettings;
        expect(parseProjectData(json, getEmptyState()).uiSettings.reportOptions).toEqual(defaultReportOptions());
    });
    it('des options invalides dans un fichier sont corrigées, jamais propagées', () => {
        const json = JSON.parse(JSON.stringify(buildProjectData(asProjectState(getDefaultState()))));
        json.uiSettings.reportOptions = { chapters: ['1', '99'], comments: { 1: 123, 2: '<script>x</script>' }, includeSalaries: 'oui', extra: 'bruit' };
        const r = parseProjectData(json, getEmptyState()).uiSettings.reportOptions;
        expect(r.chapters).toEqual(['1']);
        expect(r.comments).toEqual({ 2: '<script>x</script>' }); // le texte est conservé tel quel ; il est échappé à l'impression
        expect(r.includeSalaries).toBe(false);
        expect(r).not.toHaveProperty('extra');
    });
    it('le poids des options reste négligeable (moins de 10 Ko, même avec tous les commentaires au maximum)', () => {
        const comments = Object.fromEntries(COMMENTABLE_CHAPTER_IDS.map(id => [id, 'é'.repeat(MAX_COMMENT_LENGTH)]));
        expect(JSON.stringify(normalizeReportOptions({ comments })).length).toBeLessThan(10 * 1024);
    });
});
