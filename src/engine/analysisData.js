import { parseLocaleNumber, CONVERSION_FACTORS } from '../utils.js';
import { calculateCosts } from './calculateCosts.js';

// Calcule l'ensemble des données d'analyse dérivées du projet : coûts de tous les produits,
// KPIs pondérés et point mort global, rapport d'achats et pertes, analyse ABC (Pareto),
// matrice BCG (menu engineering) et classement par contribution au profit. Extrait de App.jsx
// pour pouvoir être testé isolément, au même titre que calculateCosts.
export function computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo) {
    // 1. Calcul initial des coûts
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

    // 3. Initialisation des KPIs globaux
    let weightedGrossMargin = 0;
    let globalBreakEven = 0;
    let weightedMaterialCost = 0;
    let weightedLaborCost = 0;
    const menuRevenue = parseLocaleNumber(generalInfo.totalRevenue) * (parseLocaleNumber(generalInfo.menuRevenuePercentage) / 100);

    // 4. Calcul des moyennes pondérées
    if (totalSalesMix > 0) {
        for (const p of activeProducts) {
            const prixVente = parseLocaleNumber(p.prixVente);
            const profitMargin = prixVente > 0 ? p.costs.margeBruteDollar / prixVente : 0;
            const weight = parseLocaleNumber(p.salesMix) / totalSalesMix;

            weightedGrossMargin += (profitMargin * weight);
            weightedMaterialCost += (p.costs.costMatierePercent * weight);
            weightedLaborCost += (p.costs.costLaborPercent * weight);
        }

        const menuRevPerc = (parseLocaleNumber(generalInfo.menuRevenuePercentage) || 100) / 100;
        const indirectsMenu = parseLocaleNumber(generalInfo.totalIndirects) * menuRevPerc;
        globalBreakEven = weightedGrossMargin > 0 ? indirectsMenu / weightedGrossMargin : 0;
    }

    // 5. Calcul du Rapport d'Achats
    let totalNetCost = 0;
    let totalLossCost = 0;
    const groupedByProvider = {};

    for (const ing of baseIngredients) {
        let totalQty = 0;
        for (const product of activeProducts) {
            const prixVente = parseLocaleNumber(product.prixVente);
            if (prixVente <= 0) continue;
            const portionsSold = (menuRevenue * (parseLocaleNumber(product.salesMix) / 100)) / prixVente;
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

    // 6. Analyse ABC
    const allItems = [];
    for (const ing of baseIngredients) {
        let consumptionValue = 0;
        for (const product of activeProducts) {
            const prixVente = parseLocaleNumber(product.prixVente);
            if (prixVente <= 0) continue;
            const batchesNeeded = (menuRevenue * (parseLocaleNumber(product.salesMix) / 100)) / prixVente / (parseLocaleNumber(product.nbPortions) || 1);
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

    // 7. Matrice BCG
    const menuEngineeringData = { stars: [], cows: [], questions: [], dogs: [] };
    if (activeProducts.length > 0) {
        const avgSalesMix = 100 / activeProducts.length;
        const totalGrossMarginDollar = activeProducts.reduce((sum, p) => sum + p.costs.margeBruteDollar, 0);
        const avgGrossMargin = totalGrossMarginDollar / activeProducts.length;
        for (const p of activeProducts) {
            const highPop = parseLocaleNumber(p.salesMix) >= avgSalesMix;
            const highProf = p.costs.margeBruteDollar >= avgGrossMargin;
            if (highPop && highProf) menuEngineeringData.stars.push(p);
            else if (highPop && !highProf) menuEngineeringData.cows.push(p);
            else if (!highPop && highProf) menuEngineeringData.questions.push(p);
            else menuEngineeringData.dogs.push(p);
        }
    }

    // 8. Données de contribution
    const contributionData = activeProducts.map(p => {
        const portionsSold = (menuRevenue * (parseLocaleNumber(p.salesMix) / 100)) / (parseLocaleNumber(p.prixVente) || 1);
        return { name: p.platName, totalContribution: portionsSold * p.costs.margeBruteDollar };
    }).sort((a, b) => b.totalContribution - a.totalContribution);

    return {
        productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin, globalBreakEven,
        weightedMaterialCost, weightedLaborCost, menuEngineeringData, purchasingReportData,
        abcAnalysisData, contributionData, productivityReport: calculatedGeneralInfo.productivityReport
    };
}
