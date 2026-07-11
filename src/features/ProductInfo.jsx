import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ArrowUpDown, AlertTriangle, Upload, Copy, Trash2 } from 'lucide-react';
import { parseLocaleNumber, isValidNumber, isValidPercentage, isNotEmpty, formatCurrency } from '../utils.jsx';
import { Tooltip, ValidationMessage, Pagination } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';

export const ProductInfo = ({ onNewProduct, onDeleteProduct, onDuplicateProduct, handleProductValueChange, itemsPerPage, onItemsPerPageChange, onOpenPosImport }) => {
    const { companyName, onUpdateCompanyName, logoUrl, onUpdateLogoUrl, generalInfo, onUpdateGeneralInfo, products } = useProject();
    const { period, operationCostPerHour, showProductivityWarning } = generalInfo;

    const [filterName, setFilterName] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'platName', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const prevProductsLength = useRef(products.length);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSortDisabled, setIsSortDisabled] = useState(false);

    const uniqueCategories = useMemo(() => ['all', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);

    const filteredAndSortedProducts = useMemo(() => {
        let sortableItems = [...products];

        if (filterName) {
            sortableItems = sortableItems.filter(item =>
                item.platName.toLowerCase().includes(filterName.toLowerCase())
            );
        }
        if (filterCategory !== 'all') {
            sortableItems = sortableItems.filter(item => item.category === filterCategory);
        }

        if (!isSortDisabled) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                let comparison = 0;
                if (sortConfig.key === 'prixVente' || sortConfig.key === 'salesMix') {
                    comparison = parseLocaleNumber(aValue) - parseLocaleNumber(bValue);
                } else {
                    comparison = String(aValue).localeCompare(String(bValue), 'fr', { sensitivity: 'base' });
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }

        return sortableItems;
    }, [products, filterName, filterCategory, sortConfig, isSortDisabled]);

    const displayedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

    const requestSort = (key) => {
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

    const handleBlurRow = (event) => {
        const currentRow = event.currentTarget;
        setTimeout(() => {
            if (!currentRow.contains(document.activeElement)) {
                setIsSortDisabled(false);
                setNewlyAddedId(null);
            }
        }, 0);
    };

    useEffect(() => {
        // Revient à la page 1 si on change les filtres
        setCurrentPage(1);
    }, [filterName, filterCategory]);

    // Detect new product addition
    useEffect(() => {
        // Si un produit a été ajouté (longueur augmentée) et que le tri est en pause
        if (products.length > prevProductsLength.current && isSortDisabled) {
            const newProduct = products[0]; // Le nouveau produit est toujours en haut de la liste
            if (newProduct) {
                setNewlyAddedId(newProduct.id);
            }
        }
        // Met à jour la référence pour la prochaine fois
        prevProductsLength.current = products.length;
    }, [products, isSortDisabled]);

    useEffect(() => {
        // Gère la mise au point et le défilement sur la nouvelle ligne ajoutée
        if (newlyAddedId) {
            setTimeout(() => {
                const newRowElement = document.getElementById(`product-row-${newlyAddedId}`);
                if (newRowElement) {
                    // Fait défiler la vue pour centrer la nouvelle ligne à l'écran
                    newRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const input = newRowElement.querySelector('input');
                    // Place le curseur dans le premier champ de la nouvelle ligne
                    if (input) input.focus();
                }
            }, 100); // Léger délai pour s'assurer que l'élément est bien dans le DOM
        }
    }, [newlyAddedId]);

    const handleAddItem = () => {
        setIsSortDisabled(true); // Met le tri en pause
        setCurrentPage(1);      // Va à la première page
        onNewProduct();         // Appelle la fonction parente pour créer le plat
    };

    const handleLogoFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onUpdateLogoUrl(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const totalSalesMix = useMemo(() => products.filter(p => p.onMenu).reduce((sum, p) => sum + parseLocaleNumber(p.salesMix || 0), 0), [products]);

    return (
        <div id="tutorial-section-recipe-header" className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Paramètres</h1>
            <div id="tutorial-section-info-entreprise" className="p-4 bg-gray-100 rounded-lg">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Informations sur l'entreprise</h2>
                <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nom de l'entreprise</label>
                    <input type="text" id="tutorial-company-name" value={companyName} onChange={(e) => onUpdateCompanyName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" />
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Importer un logo (fichier)</label>
                        <input type="file" accept="image/*" onChange={handleLogoFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Importer un logo (URL)</label>
                        <input type="text" placeholder="https://..." value={logoUrl.startsWith('data:') ? '' : logoUrl} onChange={(e) => onUpdateLogoUrl(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                </div>
                {logoUrl && (
                    <div className="mt-4 flex justify-center items-center bg-white p-2 rounded-md shadow-inner">
                        <img src={logoUrl} alt="Logo de l'entreprise" className="h-24 w-auto object-contain" />
                    </div>
                )}
            </div>

            <div id="tutorial-section-info-frais" className="p-4 bg-gray-100 rounded-lg">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Frais et revenus</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
                    {/* Ligne Période de référence */}
                    <div className="md:col-span-2">
                        <label htmlFor="period" className="flex items-center text-sm font-medium text-gray-700">
                            Période de référence
                            <Tooltip text="La période sur laquelle vos revenus et frais indirects sont basés (semaine, mois, etc.)." />
                        </label>
                        <select id="period" value={period} onChange={(e) => onUpdateGeneralInfo('period', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="weekly">Hebdomadaire</option>
                            <option value="monthly">Mensuelle</option>
                            <option value="quarterly">Trimestrielle</option>
                            <option value="yearly">Annuelle</option>
                            <option value="custom">Personnalisée</option>
                        </select>
                    </div>
                    {period === 'custom' && (
                        <div className="md:col-span-2 grid grid-cols-2 gap-4 -mt-2">
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Date de début</label>
                                <input type="date" id="startDate" value={generalInfo.startDate || ''} onChange={(e) => onUpdateGeneralInfo('startDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Date de fin</label>
                                <input type="date" id="endDate" value={generalInfo.endDate || ''} onChange={(e) => onUpdateGeneralInfo('endDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                            </div>
                        </div>
                    )}

                    {/* Ligne Revenus */}
                    <div>
                        <label htmlFor="totalRevenue" className="flex items-center text-sm font-medium text-gray-700">
                            Revenus totaux ($)
                            <Tooltip text="Votre chiffre d'affaires total pour la période de référence sélectionnée." />
                        </label>
                        <input type="text" inputMode="decimal" id="tutorial-total-revenue" value={generalInfo.totalRevenue || ''} onChange={(e) => onUpdateGeneralInfo('totalRevenue', e.target.value)} onBlur={(e) => onUpdateGeneralInfo('totalRevenue', parseLocaleNumber(e.target.value))} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidNumber(generalInfo.totalRevenue) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidNumber(generalInfo.totalRevenue) && <ValidationMessage message="Veuillez entrer un nombre positif." />}
                    </div>
                    <div>
                        <label htmlFor="menuRevenuePercentage" className="flex items-center text-sm font-medium text-gray-700">
                            Portion des revenus du menu analysé (%)
                            <Tooltip text="Indiquez ici quel pourcentage de vos revenus totaux est représenté par les items listés dans ce calculateur. Par exemple, si les boissons représentent 30% de vos ventes, vous pourriez indiquer 70%." />
                        </label>
                        <input type="text" inputMode="decimal" id="menuRevenuePercentage" value={generalInfo.menuRevenuePercentage || ''} onChange={(e) => onUpdateGeneralInfo('menuRevenuePercentage', e.target.value)} onBlur={(e) => onUpdateGeneralInfo('menuRevenuePercentage', parseLocaleNumber(e.target.value))} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidPercentage(generalInfo.menuRevenuePercentage) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidPercentage(generalInfo.menuRevenuePercentage) && <ValidationMessage message="Doit être un % entre 0 et 100." />}
                        <p className="mt-1 text-sm text-gray-600">
                            Revenus du menu analysé: <span className="font-semibold">{formatCurrency(parseLocaleNumber(generalInfo.totalRevenue) * (parseLocaleNumber(generalInfo.menuRevenuePercentage) / 100))} $</span>
                        </p>
                    </div>

                    {/* Ligne Frais indirects */}
                    <div className="md:col-span-2">
                        <label htmlFor="totalIndirects" className="flex items-center text-sm font-medium text-gray-700">
                            Frais indirects totaux ($)
                            <Tooltip text="Tous les coûts qui ne sont pas directement liés à la production d'un plat spécifique (loyer, électricité, salaires administratifs, etc.)." />
                        </label>
                        <input type="text" inputMode="decimal" id="totalIndirects" value={generalInfo.totalIndirects || ''} onChange={(e) => onUpdateGeneralInfo('totalIndirects', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidNumber(generalInfo.totalIndirects) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidNumber(generalInfo.totalIndirects) && <ValidationMessage message="Veuillez entrer un nombre positif." />}
                    </div>

                    {/* Ligne Main d'oeuvre et Heures */}
                    <div className="md:col-span-2">
                        <label htmlFor="totalKitchenLaborCost" className="flex items-center text-sm font-medium text-gray-700">
                            Coût main-d'œuvre cuisine total ($)
                            <Tooltip text="Ce coût est maintenant calculé automatiquement à partir des données de l'onglet Main-d'œuvre." />
                        </label>
                        <input type="text" value={formatCurrency(generalInfo.totalKitchenLaborCost)} readOnly disabled className="mt-1 block w-full rounded-md bg-gray-50 p-1 border-0 text-right" />
                    </div>
                    <div>
                        <label htmlFor="operationHours" className="flex items-center text-sm font-medium text-gray-700">
                            Heures totales d'opération
                            <Tooltip text="Le nombre total d'heures d'ouverture de votre établissement pendant la période de référence." />
                        </label>
                        <input type="text" inputMode="decimal" id="operationHours" value={generalInfo.operationHours || ''} onChange={(e) => onUpdateGeneralInfo('operationHours', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidNumber(generalInfo.operationHours) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidNumber(generalInfo.operationHours) && <ValidationMessage message="Veuillez entrer un nombre positif." />}
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700">
                            Coût horaire d'opération ($/h)
                            <Tooltip text="Calculé automatiquement (Frais indirects totaux / Heures d'opération). Représente le coût de fonctionnement de votre établissement par heure." />
                        </label>
                        <input type="text" value={formatCurrency(operationCostPerHour)} readOnly disabled className="mt-1 block w-full rounded-md bg-gray-50 p-1 border-0 text-right" />
                    </div>

                    {/* Ligne Avertissement */}
                    {showProductivityWarning && (
                        <div className="md:col-span-2 p-3 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm flex items-center justify-center">
                            <AlertTriangle className="inline h-4 w-4 mr-2"/>
                            <span>Attention : Le coût de main-d'œuvre direct calculé est supérieur au coût total entré. Veuillez vérifier vos données.</span>
                        </div>
                    )}
                </div>
            </div>

            <div id="tutorial-section-info-objectifs" className="p-4 bg-gray-100 rounded-lg">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Objectifs stratégiques</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="foodCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                            Objectif coût matière (%)
                            <Tooltip text="Le pourcentage maximum du prix de vente que le coût des ingrédients devrait représenter." />
                        </label>
                        <input type="text" inputMode="decimal" id="foodCostTarget" value={generalInfo.foodCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('foodCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidPercentage(generalInfo.foodCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidPercentage(generalInfo.foodCostTarget) && <ValidationMessage message="Doit être un %." />}
                    </div>
                    <div>
                        <label htmlFor="laborCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                            Objectif coût main-d'oeuvre (%)
                            <Tooltip text="Le pourcentage maximum du prix de vente que le coût de la main-d'oeuvre devrait représenter." />
                        </label>
                        <input type="text" inputMode="decimal" id="laborCostTarget" value={generalInfo.laborCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('laborCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidPercentage(generalInfo.laborCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                        {!isValidPercentage(generalInfo.laborCostTarget) && <ValidationMessage message="Doit être un %." />}
                    </div>
                </div>
            </div>

            <div id="tutorial-section-info-menu" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">Menu et recettes</h2>
                    <div className="flex items-center space-x-2">
                        <button onClick={onOpenPosImport} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                            <Upload className="h-5 w-5 mr-2" /> Importer depuis POS
                        </button>
                        <button id="tutorial-add-item" onClick={handleAddItem} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            Ajouter un item
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label htmlFor="filterPlatName" className="block text-sm font-medium text-gray-700">Filtrer par nom</label>
                        <input
                            type="text"
                            id="filterPlatName"
                            value={filterName}
                            onChange={e => setFilterName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            placeholder="Rechercher un plat..."
                        />
                    </div>
                    <div>
                        <label htmlFor="filterCategory" className="block text-sm font-medium text-gray-700">Filtrer par catégorie</label>
                        <select
                            id="filterCategory"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {uniqueCategories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'all' ? 'Toutes les catégories' : cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {products.length > 0 && Math.round(totalSalesMix) !== 100 && (
                    <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm flex items-center justify-center">
                        <AlertTriangle className="inline h-4 w-4 mr-2"/>
                        Attention : Le total de votre mix des ventes est de {totalSalesMix.toFixed(1)}%. Pour une analyse précise, il devrait être de 100%.
                    </div>
                )}
                
                <datalist id="category-list">
                    {uniqueCategories.map(cat => cat !== 'all' && <option key={cat} value={cat} />)}
                </datalist>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <button onClick={() => requestSort('platName')} className="flex items-center w-full">Nom du plat {getSortIcon('platName')}</button>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">
                                        <button onClick={() => requestSort('category')} className="flex items-center">Catégorie {getSortIcon('category')}</button>
                                        <Tooltip text="Regroupez vos plats par catégorie (ex: Entrées, Plats principaux, Desserts) pour une meilleure organisation." />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">
                                        <button onClick={() => requestSort('prixVente')} className="flex items-center">Prix de vente ($) {getSortIcon('prixVente')}</button>
                                        <Tooltip text="Le prix affiché sur votre menu pour le client." />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">
                                        <button onClick={() => requestSort('salesMix')} className="flex items-center">Mix des Ventes (%) {getSortIcon('salesMix')}</button>
                                        <Tooltip text="La part en pourcentage que ce plat représente dans vos ventes totales. La somme de tous les plats au menu devrait idéalement être de 100%." />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">
                                        Au Menu
                                        <Tooltip text="Cochez cette case pour inclure un plat dans les calculs basés sur les ventes (ex: analyse stratégique)." />
                                    </div>
                                </th>
                                <th className="relative px-4 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayedProducts.map((product, index) => {
                                const originalIndex = products.findIndex(p => p.id === product.id);
                                return (
                                <tr key={product.id} id={`product-row-${product.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${product.id === newlyAddedId ? 'new-row' : ''}`}onBlur={handleBlurRow}tabIndex={-1}>
                                    <td className="px-4 py-2">
                                        <input type="text" value={product.platName || ''} onChange={(e) => handleProductValueChange(originalIndex, 'platName', e.target.value)} className={`w-full p-1 border rounded ${!isNotEmpty(product.platName) ? 'border-red-500' : 'border-gray-300'}`} />
                                        {!isNotEmpty(product.platName) && <ValidationMessage message="Requis." />}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center">
                                            <input type="text" list="category-list" value={product.category || ''} onChange={(e) => handleProductValueChange(originalIndex, 'category', e.target.value)} className="w-full p-1 border rounded" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center">
                                            <input type="text" inputMode="decimal" value={product.prixVente || ''} onChange={(e) => handleProductValueChange(originalIndex, 'prixVente', e.target.value)} className={`w-24 p-1 border rounded text-right ${!isValidNumber(product.prixVente) ? 'border-red-500' : 'border-gray-300'}`} />
                                        </div>
                                        {!isValidNumber(product.prixVente) && <ValidationMessage message="Nombre invalide." />}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center">
                                            <input type="text" inputMode="decimal" value={product.salesMix || ''} onChange={(e) => handleProductValueChange(originalIndex, 'salesMix', e.target.value)} disabled={!product.onMenu} className={`w-24 p-1 border rounded text-right ${!isValidPercentage(product.salesMix) ? 'border-red-500' : 'border-gray-300'} ${!product.onMenu ? 'bg-gray-100' : ''}`} />
                                        </div>
                                        {!isValidPercentage(product.salesMix) && <ValidationMessage message="Doit être un %." />}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <input type="checkbox" checked={product.onMenu} onChange={(e) => handleProductValueChange(originalIndex, 'onMenu', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={() => onDuplicateProduct(originalIndex)} title="Dupliquer le plat" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={20}/></button>
                                            <button onClick={() => onDeleteProduct(originalIndex)} title="Supprimer le plat" className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                <Pagination
                    totalItems={filteredAndSortedProducts.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
                </div>
            </div>
        </div>
    );
};