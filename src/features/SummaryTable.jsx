import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Label, ResponsiveContainer, Bar, LabelList, Cell } from 'recharts';
import { ArrowUpDown, FileDown, Pencil, AlertTriangle, Star, HelpCircle as QuestionMark, Milk, Bone, Camera, Trash2, ChevronDown } from 'lucide-react';
import { unnamedLabel, parseLocaleNumber, formatCurrency, formatPercent, formatNumber } from '../utils.js';
import { useEscapeKey, useSessionState } from '../ui-utils.jsx';
import { ObjectiveBadge } from '../components/ObjectiveBadge.jsx';
import { Tooltip, Pagination, CostNatureBadge, EmptyState } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { CostShockSimulator } from './CostShockSimulator.jsx';
import { computeMenuEngineeringQuadrants, computeActivitySummaries, computeChannelSummaries, computeActivityChannelMarginMatrix } from '../engine/analysisData.js';
import { computeSkuCascade } from '../engine/skuCascade.js';
import { computeGlobalSeries, computeProductSeries, isProductPriced } from '../engine/trackingSeries.js';
import { computeProjectChecks } from '../engine/projectChecks.js';
import { computeIngredientVolatility, computePackagingVolatility } from '../engine/priceVolatility.js';
import { AbcAnalysis } from './reports/AbcAnalysis.jsx';
import { PurchasingReport } from './reports/PurchasingReport.jsx';
import { LaborReport } from './reports/LaborReport.jsx';
import { ReconciliationReport } from './reports/ReconciliationReport.jsx';
import { ActivityLaborSection } from './reports/ActivityLaborSection.jsx';
import { FindingsProvider, ObjectivesFindings, EvolutionFindings, StrengthsFindings, TabFindings } from './reports/KeyFindings.jsx';
import { computeSafetyMargin } from '../engine/laborReport.js';

// Sous-onglets de Rapport et suivi (refonte du 21/11), en quatre groupes séparés par un trait : Vue d'ensemble | produits et segments |
// approvisionnement et équipe | simulation. L'ancien sous-onglet « Intrants » est scindé en Ingrédients et Emballages.
const REPORT_SUBTAB_GROUPS = [
    [{ id: 'overview', label: "Vue d'ensemble" }],
    [{ id: 'portfolio', label: 'Portefeuille' }, { id: 'bySku', label: 'Par SKU' }, { id: 'byActivity', label: 'Par Activité' }, { id: 'byChannel', label: 'Par Canal' }],
    [{ id: 'ingredients', label: 'Ingrédients' }, { id: 'packaging', label: 'Emballages' }, { id: 'labor', label: "Main-d'œuvre" }],
    [{ id: 'simulation', label: 'Simulation' }],
];

// --- SECTION SUIVI (fusionnée dans Rapport le 24/10, retour utilisateur — voir
// Projet_Claude/03-Feuille-de-route.md) : composants repris tels quels de l'ex-TrackingTab.jsx,
// supprimé. Regroupés ici, avant leur premier usage (StrategicAnalysis plus bas), pour rester
// disponibles aux trois sous-onglets qui en ont besoin (Vue d'ensemble, Par SKU, Intrants).

// Libellé et style du niveau de volatilité (faible / modérée / élevée).
const VOLATILITY_TIERS = {
    elevee: { label: 'élevée', className: 'text-red-700 font-semibold' },
    moderee: { label: 'modérée', className: 'text-orange-600 font-medium' },
    faible: { label: 'faible', className: 'text-gray-500' },
};

// Tableau de volatilité générique (Phase 6, 15/10) : extrait de l'ancien bloc « Volatilité des
// prix d'achat » (ingrédients seulement) pour le réutiliser tel quel sur l'emballage — même
// tri/filtre/pagination, même visuel (badge de palier).
const VolatilityTable = ({ volatility, itemLabel, nameColumnLabel, filterPlaceholder, memoryKey }) => {
    const [sort, setSort] = useSessionState(`${memoryKey}.sort`, { key: 'amplitudePercent', direction: 'descending' });
    const [filterName, setFilterName] = useSessionState(`${memoryKey}.filterName`, '');
    const [filterProvider, setFilterProvider] = useSessionState(`${memoryKey}.filterProvider`, 'all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const providers = useMemo(
        () => ['all', ...[...new Set(volatility.list.map(v => v.provider).filter(Boolean))].sort()],
        [volatility]
    );
    const filtered = useMemo(() => {
        let list = volatility.list;
        if (filterName.trim()) {
            const q = filterName.toLowerCase();
            list = list.filter(v => (v.name || '').toLowerCase().includes(q));
        }
        if (filterProvider !== 'all') list = list.filter(v => v.provider === filterProvider);
        const dir = sort.direction === 'ascending' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sort.key], bv = b[sort.key];
            if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
            return ((av || 0) - (bv || 0)) * dir;
        });
    }, [volatility, filterName, filterProvider, sort]);
    useEffect(() => { setPage(1); }, [filterName, filterProvider, perPage]);
    const paged = useMemo(() => filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage), [filtered, page, perPage]);
    const requestSort = (key) => setSort(prev => ({
        key, direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending',
    }));

    if (!volatility.hasEnoughData) {
        return <p className="text-sm text-gray-500">Créez au moins 2 points de référence pour analyser la volatilité {itemLabel}.</p>;
    }

    const columns = [
        { key: 'name', label: nameColumnLabel, align: 'left' },
        { key: 'provider', label: 'Fournisseur', align: 'left' },
        { key: 'currentPrice', label: 'Prix actuel', align: 'right', tip: "vol.prixActuel" },
        { key: 'trendPercent', label: 'Tendance', align: 'right', tip: "vol.tendance" },
        { key: 'amplitudePercent', label: 'Volatilité (amplitude)', align: 'right', tip: "vol.amplitude" },
    ];

    return (
        <>
            <div className="flex flex-wrap gap-3 mb-3">
                <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder={filterPlaceholder}
                    className="p-2 border rounded-md text-sm w-56"
                />
                <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="p-2 border rounded-md text-sm w-56">
                    {providers.map(p => <option key={p} value={p}>{p === 'all' ? 'Tous les fournisseurs' : p}</option>)}
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 border-b">
                            {columns.map(col => (
                                <th key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                        <button onClick={() => requestSort(col.key)} className={`inline-flex items-center gap-1 hover:text-gray-800 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                            {col.label}
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${sort.key === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                                        </button>
                                        {col.tip && <Tooltip tip={col.tip} />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(v => {
                            const tier = VOLATILITY_TIERS[v.tier] || VOLATILITY_TIERS.faible;
                            return (
                                <tr key={v.id} className={`border-b border-gray-100 ${v.tier === 'elevee' ? 'bg-orange-50' : ''}`}>
                                    <td className="py-2 px-3">{v.name}</td>
                                    <td className="py-2 px-3 text-gray-500">{v.provider || '—'}</td>
                                    <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(v.currentPrice)} $</td>
                                    <td className={`py-2 px-3 text-right ${v.trendPercent > 0.5 ? 'text-red-600' : v.trendPercent < -0.5 ? 'text-green-600' : 'text-gray-500'}`}>
                                        {v.trendPercent > 0.5 ? '▲' : v.trendPercent < -0.5 ? '▼' : '→'} {formatNumber(Math.abs(v.trendPercent), 0)} %
                                    </td>
                                    <td className={`py-2 px-3 text-right ${tier.className}`}>
                                        {formatNumber(v.amplitudePercent, 0)} % · {tier.label}
                                    </td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr><td colSpan={columns.length} className="py-4 text-center text-gray-500">Aucun élément ne correspond au filtre.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination
                totalItems={filtered.length}
                itemsPerPage={perPage}
                currentPage={page}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
            />
        </>
    );
};

// Doit être déclaré en dehors de SimpleLineChart : un composant recréé à chaque rendu
// perdrait son état à chaque frappe. Recharts fournit déjà le point de donnée complet via
// payload[0].payload, donc ce composant n'a besoin d'aucune fermeture sur les props du parent.
const LineChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const pointData = payload[0]?.payload;
        return (
            <div className="bg-white p-4 border rounded-lg shadow-lg">
                <p className="font-bold mb-2">{label}</p>
                {pointData && <p className="text-xs text-gray-500 mb-2">{pointData.name}</p>}
                {payload.map(pld => (
                    <p key={pld.dataKey} style={{ color: pld.color }}>
                        {`${pld.name}: ${formatNumber(pld.value, 2)}${pld.payload[pld.dataKey + "_unit"] || ''}`}
                    </p>
                ))}
                 {pointData && pointData.note && <p className="text-xs text-gray-600 mt-2 border-t pt-2">Note: {pointData.note}</p>}
            </div>
        );
    }
    return null;
};

// Graphique d'évolution générique (Recharts) — réutilisé par les KPI globaux, l'analyse par SKU et
// les prix d'ingrédients/emballages.
const SimpleLineChart = ({ data, lines, yAxisLabel }) => {
    if (!data || data.length < 1 || !lines || lines.length === 0) {
        return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Données insuffisantes pour afficher le graphique.</div>;
    }

    const validLines = lines.filter(line => data.some(d => d[line.dataKey] !== null && d[line.dataKey] !== undefined && isFinite(d[line.dataKey])));
    if (validLines.length === 0) return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Aucune donnée à afficher pour les indicateurs sélectionnés.</div>;

    const yAxisTickFormatter = (value) => {
        if (yAxisLabel && yAxisLabel.includes('%')) return `${formatNumber(value, 0)}%`;
        if (yAxisLabel && yAxisLabel.includes('$')) return `${formatNumber(value, 2)}$`;
        return formatNumber(value, 1);
    };

    const dataWithUnits = data.map(d => {
        const newData = { ...d };
        validLines.forEach(line => {
            newData[line.dataKey + "_unit"] = line.unit || '';
        });
        return newData;
    });

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <LineChart
                    data={dataWithUnits}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 40,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }}>
                        <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <RechartsTooltip content={<LineChartTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                    {validLines.map(line => (
                        <Line
                            key={line.dataKey}
                            type="monotone"
                            dataKey={line.dataKey}
                            stroke={line.color}
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                            dot={{ r: 4 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- MODAL POUR LES DÉTAILS DU POINT DE RÉFÉRENCE ---
const SnapshotDetailsModal = ({ isOpen, onClose, onSave, initialData }) => {
    useEscapeKey(isOpen, onClose);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(initialData ? initialData.name : new Date().toLocaleString('fr-CA', { dateStyle: 'long' }));
            setNote(initialData ? initialData.note : '');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ name, note });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{initialData ? 'Modifier le point de référence' : 'Nouveau point de référence'}</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="snapshotName" className="block text-sm font-medium text-gray-700">Nom du point de référence</label>
                        <input
                            type="text"
                            id="snapshotName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="snapshotNote" className="block text-sm font-medium text-gray-700">Note descriptive (optionnel)</label>
                        <textarea
                            id="snapshotNote"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                            placeholder="Ex: Promotion estivale, nouveau fournisseur..."
                            rows="3"
                        />
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-xs"
                        onClick={handleSave}
                    >
                        Enregistrer
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MODALE « GÉRER LES POINTS DE RÉFÉRENCE » (24/10) : auparavant une section toujours visible en
// bas de l'onglet Suivi — déplacée dans une modale, ouverte à la demande depuis le menu déroulant
// « Point de référence » (voir PointDeReferenceMenu), pour ne plus encombrer la vue par défaut.
// Tri/filtre/pagination restent LOCAUX à la modale (state éphémère, se réinitialise à chaque
// ouverture — un choix délibéré, contrairement à `selectedSnapshotIds` ci-dessous qui, lui,
// contrôle quels points alimentent les graphiques et doit donc survivre à la fermeture de cette
// modale).
const ManagePointsModal = ({ isOpen, onClose, trackingPoints, selectedSnapshotIds, onSelectionChange, onSelectAll, onEditSnapshot, onDeleteSnapshot }) => {
    useEscapeKey(isOpen, onClose);
    const [snapSort, setSnapSort] = useState({ key: 'timestamp', direction: 'descending' });
    const [snapFilter, setSnapFilter] = useState('');
    const [snapPage, setSnapPage] = useState(1);
    const [snapPerPage, setSnapPerPage] = useState(10);

    const filteredSnapshots = useMemo(() => {
        let list = trackingPoints;
        if (snapFilter.trim()) {
            const q = snapFilter.toLowerCase();
            list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
        }
        const dir = snapSort.direction === 'ascending' ? 1 : -1;
        return [...list].sort((a, b) => {
            if (snapSort.key === 'timestamp') return (new Date(a.timestamp) - new Date(b.timestamp)) * dir;
            return String(a[snapSort.key] || '').localeCompare(String(b[snapSort.key] || '')) * dir;
        });
    }, [trackingPoints, snapFilter, snapSort]);
    useEffect(() => { setSnapPage(1); }, [snapFilter, snapPerPage]);
    const pagedSnapshots = useMemo(
        () => filteredSnapshots.slice((snapPage - 1) * snapPerPage, (snapPage - 1) * snapPerPage + snapPerPage),
        [filteredSnapshots, snapPage, snapPerPage]
    );
    const requestSnapSort = (key) => setSnapSort(prev => ({
        key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Gestion des points de référence</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <input
                    type="text"
                    value={snapFilter}
                    onChange={(e) => setSnapFilter(e.target.value)}
                    placeholder="Filtrer par nom ou note…"
                    className="p-2 border rounded-md text-sm w-64 mb-3"
                />
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredSnapshots.length > 0 && filteredSnapshots.every(p => selectedSnapshotIds.has(p.id))}
                                        onChange={(e) => onSelectAll(filteredSnapshots.map(p => p.id), e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                {[
                                    { key: 'name', label: 'Nom' },
                                    { key: 'note', label: 'Note' },
                                    { key: 'timestamp', label: 'Date de création' },
                                ].map(col => (
                                    <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                        <button onClick={() => requestSnapSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
                                            {col.label}
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${snapSort.key === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                                        </button>
                                    </th>
                                ))}
                                <th className="relative px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pagedSnapshots.map((point, index) => (
                                <tr key={point.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedSnapshotIds.has(point.id)}
                                            onChange={() => onSelectionChange(point.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{point.name}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{point.note || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}</td>
                                    <td className="px-4 py-2 text-right flex items-center justify-end space-x-2">
                                        <button onClick={() => onEditSnapshot(point)} className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => onDeleteSnapshot(point.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {pagedSnapshots.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Aucun point de référence ne correspond au filtre.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    totalItems={filteredSnapshots.length}
                    itemsPerPage={snapPerPage}
                    currentPage={snapPage}
                    onPageChange={setSnapPage}
                    onItemsPerPageChange={setSnapPerPage}
                />
            </div>
        </div>
    );
};

// --- MENU DÉROULANT « POINT DE RÉFÉRENCE » (24/10) : remplace le bouton unique « Créer un point de
// référence », déplacé sous les boutons d'export — deux actions désormais (nouveau point, ou gérer
// ceux existants, auparavant une section toujours visible en bas de l'onglet Suivi).
const PointDeReferenceMenu = ({ onNew, onManage }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = React.useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                id="tutorial-snapshot"
                onClick={() => setIsOpen(o => !o)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
                <Camera className="h-4 w-4 mr-2" /> Point de référence <ChevronDown className="h-3.5 w-3.5 ml-2" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                    <button onClick={() => { setIsOpen(false); onNew(); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Nouveau point de référence
                    </button>
                    <button onClick={() => { setIsOpen(false); onManage(); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Gérer les points de référence
                    </button>
                </div>
            )}
        </div>
    );
};

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

const BySkuWaterfall = ({ row, productionActivities = [], salesChannels = [] }) => {
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
                        <p className="text-[10px] leading-none -mt-0.5 mb-0.5"><CostNatureBadge nature="direct" /></p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(costs.costSubcontractingPerPortion)} $</p>
                    </div>
                )}
                <div className="p-3 bg-white border-2 border-gray-300 rounded-lg text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-500 flex items-center justify-center">Coût de Production (total) <Tooltip tip="sku.coutProduction" /></p>
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
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-100">Canal</th>
                                {channelBreakdown.map(cb => (
                                    <th key={cb.channelId} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800 whitespace-nowrap">{cb.channelName}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <BySkuSectionHeader label="PDS et frais de mise en marché" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="PDS" tooltip="sku.pds" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {pds > 0 ? `${formatCurrency(pds)} $` : <span className="text-gray-400" title="PDS non saisi pour ce format">—</span>}
                                </td>
                            ))} />
                            {linkRows.map(linkRow => (
                                <BySkuRow key={linkRow.key} label={linkRow.label} tooltip="sku.maillons" render={channelBreakdown.map(cb => {
                                    const delta = getLinkDelta(cb, linkRow);
                                    return (
                                        <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                            {delta != null ? `${formatCurrency(delta)} $` : <span className="text-gray-400" title="Ce canal ne passe pas par ce maillon, ou PDS non saisi pour ce format">—</span>}
                                        </td>
                                    );
                                })} />
                            ))}
                            <BySkuRow label="Frais de mise en marché totaux par unité" tooltip="sku.fraisMiseMarche" emphasis render={channelBreakdown.map(cb => {
                                const totalDelta = getTotalLinkDelta(cb);
                                return (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                        {totalDelta != null ? `${formatCurrency(totalDelta)} $` : <span className="text-gray-400 font-normal" title="PDS non saisi pour ce format">—</span>}
                                    </td>
                                );
                            })} />

                            <BySkuSectionHeader label="Marge brute" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Prix de vente" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-medium text-gray-800">{formatCurrency(cb.netPrice)} $</td>
                            ))} />
                            <BySkuRow label="Bénéfice brut" tooltip="sku.beneficeBrut" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatCurrency(cb.margeBruteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Marge brute" tooltip="sku.margeBrute" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatPercent(cb.margeBrutePercent)} %</td>
                            ))} />

                            <BySkuSectionHeader label="Répartition des charges fixes" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Frais fixes — Général" tooltip="sku.ffGeneral" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedGeneral)} $</td>
                            ))} />
                            <BySkuRow label={`Frais fixes — Activité${activityName ? ` (${activityName})` : ''}`} tooltip="sku.ffActivite" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedActivity)} $</td>
                            ))} />
                            <BySkuRow label="Frais fixes — Canal" tooltip="sku.ffCanal" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).fixedChannel)} $</td>
                            ))} />
                            <BySkuRow label="Frais fixes totaux par unité" tooltip="sku.ffTotal" emphasis render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(cascadeOf(cb).fixedTotal)} $</td>
                            ))} />

                            <BySkuSectionHeader label="Coût net et marge nette" colSpan={channelBreakdown.length + 1} />
                            {(costs.costAgingPerPortion || 0) > 0 && (
                                <BySkuRow label={<>Vieillissement <CostNatureBadge nature="financial" /></>} tooltip="sku.vieillissement" render={channelBreakdown.map(cb => (
                                    <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(costs.costAgingPerPortion)} $</td>
                                ))} />
                            )}
                            <BySkuRow label="Coût net" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(cascadeOf(cb).netCost)} $</td>
                            ))} />
                            <BySkuRow label="Bénéfice net" tooltip="sku.beneficeNet" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatCurrency(cb.margeNetteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Marge nette" tooltip="sku.margeNette" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatPercent(cb.margeNettePercent)} %</td>
                            ))} />

                            <BySkuSectionHeader label="Seuil de rentabilité par canal de vente" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Revenu total" tooltip="sku.revenuTotal" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cascadeOf(cb).revenueTotal != null ? `${formatCurrency(cascadeOf(cb).revenueTotal)} $` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Frais totaux" tooltip="sku.fraisTotaux" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {cascadeOf(cb).costTotal != null ? `${formatCurrency(cascadeOf(cb).costTotal)} $` : <span className="text-gray-400" title="Aucun volume réel saisi pour ce canal">—</span>}
                                </td>
                            ))} />
                            <BySkuRow label="Bénéfices / Pertes" tooltip="sku.beneficePerte" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-bold" style={cb.volume > 0 ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                    {cascadeOf(cb).profitTotal != null ? `${formatCurrency(cascadeOf(cb).profitTotal)} $` : <span className="text-gray-400 font-normal" title="Aucun volume réel saisi pour ce canal">—</span>}
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

// Rapport agrégé Par Activité / Par Canal (révisé le 02/11, retour utilisateur) — une LIGNE par
// activité (ou par canal), chacune réduite à son propre TOTAL ; jamais ventilée par l'autre axe.
// Version précédente (24/10) : un sélecteur + une colonne par canal/activité, comme BySkuWaterfall
// — retour utilisateur immédiat, « on dirait une simple répétition de deux rapports identiques »
// (Par Activité transposé de Par Canal), alors que le vrai intérêt était LE TOTAL de chaque ligne,
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
const SegmentSummaryTable = ({ rows, nameColumnLabel, idKey, nameKey }) => {
    const sortedRows = useMemo(() => [...rows].sort((a, b) => b.margeNetteTotal - a.margeNetteTotal), [rows]);

    if (rows.length === 0) {
        return <p className="text-sm text-gray-500 text-center py-8">Aucune donnée réelle pour l'instant — saisissez un volume vendu par canal dans Paramètres → Produits et SKUs pour alimenter ce tableau.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-100">{nameColumnLabel}</th>
                        {sortedRows.map(row => (
                            <th key={row[idKey]} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800 whitespace-nowrap">{row[nameKey]}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    <BySkuSectionHeader label="Marge brute" colSpan={sortedRows.length + 1} />
                    <BySkuRow label="Revenu total" tooltip="seg.revenu" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.revenueTotal)} $</td>
                    ))} />
                    <BySkuRow label="Coût de production" tooltip="seg.cout" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.totalDirectCostTotal)} $</td>
                    ))} />
                    <BySkuRow label="Bénéfice brut" tooltip="seg.brut" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeBrutePercent)}>{formatCurrency(row.margeBruteTotal)} $</td>
                    ))} />
                    <BySkuRow label="Marge brute" tooltip="seg.margeBrute" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeBrutePercent)}>{formatPercent(row.margeBrutePercent)} %</td>
                    ))} />

                    <BySkuSectionHeader label="Frais fixes et marge nette" colSpan={sortedRows.length + 1} />
                    <BySkuRow label="Frais fixes" tooltip="seg.fraisFixes" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(row.totalIndirectTotal)} $</td>
                    ))} />
                    <BySkuRow label="Bénéfice net" tooltip="seg.net" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeNettePercent)}>{formatCurrency(row.margeNetteTotal)} $</td>
                    ))} />
                    <BySkuRow label="Marge nette" tooltip="seg.margeNette" render={sortedRows.map(row => (
                        <td key={row[idKey]} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(row.margeNettePercent)}>{formatPercent(row.margeNettePercent)} %</td>
                    ))} />

                    <BySkuSectionHeader label="Seuil de rentabilité" colSpan={sortedRows.length + 1} />
                    <BySkuRow
                        label="Point mort"
                        tooltip="seg.pointMort"
                        emphasis
                        render={sortedRows.map(row => (
                            <td key={row[idKey]} className="px-4 py-2.5 text-right font-bold text-indigo-700">
                                {row.breakEvenRevenue != null ? `${formatCurrency(row.breakEvenRevenue)} $` : 'N/A'}
                            </td>
                        ))}
                    />
                </tbody>
            </table>
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
const StrategicAnalysis = ({ analysisData, generalInfo, globalKpiData }) => {
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
const BcgMatrix = ({ analysisData, salesChannels }) => {
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

// Onglet 4: Résumé
export const SummaryTable = ({
    onEditProduct, onOpenPdfModal, exportToExcel, itemsPerPage, onItemsPerPageChange,
    // « Position » de l'utilisateur dans cet onglet (24/10, retour utilisateur) : contrôlée depuis
    // App.jsx (comme `editingProductIndex`/`openRecipeSections` le sont déjà pour Production) —
    // jamais un useState local, pour que ça survive à une navigation vers un autre onglet puis un
    // retour ici (ex. vérifier un ingrédient, puis revenir exactement sur le même sous-onglet et le
    // même SKU). Voir Projet_Claude/03-Feuille-de-route.md.
    activeSubTab, onActiveSubTabChange, selectedSkuId, onSelectedSkuIdChange,
    selectedIngredientId, onSelectedIngredientIdChange, selectedPackagingId, onSelectedPackagingIdChange,
}) => {
    const {
        products, generalInfo, laborDatabase, analysisData, salesChannels, productionActivities,
        trackingPoints, setTrackingPoints, baseIngredients, basePackaging, showNotification, setNotification, goToTab, indirectPools,
    } = useProject();
    // Valeur d'un ancien sous-onglet (« intrants ») : traitée comme Ingrédients.
    const subTab = activeSubTab === 'intrants' ? 'ingredients' : activeSubTab;
    const [sortConfig, setSortConfig] = useSessionState('summary.contributionSort', { key: 'costs.margeNettePercent', direction: 'descending' });
    const [contributionPage, setContributionPage] = useState(1);
    const [showChecks, setShowChecks] = useState(false);
    const projectChecks = useMemo(() => computeProjectChecks({
        products, baseIngredients, basePackaging, productionActivities, salesChannels, trackingPoints, fixedCosts: indirectPools?.meta,
    }), [products, baseIngredients, basePackaging, productionActivities, salesChannels, trackingPoints, indirectPools]);
    const [currentPage, setCurrentPage] = useState(1);
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
    // Repli robuste : aucun SKU choisi OU un SKU qui n'existe plus (changement de projet) retombe
    // sur le premier SKU disponible — jamais un tableau figé sur « Aucun SKU » alors que les produits actifs en
    // contient (l'ancienne condition `!selectedSkuId` seule ne couvrait pas ce second cas).
    useEffect(() => {
        // Préfère un SKU rattaché à au moins un canal : une sous-recette (sans canal) n'offre aucune
        // cascade à afficher, un mauvais écran d'accueil pour cet onglet.
        if (skuOptions.length > 0 && !skuOptions.some(o => o.id === selectedSkuId)) {
            onSelectedSkuIdChange((skuOptions.find(o => (o.channelBreakdown || []).length > 0) || skuOptions[0]).id);
        }
    }, [skuOptions, selectedSkuId, onSelectedSkuIdChange]);
    const selectedSkuRow = productsWithCosts.find(p => p.id === selectedSkuId) || null;

    // Par Activité / Par Canal (révisé le 02/11, retour utilisateur) : une ligne par activité (ou
    // par canal), chacune réduite à son propre TOTAL — plus de sélecteur, plus de ventilation par
    // l'autre axe (voir SegmentSummaryTable ci-dessus pour la justification complète du
    // changement). Une activité/un canal sans aucune vente réelle en est simplement absent (voir
    // computeActivitySummaries/computeChannelSummaries, analysisData.js).
    const activitySummaries = useMemo(
        () => computeActivitySummaries(productsWithCosts, productionActivities),
        [productsWithCosts, productionActivities]
    );
    const channelSummaries = useMemo(
        () => computeChannelSummaries(productsWithCosts, salesChannels),
        [productsWithCosts, salesChannels]
    );

    // --- SECTION SUIVI (fusionnée dans Rapport le 24/10, retour utilisateur) ---
    const priceVolatility = useMemo(() => computeIngredientVolatility(trackingPoints), [trackingPoints]);
    const packagingVolatility = useMemo(() => computePackagingVolatility(trackingPoints), [trackingPoints]);

    // Quels points de référence alimentent les graphiques ci-dessous (pas seulement la modale de
    // gestion, dont le tri/filtre/pagination restent purement locaux à son affichage) — les 15 plus
    // récents par défaut.
    const [selectedSnapshotIds, setSelectedSnapshotIds] = useState(new Set());
    useEffect(() => {
        if (trackingPoints.length > 0) {
            setSelectedSnapshotIds(new Set(trackingPoints.slice(-15).map(p => p.id)));
        } else {
            setSelectedSnapshotIds(new Set());
        }
    }, [trackingPoints]);
    const displayedTrackingPoints = useMemo(
        () => trackingPoints.filter(p => selectedSnapshotIds.has(p.id)),
        [trackingPoints, selectedSnapshotIds]
    );

    // Séries d'évolution calculées par le moteur (engine/trackingSeries.js), partagées avec le rapport PDF : mêmes variables, mêmes règles de données absentes.
    const globalKpiData = useMemo(() => computeGlobalSeries(displayedTrackingPoints), [displayedTrackingPoints]);

    // Évolution des coûts du SKU sélectionné ci-dessus (« Par SKU ») — ex-« Analyse par format » de
    // l'onglet Suivi, fusionnée le 24/10 : réutilise le MÊME sélecteur de SKU plutôt qu'un second
    // indépendant, qui pouvait pointer vers un autre produit (source de confusion).
    const productKpiData = useMemo(() => computeProductSeries(displayedTrackingPoints, selectedSkuId), [displayedTrackingPoints, selectedSkuId]);

    // Un format sans prix de vente (sous-recette jamais vendue seule) a tous ses ratios en % forcés
    // à 0 par calculateCosts.js (division par un prix nul) — le graphique basculerait alors sur une
    // ligne plate à 0 % trompeuse. On y bascule donc les coûts en $/unité, toujours significatifs.
    const selectedProductIsPriced = useMemo(() => isProductPriced(displayedTrackingPoints, selectedSkuId), [displayedTrackingPoints, selectedSkuId]);

    const trackableIngredients = useMemo(() => {
        const allIngredients = new Map();
        trackingPoints.forEach(point => {
            (point.baseIngredients || []).forEach(ing => {
                if (!allIngredients.has(ing.id)) allIngredients.set(ing.id, ing.name);
            });
        });
        return Array.from(allIngredients, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);
    useEffect(() => {
        if (trackableIngredients.length > 0 && !trackableIngredients.some(i => i.id === selectedIngredientId)) {
            onSelectedIngredientIdChange(trackableIngredients[0].id);
        }
    }, [trackableIngredients, selectedIngredientId, onSelectedIngredientIdChange]);
    const ingredientPriceData = useMemo(() => {
        if (!selectedIngredientId) return [];
        return displayedTrackingPoints.map(point => {
            const ingredientData = (point.baseIngredients || []).find(ing => String(ing.id) === String(selectedIngredientId));
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Prix Unitaire": ingredientData ? ingredientData.unitPrice : null,
            };
        });
    }, [displayedTrackingPoints, selectedIngredientId]);

    // Emballage : toujours un suivi SÉPARÉ de celui des ingrédients (jamais fusionné), par cohérence
    // avec la Phase 2 (coût d'emballage comme poste distinct du coût matière).
    const trackablePackaging = useMemo(() => {
        const allPackaging = new Map();
        trackingPoints.forEach(point => {
            (point.basePackaging || []).forEach(pkg => {
                if (!allPackaging.has(pkg.id)) allPackaging.set(pkg.id, pkg.name);
            });
        });
        return Array.from(allPackaging, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);
    useEffect(() => {
        if (trackablePackaging.length > 0 && !trackablePackaging.some(p => p.id === selectedPackagingId)) {
            onSelectedPackagingIdChange(trackablePackaging[0].id);
        }
    }, [trackablePackaging, selectedPackagingId, onSelectedPackagingIdChange]);
    const packagingPriceData = useMemo(() => {
        if (!selectedPackagingId) return [];
        return displayedTrackingPoints.map(point => {
            const packagingData = (point.basePackaging || []).find(pkg => String(pkg.id) === String(selectedPackagingId));
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Prix Unitaire": packagingData ? packagingData.unitPrice : null,
            };
        });
    }, [displayedTrackingPoints, selectedPackagingId]);

    // Modales « Point de référence » (menu déroulant déplacé sous les boutons d'export, 24/10 — ex-
    // bouton unique « Créer un point de référence »).
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [editingSnapshot, setEditingSnapshot] = useState(null);

    const handleSaveSnapshot = ({ name, note }) => {
        if (editingSnapshot) {
            setTrackingPoints(prev => prev.map(p => (p.id === editingSnapshot.id ? { ...p, name, note } : p)));
            showNotification({ message: "Point de référence mis à jour !", type: 'success' });
        } else {
            // On capture les coûts déjà calculés dans la source unique (analysisData.productsWithCosts)
            // plutôt que de les recalculer. Le deep-clone fige la copie, indépendante des recalculs
            // ultérieurs.
            const newSnapshot = {
                id: Date.now(),
                name: name || new Date().toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                note: note || '',
                timestamp: new Date().toISOString(),
                generalInfo: { ...generalInfo },
                productsWithCosts: JSON.parse(JSON.stringify(productsWithCosts)),
                baseIngredients: JSON.parse(JSON.stringify(baseIngredients)),
                basePackaging: JSON.parse(JSON.stringify(basePackaging)),
            };
            setTrackingPoints(prev => [...prev, newSnapshot]);
            showNotification({ message: "Point de référence créé avec succès !", type: 'success' });
        }
        setIsSnapshotModalOpen(false);
        setEditingSnapshot(null);
    };

    const handleDeleteSnapshot = (idToDelete) => {
        const pointToDelete = trackingPoints.find(p => p.id === idToDelete);
        if (!pointToDelete) return;
        const originalTrackingPoints = [...trackingPoints];
        const originalSelectedIds = new Set(selectedSnapshotIds);
        const newTrackingPoints = trackingPoints.filter(p => p.id !== idToDelete);
        const newSelectedIds = new Set(selectedSnapshotIds);
        newSelectedIds.delete(idToDelete);
        setTrackingPoints(newTrackingPoints);
        setSelectedSnapshotIds(newSelectedIds);
        showNotification({
            message: `Le point de référence "${pointToDelete.name}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                setTrackingPoints(originalTrackingPoints);
                setSelectedSnapshotIds(originalSelectedIds);
                setNotification(null);
            }
        });
    };

    const handleSnapshotSelectionChange = (id) => {
        setSelectedSnapshotIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    };
    const handleSnapshotSelectAll = (idsInScope, checked) => {
        setSelectedSnapshotIds(prev => {
            const next = new Set(prev);
            idsInScope.forEach(id => (checked ? next.add(id) : next.delete(id)));
            return next;
        });
    };
    const openEditSnapshotModal = (snapshot) => {
        setIsManageModalOpen(false);
        setEditingSnapshot(snapshot);
        setIsSnapshotModalOpen(true);
    };

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
    // Pagination du classement par contribution (21/11, à la place de « Voir tout ») : même réglage de lignes par page que les autres tableaux.
    const totalContributionsCount = contributionData.length;
    const contributionPageClamped = Math.min(contributionPage, Math.max(1, Math.ceil(totalContributionsCount / itemsPerPage)));
    const displayedContributions = useMemo(() => {
        const start = (contributionPageClamped - 1) * itemsPerPage;
        return contributionData.slice(start, start + itemsPerPage);
    }, [contributionData, contributionPageClamped, itemsPerPage]);

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

    // Matrice Activité × Canal (02/11, retour utilisateur — intégrée en haut de la matrice SKU ×
    // Canal ci-dessous) : mêmes règles que celle-ci (tri par colonne, « — »/jamais 0 $ pour une
    // combinaison sans vente, pagination, palette de marge) — un état de tri/pagination séparé,
    // puisque c'est une liste différente (`productionActivities`, pas `productsWithCosts`),
    // partageant seulement le même réglage de nombre de lignes par page (`itemsPerPage`, prop
    // commune aux deux tableaux).
    // Révision du 02/11 (retour utilisateur, suite) : métrique en $ (bénéfice net) plutôt qu'en %,
    // avec une ligne ET une colonne Total — une matrice en % ne peut pas avoir de total sensé
    // (sommer ou moyenner des % individuels diverge du vrai % consolidé, paradoxe de Simpson,
    // même principe que partout ailleurs dans ce fichier), alors qu'un $ se somme sans ambiguïté.
    // Les totaux réutilisent directement `activitySummaries`/`channelSummaries` (déjà calculés
    // plus haut pour Par Activité/Par Canal) plutôt que de re-sommer la matrice — même donnée,
    // jamais deux calculs indépendants qui pourraient diverger.
    const [activityMatrixSort, setActivityMatrixSort] = useSessionState('summary.activityMatrixSort', { key: 'activityName', direction: 'descending' });
    const [activityMatrixPage, setActivityMatrixPage] = useState(1);
    useEffect(() => {
        setActivityMatrixPage(1);
    }, [activityMatrixSort]);

    const activityChannelMatrix = useMemo(
        () => computeActivityChannelMarginMatrix(productsWithCosts, productionActivities, salesChannels),
        [productsWithCosts, productionActivities, salesChannels]
    );

    // Grand total (coin inférieur droit) : somme des totaux par activité — équivalente à la somme
    // des totaux par canal (les deux ventilent le même bénéfice net, juste selon un axe différent,
    // comme déjà vérifié pour Par Activité/Par Canal).
    const activityMatrixGrandTotal = useMemo(
        () => activitySummaries.reduce((sum, r) => sum + r.margeNetteTotal, 0),
        [activitySummaries]
    );

    const getActivityMatrixValue = (activity, key) => {
        if (key === 'total') {
            const total = activitySummaries.find(r => r.activityId === activity.id);
            return total ? total.margeNetteTotal : null;
        }
        if (key.startsWith('channel:')) {
            const channelId = key.slice('channel:'.length);
            const cell = activityChannelMatrix[activity.id]?.[channelId];
            return cell ? cell.margeNetteTotal : null;
        }
        return activity.name; // key === 'activityName'
    };

    const sortedActivityRows = useMemo(() => {
        const items = [...productionActivities];
        items.sort((a, b) => {
            const aValue = getActivityMatrixValue(a, activityMatrixSort.key);
            const bValue = getActivityMatrixValue(b, activityMatrixSort.key);
            if (activityMatrixSort.key === 'total' || activityMatrixSort.key.startsWith('channel:')) {
                // « — » (valeur absente) reste toujours en fin de liste, peu importe le sens du
                // tri — jamais interprété comme 0 $, même règle que la matrice SKU × Canal.
                const aNum = aValue === null ? null : parseLocaleNumber(aValue);
                const bNum = bValue === null ? null : parseLocaleNumber(bValue);
                if (aNum === null && bNum === null) return 0;
                if (aNum === null) return 1;
                if (bNum === null) return -1;
                const comparison = aNum - bNum;
                return activityMatrixSort.direction === 'ascending' ? comparison : -comparison;
            }
            const comparison = String(aValue || '').localeCompare(String(bValue || ''), 'fr', { sensitivity: 'base' });
            return activityMatrixSort.direction === 'ascending' ? comparison : -comparison;
        });
        return items;
    }, [productionActivities, activityChannelMatrix, activitySummaries, activityMatrixSort]);

    const displayedActivityRows = useMemo(() => {
        const startIndex = (activityMatrixPage - 1) * itemsPerPage;
        return sortedActivityRows.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedActivityRows, activityMatrixPage, itemsPerPage]);

    const requestActivityMatrixSort = (key) => {
        let direction = 'ascending';
        if (activityMatrixSort.key === key && activityMatrixSort.direction === 'ascending') {
            direction = 'descending';
        } else if (activityMatrixSort.key === key && activityMatrixSort.direction === 'descending') {
            direction = 'ascending';
        }
        setActivityMatrixSort({ key, direction });
    };

    const getActivityMatrixSortIcon = (key) => {
        if (activityMatrixSort.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return activityMatrixSort.direction === 'ascending' ? '▲' : '▼';
    };

    return (
        <FindingsProvider>
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <SnapshotDetailsModal
                isOpen={isSnapshotModalOpen}
                onClose={() => { setIsSnapshotModalOpen(false); setEditingSnapshot(null); }}
                onSave={handleSaveSnapshot}
                initialData={editingSnapshot}
            />
            <ManagePointsModal
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                trackingPoints={trackingPoints}
                selectedSnapshotIds={selectedSnapshotIds}
                onSelectionChange={handleSnapshotSelectionChange}
                onSelectAll={handleSnapshotSelectAll}
                onEditSnapshot={openEditSnapshotModal}
                onDeleteSnapshot={handleDeleteSnapshot}
            />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Rapport et suivi</h1>
                {/* Une seule ligne : Excel, PDF, puis le point de référence (à droite du PDF, 18/11). */}
                <div className="flex items-center gap-2">
                        <button onClick={() => exportToExcel(laborDatabase)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            <FileDown className="h-4 w-4 mr-2" /> Exporter vers Excel
                        </button>
                        <button onClick={onOpenPdfModal} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                            <FileDown className="h-4 w-4 mr-2" /> Générer un rapport PDF
                        </button>
                    <PointDeReferenceMenu
                        onNew={() => { setEditingSnapshot(null); setIsSnapshotModalOpen(true); }}
                        onManage={() => setIsManageModalOpen(true)}
                    />
                </div>
            </div>
            {products.length === 0 && (
                <EmptyState message="Rien à analyser pour l'instant : ajoutez d'abord des produits.">
                    <button onClick={() => goToTab('info')} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">Aller à Paramètres → Produits et SKUs</button>
                </EmptyState>
            )}

            {projectChecks.length > 0 && products.length > 0 && (
                <div data-testid="project-checks" className="mb-6 border border-amber-300 bg-amber-50 rounded-lg">
                    <button type="button" onClick={() => setShowChecks(o => !o)} aria-expanded={showChecks}
                        className="w-full flex items-center justify-between px-4 py-3 text-left">
                        <span className="flex items-center text-sm font-semibold text-amber-900">
                            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                            {projectChecks.length} point{projectChecks.length > 1 ? 's' : ''} à vérifier avant de vous fier à ces résultats
                        </span>
                        <ChevronDown className={`h-5 w-5 text-amber-700 transition-transform ${showChecks ? 'rotate-180' : ''}`} />
                    </button>
                    {showChecks && (
                        <ul className="px-4 pb-3 space-y-2">
                            {projectChecks.map(c => (
                                <li key={c.id} className="flex items-center justify-between gap-3 text-sm text-amber-900">
                                    <span>{c.message}</span>
                                    <button type="button" onClick={() => goToTab(c.tab)} className="flex-shrink-0 text-blue-700 hover:text-blue-900 underline whitespace-nowrap">
                                        Corriger dans {c.tabLabel}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Barre des sous-onglets (21/11, refonte de Rapport et suivi) : quatre groupes dans l'ordre — Vue d'ensemble, produits et segments,
                approvisionnement et équipe, simulation. Un trait vertical sépare les groupes (rétabli le 23/11 à la demande de l'utilisateur) ; la barre passe à la ligne
                dans une fenêtre étroite au lieu de défiler. Voir Projet_Claude/03-Feuille-de-route.md. */}
            <div data-tour="subtab-bar" className="flex flex-wrap gap-x-1 border-b border-gray-200 mb-6">
                {REPORT_SUBTAB_GROUPS.map((group, groupIndex) => (
                    <React.Fragment key={groupIndex}>
                        {groupIndex > 0 && <span aria-hidden="true" className="mx-2 self-center h-5 w-px bg-gray-300 flex-shrink-0" />}
                        {group.map(tab => (
                            <button
                                key={tab.id}
                                data-tour={`subtab-${tab.id}`}
                                aria-current={subTab === tab.id ? 'page' : undefined}
                                onClick={() => onActiveSubTabChange(tab.id)}
                                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${subTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </React.Fragment>
                ))}
            </div>

            {subTab === 'bySku' && (
            <div id="tutorial-section-summary-bysku">
                <div className="flex items-center gap-2 mb-6">
                    <label htmlFor="summarySkuSelect" className="text-sm font-medium text-gray-700">SKU :</label>
                    <select
                        id="summarySkuSelect"
                        value={selectedSkuId || ''}
                        onChange={(e) => onSelectedSkuIdChange(e.target.value)}
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
                    ? <BySkuWaterfall row={selectedSkuRow} productionActivities={productionActivities} salesChannels={salesChannels} />
                    : <p className="text-center text-gray-500 py-8">Aucun SKU actif pour l'instant — cochez la case « Actif » d'un format dans Paramètres → Produits et SKUs.</p>}

                {/* Évolution des coûts de ce SKU (ex-« Analyse par format » de l'onglet Suivi,
                    fusionnée ici le 24/10, retour utilisateur, sous le tableau récapitulatif du
                    coût de revient par canal) — même SKU que ci-dessus, aucun second sélecteur. */}
                {selectedSkuRow && (
                <div id="tutorial-section-tracking-product" className="mt-8 pt-6 border-t">
                    <h2 className="text-2xl font-bold text-gray-700 mb-1">Évolution des coûts de ce SKU</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {selectedProductIsPriced
                            ? "Comment les coûts et la marge nette (%) de ce SKU ont évolué, d'un point de référence à l'autre. Un excellent moyen de mesurer l'impact de vos changements de prix ou d'optimisation des coûts."
                            : "Ce SKU n'a pas de prix de vente (sous-recette non vendue seule) : les ratios en % du prix n'ont pas de sens, les coûts sont donc affichés en $ par unité produite."}
                    </p>
                    {selectedProductIsPriced ? (
                        <SimpleLineChart
                            data={productKpiData}
                            lines={[
                                { dataKey: "Coût matière (%)", color: "#82ca9d", unit: '%' },
                                { dataKey: "Coût emballage (%)", color: "#db2777", unit: '%' },
                                { dataKey: "Coût main-d'œuvre (%)", color: "#ffc658", unit: '%' },
                                { dataKey: "Coût frais indirects (%)", color: "#8884d8", unit: '%' },
                                { dataKey: "Marge nette (%)", color: "#ff7300", unit: '%' },
                            ]}
                            yAxisLabel="Pourcentage (%)"
                        />
                    ) : (
                        <SimpleLineChart
                            data={productKpiData}
                            lines={[
                                { dataKey: "Coût matière ($/u.)", color: "#82ca9d", unit: ' $' },
                                { dataKey: "Coût emballage ($/u.)", color: "#db2777", unit: ' $' },
                                { dataKey: "Coût main-d'œuvre ($/u.)", color: "#ffc658", unit: ' $' },
                                { dataKey: "Coût de revient ($/u.)", color: "#ff7300", unit: ' $' },
                            ]}
                            yAxisLabel="Coût ($ / unité)"
                        />
                    )}
                </div>
                )}
            </div>
            )}

            {/* Par Activité / Par Canal (révisé le 02/11, retour utilisateur) : une ligne par
                activité (ou par canal), chacune réduite à son propre total — plus de sélecteur, la
                liste entière est déjà visible (voir SegmentSummaryTable, computeActivitySummaries/
                computeChannelSummaries, engine/analysisData.js, pour la méthodologie : $ sommés
                jamais % moyennés, point mort en $ de revenu pas en unités). */}
            {subTab === 'byActivity' && (
            <>
            <div id="tutorial-section-summary-byactivity">
                <SegmentSummaryTable rows={activitySummaries} nameColumnLabel="Activité" idKey="activityId" nameKey="activityName" />
            </div>
            {/* Section ajoutée SOUS le tableau d'origine, qui reste intact (hors de son conteneur). */}
            <ActivityLaborSection activitySummaries={activitySummaries} activeProducts={analysisData.activeProducts} productivityReport={generalInfo.productivityReport} productionActivities={productionActivities} />
            </>
            )}

            {subTab === 'byChannel' && (
            <div id="tutorial-section-summary-bychannel">
                <SegmentSummaryTable rows={channelSummaries} nameColumnLabel="Canal" idKey="channelId" nameKey="channelName" />
            </div>
            )}

            {/* Vue d'ensemble : tuiles, évolution des marges et coûts moyens, matrice Activité × Canal, puis la Réconciliation réel / théorique
                (déplacée ici le 21/11 depuis l'État des résultats : les deux portent sur l'entreprise entière). */}
            {subTab === 'overview' && (
            <>
            <StrategicAnalysis analysisData={analysisData} generalInfo={generalInfo} globalKpiData={globalKpiData} />

            {/* 02/11, retour utilisateur : matrice Activité × Canal insérée au-dessus de la matrice
                SKU × Canal — même principe (« — » si aucune vente), mais à l'échelle de l'activité
                de production plutôt que du SKU individuel. Toutes les activités fournies
                apparaissent (même sans vente, « — » partout), comme la matrice SKU × Canal liste
                tous les SKUs. Pas de colonne « éditer » : une activité n'a pas de destination
                d'édition unique comme un SKU.
                Révisée le 02/11 (retour utilisateur, suite) : bénéfices/pertes en $ plutôt qu'en %
                — un $ se somme sans ambiguïté, ce qui permet une ligne ET une colonne Total (une
                matrice en % n'aurait pas de total sensé, voir le commentaire plus haut). La
                couleur de chaque cellule reste basée sur la marge nette % (intensité relative à
                l'échelle propre de CETTE cellule), même si la valeur affichée est en $. */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Bénéfices / pertes des activités par canaux</h2>
                <p className="text-sm text-gray-500 mb-4">Le bénéfice net (ou la perte) de chaque activité de production, pour chacun de ses canaux de vente, avec le total par activité et par canal. « — » : cette activité n'a aucune vente dans ce canal.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-100">
                                <button onClick={() => requestActivityMatrixSort('activityName')} className="flex items-center w-full">
                                    Activité {getActivityMatrixSortIcon('activityName')}
                                </button>
                            </th>
                            {salesChannels.map(c => (
                                <th key={c.id} className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                                    <button onClick={() => requestActivityMatrixSort(`channel:${c.id}`)} className="flex items-center justify-end w-full">
                                        {c.name || 'Sans nom'} {getActivityMatrixSortIcon(`channel:${c.id}`)}
                                    </button>
                                </th>
                            ))}
                            {/* Colonne Total : pas de bordure ajoutée ici (retour utilisateur) — la
                                ligne des titres ne doit pas changer d'apparence ; la séparation se
                                fait seulement sur les lignes de données et la ligne Total ci-dessous. */}
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                                <button onClick={() => requestActivityMatrixSort('total')} className="flex items-center justify-end w-full">
                                    Total {getActivityMatrixSortIcon('total')}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedActivityRows.map((activity, index) => {
                            const activityTotal = activitySummaries.find(r => r.activityId === activity.id);
                            return (
                                <tr key={activity.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-1.5 whitespace-nowrap font-medium sticky left-0 bg-inherit">{activity.name || 'Sans nom'}</td>
                                    {salesChannels.map(c => {
                                        const cell = activityChannelMatrix[activity.id]?.[c.id];
                                        return (
                                            <td key={c.id} className="px-3 py-1.5 text-right font-bold" style={cell ? getMarginCellStyle(cell.margeNettePercent) : undefined}>
                                                {cell ? `${formatCurrency(cell.margeNetteTotal)} $` : <span className="text-gray-400 font-normal" title="Aucune vente dans ce canal">—</span>}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-1.5 text-right font-bold border-l-4 border-white" style={activityTotal ? getMarginCellStyle(activityTotal.margeNettePercent) : undefined}>
                                        {activityTotal ? `${formatCurrency(activityTotal.margeNetteTotal)} $` : <span className="text-gray-400 font-normal" title="Aucune vente pour cette activité">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Ligne Total mise en évidence (02/11, retour utilisateur) : même principe
                            que la colonne Total ci-dessus — bordure du haut plus épaisse que les
                            séparateurs de lignes ordinaires, pour qu'elle se détache comme un résultat
                            agrégé plutôt qu'une activité de plus. Blanche plutôt que grise (retour
                            utilisateur) : la bordure grise tranchait mal avec les cellules déjà
                            colorées (palette de marge) — le blanc se lit comme un espacement net entre
                            cartes plutôt qu'un trait disgracieux par-dessus une couleur. Bordure posée
                            sur CHAQUE <td> plutôt que sur le <tr> (retour utilisateur, la bordure du
                            haut n'apparaissait pas) : un navigateur ne peint jamais une bordure posée
                            directement sur <tr> en mode de bordures "separate" (celui par défaut d'un
                            tableau HTML, jamais changé ici) — seules les cellules peuvent porter une
                            bordure visible. Toujours la somme sur TOUTES les activités (jamais limitée
                            à la page affichée) — réutilise channelSummaries, déjà calculé pour Par
                            Canal. */}
                        <tr className="bg-gray-100 font-bold">
                            <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-gray-100 border-t-4 border-white">Total</td>
                            {salesChannels.map(c => {
                                const channelTotal = channelSummaries.find(r => r.channelId === c.id);
                                return (
                                    <td key={c.id} className="px-3 py-1.5 text-right border-t-4 border-white" style={channelTotal ? getMarginCellStyle(channelTotal.margeNettePercent) : undefined}>
                                        {channelTotal ? `${formatCurrency(channelTotal.margeNetteTotal)} $` : <span className="text-gray-400 font-normal" title="Aucune vente dans ce canal">—</span>}
                                    </td>
                                );
                            })}
                            <td className="px-3 py-1.5 text-right text-indigo-700 border-l-4 border-t-4 border-white">{formatCurrency(activityMatrixGrandTotal)} $</td>
                        </tr>
                    </tbody>
                </table>
                <Pagination
                    totalItems={sortedActivityRows.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={activityMatrixPage}
                    onPageChange={setActivityMatrixPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>

            {/* Constats : forces et faiblesses (mêmes règles que le chapitre 1 du rapport PDF), seuls sous la matrice Activité × Canal (23/11). */}
            <StrengthsFindings />

            <div className="mt-8">
                <ReconciliationReport />
            </div>
            </>
            )}

            {/* Portefeuille (21/11) : les analyses qui portent sur l'ensemble des produits — matrice stratégique, contribution au profit, marges
                nettes des SKUs par canaux. */}
            {subTab === 'portfolio' && (
            <>
            <BcgMatrix analysisData={analysisData} salesChannels={salesChannels} />

            {/* Classement par contribution totale : pagination (comme les autres tableaux) à la place de « Voir tout », lignes plus serrées. */}
            <div id="tutorial-contribution-chart" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Classement par contribution totale au profit</h2>
                <p className="text-sm text-gray-500 mb-4">Ce graphique montre les produits qui génèrent le plus de profit en dollars pour couvrir vos frais fixes.</p>
                <div style={{ width: '100%', height: 20 + displayedContributions.length * 30 }}>
                    <ResponsiveContainer>
                        <BarChart
                            layout="vertical"
                            data={displayedContributions}
                            margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                        >
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={240} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                            <RechartsTooltip
                                formatter={(value) => `${formatCurrency(value)} $`}
                                cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }}
                                contentStyle={{ borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="totalContribution" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="totalContribution" position="right" formatter={(value) => `${formatCurrency(value)} $`} style={{ fill: '#374151', fontSize: '12px' }}/>
                                {displayedContributions.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.totalContribution >= 0 ? '#10B981' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <Pagination
                    totalItems={totalContributionsCount}
                    itemsPerPage={itemsPerPage}
                    currentPage={contributionPageClamped}
                    onPageChange={setContributionPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>

            {/* 06/10 : matrice SKU × canal inspirée de l'onglet « Rapport - Marges » du chiffrier
                SymbiOse de l'utilisateur — remplace l'ancien tableau détaillé à un seul canal à la
                fois (son filtre par canal n'a plus lieu d'être : tous les canaux sont déjà visibles
                en colonnes ici). Pas de regroupement « Vente directe / Vente au détail » comme dans
                le chiffrier original : ça suppose un type de canal que `salesChannels` ne modélise
                pas encore. */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Marges nettes des SKUs par canaux</h2>
                <p className="text-sm text-gray-500 mb-4">La marge nette (% du prix de vente) de chaque SKU, pour chacun de ses canaux de vente. « — » : ce SKU n'est pas vendu dans ce canal.</p>
            </div>
            <div id="tutorial-section-summary-table" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-100">
                                <button onClick={() => requestSort('displayName')} className="flex items-center w-full">
                                    Produit {getSortIcon('displayName')}
                                </button>
                            </th>
                            {salesChannels.map(c => (
                                <th key={c.id} className="px-3 py-1 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                                    <button onClick={() => requestSort(`channel:${c.id}`)} className="flex items-center justify-end w-full">
                                        {c.name || 'Sans nom'} {getSortIcon(`channel:${c.id}`)}
                                    </button>
                                </th>
                            ))}
                            <th className="relative px-3 py-1"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedProducts.map((product, index) => (
                            <tr key={product.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-1 whitespace-nowrap font-medium sticky left-0 bg-inherit">{product.displayName || product.platName || unnamedLabel(index)}</td>
                                {salesChannels.map(c => {
                                    const cb = (product.channelBreakdown || []).find(ch => ch.channelId === c.id);
                                    return (
                                        <td key={c.id} className="px-3 py-1 text-right font-bold" style={cb ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                            {cb ? `${formatPercent(cb.margeNettePercent)} %` : <span className="text-gray-400 font-normal" title="Non vendu dans ce canal">—</span>}
                                        </td>
                                    );
                                })}
                                <td className="px-3 py-1 text-right">
                                    <button
                                        onClick={() => onEditProduct(products.findIndex(p => p.id === product.productId), product.formatIndex || 0)}
                                        title="Éditer le produit"
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

            {/* Ingrédients : analyse ABC, rapport d'achats et perte stock, puis évolution des prix et volatilité (ex-sous-onglet Intrants, bloc ingrédients). */}
            {subTab === 'ingredients' && (
            <div className="space-y-8">
                <AbcAnalysis id="tutorial-section-ingredients-abc" abc={analysisData.abcAnalysisData} volatilityByName={priceVolatility.byName} nounPlural="ingrédients" />
                <div className="pt-6 border-t">
                    <PurchasingReport id="tutorial-section-ingredients-rapport" report={analysisData.purchasingReportData} itemLabel="Ingrédient" selectId="reportFilterProvider" memoryKey="ingredients.reportFilter" itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
                <div id="tutorial-section-tracking-ingredient" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-2xl font-bold text-gray-700">Évolution du prix des ingrédients</h2>
                        <select
                            value={selectedIngredientId || ''}
                            onChange={(e) => onSelectedIngredientIdChange(e.target.value)}
                            className="p-2 border rounded-md w-72"
                        >
                            {trackableIngredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                        </select>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez un ingrédient pour voir comment son prix unitaire a évolué dans le temps. C'est idéal pour suivre l'inflation et l'impact de vos négociations avec les fournisseurs.</p>
                    <SimpleLineChart
                        data={ingredientPriceData}
                        lines={[
                            { dataKey: "Prix Unitaire", color: "#82ca9d", unit: ' $' },
                        ]}
                        yAxisLabel="Prix Unitaire ($)"
                    />

                    {/* Volatilité des prix d'achat — dérivée des points de référence. */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité des prix d'achat</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Amplitude du prix (écart entre son plus bas et son plus haut, en % de la moyenne) et tendance
                            {priceVolatility.hasEnoughData ? ` sur vos ${priceVolatility.pointCount} points de référence` : ''}.
                            À croiser avec la classe ABC (section Analyse ABC ci-dessus) : un ingrédient de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={priceVolatility}
                            memoryKey="summary.ingredientVolatility"
                            itemLabel="des ingrédients"
                            nameColumnLabel="Ingrédient"
                            filterPlaceholder="Filtrer par ingrédient…"
                        />
                    </div>
                </div>
            </div>
            )}

            {/* Emballages : même gabarit — poste SÉPARÉ des ingrédients (voir Phase 2), jamais fusionné. */}
            {subTab === 'packaging' && (
            <div className="space-y-8">
                <AbcAnalysis id="tutorial-section-packaging-abc" abc={analysisData.packagingAbcAnalysisData} volatilityByName={packagingVolatility.byName} nounPlural="emballages" emptyMessage="Aucun emballage consommé pour la période — rattachez des emballages à vos formats de vente (onglet Production) pour voir apparaître cette analyse." />
                <div className="pt-6 border-t">
                    <PurchasingReport id="tutorial-section-packaging-rapport" report={analysisData.packagingPurchasingReportData} itemLabel="Emballage" selectId="reportFilterProviderPackaging" memoryKey="packaging.reportFilter" itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
                {/* Emballage — poste SÉPARÉ des ingrédients (voir Phase 2), jamais fusionné. */}
                <div id="tutorial-section-tracking-packaging" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-2xl font-bold text-gray-700">Évolution du prix des emballages</h2>
                        <select
                            value={selectedPackagingId || ''}
                            onChange={(e) => onSelectedPackagingIdChange(e.target.value)}
                            className="p-2 border rounded-md w-72"
                        >
                            {trackablePackaging.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                        </select>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez un emballage pour voir comment son prix unitaire a évolué dans le temps. C'est idéal pour suivre l'inflation et l'impact de vos négociations avec les fournisseurs.</p>
                    <SimpleLineChart
                        data={packagingPriceData}
                        lines={[
                            { dataKey: "Prix Unitaire", color: "#db2777", unit: ' $' },
                        ]}
                        yAxisLabel="Prix Unitaire ($)"
                    />

                    {/* Volatilité des prix d'achat — Emballage (Phase 6) : même analyse que les
                        ingrédients, poste SÉPARÉ (voir Phase 2). */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité des prix d'achat</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Amplitude du prix (écart entre son plus bas et son plus haut, en % de la moyenne) et tendance
                            {packagingVolatility.hasEnoughData ? ` sur vos ${packagingVolatility.pointCount} points de référence` : ''}.
                            À croiser avec la classe ABC (section Analyse ABC ci-dessus) : un emballage de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={packagingVolatility}
                            memoryKey="summary.packagingVolatility"
                            itemLabel="de l'emballage"
                            nameColumnLabel="Emballage"
                            filterPlaceholder="Filtrer par emballage…"
                        />
                    </div>
                </div>
            </div>
            )}

            {/* Main-d'œuvre : rapport de productivité et charge de travail par activité. */}
            {subTab === 'labor' && <LaborReport itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />}

            {/* 06/10 : sous-onglet dédié — être dans cet onglet suffit, pas besoin de redéplier
                le simulateur derrière un second clic (voir CostShockSimulator, prop collapsible). */}
            {subTab === 'simulation' && (
                <CostShockSimulator collapsible={false} />
            )}

            {/* Bandeau de constats à la fin de chaque sous-onglet, sauf Vue d'ensemble (trois blocs ci-dessus) et Simulation (23/11). */}
            {subTab !== 'overview' && subTab !== 'simulation' && (
                <TabFindings subTab={subTab} selectedFormat={subTab === 'bySku' && selectedSkuRow ? { id: selectedSkuRow.id, productId: selectedSkuRow.productId } : null} />
            )}
        </div>
        </FindingsProvider>
    );
};
