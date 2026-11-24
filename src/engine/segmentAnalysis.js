// Résumés par activité et par canal, matrice activité × canal, impacts, profit brut et net, réconciliation réel / théorique. Extrait de analysisData.js le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { parseLocaleNumber } from '../utils.js';
import { isActiveRow } from './analysisShared.js';

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
    // Poids d'un format : son REVENU réel (prix net × volume de chaque canal) — des pourcentages se
    // moyennent en dollars, pas en unités. Repli sur la part du mix des ventes quand aucun revenu réel
    // n'existe pour toute l'activité (projet neuf).
    const revenueOfRow = (p) => (p.channelBreakdown || []).reduce((s, cb) => s + parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume), 0);
    for (const [activityId, rows] of Object.entries(byActivity)) {
        const totalMix = rows.reduce((s, p) => s + parseLocaleNumber(p.salesMix), 0);
        const totalRev = rows.reduce((s, p) => s + revenueOfRow(p), 0);
        if (!(totalMix > 0) && !(totalRev > 0)) continue;
        let margeBrutePercent = 0, costMatierePercent = 0, costLaborPercent = 0;
        for (const p of rows) {
            const weight = totalRev > 0 ? revenueOfRow(p) / totalRev : parseLocaleNumber(p.salesMix) / totalMix;
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
        // Pondéré par le revenu du canal (prix net × volume) : voir blendAcrossChannels.
        const revOf = (cb) => parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume);
        const totalRev = rows.reduce((s, cb) => s + revOf(cb), 0);
        let margeBrutePercent = 0, costMatierePercent = 0, costLaborPercent = 0;
        for (const cb of rows) {
            const weight = totalRev > 0 ? revOf(cb) / totalRev : parseLocaleNumber(cb.volume) / totalVolume;
            margeBrutePercent += cb.margeBrutePercent * weight;
            costMatierePercent += cb.costMatierePercent * weight;
            costLaborPercent += cb.costLaborPercent * weight;
        }
        const label = salesChannels.find(c => c.id === channelId)?.name || channelId;
        result.push({ channelId, label, margeBrutePercent, costMatierePercent, costLaborPercent });
    }
    return result;
}

// Rapport Par Activité / Par Canal (24/10, retour utilisateur) — agrégation de plusieurs SKU×canal
// en un seul segment, par SOMME des $ déjà calculés (jamais une moyenne de pourcentages, voir
// commentaire plus bas) : revenu, chaque poste de coût direct, et chaque pool indirect (Général/
// Activité/Canal), tous multipliés par le volume RÉEL de cette ligne puis sommés sur le segment. Un
// SKU sans volume réel sur ce canal n'y contribue simplement pas (jamais un 0 inventé).
//
// Pourquoi sommer les $ plutôt que moyenner les % : un simple % moyen (même pondéré par le volume)
// peut diverger du vrai % consolidé dès que les prix varient entre SKU — paradoxe de Simpson déjà
// rencontré et corrigé le 20/10 pour les KPI du menu entier (voir plus bas, `globalBreakEven` :
// pondéré par le $ de revenu réel, pas par le mix des ventes en unités). La seule façon
// mathématiquement correcte d'obtenir « la marge nette % de ce segment » est de diviser la SOMME
// des $ de marge par la SOMME des $ de revenu — jamais l'inverse (moyenner d'abord, sommer après).
//
// Point mort du segment, en $ DE REVENU plutôt qu'en unités : un segment agrège des SKU
// hétérogènes (prix, formats, unités de vente différents) — « X unités » n'aurait pas de sens
// (unités de QUOI ?). La méthode standard en comptabilité de gestion pour un point mort multi-
// produits est le ratio de marge de contribution pondéré en $ : Point mort ($) = Frais fixes
// totaux du segment ÷ (marge de contribution totale du segment ÷ revenu total du segment) — même
// méthode que `globalBreakEven` ci-dessous, à l'échelle du segment plutôt que du menu entier. La
// main-d'œuvre y est traitée comme un coût FIXE (révision du 20/10, voir computeChannelBreakdown) :
// ajoutée aux frais fixes au numérateur, exclue de la marge de contribution au dénominateur.
function aggregateSegmentRows(rows) {
    let revenueTotal = 0, volumeTotal = 0;
    let costMatiereTotal = 0, costPackagingTotal = 0, costLaborTotal = 0, costSubcontractingTotal = 0, costAgingTotal = 0;
    let costIndirectGeneralTotal = 0, costIndirectActivityTotal = 0, costIndirectChannelTotal = 0;

    for (const { costs, cb } of rows) {
        const volume = parseLocaleNumber(cb.volume);
        if (!(volume > 0)) continue;
        revenueTotal += parseLocaleNumber(cb.netPrice) * volume;
        volumeTotal += volume;
        costMatiereTotal += parseLocaleNumber(costs.costMatierePerPortion) * volume;
        costPackagingTotal += parseLocaleNumber(costs.costPackagingPerPortion) * volume;
        costLaborTotal += parseLocaleNumber(costs.costLaborPerPortion) * volume;
        costSubcontractingTotal += parseLocaleNumber(costs.costSubcontractingPerPortion) * volume;
        costAgingTotal += parseLocaleNumber(costs.costAgingPerPortion) * volume;
        costIndirectGeneralTotal += parseLocaleNumber(costs.costIndirectGeneralPerPortion) * volume;
        costIndirectActivityTotal += parseLocaleNumber(costs.costIndirectActivityPerPortion) * volume;
        costIndirectChannelTotal += parseLocaleNumber(cb.costIndirectChannelPerPortion) * volume;
    }

    if (revenueTotal <= 0) return null; // Rien à ce segment — absent, jamais un tableau à 0.

    const totalDirectCostTotal = costMatiereTotal + costPackagingTotal + costLaborTotal + costSubcontractingTotal;
    const margeBruteTotal = revenueTotal - totalDirectCostTotal;
    const totalIndirectTotal = costIndirectGeneralTotal + costIndirectActivityTotal + costIndirectChannelTotal;
    const margeNetteTotal = margeBruteTotal - totalIndirectTotal - costAgingTotal;

    // Point mort (voir commentaire de fonction) : marge de contribution SANS la main-d'œuvre, qui
    // rejoint les frais fixes au numérateur. Le vieillissement, proportionnel au volume, en est retiré (21/11).
    const contributionTotal = margeBruteTotal + costLaborTotal - costAgingTotal;
    const contributionRatio = contributionTotal / revenueTotal;
    const fixedCostForBreakEven = totalIndirectTotal + costLaborTotal;
    const breakEvenRevenue = contributionRatio > 0 ? fixedCostForBreakEven / contributionRatio : null;

    return {
        revenueTotal, volumeTotal,
        costMatiereTotal, costPackagingTotal, costLaborTotal, costSubcontractingTotal, costAgingTotal,
        totalDirectCostTotal,
        margeBruteTotal, margeBrutePercent: margeBruteTotal / revenueTotal,
        costIndirectGeneralTotal, costIndirectActivityTotal, costIndirectChannelTotal, totalIndirectTotal,
        margeNetteTotal, margeNettePercent: margeNetteTotal / revenueTotal,
        breakEvenRevenue,
    };
}

// Rapport Par Activité (révisé le 02/11, retour utilisateur) : UNE ligne par activité, réduite à
// son propre TOTAL agrégé — tous canaux confondus, jamais ventilée par canal. Version précédente
// (24/10) : une activité choisie, ventilée par canal en colonnes — retour utilisateur immédiat,
// « on dirait une simple répétition de deux rapports identiques » (« Par Activité » transposé de
// « Par Canal »), alors que le vrai intérêt était LE TOTAL de chaque ligne, pas sa répartition par
// canal/activité. Voir Projet_Claude/03-Feuille-de-route.md pour la discussion complète. Une
// activité sans aucun volume réel vendu en est simplement absente (jamais une ligne à 0).
export function computeActivitySummaries(productsWithCosts, productionActivities = []) {
    const byActivity = {};
    for (const row of (productsWithCosts || [])) {
        if (!row.activityId || !isActiveRow(row)) continue;
        for (const cb of (row.channelBreakdown || [])) {
            (byActivity[row.activityId] || (byActivity[row.activityId] = [])).push({ costs: row.costs, cb });
        }
    }
    const result = [];
    for (const activity of productionActivities) {
        const rows = byActivity[activity.id];
        if (!rows) continue;
        const aggregate = aggregateSegmentRows(rows);
        if (!aggregate) continue;
        result.push({ activityId: activity.id, activityName: activity.name || activity.id, ...aggregate });
    }
    return result;
}

// Rapport Par Canal : la transposée exacte du rapport ci-dessus (même fonction d'agrégation) — une
// ligne par canal, réduite à son propre total, toutes activités confondues. Un SKU sans activité
// assignée en est exclu (donnée absente — cas qui ne devrait de toute façon jamais se produire,
// une activité étant obligatoire à la création d'un produit).
export function computeChannelSummaries(productsWithCosts, salesChannels = []) {
    const byChannel = {};
    for (const row of (productsWithCosts || [])) {
        if (!isActiveRow(row)) continue;
        for (const cb of (row.channelBreakdown || [])) {
            (byChannel[cb.channelId] || (byChannel[cb.channelId] = [])).push({ costs: row.costs, cb });
        }
    }
    const result = [];
    for (const channel of salesChannels) {
        const rows = byChannel[channel.id];
        if (!rows) continue;
        const aggregate = aggregateSegmentRows(rows);
        if (!aggregate) continue;
        result.push({ channelId: channel.id, channelName: channel.name || channel.id, ...aggregate });
    }
    return result;
}

// Matrice Activité × Canal (02/11, retour utilisateur) : le bénéfice net $ (« Bénéfices/Pertes »)
// de chaque activité, pour chacun de ses canaux de vente — même principe que la matrice SKU ×
// Canal déjà dans Vue d'ensemble (computeAnalysisData, `productsWithCosts[].channelBreakdown`), à
// l'échelle de l'activité plutôt que du SKU. Réutilise `aggregateSegmentRows` (même agrégation $
// sommés puis divisés que Par Activité/Par Canal, jamais une moyenne de % individuels) — une
// combinaison (activité, canal) sans aucun volume réel en est simplement absente de la matrice
// (jamais une cellule à 0 $). Métrique en $ plutôt qu'en % (révision du 02/11, retour utilisateur) :
// une ligne/colonne Total n'a de sens que pour un $ (sommable) — une moyenne ou une somme de %
// individuels divergerait du vrai % consolidé (paradoxe de Simpson, même principe que partout
// ailleurs dans ce fichier). `margeNettePercent` reste renvoyé à côté, pour la palette de couleur
// (l'intensité d'une cellule doit rester relative à SA propre échelle de revenu, pas au $ brut).
// Renvoie `{ [activityId]: { [channelId]: { margeNetteTotal, margeNettePercent } } }` ; une
// activité ou un canal sans aucune donnée obtient un objet vide, pas une entrée manquante —
// l'appelant peut itérer sur TOUTES les activités/canaux (même ceux sans vente), comme le fait déjà
// la matrice SKU × Canal pour un SKU sans aucun canal renseigné.
export function computeActivityChannelMarginMatrix(productsWithCosts, productionActivities = [], salesChannels = []) {
    const cellRows = {};
    for (const row of (productsWithCosts || [])) {
        if (!row.activityId || !isActiveRow(row)) continue;
        for (const cb of (row.channelBreakdown || [])) {
            const key = `${row.activityId}::${cb.channelId}`;
            (cellRows[key] || (cellRows[key] = [])).push({ costs: row.costs, cb });
        }
    }
    const matrix = {};
    for (const activity of productionActivities) {
        matrix[activity.id] = {};
        for (const channel of salesChannels) {
            const rows = cellRows[`${activity.id}::${channel.id}`];
            if (!rows) continue;
            const aggregate = aggregateSegmentRows(rows);
            if (!aggregate) continue;
            matrix[activity.id][channel.id] = { margeNetteTotal: aggregate.margeNetteTotal, margeNettePercent: aggregate.margeNettePercent };
        }
    }
    return matrix;
}

// Phase 4.4bis (20/10, retour utilisateur) : Bénéfice brut (affiché sous Charges directes réelles,
// avant Frais fixes) et Bénéfice net (affiché sous Frais fixes, avant la Réconciliation), tous deux
// ventilés par activité ET par canal — comme les 3 tableaux ci-dessus, pas un seul total
// entreprise comme l'ancienne ligne « Marge » de la Réconciliation (qui garde son propre total,
// voir computeRealVsTheoreticalReconciliation ci-dessous : les deux affichages coexistent, à deux
// niveaux de détail différents).
// Bénéfice brut = Revenus moins Charges directes, par contenant (Général/Activité, déjà des
// totaux réels) et par canal — indicatif des deux côtés, comme les tableaux Revenus/Charges
// directes eux-mêmes. Visible SEULEMENT si revenus ET charges directes ont, l'un et l'autre, une
// part connue (`hasShare`) pour ce canal ; sinon `null` — jamais une soustraction avec un côté
// forcé à 0, qui sous-estimerait silencieusement les charges de ce canal.
export function computeGrossProfitTotals({ activityBuckets, salesChannels, bucketTotals, directCostBucketTotals, channelTotals, directCostChannelTotals }) {
    const bucketValues = {};
    (activityBuckets || []).forEach((b) => {
        bucketValues[b.key] = (bucketTotals?.[b.key] || 0) - (directCostBucketTotals?.[b.key] || 0);
    });

    const channelValues = {};
    (salesChannels || []).forEach((c) => {
        const rev = channelTotals?.[c.id];
        const dc = directCostChannelTotals?.[c.id];
        channelValues[c.id] = (rev?.hasShare && dc?.hasShare) ? (rev.total - dc.total) : null;
    });

    return { bucketValues, channelValues };
}

// Bénéfice net = Bénéfice brut moins Frais fixes, par contenant ET par canal. Les deux côtés des
// Frais fixes (Phase 4.5) sont des allocations RÉELLES (saisies manuellement ou par clé), jamais
// une part indicative — un contenant/canal sans frais fixes qui lui soit alloué vaut simplement 0,
// une vraie valeur, pas une donnée manquante. Un canal dont le Bénéfice brut est `null` ci-dessus
// reste `null` ici aussi : on ne bâtit jamais une valeur sur une base absente.
export function computeNetProfitTotals({ activityBuckets, salesChannels, grossProfitBucketValues, grossProfitChannelValues, expenseBucketTotals, expenseChannelTotals }) {
    const bucketValues = {};
    (activityBuckets || []).forEach((b) => {
        bucketValues[b.key] = (grossProfitBucketValues?.[b.key] || 0) - (expenseBucketTotals?.[b.key] || 0);
    });

    const channelValues = {};
    (salesChannels || []).forEach((c) => {
        const gp = grossProfitChannelValues?.[c.id];
        channelValues[c.id] = gp != null ? gp - (expenseChannelTotals?.[c.id] || 0) : null;
    });

    return { bucketValues, channelValues };
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
// Coût de vieillissement théorique (02/11, retour utilisateur) : manquait entièrement de ce
// tableau depuis sa création (20/10), alors qu'il est bien soustrait côté réel indirectement —
// `aggregateSegmentRows` (Par Activité/Canal/SKU) le déduit dans `margeNetteTotal`, séparément des
// charges directes et des frais fixes (`calculateCosts.js` : `totalCostPerPortion =
// totalDirectCostPerPortion + costIndirectPerPortion + costAgingPerPortion`, 3 postes distincts).
// Sans ce correctif, le Bénéfice net théorique SURESTIME le profit de tout produit avec
// vieillissement activé (constaté : écart de 83,54 $ dans le projet démo, exactement le coût de
// vieillissement total). Vieillissement n'est PAS un type de charge directe RÉELLE saisissable
// (`DIRECT_COST_TYPES`, utils.js, n'en a pas) : rien à soustraire côté réel pour rester symétrique
// — seul le théorique gagne ce nouveau poste, soustrait au même niveau que dans
// `aggregateSegmentRows` (après le Bénéfice brut, pas dans les Charges directes/Bénéfice brut).
export function computeRealVsTheoreticalReconciliation({
    totalRevenue, totalDirectCosts, activeProducts, unitsSoldById, menuRevenue, totalIndirects,
}) {
    const theoreticalDirectCosts = (activeProducts || []).reduce(
        (sum, p) => sum + (unitsSoldById?.[p.id] || 0) * parseLocaleNumber(p.costs?.totalDirectCostPerPortion),
        0
    );
    const theoreticalAgingCosts = (activeProducts || []).reduce(
        (sum, p) => sum + (unitsSoldById?.[p.id] || 0) * parseLocaleNumber(p.costs?.costAgingPerPortion),
        0
    );

    const makeRow = (label, real, theoretical) => ({
        label,
        real,
        theoretical,
        diff: real - theoretical,
        // Écart en % relatif au théorique (base de comparaison, comme un budget) — absent (pas 0 %)
        // quand aucun théorique n'existe, pour ne jamais laisser croire à une précision inexistante.
        // Dénominateur en valeur absolue : un théorique négatif (perte) ne doit pas inverser le signe de l'écart
        // (réel 4 000 $ contre théorique −423 $ = +4 423 $, soit +1 045 %, pas −1 045 %).
        diffPercent: theoretical !== 0 ? (real - theoretical) / Math.abs(theoretical) : null,
    });

    const grossProfitReal = totalRevenue - totalDirectCosts;
    const grossProfitTheoretical = menuRevenue - theoreticalDirectCosts;
    const indirects = parseLocaleNumber(totalIndirects);

    const rows = [
        makeRow('Revenus', totalRevenue, menuRevenue),
        makeRow('Charges directes', totalDirectCosts, theoreticalDirectCosts),
        makeRow('Bénéfice brut', grossProfitReal, grossProfitTheoretical),
        makeRow('Bénéfice net', grossProfitReal - indirects, grossProfitTheoretical - indirects - theoreticalAgingCosts),
    ];

    return { rows };
}
