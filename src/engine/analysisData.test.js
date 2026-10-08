import { describe, it, expect } from 'vitest';
import { computeAnalysisData, computeMenuEngineeringQuadrants } from './analysisData.js';

const baseGeneralInfo = (overrides = {}) => ({
    totalRevenue: 0,
    menuRevenuePercentage: 100,
    totalIndirects: 0,
    kitchenProductivity: 100,
    ...overrides,
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
    indirectCosts: { method: 'fixed', fixedAmount: 0 },
    salesMix: 0,
    onMenu: true,
    ...overrides,
});

describe('computeAnalysisData - moyennes pondérées et point mort global', () => {
    it('pondère la marge et les coûts par le mix des ventes de chaque produit actif', () => {
        const productA = baseProduct({ id: 'A', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 70 });
        const productB = baseProduct({ id: 'B', isResaleProduct: true, purchaseCost: 2, prixVente: 10, salesMix: 30 });
        const products = [productA, productB];
        const generalInfo = baseGeneralInfo({ totalRevenue: 10000, totalIndirects: 1000 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        // A : marge 10$/20$ = 0.5, B : marge 8$/10$ = 0.8 -> pondéré 70/30 = 0.59
        expect(result.weightedGrossMargin).toBeCloseTo(0.59);
        // A : coût matière 10/20 = 0.5, B : 2/10 = 0.2 -> pondéré 70/30 = 0.41
        expect(result.weightedMaterialCost).toBeCloseTo(0.41);
        expect(result.weightedLaborCost).toBeCloseTo(0);
        // Point mort GLOBAL en chiffre d'affaires ($) = frais indirects fixes / taux de marge
        // pondéré par le REVENU. Prix moyen pondéré = (70×20 + 30×10)/100 = 17 ; taux de marge sur
        // revenu = (10×0.7 + 8×0.3)/17 = 9.4/17. Point mort = 1000 / (9.4/17) ≈ 1808,5 $.
        expect(result.globalBreakEven).toBeCloseTo(1000 / (9.4 / 17));
    });

    it('pondère le coût emballage par le mix des ventes (Phase 2.3)', () => {
        const basePackaging = [{ id: 'pot', unitPrice: 2, lossPercentage: 0, unit: 'unité' }];
        const productA = baseProduct({ id: 'A', prixVente: 20, salesMix: 70, packagingItems: [{ id: 'pot', quantity: 1, recipeUnit: 'unité' }] });
        const productB = baseProduct({ id: 'B', prixVente: 10, salesMix: 30, packagingItems: [{ id: 'pot', quantity: 1, recipeUnit: 'unité' }] });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([productA, productB], [], [], generalInfo, calculatedGeneralInfo, basePackaging);

        // A : coût emballage 2/20 = 0.1, B : 2/10 = 0.2 -> pondéré 70/30 = 0.13
        expect(result.weightedPackagingCost).toBeCloseTo(0.13);
    });

    it('exclut les produits hors menu du calcul des moyennes pondérées', () => {
        const productA = baseProduct({ id: 'A', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 100, onMenu: true });
        const productB = baseProduct({ id: 'B', isResaleProduct: true, purchaseCost: 19, prixVente: 20, salesMix: 999, onMenu: false });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([productA, productB], [], [], generalInfo, calculatedGeneralInfo);

        expect(result.activeProducts).toHaveLength(1);
        expect(result.activeProducts[0].id).toBe('A');
        expect(result.weightedGrossMargin).toBeCloseTo(0.5); // uniquement A, mix 100%
    });
});

describe('computeAnalysisData - analyse ABC', () => {
    it('classe les ingrédients en A/B/C selon les seuils cumulés de 70% et 90%', () => {
        // Un seul produit consommant 3 ingrédients, calibré pour que la valeur de
        // consommation de chacun corresponde exactement à sa quantité (batchesNeeded = 1).
        const baseIngredients = [
            { id: 'ing_A', name: 'Ingrédient A', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
            { id: 'ing_B', name: 'Ingrédient B', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
            { id: 'ing_C', name: 'Ingrédient C', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
        ];
        const product = baseProduct({
            prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true,
            ingredients: [
                { id: 'ing_A', quantity: 70, recipeUnit: 'unité' },
                { id: 'ing_B', quantity: 20, recipeUnit: 'unité' },
                { id: 'ing_C', quantity: 10, recipeUnit: 'unité' },
            ],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo);

        expect(result.abcAnalysisData.A.map(i => i.name)).toEqual(['Ingrédient A']);
        expect(result.abcAnalysisData.B.map(i => i.name)).toEqual(['Ingrédient B']);
        expect(result.abcAnalysisData.C.map(i => i.name)).toEqual(['Ingrédient C']);
    });
});

describe('computeAnalysisData - matrice BCG (menu engineering)', () => {
    it('classe chaque produit dans le bon quadrant selon sa popularité et sa rentabilité relatives', () => {
        const products = [
            baseProduct({ id: 'star', prixVente: 20, isResaleProduct: true, purchaseCost: 10, salesMix: 40, onMenu: true }), // marge 10, pop 40
            baseProduct({ id: 'cow', prixVente: 20, isResaleProduct: true, purchaseCost: 18, salesMix: 40, onMenu: true }),  // marge 2, pop 40
            baseProduct({ id: 'question', prixVente: 20, isResaleProduct: true, purchaseCost: 10, salesMix: 10, onMenu: true }), // marge 10, pop 10
            baseProduct({ id: 'dog', prixVente: 20, isResaleProduct: true, purchaseCost: 18, salesMix: 10, onMenu: true }),  // marge 2, pop 10
        ];
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        expect(result.menuEngineeringData.stars.map(p => p.id)).toEqual(['star']);
        expect(result.menuEngineeringData.cows.map(p => p.id)).toEqual(['cow']);
        expect(result.menuEngineeringData.questions.map(p => p.id)).toEqual(['question']);
        expect(result.menuEngineeringData.dogs.map(p => p.id)).toEqual(['dog']);
    });
});

describe('computeAnalysisData - contribution au profit', () => {
    it('trie les produits par contribution totale décroissante', () => {
        const products = [
            baseProduct({ id: 'low', prixVente: 10, isResaleProduct: true, purchaseCost: 8, salesMix: 10, onMenu: true }),
            baseProduct({ id: 'high', prixVente: 10, isResaleProduct: true, purchaseCost: 2, salesMix: 90, onMenu: true }),
        ];
        const generalInfo = baseGeneralInfo({ totalRevenue: 1000, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        expect(result.contributionData[0].name).toBe('Produit Test'); // le plus haut contributeur en premier
        expect(result.contributionData[0].totalContribution).toBeGreaterThan(result.contributionData[1].totalContribution);
    });
});

describe('computeAnalysisData - reconstruction des volumes (mix = popularité en unités)', () => {
    it('répartit les volumes selon la part de popularité, indépendamment du prix (mix ≠ part de revenu)', () => {
        // Deux plats à popularité égale (50/50) mais à prix très différents. Le mix étant une part
        // d'UNITÉS, les deux doivent vendre le même nombre d'unités — donc consommer la même
        // quantité de leur ingrédient respectif. L'ancienne formule (revenu × mix / prix) aurait
        // donné 4× plus d'unités au plat bon marché.
        const baseIngredients = [
            { id: 'ingA', name: 'Ing A', provider: 'PA', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
            { id: 'ingB', name: 'Ing B', provider: 'PB', unit: 'unité', unitPrice: 1, lossPercentage: 0 },
        ];
        const p1 = baseProduct({ id: 'cher', prixVente: 40, salesMix: 50, nbPortions: 1, ingredients: [{ id: 'ingA', quantity: 1, recipeUnit: 'unité' }] });
        const p2 = baseProduct({ id: 'bon_marche', prixVente: 10, salesMix: 50, nbPortions: 1, ingredients: [{ id: 'ingB', quantity: 1, recipeUnit: 'unité' }] });
        // Prix moyen pondéré = (50×40 + 50×10)/100 = 25 ; unités totales = 2500/25 = 100 ; 50 chacun.
        const generalInfo = baseGeneralInfo({ totalRevenue: 2500, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([p1, p2], baseIngredients, [], generalInfo, calculatedGeneralInfo);

        const qtyA = result.purchasingReportData.groupedByProvider['PA'].items.find(i => i.id === 'ingA').totalQuantity;
        const qtyB = result.purchasingReportData.groupedByProvider['PB'].items.find(i => i.id === 'ingB').totalQuantity;
        expect(qtyA).toBeCloseTo(50);
        expect(qtyB).toBeCloseTo(50);
    });
});

describe('computeAnalysisData - matrice sur marge incluant la main-d\'œuvre (semi-variable)', () => {
    it('classe selon la marge de contribution incluant la MO (prix − coût matière − MO)', () => {
        // Deux plats à popularité égale. Le plat 1 est intensif en main-d'œuvre : à faible coût
        // matière mais fort coût MO, sa marge (MO incluse) est faible (8) — c'est une VACHE.
        // Le plat 2, sans MO, a une marge plus élevée (12) — c'est un STAR. La MO étant traitée
        // comme un coût semi-variable, elle pèse bien dans la rentabilité (choix méthodologique).
        const laborDatabase = [
            { postName: 'Cuisinier', employees: [{ hourlyRate: 60, socialCharges: 0, vacationPercentage: 0, workedHours: 1 }] },
        ];
        const baseIngredients = [
            { id: 'faible', name: 'Peu coûteux', unit: 'unité', unitPrice: 2, lossPercentage: 0 },
            { id: 'eleve', name: 'Coûteux', unit: 'unité', unitPrice: 8, lossPercentage: 0 },
        ];
        const laborHeavy = baseProduct({
            id: 'laborHeavy', prixVente: 20, salesMix: 50, nbPortions: 1,
            ingredients: [{ id: 'faible', quantity: 1, recipeUnit: 'unité' }],
            productionSteps: [{ stepId: 's1', personnel: [{ postId: 'Cuisinier' }], startTime: 0, duration: 600 }],
        });
        const laborLight = baseProduct({
            id: 'laborLight', prixVente: 20, salesMix: 50, nbPortions: 1,
            ingredients: [{ id: 'eleve', quantity: 1, recipeUnit: 'unité' }],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 2000, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, kitchenProductivity: 100, operationCostPerHour: 0, productivityReport: {} };

        const result = computeAnalysisData([laborHeavy, laborLight], baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo);

        // Marges (MO incluse) : laborHeavy 20−(2+10)=8 < moyenne 10 -> vache ; laborLight 20−8=12 -> star.
        expect(result.menuEngineeringData.stars.map(p => p.id)).toEqual(['laborLight']);
        expect(result.menuEngineeringData.cows.map(p => p.id)).toEqual(['laborHeavy']);
    });
});

describe('computeAnalysisData - règle des 70 % sur la popularité', () => {
    it('classe comme populaire un plat au-dessus de 70 % de la part moyenne (et non de la moyenne brute)', () => {
        // 3 plats, part moyenne = 33,3 %. Seuil à 70 % = 23,3 %. Le plat à 25 % est POPULAIRE selon
        // la règle des 70 % (alors qu'il serait « peu populaire » avec le seuil = moyenne brute).
        const products = [
            baseProduct({ id: 'gros', prixVente: 20, isResaleProduct: true, purchaseCost: 15, salesMix: 50, onMenu: true }),      // contribution 5
            baseProduct({ id: 'borderline', prixVente: 20, isResaleProduct: true, purchaseCost: 5, salesMix: 25, onMenu: true }), // contribution 15
            baseProduct({ id: 'petit', prixVente: 20, isResaleProduct: true, purchaseCost: 15, salesMix: 25, onMenu: true }),     // contribution 5
        ];
        const generalInfo = baseGeneralInfo(); // totalRevenue 0 -> seuil de rentabilité = moyenne simple des contributions
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo);

        // 'borderline' (pop 25 % ≥ 23,3 % et contribution 15 ≥ moyenne 8,33) -> STAR.
        // Avec l'ancien seuil (= moyenne 33,3 %), il aurait été « dilemme » (peu populaire).
        expect(result.menuEngineeringData.stars.map(p => p.id)).toEqual(['borderline']);
    });
});

describe('computeAnalysisData - formats multiples (Phase 1.6)', () => {
    const multiFormatProduct = (overrides = {}) => ({
        id: 'prod_confiture',
        platName: 'Confiture de fraises',
        category: 'Confiture',
        onMenu: true,
        formats: [
            {
                id: 'fmt_250', sku: 'CONF-250ML', prixVente: 8, nbPortions: 1, portionSize: 250, portionUnit: 'ml',
                salesMix: 60, onMenu: true, ingredients: [{ id: 'ing_fraise', quantity: 1, recipeUnit: 'kg' }], productionSteps: [],
                isResaleProduct: false, purchaseCost: 0, indirectCosts: {},
            },
            {
                id: 'fmt_500', sku: 'CONF-500ML', prixVente: 14, nbPortions: 1, portionSize: 500, portionUnit: 'ml',
                salesMix: 40, onMenu: true, ingredients: [{ id: 'ing_fraise', quantity: 2, recipeUnit: 'kg' }], productionSteps: [],
                isResaleProduct: false, purchaseCost: 0, indirectCosts: {},
            },
        ],
        ...overrides,
    });
    const baseIngredients = [{ id: 'ing_fraise', name: 'Fraises', provider: 'Fournisseur Fraises', unit: 'kg', unitPrice: 5, lossPercentage: 0 }];
    const generalInfoFor = (overrides = {}) => baseGeneralInfo({ totalRevenue: 1000, menuRevenuePercentage: 100, ...overrides });
    const calcGeneralInfoFor = (generalInfo) => ({ ...generalInfo, productivityReport: {} });

    it('produit une ligne par format, avec un id de ligne distinct et le même productId', () => {
        const product = multiFormatProduct();
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        expect(result.productsWithCosts).toHaveLength(2);
        const [row250, row500] = result.productsWithCosts;
        expect(row250.id).toBe('fmt_250');
        expect(row500.id).toBe('fmt_500');
        expect(row250.productId).toBe('prod_confiture');
        expect(row500.productId).toBe('prod_confiture');
        expect(row250.formatIndex).toBe(0);
        expect(row500.formatIndex).toBe(1);
    });

    it("calcule le coût de chaque format à partir de SA PROPRE fiche recette, pas d'un lot partagé", () => {
        const product = multiFormatProduct();
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        const row250 = result.productsWithCosts.find(r => r.id === 'fmt_250');
        const row500 = result.productsWithCosts.find(r => r.id === 'fmt_500');
        // 250 ml : 1 kg de fraises à 5$/kg = 5$ ; 500 ml : 2 kg = 10$ — chaque format son propre coût.
        expect(row250.costs.totalIngredientsCost).toBeCloseTo(5);
        expect(row500.costs.totalIngredientsCost).toBeCloseTo(10);
    });

    it('le rapport d\'achats cumule la consommation des DEUX formats, pas seulement le premier', () => {
        const product = multiFormatProduct();
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        // Chaque format vend ses propres unités (mix 60/40), consommant respectivement 1 kg et 2 kg
        // de fraises par unité vendue — la quantité totale achetée doit refléter les deux, pas
        // seulement le format par défaut (ce qui aurait ignoré la consommation du format 500 ml).
        const totalQty = result.purchasingReportData.groupedByProvider['Fournisseur Fraises'].items.find(i => i.id === 'ing_fraise').totalQuantity;
        expect(totalQty).toBeGreaterThan(0);
        // Preuve directe que le format 500 ml contribue : désactiver son "onMenu" doit réduire la quantité totale.
        const productOnlyDefaultActive = multiFormatProduct({
            formats: [
                { ...multiFormatProduct().formats[0] },
                { ...multiFormatProduct().formats[1], onMenu: false, salesMix: 0 },
            ],
        });
        const resultDefaultOnly = computeAnalysisData([productOnlyDefaultActive], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));
        const qtyDefaultOnly = resultDefaultOnly.purchasingReportData.groupedByProvider['Fournisseur Fraises'].items.find(i => i.id === 'ing_fraise').totalQuantity;
        expect(qtyDefaultOnly).toBeLessThan(totalQty);
    });

    it('calcule displayName sur chaque ligne de productsWithCosts (pas seulement contributionData)', () => {
        const product = multiFormatProduct();
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        const names = result.productsWithCosts.map(r => r.displayName).sort();
        expect(names).toEqual(['Confiture de fraises (250 ml)', 'Confiture de fraises (500 ml)']);
    });

    it("garde le nom seul dans displayName quand un format est désactivé et qu'il n'en reste qu'un affiché dans contributionData, mais désambiguïse quand même dans productsWithCosts (le produit a bien 2 formats)", () => {
        const product = multiFormatProduct({
            formats: [
                multiFormatProduct().formats[0],
                { ...multiFormatProduct().formats[1], onMenu: false, salesMix: 0 },
            ],
        });
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        // productsWithCosts inclut les deux lignes (actives ou non) : toutes deux désambiguïsées,
        // puisque le produit a bien 2 formats au total.
        expect(result.productsWithCosts.map(r => r.displayName).sort()).toEqual(['Confiture de fraises (250 ml)', 'Confiture de fraises (500 ml)']);
    });

    it('désambiguïse le nom dans contributionData quand plusieurs formats du même produit sont actifs', () => {
        const product = multiFormatProduct();
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calcGeneralInfoFor(generalInfo));

        expect(result.contributionData).toHaveLength(2);
        const names = result.contributionData.map(c => c.name).sort();
        expect(names).toEqual(['Confiture de fraises (250 ml)', 'Confiture de fraises (500 ml)']);
    });

    it('un produit à un seul format ne gagne pas de suffixe dans contributionData (non-régression)', () => {
        const product = baseProduct({ salesMix: 100, prixVente: 10 });
        const generalInfo = generalInfoFor();
        const result = computeAnalysisData([product], [], [], generalInfo, calcGeneralInfoFor(generalInfo));

        expect(result.contributionData[0].name).toBe('Produit Test');
    });
});

describe('computeAnalysisData - rapport d\'achats et pertes', () => {
    it('calcule le coût net et le coût de perte cohérents avec le taux de perte de l\'ingrédient', () => {
        const baseIngredients = [
            { id: 'ing_1', name: 'Farine', provider: 'Fournisseur A', unit: 'kg', unitPrice: 2, lossPercentage: 20 },
        ];
        const product = baseProduct({
            prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true,
            ingredients: [{ id: 'ing_1', quantity: 10, recipeUnit: 'kg' }],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo);

        // batchesNeeded = 1 -> quantité nette = 10kg, coût net = 10 * 2$ = 20$
        expect(result.purchasingReportData.totalNetCost).toBeCloseTo(20);
        // coût de perte = net / (1 - 20%) - net = 20/0.8 - 20 = 5
        expect(result.purchasingReportData.totalLossCost).toBeCloseTo(5);
        expect(result.purchasingReportData.groupedByProvider['Fournisseur A'].totalCost).toBeCloseTo(25);
    });
});

describe('computeAnalysisData - rapport d\'achats et analyse ABC du Packaging (Phase 2.3)', () => {
    it("calcule un rapport d'achats et une analyse ABC du packaging, séparés et jamais fusionnés avec ceux des ingrédients", () => {
        const baseIngredients = [{ id: 'ing_1', name: 'Farine', provider: 'Fournisseur A', unit: 'kg', unitPrice: 2, lossPercentage: 0 }];
        const basePackaging = [{ id: 'pkg_1', name: 'Pot de verre', provider: 'Fournisseur Verre', unit: 'unité', unitPrice: 1, lossPercentage: 20 }];
        const product = baseProduct({
            prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true,
            ingredients: [{ id: 'ing_1', quantity: 1, recipeUnit: 'kg' }],
            packagingItems: [{ id: 'pkg_1', quantity: 10, recipeUnit: 'unité' }],
        });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo, basePackaging);

        // Rapport d'achats du packaging : 10 pots x 1$ = 10$ net, perte = 10/0.8 - 10 = 2.5$.
        expect(result.packagingPurchasingReportData.totalNetCost).toBeCloseTo(10);
        expect(result.packagingPurchasingReportData.totalLossCost).toBeCloseTo(2.5);
        expect(result.packagingPurchasingReportData.groupedByProvider['Fournisseur Verre'].totalCost).toBeCloseTo(12.5);
        // Analyse ABC du packaging : un seul item, forcément 100% de la valeur -> catégorie A.
        expect(result.packagingAbcAnalysisData.A.map(i => i.name)).toEqual(['Pot de verre']);

        // Les rapports/ABC des ingrédients restent indépendants (pas de pot de verre mélangé).
        expect(result.purchasingReportData.totalNetCost).toBeCloseTo(2); // 1kg x 2$
        expect(result.abcAnalysisData.A.map(i => i.name)).toEqual(['Farine']);
    });

    it('un catalogue Packaging vide donne un rapport et une ABC vides, sans erreur', () => {
        const product = baseProduct({ prixVente: 100, nbPortions: 1, salesMix: 100, onMenu: true });
        const generalInfo = baseGeneralInfo({ totalRevenue: 100, menuRevenuePercentage: 100 });
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], [], [], generalInfo, calculatedGeneralInfo);

        expect(result.packagingPurchasingReportData.totalNetCost).toBe(0);
        expect(result.packagingAbcAnalysisData.A).toEqual([]);
    });
});

describe('computeAnalysisData - channelBreakdown par ligne (Phase 3.3)', () => {
    it('ajoute une ventilation par canal à chaque ligne, à partir de channelPrices du format', () => {
        const salesChannels = [
            { id: 'c_direct', name: 'Vente directe', links: [] },
            { id: 'c_distrib', name: 'Grande distribution', links: [{ type: 'margin', percent: 50 }] },
        ];
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {}, ingredients: [],
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 },
                    { id: 'cp2', channelId: 'c_distrib', netPrice: 10, volume: 40 },
                ],
            }],
        });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], [], [], generalInfo, calculatedGeneralInfo, [], salesChannels);
        const [row] = result.productsWithCosts;
        expect(row.channelBreakdown).toHaveLength(2);
        expect(row.channelBreakdown.map(c => c.channelName)).toEqual(['Vente directe', 'Grande distribution']);
        expect(row.channelBreakdown[0].margeNetteDollar).toBeCloseTo(20); // aucun coût, aucun maillon
        expect(row.channelBreakdown[1].margeNetteDollar).toBeCloseTo(10);
    });

    it("calcule un point mort par canal (06/10) à partir des frais indirects alloués à ce format", () => {
        const salesChannels = [
            { id: 'c_direct', name: 'Vente directe', links: [] },
            { id: 'c_distrib', name: 'Grande distribution', links: [] },
        ];
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {}, ingredients: [], salesMix: 50,
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 },   // marge brute 20$
                    { id: 'cp2', channelId: 'c_distrib', netPrice: 10, volume: 40 },  // marge brute 10$
                ],
            }],
        });
        const generalInfo = baseGeneralInfo({ totalIndirects: 200 }); // alloué à ce format : 200 * 50% = 100$
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], [], [], generalInfo, calculatedGeneralInfo, [], salesChannels);
        const [row] = result.productsWithCosts;
        expect(row.channelBreakdown[0].breakEvenUnits).toBe(5);  // ceil(100 / 20)
        expect(row.channelBreakdown[1].breakEvenUnits).toBe(10); // ceil(100 / 10)
    });

    it('tableau vide sans salesChannels (comportement par défaut, rétrocompatible)', () => {
        const product = baseProduct({
            formats: [{ id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {}, ingredients: [], channelPrices: [{ id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 }] }],
        });
        const generalInfo = baseGeneralInfo();
        const result = computeAnalysisData([product], [], [], generalInfo, { ...generalInfo, productivityReport: {} });
        expect(result.productsWithCosts[0].channelBreakdown).toEqual([]);
    });
});

describe('computeAnalysisData - vue « tous canaux » des KPIs pondérés et de la contribution (06/10)', () => {
    it("pondère les coûts/marges par le volume RÉEL de CHAQUE canal, pas seulement le canal principal", () => {
        const salesChannels = [
            { id: 'c_direct', name: 'Vente directe', links: [] },
            { id: 'c_epi', name: 'Épiceries', links: [] },
        ];
        // Coût matière fixe à 10$ (ne varie jamais par canal). Canal principal (direct) : prix
        // 20$ -> coût matière 50%. Canal secondaire (épiceries, PAS le canal principal) : prix
        // 10$ -> coût matière 100%. Volumes égaux (50/50) -> pondéré = 75%. Avant ce correctif, un
        // changement de prix sur le canal secondaire ne bougeait jamais ce chiffre (resté à 50%,
        // canal principal seul) — c'est exactement le bug rapporté par l'utilisateur.
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {}, salesMix: 100, onMenu: true,
                ingredients: [{ id: 'ing_1', quantity: 1, recipeUnit: 'kg' }],
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 50 },
                    { id: 'cp2', channelId: 'c_epi', netPrice: 10, volume: 50 },
                ],
            }],
        });
        const baseIngredients = [{ id: 'ing_1', name: 'Ing', unit: 'kg', unitPrice: 10, lossPercentage: 0 }];
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], baseIngredients, [], generalInfo, calculatedGeneralInfo, [], salesChannels);

        expect(result.weightedMaterialCost).toBeCloseTo(0.75);
    });

    it("somme la contribution RÉELLE de chaque canal (volume × marge brute), pas seulement le canal principal", () => {
        const salesChannels = [
            { id: 'c_direct', name: 'Vente directe', links: [] },
            { id: 'c_epi', name: 'Épiceries', links: [] },
        ];
        const product = baseProduct({
            formats: [{
                id: 'fmt-1', nbPortions: 1, portionSize: 1, indirectCosts: {}, salesMix: 100, onMenu: true, ingredients: [],
                channelPrices: [
                    { id: 'cp1', channelId: 'c_direct', netPrice: 20, volume: 10 }, // marge 20$ × 10 = 200
                    { id: 'cp2', channelId: 'c_epi', netPrice: 10, volume: 40 },    // marge 10$ × 40 = 400
                ],
            }],
        });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([product], [], [], generalInfo, calculatedGeneralInfo, [], salesChannels);

        expect(result.contributionData[0].totalContribution).toBeCloseTo(600);
    });

    it("la popularité « tous canaux » de la matrice BCG utilise le volume RÉEL agrégé à travers les canaux, jamais salesMix (évite la dilution par un format en mode manuel — 07/10)", () => {
        const salesChannels = [{ id: 'c1', name: 'Canal 1', links: [] }];
        // `tracked` a un salesMix de 10 % (dilué par le 90 % fixe de `manual`), mais un volume
        // RÉEL de 1000 unités sur son seul canal. `manual` a un salesMix de 90 % mais ZÉRO volume
        // réel (pas de channelPrices du tout — mode manuel, jamais vraiment vendu). Avec l'ancien
        // calcul (popularity = salesMix), `tracked` aurait 10 % de popularité (sous le seuil) ;
        // avec le nouveau calcul (popularity = part du volume réel), `tracked` doit avoir ~100 %
        // et `manual`, n'ayant AUCUNE performance réelle à classer, doit être exclu de la matrice
        // plutôt que forcé à 0 % (ce qui fausserait quand même le seuil des autres — 07/10).
        const tracked = baseProduct({
            id: 'tracked', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 10, onMenu: true,
            channelPrices: [{ id: 'cp1', channelId: 'c1', netPrice: 20, volume: 1000 }],
        });
        const manual = baseProduct({
            id: 'manual', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 90, onMenu: true,
        });
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData([tracked, manual], [], [], generalInfo, calculatedGeneralInfo, [], salesChannels);

        const allRows = [...result.menuEngineeringData.stars, ...result.menuEngineeringData.cows, ...result.menuEngineeringData.questions, ...result.menuEngineeringData.dogs];
        expect(allRows.find(r => r.id === 'tracked').popularity).toBeCloseTo(100);
        expect(allRows.find(r => r.id === 'manual')).toBeUndefined();
    });

    it("se replie sur salesMix/unités reconstruites si AUCUN produit actif n'a de volume réel sur aucun canal (rétrocompatibilité)", () => {
        const products = [
            baseProduct({ id: 'A', isResaleProduct: true, purchaseCost: 10, prixVente: 20, salesMix: 40, onMenu: true }),
            baseProduct({ id: 'B', isResaleProduct: true, purchaseCost: 18, prixVente: 20, salesMix: 60, onMenu: true }),
        ];
        const generalInfo = baseGeneralInfo();
        const calculatedGeneralInfo = { ...generalInfo, productivityReport: {} };

        const result = computeAnalysisData(products, [], [], generalInfo, calculatedGeneralInfo, [], []);

        const allRows = [...result.menuEngineeringData.stars, ...result.menuEngineeringData.cows, ...result.menuEngineeringData.questions, ...result.menuEngineeringData.dogs];
        expect(allRows.find(r => r.id === 'A').popularity).toBeCloseTo(40);
        expect(allRows.find(r => r.id === 'B').popularity).toBeCloseTo(60);
    });
});

describe('computeMenuEngineeringQuadrants — fonction pure (réutilisée pour une analyse BCG limitée à un seul canal)', () => {
    it('classe des lignes déjà réduites à popularité/marge/volume, indépendamment de toute autre donnée produit', () => {
        const rows = [
            { id: 'star', popularity: 40, margeBruteDollar: 10, volume: 40 },
            { id: 'cow', popularity: 40, margeBruteDollar: 2, volume: 40 },
            { id: 'question', popularity: 10, margeBruteDollar: 10, volume: 10 },
            { id: 'dog', popularity: 10, margeBruteDollar: 2, volume: 10 },
        ];
        const result = computeMenuEngineeringQuadrants(rows);
        expect(result.stars.map(r => r.id)).toEqual(['star']);
        expect(result.cows.map(r => r.id)).toEqual(['cow']);
        expect(result.questions.map(r => r.id)).toEqual(['question']);
        expect(result.dogs.map(r => r.id)).toEqual(['dog']);
    });

    it('retourne des quadrants vides sans lancer d\'erreur pour une liste vide (ex. aucun SKU vendu dans le canal choisi)', () => {
        const result = computeMenuEngineeringQuadrants([]);
        expect(result).toEqual({ stars: [], cows: [], questions: [], dogs: [] });
    });
});
