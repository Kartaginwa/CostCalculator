import { describe, it, expect } from 'vitest';
import { applyCostShocks, applyLaborShocks, shockIsActive, expandShockScopes } from './costScenario.js';

const ingredients = () => [
    { id: 'a', name: 'Saumon', provider: 'Poisson', unitPrice: 10, purchasePrice: 100 },
    { id: 'b', name: 'Bœuf', provider: 'Boucher', unitPrice: 20, purchasePrice: 200 },
    { id: 'c', name: 'Farine', provider: 'Boucher', unitPrice: 2, purchasePrice: 20 },
];

const labor = () => [
    { id: 'post_cuistot', postName: 'Cuisinier', employees: [
        { id: 'e1', employeeName: 'Julie', hourlyRate: 20 },
        { id: 'e2', employeeName: 'Marc', hourlyRate: 25 },
    ] },
    { id: 'post_plonge', postName: 'Plongeur', employees: [
        { id: 'e3', employeeName: 'Kevin', hourlyRate: 16 },
    ] },
];

describe('applyCostShocks (intrants)', () => {
    it('renvoie la liste inchangée sans choc actif', () => {
        const base = ingredients();
        expect(applyCostShocks(base, [])).toBe(base);
        expect(applyCostShocks(base, [{ type: 'ingredient', scope: 'all', percent: 0 }])).toBe(base);
        // Un choc de type labor ne touche pas les ingrédients.
        expect(applyCostShocks(base, [{ type: 'labor', scope: 'all', percent: 10 }])).toBe(base);
    });

    it("portée 'all' : applique le % à tous les ingrédients", () => {
        const res = applyCostShocks(ingredients(), [{ type: 'ingredient', scope: 'all', percent: 10 }]);
        expect(res[0].unitPrice).toBeCloseTo(11);
        expect(res[1].unitPrice).toBeCloseTo(22);
        expect(res[0].purchasePrice).toBeCloseTo(110);
    });

    it("portée 'provider' : n'affecte que le fournisseur ciblé (target)", () => {
        const res = applyCostShocks(ingredients(), [{ type: 'ingredient', scope: 'provider', target: 'Boucher', percent: 50 }]);
        expect(res[0].unitPrice).toBeCloseTo(10);   // Poisson, inchangé
        expect(res[1].unitPrice).toBeCloseTo(30);   // Boucher +50%
        expect(res[2].unitPrice).toBeCloseTo(3);    // Boucher +50%
    });

    it("portée 'selection' : n'affecte que les ids sélectionnés", () => {
        const res = applyCostShocks(ingredients(), [{ type: 'ingredient', scope: 'selection', selectedIds: ['a', 'c'], percent: 100 }]);
        expect(res[0].unitPrice).toBeCloseTo(20);
        expect(res[1].unitPrice).toBeCloseTo(20);
        expect(res[2].unitPrice).toBeCloseTo(4);
    });

    it('cumule plusieurs chocs multiplicativement', () => {
        const res = applyCostShocks(ingredients(), [
            { type: 'ingredient', scope: 'all', percent: 10 },
            { type: 'ingredient', scope: 'provider', target: 'Boucher', percent: 20 },
        ]);
        expect(res[0].unitPrice).toBeCloseTo(11);     // Poisson : ×1,10
        expect(res[1].unitPrice).toBeCloseTo(26.4);   // Boucher : ×1,10 × 1,20
    });
});

describe('applyLaborShocks (main-d\'œuvre)', () => {
    it('renvoie la base inchangée sans choc labor actif', () => {
        const base = labor();
        expect(applyLaborShocks(base, [])).toBe(base);
        // Un choc de type ingredient ne touche pas la MO.
        expect(applyLaborShocks(base, [{ type: 'ingredient', scope: 'all', percent: 10 }])).toBe(base);
    });

    it("portée 'all' : ajuste le taux horaire de tous les employés", () => {
        const res = applyLaborShocks(labor(), [{ type: 'labor', scope: 'all', percent: 10 }]);
        expect(res[0].employees[0].hourlyRate).toBeCloseTo(22);
        expect(res[0].employees[1].hourlyRate).toBeCloseTo(27.5);
        expect(res[1].employees[0].hourlyRate).toBeCloseTo(17.6);
    });

    it("portée 'post' : n'affecte que le poste ciblé (target = id du poste)", () => {
        const res = applyLaborShocks(labor(), [{ type: 'labor', scope: 'post', target: 'post_cuistot', percent: 20 }]);
        expect(res[0].employees[0].hourlyRate).toBeCloseTo(24);   // Cuisinier +20%
        expect(res[0].employees[1].hourlyRate).toBeCloseTo(30);   // Cuisinier +20%
        expect(res[1].employees[0].hourlyRate).toBeCloseTo(16);   // Plongeur inchangé
    });

    it("portée 'selection' : n'affecte que les employés sélectionnés", () => {
        const res = applyLaborShocks(labor(), [{ type: 'labor', scope: 'selection', selectedIds: ['e2'], percent: 100 }]);
        expect(res[0].employees[0].hourlyRate).toBeCloseTo(20);   // e1 inchangé
        expect(res[0].employees[1].hourlyRate).toBeCloseTo(50);   // e2 doublé
        expect(res[1].employees[0].hourlyRate).toBeCloseTo(16);
    });
});

describe('shockIsActive', () => {
    it('détecte les chocs exploitables des deux types', () => {
        expect(shockIsActive({ scope: 'all', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'all', percent: 0 })).toBe(false);
        expect(shockIsActive({ scope: 'provider', target: 'X', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'provider', target: '', percent: 5 })).toBe(false);
        expect(shockIsActive({ scope: 'post', target: 'p1', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'selection', selectedIds: [], percent: 5 })).toBe(false);
        expect(shockIsActive({ scope: 'selection', selectedIds: ['a'], percent: 5 })).toBe(true);
    });

    it("détecte les portées 'format' et 'activity' (Phase 6, 15/10)", () => {
        expect(shockIsActive({ scope: 'format', target: 'fmt1', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'format', target: '', percent: 5 })).toBe(false);
        expect(shockIsActive({ scope: 'activity', target: 'act1', percent: 5 })).toBe(true);
        expect(shockIsActive({ scope: 'activity', target: '', percent: 5 })).toBe(false);
    });
});

describe("expandShockScopes — résout 'format'/'activity' en 'selection' concret (Phase 6, 15/10)", () => {
    // Deux formats de l'activité 'act_confitures' (fmt1, fmt2) + un de 'act_sauces' (fmt3), chacun
    // avec ses propres ingrédients directs et étapes de production — même forme que
    // `productsWithCosts` (Phase 1.6, une ligne par FORMAT).
    const productsWithCosts = [
        {
            id: 'fmt1', activityId: 'act_confitures',
            format: {
                ingredients: [{ id: 'ing_fraise' }, { id: 'ing_sucre' }],
                productionSteps: [{ personnel: [{ postId: 'Cuisinier' }] }],
            },
        },
        {
            id: 'fmt2', activityId: 'act_confitures',
            format: {
                ingredients: [{ id: 'ing_sucre' }, { id: 'ing_citron' }],
                productionSteps: [{ personnel: [{ postId: 'Opérateur' }] }],
            },
        },
        {
            id: 'fmt3', activityId: 'act_sauces',
            format: {
                ingredients: [{ id: 'ing_tomate' }],
                productionSteps: [{ personnel: [{ postId: 'Cuisinier' }] }],
            },
        },
    ];
    const laborDatabase = [
        { id: 'post_cuisinier', postName: 'Cuisinier', employees: [{ id: 'e_cuisinier' }] },
        { id: 'post_operateur', postName: 'Opérateur', employees: [{ id: 'e_operateur' }] },
    ];

    it("ingrédient, portée 'format' : ids des ingrédients directs de CE format seulement", () => {
        const [expanded] = expandShockScopes(
            [{ type: 'ingredient', scope: 'format', target: 'fmt1', percent: 10 }],
            { productsWithCosts, laborDatabase }
        );
        expect(expanded.scope).toBe('selection');
        expect(new Set(expanded.selectedIds)).toEqual(new Set(['ing_fraise', 'ing_sucre']));
    });

    it("ingrédient, portée 'activity' : union des ingrédients de TOUS les formats de l'activité", () => {
        const [expanded] = expandShockScopes(
            [{ type: 'ingredient', scope: 'activity', target: 'act_confitures', percent: 10 }],
            { productsWithCosts, laborDatabase }
        );
        expect(new Set(expanded.selectedIds)).toEqual(new Set(['ing_fraise', 'ing_sucre', 'ing_citron']));
    });

    it("main-d'œuvre, portée 'format' : employés des postes utilisés dans les étapes de CE format", () => {
        const [expanded] = expandShockScopes(
            [{ type: 'labor', scope: 'format', target: 'fmt2', percent: 10 }],
            { productsWithCosts, laborDatabase }
        );
        expect(expanded.selectedIds).toEqual(['e_operateur']);
    });

    it("main-d'œuvre, portée 'activity' : employés des postes utilisés dans TOUS les formats de l'activité", () => {
        const [expanded] = expandShockScopes(
            [{ type: 'labor', scope: 'activity', target: 'act_confitures', percent: 10 }],
            { productsWithCosts, laborDatabase }
        );
        expect(new Set(expanded.selectedIds)).toEqual(new Set(['e_cuisinier', 'e_operateur']));
    });

    it("laisse inchangé un choc 'all'/'provider'/'post'/'selection'", () => {
        const shocks = [
            { type: 'ingredient', scope: 'all', percent: 10 },
            { type: 'ingredient', scope: 'provider', target: 'Boucher', percent: 10 },
            { type: 'labor', scope: 'post', target: 'post_cuisinier', percent: 10 },
            { type: 'ingredient', scope: 'selection', selectedIds: ['x'], percent: 10 },
        ];
        expect(expandShockScopes(shocks, { productsWithCosts, laborDatabase })).toEqual(shocks);
    });

    it('cible absente (format/activité supprimé depuis) : selectedIds vide, pas une erreur', () => {
        const [expanded] = expandShockScopes(
            [{ type: 'ingredient', scope: 'format', target: 'fmt_disparu', percent: 10 }],
            { productsWithCosts, laborDatabase }
        );
        expect(expanded.selectedIds).toEqual([]);
    });
});
