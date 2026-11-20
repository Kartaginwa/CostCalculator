// Vérifications de cohérence du projet (Phase 7, 18/11) : regroupe à un seul endroit des problèmes
// de données qui, autrement, n'apparaissent que dans l'onglet concerné. Fonction pure — aucune
// donnée n'est modifiée ; chaque constat dit où aller pour le corriger (`tab`).
import { parseLocaleNumber, isNotEmpty, formatNumber } from '../utils.js';

const STALE_DAYS = 30;

export function computeProjectChecks({ products = [], baseIngredients = [], basePackaging = [], fixedCosts = null, now = new Date() }) {
    const checks = [];
    const formatsOf = (p) => (p.formats && p.formats.length > 0 ? p.formats : [p]);

    const unnamed = products.filter(p => !isNotEmpty(p.platName)).length;
    if (unnamed > 0) {
        checks.push({ id: 'unnamed-products', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${unnamed} produit${unnamed > 1 ? 's' : ''} sans nom.` });
    }

    const menuFormats = products.flatMap(p => formatsOf(p).filter(f => f.onMenu).map(f => ({ p, f })));

    const noPrice = menuFormats.filter(({ f }) =>
        !(parseLocaleNumber(f.prixVente) > 0) && !(f.channelPrices || []).some(cp => parseLocaleNumber(cp.netPrice) > 0));
    if (noPrice.length > 0) {
        checks.push({ id: 'no-sale-price', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${noPrice.length} SKU${noPrice.length > 1 ? 's' : ''} actif${noPrice.length > 1 ? 's' : ''} sans prix de vente : leurs marges ne peuvent pas être calculées.` });
    }

    if (menuFormats.length > 0) {
        const totalMix = menuFormats.reduce((sum, { f }) => sum + parseLocaleNumber(f.salesMix), 0);
        if (Math.round(totalMix) !== 100) {
            checks.push({ id: 'sales-mix', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
                message: totalMix > 0
                    ? `La répartition des ventes des SKUs actifs totalise ${formatNumber(totalMix, 1)} % au lieu de 100 % : les moyennes pondérées sont faussées.`
                    : 'La répartition des ventes des SKUs actifs n\'est pas renseignée : les moyennes pondérées ne sont pas fiables.' });
        }
    }

    // Frais fixes mal répartis (19/11) : ce qu'aucune ligne n'attribue à un contenant est compté dans Général
    // (jamais perdu) ; un dépassement gonfle les coûts. Dans les deux cas l'utilisateur doit le savoir.
    if (fixedCosts && fixedCosts.unallocated > 0) {
        checks.push({ id: 'fixed-costs-unallocated', tab: 'income-statement', tabLabel: 'État des résultats → Frais fixes',
            message: `${formatNumber(fixedCosts.unallocated, 2)} $ de frais fixes ne sont répartis dans aucune activité ni aucun canal : ils sont comptés dans « Général ».` });
    }
    if (fixedCosts && fixedCosts.overAllocated > 0) {
        checks.push({ id: 'fixed-costs-over-allocated', tab: 'income-statement', tabLabel: 'État des résultats → Frais fixes',
            message: `Les frais fixes répartis dépassent le total saisi de ${formatNumber(fixedCosts.overAllocated, 2)} $ : les coûts par produit sont surévalués.` });
    }

    const missingPrice = (list) => list.filter(i => !i.isRecipe && !(parseLocaleNumber(i.purchasePrice) > 0)).length;
    const stale = (list) => {
        const limit = new Date(now); limit.setDate(limit.getDate() - STALE_DAYS);
        return list.filter(i => !i.isRecipe && i.lastUpdated && new Date(i.lastUpdated) < limit).length;
    };
    const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

    const ingNoPrice = missingPrice(baseIngredients);
    if (ingNoPrice > 0) checks.push({ id: 'ingredients-no-price', tab: 'ingredients', tabLabel: 'Ingrédients',
        message: `${plural(ingNoPrice, 'ingrédient', 'ingrédients')} sans prix d'achat.` });
    const pkgNoPrice = missingPrice(basePackaging);
    if (pkgNoPrice > 0) checks.push({ id: 'packaging-no-price', tab: 'packaging', tabLabel: 'Emballage',
        message: `${plural(pkgNoPrice, 'emballage', 'emballages')} sans prix d'achat.` });

    const ingStale = stale(baseIngredients);
    if (ingStale > 0) checks.push({ id: 'ingredients-stale', tab: 'ingredients', tabLabel: 'Ingrédients',
        message: `${plural(ingStale, 'ingrédient', 'ingrédients')} dont le prix n'a pas été mis à jour depuis plus de ${STALE_DAYS} jours.` });
    const pkgStale = stale(basePackaging);
    if (pkgStale > 0) checks.push({ id: 'packaging-stale', tab: 'packaging', tabLabel: 'Emballage',
        message: `${plural(pkgStale, 'emballage', 'emballages')} dont le prix n'a pas été mis à jour depuis plus de ${STALE_DAYS} jours.` });

    return checks;
}
