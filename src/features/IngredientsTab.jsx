import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { ArrowUpDown, Upload, AlertCircle, Copy, Trash2 } from 'lucide-react';
import { parseLocaleNumber, generateSlug, formatUnitPrice, formatCurrency, isNotEmpty, isValidNumber, isValidPercentage } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination, AllergenModal } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { computeIngredientVolatility } from '../engine/priceVolatility.js';

// Chargé à la demande : l'assistant d'import est volumineux et rarement ouvert.
const CatalogImportWizardModal = lazy(() => import('./CatalogImportWizardModal.jsx').then(m => ({ default: m.CatalogImportWizardModal })));

// Élément de la liste ABC, avec étiquette « volatile » si le prix de l'ingrédient est jugé volatil
// d'après les points de référence (croisement ABC × volatilité : un item de forte valeur au prix
// volatil est une priorité d'approvisionnement).
const AbcItem = ({ item, volatilityByName }) => {
    const v = volatilityByName[item.name];
    return (
        <li className="flex justify-between items-center">
            <span className="flex items-center">
                {item.name}
                {v && v.isVolatile && (
                    <span
                        title={`Prix volatil : amplitude ${v.amplitudePercent.toFixed(0)} % entre son plus bas et son plus haut sur les points de référence.`}
                        className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                    >
                        volatile
                    </span>
                )}
            </span>
            <span className="font-mono text-gray-600">{item.percent.toFixed(1)}%</span>
        </li>
    );
};

export const IngredientsTab = ({ itemsPerPage, onItemsPerPageChange }) => {
    const { ingredientsList, baseIngredients, onUpdateIngredientsList, showNotification, setNotification, analysisData, trackingPoints } = useProject();
    const priceVolatility = useMemo(() => computeIngredientVolatility(trackingPoints), [trackingPoints]);

    // --- LOGIQUE CENTRALISÉE : ON EXTRAIT LES DONNÉES DU CERVEAU ---
    // // you should modify this part : on récupère les données pré-calculées
    const { purchasingReportData, abcAnalysisData } = analysisData;

    const [filterName, setFilterName] = useState('');
    const [filterProvider, setFilterProvider] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const [editingIngredientId, setEditingIngredientId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [comparisonIngredient, setComparisonIngredient] = useState('');
    const [isSortDisabled, setIsSortDisabled] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [reportFilterProvider, setReportFilterProvider] = useState('none');

    // // IMPORTANT : Supprimez ici tout bloc useMemo ou fonction qui s'appelait 
    // // 'purchasingReportData' ou 'abcAnalysisData' car ils sont maintenant fournis par la prop analysisData.
    // // Ces anciens blocs utilisaient 'activeProducts', ce qui causait votre erreur.

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
    
    // Effet pour revenir à la première page si les filtres changent
    useEffect(() => {
        setCurrentPage(1);
    }, [filterName, filterProvider, itemsPerPage]);

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

        const purchasePrice = parseLocaleNumber(itemToUpdate.purchasePrice);
        const purchaseFormat = parseLocaleNumber(itemToUpdate.purchaseFormat) || 1;
        itemToUpdate.unitPrice = purchasePrice / purchaseFormat;

        if (field === 'purchasePrice') {
            itemToUpdate.lastUpdated = new Date().toISOString().split('T')[0];
        }

        newList[originalIndex] = itemToUpdate;
        onUpdateIngredientsList(newList);
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

        const originalList = [...baseIngredients];
        const newList = baseIngredients.filter(item => item.id !== id);
        onUpdateIngredientsList(newList);

        showNotification({
            message: `L'ingrédient "${ingredientToDelete.name}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdateIngredientsList(originalList);
                setNotification(null);
            }
        });
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
            lastUpdated: new Date().toISOString().split('T')[0],
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
    };

    const ingredientToEdit = editingIngredientId ? baseIngredients.find(ing => ing.id === editingIngredientId) : null;

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Base de données des ingrédients</h1>
                <div className="flex space-x-2"> {/* Div ajoutée ici */}
                    <button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                        <Upload className="h-5 w-5 mr-2" /> Importer une liste
                    </button>
                    <button id="tutorial-add-ingredient" onClick={addRow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        Ajouter un ingrédient
                    </button>
                </div> {/* Fin de la div ajoutée */}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                    <label htmlFor="filterName" className="block text-sm font-medium text-gray-700">Filtrer par ingrédient</label>
                    <input
                        type="text"
                        id="filterName"
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        placeholder="Rechercher un ingrédient..."
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
                        placeholder="Nom de l'ingrédient..."
                    />
                </div>
            </div>

            <datalist id="ingredient-name-list">
                {uniqueIngredientNames.map(name => <option key={name} value={name} />)}
            </datalist>

            {/* --- Section de comparaison des prix --- */}
            {comparisonResults.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Comparaison des prix pour "{comparisonIngredient}"</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Fournisseur</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Prix Unitaire</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Perte Estimée</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Prix Efficace ($/{comparisonResults[0]?.unit})</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {comparisonResults.map((item, index) => (
                                    <tr key={item.id} className={index === 0 ? 'bg-green-100' : ''}>
                                        <td className="px-4 py-2 font-medium">{item.provider}</td>
                                        <td className="px-4 py-2">{formatUnitPrice(item.unitPrice)} $</td>
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

            <datalist id="provider-list">
                {uniqueProviders.map(provider => provider !== 'all' && <option key={provider} value={provider} />)}
            </datalist>

            <div id="tutorial-section-ingredients-db" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6"><button onClick={() => requestSort('name')} className="flex items-center w-full">Ingrédient {getSortIcon('name')}</button></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6"><button onClick={() => requestSort('provider')} className="flex items-center w-full">Fournisseur {getSortIcon('provider')}</button></th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase"><button onClick={() => requestSort('purchaseFormat')} className="flex items-center w-full">Format Achat {getSortIcon('purchaseFormat')}</button></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité de Base</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase"><button onClick={() => requestSort('purchasePrice')} className="flex items-center w-full">Prix Achat ($) {getSortIcon('purchasePrice')}</button></th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            <div className="flex items-center">
                                <button onClick={() => requestSort('lossPercentage')} className="flex items-center">
                                    Taux de perte (%) {getSortIcon('lossPercentage')}
                                </button>
                                <Tooltip text="Perte AVANT la production : péremption, produits abîmés, gaspillage en stock. Ne pas confondre avec le Rendement (onglet Recette), qui couvre la perte PENDANT la préparation (ex. épluchage, cuisson) — les deux se cumulent, ne saisissez pas la même perte aux deux endroits sous peine de gonfler le coût matière." />
                            </div>
                        </th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase"><button onClick={() => requestSort('unitPrice')} className="flex items-center w-full">Prix Unitaire ($) {getSortIcon('unitPrice')}</button></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                <div className="flex items-center">
                                    <button onClick={() => requestSort('lastUpdated')} className="flex items-center w-full">Dernière MàJ {getSortIcon('lastUpdated')}</button>
                                    <Tooltip text="La date de la dernière modification du prix d'achat. Un point jaune apparaît si la date est supérieure à 30 jours." />
                                </div>
                            </th>
                            <th className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedIngredients.map((item, index) => {
                            const isOld = new Date(item.lastUpdated) < thirtyDaysAgo;
                            return (
                            <tr key={item.id} id={`ingredient-row-${item.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${item.id === newlyAddedId ? 'new-row' : ''}`}>
                                <td className="px-4 py-2">
                                    <input type="text" value={item.name || ''} onChange={e => handleUpdate(item.id, 'name', e.target.value)} className={`w-full p-1 border rounded ${!isNotEmpty(item.name) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isNotEmpty(item.name) && <ValidationMessage message="Requis." />}
                                </td>
                                <td className="px-4 py-2"><input type="text" list="provider-list" value={item.provider || ''} onChange={e => handleUpdate(item.id, 'provider', e.target.value)} className="w-full p-1 border rounded" disabled={item.isRecipe}/></td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchaseFormat || ''} onChange={e => handleUpdate(item.id, 'purchaseFormat', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidNumber(item.purchaseFormat) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isValidNumber(item.purchaseFormat) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-4 py-2">
                                    <select value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-full p-1 border rounded" disabled={item.isRecipe}>
                                        <option value="g">g</option>
                                        <option value="kg">kg</option>
                                        <option value="ml">ml</option>
                                        <option value="L">L</option>
                                        <option value="unité">unité</option>
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" inputMode="decimal" value={item.purchasePrice || ''} onChange={e => handleUpdate(item.id, 'purchasePrice', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidNumber(item.purchasePrice) ? 'border-red-500' : 'border-gray-300'}`} disabled={item.isRecipe}/>
                                    {!isValidNumber(item.purchasePrice) && <ValidationMessage message="Nombre invalide." />}
                                </td>
                                <td className="px-2 py-2">
                                    <input 
                                        type="text" 
                                        inputMode="decimal" 
                                        value={item.lossPercentage || ''} 
                                        onChange={e => handleUpdate(item.id, 'lossPercentage', e.target.value)} 
                                        className={`w-16 p-1 border rounded text-right ${!item.isRecipe && !isValidPercentage(item.lossPercentage) ? 'border-red-500' : 'border-gray-300'} ${item.isRecipe ? 'bg-gray-100' : ''}`}
                                        disabled={item.isRecipe}
                                    />
                                    {!item.isRecipe && !isValidPercentage(item.lossPercentage) && <ValidationMessage message="Doit être un %." />}
                                </td>
                                <td className="px-2 py-2"><input type="text" value={formatCurrency(item.unitPrice)} readOnly disabled className="w-16 p-1 bg-gray-50 border-0 rounded text-right"/></td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center">
                                        <input type="date" value={item.lastUpdated || ''} onChange={e => handleUpdate(item.id, 'lastUpdated', e.target.value)} className="w-full p-1 border rounded" disabled={item.isRecipe}/>
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
            {/* NOUVEAU: Analyse ABC des Ingrédients */}
                <div id="tutorial-section-ingredients-abc" className="mt-8 pt-6 border-t">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyse ABC des ingrédients</h2>
                    <p className="text-sm text-gray-500 mb-4">Cet outil classe vos ingrédients en trois catégories selon leur importance dans vos coûts totaux, vous aidant à concentrer vos efforts de gestion là où ils comptent le plus.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Catégorie A */}
                        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <h3 className="font-bold text-lg text-red-800 flex items-center">Catégorie A <span className="ml-auto text-sm font-normal">({abcAnalysisData.totals.A.toFixed(1)}% des coûts)</span></h3>
                            <p className="text-xs text-gray-500 mb-2">Très importants. À contrôler de près.</p>
                            <ul className="text-sm space-y-1">
                                {abcAnalysisData.A.map(item => <AbcItem key={item.name} item={item} volatilityByName={priceVolatility.byName} />)}
                            </ul>
                        </div>
                        {/* Catégorie B */}
                        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                            <h3 className="font-bold text-lg text-yellow-800 flex items-center">Catégorie B <span className="ml-auto text-sm font-normal">({abcAnalysisData.totals.B.toFixed(1)}% des coûts)</span></h3>
                            <p className="text-xs text-gray-500 mb-2">Importance moyenne.</p>
                            <ul className="text-sm space-y-1">
                                {abcAnalysisData.B.map(item => <AbcItem key={item.name} item={item} volatilityByName={priceVolatility.byName} />)}
                            </ul>
                        </div>
                        {/* Catégorie C */}
                        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                            <h3 className="font-bold text-lg text-green-800 flex items-center">Catégorie C <span className="ml-auto text-sm font-normal">({abcAnalysisData.totals.C.toFixed(1)}% des coûts)</span></h3>
                            <p className="text-xs text-gray-500 mb-2">Faible importance. Contrôle souple.</p>
                            <ul className="text-sm space-y-1">
                                {abcAnalysisData.C.map(item => <AbcItem key={item.name} item={item} volatilityByName={priceVolatility.byName} />)}
                            </ul>
                        </div>
                    </div>
                </div>
            <div id="tutorial-section-ingredients-rapport" className="mt-8 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Rapport d'achats et pertes pour la période</h2>
                    <div>
                        <label htmlFor="reportFilterProvider" className="block text-sm font-medium text-gray-700">Filtrer par fournisseur</label>
                        <select
                            id="reportFilterProvider"
                            value={reportFilterProvider}
                            onChange={e => setReportFilterProvider(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            <option value="all">Tous les fournisseurs</option>
                            <option value="none">Aucun</option> {/* <-- AJOUTEZ CETTE LIGNE */}
                            {Object.keys(purchasingReportData.groupedByProvider).sort().map(provider => (
                                <option key={provider} value={provider}>{provider}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-6">
                    {Object.entries(purchasingReportData.groupedByProvider)
                        .filter(([provider]) => {
                            if (reportFilterProvider === 'all') return true;
                            // L'application groupe les ingrédients sans fournisseur sous le nom "Non spécifié"
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
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">
                                                    Qté Nette (Production)
                                                    <Tooltip text="La quantité totale de cet ingrédient qui est réellement utilisée dans vos plats, basée sur vos ventes estimées." />
                                                </div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">
                                                    Coût Net (Production)
                                                    <Tooltip text="Le coût de la quantité nette. C'est la valeur de la matière qui est transformée en plats vendus." />
                                                </div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qté Perdue (Stock)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût Perdu (Stock)</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">
                                                    Coût d'Achat Requis
                                                    <Tooltip text="Le coût total que vous devriez budgéter pour cet ingrédient, incluant le coût de la matière productive et le coût de la perte." />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.items.map(item => (
                                            <tr key={item.id} id={`ingredient-row-${item.id}`} className={item.id === newlyAddedId ? 'new-row' : ''}>
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
                        <p className="text-2xl font-bold text-blue-900">{formatCurrency(purchasingReportData.grandTotal.purchase)} $</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-red-800">Coût Total des Pertes</h3>
                        <p className="text-2xl font-bold text-red-900">{formatCurrency(purchasingReportData.grandTotal.loss)} $</p>
                    </div>
                    <div className="md:col-span-1">
                        <h3 className="text-lg font-semibold text-gray-800">Coût d'Achat Total Requis</h3>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(purchasingReportData.grandTotal.total)} $</p>
                    </div>
                </div>
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