// Bassins de frais indirects : répartition des frais fixes et des charges directes réelles par activité, canal ou clé personnalisée. Extrait de analysisData.js le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { parseLocaleNumber, CONVERSION_FACTORS, round2, sumLineAmounts, sumAmountsMap } from '../utils.js';
import { isActiveRow } from './analysisShared.js';

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

// Valeur du driver choisi pour UN format précis — fonction pure PARTAGÉE entre
// `computeIndirectCostDriverTotals` (agrégation du total d'un pool) et le merge de
// `computeAnalysisData` (part de CE format) : les deux DOIVENT impérativement utiliser la même
// formule, sans quoi la somme des parts individuelles ne reconstituerait plus exactement le pool
// (voir l'historique de bogues de ce fichier — Général à 0,75 $ uniforme pour tout le menu, 21/10 —
// causé précisément par deux calculs du même nombre qui avaient divergé).
// « volume » (22/10, retour utilisateur, inspiré du CICI du même nom dans l'Agro-Calculateur du
// MAPAQ — voir Projet_Claude/03-Feuille-de-route.md) : le volume/poids physique total VENDU de ce
// format (`portionSize` converti vers l'unité de base choisie pour CE pool, × `portionsSold`) —
// pertinent quand le frais indirect suit l'encombrement physique (entreposage réfrigéré, capacité
// d'entrepôt) plutôt que la valeur des intrants ou le temps de main-d'œuvre. Contrairement à
// `directCost`/`laborTime`, peut renvoyer `null` (jamais 0) : un format dont l'unité n'appartient
// pas à la MÊME FAMILLE physique que celle choisie pour ce pool (masse 'g' vs volume 'ml' — ex. un
// format vendu « à l'unité », ou en mL alors que le pool est en masse) reste simplement ABSENT de
// ce driver, pour ce pool — convertir du kg en mL sans densité serait une donnée inventée, jamais
// un vrai 0.
export function computeIndirectDriverValue(driver, { portionUnit, portionSize, portionsSold, productionTimeSeconds, nbPortions, totalDirectCostPerPortion }, volumeUnit) {
    if (driver === 'laborTime') {
        return (parseLocaleNumber(productionTimeSeconds) / 3600) * (portionsSold / (parseLocaleNumber(nbPortions) || 1));
    }
    if (driver === 'volume') {
        const factorInfo = CONVERSION_FACTORS[portionUnit];
        if (!factorInfo || factorInfo.base !== volumeUnit) return null;
        return (parseLocaleNumber(portionSize) || 0) * factorInfo.factor * portionsSold;
    }
    return parseLocaleNumber(totalDirectCostPerPortion) * portionsSold;
}

// Phase 4.6 — Totaux agrégés des trois drivers possibles (coût direct, temps de main-d'œuvre,
// volume physique) pour les pools Activité, et des trois drivers possibles (ventes, coût direct,
// temps de MO) pour les pools Canal — calculés sur TOUS les formats actifs, au prorata du volume
// VENDU (reconstruit menu entier pour Activité via `costs.portionsSold` ; volume RÉEL par canal via
// `format.channelPrices` pour Canal, plus précis). Les TROIS drivers sont toujours calculés, pas
// seulement celui choisi pour cette activité/ce canal — chacun peut choisir indépendamment sans
// recalcul global. Un produit dont l'activité a été supprimée depuis, ou un canal sans aucun volume
// réel saisi nulle part, reste simplement absent (jamais une part forcée à 0) — voir
// 04-Conception-Modele.md, section Phase 4.6.
// Canal (corrigé le 14/10, suite à un retour utilisateur) : AUCUN driver au choix — contrairement à
// Activité. Vérification formule par formule de l'Agro-Calculateur (feuille `Synthèse`, matrice
// « Coût de revient complet ») : `E27 = D27 + (D27 × (Pool_circuit / SOMMEPROD(coût_production ×
// volume, TOUS les SKU)))` — un SEUL mécanisme universel, jamais un choix par circuit. Le CICI ne
// se choisit qu'À L'ACTIVITÉ (une fois) ; le canal applique ensuite une MAJORATION % sur le coût de
// production déjà établi (peu importe quel CICI l'a produit), jamais un driver indépendant. C'est la
// méthode traditionnelle « majoration sur coût de production » (percentage of production cost),
// qui hérite automatiquement de la fidélité déjà obtenue au niveau de l'activité — voir
// 04-Conception-Modele.md, section Phase 4.6, pour la validation complète.
export function computeIndirectCostDriverTotals(productsWithCosts, productionActivities = [], salesChannels = [], generalInfo = {}) {
    const activityDriverTotals = {};
    productionActivities.forEach((a) => { activityDriverTotals[a.id] = { directCost: 0, laborTime: 0, volume: 0 }; });
    // Famille physique (masse 'g' / volume 'ml') choisie PAR ACTIVITÉ pour son propre driver
    // « volume » — indépendante de celle de Général et de celle des autres activités (chacune peut
    // choisir sa propre famille, exactement comme chacune choisit déjà son propre driver).
    const activityVolumeUnitById = Object.fromEntries(productionActivities.map((a) => [a.id, a.indirectCostVolumeUnit]));

    // Général (20/10, retour utilisateur) : même mécanisme que ci-dessus, mais à l'échelle du menu
    // ENTIER plutôt que par activité — tout produit vendu y contribue, peu importe son activité
    // (contrairement à `activityDriverTotals`, scopé par `activityId`). Remplace l'ancien calcul
    // interne à calculateCosts.js (« au prorata des ventes » ou « temps de MO » appliqué
    // directement sur le pool déjà réduit) : « au prorata des ventes » s'y réduisait
    // mathématiquement toujours à un partage égal à l'unité dès que le mix des ventes reflète
    // fidèlement les volumes réels (ce qui est précisément son rôle) — voir
    // Projet_Claude/03-Feuille-de-route.md, 21/10, pour la démonstration complète.
    const generalDriverTotals = { directCost: 0, laborTime: 0, volume: 0 };
    const generalVolumeUnit = generalInfo?.indirectCostVolumeUnit;

    // Un seul total par canal (pas un par driver) : le dénominateur de la majoration, toujours la
    // valeur totale (au coût de production) de ce qui transite par ce canal.
    const channelDriverTotals = {};
    salesChannels.forEach((c) => { channelDriverTotals[c.id] = 0; });

    for (const row of (productsWithCosts || [])) {
        const costs = row.costs;
        if (!costs || !isActiveRow(row)) continue;
        const driverCtx = {
            portionUnit: row.portionUnit, portionSize: costs.portionSize, portionsSold: parseLocaleNumber(costs.portionsSold),
            productionTimeSeconds: costs.productionTimeSeconds, nbPortions: costs.nbPortions, totalDirectCostPerPortion: costs.totalDirectCostPerPortion,
        };
        const portionsSold = driverCtx.portionsSold;

        if (portionsSold > 0) {
            generalDriverTotals.directCost += computeIndirectDriverValue('directCost', driverCtx);
            generalDriverTotals.laborTime += computeIndirectDriverValue('laborTime', driverCtx);
            const generalVolumeValue = computeIndirectDriverValue('volume', driverCtx, generalVolumeUnit);
            if (generalVolumeValue !== null) generalDriverTotals.volume += generalVolumeValue;
        }

        if (row.activityId && activityDriverTotals[row.activityId] && portionsSold > 0) {
            activityDriverTotals[row.activityId].directCost += computeIndirectDriverValue('directCost', driverCtx);
            activityDriverTotals[row.activityId].laborTime += computeIndirectDriverValue('laborTime', driverCtx);
            const activityVolumeValue = computeIndirectDriverValue('volume', driverCtx, activityVolumeUnitById[row.activityId]);
            if (activityVolumeValue !== null) activityDriverTotals[row.activityId].volume += activityVolumeValue;
        }

        (row.format?.channelPrices || []).forEach((cp) => {
            const volume = parseLocaleNumber(cp.volume);
            if (!(cp.channelId in channelDriverTotals) || !(volume > 0)) return;
            channelDriverTotals[cp.channelId] += parseLocaleNumber(costs.totalDirectCostPerPortion) * volume;
        });
    }

    return { activityDriverTotals, generalDriverTotals, channelDriverTotals };
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
        if (!row.activityId || !isActiveRow(row)) continue;
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

// Phase 4.3bis (13/10) — Charges directes réelles : mappe chaque catégorie de `directCostLines`
// (voir utils.js, DIRECT_COST_TYPES) vers le champ de coût théorique par portion correspondant
// dans `costs` (calculateCosts.js) — driver « apparié par type » (voir Projet_Claude/
// 04-Conception-Modele.md, section 1bis) : on ne répartit jamais un $ réel d'un type avec la clé
// théorique d'un AUTRE type (ex. de l'emballage réel avec une clé de main-d'œuvre théorique serait
// arbitraire).
const DIRECT_COST_TYPE_FIELDS = {
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
        if (!row.activityId || !isActiveRow(row)) continue;
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

// Pools de frais fixes (Général / chaque activité / chaque canal) et leurs drivers, à partir d'un calcul
// « brouillon » (sans pools) des formats. Extrait d'App.jsx le 19/11 pour que le simulateur de chocs
// reconstruise EXACTEMENT les mêmes pools sur ses coûts simulés (avant, il calculait sans pools : ses marges
// nettes n'étaient pas comparables à celles du reste de l'app).
// Frais fixes non répartis : ce qu'une ligne de frais fixes n'a pas attribué à un contenant ne doit jamais
// disparaître des marges — la part manquante est comptée dans Général (coût de soutien de l'entreprise) et
// signalée dans `meta`. Un dépassement (réparti > montant) est gardé tel quel et signalé.
export function computeIndirectPools(draftProductsWithCosts, { expenseLines, repartitionKeys, revenueLines, directCostLines, productionActivities = [], salesChannels = [], generalInfo = {} }) {
    const activityBuckets = buildActivityBuckets(productionActivities);
    const totalRevenue = (revenueLines || []).reduce((sum, line) => sum + sumAmountsMap(line.amounts), 0);
    const totalDirectCosts = sumLineAmounts(directCostLines || []);
    const bucketTotals = computeBucketTotalsFromAmounts(revenueLines, activityBuckets);
    const { directCostBucketTotals } = computeDirectCostLineAllocations(directCostLines, draftProductsWithCosts, activityBuckets, salesChannels);
    const effectiveAllocations = computeExpenseLineEffectiveAllocations({
        expenseLines, repartitionKeys, activityBuckets, salesChannels, totalRevenue, totalDirectCosts, bucketTotals, directCostBucketTotals,
    });
    const { activityPoolTotals, channelPoolTotals } = computeExpensePoolTotals(expenseLines, effectiveAllocations, activityBuckets, salesChannels);
    const { activityDriverTotals, generalDriverTotals, channelDriverTotals } = computeIndirectCostDriverTotals(draftProductsWithCosts, productionActivities, salesChannels, generalInfo);

    const total = sumLineAmounts(expenseLines || []);
    const allocated = Object.values(activityPoolTotals).reduce((s, v) => s + v, 0) + Object.values(channelPoolTotals).reduce((s, v) => s + v, 0);
    const gap = round2(total - allocated);
    // Seuil de 5 ¢ : les montants répartis sont arrondis au cent ligne par ligne (round2) ; un résidu d'arrondi
    // de 1 ou 2 ¢ ne doit pas déclencher un faux avertissement.
    const unallocated = gap > 0.05 ? gap : 0;
    const overAllocated = gap < -0.05 ? -gap : 0;

    const generalDriver = generalInfo.indirectCostMethod || 'directCost';
    return {
        generalPool: { amount: (activityPoolTotals.general || 0) + unallocated, driver: generalDriver, driverTotal: generalDriverTotals[generalDriver] || 0, volumeUnit: generalInfo.indirectCostVolumeUnit },
        activityPools: Object.fromEntries(productionActivities.map((a) => {
            const driver = a.indirectCostDriver || 'directCost';
            return [a.id, { amount: activityPoolTotals[a.id] || 0, driver, driverTotal: activityDriverTotals[a.id]?.[driver] || 0, volumeUnit: a.indirectCostVolumeUnit }];
        })),
        // Canal : aucun driver au choix — majoration sur le coût de production (voir computeIndirectCostDriverTotals).
        channelPools: Object.fromEntries(salesChannels.map((c) => (
            [c.id, { amount: channelPoolTotals[c.id] || 0, driverTotal: channelDriverTotals[c.id] || 0 }]
        ))),
        meta: { total, allocated, unallocated, overAllocated },
        // Répartition effective de chaque ligne de frais fixes ({ [ligneId]: { activityAllocations, channelAllocations } }), telle qu'utilisée ci-dessus :
        // lue par l'export Excel (feuille Frais_répartition) pour ne jamais la recalculer.
        effectiveAllocations,
    };
}
