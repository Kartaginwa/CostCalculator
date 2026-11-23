import { describe, it, expect } from 'vitest';
import { computeFormatAllergens } from './allergens.js';
import { getDefaultState } from '../state/initialState.js';
import { MAJOR_ALLERGENS } from '../utils.js';
import { demoInputs } from './testing/demoFindingsContext.js';
import { buildReportModel } from '../reports/report/model.js';
import { ficheHtml } from '../reports/report/fiches.js';

// Allergènes : les clés enregistrées dans un projet sont des identifiants internes en anglais (`milk`, `soybeans`…) ; l'écran et le rapport n'affichent QUE les noms
// français de MAJOR_ALLERGENS (« Lait », « Soja »…). Une clé inconnue s'afficherait telle quelle, en anglais : ces tests l'interdisent pour le projet démo.
const FRENCH = { gluten: 'Gluten', crustaceans: 'Crustacés', eggs: 'Œufs', fish: 'Poisson', peanuts: 'Arachides', soybeans: 'Soja', milk: 'Lait', nuts: 'Noix', celery: 'Céleri', mustard: 'Moutarde', sesame: 'Sésame', sulphites: 'Sulphites', lupin: 'Lupin', molluscs: 'Mollusques' };

describe('liste des allergènes de l\'application', () => {
    it('chacune des 14 clés a son nom français', () => {
        expect(Object.fromEntries(MAJOR_ALLERGENS.map(a => [a.key, a.name]))).toEqual(FRENCH);
    });
});

describe('projet démo : aucun allergène inconnu', () => {
    const s = getDefaultState();
    const known = new Set(MAJOR_ALLERGENS.map(a => a.key));
    it('chaque allergène d\'un ingrédient est une clé connue', () => {
        const unknown = s.ingredientsList.flatMap(i => (i.allergens || []).filter(k => !known.has(k)).map(k => `${i.name} : ${k}`));
        expect(unknown).toEqual([]);
    });
    it('chaque allergène saisi à la main sur un format est une clé connue', () => {
        const unknown = s.products.flatMap(p => p.formats.flatMap(f => (f.manualAllergens || []).filter(k => !known.has(k)).map(k => `${f.id} : ${k}`)));
        expect(unknown).toEqual([]);
    });
    it('le prémélange gingembre-ail-soya déclare le soja', () => {
        expect(s.ingredientsList.find(i => i.id === 'ing_epices_asiat').allergens).toEqual(['soybeans']);
    });
});

describe('computeFormatAllergens', () => {
    const s = getDefaultState();
    const fmt = (id) => s.products.flatMap(p => p.formats).find(f => f.id === id);
    it('un format tire ses allergènes de ses ingrédients : le Poulet général Tao contient du soja', () => {
        expect(computeFormatAllergens(fmt('fmt_tao'), s.ingredientsList)).toContain('soybeans');
    });
    it('un produit de revente utilise sa liste saisie à la main', () => {
        expect(computeFormatAllergens({ isResaleProduct: true, manualAllergens: ['milk'] }, [])).toEqual(['milk']);
    });
    it('sans format, aucun allergène', () => {
        expect(computeFormatAllergens(null, [])).toEqual([]);
    });
});

describe('rapport : les allergènes sont imprimés en français', () => {
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const model = buildReportModel({ project: { ...state, trackingPoints }, analysisData, calculatedGeneralInfo });
    const frenchNames = new Set(Object.values(FRENCH));
    it('chaque allergène d\'une fiche du démo est un nom français de la liste, jamais une clé anglaise', () => {
        const printed = model.fiches.flatMap(f => f.allergens);
        expect(printed.length).toBeGreaterThan(0);
        expect(printed.filter(n => !frenchNames.has(n))).toEqual([]);
    });
    it('la fiche du Poulet général Tao imprime « Soja »', () => {
        const tao = model.fiches.find(f => f.id === 'fmt_tao');
        expect(tao.allergens).toContain('Soja');
        const html = ficheHtml(tao, model);
        expect(html).toMatch(/Allergènes : <b>[^<]*Soja/);
        expect(html).not.toMatch(/\bsoy\b|soybeans/);
    });
    it('aucune fiche du démo n\'imprime une clé anglaise', () => {
        for (const f of model.fiches) expect(ficheHtml(f, model), f.name).not.toMatch(/Allergènes : <b>[^<]*\b(soy|soybeans|milk|fish|eggs|gluten|peanuts|nuts|celery|mustard|sesame|sulphites|molluscs|crustaceans)\b/);
    });
});
