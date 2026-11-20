import { describe, it, expect } from 'vitest';
import { getDefaultState } from '../state/initialState.js';
import { CONVERSION_FACTORS, unitConversionFactor, areUnitsCompatible, unitFamily, unitLabel } from '../utils.js';
import { calculateCosts } from './calculateCosts.js';
import { computeIngredientVolatility } from './priceVolatility.js';
import { computeSnapshotBreakEven, computeSnapshotMenuKpis } from './analysisData.js';
import { computeProjectAnalysis } from './analysisPipeline.js';
import { computeProjectChecks } from './projectChecks.js';
import { findRecipeLoops, wouldCreateRecipeLoop, findIngredientUsages, findPackagingUsages, findSubRecipeUsages, formatNameList } from './usage.js';
import { clearFormatVolumes, mirrorFirstFormat, removeChannelFromProducts } from './productEdits.js';
import { computeLaborHoursNeeded } from './laborHours.js';

// Corrections de l'audit complémentaire du 19/11 : fiche produit, points de référence, unités de mesure.

const analysisOf = (state) => computeProjectAnalysis({
    products: state.products, baseIngredients: state.ingredientsList, basePackaging: state.basePackaging, laborDatabase: state.laborDatabase,
    generalInfo: state.generalInfo, salesChannels: state.salesChannels, productionActivities: state.productionActivities,
    expenseLines: state.expenseLines, revenueLines: state.revenueLines, directCostLines: state.directCostLines, repartitionKeys: state.repartitionKeys,
});

describe('Unités de mesure', () => {
    it('une seule formule de conversion, exacte dans une famille', () => {
        expect(unitConversionFactor('g', 'kg')).toBeCloseTo(0.001, 10);
        expect(unitConversionFactor('kg', 'g')).toBe(1000);
        expect(unitConversionFactor('douzaine', 'unité')).toBe(12);
        expect(unitConversionFactor('lb', 'kg')).toBeCloseTo(0.453592, 6);
    });
    it('reconnaît les familles et refuse de les mélanger', () => {
        expect(unitFamily('kg')).toBe('g');
        expect(areUnitsCompatible('kg', 'oz')).toBe(true);
        expect(areUnitsCompatible('L', 'kg')).toBe(false);
        expect(areUnitsCompatible('unité', 'kg')).toBe(false);
        expect(areUnitsCompatible('zz', 'zz')).toBe(false);
    });
    it('distingue le gallon américain du gallon impérial', () => {
        expect(CONVERSION_FACTORS.gal.factor).toBeCloseTo(3785.41, 2);
        expect(CONVERSION_FACTORS['gal imp'].factor).toBeCloseTo(4546.09, 2);
        expect(CONVERSION_FACTORS['fl oz imp'].factor).toBeCloseTo(28.4131, 4);
        expect(unitConversionFactor('gal imp', 'gal')).toBeCloseTo(1.2010, 3);
        expect(unitLabel('gal')).toBe('gal US');
        expect(unitLabel('gal imp')).toBe('gal imp');
        expect(unitLabel('kg')).toBe('kg');
    });
    it('le coût d\'un ingrédient en gallons impériaux n\'est plus sous-estimé', () => {
        const state = getDefaultState();
        const product = state.products[0];
        const fmt = { ...product.formats[0], nbPortions: 1, portionSize: 1, portionUnit: 'unité', productionSteps: [], packagingItems: [], isResaleProduct: false,
            ingredients: [{ rowId: 'r', id: 'X', quantity: 1, recipeUnit: 'gal imp', yieldPercentage: 100 }] };
        const prod = { ...product, formats: [fmt] };
        const costs = calculateCosts(prod, state.generalInfo, [{ id: 'X', name: 'X', unit: 'L', unitPrice: 10, lossPercentage: 0 }], [prod], state.laborDatabase, null, {}, new Set(), fmt, state.basePackaging);
        expect(costs.costMatierePerPortion).toBeCloseTo(45.4609, 3);
    });
});

describe('Volatilité des prix et unités', () => {
    const point = (timestamp, unit, unitPrice) => ({ timestamp, baseIngredients: [{ id: 'X', name: 'X', unit, unitPrice }] });
    it('un changement d\'unité à prix réel constant n\'est pas de la volatilité', () => {
        const result = computeIngredientVolatility([point('2026-01-01', 'kg', 10), point('2026-06-01', 'g', 0.01)]);
        expect(result.list[0].amplitudePercent).toBeCloseTo(0, 6);
        expect(result.list[0].isVolatile).toBe(false);
        expect(result.list[0].currentPrice).toBe(0.01);
    });
    it('une vraie variation de prix est toujours détectée après un changement d\'unité', () => {
        const result = computeIngredientVolatility([point('2026-01-01', 'kg', 10), point('2026-06-01', 'g', 0.012)]);
        expect(result.list[0].trendPercent).toBeCloseTo(20, 4);
        expect(result.list[0].isVolatile).toBe(true);
    });
    it('un changement de famille d\'unités fait repartir la série', () => {
        const result = computeIngredientVolatility([point('2026-01-01', 'kg', 10), point('2026-03-01', 'kg', 10), point('2026-06-01', 'unité', 4)]);
        expect(result.list[0].count).toBe(1);
        expect(result.list[0].isVolatile).toBe(false);
    });
});

describe('Relevés du projet démo', () => {
    it('le dernier relevé suit la même méthode que les tuiles du rapport', () => {
        const state = getDefaultState();
        const live = analysisOf(state);
        const last = state.trackingPoints[state.trackingPoints.length - 1];
        expect(computeSnapshotBreakEven(last.productsWithCosts, last.generalInfo.totalIndirects)).toBeCloseTo(live.data.globalBreakEven, 0);
        const kpis = computeSnapshotMenuKpis(last.productsWithCosts);
        const liveKpis = computeSnapshotMenuKpis(live.data.productsWithCosts);
        expect(kpis.weightedGrossMargin).toBeCloseTo(liveKpis.weightedGrossMargin, 3);
        expect(kpis.weightedLaborCost).toBeCloseTo(liveKpis.weightedLaborCost, 3);
        expect(kpis.weightedMaterialCost).toBeCloseTo(liveKpis.weightedMaterialCost, 3);
    });
    it('tous les relevés portent le détail par canal : aucun avertissement de relevé ancien', () => {
        const state = getDefaultState();
        expect(state.trackingPoints.length).toBe(19);
        state.trackingPoints.forEach((pt) => {
            pt.productsWithCosts.filter(r => r.onMenu).forEach((r) => expect(r.channelBreakdown.length).toBeGreaterThan(0));
        });
    });
    it('le projet démo ne déclenche aucun point à vérifier', () => {
        const state = getDefaultState();
        const { pools } = analysisOf(state);
        const checks = computeProjectChecks({
            products: state.products, baseIngredients: state.ingredientsList, basePackaging: state.basePackaging,
            productionActivities: state.productionActivities, salesChannels: state.salesChannels, trackingPoints: state.trackingPoints,
            fixedCosts: pools.meta, now: new Date(),
        });
        expect(checks.map(c => c.id)).toEqual([]);
    });
});

describe('Calibrage du projet démo (20/11)', () => {
    const state = getDefaultState();
    const { data } = analysisOf(state);
    const rows = data.productsWithCosts.filter((r) => r.onMenu);
    const aggregate = (keyOf) => {
        const groups = {};
        rows.forEach((r) => r.channelBreakdown.forEach((cb) => {
            const volume = Number(cb.volume) || 0;
            const g = (groups[keyOf(r, cb)] = groups[keyOf(r, cb)] || { revenue: 0, net: 0 });
            g.revenue += Number(cb.netPrice) * volume;
            g.net += Number(cb.margeNetteDollar) * volume;
        }));
        return groups;
    };
    it('le bénéfice net théorique est positif et proche du réel (4 000 $)', () => {
        const net = Object.values(aggregate(() => 'tout'))[0].net;
        expect(net).toBeGreaterThan(3000);
        expect(net).toBeLessThan(7000);
    });
    it('chaque activité et chaque canal est rentable', () => {
        Object.entries(aggregate((r) => r.activityId)).forEach(([id, g]) => expect(g.net, `activité ${id}`).toBeGreaterThan(0));
        Object.entries(aggregate((r, cb) => cb.channelId)).forEach(([id, g]) => expect(g.net, `canal ${id}`).toBeGreaterThan(0));
    });
    it('les revenus théoriques par activité restent proches des revenus réels saisis (±10 %)', () => {
        const byActivity = aggregate((r) => r.activityId);
        const real = { act_plats: 45000, act_soupes: 20000, act_sauces: 12500 };
        Object.entries(real).forEach(([id, amount]) => expect(Math.abs(byActivity[id].revenue - amount) / amount, id).toBeLessThan(0.1));
        const total = Object.values(byActivity).reduce((s, g) => s + g.revenue, 0);
        expect(Math.abs(total - 80000) / 80000).toBeLessThan(0.03);
    });
    it('l\'équipe est utilisée entre 80 % et 95 % (ni sous-capacité, ni inoccupée)', () => {
        const hours = computeLaborHoursNeeded(state.products, state.ingredientsList).byPost;
        const expected = state.laborDatabase.reduce((s, post) => s + (post.employees || []).reduce((t, e) => t + Number(e.workedHours) * Number(e.productiveTimePercentage) / 100, 0), 0);
        const needed = Object.values(hours).reduce((s, h) => s + h, 0);
        expect(needed / expected).toBeGreaterThan(0.8);
        expect(needed / expected).toBeLessThan(0.95);
    });
    it('les parts de ventes du démo totalisent 100 %', () => {
        const total = state.products.flatMap((p) => p.formats).filter((f) => f.onMenu).reduce((s, f) => s + Number(f.salesMix), 0);
        expect(total).toBeCloseTo(100, 1);
    });
});

describe('Usages avant suppression', () => {
    it('retrouve les produits qui utilisent un ingrédient, un emballage ou une sous-recette', () => {
        const state = getDefaultState();
        expect(findIngredientUsages(state.products, 'ing_epices').length).toBeGreaterThan(2);
        expect(findIngredientUsages(state.products, 'ing_inconnu')).toEqual([]);
        expect(findPackagingUsages(state.products, 'pkg_etiquette').length).toBeGreaterThan(0);
        const puree = state.products.find(p => p.id === 'sub_puree_vrac');
        expect(findSubRecipeUsages(state.products, puree).length).toBeGreaterThan(0);
        // Un produit qui n'est pas une sous-recette n'a pas d'usages.
        const plat = state.products.find(p => !p.isIngredient);
        expect(findSubRecipeUsages(state.products, plat)).toEqual([]);
    });
    it('formate la liste de noms', () => {
        expect(formatNameList(['A', 'B'])).toBe('A, B');
        expect(formatNameList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C et 2 autres');
    });
});

describe('Gestes de la fiche produit', () => {
    it('une copie repart sans volumes ni part des ventes, mais garde les prix', () => {
        const state = getDefaultState();
        const original = state.products.find(p => p.id === 'sub_puree').formats[0];
        const copy = clearFormatVolumes(original);
        expect(copy.salesMix).toBe(0);
        copy.channelPrices.forEach((cp, i) => {
            expect(cp.volume).toBe('');
            expect(cp.netPrice).toBe(original.channelPrices[i].netPrice);
            expect(cp.id).not.toBe(original.channelPrices[i].id);
        });
        expect(original.channelPrices.some(cp => Number(cp.volume) > 0)).toBe(true);
    });
    it('une copie de produit n\'augmente plus les revenus du projet', () => {
        const state = getDefaultState();
        const base = analysisOf(state);
        const source = state.products[1];
        const copy = { ...JSON.parse(JSON.stringify(source)), id: 'copie', platName: 'Copie', formats: source.formats.map((f, i) => ({ ...clearFormatVolumes(JSON.parse(JSON.stringify(f))), id: `copie_${i}` })) };
        const withCopy = analysisOf({ ...state, products: [...state.products, copy] });
        expect(withCopy.data.menuRevenue).toBeCloseTo(base.data.menuRevenue, 2);
    });
    it('retirer un canal retire ses prix et volumes de tous les formats et recalcule les parts', () => {
        const state = getDefaultState();
        const { products, removedCount } = removeChannelFromProducts(state.products, 'channel_gs');
        expect(removedCount).toBeGreaterThan(0);
        products.forEach(p => p.formats.forEach(f => expect(f.channelPrices.some(cp => cp.channelId === 'channel_gs')).toBe(false)));
        const checks = computeProjectChecks({ products, salesChannels: state.salesChannels.filter(c => c.id !== 'channel_gs') });
        expect(checks.map(c => c.id)).not.toContain('missing-channel');
        // Un canal absent ne change rien.
        expect(removeChannelFromProducts(state.products, 'canal_inconnu').removedCount).toBe(0);
    });
    it('supprimer le premier format passe le miroir « à plat » au suivant', () => {
        const state = getDefaultState();
        const product = state.products.find(p => p.formats.length > 1);
        const second = product.formats[1];
        const updated = mirrorFirstFormat({ ...product, formats: product.formats.slice(1) });
        expect(updated.portionSize).toBe(second.portionSize);
        expect(updated.portionUnit).toBe(second.portionUnit);
        expect(updated.prixVente).toBe(second.prixVente);
    });
    it('le démo : un canal en double est signalé, et l\'activité d\'un produit supprimée est signalée', () => {
        const state = getDefaultState();
        const products = state.products.map(p => ({ ...p, formats: p.formats.map(f => (f.id === 'fmt_chili' ? { ...f, channelPrices: [...f.channelPrices, { ...f.channelPrices[0], id: 'cp_dup' }] } : f)) }));
        const ids = computeProjectChecks({ products, productionActivities: state.productionActivities.slice(1), salesChannels: state.salesChannels }).map(c => c.id);
        expect(ids).toContain('duplicate-channel');
        expect(ids).toContain('missing-activity');
    });
});

describe('Boucles de sous-recettes (audit 20/11, constat 9)', () => {
    const rec = (id, name, uses = []) => ({ id, platName: name, isIngredient: true, formats: [{ id: `f_${id}`, ingredients: uses.map(u => ({ id: `f_${u}`, quantity: 1 })) }] });
    it('trouve une boucle directe et une boucle à trois étapes, une seule fois chacune', () => {
        expect(findRecipeLoops([rec('a', 'A', ['b']), rec('b', 'B', ['a'])])).toEqual([['A', 'B']]);
        const three = findRecipeLoops([rec('a', 'A', ['b']), rec('b', 'B', ['c']), rec('c', 'C', ['a'])]);
        expect(three).toHaveLength(1);
        expect([...three[0]].sort()).toEqual(['A', 'B', 'C']);
    });
    it("ne signale rien pour une chaîne sans retour ni pour deux recettes qui partagent une sous-recette", () => {
        expect(findRecipeLoops([rec('a', 'A', ['b']), rec('b', 'B', ['c']), rec('c', 'C')])).toEqual([]);
        expect(findRecipeLoops([rec('a', 'A', ['c']), rec('b', 'B', ['c']), rec('c', 'C')])).toEqual([]);
    });
    it("refuse d'ajouter ce qui créerait une boucle, directe ou non", () => {
        const products = [rec('a', 'A', ['b']), rec('b', 'B', ['c']), rec('c', 'C'), rec('d', 'D')];
        expect(wouldCreateRecipeLoop(products, products[2], 'f_a')).toBe(true); // C utiliserait A, qui utilise B, qui utilise C
        expect(wouldCreateRecipeLoop(products, products[2], 'f_c')).toBe(true); // elle-même
        expect(wouldCreateRecipeLoop(products, products[2], 'f_d')).toBe(false);
        expect(wouldCreateRecipeLoop(products, products[0], 'f_c')).toBe(false);
        expect(wouldCreateRecipeLoop(products, products[0], 'ing_farine')).toBe(false);
    });
});
