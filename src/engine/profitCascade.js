// Cascade « du revenu au bénéfice net » et « sur chaque dollar de vente » (phase 2 de la refonte de l'export PDF, 22/11).
// AUCUN calcul de donnée : on met en série les totaux que computeChannelSummaries (analysisData.js) calcule déjà pour le rapport Par canal, en les
// additionnant sur les canaux. Les identités (revenu − charges directes = bénéfice brut ; bénéfice brut − frais fixes − vieillissement = bénéfice net)
// sont celles de aggregateSegmentRows : un test les vérifie.
// Une donnée absente reste absente : sans canal avec ventes, la fonction renvoie null.

const total = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

/**
 * @param {object[]} channelSummaries  résultat de computeChannelSummaries
 * @returns {null | { revenue, material, packaging, labor, subcontracting, gross, fixed, aging, net, steps, perDollar }}
 */
export function computeProfitCascade(channelSummaries) {
    const rows = channelSummaries || [];
    const revenue = total(rows, 'revenueTotal');
    if (!rows.length || !(revenue > 0)) return null;
    const material = total(rows, 'costMatiereTotal'), packaging = total(rows, 'costPackagingTotal'), labor = total(rows, 'costLaborTotal');
    const subcontracting = total(rows, 'costSubcontractingTotal'), aging = total(rows, 'costAgingTotal');
    const gross = total(rows, 'margeBruteTotal'), fixed = total(rows, 'totalIndirectTotal'), net = total(rows, 'margeNetteTotal');
    // Cascade : les totaux (ventes, bénéfice brut, bénéfice net) et les retraits qui les séparent.
    const steps = [
        { key: 'revenue', label: 'Ventes prévues', value: revenue, total: true },
        { key: 'material', label: 'Matières', value: material },
        { key: 'packaging', label: 'Emballage', value: packaging },
        { key: 'labor', label: 'Main-d\'œuvre', value: labor },
        { key: 'subcontracting', label: 'Sous-traitance', value: subcontracting },
        { key: 'gross', label: 'Bénéfice brut', value: gross, total: true },
        { key: 'fixed', label: 'Frais fixes', value: fixed },
        { key: 'aging', label: 'Vieillissement', value: aging },
        { key: 'net', label: 'Bénéfice net', value: net, total: true },
    ].filter(s => s.total || s.value !== 0); // un retrait nul (pas de sous-traitance, pas de vieillissement) n'est pas une étape
    // Sur chaque dollar de vente : la part de chaque poste dans les ventes (les frais fixes incluent le vieillissement, comme dans le rapport).
    const share = (v) => v / revenue;
    const perDollar = [
        { key: 'material', label: 'Matières', value: material },
        { key: 'packaging', label: 'Emballage', value: packaging },
        { key: 'labor', label: 'Main-d\'œuvre', value: labor },
        { key: 'subcontracting', label: 'Sous-traitance', value: subcontracting },
        { key: 'fixed', label: 'Frais fixes', value: fixed + aging },
        { key: 'net', label: 'Bénéfice net', value: net },
    ].filter(s => s.value !== 0).map(s => ({ ...s, share: share(s.value) }));
    return { revenue, material, packaging, labor, subcontracting, gross, fixed, aging, net, steps, perDollar };
}
