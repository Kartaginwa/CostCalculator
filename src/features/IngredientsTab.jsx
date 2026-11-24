import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useTouched, focusSoon, useSessionState, useStateResetOnChange } from '../ui-utils.jsx';
import { ArrowUpDown, Upload, PlusCircle, AlertCircle, Copy, Trash2 } from 'lucide-react';
import { todayLocalISO, landedUnitPrice, parseLocaleNumber, generateSlug, formatUnitPrice, formatCurrency, isNotEmpty, isValidNumber, isInvalidPercentage, CONVERSION_FACTORS, filterActiveUnits, unitLabel, areUnitsCompatible } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination, AllergenModal, EmptyState } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { findIngredientUsages, formatNameList } from '../engine/usage.js';

// Chargé à la demande : l'assistant d'import est volumineux et rarement ouvert.
const CatalogImportWizardModal = lazy(() => import('./CatalogImportWizardModal.jsx').then(m => ({ default: m.CatalogImportWizardModal })));

export const IngredientsTab = ({ itemsPerPage, onItemsPerPageChange }) => {
    const { ingredientsList, baseIngredients, onUpdateIngredientsList, showNotification, setNotification, requestConfirmation, products, activeUnits } = useProject();

    const [isNameTouched, touchName] = useTouched();
    const [filterName, setFilterName] = useSessionState('ingredients.filterName', '');
    const [filterProvider, setFilterProvider] = useSessionState('ingredients.filterProvider', 'all');
    const [sortConfig, setSortConfig] = useSessionState('ingredients.sortConfig', { key: 'name', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const [editingIngredientId, setEditingIngredientId] = useState(null);
    const [currentPage, setCurrentPage] = useStateResetOnChange(1, [filterName, filterProvider, itemsPerPage]); // revient à la page 1 si un filtre change
    const [comparisonIngredient, setComparisonIngredient] = useSessionState('ingredients.comparison', '');
    const [isSortDisabled, setIsSortDisabled] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    // --- LOGIQUE DE PRÉPARATION DES DONNÉES POUR L'AFFICHAGE ---
    // // add this logic here : Définition des variables nécessaires à l'interface
    const uniqueProviders = useMemo(() => ['all', ...new Set(baseIngredients.map(ing => ing.provider).filter(Boolean))], [baseIngredients]);
    const uniqueIngredientNames = useMemo(() => [...new Set(baseIngredients.map(ing => ing.name).filter(Boolean))], [baseIngredients]);
    
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    }, []);

    const comparisonResults = useMemo(() => {
        if (!comparisonIngredient) return [];
        return baseIngredients
            .filter(ing => ing.name.toLowerCase() === comparisonIngredient.toLowerCase())
            .map(ing => {
                const lossP = (parseLocaleNumber(ing.lossPercentage) || 0) / 100;
                const effectiveUnitPrice = lossP > 0 && lossP < 1 ? ing.unitPrice / (1 - lossP) : ing.unitPrice;
                return { ...ing, effectiveUnitPrice, lossCostPerUnit: effectiveUnitPrice - ing.unitPrice };
            })
            .sort((a, b) => a.effectiveUnitPrice - b.effectiveUnitPrice);
    }, [baseIngredients, comparisonIngredient]);

    // // IMPORTANT : Assurez-vous qu'il n'y a PAS de bloc 'useMemo' nommé purchasingReportData ici.
    // // S'il y en a un, supprimez-le, car il utilise 'activeProducts' et cause votre erreur.

    // D'abord, on filtre et trie la liste COMPLÈTE des ingrédients
    const filteredAndSortedIngredients = useMemo(() => {
        let sortableItems = [...ingredientsList];

        if (filterName) {
            sortableItems = sortableItems.filter(item =>
                item.name.toLowerCase().includes(filterName.toLowerCase())
            );
        }
        if (filterProvider !== 'all') {
            sortableItems = sortableItems.filter(item => item.provider === filterProvider);
        }

        // Le tri est maintenant conditionnel
        if (!isSortDisabled) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                let comparison = 0;
                // Gère toutes les colonnes numériques
                if (['purchaseFormat', 'purchasePrice', 'unitPrice', 'lossPercentage'].includes(sortConfig.key)) {
                    comparison = parseLocaleNumber(aValue) - parseLocaleNumber(bValue);
                } else if (sortConfig.key === 'lastUpdated') {
                    comparison = new Date(aValue) - new Date(bValue);
                } else { // Tri alphabétique pour le reste
                    comparison = String(aValue).localeCompare(String(bValue), 'fr', { sensitivity: 'base' });
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }

        return sortableItems;
    }, [ingredientsList, filterName, filterProvider, sortConfig, isSortDisabled]);
    
    // Effet pour gérer la réactivation du tri en cliquant en dehors de la nouvelle ligne
    useEffect(() => {
        // On n'active cet effet que si le tri est désactivé.
        if (!isSortDisabled) {
            return; // Ne fait rien si le tri est déjà actif.
        }

        const handleClickOutside = (event) => {
            const newRowElement = document.getElementById(`ingredient-row-${newlyAddedId}`);

            // Si on clique en dehors de la nouvelle ligne, on réactive le tri.
            if (newRowElement && !newRowElement.contains(event.target)) {
                setIsSortDisabled(false);
                setNewlyAddedId(null); // On oublie la nouvelle ligne, son état est finalisé.
            }
        };

        // On écoute les clics sur tout le document.
        document.addEventListener('mousedown', handleClickOutside);

        // La fonction de nettoyage est cruciale. Elle retire l'écouteur.
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSortDisabled, newlyAddedId]); // Se ré-abonne si ces valeurs changent.

    // Ensuite, on "découpe" la liste filtrée pour n'afficher que la page actuelle
    const displayedIngredients = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredAndSortedIngredients.slice(startIndex, endIndex);
    }, [filteredAndSortedIngredients, currentPage, itemsPerPage]);

    const requestSort = (key) => {
        setIsSortDisabled(false);
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const handleUpdate = (id, field, value) => {
        const originalIndex = baseIngredients.findIndex(item => item.id === id);
        if (originalIndex === -1) return;

        const newList = [...baseIngredients];
        const originalItem = newList[originalIndex];
        const itemToUpdate = { ...originalItem, [field]: value };

        // Génère ou met à jour le slug UNIQUEMENT si l'utilisateur n'a pas fourni de SKU manuellement.
        // On considère qu'un champ uniqueId vide ou commençant par le nom de l'ingrédient est "généré".
        const isGeneratedId = !originalItem.uniqueId || originalItem.uniqueId.startsWith(generateSlug(originalItem.name, ''));

        if (isGeneratedId && (field === 'name' || field === 'provider')) {
            const newName = field === 'name' ? value : itemToUpdate.name;
            const newProvider = field === 'provider' ? value : itemToUpdate.provider;
            if (newName) {
                itemToUpdate.uniqueId = generateSlug(newName, newProvider, itemToUpdate.purchaseFormat, itemToUpdate.unit);
            } else {
                itemToUpdate.uniqueId = ''; // Vide le slug si le nom est vide
            }
        }

        itemToUpdate.unitPrice = landedUnitPrice(itemToUpdate);

        if (field === 'purchasePrice' || field === 'discountPercentage' || field === 'inboundCost') {
            itemToUpdate.lastUpdated = todayLocalISO();
        }

        newList[originalIndex] = itemToUpdate;
        onUpdateIngredientsList(newList);

        // Changer l'unité d'un ingrédient déjà utilisé vers une AUTRE famille (kg → unité, L → kg) laisse les lignes de
        // recette dans leur ancienne unité : le coût serait faux sans erreur visible. On prévient tout de suite.
        if (field === 'unit' && !areUnitsCompatible(value, originalItem.unit)) {
            const usages = findIngredientUsages(products, id);
            if (usages.length > 0) {
                showNotification({
                    message: `L'unité de « ${originalItem.name || 'cet ingrédient'} » est passée de ${unitLabel(originalItem.unit)} à ${unitLabel(value)}, une autre famille d'unités. Les recettes qui l'utilisent (${formatNameList(usages)}) gardent l'ancienne unité\u00A0: corrigez-la dans chaque recette, sinon leur coût est faux.`,
                    type: 'error',
                });
            }
        }
    };
    const handleUpdateAllergens = (ingredientId, newAllergens) => {
        const newList = baseIngredients.map(item => 
            item.id === ingredientId ? { ...item, allergens: newAllergens } : item
        );
        onUpdateIngredientsList(newList);
    };

    const removeRow = (id) => {
        const ingredientToDelete = baseIngredients.find(item => item.id === id);
        if (!ingredientToDelete) return;

        const performDelete = () => {
            const originalList = [...baseIngredients];
            const newList = baseIngredients.filter(item => item.id !== id);
            onUpdateIngredientsList(newList);

            showNotification({
                message: `L'ingrédient «\u00A0${ingredientToDelete.name}\u00A0» a été supprimé.`,
                type: 'info',
                onUndo: () => {
                    onUpdateIngredientsList(originalList);
                    setNotification(null);
                }
            });
        };
        // Un ingrédient utilisé par des recettes : le moteur compterait leur ligne à 0 $ (le coût baisserait sans bruit).
        const usages = findIngredientUsages(products, id);
        if (usages.length > 0) {
            requestConfirmation({
                title: 'Supprimer cet ingrédient ?',
                message: `« ${ingredientToDelete.name || 'Sans nom'} » est utilisé dans\u00A0: ${formatNameList(usages)}. Ces recettes compteront cette ligne à 0\u00A0$ jusqu'à ce que vous choisissiez un autre ingrédient. Vous pourrez annuler juste après.`,
                onConfirm: performDelete,
            });
            return;
        }
        performDelete();
    };
    const duplicateRow = (id) => {
        const ingredientIndex = baseIngredients.findIndex(item => item.id === id);
        if (ingredientIndex === -1) return;

        const ingredientToDuplicate = baseIngredients[ingredientIndex];
        const newIngredient = {
            ...ingredientToDuplicate,
            id: `manual_${Date.now()}_${Math.random()}`,
            name: `${ingredientToDuplicate.name || 'Ingrédient'} (Copie)`,
            uniqueId: '', // <- RÉINITIALISE L'IDENTIFIANT UNIQUE
            isRecipe: false, // S'assure que la copie n'est pas un lien vers une recette
        };

        const newList = [...baseIngredients];
        newList.splice(ingredientIndex + 1, 0, newIngredient);
        onUpdateIngredientsList(newList);
    };

    const addRow = () => {
        const newIngredient = {
            id: `manual_${Date.now()}_${Math.random()}`,
            name: '',
            uniqueId: '',
            provider: '',
            purchaseFormat: 1,
            unit: 'kg',
            purchasePrice: '',
            unitPrice: 0,
            isRecipe: false,
            lossPercentage: 0,
            lastUpdated: todayLocalISO(),
            allergens: []
        };
        // 1. On désactive le tri
        setIsSortDisabled(true);
        // 2. On se place sur la première page
        setCurrentPage(1);
        // 3. On mémorise l'ID du nouvel ingrédient
        setNewlyAddedId(newIngredient.id); 
        // 4. On ajoute le nouvel ingrédient AU DÉBUT de la liste
        onUpdateIngredientsList([newIngredient, ...baseIngredients]);
        focusSoon(`[id="ingredient-row-${newIngredient.id}"] input`);
    };

    const ingredientToEdit = editingIngredientId ? baseIngredients.find(ing => ing.id === editingIngredientId) : null;

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Base de données des ingrédients</h1>
                <div className="flex space-x-2"> {/* Div ajoutée ici */}
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                        <Upload className="h-4 w-4 mr-2" /> Importer une liste
                    </button>
                    <button id="tutorial-add-ingredient" onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un ingrédient
                    </button>
                </div> {/* Fin de la div ajoutée */}
            </div>
            
            {baseIngredients.length === 0 && (
                <EmptyState message="Aucun ingrédient dans la base pour l'instant.">
                    <button onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"><PlusCircle className="h-4 w-4 mr-2" /> Ajouter un ingrédient</button>
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700"><Upload className="h-4 w-4 mr-2" /> Importer une liste</button>
                </EmptyState>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                    <label htmlFor="filterName" className="block text-sm font-medium text-gray-700">Filtrer par ingrédient</label>
                    <input
                        type="text"
                        id="filterName"
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Rechercher un ingrédient…"
                    />
                </div>
                <div>
                    <label htmlFor="filterProvider" className="block text-sm font-medium text-gray-700">Filtrer par fournisseur</label>
                    <select
                        id="filterProvider"
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
                    <label htmlFor="comparisonIngredient" className="block text-sm font-medium text-gray-700">Comparer un ingrédient</label>
                    <input
                        type="text"
                        id="comparisonIngredient"
                        value={comparisonIngredient}
                        onChange={e => setComparisonIngredient(e.target.value)}
                        list="ingredient-name-list"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Nom de l'ingrédient…"
                    />
                </div>
            </div>

            <datalist id="ingredient-name-list">
                {uniqueIngredientNames.map(name => <option key={name} value={name} />)}
            </datalist>

            {/* --- Section de comparaison des prix --- */}
            {comparisonResults.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Comparaison des prix pour «&nbsp;{comparisonIngredient}&nbsp;»</h3>
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
                                            {formatUnitPrice(item.lossCostPerUnit)}&nbsp;$ 
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

            <datalist id="provider-list">
                {uniqueProviders.map(provider => provider !== 'all' && <option key={provider} value={provider} />)}
            </datalist>

            <div id="tutorial-section-ingredients-db" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-1/6"><button onClick={() => requestSort('name')} className="flex items-center w-full justify-center">Ingrédient {getSortIcon('name')}</button></th>
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
                                <button onClick={() => requestSort('lossPercentage')} className="flex items-center justify-center">
                                    Taux de perte (%) {getSortIcon('lossPercentage')}
                                </button>
                                <Tooltip tip="ing.perte" />
                            </div>
                        </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    <button onClick={() => requestSort('unitPrice')} className="flex items-center justify-center">Prix unitaire ($) {getSortIcon('unitPrice')}</button>
                                    <Tooltip tip="ing.prixUnitaire" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                                <div className="flex items-center justify-center">
                                    <button onClick={() => requestSort('lastUpdated')} className="flex items-center w-full justify-center">Dernière mise à jour {getSortIcon('lastUpdated')}</button>
                                    <Tooltip tip="ing.maj" />
                                </div>
                            </th>
                            <th className="relative px-4 py-3 text-center"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedIngredients.map((item, index) => {
                            const isOld = new Date(item.lastUpdated) < thirtyDaysAgo;
                            return (
                            <tr key={item.id} id={`ingredient-row-${item.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${item.id === newlyAddedId ? 'new-row' : ''}`}>
                                <td className="px-2 py-2">
                                    <input type="text" value={item.name || ''} onChange={e => handleUpdate(item.id, 'name', e.target.value)} onBlur={() => touchName(item.id)} className={`w-full p-1 text-sm border rounded ${!isNotEmpty(item.name) && isNameTouched(item.id) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isNotEmpty(item.name) && isNameTouched(item.id) && <ValidationMessage message="Requis." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" list="provider-list" value={item.provider || ''} onChange={e => handleUpdate(item.id, 'provider', e.target.value)} className="w-full p-1 text-sm border rounded" disabled={item.isRecipe}/></td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchaseFormat || ''} onChange={e => handleUpdate(item.id, 'purchaseFormat', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${!isValidNumber(item.purchaseFormat) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isValidNumber(item.purchaseFormat) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <select value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-full min-w-[4.5rem] p-1 text-sm border rounded" disabled={item.isRecipe}>
                                        {filterActiveUnits(Object.keys(CONVERSION_FACTORS), activeUnits, item.unit).map(u => (
                                            <option key={u} value={u}>{unitLabel(u)}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchasePrice || ''} onChange={e => handleUpdate(item.id, 'purchasePrice', e.target.value)} className={`w-20 p-1 text-sm border rounded text-right ${!isValidNumber(item.purchasePrice) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isValidNumber(item.purchasePrice) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.discountPercentage || ''} onChange={e => handleUpdate(item.id, 'discountPercentage', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${!item.isRecipe && isInvalidPercentage(item.discountPercentage) ? 'border-red-500' : 'border-gray-300'} ${item.isRecipe ? 'bg-gray-100' : ''}`} disabled={item.isRecipe} aria-label="Escompte (%)" />
                                    {!item.isRecipe && isInvalidPercentage(item.discountPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.inboundCost || ''} onChange={e => handleUpdate(item.id, 'inboundCost', e.target.value)} className={`w-16 p-1 text-sm border rounded text-right ${!item.isRecipe && isNotEmpty(item.inboundCost) && !isValidNumber(item.inboundCost) ? 'border-red-500' : 'border-gray-300'} ${item.isRecipe ? 'bg-gray-100' : ''}`} disabled={item.isRecipe} aria-label="Transport ($)" />
                                    {!item.isRecipe && isNotEmpty(item.inboundCost) && !isValidNumber(item.inboundCost) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input 
                                        type="text" 
                                        inputMode="decimal" 
                                        value={item.lossPercentage || ''} 
                                        onChange={e => handleUpdate(item.id, 'lossPercentage', e.target.value)} 
                                        className={`w-16 p-1 text-sm border rounded text-right ${!item.isRecipe && isInvalidPercentage(item.lossPercentage) ? 'border-red-500' : 'border-gray-300'} ${item.isRecipe ? 'bg-gray-100' : ''}`}
                                        disabled={item.isRecipe}
                                    />
                                    {!item.isRecipe && isInvalidPercentage(item.lossPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" value={formatCurrency(item.unitPrice)} readOnly disabled className="w-16 p-1 text-sm bg-gray-50 border-0 rounded text-right"/></td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center">
                                        <input type="date" value={item.lastUpdated || ''} onChange={e => handleUpdate(item.id, 'lastUpdated', e.target.value)} className="w-full p-1 text-sm border rounded" disabled={item.isRecipe}/>
                                        {isOld && <span title="Prix non mis à jour depuis plus de 30 jours" className="ml-2 h-3 w-3 bg-yellow-400 rounded-full"></span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    {!item.isRecipe && (
                                        <div className="flex items-center justify-center space-x-1">
                                            <button onClick={() => setEditingIngredientId(item.id)} title="Gérer les allergènes" className={`p-1 rounded-full ${item.allergens && item.allergens.length > 0 ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`}>
                                                <AlertCircle size={20}/>
                                            </button>
                                            <button onClick={() => duplicateRow(item.id)} title="Dupliquer l'ingrédient" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={20}/></button>
                                            <button onClick={() => removeRow(item.id)} title="Supprimer l'ingrédient" className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20}/></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
                <Pagination
                    totalItems={filteredAndSortedIngredients.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>
            <AllergenModal
                isOpen={!!ingredientToEdit}
                onClose={() => setEditingIngredientId(null)}
                ingredientName={ingredientToEdit?.name}
                assignedAllergens={ingredientToEdit?.allergens || []}
                onUpdateAllergens={(newAllergens) => handleUpdateAllergens(ingredientToEdit.id, newAllergens)}
            />
            {isImportWizardOpen && (
                <Suspense fallback={null}>
                    <CatalogImportWizardModal
                        isOpen={isImportWizardOpen}
                        onClose={() => setIsImportWizardOpen(false)}
                        baseItems={baseIngredients}
                        onUpdateItemsList={onUpdateIngredientsList}
                        showNotification={showNotification}
                        itemLabel="ingrédient"
                        itemLabelPlural="Ingrédients"
                        extraNewItemFields={{ isRecipe: false, allergens: [] }}
                    />
                </Suspense>
            )}
        </div>
    );
};