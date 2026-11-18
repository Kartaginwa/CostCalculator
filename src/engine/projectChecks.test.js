import { describe, it, expect } from 'vitest';
import { computeProjectChecks } from './projectChecks.js';

const fmt = (over = {}) => ({ onMenu: true, salesMix: 50, prixVente: 10, channelPrices: [], ...over });

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
