import { describe, it, expect } from 'vitest';
import { getDefaultState } from '../state/initialState.js';
import { parseLocaleNumber as P } from '../utils.js';
import {
    computeActivitySummaries, computeChannelSummaries, computeSnapshotBreakEven,
} from './analysisData.js';
import { applyCostShocks } from './costScenario.js';
import { computeProjectChecks } from './projectChecks.js';
import { computeProjectAnalysis } from './analysisPipeline.js';
import { computeLaborHoursNeeded } from './laborHours.js';

// Corrections issues de l'audit de la méthode (19/11) — chaque test rejoue le projet démo avec le même enchaînement
// que l'application : calcul brouillon (sans pools) → pools de frais fixes → calcul final.
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

const pipeline = (state, { deactivate = [], ingredients = null } = {}) => {
    const products = state.products.map((p) => ({ ...p, formats: p.formats.map((f) => ({ ...f, onMenu: deactivate.includes(f.id) ? false : f.onMenu })) }));
    // La chaîne complète de l'application (absorption de toute la paie, sous-recettes comprises → brouillon → pools → final).
    const { data, pools, generalInfo } = computeProjectAnalysis({
        products, baseIngredients: ingredients || state.ingredientsList, basePackaging: state.basePackaging, laborDatabase: state.laborDatabase,
        generalInfo: state.generalInfo, salesChannels: state.salesChannels, productionActivities: state.productionActivities,
        expenseLines: state.expenseLines, revenueLines: state.revenueLines, directCostLines: state.directCostLines, repartitionKeys: state.repartitionKeys,
    });
    return { data, pools, generalInfo, state };
};

const allocatedToActive = (data) => {
    const act = data.productsWithCosts.filter((p) => p.onMenu);
    const vol = (p) => P(p.costs.portionsSold) || 0;
    return sum(act, (p) => (P(p.costs.costIndirectGeneralPerPortion) + P(p.costs.costIndirectActivityPerPortion)) * vol(p))
        + sum(act, (p) => sum(p.channelBreakdown, (cb) => P(cb.costIndirectChannelPerPortion) * P(cb.volume)));
};

describe('Audit de la méthode : correctifs du 19/11', () => {
    it('base : les frais fixes du démo sont répartis en totalité sur les produits actifs', () => {
        const { data } = pipeline(getDefaultState());
        expect(allocatedToActive(data)).toBeCloseTo(28000, 1);
    });

    it('1. un format inactif n\'absorbe aucun frais fixe et n\'apparaît dans aucun rapport agrégé', () => {
        const state = getDefaultState();
        const { data, generalInfo } = pipeline(state, { deactivate: ['fmt_chili'] });
        // tout le pool est réparti entre les formats ACTIFS (avant : 3 309 $ restaient sur le format inactif)
        expect(allocatedToActive(data)).toBeCloseTo(P(generalInfo.totalIndirects), 1);
        const inactive = data.productsWithCosts.find((p) => p.id === 'fmt_chili');
        expect(P(inactive.costs.costIndirectGeneralPerPortion)).toBe(0);
        expect(P(inactive.costs.costIndirectActivityPerPortion)).toBe(0);
        // Par Activité / Par Canal : seulement les produits actifs
        const activeRevenue = data.menuRevenue;
        const byActivity = computeActivitySummaries(data.productsWithCosts, state.productionActivities);
        const byChannel = computeChannelSummaries(data.productsWithCosts, state.salesChannels);
        expect(sum(byActivity, (s) => s.revenueTotal)).toBeCloseTo(activeRevenue, 2);
        expect(sum(byChannel, (s) => s.revenueTotal)).toBeCloseTo(activeRevenue, 2);
        // et la somme des bénéfices nets segmentés égale celle du menu actif
        expect(sum(byActivity, (s) => s.margeNetteTotal)).toBeCloseTo(sum(byChannel, (s) => s.margeNetteTotal), 2);
    });

    it('2. des frais fixes partiellement répartis ne disparaissent pas : le reste va dans Général et est signalé', () => {
        const state = getDefaultState();
        const l0 = state.expenseLines[0]; // loyer, 9 000 $ réparti à la main
        state.expenseLines[0] = { ...l0, repartitionKey: 'manual', activityAllocations: { general: 6000 }, channelAllocations: {} };
        const { data, pools, generalInfo } = pipeline(state);
        expect(pools.meta.unallocated).toBeCloseTo(3000, 1);
        expect(allocatedToActive(data)).toBeCloseTo(P(generalInfo.totalIndirects), 1);
        const checks = computeProjectChecks({ products: state.products, fixedCosts: pools.meta });
        expect(checks.map((c) => c.id)).toContain('fixed-costs-unallocated');
        // le démo, lui, ne déclenche aucun avertissement de répartition (pas de faux positif dû aux arrondis)
        expect(pipeline(getDefaultState()).pools.meta.unallocated).toBe(0);
        expect(pipeline(getDefaultState()).pools.meta.overAllocated).toBe(0);
    });

    it('2 bis. un dépassement de répartition est signalé', () => {
        const state = getDefaultState();
        const l0 = state.expenseLines[0];
        state.expenseLines[0] = { ...l0, repartitionKey: 'manual', activityAllocations: { general: 12000 }, channelAllocations: {} };
        const { pools } = pipeline(state);
        expect(pools.meta.overAllocated).toBeCloseTo(3000, 1);
        expect(computeProjectChecks({ fixedCosts: pools.meta }).map((c) => c.id)).toContain('fixed-costs-over-allocated');
    });

    it('3. le calcul du simulateur (mêmes pools, coûts simulés) répartit toujours 100 % des frais fixes', () => {
        const state = getDefaultState();
        const shocked = applyCostShocks(state.ingredientsList, [{ type: 'ingredient', scope: 'all', percent: 15 }]);
        const base = pipeline(state);
        const sim = pipeline(state, { ingredients: shocked });
        expect(allocatedToActive(sim.data)).toBeCloseTo(28000, 1);
        // sans choc, le chemin du simulateur donne exactement les marges nettes de l'application
        const same = pipeline(state, { ingredients: applyCostShocks(state.ingredientsList, []) });
        const net = (d) => d.productsWithCosts.filter((p) => p.onMenu).map((p) => P(p.costs.margeNetteDollar));
        net(same.data).forEach((v, i) => expect(v).toBeCloseTo(net(base.data)[i], 8));
        // le choc fait baisser la marge nette de chaque produit vendu, d'un montant du même ordre que la hausse des coûts
        const baseNet = net(base.data); const simNet = net(sim.data);
        expect(simNet.filter((v, i) => v < baseNet[i]).length).toBeGreaterThan(5);
    });

    it('4. la marge brute et les coûts moyens du menu sont pondérés en dollars (Σ marge ÷ Σ revenu)', () => {
        const { data } = pipeline(getDefaultState());
        let rev = 0; let direct = 0; let matiere = 0;
        data.activeProducts.forEach((p) => p.channelBreakdown.forEach((cb) => {
            const v = P(cb.volume); rev += P(cb.netPrice) * v;
            direct += P(p.costs.totalDirectCostPerPortion) * v; matiere += P(p.costs.costMatierePerPortion) * v;
        }));
        expect(data.weightedGrossMargin).toBeCloseTo((rev - direct) / rev, 8);
        expect(data.weightedMaterialCost).toBeCloseTo(matiere / rev, 8);
    });

    it('5. le point mort d\'un point de référence utilise la même formule que la tuile actuelle', () => {
        const { data, generalInfo } = pipeline(getDefaultState());
        const snapshotLike = JSON.parse(JSON.stringify(data.productsWithCosts));
        expect(computeSnapshotBreakEven(snapshotLike, generalInfo.totalIndirects)).toBeCloseTo(data.globalBreakEven, 4);
    });

    it('6. toute la masse salariale (tous les postes entrés) se retrouve dans le coût des produits', () => {
        const state = getDefaultState();
        const { data } = pipeline(state);
        const payroll = sum(state.laborDatabase, (post) => sum(post.employees || [], (e) => P(e.workedHours) * P(e.hourlyRate) * (1 + P(e.socialCharges) / 100) * (1 + P(e.vacationPercentage) / 100)));
        // Main-d'œuvre propre de chaque format × portions à produire (ventes ET consommation par d'autres recettes) : la
        // main-d'œuvre d'une sous-recette est portée par le produit qui la consomme, mais fabriquée une seule fois.
        const { batchesByFormat } = computeLaborHoursNeeded(state.products.map((p) => ({ ...p, formats: p.formats })), state.ingredientsList);
        const absorbed = sum(data.productsWithCosts, (p) => P(p.costs.costLaborPerPortion) * (batchesByFormat[p.id] || 0) * (P(p.nbPortions) || 1));
        // Avant : 88,7 % (temps non productif perdu), puis 96,5 % (taux par heures), puis 100 % mais avec le temps des
        // sous-recettes absent des heures nécessaires (coût compté en double). Maintenant : exactement la paie versée.
        expect(absorbed / payroll).toBeCloseTo(1, 3);
    });
});
