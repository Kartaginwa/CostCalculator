import { describe, it, expect } from 'vitest';
import { computeAnalysisData } from './analysisData.js';

const baseGeneralInfo = (overrides = {}) => ({
    totalRevenue: 0,
    menuRevenuePercentage: 100,
    totalIndirects: 0,
    kitchenProductivity: 100,
    ...overrides,
});

const baseProduct = (overrides = {}) => ({
    id: 'p1',
    platName: 'Produit Test',
    prixVente: 20,
    nbPortions: 1,
    isResaleProduct: false,
    purchaseCost: 0,
    ingredients: [],
    productionSteps: [],
    indirectCosts: { method: 'fixed', fixedAmount: 0 },
    salesMix: 0,
    onMenu: true,
    ...overrides,
});

describe('computeAnalysisData - moyennes pondérées et point mort global', () => {
    it('pondère la marge et les coûts par le mix des ventes de chaque produit actif', () => {
        const productA = baseProduct({ id: 'A', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 70 });
        const productB = baseProduct({ id: 'B', isResaleProduct: true, purchaseCost: 2, prixVente: 10, salesMix: 30 });
        const products = [productA, productB];
        const generalInfo = baseGeneralInfo({ totalRevenue: 10000, totalIndirects: 1000 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        // A : marge 10$/20$ = 0.5, B : marge 8$/10$ = 0.8 -> pondéré 70/30 = 0.59
        expect(result.weightedGrossMargin).toBeCloseTo(0.59);
        // A : coût matière 10/20 = 0.5, B : 2/10 = 0.2 -> pondéré 70/30 = 0.41
        expect(result.weightedMaterialCost).toBeCloseTo(0.41);
        expect(result.weightedLaborCost).toBeCloseTo(0);
        // point mort = frais indirects alloués au menu / marge brute pondérée = 1000 / 0.59
        expect(result.globalBreakEven).toBeCloseTo(1000 / 0.59);
    });

    it('exclut les produits hors menu du calcul des moyennes pondérées', () => {
        const productA = baseProduct({ id: 'A', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 100, onMenu: true });
        const productB = baseProduct({ id: 'B', isResaleProduct: true, purchaseCost: 19, prixVente: 20, salesMix: 999, onMenu: false });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([productA, productB], [], [], generalInfo, calculatedGeneralInfo);

        expect(result.activeProducts).toHaveLength(1);
        expect(result.activeProducts[0].id).toBe('A');
        expect(result.weightedGrossMargin).toBeCloseTo(0.5); // uniquement A, mix 100%
    });
});

describe('computeAnalysisData - analyse ABC', () => {
    it('classe les ingrédients en A/B/C selon les seuils cumulés de 70% et 90%', () => {
        // Un seul produit consommant 3 ingrédients, calibré pour que la valeur de
        // consommation de chacun corresponde exactement à sa quantité (batchesNeeded = 1).
        const baseIngredients = [
            { id: 'ing_A', name: 'Ingrédient A', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
            { id: 'ing_B', name: 'Ingrédient B', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
            { id: 'ing_C', name: 'Ingrédient C', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
        ];
        const product = baseProduct({
            prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true,
            ingredients: [
                { id: 'ing_A', quantity: 70, recipeUnit: 'unité' },
                { id: 'ing_B', quantity: 20, recipeUnit: 'unité' },
                { id: 'ing_C', quantity: 10, recipeUnit: 'unité' },
            ],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo);

        expect(result.abcAnalysisData.A.map(i => i.name)).toEqual(['Ingrédient A']);
        expect(result.abcAnalysisData.B.map(i => i.name)).toEqual(['Ingrédient B']);
        expect(result.abcAnalysisData.C.map(i => i.name)).toEqual(['Ingrédient C']);
    });
});

describe('computeAnalysisData - matrice BCG (menu engineering)', () => {
    it('classe chaque produit dans le bon quadrant selon sa popularité et sa rentabilité relatives', () => {
        const products = [
            baseProduct({ id: 'star', prixVente: 20, isResaleProduct: true, purchaseCost: 10, salesMix: 40, onMenu: true }), // marge 10, pop 40
            baseProduct({ id: 'cow', prixVente: 20, isResaleProduct: true, purchaseCost: 18, salesMix: 40, onMenu: true }),  // marge 2, pop 40
            baseProduct({ id: 'question', prixVente: 20, isResaleProduct: true, purchaseCost: 10, salesMix: 10, onMenu: true }), // marge 10, pop 10
            baseProduct({ id: 'dog', prixVente: 20, isResaleProduct: true, purchaseCost: 18, salesMix: 10, onMenu: true }),  // marge 2, pop 10
        ];
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        expect(result.menuEngineeringData.stars.map(p => p.id)).toEqual(['star']);
        expect(result.menuEngineeringData.cows.map(p => p.id)).toEqual(['cow']);
        expect(result.menuEngineeringData.questions.map(p => p.id)).toEqual(['question']);
        expect(result.menuEngineeringData.dogs.map(p => p.id)).toEqual(['dog']);
    });
});

describe('computeAnalysisData - contribution au profit', () => {
    it('trie les produits par contribution totale décroissante', () => {
        const products = [
            baseProduct({ id: 'low', prixVente: 10, isResaleProduct: true, purchaseCost: 8, salesMix: 10, onMenu: true }),
            baseProduct({ id: 'high', prixVente: 10, isResaleProduct: true, purchaseCost: 2, salesMix: 90, onMenu: true }),
        ];
        const generalInfo = baseGeneralInfo({ totalRevenue: 1000, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        expect(result.contributionData[0].name).toBe('Produit Test'); // le plus haut contributeur en premier
        expect(result.contributionData[0].totalContribution).toBeGreaterThan(result.contributionData[1].totalContribution);
    });
});

describe('computeAnalysisData - rapport d\'achats et pertes', () => {
    it('calcule le coût net et le coût de perte cohérents avec le taux de perte de l\'ingrédient', () => {
        const baseIngredients = [
            { id: 'ing_1', name: 'Farine', provider: 'Fournisseur A', unit: 'kg', unitPrice: 2, lossPercentage: 20 },
        ];
        const product = baseProduct({
            prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true,
            ingredients: [{ id: 'ing_1', quantity: 10, recipeUnit: 'kg' }],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo);

        // batchesNeeded = 1 -> quantité nette = 10kg, coût net = 10 * 2$ = 20$
        expect(result.purchasingReportData.totalNetCost).toBeCloseTo(20);
        // coût de perte = net / (1 - 20%) - net = 20/0.8 - 20 = 5
        expect(result.purchasingReportData.totalLossCost).toBeCloseTo(5);
        expect(result.purchasingReportData.groupedByProvider['Fournisseur A'].totalCost).toBeCloseTo(25);
    });
});
