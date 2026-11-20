// Où un ingrédient, un emballage ou une sous-recette est-il utilisé ? (19/11, audit complémentaire)
// Sert à prévenir l'utilisateur AVANT une suppression : le moteur compte à 0 $ une ligne de recette dont la
// référence n'existe plus, ce qui baisse silencieusement le coût du produit qui l'utilisait.
// Fonctions pures : aucune donnée n'est modifiée.

const formatsOf = (p) => (p.formats && p.formats.length > 0 ? p.formats : [p]);

const namesUsing = (products, rowsKey, ids, excludeProductId = null) => {
    const wanted = new Set(ids);
    const names = new Set();
    for (const p of products || []) {
        if (excludeProductId !== null && p.id === excludeProductId) continue;
        const used = formatsOf(p).some(f => !f.isResaleProduct && (f[rowsKey] || []).some(row => wanted.has(row.id)));
        if (used) names.add((p.platName || '').trim() || 'Sans nom');
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
};

// Noms des produits dont une recette utilise cet ingrédient de base.
export const findIngredientUsages = (products, ingredientId) => namesUsing(products, 'ingredients', [ingredientId]);

// Noms des produits dont une recette utilise cet emballage.
export const findPackagingUsages = (products, packagingId) => namesUsing(products, 'packagingItems', [packagingId]);

// Noms des AUTRES produits qui utilisent cette sous-recette (un format précis, ou tous les formats du produit, plus
// l'ancien identifiant « produit » que portent les projets antérieurs aux formats).
export const findSubRecipeUsages = (products, product, formatId = null) => {
    if (!product || !product.isIngredient) return [];
    const ids = formatId !== null ? [formatId] : [product.id, ...(product.formats || []).map(f => f.id)];
    return namesUsing(products, 'ingredients', ids, product.id);
};

// Phrase prête à afficher : « A, B et 2 autres ».
export const formatNameList = (names) => {
    if (names.length <= 3) return names.join(', ');
    const rest = names.length - 3;
    return `${names.slice(0, 3).join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
};
