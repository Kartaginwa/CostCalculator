// Séries d'évolution (points de référence) : celles de la Vue d'ensemble et du graphique d'un SKU (Par SKU).
// Fonctions pures, extraites de SummaryTable.jsx le 22/11 (phase 1 de la refonte de l'export PDF) : l'écran et le
// rapport PDF tracent les MÊMES variables. Les clés (libellés français) sont celles des `dataKey` des graphiques.
// Donnée absente = null (un trou dans la ligne), jamais forcée à 0.
import { parseLocaleNumber, snapshotDateLabel } from '../utils.js';
import { computeSnapshotBreakEven, computeSnapshotMenuKpis } from './analysisData.js';

const pointName = (point) => snapshotDateLabel(point.timestamp);

/** Évolution globale : marge brute, coût matière, coût emballage, coût main-d'œuvre (moyennes pondérées par le revenu, en %), point mort. */
export function computeGlobalSeries(points = []) {
    return points.map(point => {
        // Pondération par le REVENU (voir computeSnapshotMenuKpis) : même méthode que les tuiles de la Vue d'ensemble, pour que le
        // dernier point du graphique corresponde à la tuile.
        const kpis = computeSnapshotMenuKpis(point.productsWithCosts);
        const base = { name: pointName(point), label: point.name, note: point.note };
        if (!kpis) {
            return { ...base, 'Point Mort Global': null, 'Marge Brute Moyenne': null, 'Coût Matière Moyen': null, 'Coût Emballage Moyen': null, "Coût Main-d'œuvre Moyen": null };
        }
        const { weightedGrossMargin, weightedMaterialCost, weightedPackagingCost, weightedLaborCost } = kpis;
        // Même formule que la tuile « Point mort » (main-d'œuvre traitée comme un coût fixe) : la courbe rejoint la valeur actuelle.
        const breakEven = computeSnapshotBreakEven(point.productsWithCosts, point.generalInfo.totalIndirects)
            ?? (weightedGrossMargin > 0 ? parseLocaleNumber(point.generalInfo.totalIndirects) / weightedGrossMargin : 0);
        return {
            ...base,
            'Point Mort Global': breakEven,
            'Marge Brute Moyenne': weightedGrossMargin * 100,
            'Coût Matière Moyen': weightedMaterialCost * 100,
            'Coût Emballage Moyen': weightedPackagingCost * 100,
            "Coût Main-d'œuvre Moyen": weightedLaborCost * 100,
        };
    });
}

/** Évolution d'un SKU : en % du prix (matière, emballage, main-d'œuvre, frais indirects, marge nette) et en $/unité (pour un format sans prix). */
export function computeProductSeries(points = [], productId) {
    if (!productId) return [];
    return points.map(point => {
        const base = { name: pointName(point), label: point.name, note: point.note };
        const productData = point.productsWithCosts.find(p => String(p.id) === String(productId));
        if (!productData) {
            return {
                ...base,
                'Coût matière (%)': null, 'Coût emballage (%)': null, "Coût main-d'œuvre (%)": null, 'Coût frais indirects (%)': null, 'Marge nette (%)': null,
                'Coût matière ($/u.)': null, 'Coût emballage ($/u.)': null, "Coût main-d'œuvre ($/u.)": null, 'Coût de revient ($/u.)': null,
            };
        }
        const c = productData.costs;
        return {
            ...base,
            'Coût matière (%)': c.costMatierePercent * 100,
            'Coût emballage (%)': c.costPackagingPercent * 100,
            "Coût main-d'œuvre (%)": c.costLaborPercent * 100,
            'Coût frais indirects (%)': c.costIndirectPercent * 100,
            'Marge nette (%)': c.margeNettePercent * 100,
            'Coût matière ($/u.)': c.costMatierePerPortion,
            'Coût emballage ($/u.)': c.costPackagingPerPortion,
            "Coût main-d'œuvre ($/u.)": c.costLaborPerPortion,
            'Coût de revient ($/u.)': c.totalCostPerPortion,
        };
    });
}

/**
 * Un format sans prix de vente (sous-recette jamais vendue seule) a tous ses ratios en % forcés à 0 par calculateCosts.js (division par un prix
 * nul) : le graphique bascule alors sur les coûts en $/unité, toujours significatifs.
 */
export function isProductPriced(points = [], productId) {
    return points.some(point => {
        const p = point.productsWithCosts.find(pp => String(pp.id) === String(productId));
        return !!p && parseLocaleNumber(p.prixVente) > 0;
    });
}
