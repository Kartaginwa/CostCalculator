// Objectifs stratégiques (24/11) : le catalogue des objectifs de l'entrepreneur et leur évaluation, sans aucun nouveau calcul de donnée.
// Un objectif compare un INDICATEUR que l'application affiche déjà (marge brute, taux d'utilisation, perte stock…) à une valeur choisie par l'utilisateur,
// dans un sens (« au plus » ou « au moins »). Deux familles :
//   - les objectifs PAR DÉFAUT (neuf) : leur sens est fixe (un coût « au plus », une marge « au moins »), leur valeur vit dans les informations générales
//     (generalInfo, champs *Target), saisie dans Paramètres (les quatre principales) ou dans la fenêtre « Gérer les objectifs » (les autres) ;
//   - les objectifs SUR MESURE (20 au plus) : un indicateur du catalogue, un sens au choix, une valeur (generalInfo.customObjectives).
// Un objectif sur mesure peut aussi viser UNE ENTITÉ précise (un ingrédient, un emballage, un fournisseur, un poste, un format, un canal, une activité) : l'indicateur
// porte alors une `entity` et la valeur se lit pour le sujet choisi (`subject`). Là encore, des valeurs déjà calculées par l'application, jamais un nouveau calcul.
// Un objectif peut être désactivé sans être supprimé (generalInfo.objectivesOff : liste d'identifiants). Sans valeur ou sans donnée, un objectif est muet :
// une donnée absente reste absente. Pas de formule libre : seuls les indicateurs du catalogue sont mesurables.
import { parseLocaleNumber as P, formatCurrency, formatNumber } from '../utils.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';
import { computeSafetyMargin } from './laborReport.js';
import { activeRows, netMarginOfRows } from './findingKit.js';

export const MAX_CUSTOM_OBJECTIVES = 20;

const finite = (v) => (Number.isFinite(v) ? v : null);
const ratio = (num, den) => (den > 0 ? num / den : null);

/**
 * Catalogue des indicateurs. `value(ctx)` renvoie la valeur dans l'unité de l'indicateur (pourcentage en points : 34,5 pour 34,5 %), ou null sans donnée.
 * `dir` : sens naturel (max = « au plus », min = « au moins ») ; `theme` et `subTab` servent aux constats (thème de la fenêtre « Voir tout », lien).
 */
export const INDICATORS = {
    matiere: { label: 'Coût matière', unit: '%', dir: 'max', theme: 'Coûts', subTab: 'ingredients', value: (c) => finite(c.analysis.weightedMaterialCost * 100) },
    emballage: { label: 'Coût d\'emballage', unit: '%', dir: 'max', theme: 'Coûts', subTab: 'packaging', value: (c) => finite(c.analysis.weightedPackagingCost * 100) },
    mo: { label: 'Coût de main-d\'œuvre', unit: '%', dir: 'max', theme: 'Coûts', subTab: 'labor', value: (c) => finite(c.analysis.weightedLaborCost * 100) },
    margeBrute: { label: 'Marge brute', unit: '%', dir: 'min', theme: 'Rentabilité', subTab: 'overview', value: (c) => finite(c.analysis.weightedGrossMargin * 100) },
    margeNette: {
        label: 'Marge nette', unit: '%', dir: 'min', theme: 'Rentabilité', subTab: 'overview',
        // Bénéfice net prévu ÷ ventes prévues : le chiffre cité par le constat « Bénéfice net prévu ».
        value: (c) => { const net = c.reconciliation?.rows?.find(r => r.label === 'Bénéfice net')?.theoretical; return finite(ratio(net, c.analysis.menuRevenue) * 100); },
    },
    utilisation: {
        label: 'Taux d\'utilisation des postes', unit: '%', dir: 'min', theme: 'Main-d\'œuvre', subTab: 'labor',
        // La ligne Total du tableau « Taux d'Utilisation (%) » de Main-d'œuvre : heures réelles ÷ heures attendues des postes de production.
        value: (c) => { const t = c.info?.productivityReport?.totals; return t && t.expected > 0 ? finite(t.utilization) : null; },
    },
    paieNonUtilisee: {
        label: 'Paie non utilisée', unit: '%', dir: 'max', theme: 'Main-d\'œuvre', subTab: 'labor',
        // La carte « Utilisation de la masse salariale » de Main-d'œuvre : la part de la paie versée sans produire.
        value: (c) => (c.cascade?.payroll > 0 ? finite(c.cascade.unusedShare * 100) : null),
    },
    perteStock: {
        label: 'Perte stock', unit: '%', dir: 'max', theme: 'Approvisionnement', subTab: 'ingredients',
        value: (c) => { const g = c.analysis.purchasingReportData?.grandTotal; return g ? finite(ratio(g.loss, g.total) * 100) : null; },
    },
    fraisFixes: {
        label: 'Frais fixes', unit: '%', dir: 'max', theme: 'Coûts', subTab: 'overview',
        // Frais fixes répartis ÷ revenus prévus, comme le constat « Les frais fixes pèsent … des revenus ».
        value: (c) => {
            const rows = c.channelSummaries || [];
            const revenue = rows.reduce((s, r) => s + r.revenueTotal, 0);
            return rows.length ? finite(ratio(rows.reduce((s, r) => s + r.totalIndirectTotal, 0), revenue) * 100) : null;
        },
    },
    // Réservés aux objectifs sur mesure
    margeSecurite: { label: 'Marge de sécurité', unit: '%', dir: 'min', theme: 'Rentabilité', subTab: 'overview', custom: true, value: (c) => { const sm = computeSafetyMargin(c.analysis.menuRevenue, c.analysis.globalBreakEven); return sm ? finite(sm.ratio * 100) : null; } },
    pointMort: { label: 'Point mort', unit: '$', dir: 'max', theme: 'Rentabilité', subTab: 'overview', custom: true, value: (c) => (c.analysis.globalBreakEven > 0 ? finite(c.analysis.globalBreakEven) : null) },
    revenus: { label: 'Revenus prévus', unit: '$', dir: 'min', theme: 'Rentabilité', subTab: 'overview', custom: true, value: (c) => (c.analysis.menuRevenue > 0 ? finite(c.analysis.menuRevenue) : null) },
    partFournisseur: { label: 'Part du premier fournisseur', unit: '%', dir: 'max', theme: 'Approvisionnement', subTab: 'ingredients', custom: true, value: (c) => { const top = c.ingredientShares?.rows?.[0]; return top ? finite(top.share * 100) : null; } },
    partCanal: {
        label: 'Part du premier canal', unit: '%', dir: 'max', theme: 'Canaux', subTab: 'byChannel', custom: true,
        value: (c) => { const rows = c.channelSummaries || []; const revenue = rows.reduce((s, r) => s + r.revenueTotal, 0); return rows.length >= 2 && revenue > 0 ? finite(Math.max(...rows.map(r => r.revenueTotal)) / revenue * 100) : null; },
    },
    margeProduitMin: {
        label: 'Marge nette du produit le moins rentable', unit: '%', dir: 'min', theme: 'Produits', subTab: 'portfolio', custom: true,
        value: (c) => { const m = activeRows(c.analysis.activeProducts).map(p => netMarginOfRows([p])).filter(v => v != null); return m.length ? finite(Math.min(...m) * 100) : null; },
    },
};
// ---------- nouveaux indicateurs (24/11) ----------
const sumOf = (list, f) => list.reduce((x, r) => x + f(r), 0);
const idKey = (v) => String(v);
// Lignes d'un rapport d'achats (ingrédients ou emballages) : { id, label, item }, triées par nom.
const reportItems = (report) => Object.values(report?.groupedByProvider || {}).flatMap(g => g.items)
    .map(i => ({ id: idKey(i.id ?? i.name), label: i.name, item: i })).sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'));
const reportItem = (report, id) => reportItems(report).find(x => x.id === idKey(id))?.item || null;
const purchaseShare = (report, id) => { const i = reportItem(report, id); return i && report.totalNetCost > 0 ? finite(i.purchaseCost / report.totalNetCost * 100) : null; };
const volatilityOf = (vol, id) => (vol?.hasEnoughData ? finite(vol.byId?.[id]?.amplitudePercent ?? null) : null);
const blendOf = (p) => p.blended || p.costs || null;
const formatRow = (c, id) => (c.analysis.activeProducts || []).find(p => idKey(p.id) === idKey(id)) || null;
const channelRow = (c, id) => (c.channelSummaries || []).find(r => idKey(r.channelId) === idKey(id)) || null;
const activityRow = (c, id) => (c.activitySummaries || []).find(r => idKey(r.activityId) === idKey(id)) || null;
const postRow = (c, id) => (c.info?.productivityReport?.rows || []).find(r => r.postName === id && r.actual > 0 && r.expected > 0) || null;
const cascadePost = (c, id) => (c.cascade?.posts || []).find(x => x.postName === id) || null;
const contribution = (c) => (c.analysis.contributionData || []).filter(x => x.totalContribution > 0);
const reconRow = (c, label) => (c.hasRealData ? c.reconciliation?.rows?.find(r => r.label === label) : null) || null;
const shareRow = (shares, provider) => (shares?.rows || []).find(r => r.provider === provider) || null;
const pctOf = (v) => (v == null || !Number.isFinite(v) ? null : v * 100);
const blendPct = (field) => (c, id) => { const p = formatRow(c, id); const b = p && blendOf(p); return b && Number.isFinite(b[field]) ? finite(b[field] * 100) : null; };
const itemValue = (reportKey, field) => (c, id) => { const i = reportItem(c.analysis[reportKey], id); return i ? finite(i[field]) : null; };
const postValue = (f) => (c, id) => { const p = cascadePost(c, id); return p ? finite(f(p)) : null; };

/** Sujets possibles d'un indicateur « par entité » : { id, label }. Les listes viennent des rapports de l'application (seuls les éléments réellement présents). */
export const ENTITY_KINDS = {
    ingredient: { label: 'un ingrédient', list: (c) => reportItems(c.analysis.purchasingReportData).map(({ id, label }) => ({ id, label })) },
    emballage: { label: 'un emballage', list: (c) => reportItems(c.analysis.packagingPurchasingReportData).map(({ id, label }) => ({ id, label })) },
    fournisseurIng: { label: 'un fournisseur d\'ingrédients', list: (c) => (c.ingredientShares?.rows || []).map(r => ({ id: r.provider, label: r.provider })) },
    fournisseurEmb: { label: 'un fournisseur d\'emballages', list: (c) => (c.packagingShares?.rows || []).map(r => ({ id: r.provider, label: r.provider })) },
    poste: { label: 'un poste de production', list: (c) => (c.cascade?.posts || []).map(p => ({ id: p.postName, label: p.postName })) },
    format: { label: 'un format (SKU)', list: (c) => (c.analysis.activeProducts || []).map(p => ({ id: idKey(p.id), label: p.displayName })) },
    canal: { label: 'un canal', list: (c) => (c.channelSummaries || []).map(r => ({ id: idKey(r.channelId), label: r.channelName })) },
    activite: { label: 'une activité', list: (c) => (c.activitySummaries || []).map(r => ({ id: idKey(r.activityId), label: r.activityName })) },
};

const I = (label, unit, dir, theme, subTab, value, extra) => ({ label, unit, dir, theme, subTab, custom: true, value, ...extra });
const E = (entity, label, unit, dir, theme, subTab, value, extra) => I(label, unit, dir, theme, subTab, value, { entity, ...extra });

Object.assign(INDICATORS, {
    // Entreprise : valeurs reprises des tuiles, des rapports et des constats
    beneficeNet: I('Bénéfice net prévu', '$', 'min', 'Rentabilité', 'overview', (c) => { const v = c.reconciliation?.rows?.find(r => r.label === 'Bénéfice net')?.theoretical; return Number.isFinite(v) && c.analysis.menuRevenue > 0 ? v : null; }),
    fixedCover: I('Couverture des frais fixes', 'fois', 'min', 'Rentabilité', 'overview', (c) => {
        const rows = c.channelSummaries || [];
        const fixed = sumOf(rows, r => r.totalIndirectTotal + r.costLaborTotal);
        return rows.length && fixed > 0 ? finite(sumOf(rows, r => r.margeBruteTotal + r.costLaborTotal - r.costAgingTotal) / fixed) : null;
    }),
    ecartRevenus: I('Écart entre revenus réels et prévus', '%', 'max', 'Réel vs théorique', 'overview', (c) => { const r = reconRow(c, 'Revenus'); return r && r.diffPercent != null ? finite(Math.abs(r.diffPercent) * 100) : null; }),
    produitsDeficitaires: I('Produits déficitaires dans au moins un canal', 'n', 'max', 'Produits', 'portfolio', (c) => {
        const rows = (c.analysis.activeProducts || []).map(p => (p.channelBreakdown || []).filter(cb => Number.isFinite(cb.margeNettePercent))).filter(m => m.length > 0);
        return rows.length ? rows.filter(m => m.some(cb => cb.margeNettePercent < 0)).length : null;
    }, { allowZero: true }),
    partPremierProduit: I('Part du premier produit dans le profit', '%', 'max', 'Produits', 'portfolio', (c) => { const l = contribution(c), t = sumOf(l, x => x.totalContribution); return l.length >= 2 && t > 0 ? finite(l[0].totalContribution / t * 100) : null; }),
    margeCanalMin: I('Marge nette du canal le moins rentable', '%', 'min', 'Canaux', 'byChannel', (c) => { const r = c.channelSummaries || []; return r.length >= 2 ? pctOf(Math.min(...r.map(x => x.margeNettePercent))) : null; }),
    posteMoinsUtilise: I('Taux d\'utilisation du poste le moins utilisé', '%', 'min', 'Main-d\'œuvre', 'labor', (c) => { const r = (c.info?.productivityReport?.rows || []).filter(x => x.actual > 0 && x.expected > 0); return r.length >= 2 ? finite(Math.min(...r.map(x => x.utilization))) : null; }),

    // Un ingrédient
    ingPart: E('ingredient', 'Part dans les achats d\'ingrédients', '%', 'max', 'Approvisionnement', 'ingredients', (c, id) => purchaseShare(c.analysis.purchasingReportData, id)),
    ingDepense: E('ingredient', 'Achats prévus', '$', 'max', 'Approvisionnement', 'ingredients', itemValue('purchasingReportData', 'purchaseCost')),
    ingPerte: E('ingredient', 'Perte stock prévue', '$', 'max', 'Approvisionnement', 'ingredients', itemValue('purchasingReportData', 'lossCost')),
    ingVolatilite: E('ingredient', 'Amplitude du prix', '%', 'max', 'Approvisionnement', 'ingredients', (c, id) => volatilityOf(c.ingredientVolatility, id)),
    // Un emballage
    pkgPart: E('emballage', 'Part dans les achats d\'emballages', '%', 'max', 'Approvisionnement', 'packaging', (c, id) => purchaseShare(c.analysis.packagingPurchasingReportData, id)),
    pkgDepense: E('emballage', 'Achats prévus', '$', 'max', 'Approvisionnement', 'packaging', itemValue('packagingPurchasingReportData', 'purchaseCost')),
    pkgPerte: E('emballage', 'Perte stock prévue', '$', 'max', 'Approvisionnement', 'packaging', itemValue('packagingPurchasingReportData', 'lossCost')),
    pkgVolatilite: E('emballage', 'Amplitude du prix', '%', 'max', 'Approvisionnement', 'packaging', (c, id) => volatilityOf(c.packagingVolatility, id)),
    // Un fournisseur
    fournIngPart: E('fournisseurIng', 'Part des achats d\'ingrédients', '%', 'max', 'Approvisionnement', 'ingredients', (c, id) => pctOf(shareRow(c.ingredientShares, id)?.share)),
    fournEmbPart: E('fournisseurEmb', 'Part des achats d\'emballages', '%', 'max', 'Approvisionnement', 'packaging', (c, id) => pctOf(shareRow(c.packagingShares, id)?.share)),
    // Un poste de production
    posteUtilisation: E('poste', 'Taux d\'utilisation', '%', 'min', 'Main-d\'œuvre', 'labor', (c, id) => { const r = postRow(c, id); return r ? finite(r.utilization) : null; }),
    posteCoutHoraire: E('poste', 'Coût horaire chargé', '$', 'max', 'Main-d\'œuvre', 'labor', postValue(p => p.hourlyRate)),
    posteMasse: E('poste', 'Masse salariale du poste', '$', 'max', 'Main-d\'œuvre', 'labor', postValue(p => p.payroll)),
    posteInutilise: E('poste', 'Paie non utilisée du poste', '$', 'max', 'Main-d\'œuvre', 'labor', postValue(p => p.unusedPay)),
    posteInutilisePart: E('poste', 'Part de la paie non utilisée', '%', 'max', 'Main-d\'œuvre', 'labor', postValue(p => (p.payroll > 0 ? p.unusedPay / p.payroll * 100 : null))),
    // Un format (SKU)
    fmtMargeBrute: E('format', 'Marge brute', '%', 'min', 'Produits', 'bySku', blendPct('margeBrutePercent')),
    fmtMargeNette: E('format', 'Marge nette', '%', 'min', 'Produits', 'bySku', (c, id) => { const p = formatRow(c, id); return p ? pctOf(netMarginOfRows([p])) : null; }),
    fmtMatiere: E('format', 'Coût matière', '%', 'max', 'Coûts', 'bySku', blendPct('costMatierePercent')),
    fmtEmballage: E('format', 'Coût d\'emballage', '%', 'max', 'Coûts', 'bySku', blendPct('costPackagingPercent')),
    fmtMo: E('format', 'Coût de main-d\'œuvre', '%', 'max', 'Coûts', 'bySku', blendPct('costLaborPercent')),
    fmtBeneficeHeure: E('format', 'Bénéfice brut par heure de main-d\'œuvre', '$', 'min', 'Main-d\'œuvre', 'labor', (c, id) => { const r = (c.productRows || []).find(x => idKey(x.id) === idKey(id)); return r && r.grossProfitPerHour != null ? finite(r.grossProfitPerHour) : null; }),
    // Un canal
    canalMargeBrute: E('canal', 'Marge brute', '%', 'min', 'Canaux', 'byChannel', (c, id) => pctOf(channelRow(c, id)?.margeBrutePercent)),
    canalMargeNette: E('canal', 'Marge nette', '%', 'min', 'Canaux', 'byChannel', (c, id) => pctOf(channelRow(c, id)?.margeNettePercent)),
    canalPart: E('canal', 'Part des revenus prévus', '%', 'max', 'Canaux', 'byChannel', (c, id) => { const r = channelRow(c, id); const t = sumOf(c.channelSummaries || [], x => x.revenueTotal); return r && t > 0 ? finite(r.revenueTotal / t * 100) : null; }),
    // Une activité
    actMargeBrute: E('activite', 'Marge brute', '%', 'min', 'Activités', 'byActivity', (c, id) => pctOf(activityRow(c, id)?.margeBrutePercent)),
    actMargeNette: E('activite', 'Marge nette', '%', 'min', 'Activités', 'byActivity', (c, id) => pctOf(activityRow(c, id)?.margeNettePercent)),
    actPart: E('activite', 'Part des revenus prévus', '%', 'max', 'Activités', 'byActivity', (c, id) => { const r = activityRow(c, id); const t = sumOf(c.activitySummaries || [], x => x.revenueTotal); return r && t > 0 ? finite(r.revenueTotal / t * 100) : null; }),
});

/** Indicateurs proposés aux objectifs sur mesure, par famille (les neuf objectifs par défaut n'en font pas partie : ils ont leur propre ligne). */
export const INDICATOR_GROUPS = [
    { label: 'Entreprise', ids: ['margeSecurite', 'pointMort', 'revenus', 'beneficeNet', 'fixedCover', 'ecartRevenus', 'produitsDeficitaires', 'partPremierProduit', 'margeProduitMin', 'partFournisseur', 'partCanal', 'margeCanalMin', 'posteMoinsUtilise'] },
    { label: 'Un ingrédient', ids: ['ingPart', 'ingDepense', 'ingPerte', 'ingVolatilite'] },
    { label: 'Un emballage', ids: ['pkgPart', 'pkgDepense', 'pkgPerte', 'pkgVolatilite'] },
    { label: 'Un fournisseur', ids: ['fournIngPart', 'fournEmbPart'] },
    { label: 'Un poste de production', ids: ['posteUtilisation', 'posteCoutHoraire', 'posteMasse', 'posteInutilise', 'posteInutilisePart'] },
    { label: 'Un format (SKU)', ids: ['fmtMargeBrute', 'fmtMargeNette', 'fmtMatiere', 'fmtEmballage', 'fmtMo', 'fmtBeneficeHeure'] },
    { label: 'Un canal', ids: ['canalMargeBrute', 'canalMargeNette', 'canalPart'] },
    { label: 'Une activité', ids: ['actMargeBrute', 'actMargeNette', 'actPart'] },
];
export const CUSTOM_INDICATOR_IDS = INDICATOR_GROUPS.flatMap(g => g.ids);
export const INDICATOR_IDS = Object.keys(INDICATORS);

/** Sujets disponibles pour un indicateur (liste vide pour un indicateur d'entreprise). */
export const subjectsOf = (ctx, indicator) => { const k = INDICATORS[indicator]?.entity; return k ? ENTITY_KINDS[k].list(ctx) : []; };

/** Texte d'une valeur dans l'unité de son indicateur : « 34,5 % », « 1 200 $ », « 1,8 fois », « 2 ». */
export const fmtObjValue = (v, unit) => (v == null ? '—' : unit === '$' ? `${formatCurrency(v)} $` : unit === '%' ? `${formatNumber(v, 1)} %` : unit === 'fois' ? `${formatNumber(v, 1)} fois` : formatNumber(v, 0));
/** Suffixe affiché à côté de la zone de saisie. */
export const unitSuffix = (unit) => (unit === 'n' ? '' : unit);

/** Les neuf objectifs par défaut : `field` = champ de generalInfo qui porte la valeur ; `principal` = saisi dans Paramètres ; `suggestion` = valeur proposée en grisé. */
export const DEFAULT_OBJECTIVES = [
    { id: 'matiere', field: 'foodCostTarget', principal: true, suggestion: null },
    { id: 'emballage', field: 'packagingCostTarget', principal: true, suggestion: null },
    { id: 'mo', field: 'laborCostTarget', principal: true, suggestion: null },
    { id: 'margeBrute', field: 'grossMarginTarget', principal: true, suggestion: null },
    { id: 'margeNette', field: 'netMarginTarget', principal: false, suggestion: 5 },
    { id: 'utilisation', field: 'utilizationTarget', principal: false, suggestion: T.postWellUsed * 100 },
    { id: 'paieNonUtilisee', field: 'unusedPayTarget', principal: false, suggestion: T.unusedPayHigh * 100 },
    { id: 'perteStock', field: 'lossTarget', principal: false, suggestion: T.lossShareHigh * 100 },
    { id: 'fraisFixes', field: 'fixedShareTarget', principal: false, suggestion: T.fixedShareHigh * 100 },
];
export const DEFAULT_FIELDS = DEFAULT_OBJECTIVES.map(o => o.field);
const DEFAULT_BY_ID = Object.fromEntries(DEFAULT_OBJECTIVES.map(o => [o.id, o]));

export const isObjectiveOff = (info, id) => (info?.objectivesOff || []).includes(id);

/**
 * Cible d'un objectif par défaut telle que l'application la lit (voyants, constats) : le texte saisi, ou '' si l'objectif est désactivé ou n'a pas de valeur.
 * Un objectif désactivé garde sa valeur saisie (on peut le réactiver), mais n'agit plus nulle part.
 */
export const activeTarget = (info, id) => (isObjectiveOff(info, id) ? '' : (info?.[DEFAULT_BY_ID[id].field] ?? ''));

const closeEnough = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * Évalue tous les objectifs (par défaut et sur mesure).
 * @param {object} ctx  contexte des constats (buildKeyFindingsContext) : ctx.info = informations générales
 * @returns {Array<{key, kind, indicator, label, unit, dir, target, current, enabled, hasTarget, met, gap, theme, subTab, principal}>}
 *   `met` et `gap` sont null quand l'objectif n'est pas évaluable (désactivé, sans valeur ou sans donnée) ; `gap` > 0 = ce qu'il manque pour l'atteindre.
 */
export function evaluateObjectives(ctx) {
    const info = ctx.info || {};
    const make = (key, kind, indicator, label, dir, rawTarget, extra, subject) => {
        const ind = INDICATORS[indicator];
        const target = P(rawTarget);
        const hasTarget = rawTarget !== '' && rawTarget != null && Number.isFinite(target) && (target > 0 || (ind.allowZero === true && target === 0));
        const enabled = !isObjectiveOff(info, key);
        let current = null;
        try { current = ind.value(ctx, subject); } catch { current = null; }
        const evaluable = enabled && hasTarget && current != null;
        const met = evaluable ? (dir === 'max' ? current <= target || closeEnough(current, target) : current >= target || closeEnough(current, target)) : null;
        const gap = evaluable ? (dir === 'max' ? current - target : target - current) : null;
        return { key, kind, indicator, label, unit: ind.unit, dir, target: hasTarget ? target : null, subject: subject ?? null, current, enabled, hasTarget, met, gap, theme: ind.theme, subTab: ind.subTab, ...extra };
    };
    const defaults = DEFAULT_OBJECTIVES.map(o => make(o.id, 'default', o.id, INDICATORS[o.id].label, INDICATORS[o.id].dir, info[o.field], { principal: o.principal }));
    const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
    const customs = (info.customObjectives || []).filter(o => INDICATORS[o.indicator]).map(o => {
        const ind = INDICATORS[o.indicator];
        const subject = ind.entity ? String(o.subject ?? '') : null;
        // Libellé : le nom choisi, sinon « sujet · indicateur » pour une entité (« Farine · achats prévus »), sinon l'indicateur.
        const subjectLabel = ind.entity ? (subjectsOf(ctx, o.indicator).find(x => x.id === subject)?.label || null) : null;
        const autoLabel = ind.entity ? `${subjectLabel || 'Sujet introuvable'} · ${lowerFirst(ind.label)}` : ind.label;
        return make(o.id, 'custom', o.indicator, (o.name || '').trim() || autoLabel, o.dir === 'min' ? 'min' : 'max', o.value, { principal: false, subjectLabel }, subject);
    });
    return [...defaults, ...customs];
}

/** Texte du sens d'un objectif : « au plus » ou « au moins ». */
export const dirText = (dir) => (dir === 'min' ? 'au moins' : 'au plus');
