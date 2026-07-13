import { calculateCosts } from '../engine/calculateCosts.js';

// Profils d'évolution de prix par ingrédient, utilisés pour générer l'historique des points de
// suivi (démo). trend = inflation mensuelle ; vol = amplitude de variation ; freq = fréquence de
// l'oscillation. À m = 0 (aujourd'hui) le facteur vaut 1 → le prix actuel est celui de l'ingrédient.
const PRICE_PROFILES = {
    ing_1: { trend: 0.003, vol: 0.10, freq: 0.55 },  // saumon — très volatil
    ing_2: { trend: 0.004, vol: 0.12, freq: 0.48 },  // pétoncles — très volatil
    ing_3: { trend: 0.005, vol: 0.09, freq: 0.62 },  // filet mignon
    ing_4: { trend: 0.003, vol: 0.04, freq: 0.50 },  // poulet
    ing_5: { trend: 0.004, vol: 0.07, freq: 0.44 },  // agneau
    ing_6: { trend: 0.002, vol: 0.06, freq: 0.52 },  // pommes de terre — saisonnier
    ing_7: { trend: 0.002, vol: 0.16, freq: 0.40 },  // tomates — très saisonnier
    ing_8: { trend: 0.002, vol: 0.08, freq: 0.58 },  // champignons
    ing_9: { trend: 0.002, vol: 0.05, freq: 0.60 },  // échalote
    ing_10: { trend: 0.003, vol: 0.06, freq: 0.46 }, // ail
    ing_11: { trend: 0.007, vol: 0.05, freq: 0.66 }, // huile d'olive — forte inflation
    ing_12: { trend: 0.003, vol: 0.02, freq: 0.50 }, // farine
    ing_13: { trend: 0.003, vol: 0.02, freq: 0.54 }, // crème
    ing_14: { trend: 0.003, vol: 0.02, freq: 0.50 }, // fromage en grains
    ing_15: { trend: 0.005, vol: 0.02, freq: 0.60 }, // parmesan — hausse régulière
    ing_16: { trend: 0.004, vol: 0.06, freq: 0.42 }, // beurre
    ing_17: { trend: 0.002, vol: 0.02, freq: 0.50 }, // vin de cuisine
    ing_18: { trend: 0.003, vol: 0.03, freq: 0.56 }, // jaune d'œuf
    ing_19: { trend: 0.003, vol: 0.02, freq: 0.50 }, // sucre
    ing_20: { trend: 0.003, vol: 0.01, freq: 0.50 }, // pain baguette
};

const round = (value, decimals = 2) => {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
};

// Génère 18 mois + le point actuel de points de suivi. Pour chaque mois, on reconstruit les prix
// d'ingrédients (dérive + oscillation) puis on calcule les coûts de chaque plat via le moteur —
// données historiques cohérentes, sans avoir à coder les coûts à la main.
function buildTrackingHistory(ingredients, labor, products, generalInfo) {
    const MONTHS = 18;
    const now = new Date();
    // La productivité cuisine dépend des volumes réels et n'est pas recalculée ici : on fige à 100 %
    // (pas de majoration de MO oisive) pour l'historique de démonstration.
    const snapBase = { ...generalInfo, kitchenProductivity: 100 };
    const notes = {
        [MONTHS]: 'Première analyse de référence — coûts matières élevés.',
        12: 'Renégociation des contrats avec la boucherie.',
        6: 'Changement de fournisseur pour la fromagerie.',
        0: 'Situation actuelle.',
    };

    const points = [];
    for (let m = MONTHS; m >= 0; m--) {
        const date = new Date(now.getFullYear(), now.getMonth() - m, 15, 12, 0, 0);
        const iso = date.toISOString();
        const dateStr = iso.split('T')[0];

        const monthIngredients = ingredients.map((ing) => {
            const prof = PRICE_PROFILES[ing.id] || { trend: 0.003, vol: 0.02, freq: 0.5 };
            const factor = 1 - prof.trend * m + prof.vol * Math.sin(m * prof.freq);
            const unitPrice = round(ing.unitPrice * factor, ing.unitPrice < 1 ? 4 : 2);
            return { ...ing, unitPrice, purchasePrice: round(unitPrice * ing.purchaseFormat, 2), lastUpdated: dateStr };
        });

        const snapGeneral = { ...snapBase, totalRevenue: round(generalInfo.totalRevenue * (1 - 0.008 * m), 0) };
        const memo = {};
        const productsWithCosts = products.map((p) => ({
            ...p,
            costs: calculateCosts(p, snapGeneral, monthIngredients, products, labor, null, memo, new Set()),
        }));

        points.push({
            id: `tp_${m}`,
            name: `Relevé ${date.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}`,
            note: notes[m] || '',
            timestamp: iso,
            generalInfo: { ...snapGeneral },
            baseIngredients: monthIngredients,
            productsWithCosts,
        });
    }
    return points;
}

export const getDefaultState = () => {
    const today = new Date().toISOString().split('T')[0];

    // --- INGRÉDIENTS (20 références, 7 fournisseurs) ---
    const ingredients = [
        { id: 'ing_1', name: 'Filet de saumon frais', provider: 'Poissonnerie Océan', purchaseFormat: 5, unit: 'kg', purchasePrice: 145.00, unitPrice: 29.00, isRecipe: false, lossPercentage: 3, lastUpdated: today, allergens: ['fish'] },
        { id: 'ing_2', name: 'Pétoncles géants U10', provider: 'Poissonnerie Océan', purchaseFormat: 2, unit: 'kg', purchasePrice: 96.00, unitPrice: 48.00, isRecipe: false, lossPercentage: 5, lastUpdated: today, allergens: ['molluscs'] },
        { id: 'ing_3', name: 'Filet mignon de bœuf AAA', provider: 'Boucherie Prime', purchaseFormat: 2, unit: 'kg', purchasePrice: 110.00, unitPrice: 55.00, isRecipe: false, lossPercentage: 10, lastUpdated: today, allergens: [] },
        { id: 'ing_4', name: 'Poitrine de poulet', provider: 'Boucherie Prime', purchaseFormat: 4, unit: 'kg', purchasePrice: 52.00, unitPrice: 13.00, isRecipe: false, lossPercentage: 8, lastUpdated: today, allergens: [] },
        { id: 'ing_5', name: 'Carré d\'agneau', provider: 'Boucherie Prime', purchaseFormat: 3, unit: 'kg', purchasePrice: 66.00, unitPrice: 22.00, isRecipe: false, lossPercentage: 12, lastUpdated: today, allergens: [] },
        { id: 'ing_6', name: 'Pommes de terre Russet', provider: 'Maraîcher Bio Local', purchaseFormat: 20, unit: 'kg', purchasePrice: 25.00, unitPrice: 1.25, isRecipe: false, lossPercentage: 20, lastUpdated: today, allergens: [] },
        { id: 'ing_7', name: 'Tomates de serre', provider: 'Maraîcher Bio Local', purchaseFormat: 5, unit: 'kg', purchasePrice: 22.00, unitPrice: 4.40, isRecipe: false, lossPercentage: 8, lastUpdated: today, allergens: [] },
        { id: 'ing_8', name: 'Champignons café', provider: 'Maraîcher Bio Local', purchaseFormat: 2, unit: 'kg', purchasePrice: 17.00, unitPrice: 8.50, isRecipe: false, lossPercentage: 10, lastUpdated: today, allergens: [] },
        { id: 'ing_9', name: 'Échalote française', provider: 'Maraîcher Bio Local', purchaseFormat: 1, unit: 'kg', purchasePrice: 5.50, unitPrice: 5.50, isRecipe: false, lossPercentage: 15, lastUpdated: today, allergens: [] },
        { id: 'ing_10', name: 'Ail frais', provider: 'Maraîcher Bio Local', purchaseFormat: 1, unit: 'kg', purchasePrice: 14.00, unitPrice: 14.00, isRecipe: false, lossPercentage: 12, lastUpdated: today, allergens: [] },
        { id: 'ing_11', name: 'Huile d\'olive extra vierge', provider: 'Épicerie Grossiste HRI', purchaseFormat: 5, unit: 'L', purchasePrice: 78.00, unitPrice: 15.60, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_12', name: 'Farine tout usage', provider: 'Épicerie Grossiste HRI', purchaseFormat: 20, unit: 'kg', purchasePrice: 24.00, unitPrice: 1.20, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['gluten'] },
        { id: 'ing_13', name: 'Crème 35 %', provider: 'Fromagerie Artisanale', purchaseFormat: 4, unit: 'L', purchasePrice: 44.00, unitPrice: 11.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_14', name: 'Fromage en grains', provider: 'Fromagerie Artisanale', purchaseFormat: 3, unit: 'kg', purchasePrice: 48.00, unitPrice: 16.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_15', name: 'Parmesan Reggiano', provider: 'Fromagerie Artisanale', purchaseFormat: 1, unit: 'kg', purchasePrice: 42.00, unitPrice: 42.00, isRecipe: false, lossPercentage: 5, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_16', name: 'Beurre non salé', provider: 'Fromagerie Artisanale', purchaseFormat: 5, unit: 'kg', purchasePrice: 55.00, unitPrice: 11.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_17', name: 'Vin rouge de cuisine', provider: 'Épicerie Grossiste HRI', purchaseFormat: 12, unit: 'L', purchasePrice: 96.00, unitPrice: 8.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['sulphites'] },
        { id: 'ing_18', name: 'Jaune d\'œuf', provider: 'Ferme Lait-Poules', purchaseFormat: 12, unit: 'unité', purchasePrice: 4.50, unitPrice: 0.38, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['eggs'] },
        { id: 'ing_19', name: 'Sucre blanc', provider: 'Épicerie Grossiste HRI', purchaseFormat: 10, unit: 'kg', purchasePrice: 18.00, unitPrice: 1.80, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_20', name: 'Pain baguette', provider: 'Boulangerie du Coin', purchaseFormat: 1, unit: 'unité', purchasePrice: 1.75, unitPrice: 1.75, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['gluten'] },
    ];

    // --- MAIN-D'ŒUVRE (4 postes) ---
    const labor = [
        { id: 'post_1', postName: 'Chef de Cuisine', employees: [{ id: 'emp_1', employeeName: 'Julie', hourlyRate: 30, socialCharges: 16, vacationPercentage: 6, productiveTimePercentage: 85, workedHours: 160 }] },
        { id: 'post_2', postName: 'Sous-Chef', employees: [{ id: 'emp_2', employeeName: 'Marc-André', hourlyRate: 24, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 90, workedHours: 160 }] },
        { id: 'post_3', postName: 'Cuisinier', employees: [{ id: 'emp_3', employeeName: 'Sophie', hourlyRate: 20, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 95, workedHours: 160 }] },
        { id: 'post_4', postName: 'Plongeur/Aide-cuisine', employees: [{ id: 'emp_4', employeeName: 'Kevin', hourlyRate: 17.50, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 100, workedHours: 120 }] },
    ];

    // --- PRODUITS ---
    const products = [
        // Sous-recettes (isIngredient) --------------------------------------------------------------
        // Sauce demi-glace : sous-recette pure (non vendue seule), intégrée à deux plats.
        { id: 'sub_demiglace', platName: 'Sauce demi-glace maison', category: 'Sous-recette', prixVente: 0, nbPortions: 1, portionSize: 1000, portionUnit: 'ml', isIngredient: true, isResaleProduct: false, purchaseCost: 0, salesMix: 0, onMenu: false, manualAllergens: [],
            ingredients: [
                { rowId: 'r_dg_1', id: 'ing_17', quantity: 500, recipeUnit: 'ml', yieldPercentage: 60 },
                { rowId: 'r_dg_2', id: 'ing_9', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_dg_3', id: 'ing_16', quantity: 60, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_dg_4', id: 'ing_10', quantity: 20, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_dg_1', stepName: 'Suer les échalotes et l\'ail', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 300 },
                { stepId: 's_dg_2', stepName: 'Déglacer et réduire', personnel: [{ postId: 'Cuisinier' }], startTime: 300, duration: 1800 },
            ], indirectCosts: { portionsSold: 0 }
        },
        // Frites maison : sous-recette QUI EST AUSSI vendue seule (accompagnement) — montre qu'une
        // sous-recette peut être un plat. Utilisée comme ingrédient dans la Poutine.
        { id: 'sub_frites', platName: 'Frites maison', category: 'Accompagnement', prixVente: 6, nbPortions: 1, portionSize: 1, portionUnit: 'portion', isIngredient: true, isResaleProduct: false, purchaseCost: 0, salesMix: 5, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_fr_1', id: 'ing_6', quantity: 300, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_fr_2', id: 'ing_11', quantity: 25, recipeUnit: 'ml', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_fr_1', stepName: 'Blanchiment des frites', personnel: [{ postId: 'Plongeur/Aide-cuisine' }], startTime: 0, duration: 480 },
                { stepId: 's_fr_2', stepName: 'Deuxième cuisson & assaisonnement', personnel: [{ postId: 'Cuisinier' }], startTime: 480, duration: 180 },
            ], indirectCosts: { portionsSold: 145 }
        },

        // Entrées ------------------------------------------------------------------------------------
        { id: 'prod_1', platName: 'Tartare de saumon', category: 'Entrée', prixVente: 19, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 8, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_1_1', id: 'ing_1', quantity: 120, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_1_2', id: 'ing_9', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_1_3', id: 'ing_11', quantity: 10, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_1_4', id: 'ing_18', quantity: 1, recipeUnit: 'unité', yieldPercentage: 100 },
                { rowId: 'r_1_5', id: 'ing_20', quantity: 0.5, recipeUnit: 'unité', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_1_1', stepName: 'Taillage minute du saumon', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 300 },
                { stepId: 's_1_2', stepName: 'Assaisonnement et dressage', personnel: [{ postId: 'Sous-Chef' }], startTime: 300, duration: 180 },
            ], indirectCosts: { portionsSold: 232 }
        },
        { id: 'prod_2', platName: 'Pétoncles poêlés au beurre', category: 'Entrée', prixVente: 24, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 6, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_2_1', id: 'ing_2', quantity: 90, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_2_2', id: 'ing_16', quantity: 20, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_2_3', id: 'ing_10', quantity: 8, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_2_1', stepName: 'Saisir les pétoncles', personnel: [{ postId: 'Chef de Cuisine' }], startTime: 0, duration: 240 },
            ], indirectCosts: { portionsSold: 174 }
        },

        // Plats principaux ---------------------------------------------------------------------------
        { id: 'prod_3', platName: 'Filet mignon, sauce demi-glace', category: 'Plat Principal', prixVente: 39, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 12, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_3_1', id: 'ing_3', quantity: 180, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_3_2', id: 'sub_demiglace', quantity: 80, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_3_3', id: 'ing_6', quantity: 180, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_3_4', id: 'ing_16', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_3_1', stepName: 'Cuisson du filet', personnel: [{ postId: 'Chef de Cuisine' }], startTime: 0, duration: 420 },
                { stepId: 's_3_2', stepName: 'Garniture et dressage', personnel: [{ postId: 'Cuisinier' }], startTime: 420, duration: 240 },
            ], indirectCosts: { portionsSold: 348 }
        },
        { id: 'prod_4', platName: 'Suprême de poulet forestier', category: 'Plat Principal', prixVente: 26, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 14, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_4_1', id: 'ing_4', quantity: 200, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_4_2', id: 'ing_8', quantity: 80, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_4_3', id: 'ing_13', quantity: 60, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_4_4', id: 'ing_9', quantity: 20, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_4_1', stepName: 'Saisir et rôtir le suprême', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 480 },
                { stepId: 's_4_2', stepName: 'Sauce forestière', personnel: [{ postId: 'Sous-Chef' }], startTime: 480, duration: 300 },
            ], indirectCosts: { portionsSold: 406 }
        },
        { id: 'prod_5', platName: 'Carré d\'agneau, jus à l\'ail', category: 'Plat Principal', prixVente: 42, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 8, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_5_1', id: 'ing_5', quantity: 250, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_5_2', id: 'ing_10', quantity: 12, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_5_3', id: 'ing_11', quantity: 20, recipeUnit: 'ml', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_5_1', stepName: 'Marquage et cuisson', personnel: [{ postId: 'Chef de Cuisine' }], startTime: 0, duration: 600 },
            ], indirectCosts: { portionsSold: 232 }
        },
        { id: 'prod_6', platName: 'Risotto aux champignons', category: 'Plat Principal', prixVente: 23, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 9, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_6_1', id: 'ing_8', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_6_2', id: 'ing_15', quantity: 30, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_6_3', id: 'ing_13', quantity: 50, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_6_4', id: 'ing_17', quantity: 40, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_6_5', id: 'ing_9', quantity: 20, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_6_1', stepName: 'Cuisson du risotto', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 1080 },
            ], indirectCosts: { portionsSold: 261 }
        },
        { id: 'prod_7', platName: 'Poutine décadente', category: 'Plat Principal', prixVente: 17, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 15, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_7_1', id: 'sub_frites', quantity: 1, recipeUnit: 'portion', yieldPercentage: 100 },
                { rowId: 'r_7_2', id: 'ing_14', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_7_3', id: 'sub_demiglace', quantity: 120, recipeUnit: 'ml', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_7_1', stepName: 'Montage et service', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 180 },
            ], indirectCosts: { portionsSold: 435 }
        },

        // Dessert ------------------------------------------------------------------------------------
        { id: 'prod_8', platName: 'Crème brûlée à la vanille', category: 'Dessert', prixVente: 11, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 8, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_8_1', id: 'ing_13', quantity: 100, recipeUnit: 'ml', yieldPercentage: 100 },
                { rowId: 'r_8_2', id: 'ing_18', quantity: 2, recipeUnit: 'unité', yieldPercentage: 100 },
                { rowId: 'r_8_3', id: 'ing_19', quantity: 25, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_8_1', stepName: 'Appareil et cuisson', personnel: [{ postId: 'Sous-Chef' }], startTime: 0, duration: 300 },
                { stepId: 's_8_2', stepName: 'Caramélisation minute', personnel: [{ postId: 'Cuisinier' }], startTime: 300, duration: 120 },
            ], indirectCosts: { portionsSold: 232 }
        },

        // Boissons (revente) -------------------------------------------------------------------------
        { id: 'prod_9', platName: 'Bière de microbrasserie', category: 'Boisson', prixVente: 9.50, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: true, purchaseCost: 3.75, salesMix: 10, onMenu: true, manualAllergens: ['gluten'], ingredients: [], productionSteps: [], indirectCosts: { portionsSold: 290 } },
        { id: 'prod_10', platName: 'Verre de vin rouge', category: 'Boisson', prixVente: 12, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: true, purchaseCost: 4.00, salesMix: 5, onMenu: true, manualAllergens: ['sulphites'], ingredients: [], productionSteps: [], indirectCosts: { portionsSold: 145 } },
    ];

    const generalInfo = {
        period: 'monthly', totalIndirects: 22000, totalRevenue: 78000, operationHours: 300,
        foodCostTarget: 30, laborCostTarget: 35, menuRevenuePercentage: 88,
        indirectCostMethod: 'salesAllocation',
    };

    // --- DONNÉES FINALES ---
    return {
        companyName: "Bistro Le Local",
        logoUrl: './demo_logo.png',
        generalInfo,
        ingredientsList: ingredients,
        products,
        laborDatabase: labor,
        trackingPoints: buildTrackingHistory(ingredients, labor, products, generalInfo),
        uiSettings: {
            infoItemsPerPage: 10,
            ingredientsItemsPerPage: 10,
            summaryItemsPerPage: 10,
        },
    };
};

export const getEmptyState = () => ({
    companyName: "",
    logoUrl: '',
    generalInfo: {
        period: 'monthly',
        totalIndirects: 0,
        totalRevenue: 0,
        operationHours: 0,
        totalKitchenLaborCost: 0,
        startDate: '',
        endDate: '',
        foodCostTarget: '',
        laborCostTarget: '',
        menuRevenuePercentage: 100,
        indirectCostMethod: 'salesAllocation',
    },
    ingredientsList: [],
    products: [],
    trackingPoints: [],
    laborDatabase: [],
    uiSettings: {
        infoItemsPerPage: 10,
        ingredientsItemsPerPage: 10,
        summaryItemsPerPage: 10,
    },
});

// Méthodes d'attribution des frais indirects retenues : une seule est choisie globalement (dans
// les Paramètres) et s'applique à tous les plats. Les deux répartissent exactement le pool de
// frais indirects (elles se réconcilient par construction) :
//   - salesAllocation : au prorata du mix des ventes ;
//   - laborTime : au prorata du temps de production (taux = frais indirects / total heures MO).
export const indirectCostMethodLabels = {
    salesAllocation: 'Au prorata des ventes',
    laborTime: 'Au prorata du temps de production',
};

export const periodTranslations = {
    monthly: 'Mensuelle',
    weekly: 'Hebdomadaire',
    quarterly: 'Trimestrielle',
    yearly: 'Annuelle',
    custom: 'Personnalisée'
};
