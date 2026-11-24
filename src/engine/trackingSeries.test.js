import { describe, it, expect } from 'vitest';
import { getDefaultState } from '../state/initialState.js';
import { computeProjectAnalysis } from './analysisPipeline.js';
import { computeGlobalSeries, computeProductSeries, isProductPriced } from './trackingSeries.js';
import { buildKeyFindingsContext } from './keyFindings.js';
import { computeIngredientPriceEffect } from './keyFindings.js';

// Séries d'évolution et effet des prix, extraits de l'écran / des constats (phase 1 de la refonte de l'export PDF).

const demo = () => {
    const s = getDefaultState();
    const a = computeProjectAnalysis({
        products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase,
        generalInfo: s.generalInfo, salesChannels: s.salesChannels, productionActivities: s.productionActivities,
        expenseLines: s.expenseLines, revenueLines: s.revenueLines, directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys,
    });
    return { s, a: a.data };
};

describe('computeGlobalSeries', () => {
    it('une ligne par point de référence, avec les quatre variables suivies par l\'écran (dont l\'emballage)', () => {
        const { s } = demo();
        const series = computeGlobalSeries(s.trackingPoints);
        expect(series).toHaveLength(s.trackingPoints.length);
        expect(Object.keys(series[0])).toEqual(expect.arrayContaining(['label', 'Marge brute moyenne', 'Coût matière moyen', 'Coût emballage moyen', "Coût main-d'œuvre moyen", 'Point mort global']));
        expect(series[0].label).toBe(s.trackingPoints[0].name);
    });

    it('le dernier point du graphique rejoint les tuiles de la Vue d\'ensemble (même pondération)', () => {
        const { s, a } = demo();
        const last = computeGlobalSeries(s.trackingPoints).at(-1);
        expect(last['Marge brute moyenne']).toBeCloseTo(a.weightedGrossMargin * 100, 1);
        expect(last['Coût matière moyen']).toBeCloseTo(a.weightedMaterialCost * 100, 1);
        expect(last['Coût emballage moyen']).toBeCloseTo(a.weightedPackagingCost * 100, 1);
        expect(last["Coût main-d'œuvre moyen"]).toBeCloseTo(a.weightedLaborCost * 100, 1);
    });

    it('un point sans produit actif pondérable donne des valeurs absentes (null), jamais 0', () => {
        const point = { timestamp: '2026-01-01T00:00:00Z', name: 'Vide', note: '', productsWithCosts: [], generalInfo: { totalIndirects: 0 } };
        const [row] = computeGlobalSeries([point]);
        expect(row['Marge brute moyenne']).toBeNull();
        expect(row['Coût emballage moyen']).toBeNull();
        expect(row['Point mort global']).toBeNull();
    });

    it('sans point de référence : aucune série', () => {
        expect(computeGlobalSeries([])).toEqual([]);
        expect(computeGlobalSeries()).toEqual([]);
    });
});

describe('computeProductSeries et isProductPriced', () => {
    it('un SKU : cinq variables en % (dont l\'emballage) et quatre en $/unité, une ligne par point', () => {
        const { s, a } = demo();
        const chili = a.activeProducts.find(r => r.displayName.startsWith('Chili'));
        const series = computeProductSeries(s.trackingPoints, chili.id);
        expect(series).toHaveLength(s.trackingPoints.length);
        expect(Object.keys(series[0])).toEqual(expect.arrayContaining([
            'Coût matière (%)', 'Coût emballage (%)', "Coût main-d'œuvre (%)", 'Coût des frais indirects (%)', 'Marge nette (%)',
            'Coût matière ($/u.)', 'Coût emballage ($/u.)', "Coût main-d'œuvre ($/u.)", 'Coût de revient ($/u.)',
        ]));
        expect(series.every(r => typeof r['Marge nette (%)'] === 'number')).toBe(true);
    });

    it('sans SKU choisi : aucune série ; un SKU absent d\'un point : valeurs null', () => {
        const { s } = demo();
        expect(computeProductSeries(s.trackingPoints, null)).toEqual([]);
        const rows = computeProductSeries(s.trackingPoints, 'inconnu');
        expect(rows).toHaveLength(s.trackingPoints.length);
        rows.forEach(r => { expect(r['Marge nette (%)']).toBeNull(); expect(r['Coût de revient ($/u.)']).toBeNull(); });
    });

    it('détecte un format sans prix de vente (le graphique bascule alors sur les $/unité)', () => {
        const priced = { timestamp: 't', name: 'A', productsWithCosts: [{ id: 'x', prixVente: '8,50' }] };
        const unpriced = { timestamp: 't', name: 'B', productsWithCosts: [{ id: 'x', prixVente: '' }] };
        expect(isProductPriced([priced], 'x')).toBe(true);
        expect(isProductPriced([unpriced], 'x')).toBe(false);
        expect(isProductPriced([unpriced, priced], 'x')).toBe(true);
        expect(isProductPriced([], 'x')).toBe(false);
    });
});

describe('computeIngredientPriceEffect (effet des variations de prix)', () => {
    it('démo : une économie d\'environ 918 $ sur les 3 derniers relevés (4,8 % des achats)', () => {
        const { s, a } = demo();
        const ctx = buildKeyFindingsContext({ analysisData: a, trackingPoints: s.trackingPoints, baseIngredients: s.ingredientsList });
        const pe = computeIngredientPriceEffect(a.purchasingReportData, ctx.ingredientVolatilityRecent);
        expect(pe.effect).toBeCloseTo(-918, 0);
        expect(pe.pointCount).toBe(3);
        expect(pe.share).toBeCloseTo(-0.048, 3);
        expect(pe.base).toBeGreaterThan(0);
    });

    it('sans historique suffisant : null (la règle se tait)', () => {
        const { a } = demo();
        expect(computeIngredientPriceEffect(a.purchasingReportData, { hasEnoughData: false, byName: {} })).toBeNull();
        expect(computeIngredientPriceEffect(a.purchasingReportData, undefined)).toBeNull();
    });
});
