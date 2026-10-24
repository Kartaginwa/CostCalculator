import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Label, ResponsiveContainer, Bar, LabelList, Cell } from 'recharts';
import { ArrowUpDown, FileDown, Pencil, AlertTriangle, Star, HelpCircle as QuestionMark, Milk, Bone, Camera, Trash2, ChevronDown } from 'lucide-react';
import { parseLocaleNumber, formatCurrency, formatPercent } from '../utils.js';
import { getCostTargetIndicator } from '../ui-utils.jsx';
import { Tooltip, Pagination } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { CostShockSimulator } from './CostShockSimulator.jsx';
import { computeMenuEngineeringQuadrants } from '../engine/analysisData.js';
import { computeSalesChannelCascade } from '../engine/salesChannelCascade.js';
import { computeIngredientVolatility, computePackagingVolatility } from '../engine/priceVolatility.js';

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
const VolatilityTable = ({ volatility, itemLabel, nameColumnLabel, filterPlaceholder }) => {
    const [sort, setSort] = useState({ key: 'amplitudePercent', direction: 'descending' });
    const [filterName, setFilterName] = useState('');
    const [filterProvider, setFilterProvider] = useState('all');
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
        { key: 'currentPrice', label: 'Prix actuel', align: 'right', tip: "Dernier prix unitaire connu (point de référence le plus récent)." },
        { key: 'trendPercent', label: 'Tendance', align: 'right', tip: "Variation entre le premier et le dernier point de référence (hausse ▲ / baisse ▼)." },
        { key: 'amplitudePercent', label: 'Volatilité (amplitude)', align: 'right', tip: "Amplitude = écart entre la valeur la plus basse et la plus haute, en % de la moyenne. Mesure l'instabilité." },
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
                <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="p-2 border rounded-md text-sm">
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
                                        {col.tip && <Tooltip text={col.tip} />}
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
                                        {v.trendPercent > 0.5 ? '▲' : v.trendPercent < -0.5 ? '▼' : '→'} {Math.abs(v.trendPercent).toFixed(0)} %
                                    </td>
                                    <td className={`py-2 px-3 text-right ${tier.className}`}>
                                        {v.amplitudePercent.toFixed(0)} % · {tier.label}
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
                        {`${pld.name}: ${pld.value.toFixed(2)}${pld.payload[pld.dataKey + "_unit"] || ''}`}
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
        if (yAxisLabel && yAxisLabel.includes('%')) return `${value.toFixed(0)}%`;
        if (yAxisLabel && yAxisLabel.includes('$')) return `${value.toFixed(2)}$`;
        return value.toFixed(1);
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
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
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
                                    <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(point.timestamp).toLocaleString('fr-CA')}</td>
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
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
                <Camera className="h-5 w-5 mr-2" /> Point de référence <ChevronDown className="h-4 w-4 ml-2" />
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

const BySkuWaterfall = ({ row, productionActivities = [], salesChannels = [] }) => {
    const costs = row.costs;
    const channelBreakdown = row.channelBreakdown || [];
    const pds = parseLocaleNumber(row.format?.pds);
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

    // Clé de dédoublonnage d'un maillon : son nom (si renseigné, pour fusionner un même maillon
    // nommé réutilisé par plusieurs canaux) — sinon channelId+index, pour qu'un maillon sans nom ne
    // fusionne jamais avec un autre maillon sans nom d'un canal différent (deux maillons distincts
    // qui ne portent simplement aucun nom, pas le même maillon).
    const linkRowKey = (channelId, link, index) => (link.name || '').trim() || `${channelId}:${index}`;

    // Un maillon par ligne, du plus proche du PDS (en haut) vers celui le plus proche du prix net
    // (en bas) — cohérent avec PDS en haut et Prix de vente en bas de cette section.
    const linkRows = [];
    const seenLinkKeys = new Set();
    channelBreakdown.forEach(cb => {
        const links = salesChannels.find(c => c.id === cb.channelId)?.links || [];
        for (let i = links.length - 1; i >= 0; i--) {
            const key = linkRowKey(cb.channelId, links[i], i);
            if (seenLinkKeys.has(key)) continue;
            seenLinkKeys.add(key);
            linkRows.push({ key, label: (links[i].name || '').trim() || `Maillon ${i + 1}` });
        }
    });

    // Delta $ de CE maillon pour CE canal : la part de l'écart PDS/prix net qui lui revient (la
    // cascade complète, pas seulement son résultat final — voir computeNetPriceFromPds pour le
    // prix net global). Absent si le canal ne passe pas par ce maillon, ou si le PDS n'est pas saisi.
    const getLinkDelta = (cb, linkRow) => {
        if (!(pds > 0)) return null;
        const links = salesChannels.find(c => c.id === cb.channelId)?.links || [];
        const index = links.findIndex((l, i) => linkRowKey(cb.channelId, l, i) === linkRow.key);
        if (index === -1) return null;
        const prices = computeSalesChannelCascade({ links, anchorIndex: links.length, anchorValue: pds });
        const before = prices[index];
        const after = prices[index + 1];
        return (before != null && after != null) ? after - before : null;
    };

    // Total $ de TOUS les maillons de ce canal (somme des deltas ci-dessus) : PDS moins le prix
    // net que produirait la cascade complète — un canal sans maillon (ex. vente directe) donne
    // bien 0 $, une vraie valeur (aucun maillon à additionner), jamais confondue avec un PDS absent.
    const getTotalLinkDelta = (cb) => {
        if (!(pds > 0)) return null;
        const links = salesChannels.find(c => c.id === cb.channelId)?.links || [];
        if (links.length === 0) return 0;
        const prices = computeSalesChannelCascade({ links, anchorIndex: links.length, anchorValue: pds });
        const first = prices[0];
        const last = prices[links.length];
        return (first != null && last != null) ? last - first : null;
    };

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
                            <BySkuSectionHeader label="PDS et frais de mise en marché" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="PDS" tooltip="Prix de détail suggéré au consommateur pour ce format — une seule valeur, la même pour tous les canaux (saisie dans Produits et SKUs)." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                    {pds > 0 ? `${formatCurrency(pds)} $` : <span className="text-gray-400" title="PDS non saisi pour ce format">—</span>}
                                </td>
                            ))} />
                            {linkRows.map(linkRow => (
                                <BySkuRow key={linkRow.key} label={linkRow.label} tooltip="Le markup ou la marge de ce maillon, en dollars, pour ce canal — une partie de l'écart entre le PDS et le prix net qui lui revient (calculée à partir de la cascade de maillons du canal, pas du prix net réellement saisi)." render={channelBreakdown.map(cb => {
                                    const delta = getLinkDelta(cb, linkRow);
                                    return (
                                        <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">
                                            {delta != null ? `${formatCurrency(delta)} $` : <span className="text-gray-400" title="Ce canal ne passe pas par ce maillon, ou PDS non saisi pour ce format">—</span>}
                                        </td>
                                    );
                                })} />
                            ))}
                            <BySkuRow label="Frais de mise en marché totaux par unité" tooltip="La somme de tous les maillons ci-dessus pour ce canal — PDS moins le prix net QUE PRODUIRAIT la cascade de maillons de ce canal (bouton « Générer » de Produits et SKUs), jamais le prix net réellement saisi." emphasis render={channelBreakdown.map(cb => {
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
                            <BySkuRow label="Bénéfice brut" tooltip="Prix net moins le coût de production. Avant frais fixes." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatCurrency(cb.margeBruteDollar)} $</td>
                            ))} />
                            <BySkuRow label="Marge brute" render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeBrutePercent)}>{formatPercent(cb.margeBrutePercent)} %</td>
                            ))} />

                            <BySkuSectionHeader label="Répartition des charges fixes" colSpan={channelBreakdown.length + 1} />
                            <BySkuRow label="Frais fixes — Général" tooltip="Part du pool « Général » (frais de structure, non rattachables à une activité ou un canal précis — ex. salaire de direction, assurances) allouée à ce SKU, au CICI choisi pour Général dans État des résultats, section « Coefficient d'imputation des charges indirectes » — au prorata des coûts directs ou du temps de main-d'œuvre, à l'échelle du menu entier. Le même montant quel que soit le canal — seul le prix change." render={channelBreakdown.map(cb => (
                                <td key={cb.channelId} className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(costs.costIndirectGeneralPerPortion || 0)} $</td>
                            ))} />
                            <BySkuRow label={`Frais fixes — Activité${activityName ? ` (${activityName})` : ''}`} tooltip="Part du pool de l'activité de production de ce SKU, au CICI choisi pour cette activité dans État des résultats, section « Coefficient d'imputation des charges indirectes » (charges directes ou temps de main-d'œuvre). Le même montant quel que soit le canal." render={channelBreakdown.map(cb => (
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
                                <td key={cb.channelId} className="px-4 py-2.5 text-right font-semibold" style={getMarginCellStyle(cb.margeNettePercent)}>{formatPercent(cb.margeNettePercent)} %</td>
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
                            <BySkuRow label="Bénéfices / Pertes" tooltip="Revenu total moins frais totaux — le profit réel dans ce canal, au volume réellement vendu." render={channelBreakdown.map(cb => (
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
const StrategicAnalysis = ({ analysisData, generalInfo, salesChannels, globalKpiData }) => {
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

            {/* Évolution des KPI globaux (ex-Suivi, fusionné le 24/10 — retour utilisateur,
                positionné au-dessus de la Matrice d'ingénierie de menu). Données ABSENTES tant
                qu'aucun point de référence n'existe : SimpleLineChart affiche alors son propre
                message, jamais un graphique vide forcé. */}
            <div id="tutorial-section-tracking-global" className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Évolution des marges et coûts moyens</h3>
                <p className="text-sm text-gray-500 mb-4">Ce graphique montre l'évolution de vos coûts moyens et de votre marge brute, d'un point de référence à l'autre, pour prendre des décisions éclairées sur votre menu.</p>
                <SimpleLineChart
                    data={globalKpiData}
                    lines={[
                        { dataKey: "Marge Brute Moyenne", color: "#82ca9d", unit: '%' },
                        { dataKey: "Coût Matière Moyen", color: "#ffc658", unit: '%' },
                        { dataKey: "Coût Emballage Moyen", color: "#db2777", unit: '%' },
                        { dataKey: "Coût M-O Moyen", color: "#ff7300", unit: '%' },
                    ]}
                    yAxisLabel="Pourcentage (%)"
                />
            </div>

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
        trackingPoints, setTrackingPoints, baseIngredients, basePackaging, showNotification, setNotification,
    } = useProject();
    const [sortConfig, setSortConfig] = useState({ key: 'costs.margeNettePercent', direction: 'descending' });
    const [showAllContributions, setShowAllContributions] = useState(false);
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
    // sur le premier SKU disponible — jamais un tableau figé sur « Aucun SKU » alors que le menu en
    // contient (l'ancienne condition `!selectedSkuId` seule ne couvrait pas ce second cas).
    useEffect(() => {
        if (skuOptions.length > 0 && !skuOptions.some(o => o.id === selectedSkuId)) onSelectedSkuIdChange(skuOptions[0].id);
    }, [skuOptions, selectedSkuId, onSelectedSkuIdChange]);
    const selectedSkuRow = productsWithCosts.find(p => p.id === selectedSkuId) || null;

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

    const globalKpiData = useMemo(() => {
        return displayedTrackingPoints.map(point => {
            const activeProductsAtPoint = point.productsWithCosts.filter(p => p.onMenu);
            const totalSalesMixAtPoint = activeProductsAtPoint.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);

            // Aucun produit actif avec un mix des ventes connu à cette date : les KPI pondérés
            // n'ont pas de sens (division par un mix total nul) — données ABSENTES (null, un trou
            // dans la ligne), jamais forcées à 0.
            if (totalSalesMixAtPoint === 0) {
                return {
                    name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note,
                    "Point Mort Global": null, "Marge Brute Moyenne": null, "Coût Matière Moyen": null, "Coût Emballage Moyen": null, "Coût M-O Moyen": null,
                };
            }

            const weightedGrossMargin = activeProductsAtPoint.reduce((sum, p) => sum + (p.costs.margeBrutePercent * (parseLocaleNumber(p.salesMix) / totalSalesMixAtPoint)), 0);
            const weightedMaterialCost = activeProductsAtPoint.reduce((sum, p) => sum + (p.costs.costMatierePercent * (parseLocaleNumber(p.salesMix) / totalSalesMixAtPoint)), 0);
            const weightedPackagingCost = activeProductsAtPoint.reduce((sum, p) => sum + (p.costs.costPackagingPercent * (parseLocaleNumber(p.salesMix) / totalSalesMixAtPoint)), 0);
            const weightedLaborCost = activeProductsAtPoint.reduce((sum, p) => sum + (p.costs.costLaborPercent * (parseLocaleNumber(p.salesMix) / totalSalesMixAtPoint)), 0);
            const globalBreakEvenAtPoint = weightedGrossMargin > 0 ? parseLocaleNumber(point.generalInfo.totalIndirects) / weightedGrossMargin : 0;

            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Point Mort Global": globalBreakEvenAtPoint,
                "Marge Brute Moyenne": weightedGrossMargin * 100,
                "Coût Matière Moyen": weightedMaterialCost * 100,
                "Coût Emballage Moyen": weightedPackagingCost * 100,
                "Coût M-O Moyen": weightedLaborCost * 100,
            };
        });
    }, [displayedTrackingPoints]);

    // Évolution des coûts du SKU sélectionné ci-dessus (« Par SKU ») — ex-« Analyse par format » de
    // l'onglet Suivi, fusionnée le 24/10 : réutilise le MÊME sélecteur de SKU plutôt qu'un second
    // indépendant, qui pouvait pointer vers un autre produit (source de confusion).
    const productKpiData = useMemo(() => {
        if (!selectedSkuId) return [];

        return displayedTrackingPoints.map(point => {
            const productData = point.productsWithCosts.find(p => String(p.id) === String(selectedSkuId));
            if (!productData) {
                return {
                    name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                    label: point.name,
                    note: point.note,
                    "Coût matière (%)": null,
                    "Coût emballage (%)": null,
                    "Coût main-d'oeuvre (%)": null,
                    "Coût frais indirects (%)": null,
                    "Marge nette (%)": null,
                    "Coût matière ($/u.)": null,
                    "Coût emballage ($/u.)": null,
                    "Coût main-d'oeuvre ($/u.)": null,
                    "Coût de revient ($/u.)": null,
                };
            }
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Coût matière (%)": productData.costs.costMatierePercent * 100,
                "Coût emballage (%)": productData.costs.costPackagingPercent * 100,
                "Coût main-d'oeuvre (%)": productData.costs.costLaborPercent * 100,
                "Coût frais indirects (%)": productData.costs.costIndirectPercent * 100,
                "Marge nette (%)": productData.costs.margeNettePercent * 100,
                "Coût matière ($/u.)": productData.costs.costMatierePerPortion,
                "Coût emballage ($/u.)": productData.costs.costPackagingPerPortion,
                "Coût main-d'oeuvre ($/u.)": productData.costs.costLaborPerPortion,
                "Coût de revient ($/u.)": productData.costs.totalCostPerPortion,
            };
        });
    }, [displayedTrackingPoints, selectedSkuId]);

    // Un format sans prix de vente (sous-recette jamais vendue seule) a tous ses ratios en % forcés
    // à 0 par calculateCosts.js (division par un prix nul) — le graphique basculerait alors sur une
    // ligne plate à 0 % trompeuse. On y bascule donc les coûts en $/unité, toujours significatifs.
    const selectedProductIsPriced = useMemo(() => {
        return displayedTrackingPoints.some(point => {
            const p = point.productsWithCosts.find(pp => String(pp.id) === String(selectedSkuId));
            return p && parseLocaleNumber(p.prixVente) > 0;
        });
    }, [displayedTrackingPoints, selectedSkuId]);

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
                {/* Boutons d'export puis, sous eux, le point de référence (déplacé le 24/10, retour
                    utilisateur — auparavant un bouton unique « Créer un point de référence » à côté
                    de l'export). */}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex space-x-2">
                        <button onClick={() => exportToExcel(laborDatabase)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            <FileDown className="h-5 w-5 mr-2" /> Exporter vers Excel
                        </button>
                        <button onClick={onOpenPdfModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                            <FileDown className="h-5 w-5 mr-2" /> Générer un rapport PDF
                        </button>
                    </div>
                    <PointDeReferenceMenu
                        onNew={() => { setEditingSnapshot(null); setIsSnapshotModalOpen(true); }}
                        onManage={() => setIsManageModalOpen(true)}
                    />
                </div>
            </div>

            <div className="flex gap-1 border-b border-gray-200 mb-6">
                <button
                    onClick={() => onActiveSubTabChange('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'overview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Vue d'ensemble
                </button>
                <button
                    onClick={() => onActiveSubTabChange('bySku')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'bySku' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Par SKU
                </button>
                <button
                    onClick={() => onActiveSubTabChange('simulation')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'simulation' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Simulation
                </button>
                <button
                    onClick={() => onActiveSubTabChange('intrants')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSubTab === 'intrants' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Intrants
                </button>
            </div>

            {activeSubTab === 'bySku' && (
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
                    : <p className="text-center text-gray-500 py-8">Aucun SKU dans le menu pour l'instant.</p>}

                {/* Évolution des coûts de ce SKU (ex-« Analyse par format » de l'onglet Suivi,
                    fusionnée ici le 24/10, retour utilisateur, sous le tableau récapitulatif du
                    coût de revient par canal) — même SKU que ci-dessus, aucun second sélecteur. */}
                {selectedSkuRow && (
                <div id="tutorial-section-tracking-product" className="mt-8 pt-6 border-t">
                    <h2 className="text-xl font-semibold text-gray-700 mb-1">Évolution des coûts de ce SKU</h2>
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
                                { dataKey: "Coût main-d'oeuvre (%)", color: "#ffc658", unit: '%' },
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
                                { dataKey: "Coût main-d'oeuvre ($/u.)", color: "#ffc658", unit: ' $' },
                                { dataKey: "Coût de revient ($/u.)", color: "#ff7300", unit: ' $' },
                            ]}
                            yAxisLabel="Coût ($ / unité)"
                        />
                    )}
                </div>
                )}
            </div>
            )}

            {activeSubTab === 'overview' && (
            <>
            <StrategicAnalysis analysisData={analysisData} generalInfo={generalInfo} salesChannels={salesChannels} globalKpiData={globalKpiData} />
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

            {/* Intrants (nouveau sous-onglet, 24/10, retour utilisateur) : évolution des prix et
                volatilité des ingrédients ET de l'emballage — contenu de l'ex-onglet Suivi, non lié
                à un SKU précis (contrairement à « Par SKU » ci-dessus). */}
            {activeSubTab === 'intrants' && (
            <div className="space-y-8">
                <div id="tutorial-section-tracking-ingredient" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Évolution du prix des ingrédients</h2>
                        <select
                            value={selectedIngredientId || ''}
                            onChange={(e) => onSelectedIngredientIdChange(e.target.value)}
                            className="p-2 border rounded-md"
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
                            À croiser avec la classe ABC (onglet Ingrédients) : un ingrédient de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={priceVolatility}
                            itemLabel="des ingrédients"
                            nameColumnLabel="Ingrédient"
                            filterPlaceholder="Filtrer par ingrédient…"
                        />
                    </div>
                </div>

                {/* Emballage — poste SÉPARÉ des ingrédients (voir Phase 2), jamais fusionné. */}
                <div id="tutorial-section-tracking-packaging" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Évolution du prix des emballages</h2>
                        <select
                            value={selectedPackagingId || ''}
                            onChange={(e) => onSelectedPackagingIdChange(e.target.value)}
                            className="p-2 border rounded-md"
                        >
                            {trackablePackaging.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                        </select>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez un emballage pour voir comment son prix unitaire a évolué dans le temps.</p>
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
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité des prix d'achat — Emballage</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Amplitude du prix (écart entre son plus bas et son plus haut, en % de la moyenne) et tendance
                            {packagingVolatility.hasEnoughData ? ` sur vos ${packagingVolatility.pointCount} points de référence` : ''}.
                            À croiser avec la classe ABC (onglet Packaging) : un emballage de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={packagingVolatility}
                            itemLabel="de l'emballage"
                            nameColumnLabel="Emballage"
                            filterPlaceholder="Filtrer par emballage…"
                        />
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};
