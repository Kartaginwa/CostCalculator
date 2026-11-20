// Transformations pures de la fiche produit (19/11, audit complémentaire) : extraites d'App.jsx pour être testées et
// pour que chaque geste laisse les données dans un état cohérent. Aucune ne modifie son entrée.
import { parseLocaleNumber, FORMAT_FLAT_MIRROR_FIELDS } from '../utils.js';
import { computeSalesMixFromChannelPrices } from './salesMixFromChannels.js';

// Les champs « à plat » du produit sont le miroir de son PREMIER format (voir FORMAT_FLAT_MIRROR_FIELDS) : à rappeler
// chaque fois que le premier format change de place ou disparaît.
export function mirrorFirstFormat(product) {
    const first = (product.formats || [])[0];
    if (!first) return product;
    const mirrored = { ...product };
    for (const field of FORMAT_FLAT_MIRROR_FIELDS) {
        if (first[field] !== undefined) mirrored[field] = first[field];
    }
    return mirrored;
}

// Une COPIE de produit ou de format repart sans ventes : les prix de chaque canal sont conservés (point de départ
// utile), les volumes et la part des ventes sont vidés. Sinon la copie doublerait les ventes de l'original
// (revenus, frais fixes absorbés, point mort) sans que l'utilisateur ne le voie.
export function clearFormatVolumes(format) {
    return {
        ...format,
        salesMix: 0,
        channelPrices: (format.channelPrices || []).map(cp => ({ ...cp, id: `cp_${Date.now()}_${Math.random()}`, volume: '' })),
    };
}

// Retire un canal de vente de tous les formats : ses prix et volumes disparaissent avec lui, au lieu de rester cachés
// dans les données sans être comptés nulle part. Le prix « principal » (premier canal) est recalculé.
export function removeChannelFromProducts(products, channelId) {
    let removedCount = 0;
    const cleaned = products.map(product => {
        let changed = false;
        const formats = (product.formats || []).map(format => {
            const kept = (format.channelPrices || []).filter(cp => cp.channelId !== channelId);
            if (kept.length === (format.channelPrices || []).length) return format;
            removedCount += (format.channelPrices || []).length - kept.length;
            changed = true;
            return { ...format, channelPrices: kept, prixVente: kept.length > 0 ? parseLocaleNumber(kept[0].netPrice) : 0 };
        });
        return changed ? mirrorFirstFormat({ ...product, formats }) : product;
    });
    if (removedCount === 0) return { products, removedCount: 0 };
    return { products: computeSalesMixFromChannelPrices(cleaned).products, removedCount };
}
