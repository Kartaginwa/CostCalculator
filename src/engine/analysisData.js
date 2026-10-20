import { parseLocaleNumber, CONVERSION_FACTORS, buildRowDisplayName, round2 } from '../utils.js';
import { calculateCosts, computeChannelBreakdown, computeMarginsForPrice } from './calculateCosts.js';

// Phase 4.5bis/4.6 — contenants « Activité » partagés entre Revenus, Charges directes réelles et
// Frais fixes : Général + chaque activité de production, dans cet ordre (voir
// 04-Conception-Modele.md, section 1 : Général est une allocation directe à une seule étape, pas
// un 3e axe symétrique). Extrait ici (au lieu de rester dupliqué dans IncomeStatementTab.jsx) pour
// qu'App.jsx puisse construire les mêmes contenants lors de l'agrégation des pools (Phase 4.6).
export function buildActivityBuckets(productionActivities = []) {
    return [{ key: 'general', label: 'Général' }, ...productionActivities.map(a => ({ key: a.id, label: a.name }))];
}

// Préfixes de la « Clé de répartition » des frais fixes (Phase 4.5bis, 14/10) pour une sélection
// directe d'une seule colonne — voir IncomeStatementTab.jsx pour le détail du mécanisme.
export const REPARTITION_ACTIVITY_PREFIX = 'activity:';
export const REPARTITION_CHANNEL_PREFIX = 'channel:';
export const REPARTITION_CUSTOM_PREFIX = 'custom:';

// Phase 4.5bis (corrigé le 14/10), extrait en fonction pure le 14/10 pour que la Phase 4.6 (ici
// même, computeAnalysisData) puisse calculer les mêmes pools Général/Activité/Canal que l'onglet
// État des résultats, sans dupliquer la logique « quelle clé remplit quel contenant ». Voir
// IncomeStatementTab.jsx (seul appelant UI) pour le commentaire détaillé du mécanisme — même
// logique ici au mot près, juste sortie du composant React.
export function computeExpenseLineEffectiveAllocations({
    expenseLines, repartitionKeys, activityBuckets, salesChannels,
    totalRevenue, totalDirectCosts, bucketTotals, directCostBucketTotals,
}) {
    const map = {};
    (expenseLines || []).forEach((line) => {
        const key = line.repartitionKey || 'manual';
        const lineAmount = parseLocaleNumber(line.amount);

        if (key === 'manual') {
            map[line.id] = { activityAllocations: line.activityAllocations || {}, channelAllocations: line.channelAllocations || {}, locked: false };
            return;
        }
        if (key === 'sales' || key === 'directCosts') {
            const sourceTotal = key === 'sales' ? totalRevenue : totalDirectCosts;
            const sourceBucketTotals = key === 'sales' ? bucketTotals : directCostBucketTotals;
            const activityAllocations = {};
            if (sourceTotal > 0) {
                activityBuckets.forEach((b) => {
                    const share = (sourceBucketTotals[b.key] || 0) / sourceTotal;
                    if (share > 0) activityAllocations[b.key] = round2(lineAmount * share);
                });
            }
            map[line.id] = { activityAllocations, channelAllocations: {}, locked: true };
            return;
        }
        if (key.startsWith(REPARTITION_ACTIVITY_PREFIX)) {
            const bucketKey = key.slice(REPARTITION_ACTIVITY_PREFIX.length);
            map[line.id] = { activityAllocations: { [bucketKey]: round2(lineAmount) }, channelAllocations: {}, locked: true };
            return;
        }
        if (key.startsWith(REPARTITION_CHANNEL_PREFIX)) {
            const channelId = key.slice(REPARTITION_CHANNEL_PREFIX.length);
            map[line.id] = { activityAllocations: {}, channelAllocations: { [channelId]: round2(lineAmount) }, locked: true };
            return;
        }
        if (key.startsWith(REPARTITION_CUSTOM_PREFIX)) {
            const customKey = (repartitionKeys || []).find((k) => k.id === key.slice(REPARTITION_CUSTOM_PREFIX.length));
            const activityShares = customKey?.activityShares || {};
            const channelShares = customKey?.channelShares || {};
            const activityAllocations = {};
            const channelAllocations = {};
            activityBuckets.forEach((b) => {
                const pct = parseLocaleNumber(activityShares[b.key]);
                if (pct > 0) activityAllocations[b.key] = round2(lineAmount * pct / 100);
            });
            salesChannels.forEach((c) => {
                const pct = parseLocaleNumber(channelShares[c.id]);
                if (pct > 0) channelAllocations[c.id] = round2(lineAmount * pct / 100);
            });
            map[line.id] = { activityAllocations, channelAllocations, locked: true };
            return;
        }
        // Clé inconnue (ex. clé personnalisée supprimée depuis) : repli silencieux sur la grille
        // manuelle déjà stockée, de nouveau librement éditable.
        map[line.id] = { activityAllocations: line.activityAllocations || {}, channelAllocations: line.channelAllocations || {}, locked: false };
    });
    return map;
}

// Sous-totaux par contenant (bas du tableau Frais fixes, ET pools Activité/Canal de la Phase 4.6)
// — somme des allocations EFFECTIVES (ci-dessus) de toutes les lignes de frais fixes, par activité
// puis par canal. Garanti sommer exactement au total des frais fixes (voir la correction du 14/10,
// bassin partagé) : jamais besoin d'un contenant « Général » côté canal, ni de double comptage.
export function computeExpensePoolTotals(expenseLines, effectiveAllocations, activityBuckets, salesChannels) {
    const activityPoolTotals = {};
    (activityBuckets || []).forEach((b) => {
        activityPoolTotals[b.key] = (expenseLines || []).reduce((sum, line) => sum + parseLocaleNumber(effectiveAllocations[line.id]?.activityAllocations?.[b.key] ?? 0), 0);
    });
    const channelPoolTotals = {};
    (salesChannels || []).forEach((c) => {
        channelPoolTotals[c.id] = (expenseLines || []).reduce((sum, line) => sum + parseLocaleNumber(effectiveAllocations[line.id]?.channelAllocations?.[c.id] ?? 0), 0);
    });
    return { activityPoolTotals, channelPoolTotals };
}

// Phase 4.6 — Totaux agrégés des deux drivers possibles (coût direct, temps de main-d'œuvre) pour
// les pools Activité, et des trois drivers possibles (ventes, coût direct, temps de MO) pour les
// pools Canal — calculés sur TOUS les formats actifs, au prorata du volume VENDU (reconstruit menu
// entier pour Activité via `costs.portionsSold` ; volume RÉEL par canal via `format.channelPrices`
// pour Canal, plus précis). Les DEUX/TROIS drivers sont toujours calculés, pas seulement celui
// choisi pour cette activité/ce canal — chacun peut choisir indépendamment sans recalcul global.
// Un produit dont l'activité a été supprimée depuis, ou un canal sans aucun volume réel saisi nulle
// part, reste simplement absent (jamais une part forcée à 0) — voir 04-Conception-Modele.md,
// section Phase 4.6.
// Canal (corrigé le 14/10, suite à un retour utilisateur) : AUCUN driver au choix — contrairement à
// Activité. Vérification formule par formule de l'Agro-Calculateur (feuille `Synthèse`, matrice
// « Coût de revient complet ») : `E27 = D27 + (D27 × (Pool_circuit / SOMMEPROD(coût_production ×
// volume, TOUS les SKU)))` — un SEUL mécanisme universel, jamais un choix par circuit. Le CICI ne
// se choisit qu'À L'ACTIVITÉ (une fois) ; le canal applique ensuite une MAJORATION % sur le coût de
// production déjà établi (peu importe quel CICI l'a produit), jamais un driver indépendant. C'est la
// méthode traditionnelle « majoration sur coût de production » (percentage of production cost),
// qui hérite automatiquement de la fidélité déjà obtenue au niveau de l'activité — voir
// 04-Conception-Modele.md, section Phase 4.6, pour la validation complète.
export function computeIndirectCostDriverTotals(productsWithCosts, productionActivities = [], salesChannels = []) {
    const activityDriverTotals = {};
    productionActivities.forEach((a) => { activityDriverTotals[a.id] = { directCost: 0, laborTime: 0 }; });

    // Un seul total par canal (pas un par driver) : le dénominateur de la majoration, toujours la
    // valeur totale (au coût de production) de ce qui transite par ce canal.
    const channelDriverTotals = {};
    salesChannels.forEach((c) => { channelDriverTotals[c.id] = 0; });

    for (const row of (productsWithCosts || [])) {
        const costs = row.costs;
        if (!costs) continue;
        const nbPortions = parseLocaleNumber(costs.nbPortions) || 1;
        const portionsSold = parseLocaleNumber(costs.portionsSold);

        if (row.activityId && activityDriverTotals[row.activityId] && portionsSold > 0) {
            activityDriverTotals[row.activityId].directCost += parseLocaleNumber(costs.totalDirectCostPerPortion) * portionsSold;
            activityDriverTotals[row.activityId].laborTime += (parseLocaleNumber(costs.productionTimeSeconds) / 3600) * (portionsSold / nbPortions);
        }

        (row.format?.channelPrices || []).forEach((cp) => {
            const volume = parseLocaleNumber(cp.volume);
            if (!(cp.channelId in channelDriverTotals) || !(volume > 0)) return;
            channelDriverTotals[cp.channelId] += parseLocaleNumber(costs.totalDirectCostPerPortion) * volume;
        });
    }

    return { activityDriverTotals, channelDriverTotals };
}

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

// Phase 4.2 — Revenus réels : ventilation par canal INDICATIVE (jamais un intrant de calcul, voir
// Projet_Claude/04-Conception-Modele.md section 1bis). Agrège le revenu théorique
// (`channelBreakdown[].netPrice × volume`) de tous les formats d'une activité, par canal, puis
// normalise en parts (%) — appliquées ensuite par l'UI au montant RÉEL saisi pour cette activité.
// Une activité sans aucun revenu théorique par canal (aucun format vendu, ou aucun canal renseigné)
// est simplement absente du résultat — jamais une part forcée à 0 (même principe que
// `channelBreakdown` et la matrice BCG).
export function computeChannelRevenueShareByActivity(productsWithCosts, salesChannels = []) {
    const revenueByActivity = {};
    for (const row of (productsWithCosts || [])) {
        if (!row.activityId) continue;
        const byChannel = revenueByActivity[row.activityId] || (revenueByActivity[row.activityId] = {});
        for (const cb of (row.channelBreakdown || [])) {
            const revenue = parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume);
            byChannel[cb.channelId] = (byChannel[cb.channelId] || 0) + revenue;
        }
    }
    const result = {};
    for (const [activityId, byChannel] of Object.entries(revenueByActivity)) {
        const total = Object.values(byChannel).reduce((s, v) => s + v, 0);
        if (!(total > 0)) continue;
        result[activityId] = Object.entries(byChannel)
            .map(([channelId, revenue]) => {
                const channel = salesChannels.find(c => c.id === channelId);
                return { channelId, channelName: channel?.name || channelId, share: revenue / total };
            })
            .sort((a, b) => b.share - a.share);
    }
    return result;
}

// Phase 6 (15/10) — Impact d'un scénario (simulateur de chocs de coûts) PAR ACTIVITÉ DE
// PRODUCTION : moyenne des % de coût/marge (vue « tous canaux », `p.blended`) pondérée par le mix
// de vente DES SEULS FORMATS DE CETTE ACTIVITÉ (pas du menu entier) — isole l'impact propre à
// l'activité plutôt que de le diluer dans la moyenne globale. Une activité sans aucun format actif
// (mix nul) ou un format sans activité assignée sont simplement absents du résultat.
export function computeActivityImpact(activeProducts, productionActivities = []) {
    const byActivity = {};
    for (const p of (activeProducts || [])) {
        if (!p.activityId) continue;
        (byActivity[p.activityId] || (byActivity[p.activityId] = [])).push(p);
    }
    const result = [];
    for (const [activityId, rows] of Object.entries(byActivity)) {
        const totalMix = rows.reduce((s, p) => s + parseLocaleNumber(p.salesMix), 0);
        if (!(totalMix > 0)) continue;
        let margeBrutePercent = 0, costMatierePercent = 0, costLaborPercent = 0;
        for (const p of rows) {
            const weight = parseLocaleNumber(p.salesMix) / totalMix;
            margeBrutePercent += p.blended.margeBrutePercent * weight;
            costMatierePercent += p.blended.costMatierePercent * weight;
            costLaborPercent += p.blended.costLaborPercent * weight;
        }
        const label = productionActivities.find(a => a.id === activityId)?.name || activityId;
        result.push({ activityId, label, margeBrutePercent, costMatierePercent, costLaborPercent });
    }
    return result;
}

// Phase 6 (15/10) — Impact d'un scénario PAR CIRCUIT DE VENTE : moyenne des % de coût/marge DE CE
// CANAL (`channelBreakdown`, pas la vue « tous canaux ») pondérée par son volume RÉEL à travers
// tous les formats actifs — un canal sans aucun volume réel renseigné est absent du résultat.
export function computeChannelImpact(activeProducts, salesChannels = []) {
    const byChannel = {};
    for (const p of (activeProducts || [])) {
        for (const cb of (p.channelBreakdown || [])) {
            if (!(parseLocaleNumber(cb.volume) > 0)) continue;
            (byChannel[cb.channelId] || (byChannel[cb.channelId] = [])).push(cb);
        }
    }
    const result = [];
    for (const [channelId, rows] of Object.entries(byChannel)) {
        const totalVolume = rows.reduce((s, cb) => s + parseLocaleNumber(cb.volume), 0);
        if (!(totalVolume > 0)) continue;
        let margeBrutePercent = 0, costMatierePercent = 0, costLaborPercent = 0;
        for (const cb of rows) {
            const weight = parseLocaleNumber(cb.volume) / totalVolume;
            margeBrutePercent += cb.margeBrutePercent * weight;
            costMatierePercent += cb.costMatierePercent * weight;
            costLaborPercent += cb.costLaborPercent * weight;
        }
        const label = salesChannels.find(c => c.id === channelId)?.name || channelId;
        result.push({ channelId, label, margeBrutePercent, costMatierePercent, costLaborPercent });
    }
    return result;
}

// Phase 4.3bis (13/10) — Charges directes réelles : mappe chaque catégorie de `directCostLines`
// (voir utils.js, DIRECT_COST_TYPES) vers le champ de coût théorique par portion correspondant
// dans `costs` (calculateCosts.js) — driver « apparié par type » (voir Projet_Claude/
// 04-Conception-Modele.md, section 1bis) : on ne répartit jamais un $ réel d'un type avec la clé
// théorique d'un AUTRE type (ex. de l'emballage réel avec une clé de main-d'œuvre théorique serait
// arbitraire).
export const DIRECT_COST_TYPE_FIELDS = {
    'Matière première': 'costMatierePerPortion',
    "Main-d'œuvre directe": 'costLaborPerPortion',
    'Emballage': 'costPackagingPerPortion',
    'Sous-traitance': 'costSubcontractingPerPortion',
};

// Agrège, par activité puis par canal, le coût théorique total d'UN type de coût donné (somme sur
// tous les formats de l'activité de costXPerPortion × volume réel par canal — même source de
// volume que computeChannelRevenueShareByActivity). Une activité/un canal sans aucun coût
// théorique de ce type en est simplement absent (jamais une valeur forcée à 0).
function computeTheoreticalCostTotalsByActivity(productsWithCosts, costField) {
    const totals = {};
    for (const row of (productsWithCosts || [])) {
        if (!row.activityId) continue;
        const unitCost = parseLocaleNumber(row.costs?.[costField]);
        if (!(unitCost > 0)) continue;
        for (const cb of (row.channelBreakdown || [])) {
            const amount = unitCost * parseLocaleNumber(cb.volume);
            if (!(amount > 0)) continue;
            const byChannel = totals[row.activityId] || (totals[row.activityId] = {});
            byChannel[cb.channelId] = (byChannel[cb.channelId] || 0) + amount;
        }
    }
    return totals;
}

// Phase 4.3bis — Charges directes réelles : parts INDICATIVES par activité puis par canal de vente
// pour un type de coût donné, appliquées ensuite par l'UI au montant RÉEL d'une ligne (jamais un
// intrant de calcul — même principe que computeChannelRevenueShareByActivity). Contrairement aux
// revenus, l'activité elle-même est ici dérivée (pas choisie manuellement) : une charge directe
// réelle n'arrive pas en comptabilité déjà rattachée à une activité précise, contrairement à une
// vente. `activityShares` vide signifie qu'aucune activité n'a de coût théorique de ce type — à
// l'appelant de replier ce cas sur « Général » plutôt que de forcer une répartition inventée.
export function computeDirectCostAllocation(productsWithCosts, costField) {
    const byActivity = computeTheoreticalCostTotalsByActivity(productsWithCosts, costField);

    const activityTotals = {};
    for (const [activityId, byChannel] of Object.entries(byActivity)) {
        activityTotals[activityId] = Object.values(byChannel).reduce((s, v) => s + v, 0);
    }
    const grandTotal = Object.values(activityTotals).reduce((s, v) => s + v, 0);

    const activityShares = {};
    const channelSharesByActivity = {};
    if (grandTotal > 0) {
        for (const [activityId, total] of Object.entries(activityTotals)) {
            activityShares[activityId] = total / grandTotal;
            channelSharesByActivity[activityId] = {};
            for (const [channelId, amount] of Object.entries(byActivity[activityId])) {
                channelSharesByActivity[activityId][channelId] = amount / total;
            }
        }
    }

    return { activityShares, channelSharesByActivity };
}

// Sous-totaux par contenant d'une liste de lignes à plat portant un `amounts` (Revenus réels,
// Phase 4.2) — extrait en fonction pure le 14/10 pour qu'App.jsx puisse l'utiliser (pool Général de
// la Phase 4.6, clé « Selon les ventes ») sans dupliquer ce calcul trivial une 2e fois.
export function computeBucketTotalsFromAmounts(lines, activityBuckets) {
    const totals = {};
    activityBuckets.forEach((b) => {
        totals[b.key] = (lines || []).reduce((sum, line) => sum + parseLocaleNumber(line.amounts?.[b.key] ?? 0), 0);
    });
    return totals;
}

// Phase 4.3bis, extrait en fonction pure le 14/10 (même raison que computeExpenseLineEffectiveAllocations
// ci-dessus) : ventilation indicative des charges directes réelles par activité puis par canal de
// vente, dérivée du coût théorique apparié au type de coût de CHAQUE ligne (DIRECT_COST_TYPE_FIELDS
// ci-dessus). Un type sans aucune donnée théorique (ex. aucune recette n'a d'item de
// sous-traitance) retombe sur Général plutôt que de forcer une part inventée. Retourne aussi
// `directCostBucketTotals` (sous-totaux par activité, consommés par le pool Général de la Phase
// 4.6 via « Selon les charges directes ») et `directCostChannelTotals` (indicatif, UI seulement).
export function computeDirectCostLineAllocations(directCostLines, productsWithCosts, activityBuckets, salesChannels) {
    const directCostAllocationByType = {};
    for (const [category, field] of Object.entries(DIRECT_COST_TYPE_FIELDS)) {
        directCostAllocationByType[category] = computeDirectCostAllocation(productsWithCosts, field);
    }

    const directCostLineAllocations = (directCostLines || []).map((line) => {
        const allocation = directCostAllocationByType[line.category];
        const hasTheoretical = allocation && Object.keys(allocation.activityShares).length > 0;
        const lineAmount = parseLocaleNumber(line.amount);

        const activityAmounts = {};
        activityBuckets.forEach((b) => {
            if (b.key === 'general') {
                activityAmounts.general = hasTheoretical ? 0 : lineAmount;
            } else {
                const share = allocation?.activityShares[b.key];
                activityAmounts[b.key] = share ? lineAmount * share : 0;
            }
        });

        const channelAmounts = {};
        salesChannels.forEach((c) => {
            let total = 0;
            let hasShare = false;
            activityBuckets.forEach((b) => {
                if (b.key === 'general') return;
                const amt = activityAmounts[b.key];
                const s = allocation?.channelSharesByActivity[b.key]?.[c.id];
                if (amt > 0 && s) { total += amt * s; hasShare = true; }
            });
            channelAmounts[c.id] = { total, hasShare };
        });

        return { line, hasTheoretical, activityAmounts, channelAmounts };
    });

    const directCostBucketTotals = {};
    activityBuckets.forEach((b) => {
        directCostBucketTotals[b.key] = directCostLineAllocations.reduce((sum, a) => sum + (a.activityAmounts[b.key] || 0), 0);
    });

    const directCostChannelTotals = {};
    salesChannels.forEach((c) => {
        let total = 0;
        let hasShare = false;
        directCostLineAllocations.forEach((a) => {
            const ch = a.channelAmounts[c.id];
            if (ch?.hasShare) { total += ch.total; hasShare = true; }
        });
        directCostChannelTotals[c.id] = { total, hasShare };
    });

    return { directCostLineAllocations, directCostBucketTotals, directCostChannelTotals };
}

// Phase 4.4 — Tableau de réconciliation réel/théorique : compare, au niveau de l'ENTREPRISE entière
// (jamais par activité/canal — le détail par activité resterait partiellement circulaire, voir la
// limite déjà documentée pour les revenus en 4.2), le réel saisi (Revenus de 4.2, Charges directes
// de 4.3) au théorique implicite du modèle de recettes — même patron que le rapport de productivité
// MO déjà présent dans l'app (« heures attendues » vs « heures réelles »), pas un concept étranger.
// `menuRevenue`/`unitsSoldById` (volumes reconstruits à partir du mix des ventes) viennent de
// `computeAnalysisData`, jamais redérivés ici en double.
// N'inclut PAS de taux de frais fixes PAR UNITÉ : les frais fixes ne se divisent jamais par un total
// d'unités à plat (correction du 13/10, suite à un retour utilisateur) — leur conversion en taux
// (Phase 4.6) est TOUJOURS par contenant (Général/Activité/Canal, Phase 4.5), par PRODUIT, calculée
// dans `calculateCosts.js` et affichée dans le rapport par SKU — jamais une seule moyenne globale
// dans cet onglet. Voir `04-Conception-Modele.md`, section 1bis. La ligne « Bénéfice net »
// (20/10) déroge volontairement à ce principe : elle soustrait le TOTAL $ des frais fixes
// (`generalInfo.totalIndirects`, déjà affiché en sous-total du tableau Dépenses ci-dessus) — pas
// une nouvelle moyenne par unité. Un seul total existe dans l'app (les frais fixes sont saisis une
// fois, jamais modélisés par produit) : il est donc soustrait identiquement du réel ET du
// théorique, l'écart entre les deux colonnes ne venant alors que des revenus/charges directes
// ci-dessus, jamais de ce total commun.
export function computeRealVsTheoreticalReconciliation({
    totalRevenue, totalDirectCosts, activeProducts, unitsSoldById, menuRevenue, totalIndirects,
}) {
    const theoreticalDirectCosts = (activeProducts || []).reduce(
        (sum, p) => sum + (unitsSoldById?.[p.id] || 0) * parseLocaleNumber(p.costs?.totalDirectCostPerPortion),
        0
    );

    const makeRow = (label, real, theoretical) => ({
        label,
        real,
        theoretical,
        diff: real - theoretical,
        // Écart en % relatif au théorique (base de comparaison, comme un budget) — absent (pas 0 %)
        // quand aucun théorique n'existe, pour ne jamais laisser croire à une précision inexistante.
        diffPercent: theoretical !== 0 ? (real - theoretical) / theoretical : null,
    });

    const grossProfitReal = totalRevenue - totalDirectCosts;
    const grossProfitTheoretical = menuRevenue - theoreticalDirectCosts;
    const indirects = parseLocaleNumber(totalIndirects);

    const rows = [
        makeRow('Revenus', totalRevenue, menuRevenue),
        makeRow('Charges directes', totalDirectCosts, theoreticalDirectCosts),
        makeRow('Bénéfice brut', grossProfitReal, grossProfitTheoretical),
        makeRow('Bénéfice net', grossProfitReal - indirects, grossProfitTheoretical - indirects),
    ];

    return { rows };
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
// `indirectPools` (Phase 4.6, optionnel, en toute fin de liste — même convention que
// `basePackaging`/`salesChannels` ci-dessus, pour ne jamais casser un appel existant, y compris les
// ~30 appels positionnels de analysisData.test.js) : vient de `computeExpensePoolTotals` +
// `computeIndirectCostDriverTotals` (calculés par l'appelant, voir App.jsx, à partir d'un premier
// appel « brouillon » à cette même fonction SANS pools — Général seul, comme avant 4.6 — pour en
// tirer les volumes/coûts directs nécessaires à l'agrégation). Forme attendue :
// `{ generalPoolAmount, activityPools: { [activityId]: { amount, driver, driverTotal } },
// channelPools: { [channelId]: { amount, driver, driverTotal } } }`. Absent (ou `null`) :
// comportement strictement identique à avant 4.6 (un seul pool Général, `totalIndirects` tel quel,
// aucun coût Activité/Canal) — c'est le cas de tout appel qui ne le fournit pas encore
// (CostShockSimulator.jsx, par exemple, pas encore mis à jour pour cette phase).
export function computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging = [], salesChannels = [], indirectPools = null) {
    // Pool Général (Phase 4.6) : remplace `totalIndirects` par la part Général SEULEMENT, si un
    // `indirectPools` est fourni — tout le reste de `calculatedGeneralInfo` (totalDirectLaborHoursNeeded
    // notamment) reste le dénominateur MENU ENTIER inchangé, requis par les deux méthodes existantes
    // (ventes/temps de MO) pour se réconcilier exactement.
    const calculatedGeneralInfoForCosts = indirectPools
        ? { ...calculatedGeneralInfo, totalIndirects: indirectPools.generalPoolAmount }
        : calculatedGeneralInfo;

    // 1. Calcul initial des coûts (une seule passe, memo partagé)
    const costsMemo = {};
    const productsWithCosts = [];
    for (const p of products) {
        const formatsList = (p.formats && p.formats.length > 0) ? p.formats : [p];
        formatsList.forEach((fmt, formatIndex) => {
            let costs = calculateCosts(p, calculatedGeneralInfoForCosts, baseIngredients, products, laborDatabase, null, costsMemo, new Set(), fmt, basePackaging);

            // Phase 4.6 — Activité : ajoute, en plus du Général déjà dans `costs` ci-dessus, la part
            // du pool de l'activité de CE produit (driver choisi pour cette activité — voir
            // Projet_Claude/04-Conception-Modele.md, section Phase 4.6). Un produit dont l'activité
            // n'a pas de pool (ou plus de pool, ou un driver sans volume réel nulle part) reste
            // simplement sans cette part — jamais un 0 inventé.
            const activityPool = indirectPools?.activityPools?.[p.activityId];
            if (activityPool && activityPool.amount > 0 && activityPool.driverTotal > 0 && costs.portionsSold > 0) {
                const driverValueTotal = activityPool.driver === 'laborTime'
                    ? (costs.productionTimeSeconds / 3600) * (costs.portionsSold / (costs.nbPortions || 1))
                    : costs.totalDirectCostPerPortion * costs.portionsSold;
                const costIndirectActivityPerPortion = (activityPool.amount * (driverValueTotal / activityPool.driverTotal)) / costs.portionsSold;
                const newCostIndirectPerPortion = costs.costIndirectPerPortion + costIndirectActivityPerPortion;
                costs = {
                    ...costs,
                    costIndirectActivityPerPortion,
                    costIndirectPerPortion: newCostIndirectPerPortion,
                    totalCostPerPortion: costs.totalDirectCostPerPortion + newCostIndirectPerPortion + (costs.costAgingPerPortion || 0),
                    ...computeMarginsForPrice(fmt.prixVente, { ...costs, costIndirectPerPortion: newCostIndirectPerPortion, totalCostPerPortion: costs.totalDirectCostPerPortion + newCostIndirectPerPortion + (costs.costAgingPerPortion || 0) }),
                };
            }

            // Frais indirects alloués à CE format (même formule que l'ancien point mort de
            // Recette & Calcul) : part du pool total au prorata de son mix des ventes. Transmis à
            // computeChannelBreakdown pour un point mort PAR CANAL (06/10, Résumé → Par SKU).
            const allocatedIndirects = parseLocaleNumber(generalInfo.totalIndirects) * (parseLocaleNumber(fmt.salesMix) / 100);
            // Phase 4.6 : `channelPools` ajoute, PAR CANAL, la part du pool de CE canal précis — en
            // plus de Général+Activité déjà dans `costs` (identiques pour tous les canaux de ce
            // format). Une marge nette différente par canal, pas seulement à cause du prix.
            const channelBreakdown = computeChannelBreakdown(costs, fmt.channelPrices, salesChannels, allocatedIndirects, indirectPools?.channelPools);

            // Phase 4.6 — Canal (vue agrégée pour CE format, « toutes ventes confondues ») : moyenne
            // pondérée par le volume réel des parts de canal déjà calculées par canal ci-dessus
            // (jamais une seule moyenne globale au niveau du menu). Un format sans aucun volume réel
            // par canal reste simplement sans cette part (voir blendAcrossChannels, même principe).
            const channelVolumeTotal = channelBreakdown.reduce((s, cb) => s + (cb.volume || 0), 0);
            if (channelVolumeTotal > 0) {
                const costIndirectChannelPerPortion = channelBreakdown.reduce((s, cb) => s + (cb.costIndirectChannelPerPortion || 0) * cb.volume, 0) / channelVolumeTotal;
                if (costIndirectChannelPerPortion > 0) {
                    const newCostIndirectPerPortion = costs.costIndirectPerPortion + costIndirectChannelPerPortion;
                    const newTotalCostPerPortion = costs.totalDirectCostPerPortion + newCostIndirectPerPortion + (costs.costAgingPerPortion || 0);
                    costs = {
                        ...costs,
                        costIndirectChannelPerPortion,
                        costIndirectPerPortion: newCostIndirectPerPortion,
                        totalCostPerPortion: newTotalCostPerPortion,
                        ...computeMarginsForPrice(fmt.prixVente, { ...costs, costIndirectPerPortion: newCostIndirectPerPortion, totalCostPerPortion: newTotalCostPerPortion }),
                    };
                }
            }

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

    // 3. VOLUMES — corrigé le 18/10, confirmé le 19/10 (voir Projet_Claude/03-Feuille-de-route.md,
    //    addendum du 19/10) : plus de reconstruction à partir d'un revenu déclaré
    //    (`generalInfo.totalRevenue`, réel) — ce serait mélanger les deux jeux de données que la
    //    Réconciliation réel/théorique doit justement garder indépendants pour rester significative
    //    (son théorique se retrouverait partiellement composé du réel auquel il est comparé).
    //    Repli sur le volume RÉEL déjà agrégé par `blendAcrossChannels` (p.blended.totalVolume,
    //    somme de `channelBreakdown[].volume`) — même donnée que la matrice BCG et le classement
    //    par contribution utilisent déjà plus bas. Un format sans aucun volume réel saisi contribue
    //    0, jamais une estimation.
    const unitsSoldById = {};
    for (const p of activeProducts) {
        unitsSoldById[p.id] = p.blended.totalVolume || 0;
    }
    // « Revenu théorique » du menu (Phase 4.4, réconciliation réel/théorique) : somme réelle
    // prix net × volume de chaque canal de chaque format — plus une reconstruction depuis un
    // revenu déclaré, mais le pendant exact du revenu RÉEL que ces mêmes prix/volumes impliquent.
    const menuRevenue = activeProducts.reduce(
        (sum, p) => sum + (p.channelBreakdown || []).reduce((s, cb) => s + parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume), 0),
        0
    );

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
        // Plus de multiplicateur "part menu" (menuRevenuePercentage, retiré le 18/10) :
        // `totalIndirects` est déjà le pool correctement scopé par les Frais fixes (Phase 4.6).
        const indirectsMenu = parseLocaleNumber(generalInfo.totalIndirects);
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
        productivityReport: calculatedGeneralInfo.productivityReport,
        // Phase 4.4 — volumes/revenu théoriques du modèle de recettes (reconstruits à l'étape 3
        // ci-dessus), exposés pour la réconciliation réel/théorique de l'État des résultats plutôt
        // que redérivés une seconde fois ailleurs.
        menuRevenue, unitsSoldById,
    };
}
