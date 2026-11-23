// Cascade de marge d'un SKU (un format), canal par canal : du PDS jusqu'à la marge nette et au point mort.
// Fonction pure, extraite de l'écran Par SKU (BySkuWaterfall, SummaryTable.jsx) le 22/11 (phase 1 de la refonte de
// l'export PDF, voir Projet_Claude/12-Plan-Export-PDF.md) : l'écran et le rapport PDF lisent ainsi les MÊMES chiffres.
// Aucun calcul nouveau : mêmes formules que l'écran, mêmes règles de données absentes (null, jamais 0 inventé).
import { parseLocaleNumber } from '../utils.js';
import { computeSalesChannelCascade } from './salesChannelCascade.js';

// Clé de dédoublonnage d'un maillon : son nom (si renseigné, pour fusionner un même maillon nommé réutilisé par plusieurs
// canaux), sinon channelId + index, pour qu'un maillon sans nom ne fusionne jamais avec celui d'un autre canal.
const linkRowKey = (channelId, link, index) => (link.name || '').trim() || `${channelId}:${index}`;

/**
 * @param {object} row              ligne de analysisData (productsWithCosts / activeProducts) : `format`, `costs`, `channelBreakdown`
 * @param {Array}  salesChannels    canaux de vente du projet (avec leurs maillons `links`)
 * @returns {{
 *   pds: number,
 *   linkRows: Array<{key: string, label: string}>,        un maillon par ligne, du plus proche du PDS au plus proche du prix net
 *   channels: Array<{channelId: string, channelName: string, ...}>   dans l'ordre de `channelBreakdown`
 * }}
 */
export function computeSkuCascade(row, salesChannels = []) {
    const costs = row.costs || {};
    const breakdown = row.channelBreakdown || [];
    const pds = parseLocaleNumber(row.format?.pds);
    const linksOf = (channelId) => salesChannels.find(c => c.id === channelId)?.links || [];

    const linkRows = [];
    const seen = new Set();
    breakdown.forEach(cb => {
        const links = linksOf(cb.channelId);
        for (let i = links.length - 1; i >= 0; i--) {
            const key = linkRowKey(cb.channelId, links[i], i);
            if (seen.has(key)) continue;
            seen.add(key);
            linkRows.push({ key, label: (links[i].name || '').trim() || `Maillon ${i + 1}` });
        }
    });

    const aging = costs.costAgingPerPortion || 0;
    const channels = breakdown.map(cb => {
        const links = linksOf(cb.channelId);
        // Écart $ de chaque maillon : la part de l'écart PDS / prix net qui lui revient. Absent (null) si le PDS n'est pas saisi.
        const prices = pds > 0 && links.length > 0 ? computeSalesChannelCascade({ links, anchorIndex: links.length, anchorValue: pds }) : null;
        const deltas = {};
        links.forEach((l, i) => {
            const before = prices ? prices[i] : null;
            const after = prices ? prices[i + 1] : null;
            const key = linkRowKey(cb.channelId, l, i);
            if (!(key in deltas)) deltas[key] = (before != null && after != null) ? after - before : null; // premier maillon de ce nom, comme l'écran
        });
        // Total des maillons : PDS moins le prix net de la cascade complète. Un canal sans maillon donne bien 0 $ (une vraie valeur),
        // jamais confondu avec un PDS absent (null).
        let totalDelta = null;
        if (pds > 0) totalDelta = links.length === 0 ? 0 : (prices && prices[0] != null && prices[links.length] != null ? prices[links.length] - prices[0] : null);
        const hasVolume = cb.volume > 0;
        const netCost = cb.netPrice - cb.margeNetteDollar;
        return {
            channelId: cb.channelId, channelName: cb.channelName,
            deltas, totalDelta,
            netPrice: cb.netPrice,
            grossProfit: cb.margeBruteDollar, grossMarginPercent: cb.margeBrutePercent,
            fixedGeneral: costs.costIndirectGeneralPerPortion || 0,
            fixedActivity: costs.costIndirectActivityPerPortion || 0,
            fixedChannel: cb.costIndirectChannelPerPortion || 0,
            fixedTotal: cb.margeBruteDollar - cb.margeNetteDollar - aging,
            aging,
            netCost,
            netProfit: cb.margeNetteDollar, netMarginPercent: cb.margeNettePercent,
            // Seuil de rentabilité : null sans volume réel saisi pour ce canal (jamais 0).
            revenueTotal: hasVolume ? cb.netPrice * cb.volume : null,
            costTotal: hasVolume ? netCost * cb.volume : null,
            profitTotal: hasVolume ? cb.margeNetteDollar * cb.volume : null,
            volume: cb.volume,
            breakEvenUnits: cb.breakEvenUnits != null ? cb.breakEvenUnits : null,
        };
    });
    return { pds, linkRows, channels };
}
