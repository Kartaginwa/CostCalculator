// Constats clés (refonte de Rapport et suivi, lot 3, 21/11) : ce que les chiffres de l'entrepreneur disent de son entreprise, en FORCES et en FAIBLESSES.
// Ce n'est pas de l'IA : un catalogue de règles déterministes. Chaque règle reçoit le contexte (données déjà calculées par l'application) et renvoie zéro,
// un ou plusieurs constats { id, tone, theme, weight, title, detail, link }. Les textes sont des gabarits.
// Principes décidés avec l'utilisateur (voir Projet_Claude/10-Constats-Cles.md) :
//   - jamais un avertissement de qualité des données (cela reste dans le panneau « points à vérifier ») ;
//   - une donnée absente reste absente : une règle sans donnée est muette, jamais forcée à 0 ;
//   - tous les seuils vivent dans reportThresholds.js ;
//   - le poids (0–100) ordonne les constats ; l'écran en montre 5 par colonne, le reste est dans une fenêtre.
import { parseLocaleNumber as P, formatNumber, unitConversionFactor } from '../utils.js';
import { SUBTAB_LABELS, pct, usd, names, finding, force, weak, subject, activeRows, netMarginOfRows, computeFormatSpread } from './findingKit.js';
import { classifyFinding, severityOf } from './findingMeta.js';
import { evaluateObjectives, activeTarget } from './objectives.js';
import { ENTITY_RULES } from './entityFindings.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';
import {
    computeActivitySummaries, computeChannelSummaries, computeRealVsTheoreticalReconciliation, computeSnapshotMenuKpis, computeSnapshotBreakEven,
} from './analysisData.js';
import { computeIngredientVolatility, computePackagingVolatility } from './priceVolatility.js';
import {
    computeSafetyMargin, computeProviderShares, computeLaborCascade, computeProductLaborProfitability, computeGrowthMargin, computeActivityLaborRatios,
} from './laborReport.js';

export const FINDING_THEMES = ['Rentabilité', 'Coûts', 'Produits', 'Canaux', 'Activités', 'Approvisionnement', 'Main-d\'œuvre', 'Réel vs théorique', 'Évolution'];
// TEST (21/11) : les constats se répartissent en trois groupes, chacun répondant à une question de gestion :
//   objectif  — « Suis-je là où je veux aller ? » : écart aux cibles saisies (coûts) ; tone 'force' = atteint, 'faiblesse' = à atteindre ;
//   evolution — « Dans quelle direction vais-je ? » : variation depuis le dernier point de référence (ou tendance sur plusieurs relevés) ; 'force' = amélioration, 'faiblesse' = détérioration ;
//   structure — « Quelle est ma solidité ? » : forces et faiblesses générales (capacité, dépendances, résilience).
export const FINDING_GROUPS = [
    { id: 'objectif', label: 'Objectifs stratégiques', forceLabel: 'Objectifs atteints', weakLabel: 'Objectifs à atteindre', forceTag: 'Atteint', weakTag: 'À atteindre' },
    { id: 'evolution', label: 'Amélioration / détérioration', forceLabel: 'Améliorations', weakLabel: 'Détériorations', forceTag: 'Amélioration', weakTag: 'Détérioration' },
    { id: 'structure', label: 'Forces et faiblesses', forceLabel: 'Forces', weakLabel: 'Faiblesses', forceTag: 'Force', weakTag: 'Faiblesse' },
];
export const groupOf = (id) => (/^(cost-|sku-over-cost-|obj-)/.test(id) ? 'objectif' : /^(history-|sku-cost-trend-|sku-margin-trend-)/.test(id) ? 'evolution' : 'structure');
export { SUBTAB_LABELS }; // défini dans findingKit.js (partagé avec les règles par entité)


// Les trois derniers points de référence, du plus ancien au plus récent.
const recentPoints = (points) => [...(points || [])].filter(p => p && p.timestamp).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp)).slice(-3);

// ---------- contexte : les données dont les règles ont besoin, calculées une fois ----------
export function buildKeyFindingsContext({ analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines }) {
    const a = analysisData || {};
    const info = generalInfo || {};
    const channelNames = Object.fromEntries((salesChannels || []).map(c => [c.id, c.name || 'Sans nom']));
    const totalRevenue = (revenueLines || []).reduce((s, l) => s + Object.values(l.amounts || {}).reduce((x, v) => x + P(v), 0), 0);
    const totalDirectCosts = (directCostLines || []).reduce((s, l) => s + P(l.amount), 0);
    const productRows = computeProductLaborProfitability(a.activeProducts || [], info.laborHoursByFormat);
    const cascade = computeLaborCascade(laborDatabase, info.productivityReport?.rows);
    return {
        analysis: a, info, channelNames, trackingPoints: trackingPoints || [], baseIngredients: baseIngredients || [], expenseLines: expenseLines || [], productionActivities: productionActivities || [],
        channelSummaries: computeChannelSummaries(a.productsWithCosts || [], salesChannels || []),
        activitySummaries: computeActivitySummaries(a.productsWithCosts || [], productionActivities || []),
        ingredientVolatility: computeIngredientVolatility(trackingPoints || []),
        packagingVolatility: computePackagingVolatility(trackingPoints || []),
        // Fenêtre récente (trois derniers relevés) : une tendance de prix ne se mesure pas depuis le tout premier relevé d'un long historique.
        ingredientVolatilityRecent: computeIngredientVolatility(recentPoints(trackingPoints)),
        packagingVolatilityRecent: computePackagingVolatility(recentPoints(trackingPoints)),
        ingredientShares: computeProviderShares(a.purchasingReportData),
        packagingShares: computeProviderShares(a.packagingPurchasingReportData),
        cascade, productRows, growth: computeGrowthMargin(cascade.freeProductionHours, productRows, info.productivityReport?.totals?.actual),
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
        ['matiere', 'matière', a.weightedMaterialCost, activeTarget(c.info, "matiere"), 85, 'ingredients'],
        ['emballage', 'emballage', a.weightedPackagingCost, activeTarget(c.info, "emballage"), 60, 'packaging'],
        ['mo', 'main-d\'œuvre', a.weightedLaborCost, activeTarget(c.info, "mo"), 60, 'labor'],
    ];
    // Coût matière : les produits qui dépassent la cible sont dits dans le détail du constat (un seul constat par objectif, décision du 24/11).
    const matTarget = P(activeTarget(c.info, 'matiere'));
    const over = matTarget > 0 ? (a.activeProducts || []).filter(p => p.costs && p.costs.costMatierePercent * 100 > matTarget) : [];
    const overText = over.length > 0 ? ` ${over.length} produit${over.length > 1 ? 's' : ''} sur ${(a.activeProducts || []).length} dépasse${over.length > 1 ? 'nt' : ''} cette cible : ${names(over.map(p => p.displayName))}.` : '';
    for (const [id, label, value, targetRaw, weight, subTab] of items) {
        const target = P(targetRaw);
        if (!(target > 0) || !Number.isFinite(value)) continue; // pas de cible saisie : règle muette
        const detail = `À ${pct(value, 2)} contre une cible de ${formatNumber(target, 0)} %.${id === 'matiere' ? overText : ''}`;
        if (value * 100 > target) out.push(weak(`cost-${id}`, 'Coûts', weight, `Coût ${label} au-dessus de la cible`, detail, subTab));
        else out.push(force(`cost-${id}`, 'Coûts', weight - 15, `Coût ${label} sous sa cible`, detail, 'overview'));
    }
    // Miroir de « cible dépassée » : au moins deux cibles saisies, et toutes atteintes.
    const set = items.filter(([, , v, t]) => P(t) > 0 && Number.isFinite(v));
    if (set.length >= 2 && set.every(([, , v, t]) => v * 100 <= P(t))) {
        out.push(force('targets-all-met', 'Coûts', 70, `Vos ${set.length} cibles de coûts sont atteintes`, `Coûts ${set.map(([, label]) => label).join(', ').replace(/, ([^,]*)$/, ' et $1')} sous leurs cibles.`, 'overview'));
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
        if (allPositive.length === rows.length && rows.length >= 3) out.push(force('sku-none-losing', 'Produits', 65, 'Aucun produit ne perd d\'argent', `Les ${rows.length} produits sont rentables dans tous leurs canaux.`, 'portfolio'));
        if (allPositive.length < rows.length) out.push(force('sku-positive', 'Produits', 60, `${allPositive.length} produit${allPositive.length > 1 ? 's' : ''} sur ${rows.length} rentable${allPositive.length > 1 ? 's' : ''} dans tous leurs canaux`, 'Marge nette positive partout où ils sont vendus.', 'portfolio'));
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
    if (rows.length >= 2 && top.revenueTotal / revenue < T.channelDependency) {
        out.push(force('channel-balanced', 'Canaux', 60, 'Revenus bien répartis entre vos canaux', `Le premier canal, ${top.channelName}, ne pèse que ${pct(top.revenueTotal / revenue, 0)} des revenus.`, 'byChannel'));
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
        // Moyenne de l'écran Main-d'œuvre (marge de croissance) : bénéfice brut ÷ TOUTES les heures de production ; absente, la comparaison l'est aussi.
        const avg = c.growth ? c.growth.grossProfitPerHour : null;
        out.push(force('product-best-hour', 'Main-d\'œuvre', 75, `« ${sorted[0].name} » : le meilleur usage du temps`, `${usd(sorted[0].grossProfitPerHour)} de bénéfice brut par heure de main-d'œuvre${avg != null ? ` (moyenne : ${usd(avg)})` : ''}.`, 'labor'));
        const worst = sorted[sorted.length - 1];
        if (avg != null && worst.grossProfitPerHour < avg * T.productHourLow) out.push(weak('product-worst-hour', 'Main-d\'œuvre', 45, `« ${worst.name} » rapporte peu à l'heure`, `${usd(worst.grossProfitPerHour)} par heure, contre ${usd(avg)} en moyenne.`, 'labor'));
    }
    if (c.growth && c.growth.freeHours >= T.growthMinShare * (c.cascade.expectedHours || 0)) out.push(force('labor-growth', 'Main-d\'œuvre', 55, `Marge de croissance : ${formatNumber(c.growth.freeHours, 0)} h libres`, `Environ ${usd(Math.round(c.growth.additionalRevenue / 100) * 100)} de ventes de plus possibles sans embauche (estimation).`, 'labor'));
    return out;
};

// Objectifs stratégiques autres que les trois cibles de coûts (objectives.js) : les cinq objectifs par défaut ajoutés le 24/11, la paie non utilisée et les objectifs
// sur mesure. Un objectif sans valeur, désactivé ou sans donnée est muet. Les cibles de coût matière, d'emballage et de main-d'œuvre gardent leurs règles ci-dessus
// (identifiants stables pour le guide).
const objectiveRules = (c) => {
    const money = (v, unit) => (unit === '$' ? usd(v) : `${formatNumber(v, 1)} %`);
    const out = [];
    for (const o of evaluateObjectives(c)) {
        if (o.met == null || ['matiere', 'emballage', 'mo'].includes(o.key)) continue;
        const detail = `À ${money(o.current, o.unit)} contre un objectif d'${o.dir === 'min' ? 'au moins' : 'au plus'} ${money(o.target, o.unit)}.`;
        const id = `obj-${o.key}`;
        if (o.met) out.push(force(id, o.theme, 45, `${o.label} : objectif atteint`, detail, o.subTab));
        else out.push(weak(id, o.theme, Math.round(60 + Math.min(25, (o.gap / o.target) * 100)), `${o.label} ${o.dir === 'min' ? 'sous' : 'au-dessus de'} l'objectif`, detail, o.subTab));
    }
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

// ---------- tendances par produit, canal et intrant : ce qui a changé depuis le dernier point de référence utile ----------
const rowRevenue = (p) => (p.channelBreakdown || []).reduce((s, cb) => s + P(cb.netPrice) * P(cb.volume), 0);
const revenueOfRows = (rows) => activeRows(rows).reduce((s, p) => s + rowRevenue(p), 0);
const skuNetMargin = (p) => netMarginOfRows([p]);
const skuAvgNetPrice = (p) => { const l = (p.channelBreakdown || []).map(cb => P(cb.netPrice)).filter(v => v > 0); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null; };
const rel = (now, before) => (before > 0 ? (now - before) / before : null);
const pts = (d) => `${formatNumber(Math.abs(d) * 100, 1)} point${Math.abs(d) * 100 >= 2 ? 's' : ''}`;

const trendRules = (c) => {
    const points = historyPoints(c);
    if (points.length < 1) return [];
    const first = points[points.length - 1], since = `depuis « ${first.name} »`;
    const out = [];
    const a = c.analysis;
    const nowRows = activeRows(a.activeProducts), thenRows = activeRows(first.productsWithCosts);
    // Produits : on apparie les formats par leur identifiant (un produit absent d'un des deux relevés est ignoré).
    const thenById = new Map(thenRows.map(p => [p.id, p]));
    const pairs = nowRows.map(p => ({ now: p, then: thenById.get(p.id) })).filter(x => x.then);
    const costChanges = pairs.map(x => ({ id: x.now.id, name: x.now.displayName, d: rel(P(x.now.costs?.totalCostPerPortion), P(x.then.costs?.totalCostPerPortion)) })).filter(x => x.d != null && P(x.d) === x.d);
    // 15 : coût de revient en hausse
    const worst = [...costChanges].sort((x, y) => y.d - x.d)[0];
    if (worst && worst.d >= T.skuCostChange) {
        const n = costChanges.filter(x => x.d >= T.skuCostChange).length;
        out.push(weak('history-sku-cost-up', 'Évolution', 56, `Coût de revient en hausse pour ${n} produit${n > 1 ? 's' : ''}`, `Le plus touché : « ${worst.name} », +${pct(worst.d, 0)} ${since}.`, 'bySku'));
    }
    // 16 : coût de revient en baisse
    const best = [...costChanges].sort((x, y) => x.d - y.d)[0];
    if (best && best.d <= -T.skuCostChange) {
        const n = costChanges.filter(x => x.d <= -T.skuCostChange).length;
        out.push(force('history-sku-cost-down', 'Évolution', 46, `Coût de revient en baisse pour ${n} produit${n > 1 ? 's' : ''}`, `Le plus allégé : « ${best.name} », ${pct(best.d, 0)} ${since}.`, 'bySku'));
    }
    // 28 : marge nette d'un produit
    const marginChanges = pairs.map(x => ({ id: x.now.id, name: x.now.displayName, then: skuNetMargin(x.then), now: skuNetMargin(x.now) })).filter(x => x.then != null && x.now != null).map(x => ({ ...x, d: x.now - x.then }));
    const down = [...marginChanges].sort((x, y) => x.d - y.d)[0];
    if (down && down.d <= -T.skuMarginPoints) out.push(weak('history-sku-margin-down', 'Évolution', 54, `Marge nette en recul pour ${marginChanges.filter(x => x.d <= -T.skuMarginPoints).length} produit(s)`, `Le plus touché : « ${down.name} », de ${pct(down.then)} à ${pct(down.now)} ${since}.`, 'bySku'));
    const up = [...marginChanges].sort((x, y) => y.d - x.d)[0];
    if (up && up.d >= T.skuMarginPoints) out.push(force('history-sku-margin-up', 'Évolution', 46, `Marge nette en progrès pour ${marginChanges.filter(x => x.d >= T.skuMarginPoints).length} produit(s)`, `Le plus amélioré : « ${up.name} », de ${pct(up.then)} à ${pct(up.now)} ${since}.`, 'bySku'));
    // 74 : érosion de marge — le coût monte, le prix net n'a pas bougé
    const eroded = pairs.map(x => ({ name: x.now.displayName, cost: rel(P(x.now.costs?.totalCostPerPortion), P(x.then.costs?.totalCostPerPortion)), price: rel(skuAvgNetPrice(x.now), skuAvgNetPrice(x.then)) }))
        .filter(x => x.cost != null && x.price != null && x.cost >= T.skuCostChange && Math.abs(x.price) < 0.01);
    if (eroded.length > 0) out.push(weak('history-erosion', 'Évolution', 62, `${eroded.length} produit${eroded.length > 1 ? 's' : ''} dont le coût monte sans hausse de prix`, `Érosion de marge : ${names(eroded.map(x => `« ${x.name} » (coût +${pct(x.cost, 0)})`))}.`, 'bySku'));
    // Par format (constats par entité, demandés par les fiches produits)
    if (c.includeEntities) {
        costChanges.filter(x => Math.abs(x.d) >= T.skuCostChange).forEach(x => out.push(finding(`sku-cost-trend-${x.id}`, x.d > 0 ? 'faiblesse' : 'force', 'Évolution', x.d > 0 ? 56 : 46,
            `« ${x.name} » : coût de revient en ${x.d > 0 ? 'hausse' : 'baisse'} de ${pct(Math.abs(x.d), 0)}`, `${since.charAt(0).toUpperCase()}${since.slice(1)}.`, 'bySku', null, subject('format', x.id, x.name))));
        marginChanges.filter(x => Math.abs(x.d) >= T.skuMarginPoints).forEach(x => out.push(finding(`sku-margin-trend-${x.id}`, x.d > 0 ? 'force' : 'faiblesse', 'Évolution', x.d > 0 ? 46 : 54,
            `« ${x.name} » : marge nette en ${x.d > 0 ? 'progrès' : 'recul'}`, `De ${pct(x.then)} à ${pct(x.now)} ${since}.`, 'bySku', null, subject('format', x.id, x.name))));
    }
    // 37 : canaux
    const chRev = (rows) => { const m = new Map(); for (const p of activeRows(rows)) for (const cb of p.channelBreakdown || []) m.set(cb.channelId, (m.get(cb.channelId) || 0) + P(cb.netPrice) * P(cb.volume)); return m; };
    const chNow = chRev(nowRows), chThen = chRev(thenRows);
    const chChanges = [...chNow].map(([id, v]) => ({ name: c.channelNames[id], d: rel(v, chThen.get(id)) })).filter(x => x.name && x.d != null);
    const grow = [...chChanges].sort((x, y) => y.d - x.d)[0];
    if (grow && grow.d >= T.channelChange) out.push(force('history-channel-up', 'Évolution', 50, `${grow.name} : revenus en hausse de ${pct(grow.d, 0)}`, `${since}.`, 'byChannel'));
    const shrink = [...chChanges].sort((x, y) => x.d - y.d)[0];
    if (shrink && shrink.d <= -T.channelChange) out.push(weak('history-channel-down', 'Évolution', 50, `${shrink.name} : revenus en baisse de ${pct(-shrink.d, 0)}`, `${since}.`, 'byChannel'));
    // 49, 50 : prix des intrants (au moins 3 relevés pour parler de tendance soutenue)
    for (const [key, vol, label, subTab] of [['ing', c.ingredientVolatilityRecent, 'ingrédient', 'ingredients'], ['pkg', c.packagingVolatilityRecent, 'emballage', 'packaging']]) {
        const list = (vol?.list || []).filter(x => x.count >= 3);
        const ups = list.filter(x => x.trendPercent / 100 >= T.priceTrend).sort((x, y) => y.trendPercent - x.trendPercent);
        const downs = list.filter(x => x.trendPercent / 100 <= -T.priceTrend).sort((x, y) => x.trendPercent - y.trendPercent);
        if (ups.length) out.push(weak(`history-price-up-${key}`, 'Évolution', 53, `${ups.length} ${label}${ups.length > 1 ? 's' : ''} en hausse soutenue`, `${names(ups.map(x => `${x.name} (+${formatNumber(x.trendPercent, 0)} %)`))}.`, subTab));
        if (downs.length) out.push(force(`history-price-down-${key}`, 'Évolution', 43, `${downs.length} ${label}${downs.length > 1 ? 's' : ''} en baisse de prix`, `${names(downs.map(x => `${x.name} (${formatNumber(x.trendPercent, 0)} %)`))}.`, subTab));
    }
    // 56 : fournisseurs (variation moyenne des prix de leurs intrants)
    const byProvider = new Map();
    for (const x of (c.ingredientVolatilityRecent?.list || []).filter(i => i.count >= 2 && i.provider)) {
        const e = byProvider.get(x.provider) || { sum: 0, n: 0 }; e.sum += x.trendPercent; e.n += 1; byProvider.set(x.provider, e);
    }
    const prov = [...byProvider].filter(([, e]) => e.n >= 2).map(([name, e]) => ({ name, avg: e.sum / e.n, n: e.n }));
    const dear = prov.sort((x, y) => y.avg - x.avg)[0];
    if (dear && dear.avg / 100 >= T.providerTrend) out.push(weak('history-provider-up', 'Évolution', 47, `${dear.name} : prix en hausse de ${formatNumber(dear.avg, 0)} % en moyenne`, `Moyenne sur ${dear.n} ingrédients ${since}.`, 'ingredients'));
    const cheap = prov.sort((x, y) => x.avg - y.avg)[0];
    if (cheap && cheap.avg / 100 <= -T.providerTrend) out.push(force('history-provider-down', 'Évolution', 41, `${cheap.name} : prix en baisse de ${formatNumber(-cheap.avg, 0)} % en moyenne`, `Moyenne sur ${cheap.n} ingrédients ${since}.`, 'ingredients'));
    return out;
};

// ---------- évolution : variation récente, tendance sur plusieurs relevés, et recul de 12 mois ----------
// Trois lectures de la même mesure, sans jamais se limiter au tout premier relevé d'un long historique :
//   - variation récente : depuis le dernier point de référence (un point enregistré qui ne diffère plus d'aujourd'hui est écarté : on compare alors
//     au précédent, sinon le constat serait toujours « aucun changement ») ;
//   - tendance : même sens sur au moins trois valeurs consécutives (jusqu'aux trois derniers relevés et aujourd'hui) ; elle remplace la variation récente ;
//   - 12 mois : le relevé le plus proche d'il y a un an (à environ 75 jours près), pour les évolutions lentes que la variation récente ne voit pas.
export const EVOLUTION_METRICS = [
    { id: 'gross', label: 'Marge brute', higherIsBetter: true, kind: 'points', subTab: 'overview', weight: 66, snap: (p) => computeSnapshotMenuKpis(p.productsWithCosts)?.weightedGrossMargin, now: (c) => c.analysis.weightedGrossMargin },
    { id: 'net', label: 'Marge nette', higherIsBetter: true, kind: 'points', subTab: 'overview', weight: 68, snap: (p) => netMarginOfRows(activeRows(p.productsWithCosts)), now: (c) => netMarginOfRows(activeRows(c.analysis.activeProducts)) },
    { id: 'material', label: 'Coût matière', higherIsBetter: false, kind: 'points', subTab: 'ingredients', weight: 64, snap: (p) => computeSnapshotMenuKpis(p.productsWithCosts)?.weightedMaterialCost, now: (c) => c.analysis.weightedMaterialCost },
    { id: 'packaging', label: 'Coût d\'emballage', higherIsBetter: false, kind: 'points', subTab: 'packaging', weight: 52, snap: (p) => computeSnapshotMenuKpis(p.productsWithCosts)?.weightedPackagingCost, now: (c) => c.analysis.weightedPackagingCost },
    { id: 'labor', label: 'Coût de main-d\'œuvre', higherIsBetter: false, kind: 'points', subTab: 'labor', weight: 58, snap: (p) => computeSnapshotMenuKpis(p.productsWithCosts)?.weightedLaborCost, now: (c) => c.analysis.weightedLaborCost },
    { id: 'revenue', label: 'Revenus', higherIsBetter: true, kind: 'rel', subTab: 'overview', weight: 67, snap: (p) => { const v = revenueOfRows(p.productsWithCosts); return v > 0 ? v : null; }, now: (c) => { const v = revenueOfRows(c.analysis.activeProducts); return v > 0 ? v : null; } },
    { id: 'breakeven', label: 'Point mort', higherIsBetter: false, kind: 'rel', subTab: 'overview', weight: 62, snap: (p) => computeSnapshotBreakEven(activeRows(p.productsWithCosts).map(r => ({ ...r, onMenu: true })), P(p.generalInfo?.totalIndirects)), now: (c) => (c.analysis.globalBreakEven > 0 ? c.analysis.globalBreakEven : null) },
];
// Points de référence utiles à l'évolution : du plus ancien au plus récent, sans les derniers qui reflètent déjà la situation d'aujourd'hui.
export const historyPoints = (c) => {
    const points = [...c.trackingPoints].filter(p => p && p.timestamp).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
    const a = c.analysis;
    const close = (x, y) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-4;
    const sameAsNow = (p) => {
        const k = computeSnapshotMenuKpis(p.productsWithCosts);
        if (!k) return false;
        const rThen = revenueOfRows(p.productsWithCosts), rNow = revenueOfRows(a.activeProducts);
        return close(k.weightedGrossMargin, a.weightedGrossMargin) && close(k.weightedMaterialCost, a.weightedMaterialCost) && Math.abs(rThen - rNow) <= Math.max(1, rNow * 1e-3);
    };
    while (points.length && sameAsNow(points[points.length - 1])) points.pop();
    return points;
};
// Le point de référence le plus proche d'il y a un an (à environ 75 jours près) ; partagé par les constats « sur 12 mois » et le tableau d'évolution du rapport.
export const yearAgoPoint = (points) => {
    const DAY = 86400000, target = Date.now() - 365 * DAY;
    return points.map(p => ({ p, gap: Math.abs(new Date(p.timestamp) - target) })).filter(x => x.gap <= 75 * DAY).sort((x, y) => x.gap - y.gap)[0]?.p ?? null;
};
const evolutionRules = (c) => {
    const points = historyPoints(c);
    if (points.length < 1) return [];
    const out = [];
    for (const m of EVOLUTION_METRICS) {
        const nowV = m.now(c);
        if (!Number.isFinite(nowV)) continue;
        const fmt = (v) => (m.kind === 'rel' ? usd(v) : pct(v));
        const thr = m.kind === 'rel' ? T.revenueChange : T.historyPoints;
        const delta = (from, to) => (m.kind === 'rel' ? rel(to, from) : to - from);
        const magnitude = (d) => (m.kind === 'rel' ? pct(Math.abs(d), 0) : pts(d));
        const make = (id, weight, d, text, detail) => {
            const up = d > 0, good = up === m.higherIsBetter;
            return finding(id, good ? 'force' : 'faiblesse', 'Évolution', weight, `${m.label} en ${up ? 'hausse' : 'baisse'} ${text} (${up ? '+' : '−'}${magnitude(d)})`, detail, m.subTab);
        };
        const series = points.slice(-3).map(p => ({ label: p.name, v: m.snap(p) })).filter(x => Number.isFinite(x.v)).concat([{ label: 'aujourd\'hui', v: nowV }]);
        const last = series[series.length - 1];
        if (series.length >= 2) {
            const prev = series[series.length - 2];
            const diffs = series.slice(1).map((x, i) => x.v - series[i].v);
            const steady = series.length >= 3 && diffs.every(d => Math.sign(d) === Math.sign(diffs[0]) && d !== 0);
            const total = delta(series[0].v, last.v);
            if (steady && total != null && Math.abs(total) >= thr) {
                out.push(make(`history-${m.id}`, m.weight + 4, total, `constante depuis ${series.length - 1} relevés`, `De ${fmt(series[0].v)} (« ${series[0].label} ») à ${fmt(last.v)} aujourd'hui.`));
            } else {
                const d = delta(prev.v, last.v);
                if (d != null && Math.abs(d) >= thr) out.push(make(`history-${m.id}`, m.weight, d, `depuis « ${prev.label} »`.replace('depuis « aujourd\'hui »', ''), `De ${fmt(prev.v)} à ${fmt(last.v)}.`));
            }
        }
        // 12 mois : le relevé le plus proche d'il y a un an, pourvu qu'il diffère du relevé de comparaison récent
        const yearAgo = yearAgoPoint(points);
        if (yearAgo && points.length >= 2 && yearAgo !== points[points.length - 1]) {
            const v = m.snap(yearAgo);
            const d = Number.isFinite(v) ? delta(v, nowV) : null;
            if (d != null && Math.abs(d) >= thr) out.push(make(`history-${m.id}-12m`, m.weight - 8, d, 'sur 12 mois', `De ${fmt(v)} (« ${yearAgo.name} ») à ${fmt(nowV)} aujourd'hui.`));
        }
    }
    return out;
};

// ---------- compléments du catalogue : structure de l'entreprise ----------
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

const economicsRules = (c) => {
    const rows = c.channelSummaries || [];
    if (rows.length === 0) return [];
    const out = [];
    const revenue = sum(rows, r => r.revenueTotal);
    const contribution = sum(rows, r => r.margeBruteTotal + r.costLaborTotal - r.costAgingTotal);
    const fixed = sum(rows, r => r.totalIndirectTotal + r.costLaborTotal);
    // 6 : la contribution couvre-t-elle les frais fixes ?
    if (fixed > 0 && contribution > 0) {
        const cover = contribution / fixed;
        if (cover >= T.fixedCoverGood) out.push(force('fixed-cover', 'Rentabilité', 60, `Les frais fixes sont couverts ${formatNumber(cover, 1)} fois`, `${usd(contribution)} de marge de contribution pour ${usd(fixed)} de frais fixes (main-d'œuvre comprise).`, 'overview'));
        else if (cover < 1) out.push(weak('fixed-cover', 'Rentabilité', 90, `La marge de contribution ne couvre pas les frais fixes`, `${usd(contribution)} de marge de contribution pour ${usd(fixed)} de frais fixes (main-d'œuvre comprise).`, 'overview', fixed - contribution));
    }
    // 7 : poids des frais fixes dans les revenus
    if (revenue > 0 && sum(rows, r => r.totalIndirectTotal) > 0) {
        const share = sum(rows, r => r.totalIndirectTotal) / revenue;
        if (share >= T.fixedShareHigh) out.push(weak('fixed-share', 'Rentabilité', 58, `Les frais fixes pèsent ${pct(share, 0)} des revenus`, 'Une structure de frais lourde exige un volume élevé pour être rentable.', 'overview'));
        else if (share <= T.fixedShareLow) out.push(force('fixed-share', 'Rentabilité', 40, `Frais fixes légers : ${pct(share, 0)} des revenus`, 'Une structure légère rend l\'entreprise plus résistante à un recul des ventes.', 'overview'));
    }
    // 17 : vieillissement
    const aging = sum(rows, r => r.costAgingTotal);
    const allCosts = sum(rows, r => r.totalDirectCostTotal + r.totalIndirectTotal + r.costAgingTotal);
    if (aging > 0 && allCosts > 0 && aging / allCosts >= T.agingShare) out.push(weak('aging-share', 'Coûts', 45, `Le vieillissement pèse ${pct(aging / allCosts, 0)} de vos coûts`, `${usd(aging)} de coût de vieillissement (capital immobilisé et pertes) sur ${usd(allCosts)} de coûts totaux.`, 'overview', aging));
    // 66 : part de la main-d'œuvre dans les coûts
    const labor = sum(rows, r => r.costLaborTotal);
    if (allCosts > 0 && labor / allCosts >= T.laborCostShare) out.push(weak('labor-cost-share', 'Main-d\'œuvre', 52, `La main-d'œuvre pèse ${pct(labor / allCosts, 0)} de vos coûts`, `${usd(labor)} sur ${usd(allCosts)} : le premier levier est la productivité du temps.`, 'labor'));
    // 71, 73 : sensibilité à une hausse de coûts, mesurée sur le bénéfice net prévu
    const net = c.reconciliation?.rows?.find(r => r.label === 'Bénéfice net')?.theoretical;
    if (net != null && net > 0) {
        const s = T.sensitivityShock;
        const inputs = sum(rows, r => r.costMatiereTotal + r.costPackagingTotal);
        if (inputs > 0) {
            const after = net - inputs * s;
            if (after < 0) out.push(weak('sens-inputs', 'Rentabilité', 72, `Une hausse de ${pct(s, 0)} des intrants vous ferait perdre de l'argent`, `Le bénéfice net prévu de ${usd(net)} passerait à ${usd(after)}.`, 'simulation', -after));
            else out.push(force('sens-inputs', 'Rentabilité', 35, `Votre bénéfice résiste à une hausse de ${pct(s, 0)} des intrants`, `Il passerait de ${usd(net)} à ${usd(after)}.`, 'simulation', net - after));
        }
        if (labor > 0) {
            const after = net - labor * s;
            if (after < 0) out.push(weak('sens-labor', 'Main-d\'œuvre', 66, `Une hausse de ${pct(s, 0)} de la main-d'œuvre vous ferait perdre de l'argent`, `Le bénéfice net prévu de ${usd(net)} passerait à ${usd(after)}.`, 'simulation', -after));
            else out.push(force('sens-labor', 'Main-d\'œuvre', 30, `Votre bénéfice résiste à une hausse de ${pct(s, 0)} de la main-d'œuvre`, `Il passerait de ${usd(net)} à ${usd(after)}.`, 'simulation', net - after));
        }
        // 72 : l'intrant dont une hausse de 10 % coûte le plus
        const items = Object.values(c.analysis.purchasingReportData?.groupedByProvider || {}).flatMap(g => g.items);
        const top = [...items].sort((x, y) => y.totalCost - x.totalCost)[0];
        if (top && top.totalCost * T.sensitivityItemShock >= net * T.sensitivityItemNetShare) {
            out.push(weak('sens-item', 'Approvisionnement', 38, `${top.name} : +${pct(T.sensitivityItemShock, 0)} de prix coûterait ${usd(top.totalCost * T.sensitivityItemShock)}`, `L'intrant qui pèse le plus dans vos achats : ${pct(top.totalCost * T.sensitivityItemShock / net, 0)} de votre bénéfice net prévu.`, 'ingredients', top.totalCost * T.sensitivityItemShock));
        }
    }
    // 69 : bénéfice brut réel vs théorique
    if (c.hasRealData) {
        const gross = c.reconciliation.rows.find(r => r.label === 'Bénéfice brut');
        if (gross && gross.diffPercent != null) {
            if (gross.diffPercent <= -T.reconciliationNetGap) out.push(weak('rec-gross', 'Réel vs théorique', 62, `Bénéfice brut réel sous le modèle (${pct(gross.diffPercent)})`, `${usd(gross.real)} réels contre ${usd(gross.theoretical)} prévus.`, 'overview'));
            else if (gross.diffPercent >= T.reconciliationNetGap) out.push(force('rec-gross', 'Réel vs théorique', 48, `Bénéfice brut réel au-dessus du modèle (+${pct(gross.diffPercent)})`, `${usd(gross.real)} réels contre ${usd(gross.theoretical)} prévus.`, 'overview'));
        }
    }
    return out;
};

const moreChannelRules = (c) => {
    const rows = c.channelSummaries || [];
    const out = [];
    const revenue = sum(rows, r => r.revenueTotal);
    if (rows.length < 2 || !(revenue > 0)) return out;
    const avg = sum(rows, r => r.margeNetteTotal) / revenue;
    // 33 : forte marge, peu exploité
    const under = rows.filter(r => r.margeNettePercent >= avg + T.marginEdge && r.revenueTotal / revenue < T.underusedShare).sort((x, y) => y.margeNettePercent - x.margeNettePercent)[0];
    if (under) out.push(force('channel-underused', 'Canaux', 52, `${under.channelName} : forte marge, encore peu exploité`, `${pct(under.margeNettePercent)} de marge nette (moyenne : ${pct(avg)}) pour ${pct(under.revenueTotal / revenue, 0)} des revenus : un canal à développer.`, 'byChannel'));
    // 35 : grand écart de marge
    const sorted = [...rows].sort((x, y) => y.margeNettePercent - x.margeNettePercent);
    const gap = sorted[0].margeNettePercent - sorted[sorted.length - 1].margeNettePercent;
    if (gap >= T.channelMarginGap) out.push(weak('channel-gap', 'Canaux', 44, `Grand écart de marge entre vos canaux : ${pts(gap)}`, `De ${pct(sorted[sorted.length - 1].margeNettePercent)} (${sorted[sorted.length - 1].channelName}) à ${pct(sorted[0].margeNettePercent)} (${sorted[0].channelName}).`, 'byChannel'));
    // 36 : frais de mise en marché
    const heavy = rows.filter(r => r.costIndirectChannelTotal / r.revenueTotal >= T.channelFeesShare);
    if (heavy.length) out.push(weak('channel-fees', 'Canaux', 46, `Frais de mise en marché élevés : ${names(heavy.map(r => `${r.channelName} (${pct(r.costIndirectChannelTotal / r.revenueTotal, 0)})`))}`, 'Ces frais rattachés au canal (commissions, marketing, livraison) absorbent une grande part du prix de vente.', 'byChannel'));
    // 76 : produits rentables absents du canal le plus rentable
    const best = sorted[0];
    if (best.margeNettePercent > 0) {
        const missing = (c.analysis.activeProducts || []).filter(p => {
            const cbs = (p.channelBreakdown || []).filter(cb => P(cb.volume) > 0);
            const margin = netMarginOfRows([p]);
            return margin != null && margin > 0 && cbs.length > 0 && !cbs.some(cb => cb.channelId === best.channelId);
        });
        if (missing.length) out.push(weak('sku-missed-channel', 'Canaux', 41, `${missing.length} produit${missing.length > 1 ? 's' : ''} rentable${missing.length > 1 ? 's' : ''} absent${missing.length > 1 ? 's' : ''} de votre meilleur canal`, `${best.channelName} (${pct(best.margeNettePercent)} de marge nette) : ${names(missing.map(p => `« ${p.displayName} »`))}.`, 'portfolio'));
    }
    return out;
};

const moreActivityRules = (c) => {
    const rows = c.activitySummaries || [];
    const out = [];
    const revenue = sum(rows, r => r.revenueTotal);
    if (!(revenue > 0)) return out;
    for (const r of rows) {
        // 40 : couvre ses frais fixes avec marge ; 41 : sous son point mort
        if (r.breakEvenRevenue != null && r.margeNetteTotal >= 0 && r.revenueTotal >= r.breakEvenRevenue * T.activityCoverGood) {
            out.push(force(`activity-cover-${r.activityId}`, 'Activités', 38, `${r.activityName} couvre ses frais fixes avec marge`, `${usd(r.revenueTotal)} de revenus pour un point mort de ${usd(r.breakEvenRevenue)}.`, 'byActivity'));
        } else if (r.breakEvenRevenue != null && r.margeNetteTotal >= 0 && r.revenueTotal < r.breakEvenRevenue) {
            out.push(weak(`activity-below-${r.activityId}`, 'Activités', 60, `${r.activityName} est sous son point mort`, `${usd(r.revenueTotal)} de revenus pour un point mort de ${usd(r.breakEvenRevenue)}.`, 'byActivity'));
        }
    }
    if (rows.length >= 2) {
        const top = [...rows].sort((x, y) => y.revenueTotal - x.revenueTotal)[0];
        // 43 : une activité domine
        if (top.revenueTotal / revenue >= T.activityDominance) out.push(weak('activity-dominant', 'Activités', 47, `${top.activityName} : ${pct(top.revenueTotal / revenue, 0)} des revenus`, 'Une seule activité porte l\'entreprise : un recul y serait difficile à compenser.', 'byActivity'));
        // 44 : forte marge, peu de revenu
        const avg = sum(rows, r => r.margeNetteTotal) / revenue;
        const under = rows.filter(r => r.margeNettePercent >= avg + T.marginEdge && r.revenueTotal / revenue < T.underusedShare).sort((x, y) => y.margeNettePercent - x.margeNettePercent)[0];
        if (under) out.push(force('activity-underused', 'Activités', 43, `${under.activityName} : forte marge, encore peu exploitée`, `${pct(under.margeNettePercent)} de marge nette (moyenne : ${pct(avg)}) pour ${pct(under.revenueTotal / revenue, 0)} des revenus.`, 'byActivity'));
    }
    return out;
};

const moreProductRules = (c) => {
    const out = [];
    const m = c.analysis.menuEngineeringData || {};
    // 23 : dilemmes
    if ((m.questions || []).length > 0) out.push(weak('bcg-questions', 'Produits', 40, `${m.questions.length} dilemme${m.questions.length > 1 ? 's' : ''} : rentables, mais peu vendus`, `À promouvoir ou à abandonner : ${names(m.questions.map(s => `« ${s.displayName} »`))}.`, 'portfolio'));
    // 26 : profit bien réparti
    const contributions = (c.analysis.contributionData || []).filter(x => x.totalContribution > 0);
    const total = sum(contributions, x => x.totalContribution);
    if (contributions.length >= 5 && total > 0) {
        const top3 = sum(contributions.slice(0, 3), x => x.totalContribution) / total;
        if (top3 <= T.profitSpreadTop3) out.push(force('profit-spread', 'Produits', 38, `Profit bien réparti : les 3 premiers produits pèsent ${pct(top3, 0)}`, `Sur ${contributions.length} produits contributifs : aucun ne porte à lui seul l'entreprise.`, 'portfolio'));
    }
    // 27 : écart de marge entre formats d'un même produit
    const spread = computeFormatSpread(c.analysis.activeProducts);
    if (spread.length) {
        const worst = spread[0].l.reduce((a, b) => (b.margin < a.margin ? b : a)), best = spread[0].l.reduce((a, b) => (b.margin > a.margin ? b : a));
        out.push(weak('format-gap', 'Produits', 43, `${spread.length} produit${spread.length > 1 ? 's' : ''} aux marges très différentes selon le format`, `Le plus marqué : « ${best.name} » à ${pct(best.margin)} contre « ${worst.name} » à ${pct(worst.margin)}.`, 'bySku'));
    }
    // 29 : une sous-recette pèse lourd dans le coût matière d'un plat
    const catalogue = new Map((c.baseIngredients || []).map(i => [i.id, i]));
    const heavy = [];
    for (const p of c.analysis.activeProducts || []) {
        let all = 0, sub = 0, subName = null, subCost = 0;
        for (const item of p.format?.ingredients || []) {
            const cat = catalogue.get(item.id);
            if (!cat) continue;
            const cost = P(item.quantity) * unitConversionFactor(item.recipeUnit || cat.unit, cat.unit) * P(cat.unitPrice);
            all += cost;
            if (cat.isRecipe) { sub += cost; if (cost > subCost) { subCost = cost; subName = cat.name; } }
        }
        if (all > 0 && sub / all >= T.subRecipeShare) heavy.push({ name: p.displayName, share: sub / all, subName });
    }
    if (heavy.length) {
        const top = heavy.sort((x, y) => y.share - x.share)[0];
        out.push(weak('subrecipe-weight', 'Produits', 36, `${heavy.length} plat${heavy.length > 1 ? 's' : ''} dont une sous-recette pèse plus de ${pct(T.subRecipeShare, 0)} du coût matière`, `Le plus marqué : « ${top.name} », ${pct(top.share, 0)} (${top.subName}). Une économie sur cette sous-recette se répercute sur tout le plat.`, 'bySku'));
    }
    // 75 : revenus de produits de revente
    const rev = sum(c.productRows, r => r.revenue || 0);
    const resale = sum(c.productRows.filter(r => r.isResale), r => r.revenue || 0);
    if (rev > 0 && resale / rev >= T.resaleShare) out.push(weak('resale-share', 'Produits', 49, `${pct(resale / rev, 0)} des revenus viennent de produits de revente`, 'Un produit de revente ajoute peu de valeur à un transformateur : sa marge dépend de votre prix d\'achat.', 'portfolio'));
    // 78 : écart entre temps consommé et profit
    const made = c.productRows.filter(r => !r.isResale && r.hours > 0);
    const hours = sum(made, r => r.hours), profit = sum(made, r => r.grossProfit);
    if (made.length >= 3 && hours > 0 && profit > 0) {
        const hog = made.map(r => ({ r, hs: r.hours / hours, ps: r.grossProfit / profit })).filter(x => x.hs >= T.hourHogShare && x.ps <= x.hs / 2).sort((x, y) => y.hs - x.hs)[0];
        if (hog) out.push(weak('hours-vs-profit', 'Main-d\'œuvre', 51, `« ${hog.r.name} » : ${pct(hog.hs, 0)} des heures, ${pct(hog.ps, 0)} du bénéfice brut`, 'Un produit qui occupe beaucoup de temps pour peu de profit : à repenser (prix, recette, processus).', 'labor'));
    }
    return out;
};

// Effet en dollars des variations de prix récentes des ingrédients, aux volumes prévus : pour chaque ingrédient acheté, l'écart entre son coût
// d'achat actuel et ce qu'il aurait coûté au prix du début de la période récente (tendance en %). Négatif : économie. Null sans historique suffisant.
// Exposé (phase 1 de la refonte de l'export PDF) pour que le constat et le rapport lisent le même chiffre.
export function computeIngredientPriceEffect(purchasingReportData, recentVolatility) {
    if (!recentVolatility?.hasEnoughData) return null;
    const used = Object.values(purchasingReportData?.groupedByProvider || {}).flatMap(g => g.items);
    let effect = 0, base = 0;
    for (const item of used) {
        const v = recentVolatility.byName[item.name];
        base += item.purchaseCost;
        if (v && v.count >= 2 && v.trendPercent > -100) effect += item.purchaseCost - item.purchaseCost / (1 + v.trendPercent / 100);
    }
    return { effect, base, share: base > 0 ? effect / base : null, pointCount: recentVolatility.pointCount };
}

const moreSupplyRules = (c) => {
    const out = [];
    // 46 : fournisseurs bien répartis
    const shares = c.ingredientShares.rows;
    if (shares.length >= 3 && !shares[0].isDependent) out.push(force('supplier-spread', 'Approvisionnement', 36, `Achats d'ingrédients bien répartis entre ${shares.length} fournisseurs`, `Le premier fournisseur ne pèse que ${pct(shares[0].share, 0)} des achats.`, 'ingredients'));
    // 53 : peu d'intrants pèsent lourd
    const abc = c.analysis.abcAnalysisData;
    const ranked = abc ? [...abc.A, ...abc.B, ...abc.C] : [];
    if (ranked.length >= 8) {
        const top5 = sum(ranked.slice(0, 5), i => i.percent) / 100;
        if (top5 >= T.top5Inputs) out.push(weak('inputs-top5', 'Approvisionnement', 39, `Cinq ingrédients pèsent ${pct(top5, 0)} de vos achats`, `Sur ${ranked.length} ingrédients : surveillez en priorité ${names(ranked.slice(0, 5).map(i => i.name), 5)}.`, 'ingredients'));
    }
    // 77 : un autre fournisseur offre un meilleur prix efficace (perte incluse)
    const effective = (i) => P(i.unitPrice) / (1 - Math.min(P(i.lossPercentage) / 100, 0.9));
    const used = Object.values(c.analysis.purchasingReportData?.groupedByProvider || {}).flatMap(g => g.items);
    const savings = [];
    for (const item of used) {
        const alts = (c.baseIngredients || []).filter(i => i.id !== item.id && !i.isRecipe && i.unit === item.unit && (i.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase() && P(i.unitPrice) > 0);
        const best = alts.sort((x, y) => effective(x) - effective(y))[0];
        if (best && effective(best) < effective(item) * (1 - T.altSupplierGap)) savings.push({ name: item.name, provider: best.provider, saving: (effective(item) - effective(best)) * item.totalQuantity, pct: 1 - effective(best) / effective(item) });
    }
    if (savings.length) {
        const top = savings.sort((x, y) => y.saving - x.saving)[0];
        out.push(weak('supplier-cheaper', 'Approvisionnement', 47, `${savings.length} ingrédient${savings.length > 1 ? 's' : ''} moins cher${savings.length > 1 ? 's' : ''} chez un autre fournisseur`, `Le plus marqué : ${top.name} chez ${top.provider}, ${pct(top.pct, 0)} de moins (perte incluse), soit ${usd(top.saving)} sur vos volumes prévus.`, 'ingredients', top.saving));
    }
    // 55 : effet en dollars des variations de prix récentes, aux volumes actuels (calcul partagé avec le rapport PDF : computeIngredientPriceEffect)
    const pe = computeIngredientPriceEffect(c.analysis.purchasingReportData, c.ingredientVolatilityRecent);
    if (pe && pe.base > 0 && Math.abs(pe.effect) / pe.base >= T.priceEffectShare) {
        const { effect, base, pointCount } = pe;
        if (effect > 0) out.push(weak('history-price-effect', 'Évolution', 57, `Les hausses de prix ajoutent ${usd(effect)} à vos achats d'ingrédients`, `Aux volumes prévus, sur les ${pointCount} derniers relevés (${pct(effect / base)} des achats).`, 'ingredients', effect));
        else out.push(force('history-price-effect', 'Évolution', 45, `Les baisses de prix font économiser ${usd(-effect)} sur vos achats d'ingrédients`, `Aux volumes prévus, sur les ${pointCount} derniers relevés (${pct(-effect / base)} des achats).`, 'ingredients', -effect));
    }
    // 79 : concentration des frais fixes
    const lines = (c.expenseLines || []).map(l => ({ label: l.label, amount: P(l.amount) })).filter(l => l.amount > 0).sort((x, y) => y.amount - x.amount);
    const totalFixed = sum(lines, l => l.amount);
    if (lines.length >= 5 && totalFixed > 0) {
        const top3 = sum(lines.slice(0, 3), l => l.amount) / totalFixed;
        if (top3 >= T.fixedTop3) out.push(weak('fixed-concentration', 'Coûts', 34, `Trois lignes de frais fixes pèsent ${pct(top3, 0)} du total`, `${names(lines.slice(0, 3).map(l => l.label), 3)} : ${usd(sum(lines.slice(0, 3), l => l.amount))} sur ${usd(totalFixed)}.`, 'overview'));
    }
    return out;
};

const moreLaborRules = (c) => {
    const out = [];
    const posts = (c.info.productivityReport?.rows || []).filter(r => r.actual > 0 && r.expected > 0);
    // 57 : poste sous-utilisé
    const low = posts.filter(r => r.utilization / 100 < T.postUnderUsed).sort((x, y) => x.utilization - y.utilization);
    if (low.length) out.push(weak('post-underused', 'Main-d\'œuvre', 48, `${low.length} poste${low.length > 1 ? 's' : ''} utilisé${low.length > 1 ? 's' : ''} à moins de ${pct(T.postUnderUsed, 0)}`, `Le plus bas : ${low[0].postName}, ${formatNumber(low[0].utilization, 0)} % d'utilisation.`, 'labor'));
    // 65 : poste surchargé
    const over = posts.filter(r => r.utilization > 100).sort((x, y) => y.utilization - x.utilization);
    if (over.length) out.push(weak('post-overloaded', 'Main-d\'œuvre', 56, `${over.length} poste${over.length > 1 ? 's' : ''} surchargé${over.length > 1 ? 's' : ''} (plus de 100 %)`, `Le plus chargé : ${over[0].postName}, ${formatNumber(over[0].utilization, 0)} % : la capacité réelle est dépassée.`, 'labor'));
    // 60 : coût réel d'une heure productive vs taux moyen
    const cas = c.cascade;
    if (cas.effectiveHourlyCost != null && cas.averageLoadedRate > 0 && cas.effectiveHourlyCost / cas.averageLoadedRate >= T.hourCostGap) {
        out.push(weak('hour-cost-gap', 'Main-d\'œuvre', 53, `Une heure productive coûte ${usd(cas.effectiveHourlyCost, 2)}, pour un taux moyen de ${usd(cas.averageLoadedRate, 2)}`, 'Les heures payées mais non productives (attente, ménage, pauses) s\'ajoutent au coût de chaque heure réellement utilisée.', 'labor'));
    }
    // 63 : activité la plus rentable par heure
    const byAct = Object.fromEntries((c.info.productivityReport?.byActivity || []).map(r => [r.activityId, r.actual]));
    const ratios = computeActivityLaborRatios(c.analysis.activeProducts || [], byAct, c.productionActivities || []).filter(r => r.grossProfitPerHour != null && r.hours > 0);
    if (ratios.length >= 2) {
        const sorted = [...ratios].sort((x, y) => y.grossProfitPerHour - x.grossProfitPerHour);
        out.push(force('activity-best-hour', 'Main-d\'œuvre', 46, `${sorted[0].activityName} : l'activité la plus rentable à l'heure`, `${usd(sorted[0].grossProfitPerHour)} de bénéfice brut par heure, contre ${usd(sorted[sorted.length - 1].grossProfitPerHour)} pour ${sorted[sorted.length - 1].activityName}.`, 'byActivity'));
    }
    return out;
};

// ---------- hiérarchie : dans quel ordre présenter les constats ----------
// Deux niveaux, décidés avec l'utilisateur (21/11) :
//   1. la GRAVITÉ de la décision (niveau 1 à 4) : 1 survie (point mort, bénéfice négatif, pertes) ; 2 moteurs de profit (marges, coûts vs cibles, produits,
//      canaux, évolution des marges) ; 3 efficacité (main-d'œuvre, fournisseurs, activités, pertes) ; 4 information (stabilité, répartition, confort) ;
//   2. à l'intérieur d'un niveau, l'IMPACT en $ rapporté aux ventes (1 % des ventes = 10 points, plafonné à 100) quand la règle le connaît ; sinon son poids.
// Les forces suivent le même classement : ce qui compte le plus à protéger passe en premier.
const TIER_RULES = [
    [/^(safety|net-theoretical|fixed-cover|channel-deficit-|activity-deficit-|activity-below-|sku-negative-everywhere|rec-net|sens-inputs|sens-labor)/, 1],
    [/^(stable-a|loss-low|post-used|sens-item|inputs-top5|fixed-concentration|bcg-stars|activity-cover-|activity-best-hour|channel-best)/, 4],
];
const THEME_TIER = { 'Rentabilité': 2, 'Coûts': 2, 'Produits': 2, 'Canaux': 2, 'Évolution': 2, 'Réel vs théorique': 2, 'Activités': 3, 'Approvisionnement': 3, 'Main-d\'œuvre': 3 };
export const tierOf = (f) => {
    // Sensibilité (décision du 22/11) : un bénéfice qui RÉSISTE au choc n'est pas une question de survie ; la gravité suit l'ampleur de la perte simulée.
    if (/^sens-(inputs|labor)$/.test(f.id) && f.tone === 'force') return 3;
    for (const [re, tier] of TIER_RULES) if (re.test(f.id)) return tier;
    return THEME_TIER[f.theme] || 3;
};
// Montants en $ des constats dont l'impact se lit directement dans les données (les autres règles portent leur propre `impact`).
const IMPACTS = {
    'safety': (c) => { const sm = computeSafetyMargin(c.analysis.menuRevenue, c.analysis.globalBreakEven); return sm ? Math.abs(sm.surplus) : null; },
    'net-theoretical': (c) => Math.abs(c.reconciliation.rows.find(r => r.label === 'Bénéfice net')?.theoretical ?? NaN),
    'labor-unused': (c) => c.cascade.unusedPay,
    'loss-high': (c) => c.analysis.purchasingReportData?.grandTotal?.loss,
    'rec-net': (c) => Math.abs(c.reconciliation.rows.find(r => r.label === 'Bénéfice net')?.diff ?? NaN),
    'rec-direct': (c) => Math.abs(c.reconciliation.rows.find(r => r.label === 'Charges directes')?.diff ?? NaN),
    'rec-gross': (c) => Math.abs(c.reconciliation.rows.find(r => r.label === 'Bénéfice brut')?.diff ?? NaN),
    'channel-deficit-': (c, id) => { const r = c.channelSummaries.find(x => id === 'channel-deficit-' + x.channelId); return r ? Math.abs(r.margeNetteTotal) : null; },
    'activity-deficit-': (c, id) => { const r = c.activitySummaries.find(x => id === 'activity-deficit-' + x.activityId); return r ? Math.abs(r.margeNetteTotal) : null; },
};
const impactOf = (c, f) => {
    if (f.impact != null) return f.impact;
    const key = Object.keys(IMPACTS).find(k => (k.endsWith('-') ? f.id.startsWith(k) : f.id === k));
    if (!key) return null;
    try { const v = IMPACTS[key](c, f.id); return Number.isFinite(v) ? v : null; } catch { return null; }
};
export const rankOf = (f, revenue) => (5 - tierOf(f)) * 1000 + (f.impact != null && revenue > 0 ? Math.min(100, (f.impact / revenue) * 1000) : f.weight);

export const FINDING_RULES = [
    safetyRule, netProfitRule, costTargetRules, objectiveRules, productRules, channelRules, activityRules, supplyRules, laborRules, reconciliationRules,
    evolutionRules, trendRules,
    economicsRules, moreChannelRules, moreActivityRules, moreProductRules, moreSupplyRules, moreLaborRules,
];

// Sujet d'un constat par entité déjà existant (canal, activité) : déduit de son identifiant, sans modifier les règles.
const subjectOf = (f, ctx) => {
    if (f.subject) return f.subject;
    let m = /^channel-deficit-(.+)$/.exec(f.id);
    if (m) return subject('canal', m[1], ctx.channelNames?.[m[1]] || m[1]);
    m = /^activity-(?:deficit|low|below|cover)-(.+)$/.exec(f.id);
    if (m) return subject('activité', m[1], (ctx.productionActivities || []).find(x => String(x.id) === m[1])?.name || m[1]);
    return null;
};

// Tous les constats applicables, du plus important au moins important (à poids égal, ordre stable par identifiant).
// Chaque constat porte aussi son classement à deux axes : `scope` (general | specific), `subjectType`, `subject` (le sujet d'un constat par entité, sinon null),
// `form` (entity | aggregate) et `severity` (major | medium | minor).
// `options.entities` : ajoute les constats PAR ENTITÉ (entityFindings.js et tendances par format) ; faux par défaut, pour que les écrans existants gardent leur contenu.
export function computeKeyFindings(ctx, { entities = false } = {}) {
    const all = [];
    const context = entities ? { ...ctx, includeEntities: true } : ctx;
    for (const rule of entities ? [...FINDING_RULES, ...ENTITY_RULES] : FINDING_RULES) {
        try { all.push(...rule(context)); } catch { /* une règle qui échoue (donnée inattendue) se tait : un constat n'est jamais inventé */ }
    }
    const byId = new Map();
    for (const f of all) if (!byId.has(f.id)) byId.set(f.id, f);
    const revenue = ctx.analysis?.menuRevenue || sum((ctx.channelSummaries || []), r => r.revenueTotal);
    const sorted = [...byId.values()].map(f => {
        const g = { ...f, group: groupOf(f.id), impact: impactOf(ctx, f) };
        const tier = tierOf(g);
        const meta = classifyFinding(f.id) || { scope: 'specific', subjectType: null };
        const sub = subjectOf(f, ctx);
        return { ...g, tier, rank: rankOf(g, revenue), scope: meta.scope, subjectType: meta.subjectType, subject: sub, form: sub ? 'entity' : 'aggregate', severity: severityOf({ ...g, scope: meta.scope }, revenue, tier) };
    }).sort((x, y) => y.rank - x.rank || x.id.localeCompare(y.id));
    const split = (list) => ({ forces: list.filter(f => f.tone === 'force'), faiblesses: list.filter(f => f.tone === 'faiblesse'), all: list });
    const groups = Object.fromEntries(FINDING_GROUPS.map(g => [g.id, split(sorted.filter(f => f.group === g.id))]));
    return { ...split(sorted), groups };
}

// Pour l'affichage : combien de constats par colonne avant la fenêtre « Voir tous les constats ».
export const VISIBLE_FINDINGS_PER_COLUMN = 5;
// TEST : nombre de lignes visibles par groupe (le reste est dans la fenêtre « Voir tout »).
export const VISIBLE_FINDINGS_PER_GROUP = 3;
