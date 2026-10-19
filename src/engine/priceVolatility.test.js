import { describe, it, expect } from 'vitest';
import { computeIngredientVolatility, computePackagingVolatility, computeFormatCostVolatility } from './priceVolatility.js';

// Fabrique un point de référence : { id, timestamp, baseIngredients:[{id,name,unitPrice}] }.
const snap = (timestamp, prices) => ({
    id: timestamp, timestamp,
    baseIngredients: Object.entries(prices).map(([id, unitPrice]) => ({ id, name: id, unitPrice })),
});

// Même forme, pour `basePackaging` (Phase 6, 15/10).
const packagingSnap = (timestamp, prices) => ({
    id: timestamp, timestamp,
    basePackaging: Object.entries(prices).map(([id, unitPrice]) => ({ id, name: id, unitPrice })),
});

// Pour `productsWithCosts` (Phase 6, 15/10) : une ligne par FORMAT, coût direct déjà figé.
const formatSnap = (timestamp, costs) => ({
    id: timestamp, timestamp,
    productsWithCosts: Object.entries(costs).map(([id, totalDirectCostPerPortion]) => ({
        id, displayName: id, costs: { totalDirectCostPerPortion },
    })),
});

describe('computeIngredientVolatility', () => {
    it('exige au moins 2 points de référence', () => {
        expect(computeIngredientVolatility([]).hasEnoughData).toBe(false);
        expect(computeIngredientVolatility([snap('2025-01-01', { a: 10 })]).hasEnoughData).toBe(false);
    });

    it('calcule amplitude, tendance et niveau par ingrédient', () => {
        const points = [
            snap('2025-01-01', { saumon: 10, farine: 2 }),
            snap('2025-02-01', { saumon: 12, farine: 2 }),
            snap('2025-03-01', { saumon: 15, farine: 2.1 }),
        ];
        const res = computeIngredientVolatility(points);
        expect(res.hasEnoughData).toBe(true);

        const saumon = res.byId.saumon;
        // prix [10,12,15] : moyenne 12,333 ; amplitude = (15-10)/12,333 = 40,5 %
        expect(saumon.amplitudePercent).toBeCloseTo(40.5, 1);
        expect(saumon.trendPercent).toBeCloseTo(50);   // (15-10)/10
        expect(saumon.tier).toBe('elevee');
        expect(saumon.isVolatile).toBe(true);

        // farine quasi stable → non volatile
        expect(res.byName.farine.isVolatile).toBe(false);
        expect(res.byName.farine.tier).toBe('faible');
    });

    it('ordonne les points par date même fournis en désordre, et trie du plus volatil au moins', () => {
        const points = [
            snap('2025-03-01', { a: 20, b: 10 }),
            snap('2025-01-01', { a: 10, b: 10 }),
        ];
        const res = computeIngredientVolatility(points);
        expect(res.byId.a.trendPercent).toBeCloseTo(100); // série remise dans l'ordre [10,20]
        expect(res.list[0].id).toBe('a');                 // le plus volatil en tête
    });

    it('ignore les prix nuls/absents dans la série', () => {
        const points = [
            snap('2025-01-01', { a: 0 }),
            snap('2025-02-01', { a: 10 }),
            snap('2025-03-01', { a: 12 }),
        ];
        const res = computeIngredientVolatility(points);
        expect(res.byId.a.count).toBe(2);
        expect(res.byId.a.trendPercent).toBeCloseTo(20);
    });
});

describe('computePackagingVolatility (Phase 6, 15/10)', () => {
    it("même comportement que computeIngredientVolatility, mais lit `basePackaging`", () => {
        const points = [
            packagingSnap('2025-01-01', { pot_250ml: 0.50 }),
            packagingSnap('2025-02-01', { pot_250ml: 0.65 }),
        ];
        const res = computePackagingVolatility(points);
        expect(res.hasEnoughData).toBe(true);
        expect(res.byId.pot_250ml.trendPercent).toBeCloseTo(30);
        expect(res.byId.pot_250ml.isVolatile).toBe(true);
    });

    it('ignore `baseIngredients` : un point sans `basePackaging` ne produit aucun item', () => {
        const points = [snap('2025-01-01', { a: 10 }), snap('2025-02-01', { a: 12 })];
        expect(computePackagingVolatility(points).list).toEqual([]);
    });
});

describe('computeFormatCostVolatility (Phase 6, 15/10)', () => {
    it('suit le coût direct total par portion (matière + emballage + MO + sous-traitance) de chaque format', () => {
        const points = [
            formatSnap('2025-01-01', { fmt_confiture_250: 2.00, fmt_sauce_500: 3.00 }),
            formatSnap('2025-02-01', { fmt_confiture_250: 2.00, fmt_sauce_500: 4.50 }),
        ];
        const res = computeFormatCostVolatility(points);
        expect(res.hasEnoughData).toBe(true);
        expect(res.byId.fmt_sauce_500.trendPercent).toBeCloseTo(50);
        expect(res.byId.fmt_sauce_500.isVolatile).toBe(true);
        expect(res.byId.fmt_confiture_250.isVolatile).toBe(false);
    });

    it('ignore un format sans coût direct positif (ex. sous-recette jamais calculée) plutôt que de forcer 0', () => {
        const points = [
            formatSnap('2025-01-01', { fmt_a: 0 }),
            formatSnap('2025-02-01', { fmt_a: 5 }),
            formatSnap('2025-03-01', { fmt_a: 6 }),
        ];
        const res = computeFormatCostVolatility(points);
        expect(res.byId.fmt_a.count).toBe(2);
    });
});
