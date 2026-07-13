export const getDefaultState = () => {
    // --- BASE DE DONNÉES ---
    const ingredients = [
        { id: 'ing_1', name: 'Filet de Saumon', provider: 'Poissonnerie Atlantique', purchaseFormat: 5, unit: 'kg', purchasePrice: 145.00, unitPrice: 29.00, isRecipe: false, lossPercentage: 3, lastUpdated: '2025-08-15', allergens: ['fish'] },
        { id: 'ing_2', name: 'Sirop d\'érable', provider: 'Érablière du Nord', purchaseFormat: 4, unit: 'L', purchasePrice: 60.00, unitPrice: 15.00, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-08-01', allergens: [] },
        { id: 'ing_3', name: 'Filet Mignon de Bœuf AAA', provider: 'Boucherie Viau', purchaseFormat: 2, unit: 'kg', purchasePrice: 110.00, unitPrice: 55.00, isRecipe: false, lossPercentage: 10, lastUpdated: '2025-08-20', allergens: [] },
        { id: 'ing_4', name: 'Jaune d\'œuf', provider: 'Ferme Lait-Poules', purchaseFormat: 12, unit: 'unité', purchasePrice: 4.50, unitPrice: 0.38, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-08-28', allergens: ['eggs'] },
        { id: 'ing_5', name: 'Câpres', provider: 'Distributeur HRI', purchaseFormat: 1, unit: 'kg', purchasePrice: 18.00, unitPrice: 18.00, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-07-30', allergens: [] },
        { id: 'ing_6', name: 'Échalote Française', provider: 'Le Jardin Local', purchaseFormat: 1, unit: 'kg', purchasePrice: 5.50, unitPrice: 5.50, isRecipe: false, lossPercentage: 15, lastUpdated: '2025-08-15', allergens: [] },
        { id: 'ing_7', name: 'Pommes de Terre Russet', provider: 'Le Jardin Local', purchaseFormat: 20, unit: 'kg', purchasePrice: 25.00, unitPrice: 1.25, isRecipe: false, lossPercentage: 20, lastUpdated: '2025-08-25', allergens: [] },
        { id: 'ing_8', name: 'Fromage en Grains', provider: 'Fromagerie St-Guillaume', purchaseFormat: 3, unit: 'kg', purchasePrice: 48.00, unitPrice: 16.00, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-08-28', allergens: ['milk'] },
        { id: 'ing_9', name: 'Huile de Canola', provider: 'Distributeur HRI', purchaseFormat: 16, unit: 'L', purchasePrice: 45.00, unitPrice: 2.81, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-08-05', allergens: [] },
        { id: 'ing_10', name: 'Pain Brioché', provider: 'Boulangerie du Coin', purchaseFormat: 8, unit: 'unité', purchasePrice: 12.00, unitPrice: 1.50, isRecipe: false, lossPercentage: 0, lastUpdated: '2025-08-29', allergens: ['gluten', 'milk', 'eggs'] },
    ];

    const labor = [
        { id: 'post_1', postName: 'Chef de Cuisine', employees: [{ id: 'emp_1', employeeName: 'Julie', hourlyRate: 28, socialCharges: 16, vacationPercentage: 6, productiveTimePercentage: 85, workedHours: 160 }] },
        { id: 'post_2', postName: 'Cuisinier', employees: [{ id: 'emp_2', employeeName: 'Marc-André', hourlyRate: 21, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 95, workedHours: 160 }] },
        { id: 'post_3', postName: 'Plongeur/Aide-cuisine', employees: [{ id: 'emp_3', employeeName: 'Kevin', hourlyRate: 17.50, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 100, workedHours: 120 }] },
    ];

    const products = [
        // --- PLATS CUISINÉS ---
        { id: 'prod_1', platName: 'Saumon Glacé à l\'Érable', category: 'Plat Principal', prixVente: 32, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 35, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_ing_1', id: 'ing_1', quantity: 0.18, recipeUnit: 'kg', yieldPercentage: 100 },
                { rowId: 'r_ing_2', id: 'ing_2', quantity: 50, recipeUnit: 'ml', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_1_1', stepName: 'Glacer le saumon', personnel: [{postId: 'Cuisinier'}], startTime: 0, duration: 120 },
                { stepId: 's_1_2', stepName: 'Cuisson et service', personnel: [{postId: 'Chef de Cuisine'}], startTime: 120, duration: 480 },
            ], indirectCosts: { method: 'salesAllocation', portionsSold: 576 }
        },
        { id: 'prod_2', platName: 'Tartare de Bœuf Classique', category: 'Entrée', prixVente: 21, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 25, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_ing_3', id: 'ing_3', quantity: 120, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_ing_4', id: 'ing_4', quantity: 1, recipeUnit: 'unité', yieldPercentage: 100 },
                { rowId: 'r_ing_5', id: 'ing_5', quantity: 10, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_ing_6', id: 'ing_6', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_2_1', stepName: 'Taillage minute du bœuf', personnel: [{postId: 'Cuisinier'}], startTime: 0, duration: 300 },
                { stepId: 's_2_2', stepName: 'Assaisonnement et dressage', personnel: [{postId: 'Cuisinier'}], startTime: 300, duration: 180 },
            ], indirectCosts: { method: 'salesAllocation', portionsSold: 627 }
        },
        { id: 'prod_3', platName: 'Poutine Décadente', category: 'Plat Principal', prixVente: 19, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: false, purchaseCost: 0, salesMix: 20, onMenu: true, manualAllergens: [],
            ingredients: [
                { rowId: 'r_ing_7', id: 'ing_7', quantity: 350, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_ing_8', id: 'ing_8', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 },
                { rowId: 'r_ing_9', id: 'ing_9', quantity: 100, recipeUnit: 'ml', yieldPercentage: 100 },
            ],
            productionSteps: [
                { stepId: 's_3_1', stepName: 'Blanchiment des frites', personnel: [{postId: 'Plongeur/Aide-cuisine'}], startTime: 0, duration: 600 },
                { stepId: 's_3_2', stepName: 'Deuxième cuisson & service', personnel: [{postId: 'Cuisinier'}], startTime: 600, duration: 240 },
            ], indirectCosts: { method: 'salesAllocation', portionsSold: 555 }
        },
        // --- PRODUITS DE REVENTE ---
        { id: 'prod_4', platName: 'Bière de Microbrasserie Locale', category: 'Boisson', prixVente: 9.50, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: true, purchaseCost: 3.75, salesMix: 15, onMenu: true, manualAllergens: ['gluten'], ingredients: [], productionSteps: [], indirectCosts: { method: 'fixed', fixedAmount: 0.50 }
        },
        { id: 'prod_5', platName: 'Cidre Artisanal', category: 'Boisson', prixVente: 12, nbPortions: 1, portionSize: 1, portionUnit: 'unité', isIngredient: false, isResaleProduct: true, purchaseCost: 4.50, salesMix: 5, onMenu: true, manualAllergens: ['sulphites'], ingredients: [], productionSteps: [], indirectCosts: { method: 'fixed', fixedAmount: 0.50 }
        },
    ];

    // --- POINTS DE SUIVI (HISTORIQUE) ---
    // Simule une amélioration continue avec des données complètes pour chaque plat
    const trackingPoints = [
        // POINT 1: Situation initiale (il y a 2 mois)
        { id: 'tp_1', name: 'Analyse Initiale - Juin 2025', note: 'Première analyse, coûts matières élevés.', timestamp: new Date('2025-06-30T12:00:00Z').toISOString(),
            generalInfo: { totalIndirects: 18500, totalRevenue: 60000 },
            baseIngredients: ingredients.map(i => {
                if (i.id === 'ing_1') return {...i, unitPrice: 32.00}; // Saumon plus cher
                if (i.id === 'ing_3') return {...i, unitPrice: 58.00}; // Boeuf plus cher
                return i;
            }),
            productsWithCosts: [
                { id: 'prod_1', platName: 'Saumon Glacé à l\'Érable', onMenu: true, salesMix: 35, costs: { costMatierePerPortion: 6.01, costLaborPerPortion: 3.80, costIndirectPerPortion: 8.57, margeNettePercent: 0.17, costMatierePercent: 0.18, costLaborPercent: 0.12, costIndirectPercent: 0.27, margeBrutePercent: 0.70 } },
                { id: 'prod_2', platName: 'Tartare de Bœuf Classique', onMenu: true, salesMix: 25, costs: { costMatierePerPortion: 7.21, costLaborPerPortion: 3.38, costIndirectPerPortion: 6.03, margeNettePercent: 0.20, costMatierePercent: 0.34, costLaborPercent: 0.16, costIndirectPercent: 0.29, margeBrutePercent: 0.50 } },
                { id: 'prod_3', platName: 'Poutine Décadente', onMenu: true, salesMix: 20, costs: { costMatierePerPortion: 2.29, costLaborPerPortion: 4.87, costIndirectPerPortion: 5.46, margeNettePercent: 0.33, costMatierePercent: 0.12, costLaborPercent: 0.26, costIndirectPercent: 0.29, margeBrutePercent: 0.62 } },
                { id: 'prod_4', platName: 'Bière de Microbrasserie Locale', onMenu: true, salesMix: 15, costs: { costMatierePerPortion: 3.75, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.55, costMatierePercent: 0.39, costLaborPercent: 0, costIndirectPercent: 0.05, margeBrutePercent: 0.61 } },
                { id: 'prod_5', platName: 'Cidre Artisanal', onMenu: true, salesMix: 5, costs: { costMatierePerPortion: 4.50, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.58, costMatierePercent: 0.38, costLaborPercent: 0, costIndirectPercent: 0.04, margeBrutePercent: 0.63 } }
            ]
        },
        // POINT 2: Après négociation (il y a 1 mois)
        { id: 'tp_2', name: 'Post-Négociation - Juillet 2025', note: 'Nouveau fournisseur pour le saumon.', timestamp: new Date('2025-07-31T12:00:00Z').toISOString(),
            generalInfo: { totalIndirects: 18500, totalRevenue: 61000 },
            baseIngredients: ingredients.map(i => i.id === 'ing_1' ? {...i, unitPrice: 29.00} : i), // Prix du saumon amélioré
            productsWithCosts: [
                { id: 'prod_1', platName: 'Saumon Glacé à l\'Érable', onMenu: true, salesMix: 38, costs: { costMatierePerPortion: 5.45, costLaborPerPortion: 3.80, costIndirectPerPortion: 8.57, margeNettePercent: 0.20, costMatierePercent: 0.17, costLaborPercent: 0.12, costIndirectPercent: 0.27, margeBrutePercent: 0.71 } },
                { id: 'prod_2', platName: 'Tartare de Bœuf Classique', onMenu: true, salesMix: 24, costs: { costMatierePerPortion: 6.86, costLaborPerPortion: 3.38, costIndirectPerPortion: 6.03, margeNettePercent: 0.23, costMatierePercent: 0.33, costLaborPercent: 0.16, costIndirectPercent: 0.29, margeBrutePercent: 0.51 } },
                { id: 'prod_3', platName: 'Poutine Décadente', onMenu: true, salesMix: 18, costs: { costMatierePerPortion: 2.29, costLaborPerPortion: 4.87, costIndirectPerPortion: 5.46, margeNettePercent: 0.33, costMatierePercent: 0.12, costLaborPercent: 0.26, costIndirectPercent: 0.29, margeBrutePercent: 0.62 } },
                { id: 'prod_4', platName: 'Bière de Microbrasserie Locale', onMenu: true, salesMix: 15, costs: { costMatierePerPortion: 3.75, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.55, costMatierePercent: 0.39, costLaborPercent: 0, costIndirectPercent: 0.05, margeBrutePercent: 0.61 } },
                { id: 'prod_5', platName: 'Cidre Artisanal', onMenu: true, salesMix: 5, costs: { costMatierePerPortion: 4.50, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.58, costMatierePercent: 0.38, costLaborPercent: 0, costIndirectPercent: 0.04, margeBrutePercent: 0.63 } }
            ]
        },
        // POINT 3: Situation actuelle (aujourd'hui)
        { id: 'tp_3', name: 'Analyse Actuelle - Août 2025', note: 'Optimisation finale après changement de fournisseur pour le fromage.', timestamp: new Date('2025-08-30T12:00:00Z').toISOString(),
            generalInfo: { totalIndirects: 18500, totalRevenue: 62000 },
            baseIngredients: ingredients, // Utilise les prix actuels
            productsWithCosts: [
                { id: 'prod_1', platName: 'Saumon Glacé à l\'Érable', onMenu: true, salesMix: 35, costs: { costMatierePerPortion: 5.45, costLaborPerPortion: 3.80, costIndirectPerPortion: 8.57, margeNettePercent: 0.20, costMatierePercent: 0.17, costLaborPercent: 0.12, costIndirectPercent: 0.27, margeBrutePercent: 0.71 } },
                { id: 'prod_2', platName: 'Tartare de Bœuf Classique', onMenu: true, salesMix: 25, costs: { costMatierePerPortion: 6.86, costLaborPerPortion: 3.38, costIndirectPerPortion: 6.03, margeNettePercent: 0.23, costMatierePercent: 0.33, costLaborPercent: 0.16, costIndirectPercent: 0.29, margeBrutePercent: 0.51 } },
                { id: 'prod_3', platName: 'Poutine Décadente', onMenu: true, salesMix: 20, costs: { costMatierePerPortion: 2.10, costLaborPerPortion: 4.87, costIndirectPerPortion: 5.46, margeNettePercent: 0.34, costMatierePercent: 0.11, costLaborPercent: 0.26, costIndirectPercent: 0.29, margeBrutePercent: 0.63 } }, // Coût matière amélioré
                { id: 'prod_4', platName: 'Bière de Microbrasserie Locale', onMenu: true, salesMix: 15, costs: { costMatierePerPortion: 3.75, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.55, costMatierePercent: 0.39, costLaborPercent: 0, costIndirectPercent: 0.05, margeBrutePercent: 0.61 } },
                { id: 'prod_5', platName: 'Cidre Artisanal', onMenu: true, salesMix: 5, costs: { costMatierePerPortion: 4.50, costLaborPerPortion: 0, costIndirectPerPortion: 0.50, margeNettePercent: 0.58, costMatierePercent: 0.38, costLaborPercent: 0, costIndirectPercent: 0.04, margeBrutePercent: 0.63 } }
            ]
        },
    ];

    // --- DONNÉES FINALES ---
    return {
        companyName: "Bistro Le Local",
        logoUrl: './demo_logo.png',
        generalInfo: {
            period: 'monthly', totalIndirects: 18500, totalRevenue: 62000, operationHours: 240,
            foodCostTarget: 30, laborCostTarget: 35, menuRevenuePercentage: 85,
            indirectCostMethod: 'salesAllocation',
        },
        ingredientsList: ingredients,
        products: products,
        laborDatabase: labor,
        trackingPoints: trackingPoints,
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
