import { parseLocaleNumber } from '../utils.js';

// Dérive la volatilité d'un prix/coût à partir des points de référence (snapshots) — sans journal
// de transactions. Sur ≥ 2 points, on reconstitue une série dans le temps par item et on calcule :
//   - tendance = (dernier − premier) / premier (%) ;
//   - volatilité = AMPLITUDE = (max − min) / moyenne (%).
// Un item est « volatil » au-delà d'un seuil d'amplitude (croisé ensuite avec la classe ABC pour
// les ingrédients/l'emballage).

export const VOLATILE_THRESHOLD = 10; // % d'amplitude à partir duquel le prix est jugé volatil (modéré+)
export const HIGH_THRESHOLD = 20;     // % d'amplitude pour la volatilité « élevée »

// Fonction pure commune aux dimensions suivies (ingrédients, emballage) — seule la façon
// d'extraire {id, name, provider, price} d'un point de référence change entre elles (Phase 6,
// 15/10 : généralisée depuis l'ancienne computeIngredientVolatility, qui ne lisait que
// `pt.baseIngredients`, pour éviter de dupliquer cette logique). Portait aussi le coût direct par
// format jusqu'au 22/10 (retiré, retour utilisateur — redondant avec le détail matière/
// emballage/MO déjà visible ailleurs dans Rapport et suivi, voir SummaryTable.jsx).
function computeCatalogVolatility(trackingPoints, extractItems) {
    const points = [...(trackingPoints || [])]
        .filter(p => p && p.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (points.length < 2) {
        return { hasEnoughData: false, pointCount: points.length, list: [], byId: {}, byName: {} };
    }

    // Série de prix/coûts par item, dans l'ordre chronologique. Les valeurs nulles/absentes (item
    // pas encore présent à cette date, ou sans prix de vente pour un format) sont ignorées.
    const seriesById = {};
    for (const pt of points) {
        for (const item of extractItems(pt)) {
            if (!(item.price > 0)) continue;
            if (!seriesById[item.id]) seriesById[item.id] = { id: item.id, name: item.name, provider: item.provider, prices: [] };
            seriesById[item.id].name = item.name;
            seriesById[item.id].provider = item.provider;
            seriesById[item.id].prices.push(item.price);
        }
    }

    const list = Object.values(seriesById).map(s => {
        const prices = s.prices;
        const first = prices[0];
        const last = prices[prices.length - 1];
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const amplitudePercent = mean > 0 ? ((max - min) / mean) * 100 : 0;
        const trendPercent = first > 0 ? ((last - first) / first) * 100 : 0;
        const enough = prices.length >= 2;
        const tier = !enough ? 'faible'
            : amplitudePercent >= HIGH_THRESHOLD ? 'elevee'
            : amplitudePercent >= VOLATILE_THRESHOLD ? 'moderee'
            : 'faible';
        return {
            id: s.id, name: s.name, provider: s.provider, count: prices.length,
            currentPrice: last, trendPercent, amplitudePercent, tier,
            isVolatile: enough && amplitudePercent >= VOLATILE_THRESHOLD,
        };
    }).sort((a, b) => b.amplitudePercent - a.amplitudePercent);

    return {
        hasEnoughData: true,
        pointCount: points.length,
        list,
        byId: Object.fromEntries(list.map(x => [x.id, x])),
        byName: Object.fromEntries(list.map(x => [x.name, x])),
    };
}

export function computeIngredientVolatility(trackingPoints) {
    return computeCatalogVolatility(trackingPoints, pt => (pt.baseIngredients || []).map(ing => ({
        id: ing.id, name: ing.name, provider: ing.provider, price: parseLocaleNumber(ing.unitPrice),
    })));
}

// Emballage : toujours un suivi SÉPARÉ de celui des ingrédients (voir SummaryTable.jsx), même
// principe que la Phase 2 (coût d'emballage comme poste distinct du coût matière).
export function computePackagingVolatility(trackingPoints) {
    return computeCatalogVolatility(trackingPoints, pt => (pt.basePackaging || []).map(pkg => ({
        id: pkg.id, name: pkg.name, provider: pkg.provider, price: parseLocaleNumber(pkg.unitPrice),
    })));
}
