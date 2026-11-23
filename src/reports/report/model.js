// Modèle de données du rapport PDF (phase 4 de la refonte de l'export, 22/11).
// RÈGLE : aucun calcul de donnée ici. Tout vient des moteurs de l'application, déjà utilisés par les écrans : analyse des données, constats clés et leurs
// surfaces, cascade par SKU, séries d'évolution, détail ligne par ligne des recettes, rapport de productivité, marge de croissance, volatilité des prix.
// Ce fichier assemble, trie et nomme ; une donnée absente reste absente (null), jamais un zéro inventé.
import { parseLocaleNumber as P, loadedHourlyRate, MAJOR_ALLERGENS } from '../../utils.js';
import { buildKeyFindingsContext, computeKeyFindings } from '../../engine/keyFindings.js';
import { objectiveFindings, evolutionFindings, overviewStrengths, resultsFindings, tabFindings, ficheFindings, dedupeFindings } from '../../engine/findingSurfaces.js';
import { computeProfitCascade } from '../../engine/profitCascade.js';
import { computeTrendRows, computeReadings } from '../../engine/reportReadings.js';
import { computeSkuCascade } from '../../engine/skuCascade.js';
import { computeGlobalSeries, computeProductSeries, isProductPriced } from '../../engine/trackingSeries.js';
import { calculateCostLines } from '../../engine/calculateCosts.js';
import { computeFormatAllergens } from '../../engine/allergens.js';
import { computeSafetyMargin, computeActivityLaborRatios } from '../../engine/laborReport.js';
import { computeActivityChannelMarginMatrix } from '../../engine/analysisData.js';
import { REPORT_THRESHOLDS as T } from '../../engine/reportThresholds.js';
import { shortMonth } from './format.js';
import { formatPeriod } from './period.js';

const ALLERGEN_NAME = Object.fromEntries(MAJOR_ALLERGENS.map(a => [a.key, a.name]));
const positive = (v) => (Number.isFinite(v) && v > 0 ? v : null);
const targetOf = (v) => positive(P(v));

// Page (repère) où un constat est détaillé : la fiche du format pour un constat de format, sinon la section de l'onglet auquel il renvoie.
const MARK_OF_TAB = { overview: 'resultats', simulation: 'tendance', portfolio: 'portefeuille', bySku: 'skutable', byChannel: 'canaux', byActivity: 'canaux', ingredients: 'ingr', packaging: 'emb', labor: 'mo1' };
// Les sous-onglets qui ont un bandeau de constats dans l'application (Vue d'ensemble : trois blocs ; Simulation : aucun). Le rapport imprime les MÊMES constats.
export const FINDING_TABS = ['portfolio', 'bySku', 'byChannel', 'byActivity', 'ingredients', 'packaging', 'labor'];
export const markOfFinding = (f) => (f.subject?.type === 'format' ? `fiche:${f.subject.id}` : MARK_OF_TAB[f.link?.subTab] || 'resultats');

/**
 * @param {object} inputs
 * @param {object} inputs.project   état du projet : companyName, logoUrl, products, ingredientsList, basePackaging, laborDatabase, salesChannels,
 *                                  productionActivities, expenseLines, revenueLines, directCostLines, trackingPoints, generalInfo (dates, cibles)
 * @param {object} inputs.analysisData            analyse des données (celle que l'application affiche)
 * @param {object} inputs.calculatedGeneralInfo   informations générales calculées (productivité, heures de main-d'œuvre) : engine/calculatedGeneralInfo.js
 */
export function buildReportModel({ project, analysisData: a, calculatedGeneralInfo: info }) {
    const channels = project.salesChannels || [], activities = project.productionActivities || [];
    const trackingPoints = [...(project.trackingPoints || [])].filter(p => p && p.timestamp).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
    const rows = a.activeProducts || [];
    const ctx = buildKeyFindingsContext({
        analysisData: a, generalInfo: info, laborDatabase: project.laborDatabase || [], trackingPoints, salesChannels: channels,
        productionActivities: activities, revenueLines: project.revenueLines, directCostLines: project.directCostLines, baseIngredients: project.ingredientsList, expenseLines: project.expenseLines,
    });
    const found = computeKeyFindings(ctx, { entities: true });
    const all = found.all;
    const revenue = a.menuRevenue > 0 ? a.menuRevenue : null;

    // ---------- portée ----------
    const catalogue = (project.ingredientsList || []).filter(i => !i.isRecipe);
    const employees = (project.laborDatabase || []).flatMap(p => p.employees || []);
    const scope = {
        formats: rows.length, products: new Set(rows.map(r => r.productId)).size, channels: channels.length, activities: activities.length,
        ingredients: catalogue.length, packaging: (project.basePackaging || []).length, posts: (project.laborDatabase || []).length, employees: employees.length,
        points: trackingPoints.length, firstPoint: trackingPoints[0]?.timestamp ?? null, lastPoint: trackingPoints[trackingPoints.length - 1]?.timestamp ?? null,
        hasRealData: ctx.hasRealData,
    };
    const targets = { material: targetOf(info.foodCostTarget), packaging: targetOf(info.packagingCostTarget), labor: targetOf(info.laborCostTarget) };

    // ---------- indicateurs ----------
    const kpis = {
        grossMargin: a.weightedGrossMargin, material: a.weightedMaterialCost, packaging: a.weightedPackagingCost, labor: a.weightedLaborCost,
        breakEven: positive(a.globalBreakEven), revenue, safety: computeSafetyMargin(a.menuRevenue, a.globalBreakEven),
        safetyComfortable: T.safetyMarginComfortable, safetyLow: T.safetyMarginLow,
    };
    const cascade = computeProfitCascade(ctx.channelSummaries);

    // ---------- évolution ----------
    const globalSeries = computeGlobalSeries(trackingPoints);
    const trend = {
        labels: trackingPoints.map(p => shortMonth(p.timestamp)), series: globalSeries,
        rows: computeTrendRows(ctx), count: trackingPoints.length,
    };

    // ---------- constats et lectures ----------
    // Le rapport utilise le MÊME mécanisme de classement que l'application (engine/findingSurfaces.js) : une adresse par constat.
    //   chapitre 1 : les trois blocs de la Vue d'ensemble (objectifs, amélioration / détérioration, forces et faiblesses) ;
    //   chapitre 2 : les constats généraux non majeurs qui n'ont aucune autre adresse ;
    //   chapitres 3 à 6 : le bandeau de chaque sous-onglet ; chapitre 7 : la fiche du format.
    const readings = computeReadings(ctx);
    const pages = (f) => ({ ...f, mark: markOfFinding(f) });
    const splitTone = (list) => ({ forces: list.filter(f => f.tone === 'force').map(pages), faiblesses: list.filter(f => f.tone === 'faiblesse').map(pages) });
    const strengths = overviewStrengths(all);
    const findingsByAddress = {
        all,
        objectives: splitTone(objectiveFindings(all)),
        evolution: splitTone(evolutionFindings(all)),
        strengths: { forces: strengths.forces.map(pages), faiblesses: strengths.faiblesses.map(pages) },
        results: resultsFindings(all).map(pages),
        tabs: Object.fromEntries(FINDING_TABS.map(tab => [tab, tabFindings(all, tab).all.map(pages)])),
    };

    // ---------- portefeuille ----------
    const classOf = new Map();
    Object.entries(a.menuEngineeringData || {}).forEach(([k, list]) => (list || []).forEach(p => classOf.set(String(p.id), k)));
    const contribution = (a.contributionData || []).map(c => ({ name: c.name, total: c.totalContribution }));
    const channelCols = channels.filter(c => rows.some(r => (r.channelBreakdown || []).some(cb => cb.channelId === c.id)));
    const skuTable = rows.map(r => ({
        id: r.id, name: r.displayName, cls: classOf.get(String(r.id)) || null, pds: positive(P(r.format?.pds)),
        cost: r.costs?.totalDirectCostPerPortion ?? null,
        channels: channelCols.map(c => { const cb = (r.channelBreakdown || []).find(x => x.channelId === c.id); return cb ? { netPrice: cb.netPrice, netMargin: cb.margeNettePercent } : null; }),
    }));

    // ---------- canaux et activités ----------
    const totalChannelRevenue = ctx.channelSummaries.reduce((s, c) => s + c.revenueTotal, 0);
    const segment = (c, name) => ({ ...c, name, share: totalChannelRevenue > 0 ? c.revenueTotal / totalChannelRevenue : null, safety: c.breakEvenRevenue != null && c.revenueTotal > 0 ? (c.revenueTotal - c.breakEvenRevenue) / c.revenueTotal : null });
    const channelRows = ctx.channelSummaries.map(c => segment(c, c.channelName));
    const activityRows = ctx.activitySummaries.map(c => segment(c, c.activityName));
    const matrixCols = ctx.channelSummaries.map(c => ({ id: c.channelId, name: c.channelName }));
    const matrix = computeActivityChannelMarginMatrix(a.productsWithCosts || [], activities, channels.map(c => ({ id: c.id, name: c.name })));
    const matrixRows = ctx.activitySummaries.map(act => ({ id: act.activityId, name: act.activityName, cells: matrixCols.map(c => matrix[act.activityId]?.[c.id] || null) }));

    // ---------- approvisionnement ----------
    const supplyOf = (kind) => {
        const isIng = kind === 'ing';
        const report = isIng ? a.purchasingReportData : a.packagingPurchasingReportData, abc = isIng ? a.abcAnalysisData : a.packagingAbcAnalysisData;
        const shares = isIng ? ctx.ingredientShares : ctx.packagingShares, vol = isIng ? ctx.ingredientVolatility : ctx.packagingVolatility;
        const items = Object.values(report?.groupedByProvider || {}).flatMap(g => g.items);
        const topLoss = [...items].sort((x, y) => y.lossCost - x.lossCost)[0];
        const total = report?.grandTotal?.total ?? 0;

        return {
            kind, isIng, net: report?.grandTotal?.purchase ?? 0, loss: report?.grandTotal?.loss ?? 0, total,
            lossShare: total > 0 ? (report.grandTotal.loss / total) : null,
            providers: shares.rows, dependency: T.providerDependency,
            abc: { A: abc?.A || [], B: abc?.B || [], C: abc?.C || [], totals: abc?.totals || { A: 0, B: 0, C: 0 } },
            topLoss: topLoss && topLoss.lossCost > 0 ? { name: topLoss.name, loss: topLoss.lossCost } : null,
            volatile: (vol?.list || []).filter(v => v.isVolatile), pointCount: vol?.pointCount ?? 0, hasEnoughData: !!vol?.hasEnoughData,
            findings: findingsByAddress.tabs[isIng ? 'ingredients' : 'packaging'],
            hasData: total > 0,
        };
    };
    const supply = { ing: supplyOf('ing'), pkg: supplyOf('pkg') };
    const classOfItem = (abc) => { const m = new Map(); ['A', 'B', 'C'].forEach(k => (abc?.[k] || []).forEach(i => m.set(i.name, k))); return m; };
    const catRow = (i, cls) => ({ name: i.name, cls: cls.get(i.name) || null, provider: i.provider || '', purchaseFormat: P(i.purchaseFormat), unit: i.unit, purchasePrice: P(i.purchasePrice), loss: P(i.lossPercentage), unitPrice: P(i.unitPrice) });
    const clsIng = classOfItem(a.abcAnalysisData), clsPkg = classOfItem(a.packagingAbcAnalysisData);
    const catalogues = { ingredients: catalogue.map(i => catRow(i, clsIng)), packaging: (project.basePackaging || []).map(i => catRow(i, clsPkg)) };

    // ---------- main-d'œuvre ----------
    const byActivityHours = Object.fromEntries((info.productivityReport?.byActivity || []).map(r => [r.activityId, r.actual]));
    const activityHour = computeActivityLaborRatios(rows, byActivityHours, activities).filter(r => r.grossProfitPerHour != null && r.hours > 0);
    const productHour = ctx.productRows.filter(r => r.grossProfitPerHour != null).sort((x, y) => y.grossProfitPerHour - x.grossProfitPerHour);
    const labor = {
        productivity: info.productivityReport?.rows || [], totals: info.productivityReport?.totals || null, cascade: ctx.cascade, growth: ctx.growth,
        average: ctx.growth ? ctx.growth.grossProfitPerHour : null, // moyenne de l'écran Main-d'œuvre (marge de croissance) : jamais recalculée
        activityHour, productHour, hasData: ctx.cascade.paidHours > 0,
        posts: (project.laborDatabase || []).map(p => ({ name: p.postName, employees: (p.employees || []).map(e => ({ name: e.employeeName, rate: P(e.hourlyRate), charges: P(e.socialCharges), vacation: P(e.vacationPercentage), hours: P(e.workedHours), loaded: loadedHourlyRate(e) * P(e.workedHours) })) })),
    };

    // ---------- fiches ----------
    const fiches = rows.map((row) => {
        const costs = row.costs || {}, format = row.format || {};
        const product = (project.products || []).find(p => p.id === row.productId) || row;
        const lines = calculateCostLines(product, info, project.ingredientsList || [], project.products || [], project.laborDatabase || [], format, project.basePackaging || []) || { ingredients: [], packaging: [], steps: [] };
        const priced = P(format.prixVente) > 0;
        const topIngredients = [...lines.ingredients].sort((x, y) => y.matiereCost - x.matiereCost).slice(0, 3).filter(l => l.matiereCost > 0)
            .map(l => ({ name: l.name, cost: l.matiereCost, share: costs.totalIngredientsCost > 0 ? l.matiereCost / costs.totalIngredientsCost : null }));
        return {
            id: row.id, mark: `fiche:${row.id}`, name: row.displayName, activity: (activities.find(x => x.id === row.activityId) || {}).name || '',
            cls: classOf.get(String(row.id)) || null,
            nbPortions: costs.nbPortions, portionSize: costs.portionSize, portionUnit: format.portionUnit || '',
            status: format.isResaleProduct ? 'resale' : row.isIngredient ? 'sub' : 'finished',
            pds: positive(P(format.pds)), allergens: computeFormatAllergens(format, project.ingredientsList).map(k => ALLERGEN_NAME[k] || k),
            findings: dedupeFindings(ficheFindings(all, row.id, row.productId)),
            costs: {
                material: costs.costMatierePerPortion, packaging: costs.costPackagingPerPortion, labor: costs.costLaborPerPortion, subcontracting: costs.costSubcontractingPerPortion,
                production: costs.totalDirectCostPerPortion,
                materialPct: priced ? costs.costMatierePercent : null, packagingPct: priced ? costs.costPackagingPercent : null, laborPct: priced ? costs.costLaborPercent : null,
                contribution: costs.margeContributionDollar, contributionPct: priced ? costs.margeContributionPercent : null,
                totalMaterial: costs.totalIngredientsCost, totalLoss: costs.totalLossCost, totalPackaging: costs.totalPackagingCost, totalLabor: costs.totalLaborCost,
            },
            cascade: computeSkuCascade(row, channels),
            lines, topIngredients, minutes: lines.steps.reduce((s, x) => s + x.durationSeconds, 0) / 60,
            series: trackingPoints.length ? computeProductSeries(trackingPoints, row.id) : [], priced: isProductPriced(trackingPoints, row.id),
        };
    });

    // ---------- disponibilité des chapitres (pour grisage dans la fenêtre d'export) ----------
    const availability = {
        '1': revenue ? null : 'Aucun produit actif avec des ventes prévues.',
        '2': cascade ? null : 'Aucune vente prévue : la cascade du revenu au bénéfice est vide.',
        '3': rows.length ? null : 'Aucun produit actif.',
        '4': ctx.channelSummaries.length ? null : 'Aucun canal avec des ventes prévues.',
        '5': supply.ing.hasData || supply.pkg.hasData ? null : 'Aucun achat prévu (aucun ingrédient ni emballage utilisé par un produit actif).',
        '6': labor.hasData ? null : 'Aucune paie saisie dans l\'onglet Main-d\'œuvre.',
        '7': rows.length ? null : 'Aucun produit actif.',
        'A': null,
    };

    return {
        company: { name: project.companyName || '', logo: project.logoUrl || null },
        period: formatPeriod(info.startDate ?? project.generalInfo?.startDate, info.endDate ?? project.generalInfo?.endDate),
        scope, targets, kpis, cascade, recon: scope.hasRealData ? ctx.reconciliation.rows : null,
        trend, readings, findings: findingsByAddress,
        portfolio: { menu: a.menuEngineeringData || {}, contribution, contributionTotal: contribution.reduce((s, c) => s + c.total, 0), skuTable, channelCols: channelCols.map(c => ({ id: c.id, name: c.name })) },
        segments: { channels: channelRows, activities: activityRows, matrixCols, matrixRows },
        supply, labor, fiches, catalogues, availability,
    };
}
