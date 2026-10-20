import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Bar, LabelList, Cell } from 'recharts';
import { ArrowUpDown, FileDown, Pencil, AlertTriangle, Star, HelpCircle as QuestionMark, Milk, Bone } from 'lucide-react';
import { parseLocaleNumber, formatCurrency, formatPercent } from '../utils.js';
import { getCostTargetIndicator } from '../ui-utils.jsx';
import { Tooltip, Pagination } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { CostShockSimulator } from './CostShockSimulator.jsx';
import { computeMenuEngineeringQuadrants } from '../engine/analysisData.js';

// Doit être déclaré en dehors de StrategicAnalysis : un composant recréé à chaque rendu
// perdrait son état et forcerait un remontage complet de ses enfants à chaque frappe.
// Lignes au format { id, displayName, popularity, margeBruteDollar } — voir
// computeMenuEngineeringQuadrants (vue « tous canaux » ou un seul canal, StrategicAnalysis).
const Quadrant = ({ title, icon, items, bgColor, borderColor, tooltipText }) => (
    <div className={`rounded-lg p-4 ${bgColor} ${borderColor} border-2`}>
        <h3 className="font-bold text-lg mb-2 flex items-center">
            {icon} {title} <Tooltip text={tooltipText} />
        </h3>
        <ul className="text-sm space-y-2">
            {items.length > 0 ? items.map(p => (
                <li key={p.id} className="flex justify-between items-center">
                    <span>• {p.displayName}</span>
                    <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                        {/* Marge brute (coût matière + emballage + main-d'œuvre) : l'axe de rentabilité de la matrice. */}
                        {`Pop: ${p.popularity.toFixed(1)}% | Marge: ${formatCurrency(p.margeBruteDollar)}$`}
                    </span>
                </li>
            )) : <li className="text-gray-500 list-none">Aucun</li>}
        </ul>
    </div>
);

// --- RÉSUMÉ PAR SKU (06/10, ventilation Général/Activité/Canal ajoutée en Phase 4.6) ---
// Un seul SKU à la fois, vu à travers chacun de ses canaux (canaux en COLONNES, jamais en
// sections) — reproduit la structure par groupes de lignes du rapport « Coût de revient unit. »
// du chiffrier SymbiOse de l'utilisateur (Revenu et marge brute / Répartition des charges fixes /
// Coût net et marge nette / Seuil de rentabilité), avec la mise en forme du reste de l'app
// (couleurs de marge, info-bulles, mise en évidence du point mort). La ventilation des charges
// fixes par activité de production ET par canal (Général/Activité/Canal, chacun avec son propre
// driver choisi dans Paramètres) vient de la Phase 4.6 — voir calculateCosts.js/analysisData.js.
// « Frais de mise en marché » (20/10, retour utilisateur) : chez SymbiOse, trois lignes détaillées
// (courtage, distribution, facturation) ; notre modèle de cascade de maillons (Canaux de vente) ne
// les détaille pas séparément — affiché ici comme un seul total déjà implicite dans la cascade :
// PDS moins Prix de vente (= tout ce que les maillons déduisent avant le prix net producteur).
// Les frais d'expédition, eux, restent absorbés dans les frais fixes plutôt que traités à part. Le
// coût de production ne varie jamais par canal — affiché une seule fois, au-dessus de la grille,
// plutôt que répété colonne par colonne.
const BySkuRow = ({ label, tooltip, render, emphasis }) => (
    <tr className={emphasis ? 'bg-indigo-50' : ''}>
        <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-600 sticky left-0 bg-inherit whitespace-nowrap">
            <span className="flex items-center">{label}{tooltip && <Tooltip text={tooltip} />}</span>
        </th>
        {render}
    </tr>
);

const BySkuSectionHeader = ({ label, colSpan }) => (
    <tr>
        <th colSpan={colSpan} className="px-4 py-2 text-left text-xs font-bold uppercase italic tracking-wide text-gray-500 bg-gray-100">
            {label}
        </th>
    </tr>
);

const BySkuWaterfall = ({ row, productionActivities = [] }) => {
    const costs = row.costs;
    const channelBreakdown = row.channelBreakdown || [];
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

    return (
        <div>
            {/* Coût de production : fixe, peu importe le canal — jamais de frais indirects ici. */}
            <div className={`grid grid-cols-2 ${hasSubcontracting ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 mb-6`}>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Coût Matière</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costMatierePerPortion)} $</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Emballage</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costPackagingPerPortion)} $</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Main-d'œuvre</p>
                    <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costLaborPerPortion)} $</p>
                </div>
                {hasSubcontracting && (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500 truncate" title={subcontractingLabel}>{subcontractingLabel}</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costSubcontractingPerPortion)} $</p>
                    </div>
                )}
                <div className="p-3 bg-white border-2 border-gray-300 rounded-lg text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-500 flex items-center justify-center">Coût de Production (total) <Tooltip text="Matière + emballage + main-d'œuvre + sous-traitance — avant tout frais indirect. Ne varie jamais par canal." /></p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(costs.totalDirectCostPerPortion)} $</p>
                </div>
            </div>

            {channelBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Ce SKU n'est rattaché à aucun canal de vente — ajoutez-en un dans Paramètres → Produits et SKUs pour voir sa cascade de marge ici.</p>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-100">Canal</th>
                                {channelBreakdown.map(cb => (
                                    <th key={cb.channelId} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800 whitespace-nowrap">{cb.channelName}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <BySkuSectionHeader label="Revenu et marge brute" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="PDS" tooltip="Prix de détail suggéré au consommateur pour ce format — une seule valeur, la même pour tous les canaux (saisie dans Produits et SKUs)." render={channelBreakdown.map(cb => {
                                const pds = parseLocaleNumber(row.format?.pds);
                                return (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                        {pds > 0 ? `${formatCurrency(pds)} $` : <span className="text-gray-400" title="PDS non saisi pour ce format">—</span>}
                                    </td>
                                );
                            })} />
                            <BySkuRow label="Frais de mise en marché" tooltip="Le coût total des maillons de ce canal (courtage, distribution, marge du détaillant, etc.) entre le PDS et le prix net — PDS moins prix de vente." render={channelBreakdown.map(cb => {
                                const pds = parseLocaleNumber(row.format?.pds);
                                return (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                        {pds > 0 ? `${formatCurrency(pds - cb.netPrice)} $` : <span className="text-gray-400" title="PDS non saisi pour ce format">—</span>}
                                    </td>
                                );
                            })} />
                            <BySkuRow label="Prix de vente" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-medium text-gray-800">{formatCurrency(cb.netPrice)} $</td>
                            ))} />
                            <BySkuRow label="Bénéfice brut" tooltip="Prix net moins le coût de production. Avant frais fixes." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatCurrency(cb.margeBruteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Marge brute" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatPercent(cb.margeBrutePercent)} %</td>
                            ))} />

                            <BySkuSectionHeader label="Répartition des charges fixes" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Frais fixes — Général" tooltip="Part du pool « Général » (frais de structure, non rattachables à une activité ou un canal précis — ex. salaire de direction, assurances) allouée à ce SKU, au driver choisi pour Général dans Paramètres (ventes ou temps de main-d'œuvre). Le même montant quel que soit le canal — seul le prix change." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(costs.costIndirectGeneralPerPortion || 0)} $</td>
                            ))} />
                            <BySkuRow label={`Frais fixes — Activité${activityName ? ` (${activityName})` : ''}`} tooltip="Part du pool de l'activité de production de ce SKU, au driver choisi pour cette activité dans Paramètres (charges directes ou temps de main-d'œuvre) — voir l'infobulle du sélecteur de driver pour le guide de décision. Le même montant quel que soit le canal." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(costs.costIndirectActivityPerPortion || 0)} $</td>
                            ))} />
                            <BySkuRow label="Frais fixes — Canal" tooltip="Part du pool du CANAL de cette colonne — varie par canal, contrairement à Général/Activité ci-dessus. Aucun driver au choix ici : toujours une majoration % sur le coût de production de ce SKU (pool du canal ÷ valeur totale, au coût de production, de tout ce qui transite par ce canal) — le même mécanisme pour tous les canaux, cascadé depuis le coût déjà établi à l'activité." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cb.costIndirectChannelPerPortion || 0)} $</td>
                            ))} />
                            <BySkuRow label="Frais fixes totaux par unité" tooltip="Général + Activité + Canal ci-dessus — la part des frais fixes totaux allouée à ce SKU sur ce canal." emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(cb.margeBruteDollar - cb.margeNetteDollar)} $</td>
                            ))} />

                            <BySkuSectionHeader label="Coût net et marge nette" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Coût net" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cb.netPrice - cb.margeNetteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Bénéfice net" tooltip="Le profit réel par unité une fois tous les coûts déduits (production + frais fixes)." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatCurrency(cb.margeNetteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Marge nette" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatPercent(cb.margeNettePercent)} %</td>
                            ))} />

                            <BySkuSectionHeader label="Seuil de rentabilité par canal de vente" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Revenu total" tooltip="Prix de vente × volume réel vendu dans ce canal (saisi dans Produits et SKUs)." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cb.volume > 0 ? `${formatCurrency(cb.netPrice * cb.volume)} $` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Frais totaux" tooltip="Coût net par unité (production + frais fixes alloués) × volume réel vendu dans ce canal." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cb.volume > 0 ? `${formatCurrency((cb.netPrice - cb.margeNetteDollar) * cb.volume)} $` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Bénéfices / Pertes" tooltip="Revenu total moins frais totaux — le profit réel dans ce canal, au volume réellement vendu." emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-bold" style={cb.volume > 0 ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                    {cb.volume > 0 ? `${formatCurrency(cb.margeNetteDollar * cb.volume)} $` : <span className="text-gray-400 font-normal" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Point mort" tooltip="Unités à vendre dans ce canal pour couvrir la part des frais fixes allouée à ce SKU." emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-bold text-indigo-700">
                                    {cb.breakEvenUnits != null ? `${cb.breakEvenUnits} unités` : 'N/A'}
                                </td>
                            ))} />
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Même palette que getMarginStyle (table "Vue d'ensemble"), réutilisée ici pour une cellule isolée.
const getMarginCellStyle = (marginPercent) => {
    if (!isFinite(marginPercent)) return { backgroundColor: 'white', color: 'black' };
    const absMargin = Math.abs(marginPercent);
    const intensity = Math.min(absMargin / 0.8, 1) * 0.85 + 0.15;
    const textColor = intensity > 0.6 ? 'white' : 'black';
    if (marginPercent > 0) return { backgroundColor: `rgba(22, 163, 74, ${intensity})`, color: textColor };
    if (marginPercent < 0) return { backgroundColor: `rgba(220, 38, 38, ${intensity})`, color: textColor };
    return { backgroundColor: 'white', color: 'black' };
};

// --- COMPOSANT D'ANALYSE STRATÉGIQUE ---
const StrategicAnalysis = ({ analysisData, generalInfo, salesChannels }) => {
    // Tout est déjà prêt dans analysisData
    const {
        weightedGrossMargin,
        globalBreakEven,
        weightedMaterialCost,
        weightedPackagingCost,
        weightedLaborCost,
        menuEngineeringData: blendedMenuEngineeringData,
        totalSalesMix,
        activeProducts,
    } = analysisData;

    // 06/10 : la matrice BCG peut s'analyser « tous canaux » (par défaut, pondérée par volume —
    // menuEngineeringData déjà calculé par le moteur) OU limitée à UN SEUL canal, à la demande de
    // l'utilisateur (la rentabilité d'un SKU peut diverger fortement d'un canal à l'autre — une
    // moyenne pondérée masque cette réalité, utile à voir séparément). Recalculée côté client avec
    // computeMenuEngineeringQuadrants (fonction pure déjà utilisée par le moteur), à partir du
    // channelBreakdown déjà présent sur chaque ligne — pas besoin de relancer tout le pipeline.
    // 07/10 : la vue « tous canaux » (menuEngineeringData, calculée par le moteur) utilise
    // désormais le volume RÉEL agrégé à travers tous les canaux pour la popularité, jamais
    // salesMix — même base que la vue par canal ci-dessous, pour éviter qu'un SKU soit classé
    // poids mort en tous-canaux sans jamais l'être dans aucun canal pris séparément (voir
    // computeAnalysisData dans analysisData.js).
    const [bcgChannelId, setBcgChannelId] = useState('');
    const menuEngineeringData = useMemo(() => {
        if (!bcgChannelId) return blendedMenuEngineeringData;
        const rows = [];
        for (const p of (activeProducts || [])) {
            const cb = (p.channelBreakdown || []).find(c => c.channelId === bcgChannelId);
            if (!cb) continue; // Ce SKU n'est pas vendu dans ce canal — exclu, jamais forcé à 0.
            const volume = parseLocaleNumber(cb.volume);
            if (volume <= 0) continue; // Prix saisi mais aucun volume réel — pas de performance à classer (07/10).
            rows.push({ id: p.id, displayName: p.displayName, popularity: 0, margeBruteDollar: cb.margeBruteDollar, volume });
        }
        // Popularité propre au canal choisi (part du volume de CE canal), pas le mix global du menu.
        const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
        rows.forEach(r => { r.popularity = totalVolume > 0 ? (r.volume / totalVolume) * 100 : 0; });
        return computeMenuEngineeringQuadrants(rows);
    }, [bcgChannelId, activeProducts, blendedMenuEngineeringData]);

    const { stars, cows, questions, dogs } = menuEngineeringData;

    if (!analysisData.activeProducts || analysisData.activeProducts.length === 0) return null;

    return (
        <div id="strategic-analysis" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Analyse stratégique et point mort global</h2>

            {/* flex + largeur fixe (plutôt que grid-cols-3) pour que la dernière ligne (2 tuiles sur
                5) reste centrée au lieu de coller à gauche — un grid laisserait un trou à droite. */}
            <div className="flex flex-wrap justify-center gap-6 mb-6 text-center">
                <div className="w-full md:w-[calc(33.333%-1rem)] p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">
                        Coût Matière Moyen Pondéré
                        <Tooltip text="La moyenne du coût matière de tous vos plats, pondérée par leur popularité (mix des ventes)." />
                        {getCostTargetIndicator(weightedMaterialCost, generalInfo.foodCostTarget)}
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedMaterialCost)} %</p>
                </div>
                <div className="w-full md:w-[calc(33.333%-1rem)] p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">
                        Coût Emballage Moyen Pondéré
                        <Tooltip text="La moyenne du coût d'emballage de tous vos plats, pondérée par leur popularité (mix des ventes) — poste séparé du coût matière." />
                        {getCostTargetIndicator(weightedPackagingCost, generalInfo.packagingCostTarget)}
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedPackagingCost)} %</p>
                </div>
                <div className="w-full md:w-[calc(33.333%-1rem)] p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">
                        Coût Main-d'œuvre Moyen Pondéré
                        <Tooltip text="La moyenne du coût de main-d'œuvre de tous vos plats, pondérée par leur popularité (mix des ventes)." />
                        {getCostTargetIndicator(weightedLaborCost, generalInfo.laborCostTarget)}
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedLaborCost)} %</p>
                </div>
                <div className="w-full md:w-[calc(33.333%-1rem)] p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">Marge Brute Moyenne Pondérée <Tooltip text="Marge après coût matière, emballage ET main-d'œuvre (la MO étant un coût semi-variable), pondérée par la popularité de chaque plat." /></div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedGrossMargin)} %</p>
                </div>
                <div className="w-full md:w-[calc(33.333%-1rem)] p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">Point Mort du Menu Analysé <Tooltip text="Le chiffre d'affaires que votre menu doit générer, au mix des ventes actuel, pour couvrir sa part des frais indirects." /></div>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(globalBreakEven)} $</p>
                </div>
            </div>
            {Math.round(totalSalesMix) !== 100 && totalSalesMix > 0 && (
                 <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm">
                    <AlertTriangle className="inline h-4 w-4 mr-2"/>
                    Attention : Le total de votre mix des ventes est de {totalSalesMix.toFixed(1)}%. Pour une analyse précise, il devrait être de 100%.
                </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-2">Matrice d'ingénierie de menu</h3>
            <p className="text-sm text-gray-500 mb-4">Classe chaque plat selon sa popularité et sa rentabilité (matrice de Boston Consulting Group).</p>

            <div className="flex items-center gap-2 mb-4">
                <label htmlFor="bcgChannelFilter" className="text-sm font-medium text-gray-700">Analyse BCG pour :</label>
                <select
                    id="bcgChannelFilter"
                    value={bcgChannelId}
                    onChange={(e) => setBcgChannelId(e.target.value)}
                    className="p-1.5 border rounded-md text-sm border-gray-300"
                >
                    <option value="">Tous les canaux (pondéré par volume)</option>
                    {(salesChannels || []).map(c => <option key={c.id} value={c.id}>{c.name || 'Sans nom'}</option>)}
                </select>
                <Tooltip text="« Tous les canaux » calcule la marge ET la popularité de chaque SKU à partir du volume réel agrégé de tous ses canaux (jamais du mix des ventes saisi à la main, pour éviter toute dilution par les formats en mode manuel). Choisir un canal limite l'analyse à sa seule marge et à sa seule popularité dans ce canal — un SKU peut être une étoile en vente directe et un poids mort en grande surface." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Quadrant
                    title="Étoiles"
                    icon={<Star className="mr-2 text-yellow-500"/>}
                    items={stars}
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200"
                    tooltipText="Vos plats les plus populaires ET les plus rentables. Mettez-les en avant !"
                />
                <Quadrant
                    title="Dilemmes"
                    icon={<QuestionMark className="mr-2 text-orange-500"/>}
                    items={questions}
                    bgColor="bg-orange-50"
                    borderColor="border-orange-200"
                    tooltipText="Plats rentables mais peu populaires. Envisagez une promotion ou une meilleure place sur le menu pour stimuler les ventes."
                />
                <Quadrant
                    title="Vaches à lait"
                    icon={<Milk className="mr-2 text-gray-500"/>}
                    items={cows}
                    bgColor="bg-gray-50"
                    borderColor="border-gray-200"
                    tooltipText="Plats très populaires mais à faible marge. Cherchez à réduire leurs coûts sans sacrifier la qualité."
                />
                <Quadrant
                    title="Poids morts"
                    icon={<Bone className="mr-2 text-red-500"/>}
                    items={dogs}
                    bgColor="bg-red-50"
                    borderColor="border-red-200"
                    tooltipText="Plats ni populaires, ni rentables. Pensez à les réinventer complètement ou à les retirer du menu."
                />
            </div>
        </div>
    );
};

// Onglet 4: Résumé
export const SummaryTable = ({ onEditProduct, onOpenPdfModal, exportToExcel, itemsPerPage, onItemsPerPageChange }) => {
    const { products, generalInfo, laborDatabase, analysisData, salesChannels, productionActivities } = useProject();
    const [sortConfig, setSortConfig] = useState({ key: 'costs.margeNettePercent', direction: 'descending' });
    const [showAllContributions, setShowAllContributions] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    // Révision du 06/10 : « Par SKU » est le détail d'UN SEUL SKU à travers ses canaux (cascade de
    // coûts façon chiffrier SymbiOse de l'utilisateur), pas un tableau de toutes les lignes — ce
    // tableau-là a été fusionné dans « Vue d'ensemble » avec le graphique de contribution. Ordre
    // des sous-onglets inversé le même jour (demande explicite) : « Vue d'ensemble » est désormais
    // le premier, et actif par défaut. Voir Projet_Claude/03-Feuille-de-route.md.
    const [activeSubTab, setActiveSubTab] = useState('overview');
    const [selectedSkuId, setSelectedSkuId] = useState(null);
    useEffect(() => {
        setCurrentPage(1);
    }, [sortConfig]);

    // --- LOGIQUE CENTRALISÉE ---
    const { productsWithCosts, contributionData } = analysisData;

    // Liste des SKU pour le sélecteur de « Par SKU », triée par nom pour rester repérable.
    const skuOptions = useMemo(
        () => [...productsWithCosts].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'fr', { sensitivity: 'base' })),
        [productsWithCosts]
    );
    useEffect(() => {
        if (!selectedSkuId && skuOptions.length > 0) setSelectedSkuId(skuOptions[0].id);
    }, [skuOptions, selectedSkuId]);
    const selectedSkuRow = productsWithCosts.find(p => p.id === selectedSkuId) || null;

    // Trie aussi par colonne de canal (clé "channel:<id>", voir la matrice « Marges nettes des SKUs
    // par canaux ») : lit la marge nette (%) de ce canal pour ce SKU dans son channelBreakdown
    // (absent → null, un SKU non vendu dans ce canal). Un « — » (valeur null) reste toujours en fin
    // de liste, peu importe le sens du tri — jamais interprété comme 0 %, qui le classerait parmi
    // les moins rentables plutôt que de le mettre à part.
    const getNestedValue = (obj, path) => {
        if (path.startsWith('channel:')) {
            const channelId = path.slice('channel:'.length);
            const cb = (obj.channelBreakdown || []).find(c => c.channelId === channelId);
            return cb ? cb.margeNettePercent : null;
        }
        return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
    };

    const sortedProducts = useMemo(() => {
        let sortableItems = [...productsWithCosts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);

                // On détecte si la colonne est numérique (Prix, Mix, n'importe quel champ de
                // costs.*, ou une colonne de canal).
                const isNumeric = sortConfig.key.includes('costs.') || sortConfig.key === 'prixVente' || sortConfig.key === 'salesMix' || sortConfig.key.startsWith('channel:');

                if (isNumeric) {
                    const aNum = (aValue === null || aValue === undefined || aValue === '') ? null : parseLocaleNumber(aValue);
                    const bNum = (bValue === null || bValue === undefined || bValue === '') ? null : parseLocaleNumber(bValue);
                    if (aNum === null && bNum === null) return 0;
                    if (aNum === null) return 1;
                    if (bNum === null) return -1;
                    const comparison = aNum - bNum;
                    return sortConfig.direction === 'ascending' ? comparison : -comparison;
                }
                // Tri alphabétique robuste pour les noms de plats
                const comparison = String(aValue || "").localeCompare(String(bValue || ""), 'fr', { sensitivity: 'base' });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [productsWithCosts, sortConfig]);

    const displayedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedProducts, currentPage, itemsPerPage]);

    // On prépare les données pour le graphique de contribution
    const displayedContributions = useMemo(() => {
        return showAllContributions ? contributionData : contributionData.slice(0, 10);
    }, [contributionData, showAllContributions]);

    const totalContributionsCount = contributionData.length;

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Résumé des produits</h1>
                <div className="flex space-x-2">
                    <button onClick={() => exportToExcel(laborDatabase)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <FileDown className="h-5 w-5 mr-2" /> Exporter vers Excel
                    </button>
                    <button onClick={onOpenPdfModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                        <FileDown className="h-5 w-5 mr-2" /> Générer un rapport PDF
                    </button>
                </div>
            </div>

            <div className="flex gap-1 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveSubTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'overview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Vue d'ensemble
                </button>
                <button
                    onClick={() => setActiveSubTab('bySku')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'bySku' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Par SKU
                </button>
                <button
                    onClick={() => setActiveSubTab('simulation')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'simulation' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Simulation
                </button>
            </div>

            {activeSubTab === 'bySku' && (
            <div id="tutorial-section-summary-bysku">
                <div className="flex items-center gap-2 mb-6">
                    <label htmlFor="summarySkuSelect" className="text-sm font-medium text-gray-700">SKU :</label>
                    <select
                        id="summarySkuSelect"
                        value={selectedSkuId || ''}
                        onChange={(e) => setSelectedSkuId(e.target.value)}
                        className="p-1.5 border rounded-md text-sm border-gray-300 flex-1 max-w-md"
                    >
                        {skuOptions.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                    {selectedSkuRow && (
                        <button
                            onClick={() => onEditProduct(products.findIndex(p => p.id === selectedSkuRow.productId), selectedSkuRow.formatIndex || 0)}
                            title="Éditer ce SKU dans Production"
                            className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50 flex-shrink-0"
                        >
                            <Pencil size={18} />
                        </button>
                    )}
                </div>
                {selectedSkuRow
                    ? <BySkuWaterfall row={selectedSkuRow} productionActivities={productionActivities} />
                    : <p className="text-center text-gray-500 py-8">Aucun SKU dans le menu pour l'instant.</p>}
            </div>
            )}

            {activeSubTab === 'overview' && (
            <>
            <StrategicAnalysis analysisData={analysisData} generalInfo={generalInfo} salesChannels={salesChannels} />
            {/* Classement par Contribution Totale */}
            <div id="tutorial-contribution-chart" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Classement par contribution totale au profit</h2>
                        <p className="text-sm text-gray-500 mb-4">Ce graphique montre les plats qui génèrent le plus de profit en dollars pour couvrir vos frais fixes.</p>
                    </div>
                    {totalContributionsCount > 10 && (
                        <button
                            onClick={() => setShowAllContributions(!showAllContributions)}
                            className="text-sm text-blue-600 hover:text-blue-800 flex-shrink-0"
                        >
                            {showAllContributions ? 'Voir les 10 principaux' : `Voir tout (${totalContributionsCount})`}
                        </button>
                    )}
                </div>
                <div style={{ width: '100%', height: 30 + displayedContributions.length * 40 }}>
                    <ResponsiveContainer>
                        <BarChart
                            layout="vertical"
                            data={displayedContributions}
                            margin={{ top: 5, right: 60, left: 100, bottom: 5 }}
                        >

                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                            <RechartsTooltip
                                formatter={(value) => `${formatCurrency(value)} $`}
                                cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }}
                                contentStyle={{ borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="totalContribution" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="totalContribution" position="right" formatter={(value) => `${formatCurrency(value)} $`} style={{ fill: '#374151', fontSize: '12px' }}/>
                                {contributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.totalContribution >= 0 ? '#10B981' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 06/10 : matrice SKU × canal inspirée de l'onglet « Rapport - Marges » du chiffrier
                SymbiOse de l'utilisateur — remplace l'ancien tableau détaillé à un seul canal à la
                fois (son filtre par canal n'a plus lieu d'être : tous les canaux sont déjà visibles
                en colonnes ici). Pas de regroupement « Vente directe / Vente au détail » comme dans
                le chiffrier original : ça suppose un type de canal que `salesChannels` ne modélise
                pas encore. */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Marges nettes des SKUs par canaux</h2>
                <p className="text-sm text-gray-500 mb-4">La marge nette (%) de chaque SKU, pour chacun de ses canaux de vente. « — » : ce SKU n'est pas vendu dans ce canal.</p>
            </div>
            <div id="tutorial-section-summary-table" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-100">
                                <button onClick={() => requestSort('displayName')} className="flex items-center w-full">
                                    Plat {getSortIcon('displayName')}
                                </button>
                            </th>
                            {salesChannels.map(c => (
                                <th key={c.id} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                    <button onClick={() => requestSort(`channel:${c.id}`)} className="flex items-center justify-end w-full">
                                        {c.name || 'Sans nom'} {getSortIcon(`channel:${c.id}`)}
                                    </button>
                                </th>
                            ))}
                            <th className="relative px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedProducts.map((product, index) => (
                            <tr key={product.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-4 whitespace-nowrap font-medium sticky left-0 bg-inherit">{product.displayName || product.platName || `Plat ${index + 1}`}</td>
                                {salesChannels.map(c => {
                                    const cb = (product.channelBreakdown || []).find(ch => ch.channelId === c.id);
                                    return (
                                        <td key={c.id} className="px-4 py-4 text-right font-bold" style={cb ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                            {cb ? `${formatPercent(cb.margeNettePercent)} %` : <span className="text-gray-400 font-normal" title="Non vendu dans ce canal">—</span>}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-4 text-right">
                                    <button
                                        onClick={() => onEditProduct(products.findIndex(p => p.id === product.productId), product.formatIndex || 0)}
                                        title="Éditer le plat"
                                        className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            <Pagination
                totalItems={sortedProducts.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={onItemsPerPageChange}
            />
            </div>
            </>
            )}

            {/* 06/10 : sous-onglet dédié — être dans cet onglet suffit, pas besoin de redéplier
                le simulateur derrière un second clic (voir CostShockSimulator, prop collapsible). */}
            {activeSubTab === 'simulation' && (
                <CostShockSimulator collapsible={false} />
            )}
        </div>
    );
};
