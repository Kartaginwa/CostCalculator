// Sérialisation d'un projet (sauvegarde/chargement JSON), extraite de App.jsx pour être testable
// isolément. C'est ici que vit la logique de rétrocompatibilité (migration des anciens formats,
// valeurs par défaut des champs ajoutés après coup) — exactement le genre de code qui casse en
// silence. buildProjectData/parseProjectData sont des fonctions pures ; App.jsx ne garde que les
// effets de bord (Blob/download, FileReader, setters d'état).

import { buildDefaultFormat, stripFormatOwnedFields } from './initialState.js';

// Construit l'objet exporté vers le fichier .json à partir de l'état courant.
export function buildProjectData({ companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, uiSettings }) {
    return { companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, uiSettings };
}

// Reconstruit les tranches d'état à partir des données JSON chargées, en appliquant migrations et
// valeurs par défaut. `emptyState` fournit les valeurs de repli (getEmptyState()). Ne touche à
// aucun état React : retourne un objet que l'appelant applique via ses setters.
export function parseProjectData(data, emptyState) {
    const companyName = data.companyName || emptyState.companyName;
    const logoUrl = data.logoUrl || emptyState.logoUrl;

    const generalInfo = { ...emptyState.generalInfo, ...data.generalInfo };
    // Projets antérieurs à l'ajout du champ menuRevenuePercentage : on force 100 % (menu entier).
    if (data.generalInfo && data.generalInfo.menuRevenuePercentage === undefined) {
        generalInfo.menuRevenuePercentage = 100;
    }

    const uiSettings = { ...emptyState.uiSettings, ...data.uiSettings };

    const trackingPoints = (data.trackingPoints || []).map(point => ({
        ...point,
        // Rétrocompatibilité : nom/note absents des anciens points de référence.
        name: point.name || new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
        note: point.note || ''
    }));

    let laborDatabase = data.laborDatabase || [];
    // Migration depuis l'ancien format « à plat » (liste d'employés sans regroupement par poste).
    if (laborDatabase.length > 0 && laborDatabase[0].employees === undefined) {
        const postsMap = new Map();
        laborDatabase.forEach(employee => {
            const postName = employee.postName || 'Non défini';
            if (!postsMap.has(postName)) {
                postsMap.set(postName, { id: `post_${Date.now()}_${postName}`, postName, employees: [] });
            }
            postsMap.get(postName).employees.push({ ...employee, id: employee.id || `emp_${Date.now()}_${Math.random()}` });
        });
        laborDatabase = Array.from(postsMap.values());
    }

    // Migration : projets antérieurs à l'ajout des activités de production (ligne de fabrication).
    // Toujours au moins une activité par défaut ("Général"), pour que l'étape suivante (rattacher
    // chaque produit à une activité) ait toujours une valeur de repli.
    const productionActivities = (data.productionActivities && data.productionActivities.length > 0)
        ? data.productionActivities
        : emptyState.productionActivities;

    // Migration : projets antérieurs à l'ajout des Circuits de vente (Phase 3) — un seul circuit
    // par défaut (« Vente directe », sans maillon), qui collapse au comportement historique à prix
    // unique (voir `initialState.js`).
    const salesChannels = (data.salesChannels && data.salesChannels.length > 0)
        ? data.salesChannels
        : emptyState.salesChannels;

    const baseIngredients = (data.baseIngredients || data.ingredientsList || emptyState.ingredientsList).map(ing => ({
        ...ing,
        uniqueId: ing.uniqueId || '',
        isRecipe: ing.isRecipe || false,
        id: String(ing.id || `manual_${Date.now()}_${Math.random()}`),
        lossPercentage: ing.lossPercentage || 0,
        lastUpdated: ing.lastUpdated || new Date().toISOString().split('T')[0]
    }));

    // Migration : projets antérieurs à l'ajout du Packaging (Phase 2) — catalogue vide par défaut.
    const basePackaging = (data.basePackaging || emptyState.basePackaging || []).map(pkg => ({
        ...pkg,
        uniqueId: pkg.uniqueId || '',
        id: String(pkg.id || `pkg_${Date.now()}_${Math.random()}`),
        lossPercentage: pkg.lossPercentage || 0,
        lastUpdated: pkg.lastUpdated || new Date().toISOString().split('T')[0]
    }));

    const products = (data.products || emptyState.products).map(p => {
        const normalized = {
            ...p,
            id: String(p.id || Date.now() + Math.random()),
            isResaleProduct: p.isResaleProduct || false,
            purchaseCost: p.purchaseCost || 0,
            category: p.category || '',
            // Migration : produits antérieurs à l'ajout des activités de production — rattachés à
            // la première activité disponible (« Général » par défaut).
            activityId: p.activityId || productionActivities[0]?.id || '',
            portionSize: p.portionSize !== undefined ? p.portionSize : 1,
            portionUnit: p.portionUnit || 'unité',
            isIngredient: p.isIngredient || false,
            onMenu: p.onMenu !== undefined ? p.onMenu : true,
            salesMix: p.salesMix !== undefined ? p.salesMix : 0,
            prixVente: p.prixVente !== undefined ? p.prixVente : 0,
            nbPortions: p.nbPortions || 1,
            indirectCosts: p.indirectCosts || { method: 'time', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 },
            ingredients: (p.ingredients || []).map(ing => ({ ...ing, rowId: ing.rowId || `ing_${Date.now()}_${Math.random()}`, yieldPercentage: ing.yieldPercentage || 100 })),
            productionSteps: (p.productionSteps || []).map(step => ({ ...step, stepId: step.stepId || `step_${Date.now()}_${Math.random()}` })),
            labor: undefined // Supprime l'ancienne clé
        };
        // Migration : produits antérieurs à la notion de format de vente — un format par défaut
        // est construit à partir des champs "à plat" déjà normalisés ci-dessus (prixVente,
        // nbPortions, ingredients, productionSteps...).
        //
        // Trois générations de fichiers à couvrir :
        //  1. Avant la Phase 1.3 (pas de `formats` du tout) : `buildDefaultFormat(normalized)`
        //     construit le premier format à partir des champs à plat ci-dessus.
        //  2. Phases 1.3-1.5 (`formats` existe, mais chaque format ne portait encore que les
        //     champs de vente — pas encore les ingrédients/étapes/revente, qui vivaient alors sur
        //     le produit) : on complète le format par défaut (index 0 seulement) avec ces champs
        //     à plat s'il ne les a pas déjà.
        //  3. Après la correction du 23/09 (chaque format porte déjà sa propre fiche recette
        //     complète) : ses champs sont utilisés tels quels.
        normalized.formats = (p.formats && p.formats.length > 0)
            ? p.formats.map((f, index) => ({
                ...f,
                ingredients: (f.ingredients !== undefined ? f.ingredients : (index === 0 ? normalized.ingredients : []) || [])
                    .map(ing => ({ ...ing, rowId: ing.rowId || `ing_${Date.now()}_${Math.random()}`, yieldPercentage: ing.yieldPercentage || 100 })),
                // Phase 2.2 : concept entièrement nouveau, pas de génération antérieure à couvrir —
                // un format sans packagingItems reçoit simplement un catalogue vide.
                packagingItems: (f.packagingItems || []).map(item => ({ ...item, rowId: item.rowId || `pkgitem_${Date.now()}_${Math.random()}` })),
                productionSteps: (f.productionSteps !== undefined ? f.productionSteps : (index === 0 ? normalized.productionSteps : []) || [])
                    .map(step => ({ ...step, stepId: step.stepId || `step_${Date.now()}_${Math.random()}` })),
                isResaleProduct: f.isResaleProduct !== undefined ? f.isResaleProduct : (index === 0 ? normalized.isResaleProduct : false),
                purchaseCost: f.purchaseCost !== undefined ? f.purchaseCost : (index === 0 ? normalized.purchaseCost : 0),
                manualAllergens: f.manualAllergens !== undefined ? f.manualAllergens : (index === 0 ? (p.manualAllergens || []) : []),
                // Migration : projets antérieurs à la Phase 3.2 — un seul prix net sur le canal par
                // défaut, reprenant l'ancien prixVente (comportement inchangé). Le PREMIER élément
                // du tableau reste le canal "principal" dont le prix alimente le prixVente du
                // format (voir App.jsx, handleFormatChannelPricesChange).
                channelPrices: (f.channelPrices && f.channelPrices.length > 0) ? f.channelPrices : [{
                    id: `cp_${f.id || `${Date.now()}_${Math.random()}`}`,
                    channelId: 'channel_default',
                    netPrice: f.prixVente !== undefined ? f.prixVente : (index === 0 ? normalized.prixVente : 0),
                    volume: 0,
                }],
            }))
            : [buildDefaultFormat(normalized)];
        return stripFormatOwnedFields(normalized);
    });

    return { companyName, logoUrl, generalInfo, uiSettings, trackingPoints, laborDatabase, productionActivities, salesChannels, baseIngredients, basePackaging, products };
}
