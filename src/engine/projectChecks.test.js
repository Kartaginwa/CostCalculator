import { describe, it, expect } from 'vitest';
import { computeProjectChecks } from './projectChecks.js';

const fmt = (over = {}) => ({ onMenu: true, salesMix: 50, prixVente: 10, portionSize: 1, portionUnit: 'unité', channelPrices: [], ...over });

describe('computeProjectChecks', () => {
    it('ne signale rien pour un projet vide ou cohérent', () => {
        expect(computeProjectChecks({})).toEqual([]);
        const products = [{ platName: 'A', formats: [fmt({ salesMix: 60 })] }, { platName: 'B', formats: [fmt({ salesMix: 40 })] }];
        expect(computeProjectChecks({ products })).toEqual([]);
    });
    it('signale un mix ≠ 100 %, un SKU sans prix et un produit sans nom', () => {
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
describe('computeProjectChecks : intégrité des données', () => {
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
        expect(check.message).toMatch(/0 \$/);
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
    it('signale une perte de 100 % ou plus', () => {
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
