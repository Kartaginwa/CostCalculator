import { describe, it, expect, vi } from 'vitest';
import { calculateCosts, computeMarginsForPrice, computeChannelBreakdown } from './calculateCosts.js';

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

        it("se rabat sur le volume RÉEL par canal si portionsSold n'est pas saisi, au lieu d'exploser (corrigé le 18/10)", () => {
            // Reproduit un projet existant créé avant l'ajout du champ portionsSold :
            // indirectCosts ne contient que la méthode, sans portionsSold — repli sur le volume
            // réel déjà saisi par canal (fmt.channelPrices), plus de reconstruction depuis un
            // revenu déclaré (totalRevenue, retiré).
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 18500 };
            const product = baseProduct({
                prixVente: 32, salesMix: 35,
                channelPrices: [{ id: 'cp1', channelId: 'c1', netPrice: 32, volume: 1000 }],
                indirectCosts: { method: 'salesAllocation' },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            // Le coût indirect par portion doit rester du même ordre de grandeur que le prix
            // de vente, pas des milliers de dollars (ancien bug : portionsSold par défaut à 1).
            expect(costs.indirectCostTotal).toBeLessThan(product.prixVente);
            expect(costs.indirectCostTotal).toBeGreaterThan(0);
        });

        it('calcule un repli exact sur la somme des volumes réels de TOUS les canaux du format (pas seulement le premier)', () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 1000 };
            const product = baseProduct({
                prixVente: 10, salesMix: 100,
                channelPrices: [
                    { id: 'cp1', channelId: 'c1', netPrice: 10, volume: 60 },
                    { id: 'cp2', channelId: 'c2', netPrice: 9, volume: 40 },
                ],
                indirectCosts: { method: 'salesAllocation' },
            });
            // Un seul produit actif (100 % du mix) : allocatedIndirects = 1000 ; portionsSold =
            // 60 + 40 = 100 (somme des deux canaux) ; indirectCostTotal = 1000 / 100 × 1 = 10.
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            expect(costs.indirectCostTotal).toBeCloseTo(10);
        });

        it("sans AUCUNE donnée réelle (ni portionsSold ni volume par canal), le coût indirect 'ventes' reste absent (0 $), jamais une estimation délirante", () => {
            // Bug trouvé le 18/10 : un repli à 1 unité (avant correction) faisait diviser tout le
            // pool par une seule portion — un coût indirect de plusieurs centaines/milliers de $
            // par portion, au lieu de rester simplement absent tant qu'aucune vente réelle
            // n'existe pour ce format.
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 18500 };
            const product = baseProduct({
                prixVente: 32, salesMix: 35,
                indirectCosts: { method: 'salesAllocation' },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            expect(costs.indirectCostTotal).toBe(0);
            expect(costs.portionsSold).toBeNull();
        });

        it("`fmt.indirectCosts.portionsSold` saisi explicitement garde priorité sur le volume réel par canal", () => {
            const generalInfo = { ...baseGeneralInfo(), totalIndirects: 1000 };
            const product = baseProduct({
                prixVente: 10, salesMix: 100,
                channelPrices: [{ id: 'cp1', channelId: 'c1', netPrice: 10, volume: 60 }],
                indirectCosts: { method: 'salesAllocation', portionsSold: 500 },
            });
            const costs = calculateCosts(product, generalInfo, [], [product], []);
            expect(costs.indirectCostTotal).toBeCloseTo(1000 / 500);
        });
    });
});

describe('calculateCosts - coûts d\'emballage (Phase 2.2)', () => {
    it("calcule le coût d'emballage sans perte, comme poste SÉPARÉ du coût matière", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const basePackaging = [{ id: 'pot', unitPrice: 0.75, lossPercentage: 0, unit: 'unité' }];
        const product = baseProduct({
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            packagingItems: [{ id: 'pot', quantity: 3, recipeUnit: 'unité' }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, {}, new Set(), null, basePackaging);
        expect(costs.totalPackagingCost).toBeCloseTo(2.25); // 3 x 0.75 $
        expect(costs.costPackagingPerPortion).toBeCloseTo(2.25);
        expect(costs.totalIngredientsCost).toBeCloseTo(2); // coût matière non affecté, poste séparé
        expect(costs.totalDirectCostPerPortion).toBeCloseTo(4.25); // 2 + 2.25
    });

    it("gonfle le coût d'emballage selon le taux de perte du catalogue (bris, rebuts)", () => {
        const basePackaging = [{ id: 'pot', unitPrice: 1, lossPercentage: 20, unit: 'unité' }];
        const product = baseProduct({
            packagingItems: [{ id: 'pot', quantity: 1, recipeUnit: 'unité' }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], [], null, {}, new Set(), null, basePackaging);
        // baseCost = 1, costAfterLoss = 1 / (1 - 0.20) = 1.25
        expect(costs.totalPackagingCost).toBeCloseTo(1.25);
        // Décomposé comme les ingrédients : coût de base (avant perte) + coût de la perte seule.
        expect(costs.totalBasePackagingCost).toBeCloseTo(1);
        expect(costs.totalPackagingLossCost).toBeCloseTo(0.25);
    });

    it("n'applique aucun coût d'emballage à un produit de revente (pas de recette)", () => {
        const basePackaging = [{ id: 'pot', unitPrice: 5, lossPercentage: 0, unit: 'unité' }];
        const product = baseProduct({
            isResaleProduct: true, purchaseCost: 3,
            packagingItems: [{ id: 'pot', quantity: 1, recipeUnit: 'unité' }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], [], null, {}, new Set(), null, basePackaging);
        expect(costs.totalPackagingCost).toBe(0);
    });

    it("le coût d'emballage réduit la marge nette, au même titre que les autres coûts directs", () => {
        const basePackaging = [{ id: 'pot', unitPrice: 2, lossPercentage: 0, unit: 'unité' }];
        const product = baseProduct({
            prixVente: 10,
            packagingItems: [{ id: 'pot', quantity: 1, recipeUnit: 'unité' }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], [], null, {}, new Set(), null, basePackaging);
        expect(costs.margeNetteDollar).toBeCloseTo(8); // 10 - 2
        expect(costs.costPackagingPercent).toBeCloseTo(0.2);
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

    it("une sous-recette à PLUSIEURS formats est résolue au format précisément référencé, pas toujours au premier (régression du 04/10 — Phase 1.6e/correctif ultérieur)", () => {
        const baseIngredients = [
            { id: 'farine', unitPrice: 5, lossPercentage: 0, unit: 'kg' },
            { id: 'beurre', unitPrice: 10, lossPercentage: 0, unit: 'kg' },
        ];
        // Sous-recette à 2 formats, chacun avec sa PROPRE recette (voir 04-Conception-Modele.md :
        // chaque format est une fiche recette autonome) — formats volontairement très différents
        // en coût pour détecter sans ambiguïté lequel des deux a été utilisé.
        const subRecipe = baseProduct({
            id: 'sauce-base', isIngredient: true, nbPortions: 1, portionUnit: 'kg',
            formats: [
                { id: 'fmt_sauce_leger', portionSize: 1, portionUnit: 'kg', nbPortions: 1, prixVente: 0, salesMix: 0, onMenu: false, ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }], productionSteps: [] },
                { id: 'fmt_sauce_riche', portionSize: 1, portionUnit: 'kg', nbPortions: 1, prixVente: 0, salesMix: 0, onMenu: false, ingredients: [{ id: 'beurre', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }], productionSteps: [] },
            ],
        });
        const parentLeger = baseProduct({
            id: 'plat-leger',
            ingredients: [{ id: 'fmt_sauce_leger', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const parentRiche = baseProduct({
            id: 'plat-riche',
            ingredients: [{ id: 'fmt_sauce_riche', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const allProducts = [subRecipe, parentLeger, parentRiche];

        const costsLeger = calculateCosts(parentLeger, baseGeneralInfo(), baseIngredients, allProducts, []);
        const costsRiche = calculateCosts(parentRiche, baseGeneralInfo(), baseIngredients, allProducts, []);

        // Chaque plat parent doit refléter le coût du format EXACT qu'il référence (farine 5$/kg
        // vs beurre 10$/kg) — pas celui du premier format de la sous-recette dans les deux cas.
        expect(costsLeger.totalIngredientsCost).toBeCloseTo(5);
        expect(costsRiche.totalIngredientsCost).toBeCloseTo(10);
    });

    it("une référence historique par id de PRODUIT (avant ce correctif) retombe sur le premier format de la sous-recette, sans régression", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 5, lossPercentage: 0, unit: 'kg' }];
        const subRecipe = baseProduct({
            id: 'sauce-base', isIngredient: true, nbPortions: 1, portionUnit: 'kg',
            formats: [
                { id: 'fmt_1', portionSize: 1, portionUnit: 'kg', nbPortions: 1, prixVente: 0, salesMix: 0, onMenu: false, ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }], productionSteps: [] },
            ],
        });
        const parent = baseProduct({
            id: 'plat-final',
            // Référence l'id du PRODUIT (comportement d'avant ce correctif), pas celui du format.
            ingredients: [{ id: 'sauce-base', quantity: 2, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const allProducts = [subRecipe, parent];

        const costs = calculateCosts(parent, baseGeneralInfo(), baseIngredients, allProducts, []);
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

    it("expose les trois niveaux de marge : contribution (matière) > coût primaire (MO) > nette", () => {
        // prix 20 ; matière 4 ; MO directe 6 (0,1 h × 60 $/h) ; indirect 1 (salesAllocation).
        const baseIngredients = [{ id: 'farine', unitPrice: 4, lossPercentage: 0, unit: 'kg' }];
        const laborDatabase = [{ postName: 'C', employees: [{ hourlyRate: 60, socialCharges: 0, vacationPercentage: 0, workedHours: 1 }] }];
        const product = baseProduct({
            prixVente: 20, salesMix: 100, nbPortions: 1,
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            productionSteps: [{ stepId: 's', personnel: [{ postId: 'C' }], startTime: 0, duration: 360 }],
            indirectCosts: { portionsSold: 10 },
        });
        const generalInfo = { ...baseGeneralInfo(), indirectCostMethod: 'salesAllocation', totalIndirects: 10 };
        const costs = calculateCosts(product, generalInfo, baseIngredients, [product], laborDatabase);
        expect(costs.margeContributionDollar).toBeCloseTo(16); // 20 − 4 (matière)
        expect(costs.margeBruteDollar).toBeCloseTo(10);         // 20 − (4 + 6) (coût primaire)
        expect(costs.margeNetteDollar).toBeCloseTo(9);          // 20 − (4 + 6 + 1)
        expect(costs.margeContributionPercent).toBeCloseTo(0.80);
    });
});

describe('calculateCosts - formats (Phase 1.4)', () => {
    it("utilise les champs du format explicite plutôt que ceux du produit quand un format est fourni", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({ prixVente: 999, nbPortions: 1 }); // ignorés : un format explicite est fourni
        const format = {
            id: 'fmt-a', prixVente: 10, nbPortions: 2, portionSize: 1, portionUnit: 'unité', salesMix: 0, indirectCosts: { portionsSold: 0 },
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        };
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, {}, new Set(), format);
        expect(costs.margeNetteDollar).toBeCloseTo(9); // prix 10 - (2$ de farine / 2 portions = 1$)
    });

    it("met en cache deux formats du même produit indépendamment (pas de collision)", () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct();
        const recipeIngredients = [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }];
        const formatSmall = { id: 'fmt-small', prixVente: 5, nbPortions: 1, portionSize: 1, indirectCosts: {}, ingredients: recipeIngredients };
        const formatBig = { id: 'fmt-big', prixVente: 20, nbPortions: 4, portionSize: 1, indirectCosts: {}, ingredients: recipeIngredients };
        const sharedMemo = {};
        const costsSmall = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, sharedMemo, new Set(), formatSmall);
        const costsBig = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], [], null, sharedMemo, new Set(), formatBig);
        expect(costsSmall.margeNetteDollar).toBeCloseTo(3);  // 5 - 2$ de farine (1 portion)
        expect(costsBig.margeNetteDollar).toBeCloseTo(19.5); // 20 - (2$ / 4 portions = 0.5$)
    });

    it('sous-traitance désactivée par défaut : aucun impact sur le coût', () => {
        const product = baseProduct({ prixVente: 20 });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], []);
        expect(costs.totalSubcontractingCost).toBe(0);
        expect(costs.costSubcontractingPerPortion).toBe(0);
    });

    it('sous-traitance activée : son coût rejoint les coûts directs (marge brute)', () => {
        const product = baseProduct({
            prixVente: 20, nbPortions: 1,
            formats: [{ id: 'fmt-1', prixVente: 20, nbPortions: 1, portionSize: 1, indirectCosts: {}, subcontracting: { enabled: true, items: [{ id: 's1', name: 'Embouteillage', cost: 3 }] } }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], []);
        expect(costs.totalSubcontractingCost).toBeCloseTo(3);
        expect(costs.margeBruteDollar).toBeCloseTo(17); // 20 - 3
    });

    it('vieillissement désactivé par défaut : aucun impact sur le coût', () => {
        const product = baseProduct({ prixVente: 20 });
        const costs = calculateCosts(product, baseGeneralInfo(), [], [product], []);
        expect(costs.totalAgingCost).toBe(0);
    });

    it('vieillissement activé : charge un intérêt de portage sur les charges directes, hors marge brute', () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 10, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 50, nbPortions: 1,
            formats: [{
                id: 'fmt-1', prixVente: 50, nbPortions: 1, portionSize: 1, indirectCosts: {}, aging: { enabled: true, interestRate: 12, months: 6 },
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // charges directes = 10$ ; intérêt = 10 × (12%/12) × 6 = 0.6$
        expect(costs.totalAgingCost).toBeCloseTo(0.6);
        expect(costs.margeBruteDollar).toBeCloseTo(40); // 50 - 10, le vieillissement n'y entre pas
        expect(costs.margeNetteDollar).toBeCloseTo(39.4); // 50 - 10 - 0.6
    });

    it("quantité produite manuelle fractionnaire (format en kg, ex. producteur vendant au poids) n'est pas tronquée", () => {
        const baseIngredients = [{ id: 'boeuf', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 0,
            formats: [{
                id: 'fmt-1', prixVente: 0, nbPortions: '47.3', portionSize: 1, portionUnit: 'kg', indirectCosts: {},
                ingredients: [{ id: 'boeuf', quantity: 50, recipeUnit: 'kg', yieldPercentage: 0 }],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // coût matière total = 100$ (50kg × 2$), réparti sur 47.3 kg produits (pas 47 ni 1)
        expect(costs.costMatierePerPortion).toBeCloseTo(100 / 47.3);
    });

    it('grille de rendement activée : calcule le nombre de portions plutôt que la valeur saisie manuellement', () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 1, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 10,
            formats: [{
                id: 'fmt-1', prixVente: 10, nbPortions: 1 /* ignoré */, portionSize: 100, indirectCosts: {},
                yieldGrid: { enabled: true, baseQuantity: 1000, stages: [{ percentEffect: -20 }], rejectRate: 0 },
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // 1000g × 0.8 = 800g / 100g = 8 unités => coût matière 1$/8 = 0.125$
        expect(costs.costMatierePerPortion).toBeCloseTo(0.125);
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

describe('computeChannelBreakdown (Phase 3.3)', () => {
    const baseIngredients = [{ id: 'farine', unitPrice: 4, lossPercentage: 0, unit: 'kg' }];
    const salesChannels = [
        { id: 'c_direct', name: 'Vente directe', links: [] },
        { id: 'c_distrib', name: 'Grande distribution', links: [{ type: 'margin', percent: 20 }] },
    ];

    it("calcule la marge pour chaque canal à partir des mêmes coûts (le coût ne varie pas par canal)", () => {
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {},
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 10, volume: 50 },
                    { id: 'cp2', channelId: 'c_distrib', netPrice: 8, volume: 200 },
                ],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        const breakdown = computeChannelBreakdown(costs, product.formats[0].channelPrices, salesChannels);
        expect(breakdown).toHaveLength(2);
        expect(breakdown[0]).toMatchObject({ channelId: 'c_direct', channelName: 'Vente directe', netPrice: 10, volume: 50 });
        expect(breakdown[0].margeNetteDollar).toBeCloseTo(6); // 10 - 4$ de farine
        expect(breakdown[1]).toMatchObject({ channelId: 'c_distrib', channelName: 'Grande distribution', netPrice: 8, volume: 200 });
        expect(breakdown[1].margeNetteDollar).toBeCloseTo(4); // 8 - 4$
    });

    it("omet un canal sans prix net saisi (pas de division par zéro forcée — voir chiffrier SymbiOse)", () => {
        const costs = calculateCosts(baseProduct(), baseGeneralInfo(), [], [baseProduct()], []);
        const breakdown = computeChannelBreakdown(costs, [
            { id: 'cp1', channelId: 'c_direct', netPrice: '', volume: 0 },
            { id: 'cp2', channelId: 'c_distrib', netPrice: 15, volume: 10 },
        ], salesChannels);
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].channelId).toBe('c_distrib');
    });

    it("omet une entrée dont le canal a été supprimé depuis", () => {
        const costs = calculateCosts(baseProduct(), baseGeneralInfo(), [], [baseProduct()], []);
        const breakdown = computeChannelBreakdown(costs, [{ id: 'cp1', channelId: 'canal_disparu', netPrice: 15, volume: 10 }], salesChannels);
        expect(breakdown).toEqual([]);
    });

    it('tableau vide pour un format sans aucun canal rattaché', () => {
        const costs = calculateCosts(baseProduct(), baseGeneralInfo(), [], [baseProduct()], []);
        expect(computeChannelBreakdown(costs, [], salesChannels)).toEqual([]);
    });

    it("calcule un point mort différent par canal (06/10) à partir des mêmes frais indirects alloués", () => {
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {},
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 10, volume: 50 },  // marge brute 6$
                    { id: 'cp2', channelId: 'c_distrib', netPrice: 8, volume: 200 }, // marge brute 4$
                ],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // Aucune main-d'œuvre dans ce produit (`productionSteps: []` par défaut) : le dénominateur
        // (marge de contribution sans MO) reste donc égal à la marge brute, comportement inchangé
        // par la révision du 20/10 (voir analysisData.js pour un cas AVEC main-d'œuvre).
        const breakdown = computeChannelBreakdown(costs, product.formats[0].channelPrices, salesChannels, 100 /* $ fixes alloués */);
        expect(breakdown[0].breakEvenUnits).toBe(17); // ceil(100 / 6)
        expect(breakdown[1].breakEvenUnits).toBe(25); // ceil(100 / 4)
    });

    it("breakEvenUnits est null quand fixedCostForBreakEven n'est pas fourni (comportement par défaut)", () => {
        const costs = calculateCosts(baseProduct(), baseGeneralInfo(), baseIngredients, [baseProduct()], []);
        const breakdown = computeChannelBreakdown(costs, [{ id: 'cp1', channelId: 'c_direct', netPrice: 15, volume: 10 }], salesChannels);
        expect(breakdown[0].breakEvenUnits).toBeNull();
    });

    it("traite la main-d'œuvre comme un coût FIXE pour le point mort (20/10, retour utilisateur) : exclue du dénominateur, pas l'inverse", () => {
        const laborDatabase = [{ postName: 'Cuisinier', employees: [{ hourlyRate: 10, socialCharges: 0, vacationPercentage: 0, workedHours: 10 }] }];
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, prixVente: 20, indirectCosts: {},
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
                productionSteps: [{ duration: 3600, personnel: [{ postId: 'Cuisinier' }] }],
                channelPrices: [{ id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 }],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], laborDatabase);
        // Coût matière 4 $ + MO 10 $ (1h × 10 $/h) = coût de production 14 $ ; marge brute = 20-14 = 6 $.
        expect(costs.costLaborPerPortion).toBeCloseTo(10);
        expect(costs.margeBruteDollar).toBeCloseTo(6);

        const breakdown = computeChannelBreakdown(costs, product.formats[0].channelPrices, salesChannels, 90 /* $ fixes, MO déjà incluse par l'appelant */);
        // Dénominateur = marge brute (6$) + MO par unité (10$) rajoutée = 16$ de contribution SANS
        // la main-d'œuvre (jamais 6$ seuls, qui la traiteraient à tort comme variable).
        expect(breakdown[0].breakEvenUnits).toBe(6); // ceil(90 / 16)
    });

    it("ajoute la part de frais fixes propre au CANAL (pool Phase 4.6) au numérateur du point mort — absente avant la révision du 20/10", () => {
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {},
                ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
                channelPrices: [{ id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 }],
            }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        // totalDirectCostPerPortion = 4$ (farine seule, aucune MO) ; pool canal : taux = 28/56 = 0.5
        // -> costIndirectChannelPerPortion = 4×0.5 = 2$/unité -> ×10 unités (volume du canal) = 20$.
        const channelPools = { c_direct: { amount: 28, driverTotal: 56 } };
        const breakdown = computeChannelBreakdown(costs, product.formats[0].channelPrices, salesChannels, 90 /* Général+Activité+MO, hors Canal */, channelPools);
        // Numérateur total = 90 (Général+Activité+MO) + 20 (Canal, propre à ce canal) = 110 ;
        // dénominateur = marge brute 16$ (20-4) — aucune MO ici, donc inchangée.
        expect(breakdown[0].breakEvenUnits).toBe(7); // ceil(110 / 16)
    });
});

describe('computeMarginsForPrice', () => {
    it('reproduit exactement les marges déjà calculées par calculateCosts pour le même prix', () => {
        const baseIngredients = [{ id: 'farine', unitPrice: 2, lossPercentage: 0, unit: 'kg' }];
        const product = baseProduct({
            prixVente: 20,
            ingredients: [{ id: 'farine', quantity: 1, recipeUnit: 'kg', yieldPercentage: 0 }],
        });
        const costs = calculateCosts(product, baseGeneralInfo(), baseIngredients, [product], []);
        const margins = computeMarginsForPrice(20, costs);
        expect(margins.margeNetteDollar).toBeCloseTo(costs.margeNetteDollar);
        expect(margins.margeBrutePercent).toBeCloseTo(costs.margeBrutePercent);
        expect(margins.costMatierePercent).toBeCloseTo(costs.costMatierePercent);
    });
});
