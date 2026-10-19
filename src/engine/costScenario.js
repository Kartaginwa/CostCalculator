import { parseLocaleNumber } from '../utils.js';

// Un « choc » perturbe d'un pourcentage soit un prix d'INTRANT, soit un salaire de MAIN-D'ŒUVRE.
// Forme : { type: 'ingredient' | 'labor', scope, target, selectedIds, percent }.
//   - type 'ingredient' : scope 'all' | 'provider' (target = fournisseur) | 'format' (target = id de
//     format) | 'activity' (target = id d'activité) | 'selection' (selectedIds = ids d'ingrédients)
//   - type 'labor'      : scope 'all' | 'post' (target = id du poste) | 'format' | 'activity' (mêmes
//     cibles que ci-dessus — un format/une activité implique les POSTES utilisés dans ses étapes de
//     production) | 'selection' (selectedIds = ids d'employés)
// Plusieurs chocs qui touchent une même cible se cumulent MULTIPLICATIVEMENT (composition des
// variations successives). Fonctions pures : les éléments non touchés sont renvoyés inchangés.

// Un choc est « actif » s'il a une variation non nulle ET une portée exploitable.
export function shockIsActive(shock) {
    if (!shock || parseLocaleNumber(shock.percent) === 0) return false;
    if (shock.scope === 'all') return true;
    if (shock.scope === 'provider' || shock.scope === 'post' || shock.scope === 'format' || shock.scope === 'activity') return !!shock.target;
    if (shock.scope === 'selection') return Array.isArray(shock.selectedIds) && shock.selectedIds.length > 0;
    return false;
}

// Résout un choc à portée 'format'/'activity' en son équivalent 'selection' concret (ids
// d'ingrédients ou d'employés), à partir des lignes `productsWithCosts` (une par FORMAT, Phase
// 1.6) — réutilise le filtrage 'selection' déjà présent dans applyCostShocks/applyLaborShocks
// plutôt que de dupliquer la logique de correspondance. Un choc 'all'/'provider'/'post'/'selection'
// traverse inchangé. Ingrédients DIRECTS du format seulement (pas les sous-recettes imbriquées,
// elles-mêmes des lignes `productsWithCosts` distinctes qu'on peut cibler séparément).
export function expandShockScopes(shocks, { productsWithCosts = [], laborDatabase = [] } = {}) {
    const ingredientIdsForFormat = (formatId) => {
        const row = productsWithCosts.find(r => r.id === formatId);
        return [...new Set((row?.format?.ingredients || []).map(i => i.id))];
    };
    const ingredientIdsForActivity = (activityId) => {
        const ids = new Set();
        productsWithCosts.forEach(row => {
            if (row.activityId === activityId) (row.format?.ingredients || []).forEach(i => ids.add(i.id));
        });
        return [...ids];
    };
    const employeeIdsForPostNames = (postNames) => {
        const ids = [];
        laborDatabase.forEach(post => {
            if (postNames.has(post.postName)) (post.employees || []).forEach(e => ids.push(e.id));
        });
        return ids;
    };
    const postNamesForFormat = (formatId) => {
        const row = productsWithCosts.find(r => r.id === formatId);
        const names = new Set();
        (row?.format?.productionSteps || []).forEach(step => (step.personnel || []).forEach(p => names.add(p.postId)));
        return names;
    };
    const postNamesForActivity = (activityId) => {
        const names = new Set();
        productsWithCosts.forEach(row => {
            if (row.activityId === activityId) {
                (row.format?.productionSteps || []).forEach(step => (step.personnel || []).forEach(p => names.add(p.postId)));
            }
        });
        return names;
    };

    return (shocks || []).map(shock => {
        if (shock.type === 'ingredient' && shock.scope === 'format') {
            return { ...shock, scope: 'selection', selectedIds: ingredientIdsForFormat(shock.target) };
        }
        if (shock.type === 'ingredient' && shock.scope === 'activity') {
            return { ...shock, scope: 'selection', selectedIds: ingredientIdsForActivity(shock.target) };
        }
        if (shock.type === 'labor' && shock.scope === 'format') {
            return { ...shock, scope: 'selection', selectedIds: employeeIdsForPostNames(postNamesForFormat(shock.target)) };
        }
        if (shock.type === 'labor' && shock.scope === 'activity') {
            return { ...shock, scope: 'selection', selectedIds: employeeIdsForPostNames(postNamesForActivity(shock.target)) };
        }
        return shock;
    });
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
