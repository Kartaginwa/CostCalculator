import { parseLocaleNumber } from '../utils.js';

// Phase 3.4 (révisé 06/10) : l'app doit rester utilisable sans jamais toucher aux canaux — le mix
// des ventes en % saisi à la main reste donc un mode de saisie à part entière, PAS remplacé par
// les unités. Les deux coexistent, détectés automatiquement par format, sans interrupteur :
//
// - Un format qui a au moins une unité saisie quelque part dans ses `channelPrices[]` (import ou
//   édition manuelle) passe en mode "unités" : son % se DÉDUIT de ses unités réelles — précis,
//   mais plus éditable directement (voir ProductInfo.jsx, qui désactive alors le champ %).
// - Un format qui n'a jamais eu d'unité saisie (volume toujours 0) reste en mode "% manuel" : sa
//   valeur reste exactement ce que l'utilisateur a tapée, jamais touchée ici.
//
// Les formats "unités" se partagent le RESTE du 100 % une fois la somme des % manuels retirée
// (jamais négatif), réparti au prorata de leurs unités réelles respectives. Si les % manuels
// occupent déjà tout l'espace, un format qui bascule en mode "unités" obtient 0 % tant que
// l'utilisateur ne réduit pas les % manuels pour lui faire de la place — pas de vol silencieux de
// part : l'avertissement déjà existant (somme du mix ≠ 100 %) reste le signal visible de ce cas.
//
// Fonction pure : ne mute pas `products`, retourne une copie avec `format.salesMix` recalculé
// pour les formats "unités" uniquement (et mirroré sur `product.salesMix` pour le format par
// défaut, index 0 — voir FORMAT_FLAT_MIRROR_FIELDS/App.jsx), ainsi que le chiffre d'affaires total
// dérivé des mêmes volumes (prix net × volume, sommé sur tout le menu) — utile à l'import, qui
// s'en sert pour recaler `generalInfo.totalRevenue`.
export function computeSalesMixFromChannelPrices(products) {
    const formatInfos = [];
    let grandTotalRevenue = 0;

    products.forEach((p, productIndex) => {
        (p.formats || []).forEach((f, formatIndex) => {
            let volume = 0;
            (f.channelPrices || []).forEach(cp => {
                const v = parseLocaleNumber(cp.volume) || 0;
                volume += v;
                grandTotalRevenue += v * (parseLocaleNumber(cp.netPrice) || 0);
            });
            formatInfos.push({ productIndex, formatIndex, volume, currentSalesMix: parseLocaleNumber(f.salesMix) || 0 });
        });
    });

    const unitFormats = formatInfos.filter(f => f.volume > 0);
    const manualFormats = formatInfos.filter(f => f.volume === 0);
    const manualPercentSum = manualFormats.reduce((sum, f) => sum + f.currentSalesMix, 0);
    const remainingPercent = Math.max(0, 100 - manualPercentSum);
    const unitTotalVolume = unitFormats.reduce((sum, f) => sum + f.volume, 0);

    const newProducts = products.map(p => ({ ...p, formats: (p.formats || []).map(f => ({ ...f })) }));
    unitFormats.forEach(({ productIndex, formatIndex, volume }) => {
        const salesMix = unitTotalVolume > 0 ? Number(((volume / unitTotalVolume) * remainingPercent).toFixed(2)) : 0;
        newProducts[productIndex].formats[formatIndex].salesMix = salesMix;
        if (formatIndex === 0) {
            newProducts[productIndex].salesMix = salesMix;
        }
    });
    // manualFormats : salesMix laissé tel quel (déjà préservé par la copie ci-dessus).

    return { products: newProducts, totalRevenue: grandTotalRevenue };
}
