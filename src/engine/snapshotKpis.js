// Indicateurs d'un point de référence (relevé) : matrice d'ingénierie du menu, marge, point mort global. Extrait de analysisData.js le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { parseLocaleNumber } from '../utils.js';
import { isActiveRow, blendAcrossChannels } from './analysisShared.js';

// Matrice BCG (menu engineering) : classe une liste de lignes déjà réduites à UNE valeur de
// popularité et UNE valeur de rentabilité par SKU — extrait en fonction pure, exportée, pour être
// réutilisable aussi bien par la vue « tous canaux » ci-dessous (pondérée par volume à travers
// `blendAcrossChannels`) que par une vue limitée à UN SEUL canal (sélecteur de canal dans Résumé →
// Vue d'ensemble, voir SummaryTable.jsx), sans jamais recalculer tout le pipeline de
// `computeAnalysisData`. Mêmes règles qu'avant (06/10) : seuil de popularité = 70 % de la part
// moyenne (règle des 70 %), seuil de rentabilité = marge moyenne pondérée par le volume.
export function computeMenuEngineeringQuadrants(rows) {
    const menuEngineeringData = { stars: [], cows: [], questions: [], dogs: [] };
    if (!rows || rows.length === 0) return menuEngineeringData;

    const totalPopularity = rows.reduce((s, r) => s + r.popularity, 0);
    const avgShare = totalPopularity / rows.length;
    const popularityThreshold = 0.70 * avgShare;

    const totalVolume = rows.reduce((s, r) => s + (r.volume || 0), 0);
    const totalMargin = rows.reduce((s, r) => s + r.margeBruteDollar * (r.volume || 0), 0);
    const avgMargin = totalVolume > 0
        ? totalMargin / totalVolume
        : rows.reduce((s, r) => s + r.margeBruteDollar, 0) / rows.length;

    for (const r of rows) {
        const highPop = r.popularity >= popularityThreshold;
        const highProf = r.margeBruteDollar >= avgMargin;
        if (highPop && highProf) menuEngineeringData.stars.push(r);
        else if (highPop && !highProf) menuEngineeringData.cows.push(r);
        else if (!highPop && highProf) menuEngineeringData.questions.push(r);
        else menuEngineeringData.dogs.push(r);
    }
    return menuEngineeringData;
}

// KPI pondérés d'un POINT DE RÉFÉRENCE (relevé historique) — pondérés par le REVENU de chaque
// produit, comme les tuiles de la Vue d'ensemble (computeAnalysisData) : la marge moyenne d'un menu est
// (somme des marges en $) ÷ (somme des revenus), jamais une moyenne de pourcentages pondérée par des
// UNITÉS (paradoxe de Simpson). Poids d'un produit : son revenu réel (prix net × volume de chaque
// canal) quand le relevé en contient pour TOUS les produits au menu ; sinon, repli cohérent sur
// « part du mix des ventes × prix de vente » (un mix est une part d'UNITÉS : sans multiplier par le
// prix, on retombe dans le piège). Retourne null quand aucun poids n'est calculable (donnée absente,
// jamais un 0 forcé).
export function computeSnapshotMenuKpis(rows) {
    const active = (rows || []).filter(p => p && p.onMenu);
    if (active.length === 0) return null;
    const realRevenue = (p) => (p.channelBreakdown || []).reduce(
        (s, cb) => s + parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume), 0);
    const allHaveReal = active.every(p => realRevenue(p) > 0);
    const revenueOf = (p) => allHaveReal ? realRevenue(p) : parseLocaleNumber(p.salesMix) * parseLocaleNumber(p.prixVente);
    const total = active.reduce((s, p) => s + revenueOf(p), 0);
    if (!(total > 0)) return null;
    const acc = { weightedGrossMargin: 0, weightedMaterialCost: 0, weightedPackagingCost: 0, weightedLaborCost: 0 };
    for (const p of active) {
        const w = revenueOf(p) / total;
        // Moyennes « tous canaux » recalculées ici (en dollars) à partir des canaux sauvegardés : les anciens points
        // de référence, enregistrés avec l'ancienne moyenne par unités, rejoignent ainsi la même méthode que les tuiles.
        const m = (p.costs && p.channelBreakdown && p.channelBreakdown.length && p.channelBreakdown.every((cb) => cb.margeBrutePercent != null)) ? blendAcrossChannels(p.costs, p.channelBreakdown) : (p.blended || p.costs || {});
        acc.weightedGrossMargin += (parseLocaleNumber(m.margeBrutePercent) || 0) * w;
        acc.weightedMaterialCost += (parseLocaleNumber(m.costMatierePercent) || 0) * w;
        acc.weightedPackagingCost += (parseLocaleNumber(m.costPackagingPercent) || 0) * w;
        acc.weightedLaborCost += (parseLocaleNumber(m.costLaborPercent) || 0) * w;
    }
    return acc;
}

// Point mort GLOBAL en chiffre d'affaires : frais fixes ÷ taux de marge de contribution pondéré par le
// REVENU, avec la main-d'œuvre directe traitée comme un coût FIXE (ajoutée aux frais fixes, retirée de la
// marge de contribution ; le vieillissement est aussi retiré de cette marge). Fonction unique, utilisée par les tuiles ET par les points de référence, pour
// que la courbe d'évolution rejoigne toujours la valeur actuelle (avant le 19/11, les points de référence
// utilisaient une autre formule : frais fixes ÷ marge brute %, main-d'œuvre traitée comme variable).
// `rows` : lignes de formats ACTIFS portant `blended`, `costs` et `channelBreakdown`.
export function computeGlobalBreakEven(rows, totalIndirects) {
    const active = (rows || []).filter(isActiveRow);
    const unitsOf = (p) => p.blended?.totalVolume || 0;
    const revenueOf = (p) => (p.channelBreakdown || []).reduce((s, cb) => s + parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume), 0);
    const menuRevenue = active.reduce((s, p) => s + revenueOf(p), 0);
    const totalMarginDollar = active.reduce((s, p) => s + parseLocaleNumber(p.blended?.margeBruteDollar) * unitsOf(p), 0);
    const totalLaborDollar = active.reduce((s, p) => s + parseLocaleNumber(p.costs?.costLaborPerPortion) * unitsOf(p), 0);
    // Le vieillissement (proportionnel au volume) est retiré de la marge de contribution, comme dans la marge nette (21/11).
    const totalAgingDollar = active.reduce((s, p) => s + parseLocaleNumber(p.costs?.costAgingPerPortion) * unitsOf(p), 0);
    const ratio = menuRevenue > 0 ? (totalMarginDollar + totalLaborDollar - totalAgingDollar) / menuRevenue : 0;
    return ratio > 0 ? (parseLocaleNumber(totalIndirects) + totalLaborDollar) / ratio : 0;
}

// Point mort global d'un POINT DE RÉFÉRENCE : même formule que la tuile actuelle (computeGlobalBreakEven), appliquée
// aux lignes sauvegardées dans le relevé. `null` quand le relevé n'a pas de données exploitables (le graphique
// laisse alors un trou plutôt que d'afficher un chiffre calculé autrement).
export function computeSnapshotBreakEven(rows, totalIndirects) {
    const active = (rows || []).filter((p) => p && p.onMenu && p.costs);
    if (active.length === 0) return null;
    const blendedRows = active.map((p) => ({ ...p, blended: blendAcrossChannels(p.costs, p.channelBreakdown) }));
    const value = computeGlobalBreakEven(blendedRows, totalIndirects);
    return value > 0 ? value : null;
}
