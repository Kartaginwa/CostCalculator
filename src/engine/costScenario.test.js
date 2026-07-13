import { describe, it, expect } from 'vitest';
import { applyCostShocks, shockIsActive } from './costScenario.js';

const ingredients = () => [
    { id: 'a', name: 'Saumon', provider: 'Poisson', unitPrice: 10, purchasePrice: 100 },
    { id: 'b', name: 'Bœuf', provider: 'Boucher', unitPrice: 20, purchasePrice: 200 },
    { id: 'c', name: 'Farine', provider: 'Boucher', unitPrice: 2, purchasePrice: 20 },
];

describe('applyCostShocks', () => {
    it('renvoie la liste inchangée sans choc actif', () => {
        const base = ingredients();
        expect(applyCostShocks(base, [])).toBe(base);
        expect(applyCostShocks(base, [{ scope: 'all', percent: 0 }])).toBe(base);
        expect(applyCostShocks(base, [{ scope: 'provider', provider: '', percent: 10 }])).toBe(base);
    });

    it("portée 'all' : applique le % à tous les ingrédients", () => {
        const res = applyCostShocks(ingredients(), [{ scope: 'all', percent: 10 }]);
        expect(res[0].unitPrice).toBeCloseTo(11);
        expect(res[1].unitPrice).toBeCloseTo(22);
        expect(res[2].unitPrice).toBeCloseTo(2.2);
        // Le prix d'achat est ajusté de la même façon.
        expect(res[0].purchasePrice).toBeCloseTo(110);
    });

    it("portée 'provider' : n'affecte que les ingrédients du fournisseur ciblé", () => {
        const res = applyCostShocks(ingredients(), [{ scope: 'provider', provider: 'Boucher', percent: 50 }]);
        expect(res[0].unitPrice).toBeCloseTo(10);   // Poisson, inchangé
        expect(res[1].unitPrice).toBeCloseTo(30);   // Boucher +50%
        expect(res[2].unitPrice).toBeCloseTo(3);    // Boucher +50%
    });

    it("portée 'selection' : n'affecte que les ids sélectionnés", () => {
        const res = applyCostShocks(ingredients(), [{ scope: 'selection', selectedIds: ['a', 'c'], percent: 100 }]);
        expect(res[0].unitPrice).toBeCloseTo(20);   // a doublé
        expect(res[1].unitPrice).toBeCloseTo(20);   // b inchangé
        expect(res[2].unitPrice).toBeCloseTo(4);    // c doublé
    });

    it('cumule plusieurs chocs multiplicativement sur un ingrédient touché par les deux', () => {
        const res = applyCostShocks(ingredients(), [
            { scope: 'all', percent: 10 },
            { scope: 'provider', provider: 'Boucher', percent: 20 },
        ]);
        // Saumon (Poisson) : ×1,10 seulement = 11.
        expect(res[0].unitPrice).toBeCloseTo(11);
        // Bœuf (Boucher) : ×1,10 × 1,20 = 26,4.
        expect(res[1].unitPrice).toBeCloseTo(26.4);
    });

    it('gère les variations négatives (baisse de prix)', () => {
        const res = applyCostShocks(ingredients(), [{ scope: 'all', percent: -25 }]);
        expect(res[0].unitPrice).toBeCloseTo(7.5);
    });
});

describe('shockIsActive', () => {
    it('détecte les chocs exploitables', () => {
        expect(shockIsActive({ scope: 'all', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'all', percent: 0 })).toBe(false);
        expect(shockIsActive({ scope: 'provider', provider: 'X', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'provider', provider: '', percent: 5 })).toBe(false);
        expect(shockIsActive({ scope: 'selection', selectedIds: [], percent: 5 })).toBe(false);
        expect(shockIsActive({ scope: 'selection', selectedIds: ['a'], percent: 5 })).toBe(true);
    });
});
