import { describe, it, expect, vi } from 'vitest';
import { calculateCosts } from './calculateCosts.js';

const baseGeneralInfo = () => ({
    totalIndirects: 0,
    totalRevenue: 0,
    operationCostPerHour: 0,
    kitchenProductivity: 100,
    menuRevenuePercentage: 100,
});

const baseProduct = (overrides = {}) => ({
    id: 'p1',
    platName: 'Produit Test',
    prixVente: 20,
    nbPortions: 1,
    isResaleProduct: false,
    purchaseCost: 0,
    ingredients: [],
    productionSteps: [],
    indirectCosts: { portionsSold: 100 },
    salesMix: 0,
    onMenu: true,
    isIngredient: false,
    portionSize: 1,
    portionUnit: 'unité',
    ...overrides,
});

describe('calculateCosts - coûts des ingrédients', () => {
    it("calcule le coût matière sans perte ni rendement", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            ingredients: [{ id: 'farine', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        expect(costs.totalBaseIngredientsCost).toBeCloseTo(4);
        expect(costs.totalIngredientsCost).toBeCloseTo(4);
        expect(costs.totalLossCost).toBeCloseTo(0);
        expect(costs.costMatierePerPortion).toBeCloseTo(4);
    });

    it("gonfle le coût matière selon le taux de perte de l'ingrédient", () => {
        const baseIngredients = [{ id: 'saumon', unitPrice: 10, lossPercentage: 20, unit: 'kg' }];
        const product = baseProduct({
            ingredients: [{ id: 'saumon', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // baseCost = 10, costAfterLoss = 10 / (1 - 0.20) = 12.5
        expect(costs.totalBaseIngredientsCost).toBeCloseTo(10);
        expect(costs.totalLossCost).toBeCloseTo(2.5);
        expect(costs.totalIngredientsCost).toBeCloseTo(12.5);
    });

    it("applique le rendement de la recette en plus de la perte de l'ingrédient", () => {
        const baseIngredients = [{ id: 'saumon', unitPrice: 10, lossPercentage: 20, unit: 'kg' }];
        const product = baseProduct({
            ingredients: [{ id: 'saumon', quantity: 1, recipeUnit: 'kg', yieldPercentage: 80 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // costAfterLoss = 12.5, finalCost = 12.5 / 0.80 = 15.625
        expect(costs.totalIngredientsCost).toBeCloseTo(15.625);
    });

    it("convertit correctement les unités de recette vers l'unité de base", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            ingredients: [{ id: 'farine', quantity: 500, recipeUnit: 'g', yieldPercentage: 0 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        expect(costs.totalIngredientsCost).toBeCloseTo(1); // 0.5 kg * 2$/kg
    });

    it("accepte les nombres au format local (virgule)", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: '2,50', lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            ingredients: [{ id: 'farine', quantity: '1,5', recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        expect(costs.totalIngredientsCost).toBeCloseTo(3.75);
    });
});

describe('calculateCosts - produit de revente', () => {
    it("utilise directement le coût d'achat, sans main-d'œuvre", () => {
        const product = baseProduct({ isResaleProduct: true, purchaseCost: 3.75, nbPortions: 1 });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], []);
        expect(costs.totalIngredientsCost).toBeCloseTo(3.75);
        expect(costs.costLaborPerPortion).toBe(0);
    });
});

describe('calculateCosts - main-d\'œuvre', () => {
    const laborDatabase = [{
        postName: 'cuisinier',
        employees: [{ hourlyRate: 20, socialCharges: 15, vacationPercentage: 10, workedHours: 8 }],
    }];

    it("calcule le coût de main-d'œuvre à partir des étapes de production", () => {
        const product = baseProduct({
            productionSteps: [{ duration: 3600, startTime: 0, personnel: [{ postId: 'cuisinier' }] }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], laborDatabase);
        // coût horaire pondéré = 20 * 1.15 * 1.10 = 25.30, pour 1h de production
        expect(costs.totalDirectLaborCost).toBeCloseTo(25.3);
        expect(costs.costLaborPerPortion).toBeCloseTo(25.3);
    });

    it("augmente le coût de main-d'œuvre quand la productivité de cuisine diminue", () => {
        const product = baseProduct({
            productionSteps: [{ duration: 3600, startTime: 0, personnel: [{ postId: 'cuisinier' }] }],
        });
        const generalInfo = { ...baseGeneralInfo(), kitchenProductivity: 80 };
        const costs = calculateCosts(product, generalInfo, [], [product], laborDatabase);
        expect(costs.totalLaborCost).toBeCloseTo(25.3 / 0.8);
    });
});

describe('calculateCosts - méthodes d\'allocation des frais indirects', () => {
    it("method 'laborTime' : au prorata du temps de production", () => {
        // Taux = frais indirects / total des heures de MO du menu (fourni via generalInfo).
        // 1h × 2 personnes = 2 h-personne ; total menu = 2 h ; taux = 1000/2 = 500$/h ; overhead = 1000.
        const product = baseProduct({
            productionSteps: [{ duration: 3600, startTime: 0, personnel: [{ postId: 'a' }, { postId: 'b' }] }],
        });
        const generalInfo = { ...baseGeneralInfo(), indirectCostMethod: 'laborTime', totalIndirects: 1000, totalDirectLaborHoursNeeded: 2 };
        const costs = calculateCosts(product, generalInfo, [], [product], []);
        expect(costs.indirectCostTotal).toBeCloseTo(1000);
    });

    it("method 'laborTime' : répartit exactement le pool (réconciliation) et ∝ aux heures de chaque plat", () => {
        const generalInfo = { ...baseGeneralInfo(), indirectCostMethod: 'laborTime', totalIndirects: 1000, totalDirectLaborHoursNeeded: 3 };
        const productA = baseProduct({ id: 'A', productionSteps: [{ duration: 3600, personnel: [{ postId: 'a' }, { postId: 'b' }] }] }); // 2 h-personne
        const productB = baseProduct({ id: 'B', productionSteps: [{ duration: 3600, personnel: [{ postId: 'a' }] }] });                 // 1 h-personne
        const allProducts = [productA, productB];
        const costsA = calculateCosts(productA, generalInfo, [], allProducts, []);
        const costsB = calculateCosts(productB, generalInfo, [], allProducts, []);
        // taux = 1000/3 ; A = 2 × 1000/3 ≈ 666,7 ; B = 1 × 1000/3 ≈ 333,3 ; somme = 1000.
        expect(costsA.indirectCostTotal + costsB.indirectCostTotal).toBeCloseTo(1000);
        expect(costsA.indirectCostTotal / costsB.indirectCostTotal).toBeCloseTo(2);
    });

    it("une sous-recette n'apporte que son coût direct au plat parent (pas de double comptage), mais absorbe ses propres frais indirects quand elle est vendue seule", () => {
        // La sous-recette est AUSSI vendue au menu (isIngredient + onMenu + mix). Utilisée comme
        // ingrédient, seul son coût direct (matière + MO) remonte au parent ; calculée en tant que
        // plat, elle absorbe bien ses propres frais indirects.
        const generalInfo = { ...baseGeneralInfo(), indirectCostMethod: 'salesAllocation', totalIndirects: 10000 };
        const baseIngredients = [{ id: 'farine', unitPrice: 5, lossPercentage: 0, unit: 'kg' }];
        const subRecipe = baseProduct({
            id: 'sauce', isIngredient: true, onMenu: true, salesMix: 50, portionUnit: 'kg', portionSize: 1, nbPortions: 1,
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            indirectCosts: { portionsSold: 100 },
        });
        const parent = baseProduct({
            id: 'plat', isIngredient: false, onMenu: true, salesMix: 50, nbPortions: 1,
            ingredients: [{ id: 'sauce', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            indirectCosts: { portionsSold: 100 },
        });
        const allProducts = [subRecipe, parent];

        // Côté parent : coût matière = coût DIRECT de la sous-recette (5$ de farine), sans son indirect.
        const parentCosts = calculateCosts(parent, generalInfo, baseIngredients, allProducts, []);
        expect(parentCosts.costMatierePerPortion).toBeCloseTo(5);

        // Sous-recette calculée seule (au menu) : elle absorbe bien un frais indirect.
        const subCosts = calculateCosts(subRecipe, generalInfo, baseIngredients, allProducts, []);
        expect(subCosts.indirectCostTotal).toBeGreaterThan(0);
    });

    describe("method 'salesAllocation'", () => {
        it("le coût indirect par portion est proportionnel au mix des ventes du produit", () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 10000 };
            const productA = baseProduct({
                id: 'A', salesMix: 50,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const productB = baseProduct({
                id: 'B', salesMix: 5,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const allProducts = [productA, productB];

            const costsA = calculateCosts(productA, generalInfo, [], allProducts, []);
            const costsB = calculateCosts(productB, generalInfo, [], allProducts, []);

            // Le ratio des coûts indirects par portion doit refléter le ratio des mix (50 / 5 = 10)
            expect(costsA.indirectCostTotal / costsB.indirectCostTotal).toBeCloseTo(10);
        });

        it("répartit l'intégralité du pool de frais indirects entre les produits actifs (absorption totale)", () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 10000 };
            const productA = baseProduct({
                id: 'A', salesMix: 50, onMenu: true,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const productB = baseProduct({
                id: 'B', salesMix: 5, onMenu: true,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const allProducts = [productA, productB];

            const costsA = calculateCosts(productA, generalInfo, [], allProducts, []);
            const costsB = calculateCosts(productB, generalInfo, [], allProducts, []);

            // indirectCostTotal (nbPortions=1) = $ alloué / portionsSold => on remultiplie par
            // portionsSold (1000) pour retrouver le montant brut alloué à chaque produit.
            const allocatedA = costsA.indirectCostTotal * 1000;
            const allocatedB = costsB.indirectCostTotal * 1000;
            expect(allocatedA + allocatedB).toBeCloseTo(10000);
        });

        it("un produit hors menu (salesMix = 0) ne reçoit aucun coût indirect, sans discontinuité ni NaN", () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 10000 };
            const product = baseProduct({
                salesMix: 0,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            expect(costs.indirectCostTotal).toBe(0);
            expect(Number.isNaN(costs.indirectCostTotal)).toBe(false);
        });

        it("ne divise pas par zéro quand aucun produit actif n'a de mix des ventes", () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 10000 };
            const product = baseProduct({
                salesMix: 0, onMenu: false,
                indirectCosts: { method: 'salesAllocation', portionsSold: 1000 },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            expect(costs.indirectCostTotal).toBe(0);
        });

        it("se rabat sur une estimation par revenu (raisonnable) si portionsSold n'est pas saisi, au lieu d'exploser", () => {
            // Reproduit un projet existant créé avant l'ajout du champ portionsSold :
            // indirectCosts ne contient que la méthode, sans portionsSold.
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 18500, totalRevenue: 62000 };
            const product = baseProduct({
                prixVente: 32, salesMix: 35,
                indirectCosts: { method: 'salesAllocation' },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            // Le coût indirect par portion doit rester du même ordre de grandeur que le prix
            // de vente, pas des milliers de dollars (ancien bug : portionsSold par défaut à 1).
            expect(costs.indirectCostTotal).toBeLessThan(product.prixVente);
            expect(costs.indirectCostTotal).toBeGreaterThan(0);
        });
    });
});

describe('calculateCosts - sous-recettes récursives', () => {
    it("intègre le coût par unité d'une sous-recette comme ingrédient", () => {
        const subRecipe = baseProduct({
            id: 'sauce-base',
            isIngredient: true,
            nbPortions: 1,
            portionSize: 1,
            portionUnit: 'kg',
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const baseIngredients = [{ id: 'farine', unitPrice: 5, lossPercentage: 0, unit: 'kg' }];
        const parent = baseProduct({
            id: 'plat-final',
            ingredients: [{ id: 'sauce-base', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const allProducts = [subRecipe, parent];

        const costs = calculateCosts(parent, baseGeneralInfo(), baseIngredients, allProducts, []);
        // sous-recette : 1kg de farine à 5$/kg => 5$/kg de sauce ; parent utilise 2kg => 10$
        expect(costs.totalIngredientsCost).toBeCloseTo(10);
    });

    it("détecte une boucle circulaire entre deux produits sans planter", () => {
        const productA = baseProduct({
            id: 'A', isIngredient: true, portionUnit: 'kg',
            ingredients: [{ id: 'B', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const productB = baseProduct({
            id: 'B', isIngredient: true, portionUnit: 'kg',
            ingredients: [{ id: 'A', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const allProducts = [productA, productB];
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const costs = calculateCosts(productA, baseGeneralInfo(), [], allProducts, []);

        expect(costs.totalCostPerPortion).toBe(0);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe('calculateCosts - marges', () => {
    it("calcule les marges brute et nette à partir du prix de vente", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        // salesAllocation calibré pour un frais indirect de 1$/portion : pool 10$, seul plat au
        // menu (mix 100 % => part 1), portions vendues 10 => 10$/10 = 1$/portion.
        const product = baseProduct({
            prixVente: 20, salesMix: 100,
            ingredients: [{ id: 'farine', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
            indirectCosts: { portionsSold: 10 },
        });
        const generalInfo = { ...baseGeneralInfo(), indirectCostMethod: 'salesAllocation', totalIndirects: 10 };
        const costs = calculateCosts(product, generalInfo, baseIngredients, [product], []);
        // coût matière 4$, main-d'œuvre 0$, indirect 1$ => coût total 5$
        expect(costs.indirectCostTotal).toBeCloseTo(1);
        expect(costs.margeBruteDollar).toBeCloseTo(16); // 20 - 4 (hors indirect)
        expect(costs.margeNetteDollar).toBeCloseTo(15); // 20 - 5
        expect(costs.margeNettePercent).toBeCloseTo(0.75);
    });
});

describe('calculateCosts - cache memo et prix simulé', () => {
    it("ne renvoie pas le résultat au prix réel lorsqu'un prix simulé est demandé avec un memo partagé", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 20,
            ingredients: [{ id: 'farine', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
            indirectCosts: { method: 'fixed', fixedAmount: 0 },
        });
        const sharedMemo = {};

        // Premier appel au prix réel : peuple le cache pour product.id
        const real = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, sharedMemo);
        expect(real.margeNetteDollar).toBeCloseTo(16); // 20 - 4

        // Deuxième appel AVEC prix simulé mais MÊME memo : ne doit pas renvoyer le résultat caché
        const simulated = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], 30, sharedMemo);
        expect(simulated.margeNetteDollar).toBeCloseTo(26); // 30 - 4, et non 16
    });

    it("ne pollue pas le cache avec un résultat au prix simulé", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 20,
            ingredients: [{ id: 'farine', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
            indirectCosts: { method: 'fixed', fixedAmount: 0 },
        });
        const sharedMemo = {};

        // Appel au prix simulé d'abord : ne doit rien écrire dans le cache
        calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], 30, sharedMemo);
        // Appel au prix réel ensuite : doit calculer 20, pas le 30 simulé
        const real = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, sharedMemo);
        expect(real.margeNetteDollar).toBeCloseTo(16); // 20 - 4
    });
});
