import { describe, it, expect } from 'vitest';
import { computeYieldUnits, effectiveNbPortions } from './yieldCalculator.js';
import { computeLaborHoursNeeded } from './laborHours.js';

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

describe('effectiveNbPortions (source unique de la quantité produite)', () => {
    it('quantité saisie sans grille ; vide ou 0 → 1', () => {
        expect(effectiveNbPortions({ nbPortions: '12' })).toBe(12);
        expect(effectiveNbPortions({ nbPortions: '' })).toBe(1);
        expect(effectiveNbPortions({ nbPortions: 0 })).toBe(1);
    });
    it('avec grille : la quantité CALCULÉE prime sur le champ saisi resté à son ancienne valeur', () => {
        const fmt = { nbPortions: 20, portionSize: 500, yieldGrid: { enabled: true, baseQuantity: 8000, stages: [{ percentEffect: -20 }], rejectRate: 5 } };
        expect(effectiveNbPortions(fmt)).toBeCloseTo(12.16, 8); // 8000 × 0,8 × 0,95 ÷ 500
    });
    it("les heures de main-d'œuvre utilisent la quantité calculée, pas la quantité saisie (audit 20/11)", () => {
        const mk = (stored) => ({ id: 'p', activityId: 'a', formats: [{
            id: 'f', onMenu: true, nbPortions: stored, portionSize: 500, portionUnit: 'g',
            yieldGrid: { enabled: true, baseQuantity: 8000, stages: [{ percentEffect: -20 }], rejectRate: 5 },
            channelPrices: [{ channelId: 'c', netPrice: 5, volume: 121.6 }],
            productionSteps: [{ duration: 3600, personnel: [{ postId: 'Cuisinier' }] }], ingredients: [],
        }] });
        // 121,6 portions ÷ 12,16 par lot = 10 lots × 1 h, quelle que soit la valeur stockée.
        expect(computeLaborHoursNeeded([mk(20)]).total).toBeCloseTo(10, 8);
        expect(computeLaborHoursNeeded([mk(12.16)]).total).toBeCloseTo(10, 8);
    });
});
