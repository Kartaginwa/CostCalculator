import { parseLocaleNumber, CONVERSION_FACTORS } from '../utils.js';

export const calculateCosts = (product, generalInfo, baseIngredients, allProducts, laborDatabase, overridePrice = null, memo = {}, visitedIds = new Set()) => {
    // Le cache n'est valide que pour les appels sans prix simulé : overridePrice change le
    // résultat (marges) mais pas la clé product.id. Les appels avec override sont donc calculés
    // à neuf et non mis en cache, pour ne jamais renvoyer un résultat au prix réel à la place
    // d'un prix simulé (ni l'inverse). Les sous-recettes, elles, sont toujours appelées sans
    // override et restent pleinement cacheables via le memo partagé.
    if (overridePrice === null && memo[product.id]) {
        return memo[product.id];
    }

    if (visitedIds.has(product.id)) {
        console.error(`Boucle circulaire détectée pour le produit: ${product.platName}`);
        // On retourne un objet de coûts vides pour éviter le crash
        return {
            totalIngredientsCost: 0, totalLaborCost: 0, totalDirectLaborCost: 0, indirectCostTotal: 0, totalRecipeCost: 0,
            costMatierePerPortion: 0, costLaborPerPortion: 0, costIndirectPerPortion: 0, totalDirectCostPerPortion: 0,
            totalCostPerPortion: 0, margeBruteDollar: 0, margeBrutePercent: 0, margeNetteDollar: 0, margeNettePercent: 0,
            costMatierePercent: 0, costLaborPercent: 0, costIndirectPercent: 0, totalBaseIngredientsCost: 0, totalLossCost: 0
        };
    }

    // On crée une copie de la pile actuelle et on y ajoute le produit courant
    const currentPath = new Set(visitedIds);
    currentPath.add(product.id);

    // Note: This function now expects generalInfo to have pre-parsed numbers
    const { kitchenProductivity } = generalInfo;
    const prixVente = overridePrice !== null ? parseLocaleNumber(overridePrice) : parseLocaleNumber(product.prixVente);
    const nbPortions = parseInt(product.nbPortions, 10) || 1;
    const productivityFactor = (kitchenProductivity > 0 && kitchenProductivity <= 100) ? kitchenProductivity / 100 : 1;
        let totalIngredientsCost = 0;
        let totalBaseIngredientsCost = 0;
        let totalLossCost = 0;
        let totalDirectLaborCost = 0;
        let totalProductionMinutes = 0;

        if (product.isResaleProduct) {
            const purchaseCost = parseLocaleNumber(product.purchaseCost);
            totalIngredientsCost = purchaseCost;
            totalBaseIngredientsCost = purchaseCost;
        } else {
            // Coûts d'ingrédients
            const ingredientsCosts = product.ingredients.reduce((acc, item) => {
                let unitPrice = 0;
                let lossPercentage = 0;
                let ingredientUnit = 'unité';

                // Tente de trouver l'ingrédient dans la liste de base
                const baseIngredient = baseIngredients.find(ing => ing.id === item.id);

                if (baseIngredient) { // C'est un ingrédient de base
                    unitPrice = parseLocaleNumber(baseIngredient.unitPrice);
                    lossPercentage = parseLocaleNumber(baseIngredient.lossPercentage) / 100;
                    ingredientUnit = baseIngredient.unit;
                } else { // Sinon, c'est peut-être une sous-recette
                    const subRecipeProduct = allProducts.find(p => p.id === item.id);
                    if (subRecipeProduct && subRecipeProduct.isIngredient) {
                        // Appel récursif pour obtenir les coûts de la sous-recette
                        const subRecipeCosts = calculateCosts(subRecipeProduct, generalInfo, baseIngredients, allProducts, laborDatabase, null, memo, currentPath);
                        const sanitizedPortionSize = parseLocaleNumber(subRecipeProduct.portionSize) || 1;
                        // Une sous-recette utilisée COMME INGRÉDIENT n'apporte que son coût DIRECT
                        // (matière + main-d'œuvre) au plat parent ; ses frais indirects sont exclus
                        // ici pour éviter le double comptage (le plat final absorbe l'overhead). Si
                        // la sous-recette est aussi vendue seule, elle absorbe bien ses propres frais
                        // indirects lorsqu'elle est calculée en tant que plat (affichage propre).
                        unitPrice = subRecipeCosts.totalDirectCostPerPortion / sanitizedPortionSize;
                        ingredientUnit = subRecipeProduct.portionUnit;
                        // Note: La perte et le rendement sont gérés à l'intérieur de la sous-recette, donc lossPercentage est 0 ici.
                    }
                }

                const recipeUnit = item.recipeUnit || ingredientUnit;
                const conversionFactorFromRecipeToBase = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[ingredientUnit]?.factor || 1);
                const quantityInBaseUnit = parseLocaleNumber(item.quantity) * conversionFactorFromRecipeToBase;
                const baseCost = quantityInBaseUnit * unitPrice;

                const costAfterLoss = lossPercentage > 0 && lossPercentage < 1
                    ? baseCost / (1 - lossPercentage)
                    : baseCost;

                const lossCost = costAfterLoss - baseCost;

                const yieldPercent = parseLocaleNumber(item.yieldPercentage);
                const finalCost = (yieldPercent && yieldPercent > 0)
                    ? costAfterLoss / (yieldPercent / 100)
                    : costAfterLoss;

                acc.totalBaseCost += baseCost;
                acc.totalLossCost += lossCost;
                acc.totalFinalCost += finalCost;

                return acc;
            }, { totalBaseCost: 0, totalLossCost: 0, totalFinalCost: 0 });

                totalIngredientsCost = ingredientsCosts.totalFinalCost;
                totalBaseIngredientsCost = ingredientsCosts.totalBaseCost;
                totalLossCost = ingredientsCosts.totalLossCost;

            // Coûts de main-d'œuvre basés sur les étapes de production
            totalDirectLaborCost = 0;
            totalProductionMinutes = 0;

            (product.productionSteps || []).forEach(step => {
                const durationSeconds = parseLocaleNumber(step.duration);

                (step.personnel || []).forEach(person => {
                    const postData = laborDatabase.find(p => p.postName === person.postId);
                    if (postData && postData.employees.length > 0) {
                        const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                        const totalCost = postData.employees.reduce((sum, emp) => {
                            const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                            return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                        }, 0);
                        const weightedAverageCost = totalHours > 0 ? totalCost / totalHours : 0;

                        totalDirectLaborCost += (durationSeconds / 3600) * weightedAverageCost;
                    }
                });

                const endTime = parseLocaleNumber(step.startTime) + durationSeconds;
                if (endTime > totalProductionMinutes) {
                    totalProductionMinutes = endTime;
                }
            });
        }


    const totalLaborCost = totalDirectLaborCost / productivityFactor;

    // Frais indirects — méthode GLOBALE (generalInfo.indirectCostMethod), appliquée à tous les
    // plats. Deux méthodes, toutes deux normalisées pour répartir EXACTEMENT la part menu du pool
    // de frais indirects (elles se réconcilient par construction). Chaque plat (y compris une
    // sous-recette vendue seule) absorbe ses propres frais indirects ; l'exclusion pour éviter le
    // double comptage se fait uniquement à l'usage (coût direct de la sous-recette côté parent).
    let indirectCostTotal = 0;
    const method = generalInfo.indirectCostMethod || 'salesAllocation';
    const totalIndirectsParsed = parseLocaleNumber(generalInfo.totalIndirects);
    const menuRevenuePercentage = (parseLocaleNumber(generalInfo.menuRevenuePercentage) || 100) / 100;

    if (method === 'laborTime') {
        // Au prorata du temps de production. Taux = part menu du pool / total des heures de MO
        // nécessaires au menu (fourni par generalInfo.totalDirectLaborHoursNeeded). Chaque plat
        // absorbe ∝ ses propres heures de MO ; sommé sur le volume produit, le total égale
        // exactement la part menu du pool → se réconcilie.
        const totalDirectLaborHoursNeeded = parseLocaleNumber(generalInfo.totalDirectLaborHoursNeeded);
        let productLaborTimeSeconds = 0;
        (product.productionSteps || []).forEach(step => {
            const durationSeconds = parseLocaleNumber(step.duration);
            const personnelCount = step.personnel?.length || 0;
            productLaborTimeSeconds += durationSeconds * personnelCount;
        });
        if (totalDirectLaborHoursNeeded > 0 && totalIndirectsParsed > 0) {
            const rate = (totalIndirectsParsed * menuRevenuePercentage) / totalDirectLaborHoursNeeded;
            indirectCostTotal = (productLaborTimeSeconds / 3600) * rate;
        }
    } else {
        // salesAllocation (défaut) : au prorata du mix des ventes, normalisé sur la somme des mix
        // actifs → répartit exactement la part menu du pool, même si les mix ne totalisent pas
        // 100 %. Dénominateur "portions vendues" : saisi si disponible, sinon estimé à partir des
        // volumes (unités reconstruites : revenu du menu / prix moyen pondéré par le mix × part).
        const salesMixPercent = parseLocaleNumber(product.salesMix) / 100;
        const portionsSoldRaw = parseLocaleNumber(product.indirectCosts?.portionsSold);
        const totalRevenueParsed = parseLocaleNumber(generalInfo.totalRevenue);
        const activeForVolume = (allProducts || []).filter(p => p.onMenu);
        const sumActiveMix = activeForVolume.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);
        const weightedAvgPrice = sumActiveMix > 0
            ? activeForVolume.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix) * parseLocaleNumber(p.prixVente), 0) / sumActiveMix
            : 0;
        let portionsSold;
        if (portionsSoldRaw > 0) {
            portionsSold = portionsSoldRaw;
        } else if (totalRevenueParsed > 0 && weightedAvgPrice > 0 && sumActiveMix > 0) {
            const totalUnits = (totalRevenueParsed * menuRevenuePercentage) / weightedAvgPrice;
            portionsSold = totalUnits * (parseLocaleNumber(product.salesMix) / sumActiveMix);
            if (!(portionsSold > 0)) portionsSold = 1;
        } else {
            portionsSold = 1;
        }
        const totalActiveSalesMix = sumActiveMix / 100;
        if (totalIndirectsParsed > 0 && totalActiveSalesMix > 0 && salesMixPercent > 0) {
            const normalizedSharePercent = salesMixPercent / totalActiveSalesMix;
            const allocatedIndirects = totalIndirectsParsed * normalizedSharePercent * menuRevenuePercentage;
            indirectCostTotal = (allocatedIndirects / portionsSold) * nbPortions;
        }
    }

    const totalRecipeCost = totalIngredientsCost + totalLaborCost + indirectCostTotal;

    // Soupape de sécurité (méthode "ventes") : sur données dégénérées (portions vendues = 1 par
    // défaut), le total d'un plat ne peut dépasser le pool de frais indirects.
    if (method !== 'laborTime') {
        const maxIndirects = parseLocaleNumber(generalInfo.totalIndirects);
        if (maxIndirects > 0 && indirectCostTotal > maxIndirects) {
            indirectCostTotal = maxIndirects;
        }
    }

    // Coûts par portion
    let costMatierePerPortion = 0;
    let costLaborPerPortion = 0;

    if (product.isResaleProduct) {
        costMatierePerPortion = nbPortions > 0 ? totalIngredientsCost / nbPortions : 0;
        costLaborPerPortion = 0; // Un produit de revente n'a pas de coût de main-d'oeuvre direct
    } else {
        costMatierePerPortion = nbPortions > 0 ? totalIngredientsCost / nbPortions : 0;
        costLaborPerPortion = nbPortions > 0 ? totalLaborCost / nbPortions : 0;
    }

    const costIndirectPerPortion = nbPortions > 0 ? indirectCostTotal / nbPortions : 0;

    const totalDirectCostPerPortion = costMatierePerPortion + costLaborPerPortion;
    const totalCostPerPortion = totalDirectCostPerPortion + costIndirectPerPortion;

    // Marges
    // margeBrute = prix − (coût matière + main-d'œuvre directe). La main-d'œuvre est traitée comme
    // un coût semi-variable (on ne produit pas si le stock suffit) et est donc, par choix
    // méthodologique de conseil, incluse dans cette marge — qui sert d'axe de rentabilité à la
    // matrice de menu, de base au classement par contribution et de marge variable au point mort.
    const margeBruteDollar = prixVente - totalDirectCostPerPortion;
    const margeBrutePercent = prixVente > 0 ? margeBruteDollar / prixVente : 0;
    const margeNetteDollar = prixVente - totalCostPerPortion;
    const margeNettePercent = prixVente > 0 ? margeNetteDollar / prixVente : 0;

    // Nouveaux pourcentages
    const costMatierePercent = prixVente > 0 ? costMatierePerPortion / prixVente : 0;
    const costLaborPercent = prixVente > 0 ? costLaborPerPortion / prixVente : 0;
    const costIndirectPercent = prixVente > 0 ? costIndirectPerPortion / prixVente : 0;

    const portionSize = parseLocaleNumber(product.portionSize) || 1;
    const costPerUnit = portionSize > 0 ? totalCostPerPortion / portionSize : 0;

    const result = {
        totalIngredientsCost,
        totalLaborCost,
        totalDirectLaborCost,
        indirectCostTotal,
        totalRecipeCost,
        costMatierePerPortion,
        costLaborPerPortion,
        costIndirectPerPortion,
        totalDirectCostPerPortion,
        totalCostPerPortion,
        margeBruteDollar,
        margeBrutePercent,
        margeNetteDollar,
        margeNettePercent,
        costPerUnit,
        costMatierePercent,
        costLaborPercent,
        costIndirectPercent,
        totalBaseIngredientsCost,
        totalLossCost
    };

    if (overridePrice === null) {
        memo[product.id] = result;
    }
    return result;

};
