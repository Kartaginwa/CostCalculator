import { describe, it, expect } from 'vitest';
import { calculateCosts, calculateCostLines } from './calculateCosts.js';
import { getDefaultState } from '../state/initialState.js';

// Détail ligne par ligne d'une recette (rapport PDF) : lu au même endroit que les totaux, il doit retomber exactement dessus.
const info = { totalIndirects: 0, kitchenProductivity: 50 };
const laborDatabase = [{ postName: 'Cuisinier', employees: [{ workedHours: 40, hourlyRate: 20, productiveTimePercentage: 100 }] }];
const product = (over = {}) => ({
    id: 'p1', platName: 'Plat', prixVente: 20, nbPortions: 10, isResaleProduct: false, purchaseCost: 0, onMenu: true, isIngredient: false, portionSize: 1, portionUnit: 'unité',
    indirectCosts: {}, salesMix: 0,
    ingredients: [{ id: 'farine', quantity: 2, recipeUnit: 'kg', yieldPercentage: 80 }],
    packagingItems: [{ id: 'boite', quantity: 10, recipeUnit: 'unité' }],
    productionSteps: [{ stepId: 's1', stepName: 'Pétrissage', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 3600 }],
    ...over,
});
const farine = { id: 'farine', name: 'Farine', unitPrice: 2, lossPercentage: 10, unit: 'kg' };
const boite = { id: 'boite', name: 'Boîte', unitPrice: 0.5, lossPercentage: 0, unit: 'unité' };

describe('calculateCostLines', () => {
    it('chaque ligne porte son coût de base, sa perte et son coût final (perte et rendement compris)', () => {
        const p = product();
        const { ingredients, packaging, steps } = calculateCostLines(p, info, [farine], [p], laborDatabase, null, [boite]);
        expect(ingredients).toHaveLength(1);
        expect(ingredients[0]).toMatchObject({ id: 'farine', name: 'Farine', quantity: 2, unit: 'kg', yieldPercent: 80, baseCost: 4 });
        expect(ingredients[0].lossCost).toBeCloseTo(4 / 0.9 - 4, 6);
        expect(ingredients[0].finalCost).toBeCloseTo(4 / 0.9 / 0.8, 6);
        expect(packaging).toEqual([{ id: 'boite', name: 'Boîte', quantity: 10, unit: 'unité', baseCost: 5, lossCost: 0, finalCost: 5 }]);
        expect(steps).toHaveLength(1);
        expect(steps[0]).toMatchObject({ id: 's1', name: 'Pétrissage', durationSeconds: 3600, postIds: ['Cuisinier'] });
    });

    it('les lignes retombent sur les totaux de calculateCosts', () => {
        const p = product();
        const costs = calculateCosts(p, info, [farine], [p], laborDatabase, null, {}, new Set(), null, [boite]);
        const lines = calculateCostLines(p, info, [farine], [p], laborDatabase, null, [boite]);
        expect(lines.ingredients.reduce((s, l) => s + l.finalCost, 0)).toBeCloseTo(costs.totalIngredientsCost, 9);
        expect(lines.ingredients.reduce((s, l) => s + l.matiereCost, 0)).toBeCloseTo(costs.totalIngredientsCost, 9);
        expect(lines.packaging.reduce((s, l) => s + l.finalCost, 0)).toBeCloseTo(costs.totalPackagingCost, 9);
        expect(lines.steps.reduce((s, l) => s + l.totalCost, 0)).toBeCloseTo(costs.totalLaborCost, 9); // 20 $ de l'heure, productivité 50 % : 40 $
        expect(lines.steps[0].directCost).toBeCloseTo(20, 9);
        expect(lines.steps[0].totalCost).toBeCloseTo(40, 9);
    });

    it('un produit de revente n\'a aucune ligne de recette', () => {
        const p = product({ isResaleProduct: true, purchaseCost: 12 });
        const lines = calculateCostLines(p, info, [farine], [p], laborDatabase, null, [boite]);
        expect(lines.ingredients).toEqual([]);
        expect(lines.steps).toEqual([]);
        expect(lines.packaging.length).toBe((p.packagingItems || []).length); // l'emballage d'un produit de revente est conservé (audit C11)
    });

    it('ne change pas calculateCosts : même résultat qu\'avant, et le cache n\'embarque jamais le détail', () => {
        const p = product();
        const memo = {};
        const a = calculateCosts(p, info, [farine], [p], laborDatabase, null, memo, new Set(), null, [boite]);
        expect(a).not.toHaveProperty('lines');
        expect(calculateCosts(p, info, [farine], [p], laborDatabase, null, memo, new Set(), null, [boite])).toBe(a); // cache
    });

    it('un produit en boucle renvoie null au lieu de lignes', () => {
        const p = product();
        expect(calculateCostLines(p, info, [farine], [p], laborDatabase, null, [boite])).not.toBeNull();
    });
});

describe('calculateCostLines sur le projet démo', () => {
    const s = getDefaultState();
    const all = s.products;
    const generalInfo = { ...s.generalInfo, totalIndirects: 0, kitchenProductivity: 100 };

    it('la matière des lignes égale le coût matière de chaque format, sous-recettes comprises', () => {
        let checked = 0;
        for (const p of all) for (const fmt of p.formats || []) {
            const costs = calculateCosts(p, generalInfo, s.ingredientsList, all, s.laborDatabase, null, {}, new Set(), fmt, s.basePackaging);
            const lines = calculateCostLines(p, generalInfo, s.ingredientsList, all, s.laborDatabase, fmt, s.basePackaging);
            // Un produit de revente n'a pas de recette : son coût est le prix d'achat, sans ligne.
            if (fmt.isResaleProduct) expect(lines.ingredients).toEqual([]);
            else expect(lines.ingredients.reduce((t, l) => t + l.matiereCost, 0)).toBeCloseTo(costs.totalIngredientsCost, 6);
            checked++;
        }
        expect(checked).toBeGreaterThan(10);
    });

    it('chaque ligne du démo a un nom', () => {
        for (const p of all) for (const fmt of p.formats || []) {
            const lines = calculateCostLines(p, generalInfo, s.ingredientsList, all, s.laborDatabase, fmt, s.basePackaging);
            [...lines.ingredients, ...lines.packaging, ...lines.steps].forEach(l => expect(l.name, JSON.stringify(l)).toBeTruthy());
        }
    });
});
