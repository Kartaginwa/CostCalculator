import { parseLocaleNumber } from '../utils.js';

// Dérive la volatilité du prix d'achat de chaque ingrédient à partir des points de référence
// (snapshots) — sans journal de transactions. Chaque snapshot contient une copie des ingrédients
// (avec leur unitPrice) à sa date. Sur ≥ 2 points, on reconstitue une série de prix par ingrédient
// et on calcule :
//   - tendance = (dernier − premier) / premier (%) ;
//   - volatilité = AMPLITUDE = (max − min) / moyenne (%).
// Un ingrédient est « volatil » au-delà d'un seuil d'amplitude (croisé ensuite avec la classe ABC).

export const VOLATILE_THRESHOLD = 10; // % d'amplitude à partir duquel le prix est jugé volatil (modéré+)
export const HIGH_THRESHOLD = 20;     // % d'amplitude pour la volatilité « élevée »

export function computeIngredientVolatility(trackingPoints) {
    const points = [...(trackingPoints || [])]
        .filter(p => p && p.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (points.length < 2) {
        return { hasEnoughData: false, pointCount: points.length, list: [], byId: {}, byName: {} };
    }

    // Série de prix (unitPrice) par ingrédient, dans l'ordre chronologique. Les prix nuls/absents
    // (ingrédient pas encore présent à cette date) sont ignorés.
    const seriesById = {};
    for (const pt of points) {
        for (const ing of (pt.baseIngredients || [])) {
            const price = parseLocaleNumber(ing.unitPrice);
            if (!(price > 0)) continue;
            if (!seriesById[ing.id]) seriesById[ing.id] = { id: ing.id, name: ing.name, provider: ing.provider, prices: [] };
            seriesById[ing.id].name = ing.name;
            seriesById[ing.id].provider = ing.provider;
            seriesById[ing.id].prices.push(price);
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
