import { parseLocaleNumber } from '../utils.js';

// Applique une liste de « chocs » de coût aux ingrédients de base et renvoie une nouvelle liste
// avec les prix ajustés. Chaque choc cible soit TOUS les ingrédients ('all'), soit un FOURNISSEUR
// ('provider'), soit une SÉLECTION d'ingrédients ('selection'), et applique une variation en %.
// Plusieurs chocs se cumulent MULTIPLICATIVEMENT (composition des variations successives : un
// ingrédient touché par « +15 % » puis « +10 % » subit ×1,15 × 1,10). Fonction pure, sans effet de
// bord — les ingrédients non touchés sont renvoyés inchangés (même référence).
export function applyCostShocks(baseIngredients, shocks) {
    const active = (shocks || []).filter(shockIsActive);
    if (active.length === 0) return baseIngredients;

    return baseIngredients.map(ing => {
        let multiplier = 1;
        for (const shock of active) {
            if (shockMatchesIngredient(shock, ing)) {
                multiplier *= (1 + parseLocaleNumber(shock.percent) / 100);
            }
        }
        if (multiplier === 1) return ing;
        return {
            ...ing,
            unitPrice: (parseLocaleNumber(ing.unitPrice) || 0) * multiplier,
            purchasePrice: (parseLocaleNumber(ing.purchasePrice) || 0) * multiplier,
        };
    });
}

// Un choc est « actif » s'il a une variation non nulle ET une portée exploitable.
export function shockIsActive(shock) {
    if (!shock || parseLocaleNumber(shock.percent) === 0) return false;
    if (shock.scope === 'all') return true;
    if (shock.scope === 'provider') return !!shock.provider;
    if (shock.scope === 'selection') return Array.isArray(shock.selectedIds) && shock.selectedIds.length > 0;
    return false;
}

function shockMatchesIngredient(shock, ing) {
    if (shock.scope === 'all') return true;
    if (shock.scope === 'provider') return ing.provider === shock.provider;
    if (shock.scope === 'selection') return shock.selectedIds.includes(ing.id);
    return false;
}
