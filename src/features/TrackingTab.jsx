import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { Camera, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { parseLocaleNumber, formatCurrency } from '../utils.js';
import { useProject } from '../state/ProjectContext.jsx';
import { computeIngredientVolatility, computePackagingVolatility, computeFormatCostVolatility } from '../engine/priceVolatility.js';
import { buildTrackableProducts } from '../engine/trackingAnalysis.js';
import { Pagination, Tooltip } from '../components/common.jsx';

// Libellé et style du niveau de volatilité (faible / modérée / élevée).
const VOLATILITY_TIERS = {
    elevee: { label: 'élevée', className: 'text-red-700 font-semibold' },
    moderee: { label: 'modérée', className: 'text-orange-600 font-medium' },
    faible: { label: 'faible', className: 'text-gray-500' },
};

// Tableau de volatilité générique (Phase 6, 15/10) : extrait de l'ancien bloc « Volatilité des
// prix d'achat » (ingrédients seulement) pour le réutiliser tel quel sur l'emballage et le coût
// direct par format — même tri/filtre/pagination, même visuel (badge de palier). `showProvider`
// désactivé pour les formats (un format n'a pas de fournisseur). `priceColumnLabel` distingue un
// PRIX d'achat (ingrédient/emballage) d'un COÛT calculé (format).
const VolatilityTable = ({ volatility, itemLabel, nameColumnLabel, filterPlaceholder, showProvider = true, priceColumnLabel = 'Prix actuel' }) => {
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
        if (showProvider && filterProvider !== 'all') list = list.filter(v => v.provider === filterProvider);
        const dir = sort.direction === 'ascending' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sort.key], bv = b[sort.key];
            if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
            return ((av || 0) - (bv || 0)) * dir;
        });
    }, [volatility, filterName, filterProvider, sort, showProvider]);
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
        ...(showProvider ? [{ key: 'provider', label: 'Fournisseur', align: 'left' }] : []),
        { key: 'currentPrice', label: priceColumnLabel, align: 'right', tip: showProvider ? "Dernier prix unitaire connu (point de référence le plus récent)." : "Dernier coût direct par portion connu (point de référence le plus récent)." },
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
                {showProvider && (
                    <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="p-2 border rounded-md text-sm">
                        {providers.map(p => <option key={p} value={p}>{p === 'all' ? 'Tous les fournisseurs' : p}</option>)}
                    </select>
                )}
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
                                    {showProvider && <td className="py-2 px-3 text-gray-500">{v.provider || '—'}</td>}
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
const CustomTooltip = ({ active, payload, label }) => {
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

// --- NOUVEAU COMPOSANT GRAPHIQUE (AVEC RECHARTS) ---
const SimpleLineChart = ({ data, lines, yAxisLabel }) => {
    // Cette version utilise directement les composants importés

    if (!data || data.length < 1 || !lines || lines.length === 0) {
        return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Données insuffisantes pour afficher le graphique.</div>;
    }

    const validLines = lines.filter(line => data.some(d => d[line.dataKey] !== null && d[line.dataKey] !== undefined && isFinite(d[line.dataKey])));
    if (validLines.length === 0) return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Aucune donnée à afficher pour les indicateurs sélectionnés.</div>;

    // Formatter for Y-axis ticks
    const yAxisTickFormatter = (value) => {
        if (yAxisLabel && yAxisLabel.includes('%')) return `${value.toFixed(0)}%`;
        if (yAxisLabel && yAxisLabel.includes('$')) return `${value.toFixed(2)}$`;
        return value.toFixed(1);
    };

    // Add unit to each data point for tooltip
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
                    <RechartsTooltip content={<CustomTooltip />} />
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

// --- NOUVEL ONGLET: SUIVI ---
export const TrackingTab = () => {
    const { trackingPoints, setTrackingPoints, generalInfo, showNotification, setNotification, baseIngredients, basePackaging, analysisData } = useProject();
    const priceVolatility = useMemo(() => computeIngredientVolatility(trackingPoints), [trackingPoints]);
    // Phase 6 (15/10) : même analyse sur l'emballage (prix d'achat) et sur le coût direct par
    // format (matière + emballage + MO + sous-traitance déjà figés dans chaque snapshot) — voir
    // VolatilityTable, qui porte désormais tout le tri/filtre/pagination (auparavant dupliqué ici
    // pour les ingrédients seulement).
    const packagingVolatility = useMemo(() => computePackagingVolatility(trackingPoints), [trackingPoints]);
    const formatVolatility = useMemo(() => computeFormatCostVolatility(trackingPoints), [trackingPoints]);

    // Tri / filtre / pagination de la table de gestion des points de référence.
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
    const [selectedProductId, setSelectedProductId] = useState('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedSnapshotIds, setSelectedSnapshotIds] = useState(new Set());
    const [editingSnapshot, setEditingSnapshot] = useState(null);
    const [selectedIngredientId, setSelectedIngredientId] = useState('');
    const [selectedPackagingId, setSelectedPackagingId] = useState('');

    useEffect(() => {
        if (trackingPoints.length > 0) {
            const last15Ids = trackingPoints
                .slice(-15)
                .map(p => p.id);
            setSelectedSnapshotIds(new Set(last15Ids));
        } else {
            setSelectedSnapshotIds(new Set());
        }
    }, [trackingPoints]);

    const displayedTrackingPoints = useMemo(() => {
        return trackingPoints.filter(p => selectedSnapshotIds.has(p.id))
    }, [trackingPoints, selectedSnapshotIds]);

    const trackableProducts = useMemo(() => buildTrackableProducts(trackingPoints), [trackingPoints]);

    useEffect(() => {
        if (!selectedProductId && trackableProducts.length > 0) {
            setSelectedProductId(trackableProducts[0].id);
        }
    }, [trackableProducts, selectedProductId]);

    const handleSaveSnapshot = ({ name, note }) => {
        if (editingSnapshot) {
            // Editing existing snapshot
            setTrackingPoints(prev => prev.map(p =>
                p.id === editingSnapshot.id ? { ...p, name, note } : p
            ));
            showNotification({ message: "Point de référence mis à jour !", type: 'success' });
        } else {
            // Creating new snapshot : on capture les coûts déjà calculés dans la source unique
            // (analysisData.productsWithCosts) plutôt que de les recalculer. Le deep-clone ci-dessous
            // fige la copie du point de référence, indépendante des recalculs ultérieurs.
            const productsWithCosts = analysisData.productsWithCosts;
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
        setIsDetailsModalOpen(false);
        setEditingSnapshot(null);
    };

    const handleDeleteSnapshot = (idToDelete) => {
        const pointToDelete = trackingPoints.find(p => p.id === idToDelete);
        if (!pointToDelete) return;

        const originalTrackingPoints = [...trackingPoints];
        const originalSelectedIds = new Set(selectedSnapshotIds);

        // "Cache" l'élément de la vue
        const newTrackingPoints = trackingPoints.filter(p => p.id !== idToDelete);
        const newSelectedIds = new Set(selectedSnapshotIds);
        newSelectedIds.delete(idToDelete);

        setTrackingPoints(newTrackingPoints);
        setSelectedSnapshotIds(newSelectedIds);

        // Affiche la notification avec l'option d'annulation
        showNotification({
            message: `Le point de référence "${pointToDelete.name}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                setTrackingPoints(originalTrackingPoints);
                setSelectedSnapshotIds(originalSelectedIds);
                setNotification(null); // Ferme la notification immédiatement
            }
        });
    };

    const handleSelectionChange = (id) => {
        setSelectedSnapshotIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedSnapshotIds(new Set(filteredSnapshots.map(p => p.id)));
        } else {
            setSelectedSnapshotIds(new Set());
        }
    };

    const openEditModal = (snapshot) => {
        setEditingSnapshot(snapshot);
        setIsDetailsModalOpen(true);
    };

    const globalKpiData = useMemo(() => {
        return displayedTrackingPoints.map(point => {
            const activeProducts = point.productsWithCosts.filter(p => p.onMenu);
            const totalSalesMix = activeProducts.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);

            if (totalSalesMix === 0) {
                return { name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note, globalBreakEven: 0, weightedGrossMargin: 0, weightedMaterialCost: 0, weightedLaborCost: 0 };
            }

            const weightedGrossMargin = activeProducts.reduce((sum, p) => sum + (p.costs.margeBrutePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedMaterialCost = activeProducts.reduce((sum, p) => sum + (p.costs.costMatierePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedLaborCost = activeProducts.reduce((sum, p) => sum + (p.costs.costLaborPercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const globalBreakEven = weightedGrossMargin > 0 ? parseLocaleNumber(point.generalInfo.totalIndirects) / weightedGrossMargin : 0;

            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Point Mort Global": globalBreakEven,
                "Marge Brute Moyenne": weightedGrossMargin * 100,
                "Coût Matière Moyen": weightedMaterialCost * 100,
                "Coût M-O Moyen": weightedLaborCost * 100,
            };
        });
    }, [displayedTrackingPoints]);

    const productKpiData = useMemo(() => {
        if (!selectedProductId) return [];

        return displayedTrackingPoints.map(point => {
            const productData = point.productsWithCosts.find(p => String(p.id) === String(selectedProductId));
            if (!productData) {
                return {
                    name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                    label: point.name,
                    note: point.note,
                    "Coût matière (%)": null,
                    "Coût main-d'oeuvre (%)": null,
                    "Coût frais indirects (%)": null,
                    "Marge nette (%)": null,
                    "Coût matière ($/u.)": null,
                    "Coût main-d'oeuvre ($/u.)": null,
                    "Coût de revient ($/u.)": null,
                };
            }
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Coût matière (%)": productData.costs.costMatierePercent * 100,
                "Coût main-d'oeuvre (%)": productData.costs.costLaborPercent * 100,
                "Coût frais indirects (%)": productData.costs.costIndirectPercent * 100,
                "Marge nette (%)": productData.costs.margeNettePercent * 100,
                "Coût matière ($/u.)": productData.costs.costMatierePerPortion,
                "Coût main-d'oeuvre ($/u.)": productData.costs.costLaborPerPortion,
                "Coût de revient ($/u.)": productData.costs.totalCostPerPortion,
            };
        });
    }, [displayedTrackingPoints, selectedProductId]);

    // Un format sans prix de vente (sous-recette jamais vendue seule, ex. "Sauce demi-glace
    // maison") a tous ses ratios en % forcés à 0 par calculateCosts.js (division par un prix nul) —
    // le graphique basculerait alors sur une ligne plate à 0 % trompeuse. On y bascule donc les
    // coûts en $/unité, toujours significatifs, plutôt que les ratios de prix de vente qui ne le
    // sont pas. Voir Projet_Claude/03-Feuille-de-route.md.
    const selectedProductIsPriced = useMemo(() => {
        return displayedTrackingPoints.some(point => {
            const p = point.productsWithCosts.find(pp => String(pp.id) === String(selectedProductId));
            return p && parseLocaleNumber(p.prixVente) > 0;
        });
    }, [displayedTrackingPoints, selectedProductId]);

    const trackableIngredients = useMemo(() => {
        const allIngredients = new Map();
        trackingPoints.forEach(point => {
            (point.baseIngredients || []).forEach(ing => {
                if (!allIngredients.has(ing.id)) {
                    allIngredients.set(ing.id, ing.name);
                }
            });
        });
        return Array.from(allIngredients, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);

    useEffect(() => {
        if (!selectedIngredientId && trackableIngredients.length > 0) {
            setSelectedIngredientId(trackableIngredients[0].id);
        }
    }, [trackableIngredients, selectedIngredientId]);

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
                if (!allPackaging.has(pkg.id)) {
                    allPackaging.set(pkg.id, pkg.name);
                }
            });
        });
        return Array.from(allPackaging, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);

    useEffect(() => {
        if (!selectedPackagingId && trackablePackaging.length > 0) {
            setSelectedPackagingId(trackablePackaging[0].id);
        }
    }, [trackablePackaging, selectedPackagingId]);

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
    return (
        <div id="tutorial-section-recipe-header" className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl space-y-8">
             <SnapshotDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => { setIsDetailsModalOpen(false); setEditingSnapshot(null); }}
                onSave={handleSaveSnapshot}
                initialData={editingSnapshot}
             />

             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Suivi des performances</h1>
                <button id="tutorial-snapshot" onClick={() => { setEditingSnapshot(null); setIsDetailsModalOpen(true); }} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                    <Camera className="h-5 w-5 mr-2" /> Créer un point de référence
                </button>
            </div>

            {trackingPoints.length < 1 ? (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <p className="text-lg text-gray-600">Créez au moins un point de référence pour commencer le suivi de vos indicateurs.</p>
                </div>
            ) : (
                <>
                    {/* Graphique des KPIs globaux */}
                    <div id="tutorial-section-tracking-global" className="p-4 bg-gray-50 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Évolution des marges et coûts moyens</h2>
                        <p className="text-sm text-gray-500 mb-4">Ce graphique montre l'évolution de vos coûts moyens et de votre marge brute pour prendre des décisions éclairées sur votre menu.</p>
                        <SimpleLineChart
                            data={globalKpiData}
                            lines={[
                                { dataKey: "Marge Brute Moyenne", color: "#82ca9d", unit: '%' },
                                { dataKey: "Coût Matière Moyen", color: "#ffc658", unit: '%' },
                                { dataKey: "Coût M-O Moyen", color: "#ff7300", unit: '%' },
                            ]}
                            yAxisLabel="Pourcentage (%)"
                        />
                    </div>

                    {/* Graphique des KPIs par recette */}
                    <div id="tutorial-section-tracking-product" className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4 mb-4">
                             <h2 className="text-xl font-semibold text-gray-700">Analyse par format</h2>
                             <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                className="p-2 border rounded-md"
                             >
                                {trackableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                        </div>
                         <p className="text-sm text-gray-500 mb-4">
                            {selectedProductIsPriced
                                ? "Sélectionnez un format pour voir comment ses coûts et sa marge nette en pourcentage ont évolué dans le temps. C'est un excellent moyen de mesurer l'impact de vos changements de prix ou d'optimisation des coûts."
                                : "Ce format n'a pas de prix de vente (sous-recette non vendue seule) : les ratios en % du prix n'ont pas de sens, les coûts sont donc affichés en $ par unité produite."}
                         </p>
                        {selectedProductIsPriced ? (
                            <SimpleLineChart
                                data={productKpiData}
                                lines={[
                                    { dataKey: "Coût matière (%)", color: "#82ca9d", unit: '%' },
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
                                    { dataKey: "Coût main-d'oeuvre ($/u.)", color: "#ffc658", unit: ' $' },
                                    { dataKey: "Coût de revient ($/u.)", color: "#ff7300", unit: ' $' },
                                ]}
                                yAxisLabel="Coût ($ / unité)"
                            />
                        )}

                        {/* Volatilité du coût direct par format (Phase 6, 15/10) : matière + emballage +
                            MO + sous-traitance déjà figés dans chaque point de référence — révèle si un
                            format est devenu sensible aux variations de prix de ses intrants, tous
                            combinés (pas seulement les ingrédients ou l'emballage pris séparément). */}
                        <div className="mt-6 pt-4 border-t">
                            <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité du coût direct par format</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Amplitude du coût direct par portion (matière + emballage + main-d'œuvre + sous-traitance)
                                {formatVolatility.hasEnoughData ? ` sur vos ${formatVolatility.pointCount} points de référence` : ''}.
                                Un format très volatil mérite une attention particulière sur son prix de vente ou ses marges.
                            </p>
                            <VolatilityTable
                                volatility={formatVolatility}
                                itemLabel="du coût direct par format"
                                nameColumnLabel="Format"
                                filterPlaceholder="Filtrer par format…"
                                showProvider={false}
                                priceColumnLabel="Coût direct actuel"
                            />
                        </div>
                    </div>
                    {/* Graphique de suivi des prix des ingrédients */}
                    <div id="tutorial-section-tracking-ingredient" className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4 mb-4">
                            <h2 className="text-xl font-semibold text-gray-700">Évolution du prix des ingrédients</h2>
                            <select
                                value={selectedIngredientId}
                                onChange={(e) => setSelectedIngredientId(e.target.value)}
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

                    {/* Graphique de suivi des prix des emballages — poste SÉPARÉ des ingrédients (voir Phase 2). */}
                    <div id="tutorial-section-tracking-packaging" className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4 mb-4">
                            <h2 className="text-xl font-semibold text-gray-700">Évolution du prix des emballages</h2>
                            <select
                                value={selectedPackagingId}
                                onChange={(e) => setSelectedPackagingId(e.target.value)}
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

                        {/* Volatilité des prix d'achat — Emballage (Phase 6, 15/10) : même analyse que les
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

                    {/* Gestion des points de référence */}
                    <div id="tutorial-section-tracking-management" className="p-4 bg-gray-50 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Gestion des points de référence</h2>
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
                                                onChange={handleSelectAll}
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
                                                    onChange={() => handleSelectionChange(point.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 font-medium text-gray-800">{point.name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{point.note || "-"}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500">{new Date(point.timestamp).toLocaleString('fr-CA')}</td>
                                            <td className="px-4 py-2 text-right flex items-center justify-end space-x-2">
                                                <button onClick={() => openEditModal(point)} className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50">
                                                    <Pencil size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteSnapshot(point.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50">
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
                </>
            )}
        </div>
    );
};
