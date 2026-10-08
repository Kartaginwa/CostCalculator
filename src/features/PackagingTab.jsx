import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { ArrowUpDown, Copy, Trash2, Upload } from 'lucide-react';
import { parseLocaleNumber, generateSlug, formatCurrency, isNotEmpty, isValidNumber, isValidPercentage } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';

// Chargé à la demande : l'assistant d'import est volumineux et rarement ouvert.
const CatalogImportWizardModal = lazy(() => import('./CatalogImportWizardModal.jsx').then(m => ({ default: m.CatalogImportWizardModal })));

// Catalogue d'emballages (Phase 2) — miroir structurel de la base de données des ingrédients
// (IngredientsTab.jsx) : fournisseur, format d'achat, unité, prix, perte %, prix unitaire dérivé,
// analyse ABC et rapport d'achats (Phase 2.3, une fois la consommation par format calculable),
// assistant d'import (même composant générique que les ingrédients — voir
// CatalogImportWizardModal.jsx). Sans allergènes (non pertinent pour un emballage).
export const PackagingTab = ({ itemsPerPage, onItemsPerPageChange }) => {
    const { basePackaging, onUpdatePackagingList, showNotification, setNotification, analysisData } = useProject();
    const { packagingPurchasingReportData, packagingAbcAnalysisData } = analysisData;
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [reportFilterProvider, setReportFilterProvider] = useState('none');

    const [filterName, setFilterName] = useState('');
    const [filterProvider, setFilterProvider] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSortDisabled, setIsSortDisabled] = useState(false);

    const uniqueProviders = useMemo(() => ['all', ...new Set(basePackaging.map(p => p.provider).filter(Boolean))], [basePackaging]);

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
        setCurrentPage(1);
    }, [filterName, filterProvider, itemsPerPage]);

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

        const purchasePrice = parseLocaleNumber(itemToUpdate.purchasePrice);
        const purchaseFormat = parseLocaleNumber(itemToUpdate.purchaseFormat) || 1;
        itemToUpdate.unitPrice = purchasePrice / purchaseFormat;

        if (field === 'purchasePrice') {
            itemToUpdate.lastUpdated = new Date().toISOString().split('T')[0];
        }

        newList[originalIndex] = itemToUpdate;
        onUpdatePackagingList(newList);
    };

    const removeRow = (id) => {
        const itemToDelete = basePackaging.find(item => item.id === id);
        if (!itemToDelete) return;

        const originalList = [...basePackaging];
        onUpdatePackagingList(basePackaging.filter(item => item.id !== id));

        showNotification({
            message: `L'emballage "${itemToDelete.name}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdatePackagingList(originalList);
                setNotification(null);
            }
        });
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
            lastUpdated: new Date().toISOString().split('T')[0],
        };
        setIsSortDisabled(true);
        setCurrentPage(1);
        setNewlyAddedId(newItem.id);
        onUpdatePackagingList([newItem, ...basePackaging]);
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Base de données des emballages</h1>
                <div className="flex space-x-2">
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                        <Upload className="h-5 w-5 mr-2" /> Importer une liste
                    </button>
                    <button id="tutorial-add-packaging" onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        Ajouter un emballage
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                    <label htmlFor="filterPackagingName" className="block text-sm font-medium text-gray-700">Filtrer par emballage</label>
                    <input
                        type="text"
                        id="filterPackagingName"
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Rechercher un emballage..."
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
            </div>

            <datalist id="packaging-provider-list">
                {uniqueProviders.map(provider => provider !== 'all' && <option key={provider} value={provider} />)}
            </datalist>

            <div id="tutorial-section-packaging-db" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6"><button onClick={() => requestSort('name')} className="flex items-center w-full">Emballage {getSortIcon('name')}</button></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6"><button onClick={() => requestSort('provider')} className="flex items-center w-full">Fournisseur {getSortIcon('provider')}</button></th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase"><button onClick={() => requestSort('purchaseFormat')} className="flex items-center w-full">Format Achat {getSortIcon('purchaseFormat')}</button></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité de Base</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase"><button onClick={() => requestSort('purchasePrice')} className="flex items-center w-full">Prix Achat ($) {getSortIcon('purchasePrice')}</button></th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                <div className="flex items-center">
                                    <button onClick={() => requestSort('lossPercentage')} className="flex items-center">Taux de perte (%) {getSortIcon('lossPercentage')}</button>
                                    <Tooltip text="Perte AVANT la production : bris, rebuts, format non conforme. Même logique que le taux de perte des ingrédients." />
                                </div>
                            </th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                <div className="flex items-center">
                                    <button onClick={() => requestSort('unitPrice')} className="flex items-center">Prix Unitaire ($) {getSortIcon('unitPrice')}</button>
                                    <Tooltip text="Calculé automatiquement (Prix d'Achat ÷ Format d'Achat) : c'est ce prix qui sera utilisé pour le coût d'emballage d'une recette." />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                <div className="flex items-center">
                                    <button onClick={() => requestSort('lastUpdated')} className="flex items-center w-full">Dernière MàJ {getSortIcon('lastUpdated')}</button>
                                    <Tooltip text="La date de la dernière modification du prix d'achat. Un point jaune apparaît si la date est supérieure à 30 jours, pour vous alerter qu'il est peut-être temps de le vérifier." />
                                </div>
                            </th>
                            <th className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedPackaging.map((item, index) => {
                            const isOld = new Date(item.lastUpdated) < thirtyDaysAgo;
                            return (
                            <tr key={item.id} id={`packaging-row-${item.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${item.id === newlyAddedId ? 'new-row' : ''}`}>
                                <td className="px-4 py-2">
                                    <input type="text" value={item.name || ''} onChange={e => handleUpdate(item.id, 'name', e.target.value)} className={`w-full p-1 border rounded ${!isNotEmpty(item.name) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isNotEmpty(item.name) && <ValidationMessage message="Requis." />}
                                </td>
                                <td className="px-4 py-2"><input type="text" list="packaging-provider-list" value={item.provider || ''} onChange={e => handleUpdate(item.id, 'provider', e.target.value)} className="w-full p-1 border rounded" /></td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchaseFormat || ''} onChange={e => handleUpdate(item.id, 'purchaseFormat', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidNumber(item.purchaseFormat) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isValidNumber(item.purchaseFormat) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-4 py-2">
                                    <select value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-full p-1 border rounded">
                                        <option value="g">g</option>
                                        <option value="kg">kg</option>
                                        <option value="ml">ml</option>
                                        <option value="L">L</option>
                                        <option value="unité">unité</option>
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchasePrice || ''} onChange={e => handleUpdate(item.id, 'purchasePrice', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidNumber(item.purchasePrice) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isValidNumber(item.purchasePrice) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.lossPercentage || ''} onChange={e => handleUpdate(item.id, 'lossPercentage', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidPercentage(item.lossPercentage) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isValidPercentage(item.lossPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" value={formatCurrency(item.unitPrice)} readOnly disabled className="w-16 p-1 bg-gray-50 border-0 rounded text-right" /></td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center">
                                        <input type="date" value={item.lastUpdated || ''} onChange={e => handleUpdate(item.id, 'lastUpdated', e.target.value)} className="w-full p-1 border rounded" />
                                        {isOld && <span title="Prix non mis à jour depuis plus de 30 jours" className="ml-2 h-3 w-3 bg-yellow-400 rounded-full"></span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                        <button onClick={() => duplicateRow(item.id)} title="Dupliquer l'emballage" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={20} /></button>
                                        <button onClick={() => removeRow(item.id)} title="Supprimer l'emballage" className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20} /></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                        {displayedPackaging.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">Aucun emballage ne correspond au filtre.</td></tr>
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

            {/* Analyse ABC des emballages (Phase 2.3) — même méthode que les ingrédients (Pareto
                70/20/10 sur la valeur de consommation), calculée dans analysisData.js une fois la
                consommation par format connue (2.2). Pas de badge "volatile" ici : le suivi
                historique des prix (Suivi) ne couvre pas encore le packaging. */}
            <div className="mt-8 pt-6 border-t">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyse ABC des emballages</h2>
                <p className="text-sm text-gray-500 mb-4">Cet outil classe vos emballages en trois catégories selon leur importance dans vos coûts totaux, vous aidant à concentrer vos efforts de gestion là où ils comptent le plus.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                        <h3 className="font-bold text-lg text-red-800 flex items-center">Catégorie A <span className="ml-auto text-sm font-normal">({packagingAbcAnalysisData.totals.A.toFixed(1)}% des coûts)</span></h3>
                        <p className="text-xs text-gray-500 mb-2">Très importants. À contrôler de près.</p>
                        <ul className="text-sm space-y-1">
                            {packagingAbcAnalysisData.A.map(item => (
                                <li key={item.name} className="flex justify-between items-center">
                                    <span>{item.name}</span>
                                    <span className="font-mono text-gray-600">{item.percent.toFixed(1)}%</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                        <h3 className="font-bold text-lg text-yellow-800 flex items-center">Catégorie B <span className="ml-auto text-sm font-normal">({packagingAbcAnalysisData.totals.B.toFixed(1)}% des coûts)</span></h3>
                        <p className="text-xs text-gray-500 mb-2">Importance moyenne.</p>
                        <ul className="text-sm space-y-1">
                            {packagingAbcAnalysisData.B.map(item => (
                                <li key={item.name} className="flex justify-between items-center">
                                    <span>{item.name}</span>
                                    <span className="font-mono text-gray-600">{item.percent.toFixed(1)}%</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                        <h3 className="font-bold text-lg text-green-800 flex items-center">Catégorie C <span className="ml-auto text-sm font-normal">({packagingAbcAnalysisData.totals.C.toFixed(1)}% des coûts)</span></h3>
                        <p className="text-xs text-gray-500 mb-2">Faible importance. Contrôle souple.</p>
                        <ul className="text-sm space-y-1">
                            {packagingAbcAnalysisData.C.map(item => (
                                <li key={item.name} className="flex justify-between items-center">
                                    <span>{item.name}</span>
                                    <span className="font-mono text-gray-600">{item.percent.toFixed(1)}%</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                {packagingAbcAnalysisData.A.length === 0 && packagingAbcAnalysisData.B.length === 0 && packagingAbcAnalysisData.C.length === 0 && (
                    <p className="text-sm text-gray-500 mt-4">Aucun emballage consommé pour la période — rattachez des emballages à vos formats de vente (onglet Recette &amp; Calcul) pour voir apparaître cette analyse.</p>
                )}
            </div>

            {/* Rapport d'achats et pertes du packaging — même méthode que les ingrédients. */}
            <div className="mt-8 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Rapport d'achats et pertes pour la période</h2>
                    <div>
                        <label htmlFor="reportFilterProviderPackaging" className="block text-sm font-medium text-gray-700">Filtrer par fournisseur</label>
                        <select
                            id="reportFilterProviderPackaging"
                            value={reportFilterProvider}
                            onChange={e => setReportFilterProvider(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            <option value="all">Tous les fournisseurs</option>
                            <option value="none">Aucun</option>
                            {Object.keys(packagingPurchasingReportData.groupedByProvider).sort().map(provider => (
                                <option key={provider} value={provider}>{provider}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-6">
                    {Object.entries(packagingPurchasingReportData.groupedByProvider)
                        .filter(([provider]) => {
                            if (reportFilterProvider === 'all') return true;
                            if (reportFilterProvider === 'none') return provider === 'Non spécifié';
                            return provider === reportFilterProvider;
                        })
                        .map(([provider, data]) => (
                        <div key={provider} className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">{provider}</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emballage</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qté Nette (Production)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût Net (Production)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qté Perdue (Stock)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût Perdu (Stock)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût d'Achat Requis</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                                <td className="px-4 py-2">{item.totalQuantity.toFixed(2)} {item.unit}</td>
                                                <td className="px-4 py-2">{formatCurrency(item.purchaseCost)} $</td>
                                                <td className="px-4 py-2">{item.lossQuantity.toFixed(2)} {item.unit}</td>
                                                <td className="px-4 py-2 text-red-600">{formatCurrency(item.lossCost)} $</td>
                                                <td className="px-4 py-2 font-bold">{formatCurrency(item.totalCost)} $</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr>
                                            <td colSpan="2" className="px-4 py-2 text-right text-gray-800">Sous-total</td>
                                            <td className="px-4 py-2 text-gray-800">{formatCurrency(data.totalPurchase)} $</td>
                                            <td className="px-4 py-2"></td>
                                            <td className="px-4 py-2 text-red-600">{formatCurrency(data.totalLoss)} $</td>
                                            <td className="px-4 py-2 text-gray-800">{formatCurrency(data.totalCost)} $</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 bg-blue-100 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <h3 className="text-lg font-semibold text-blue-800">Coût Net Total (Production)</h3>
                        <p className="text-2xl font-bold text-blue-900">{formatCurrency(packagingPurchasingReportData.grandTotal.purchase)} $</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-red-800">Coût Total des Pertes</h3>
                        <p className="text-2xl font-bold text-red-900">{formatCurrency(packagingPurchasingReportData.grandTotal.loss)} $</p>
                    </div>
                    <div className="md:col-span-1">
                        <h3 className="text-lg font-semibold text-gray-800">Coût d'Achat Total Requis</h3>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(packagingPurchasingReportData.grandTotal.total)} $</p>
                    </div>
                </div>
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
