import { describe, it, expect } from 'vitest';
import { computeYieldUnits } from './yieldCalculator.js';

describe('computeYieldUnits', () => {
    it("retourne le nombre d'unités sans étape ni rejet (division simple)", () => {
        // 1000 ml de sauce, format de 250 ml => 4 unités.
        expect(computeYieldUnits({ baseQuantity: 1000, unitSize: 250 })).toBeCloseTo(4);
    });

    it('applique une perte de procédé (effet négatif) avant la division', () => {
        // 1000 g de matière, réduction de 30 % à la cuisson => 700 g, format 100 g => 7 unités.
        const result = computeYieldUnits({
            baseQuantity: 1000,
            stages: [{ name: 'Cuisson', percentEffect: -30 }],
            unitSize: 100,
        });
        expect(result).toBeCloseTo(7);
    });

    it('applique un gain de procédé (effet positif), ex. absorption de liquide', () => {
        // 1000 g, +20 % au trempage => 1200 g, format 200 g => 6 unités.
        const result = computeYieldUnits({
            baseQuantity: 1000,
            stages: [{ name: 'Trempage', percentEffect: 20 }],
            unitSize: 200,
        });
        expect(result).toBeCloseTo(6);
    });

    it('cumule plusieurs étapes séquentiellement', () => {
        // 1000 g, -20 % puis -25 % => 1000×0.8×0.75 = 600 g, format 60 g => 10 unités.
        const result = computeYieldUnits({
            baseQuantity: 1000,
            stages: [{ percentEffect: -20 }, { percentEffect: -25 }],
            unitSize: 60,
        });
        expect(result).toBeCloseTo(10);
    });

    it('applique le taux de rejet des produits finis APRÈS la cascade de rendement', () => {
        // 1000 g, -50 % => 500 g, format 50 g => 10 unités brutes, 10 % rejetées => 9 unités.
        const result = computeYieldUnits({
            baseQuantity: 1000,
            stages: [{ percentEffect: -50 }],
            rejectRate: 10,
            unitSize: 50,
        });
        expect(result).toBeCloseTo(9);
    });

    it('retourne 0 sans planter quand la taille du format est absente ou nulle', () => {
        expect(computeYieldUnits({ baseQuantity: 1000, unitSize: 0 })).toBe(0);
        expect(computeYieldUnits({ baseQuantity: 1000 })).toBe(0);
        expect(computeYieldUnits()).toBe(0);
    });

    it('accepte les nombres au format local (virgule)', () => {
        const result = computeYieldUnits({ baseQuantity: '1000', stages: [{ percentEffect: '-10' }], unitSize: '90' });
        expect(result).toBeCloseTo(10); // 1000 × 0.9 = 900, / 90 = 10
    });
});
