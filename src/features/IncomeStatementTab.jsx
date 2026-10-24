import React, { useMemo, useState, lazy, Suspense } from 'react';
import { Trash2, CheckCircle2, AlertCircle, X, Plus, Lock } from 'lucide-react';
import { parseLocaleNumber, isValidNumber, isNotEmpty, formatCurrency, sumLineAmounts, sumAmountsMap, round2, EXPENSE_CATEGORIES, DIRECT_COST_TYPES, UNIT_BASE_FAMILY_LABELS } from '../utils.js';
import { Tooltip } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { indirectCostMethodLabels } from '../state/initialState.js';

// `lazy` : pdfjs-dist (import PDF, Phase 4.7) est une dépendance lourde (~440 kB) — un import
// statique l'aurait inlinée dans le chunk principal chargé au démarrage de l'app, alors qu'elle ne
// sert qu'à l'ouverture de cet assistant. Même patron que SalesReportImportWizardModal dans
// App.jsx (chunk séparé, chargé seulement à l'ouverture).
const IncomeStatementImportWizardModal = lazy(() => import('./IncomeStatementImportWizardModal.jsx').then(m => ({ default: m.IncomeStatementImportWizardModal })));
import {
    computeChannelRevenueShareByActivity, computeRealVsTheoreticalReconciliation,
    buildActivityBuckets, computeBucketTotalsFromAmounts, computeDirectCostLineAllocations,
    computeExpenseLineEffectiveAllocations, computeExpensePoolTotals,
    computeGrossProfitTotals,
    REPARTITION_ACTIVITY_PREFIX, REPARTITION_CHANNEL_PREFIX, REPARTITION_CUSTOM_PREFIX,
} from '../engine/analysisData.js';

// Cellule « — » neutre pour une colonne qui ne s'applique pas à ce tableau (voir
// Projet_Claude/04-Conception-Modele.md, section 1bis : les 3 tableaux de l'État des résultats
// partagent le même jeu de colonnes — Poste/Catégorie/Clé de répartition/Montant — même quand l'une
// d'elles ne sert pas encore à un tableau donné, pour une forme visuelle uniforme).
const PlaceholderCell = () => <span className="text-gray-300">—</span>;

// Phase 4.5bis (corrigé le 14/10) — vérification en temps réel de la répartition d'une ligne de
// frais fixes, comme la colonne « VÉRIFICATION » du chiffrier SymbiOse : UN SEUL bassin partagé,
// pas deux axes indépendants chacun réclamant 100 % du montant. Activités et Canaux sont deux
// GROUPES de contenants dans la MÊME rangée (exactement comme SymbiOse, où « Général/Koji/Tempeh/
// Lacto » et « Marché public/Boutique en ligne/... » sont des colonnes côte à côte d'une seule
// rangée, jamais deux rangées de vérification séparées) — la somme de TOUTES les cellules de la
// ligne (contenants d'activité + contenants de canal confondus) ne doit jamais dépasser le Montant.
// Correction du 14/10 : l'ancien modèle à deux axes indépendants faisait comptabiliser deux fois le
// même montant (une fois « complet » côté Activités, une fois « complet » côté Canaux), ce qui
// aurait faussé l'agrégation en Phase 4.6. Jamais un blocage, uniquement informatif (certaines
// lignes ne s'appliquent naturellement qu'à un sous-ensemble de contenants).
const ALLOCATION_EPSILON = 0.005;
// Familles physiques offertes au CICI « volume » (22/10) : seulement masse/volume — jamais
// 'unité' (discrète, un comptage, aucune taille physique à convertir). Voir
// `computeIndirectDriverValue`, engine/analysisData.js.
const VOLUME_CICI_FAMILIES = ['g', 'ml'];
const AllocationCheckBadge = ({ diff }) => {
    if (Math.abs(diff) < ALLOCATION_EPSILON) {
        return <CheckCircle2 size={14} className="text-green-600 shrink-0" title="Répartition complète : la somme des contenants (Activités + Canaux) égale le Montant." />;
    }
    const message = diff > 0
        ? `Il reste ${formatCurrency(diff)} $ à répartir (Activités + Canaux confondus).`
        : `La répartition dépasse le Montant de ${formatCurrency(Math.abs(diff))} $ (Activités + Canaux confondus).`;
    return <AlertCircle size={14} className="text-amber-500 shrink-0" title={`${message} Purement informatif : rien n'empêche de laisser des contenants non applicables à cette ligne.`} />;
};

// Largeurs de colonne communes aux 3 tableaux zonés (Revenus, Charges directes, Frais fixes) —
// voir IncomeStatementColGroup ci-dessous pour pourquoi ces valeurs doivent vivre dans un
// `<colgroup>` plutôt que sur les `<th>`.
const COL_WIDTH_POSTE = 136;
const COL_WIDTH_CATEGORIE = 136;
const COL_WIDTH_REPARTITION = 136;
const COL_WIDTH_MONTANT = 106;
const COL_WIDTH_BUCKET = 85;
const COL_WIDTH_SPACER = 8;
const COL_WIDTH_ACTIONS = 40;

// `table-layout: fixed` ne lit les largeurs de colonne QUE sur la toute première rangée du
// tableau (ou sur un `<colgroup>`) — jamais sur une rangée suivante. Nos tableaux ont une 1re
// rangée d'en-tête de ZONE avec des cellules `colSpan` (sans largeur individuelle), donc les
// largeurs posées sur la 2e rangée (en-têtes de colonne) étaient silencieusement ignorées par le
// navigateur, qui répartissait l'espace à parts égales entre colonnes non dimensionnées — d'où des
// largeurs identiques malgré des classes `w-[Npx]` différentes (correctif du 13/10, suite à un
// retour utilisateur). Un `<colgroup>` explicite est la seule façon fiable de fixer des largeurs de
// colonne individuelles indépendamment de la structure des rangées d'en-tête.
const IncomeStatementColGroup = ({ activityBuckets, salesChannels }) => (
    <colgroup>
        <col style={{ width: `${COL_WIDTH_POSTE}px` }} />
        <col style={{ width: `${COL_WIDTH_CATEGORIE}px` }} />
        <col style={{ width: `${COL_WIDTH_REPARTITION}px` }} />
        <col style={{ width: `${COL_WIDTH_MONTANT}px` }} />
        <col style={{ width: `${COL_WIDTH_SPACER}px` }} />
        {activityBuckets.map((b) => <col key={b.key} style={{ width: `${COL_WIDTH_BUCKET}px` }} />)}
        {salesChannels.length > 0 && <col style={{ width: `${COL_WIDTH_SPACER}px` }} />}
        {salesChannels.map((c) => <col key={c.id} style={{ width: `${COL_WIDTH_BUCKET}px` }} />)}
        <col style={{ width: `${COL_WIDTH_ACTIONS}px` }} />
    </colgroup>
);

// Barre de synthèse Bénéfice brut/net (20/10, retour utilisateur) : même grille de colonnes ET
// mêmes trois palettes que les rangées « Sous-total » des 3 tableaux ci-dessus (vert pour
// Poste/Montant, jaune pour les activités, bleu pour les canaux — voir IncomeStatementColGroup) —
// une seule ligne mise en évidence entre deux sections. Aucun wrapper `overflow-x-auto` propre
// (retiré le 20/10) : ce tableau partage désormais le scroll horizontal UNIQUE du groupe de
// tableaux de cet onglet (voir plus bas, autour de `tutorial-section-revenue`), pour que ses
// colonnes restent alignées avec celles des autres tableaux pendant le défilement. Même taille de
// police que ces tableaux (`text-xs`, jamais `text-sm`) pour que les montants tiennent sur une
// seule ligne dans des colonnes de largeur fixe identique. `bucketValues`/`channelValues` déjà
// calculés (computeGrossProfitTotals/computeNetProfitTotals) — jamais redérivés ici. Une valeur de
// canal `null` affiche « — » plutôt qu'un 0 forcé (voir le commentaire de ces fonctions).
//
// `showActivityBuckets`/`showSalesChannels` (20/10, retour utilisateur) : Bénéfice brut n'affiche
// plus de donnée par canal (jugée peu fiable à ce niveau — indicative des deux côtés, souvent
// absente) ; Bénéfice net n'affiche plus de donnée ni par activité ni par canal. Les colonnes
// elles-mêmes restent dans la grille (`IncomeStatementColGroup` reçoit toujours les vraies listes)
// pour que la largeur totale — donc l'alignement avec les 3 tableaux voisins dans le scroll
// unique — ne change pas ; seules leur couleur et leur contenu disparaissent pour ce groupe.
const ProfitSummaryBar = ({ label, tooltip, total, activityBuckets, bucketValues, salesChannels, channelValues, showActivityBuckets = true, showSalesChannels = true }) => {
    const hasVisibleChannels = showSalesChannels && salesChannels.length > 0;
    const montantIsLast = !hasVisibleChannels && !(showActivityBuckets && activityBuckets.length > 0);
    return (
    <table className="w-full table-fixed text-xs border-separate border-spacing-0">
        <IncomeStatementColGroup activityBuckets={activityBuckets} salesChannels={salesChannels} />
        <tbody>
            <tr className="font-bold">
                <td colSpan={3} className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-l-lg">
                    <span className="flex items-center justify-end">{label}{tooltip && <Tooltip text={tooltip} />}</span>
                </td>
                <td className={`px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 ${montantIsLast ? 'rounded-r-lg' : ''}`}>{formatCurrency(total)} $</td>
                <td className="w-2 p-0" aria-hidden="true" />
                {activityBuckets.map((b, i) => {
                    const isLast = showActivityBuckets && i === activityBuckets.length - 1 && !hasVisibleChannels;
                    return (
                        <td key={b.key} className={`px-2 py-1.5 text-right text-xs ${showActivityBuckets ? 'text-yellow-800 bg-yellow-50' : ''} ${isLast ? 'rounded-r-lg' : ''}`}>
                            {showActivityBuckets ? `${formatCurrency(bucketValues[b.key] || 0)} $` : ''}
                        </td>
                    );
                })}
                {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                {salesChannels.map((c, i) => {
                    const v = channelValues[c.id];
                    const isLast = showSalesChannels && i === salesChannels.length - 1;
                    return (
                        <td key={c.id} className={`px-2 py-1.5 text-right text-xs italic ${showSalesChannels ? 'text-blue-800 bg-blue-50' : ''} ${isLast ? 'rounded-r-lg' : ''}`}>
                            {showSalesChannels ? (v != null ? `${formatCurrency(v)} $` : '—') : ''}
                        </td>
                    );
                })}
                <td className="px-1 py-1" aria-hidden="true" />
            </tr>
        </tbody>
    </table>
    );
};

// Clés de répartition personnalisées (Phase 4.5, ajouté le 14/10) : gabarits de pourcentages
// réutilisables sur plusieurs lignes de frais fixes — chaque clé définit, INDÉPENDAMMENT, une
// ventilation % pour l'axe Activités et/ou l'axe Canaux (un axe non défini par la clé reste
// simplement libre/Manuel sur les lignes qui l'utilisent — voir expenseLineEffectiveAllocations
// dans IncomeStatementTab). Gérées dans une fenêtre modale dédiée (accessible en haut de l'onglet)
// plutôt qu'en ligne dans le tableau Frais fixes, car une clé est réutilisable sur plusieurs lignes
// — ce n'est pas une donnée propre à une seule ligne, contrairement à activityAllocations/
// channelAllocations.
// Clés par défaut (Manuel mis à part) : jamais modifiables, affichées en lecture seule dans la
// fenêtre modale pour que leur fonctionnement (quelle part va à quelle activité, EN CE MOMENT, vu
// les Revenus/Charges directes réels déjà saisis) soit visible d'un coup d'œil — demandé le 14/10
// après la correction du modèle, pour que « Selon les ventes »/« Selon les charges directes » ne
// restent pas des boîtes noires. Jamais de colonne Canaux : ces deux clés ne répartissent que sur
// l'axe Activités (voir la correction du même jour dans 04-Conception-Modele.md).
const DEFAULT_KEYS = [
    { key: 'sales', name: 'Selon les ventes', hint: "Prorata des revenus réels déjà saisis (section Revenus) — Activités seulement." },
    { key: 'directCosts', name: 'Selon les charges directes', hint: "Prorata des charges directes réelles déjà saisies (section Charges directes réelles) — Activités seulement." },
];

const RepartitionKeysModal = ({ isOpen, onClose, repartitionKeys, onUpdateRepartitionKeys, activityBuckets, salesChannels, bucketTotals, totalRevenue, directCostBucketTotals, totalDirectCosts }) => {
    if (!isOpen) return null;

    const defaultKeyActivityPct = (sourceKey) => {
        const sourceTotal = sourceKey === 'sales' ? totalRevenue : totalDirectCosts;
        const sourceBucketTotals = sourceKey === 'sales' ? bucketTotals : directCostBucketTotals;
        const pct = {};
        if (sourceTotal > 0) {
            activityBuckets.forEach((b) => {
                const share = (sourceBucketTotals[b.key] || 0) / sourceTotal * 100;
                if (share > 0) pct[b.key] = share;
            });
        }
        return pct;
    };

    const handleAddKey = () => {
        const newKey = { id: `rk_${Date.now()}_${Math.random()}`, name: '', activityShares: {}, channelShares: {} };
        onUpdateRepartitionKeys([...repartitionKeys, newKey]);
    };
    const handleRemoveKey = (id) => onUpdateRepartitionKeys(repartitionKeys.filter((k) => k.id !== id));
    const handleNameChange = (id, name) => onUpdateRepartitionKeys(repartitionKeys.map((k) => k.id === id ? { ...k, name } : k));
    const handleActivityShareChange = (id, bucketKey, value) =>
        onUpdateRepartitionKeys(repartitionKeys.map((k) => k.id === id ? { ...k, activityShares: { ...k.activityShares, [bucketKey]: value } } : k));
    const handleActivityShareBlur = (id, bucketKey, value) =>
        onUpdateRepartitionKeys(repartitionKeys.map((k) => k.id === id ? { ...k, activityShares: { ...k.activityShares, [bucketKey]: round2(value) } } : k));
    const handleChannelShareChange = (id, channelId, value) =>
        onUpdateRepartitionKeys(repartitionKeys.map((k) => k.id === id ? { ...k, channelShares: { ...k.channelShares, [channelId]: value } } : k));
    const handleChannelShareBlur = (id, channelId, value) =>
        onUpdateRepartitionKeys(repartitionKeys.map((k) => k.id === id ? { ...k, channelShares: { ...k.channelShares, [channelId]: round2(value) } } : k));

    const sumShares = (shares) => Object.values(shares || {}).reduce((s, v) => s + parseLocaleNumber(v), 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Clés de répartition</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Fermer"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Une clé définit une ventilation en % réutilisable sur plusieurs lignes de frais fixes — sur
                    les activités et/ou les canaux, dans un seul bassin partagé (la somme des deux groupes ne
                    devrait pas dépasser 100 %). Une ligne qui applique cette clé est entièrement verrouillée ;
                    repasser cette ligne en Manuel la rend de nouveau librement modifiable. Les % n'ont pas
                    besoin de totaliser 100 — c'est purement informatif, jamais bloquant.
                </p>

                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clés par défaut (non modifiables)</h4>
                <div className="space-y-3 mb-6">
                    {DEFAULT_KEYS.map((dk) => {
                        const pct = defaultKeyActivityPct(dk.key);
                        return (
                            <div key={dk.key} className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-sm font-medium text-gray-700">{dk.name}</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">{dk.hint}</p>
                                <div className="text-xs font-semibold text-yellow-800 mb-1.5">Activités — part actuelle</div>
                                <div className="space-y-1">
                                    {activityBuckets.map((b) => (
                                        <div key={b.key} className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-gray-600 truncate">{b.label}</span>
                                            <span className="text-xs text-gray-500">{pct[b.key] !== undefined ? `${pct[b.key].toFixed(1)} %` : '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clés personnalisées</h4>
                {repartitionKeys.length === 0 && (
                    <p className="text-sm text-gray-400 italic mb-4">Aucune clé personnalisée pour l'instant.</p>
                )}
                <div className="space-y-6">
                    {repartitionKeys.map((k) => {
                        const activityTotal = sumShares(k.activityShares);
                        const channelTotal = sumShares(k.channelShares);
                        return (
                            <div key={k.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={k.name}
                                        onChange={(e) => handleNameChange(k.id, e.target.value)}
                                        placeholder="Nom de la clé (ex. Équipe de vente)"
                                        className={`flex-1 p-1.5 text-sm border rounded ${!isNotEmpty(k.name) ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    <button onClick={() => handleRemoveKey(k.id)} title="Supprimer cette clé" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs font-semibold text-yellow-800 mb-1.5">Activités — {activityTotal.toFixed(1)} %</div>
                                        <div className="space-y-1">
                                            {activityBuckets.map((b) => (
                                                <div key={b.key} className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-600 truncate">{b.label}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={k.activityShares?.[b.key] ?? ''}
                                                            onChange={(e) => handleActivityShareChange(k.id, b.key, e.target.value)}
                                                            onBlur={(e) => handleActivityShareBlur(k.id, b.key, e.target.value)}
                                                            className="w-16 p-1 text-xs border border-gray-300 rounded text-right"
                                                        />
                                                        <span className="text-xs text-gray-400">%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-blue-800 mb-1.5">Canaux — {channelTotal.toFixed(1)} %</div>
                                        <div className="space-y-1">
                                            {salesChannels.length === 0 && <p className="text-xs text-gray-400 italic">Aucun canal de vente défini.</p>}
                                            {salesChannels.map((c) => (
                                                <div key={c.id} className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-600 truncate">{c.name}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={k.channelShares?.[c.id] ?? ''}
                                                            onChange={(e) => handleChannelShareChange(k.id, c.id, e.target.value)}
                                                            onBlur={(e) => handleChannelShareBlur(k.id, c.id, e.target.value)}
                                                            className="w-16 p-1 text-xs border border-gray-300 rounded text-right"
                                                        />
                                                        <span className="text-xs text-gray-400">%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button onClick={handleAddKey} className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={14} /> Ajouter une clé
                </button>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

// État des résultats (ex-« Frais fixes », renommé le 12/10 — voir
// Projet_Claude/04-Conception-Modele.md section 1bis) : revenus réels et frais fixes réels,
// chacun catégorisé/réparti par ligne. Le total de chaque section n'est affiché qu'une fois,
// dans la rangée « Sous-total » du tableau (pas de bloc de total redondant sous le tableau —
// retiré le 13/10, de même que l'encadré gris derrière chaque section, à la demande de
// l'utilisateur ; seule la section Réconciliation garde son encadré).
// `generalInfo.totalIndirects` reste entièrement dérivé des lignes de frais fixes (Phase 4.1) ;
// les revenus réels (Phase 4.2) ne sont pas encore consommés par le moteur de calcul (données + UI
// seulement à ce stade, comme `expenseLines` en 4.1).
//
// Revenus — grille de contenants (révisé le 13/10, inspiré de la colonne « Répartition » de
// l'Agro-Calculateur MAPAQ, onglet Rev-Dep) : chaque ligne choisit une **répartition** — Général,
// une activité précise, ou « Saisie manuelle ». Hors saisie manuelle, le montant édité dans la
// colonne Montant s'affiche tel quel dans la seule colonne de contenant correspondante (les autres
// marquent « — ») ; en saisie manuelle, c'est l'inverse : chaque colonne de contenant (Général +
// activités) devient directement éditable, et Montant devient un total calculé en lecture seule.
// Les colonnes par canal restent purement indicatives (jamais un intrant de calcul) et se calculent
// maintenant sur la somme des contenants non-Général de la ligne (généralisation qui couvre aussi
// bien une ligne à un seul contenant qu'une ligne en saisie manuelle répartie sur plusieurs).
export const IncomeStatementTab = () => {
    const {
        expenseLines, onUpdateExpenseLines, revenueLines, onUpdateRevenueLines,
        directCostLines, onUpdateDirectCostLines,
        repartitionKeys, onUpdateRepartitionKeys,
        productionActivities, onUpdateProductionActivities, salesChannels, analysisData, generalInfo, onUpdateGeneralInfo, showNotification, setNotification,
    } = useProject();
    const [showRepartitionKeysModal, setShowRepartitionKeysModal] = useState(false);
    const [showImportWizard, setShowImportWizard] = useState(false);

    const totalRevenue = useMemo(
        () => revenueLines.reduce((sum, line) => sum + sumAmountsMap(line.amounts), 0),
        [revenueLines]
    );

    // Ventilation par canal INDICATIVE uniquement (jamais un intrant de calcul — voir
    // computeChannelRevenueShareByActivity).
    const channelShareByActivity = useMemo(
        () => computeChannelRevenueShareByActivity(analysisData.productsWithCosts, salesChannels),
        [analysisData.productsWithCosts, salesChannels]
    );

    const handleAddRevenueLine = () => {
        const newLine = { id: `rev_${Date.now()}_${Math.random()}`, label: '', repartition: 'general', amounts: { general: 0 } };
        onUpdateRevenueLines([...revenueLines, newLine]);
    };

    const handleRevenueLabelChange = (id, value) => {
        onUpdateRevenueLines(revenueLines.map(line => line.id === id ? { ...line, label: value } : line));
    };

    // Change la répartition d'une ligne : hors saisie manuelle, le total courant est refondu dans
    // le nouveau contenant choisi (une seule clé non nulle) — en saisie manuelle, les montants déjà
    // saisis par contenant sont conservés tels quels, modifiables ensuite cellule par cellule.
    const handleRevenueRepartitionChange = (id, newRepartition) => {
        onUpdateRevenueLines(revenueLines.map(line => {
            if (line.id !== id) return line;
            if (newRepartition === 'manual') return { ...line, repartition: newRepartition };
            return { ...line, repartition: newRepartition, amounts: { [newRepartition]: sumAmountsMap(line.amounts) } };
        }));
    };

    // Montant (hors saisie manuelle uniquement) : seule clé = le contenant choisi par la répartition.
    const handleRevenueMontantChange = (id, value) => {
        onUpdateRevenueLines(revenueLines.map(line => line.id === id ? { ...line, amounts: { [line.repartition]: value } } : line));
    };
    const handleRevenueMontantBlur = (id, value) => {
        onUpdateRevenueLines(revenueLines.map(line => line.id === id ? { ...line, amounts: { [line.repartition]: parseLocaleNumber(value) } } : line));
    };

    // Saisie manuelle uniquement : une cellule par contenant, indépendante des autres.
    const handleRevenueBucketChange = (id, bucketKey, value) => {
        onUpdateRevenueLines(revenueLines.map(line => line.id === id ? { ...line, amounts: { ...line.amounts, [bucketKey]: value } } : line));
    };
    const handleRevenueBucketBlur = (id, bucketKey, value) => {
        onUpdateRevenueLines(revenueLines.map(line => line.id === id ? { ...line, amounts: { ...line.amounts, [bucketKey]: parseLocaleNumber(value) } } : line));
    };

    const handleRemoveRevenueLine = (id) => {
        const lineToDelete = revenueLines.find(line => line.id === id);
        const originalList = [...revenueLines];
        onUpdateRevenueLines(revenueLines.filter(line => line.id !== id));
        showNotification({
            message: `Le revenu "${lineToDelete.label || 'Sans nom'}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdateRevenueLines(originalList);
                setNotification(null);
            }
        });
    };

    const handleAddExpenseLine = () => {
        const newLine = { id: `exp_${Date.now()}_${Math.random()}`, label: '', category: EXPENSE_CATEGORIES[0], amount: 0, repartitionKey: 'manual', activityAllocations: {}, channelAllocations: {} };
        onUpdateExpenseLines([...expenseLines, newLine]);
    };

    const handleExpenseLineChange = (id, field, value) => {
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, [field]: value } : line));
    };

    const handleRemoveExpenseLine = (id) => {
        const lineToDelete = expenseLines.find(line => line.id === id);
        const originalList = [...expenseLines];
        onUpdateExpenseLines(expenseLines.filter(line => line.id !== id));
        showNotification({
            message: `La dépense "${lineToDelete.label || 'Sans nom'}" a été supprimée.`,
            type: 'info',
            onUndo: () => {
                onUpdateExpenseLines(originalList);
                setNotification(null);
            }
        });
    };

    const totalDirectCosts = useMemo(() => sumLineAmounts(directCostLines), [directCostLines]);

    const handleAddDirectCostLine = () => {
        const newLine = { id: `dc_${Date.now()}_${Math.random()}`, label: '', category: DIRECT_COST_TYPES[0], amount: 0 };
        onUpdateDirectCostLines([...directCostLines, newLine]);
    };

    const handleDirectCostLineChange = (id, field, value) => {
        onUpdateDirectCostLines(directCostLines.map(line => line.id === id ? { ...line, [field]: value } : line));
    };

    const handleRemoveDirectCostLine = (id) => {
        const lineToDelete = directCostLines.find(line => line.id === id);
        const originalList = [...directCostLines];
        onUpdateDirectCostLines(directCostLines.filter(line => line.id !== id));
        showNotification({
            message: `La charge directe "${lineToDelete.label || 'Sans nom'}" a été supprimée.`,
            type: 'info',
            onUndo: () => {
                onUpdateDirectCostLines(originalList);
                setNotification(null);
            }
        });
    };

    // Phase 4.7 — assistant d'import de l'état des résultats : chaque ligne importée devient une
    // ligne de Revenus ou de Frais fixes « normale », immédiatement éditable comme si elle avait
    // été saisie à la main. Additif (par défaut) concatène aux lignes existantes ; Remplacer
    // écrase les DEUX tableaux par le contenu de ce fichier (choix explicite de l'utilisateur à
    // l'étape 4 du wizard — un état des résultats importé est traité comme la nouvelle source de
    // vérité complète, pas une correction partielle).
    const handleImportComplete = ({ revenueItems, expenseItems, mode, newStartDate, newEndDate }) => {
        const newRevenueLines = revenueItems.map((item, i) => ({
            id: `rev_import_${Date.now()}_${i}`, label: item.label, repartition: item.activityKey, amounts: { [item.activityKey]: item.amount },
        }));
        const newExpenseLines = expenseItems.map((item, i) => ({
            id: `exp_import_${Date.now()}_${i}`, label: item.label, category: item.category, amount: item.amount, repartitionKey: 'manual', activityAllocations: {}, channelAllocations: {},
        }));
        onUpdateRevenueLines(mode === 'replace' ? newRevenueLines : [...revenueLines, ...newRevenueLines]);
        onUpdateExpenseLines(mode === 'replace' ? newExpenseLines : [...expenseLines, ...newExpenseLines]);
        // Période de référence (18/10) : détectée automatiquement depuis les dates du fichier
        // (colonne Date, fichier structuré seulement — un PDF textuel n'a pas de colonne par
        // ligne, voir IncomeStatementImportWizardModal.jsx), même patron que l'import de rapport
        // de ventes (App.jsx::handleSalesReportImport). N'écrase rien si le fichier n'a pas de
        // date reconnue.
        if (newStartDate) onUpdateGeneralInfo('startDate', newStartDate);
        if (newEndDate) onUpdateGeneralInfo('endDate', newEndDate);
        showNotification({ message: `${newRevenueLines.length} revenu(s) et ${newExpenseLines.length} dépense(s) importé(s).`, type: 'success' });
    };

    // Colonnes « Activités de production » — partagées par Revenus et Charges directes réelles
    // (même liste : Général + chaque activité), d'où le nom générique.
    const activityBuckets = useMemo(() => buildActivityBuckets(productionActivities), [productionActivities]);

    // CICI par activité (centralisé ici le 22/10, retour utilisateur — vivait auparavant dans
    // Paramètres → Activités de production, au même endroit que le nom/la suppression de
    // l'activité ; mélangeait une décision structurelle (qu'est-ce qui existe) avec une décision
    // de méthode comptable (comment répartir un coût), voir section Coefficient d'imputation des
    // charges indirectes plus bas). Propre à chaque activité : deux activités peuvent choisir des
    // drivers différents sans que la réconciliation en souffre (chaque pool se normalise contre
    // ses propres produits — voir 04-Conception-Modele.md).
    const handleActivityDriverChange = (id, indirectCostDriver) => {
        onUpdateProductionActivities(productionActivities.map(a => a.id === id ? { ...a, indirectCostDriver } : a));
    };

    // Famille physique (masse 'g' / volume 'ml') du driver « volume » de CETTE activité — propre à
    // chaque activité, comme le driver lui-même (voir ci-dessus) ; n'a d'effet que si
    // `indirectCostDriver === 'volume'` (ignorée sinon, jamais effacée au changement de driver, pour
    // ne pas perdre le choix si l'utilisateur revient à « volume » ensuite).
    const handleActivityVolumeUnitChange = (id, indirectCostVolumeUnit) => {
        onUpdateProductionActivities(productionActivities.map(a => a.id === id ? { ...a, indirectCostVolumeUnit } : a));
    };

    // Sous-totaux par colonne (bas du tableau Revenus) : un sous-total par contenant (Général +
    // chaque activité) et, indicativement, un sous-total par canal — distinct du total global
    // affiché sous le tableau (qui reste la somme de tous les contenants, donc égal au sous-total
    // Montant ci-dessous). Extrait en fonction pure (engine/analysisData.js, 14/10) : App.jsx en a
    // aussi besoin pour construire les pools Général/Activité/Canal de la Phase 4.6.
    const bucketTotals = useMemo(() => computeBucketTotalsFromAmounts(revenueLines, activityBuckets), [revenueLines, activityBuckets]);

    const channelTotals = useMemo(() => {
        const totals = {};
        salesChannels.forEach((c) => {
            let total = 0;
            let hasShare = false;
            revenueLines.forEach((line) => {
                for (const [bucketKey, amt] of Object.entries(line.amounts || {})) {
                    if (bucketKey === 'general') continue;
                    const s = channelShareByActivity[bucketKey]?.find((x) => x.channelId === c.id);
                    if (s) { total += parseLocaleNumber(amt) * s.share; hasShare = true; }
                }
            });
            totals[c.id] = { total, hasShare };
        });
        return totals;
    }, [revenueLines, salesChannels, channelShareByActivity]);

    // Phase 4.3bis — Charges directes réelles : ventilation indicative par activité puis par canal
    // de vente, dérivée du coût théorique apparié au type de coût de CHAQUE ligne. Extrait en
    // fonction pure (engine/analysisData.js, 14/10) : App.jsx en a aussi besoin (pool Général de la
    // Phase 4.6, clé « Selon les charges directes »), sans dupliquer cette logique une 2e fois.
    const { directCostLineAllocations, directCostBucketTotals, directCostChannelTotals } = useMemo(
        () => computeDirectCostLineAllocations(directCostLines, analysisData.productsWithCosts, activityBuckets, salesChannels),
        [directCostLines, analysisData.productsWithCosts, activityBuckets, salesChannels]
    );

    // Phase 4.5 — Frais fixes : allocation manuelle $ par contenant, sur deux axes INDÉPENDANTS
    // (Activités, Canaux — voir 04-Conception-Modele.md, section 1 : Général n'est pas un 3e axe
    // symétrique, c'est une allocation directe au sein de l'axe Activités). Montant reste saisi
    // indépendamment (pas dérivé de la somme des contenants, contrairement à Revenus en Saisie
    // manuelle) — les contenants sont une VENTILATION de ce montant, vérifiée mais jamais forcée.
    const handleExpenseActivityAllocationChange = (id, bucketKey, value) => {
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, activityAllocations: { ...line.activityAllocations, [bucketKey]: value } } : line));
    };
    const handleExpenseActivityAllocationBlur = (id, bucketKey, value) => {
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, activityAllocations: { ...line.activityAllocations, [bucketKey]: round2(value) } } : line));
    };
    const handleExpenseChannelAllocationChange = (id, channelId, value) => {
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, channelAllocations: { ...line.channelAllocations, [channelId]: value } } : line));
    };
    const handleExpenseChannelAllocationBlur = (id, channelId, value) => {
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, channelAllocations: { ...line.channelAllocations, [channelId]: round2(value) } } : line));
    };

    // « Clé de répartition » (révisé le 14/10, corrigé le même jour) : au-delà de Manuel/Selon les
    // ventes/Selon les charges directes, la liste propose aussi un contenant PRÉCIS — une activité
    // (dont Général) ou un canal — pour les dépenses attribuables à une seule colonne (comme la
    // colonne « Répartition » de l'Agro-Calculateur, onglet Rev-Dep), ainsi que des clés
    // personnalisées (RepartitionKeysModal, plus bas).
    //
    // CORRECTION (retour utilisateur du 14/10) : Activités et Canaux sont UN SEUL bassin partagé —
    // pas deux axes indépendants réclamant chacun 100 % du montant (voir le commentaire détaillé
    // sur AllocationCheckBadge plus haut). Toute clé verrouille donc la ligne ENTIÈRE (pas un axe à
    // la fois) :
    //  - Selon les ventes / Selon les charges directes : répartit UNIQUEMENT sur l'axe Activités (au
    //    prorata des revenus/charges directes réels déjà saisis) — jamais sur Canaux. La ventilation
    //    par canal des Revenus/Charges directes réelles est explicitement INDICATIVE (jamais un
    //    intrant de calcul, voir ces sections plus haut) ; la réutiliser ici en ferait, à tort, une
    //    donnée réelle, et doublerait la comptabilisation du montant si les deux axes étaient
    //    sommés ensemble en Phase 4.6.
    //  - Une activité précise : 100 % du montant dans cette seule colonne d'activité, rien côté canal.
    //  - Un canal précis : 100 % du montant dans cette seule colonne de canal, rien côté activité.
    //    C'est la SEULE façon d'attribuer un montant à un canal par une clé prédéfinie — jamais via
    //    Selon les ventes/charges directes (qui ne touchent que l'axe Activités).
    //  - Une clé personnalisée : répartit selon les % qu'elle définit, sur l'un ou l'autre groupe de
    //    contenants (ou les deux, si la clé définit les deux) — toujours au sein du même bassin.
    //
    // Tant que la clé n'est pas Manuel, la grille n'est PLUS une valeur stockée : elle est recalculée
    // en direct à chaque rendu par expenseLineEffectiveAllocations ci-dessous, à partir du Montant
    // courant — pour ne jamais figer un nombre qui deviendrait faux si le Montant change ensuite
    // (ce que l'ancien pré-remplissage ponctuel ne garantissait pas). Revenir à Manuel fige (« bake
    // in ») la dernière valeur calculée comme point de départ éditable (Activités et Canaux
    // redeviennent alors librement modifiables, ensemble, sans qu'un total combiné ne soit imposé —
    // purement informatif, jamais un blocage). Extrait en fonction pure (engine/analysisData.js,
    // 14/10) : App.jsx en a aussi besoin pour construire les pools de la Phase 4.6, sans dupliquer
    // cette logique une 2e fois.
    const expenseLineEffectiveAllocations = useMemo(() => computeExpenseLineEffectiveAllocations({
        expenseLines, repartitionKeys, activityBuckets, salesChannels, totalRevenue, totalDirectCosts, bucketTotals, directCostBucketTotals,
    }), [expenseLines, repartitionKeys, activityBuckets, salesChannels, totalRevenue, totalDirectCosts, bucketTotals, directCostBucketTotals]);

    const handleExpenseRepartitionKeyChange = (id, key) => {
        if (key === 'manual') {
            const effective = expenseLineEffectiveAllocations[id];
            onUpdateExpenseLines(expenseLines.map(line => line.id === id
                ? { ...line, repartitionKey: 'manual', activityAllocations: effective?.activityAllocations || line.activityAllocations || {}, channelAllocations: effective?.channelAllocations || line.channelAllocations || {} }
                : line));
            return;
        }
        onUpdateExpenseLines(expenseLines.map(line => line.id === id ? { ...line, repartitionKey: key } : line));
    };

    // Un seul écart par ligne (pas un par axe) : la somme de TOUS les contenants (Activités +
    // Canaux confondus) comparée au Montant — voir la correction du 14/10 documentée plus haut.
    const expenseLineVerifications = useMemo(() => {
        const map = {};
        expenseLines.forEach((line) => {
            const amount = parseLocaleNumber(line.amount);
            const effective = expenseLineEffectiveAllocations[line.id];
            map[line.id] = { diff: amount - sumAmountsMap(effective?.activityAllocations) - sumAmountsMap(effective?.channelAllocations) };
        });
        return map;
    }, [expenseLines, expenseLineEffectiveAllocations]);

    const { activityPoolTotals: expenseBucketTotals, channelPoolTotals: expenseChannelTotals } = useMemo(
        () => computeExpensePoolTotals(expenseLines, expenseLineEffectiveAllocations, activityBuckets, salesChannels),
        [expenseLines, expenseLineEffectiveAllocations, activityBuckets, salesChannels]
    );

    // Phase 4.4bis (20/10) — Bénéfice brut (sous Charges directes réelles), ventilé par activité
    // (voir ProfitSummaryBar) comme les 3 tableaux ci-dessus. Sa ventilation par canal a été
    // retirée le 20/10 (retour utilisateur), ainsi que toute ventilation (activité ET canal) pour
    // Bénéfice net — qui n'affiche donc plus qu'un total entreprise, sans passer par
    // `computeNetProfitTotals` (resté exporté dans analysisData.js, toujours testé, simplement
    // plus consommé ici).
    const grossProfit = useMemo(
        () => computeGrossProfitTotals({ activityBuckets, salesChannels, bucketTotals, directCostBucketTotals, channelTotals, directCostChannelTotals }),
        [activityBuckets, salesChannels, bucketTotals, directCostBucketTotals, channelTotals, directCostChannelTotals]
    );
    const grossProfitTotal = totalRevenue - totalDirectCosts;
    const netProfitTotal = grossProfitTotal - parseLocaleNumber(generalInfo.totalIndirects);

    // Phase 4.4 — Tableau de réconciliation réel/théorique, au niveau de l'entreprise entière.
    const reconciliation = useMemo(
        () => computeRealVsTheoreticalReconciliation({
            totalRevenue, totalDirectCosts,
            activeProducts: analysisData.activeProducts, unitsSoldById: analysisData.unitsSoldById,
            menuRevenue: analysisData.menuRevenue, totalIndirects: generalInfo.totalIndirects,
        }),
        [totalRevenue, totalDirectCosts, analysisData.activeProducts, analysisData.unitsSoldById, analysisData.menuRevenue, generalInfo.totalIndirects]
    );

    return (
        <div id="tutorial-section-income-statement" className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-[1600px] space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800">État des résultats</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImportWizard(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700"
                    >
                        Importer l'état des résultats
                    </button>
                    <button
                        onClick={() => setShowRepartitionKeysModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600"
                    >
                        Gérer les clés de répartition
                    </button>
                </div>
            </div>
            {/* Période de référence (déplacée de Paramètres le 18/10 — voir
                Projet_Claude/03-Feuille-de-route.md) : tout en haut, avant Revenus — ce que
                couvrent les lignes ci-dessous dépend de cette période, pas l'inverse. Toujours
                personnalisée depuis le 22/10 (sélecteur semaine/mois/trimestre/année retiré) :
                une seule plage de dates, jamais une étiquette approximative qui ne correspond à
                aucune date précise — `generalInfo.period` reste 'custom' en interne (voir
                initialState.js), mais ce choix n'est plus exposé à l'utilisateur. */}
            <div id="tutorial-section-income-statement-period" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-gray-100 rounded-lg">
                <div className="md:col-span-2 flex items-center text-sm font-medium text-gray-700">
                    Période de référence
                    <Tooltip text="La plage de dates précise sur laquelle vos revenus et frais fixes ci-dessous sont basés. L'assistant d'import (bouton ci-dessus) la détecte et la renseigne automatiquement à partir des dates du fichier, quand elles y figurent." />
                </div>
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Date de début</label>
                    <input type="date" id="startDate" value={generalInfo.startDate || ''} onChange={(e) => onUpdateGeneralInfo('startDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Date de fin</label>
                    <input type="date" id="endDate" value={generalInfo.endDate || ''} onChange={(e) => onUpdateGeneralInfo('endDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                </div>
            </div>
            {showImportWizard && (
                <Suspense fallback={null}>
                    <IncomeStatementImportWizardModal
                        isOpen={showImportWizard}
                        onClose={() => setShowImportWizard(false)}
                        onImportComplete={handleImportComplete}
                        productsWithCosts={analysisData.productsWithCosts}
                        activityBuckets={activityBuckets}
                    />
                </Suspense>
            )}
            <RepartitionKeysModal
                isOpen={showRepartitionKeysModal}
                onClose={() => setShowRepartitionKeysModal(false)}
                repartitionKeys={repartitionKeys}
                onUpdateRepartitionKeys={onUpdateRepartitionKeys}
                activityBuckets={activityBuckets}
                salesChannels={salesChannels}
                bucketTotals={bucketTotals}
                totalRevenue={totalRevenue}
                directCostBucketTotals={directCostBucketTotals}
                totalDirectCosts={totalDirectCosts}
            />

            {/* Scroll horizontal UNIQUE pour tout ce groupe (20/10, retour utilisateur) : Revenus,
                Charges directes réelles, Bénéfice brut, Frais fixes, Bénéfice net partagent tous
                la même grille de colonnes (IncomeStatementColGroup) — chacun avait son propre
                `overflow-x-auto` avant, donc faire défiler l'un ne faisait pas suivre les autres,
                et une même colonne (ex. un canal précis) pouvait se retrouver désalignée d'un
                tableau à l'autre après un défilement indépendant. Un seul conteneur de défilement
                ici, partagé par les 5 — jamais par la Réconciliation plus bas, qui a sa propre
                grille de colonnes (Poste/Réel/Théorique/Écart), sans rapport avec celle-ci. Le
                `space-y-8` interne reproduit l'espacement que ce groupe aurait eu comme enfants
                directs du conteneur `space-y-8` englobant (voir plus haut), puisqu'il n'en est
                plus qu'un seul enfant direct lui-même. */}
            <div className="overflow-x-auto">
            <div className="space-y-8">
            <div id="tutorial-section-revenue">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center mb-4">
                    Revenus
                    <Tooltip text="Vos revenus réels (tels qu'ils apparaissent dans votre vraie comptabilité). Choisissez une répartition par ligne : Général (non rattachable à une activité précise), une activité de production précise, ou Saisie manuelle pour ventiler librement entre plusieurs contenants à la fois. Les colonnes par canal sont une estimation dérivée du mix de vente, jamais une donnée réelle — à titre indicatif seulement, pas un calcul." />
                </h2>
                {revenueLines.length > 0 ? (
                        <table className="w-full table-fixed text-xs border-separate border-spacing-0">
                            <IncomeStatementColGroup activityBuckets={activityBuckets} salesChannels={salesChannels} />
                            <thead>
                                <tr>
                                    <th colSpan={4} className="px-2 py-1.5 text-center text-xs font-bold text-green-700 uppercase bg-green-50 rounded-t-lg">&nbsp;</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    <th colSpan={activityBuckets.length} className="px-2 py-1.5 text-center text-xs font-bold text-yellow-700 uppercase bg-yellow-50 rounded-t-lg">Activités de production</th>
                                    {salesChannels.length > 0 && (
                                        <>
                                            <th className="w-2 p-0" aria-hidden="true" />
                                            <th colSpan={salesChannels.length} className="px-2 py-1.5 text-center text-xs font-bold text-blue-700 uppercase bg-blue-50 rounded-t-lg">
                                                <span className="flex items-center justify-center">
                                                    Canaux de vente (indicatif)
                                                    <Tooltip text="Estimée automatiquement à partir du mix de vente déclaré (channelPrices). Jamais une donnée saisie ni un intrant de calcul — uniquement informatif." />
                                                </span>
                                            </th>
                                        </>
                                    )}
                                    <th rowSpan={2} className="w-10 px-1 py-1" aria-hidden="true" />
                                </tr>
                                <tr>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Poste de revenu</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Catégorie
                                            <Tooltip text="Les revenus n'ont pas de catégorie comptable à classer, contrairement aux charges ci-dessous — cette colonne existe pour que les 3 tableaux de cet onglet gardent la même forme. Rien à saisir ici." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Clé de répartition
                                            <Tooltip text="Où compter ce revenu : Général (non rattachable à une activité de production précise), une activité précise, ou Saisie manuelle pour répartir un même revenu entre plusieurs activités à la fois." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Montant ($)</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b) => (
                                        <th key={b.key} className="px-2 py-1 text-center text-xs font-normal text-yellow-800 bg-yellow-50">
                                            {b.key === 'general' ? (
                                                <span className="flex items-center justify-center">
                                                    {b.label}
                                                    <Tooltip text="Part du revenu non rattachable à une activité de production précise (ex. revenus divers, intérêts)." />
                                                </span>
                                            ) : b.label}
                                        </th>
                                    ))}
                                    {salesChannels.length > 0 && <th className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c) => (
                                        <th key={c.id} className="px-2 py-1 text-center text-xs font-normal italic text-blue-800 bg-blue-50">{c.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {revenueLines.map((line) => {
                                    const isManual = line.repartition === 'manual';
                                    const lineTotal = sumAmountsMap(line.amounts);
                                    const rowBorder = 'border-b border-gray-200';
                                    return (
                                        <tr key={line.id}>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <input
                                                    type="text"
                                                    value={line.label}
                                                    onChange={(e) => handleRevenueLabelChange(line.id, e.target.value)}
                                                    placeholder="Poste de revenu"
                                                    title={line.label}
                                                    className={`w-full p-1 text-xs border rounded ${!isNotEmpty(line.label) ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </td>
                                            <td className={`px-2 py-1 text-center bg-green-50 ${rowBorder}`}><PlaceholderCell /></td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <select
                                                    value={line.repartition}
                                                    onChange={(e) => handleRevenueRepartitionChange(line.id, e.target.value)}
                                                    className="w-full p-1 text-xs border border-gray-300 rounded"
                                                >
                                                    {activityBuckets.map((b) => (
                                                        <option key={b.key} value={b.key}>{b.label}</option>
                                                    ))}
                                                    <option value="manual">Saisie manuelle</option>
                                                </select>
                                            </td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                {isManual ? (
                                                    <span className="block w-full p-1 text-xs text-right font-semibold text-gray-800">{formatCurrency(lineTotal)} $</span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={line.amounts[line.repartition] ?? ''}
                                                        onChange={(e) => handleRevenueMontantChange(line.id, e.target.value)}
                                                        onBlur={(e) => handleRevenueMontantBlur(line.id, e.target.value)}
                                                        placeholder="Montant ($)"
                                                        className={`w-full p-1 text-xs border rounded text-right ${!isValidNumber(line.amounts[line.repartition]) ? 'border-red-500' : 'border-gray-300'}`}
                                                    />
                                                )}
                                            </td>
                                            <td className="w-2 p-0" aria-hidden="true" />
                                            {activityBuckets.map((b) => {
                                                return (
                                                    <td key={b.key} className={`px-2 py-1 text-right text-xs bg-yellow-50 ${rowBorder}`}>
                                                        {isManual ? (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={line.amounts[b.key] ?? ''}
                                                                onChange={(e) => handleRevenueBucketChange(line.id, b.key, e.target.value)}
                                                                onBlur={(e) => handleRevenueBucketBlur(line.id, b.key, e.target.value)}
                                                                className="w-full p-1 text-xs border border-gray-300 rounded text-right"
                                                            />
                                                        ) : (
                                                            <span className={b.key === line.repartition ? 'font-medium text-gray-800' : 'text-gray-400'}>
                                                                {b.key === line.repartition ? `${formatCurrency(lineTotal)} $` : '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                            {salesChannels.map((c) => {
                                                let channelTotal = 0;
                                                let hasShare = false;
                                                for (const [bucketKey, amt] of Object.entries(line.amounts || {})) {
                                                    if (bucketKey === 'general') continue;
                                                    const s = channelShareByActivity[bucketKey]?.find((x) => x.channelId === c.id);
                                                    if (s) { channelTotal += parseLocaleNumber(amt) * s.share; hasShare = true; }
                                                }
                                                return (
                                                    <td key={c.id} className={`px-2 py-1 text-right text-xs text-gray-500 italic bg-blue-50 ${rowBorder}`}>
                                                        {hasShare ? `${formatCurrency(channelTotal)} $` : '—'}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-1 py-1 text-center">
                                                <button onClick={() => handleRemoveRevenueLine(line.id)} title="Supprimer ce revenu" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold">
                                    <td colSpan={3} className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-bl-lg">Sous-total</td>
                                    <td className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-br-lg">{formatCurrency(totalRevenue)} $</td>
                                    <td className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === activityBuckets.length - 1;
                                        return (
                                            <td key={b.key} className={`px-2 py-1.5 text-right text-xs text-yellow-800 bg-yellow-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {formatCurrency(bucketTotals[b.key])} $
                                            </td>
                                        );
                                    })}
                                    {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === salesChannels.length - 1;
                                        const ct = channelTotals[c.id];
                                        return (
                                            <td key={c.id} className={`px-2 py-1.5 text-right text-xs italic text-blue-800 bg-blue-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {ct.hasShare ? `${formatCurrency(ct.total)} $` : '—'}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1 py-1" aria-hidden="true" />
                                </tr>
                            </tfoot>
                        </table>
                ) : (
                    <p className="text-sm text-gray-500 italic">Aucun revenu listé — ajoutez-en un pour commencer.</p>
                )}
                <button onClick={handleAddRevenueLine} className="mt-4 text-sm text-blue-600 hover:text-blue-800">
                    + Ajouter un revenu
                </button>
            </div>

            <div id="tutorial-section-direct-costs">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center mb-4">
                    Charges directes réelles
                    <Tooltip text="Vos charges directes réelles (telles qu'elles apparaissent dans votre vraie comptabilité), ventilées par type de coût — pas par les catégories de frais fixes ci-dessous. Sert au diagnostic réel vs théorique (comparaison avec le coût de revient calculé par le modèle de recette) ; n'entre pas encore dans un calcul en aval." />
                </h2>
                {directCostLines.length > 0 ? (
                        <table className="w-full table-fixed text-xs border-separate border-spacing-0">
                            <IncomeStatementColGroup activityBuckets={activityBuckets} salesChannels={salesChannels} />
                            <thead>
                                <tr>
                                    <th colSpan={4} className="px-2 py-1.5 text-center text-xs font-bold text-green-700 uppercase bg-green-50 rounded-t-lg">&nbsp;</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    <th colSpan={activityBuckets.length} className="px-2 py-1.5 text-center text-xs font-bold text-yellow-700 uppercase bg-yellow-50 rounded-t-lg">
                                        <span className="flex items-center justify-center">
                                            Activités de production (indicatif)
                                            <Tooltip text="Estimée automatiquement à partir du coût théorique du modèle de recette, apparié au type de coût de la ligne (matière première, main-d'œuvre directe, emballage ou sous-traitance) — jamais une donnée saisie ni un intrant de calcul. Une ligne sans aucune donnée théorique de ce type retombe sur Général." />
                                        </span>
                                    </th>
                                    {salesChannels.length > 0 && (
                                        <>
                                            <th className="w-2 p-0" aria-hidden="true" />
                                            <th colSpan={salesChannels.length} className="px-2 py-1.5 text-center text-xs font-bold text-blue-700 uppercase bg-blue-50 rounded-t-lg">
                                                <span className="flex items-center justify-center">
                                                    Canaux de vente (indicatif)
                                                    <Tooltip text="Estimée automatiquement à partir du coût théorique et du volume réel par canal — jamais une donnée saisie ni un intrant de calcul. Uniquement informatif." />
                                                </span>
                                            </th>
                                        </>
                                    )}
                                    <th rowSpan={2} className="w-10 px-1 py-1" aria-hidden="true" />
                                </tr>
                                <tr>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Poste de charge directe</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Catégorie
                                            <Tooltip text="Le type de dépense selon sa nature : Matière première (ingrédients), Main-d'œuvre directe (salaires de production), Emballage, ou Sous-traitance (services externes de production)." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Clé de répartition
                                            <Tooltip text="Non applicable ici : contrairement aux revenus, la répartition par activité et par canal (colonnes de droite) se calcule automatiquement à partir du type de coût choisi — rien à saisir dans cette colonne." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Montant ($)</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b) => (
                                        <th key={b.key} className="px-2 py-1 text-center text-xs font-normal text-yellow-800 bg-yellow-50">
                                            {b.key === 'general' ? (
                                                <span className="flex items-center justify-center">
                                                    {b.label}
                                                    <Tooltip text="Part de la charge qui n'a pas pu être rattachée à une activité précise — aucune recette n'a de coût théorique de ce type pour en dériver la répartition." />
                                                </span>
                                            ) : b.label}
                                        </th>
                                    ))}
                                    {salesChannels.length > 0 && <th className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c) => (
                                        <th key={c.id} className="px-2 py-1 text-center text-xs font-normal italic text-blue-800 bg-blue-50">{c.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {directCostLineAllocations.map(({ line, activityAmounts, channelAmounts }) => {
                                    const rowBorder = 'border-b border-gray-200';
                                    return (
                                        <tr key={line.id}>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <input
                                                    type="text"
                                                    value={line.label}
                                                    onChange={(e) => handleDirectCostLineChange(line.id, 'label', e.target.value)}
                                                    placeholder="Poste de charge directe (ex. Achats de matières premières)"
                                                    title={line.label}
                                                    className={`w-full p-1 text-xs border rounded ${!isNotEmpty(line.label) ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <select
                                                    value={line.category}
                                                    onChange={(e) => handleDirectCostLineChange(line.id, 'category', e.target.value)}
                                                    className="w-full p-1 text-xs border border-gray-300 rounded"
                                                >
                                                    {DIRECT_COST_TYPES.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className={`px-2 py-1 text-center bg-green-50 ${rowBorder}`}><PlaceholderCell /></td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={line.amount}
                                                    onChange={(e) => handleDirectCostLineChange(line.id, 'amount', e.target.value)}
                                                    onBlur={(e) => handleDirectCostLineChange(line.id, 'amount', parseLocaleNumber(e.target.value))}
                                                    placeholder="Montant ($)"
                                                    className={`w-full p-1 text-xs border rounded text-right ${!isValidNumber(line.amount) ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </td>
                                            <td className="w-2 p-0" aria-hidden="true" />
                                            {activityBuckets.map((b) => (
                                                <td key={b.key} className={`px-2 py-1 text-right text-xs text-gray-500 italic bg-yellow-50 ${rowBorder}`}>
                                                    {activityAmounts[b.key] > 0 ? `${formatCurrency(activityAmounts[b.key])} $` : '—'}
                                                </td>
                                            ))}
                                            {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                            {salesChannels.map((c) => {
                                                const ch = channelAmounts[c.id];
                                                return (
                                                    <td key={c.id} className={`px-2 py-1 text-right text-xs text-gray-500 italic bg-blue-50 ${rowBorder}`}>
                                                        {ch?.hasShare ? `${formatCurrency(ch.total)} $` : '—'}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-1 py-1 text-center">
                                                <button onClick={() => handleRemoveDirectCostLine(line.id)} title="Supprimer cette charge directe" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold">
                                    <td colSpan={3} className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-bl-lg">Sous-total</td>
                                    <td className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-br-lg">{formatCurrency(totalDirectCosts)} $</td>
                                    <td className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === activityBuckets.length - 1;
                                        return (
                                            <td key={b.key} className={`px-2 py-1.5 text-right text-xs text-yellow-800 bg-yellow-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {formatCurrency(directCostBucketTotals[b.key])} $
                                            </td>
                                        );
                                    })}
                                    {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === salesChannels.length - 1;
                                        const ct = directCostChannelTotals[c.id];
                                        return (
                                            <td key={c.id} className={`px-2 py-1.5 text-right text-xs italic text-blue-800 bg-blue-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {ct.hasShare ? `${formatCurrency(ct.total)} $` : '—'}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1 py-1" aria-hidden="true" />
                                </tr>
                            </tfoot>
                        </table>
                ) : (
                    <p className="text-sm text-gray-500 italic">Aucune charge directe listée — ajoutez-en une pour commencer.</p>
                )}
                <button onClick={handleAddDirectCostLine} className="mt-4 text-sm text-blue-600 hover:text-blue-800">
                    + Ajouter une charge directe
                </button>
            </div>

            <ProfitSummaryBar
                label="Bénéfice brut"
                tooltip="Revenus moins Charges directes réelles — avant frais fixes. Par activité : deux totaux réels ci-dessus, directement soustraits. Pas de détail par canal (retiré le 20/10) : trop souvent indicatif des deux côtés pour être fiable à ce niveau."
                total={grossProfitTotal}
                activityBuckets={activityBuckets}
                bucketValues={grossProfit.bucketValues}
                salesChannels={salesChannels}
                channelValues={grossProfit.channelValues}
                showSalesChannels={false}
            />

            <div id="tutorial-section-expenses">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                        Frais fixes
                        <Tooltip text="Listez ici chaque poste de dépense qui n'est pas directement lié à la production d'un plat précis (loyer, électricité, marketing, salaires administratifs, assurances, frais bancaires...), avec sa catégorie. Le total (contenant « Général », non rattaché à une activité ou un canal précis) alimente le calcul des frais indirects par plat, selon la méthode d'attribution de Général choisie plus bas." />
                    </h2>
                </div>
                {expenseLines.length > 0 ? (
                        <table className="w-full table-fixed text-xs border-separate border-spacing-0">
                            <IncomeStatementColGroup activityBuckets={activityBuckets} salesChannels={salesChannels} />
                            <thead>
                                <tr>
                                    <th colSpan={4} className="px-2 py-1.5 text-center text-xs font-bold text-green-700 uppercase bg-green-50 rounded-t-lg">&nbsp;</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    <th colSpan={activityBuckets.length} className="px-2 py-1.5 text-center text-xs font-bold text-yellow-700 uppercase bg-yellow-50 rounded-t-lg">
                                        <span className="flex items-center justify-center">
                                            Activités de production
                                            <Tooltip text="Répartissez manuellement le montant de chaque dépense entre Général et vos activités de production — la somme des cellules remplies est comparée au Montant de la ligne (voir l'icône à côté de la Clé de répartition), sans jamais bloquer : certaines dépenses ne s'appliquent naturellement qu'à cet axe, ou qu'à l'autre." />
                                        </span>
                                    </th>
                                    {salesChannels.length > 0 && (
                                        <>
                                            <th className="w-2 p-0" aria-hidden="true" />
                                            <th colSpan={salesChannels.length} className="px-2 py-1.5 text-center text-xs font-bold text-blue-700 uppercase bg-blue-50 rounded-t-lg">
                                                <span className="flex items-center justify-center">
                                                    Canaux de vente
                                                    <Tooltip text="Répartissez manuellement le montant de chaque dépense entre vos canaux de vente — un axe indépendant des Activités (une même dépense peut être répartie sur les deux à la fois, ou sur un seul si l'autre ne s'applique pas)." />
                                                </span>
                                            </th>
                                        </>
                                    )}
                                    <th rowSpan={2} className="w-10 px-1 py-1" aria-hidden="true" />
                                </tr>
                                <tr>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Poste de dépense</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Catégorie
                                            <Tooltip text="La fonction de l'entreprise à laquelle cette dépense se rattache, qui suggère (sans l'imposer) un contenant par défaut : Frais généraux de production → Général ou une activité ; Frais de vente/mise en marché → Général ou un canal ; Frais d'administration et Frais financiers → Général (rarement rattachables à une ligne ou un canal précis)." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">
                                        <span className="flex items-center justify-center">
                                            Clé de répartition
                                            <Tooltip text="Raccourci optionnel qui pré-remplit la grille proportionnellement — Selon les ventes ou Selon les charges directes réelles — modifiable ensuite cellule par cellule. Manuel laisse la grille telle quelle : rien n'est pré-rempli automatiquement." />
                                        </span>
                                    </th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-green-800 uppercase bg-green-50">Montant ($)</th>
                                    <th className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b) => (
                                        <th key={b.key} className="px-2 py-1 text-center text-xs font-normal text-yellow-800 bg-yellow-50">
                                            {b.key === 'general' ? (
                                                <span className="flex items-center justify-center">
                                                    {b.label}
                                                    <Tooltip text="Allocation directe à l'entreprise entière, sans lien de causalité avec une activité ou un canal précis (ex. salaire de direction, assurance générale) — un « facility-sustaining cost », pas une activité comme les autres." />
                                                </span>
                                            ) : b.label}
                                        </th>
                                    ))}
                                    {salesChannels.length > 0 && <th className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c) => (
                                        <th key={c.id} className="px-2 py-1 text-center text-xs font-normal italic text-blue-800 bg-blue-50">{c.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {expenseLines.map((line) => {
                                    const rowBorder = 'border-b border-gray-200';
                                    const verification = expenseLineVerifications[line.id] || { diff: 0 };
                                    const effective = expenseLineEffectiveAllocations[line.id] || { activityAllocations: {}, channelAllocations: {}, locked: false };
                                    return (
                                        <tr key={line.id}>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <input
                                                    type="text"
                                                    value={line.label}
                                                    onChange={(e) => handleExpenseLineChange(line.id, 'label', e.target.value)}
                                                    placeholder="Poste de dépense (ex. Loyer)"
                                                    title={line.label}
                                                    className={`w-full p-1 text-xs border rounded ${!isNotEmpty(line.label) ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <select
                                                    value={line.category}
                                                    onChange={(e) => handleExpenseLineChange(line.id, 'category', e.target.value)}
                                                    className="w-full p-1 text-xs border border-gray-300 rounded"
                                                >
                                                    {EXPENSE_CATEGORIES.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        value={line.repartitionKey || 'manual'}
                                                        onChange={(e) => handleExpenseRepartitionKeyChange(line.id, e.target.value)}
                                                        className="w-full p-1 text-xs border border-gray-300 rounded"
                                                    >
                                                        <option value="manual">Manuel</option>
                                                        <option value="sales">Selon les ventes</option>
                                                        <option value="directCosts">Selon les charges directes</option>
                                                        {repartitionKeys.length > 0 && (
                                                            <optgroup label="Clés personnalisées">
                                                                {repartitionKeys.map((k) => (
                                                                    <option key={k.id} value={`${REPARTITION_CUSTOM_PREFIX}${k.id}`}>{k.name || 'Sans nom'}</option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                        <optgroup label="Une seule activité">
                                                            {activityBuckets.map((b) => (
                                                                <option key={b.key} value={`${REPARTITION_ACTIVITY_PREFIX}${b.key}`}>{b.label}</option>
                                                            ))}
                                                        </optgroup>
                                                        {salesChannels.length > 0 && (
                                                            <optgroup label="Un seul canal">
                                                                {salesChannels.map((c) => (
                                                                    <option key={c.id} value={`${REPARTITION_CHANNEL_PREFIX}${c.id}`}>{c.name}</option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                    <AllocationCheckBadge diff={verification.diff} />
                                                </div>
                                            </td>
                                            <td className={`px-1 py-1 bg-green-50 ${rowBorder}`}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={line.amount}
                                                    onChange={(e) => handleExpenseLineChange(line.id, 'amount', e.target.value)}
                                                    onBlur={(e) => handleExpenseLineChange(line.id, 'amount', parseLocaleNumber(e.target.value))}
                                                    placeholder="Montant ($)"
                                                    className={`w-full p-1 text-xs border rounded text-right ${!isValidNumber(line.amount) ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </td>
                                            <td className="w-2 p-0" aria-hidden="true" />
                                            {activityBuckets.map((b) => (
                                                <td key={b.key} className={`px-2 py-1 text-right text-xs bg-yellow-50 ${rowBorder}`}>
                                                    {effective.locked ? (
                                                        <span className="text-gray-500" title="Valeur dérivée de la clé de répartition — passer en Manuel pour modifier.">
                                                            {effective.activityAllocations[b.key] !== undefined ? `${formatCurrency(effective.activityAllocations[b.key])} $` : '—'}
                                                        </span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={line.activityAllocations?.[b.key] ?? ''}
                                                            onChange={(e) => handleExpenseActivityAllocationChange(line.id, b.key, e.target.value)}
                                                            onBlur={(e) => handleExpenseActivityAllocationBlur(line.id, b.key, e.target.value)}
                                                            className="w-full p-1 text-xs border border-gray-300 rounded text-right"
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                            {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                            {salesChannels.map((c) => (
                                                <td key={c.id} className={`px-2 py-1 text-right text-xs bg-blue-50 ${rowBorder}`}>
                                                    {effective.locked ? (
                                                        <span className="text-gray-500" title="Valeur dérivée de la clé de répartition — passer en Manuel pour modifier.">
                                                            {effective.channelAllocations[c.id] !== undefined ? `${formatCurrency(effective.channelAllocations[c.id])} $` : '—'}
                                                        </span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={line.channelAllocations?.[c.id] ?? ''}
                                                            onChange={(e) => handleExpenseChannelAllocationChange(line.id, c.id, e.target.value)}
                                                            onBlur={(e) => handleExpenseChannelAllocationBlur(line.id, c.id, e.target.value)}
                                                            className="w-full p-1 text-xs border border-gray-300 rounded text-right"
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-1 py-1 text-center">
                                                <button onClick={() => handleRemoveExpenseLine(line.id)} title="Supprimer cette dépense" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold">
                                    <td colSpan={3} className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-bl-lg">Sous-total</td>
                                    <td className="px-2 py-1.5 text-right text-xs text-green-800 bg-green-50 rounded-br-lg">{formatCurrency(generalInfo.totalIndirects)} $</td>
                                    <td className="w-2 p-0" aria-hidden="true" />
                                    {activityBuckets.map((b, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === activityBuckets.length - 1;
                                        return (
                                            <td key={b.key} className={`px-2 py-1.5 text-right text-xs text-yellow-800 bg-yellow-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {formatCurrency(expenseBucketTotals[b.key])} $
                                            </td>
                                        );
                                    })}
                                    {salesChannels.length > 0 && <td className="w-2 p-0" aria-hidden="true" />}
                                    {salesChannels.map((c, i) => {
                                        const isFirst = i === 0;
                                        const isLast = i === salesChannels.length - 1;
                                        return (
                                            <td key={c.id} className={`px-2 py-1.5 text-right text-xs text-blue-800 bg-blue-50 ${isFirst ? 'rounded-bl-lg' : ''} ${isLast ? 'rounded-br-lg' : ''}`}>
                                                {formatCurrency(expenseChannelTotals[c.id])} $
                                            </td>
                                        );
                                    })}
                                    <td className="px-1 py-1" aria-hidden="true" />
                                </tr>
                            </tfoot>
                        </table>
                ) : (
                    <p className="text-sm text-gray-500 italic">Aucune dépense listée — ajoutez-en une pour commencer.</p>
                )}
                <button onClick={handleAddExpenseLine} className="mt-4 text-sm text-blue-600 hover:text-blue-800">
                    + Ajouter une dépense
                </button>
            </div>

            <ProfitSummaryBar
                label="Bénéfice net"
                tooltip="Bénéfice brut moins Frais fixes — au total de l'entreprise. Pas de détail par activité ni par canal (retiré le 20/10)."
                total={netProfitTotal}
                activityBuckets={activityBuckets}
                bucketValues={{}}
                salesChannels={salesChannels}
                channelValues={{}}
                showActivityBuckets={false}
                showSalesChannels={false}
            />
            </div>
            </div>

            {/* Coefficient d'imputation des charges indirectes (CICI) — centralisé ici le 22/10,
                retour utilisateur. Avant cette révision, le driver de Général (renommé « Méthode
                d'attribution de Général » le 21/10) vivait ici tout seul, tandis que le driver de
                chaque activité vivait dans Paramètres → Activités de production, au même endroit
                que son nom/sa suppression — une décision de méthode comptable mélangée avec une
                décision structurelle, et une même notion de CICI éclatée entre deux onglets.
                Désormais, Général et chaque activité partagent UNE seule liste, ici : même
                libellé « CICI » que la terminologie déjà établie dans les infobulles du rapport
                Par SKU, même mécanisme pour les deux (voir analysisData.js). Canal n'y figure
                PAS : il n'a pas de CICI, seulement un pourcentage de majoration (Paramètres →
                Canaux de vente) — une notion différente, pas un oubli. Placée après Frais
                fixes/Bénéfice net, avant la Réconciliation — hors du conteneur de défilement
                horizontal unique ci-dessus (une simple liste de sélecteurs, pas un tableau large) :
                reste toujours visible, jamais caché en défilant vers les colonnes de droite des
                tableaux. */}
            <div id="tutorial-section-cici" className="p-4 bg-gray-100 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center mb-4">
                    Coefficient d'imputation des charges indirectes
                    <Tooltip text="Le CICI est le driver utilisé pour convertir un pool de frais fixes déjà dimensionné (par la clé de répartition, ci-dessus) en un taux $ par produit — propre à chaque ligne ci-dessous, sans effet sur les autres : Général (frais de structure non rattachables à une activité ou un canal précis — ex. salaire de direction, assurances) se répartit à l'échelle du menu entier ; chaque activité se répartit seulement entre ses propres produits. « Au prorata des coûts directs » (matière + emballage + main-d'œuvre + sous-traitance combinés) : choix par défaut, approprié quand le coût indirect suit globalement la valeur des intrants consommés — capture à la fois le volume et la complexité d'un produit. « Au prorata du temps de production » : plus précis si le coût indirect suit plutôt la CADENCE/le temps machine qu'une pure valeur d'intrants. « Au prorata du volume physique » (inspiré de l'Agro-Calculateur du MAPAQ) : selon le poids ou volume physique total vendu (ex. kg, L) — pertinent quand le frais indirect suit l'encombrement (entreposage réfrigéré, capacité d'entrepôt) plutôt que la valeur ou la cadence ; exige de préciser la famille physique (Masse ou Volume) juste à côté — un format d'une autre famille (ex. vendu à l'unité, ou en volume si Masse est choisi) reste simplement absent de ce calcul, jamais une conversion masse/volume inventée. Canal n'a pas de CICI : son coût indirect est toujours un pourcentage de majoration (Paramètres → Canaux de vente)." />
                </h2>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm">
                        <label htmlFor="indirectCostMethod" className="flex-1 font-medium text-gray-700">Général</label>
                        <select id="indirectCostMethod" value={generalInfo.indirectCostMethod || 'directCost'} onChange={(e) => onUpdateGeneralInfo('indirectCostMethod', e.target.value)} className="p-1 border rounded text-sm border-gray-300">
                            {Object.entries(indirectCostMethodLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        {generalInfo.indirectCostMethod === 'volume' && (
                            <select id="indirectCostVolumeUnit" value={generalInfo.indirectCostVolumeUnit || ''} onChange={(e) => onUpdateGeneralInfo('indirectCostVolumeUnit', e.target.value)} className="p-1 border rounded text-sm border-gray-300">
                                <option value="" disabled>Famille physique…</option>
                                {VOLUME_CICI_FAMILIES.map((base) => (
                                    <option key={base} value={base}>{UNIT_BASE_FAMILY_LABELS[base]}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {productionActivities.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm">
                            <span className="flex-1 text-gray-700">{activity.name}</span>
                            <select
                                value={activity.indirectCostDriver || 'directCost'}
                                onChange={(e) => handleActivityDriverChange(activity.id, e.target.value)}
                                className="p-1 border rounded text-sm border-gray-300"
                            >
                                {Object.entries(indirectCostMethodLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                            {activity.indirectCostDriver === 'volume' && (
                                <select value={activity.indirectCostVolumeUnit || ''} onChange={(e) => handleActivityVolumeUnitChange(activity.id, e.target.value)} className="p-1 border rounded text-sm border-gray-300">
                                    <option value="" disabled>Famille physique…</option>
                                    {VOLUME_CICI_FAMILIES.map((base) => (
                                        <option key={base} value={base}>{UNIT_BASE_FAMILY_LABELS[base]}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div id="tutorial-section-reconciliation" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                        Réconciliation réel / théorique
                        <Tooltip text="Compare, au niveau de l'entreprise entière, vos revenus et charges directes réels (saisis ci-dessus) au théorique implicite de votre modèle de recettes (prix de vente × volumes reconstruits à partir du mix des ventes et du chiffre d'affaires du menu, dans Paramètres). Mesure la qualité de vos hypothèses de modélisation contre la réalité comptable — jamais un intrant de calcul, uniquement un diagnostic. Jamais par activité ou canal : à ce niveau de détail, le modèle utilisé pour reconstruire les volumes serait partiellement circulaire." />
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                    <span className="flex items-center justify-center">
                                        Poste
                                        <Tooltip text="Bénéfice brut = Revenus moins Charges directes (avant frais fixes). Bénéfice net = Bénéfice brut moins le total des frais fixes (Dépenses ci-dessus) — ce total n'ayant qu'une seule valeur dans l'app, il est soustrait identiquement du réel et du théorique. Toutes ces lignes reprennent les totaux des tableaux ci-dessus, jamais une donnée saisie séparément." />
                                    </span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                    <span className="flex items-center justify-center">
                                        Réel ($)
                                        <Tooltip text="Le montant tel que saisi dans les tableaux Revenus et Charges directes réelles ci-dessus." />
                                    </span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                    <span className="flex items-center justify-center">
                                        Théorique ($)
                                        <Tooltip text="Le montant que prédit votre modèle de recettes (prix de vente et mix de vente déclarés dans Paramètres) — une estimation basée sur vos hypothèses, pas une donnée réelle." />
                                    </span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                    <span className="flex items-center justify-center">
                                        Écart ($)
                                        <Tooltip text="Réel moins Théorique. Positif : votre résultat réel dépasse ce que le modèle prévoyait. Négatif : il est en dessous." />
                                    </span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                                    <span className="flex items-center justify-center">
                                        Écart (%)
                                        <Tooltip text="Le même écart, exprimé en pourcentage du théorique — pour comparer plus facilement l'ampleur de l'écart entre les lignes." />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reconciliation.rows.map((row) => {
                                const isMarge = row.label === 'Bénéfice net';
                                return (
                                    <tr key={row.label} className={isMarge ? 'font-bold border-t-2 border-gray-300' : ''}>
                                        <td className="px-4 py-2">{row.label}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(row.real)} $</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(row.theoretical)} $</td>
                                        <td className="px-4 py-2 text-right">{row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff)} $</td>
                                        <td className="px-4 py-2 text-right">
                                            {row.diffPercent != null ? `${row.diffPercent >= 0 ? '+' : ''}${(row.diffPercent * 100).toFixed(1)} %` : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
