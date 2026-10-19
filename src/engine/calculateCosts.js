import { parseLocaleNumber, CONVERSION_FACTORS } from '../utils.js';
import { computeYieldUnits } from './yieldCalculator.js';

// `format` est un paramètre optionnel de fin de liste (Phase 1.4) : quand un appelant en passe un
// explicitement (ex. l'un des `formats[]` d'une recette mère), les champs de vente (prix,
// portions, mix, indirects) sont lus dessus plutôt que sur `product`. Repli automatique sur
// `product.formats?.[0]`, puis sur `product` lui-même si aucun format n'existe (compatibilité
// avec le code/les tests antérieurs à la Phase 1.3, où ces champs vivaient directement sur le
// produit) — le comportement pour un produit à un seul format reste donc identique en tout point.
// `basePackaging` (Phase 2.2) est ajouté en TOUT dernier paramètre, jamais inséré avant `format` :
// plusieurs appelants passent déjà `format` positionnellement (9e argument) ; l'insérer plus tôt
// aurait silencieusement décalé ces appels existants. Défaut `[]`, sûr pour tout appel antérieur
// à cette phase (aucun format n'a encore de `packagingItems` tant que rien n'y est rattaché).
export const calculateCosts = (product, generalInfo, baseIngredients, allProducts, laborDatabase, overridePrice = null, memo = {}, visitedIds = new Set(), format = null, basePackaging = []) => {
    const fmt = format || product.formats?.[0] || product;

    // Le cache est keyé par format (et non par produit) : deux formats d'une même recette mère ont
    // des coûts par unité différents (prix, portions, emballage...) et ne doivent jamais partager
    // une entrée de cache. Pour un produit à un seul format (ou sans format, repli ci-dessus),
    // fmt.id vaut alors l'id du produit — comportement inchangé.
    // Le cache n'est valide que pour les appels sans prix simulé : overridePrice change le
    // résultat (marges) mais pas la clé de cache. Les appels avec override sont donc calculés à
    // neuf et non mis en cache, pour ne jamais renvoyer un résultat au prix réel à la place d'un
    // prix simulé (ni l'inverse). Les sous-recettes, elles, sont toujours appelées sans override
    // et restent pleinement cacheables via le memo partagé.
    if (overridePrice === null && memo[fmt.id]) {
        return memo[fmt.id];
    }

    if (visitedIds.has(product.id)) {
        console.error(`Boucle circulaire détectée pour le produit: ${product.platName}`);
        // On retourne un objet de coûts vides pour éviter le crash
        return {
            totalIngredientsCost: 0, totalPackagingCost: 0, totalLaborCost: 0, totalDirectLaborCost: 0, totalSubcontractingCost: 0,
            totalAgingCost: 0, indirectCostTotal: 0, totalRecipeCost: 0,
            costMatierePerPortion: 0, costPackagingPerPortion: 0, costLaborPerPortion: 0, costSubcontractingPerPortion: 0, costAgingPerPortion: 0,
            costIndirectPerPortion: 0, totalDirectCostPerPortion: 0,
            totalCostPerPortion: 0, margeBruteDollar: 0, margeBrutePercent: 0, margeNetteDollar: 0, margeNettePercent: 0,
            costMatierePercent: 0, costPackagingPercent: 0, costLaborPercent: 0, costIndirectPercent: 0, totalBaseIngredientsCost: 0, totalLossCost: 0,
            totalBasePackagingCost: 0, totalPackagingLossCost: 0
        };
    }

    // On crée une copie de la pile actuelle et on y ajoute le produit courant
    const currentPath = new Set(visitedIds);
    currentPath.add(product.id);

    // Note: This function now expects generalInfo to have pre-parsed numbers
    const { kitchenProductivity } = generalInfo;
    const prixVente = overridePrice !== null ? parseLocaleNumber(overridePrice) : parseLocaleNumber(fmt.prixVente);

    // Quantité produite : saisie manuellement (comportement historique), ou calculée par la
    // grille de rendement du format quand elle est activée (Phase 1.4 — voir yieldCalculator.js).
    // Pas de parseInt ici : une unité continue (kg, L...) peut légitimement être fractionnaire
    // (ex. 47,3 kg) — seule une unité discrète (« unité ») est contrainte à un entier, et
    // seulement côté validation UI (RecipeCalculator.jsx), pas ici (voir isDiscreteUnit, utils.js).
    let nbPortions = parseLocaleNumber(fmt.nbPortions) || 1;
    if (fmt.yieldGrid?.enabled) {
        const computedUnits = computeYieldUnits({
            baseQuantity: fmt.yieldGrid.baseQuantity,
            stages: fmt.yieldGrid.stages,
            rejectRate: fmt.yieldGrid.rejectRate,
            unitSize: fmt.portionSize,
        });
        if (computedUnits > 0) nbPortions = computedUnits;
    }

    const productivityFactor = (kitchenProductivity > 0 && kitchenProductivity <= 100) ? kitchenProductivity / 100 : 1;
        let totalIngredientsCost = 0;
        let totalBaseIngredientsCost = 0;
        let totalLossCost = 0;
        let totalDirectLaborCost = 0;
        let totalProductionMinutes = 0;

        if (fmt.isResaleProduct) {
            const purchaseCost = parseLocaleNumber(fmt.purchaseCost);
            totalIngredientsCost = purchaseCost;
            totalBaseIngredientsCost = purchaseCost;
        } else {
            // Coûts d'ingrédients — chaque format est sa propre fiche recette autonome depuis la
            // correction du 23/09 (voir 04-Conception-Modele.md) : plus de lot partagé entre
            // formats d'un même produit à répartir, donc pas d'allocation à faire ici.
            const ingredientsCosts = (fmt.ingredients || []).reduce((acc, item) => {
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
                    // `item.id` référence soit un FORMAT précis (sélectionné via le sélecteur
                    // d'ingrédient depuis la Phase 1.6, qui liste maintenant un format de
                    // sous-recette à la fois — voir App.jsx `ingredientsList`), soit, pour une
                    // référence antérieure à ce correctif, directement l'id du PRODUIT — auquel cas
                    // on retombe sur son premier format, comportement historique inchangé.
                    let subRecipeProduct = null;
                    let subFmt = null;
                    for (const p of allProducts) {
                        if (!p.isIngredient) continue;
                        const match = (p.formats || []).find(f => f.id === item.id);
                        if (match) { subRecipeProduct = p; subFmt = match; break; }
                    }
                    if (!subRecipeProduct) {
                        const byProductId = allProducts.find(p => p.id === item.id);
                        if (byProductId && byProductId.isIngredient) {
                            subRecipeProduct = byProductId;
                            subFmt = byProductId.formats?.[0] || byProductId;
                        }
                    }
                    if (subRecipeProduct && subFmt) {
                        // Appel récursif pour obtenir les coûts du format précis de la sous-recette.
                        const subRecipeCosts = calculateCosts(subRecipeProduct, generalInfo, baseIngredients, allProducts, laborDatabase, null, memo, currentPath, subFmt);
                        const sanitizedPortionSize = parseLocaleNumber(subFmt.portionSize) || 1;
                        // Une sous-recette utilisée COMME INGRÉDIENT n'apporte que son coût DIRECT
                        // (matière + main-d'œuvre) au plat parent ; ses frais indirects sont exclus
                        // ici pour éviter le double comptage (le plat final absorbe l'overhead). Si
                        // la sous-recette est aussi vendue seule, elle absorbe bien ses propres frais
                        // indirects lorsqu'elle est calculée en tant que plat (affichage propre).
                        unitPrice = subRecipeCosts.totalDirectCostPerPortion / sanitizedPortionSize;
                        ingredientUnit = subFmt.portionUnit;
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

            (fmt.productionSteps || []).forEach(step => {
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

    // Coûts d'emballage (Phase 2.2) — poste SÉPARÉ, jamais fusionné au coût matière (voir
    // 04-Conception-Modele.md). Même logique de conversion d'unité et de perte que les
    // ingrédients, mais sans notion de rendement : un emballage ne « rétrécit » pas pendant la
    // production (pas d'équivalent de l'épluchage/la cuisson). Absent pour un produit de revente,
    // comme les ingrédients et la main-d'œuvre (pas de recette du tout dans ce cas).
    let totalPackagingCost = 0;
    let totalBasePackagingCost = 0;
    let totalPackagingLossCost = 0;
    if (!fmt.isResaleProduct) {
        const packagingCosts = (fmt.packagingItems || []).reduce((acc, item) => {
            const basePkg = basePackaging.find(pkg => pkg.id === item.id);
            if (!basePkg) return acc;
            const unitPrice = parseLocaleNumber(basePkg.unitPrice);
            const lossPercentage = (parseLocaleNumber(basePkg.lossPercentage) || 0) / 100;
            const recipeUnit = item.recipeUnit || basePkg.unit;
            const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[basePkg.unit]?.factor || 1);
            const quantityInBaseUnit = parseLocaleNumber(item.quantity) * conversionFactor;
            const baseCost = quantityInBaseUnit * unitPrice;
            const costAfterLoss = lossPercentage > 0 && lossPercentage < 1 ? baseCost / (1 - lossPercentage) : baseCost;
            const lossCost = costAfterLoss - baseCost;

            acc.totalBaseCost += baseCost;
            acc.totalLossCost += lossCost;
            acc.totalFinalCost += costAfterLoss;
            return acc;
        }, { totalBaseCost: 0, totalLossCost: 0, totalFinalCost: 0 });

        totalPackagingCost = packagingCosts.totalFinalCost;
        totalBasePackagingCost = packagingCosts.totalBaseCost;
        totalPackagingLossCost = packagingCosts.totalLossCost;
    }


    const totalLaborCost = totalDirectLaborCost / productivityFactor;

    // Sous-traitance (Phase 1.4) : coût d'opérations données à l'externe, propre au format (ex. un
    // format spécifique confié à un tiers pour l'embouteillage). Masqué par défaut (`enabled`
    // absent ou faux) — contribue alors 0 $, sans aucun changement de comportement.
    let totalSubcontractingCost = 0;
    if (fmt.subcontracting?.enabled) {
        totalSubcontractingCost = (fmt.subcontracting.items || []).reduce((sum, item) => sum + parseLocaleNumber(item.cost), 0);
    }

    // Frais indirects — méthode GLOBALE (generalInfo.indirectCostMethod), appliquée à tous les
    // plats. Deux méthodes, toutes deux normalisées pour répartir EXACTEMENT la part menu du pool
    // de frais indirects (elles se réconcilient par construction). Chaque plat (y compris une
    // sous-recette vendue seule) absorbe ses propres frais indirects ; l'exclusion pour éviter le
    // double comptage se fait uniquement à l'usage (coût direct de la sous-recette côté parent).
    let indirectCostTotal = 0;
    const method = generalInfo.indirectCostMethod || 'salesAllocation';
    const totalIndirectsParsed = parseLocaleNumber(generalInfo.totalIndirects);

    // Temps de production total du format (Phase 4.6) : calculé UNE FOIS, exposé dans le résultat
    // (`productionTimeSeconds`) — réutilisé ci-dessous par la méthode « temps de MO » ET, en dehors
    // de cette fonction, comme driver possible pour les pools Activité/Canal (analysisData.js).
    // Déplacé hors du `if (method === 'laborTime')` : avant, ce calcul n'existait que pour CETTE
    // méthode précise ; il est maintenant toujours disponible, peu importe la méthode choisie pour
    // Général.
    let productionTimeSeconds = 0;
    (fmt.productionSteps || []).forEach(step => {
        const durationSeconds = parseLocaleNumber(step.duration);
        const personnelCount = step.personnel?.length || 0;
        productionTimeSeconds += durationSeconds * personnelCount;
    });

    // Volume réel (corrigé le 18/10, confirmé le 19/10 — voir Projet_Claude/03-Feuille-de-route.md,
    // addendum du 19/10) : jamais de reconstruction à partir du revenu déclaré de l'État des
    // résultats (`generalInfo.totalRevenue`, réel) — ce serait mélanger les deux jeux de données
    // que la Réconciliation réel/théorique doit justement garder indépendants pour rester
    // significative. Repli uniquement sur le volume RÉEL déjà saisi par canal
    // (`fmt.channelPrices[].volume`, Phase 3.2), la même donnée que `channelBreakdown`/
    // `blendAcrossChannels` utilisent déjà ailleurs dans le moteur. Sans AUCUNE donnée réelle (ni
    // saisie manuelle, ni volume par canal), `portionsSold` reste `null` — PAS un repli à 1, qui
    // produirait un coût par portion délirant (le pool entier divisé par une seule unité). Le coût
    // indirect « ventes » de ce format reste alors absent (0 $, jamais une estimation fabriquée)
    // tant qu'aucun volume réel n'existe pour lui.
    const salesMixPercent = parseLocaleNumber(fmt.salesMix) / 100;
    const portionsSoldRaw = parseLocaleNumber(fmt.indirectCosts?.portionsSold);
    const realVolumeFromChannels = (fmt.channelPrices || []).reduce((sum, cp) => sum + (parseLocaleNumber(cp.volume) || 0), 0);
    const activeForVolume = (allProducts || []).filter(p => p.onMenu);
    const sumActiveMix = activeForVolume.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);
    let portionsSold = null;
    if (portionsSoldRaw > 0) {
        portionsSold = portionsSoldRaw;
    } else if (realVolumeFromChannels > 0) {
        portionsSold = realVolumeFromChannels;
    }

    if (method === 'laborTime') {
        // Au prorata du temps de production. Taux = pool / total des heures de MO nécessaires au
        // menu (fourni par generalInfo.totalDirectLaborHoursNeeded). Chaque plat absorbe ∝ ses
        // propres heures de MO ; sommé sur le volume produit, le total égale exactement le pool →
        // se réconcilie. Plus de multiplicateur "part menu" (menuRevenuePercentage, retiré le
        // 18/10) : `totalIndirectsParsed` est déjà le bassin Général correctement scopé par la
        // répartition Activité/Canal des Frais fixes (Phase 4.6) — le multiplier encore par un %
        // arbitraire aurait réduit le pool une seconde fois.
        const totalDirectLaborHoursNeeded = parseLocaleNumber(generalInfo.totalDirectLaborHoursNeeded);
        if (totalDirectLaborHoursNeeded > 0 && totalIndirectsParsed > 0) {
            const rate = totalIndirectsParsed / totalDirectLaborHoursNeeded;
            indirectCostTotal = (productionTimeSeconds / 3600) * rate;
        }
    } else {
        // salesAllocation (défaut) : au prorata du mix des ventes, normalisé sur la somme des mix
        // actifs → répartit exactement le pool, même si les mix ne totalisent pas 100 %.
        // Dénominateur "portions vendues" : saisi si disponible, sinon le volume réel par canal
        // (voir ci-dessus).
        //
        // Population agrégée (allProducts) lue depuis les champs "à plat" du produit, pas depuis
        // formats[] : tant que chaque produit n'a qu'un seul format (Phases 1.4-1.5), ces champs
        // sont des miroirs exacts l'un de l'autre (voir Phase 1.3), donc strictement équivalent.
        // À revisiter en Phase 1.6, quand plusieurs formats par produit deviendront réels.
        const totalActiveSalesMix = sumActiveMix / 100;
        if (totalIndirectsParsed > 0 && totalActiveSalesMix > 0 && salesMixPercent > 0 && portionsSold > 0) {
            const normalizedSharePercent = salesMixPercent / totalActiveSalesMix;
            const allocatedIndirects = totalIndirectsParsed * normalizedSharePercent;
            indirectCostTotal = (allocatedIndirects / portionsSold) * nbPortions;
        }
    }

    const totalRecipeCost = totalIngredientsCost + totalPackagingCost + totalLaborCost + totalSubcontractingCost + indirectCostTotal;

    // Soupape de sécurité (méthode "ventes") : sur données dégénérées (ex. un volume réel très
    // faible pour ce format), le total d'un plat ne peut dépasser le pool de frais indirects.
    if (method !== 'laborTime') {
        const maxIndirects = parseLocaleNumber(generalInfo.totalIndirects);
        if (maxIndirects > 0 && indirectCostTotal > maxIndirects) {
            indirectCostTotal = maxIndirects;
        }
    }

    // Coûts par portion
    let costMatierePerPortion = 0;
    let costLaborPerPortion = 0;

    if (fmt.isResaleProduct) {
        costMatierePerPortion = nbPortions > 0 ? totalIngredientsCost / nbPortions : 0;
        costLaborPerPortion = 0; // Un produit de revente n'a pas de coût de main-d'oeuvre direct
    } else {
        costMatierePerPortion = nbPortions > 0 ? totalIngredientsCost / nbPortions : 0;
        costLaborPerPortion = nbPortions > 0 ? totalLaborCost / nbPortions : 0;
    }

    const costPackagingPerPortion = nbPortions > 0 ? totalPackagingCost / nbPortions : 0;
    const costSubcontractingPerPortion = nbPortions > 0 ? totalSubcontractingCost / nbPortions : 0;
    const costIndirectPerPortion = nbPortions > 0 ? indirectCostTotal / nbPortions : 0;

    const totalDirectCostPerPortion = costMatierePerPortion + costPackagingPerPortion + costLaborPerPortion + costSubcontractingPerPortion;

    // Vieillissement (Phase 1.4) : charges d'intérêt de portage pour un format qui doit
    // affiner/vieillir en inventaire avant la vente (ex. fermentation), calculées sur le total des
    // charges directes du lot — comme le MAPAQ, traitées à part des charges indirectes plutôt que
    // fondues dans le coût matière/MO. Masqué par défaut : contribue alors 0 $.
    let totalAgingCost = 0;
    if (fmt.aging?.enabled) {
        const rate = parseLocaleNumber(fmt.aging.interestRate) / 100;
        const months = parseLocaleNumber(fmt.aging.months);
        totalAgingCost = (totalIngredientsCost + totalPackagingCost + totalLaborCost + totalSubcontractingCost) * (rate / 12) * months;
    }
    const costAgingPerPortion = nbPortions > 0 ? totalAgingCost / nbPortions : 0;

    const totalCostPerPortion = totalDirectCostPerPortion + costIndirectPerPortion + costAgingPerPortion;

    const portionSize = parseLocaleNumber(fmt.portionSize) || 1;
    // Marges : extrait dans computeMarginsForPrice (fonction pure, exportée) parce que c'est la
    // SEULE partie du calcul qui dépend du prix de vente — tout ce qui précède (coûts) ne varie
    // pas par canal de vente. Phase 3.3 : computeChannelBreakdown (plus bas) réutilise cette même
    // fonction pour chaque canal du format, sans recalculer les coûts.
    const margins = computeMarginsForPrice(prixVente, {
        totalDirectCostPerPortion, totalCostPerPortion, costMatierePerPortion,
        costPackagingPerPortion, costLaborPerPortion, costIndirectPerPortion, portionSize,
    });

    const result = {
        totalIngredientsCost,
        totalPackagingCost,
        totalLaborCost,
        totalDirectLaborCost,
        totalSubcontractingCost,
        totalAgingCost,
        indirectCostTotal,
        totalRecipeCost,
        costMatierePerPortion,
        costPackagingPerPortion,
        costLaborPerPortion,
        costSubcontractingPerPortion,
        costAgingPerPortion,
        costIndirectPerPortion,
        // Phase 4.6 — ce calcul ne produit encore QUE la part Général du pool de frais fixes (voir
        // plus haut) : exposée explicitement sous ce nom pour qu'analysisData.js puisse y ajouter
        // les parts Activité/Canal sans ambiguïté sur ce que `costIndirectPerPortion` représente à
        // CE stade (avant enrichissement). `costIndirectPerPortion` reste la somme des trois après
        // enrichissement — jamais recalculé ici, cette fonction ne connaît que Général.
        costIndirectGeneralPerPortion: costIndirectPerPortion,
        totalDirectCostPerPortion,
        totalCostPerPortion,
        // Exposé pour computeChannelBreakdown (Phase 3.3), appelé en dehors de calculateCosts avec
        // ces coûts déjà calculés — sans ce champ, computeMarginsForPrice ne pourrait pas recalculer
        // costPerUnit pour un autre prix (canal) que celui-ci.
        portionSize,
        // Phase 4.6 — exposés pour servir de drivers aux pools Activité/Canal (analysisData.js),
        // calculés une seule fois ci-dessus, peu importe la méthode choisie pour Général :
        // `nbPortions` (portions par lot), `portionsSold` (volume reconstruit, menu entier) et
        // `productionTimeSeconds` (temps de production d'un lot).
        nbPortions,
        portionsSold,
        productionTimeSeconds,
        ...margins,
        totalBaseIngredientsCost,
        totalLossCost,
        totalBasePackagingCost,
        totalPackagingLossCost
    };

    if (overridePrice === null) {
        memo[fmt.id] = result;
    }
    return result;

};

// Marges pour un prix de vente donné, à partir des coûts déjà calculés (coûts = fixes, ne varient
// pas par canal de vente ; seul le prix varie). Extrait de calculateCosts ci-dessus pour être
// réutilisé par computeChannelBreakdown (Phase 3.3) sans dupliquer le calcul des coûts.
// margeBrute = prix − (coût matière + main-d'œuvre directe + sous-traitance). La main-d'œuvre est
// traitée comme un coût semi-variable et donc incluse dans cette marge — qui sert d'axe de
// rentabilité à la matrice de menu, de base au classement par contribution et de marge variable au
// point mort. margeContribution (coût matière seul) et margeNette (tous les coûts) sont fournies à
// titre d'affichage (les trois niveaux : contribution → coût primaire → nette).
export const computeMarginsForPrice = (prixVente, costs) => {
    const {
        totalDirectCostPerPortion, totalCostPerPortion, costMatierePerPortion,
        costPackagingPerPortion, costLaborPerPortion, costIndirectPerPortion, portionSize,
    } = costs;

    const margeBruteDollar = prixVente - totalDirectCostPerPortion;
    const margeBrutePercent = prixVente > 0 ? margeBruteDollar / prixVente : 0;
    const margeNetteDollar = prixVente - totalCostPerPortion;
    const margeNettePercent = prixVente > 0 ? margeNetteDollar / prixVente : 0;
    const margeContributionDollar = prixVente - costMatierePerPortion;
    const margeContributionPercent = prixVente > 0 ? margeContributionDollar / prixVente : 0;

    const costMatierePercent = prixVente > 0 ? costMatierePerPortion / prixVente : 0;
    const costPackagingPercent = prixVente > 0 ? costPackagingPerPortion / prixVente : 0;
    const costLaborPercent = prixVente > 0 ? costLaborPerPortion / prixVente : 0;
    const costIndirectPercent = prixVente > 0 ? costIndirectPerPortion / prixVente : 0;

    const size = parseLocaleNumber(portionSize) || 1;
    const costPerUnit = size > 0 ? totalCostPerPortion / size : 0;

    return {
        margeBruteDollar, margeBrutePercent, margeNetteDollar, margeNettePercent,
        margeContributionDollar, margeContributionPercent,
        costMatierePercent, costPackagingPercent, costLaborPercent, costIndirectPercent,
        costPerUnit,
    };
};

// Phase 3.3 : ventilation de la marge d'un format PAR CANAL DE VENTE, à partir des coûts déjà
// calculés (une seule fois, indépendants du canal) et de `format.channelPrices` (Phase 3.2). Un
// canal supprimé depuis, ou sans prix net saisi, est omis du résultat plutôt que forcé à 0 —
// leçon tirée du chiffrier SymbiOse de l'utilisateur (voir 06-Analyse-Chiffrier-SymbiOse.md) :
// une grille produit × canal avec des canaux non utilisés à 0 $ génère des divisions par zéro en
// cascade ; une valeur absente (canal non vendu ici) doit rester absente, jamais un calcul forcé.
// `allocatedIndirects` (optionnel, $ — la part des frais indirects déjà allouée à CE format,
// peu importe le canal) : quand fourni, chaque entrée reçoit aussi `breakEvenUnits`, le point
// mort pour CE canal (mêmes frais indirects alloués, divisés par la marge brute propre à ce
// canal — donc un point mort différent par canal, uniquement parce que le prix diffère). Même
// formule que l'ancien point mort de Recette & Calcul, déplacé le 06/10 vers Résumé → Par SKU.
// `channelPools` (Phase 4.6, optionnel — `{ [channelId]: { amount, driverTotal } }`) : pool de
// frais fixes propre à CE canal (voir engine/analysisData.js, computeIndirectCostDriverTotals).
// Quand fourni, chaque entrée ajoute, EN PLUS de `costs.costIndirectPerPortion` (Général + Activité,
// déjà commun à tous les canaux de ce format), la part SPÉCIFIQUE à ce canal précis — donc une
// marge nette différente par canal, pas seulement à cause du prix.
//
// AUCUN driver au choix ici (contrairement à Activité) — toujours une MAJORATION % sur le coût de
// production déjà établi (`costs.totalDirectCostPerPortion`), jamais sur les ventes ni le temps de
// MO. Vérifié formule par formule dans l'Agro-Calculateur (feuille `Synthèse`, matrice « Coût de
// revient complet ») le 14/10, suite à un retour utilisateur : le CICI ne s'y choisit qu'À
// L'ACTIVITÉ, une seule fois ; le canal applique ensuite ce même mécanisme universel — jamais un
// second choix de driver indépendant, qui créerait un déséquilibre entre la cohérence déjà établie
// au niveau de l'activité et celle du canal. Voir 04-Conception-Modele.md, section Phase 4.6.
// `taux_canal = pool_canal ÷ Σ(coût de production × volume, TOUS les produits de ce canal)` ;
// `part_canal_de_ce_produit = son propre coût de production × taux_canal` — se réconcilie
// exactement par construction (le coût de production du produit s'annule dans la somme). Un canal
// sans volume réel saisi ou sans pool configuré reste simplement sans part de canal (jamais un 0
// inventé) — seuls Général/Activité s'appliquent alors.
export const computeChannelBreakdown = (costs, channelPrices = [], salesChannels = [], allocatedIndirects = null, channelPools = null) => {
    return channelPrices
        .map(cp => {
            const channel = salesChannels.find(c => c.id === cp.channelId);
            const netPrice = parseLocaleNumber(cp.netPrice);
            if (!channel || !(netPrice > 0)) return null;
            const volume = parseLocaleNumber(cp.volume);

            let channelCosts = costs;
            let costIndirectChannelPerPortion = 0;
            const pool = channelPools?.[cp.channelId];
            if (pool && pool.amount > 0 && pool.driverTotal > 0 && volume > 0) {
                const channelMarkupRate = pool.amount / pool.driverTotal;
                costIndirectChannelPerPortion = costs.totalDirectCostPerPortion * channelMarkupRate;
                const newCostIndirectPerPortion = costs.costIndirectPerPortion + costIndirectChannelPerPortion;
                channelCosts = {
                    ...costs,
                    costIndirectPerPortion: newCostIndirectPerPortion,
                    totalCostPerPortion: costs.totalDirectCostPerPortion + newCostIndirectPerPortion + (costs.costAgingPerPortion || 0),
                };
            }

            const margins = computeMarginsForPrice(netPrice, channelCosts);
            const breakEvenUnits = (allocatedIndirects != null && margins.margeBruteDollar > 0)
                ? Math.ceil(allocatedIndirects / margins.margeBruteDollar)
                : null;
            return {
                channelId: channel.id,
                channelName: channel.name,
                netPrice,
                volume,
                ...margins,
                costIndirectChannelPerPortion,
                breakEvenUnits,
            };
        })
        .filter(Boolean);
};
