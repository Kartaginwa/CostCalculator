// AUDIT (lecture seule) — Harnais d'exécution de la logique de calcul de l'application sur le JEU DE DÉMONSTRATION
// (getDefaultState). Aucune donnée de production, aucun fichier de l'application modifié. Sortie : audit/annexes/*.json
import { describe as vitestDescribe, it } from 'vitest';
import process from 'node:process';

// Exécuté seulement à la demande (AUDIT_HARNESS=1) : écrit dans audit/annexes, donc jamais pendant `npx vitest run` ordinaire.
const describe = vitestDescribe.skipIf(!process.env.AUDIT_HARNESS);
import fs from 'node:fs';
import { getDefaultState } from '../../src/state/initialState.js';
import { computeProjectAnalysis } from '../../src/engine/analysisPipeline.js';
import { computeProjectChecks } from '../../src/engine/projectChecks.js';

const OUT = 'audit/annexes';
const clone = (o) => JSON.parse(JSON.stringify(o));
const analysisOf = (s) => computeProjectAnalysis({
    products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase,
    generalInfo: s.generalInfo, salesChannels: s.salesChannels, productionActivities: s.productionActivities,
    expenseLines: s.expenseLines, revenueLines: s.revenueLines, directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys,
});
const slim = (r) => ({
    id: r.id, name: r.displayName, active: r.onMenu, nbPortions: r.costs.nbPortions, portionSize: r.costs.portionSize, portionsSold: r.costs.portionsSold,
    matiere: r.costs.costMatierePerPortion, emb: r.costs.costPackagingPerPortion, mo: r.costs.costLaborPerPortion, st: r.costs.costSubcontractingPerPortion,
    direct: r.costs.totalDirectCostPerPortion, indGen: r.costs.costIndirectGeneralPerPortion, indAct: r.costs.costIndirectActivityPerPortion,
    indCan: r.costs.costIndirectChannelPerPortion, indTot: r.costs.costIndirectPerPortion, aging: r.costs.costAgingPerPortion, total: r.costs.totalCostPerPortion,
    lot: { ingredients: r.costs.totalIngredientsCost, base: r.costs.totalBaseIngredientsCost, loss: r.costs.totalLossCost, pack: r.costs.totalPackagingCost, labor: r.costs.totalLaborCost, laborDirectRaw: r.costs.totalDirectLaborCost },
    channels: r.channelBreakdown.map(c => ({ id: c.channelId, price: c.netPrice, vol: c.volume, indCan: c.costIndirectChannelPerPortion, margeBrute: c.margeBruteDollar, margeNette: c.margeNetteDollar, be: c.breakEvenUnits })),
});

describe('audit harness', () => {
    it('base: démo', () => {
        const s = getDefaultState();
        const inputs = { ...s }; delete inputs.trackingPoints;
        fs.writeFileSync(`${OUT}/demo_inputs.json`, JSON.stringify(inputs, null, 1));
        const a = analysisOf(s);
        const rows = a.data.productsWithCosts.map(slim);
        const sumInd = a.data.productsWithCosts.filter(r => r.onMenu).reduce((t, r) => t + r.costs.costIndirectPerPortion * (r.costs.portionsSold || 0), 0);
        const out = {
            kitchenProductivity: a.kitchenProductivity, totalIndirects: a.generalInfo.totalIndirects,
            pools: a.pools, rows, globalBreakEven: a.data.globalBreakEven, menuRevenue: a.data.menuRevenue,
            weighted: { gm: a.data.weightedGrossMargin, mat: a.data.weightedMaterialCost, pk: a.data.weightedPackagingCost, lab: a.data.weightedLaborCost },
            sumIndirectAbsorbed: sumInd,
            checks: computeProjectChecks({ products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, productionActivities: s.productionActivities, salesChannels: s.salesChannels }).map(c => c.id),
        };
        fs.writeFileSync(`${OUT}/app_output_demo.json`, JSON.stringify(out, null, 1));
    });

    it('cas limites et sensibilités', () => {
        const res = {};
        const base = getDefaultState();
        const baseA = analysisOf(base);
        const rowOf = (a, id) => a.data.productsWithCosts.find(r => r.id === id);
        const keep = (a, id) => { const r = rowOf(a, id); return { direct: r.costs.totalDirectCostPerPortion, mo: r.costs.costLaborPerPortion, mat: r.costs.costMatierePerPortion, ind: r.costs.costIndirectPerPortion, total: r.costs.totalCostPerPortion }; };
        const targets = ['fmt_pate_s', 'fmt_pate_f', 'fmt_tao', 'fmt_saumon', 'fmt_sub_puree'];
        res.base = { kitchenProductivity: baseA.kitchenProductivity, ...Object.fromEntries(targets.map(id => [id, keep(baseA, id)])) };

        let s = clone(base); s.ingredientsList.find(i => i.id === 'ing_boeuf').unitPrice *= 1.10;
        res.S1_boeuf_plus10 = Object.fromEntries(targets.map(id => [id, keep(analysisOf(s), id)]));
        s = clone(base); s.products.find(p => p.id === 'prod_tao').formats[0].ingredients[0].yieldPercentage = 80;
        res.S2_tao_poulet_yield80 = { fmt_tao: keep(analysisOf(s), 'fmt_tao') };
        for (const k of [0.25, 0.5, 2]) {
            s = clone(base);
            s.products.forEach(p => p.formats.forEach(f => (f.channelPrices || []).forEach(cp => { cp.volume = cp.volume * k; })));
            const a = analysisOf(s);
            res[`S3_volume_x${k}`] = { kitchenProductivity: a.kitchenProductivity, ...Object.fromEntries(targets.map(id => [id, keep(a, id)])) };
        }
        s = clone(base); s.ingredientsList.find(i => i.id === 'ing_boeuf').lossPercentage = 100;
        res.E1_loss100 = { fmt_pate_s: keep(analysisOf(s), 'fmt_pate_s') };
        s = clone(base); s.ingredientsList.find(i => i.id === 'ing_boeuf').lossPercentage = 50;
        res.E1b_loss50 = { fmt_pate_s: keep(analysisOf(s), 'fmt_pate_s') };
        s = clone(base); s.products.find(p => p.id === 'prod_tao').formats[0].nbPortions = '';
        res.E2_nbPortions_vide = { fmt_tao: keep(analysisOf(s), 'fmt_tao') };

        s = clone(base);
        s.products.find(p => p.id === 'prod_pate').isIngredient = true;
        s.products.find(p => p.id === 'sub_puree').formats[0].ingredients.push({ rowId: 'loop', id: 'fmt_pate_s', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 });
        const origErr = globalThis.console.error; let loopMsg = 0; globalThis.console.error = () => { loopMsg++; };
        const aLoop = analysisOf(s); globalThis.console.error = origErr;
        res.E3_boucle = { console_error_calls: loopMsg, puree: keep(aLoop, 'fmt_sub_puree'), pate_s: keep(aLoop, 'fmt_pate_s') };

        s = clone(base); s.products.find(p => p.id === 'prod_tao').formats[0].ingredients[0].recipeUnit = 'ml';
        res.E4_unit_famille = { fmt_tao: keep(analysisOf(s), 'fmt_tao') };
        s = clone(base); s.products.find(p => p.id === 'prod_tao').formats[0].ingredients[0].quantity = -3600;
        res.E5_qte_negative = { fmt_tao: keep(analysisOf(s), 'fmt_tao') };

        s = clone(base); s.products.find(p => p.id === 'sub_puree').formats[0].aging = { enabled: true, interestRate: 12, months: 6 };
        const a6 = analysisOf(s);
        res.E6_aging_sous_recette = { puree: { ...keep(a6, 'fmt_sub_puree'), aging: rowOf(a6, 'fmt_sub_puree').costs.costAgingPerPortion }, pate_s: keep(a6, 'fmt_pate_s') };

        s = clone(base); s.products.find(p => p.id === 'prod_tao').formats[0].channelPrices.find(c => c.channelId === 'channel_gs').netPrice = 0;
        const a7 = analysisOf(s);
        const absorbedCanal = (a) => a.data.productsWithCosts.filter(r => r.onMenu).reduce((t, r) => t + r.channelBreakdown.filter(c => c.channelId === 'channel_gs').reduce((u, c) => u + c.costIndirectChannelPerPortion * c.volume, 0), 0);
        res.E7_canal_prix0 = { pool_gs: a7.pools.channelPools.channel_gs.amount, absorbe_base: absorbedCanal(baseA), absorbe_apres: absorbedCanal(a7) };

        s = clone(base);
        s.products.forEach(p => p.formats.forEach(f => (f.channelPrices || []).forEach(cp => { cp.volume = cp.volume * 0.02; })));
        const a8 = analysisOf(s);
        res.E8_volume_x0_02 = { kitchenProductivity: a8.kitchenProductivity, tao: keep(a8, 'fmt_tao') };
        s = clone(base);
        s.products.forEach(p => p.formats.forEach(f => (f.channelPrices || []).forEach(cp => { cp.volume = 0; })));
        const a9 = analysisOf(s);
        res.E9_volume_zero = { kitchenProductivity: a9.kitchenProductivity, tao: keep(a9, 'fmt_tao') };

        res.E10_expenses_by_category = base.expenseLines.reduce((m, l) => { m[l.category] = (m[l.category] || 0) + l.amount; return m; }, {});

        s = clone(base); const f = s.products.find(p => p.id === 'prod_tao').formats[0]; f.yieldGrid = { enabled: true, baseQuantity: 8000, stages: [{ percentEffect: -20 }], rejectRate: 5 };
        const a11 = analysisOf(s);
        res.E11_yieldGrid = { fmt_tao: keep(a11, 'fmt_tao'), nb: rowOf(a11, 'fmt_tao').costs.nbPortions };
        s = clone(base); s.products.find(p => p.id === 'sub_puree').formats[0].portionSize = 0;
        const a12 = analysisOf(s);
        res.E12_portionSize0 = { pate_s: keep(a12, 'fmt_pate_s'), puree: keep(a12, 'fmt_sub_puree') };
        fs.writeFileSync(`${OUT}/app_output_edgecases.json`, JSON.stringify(res, null, 1));
    });
    it('compléments : courbe de productivité et grille de rendement', () => {
        const res = {};
        const base = getDefaultState();
        const rowOf = (a, id) => a.data.productsWithCosts.find(r => r.id === id);
        const curve = [];
        for (const k of [0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.3, 1.5, 2]) {
            const s = clone(base);
            s.products.forEach(p => p.formats.forEach(f => (f.channelPrices || []).forEach(cp => { cp.volume = cp.volume * k; })));
            const a = analysisOf(s);
            const r = rowOf(a, 'fmt_tao');
            curve.push({ k, productivite: a.kitchenProductivity, tao_mo: r.costs.costLaborPerPortion, tao_direct: r.costs.totalDirectCostPerPortion, tao_ind: r.costs.costIndirectPerPortion, tao_total: r.costs.totalCostPerPortion });
        }
        res.courbe = curve;
        // Grille de rendement : nbPortions stocké (20) vs calculé (15,2)
        const mk = (stored) => {
            const s = clone(base);
            const f = s.products.find(p => p.id === 'prod_tao').formats[0];
            f.yieldGrid = { enabled: true, baseQuantity: 8000, stages: [{ percentEffect: -20 }], rejectRate: 5 };
            f.nbPortions = stored;
            return analysisOf(s);
        };
        const a20 = mk(20), a152 = mk(15.2);
        const purch = (a) => a.data.purchasingReportData.totalPurchaseCost;
        res.grille = {
            stocke20: { productivite: a20.kitchenProductivity, tao_total: rowOf(a20, 'fmt_tao').costs.totalCostPerPortion, achats: purch(a20), nbCout: rowOf(a20, 'fmt_tao').costs.nbPortions },
            stocke15_2: { productivite: a152.kitchenProductivity, tao_total: rowOf(a152, 'fmt_tao').costs.totalCostPerPortion, achats: purch(a152), nbCout: rowOf(a152, 'fmt_tao').costs.nbPortions },
        };
        fs.writeFileSync(`${OUT}/app_output_complements.json`, JSON.stringify(res, null, 1));
    });
});
