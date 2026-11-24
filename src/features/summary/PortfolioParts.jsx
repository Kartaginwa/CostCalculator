// Analyse stratégique et matrice BCG du sous-onglet Portefeuille. Extrait de SummaryTable.jsx le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { useMemo } from 'react';
import { AlertTriangle, Star, HelpCircle as QuestionMark, Milk, Bone } from 'lucide-react';
import { parseLocaleNumber, formatCurrency, formatPercent, formatNumber } from '../../utils.js';
import { useSessionState } from '../../ui-utils.jsx';
import { ObjectiveBadge } from '../../components/ObjectiveBadge.jsx';
import { Tooltip } from '../../components/common.jsx';
import { computeMenuEngineeringQuadrants } from '../../engine/analysisData.js';
import { ObjectivesFindings, EvolutionFindings } from '../reports/KeyFindings.jsx';
import { computeSafetyMargin } from '../../engine/laborReport.js';
import { SimpleLineChart } from './SimpleLineChart.jsx';

// Doit être déclaré en dehors de StrategicAnalysis : un composant recréé à chaque rendu
// perdrait son état et forcerait un remontage complet de ses enfants à chaque frappe.
// Lignes au format { id, displayName, popularity, margeBruteDollar } — voir
// computeMenuEngineeringQuadrants (vue « tous canaux » ou un seul canal, StrategicAnalysis).
const Quadrant = ({ title, icon, items, bgColor, borderColor, tooltipText }) => (
    <div className={`rounded-lg p-4 ${bgColor} ${borderColor} border-2`}>
        <h3 className="font-bold text-lg mb-2 flex items-center">
            {icon} {title} <Tooltip tip={tooltipText} />
        </h3>
        <ul className="text-sm space-y-2">
            {items.length > 0 ? items.map(p => (
                <li key={p.id} className="flex justify-between items-center">
                    <span>• {p.displayName}</span>
                    <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                        {/* Marge brute (coût matière + emballage + main-d'œuvre) : l'axe de rentabilité de la matrice. */}
                        {`Pop: ${formatNumber(p.popularity, 1)}% | Marge: ${formatCurrency(p.margeBruteDollar)}$`}
                    </span>
                </li>
            )) : <li className="text-gray-500 list-none">Aucun</li>}
        </ul>
    </div>
);

// --- COMPOSANT D'ANALYSE STRATÉGIQUE ---
export const StrategicAnalysis = ({ analysisData, generalInfo, globalKpiData }) => {
    // Tout est déjà prêt dans analysisData
    const {
        weightedGrossMargin,
        globalBreakEven,
        weightedMaterialCost,
        weightedPackagingCost,
        weightedLaborCost,
        totalSalesMix,
        menuRevenue,
    } = analysisData;
    // Marge de sécurité : de combien les ventes prévues peuvent baisser avant le point mort. Absente (—) sans ventes prévues.
    const safetyMargin = computeSafetyMargin(menuRevenue, globalBreakEven);


    if (!analysisData.activeProducts || analysisData.activeProducts.length === 0) return null;

    return (
        <>
        <div id="strategic-analysis" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Indicateurs clés de rentabilité</h2>

            {/* flex + largeur fixe (plutôt que grid-cols-3) pour que la dernière ligne (2 tuiles sur
                5) reste centrée au lieu de coller à gauche — un grid laisserait un trou à droite. */}
            <div data-tour="kpi-tiles" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 text-center">
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">
                        Coût Matière Moyen Pondéré
                        <Tooltip tip="kpi.matiere" />
                        <ObjectiveBadge id="matiere" value={weightedMaterialCost * 100} info={generalInfo} />
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatPercent(weightedMaterialCost)} %</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">
                        Coût Emballage Moyen Pondéré
                        <Tooltip tip="kpi.emballage" />
                        <ObjectiveBadge id="emballage" value={weightedPackagingCost * 100} info={generalInfo} />
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatPercent(weightedPackagingCost)} %</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">
                        Coût Main-d'œuvre Moyen Pondéré
                        <Tooltip tip="kpi.mo" />
                        <ObjectiveBadge id="mo" value={weightedLaborCost * 100} info={generalInfo} />
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatPercent(weightedLaborCost)} %</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">Marge Brute Moyenne Pondérée <Tooltip tip="kpi.margeBrute" /><ObjectiveBadge id="margeBrute" value={weightedGrossMargin * 100} info={generalInfo} /></div>
                    <p className="text-2xl font-bold text-blue-600">{formatPercent(weightedGrossMargin)} %</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">Point Mort des Produits Actifs <Tooltip tip="kpi.pointMort" /></div>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(globalBreakEven)} $</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow flex flex-col">
                    <div className="text-sm text-gray-500 flex flex-1 items-center justify-center">Marge de sécurité <Tooltip tip="kpi.margeSecurite" /></div>
                    {safetyMargin ? (
                        <>
                            <p className={`text-2xl font-bold ${safetyMargin.ratio < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatPercent(safetyMargin.ratio)} %</p>
                        </>
                    ) : <p className="text-2xl font-bold text-gray-400" title="Aucune vente prévue ou point mort non calculable">—</p>}
                </div>
            </div>
            {Math.round(totalSalesMix) !== 100 && totalSalesMix > 0 && (
                 <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm">
                    <AlertTriangle className="inline h-4 w-4 mr-2"/>
                    Attention : Le total de vos parts des ventes est de {formatNumber(totalSalesMix, 1)}%. Pour une analyse précise, il devrait être de 100%.
                </div>
            )}

        </div>

        {/* Constats : objectifs stratégiques, seuls sous les tuiles (23/11). */}
        <ObjectivesFindings />

        <div className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
            {/* Évolution des KPI globaux (ex-Suivi, fusionné le 24/10 — retour utilisateur,
                positionné au-dessus de la Matrice stratégique des produits). Données ABSENTES tant
                qu'aucun point de référence n'existe : SimpleLineChart affiche alors son propre
                message, jamais un graphique vide forcé. */}
            <div id="tutorial-section-tracking-global" className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Évolution des marges et coûts moyens</h3>
                <p className="text-sm text-gray-500 mb-4">Ce graphique montre l'évolution de vos coûts moyens et de votre marge brute, d'un point de référence à l'autre, pour prendre des décisions éclairées sur vos produits.</p>
                <SimpleLineChart
                    data={globalKpiData}
                    lines={[
                        { dataKey: "Marge Brute Moyenne", color: "#82ca9d", unit: '%' },
                        { dataKey: "Coût Matière Moyen", color: "#ffc658", unit: '%' },
                        { dataKey: "Coût Emballage Moyen", color: "#db2777", unit: '%' },
                        { dataKey: "Coût Main-d'œuvre Moyen", color: "#ff7300", unit: '%' },
                    ]}
                    yAxisLabel="Pourcentage (%)"
                />
            </div>

        </div>

        {/* Constats : amélioration / détérioration, seuls sous l'évolution des marges (23/11). */}
        <EvolutionFindings />
        </>
    );
};

// Matrice stratégique des produits (BCG) — déplacée le 21/11 dans le sous-onglet Portefeuille, en vraie matrice 2 × 2 : popularité en colonnes
// (élevée à gauche, faible à droite), rentabilité en lignes (élevée en haut). Les quatre quadrants sont ceux de l'application (Quadrant).
export const BcgMatrix = ({ analysisData, salesChannels }) => {
    const {
        menuEngineeringData: blendedMenuEngineeringData,
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
    const [bcgChannelId, setBcgChannelId] = useSessionState('summary.bcgChannelId', '');
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
        // Popularité propre au canal choisi (part du volume de CE canal), pas la répartition globale des ventes.
        const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
        rows.forEach(r => { r.popularity = totalVolume > 0 ? (r.volume / totalVolume) * 100 : 0; });
        return computeMenuEngineeringQuadrants(rows);
    }, [bcgChannelId, activeProducts, blendedMenuEngineeringData]);

    const { stars, cows, questions, dogs } = menuEngineeringData;

    if (!analysisData.activeProducts || analysisData.activeProducts.length === 0) return null;

    const axisLabel = 'text-xs font-semibold text-gray-500';
    return (
        <div data-tour="bcg-matrix" className="p-6 bg-gray-50 rounded-xl shadow-inner">
            <h2 data-tour="bcg-title" className="text-2xl font-bold text-gray-800 mb-2">Matrice stratégique des produits</h2>
            <p className="text-sm text-gray-500 mb-4">Classe chaque produit selon sa popularité et sa rentabilité (matrice de Boston Consulting Group).</p>

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
                <Tooltip tip="bcg.selecteur" />
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
                <div />
                <div className={`text-center ${axisLabel}`}>Popularité élevée</div>
                <div className={`text-center ${axisLabel}`}>Popularité faible</div>
                <div className={`flex items-center justify-center ${axisLabel}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Rentabilité élevée</div>
                <Quadrant
                    title="Étoiles"
                    icon={<Star className="mr-2 text-yellow-500"/>}
                    items={stars}
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200"
                    tooltipText="bcg.etoiles"
                />
                <Quadrant
                    title="Dilemmes"
                    icon={<QuestionMark className="mr-2 text-orange-500"/>}
                    items={questions}
                    bgColor="bg-orange-50"
                    borderColor="border-orange-200"
                    tooltipText="bcg.dilemmes"
                />
                <div className={`flex items-center justify-center ${axisLabel}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Rentabilité faible</div>
                <Quadrant
                    title="Vaches à lait"
                    icon={<Milk className="mr-2 text-gray-500"/>}
                    items={cows}
                    bgColor="bg-gray-50"
                    borderColor="border-gray-200"
                    tooltipText="bcg.vaches"
                />
                <Quadrant
                    title="Poids morts"
                    icon={<Bone className="mr-2 text-red-500"/>}
                    items={dogs}
                    bgColor="bg-red-50"
                    borderColor="border-red-200"
                    tooltipText="bcg.poidsMorts"
                />
            </div>
        </div>
    );
};
