import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, ChevronDown, GripVertical, Trash2, Scale } from 'lucide-react';
import {
    parseLocaleNumber, isValidNumber, isValidPositiveInteger, isValidPercentage,
    formatCurrency, formatUnitPrice, formatSecondsToTime, formatPercent,
    getCompatibleUnits, CONVERSION_FACTORS, MAJOR_ALLERGENS,
} from '../utils.js';
import { getCostTargetIndicator, useValueFlash } from '../ui-utils.jsx';
import { Tooltip, ValidationMessage, FlashingCell, GanttChart, PersonnelModal, AllergenModal, Combobox, TimeInput } from '../components/common.jsx';
import { calculateCosts } from '../engine/calculateCosts.js';
import { useProject } from '../state/ProjectContext.jsx';
import { indirectCostMethodLabels } from '../state/initialState.js';

export const RecipeCalculator = ({ editingProductIndex, onSelectProduct, openRecipeSections, setOpenRecipeSections }) => {
    const { products, baseIngredients, onUpdateProducts, generalInfo, ingredientsList, laborDatabase, analysisData, showNotification, setNotification } = useProject();
    const product = products[editingProductIndex] || null;

    const [isSimulating, setIsSimulating] = useState(false);
    const [simulatedPrice, setSimulatedPrice] = useState('');
    const [newlyAddedRowId, setNewlyAddedRowId] = useState(null);
    const [newlyAddedStepId, setNewlyAddedStepId] = useState(null);
    const [isResaleAllergenModalOpen, setIsResaleAllergenModalOpen] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null); // { index: number, type: 'ingredient' | 'step' }
    const [editingStepIndex, setEditingStepIndex] = useState(null);

    const toggleSection = (sectionId) => {
        setOpenRecipeSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        if (newlyAddedStepId) {
            setTimeout(() => {
                const newRowElement = document.getElementById(`step-row-${newlyAddedStepId}`);
                if (newRowElement) {
                    newRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const input = newRowElement.querySelector('input');
                    if (input) input.focus();
                }
                // Réinitialise après un délai pour l'animation
                setTimeout(() => setNewlyAddedStepId(null), 500);
            }, 100);
        }
    }, [newlyAddedStepId]);


    // Tous les hooks ci-dessous doivent s'exécuter dans le même ordre à chaque rendu : on ne
    // peut pas les placer après un retour anticipé, sinon React plante dès qu'on passe de 0 à
    // 1 produit (nombre de hooks incohérent entre deux rendus du même composant monté).
    const recipeAllergens = useMemo(() => {
        if (!product) return [];
        // SI c'est un produit de revente, on utilise sa liste manuelle
        if (product.isResaleProduct) {
            return product.manualAllergens || [];
        }
        // SINON, on calcule à partir des ingrédients
        const allergens = new Set();
        (product.ingredients || []).forEach(item => {
            const baseIngredient = ingredientsList.find(ing => ing.id === item.id);
            if (baseIngredient && baseIngredient.allergens) {
                baseIngredient.allergens.forEach(allergen => allergens.add(allergen));
            }
        });
        return Array.from(allergens);
    }, [product, ingredientsList]);

    // Réutilise les coûts déjà calculés dans la source unique (analysisData.productsWithCosts)
    // plutôt que de relancer calculateCosts : le produit édité est celui du tableau products, donc
    // ses coûts y sont à jour au même rendu. La simulation de prix, elle, reste un calcul dédié
    // (ci-dessous) car elle utilise un prix de vente override.
    const costs = product
        ? (analysisData.productsWithCosts.find(p => p.id === product.id)?.costs ?? null)
        : null;

    const productionSummary = useMemo(() => {
        if (!product || !product.productionSteps || product.productionSteps.length === 0) {
            return { totalProductionTime: 0, totalLaborTime: 0, laborIntensity: 0 };
        }

        let totalProductionTime = 0;
        let totalLaborTime = 0;

        product.productionSteps.forEach(step => {
            const duration = parseLocaleNumber(step.duration) || 0;
            const startTime = parseLocaleNumber(step.startTime) || 0;
            const personnelCount = step.personnel?.length || 0;

            const endTime = startTime + duration;
            if (endTime > totalProductionTime) {
                totalProductionTime = endTime;
            }
            totalLaborTime += duration * personnelCount;
        });

        const laborIntensity = totalProductionTime > 0 ? (totalLaborTime / totalProductionTime) : 0;

        return { totalProductionTime, totalLaborTime, laborIntensity };
    }, [product]);

    const flashTotalCost = useValueFlash(costs?.totalCostPerPortion ?? 0);
    const flashNetMargin = useValueFlash(costs?.margeNetteDollar ?? 0);

    const simulatedCosts = (product && isSimulating && isValidNumber(simulatedPrice))
        ? calculateCosts(product, generalInfo, baseIngredients, products, laborDatabase, simulatedPrice)
        : null;

    const { breakEvenForProduct, breakEvenDescription } = useMemo(() => {
        if (!product || !costs) return { breakEvenForProduct: null, breakEvenDescription: '' };
        const relevantCosts = simulatedCosts || costs;
        if (relevantCosts.margeBruteDollar <= 0) {
            return { breakEvenForProduct: null, breakEvenDescription: "La marge brute par unité est nulle ou négative. Le point mort ne peut être atteint." };
        }

        const salesMixPercent = parseLocaleNumber(product.salesMix) / 100;

        if (salesMixPercent <= 0) {
            return { breakEvenForProduct: null, breakEvenDescription: "Le mix des ventes doit être supérieur à 0 pour calculer le point mort." };
        }

        const allocatedIndirects = parseLocaleNumber(generalInfo.totalIndirects) * salesMixPercent;
        const breakEvenUnits = Math.ceil(allocatedIndirects / relevantCosts.margeBruteDollar);
        return {
            breakEvenForProduct: breakEvenUnits,
            breakEvenDescription: "Unités à vendre pour couvrir la part des frais indirects totaux allouée à ce plat (basé sur le mix des ventes)."
        };

    }, [product, generalInfo.totalIndirects, costs, simulatedCosts]);

    if (!product) return <div className="text-center p-8">Veuillez d'abord sélectionner ou ajouter un plat.</div>;

    const handleDragStart = (e, index, type) => {
        setDraggedItem({ index, type });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetIndex, type) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.type !== type) return;

        const sourceIndex = draggedItem.index;
        if (sourceIndex === targetIndex) return;

        const newProducts = [...products];
        const productToUpdate = { ...newProducts[editingProductIndex] };
        const list = [...(productToUpdate[type === 'ingredient' ? 'ingredients' : 'productionSteps'] || [])];

        const [draggedElement] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, draggedElement);

        if (type === 'ingredient') {
            productToUpdate.ingredients = list;
        } else {
            productToUpdate.productionSteps = list;
        }

        newProducts[editingProductIndex] = productToUpdate;
        onUpdateProducts(newProducts);
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const productivityFactor = (generalInfo.kitchenProductivity > 0 && generalInfo.kitchenProductivity <= 100) ? generalInfo.kitchenProductivity / 100 : 1;
    const availableIngredients = ingredientsList.filter(ing => ing.id !== product.id);


    // --- GESTIONNAIRES ---
    const handleProductChange = (field, value) => {
        const newProducts = products.map((p, index) => {
            if (index === editingProductIndex) {
                const updatedProduct = { ...p, [field]: value };

                if (field === 'isResaleProduct' && value === true) {
                    // Vide les listes de la recette pour éviter de conserver des données erronées
                    updatedProduct.ingredients = [];
                    updatedProduct.productionSteps = [];
                }

                return updatedProduct;
            }
            return p;
        });
        onUpdateProducts(newProducts);
    };
    const addRow = (category) => {
        // Pour l'instant, ne gère que les ingrédients
        if (category !== 'ingredients') return;

        const newRow = { 
            rowId: `ing_${Date.now()}_${Math.random()}`, 
            id: '', 
            name: '', 
            quantity: '', 
            unit: '', 
            cost: 0, 
            yieldPercentage: 100,
            recipeUnit: ''
        };

        const newProducts = [...products];
        const currentIngredients = newProducts[editingProductIndex].ingredients || [];
        newProducts[editingProductIndex] = { ...newProducts[editingProductIndex], ingredients: [...currentIngredients, newRow] };
        onUpdateProducts(newProducts);

        // Déclenche l'animation sur la nouvelle ligne
        setNewlyAddedRowId(newRow.rowId);
        setTimeout(() => setNewlyAddedRowId(null), 500); // Doit correspondre à la durée de l'animation CSS
    };
    const removeRow = (category, indexToRemove) => {
        const key = category === 'ingredients' ? 'ingredients' : 'productionSteps';
        const itemToDelete = product[key][indexToRemove];
        if (!itemToDelete) return;

        const itemName = itemToDelete.name || 'un ingrédient';
        const originalProducts = JSON.parse(JSON.stringify(products));

        const newProducts = products.map((p, pIndex) => {
            if (pIndex !== editingProductIndex) return p;

            const updatedList = (p[key] || []).filter((_, index) => index !== indexToRemove);
            return { ...p, [key]: updatedList };
        });
        onUpdateProducts(newProducts);

        showNotification({
            message: `L'ingrédient "${itemName}" a été retiré de la recette.`,
            type: 'info',
            onUndo: () => {
                onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };
    
    const handleValueChange = (category, itemIndex, field, value) => {
        if (category !== 'ingredients') return;

        const newProducts = products.map((p, pIndex) => {
            if (pIndex !== editingProductIndex) return p;

            const updatedCategory = p[category].map((item, iIndex) => {
                if (iIndex !== itemIndex) return item;

                const updatedItem = { ...item, [field]: value };

                // Si on change l'ingrédient, on met à jour toutes ses infos
                if (field === 'id') {
                    const selectedIngredient = ingredientsList.find(ing => ing.id == value);
                    if (selectedIngredient) {
                        updatedItem.name = selectedIngredient.name;
                        updatedItem.unit = selectedIngredient.unit;
                        updatedItem.cost = selectedIngredient.unitPrice;
                        updatedItem.recipeUnit = selectedIngredient.unit; // On initialise l'unité de la recette
                    }
                }
                return updatedItem;
            });

            return { ...p, [category]: updatedCategory };
        });
        onUpdateProducts(newProducts);
    };

    const openPersonnelModal = (index) => {
        setEditingStepIndex(index);
    };

    const closePersonnelModal = () => {
        setEditingStepIndex(null);
    };

    const handleStepChange = (stepIndex, field, value) => {
        const newProducts = [...products];
        const newSteps = [...(newProducts[editingProductIndex].productionSteps || [])];
        newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
        newProducts[editingProductIndex] = { ...newProducts[editingProductIndex], productionSteps: newSteps };
        onUpdateProducts(newProducts);
    };

    const handlePersonnelChange = (personnel) => {
        if (editingStepIndex === null) return;
        handleStepChange(editingStepIndex, 'personnel', personnel);
    };

    const addStep = () => {
        const newStep = {
            stepId: `step_${Date.now()}_${Math.random()}`,
            stepName: '',
            personnel: [],
            startTime: 0,
            duration: 0
        };
        const newProducts = [...products];
        const currentSteps = newProducts[editingProductIndex].productionSteps || [];
        newProducts[editingProductIndex] = { ...newProducts[editingProductIndex], productionSteps: [...currentSteps, newStep] };
        onUpdateProducts(newProducts);
        // Déclenche l'animation
        setNewlyAddedStepId(newStep.stepId);
    };

    const removeStep = (stepIndex) => {
        const stepToDelete = product.productionSteps[stepIndex];
        if (!stepToDelete) return;

        const originalProducts = JSON.parse(JSON.stringify(products));
        const newProducts = [...products];
        const currentSteps = newProducts[editingProductIndex].productionSteps || [];
        newProducts[editingProductIndex] = { ...newProducts[editingProductIndex], productionSteps: currentSteps.filter((_, i) => i !== stepIndex) };
        onUpdateProducts(newProducts);

        showNotification({
            message: `L'étape "${stepToDelete.stepName}" a été supprimée.`,
            type: 'info',
            onUndo: () => {
                onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    const handleIndirectCostChange = (field, value) => {
        const newProducts = products.map((p, index) => {
            if (index === editingProductIndex) {
                return {
                    ...p,
                    indirectCosts: {
                        ...p.indirectCosts,
                        [field]: value
                    }
                };
            }
            return p;
        });
        onUpdateProducts(newProducts);
    };

    const handleApplySimulatedPrice = () => {
        if (isSimulating && isValidNumber(simulatedPrice)) {
            handleProductChange('prixVente', simulatedPrice);
            setIsSimulating(false);
            setSimulatedPrice('');
            showNotification({ message: `Prix de vente de "${product.platName}" mis à jour.`, type: 'success' });
        }
    };
    const handleResaleAllergenChange = (newAllergens) => {
        handleProductChange('manualAllergens', newAllergens);
    };

const handleIngredientUpdate = (itemIndex, selection) => {
    const newProducts = products.map((p, pIndex) => {
        if (pIndex !== editingProductIndex) return p;

        const updatedIngredients = p.ingredients.map((item, iIndex) => {
            if (iIndex !== itemIndex) return item;

            // Si la sélection est un objet, cela veut dire qu'on a choisi un ingrédient de la liste
            if (typeof selection === 'object' && selection !== null) {
                return {
                    ...item,
                    id: selection.id,
                    name: selection.name,
                    unit: selection.unit,
                    cost: selection.unitPrice,
                    recipeUnit: selection.unit,
                };
            }

            // Sinon, c'est une saisie de texte libre
            return {
                ...item,
                id: '', // Pas d'ID pour un ingrédient personnalisé
                name: selection, // 'selection' est la chaîne de caractères brute
                unit: '',
                cost: 0,
                recipeUnit: '',
            };
        });

        return { ...p, ingredients: updatedIngredients };
    });
    onUpdateProducts(newProducts);
};

    // --- FIN GESTIONNAIRES ---

    const getMarginTextColorClass = (marginPercent) => {
        const margin = marginPercent * 100;
        if (margin > 50) return 'text-green-800';
        if (margin > 25) return 'text-green-700';
        if (margin > 0) return 'text-green-600';
        if (margin < -50) return 'text-red-800';
        if (margin < -25) return 'text-red-700';
        if (margin < 0) return 'text-red-600';
        return 'text-gray-800';
    };

    const renderComparison = (original, simulated, formatFn, higherIsBetter, suffix = '') => {
        const diff = simulated - original;
        let diffColor = 'text-gray-500';
        if (diff > 0) {
            diffColor = higherIsBetter ? 'text-green-600' : 'text-red-600';
        } else if (diff < 0) {
            diffColor = higherIsBetter ? 'text-red-600' : 'text-green-600';
        }
        const sign = diff > 0 ? '+' : '';
    
        return (
            <>
                <span className="font-bold">{formatFn(simulated)}{suffix}</span>
                <span className={`ml-2 text-sm ${diffColor}`}>({sign}{formatFn(diff)}{suffix})</span>
            </>
        );
    };

    return (
        <div id="tutorial-section-recipe-header" className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl space-y-8">
            <PersonnelModal 
                isOpen={editingStepIndex !== null}
                onClose={closePersonnelModal}
                step={editingStepIndex !== null ? product.productionSteps[editingStepIndex] : null}
                laborDatabase={laborDatabase}
                onUpdatePersonnel={handlePersonnelChange}
            />
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Recette et calcul pour :</h1>
                <select value={editingProductIndex} onChange={(e) => onSelectProduct(parseInt(e.target.value, 10))} className="flex-1 p-2 border rounded-md">
                    {products.map((p, index) => <option key={p.id || index} value={index}>{p.platName || `Plat ${index + 1}`}</option>)}
                </select>
            </div>
            
            <div className="grid grid-cols-3 gap-4 items-start">
                <div>
                    <label htmlFor="nbPortions" className="flex items-center text-sm font-medium text-gray-700">
                        Nombre de portions
                        <Tooltip text="Le nombre de portions que cette recette produit." />
                    </label>
                    <input type="text" inputMode="numeric" id="nbPortions" value={product.nbPortions || ''} onChange={(e) => handleProductChange('nbPortions', e.target.value)} className={`mt-1 w-full rounded-md shadow-sm p-2 border text-right ${!isValidPositiveInteger(product.nbPortions) ? 'border-red-500' : 'border-gray-300'}`} />
                    {!isValidPositiveInteger(product.nbPortions) && <ValidationMessage message="Doit être un entier positif." />}
                </div>
                 <div>
                    <label htmlFor="portionSize" className="flex items-center text-sm font-medium text-gray-700">
                        Quantité par portion
                        <Tooltip text="La taille de chaque portion (ex: 250g, 1 unité)." />
                    </label>
                    <input type="text" inputMode="decimal" id="portionSize" value={product.portionSize || ''} onChange={(e) => handleProductChange('portionSize', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidNumber(product.portionSize) ? 'border-red-500' : 'border-gray-300'}`} />
                    {!isValidNumber(product.portionSize) && <ValidationMessage message="Nombre positif requis." />}
                </div>
                <div>
                    <label htmlFor="portionUnit" className="block text-sm font-medium text-gray-700">Unité</label>
                    <select id="portionUnit" value={product.portionUnit} onChange={(e) => handleProductChange('portionUnit', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="unité">unité</option>
                    </select>
                </div>
            </div>
            <div className="mt-2">
                <label htmlFor="isIngredient" className="flex items-center text-sm font-medium text-gray-700">
                    <input type="checkbox" id="isIngredient" checked={product.isIngredient} onChange={(e) => handleProductChange('isIngredient', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"/>
                    Considérer comme une sous-recette (mise en place) / un ingrédient
                    <Tooltip text="Cochez cette case si cette recette est utilisée comme ingrédient dans d'autres plats (ex: une sauce de base)." />
                </label>
            </div>
            <div className="mt-2">
                <label htmlFor="isResaleProduct" className="flex items-center text-sm font-medium text-gray-700">
                    <input type="checkbox" id="isResaleProduct" checked={product.isResaleProduct} onChange={(e) => handleProductChange('isResaleProduct', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"/>
                    Considérer comme un produit de revente
                    <Tooltip text="Cochez cette case pour les produits achetés et revendus sans transformation (ex: boissons, croustilles). Cela simplifiera la fiche de coût à un simple coût d'achat." />
                </label>
            </div>
            {recipeAllergens.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-red-800 flex items-center mb-2">
                        <AlertCircle size={16} className="mr-2" />
                        Allergènes détectés dans cette recette :
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {recipeAllergens.map(allergenKey => {
                            const allergen = MAJOR_ALLERGENS.find(a => a.key === allergenKey);
                            return (
                                <span key={allergenKey} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                                    {allergen ? allergen.name : allergenKey}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}


            {!product.isResaleProduct && (
                <>
                    {/* Ingrédients */}
                    <div id="tutorial-section-recipe-ingredients" className="p-4 bg-green-50 rounded-lg relative z-20">
                <div
                    onClick={() => toggleSection('ingredients')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('ingredients')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('ingredients')}
                >
                    <h2 className="text-xl font-semibold text-green-700">1. Ingrédients</h2>
                    <ChevronDown className={`h-6 w-6 text-green-700 transform transition-transform duration-200 ${openRecipeSections.has('ingredients') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('ingredients') && (
                <div className="mt-4">
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="min-w-full">
                         <thead className="bg-green-100">
                            <tr>
                                <th className="px-2 py-2 w-12"></th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût U. ($)</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center whitespace-nowrap">
                                        Rendement (%)
                                        <Tooltip text="Perte PENDANT la préparation de cette recette : parage, épluchage, cuisson, etc. Exemple : 1kg de carottes donne 800g après épluchage, le rendement est de 80%. Ne pas confondre avec le Taux de perte (onglet Ingrédients), qui couvre la perte AVANT production (péremption, stock) — les deux se cumulent, ne saisissez pas la même perte aux deux endroits sous peine de gonfler le coût matière." />
                                    </div>
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût Total ($)</th>
                                <th className="relative px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(product.ingredients || []).map((item, index) => {
                                const baseIngredient = ingredientsList.find(ing => ing.id === item.id);
                                const recipeUnit = item.recipeUnit || baseIngredient?.unit;
                                const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[baseIngredient?.unit]?.factor || 1);
                                const quantityInBaseUnit = parseLocaleNumber(item.quantity) * conversionFactor;
                                const baseCost = quantityInBaseUnit * parseLocaleNumber(baseIngredient?.unitPrice || 0);

                                const yieldPercent = parseLocaleNumber(item.yieldPercentage);
                                const displayedUnitPrice = (baseIngredient?.unitPrice || 0) / (CONVERSION_FACTORS[baseIngredient?.unit]?.factor || 1) * (CONVERSION_FACTORS[recipeUnit]?.factor || 1);
                                const totalCost = (yieldPercent && yieldPercent > 0) ? baseCost / (yieldPercent / 100) : baseCost;

                                return (
                                    <tr 
                                        key={item.rowId || index}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, index, 'ingredient')}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, index, 'ingredient')}
                                        onDragEnd={handleDragEnd}
                                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-green-50/50'} transition-all ${draggedItem?.type === 'ingredient' && draggedItem?.index === index ? 'opacity-50 bg-blue-100' : ''} ${item.rowId === newlyAddedRowId ? 'new-row' : ''}`}
                                    >
                                        <td className="px-2 py-2 text-center cursor-move text-gray-400">
                                            <GripVertical />
                                        </td>
                                        <td className="px-2 py-2 w-1/4">
                                            <Combobox
                                                options={availableIngredients}
                                                value={availableIngredients.find(ing => ing.id === item.id) || null}
                                                onChange={(selection) => handleIngredientUpdate(index, selection)}
                                                getOptionLabel={(option) => option.name}
                                                getOptionKey={(option) => option.id}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="text" inputMode="decimal" value={item.quantity || ''} onChange={e => handleValueChange('ingredients', index, 'quantity', e.target.value)} className={`w-full p-1 border rounded text-right ${!isValidNumber(item.quantity) ? 'border-red-500' : 'border-gray-300'}`}/>
                                            {!isValidNumber(item.quantity) && <ValidationMessage message="Invalide" />}
                                        </td>
                                        <td className="px-2 py-2">
                                            <select 
                                                value={item.recipeUnit || baseIngredient?.unit} 
                                                onChange={e => handleValueChange('ingredients', index, 'recipeUnit', e.target.value)}
                                                className="w-full p-1 border rounded"
                                                disabled={!baseIngredient}
                                            >
                                                {getCompatibleUnits(baseIngredient?.unit).map(unit => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-2"><input type="text" value={formatUnitPrice(displayedUnitPrice)} readOnly disabled className="w-full p-1 bg-gray-100 border-0 rounded text-right"/></td>
                                        <td className="px-2 py-2">
                                            <input type="text" inputMode="decimal" value={item.yieldPercentage || ''} onChange={e => handleValueChange('ingredients', index, 'yieldPercentage', e.target.value)} className={`w-full p-1 border rounded text-right ${!isValidPercentage(item.yieldPercentage) ? 'border-red-500' : 'border-gray-300'}`}/>
                                            {!isValidPercentage(item.yieldPercentage) && <ValidationMessage message="Doit être un %." />}
                                        </td>
                                        <FlashingCell value={totalCost} />
                                        <td className="px-2 py-2 text-center"><button onClick={() => removeRow('ingredients', index)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20}/></button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <button id="tutorial-add-ingredient-to-recipe" onClick={() => addRow('ingredients')} className="mt-4 text-sm text-green-600 hover:text-green-800">+ Ajouter un ingrédient</button>
                <div className="mt-4 p-3 bg-green-100 rounded-md space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                        <p className="text-green-800">Coût Matières (base): <span>{formatCurrency(costs.totalBaseIngredientsCost)} $</span></p>
                        <p className="text-green-800">Coût des Pertes (stock): <span>{formatCurrency(costs.totalLossCost)} $</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-green-200 pt-2">
                        <p className="font-bold text-green-800">Total Coûts Matières (recette): <span>{formatCurrency(costs.totalIngredientsCost)} $</span></p>
                        <p className="font-bold text-green-800">Coût Matières (portion): <span>{formatCurrency(costs.costMatierePerPortion)} $</span></p>
                    </div>
                </div>
                </div>
            )}
            </div>

            {/* Processus de production et main-d'oeuvre */}
            <div id="tutorial-section-recipe-labor" className="p-4 bg-yellow-50 rounded-lg relative z-10">
                <div
                    onClick={() => toggleSection('labor')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('labor')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('labor')}
                >
                    <h2 className="text-xl font-semibold text-yellow-700">2. Processus de production et main-d'œuvre</h2>
                    <ChevronDown className={`h-6 w-6 text-yellow-700 transform transition-transform duration-200 ${openRecipeSections.has('labor') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('labor') && (
                    <div className="mt-4">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-yellow-100">
                            <tr>
                                <th className="px-2 py-2 w-12 align-middle"></th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center">
                                        Étape de production
                                        <Tooltip text="Décrivez l'action (ex: 'Taillage des légumes', 'Cuisson de la viande')." />
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center">
                                        Personnel
                                        <Tooltip text="Cliquez sur 'Modifier' pour assigner un ou plusieurs employés à cette tâche." />
                                    </div>
                                </th>
                                <th className="w-24 px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center justify-center">
                                        Début
                                        <Tooltip text="Le moment où l'étape commence, en heures, minutes et secondes, depuis le début de la recette." />
                                    </div>
                                </th>
                                <th className="w-24 px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center justify-center">
                                        Durée
                                        <Tooltip text="La durée totale de l'étape en heures, minutes et secondes." />
                                    </div>
                                </th>
                                <th className="w-28 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">Fin</th>
                                <th className="w-24 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center justify-center">
                                        <div className="flex flex-col items-center"><span>Coût</span><span>Direct ($)</span></div>
                                        <Tooltip text="Le coût pur de la main-d'œuvre pour cette étape, basé sur le salaire de base des employés et la durée de la tâche." />
                                    </div>
                                </th>
                                <th className="w-24 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center justify-center">
                                        <div className="flex flex-col items-center"><span>Coût</span><span>Indirect ($)</span></div>
                                        <Tooltip text="La part du coût de l'inefficacité et du temps non-productif de la cuisine allouée à cette étape, basée sur le taux de productivité global." />
                                    </div>
                                </th>
                                <th className="w-24 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase align-middle">
                                    <div className="flex items-center justify-center">
                                        <div className="flex flex-col items-center"><span>Coût</span><span>Total ($)</span></div>
                                    </div>
                                </th>
                                <th className="relative px-2 py-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(product.productionSteps || []).map((step, index) => {
                                const stepDirectCost = (step.personnel || []).reduce((total, person) => {
                                    const postData = laborDatabase.find(p => p.postName === person.postId);
                                    if (!postData || postData.employees.length === 0) return total;

                                    const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                                    const totalCost = postData.employees.reduce((sum, emp) => {
                                        const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                                        return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                                    }, 0);
                                    const weightedAverageCost = totalHours > 0 ? totalCost / totalHours : 0;

                                    // Convertit la durée en secondes vers des heures pour le calcul
                                    return total + ((parseLocaleNumber(step.duration) / 3600) * weightedAverageCost);
                                }, 0);

                                const stepTotalCost = stepDirectCost / productivityFactor;
                                const stepIndirectCost = stepTotalCost - stepDirectCost;

                                const personnelSummary = (step.personnel || []).reduce((acc, person) => {
                                    if (!person.postId) return acc;
                                    acc[person.postId] = (acc[person.postId] || 0) + 1;
                                    return acc;
                                }, {});

                                return (
                                <tr 
                                    key={step.stepId}
                                    id={`step-row-${step.stepId}`}
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, index, 'step')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index, 'step')}
                                    onDragEnd={handleDragEnd}
                                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50/50'} transition-all ${draggedItem?.type === 'step' && draggedItem?.index === index ? 'opacity-50 bg-blue-100' : ''} ${step.stepId === newlyAddedStepId ? 'new-row' : ''}`}
                                >
                                    <td className="px-2 py-2 text-center cursor-move text-gray-400">
                                        <GripVertical />
                                    </td>
                                    <td className="px-2 py-2"><input type="text" value={step.stepName || ''} onChange={e => handleStepChange(index, 'stepName', e.target.value)} className="w-full p-1 border rounded"/></td>
                                    <td className="px-2 py-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">
                                                {Object.entries(personnelSummary).map(([post, count]) => `${count} ${post}`).join(', ') || <span className="text-gray-400">Aucun</span>}
                                            </span>
                                            <button onClick={() => openPersonnelModal(index)} className="text-xs text-blue-600 hover:underline ml-2">Modifier</button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <TimeInput
                                            totalSeconds={step.startTime}
                                            onChange={(newSeconds) => handleStepChange(index, 'startTime', newSeconds)}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <TimeInput
                                            totalSeconds={step.duration}
                                            onChange={(newSeconds) => handleStepChange(index, 'duration', newSeconds)}
                                        />
                                    </td>
                                    <td className="px-2 py-2"><input type="text" value={formatSecondsToTime(parseLocaleNumber(step.startTime) + parseLocaleNumber(step.duration))} readOnly disabled className="w-full p-1 bg-gray-50 border-0 rounded text-center"/></td>
                                    <FlashingCell value={stepDirectCost} />
                                    <FlashingCell value={stepIndirectCost} />
                                    <FlashingCell value={stepTotalCost} />
                                    <td className="px-2 py-2 text-center"><button onClick={() => removeStep(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20}/></button></td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                {/* --- DEBUT DU BLOC A REMPLACER --- */}
                <div className="flex justify-between items-center mt-4">
                    <button onClick={addStep} className="text-sm text-yellow-600 hover:text-yellow-800">+ Ajouter une étape</button>

                    {/* Résumé des temps de production (version compacte) */}
                    <div className="flex space-x-4 text-right">
                        <div>
                            <p className="text-xs text-gray-500 flex items-center justify-end">
                                Durée Processus
                                <Tooltip text="Le temps total écoulé entre le début de la première étape et la fin de la dernière." />
                            </p>
                            <p className="font-semibold text-sm text-gray-800">{(productionSummary.totalProductionTime / 60).toFixed(1)} min</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 flex items-center justify-end">
                                Temps Personnel
                                <Tooltip text="La somme du temps de travail de chaque employé. Ex: 10 min avec 2 cuisiniers = 20 min de personnel." />
                            </p>
                            <p className="font-semibold text-sm text-gray-800">{(productionSummary.totalLaborTime / 60).toFixed(1)} min</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 flex items-center justify-end">
                                Intensité M-O
                                <Tooltip text="Ratio Temps Personnel / Durée Processus. Un ratio > 1 indique que plusieurs personnes travaillent en même temps." />
                            </p>
                            <p className="font-semibold text-sm text-gray-800">{productionSummary.laborIntensity.toFixed(2)}x</p>
                        </div>
                    </div>
                </div>
                {/* --- FIN DU BLOC A REMPLACER --- */}
                {/* Diagramme de Gantt */}
                    <div className="mt-6">
                        <GanttChart productionSteps={product.productionSteps} />
                    </div>
                <div className="mt-4 p-3 bg-yellow-100 rounded-md space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                        <p className="text-yellow-800">Total Coût Main-d'œuvre Direct: <span>{formatCurrency(costs.totalDirectLaborCost)} $</span></p>
                        <p className="text-yellow-800">Total Coût Main-d'œuvre Indirect: <span>{formatCurrency(costs.totalLaborCost - costs.totalDirectLaborCost)} $</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-yellow-200 pt-2">
                        <p className="font-bold text-yellow-800">Total Main-d'oeuvre (recette): <span>{formatCurrency(costs.totalLaborCost)} $</span></p>
                        <p className="font-bold text-yellow-800">Coût Main-d'oeuvre (portion): <span>{formatCurrency(costs.costLaborPerPortion)} $</span></p>
                    </div>
                    </div>
                </div>
                )}
            </div>
            </>
             )}


            {product.isResaleProduct && (
                <div className="p-4 bg-green-50 rounded-lg">
                    <div
                        onClick={() => toggleSection('ingredients')}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('ingredients')}
                        className="w-full flex justify-between items-center cursor-pointer"
                        aria-expanded={openRecipeSections.has('ingredients')}
                    >
                        <h2 className="text-xl font-semibold text-green-700">1. Coût d'Achat</h2>
                        <ChevronDown className={`h-6 w-6 text-green-700 transform transition-transform duration-200 ${openRecipeSections.has('ingredients') ? 'rotate-180' : ''}`} />
                    </div>
                    {openRecipeSections.has('ingredients') && (
                        <div className="mt-4">
                    <div>
                        <label htmlFor="purchaseCost" className="block text-sm font-medium text-gray-700">Coût d'achat par unité ($)</label>
                        <input 
                            type="text" 
                            inputMode="decimal" 
                            id="purchaseCost" 
                            value={product.purchaseCost || ''} 
                            onChange={(e) => handleProductChange('purchaseCost', e.target.value)} 
                            className={`mt-1 block w-full max-w-xs rounded-md shadow-sm p-2 border text-right ${!isValidNumber(product.purchaseCost) ? 'border-red-500' : 'border-gray-300'}`} 
                        />
                        {!isValidNumber(product.purchaseCost) && <ValidationMessage message="Veuillez entrer un nombre positif." />}
                    </div>
                    <div className="mt-4 p-3 bg-green-100 rounded-md grid grid-cols-2 gap-4">
                        <p className="font-bold text-green-800">Total Coût Direct: <span>{formatCurrency(costs.totalDirectCostPerPortion)} $</span></p>
                        <p className="font-bold text-green-800">Coût par Portion: <span>{formatCurrency(costs.totalDirectCostPerPortion)} $</span></p>
                    </div>
                    {/* NOUVEAU: Gestion des allergènes pour les produits de revente */}
                    {product.isResaleProduct && (
                        <>
                            <div className="mt-4">
                                <button 
                                    onClick={() => setIsResaleAllergenModalOpen(true)}
                                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                                >
                                    <AlertCircle className="h-5 w-5 mr-2" />
                                    Gérer les allergènes du produit de revente
                                </button>
                            </div>
                            <AllergenModal
                                isOpen={isResaleAllergenModalOpen}
                                onClose={() => setIsResaleAllergenModalOpen(false)}
                                ingredientName={product.platName}
                                assignedAllergens={product.manualAllergens || []}
                                onUpdateAllergens={handleResaleAllergenChange}
                            />
                        </>
                    )}
                        </div>
                    )}
                </div>
            )}

            {/* Frais indirects */}
            <div id="tutorial-section-recipe-indirects" className="p-4 bg-purple-50 rounded-lg">
                <div
                    onClick={() => toggleSection('indirects')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('indirects')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('indirects')}
                >
                    <h2 className="text-xl font-semibold text-purple-700">3. Frais indirects</h2>
                    <ChevronDown className={`h-6 w-6 text-purple-700 transform transition-transform duration-200 ${openRecipeSections.has('indirects') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('indirects') && (
                    <div className="mt-4">
                <div className="space-y-4">
                    {/* La méthode d'attribution des frais indirects est GLOBALE (onglet Paramètres) et
                        s'applique à tous les plats. On rappelle ici la méthode active ; si c'est
                        « au prorata des ventes », on saisit les portions vendues de ce plat. */}
                    <div className="p-3 bg-purple-100 rounded-md text-sm text-purple-800">
                        Méthode d'attribution active : <strong>{indirectCostMethodLabels[generalInfo.indirectCostMethod] || indirectCostMethodLabels.salesAllocation}</strong>.
                        <span className="block text-xs text-purple-700 mt-1">Se choisit globalement dans l'onglet Paramètres et s'applique à tous les plats.</span>
                    </div>
                    {(generalInfo.indirectCostMethod || 'salesAllocation') === 'salesAllocation' && (
                        <div className="p-2">
                            <label className="block text-sm font-medium">Nombre de portions vendues ou envisagées</label>
                            <p className="text-xs text-gray-600 mb-2">Dénominateur de la répartition « au prorata des ventes » quand ce plat est vendu tel quel. Laissé vide, il est estimé automatiquement à partir du revenu et du mix des ventes.</p>
                            <input type="text" inputMode="decimal" value={product.indirectCosts?.portionsSold || ''} onChange={(e) => handleIndirectCostChange('portionsSold', e.target.value)} className={`block w-full p-2 border rounded text-right ${product.indirectCosts?.portionsSold && !isValidPositiveInteger(product.indirectCosts.portionsSold) ? 'border-red-500' : 'border-gray-300'}`}/>
                            {product.indirectCosts?.portionsSold && !isValidPositiveInteger(product.indirectCosts.portionsSold) && <ValidationMessage message="Doit être un entier positif." />}
                        </div>
                    )}
                </div>
                 <div className="mt-4 p-3 bg-purple-100 rounded-md grid grid-cols-2 gap-4">
                    <p className="font-bold text-purple-800">Total Frais Indirects (recette): <span>{formatCurrency(costs.indirectCostTotal)} $</span></p>
                    <p className="font-bold text-purple-800">Coût Indirect (portion): <span>{formatCurrency(costs.costIndirectPerPortion)} $</span></p>
                </div>
                </div>
            )}
            </div>

            {/* Rapport */}
            <div id="recap-section" className="p-4 bg-blue-50 rounded-lg">
                <div
                    onClick={() => toggleSection('recap')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('recap')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('recap')}
                >
                    <h2 className="text-xl font-semibold text-blue-700">4. Récapitulatif</h2>
                    <ChevronDown className={`h-6 w-6 text-blue-700 transform transition-transform duration-200 ${openRecipeSections.has('recap') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('recap') && (
                    <div className="mt-4">
                {/* Prix de vente en tête, centré et à la taille d'une carte : point de départ de la
                    cascade de marges ci-dessous. */}
                <div className="flex justify-center mb-4">
                    <div className="w-full md:w-1/3 p-3 bg-white rounded-lg shadow text-center border-l-4 border-blue-500">
                        <p className="text-sm text-gray-500">Prix de Vente</p>
                        <p className="text-2xl font-bold text-blue-800">
                            {simulatedCosts
                                ? renderComparison(parseLocaleNumber(product.prixVente), parseLocaleNumber(simulatedPrice), formatCurrency, true, ' $')
                                : `${formatCurrency(parseLocaleNumber(product.prixVente))} $`}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-4">
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">
                            Coût Matière (%)
                            <Tooltip text="Le pourcentage du prix de vente que représente le coût des ingrédients." />
                            {getCostTargetIndicator(simulatedCosts ? simulatedCosts.costMatierePercent : costs.costMatierePercent, generalInfo.foodCostTarget)}
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                             {simulatedCosts 
                                ? renderComparison(costs.costMatierePercent, simulatedCosts.costMatierePercent, formatPercent, false, '%') 
                                : `${formatPercent(costs.costMatierePercent)}%`}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">
                            Coût Main-d'oeuvre (%)
                            <Tooltip text="Le pourcentage du prix de vente que représente le coût total de la main-d'œuvre (direct et indirect)." />
                            {getCostTargetIndicator(simulatedCosts ? simulatedCosts.costLaborPercent : costs.costLaborPercent, generalInfo.laborCostTarget)}
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                            {simulatedCosts 
                                ? renderComparison(costs.costLaborPercent, simulatedCosts.costLaborPercent, formatPercent, false, '%') 
                                : `${formatPercent(costs.costLaborPercent)}%`}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Coût Frais Indirects (%) <Tooltip text="Le pourcentage du prix de vente que représentent les frais indirects alloués." /></div>
                        <p className="text-xl font-bold text-gray-800">
                            {simulatedCosts 
                                ? renderComparison(costs.costIndirectPercent, simulatedCosts.costIndirectPercent, formatPercent, false, '%') 
                                : `${formatPercent(costs.costIndirectPercent)}%`}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-4">
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Total Coûts Directs <Tooltip text="La somme des coûts de matières et de la main-d'œuvre directement attribuables à la production de ce plat." /></div>
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(costs.totalDirectCostPerPortion)} $</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Total Coûts Indirects <Tooltip text="La part des frais généraux de l'établissement (loyer, électricité, etc.) allouée à ce plat." /></div>
                         <p className="text-2xl font-bold text-gray-800">
                            {simulatedCosts 
                                ? renderComparison(costs.costIndirectPerPortion, simulatedCosts.costIndirectPerPortion, formatCurrency, false, ' $') 
                                : `${formatCurrency(costs.costIndirectPerPortion)} $`}
                        </p>
                    </div>
                    <div className={`p-3 bg-white rounded-lg shadow ${flashTotalCost ? 'animate-flash' : ''}`}>
                        <div className="text-sm text-gray-500 flex items-center justify-center">Coût de Revient Total <Tooltip text="La somme de tous les coûts (matières, main-d'œuvre, indirects) pour produire une portion." /></div>
                        <p className="text-2xl font-bold text-blue-800">
                             {simulatedCosts 
                                ? renderComparison(costs.totalCostPerPortion, simulatedCosts.totalCostPerPortion, formatCurrency, false, ' $') 
                                : `${formatCurrency(costs.totalCostPerPortion)} $`}
                        </p>
                    </div>
                </div>
                {/* Les trois niveaux de marge, en cascade : prix − matière = contribution ;
                    − main-d'œuvre = coût primaire ; − frais indirects = nette. */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Marge de contribution <Tooltip text="Prix de vente moins le coût matière seul. C'est ce qui reste pour couvrir la main-d'œuvre, les frais indirects et le profit." /></div>
                        <p className={`text-xl font-bold ${getMarginTextColorClass(simulatedCosts ? simulatedCosts.margeContributionPercent : costs.margeContributionPercent)}`}>
                            {simulatedCosts ? (
                                <>
                                    <span>{`${formatCurrency(simulatedCosts.margeContributionDollar)}$ / ${formatPercent(simulatedCosts.margeContributionPercent)}%`}</span>
                                    <span className="block text-sm font-normal text-gray-500">
                                        (diff: {simulatedCosts.margeContributionDollar - costs.margeContributionDollar >= 0 ? '+' : ''}{formatCurrency(simulatedCosts.margeContributionDollar - costs.margeContributionDollar)}$)
                                    </span>
                                </>
                            ) : (
                                `${formatCurrency(costs.margeContributionDollar)}$ / ${formatPercent(costs.margeContributionPercent)}%`
                            )}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Marge sur coût primaire <Tooltip text="Prix de vente moins les coûts directs (matière + main-d'œuvre). Profit avant de déduire les frais indirects. La MO est traitée comme un coût semi-variable." /></div>
                        <p className={`text-xl font-bold ${getMarginTextColorClass(simulatedCosts ? simulatedCosts.margeBrutePercent : costs.margeBrutePercent)}`}>
                            {simulatedCosts ? (
                                <>
                                    <span>{`${formatCurrency(simulatedCosts.margeBruteDollar)}$ / ${formatPercent(simulatedCosts.margeBrutePercent)}%`}</span>
                                    <span className="block text-sm font-normal text-gray-500">
                                        (diff: {simulatedCosts.margeBruteDollar - costs.margeBruteDollar >= 0 ? '+' : ''}{formatCurrency(simulatedCosts.margeBruteDollar - costs.margeBruteDollar)}$)
                                    </span>
                                </>
                            ) : (
                                `${formatCurrency(costs.margeBruteDollar)}$ / ${formatPercent(costs.margeBrutePercent)}%`
                            )}
                        </p>
                    </div>
                    <div className={`p-3 bg-white rounded-lg shadow ${flashNetMargin ? 'animate-flash' : ''}`}>
                        <div className="text-sm text-gray-500 flex items-center justify-center">Marge Nette <Tooltip text="Le profit réel par portion après avoir déduit tous les coûts (directs et indirects)." /></div>
                        <p className={`text-xl font-bold ${getMarginTextColorClass(simulatedCosts ? simulatedCosts.margeNettePercent : costs.margeNettePercent)}`}>
                            {simulatedCosts ? (
                                <>
                                    <span>{`${formatCurrency(simulatedCosts.margeNetteDollar)}$ / ${formatPercent(simulatedCosts.margeNettePercent)}%`}</span>
                                    <span className="block text-sm font-normal text-gray-500">
                                        (diff: {simulatedCosts.margeNetteDollar - costs.margeNetteDollar >= 0 ? '+' : ''}{formatCurrency(simulatedCosts.margeNetteDollar - costs.margeNetteDollar)}$)
                                    </span>
                                </>
                            ) : (
                                `${formatCurrency(costs.margeNetteDollar)}$ / ${formatPercent(costs.margeNettePercent)}%`
                            )}
                        </p>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center justify-center">Point Mort du Produit <Tooltip text="Le nombre d'unités de ce plat que vous devez vendre pour couvrir sa part des frais indirects." /></h3>
                     {breakEvenForProduct !== null ? (
                        <>
                            <p className="text-sm text-gray-500 mb-2">{breakEvenDescription}</p>
                            <p className="text-2xl font-bold text-indigo-600">
                                {breakEvenForProduct} unités
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-500 mb-2">{breakEvenDescription}</p>
                            <p className="text-lg font-bold text-gray-600">
                               N/A
                            </p>
                        </>
                    )}
                </div>
                <div className="mt-6 pt-4 border-t">
                    {!isSimulating ? (
                        <div className="text-center">
                            <button onClick={() => setIsSimulating(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                                <Scale className="h-5 w-5 mr-2" /> Simuler un nouveau prix
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 bg-indigo-50 rounded-lg">
                            <h3 className="text-md font-semibold text-indigo-800 mb-2 text-center">Mode Simulation</h3>
                            <div className="flex items-center justify-center gap-4">
                                <label htmlFor="simulatedPrice" className="text-sm font-medium text-gray-700">Prix de vente simulé ($):</label>
                                <input 
                                    type="text" 
                                    id="simulatedPrice"
                                    inputMode="decimal"
                                    value={simulatedPrice}
                                    onChange={(e) => setSimulatedPrice(e.target.value)}
                                    className={`w-32 p-1 border rounded text-right ${!isValidNumber(simulatedPrice) ? 'border-red-500' : 'border-gray-300'}`}
                                    autoFocus
                                />
                                <button
                                    onClick={handleApplySimulatedPrice}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    disabled={!isValidNumber(simulatedPrice)}
                                >
                                    Modifier le prix
                                </button>
                                <button onClick={() => { setIsSimulating(false); setSimulatedPrice(''); }} className="px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                                    Quitter
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            )}
            </div>
        </div>
    );
};