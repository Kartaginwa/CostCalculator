// Constats clés (refonte de Rapport et suivi, lot 3, 21/11) : ce que les chiffres de l'entrepreneur disent de son entreprise, en FORCES et en FAIBLESSES.
// Ce n'est pas de l'IA : un catalogue de règles déterministes. Chaque règle reçoit le contexte (données déjà calculées par l'application) et renvoie zéro,
// un ou plusieurs constats { id, tone, theme, weight, title, detail, link }. Les textes sont des gabarits.
// Principes décidés avec l'utilisateur (voir Projet_Claude/10-Constats-Cles.md) :
//   - jamais un avertissement de qualité des données (cela reste dans le panneau « points à vérifier ») ;
//   - une donnée absente reste absente : une règle sans donnée est muette, jamais forcée à 0 ;
//   - tous les seuils vivent dans reportThresholds.js ;
//   - le poids (0–100) ordonne les constats ; l'écran en montre 5 par colonne, le reste est dans une fenêtre.
import { parseLocaleNumber as P, formatNumber } from '../utils.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';
import {
    computeActivitySummaries, computeChannelSummaries, computeRealVsTheoreticalReconciliation, computeSnapshotMenuKpis,
} from './analysisData.js';
import { computeIngredientVolatility, computePackagingVolatility } from './priceVolatility.js';
import {
    computeSafetyMargin, computeProviderShares, computeLaborCascade, computeProductLaborProfitability, computeGrowthMargin,
} from './laborReport.js';

export const FINDING_THEMES = ['Rentabilité', 'Coûts', 'Produits', 'Canaux', 'Activités', 'Approvisionnement', 'Main-d\'œuvre', 'Réel vs théorique', 'Évolution'];
export const SUBTAB_LABELS = {
    overview: 'Vue d\'ensemble', portfolio: 'Portefeuille', bySku: 'Par SKU', byActivity: 'Par Activité', byChannel: 'Par Canal',
    ingredients: 'Ingrédients', packaging: 'Emballages', labor: 'Main-d\'œuvre', simulation: 'Simulation',
};

const pct = (ratio, d = 1) => `${formatNumber(ratio * 100, d)} %`;
// Montant en $ avec le séparateur de milliers de l'application (ex. 11 071 $).
const usd = (v, d = 0) => `${v.toLocaleString('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d })} $`;
const finding = (id, tone, theme, weight, title, detail, subTab) => ({ id, tone, theme, weight, title, detail, link: { subTab, label: SUBTAB_LABELS[subTab] } });
const force = (...a) => finding(a[0], 'force', ...a.slice(1));
const weak = (...a) => finding(a[0], 'faiblesse', ...a.slice(1));
const names = (list, max = 3) => (list.length > max ? [...list.slice(0, max), `${list.length - max} autre${list.length - max > 1 ? 's' : ''}`] : list).join(', ');

// ---------- contexte : les données dont les règles ont besoin, calculées une fois ----------
export function buildKeyFindingsContext({ analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines }) {
    const a = analysisData || {};
    const info = generalInfo || {};
    const channelNames = Object.fromEntries((salesChannels || []).map(c => [c.id, c.name || 'Sans nom']));
    const totalRevenue = (revenueLines || []).reduce((s, l) => s + Object.values(l.amounts || {}).reduce((x, v) => x + P(v), 0), 0);
    const totalDirectCosts = (directCostLines || []).reduce((s, l) => s + P(l.amount), 0);
    const productRows = computeProductLaborProfitability(a.activeProducts || [], info.laborHoursByFormat);
    const cascade = computeLaborCascade(laborDatabase, info.productivityReport?.rows);
    return {
        analysis: a, info, channelNames, trackingPoints: trackingPoints || [],
        channelSummaries: computeChannelSummaries(a.productsWithCosts || [], salesChannels || []),
        activitySummaries: computeActivitySummaries(a.productsWithCosts || [], productionActivities || []),
        ingredientVolatility: computeIngredientVolatility(trackingPoints || []),
        packagingVolatility: computePackagingVolatility(trackingPoints || []),
        ingredientShares: computeProviderShares(a.purchasingReportData),
        packagingShares: computeProviderShares(a.packagingPurchasingReportData),
        cascade, productRows, growth: computeGrowthMargin(cascade.freeProductionHours, productRows),
        hasRealData: totalRevenue !== 0 || totalDirectCosts !== 0,
        reconciliation: computeRealVsTheoreticalReconciliation({
            totalRevenue, totalDirectCosts, activeProducts: a.activeProducts, unitsSoldById: a.unitsSoldById, menuRevenue: a.menuRevenue, totalIndirects: info.totalIndirects,
        }),
    };
}

// ---------- règles ----------
const safetyRule = (c) => {
    const sm = computeSafetyMargin(c.analysis.menuRevenue, c.analysis.globalBreakEven);
    if (!sm) return [];
    const detail = `Ventes prévues de ${usd(c.analysis.menuRevenue)} pour un point mort de ${usd(c.analysis.globalBreakEven)}.`;
    if (sm.ratio < 0) return [weak('safety', 'Rentabilité', 100, `Vous êtes ${usd(-sm.surplus)} sous le point mort`, detail, 'overview')];
    if (sm.ratio < T.safetyMarginLow) return [weak('safety', 'Rentabilité', 85, `Marge de sécurité mince : ${pct(sm.ratio)}`, detail, 'overview')];
    if (sm.ratio >= T.safetyMarginComfortable) return [force('safety', 'Rentabilité', 90, `Marge de sécurité de ${pct(sm.ratio)}`, `Les ventes prévues dépassent le point mort de ${usd(sm.surplus)}.`, 'overview')];
    return [];
};

const netProfitRule = (c) => {
    const net = c.reconciliation.rows.find(r => r.label === 'Bénéfice net');
    const revenue = c.analysis.menuRevenue;
    if (!net || !(revenue > 0)) return [];
    if (net.theoretical < 0) return [weak('net-theoretical', 'Rentabilité', 95, `Bénéfice net prévu négatif : ${usd(net.theoretical)}`, `Vos prix, volumes et frais fixes actuels ne couvrent pas tous vos coûts.`, 'overview')];
    if (net.theoretical > 0) return [force('net-theoretical', 'Rentabilité', 70, `Bénéfice net prévu de ${usd(net.theoretical)}`, `Soit ${pct(net.theoretical / revenue)} des ventes prévues, tous coûts et frais fixes déduits.`, 'overview')];
    return [];
};

const costTargetRules = (c) => {
    const a = c.analysis, out = [];
    const items = [
        ['matiere', 'matière', a.weightedMaterialCost, c.info.foodCostTarget, 85, 'ingredients'],
        ['emballage', 'emballage', a.weightedPackagingCost, c.info.packagingCostTarget, 60, 'packaging'],
        ['mo', 'main-d\'œuvre', a.weightedLaborCost, c.info.laborCostTarget, 60, 'labor'],
    ];
    for (const [id, label, value, targetRaw, weight, subTab] of items) {
        const target = P(targetRaw);
        if (!(target > 0) || !Number.isFinite(value)) continue; // pas de cible saisie : règle muette
        const detail = `À ${pct(value, 2)} contre une cible de ${formatNumber(target, 0)} %.`;
        if (value * 100 > target) out.push(weak(`cost-${id}`, 'Coûts', weight, `Coût ${label} au-dessus de la cible`, detail, subTab));
        else out.push(force(`cost-${id}`, 'Coûts', weight - 15, `Coût ${label} sous sa cible`, detail, 'overview'));
    }
    // Produit par produit : combien dépassent la cible de coût matière.
    const target = P(c.info.foodCostTarget);
    if (target > 0) {
        const over = (a.activeProducts || []).filter(p => p.costs && p.costs.costMatierePercent * 100 > target);
        if (over.length > 0) out.push(weak('cost-matiere-products', 'Coûts', 55, `${over.length} produit${over.length > 1 ? 's' : ''} sur ${(a.activeProducts || []).length} dépasse${over.length > 1 ? 'nt' : ''} la cible de coût matière`, names(over.map(p => p.displayName)), 'bySku'));
    }
    return out;
};

const productRules = (c) => {
    const out = [];
    const rows = (c.analysis.activeProducts || []).map(p => ({
        name: p.displayName,
        margins: (p.channelBreakdown || []).filter(cb => Number.isFinite(cb.margeNettePercent)).map(cb => ({ channel: c.channelNames[cb.channelId] || 'canal', pct: cb.margeNettePercent })),
    })).filter(r => r.margins.length > 0);
    if (rows.length === 0) return out;
    const losers = rows.filter(r => r.margins.some(m => m.pct < 0));
    const everywhereNegative = rows.filter(r => r.margins.every(m => m.pct < 0));
    const allPositive = rows.filter(r => r.margins.every(m => m.pct > 0));
    if (losers.length > 0) {
        const worst = losers.map(r => ({ r, m: r.margins.reduce((a, b) => (b.pct < a.pct ? b : a)) })).sort((x, y) => x.m.pct - y.m.pct)[0];
        out.push(weak('sku-losers', 'Produits', 88, `${losers.length} produit${losers.length > 1 ? 's' : ''} sur ${rows.length} perdent de l'argent dans au moins un canal`, `Le pire : « ${worst.r.name} », ${pct(worst.m.pct)} de marge nette (${worst.m.channel}).`, 'portfolio'));
    }
    if (everywhereNegative.length > 0) out.push(weak('sku-negative-everywhere', 'Produits', 92, `${everywhereNegative.length} produit${everywhereNegative.length > 1 ? 's' : ''} déficitaire${everywhereNegative.length > 1 ? 's' : ''} dans tous leurs canaux`, names(everywhereNegative.map(r => `« ${r.name} »`)), 'portfolio'));
    if (allPositive.length > 0) {
        out.push(force('sku-positive', 'Produits', 60, `${allPositive.length} produit${allPositive.length > 1 ? 's' : ''} sur ${rows.length} rentable${allPositive.length > 1 ? 's' : ''} dans tous leurs canaux`, 'Marge nette positive partout où ils sont vendus.', 'portfolio'));
        const best = allPositive.filter(r => r.margins.length >= 2).map(r => ({ r, min: Math.min(...r.margins.map(m => m.pct)), max: Math.max(...r.margins.map(m => m.pct)) })).sort((a, b) => b.min - a.min)[0];
        if (best) out.push(force('sku-best', 'Produits', 80, `« ${best.r.name} » est rentable partout`, `Marge nette positive dans ses ${best.r.margins.length} canaux, de ${pct(best.min)} à ${pct(best.max)}.`, 'portfolio'));
    }
    const m = c.analysis.menuEngineeringData || {};
    if ((m.stars || []).length > 0) out.push(force('bcg-stars', 'Produits', 50, `${m.stars.length} étoile${m.stars.length > 1 ? 's' : ''} : à protéger`, names(m.stars.map(s => `« ${s.displayName} »`)), 'portfolio'));
    if ((m.dogs || []).length > 0) out.push(weak('bcg-dogs', 'Produits', 48, `${m.dogs.length} poids mort${m.dogs.length > 1 ? 's' : ''} : à repenser ou retirer`, names(m.dogs.map(s => `« ${s.displayName} »`)), 'portfolio'));
    if ((m.cows || []).length > 0) out.push(weak('bcg-cows', 'Produits', 42, `${m.cows.length} vache${m.cows.length > 1 ? 's' : ''} à lait à optimiser`, `Très vendus mais peu rentables : ${names(m.cows.map(s => `« ${s.displayName} »`))}.`, 'portfolio'));
    // Profit concentré sur le produit n° 1
    const contributions = (c.analysis.contributionData || []).filter(x => x.totalContribution > 0);
    const total = contributions.reduce((s, x) => s + x.totalContribution, 0);
    if (contributions.length >= 3 && total > 0 && contributions[0].totalContribution / total >= T.productProfitShare) {
        out.push(weak('profit-concentration', 'Produits', 55, `« ${contributions[0].name} » génère ${pct(contributions[0].totalContribution / total, 0)} du profit`, 'Un seul produit porte une grande part de vos résultats.', 'portfolio'));
    }
    return out;
};

const channelRules = (c) => {
    const rows = c.channelSummaries || [];
    const out = [];
    const revenue = rows.reduce((s, r) => s + r.revenueTotal, 0);
    const net = rows.reduce((s, r) => s + r.margeNetteTotal, 0);
    if (rows.length === 0 || !(revenue > 0)) return out;
    const top = [...rows].sort((a, b) => b.revenueTotal - a.revenueTotal)[0];
    if (rows.length >= 2 && top.revenueTotal / revenue >= T.channelDependency) {
        const profitShare = net > 0 ? top.margeNetteTotal / net : null;
        out.push(weak('channel-dependency', 'Canaux', 92, `${top.channelName} : ${pct(top.revenueTotal / revenue, 0)} des revenus${profitShare != null ? `, ${pct(profitShare, 0)} du bénéfice net` : ''}`,
            profitShare != null && profitShare < top.revenueTotal / revenue ? `${usd(top.margeNetteTotal)} de bénéfice net sur ${usd(net)} : le canal qui pèse le plus rapporte proportionnellement le moins.` : 'Une grande part de vos revenus dépend d\'un seul canal.', 'byChannel'));
    }
    rows.filter(r => r.margeNetteTotal < 0).forEach(r => out.push(weak(`channel-deficit-${r.channelId}`, 'Canaux', 80, `${r.channelName} perd de l'argent`, `Bénéfice net de ${usd(r.margeNetteTotal)} pour ${usd(r.revenueTotal)} de revenus.`, 'byChannel')));
    if (rows.length >= 2) {
        const best = [...rows].sort((a, b) => b.margeNettePercent - a.margeNettePercent)[0];
        if (best.margeNettePercent > 0 && best.channelId !== top.channelId) out.push(force('channel-best', 'Canaux', 65, `${best.channelName} : la meilleure marge nette`, `${pct(best.margeNettePercent)} de marge nette pour ${pct(best.revenueTotal / revenue, 0)} des revenus.`, 'byChannel'));
    }
    return out;
};

const activityRules = (c) => {
    const rows = c.activitySummaries || [];
    const out = [];
    rows.filter(r => r.margeNetteTotal < 0).forEach(r => out.push(weak(`activity-deficit-${r.activityId}`, 'Activités', 85, `${r.activityName} perd de l'argent`, `Bénéfice net de ${usd(r.margeNetteTotal)} pour ${usd(r.revenueTotal)} de revenus.`, 'byActivity')));
    rows.filter(r => r.margeNetteTotal > 0 && r.margeNettePercent < T.lowNetMargin).forEach(r => out.push(weak(`activity-low-${r.activityId}`, 'Activités', 50, `${r.activityName} : marge nette de ${pct(r.margeNettePercent)}`, `${usd(r.margeNetteTotal)} de bénéfice net sur ${usd(r.revenueTotal)} de revenus.`, 'byActivity')));
    if (rows.length >= 2 && rows.every(r => r.margeNetteTotal > 0)) out.push(force('activities-positive', 'Activités', 55, `Les ${rows.length} activités sont bénéficiaires`, `Bénéfice net positif pour chacune : ${names(rows.map(r => usd(r.margeNetteTotal)), 5)}.`, 'byActivity'));
    return out;
};

const supplyRules = (c) => {
    const out = [];
    const sets = [
        ['ing', 'd\'ingrédients', c.ingredientShares, c.ingredientVolatility, c.analysis.abcAnalysisData, c.analysis.purchasingReportData, 'ingredients', 1],
        ['pkg', 'd\'emballages', c.packagingShares, c.packagingVolatility, c.analysis.packagingAbcAnalysisData, c.analysis.packagingPurchasingReportData, 'packaging', 0.65],
    ];
    for (const [id, noun, shares, vol, abc, report, subTab, k] of sets) {
        const top = shares.rows[0];
        if (top && top.isDependent) out.push(weak(`supplier-${id}`, 'Approvisionnement', Math.round(80 * k), `${top.provider} : ${pct(top.share, 0)} des achats ${noun}`, 'Une dépendance à un seul fournisseur.', subTab));
        const classA = (abc?.A || []);
        if (vol.hasEnoughData && classA.length > 0) {
            const volatile = classA.filter(i => vol.byName[i.name]?.isVolatile);
            if (volatile.length > 0) out.push(weak(`volatile-a-${id}`, 'Approvisionnement', Math.round(78 * k), `${volatile.length} ${id === 'ing' ? 'ingrédient' : 'emballage'}${volatile.length > 1 ? 's' : ''} de classe A à prix volatil`, `${names(volatile.map(i => `${i.name} (${formatNumber(vol.byName[i.name].amplitudePercent, 0)} %)`))} : amplitudes de prix sur ${vol.pointCount} relevés.`, subTab));
            else out.push(force(`stable-a-${id}`, 'Approvisionnement', Math.round(45 * k), `Les ${id === 'ing' ? 'ingrédients' : 'emballages'} de classe A ont des prix stables`, `Aucun des ${classA.length} éléments de classe A n'a un prix volatil.`, subTab));
        }
        // Perte stock prévue
        const loss = report?.grandTotal;
        if (loss && loss.total > 0 && id === 'ing') {
            const share = loss.loss / loss.total;
            const items = Object.values(report.groupedByProvider || {}).flatMap(g => g.items);
            const topItem = [...items].sort((a, b) => b.lossCost - a.lossCost)[0];
            if (share >= T.lossShareHigh && topItem) out.push(weak('loss-high', 'Approvisionnement', 42, `Perte stock prévue : ${usd(loss.loss)} (${pct(share)} des achats)`, `La plus coûteuse : ${topItem.name}, ${usd(topItem.lossCost)}.`, subTab));
            else if (share < T.lossShareLow) out.push(force('loss-low', 'Approvisionnement', 30, `Perte stock faible : ${pct(share)} des achats`, `${usd(loss.loss)} à acheter en plus pour la compenser.`, subTab));
        }
    }
    return out;
};

const laborRules = (c) => {
    const out = [];
    const cas = c.cascade;
    if (cas.payroll > 0 && cas.unusedShare != null) {
        if (cas.unusedShare >= T.unusedPayHigh) out.push(weak('labor-unused', 'Main-d\'œuvre', 70, `${pct(cas.unusedShare)} de la paie n'est pas utilisée`, `Soit ${usd(cas.unusedPay)} payés sans produire, absorbés dans le coût de vos produits.`, 'labor'));
        else if (cas.unusedShare <= T.unusedPayLow) out.push(force('labor-used', 'Main-d\'œuvre', 50, `Seulement ${pct(cas.unusedShare)} de la paie non utilisée`, `Votre équipe est bien occupée : ${usd(cas.unusedPay)} sur ${usd(cas.payroll)}.`, 'labor'));
    }
    const posts = (c.info.productivityReport?.rows || []).filter(r => r.actual > 0 && r.expected > 0);
    const best = [...posts].sort((a, b) => b.utilization - a.utilization)[0];
    if (best && best.utilization / 100 >= T.postWellUsed) out.push(force('post-used', 'Main-d\'œuvre', 40, `${best.postName} à ${formatNumber(best.utilization, 0)} % d'utilisation`, 'Le poste de production le plus sollicité est bien occupé.', 'labor'));
    const ranked = c.productRows.filter(r => r.grossProfitPerHour != null);
    if (ranked.length >= 3) {
        const sorted = [...ranked].sort((a, b) => b.grossProfitPerHour - a.grossProfitPerHour);
        const totalHours = ranked.reduce((s, r) => s + r.hours, 0);
        const avg = ranked.reduce((s, r) => s + r.grossProfit, 0) / totalHours;
        out.push(force('product-best-hour', 'Main-d\'œuvre', 75, `« ${sorted[0].name} » : le meilleur usage du temps`, `${usd(sorted[0].grossProfitPerHour)} de bénéfice brut par heure de main-d'œuvre (moyenne : ${usd(avg)}).`, 'labor'));
        const worst = sorted[sorted.length - 1];
        if (worst.grossProfitPerHour < avg * T.productHourLow) out.push(weak('product-worst-hour', 'Main-d\'œuvre', 45, `« ${worst.name} » rapporte peu à l'heure`, `${usd(worst.grossProfitPerHour)} par heure, contre ${usd(avg)} en moyenne.`, 'labor'));
    }
    if (c.growth && c.growth.freeHours >= T.growthMinHours) out.push(force('labor-growth', 'Main-d\'œuvre', 55, `Marge de croissance : ${formatNumber(c.growth.freeHours, 0)} h libres`, `Environ ${usd(Math.round(c.growth.additionalRevenue / 100) * 100)} de ventes de plus possibles sans embauche (estimation).`, 'labor'));
    return out;
};

const reconciliationRules = (c) => {
    if (!c.hasRealData) return [];
    const out = [];
    const row = (label) => c.reconciliation.rows.find(r => r.label === label);
    const rev = row('Revenus'), direct = row('Charges directes'), net = row('Bénéfice net');
    if (rev && rev.diffPercent != null && Math.abs(rev.diffPercent) <= T.reconciliationClose) out.push(force('rec-revenue', 'Réel vs théorique', 50, `Revenus réels alignés sur votre modèle (${rev.diffPercent >= 0 ? '+' : ''}${pct(rev.diffPercent)})`, `${usd(rev.real)} réels contre ${usd(rev.theoretical)} prévus.`, 'overview'));
    if (direct && direct.diffPercent != null && direct.diffPercent >= T.reconciliationGap) out.push(weak('rec-direct', 'Réel vs théorique', 60, `Charges directes réelles au-dessus du modèle (+${pct(direct.diffPercent)})`, `${direct.diff >= 0 ? '+' : ''}${usd(direct.diff)} : pertes, rendements ou prix payés plus élevés que prévu.`, 'overview'));
    if (net && net.diffPercent != null) {
        if (net.diffPercent <= -T.reconciliationNetGap) out.push(weak('rec-net', 'Réel vs théorique', 75, `Bénéfice net réel sous le modèle (${pct(net.diffPercent)})`, `${usd(net.real)} réels contre ${usd(net.theoretical)} prévus.`, 'overview'));
        else if (net.diffPercent >= T.reconciliationNetGap) out.push(force('rec-net', 'Réel vs théorique', 60, `Bénéfice net réel au-dessus du modèle (+${pct(net.diffPercent)})`, `${usd(net.real)} réels contre ${usd(net.theoretical)} prévus.`, 'overview'));
    }
    return out;
};

// Évolution depuis le plus ancien point de référence (il en faut au moins deux).
const historyRules = (c) => {
    const points = [...c.trackingPoints].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (points.length < 2) return [];
    const first = computeSnapshotMenuKpis(points[0].productsWithCosts);
    if (!first) return [];
    const a = c.analysis, out = [];
    const since = `depuis « ${points[0].name} »`;
    const dGross = a.weightedGrossMargin - first.weightedGrossMargin;
    if (dGross >= T.historyPoints) out.push(force('history-gross', 'Évolution', 55, `Marge brute en hausse de ${formatNumber(dGross * 100, 1)} point${dGross * 100 >= 2 ? 's' : ''}`, `${since} : de ${pct(first.weightedGrossMargin)} à ${pct(a.weightedGrossMargin)}.`, 'overview'));
    else if (dGross <= -T.historyPoints) out.push(weak('history-gross', 'Évolution', 55, `Marge brute en baisse de ${formatNumber(-dGross * 100, 1)} point${-dGross * 100 >= 2 ? 's' : ''}`, `${since} : de ${pct(first.weightedGrossMargin)} à ${pct(a.weightedGrossMargin)}.`, 'overview'));
    const dMat = a.weightedMaterialCost - first.weightedMaterialCost;
    if (dMat >= T.historyPoints) out.push(weak('history-material', 'Évolution', 50, `Coût matière en hausse de ${formatNumber(dMat * 100, 1)} point${dMat * 100 >= 2 ? 's' : ''}`, `${since} : de ${pct(first.weightedMaterialCost)} à ${pct(a.weightedMaterialCost)}.`, 'ingredients'));
    else if (dMat <= -T.historyPoints) out.push(force('history-material', 'Évolution', 45, `Coût matière en baisse de ${formatNumber(-dMat * 100, 1)} point${-dMat * 100 >= 2 ? 's' : ''}`, `${since} : de ${pct(first.weightedMaterialCost)} à ${pct(a.weightedMaterialCost)}.`, 'ingredients'));
    return out;
};

export const FINDING_RULES = [safetyRule, netProfitRule, costTargetRules, productRules, channelRules, activityRules, supplyRules, laborRules, reconciliationRules, historyRules];

// Tous les constats applicables, du plus important au moins important (à poids égal, ordre stable par identifiant).
export function computeKeyFindings(ctx) {
    const all = [];
    for (const rule of FINDING_RULES) {
        try { all.push(...rule(ctx)); } catch { /* une règle qui échoue (donnée inattendue) se tait : un constat n'est jamais inventé */ }
    }
    const byId = new Map();
    for (const f of all) if (!byId.has(f.id)) byId.set(f.id, f);
    const sorted = [...byId.values()].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    return { forces: sorted.filter(f => f.tone === 'force'), faiblesses: sorted.filter(f => f.tone === 'faiblesse'), all: sorted };
}

// Pour l'affichage : combien de constats par colonne avant la fenêtre « Voir tous les constats ».
export const VISIBLE_FINDINGS_PER_COLUMN = 5;
