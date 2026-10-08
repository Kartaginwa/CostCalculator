import { parseLocaleNumber, CONVERSION_FACTORS, buildRowDisplayName } from '../utils.js';
import { calculateCosts, computeChannelBreakdown } from './calculateCosts.js';

// Rapport d'achats (quantités/coûts nets + pertes par fournisseur) ET analyse ABC (Pareto
// 70/20/10 sur la valeur de consommation, SANS la perte — même définition que le rapport
// d'achats, qui l'ajoute séparément comme `totalLossCost`) pour UN catalogue donné. Extrait pour
// ne pas dupliquer cette logique une 3e fois (Phase 2.3, après les ingrédients) : seul le champ de
// recette consulté change (`ingredients` vs `packagingItems`), le reste est rigoureusement
// identique entre les deux catalogues.
function computePurchasingAndAbc(catalogue, activeProducts, unitsSoldById, recipeField) {
    let totalNetCost = 0;
    let totalLossCost = 0;
    const groupedByProvider = {};
    const allItems = [];

    for (const catItem of catalogue) {
        let totalQty = 0;
        for (const product of activeProducts) {
            const portionsSold = unitsSoldById[product.id] || 0;
            if (portionsSold <= 0) continue;
            const batchesNeeded = portionsSold / (parseLocaleNumber(product.nbPortions) || 1);
            // `product` est ici une LIGNE de `activeProducts` (Phase 1.6 : une par format) — son
            // propre format attaché (`product.format`), pas une nouvelle dérivation du premier
            // format du produit sous-jacent.
            for (const item of (product.format?.[recipeField] || [])) {
                if (item.id === catItem.id) {
                    const recipeUnit = item.recipeUnit || catItem.unit;
                    const conv = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[catItem.unit]?.factor || 1);
                    totalQty += parseLocaleNumber(item.quantity) * conv * batchesNeeded;
                }
            }
        }
        if (totalQty > 0) {
            const lossP = (parseLocaleNumber(catItem.lossPercentage) || 0) / 100;
            const net = totalQty * catItem.unitPrice;
            const lossVal = lossP > 0 && lossP < 1 ? (net / (1 - lossP)) - net : net * lossP;
            totalNetCost += net;
            totalLossCost += lossVal;
            const prov = catItem.provider || "Non spécifié";
            if (!groupedByProvider[prov]) groupedByProvider[prov] = { items: [], totalPurchase: 0, totalLoss: 0, totalCost: 0 };
            groupedByProvider[prov].items.push({ ...catItem, totalQuantity: totalQty, purchaseCost: net, lossQuantity: totalQty * (lossP / (1 - lossP) || 0), lossCost: lossVal, totalCost: net + lossVal });
            groupedByProvider[prov].totalPurchase += net;
            groupedByProvider[prov].totalLoss += lossVal;
            groupedByProvider[prov].totalCost += (net + lossVal);
            allItems.push({ name: catItem.name, value: net });
        }
    }
    const purchasingReportData = { totalNetCost, totalLossCost, totalPurchaseCost: totalNetCost + totalLossCost, groupedByProvider, grandTotal: { purchase: totalNetCost, loss: totalLossCost, total: totalNetCost + totalLossCost } };

    allItems.sort((a, b) => b.value - a.value);
    const totalVal = allItems.reduce((sum, item) => sum + item.value, 0);
    const abcAnalysisData = { A: [], B: [], C: [], totals: { A: 0, B: 0, C: 0 } };
    let cumulativeValue = 0;
    for (const item of allItems) {
        const cumPercentBefore = totalVal > 0 ? (cumulativeValue / totalVal) * 100 : 0;
        const itemPercent = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
        if (cumPercentBefore < 70) { abcAnalysisData.A.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.A += itemPercent; }
        else if (cumPercentBefore < 90) { abcAnalysisData.B.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.B += itemPercent; }
        else { abcAnalysisData.C.push({ ...item, percent: itemPercent }); abcAnalysisData.totals.C += itemPercent; }
        cumulativeValue += item.value;
    }

    return { purchasingReportData, abcAnalysisData };
}

// Combine les valeurs d'un SKU à travers TOUS ses canaux, pondérées par le volume RÉEL de chaque
// canal (channelBreakdown[].volume) — remplace la vue « canal principal seulement » (`costs`) pour
// les indicateurs censés refléter toute l'activité d'un SKU, pas seulement son canal principal
// (retour utilisateur du 06/10 : changer le prix net sur un canal secondaire ne bougeait ni les
// KPIs pondérés, ni la matrice BCG, ni le classement par contribution). Repli sur `costs` (canal
// principal) si aucun canal n'a de volume renseigné pour ce SKU — impossible de pondérer sans
// données, comportement historique conservé à l'identique dans ce cas (et pour tout produit sans
// `channelPrices` du tout, ex. les anciens tests/projets).
function blendAcrossChannels(costs, channelBreakdown) {
    const cbWithVolume = (channelBreakdown || []).filter(cb => parseLocaleNumber(cb.volume) > 0);
    const totalVolume = cbWithVolume.reduce((s, cb) => s + parseLocaleNumber(cb.volume), 0);
    if (totalVolume <= 0) {
        return {
            margeBruteDollar: costs.margeBruteDollar,
            margeBrutePercent: costs.margeBrutePercent,
            costMatierePercent: costs.costMatierePercent,
            costPackagingPercent: costs.costPackagingPercent,
            costLaborPercent: costs.costLaborPercent,
            totalVolume: 0,
        };
    }
    const weighted = (field) => cbWithVolume.reduce((s, cb) => s + (parseLocaleNumber(cb[field]) || 0) * parseLocaleNumber(cb.volume), 0) / totalVolume;
    return {
        margeBruteDollar: weighted('margeBruteDollar'),
        // Pourcentage pondéré directement (pas redérivé d'un $ pondéré / prix du canal principal,
        // ce qui mélangerait un numérateur multi-canal à un dénominateur mono-canal).
        margeBrutePercent: weighted('margeBrutePercent'),
        costMatierePercent: weighted('costMatierePercent'),
        costPackagingPercent: weighted('costPackagingPercent'),
        costLaborPercent: weighted('costLaborPercent'),
        totalVolume,
    };
}

// Matrice BCG (menu engineering) : classe une liste de lignes déjà réduites à UNE valeur de
// popularité et UNE valeur de rentabilité par SKU — extrait en fonction pure, exportée, pour être
// réutilisable aussi bien par la vue « tous canaux » ci-dessous (pondérée par volume à travers
// `blendAcrossChannels`) que par une vue limitée à UN SEUL canal (sélecteur de canal dans Résumé →
// Vue d'ensemble, voir SummaryTable.jsx), sans jamais recalculer tout le pipeline de
// `computeAnalysisData`. Mêmes règles qu'avant (06/10) : seuil de popularité = 70 % de la part
// moyenne (règle des 70 %), seuil de rentabilité = marge moyenne pondérée par le volume.
export function computeMenuEngineeringQuadrants(rows) {
    const menuEngineeringData = { stars: [], cows: [], questions: [], dogs: [] };
    if (!rows || rows.length === 0) return menuEngineeringData;

    const totalPopularity = rows.reduce((s, r) => s + r.popularity, 0);
    const avgShare = totalPopularity / rows.length;
    const popularityThreshold = 0.70 * avgShare;

    const totalVolume = rows.reduce((s, r) => s + (r.volume || 0), 0);
    const totalMargin = rows.reduce((s, r) => s + r.margeBruteDollar * (r.volume || 0), 0);
    const avgMargin = totalVolume > 0
        ? totalMargin / totalVolume
        : rows.reduce((s, r) => s + r.margeBruteDollar, 0) / rows.length;

    for (const r of rows) {
        const highPop = r.popularity >= popularityThreshold;
        const highProf = r.margeBruteDollar >= avgMargin;
        if (highPop && highProf) menuEngineeringData.stars.push(r);
        else if (highPop && !highProf) menuEngineeringData.cows.push(r);
        else if (!highPop && highProf) menuEngineeringData.questions.push(r);
        else menuEngineeringData.dogs.push(r);
    }
    return menuEngineeringData;
}

// Calcule l'ensemble des données d'analyse dérivées du projet : coûts de tous les FORMATS de
// tous les produits, KPIs pondérés et point mort global, rapport d'achats et pertes, analyse ABC
// (Pareto), matrice BCG (menu engineering) et classement par contribution au profit. Extrait de
// App.jsx pour pouvoir être testé isolément, au même titre que calculateCosts.
//
// Phase 1.6 : une ligne par FORMAT (pas par produit) — chaque ligne de `productsWithCosts` « a
// l'air » d'un produit (mêmes champs à plat `prixVente`/`salesMix`/`onMenu`/`nbPortions`/`platName`
// lus par tous les écrans consommateurs existants) mais représente un format précis, avec son
// propre id de ligne (`id` = l'id du FORMAT, pas du produit — voir `productId` ci-dessous pour
// remonter au produit). Un produit sans `formats[]` (compatibilité avec d'anciennes fixtures de
// test) se rabat sur lui-même comme unique « format implicite », avec `formatIndex` 0 — résultat
// strictement identique à avant la Phase 1.6 pour tout produit à un seul format, qui reste le cas
// de tous les projets existants.
// `basePackaging` (Phase 2.2) : paramètre optionnel en fin de liste (défaut `[]`), pour ne pas
// casser les nombreux appels existants (tests, simulateur de chocs) qui ne manipulent pas encore
// le packaging — un catalogue vide donne un coût d'emballage nul, comportement inchangé.
// `salesChannels` (Phase 3.3) : paramètre optionnel en fin de liste (défaut `[]`), même convention
// que `basePackaging` — un projet sans canaux définis obtient simplement un `channelBreakdown` vide
// par ligne, comportement inchangé pour tout appel antérieur à cette phase.
export function computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging = [], salesChannels = []) {
    // 1. Calcul initial des coûts (une seule passe, memo partagé)
    const costsMemo = {};
    const productsWithCosts = [];
    for (const p of products) {
        const formatsList = (p.formats && p.formats.length > 0) ? p.formats : [p];
        formatsList.forEach((fmt, formatIndex) => {
            const costs = calculateCosts(p, calculatedGeneralInfo, baseIngredients, products, laborDatabase, null, costsMemo, new Set(), fmt, basePackaging);
            // Frais indirects alloués à CE format (même formule que l'ancien point mort de
            // Recette & Calcul) : part du pool total au prorata de son mix des ventes. Transmis à
            // computeChannelBreakdown pour un point mort PAR CANAL (06/10, Résumé → Par SKU).
            const allocatedIndirects = parseLocaleNumber(generalInfo.totalIndirects) * (parseLocaleNumber(fmt.salesMix) / 100);
            const channelBreakdown = computeChannelBreakdown(costs, fmt.channelPrices, salesChannels, allocatedIndirects);
            productsWithCosts.push({
                ...p,
                // Champs de vente du FORMAT (pas nécessairement ceux du produit, ni ceux de son
                // premier format — ceux de CE format précis) : chaque ligne reste lisible par les
                // écrans existants qui attendent un prixVente/salesMix/onMenu/nbPortions à plat.
                prixVente: fmt.prixVente,
                nbPortions: fmt.nbPortions,
                portionSize: fmt.portionSize,
                portionUnit: fmt.portionUnit,
                salesMix: fmt.salesMix,
                onMenu: fmt.onMenu,
                sku: fmt.sku,
                // Identité de ligne : `id` devient l'id du FORMAT (unique même entre deux formats
                // du même produit) pour que toute logique existante indexée par `.id` (clés React,
                // Map, recherches) reste correcte sans modification. `productId` permet de
                // retrouver le produit d'origine (ex. pour naviguer vers Recette & Calcul).
                id: fmt.id,
                productId: p.id,
                formatIndex,
                format: fmt,
                // Étiquette désambiguïsée, calculée une seule fois ici plutôt que redérivée dans
                // chaque écran consommateur (Résumé, rapports...) — voir buildRowDisplayName.
                displayName: buildRowDisplayName(p.platName, formatsList, fmt, formatIndex),
                costs,
                // Phase 3.3 : ventilation par canal de vente — réutilise `costs` déjà calculé
                // ci-dessus plutôt que de le recalculer par canal (voir computeChannelBreakdown).
                channelBreakdown,
                // 06/10 : vue « tous canaux », pondérée par le volume réel de chacun — alimente les
                // KPIs pondérés, la matrice BCG (vue par défaut) et sert de repli pour le
                // classement par contribution (voir blendAcrossChannels ci-dessus).
                blended: blendAcrossChannels(costs, channelBreakdown),
            });
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

    // 4. KPIs globaux + point mort GLOBAL (en chiffre d'affaires $)
    let weightedGrossMargin = 0;   // pondéré par la popularité (unités) — cohérent avec l'affichage
    let globalBreakEven = 0;
    let weightedMaterialCost = 0;
    let weightedPackagingCost = 0;
    let weightedLaborCost = 0;

    if (totalSalesMix > 0) {
        for (const p of activeProducts) {
            const weight = parseLocaleNumber(p.salesMix) / totalSalesMix;

            // 06/10 : les 4 KPIs pondérés utilisent la vue « tous canaux » (p.blended), pas
            // seulement le canal principal — sinon un changement de prix sur un canal secondaire
            // n'y apparaît jamais (retour utilisateur). Repli automatique sur le canal principal
            // tant qu'aucun volume n'est renseigné sur aucun canal (voir blendAcrossChannels).
            weightedGrossMargin += (p.blended.margeBrutePercent * weight);
            weightedMaterialCost += (p.blended.costMatierePercent * weight);
            weightedPackagingCost += (p.blended.costPackagingPercent * weight);
            weightedLaborCost += (p.blended.costLaborPercent * weight);
        }

        // Point mort global en CHIFFRE D'AFFAIRES : coûts fixes / taux de marge pondéré par le
        // REVENU (dollars de vente), et non par les unités. Hypothèse : matière + main-d'œuvre =
        // variables (MO semi-variable), frais indirects = seuls coûts fixes. (Le point mort en
        // UNITÉS est calculé par plat dans RecipeCalculator : part de frais indirects allouée /
        // marge brute par unité.) Marge « tous canaux » ici aussi (06/10).
        const totalMarginDollar = activeProducts.reduce((s, p) => s + p.blended.margeBruteDollar * (unitsSoldById[p.id] || 0), 0);
        const revenueWeightedMarginRatio = menuRevenue > 0 ? totalMarginDollar / menuRevenue : 0;
        const menuRevPerc = (parseLocaleNumber(generalInfo.menuRevenuePercentage) || 100) / 100;
        const indirectsMenu = parseLocaleNumber(generalInfo.totalIndirects) * menuRevPerc;
        globalBreakEven = revenueWeightedMarginRatio > 0 ? indirectsMenu / revenueWeightedMarginRatio : 0;
    }

    // 5 & 6. Rapport d'Achats + Analyse ABC — ingrédients, puis packaging (Phase 2.3) selon la
    // même méthode (voir computePurchasingAndAbc ci-dessus), quantités basées sur les unités
    // reconstruites (étape 3). Postes toujours SÉPARÉS, jamais fusionnés entre les deux catalogues.
    const { purchasingReportData, abcAnalysisData } = computePurchasingAndAbc(baseIngredients, activeProducts, unitsSoldById, 'ingredients');
    const { purchasingReportData: packagingPurchasingReportData, abcAnalysisData: packagingAbcAnalysisData } = computePurchasingAndAbc(basePackaging, activeProducts, unitsSoldById, 'packagingItems');

    // 7. Matrice d'ingénierie de menu (Kasavana-Smith), vue « tous canaux » par défaut :
    //    - axe rentabilité = marge de contribution incluant la main-d'œuvre semi-variable
    //      (margeBruteDollar), PONDÉRÉE à travers tous les canaux du SKU (p.blended, 06/10) —
    //      plus seulement le canal principal ;
    //    - axe popularité = part du volume RÉEL agrégé à travers tous les canaux du SKU
    //      (p.blended.totalVolume), exactement la même base que chaque vue limitée à un seul canal
    //      (07/10) — jamais salesMix, qui reste une part du menu GLOBAL diluée par le % fixe des
    //      formats en mode manuel (volume nul sur tous les canaux). Repli sur l'ancienne
    //      reconstruction (salesMix + unités reconstruites du revenu total) UNIQUEMENT si aucun
    //      produit actif n'a de volume réel renseigné sur aucun canal (projet sans circuits de
    //      vente, anciens tests) — comportement historique inchangé dans ce cas précis.
    //    - seuil de popularité = 70 % de la part moyenne (règle des 70 %) ;
    //    - seuil de rentabilité = marge moyenne pondérée par le volume (réel ou reconstruit).
    // 07/10 : un SKU sans AUCUN volume réel sur aucun canal (jamais vraiment vendu — ex. un format
    // laissé en mode manuel sans historique de vente) est EXCLU de la matrice, jamais forcé à 0 %
    // de popularité — même principe que channelBreakdown (une donnée absente reste absente) et que
    // la vue par canal (qui exclut déjà tout SKU non présent dans son channelBreakdown). L'inclure
    // avec 0 % fausserait quand même la part moyenne (le dénominateur `rows.length` du seuil de
    // popularité), donc le seuil de tous les autres SKU, sans qu'il ait de performance réelle à
    // classer. Uniquement quand des données de volume réel existent par ailleurs (sinon TOUT le
    // menu serait exclu — repli ci-dessous).
    // Logique de classement extraite dans computeMenuEngineeringQuadrants (ci-dessus), réutilisée
    // telle quelle par le sélecteur de canal de Résumé → Vue d'ensemble (SummaryTable.jsx) pour une
    // analyse limitée à UN SEUL canal, sans recalculer tout ce pipeline.
    const totalRealVolumeAllChannels = activeProducts.reduce((s, p) => s + (p.blended.totalVolume || 0), 0);
    const menuEngineeringCandidates = totalRealVolumeAllChannels > 0
        ? activeProducts.filter(p => p.blended.totalVolume > 0)
        : activeProducts;
    const menuEngineeringData = computeMenuEngineeringQuadrants(menuEngineeringCandidates.map(p => ({
        id: p.id,
        displayName: p.displayName,
        popularity: totalRealVolumeAllChannels > 0
            ? (p.blended.totalVolume / totalRealVolumeAllChannels) * 100
            : parseLocaleNumber(p.salesMix),
        margeBruteDollar: p.blended.margeBruteDollar,
        volume: totalRealVolumeAllChannels > 0 ? p.blended.totalVolume : (unitsSoldById[p.id] || 0),
    })));

    // 8. Données de contribution — somme RÉELLE du volume × marge brute de CHAQUE canal du SKU
    // (06/10, option 2 retenue par l'utilisateur) : cohérent avec le titre « contribution totale »,
    // et plus exact que l'ancienne estimation (unités reconstruites du canal principal seulement)
    // dès qu'un SKU a de vrais volumes saisis sur plusieurs canaux. Repli sur l'ancienne estimation
    // quand aucun canal n'a de volume renseigné pour ce SKU (même condition que blendAcrossChannels).
    const contributionData = activeProducts.map(p => {
        const totalContribution = p.blended.totalVolume > 0
            ? (p.channelBreakdown || []).reduce((s, cb) => s + parseLocaleNumber(cb.volume) * cb.margeBruteDollar, 0)
            : (unitsSoldById[p.id] || 0) * p.costs.margeBruteDollar;
        return { name: p.displayName, totalContribution };
    }).sort((a, b) => b.totalContribution - a.totalContribution);

    return {
        productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin, globalBreakEven,
        weightedMaterialCost, weightedPackagingCost, weightedLaborCost, menuEngineeringData,
        purchasingReportData, abcAnalysisData, packagingPurchasingReportData, packagingAbcAnalysisData, contributionData,
        productivityReport: calculatedGeneralInfo.productivityReport
    };
}
