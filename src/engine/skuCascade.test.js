import { describe, it, expect } from 'vitest';
import { getDefaultState } from '../state/initialState.js';
import { computeProjectAnalysis } from './analysisPipeline.js';
import { computeSkuCascade } from './skuCascade.js';

// Cascade d'un SKU (extraite de l'écran Par SKU, phase 1 de la refonte de l'export PDF). Chiffres de référence : ceux du projet démo,
// déjà cités par le guide (guideNumbers.js) et vérifiés à l'écran par e2e/guide-demo-numbers.spec.js (Chili con carne mijoté).

const demo = () => {
    const s = getDefaultState();
    const a = computeProjectAnalysis({
        products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase,
        generalInfo: s.generalInfo, salesChannels: s.salesChannels, productionActivities: s.productionActivities,
        expenseLines: s.expenseLines, revenueLines: s.revenueLines, directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys,
    });
    return { s, rows: a.data.activeProducts };
};
const chili = (rows) => rows.find(r => r.displayName.startsWith('Chili'));

describe('computeSkuCascade — Chili con carne mijoté (démo)', () => {
    it('part du PDS et liste les maillons du plus proche du PDS au plus proche du prix net', () => {
        const { s, rows } = demo();
        const c = computeSkuCascade(chili(rows), s.salesChannels);
        expect(c.pds).toBeCloseTo(8.99, 2);
        expect(c.linkRows.map(l => l.label)).toEqual(['Épicier indépendant', 'Détaillant national', 'Centre de distribution']);
        expect(c.channels.map(x => x.channelName)).toEqual(chili(rows).channelBreakdown.map(cb => cb.channelName));
    });

    it('écart en $ de chaque maillon et total par canal (vente directe : 0 $, une vraie valeur)', () => {
        const { s, rows } = demo();
        const [direct, epiceries, grandes] = computeSkuCascade(chili(rows), s.salesChannels).channels;
        expect(direct.totalDelta).toBe(0);
        expect(Object.keys(direct.deltas)).toEqual([]);
        expect(epiceries.deltas['Épicier indépendant']).toBeCloseTo(2.70, 2);
        expect(epiceries.totalDelta).toBeCloseTo(2.70, 2);
        expect(grandes.deltas['Détaillant national']).toBeCloseTo(2.88, 2);
        expect(grandes.deltas['Centre de distribution']).toBeCloseTo(0.65, 2);
        expect(grandes.totalDelta).toBeCloseTo(3.53, 2);
        // Le prix net est le PDS moins les maillons : même chiffre que la ligne « Prix de vente » de l'écran.
        expect(grandes.netPrice).toBeCloseTo(8.99 - 3.53, 2);
    });

    it('frais fixes, coût net, marges, seuil de rentabilité : mêmes valeurs que l\'écran', () => {
        const { s, rows } = demo();
        const [direct, epiceries, grandes] = computeSkuCascade(chili(rows), s.salesChannels).channels;
        expect(direct.fixedGeneral).toBeCloseTo(0.71, 2);
        expect(direct.fixedActivity).toBeCloseTo(1.00, 2);
        expect(direct.fixedChannel).toBeCloseTo(1.10, 2);
        expect(direct.fixedTotal).toBeCloseTo(2.81, 2);
        expect(direct.netCost).toBeCloseTo(6.61, 2);
        expect(direct.netMarginPercent).toBeCloseTo(0.1825, 3);
        expect(epiceries.netMarginPercent).toBeCloseTo(-0.0076, 3);
        expect(grandes.netMarginPercent).toBeCloseTo(-0.0961, 3);
        expect(direct.revenueTotal).toBeCloseTo(922.26, 1);
        expect(direct.profitTotal).toBeCloseTo(168.31, 1);
        expect(epiceries.profitTotal).toBeCloseTo(-12.89, 1);
        expect([direct.breakEvenUnits, epiceries.breakEvenUnits, grandes.breakEvenUnits]).toEqual([575, 946, 1365]);
    });
});

describe('computeSkuCascade — données absentes : jamais un zéro inventé', () => {
    it('sans PDS : écarts et totaux des maillons absents (null), sauf si le canal n\'a aucun maillon… qui reste absent aussi', () => {
        const { s, rows } = demo();
        const row = chili(rows);
        const noPds = { ...row, format: { ...row.format, pds: '' } };
        const c = computeSkuCascade(noPds, s.salesChannels);
        expect(c.pds).toBe(0);
        c.channels.forEach(ch => {
            expect(ch.totalDelta).toBeNull();
            Object.values(ch.deltas).forEach(v => expect(v).toBeNull());
        });
    });

    it('sans volume réel dans un canal : revenu, frais et bénéfice totaux absents (null)', () => {
        const { s, rows } = demo();
        const row = chili(rows);
        const noVolume = { ...row, channelBreakdown: row.channelBreakdown.map(cb => ({ ...cb, volume: 0 })) };
        computeSkuCascade(noVolume, s.salesChannels).channels.forEach(ch => {
            expect(ch.revenueTotal).toBeNull();
            expect(ch.costTotal).toBeNull();
            expect(ch.profitTotal).toBeNull();
        });
    });

    it('un SKU rattaché à aucun canal : aucune colonne, aucun maillon', () => {
        const { s, rows } = demo();
        const c = computeSkuCascade({ ...chili(rows), channelBreakdown: [] }, s.salesChannels);
        expect(c.channels).toEqual([]);
        expect(c.linkRows).toEqual([]);
    });
});
