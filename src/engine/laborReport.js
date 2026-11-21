// Calculs des rapports de Rapport et suivi (lot 2, 21/11) : marge de sécurité, part des achats par fournisseur, cascade de la paie, rentabilité de
// l'heure de main-d'œuvre (par activité et par produit) et marge de croissance. Fonctions pures : aucune donnée n'est modifiée.
// Principe du projet : une donnée absente reste absente (null), jamais forcée à 0.
import { parseLocaleNumber as P, loadedHourlyRate } from '../utils.js';
import { REPORT_THRESHOLDS } from './reportThresholds.js';

// Marge de sécurité : de combien les ventes prévues peuvent baisser avant d'atteindre le point mort = (ventes − point mort) ÷ ventes.
// Négative : déjà sous le point mort. Absente (null) sans ventes prévues ou sans point mort calculable.
export function computeSafetyMargin(revenue, breakEven) {
    if (!(revenue > 0) || !Number.isFinite(breakEven) || !(breakEven > 0)) return null;
    return { ratio: (revenue - breakEven) / revenue, surplus: revenue - breakEven };
}

// Part de chaque fournisseur dans le coût d'achat total requis (rapport d'achats : `groupedByProvider`). Triés du plus grand au plus petit.
export function computeProviderShares(report, threshold = REPORT_THRESHOLDS.providerDependency) {
    const entries = Object.entries(report?.groupedByProvider || {});
    const total = entries.reduce((sum, [, g]) => sum + g.totalCost, 0);
    const rows = entries
        .map(([provider, g]) => ({ provider, total: g.totalCost, share: total > 0 ? g.totalCost / total : null }))
        .map(r => ({ ...r, isDependent: r.share != null && r.share >= threshold }))
        .sort((a, b) => b.total - a.total);
    return { rows, total };
}

// Cascade de la paie : des heures payées aux heures réellement utilisées à produire, en heures et en dollars.
//   heures payées = heures utilisées + heures productives inutilisées + heures non productives (déjà exclues du « % temps productif attendu »).
// Le coût d'une heure d'un poste est sa paie chargée ÷ ses heures payées. Un poste sans aucune heure requise par les recettes (ex. responsable de
// production) compte entièrement en heures productives inutilisées. `freeProductionHours` : heures productives libres des SEULS postes de
// production (ceux dont les recettes demandent des heures), base de la marge de croissance.
export function computeLaborCascade(laborDatabase, productivityRows) {
    const actualByPost = Object.fromEntries((productivityRows || []).map(r => [r.postName, r.actual]));
    const out = {
        paidHours: 0, expectedHours: 0, usedHours: 0, idleHours: 0, nonProductiveHours: 0, overloadHours: 0, freeProductionHours: 0,
        payroll: 0, costUsed: 0, costIdle: 0, costNonProductive: 0,
    };
    for (const post of laborDatabase || []) {
        let paid = 0, expected = 0, pay = 0;
        for (const emp of post.employees || []) {
            const hours = P(emp.workedHours);
            paid += hours;
            expected += hours * P(emp.productiveTimePercentage) / 100;
            pay += hours * loadedHourlyRate(emp);
        }
        if (!(paid > 0)) continue;
        const actual = actualByPost[post.postName] || 0;
        const used = Math.min(actual, expected);
        const idle = expected - used;
        const nonProductive = paid - expected;
        const rate = pay / paid;
        out.paidHours += paid; out.expectedHours += expected; out.usedHours += used; out.idleHours += idle; out.nonProductiveHours += nonProductive;
        out.overloadHours += Math.max(0, actual - expected);
        if (actual > 0) out.freeProductionHours += idle;
        out.payroll += pay; out.costUsed += used * rate; out.costIdle += idle * rate; out.costNonProductive += nonProductive * rate;
    }
    const unusedPay = out.costIdle + out.costNonProductive;
    return {
        ...out,
        unusedPay,
        unusedShare: out.payroll > 0 ? unusedPay / out.payroll : null,
        // Coût réel d'une heure productive : la paie totale répartie sur les seules heures réellement utilisées ; à comparer au taux moyen chargé.
        effectiveHourlyCost: out.usedHours > 0 ? out.payroll / out.usedHours : null,
        averageLoadedRate: out.paidHours > 0 ? out.payroll / out.paidHours : null,
    };
}

const channelRevenue = (p) => (p.channelBreakdown || []).reduce((s, cb) => s + P(cb.netPrice) * P(cb.volume), 0);
const channelGrossProfit = (p) => (p.channelBreakdown || []).reduce((s, cb) => s + P(cb.volume) * (cb.margeBruteDollar || 0), 0);
const isResale = (p) => !!(p.format?.isResaleProduct || p.isResaleProduct);

// Rentabilité de l'heure par PRODUIT : bénéfice brut ÷ heures de main-d'œuvre de son format. Un produit de revente n'a aucune main-d'œuvre : il
// reste dans la liste (isResale) mais sans ratio. Même chose sans heures (null). Le temps d'une sous-recette reste attribué à son propre format.
export function computeProductLaborProfitability(activeProducts, hoursByFormat) {
    return (activeProducts || []).map(p => {
        const hours = (hoursByFormat || {})[p.format?.id] || 0;
        const grossProfit = channelGrossProfit(p);
        const resale = isResale(p);
        return {
            id: p.id, name: p.displayName, activityId: p.activityId, hours, revenue: channelRevenue(p), grossProfit, isResale: resale,
            grossProfitPerHour: !resale && hours > 0 ? grossProfit / hours : null,
        };
    });
}

// Rentabilité de l'heure par ACTIVITÉ : heures = celles de l'activité (sous-recettes comprises, attribuées à l'activité qui les fabrique) ;
// revenu et bénéfice brut = ceux de ses produits fabriqués, produits de revente EXCLUS (ils ajouteraient du revenu sans heures).
export function computeActivityLaborRatios(activeProducts, hoursByActivity, activities) {
    const totalHours = Object.values(hoursByActivity || {}).reduce((s, h) => s + h, 0);
    return (activities || []).map(a => {
        const hours = (hoursByActivity || {})[a.id] || 0;
        const own = (activeProducts || []).filter(p => p.activityId === a.id && !isResale(p));
        const revenue = own.reduce((s, p) => s + channelRevenue(p), 0);
        const grossProfit = own.reduce((s, p) => s + channelGrossProfit(p), 0);
        return {
            activityId: a.id, activityName: a.name, hours, sharePercent: totalHours > 0 ? (hours / totalHours) * 100 : 0, revenue, grossProfit,
            revenuePerHour: hours > 0 ? revenue / hours : null,
            grossProfitPerHour: hours > 0 ? grossProfit / hours : null,
        };
    });
}

// Marge de croissance (estimation indicative) : ce que les heures productives libres des postes de production pourraient produire de plus, au
// revenu et au bénéfice brut moyens par heure des produits fabriqués, au même mix. Suppose que la demande existe et que les heures libres tombent
// au bon poste.
export function computeGrowthMargin(freeProductionHours, productRows) {
    const made = (productRows || []).filter(r => !r.isResale && r.hours > 0);
    const hours = made.reduce((s, r) => s + r.hours, 0);
    if (!(freeProductionHours > 0) || !(hours > 0)) return null;
    const revenuePerHour = made.reduce((s, r) => s + r.revenue, 0) / hours;
    const grossProfitPerHour = made.reduce((s, r) => s + r.grossProfit, 0) / hours;
    return { freeHours: freeProductionHours, revenuePerHour, grossProfitPerHour, additionalRevenue: freeProductionHours * revenuePerHour, additionalGrossProfit: freeProductionHours * grossProfitPerHour };
}
