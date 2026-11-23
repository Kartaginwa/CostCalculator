// Constats PAR ENTITÉ (phase 2 de la refonte de l'export PDF, 22/11) : la version « un constat par sujet » des règles agrégées de keyFindings.js
// (un format, un poste, une case activité × canal, un fournisseur, un élément du catalogue). Les versions agrégées existent toujours ; celles-ci
// les complètent pour les fiches produits et les sections qui parlent d'une entité précise.
// Mêmes principes que keyFindings.js : règles déterministes, aucun texte d'IA, une donnée absente reste absente (règle muette), seuils dans
// reportThresholds.js, et AUCUN calcul recopié : on lit les données déjà calculées par l'application (analysisData, ventilation par canal,
// matrice stratégique, rapport d'achats, volatilité, productivité) et les calculs partagés de findingKit.js.
import { parseLocaleNumber as P, formatNumber } from '../utils.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';
import { finding, force, weak, pct, usd, subject, computeFormatSpread } from './findingKit.js';
import { computeActivityChannelMarginMatrix } from './analysisData.js';
import { activeTarget } from './objectives.js';

const nf = (v) => formatNumber(v, 0);

// ---------- formats : alimentent les fiches produits ----------
const CLASS_TEXT = {
    stars: ['force', 50, 'une étoile', 'Très populaire et très rentable : à protéger.'],
    questions: ['faiblesse', 40, 'un dilemme', 'Rentable, mais peu vendu : à promouvoir ou à abandonner.'],
    cows: ['faiblesse', 42, 'une vache à lait', 'Très vendu, mais peu rentable : à optimiser.'],
    dogs: ['faiblesse', 48, 'un poids mort', 'Peu populaire et peu rentable : à repenser ou à retirer.'],
};

export const formatRules = (c) => {
    const a = c.analysis, out = [];
    const rows = a.activeProducts || [];
    const m = a.menuEngineeringData || {};
    const classOf = new Map();
    Object.keys(CLASS_TEXT).forEach(k => (m[k] || []).forEach(p => classOf.set(String(p.id), k)));
    const target = P(activeTarget(c.info, 'matiere'));
    // Bénéfice brut par heure : la moyenne de l'écran Main-d'œuvre (c.growth, calculé par computeGrowthMargin), pas une moyenne refaite ici.
    const ranked = (c.productRows || []).filter(r => r.grossProfitPerHour != null);
    const avgHour = ranked.length >= 3 && c.growth ? c.growth.grossProfitPerHour : null;
    const hourOf = new Map(ranked.map(r => [String(r.id), r.grossProfitPerHour]));

    for (const p of rows) {
        const sub = subject('format', p.id, p.displayName), q = `« ${p.displayName} »`;
        // Classe stratégique du format
        const k = classOf.get(String(p.id));
        if (k) { const [tone, weight, label, detail] = CLASS_TEXT[k]; out.push(finding(`sku-class-${p.id}`, tone, 'Produits', weight, `${q} : ${label}`, detail, 'bySku', null, sub)); }
        // Marge nette par canal : déficit ou rentabilité partout
        const margins = (p.channelBreakdown || []).filter(cb => Number.isFinite(cb.margeNettePercent))
            .map(cb => ({ channel: c.channelNames[cb.channelId] || 'canal', pct: cb.margeNettePercent, profit: cb.margeNetteDollar * P(cb.volume), hasVolume: P(cb.volume) > 0 }));
        if (margins.length) {
            const neg = margins.filter(x => x.pct < 0);
            if (neg.length) {
                const all = neg.length === margins.length;
                const loss = -neg.filter(x => x.hasVolume).reduce((s, x) => s + x.profit, 0);
                out.push(weak(`sku-loss-${p.id}`, 'Produits', all ? 80 : 70,
                    all ? `${q} est déficitaire dans tous ses canaux` : `${q} perd de l'argent dans ${neg.length > 1 ? `${neg.length} canaux` : '1 canal'} sur ${margins.length}`,
                    neg.map(x => `${x.channel} : ${pct(x.pct)}`).join(' · '), 'bySku', loss > 0 ? loss : null, sub));
            } else {
                const lo = Math.min(...margins.map(x => x.pct)), hi = Math.max(...margins.map(x => x.pct));
                out.push(force(`sku-positive-${p.id}`, 'Produits', 45, `${q} est rentable dans ${margins.length > 1 ? 'tous ses canaux' : 'son canal'}`,
                    margins.length > 1 ? `Marge nette de ${pct(lo)} à ${pct(hi)}.` : `Marge nette de ${pct(lo)}.`, 'bySku', null, sub));
            }
        }
        // Coût matière au-dessus de la cible (règle 80, version par format)
        if (target > 0 && p.costs && p.costs.costMatierePercent * 100 > target) {
            out.push(weak(`sku-over-cost-${p.id}`, 'Coûts', 50, `${q} : coût matière au-dessus de la cible`, `${pct(p.costs.costMatierePercent, 1)} contre une cible de ${nf(target)} %.`, 'bySku', null, sub));
        }
        // Bénéfice brut par heure de main-d'œuvre, comparé à la moyenne de l'équipe
        const gph = hourOf.get(String(p.id));
        if (gph != null && avgHour != null) {
            if (gph < avgHour * T.productHourLow) out.push(weak(`sku-hour-${p.id}`, 'Main-d\'œuvre', 45, `${q} rapporte peu à l'heure`, `${usd(gph)} de bénéfice brut par heure, contre ${usd(avgHour)} en moyenne.`, 'labor', null, sub));
            else if (gph >= avgHour * T.productHourHigh) out.push(force(`sku-hour-${p.id}`, 'Main-d\'œuvre', 40, `${q} : un bon usage du temps`, `${usd(gph)} de bénéfice brut par heure, contre ${usd(avgHour)} en moyenne.`, 'labor', null, sub));
        }
    }
    // Écart de marge entre les formats d'un même produit (règle 27, version par produit)
    for (const s of computeFormatSpread(rows)) {
        const best = s.l.reduce((x, y) => (y.margin > x.margin ? y : x)), worst = s.l.reduce((x, y) => (y.margin < x.margin ? y : x));
        out.push(weak(`format-gap-of-${best.productId}`, 'Produits', 43, 'Les formats d\'un même produit n\'ont pas la même marge', `« ${best.name} » à ${pct(best.margin)} contre « ${worst.name} » à ${pct(worst.margin)}.`, 'bySku', null, subject('produit', best.productId, best.name)));
    }
    return out;
};

// ---------- activité × canal ----------
// Cases activité × canal dont le bénéfice net est négatif, lues dans la matrice de l'application. Partagé par les constats et par la lecture du rapport.
export const deficitCells = (c) => {
    const channels = Object.entries(c.channelNames || {}).map(([id, name]) => ({ id, name }));
    const activities = c.productionActivities || [];
    if (!channels.length || !activities.length) return [];
    const matrix = computeActivityChannelMarginMatrix(c.analysis.productsWithCosts || [], activities, channels);
    const out = [];
    for (const act of activities) for (const ch of channels) {
        const cell = matrix[act.id]?.[ch.id];
        if (cell && cell.margeNetteTotal < 0) out.push({ act, ch, cell });
    }
    return out;
};
export const cellRules = (c) => deficitCells(c).map(({ act, ch, cell }) => weak(`cell-deficit-${act.id}-${ch.id}`, 'Activités', 60, `${act.name} en ${ch.name} : perd de l'argent`,
    `Bénéfice net de ${usd(cell.margeNetteTotal)} (${pct(cell.margeNettePercent)} de marge nette).`, 'byActivity', Math.abs(cell.margeNetteTotal), subject('activité × canal', `${act.id}:${ch.id}`, `${act.name} × ${ch.name}`)));

// ---------- postes de production ----------
export const postRules = (c) => {
    const out = [];
    for (const r of (c.info.productivityReport?.rows || []).filter(x => x.actual > 0 && x.expected > 0)) {
        const u = r.utilization / 100, sub = subject('poste', r.postName, r.postName);
        if (u > 1) out.push(weak(`post-state-${r.postName}`, 'Main-d\'œuvre', 56, `${r.postName} : surchargé (${nf(r.utilization)} %)`, 'La capacité réelle est dépassée.', 'labor', null, sub));
        else if (u < T.postUnderUsed) out.push(weak(`post-state-${r.postName}`, 'Main-d\'œuvre', 48, `${r.postName} : utilisé à ${nf(r.utilization)} %`, `Moins de ${pct(T.postUnderUsed, 0)} d'utilisation : de la capacité inutilisée.`, 'labor', null, sub));
        else if (u >= T.postWellUsed) out.push(force(`post-state-${r.postName}`, 'Main-d\'œuvre', 40, `${r.postName} : ${nf(r.utilization)} % d'utilisation`, 'Poste de production bien occupé.', 'labor', null, sub));
    }
    return out;
};

// ---------- approvisionnement : fournisseurs et éléments du catalogue ----------
export const supplyEntityRules = (c) => {
    const out = [];
    const sets = [
        ['ing', 'd\'ingrédients', 'ingrédient', c.ingredientShares, c.ingredientVolatility, c.analysis.abcAnalysisData, c.analysis.purchasingReportData, 'ingredients', 1],
        ['pkg', 'd\'emballages', 'emballage', c.packagingShares, c.packagingVolatility, c.analysis.packagingAbcAnalysisData, c.analysis.packagingPurchasingReportData, 'packaging', 0.65],
    ];
    for (const [key, noun, itemType, shares, vol, abc, report, subTab, k] of sets) {
        // Chaque fournisseur en dépendance (pas seulement le premier)
        (shares?.rows || []).filter(r => r.isDependent).forEach(r => out.push(weak(`supplier-dep-${key}-${r.provider}`, 'Approvisionnement', Math.round(75 * k),
            `${r.provider} : ${pct(r.share, 0)} des achats ${noun}`, 'Une dépendance à un seul fournisseur.', subTab, null, subject('fournisseur', r.provider, r.provider))));
        // Chaque élément de classe A à prix volatil
        if (vol?.hasEnoughData) {
            (abc?.A || []).filter(i => vol.byName[i.name]?.isVolatile).forEach(i => out.push(weak(`volatile-item-${key}-${i.id ?? i.name}`, 'Approvisionnement', Math.round(60 * k),
                `${i.name} : prix volatil`, `Amplitude de ${nf(vol.byName[i.name].amplitudePercent)} % sur ${vol.pointCount} relevés ; élément de classe A.`, subTab, null, subject(itemType, i.id ?? i.name, i.name))));
        }
        // Chaque ingrédient qui pèse lourd dans la perte stock prévue (ingrédients seulement, comme la règle agrégée)
        const loss = report?.grandTotal;
        if (key === 'ing' && loss && loss.loss > 0) {
            Object.values(report.groupedByProvider || {}).flatMap(g => g.items).filter(i => i.lossCost / loss.loss >= T.lossItemShare)
                .forEach(i => out.push(weak(`loss-item-${i.id}`, 'Approvisionnement', 40, `${i.name} : ${usd(i.lossCost)} de perte stock`, `${pct(i.lossCost / loss.loss, 0)} de la perte stock prévue.`, subTab, i.lossCost, subject('ingrédient', i.id, i.name))));
        }
    }
    return out;
};

export const ENTITY_RULES = [formatRules, cellRules, postRules, supplyEntityRules];
