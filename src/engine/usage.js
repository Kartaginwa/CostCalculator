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
        const used = formatsOf(p).some(f => (rowsKey === 'packagingItems' || !f.isResaleProduct) && (f[rowsKey] || []).some(row => wanted.has(row.id)));
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

// --- Boucles de sous-recettes (20/11, audit constat 9) ---
// Une recette A qui utilise B, qui utilise A (directement ou par plusieurs étapes) n'a pas de coût définissable : le moteur
// coupe la boucle et compte cette branche à 0 $. On empêche de créer une boucle à la saisie et on signale celles qui existent.
// Même résolution qu'au calcul : la ligne désigne un FORMAT de sous-recette ou (anciens projets) un produit, repli sur son
// premier format.
const subFormatOf = (products, id) => {
    for (const p of products || []) {
        if (!p.isIngredient) continue;
        const fmt = (p.formats || []).find(f => f.id === id);
        if (fmt) return { product: p, fmt };
    }
    const byProduct = (products || []).find(p => p.isIngredient && p.id === id);
    return byProduct ? { product: byProduct, fmt: byProduct.formats?.[0] || byProduct } : null;
};

const subFormatsUsedBy = (products, fmt) => (fmt.isResaleProduct ? [] : (fmt.ingredients || []))
    .map(row => subFormatOf(products, row.id))
    .filter(Boolean);

// Boucles existantes : une liste de noms de produits par boucle (sans doublon).
export const findRecipeLoops = (products) => {
    const loops = new Map();
    const state = {}; // 1 = en cours, 2 = terminé
    const walk = (product, fmt, stack) => {
        state[fmt.id] = 1;
        stack.push({ product, fmt });
        for (const next of subFormatsUsedBy(products, fmt)) {
            if (state[next.fmt.id] === 1) {
                const start = stack.findIndex(e => e.fmt.id === next.fmt.id);
                const names = [...new Set(stack.slice(start).map(e => (e.product.platName || '').trim() || 'Sans nom'))];
                loops.set([...names].sort().join('|'), names);
            } else if (!state[next.fmt.id]) {
                walk(next.product, next.fmt, stack);
            }
        }
        stack.pop();
        state[fmt.id] = 2;
    };
    for (const p of products || []) {
        for (const fmt of formatsOf(p)) if (!state[fmt.id]) walk(p, fmt, []);
    }
    return [...loops.values()];
};

// Ajouter `candidateId` (un format de sous-recette) comme ingrédient de ce produit créerait-il une boucle ? Vrai si la
// sous-recette candidate utilise déjà, directement ou non, un format de ce produit.
export const wouldCreateRecipeLoop = (products, product, candidateId) => {
    const own = new Set(formatsOf(product).map(f => f.id));
    const start = subFormatOf(products, candidateId);
    if (!start) return false;
    const seen = new Set();
    const stack = [start];
    while (stack.length > 0) {
        const { fmt } = stack.pop();
        if (own.has(fmt.id)) return true;
        if (seen.has(fmt.id)) continue;
        seen.add(fmt.id);
        stack.push(...subFormatsUsedBy(products, fmt));
    }
    return false;
};
