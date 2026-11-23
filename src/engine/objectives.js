// Objectifs stratégiques (24/11) : le catalogue des objectifs de l'entrepreneur et leur évaluation, sans aucun nouveau calcul de donnée.
// Un objectif compare un INDICATEUR que l'application affiche déjà (marge brute, taux d'utilisation, perte stock…) à une valeur choisie par l'utilisateur,
// dans un sens (« au plus » ou « au moins »). Deux familles :
//   - les objectifs PAR DÉFAUT (neuf) : leur sens est fixe (un coût « au plus », une marge « au moins »), leur valeur vit dans les informations générales
//     (generalInfo, champs *Target), saisie dans Paramètres (les quatre principales) ou dans la fenêtre « Gérer les objectifs » (les autres) ;
//   - les objectifs SUR MESURE (20 au plus) : un indicateur du catalogue, un sens au choix, une valeur (generalInfo.customObjectives).
// Un objectif peut être désactivé sans être supprimé (generalInfo.objectivesOff : liste d'identifiants). Sans valeur ou sans donnée, un objectif est muet :
// une donnée absente reste absente. Pas de formule libre : seuls les indicateurs du catalogue sont mesurables.
import { parseLocaleNumber as P } from '../utils.js';
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
export const INDICATOR_IDS = Object.keys(INDICATORS);

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
    const make = (key, kind, indicator, label, dir, rawTarget, extra) => {
        const ind = INDICATORS[indicator];
        const target = P(rawTarget);
        const hasTarget = rawTarget !== '' && rawTarget != null && Number.isFinite(target) && target > 0;
        const enabled = !isObjectiveOff(info, key);
        let current = null;
        try { current = ind.value(ctx); } catch { current = null; }
        const evaluable = enabled && hasTarget && current != null;
        const met = evaluable ? (dir === 'max' ? current <= target || closeEnough(current, target) : current >= target || closeEnough(current, target)) : null;
        const gap = evaluable ? (dir === 'max' ? current - target : target - current) : null;
        return { key, kind, indicator, label, unit: ind.unit, dir, target: hasTarget ? target : null, current, enabled, hasTarget, met, gap, theme: ind.theme, subTab: ind.subTab, ...extra };
    };
    const defaults = DEFAULT_OBJECTIVES.map(o => make(o.id, 'default', o.id, INDICATORS[o.id].label, INDICATORS[o.id].dir, info[o.field], { principal: o.principal }));
    const customs = (info.customObjectives || []).filter(o => INDICATORS[o.indicator]).map(o =>
        make(o.id, 'custom', o.indicator, (o.name || '').trim() || INDICATORS[o.indicator].label, o.dir === 'min' ? 'min' : 'max', o.value, { principal: false }));
    return [...defaults, ...customs];
}

/** Texte du sens d'un objectif : « au plus » ou « au moins ». */
export const dirText = (dir) => (dir === 'min' ? 'au moins' : 'au plus');
