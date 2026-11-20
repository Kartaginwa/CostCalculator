import { describe, it, expect } from 'vitest';
import { computeLaborHoursNeeded } from './laborHours.js';
import { computeLaborAbsorption } from './analysisPipeline.js';

// Heures nécessaires, sous-recettes comprises (19/11) : un format fabrique ce qu'il vend ET ce que les autres recettes
// en consomment, même s'il n'est jamais vendu seul.
const step = (hours, post = 'Cuisinier') => ({ duration: hours * 3600, personnel: [{ postId: post }] });
const fmt = (over = {}) => ({ id: 'f', onMenu: true, nbPortions: 1, portionSize: 1, portionUnit: 'unité', channelPrices: [], productionSteps: [], ingredients: [], ...over });
const sold = (volume) => [{ channelId: 'c', netPrice: 5, volume }];

// Sauce : lot de 10 L, 2 h de travail, jamais vendue seule. Plat : lot de 20 portions, 3 h, consomme 2 L de sauce par lot.
const sauce = (over = {}) => ({ id: 'p_sauce', isIngredient: true, activityId: 'a1', formats: [fmt({ id: 'f_sauce', onMenu: false, nbPortions: 10, portionSize: 1, portionUnit: 'L', productionSteps: [step(2)], ...over })] });
const plat = (over = {}, row = {}) => ({ id: 'p_plat', activityId: 'a2', formats: [fmt({
    id: 'f_plat', nbPortions: 20, channelPrices: sold(100), productionSteps: [step(3)],
    ingredients: [{ id: 'f_sauce', quantity: 2, recipeUnit: 'L', yieldPercentage: 100, ...row }], ...over,
})] });

describe('computeLaborHoursNeeded', () => {
    it('sans sous-recette : durée des étapes × lots vendus', () => {
        const r = computeLaborHoursNeeded([plat({ ingredients: [] })]);
        expect(r.byPost.Cuisinier).toBeCloseTo(15, 8); // 100 portions ÷ 20 = 5 lots × 3 h
        expect(r.total).toBeCloseTo(15, 8);
    });
    it('compte le temps d\'une sous-recette jamais vendue seule', () => {
        const r = computeLaborHoursNeeded([sauce(), plat()]);
        // 5 lots de plat × 2 L = 10 L de sauce = 1 lot de sauce × 2 h
        expect(r.byPost.Cuisinier).toBeCloseTo(15 + 2, 8);
        expect(r.batchesByFormat.f_sauce).toBeCloseTo(1, 8);
        // la sauce est attribuée à l'activité qui la fabrique, le plat à la sienne
        expect(r.byActivity.a1).toBeCloseTo(2, 8);
        expect(r.byActivity.a2).toBeCloseTo(15, 8);
    });
    it('convertit l\'unité de la ligne vers celle de la portion de la sous-recette', () => {
        const r = computeLaborHoursNeeded([sauce(), plat({}, { quantity: 2000, recipeUnit: 'ml' })]);
        expect(r.byPost.Cuisinier).toBeCloseTo(17, 8);
    });
    it('suit le rendement de la ligne, comme le coût (rendement 50 % = deux fois plus de sauce)', () => {
        const r = computeLaborHoursNeeded([sauce(), plat({}, { yieldPercentage: 50 })]);
        expect(r.byPost.Cuisinier).toBeCloseTo(15 + 4, 8);
    });
    it('additionne ce qui est vendu seul et ce qui est consommé', () => {
        const soldAlone = sauce({ onMenu: true, channelPrices: sold(30) }); // 3 lots vendus
        const r = computeLaborHoursNeeded([soldAlone, plat()]);
        expect(r.batchesByFormat.f_sauce).toBeCloseTo(3 + 1, 8);
        expect(r.byPost.Cuisinier).toBeCloseTo(15 + 4 * 2, 8);
    });
    it('un produit inactif ne consomme rien', () => {
        const r = computeLaborHoursNeeded([sauce(), plat({ onMenu: false })]);
        expect(r.total).toBe(0);
    });
    it('suit une chaîne de sous-recettes (une sous-recette dans une sous-recette)', () => {
        const base = { id: 'p_base', isIngredient: true, activityId: 'a1', formats: [fmt({ id: 'f_base', onMenu: false, nbPortions: 1, portionSize: 1, portionUnit: 'kg', productionSteps: [step(1, 'Aide')] })] };
        const sauceWithBase = sauce({ ingredients: [{ id: 'f_base', quantity: 4, recipeUnit: 'kg', yieldPercentage: 100 }] });
        const r = computeLaborHoursNeeded([base, sauceWithBase, plat()]);
        // 1 lot de sauce consomme 4 kg de base = 4 lots × 1 h
        expect(r.byPost.Aide).toBeCloseTo(4, 8);
        expect(r.byPost.Cuisinier).toBeCloseTo(17, 8);
    });
    it('ignore un ingrédient de base et se protège d\'une référence circulaire', () => {
        const loop = sauce({ ingredients: [{ id: 'f_plat', quantity: 1, recipeUnit: 'unité', yieldPercentage: 100 }] });
        const r = computeLaborHoursNeeded([loop, { ...plat(), isIngredient: true }]); // le plat consomme la sauce, qui consomme le plat
        expect(Number.isFinite(r.total)).toBe(true);
        const withBase = computeLaborHoursNeeded([plat({}, { id: 'ing_x' })], [{ id: 'ing_x' }]);
        expect(withBase.total).toBeCloseTo(15, 8);
    });
    it('un produit de revente ne consomme aucune sous-recette', () => {
        const r = computeLaborHoursNeeded([sauce(), plat({ isResaleProduct: true })]);
        expect(r.byPost.Cuisinier).toBeCloseTo(15, 8);
    });
});

describe('Taux d\'absorption avec sous-recettes', () => {
    const labor = [{ postName: 'Cuisinier', employees: [{ workedHours: 100, hourlyRate: 20, socialCharges: 0, vacationPercentage: 0 }] }];
    it('le temps de la sous-recette relève le taux : 17 h au lieu de 15 h sur 100 h payées', () => {
        const without = computeLaborAbsorption([plat()], labor, []);
        expect(without.kitchenProductivity).toBeCloseTo(15, 8);
        const withSub = computeLaborAbsorption([sauce(), plat()], labor, []);
        expect(withSub.kitchenProductivity).toBeCloseTo(17, 8);
        expect(withSub.totalDirectLaborHoursNeeded).toBeCloseTo(17, 8);
    });
});

describe("computeLaborHoursNeeded : canal supprimé (21/11)", () => {
    it("les ventes d'un canal qui n'existe plus ne demandent aucune heure de production", () => {
        const product = plat({ ingredients: [], channelPrices: [{ channelId: 'c1', netPrice: 5, volume: 100 }, { channelId: 'supprime', netPrice: 5, volume: 400 }] });
        const channels = [{ id: 'c1', name: 'Direct' }];
        expect(computeLaborHoursNeeded([product], [], channels).total).toBeCloseTo(15, 8); // 100 ÷ 20 = 5 lots × 3 h
        expect(computeLaborHoursNeeded([product], []).total).toBeCloseTo(75, 8); // sans liste de canaux : tout compte
    });
});
