// Dérivations pures à partir de l'historique de suivi (trackingPoints), extraites de
// TrackingTab.jsx pour être testables isolément — au même titre que priceVolatility.js.

// Construit la liste des formats suivables (menu déroulant "Analyse par recette") à partir de
// tout l'historique. Phase 1.6c : chaque ligne de `point.productsWithCosts` représente désormais
// un FORMAT, pas un produit (voir analysisData.js) — mais un point de référence créé AVANT ce
// correctif a ses lignes à l'ancienne forme (une par produit, sans `displayName`). Les deux
// formes coexistent dans le même historique sans migration : chaque ligne reste lisible telle
// quelle (`id` sert de clé de regroupement dans les deux cas — l'id du format pour les points
// récents, l'id du produit pour les anciens — jamais de collision entre les deux puisque leurs
// espaces d'id ne se recoupent pas), seul le libellé affiché se réduit à `platName` quand
// `displayName` n'existe pas encore sur cette ligne.
export function buildTrackableProducts(trackingPoints) {
    const allProducts = new Map();
    trackingPoints.forEach(point => {
        (point.productsWithCosts || []).forEach(p => {
            if (!allProducts.has(p.id)) {
                allProducts.set(p.id, p.displayName || p.platName);
            }
        });
    });
    return Array.from(allProducts, ([id, name]) => ({ id, name }));
}
