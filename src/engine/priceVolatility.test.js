import { describe, it, expect } from 'vitest';
import { computeIngredientVolatility } from './priceVolatility.js';

// Fabrique un point de référence : { id, timestamp, baseIngredients:[{id,name,unitPrice}] }.
const snap = (timestamp, prices) => ({
    id: timestamp, timestamp,
    baseIngredients: Object.entries(prices).map(([id, unitPrice]) => ({ id, name: id, unitPrice })),
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
