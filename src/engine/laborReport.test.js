import { describe, it, expect } from 'vitest';
import {
    computeSafetyMargin, computeProviderShares, computeLaborCascade, computeProductLaborProfitability, computeActivityLaborRatios, computeGrowthMargin,
} from './laborReport.js';
import { computeLaborHoursNeeded } from './laborHours.js';

describe('computeSafetyMargin — marge de sécurité', () => {
    it('(ventes − point mort) ÷ ventes', () => {
        const r = computeSafetyMargin(80000, 60000);
        expect(r.ratio).toBeCloseTo(0.25, 10);
        expect(r.surplus).toBe(20000);
    });
    it('négative quand les ventes sont sous le point mort', () => {
        expect(computeSafetyMargin(75366, 76656).ratio).toBeLessThan(0);
    });
    it('absente (null) sans ventes prévues ou sans point mort : jamais forcée à 0', () => {
        expect(computeSafetyMargin(0, 1000)).toBeNull();
        expect(computeSafetyMargin(50000, 0)).toBeNull();
        expect(computeSafetyMargin(50000, NaN)).toBeNull();
        expect(computeSafetyMargin(50000, Infinity)).toBeNull();
    });
});

describe('computeProviderShares — part des achats par fournisseur', () => {
    const report = { groupedByProvider: { A: { totalCost: 500 }, B: { totalCost: 300 }, C: { totalCost: 200 } } };
    it('les parts somment à 100 % et sont triées', () => {
        const { rows, total } = computeProviderShares(report);
        expect(total).toBe(1000);
        expect(rows.map(r => r.provider)).toEqual(['A', 'B', 'C']);
        expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    });
    it('signale une dépendance à partir du seuil (inclus)', () => {
        const { rows } = computeProviderShares(report, 0.5);
        expect(rows.map(r => r.isDependent)).toEqual([true, false, false]);
        expect(computeProviderShares(report).rows[0].isDependent).toBe(true); // seuil par défaut : 40 %
    });
    it('rapport vide : aucune ligne, aucune part inventée', () => {
        expect(computeProviderShares({ groupedByProvider: {} })).toEqual({ rows: [], total: 0 });
        expect(computeProviderShares(null).rows).toEqual([]);
    });
});

describe('computeLaborCascade — où va la paie', () => {
    // Un poste : 2 employés, 100 h payées chacun, 20 $/h chargé, 80 % productif → 200 h payées, 160 h attendues, paie 4 000 $.
    const emp = { workedHours: '100', hourlyRate: '20', socialCharges: '0', vacationPercentage: '0', productiveTimePercentage: '80' };
    const db = [{ id: 'p1', postName: 'Cuisine', employees: [emp, { ...emp }] }, { id: 'p2', postName: 'Gestion', employees: [{ ...emp, workedHours: '10', productiveTimePercentage: '100' }] }];
    it('heures payées = utilisées + inutilisées + non productives ; paie = somme des trois coûts', () => {
        const c = computeLaborCascade(db, [{ postName: 'Cuisine', actual: 120 }, { postName: 'Gestion', actual: 0 }]);
        expect(c.paidHours).toBeCloseTo(210, 8);
        expect(c.usedHours + c.idleHours + c.nonProductiveHours).toBeCloseTo(c.paidHours, 8);
        expect(c.costUsed + c.costIdle + c.costNonProductive).toBeCloseTo(c.payroll, 8);
        expect(c.usedHours).toBeCloseTo(120, 8);
        expect(c.nonProductiveHours).toBeCloseTo(40, 8);
    });
    it('un poste sans heure requise compte entièrement en heures inutilisées, mais pas dans la marge de croissance', () => {
        const c = computeLaborCascade(db, [{ postName: 'Cuisine', actual: 120 }, { postName: 'Gestion', actual: 0 }]);
        expect(c.idleHours).toBeCloseTo(40 + 10, 8);          // 160 − 120 pour la cuisine, 10 h pour la gestion
        expect(c.freeProductionHours).toBeCloseTo(40, 8);      // la gestion n'y figure pas
        expect(c.noRecipeIdleHours).toBeCloseTo(10, 8);        // ses heures : l'écart avec la différence du rapport de productivité
        expect(c.freeProductionHours + c.noRecipeIdleHours).toBeCloseTo(c.idleHours, 8);
    });
    it('coût réel d\'une heure productive = paie ÷ heures utilisées, supérieur au taux moyen chargé quand des heures sont inutilisées', () => {
        const c = computeLaborCascade(db, [{ postName: 'Cuisine', actual: 120 }, { postName: 'Gestion', actual: 0 }]);
        expect(c.effectiveHourlyCost).toBeCloseTo(c.payroll / 120, 8);
        expect(c.averageLoadedRate).toBeCloseTo(20, 8);
        expect(c.effectiveHourlyCost).toBeGreaterThan(c.averageLoadedRate);
    });
    it('des heures réelles au-delà des heures attendues ne créent pas de capacité négative', () => {
        const c = computeLaborCascade(db, [{ postName: 'Cuisine', actual: 200 }]);
        expect(c.idleHours).toBeGreaterThanOrEqual(0);
        expect(c.overloadHours).toBeCloseTo(40, 8);
    });
    it('sans postes ou sans heures : valeurs absentes (null), pas de division par zéro', () => {
        const c = computeLaborCascade([], []);
        expect(c.unusedShare).toBeNull(); expect(c.effectiveHourlyCost).toBeNull(); expect(c.averageLoadedRate).toBeNull();
    });
});

const product = (id, activityId, resale, rows) => ({
    id, displayName: id, activityId, format: { id: `f_${id}`, isResaleProduct: resale },
    channelBreakdown: rows.map(([netPrice, volume, margeBruteDollar]) => ({ netPrice, volume, margeBruteDollar })),
});

describe('rentabilité de l\'heure de main-d\'œuvre', () => {
    const products = [product('a', 'act1', false, [[10, 100, 4]]), product('b', 'act1', false, [[20, 50, 8]]), product('r', 'act1', true, [[5, 1000, 2]])];
    const hoursByFormat = { f_a: 10, f_b: 5 };
    it('par produit : bénéfice brut ÷ heures ; un produit de revente reste listé sans ratio', () => {
        const rows = computeProductLaborProfitability(products, hoursByFormat);
        expect(rows.find(r => r.id === 'a').grossProfitPerHour).toBeCloseTo(400 / 10, 8);
        expect(rows.find(r => r.id === 'b').grossProfitPerHour).toBeCloseTo(400 / 5, 8);
        const resale = rows.find(r => r.id === 'r');
        expect(resale.isResale).toBe(true);
        expect(resale.grossProfitPerHour).toBeNull();
    });
    it('par activité : les produits de revente sont exclus du revenu et du bénéfice brut', () => {
        const [a] = computeActivityLaborRatios(products, { act1: 20 }, [{ id: 'act1', name: 'Activité 1' }]);
        expect(a.revenue).toBeCloseTo(1000 + 1000, 8);          // a + b, sans la revente (5 000 $)
        expect(a.grossProfit).toBeCloseTo(800, 8);
        expect(a.revenuePerHour).toBeCloseTo(100, 8);
        expect(a.sharePercent).toBeCloseTo(100, 8);
    });
    it('une activité sans heures n\'a pas de ratio (null)', () => {
        const [a] = computeActivityLaborRatios(products, {}, [{ id: 'act1', name: 'Activité 1' }]);
        expect(a.revenuePerHour).toBeNull(); expect(a.grossProfitPerHour).toBeNull();
    });
    it('marge de croissance : heures libres × revenu et bénéfice brut moyens par heure, hors revente', () => {
        const rows = computeProductLaborProfitability(products, hoursByFormat);
        const g = computeGrowthMargin(15, rows);               // sans total d'heures : repli sur les heures des produits fabriqués (15 h)
        expect(g.revenuePerHour).toBeCloseTo(2000 / 15, 8);
        expect(g.additionalRevenue).toBeCloseTo(2000, 8);
        expect(g.additionalGrossProfit).toBeCloseTo(800, 8);
    });
    it('marge de croissance : le revenu par heure se calcule sur TOUTES les heures de production (sous-recettes comprises)', () => {
        const rows = computeProductLaborProfitability(products, hoursByFormat);   // les produits fabriqués ne comptent que 15 h…
        const g = computeGrowthMargin(15, rows, 20);                                // …mais l'équipe en travaille 20 (5 h de sous-recettes)
        expect(g.revenuePerHour).toBeCloseTo(2000 / 20, 8);
        expect(g.grossProfitPerHour).toBeCloseTo(800 / 20, 8);
        expect(g.additionalRevenue).toBeCloseTo(15 * 100, 8);
    });
    it('marge de croissance absente sans heures libres ou sans produit fabriqué', () => {
        expect(computeGrowthMargin(0, computeProductLaborProfitability(products, hoursByFormat))).toBeNull();
        expect(computeGrowthMargin(10, [])).toBeNull();
    });
});

describe('computeLaborHoursNeeded — heures par format', () => {
    it('la somme des heures par format égale le total des heures par poste', () => {
        const products = [{
            id: 'p1', activityId: 'a1', name: 'Soupe',
            formats: [{
                id: 'f1', onMenu: true, nbPortions: '10', portionSize: '1', portionUnit: 'unité', channelPrices: [{ channelId: 'c1', volume: '100', price: '5' }],
                productionSteps: [{ duration: 3600, personnel: [{ postId: 'cuisine' }, { postId: 'cuisine' }] }, { duration: 1800, personnel: [{ postId: 'emb' }] }],
            }],
        }];
        const r = computeLaborHoursNeeded(products, [], [{ id: 'c1', name: 'Direct' }]);
        const sum = Object.values(r.hoursByFormat).reduce((s, h) => s + h, 0);
        expect(sum).toBeGreaterThan(0);
        expect(sum).toBeCloseTo(r.total, 8);
    });
});
