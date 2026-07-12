// Sérialisation d'un projet (sauvegarde/chargement JSON), extraite de App.jsx pour être testable
// isolément. C'est ici que vit la logique de rétrocompatibilité (migration des anciens formats,
// valeurs par défaut des champs ajoutés après coup) — exactement le genre de code qui casse en
// silence. buildProjectData/parseProjectData sont des fonctions pures ; App.jsx ne garde que les
// effets de bord (Blob/download, FileReader, setters d'état).

// Construit l'objet exporté vers le fichier .json à partir de l'état courant.
export function buildProjectData({ companyName, logoUrl, generalInfo, baseIngredients, products, trackingPoints, laborDatabase, uiSettings }) {
    return { companyName, logoUrl, generalInfo, baseIngredients, products, trackingPoints, laborDatabase, uiSettings };
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

    const baseIngredients = (data.baseIngredients || data.ingredientsList || emptyState.ingredientsList).map(ing => ({
        ...ing,
        uniqueId: ing.uniqueId || '',
        isRecipe: ing.isRecipe || false,
        id: String(ing.id || `manual_${Date.now()}_${Math.random()}`),
        lossPercentage: ing.lossPercentage || 0,
        lastUpdated: ing.lastUpdated || new Date().toISOString().split('T')[0]
    }));

    const products = (data.products || emptyState.products).map(p => ({
        ...p,
        id: String(p.id || Date.now() + Math.random()),
        isResaleProduct: p.isResaleProduct || false,
        purchaseCost: p.purchaseCost || 0,
        category: p.category || '',
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
    }));

    return { companyName, logoUrl, generalInfo, uiSettings, trackingPoints, laborDatabase, baseIngredients, products };
}
