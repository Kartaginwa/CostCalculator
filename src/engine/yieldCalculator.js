import { parseLocaleNumber } from '../utils.js';

// Calcule le nombre d'unités de vente qu'un format produit à partir d'une quantité de départ,
// en cascade à travers une liste ouverte d'étapes nommées (chacune avec un effet en % sur la
// quantité — négatif pour une perte, positif pour un gain, ex. absorption d'eau), puis un taux de
// rejet des produits finis appliqué APRÈS la transformation. Les deux sont distincts
// méthodologiquement (voir Projet_Claude/04-Conception-Modele.md) : une perte de procédé change
// la quantité obtenue, un rejet de contrôle qualité retire des unités déjà produites — les
// mélanger fausserait l'analyse de chacun.
//
// Fonction pure, indépendante du reste du moteur : ne fait aucune hypothèse sur l'unité de
// mesure (l'utilisateur choisit une unité de base cohérente pour baseQuantity et unitSize, comme
// dans la grille de rendement du MAPAQ).
// Quantité produite EFFECTIVE d'un format (nombre d'unités par lot) : source unique pour tout le moteur.
// Quand la grille de rendement est activée, c'est la quantité CALCULÉE ; sinon la quantité saisie (vide ou 0 → 1,
// comme avant). Avant cette fonction, le calcul des coûts lisait la quantité calculée alors que les heures de
// main-d'œuvre et le rapport d'achats lisaient le champ saisi, resté à l'ancienne valeur (audit du 20/11, constat 5).
export function effectiveNbPortions(fmt) {
    let nbPortions = parseLocaleNumber(fmt?.nbPortions) || 1;
    if (fmt?.yieldGrid?.enabled) {
        const computedUnits = computeYieldUnits({
            baseQuantity: fmt.yieldGrid.baseQuantity,
            stages: fmt.yieldGrid.stages,
            rejectRate: fmt.yieldGrid.rejectRate,
            unitSize: fmt.portionSize,
        });
        if (computedUnits > 0) nbPortions = computedUnits;
    }
    return nbPortions;
}

export function computeYieldUnits({ baseQuantity, stages = [], rejectRate = 0, unitSize } = {}) {
    let quantity = parseLocaleNumber(baseQuantity);

    for (const stage of stages) {
        quantity *= (1 + parseLocaleNumber(stage.percentEffect) / 100);
    }

    const reject = parseLocaleNumber(rejectRate) / 100;
    const finishedQuantity = reject > 0 && reject < 1 ? quantity * (1 - reject) : quantity;

    const size = parseLocaleNumber(unitSize);
    return size > 0 ? finishedQuantity / size : 0;
}
