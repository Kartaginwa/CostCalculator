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
