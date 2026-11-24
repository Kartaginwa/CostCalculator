// Cascade de rentabilité d'un SKU et tableau de résumé par segment (Par SKU, Par activité, Par canal). Extrait de SummaryTable.jsx le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { useMemo } from 'react';
import { formatCurrency, formatPercent } from '../../utils.js';
import { Tooltip, CostNatureBadge } from '../../components/common.jsx';
import { computeSkuCascade } from '../../engine/skuCascade.js';
import { getMarginCellStyle } from './summaryUtils.js';

// --- RÉSUMÉ PAR SKU (06/10, ventilation Général/Activité/Canal ajoutée en Phase 4.6) ---
// Un seul SKU à la fois, vu à travers chacun de ses canaux (canaux en COLONNES, jamais en
// sections) — reproduit la structure par groupes de lignes du rapport « Coût de revient unit. »
// du chiffrier SymbiOse de l'utilisateur (Revenu et marge brute / Répartition des charges fixes /
// Coût net et marge nette / Seuil de rentabilité), avec la mise en forme du reste de l'app
// (couleurs de marge, info-bulles, mise en évidence du point mort). La ventilation des charges
// fixes par activité de production ET par canal (Général/Activité/Canal, chacun avec son propre
// driver choisi dans Paramètres) vient de la Phase 4.6 — voir calculateCosts.js/analysisData.js.
// « PDS et frais de mise en marché » (20/10, retour utilisateur) : une section séparée, avant
// « Marge brute », détaillant CHAQUE maillon de la cascade (markup/marge, Canaux de vente) en
// dollars — pas un seul total global comme avant. Un maillon NOMMÉ identique dans plusieurs canaux
// (ex. un même partenaire de distribution) n'apparaît qu'une fois ; un maillon sans nom ne fusionne
// jamais avec un autre maillon sans nom d'un canal différent (voir `linkRowKey` : repli sur
// channelId+index dans ce cas précis, jamais sur le nom vide lui-même). Chez SymbiOse, trois lignes
// détaillées existent (courtage, distribution, facturation) ; notre modèle de cascade de maillons
// ne les détaille pas de la même façon, mais le principe (une ligne par poste) est repris ici.
// Les frais d'expédition, eux, restent absorbés dans les frais fixes plutôt que traités à part. Le
// coût de production ne varie jamais par canal — affiché une seule fois, au-dessus de la grille,
// plutôt que répété colonne par colonne.
const BySkuRow = ({ label, tooltip, render, emphasis }) => (
    <tr className={emphasis ? 'bg-indigo-50' : ''}>
        <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-600 sticky left-0 bg-inherit whitespace-nowrap">
            <span className="flex items-center">{label}{tooltip && <Tooltip tip={tooltip} />}</span>
        </th>
        {render}
    </tr>
);

const BySkuSectionHeader = ({ label, colSpan }) => (
    <tr>
        <th colSpan={colSpan} className="px-4 py-2 text-left text-xs font-bold italic tracking-wide text-gray-500 bg-gray-100">
            {label}
        </th>
    </tr>
);

export const BySkuWaterfall = ({ row, productionActivities = [], salesChannels = [] }) => {
    const costs = row.costs;
    const channelBreakdown = row.channelBreakdown || [];
    // Cascade du SKU (PDS, maillons, frais, marges, seuil) : calculée par le moteur (engine/skuCascade.js), partagée avec le rapport PDF.
    const cascade = computeSkuCascade(row, salesChannels);
    const pds = cascade.pds;
    const cascadeOf = (cb) => cascade.channels.find(c => c.channelId === cb.channelId);
    // Phase 4.6 : nom de l'activité de ce SKU, pour une infobulle lisible sur la ligne « Activité »
    // ci-dessous (le produit n'a pas de contenant « Général » propre — absent, jamais inventé).
    const activityName = productionActivities.find(a => a.id === row.activityId)?.name;
    // La tuile « Coûts additionnels » (ex-« S-T », sous-traitance) ne s'affiche que si ce format en
    // a — et affiche le nom de l'opération/du sous-traitant plutôt qu'un intitulé générique, pour
    // rester lisible même avec plusieurs opérations.
    const hasSubcontracting = costs.costSubcontractingPerPortion > 0;
    const subcontractingLabel = (row.format?.subcontracting?.items || [])
        .map(item => item.name || item.operation)
        .filter(Boolean)
        .join(' + ') || 'Coûts additionnels';

    // Un maillon par ligne, du plus proche du PDS (en haut) vers celui le plus proche du prix net (en bas) — cohérent avec PDS en haut et Prix de vente
    // en bas de cette section. Les écarts $ viennent du moteur : absents (null) si le canal ne passe pas par ce maillon ou si le PDS n'est pas saisi ;
    // un canal sans maillon (vente directe) donne bien 0 $ au total, une vraie valeur, jamais confondue avec un PDS absent.
    const { linkRows } = cascade;
    const getLinkDelta = (cb, linkRow) => cascadeOf(cb)?.deltas[linkRow.key] ?? null;
    const getTotalLinkDelta = (cb) => cascadeOf(cb)?.totalDelta ?? null;

    return (
        <div>
            {/* Coût de production : fixe, peu importe le canal — jamais de frais indirects ici. */}
            <div className={`grid grid-cols-2 ${hasSubcontracting ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 mb-6`}>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Coût matière</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costMatierePerPortion)}&nbsp;$</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Emballage</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costPackagingPerPortion)}&nbsp;$</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Main-d'œuvre</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costLaborPerPortion)}&nbsp;$</p>
                </div>
                {hasSubcontracting && (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500 truncate" title={subcontractingLabel}>{subcontractingLabel}</p>
                        <p className="text-[10px] leading-none -mt-0.5 mb-0.5"><CostNatureBadge nature="direct" /></p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costSubcontractingPerPortion)}&nbsp;$</p>
                    </div>
                )}
                <div className="p-3 bg-white border-2 border-gray-300 rounded-lg text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-500 flex items-center justify-center">Coût de production (total) <Tooltip tip="sku.coutProduction" /></p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(costs.totalDirectCostPerPortion)}&nbsp;$</p>
                </div>
            </div>

            {channelBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Ce SKU n'est rattaché à aucun canal de vente — ajoutez-en un dans Paramètres → Produits et SKUs pour voir sa cascade de marge ici.</p>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 sticky left-0 bg-gray-100">Canal</th>
                                {channelBreakdown.map(cb => (
                                    <th key={cb.channelId} className="px-4 py-2.5 text-center text-sm font-semibold text-gray-800 whitespace-nowrap">{cb.channelName}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <BySkuSectionHeader label="PDS et frais de mise en marché" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="PDS" tooltip="sku.pds" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {pds > 0 ? `${formatCurrency(pds)}\u00A0$` : <span className="text-gray-400" title="PDS non saisi pour ce format">—</span>}
                                </td>
                            ))} />
                            {linkRows.map(linkRow => (
                                <BySkuRow key={linkRow.key} label={linkRow.label} tooltip="sku.maillons" render={channelBreakdown.map(cb => {
                                    const delta = getLinkDelta(cb, linkRow);
                                    return (
                                        <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                            {delta != null ? `${formatCurrency(delta)}\u00A0$` : <span className="text-gray-400" title="Ce canal ne passe pas par ce maillon, ou PDS non saisi pour ce format">—</span>}
                                        </td>
                                    );
                                })} />
                            ))}
                            <BySkuRow label="Frais de mise en marché totaux par unité" tooltip="sku.fraisMiseMarche" emphasis render={channelBreakdown.map(cb => {
                                const totalDelta = getTotalLinkDelta(cb);
                                return (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                        {totalDelta != null ? `${formatCurrency(totalDelta)}\u00A0$` : <span className="text-gray-400 font-normal" title="PDS non saisi pour ce format">—</span>}
                                    </td>
                                );
                            })} />

                            <BySkuSectionHeader label="Marge brute" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Prix de vente" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-medium text-gray-800">{formatCurrency(cb.netPrice)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Bénéfice brut" tooltip="sku.beneficeBrut" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatCurrency(cb.margeBruteDollar)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Marge brute" tooltip="sku.margeBrute" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatPercent(cb.margeBrutePercent)}&nbsp;%</td>
                            ))} />

                            <BySkuSectionHeader label="Répartition des charges fixes" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Frais fixes — Général" tooltip="sku.ffGeneral" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedGeneral)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label={`Frais fixes — Activité${activityName ? ` (${activityName})` : ''}`} tooltip="sku.ffActivite" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedActivity)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Frais fixes — Canal" tooltip="sku.ffCanal" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedChannel)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Frais fixes totaux par unité" tooltip="sku.ffTotal" emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(cascadeOf(cb).fixedTotal)}&nbsp;$</td>
                            ))} />

                            <BySkuSectionHeader label="Coût net et marge nette" colSpan={channelBreakdown.length + 1} />
                            {(costs.costAgingPerPortion || 0) > 0 && (
                                <BySkuRow label={<>Vieillissement <CostNatureBadge nature="financial" /></>} tooltip="sku.vieillissement" render={channelBreakdown.map(cb => (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(costs.costAgingPerPortion)}&nbsp;$</td>
                                ))} />
                            )}
                            <BySkuRow label="Coût net" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).netCost)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Bénéfice net" tooltip="sku.beneficeNet" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatCurrency(cb.margeNetteDollar)}&nbsp;$</td>
                            ))} />
                            <BySkuRow label="Marge nette" tooltip="sku.margeNette" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatPercent(cb.margeNettePercent)}&nbsp;%</td>
                            ))} />

                            <BySkuSectionHeader label="Seuil de rentabilité par canal de vente" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Revenu total" tooltip="sku.revenuTotal" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cascadeOf(cb).revenueTotal != null ? `${formatCurrency(cascadeOf(cb).revenueTotal)}\u00A0$` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Frais totaux" tooltip="sku.fraisTotaux" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cascadeOf(cb).costTotal != null ? `${formatCurrency(cascadeOf(cb).costTotal)}\u00A0$` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Bénéfices / Pertes" tooltip="sku.beneficePerte" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-bold" style={cb.volume > 0 ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                    {cascadeOf(cb).profitTotal != null ? `${formatCurrency(cascadeOf(cb).profitTotal)}\u00A0$` : <span className="text-gray-400 font-normal" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Point mort" tooltip="sku.pointMort" emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-bold text-indigo-700">
                                    {cascadeOf(cb).breakEvenUnits != null ? `${cascadeOf(cb).breakEvenUnits} unités` : 'N/A'}
                                </td>
                            ))} />
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Rapport agrégé Par activité / Par canal (révisé le 02/11, retour utilisateur) — une LIGNE par
// activité (ou par canal), chacune réduite à son propre TOTAL ; jamais ventilée par l'autre axe.
// Version précédente (24/10) : un sélecteur + une colonne par canal/activité, comme BySkuWaterfall
// — retour utilisateur immédiat, « on dirait une simple répétition de deux rapports identiques »
// (Par activité transposé de Par canal), alors que le vrai intérêt était LE TOTAL de chaque ligne,
// pas sa répartition par l'autre axe. Voir Projet_Claude/03-Feuille-de-route.md. Même principe
// qu'ailleurs dans ce fichier (« Classement par contribution totale ») : classée par Bénéfice net $
// décroissant, pour que le segment le plus/moins profitable saute aux yeux sans tri manuel. Tous
// les $ sont des TOTAUX (jamais un prix/coût par unité, qui supposerait une unité de vente commune
// à tous les SKU agrégés) ; les % sont dérivés en divisant deux TOTAUX $, jamais en moyennant des %
// individuels (voir aggregateSegmentRows, analysisData.js — paradoxe de Simpson). Le point mort est
// en $ DE REVENU, pas en unités, pour la même raison.
// Axes inversés le 02/11 (retour utilisateur) : une colonne par segment (activité/canal), une
// ligne par indicateur — plus lisible quand il y a peu de segments (souvent 2-4) à comparer côte
// à côte sur beaucoup d'indicateurs, plutôt que l'inverse. Segments triés par Bénéfice net $
// décroissant, de gauche à droite (même logique de tri qu'avant, appliquée aux colonnes).
// Mise en page alignée le 02/11 sur celle de Par SKU (retour utilisateur) : réutilise directement
// BySkuRow/BySkuSectionHeader — même cascade visuelle (en-têtes de section gris, ligne d'emphase
// bg-indigo-50 pour un total/point mort, étiquette sticky avec infobulle inline) — plutôt qu'une
// mise en page ad hoc propre à ce tableau.
export const SegmentSummaryTable = ({ rows, nameColumnLabel, idKey, nameKey }) => {
    const sortedRows = useMemo(() => [...rows].sort((a, b) => b.margeNetteTotal - a.margeNetteTotal), [rows]);

    if (rows.length === 0) {
        return <p className="text-sm text-gray-500 text-center py-8">Aucune donnée réelle pour l'instant — saisissez un volume vendu par canal dans Paramètres → Produits et SKUs pour alimenter ce tableau.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 sticky left-0 bg-gray-100">{nameColumnLabel}</th>
                        {sortedRows.map(row => (
                            <th key={row[idKey]} className="px-4 py-2.5 text-center text-sm font-semibold text-gray-800 whitespace-nowrap">{row[nameKey]}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    <BySkuSectionHeader label="Marge brute" colSpan={sortedRows.length + 1} />
                    <BySkuRow label="Revenu total" tooltip="seg.revenu" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.revenueTotal)}&nbsp;$</td>
                    ))} />
                    <BySkuRow label="Coût de production" tooltip="seg.cout" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.totalDirectCostTotal)}&nbsp;$</td>
                    ))} />
                    <BySkuRow label="Bénéfice brut" tooltip="seg.brut" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeBrutePercent)}>{formatCurrency(row.margeBruteTotal)}&nbsp;$</td>
                    ))} />
                    <BySkuRow label="Marge brute" tooltip="seg.margeBrute" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeBrutePercent)}>{formatPercent(row.margeBrutePercent)}&nbsp;%</td>
                    ))} />

                    <BySkuSectionHeader label="Frais fixes et marge nette" colSpan={sortedRows.length + 1} />
                    <BySkuRow label="Frais fixes" tooltip="seg.fraisFixes" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(row.totalIndirectTotal)}&nbsp;$</td>
                    ))} />
                    <BySkuRow label="Bénéfice net" tooltip="seg.net" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeNettePercent)}>{formatCurrency(row.margeNetteTotal)}&nbsp;$</td>
                    ))} />
                    <BySkuRow label="Marge nette" tooltip="seg.margeNette" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeNettePercent)}>{formatPercent(row.margeNettePercent)}&nbsp;%</td>
                    ))} />

                    <BySkuSectionHeader label="Seuil de rentabilité" colSpan={sortedRows.length + 1} />
                    <BySkuRow
                        label="Point mort"
                        tooltip="seg.pointMort"
                        emphasis
                        render={sortedRows.map(row => (
                            <td key={row[idKey]} className="px-4 py-2.5 text-right font-bold text-indigo-700">
                                {row.breakEvenRevenue != null ? `${formatCurrency(row.breakEvenRevenue)}\u00A0$` : 'N/A'}
                            </td>
                        ))}
                    />
                </tbody>
            </table>
        </div>
    );
};
