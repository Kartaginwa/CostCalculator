import { parseLocaleNumber } from '../utils.js';

// Un « choc » perturbe d'un pourcentage soit un prix d'INTRANT, soit un salaire de MAIN-D'ŒUVRE.
// Forme : { type: 'ingredient' | 'labor', scope, target, selectedIds, percent }.
//   - type 'ingredient' : scope 'all' | 'provider' (target = fournisseur) | 'selection' (selectedIds = ids d'ingrédients)
//   - type 'labor'      : scope 'all' | 'post'     (target = id du poste)  | 'selection' (selectedIds = ids d'employés)
// Plusieurs chocs qui touchent une même cible se cumulent MULTIPLICATIVEMENT (composition des
// variations successives). Fonctions pures : les éléments non touchés sont renvoyés inchangés.

// Un choc est « actif » s'il a une variation non nulle ET une portée exploitable.
export function shockIsActive(shock) {
    if (!shock || parseLocaleNumber(shock.percent) === 0) return false;
    if (shock.scope === 'all') return true;
    if (shock.scope === 'provider' || shock.scope === 'post') return !!shock.target;
    if (shock.scope === 'selection') return Array.isArray(shock.selectedIds) && shock.selectedIds.length > 0;
    return false;
}

// Applique les chocs d'INTRANTS aux ingrédients de base (ajuste unitPrice et purchasePrice).
export function applyCostShocks(baseIngredients, shocks) {
    const active = (shocks || []).filter(s => (s.type ?? 'ingredient') === 'ingredient' && shockIsActive(s));
    if (active.length === 0) return baseIngredients;

    return baseIngredients.map(ing => {
        let multiplier = 1;
        for (const shock of active) {
            const matches = shock.scope === 'all'
                || (shock.scope === 'provider' && ing.provider === shock.target)
                || (shock.scope === 'selection' && shock.selectedIds.includes(ing.id));
            if (matches) multiplier *= (1 + parseLocaleNumber(shock.percent) / 100);
        }
        if (multiplier === 1) return ing;
        return {
            ...ing,
            unitPrice: (parseLocaleNumber(ing.unitPrice) || 0) * multiplier,
            purchasePrice: (parseLocaleNumber(ing.purchasePrice) || 0) * multiplier,
        };
    });
}

// Applique les chocs de MAIN-D'ŒUVRE à la base de MO (ajuste le taux horaire de chaque employé).
// Les charges sociales et vacances (en %) sont conservées : elles s'appliquent au taux ajusté dans
// le moteur de calcul. La productivité et les heures ne dépendent pas des salaires — inchangées.
export function applyLaborShocks(laborDatabase, shocks) {
    const active = (shocks || []).filter(s => s.type === 'labor' && shockIsActive(s));
    if (active.length === 0) return laborDatabase;

    return (laborDatabase || []).map(post => {
        let changed = false;
        const employees = (post.employees || []).map(emp => {
            let multiplier = 1;
            for (const shock of active) {
                const matches = shock.scope === 'all'
                    || (shock.scope === 'post' && post.id === shock.target)
                    || (shock.scope === 'selection' && shock.selectedIds.includes(emp.id));
                if (matches) multiplier *= (1 + parseLocaleNumber(shock.percent) / 100);
            }
            if (multiplier === 1) return emp;
            changed = true;
            return { ...emp, hourlyRate: (parseLocaleNumber(emp.hourlyRate) || 0) * multiplier };
        });
        return changed ? { ...post, employees } : post;
    });
}
