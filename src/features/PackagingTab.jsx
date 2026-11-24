import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useTouched, focusSoon, useSessionState, useStateResetOnChange } from '../ui-utils.jsx';
import { ArrowUpDown, Copy, PlusCircle, Trash2, Upload } from 'lucide-react';
import { todayLocalISO, landedUnitPrice, parseLocaleNumber, generateSlug, formatCurrency, formatUnitPrice, isNotEmpty, isValidNumber, isInvalidPercentage, CONVERSION_FACTORS, filterActiveUnits, unitLabel, areUnitsCompatible } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination, EmptyState } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { findPackagingUsages, formatNameList } from '../engine/usage.js';

// Chargé à la demande : l'assistant d'import est volumineux et rarement ouvert.
const CatalogImportWizardModal = lazy(() => import('./CatalogImportWizardModal.jsx').then(m => ({ default: m.CatalogImportWizardModal })));

// Catalogue d'emballages (Phase 2) — miroir structurel de la base de données des ingrédients
// (IngredientsTab.jsx) : fournisseur, format d'achat, unité, prix, perte %, prix unitaire dérivé,
// analyse ABC et rapport d'achats (Phase 2.3, une fois la consommation par format calculable),
// assistant d'import (même composant générique que les ingrédients — voir
// CatalogImportWizardModal.jsx). Sans allergènes (non pertinent pour un emballage).
export const PackagingTab = ({ itemsPerPage, onItemsPerPageChange }) => {
    const { basePackaging, onUpdatePackagingList, showNotification, setNotification, requestConfirmation, products, activeUnits } = useProject();
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    const [isNameTouched, touchName] = useTouched();
    const [filterName, setFilterName] = useSessionState('packaging.filterName', '');
    const [filterProvider, setFilterProvider] = useSessionState('packaging.filterProvider', 'all');
    const [sortConfig, setSortConfig] = useSessionState('packaging.sortConfig', { key: 'name', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const [currentPage, setCurrentPage] = useStateResetOnChange(1, [filterName, filterProvider, itemsPerPage]); // revient à la page 1 si un filtre change
    const [isSortDisabled, setIsSortDisabled] = useState(false);
    const [comparisonPackaging, setComparisonPackaging] = useSessionState('packaging.comparison', '');

    const uniqueProviders = useMemo(() => ['all', ...new Set(basePackaging.map(p => p.provider).filter(Boolean))], [basePackaging]);
    const uniquePackagingNames = useMemo(() => [...new Set(basePackaging.map(p => p.name).filter(Boolean))], [basePackaging]);

    // « Comparer un emballage » (même outil que IngredientsTab.jsx, dupliqué ici le 15/10) : un
    // même emballage peut venir de plusieurs fournisseurs à des prix et taux de perte différents —
    // le « prix efficace » (prix unitaire corrigé du taux de perte) révèle le coût réel une fois
    // utilisable, pas seulement le prix affiché au catalogue.
    const comparisonResults = useMemo(() => {
        if (!comparisonPackaging) return [];
        return basePackaging
            .filter(p => p.name.toLowerCase() === comparisonPackaging.toLowerCase())
            .map(p => {
                const lossP = (parseLocaleNumber(p.lossPercentage) || 0) / 100;
                const effectiveUnitPrice = lossP > 0 && lossP < 1 ? p.unitPrice / (1 - lossP) : p.unitPrice;
                return { ...p, effectiveUnitPrice, lossCostPerUnit: effectiveUnitPrice - p.unitPrice };
            })
            .sort((a, b) => a.effectiveUnitPrice - b.effectiveUnitPrice);
    }, [basePackaging, comparisonPackaging]);

    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    }, []);

    const filteredAndSortedPackaging = useMemo(() => {
        let items = [...basePackaging];

        if (filterName) {
            items = items.filter(item => item.name.toLowerCase().includes(filterName.toLowerCase()));
        }
        if (filterProvider !== 'all') {
            items = items.filter(item => item.provider === filterProvider);
        }

        if (!isSortDisabled) {
            items.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                let comparison = 0;
                if (['purchaseFormat', 'purchasePrice', 'unitPrice', 'lossPercentage'].includes(sortConfig.key)) {
                    comparison = parseLocaleNumber(aValue) - parseLocaleNumber(bValue);
                } else if (sortConfig.key === 'lastUpdated') {
                    comparison = new Date(aValue) - new Date(bValue);
                } else {
                    comparison = String(aValue).localeCompare(String(bValue), 'fr', { sensitivity: 'base' });
                }
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }

        return items;
    }, [basePackaging, filterName, filterProvider, sortConfig, isSortDisabled]);

    useEffect(() => {
        if (!isSortDisabled) return;

        const handleClickOutside = (event) => {
            const newRowElement = document.getElementById(`packaging-row-${newlyAddedId}`);
            if (newRowElement && !newRowElement.contains(event.target)) {
                setIsSortDisabled(false);
                setNewlyAddedId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSortDisabled, newlyAddedId]);

    const displayedPackaging = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedPackaging.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedPackaging, currentPage, itemsPerPage]);

    const requestSort = (key) => {
        setIsSortDisabled(false);
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const handleUpdate = (id, field, value) => {
        const originalIndex = basePackaging.findIndex(item => item.id === id);
        if (originalIndex === -1) return;

        const newList = [...basePackaging];
        const originalItem = newList[originalIndex];
        const itemToUpdate = { ...originalItem, [field]: value };

        // Même convention que les ingrédients : le SKU/PLU se déduit automatiquement tant que
        // l'utilisateur ne l'a pas saisi lui-même (reconnu via son préfixe).
        const isGeneratedId = !originalItem.uniqueId || originalItem.uniqueId.startsWith(generateSlug(originalItem.name, ''));
        if (isGeneratedId && (field === 'name' || field === 'provider')) {
            const newName = field === 'name' ? value : itemToUpdate.name;
            const newProvider = field === 'provider' ? value : itemToUpdate.provider;
            itemToUpdate.uniqueId = newName ? generateSlug(newName, newProvider, itemToUpdate.purchaseFormat, itemToUpdate.unit) : '';
        }

        itemToUpdate.unitPrice = landedUnitPrice(itemToUpdate);

        if (field === 'purchasePrice' || field === 'discountPercentage' || field === 'inboundCost') {
            itemToUpdate.lastUpdated = todayLocalISO();
        }

        newList[originalIndex] = itemToUpdate;
        onUpdatePackagingList(newList);

        // Même avertissement que pour les ingrédients : un changement de FAMILLE d'unités laisse les recettes dans l'ancienne unité.
        if (field === 'unit' && !areUnitsCompatible(value, originalItem.unit)) {
            const usages = findPackagingUsages(products, id);
            if (usages.length > 0) {
                showNotification({
                    message: `L'unité de « ${originalItem.name || 'cet emballage'} » est passée de ${unitLabel(originalItem.unit)} à ${unitLabel(value)}, une autre famille d'unités. Les recettes qui l'utilisent (${formatNameList(usages)}) gardent l'ancienne unité\u00A0: corrigez-la dans chaque recette, sinon leur coût est faux.`,
                    type: 'error',
                });
            }
        }
    };

    const removeRow = (id) => {
        const itemToDelete = basePackaging.find(item => item.id === id);
        if (!itemToDelete) return;

        const performDelete = () => {
            const originalList = [...basePackaging];
            onUpdatePackagingList(basePackaging.filter(item => item.id !== id));

            showNotification({
                message: `L'emballage «\u00A0${itemToDelete.name}\u00A0» a été supprimé.`,
                type: 'info',
                onUndo: () => {
                    onUpdatePackagingList(originalList);
                    setNotification(null);
                }
            });
        };
        const usages = findPackagingUsages(products, id);
        if (usages.length > 0) {
            requestConfirmation({
                title: 'Supprimer cet emballage ?',
                message: `« ${itemToDelete.name || 'Sans nom'} » est utilisé dans\u00A0: ${formatNameList(usages)}. Ces recettes compteront cette ligne à 0\u00A0$ jusqu'à ce que vous choisissiez un autre emballage. Vous pourrez annuler juste après.`,
                onConfirm: performDelete,
            });
            return;
        }
        performDelete();
    };

    const duplicateRow = (id) => {
        const index = basePackaging.findIndex(item => item.id === id);
        if (index === -1) return;

        const itemToDuplicate = basePackaging[index];
        const newItem = {
            ...itemToDuplicate,
            id: `pkg_${Date.now()}_${Math.random()}`,
            name: `${itemToDuplicate.name || 'Emballage'} (Copie)`,
            uniqueId: '',
        };

        const newList = [...basePackaging];
        newList.splice(index + 1, 0, newItem);
        onUpdatePackagingList(newList);
    };

    const addRow = () => {
        const newItem = {
            id: `pkg_${Date.now()}_${Math.random()}`,
            name: '',
            uniqueId: '',
            provider: '',
            purchaseFormat: 1,
            unit: 'unité',
            purchasePrice: '',
            unitPrice: 0,
            lossPercentage: 0,
            lastUpdated: todayLocalISO(),
        };
        setIsSortDisabled(true);
        setCurrentPage(1);
        setNewlyAddedId(newItem.id);
        onUpdatePackagingList([newItem, ...basePackaging]);
        focusSoon(`[id="packaging-row-${newItem.id}"] input`);
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Base de données des emballages</h1>
                <div className="flex space-x-2">
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                        <Upload className="h-4 w-4 mr-2" /> Importer une liste
                    </button>
                    <button id="tutorial-add-packaging" onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un emballage
                    </button>
                </div>
            </div>

            {basePackaging.length === 0 && (
                <EmptyState message="Aucun emballage dans la base pour l'instant.">
                    <button onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"><PlusCircle className="h-4 w-4 mr-2" /> Ajouter un emballage</button>
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700"><Upload className="h-4 w-4 mr-2" /> Importer une liste</button>
                </EmptyState>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                    <label htmlFor="filterPackagingName" className="block text-sm font-medium text-gray-700">Filtrer par emballage</label>
                    <input
                        type="text"
                        id="filterPackagingName"
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Rechercher un emballage…"
                    />
                </div>
                <div>
                    <label htmlFor="filterPackagingProvider" className="block text-sm font-medium text-gray-700">Filtrer par fournisseur</label>
                    <select
                        id="filterPackagingProvider"
                        value={filterProvider}
                        onChange={e => setFilterProvider(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                        {uniqueProviders.map(provider => (
                            <option key={provider} value={provider}>{provider === 'all' ? 'Tous les fournisseurs' : provider}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="comparisonPackaging" className="block text-sm font-medium text-gray-700">Comparer un emballage</label>
                    <input
                        type="text"
                        id="comparisonPackaging"
                        value={comparisonPackaging}
                        onChange={e => setComparisonPackaging(e.target.value)}
                        list="packaging-name-list"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Nom de l'emballage…"
                    />
                </div>
            </div>

            <datalist id="packaging-name-list">
                {uniquePackagingNames.map(name => <option key={name} value={name} />)}
            </datalist>

            {/* --- Section de comparaison des prix (même outil que IngredientsTab.jsx) --- */}
            {comparisonResults.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Comparaison des prix pour «&nbsp;{comparisonPackaging}&nbsp;»</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-100">
                                <tr>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Fournisseur</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Prix unitaire</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Perte estimée</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Prix effectif ($/{comparisonResults[0]?.unit})</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {comparisonResults.map((item, index) => (
                                    <tr key={item.id} className={index === 0 ? 'bg-green-100' : ''}>
                                        <td className="px-4 py-2 font-medium">{item.provider}</td>
                                        <td className="px-4 py-2">{formatUnitPrice(item.unitPrice)}&nbsp;$</td>
                                        <td className="px-4 py-2 text-red-600">
                                            {formatUnitPrice(item.lossCostPerUnit)} $
                                            <span className="text-xs text-gray-500 ml-1">({item.lossPercentage || 0}%)</span>
                                        </td>
                                        <td className="px-4 py-2 font-bold">
                                            {formatUnitPrice(item.effectiveUnitPrice)} $
                                            {index === 0 && <span className="ml-2 text-xs font-bold text-green-800 bg-green-200 px-2 py-0.5 rounded-full">Meilleur prix</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <datalist id="packaging-provider-list">
                {uniqueProviders.map(provider => provider !== 'all' && <option key={provider} value={provider} />)}
            </datalist>

            <div id="tutorial-section-packaging-db" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-1/6"><button onClick={() => requestSort('name')} className="flex items-center w-full justify-center">Emballage {getSortIcon('name')}</button></th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-1/6"><button onClick={() => requestSort('provider')} className="flex items-center w-full justify-center">Fournisseur {getSortIcon('provider')}</button></th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500"><button onClick={() => requestSort('purchaseFormat')} className="flex items-center w-full justify-center">Format d'achat {getSortIcon('purchaseFormat')}</button></th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Unité de base</th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500"><button onClick={() => requestSort('purchasePrice')} className="flex items-center w-full justify-center">Prix d'achat ($) {getSortIcon('purchasePrice')}</button></th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    Escompte (%)
                                    <Tooltip tip="ing.escompte" />
                                </div>
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    Transport ($)
                                    <Tooltip tip="ing.transport" />
                                </div>
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    <button onClick={() => requestSort('lossPercentage')} className="flex items-center justify-center">Taux de perte (%) {getSortIcon('lossPercentage')}</button>
                                    <Tooltip tip="emb.perte" />
                                </div>
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    <button onClick={() => requestSort('unitPrice')} className="flex items-center justify-center">Prix unitaire ($) {getSortIcon('unitPrice')}</button>
                                    <Tooltip tip="emb.prixUnitaire" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    <button onClick={() => requestSort('lastUpdated')} className="flex items-center w-full justify-center">Dernière mise à jour {getSortIcon('lastUpdated')}</button>
                                    <Tooltip tip="emb.maj" />
                                </div>
                            </th>
                            <th className="relative px-4 py-3 text-center"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedPackaging.map((item, index) => {
                            const isOld = new Date(item.lastUpdated) < thirtyDaysAgo;
                            return (
                            <tr key={item.id} id={`packaging-row-${item.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${item.id === newlyAddedId ? 'new-row' : ''}`}>
                                <td className="px-2 py-2">
                                    <input type="text" value={item.name || ''} onChange={e => handleUpdate(item.id, 'name', e.target.value)} onBlur={() => touchName(item.id)} className={`w-full p-1 text-sm border rounded ${!isNotEmpty(item.name) && isNameTouched(item.id) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isNotEmpty(item.name) && isNameTouched(item.id) && <ValidationMessage message="Requis." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" list="packaging-provider-list" value={item.provider || ''} onChange={e => handleUpdate(item.id, 'provider', e.target.value)} className="w-full p-1 text-sm border rounded" /></td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchaseFormat || ''} onChange={e => handleUpdate(item.id, 'purchaseFormat', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${!isValidNumber(item.purchaseFormat) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isValidNumber(item.purchaseFormat) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <select value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-full min-w-[4.5rem] p-1 text-sm border rounded">
                                        {filterActiveUnits(Object.keys(CONVERSION_FACTORS), activeUnits, item.unit).map(u => (
                                            <option key={u} value={u}>{unitLabel(u)}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchasePrice || ''} onChange={e => handleUpdate(item.id, 'purchasePrice', e.target.value)} className={`w-20 p-1 text-sm border rounded text-right ${!isValidNumber(item.purchasePrice) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isValidNumber(item.purchasePrice) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.discountPercentage || ''} onChange={e => handleUpdate(item.id, 'discountPercentage', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${isInvalidPercentage(item.discountPercentage) ? 'border-red-500' : 'border-gray-300'}`} aria-label="Escompte (%)" />
                                    {isInvalidPercentage(item.discountPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.inboundCost || ''} onChange={e => handleUpdate(item.id, 'inboundCost', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${isNotEmpty(item.inboundCost) && !isValidNumber(item.inboundCost) ? 'border-red-500' : 'border-gray-300'}`} aria-label="Transport ($)" />
                                    {isNotEmpty(item.inboundCost) && !isValidNumber(item.inboundCost) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.lossPercentage || ''} onChange={e => handleUpdate(item.id, 'lossPercentage', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${isInvalidPercentage(item.lossPercentage) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {isInvalidPercentage(item.lossPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" value={formatCurrency(item.unitPrice)} readOnly disabled className="w-16 p-1 text-sm bg-gray-50 border-0 rounded text-right" /></td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center">
                                        <input type="date" value={item.lastUpdated || ''} onChange={e => handleUpdate(item.id, 'lastUpdated', e.target.value)} className="w-full p-1 text-sm border rounded" />
                                        {isOld && <span title="Prix non mis à jour depuis plus de 30 jours" className="ml-2 h-3 w-3 bg-yellow-400 rounded-full"></span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                        {/* Même largeur que la colonne d'actions des ingrédients (qui porte l'icône des allergènes) : les deux onglets restent alignés. */}
                                        <span aria-hidden="true" className="inline-block w-7" />
                                        <button onClick={() => duplicateRow(item.id)} title="Dupliquer l'emballage" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={20} /></button>
                                        <button onClick={() => removeRow(item.id)} title="Supprimer l'emballage" className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20} /></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                        {displayedPackaging.length === 0 && (
                            <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">Aucun emballage ne correspond au filtre.</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination
                    totalItems={filteredAndSortedPackaging.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>


            {isImportWizardOpen && (
                <Suspense fallback={null}>
                    <CatalogImportWizardModal
                        isOpen={isImportWizardOpen}
                        onClose={() => setIsImportWizardOpen(false)}
                        baseItems={basePackaging}
                        onUpdateItemsList={onUpdatePackagingList}
                        showNotification={showNotification}
                        itemLabel="emballage"
                        itemLabelPlural="Emballages"
                        extraNewItemFields={{}}
                    />
                </Suspense>
            )}
        </div>
    );
};
