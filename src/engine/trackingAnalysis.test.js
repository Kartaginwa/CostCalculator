import { describe, it, expect } from 'vitest';
import { buildTrackableProducts } from './trackingAnalysis.js';

describe('buildTrackableProducts', () => {
    it('liste un format par ligne distincte, avec son displayName', () => {
        const trackingPoints = [
            {
                id: 'tp1',
                productsWithCosts: [
                    { id: 'fmt_250', productId: 'prod_1', displayName: 'Confiture de fraises (250 ml)', platName: 'Confiture de fraises' },
                    { id: 'fmt_500', productId: 'prod_1', displayName: 'Confiture de fraises (500 ml)', platName: 'Confiture de fraises' },
                ],
            },
        ];
        const result = buildTrackableProducts(trackingPoints);
        expect(result).toEqual([
            { id: 'fmt_250', name: 'Confiture de fraises (250 ml)' },
            { id: 'fmt_500', name: 'Confiture de fraises (500 ml)' },
        ]);
    });

    it("se rabat sur platName pour un ancien point de référence sans displayName (rétrocompatibilité Phase 1.6)", () => {
        const trackingPoints = [
            {
                id: 'tp_old',
                productsWithCosts: [
                    { id: 'prod_1', platName: 'Confiture de fraises' }, // ancienne forme : pas de displayName, id = id du PRODUIT
                ],
            },
        ];
        const result = buildTrackableProducts(trackingPoints);
        expect(result).toEqual([{ id: 'prod_1', name: 'Confiture de fraises' }]);
    });

    it('fait cohabiter un ancien point (une ligne par produit) et un nouveau point (une ligne par format) sans planter', () => {
        const trackingPoints = [
            { id: 'tp_old', productsWithCosts: [{ id: 'prod_1', platName: 'Confiture de fraises' }] },
            {
                id: 'tp_new',
                productsWithCosts: [
                    { id: 'fmt_250', productId: 'prod_1', displayName: 'Confiture de fraises (250 ml)', platName: 'Confiture de fraises' },
                    { id: 'fmt_500', productId: 'prod_1', displayName: 'Confiture de fraises (500 ml)', platName: 'Confiture de fraises' },
                ],
            },
        ];
        const result = buildTrackableProducts(trackingPoints);
        // Trois entrées distinctes : l'ancien point n'a pas été fusionné avec les nouveaux formats
        // (il n'y a pas de moyen fiable de savoir à quel format l'ancienne ligne correspond), mais
        // rien ne plante et les trois restent sélectionnables individuellement.
        expect(result).toHaveLength(3);
        expect(result.map(r => r.id).sort()).toEqual(['fmt_250', 'fmt_500', 'prod_1'].sort());
    });

    it('déduplique un même format suivi sur plusieurs points successifs', () => {
        const row = { id: 'fmt_250', productId: 'prod_1', displayName: 'Confiture de fraises (250 ml)', platName: 'Confiture de fraises' };
        const trackingPoints = [
            { id: 'tp1', productsWithCosts: [row] },
            { id: 'tp2', productsWithCosts: [{ ...row }] },
        ];
        const result = buildTrackableProducts(trackingPoints);
        expect(result).toHaveLength(1);
    });

    it('un produit à un seul format (non-régression) : affiche le nom seul, exactement comme avant la Phase 1.6', () => {
        const trackingPoints = [
            { id: 'tp1', productsWithCosts: [{ id: 'fmt_1', productId: 'prod_1', displayName: 'Tartare de saumon', platName: 'Tartare de saumon' }] },
        ];
        const result = buildTrackableProducts(trackingPoints);
        expect(result).toEqual([{ id: 'fmt_1', name: 'Tartare de saumon' }]);
    });

    it('ne plante pas sur un trackingPoints vide', () => {
        expect(buildTrackableProducts([])).toEqual([]);
    });
});
