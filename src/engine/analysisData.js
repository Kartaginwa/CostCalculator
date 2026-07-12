import { parseLocaleNumber, CONVERSION_FACTORS } from '../utils.js';
import { calculateCosts } from './calculateCosts.js';

// Calcule l'ensemble des données d'analyse dérivées du projet : coûts de tous les produits,
// KPIs pondérés et point mort global, rapport d'achats et pertes, analyse ABC (Pareto),
// matrice BCG (menu engineering) et classement par contribution au profit. Extrait de App.jsx
// pour pouvoir être testé isolément, au même titre que calculateCosts.
export function computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo) {
    // 1. Calcul initial des coûts (une seule passe, memo partagé)
    const costsMemo = {};
    const productsWithCosts = [];
    for (const p of products) {
        productsWithCosts.push({
            ...p,
            costs: calculateCosts(p, calculatedGeneralInfo, baseIngredients, products, laborDatabase, null, costsMemo, new Set())
        });
    }

    // 2. Définition des produits actifs
    const activeProducts = productsWithCosts.filter(p => p.onMenu);
    const totalSalesMix = activeProducts.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);

    // 3. Reconstruction des VOLUMES à partir du mix.
    //    Le mix des ventes est une part de POPULARITÉ (unités vendues), pas de revenu — c'est ainsi
    //    qu'il est saisi et importé depuis les données de caisse. On reconstruit donc les unités de
    //    façon dimensionnellement cohérente : unités totales = revenu du menu / prix moyen pondéré
    //    par le mix, puis réparties selon la part de popularité de chaque plat. (L'ancienne formule
    //    « revenu × mix / prix » traitait implicitement le mix comme une part de revenu, ce qui
    //    faussait tous les volumes — achats, ABC, contribution — dès que les prix différaient d'un
    //    plat à l'autre.)
    const menuRevenue = parseLocaleNumber(generalInfo.totalRevenue) * (parseLocaleNumber(generalInfo.menuRevenuePercentage) / 100);
    const weightedAvgPrice = totalSalesMix > 0
        ? activeProducts.reduce((s, p) => s + parseLocaleNumber(p.salesMix) * parseLocaleNumber(p.prixVente), 0) / totalSalesMix
        : 0;
    const totalUnitsSold = weightedAvgPrice > 0 ? menuRevenue / weightedAvgPrice : 0;
    const unitsSoldById = {};
    for (const p of activeProducts) {
        const share = totalSalesMix > 0 ? parseLocaleNumber(p.salesMix) / totalSalesMix : 0;
        unitsSoldById[p.id] = totalUnitsSold * share;
    }

    // 4. KPIs globaux + point mort
    let weightedGrossMargin = 0;   // pondéré par la popularité (unités) — cohérent avec l'affichage
    let globalBreakEven = 0;       // en CHIFFRE D'AFFAIRES ($) — conservé pour l'export Excel
    let globalBreakEvenUnits = 0;  // en UNITÉS — objectif principal affiché dans l'app
    let weightedMaterialCost = 0;
    let weightedLaborCost = 0;

    if (totalSalesMix > 0) {
        for (const p of activeProducts) {
            const prixVente = parseLocaleNumber(p.prixVente);
            const profitMargin = prixVente > 0 ? p.costs.margeBruteDollar / prixVente : 0;
            const weight = parseLocaleNumber(p.salesMix) / totalSalesMix;

            weightedGrossMargin += (profitMargin * weight);
            weightedMaterialCost += (p.costs.costMatierePercent * weight);
            weightedLaborCost += (p.costs.costLaborPercent * weight);
        }

        // Point mort. Hypothèse du modèle : matière + main-d'œuvre = variables (MO semi-variable,
        // cf. calculateCosts), frais indirects = seuls coûts fixes.
        //  - EN UNITÉS (objectif de l'outil) : coûts fixes / marge de contribution moyenne PAR UNITÉ,
        //    pondérée par la popularité — soit le nombre d'unités à vendre, au mix actuel, pour
        //    couvrir les frais indirects.
        //  - EN CHIFFRE D'AFFAIRES : coûts fixes / taux de marge pondéré par le REVENU (conservé
        //    pour l'export ; équivaut au point mort en unités × prix moyen).
        const avgMarginPerUnit = activeProducts.reduce(
            (s, p) => s + p.costs.margeBruteDollar * (parseLocaleNumber(p.salesMix) / totalSalesMix), 0
        );
        const totalMarginDollar = activeProducts.reduce((s, p) => s + p.costs.margeBruteDollar * (unitsSoldById[p.id] || 0), 0);
        const revenueWeightedMarginRatio = menuRevenue > 0 ? totalMarginDollar / menuRevenue : 0;
        const menuRevPerc = (parseLocaleNumber(generalInfo.menuRevenuePercentage) || 100) / 100;
        const indirectsMenu = parseLocaleNumber(generalInfo.totalIndirects) * menuRevPerc;
        globalBreakEvenUnits = avgMarginPerUnit > 0 ? indirectsMenu / avgMarginPerUnit : 0;
        globalBreakEven = revenueWeightedMarginRatio > 0 ? indirectsMenu / revenueWeightedMarginRatio : 0;
    }

    // 5. Calcul du Rapport d'Achats — quantités basées sur les unités reconstruites (étape 3).
    let totalNetCost = 0;
    let totalLossCost = 0;
    const groupedByProvider = {};

    for (const ing of baseIngredients) {
        let totalQty = 0;
        for (const product of activeProducts) {
            const portionsSold = unitsSoldById[product.id] || 0;
            if (portionsSold <= 0) continue;
            const batchesNeeded = portionsSold / (parseLocaleNumber(product.nbPortions) || 1);
            for (const item of (product.ingredients || [])) {
                if (item.id === ing.id) {
                    const recipeUnit = item.recipeUnit || ing.unit;
                    const conv = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[ing.unit]?.factor || 1);
                    totalQty += parseLocaleNumber(item.quantity) * conv * batchesNeeded;
                }
            }
        }
        if (totalQty > 0) {
            const lossP = (parseLocaleNumber(ing.lossPercentage) || 0) / 100;
            const net = totalQty * ing.unitPrice;
            const lossVal = lossP > 0 && lossP < 1 ? (net / (1 - lossP)) - net : net * lossP;
            totalNetCost += net;
            totalLossCost += lossVal;
            const prov = ing.provider || "Non spécifié";
            if (!groupedByProvider[prov]) groupedByProvider[prov] = { items: [], totalPurchase: 0, totalLoss: 0, totalCost: 0 };
            groupedByProvider[prov].items.push({ ...ing, totalQuantity: totalQty, purchaseCost: net, lossQuantity: totalQty * (lossP / (1 - lossP) || 0), lossCost: lossVal, totalCost: net + lossVal });
            groupedByProvider[prov].totalPurchase += net;
            groupedByProvider[prov].totalLoss += lossVal;
            groupedByProvider[prov].totalCost += (net + lossVal);
        }
    }
    const purchasingReportData = { totalNetCost, totalLossCost, totalPurchaseCost: totalNetCost + totalLossCost, groupedByProvider, grandTotal: { purchase: totalNetCost, loss: totalLossCost, total: totalNetCost + totalLossCost } };

    // 6. Analyse ABC — valeur de consommation basée sur les mêmes unités reconstruites.
    const allItems = [];
    for (const ing of baseIngredients) {
        let consumptionValue = 0;
        for (const product of activeProducts) {
            const portionsSold = unitsSoldById[product.id] || 0;
            if (portionsSold <= 0) continue;
            const batchesNeeded = portionsSold / (parseLocaleNumber(product.nbPortions) || 1);
            for (const item of (product.ingredients || [])) {
                if (item.id === ing.id) {
                    const conv = (CONVERSION_FACTORS[item.recipeUnit || ing.unit]?.factor || 1) / (CONVERSION_FACTORS[ing.unit]?.factor || 1);
                    consumptionValue += parseLocaleNumber(item.quantity) * conv * batchesNeeded * ing.unitPrice;
                }
            }
        }
        if (consumptionValue > 0) allItems.push({ name: ing.name, value: consumptionValue });
    }
    allItems.sort((a, b) => b.value - a.value);
    const totalVal = allItems.reduce((sum, item) => sum + item.value, 0);
    const abcAnalysisData = { A: [], B: [], C: [], totals: { A: 0, B: 0, C: 0 } };
    let cumulativeValue = 0;
    for (const item of allItems) {
        const cumPercentBefore = (cumulativeValue / totalVal) * 100;
        const itemPercent = (item.value / totalVal) * 100;
        if (cumPercentBefore < 70) { abcAnalysisData.A.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.A += itemPercent; }
        else if (cumPercentBefore < 90) { abcAnalysisData.B.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.B += itemPercent; }
        else { abcAnalysisData.C.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.C += itemPercent; }
        cumulativeValue += item.value;
    }

    // 7. Matrice d'ingénierie de menu (Kasavana-Smith) :
    //    - axe rentabilité = marge de contribution incluant la main-d'œuvre semi-variable
    //      (margeBruteDollar), conformément à la pratique de conseil retenue ;
    //    - seuil de popularité = 70 % de la part moyenne (règle des 70 %) ;
    //    - seuil de rentabilité = marge moyenne pondérée par les unités vendues.
    const menuEngineeringData = { stars: [], cows: [], questions: [], dogs: [] };
    if (activeProducts.length > 0) {
        const avgShare = totalSalesMix / activeProducts.length;         // part moyenne (en points de %)
        const popularityThreshold = 0.70 * avgShare;                    // règle des 70 %
        const totalUnitsActive = activeProducts.reduce((s, p) => s + (unitsSoldById[p.id] || 0), 0);
        const totalMarginActive = activeProducts.reduce((s, p) => s + p.costs.margeBruteDollar * (unitsSoldById[p.id] || 0), 0);
        const avgMargin = totalUnitsActive > 0
            ? totalMarginActive / totalUnitsActive
            : activeProducts.reduce((s, p) => s + p.costs.margeBruteDollar, 0) / activeProducts.length;
        for (const p of activeProducts) {
            const highPop = parseLocaleNumber(p.salesMix) >= popularityThreshold;
            const highProf = p.costs.margeBruteDollar >= avgMargin;
            if (highPop && highProf) menuEngineeringData.stars.push(p);
            else if (highPop && !highProf) menuEngineeringData.cows.push(p);
            else if (!highPop && highProf) menuEngineeringData.questions.push(p);
            else menuEngineeringData.dogs.push(p);
        }
    }

    // 8. Données de contribution — unités vendues × marge de contribution par portion (MO incluse).
    const contributionData = activeProducts.map(p => ({
        name: p.platName,
        totalContribution: (unitsSoldById[p.id] || 0) * p.costs.margeBruteDollar,
    })).sort((a, b) => b.totalContribution - a.totalContribution);

    return {
        productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin, globalBreakEven,
        globalBreakEvenUnits, weightedMaterialCost, weightedLaborCost, menuEngineeringData,
        purchasingReportData, abcAnalysisData, contributionData,
        productivityReport: calculatedGeneralInfo.productivityReport
    };
}
