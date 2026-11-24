import { describe, it, expect } from 'vitest';
import { computeProjectChecks } from './projectChecks.js';

const fmt = (over = {}) => ({ onMenu: true, nbPortions: 10, salesMix: 50, prixVente: 10, portionSize: 1, portionUnit: 'unité', channelPrices: [], indirectCosts: { portionsSold: 100 }, ...over });

describe('computeProjectChecks', () => {
    it('ne signale rien pour un projet vide ou cohérent', () => {
        expect(computeProjectChecks({})).toEqual([]);
        const products = [{ platName: 'A', formats: [fmt({ salesMix: 60 })] }, { platName: 'B', formats: [fmt({ salesMix: 40 })] }];
        expect(computeProjectChecks({ products })).toEqual([]);
    });
    it('signale un mix ≠ 100 %, un SKU sans prix et un produit sans nom', () => {
        const products = [{ platName: '', formats: [fmt({ salesMix: 30, prixVente: 0 })] }];
        const ids = computeProjectChecks({ products }).map(c => c.id);
        expect(ids).toEqual(expect.arrayContaining(['unnamed-products', 'no-sale-price', 'sales-mix']));
    });
    it('un prix de canal compte comme un prix de vente', () => {
        const products = [{ platName: 'A', formats: [fmt({ salesMix: 100, prixVente: 0, channelPrices: [{ netPrice: '12,50' }] })] }];
        expect(computeProjectChecks({ products }).map(c => c.id)).not.toContain('no-sale-price');
    });
    it('signale les ingrédients sans prix et les prix périmés, pas les sous-recettes', () => {
        const baseIngredients = [
            { name: 'x', purchasePrice: '', lastUpdated: '2020-01-01' },
            { name: 'y', purchasePrice: 5, lastUpdated: '2020-01-01' },
            { name: 'sous-recette', isRecipe: true, purchasePrice: '', lastUpdated: '2020-01-01' },
        ];
        const checks = computeProjectChecks({ baseIngredients, now: new Date('2026-11-18') });
        expect(checks.find(c => c.id === 'ingredients-no-price').message).toMatch(/^1 ingrédient /);
        expect(checks.find(c => c.id === 'ingredients-stale').message).toMatch(/^2 ingrédients /);
    });
});

// Intégrité des données (19/11, audit complémentaire) : des erreurs que le calcul absorbait sans bruit.
describe('computeProjectChecks : intégrité des données', () => {
    const ingredients = [{ id: 'ing_riz', name: 'Riz', unit: 'kg', purchasePrice: 3 }];
    const packaging = [{ id: 'pkg_sac', name: 'Sac', unit: 'unité', purchasePrice: 0.2 }];
    const recipeProduct = (rows = {}) => ({
        id: 'p1', platName: 'Plat', activityId: 'act1',
        formats: [fmt({ salesMix: 100, ingredients: rows.ingredients || [], packagingItems: rows.packagingItems || [] })],
    });
    const run = (extra = {}) => computeProjectChecks({
        products: [recipeProduct()], baseIngredients: ingredients, basePackaging: packaging,
        productionActivities: [{ id: 'act1' }], salesChannels: [{ id: 'ch1' }], ...extra,
    }).map(c => c.id);

    it('ne signale rien quand les références sont toutes valides', () => {
        const product = recipeProduct({ ingredients: [{ id: 'ing_riz', quantity: 500, recipeUnit: 'g' }], packagingItems: [{ id: 'pkg_sac', quantity: 1, recipeUnit: 'unité' }] });
        expect(run({ products: [product] })).toEqual([]);
    });
    it('signale une ligne de recette dont l\'ingrédient n\'existe plus, mais accepte une sous-recette', () => {
        const sub = { id: 'sp', platName: 'Sauce', isIngredient: true, activityId: 'act1', formats: [fmt({ id: 'fmt_sauce', portionUnit: 'ml', portionSize: 500, salesMix: 0, onMenu: false })] };
        const useSub = recipeProduct({ ingredients: [{ id: 'fmt_sauce', quantity: 100, recipeUnit: 'ml' }] });
        expect(run({ products: [useSub, sub] })).not.toContain('missing-references');
        const useGone = recipeProduct({ ingredients: [{ id: 'ing_disparu', quantity: 1, recipeUnit: 'kg' }] });
        const check = computeProjectChecks({ products: [useGone], baseIngredients: ingredients }).find(c => c.id === 'missing-references');
        expect(check.message).toMatch(/Plat/);
        expect(check.message).toMatch(/0\u00A0\$/);
    });
    it('signale un emballage supprimé', () => {
        const product = recipeProduct({ packagingItems: [{ id: 'pkg_gone', quantity: 1, recipeUnit: 'unité' }] });
        expect(run({ products: [product] })).toContain('missing-packaging');
    });
    it('signale une unité de recette d\'une autre famille que celle de l\'ingrédient', () => {
        const product = recipeProduct({ ingredients: [{ id: 'ing_riz', quantity: 1, recipeUnit: 'L' }] });
        expect(run({ products: [product] })).toContain('unit-mismatch');
        const sameFamily = recipeProduct({ ingredients: [{ id: 'ing_riz', quantity: 1, recipeUnit: 'lb' }] });
        expect(run({ products: [sameFamily] })).not.toContain('unit-mismatch');
    });
    it('signale une perte de 100 % ou plus', () => {
        expect(run({ baseIngredients: [{ id: 'a', name: 'Lait', unit: 'L', purchasePrice: 2, lossPercentage: 100 }] })).toContain('loss-100');
        expect(run({ baseIngredients: [{ id: 'a', name: 'Lait', unit: 'L', purchasePrice: 2, lossPercentage: 99 }] })).not.toContain('loss-100');
    });
    it('signale un canal en double dans un format, un canal supprimé et une activité disparue', () => {
        const dup = { ...recipeProduct(), formats: [fmt({ salesMix: 100, channelPrices: [{ channelId: 'ch1', netPrice: 5, volume: 10 }, { channelId: 'ch1', netPrice: 5, volume: 20 }] })] };
        expect(run({ products: [dup] })).toContain('duplicate-channel');
        const orphanChannel = { ...recipeProduct(), formats: [fmt({ salesMix: 100, channelPrices: [{ channelId: 'ch_supprime', netPrice: 5, volume: 10 }] })] };
        expect(run({ products: [orphanChannel] })).toContain('missing-channel');
        expect(run({ products: [{ ...recipeProduct(), activityId: 'act_supprimee' }] })).toContain('missing-activity');
    });
    it('signale une quantité de format nulle', () => {
        const zero = { ...recipeProduct(), formats: [fmt({ salesMix: 100, portionSize: '0' })] };
        expect(run({ products: [zero] })).toContain('portion-size');
    });
    it('signale les points de référence enregistrés sans détail par canal', () => {
        const legacy = { productsWithCosts: [{ onMenu: true, costs: {} }] };
        const recent = { productsWithCosts: [{ onMenu: true, channelBreakdown: [{ channelId: 'ch1' }], costs: {} }] };
        expect(run({ trackingPoints: [recent] })).not.toContain('legacy-snapshots');
        expect(run({ trackingPoints: [recent, legacy] })).toContain('legacy-snapshots');
    });
    it('sans les listes de référence, ne conclut rien (liste absente ≠ liste vide)', () => {
        const product = recipeProduct({ ingredients: [{ id: 'ing_riz', quantity: 1, recipeUnit: 'kg' }] });
        expect(computeProjectChecks({ products: [product] }).map(c => c.id)).toEqual([]);
    });
});

// Contrôles ajoutés le 20/11 (audit, constats 6 et 7).
describe('computeProjectChecks : volumes et prix à 0 $', () => {
    it('signale un SKU actif sans aucun volume vendu (un % des ventes seul ne suffit pas)', () => {
        const noVolume = [{ platName: 'Sauce', formats: [fmt({ salesMix: 100, indirectCosts: { portionsSold: 0 }, channelPrices: [{ channelId: 'c', netPrice: 5, volume: 0 }] })] }];
        const checks = computeProjectChecks({ products: noVolume });
        expect(checks.map(c => c.id)).toContain('no-volume');
        expect(checks.find(c => c.id === 'no-volume').message).toMatch(/^1 SKU actif n'a aucun volume vendu \(Sauce\)/);
        const withVolume = [{ platName: 'Sauce', formats: [fmt({ salesMix: 100, indirectCosts: { portionsSold: 0 }, channelPrices: [{ channelId: 'c', netPrice: 5, volume: 40 }] })] }];
        expect(computeProjectChecks({ products: withVolume }).map(c => c.id)).not.toContain('no-volume');
    });
    it("un SKU inactif sans volume n'est pas signalé", () => {
        const inactive = [{ platName: 'Bouillon', formats: [fmt({ onMenu: false, salesMix: 0, indirectCosts: { portionsSold: 0 } })] }];
        expect(computeProjectChecks({ products: inactive }).map(c => c.id)).not.toContain('no-volume');
    });
    it('signale un volume vendu à un prix net de 0 $ (produit offert, à confirmer)', () => {
        const free = [{ platName: 'Échantillon', formats: [fmt({ salesMix: 100, channelPrices: [{ channelId: 'c', netPrice: 0, volume: 25 }] })] }];
        const checks = computeProjectChecks({ products: free });
        expect(checks.map(c => c.id)).toContain('sold-at-zero');
        const paid = [{ platName: 'Échantillon', formats: [fmt({ salesMix: 100, channelPrices: [{ channelId: 'c', netPrice: 3, volume: 25 }] })] }];
        expect(computeProjectChecks({ products: paid }).map(c => c.id)).not.toContain('sold-at-zero');
    });
});

// Contrôles ajoutés le 20/11 (audit, constats 8 et 9).
describe('computeProjectChecks : boucles, quantité produite, quantités négatives', () => {
    const run = (args) => computeProjectChecks(args).map(c => c.id);
    it('signale une boucle de sous-recettes avec les noms des produits concernés', () => {
        const a = { id: 'a', platName: 'Sauce A', isIngredient: true, formats: [fmt({ id: 'fa', ingredients: [{ id: 'fb', quantity: 1 }] })] };
        const b = { id: 'b', platName: 'Base B', isIngredient: true, formats: [fmt({ id: 'fb', ingredients: [{ id: 'fa', quantity: 1 }] })] };
        const checks = computeProjectChecks({ products: [a, b] });
        const loop = checks.find(c => c.id === 'recipe-loop');
        expect(loop.message).toMatch(/Sauce A/);
        expect(loop.message).toMatch(/Base B/);
    });
    it('signale un format sans quantité produite, sauf avec une grille de rendement ou pour un produit de revente', () => {
        const none = [{ platName: 'Plat', formats: [fmt({ nbPortions: '' })] }];
        expect(run({ products: none })).toContain('batch-size');
        const grid = [{ platName: 'Plat', formats: [fmt({ nbPortions: '', yieldGrid: { enabled: true, baseQuantity: 10 } })] }];
        expect(run({ products: grid })).not.toContain('batch-size');
        const resale = [{ platName: 'Revente', formats: [fmt({ nbPortions: '', isResaleProduct: true })] }];
        expect(run({ products: resale })).not.toContain('batch-size');
    });
    it('signale une quantité négative dans une recette', () => {
        const neg = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: '-3' }] })] }];
        expect(run({ products: neg })).toContain('negative-quantity');
        const ok = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: '3' }] })] }];
        expect(run({ products: ok })).not.toContain('negative-quantity');
    });
    // Saisies illisibles et rendement nul (23/11, audit) : jamais de fausse alerte sur un champ vide, un nombre ou un format courant.
    it('signale une quantité ou un prix illisible, jamais un champ vide, un nombre ou une saisie à virgule ou espaces', () => {
        const bad = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: 'abc' }] })] }];
        expect(run({ products: bad })).toContain('unreadable-quantity');
        const fine = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'a', quantity: '' }, { id: 'b', quantity: 2.5 }, { id: 'c', quantity: '1 234,5' }, { id: 'd', quantity: '-3' }] })] }];
        expect(run({ products: fine })).not.toContain('unreadable-quantity');
        expect(run({ baseIngredients: [{ name: 'Sel', purchasePrice: '12,5$x' }] })).toContain('unreadable-price');
        expect(run({ basePackaging: [{ name: 'Sac', purchasePrice: 'abc' }] })).toContain('unreadable-price');
        expect(run({ baseIngredients: [{ name: 'A', purchasePrice: '' }, { name: 'B', purchasePrice: 1e-7 }, { name: 'C', purchasePrice: '12,50' }, { name: 'Sous', isRecipe: true, purchasePrice: 'abc' }] })).not.toContain('unreadable-price');
    });
    it('signale un rendement à 0 % ou illisible, pas un rendement vide ou à 100 %', () => {
        const zero = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: 1, yieldPercentage: '0' }] })] }];
        expect(run({ products: zero })).toContain('yield-zero');
        const bad = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: 1, yieldPercentage: 'abc' }] })] }];
        expect(run({ products: bad })).toContain('yield-zero');
        const ok = [{ platName: 'Plat', formats: [fmt({ ingredients: [{ id: 'x', quantity: 1, yieldPercentage: '' }, { id: 'y', quantity: 1, yieldPercentage: 100 }, { id: 'z', quantity: 1, yieldPercentage: '85' }] })] }];
        expect(run({ products: ok })).not.toContain('yield-zero');
    });
});
