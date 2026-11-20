// Heures de main-d'œuvre NÉCESSAIRES pour produire les volumes vendus (19/11, audit : les sous-recettes n'étaient pas comptées).
//
// Règle : les heures d'un format = durée de ses étapes × nombre de lots à produire. Les lots viennent de deux sources :
//   1. les ventes du format lui-même (volumes par canal ÷ portions par lot) ;
//   2. ce que les AUTRES recettes en consomment, quand le format sert de sous-recette dans une ligne d'ingrédient —
//      même si la sous-recette n'est jamais vendue seule. La chaîne est suivie jusqu'au bout (sous-recette d'une
//      sous-recette).
// Sans cela, le temps de fabrication d'une sous-recette non vendue disparaissait du rapport de productivité et du
// taux d'absorption, alors que son coût de main-d'œuvre est déjà compté dans le coût du produit qui la consomme : la
// capacité inutilisée était surestimée et ce coût se retrouvait compté deux fois.
//
// La quantité consommée suit exactement calculateCosts.js : quantité de la ligne, convertie dans l'unité de la portion
// de la sous-recette, divisée par le rendement de la ligne, puis par la quantité d'une portion et par le nombre de
// portions d'un lot. Fonction pure : aucune donnée n'est modifiée.
import { parseLocaleNumber as P, unitConversionFactor, activeChannelPrices } from '../utils.js';
import { effectiveNbPortions } from './yieldCalculator.js';

const formatsOf = (product) => (product.formats && product.formats.length > 0 ? product.formats : [product]);

export function computeLaborHoursNeeded(products, baseIngredients = [], salesChannels = []) {
    const baseIds = new Set((baseIngredients || []).map(i => i.id));
    const subRecipes = (products || []).filter(p => p.isIngredient);
    const byPost = {};
    const byActivity = {};
    // Lots à produire par FORMAT (ventes + consommation par d'autres recettes) : sert aussi à vérifier que la paie absorbée
    // par les produits est exactement la paie versée.
    const batchesByFormat = {};

    // Même résolution que calculateCosts : l'id d'une ligne désigne un FORMAT de sous-recette, ou (anciens projets) un produit.
    const findSubRecipe = (id) => {
        for (const product of subRecipes) {
            const fmt = (product.formats || []).find(f => f.id === id);
            if (fmt) return { product, fmt };
        }
        const byProduct = subRecipes.find(p => p.id === id);
        return byProduct ? { product: byProduct, fmt: byProduct.formats?.[0] || byProduct } : null;
    };

    const addBatches = (product, fmt, batches, path) => {
        if (!(batches > 0)) return;
        batchesByFormat[fmt.id] = (batchesByFormat[fmt.id] || 0) + batches;
        (fmt.productionSteps || []).forEach(step => {
            (step.personnel || []).forEach(person => {
                const hours = (P(step.duration) / 3600) * batches;
                byPost[person.postId] = (byPost[person.postId] || 0) + hours;
                if (product.activityId) byActivity[product.activityId] = (byActivity[product.activityId] || 0) + hours;
            });
        });
        if (fmt.isResaleProduct) return;
        const nextPath = new Set(path).add(fmt.id);
        (fmt.ingredients || []).forEach(row => {
            if (baseIds.has(row.id)) return;
            const sub = findSubRecipe(row.id);
            if (!sub || nextPath.has(sub.fmt.id)) return;
            let quantity = P(row.quantity) * unitConversionFactor(row.recipeUnit || sub.fmt.portionUnit, sub.fmt.portionUnit);
            const yieldPercent = P(row.yieldPercentage);
            if (yieldPercent > 0) quantity /= yieldPercent / 100;
            const portions = quantity / (P(sub.fmt.portionSize) || 1);
            addBatches(sub.product, sub.fmt, batches * (portions / effectiveNbPortions(sub.fmt)), nextPath);
        });
    };

    (products || []).forEach(product => {
        formatsOf(product).filter(fmt => fmt.onMenu !== false).forEach(fmt => {
            const sold = activeChannelPrices(fmt, salesChannels).reduce((sum, cp) => sum + (P(cp.volume) || 0), 0);
            addBatches(product, fmt, sold / effectiveNbPortions(fmt), new Set());
        });
    });

    return { byPost, byActivity, batchesByFormat, total: Object.values(byPost).reduce((sum, h) => sum + h, 0) };
}
