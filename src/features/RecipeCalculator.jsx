import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, ChevronDown, GripVertical, Trash2, Scale, PlusCircle } from 'lucide-react';
import {
    parseLocaleNumber, isValidNumber, isValidPositiveInteger, isValidPositiveNumber, isValidPercentage,
    formatCurrency, formatUnitPrice, formatSecondsToTime, formatPercent, formatQuantityLabel,
    getCompatibleUnits, CONVERSION_FACTORS, isDiscreteUnit, MAJOR_ALLERGENS, FORMAT_FLAT_MIRROR_FIELDS,
} from '../utils.js';
import { getCostTargetIndicator, useValueFlash } from '../ui-utils.jsx';
import { Tooltip, ValidationMessage, FlashingCell, GanttChart, PersonnelModal, AllergenModal, Combobox, TimeInput, AddFormatModal, CopyFromFormatControl } from '../components/common.jsx';
import { calculateCosts, computeChannelBreakdown } from '../engine/calculateCosts.js';
import { computeYieldUnits } from '../engine/yieldCalculator.js';
import { useProject } from '../state/ProjectContext.jsx';

export const RecipeCalculator = ({ editingProductIndex, initialFormatIndex = 0, onSelectProduct, openRecipeSections, setOpenRecipeSections, onAddFormat, onDuplicateFormat }) => {
    const { products, baseIngredients, basePackaging, salesChannels, onUpdateProducts, generalInfo, ingredientsList, laborDatabase, showNotification, setNotification, analysisData } = useProject();
    const product = products[editingProductIndex] || null;

    const [selectedFormatIndex, setSelectedFormatIndex] = useState(0);
    const [isAddFormatModalOpen, setIsAddFormatModalOpen] = useState(false);
    const formats = product?.formats || [];
    const format = formats[selectedFormatIndex] || formats[0] || null;

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

    // Revient au format par défaut (0) en changeant de plat — ou au format précis visé par la
    // navigation (ex. clic sur une ligne du Résumé, Phase 1.6b), sans interférer avec un clic
    // ultérieur sur un autre onglet : cet effet ne redéclenche que si l'un des deux change.
    useEffect(() => {
        setSelectedFormatIndex(initialFormatIndex || 0);
    }, [editingProductIndex, initialFormatIndex]);

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
        if (!format) return [];
        // SI c'est un produit de revente, on utilise sa liste manuelle
        if (format.isResaleProduct) {
            return format.manualAllergens || [];
        }
        // SINON, on calcule à partir des ingrédients
        const allergens = new Set();
        (format.ingredients || []).forEach(item => {
            const baseIngredient = ingredientsList.find(ing => ing.id === item.id);
            if (baseIngredient && baseIngredient.allergens) {
                baseIngredient.allergens.forEach(allergen => allergens.add(allergen));
            }
        });
        return Array.from(allergens);
    }, [format, ingredientsList]);

    // Coûts du FORMAT sélectionné : calculé directement (memo local, vide à chaque rendu — cet
    // écran ne calcule qu'un seul plat à la fois) plutôt que réutilisé depuis
    // analysisData.productsWithCosts, pour rester réactif pendant la saisie sans attendre le
    // recalcul global de l'analyse.
    const costs = useMemo(() => {
        if (!product || !format) return null;
        return calculateCosts(product, generalInfo, baseIngredients, products, laborDatabase, null, {}, new Set(), format, basePackaging);
    }, [product, format, generalInfo, baseIngredients, products, laborDatabase, basePackaging]);

    const productionSummary = useMemo(() => {
        if (!format || !format.productionSteps || format.productionSteps.length === 0) {
            return { totalProductionTime: 0, totalLaborTime: 0, laborIntensity: 0 };
        }

        let totalProductionTime = 0;
        let totalLaborTime = 0;

        format.productionSteps.forEach(step => {
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
    }, [format]);

    const flashTotalCost = useValueFlash(costs?.totalDirectCostPerPortion ?? 0);

    // Ventilation par canal de vente (Phase 3.3, complétée le 06/10) : coût de production + marge
    // brute SEULEMENT — la marge NETTE n'apparaît plus du tout dans ce récapitulatif (elle a
    // besoin de l'allocation des frais fixes, pas encore multi-canal avant la Phase 4) ; le
    // rapport multi-canal pour la marge nette vit dans Résumé → Par SKU. Décision utilisateur du
    // 06/10 : Recette & Calcul = coût de production + marge brute, rien d'autre côté marge.
    const channelBreakdown = useMemo(
        () => computeChannelBreakdown(costs, format?.channelPrices, salesChannels),
        [costs, format, salesChannels]
    );
    const [selectedChannelId, setSelectedChannelId] = useState(null);
    useEffect(() => {
        // Revient au canal principal (premier de la liste) à chaque changement de format.
        setSelectedChannelId(null);
    }, [format?.id]);
    const selectedChannelData = channelBreakdown.find(cb => cb.channelId === selectedChannelId) || channelBreakdown[0] || null;
    // Source des valeurs dépendantes du prix (% de coût, marge de contribution, marge brute, prix
    // affiché) hors simulation : le canal sélectionné, avec repli sur `costs` (0 $ partout) si ce
    // format n'a encore aucun canal rattaché — jamais une erreur, jamais une valeur forcée.
    const marginView = selectedChannelData || costs;

    const simulatedCosts = (product && format && isSimulating && isValidNumber(simulatedPrice))
        ? calculateCosts(product, generalInfo, baseIngredients, products, laborDatabase, simulatedPrice, {}, new Set(), format, basePackaging)
        : null;

    // Nombre d'unités produites, calculé par la grille de rendement (Phase 1.4) quand elle est
    // activée pour le format sélectionné — remplace alors la saisie manuelle.
    const computedYieldUnits = useMemo(() => {
        if (!format?.yieldGrid?.enabled) return null;
        return computeYieldUnits({
            baseQuantity: format.yieldGrid.baseQuantity,
            stages: format.yieldGrid.stages,
            rejectRate: format.yieldGrid.rejectRate,
            unitSize: format.portionSize,
        });
    }, [format]);

    // Point mort réintroduit le 19/10 (retour utilisateur) : affiche la valeur DÉJÀ calculée par
    // le pipeline complet (analysisData.productsWithCosts, voir analysisData.js) — jamais
    // recalculée localement ici, contrairement à l'ancienne implémentation pré-06/10
    // (breakEvenForProduct), qui dupliquait ce calcul. Avantage concret demandé par l'utilisateur :
    // une modification du prix de vente se répercute immédiatement ici, puisque `analysisData` se
    // recalcule déjà à chaque changement de `products` (même cycle de rendu, voir App.jsx) — rien
    // à maintenir en synchronisation. `null` si ce format n'a encore aucun canal rattaché, ou si la
    // marge brute du canal sélectionné est ≤ 0 (point mort indéfini) — jamais une valeur forcée.
    const analysisFormatEntry = analysisData?.productsWithCosts?.find(p => p.id === format?.id);
    const analysisChannelEntry = analysisFormatEntry?.channelBreakdown?.find(cb => cb.channelId === selectedChannelData?.channelId);
    const breakEvenUnits = analysisChannelEntry?.breakEvenUnits ?? null;

    if (!product || !format) return <div className="text-center p-8">Veuillez d'abord sélectionner ou ajouter un plat.</div>;

    const handleDragStart = (e, index, type) => {
        setDraggedItem({ index, type });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Applique une mise à jour au format actuellement sélectionné (chaque format est sa propre
    // fiche recette autonome depuis la correction du 23/09 — voir 04-Conception-Modele.md).
    const updateFormat = (updater) => {
        const newProducts = products.map((p, index) => {
            if (index !== editingProductIndex) return p;
            const newFormats = p.formats.map((f, i) => i === selectedFormatIndex ? updater(f) : f);
            return { ...p, formats: newFormats };
        });
        onUpdateProducts(newProducts);
    };

    // --- COPIE SECTION PAR SECTION DEPUIS UN AUTRE SKU (04-Conception-Modele.md) ---
    // Chaque format étant sa propre fiche recette autonome, ces gestionnaires peuplent UNE
    // section du format sélectionné à partir d'un SKU voisin, sans toucher au reste de sa fiche.
    // Nouveaux id pour les listes copiées, comme pour toute duplication (jamais de référence
    // partagée entre deux formats — voir handleDuplicateFormat dans App.jsx).
    const copyIngredientsFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            ingredients: (source.ingredients || []).map(ing => ({ ...ing, rowId: `ing_${Date.now()}_${Math.random()}` })),
        }));
    };

    const copyPackagingItemsFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            packagingItems: (source.packagingItems || []).map(item => ({ ...item, rowId: `pkgitem_${Date.now()}_${Math.random()}` })),
        }));
    };

    const copyProductionStepsFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            productionSteps: (source.productionSteps || []).map(step => ({ ...step, stepId: `step_${Date.now()}_${Math.random()}` })),
        }));
    };

    const copyResalePurchaseFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            purchaseCost: source.purchaseCost,
            manualAllergens: [...(source.manualAllergens || [])],
        }));
    };

    const copyAdditionalCostsFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            subcontracting: source.subcontracting
                ? { ...source.subcontracting, items: (source.subcontracting.items || []).map(it => ({ ...it, id: `sub_${Date.now()}_${Math.random()}` })) }
                : f.subcontracting,
            aging: source.aging ? { ...source.aging } : f.aging,
        }));
    };

    // Ne copie PAS le format (portionSize/portionUnit) : c'est justement l'attribut délibérément
    // propre à chaque SKU (voir 04-Conception-Modele.md), géré dans Paramètres → Produits et SKUs.
    const copyYieldFrom = (sourceFormatId) => {
        const source = formats.find(f => f.id === sourceFormatId);
        if (!source) return;
        updateFormat(f => ({
            ...f,
            nbPortions: source.nbPortions,
            yieldGrid: source.yieldGrid ? JSON.parse(JSON.stringify(source.yieldGrid)) : f.yieldGrid,
        }));
    };

    const handleDrop = (e, targetIndex, type) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.type !== type) return;

        const sourceIndex = draggedItem.index;
        if (sourceIndex === targetIndex) return;

        const key = type === 'ingredient' ? 'ingredients' : 'productionSteps';
        updateFormat(f => {
            const list = [...(f[key] || [])];
            const [draggedElement] = list.splice(sourceIndex, 1);
            list.splice(targetIndex, 0, draggedElement);
            return { ...f, [key]: list };
        });
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const productivityFactor = (generalInfo.kitchenProductivity > 0 && generalInfo.kitchenProductivity <= 100) ? generalInfo.kitchenProductivity / 100 : 1;
    // Exclut TOUS les formats du produit en cours d'édition (pas seulement product.id, qui ne
    // correspond plus à aucun id de ligne depuis que chaque format a son propre id — Phase 1.6a) :
    // un produit ne doit pas pouvoir s'utiliser lui-même comme ingrédient, quel que soit le format.
    const ownFormatIds = new Set((product.formats || []).map(f => f.id));
    const availableIngredients = ingredientsList.filter(ing => !ownFormatIds.has(ing.id));


    // --- GESTIONNAIRES : PRODUIT (recette mère — regroupement organisationnel uniquement) ---
    const handleProductChange = (field, value) => {
        const newProducts = products.map((p, index) => index === editingProductIndex ? { ...p, [field]: value } : p);
        onUpdateProducts(newProducts);
    };

    // Le statut « produit de revente » et l'allergènes manuels appartiennent au FORMAT (chaque SKU
    // a sa propre fiche recette — voir 04-Conception-Modele.md) : un même produit peut avoir un
    // format cuisiné et un format simplement revendu.
    const handleFormatResaleToggle = (checked) => {
        updateFormat(f => ({
            ...f,
            isResaleProduct: checked,
            // Vide la recette pour éviter de conserver des données erronées en passant en revente
            // (un produit de revente n'a pas de coût d'emballage distinct non plus — voir
            // calculateCosts.js).
            ...(checked ? { ingredients: [], productionSteps: [], packagingItems: [] } : {}),
        }));
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

        updateFormat(f => ({ ...f, ingredients: [...(f.ingredients || []), newRow] }));

        // Déclenche l'animation sur la nouvelle ligne
        setNewlyAddedRowId(newRow.rowId);
        setTimeout(() => setNewlyAddedRowId(null), 500); // Doit correspondre à la durée de l'animation CSS
    };
    const removeRow = (category, indexToRemove) => {
        const key = category === 'ingredients' ? 'ingredients' : 'productionSteps';
        const itemToDelete = format[key][indexToRemove];
        if (!itemToDelete) return;

        const itemName = itemToDelete.name || 'un ingrédient';
        const originalProducts = JSON.parse(JSON.stringify(products));

        updateFormat(f => ({ ...f, [key]: (f[key] || []).filter((_, index) => index !== indexToRemove) }));

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

        updateFormat(f => ({
            ...f,
            ingredients: (f.ingredients || []).map((item, iIndex) => {
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
            }),
        }));
    };

    const openPersonnelModal = (index) => {
        setEditingStepIndex(index);
    };

    const closePersonnelModal = () => {
        setEditingStepIndex(null);
    };

    const handleStepChange = (stepIndex, field, value) => {
        updateFormat(f => {
            const newSteps = [...(f.productionSteps || [])];
            newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
            return { ...f, productionSteps: newSteps };
        });
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
        updateFormat(f => ({ ...f, productionSteps: [...(f.productionSteps || []), newStep] }));
        // Déclenche l'animation
        setNewlyAddedStepId(newStep.stepId);
    };

    const removeStep = (stepIndex) => {
        const stepToDelete = format.productionSteps[stepIndex];
        if (!stepToDelete) return;

        const originalProducts = JSON.parse(JSON.stringify(products));
        updateFormat(f => ({ ...f, productionSteps: (f.productionSteps || []).filter((_, i) => i !== stepIndex) }));

        showNotification({
            message: `L'étape "${stepToDelete.stepName}" a été supprimée.`,
            type: 'info',
            onUndo: () => {
                onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    const handleResaleAllergenChange = (newAllergens) => {
        updateFormat(f => ({ ...f, manualAllergens: newAllergens }));
    };

    const handleIngredientUpdate = (itemIndex, selection) => {
        updateFormat(f => ({
            ...f,
            ingredients: (f.ingredients || []).map((item, iIndex) => {
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
            }),
        }));
    };

    // --- GESTIONNAIRES : EMBALLAGE (Phase 2.2) — section propre au FORMAT, comme les ingrédients,
    // mais sans notion de rendement (un emballage ne « rétrécit » pas pendant la production) ni de
    // glisser-déposer (liste généralement courte, réordonnancement moins utile qu'en ingrédients).
    const addPackagingRow = () => {
        const newRow = { rowId: `pkgitem_${Date.now()}_${Math.random()}`, id: '', name: '', quantity: '', unit: '', cost: 0, recipeUnit: '' };
        updateFormat(f => ({ ...f, packagingItems: [...(f.packagingItems || []), newRow] }));
        setNewlyAddedRowId(newRow.rowId);
        setTimeout(() => setNewlyAddedRowId(null), 500);
    };

    const removePackagingRow = (indexToRemove) => {
        const itemToDelete = (format.packagingItems || [])[indexToRemove];
        if (!itemToDelete) return;

        const itemName = itemToDelete.name || 'un emballage';
        const originalProducts = JSON.parse(JSON.stringify(products));

        updateFormat(f => ({ ...f, packagingItems: (f.packagingItems || []).filter((_, index) => index !== indexToRemove) }));

        showNotification({
            message: `L'emballage "${itemName}" a été retiré de la recette.`,
            type: 'info',
            onUndo: () => {
                onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    const handlePackagingValueChange = (itemIndex, field, value) => {
        updateFormat(f => ({
            ...f,
            packagingItems: (f.packagingItems || []).map((item, iIndex) => iIndex === itemIndex ? { ...item, [field]: value } : item),
        }));
    };

    const handlePackagingUpdate = (itemIndex, selection) => {
        updateFormat(f => ({
            ...f,
            packagingItems: (f.packagingItems || []).map((item, iIndex) => {
                if (iIndex !== itemIndex) return item;

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

                return { ...item, id: '', name: selection, unit: '', cost: 0, recipeUnit: '' };
            }),
        }));
    };

    // --- GESTIONNAIRES : FORMAT DE VENTE (Phase 1.5) ---
    const handleFormatChange = (field, value) => {
        const newProducts = products.map((p, index) => {
            if (index !== editingProductIndex) return p;
            const newFormats = p.formats.map((f, i) => i === selectedFormatIndex ? { ...f, [field]: value } : f);
            const updated = { ...p, formats: newFormats };
            if (selectedFormatIndex === 0 && FORMAT_FLAT_MIRROR_FIELDS.includes(field)) {
                updated[field] = value;
            }
            return updated;
        });
        onUpdateProducts(newProducts);
    };

    // Active/désactive un module optionnel du format (rendement, sous-traitance, vieillissement) —
    // masqués par défaut (voir 04-Conception-Modele.md), révélés par une case à cocher.
    const handleFormatNestedToggle = (key, enabled) => {
        const newProducts = products.map((p, index) => {
            if (index !== editingProductIndex) return p;
            const newFormats = p.formats.map((f, i) => i === selectedFormatIndex ? { ...f, [key]: { ...f[key], enabled } } : f);
            return { ...p, formats: newFormats };
        });
        onUpdateProducts(newProducts);
    };

    const handleFormatNestedChange = (key, field, value) => {
        const newProducts = products.map((p, index) => {
            if (index !== editingProductIndex) return p;
            const newFormats = p.formats.map((f, i) => i === selectedFormatIndex ? { ...f, [key]: { ...f[key], [field]: value } } : f);
            return { ...p, formats: newFormats };
        });
        onUpdateProducts(newProducts);
    };

    const handleAddYieldStage = () => {
        const newStage = { id: `stage_${Date.now()}_${Math.random()}`, name: '', percentEffect: 0 };
        handleFormatNestedChange('yieldGrid', 'stages', [...(format.yieldGrid?.stages || []), newStage]);
    };
    const handleRemoveYieldStage = (stageIndex) => {
        handleFormatNestedChange('yieldGrid', 'stages', (format.yieldGrid?.stages || []).filter((_, i) => i !== stageIndex));
    };
    const handleYieldStageChange = (stageIndex, field, value) => {
        const newStages = (format.yieldGrid?.stages || []).map((s, i) => i === stageIndex ? { ...s, [field]: value } : s);
        handleFormatNestedChange('yieldGrid', 'stages', newStages);
    };

    const handleAddSubcontractingItem = () => {
        const newItem = { id: `sub_${Date.now()}_${Math.random()}`, name: '', operation: '', cost: 0 };
        handleFormatNestedChange('subcontracting', 'items', [...(format.subcontracting?.items || []), newItem]);
    };
    const handleRemoveSubcontractingItem = (itemIndex) => {
        handleFormatNestedChange('subcontracting', 'items', (format.subcontracting?.items || []).filter((_, i) => i !== itemIndex));
    };
    const handleSubcontractingItemChange = (itemIndex, field, value) => {
        const newItems = (format.subcontracting?.items || []).map((it, i) => i === itemIndex ? { ...it, [field]: value } : it);
        handleFormatNestedChange('subcontracting', 'items', newItems);
    };

    const handleApplySimulatedPrice = () => {
        if (isSimulating && isValidNumber(simulatedPrice)) {
            handleFormatChange('prixVente', simulatedPrice);
            setIsSimulating(false);
            setSimulatedPrice('');
            showNotification({ message: `Prix de vente de "${product.platName}" mis à jour.`, type: 'success' });
        }
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
                step={editingStepIndex !== null ? format.productionSteps[editingStepIndex] : null}
                laborDatabase={laborDatabase}
                onUpdatePersonnel={handlePersonnelChange}
            />
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Recette et calcul pour :</h1>
                <select value={editingProductIndex} onChange={(e) => onSelectProduct(parseInt(e.target.value, 10))} className="flex-1 p-2 border rounded-md">
                    {products.map((p, index) => <option key={p.id || index} value={index}>{p.platName || `Plat ${index + 1}`}</option>)}
                </select>
            </div>

            {/* Sélecteur de format de vente, dans le même style d'onglets soulignés que la barre de
                navigation principale de l'app. La gestion des formats (duplication en bloc,
                suppression, prix, mix) reste centrée dans Paramètres → Produits et SKUs ; cet écran
                choisit quel format éditer en détail et offre un raccourci pour en créer un nouveau
                sans changer d'onglet (voir 04-Conception-Modele.md). */}
            <AddFormatModal
                isOpen={isAddFormatModalOpen}
                onClose={() => setIsAddFormatModalOpen(false)}
                productName={product.platName || 'ce produit'}
                existingFormats={formats}
                onCreate={({ sku, portionSize, portionUnit, copyFromFormatId }) => {
                    const overrides = { sku, portionSize, portionUnit };
                    if (copyFromFormatId) {
                        const sourceIndex = formats.findIndex(f => f.id === copyFromFormatId);
                        onDuplicateFormat(editingProductIndex, sourceIndex, overrides);
                        setSelectedFormatIndex(sourceIndex + 1);
                    } else {
                        onAddFormat(editingProductIndex, overrides);
                        setSelectedFormatIndex(formats.length);
                    }
                    setIsAddFormatModalOpen(false);
                }}
            />
            <div id="tutorial-section-recipe-formats" className="border-b border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center flex-wrap">
                        <span className="flex items-center text-xs font-medium text-gray-500 uppercase mr-2">
                            Format
                            <Tooltip text="Un produit peut être vendu sous plusieurs formats — l'emballage et la quantité (ex. pot de 250 ml, pot de 500 ml) — chacun avec sa propre fiche recette, son propre rendement et son propre prix. Le SKU (numéro de référence, géré dans Paramètres → Produits et SKUs) se déduit de la recette et du format ; choisissez ici le format à éditer en détail." />
                        </span>
                        {formats.map((f, index) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setSelectedFormatIndex(index)}
                                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-sm font-medium transition-colors focus:outline-none ${index === selectedFormatIndex ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                {formatQuantityLabel(f.portionSize, f.portionUnit) || `Format ${index + 1}`}
                                {index === 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${index === selectedFormatIndex ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>défaut</span>
                                )}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setIsAddFormatModalOpen(true)} className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 px-2 py-1 mb-1">
                        <PlusCircle size={16} /> Ajouter un format
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-500">
                    Format de ce SKU : <span className="font-medium text-gray-700">{formatQuantityLabel(format.portionSize, format.portionUnit) || 'non défini'}</span> — modifiable dans Paramètres → Produits et SKUs.
                </p>
                <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyYieldFrom} label="le nombre d'unités et le rendement" />
            </div>
            <div className="max-w-xs">
                <label htmlFor="nbPortions" className="flex items-center text-sm font-medium text-gray-700">
                    Quantité produite
                    <Tooltip text="La quantité de ce format que la recette produit, dans son unité (ex. 40 unités de 250 ml, ou 47,3 kg pour un format en kg). Un entier est exigé seulement pour une unité de compte (« unité ») ; les unités de poids/volume acceptent les décimales. Peut aussi être calculée automatiquement ci-dessous via une grille de rendement." />
                </label>
                <input
                    type="text" inputMode={isDiscreteUnit(format.portionUnit) ? 'numeric' : 'decimal'} id="nbPortions"
                    value={format.yieldGrid?.enabled ? (computedYieldUnits ?? 0).toFixed(2) : (format.nbPortions || '')}
                    onChange={(e) => handleFormatChange('nbPortions', e.target.value)}
                    disabled={!!format.yieldGrid?.enabled}
                    className={`mt-1 w-full rounded-md shadow-sm p-2 border text-right ${format.yieldGrid?.enabled ? 'bg-gray-100' : ''} ${!format.yieldGrid?.enabled && !(isDiscreteUnit(format.portionUnit) ? isValidPositiveInteger(format.nbPortions) : isValidPositiveNumber(format.nbPortions)) ? 'border-red-500' : 'border-gray-300'}`}
                />
                {!format.yieldGrid?.enabled && !(isDiscreteUnit(format.portionUnit) ? isValidPositiveInteger(format.nbPortions) : isValidPositiveNumber(format.nbPortions)) &&
                    <ValidationMessage message={isDiscreteUnit(format.portionUnit) ? "Doit être un entier positif." : "Doit être un nombre positif."} />}
            </div>

            {/* Grille de rendement (Phase 1.4/1.5) — module autonome, distinct des étapes de
                production/main-d'œuvre (voir 04-Conception-Modele.md). Masqué par défaut. */}
            <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={!!format.yieldGrid?.enabled} onChange={(e) => handleFormatNestedToggle('yieldGrid', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2" />
                    Calculer le nombre d'unités produites à partir d'une grille de rendement
                    <Tooltip text="Plutôt que de saisir le nombre d'unités produites directement, calculez-le à partir d'une quantité de matière première de départ, d'une suite d'étapes de transformation (chacune avec son effet en % sur la quantité), puis d'un taux de rejet des produits finis appliqué après coup." />
                </label>
                {format.yieldGrid?.enabled && (
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 max-w-md">
                            <div>
                                <label className="block text-xs font-medium text-gray-600">Quantité de départ</label>
                                <input type="text" inputMode="decimal" value={format.yieldGrid.baseQuantity || ''} onChange={(e) => handleFormatNestedChange('yieldGrid', 'baseQuantity', e.target.value)} className="mt-1 w-full p-1.5 border rounded text-right text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600">Unité (informatif)</label>
                                <input type="text" value={format.yieldGrid.baseUnit || ''} onChange={(e) => handleFormatNestedChange('yieldGrid', 'baseUnit', e.target.value)} placeholder="ex. kg" className="mt-1 w-full p-1.5 border rounded text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Étapes de transformation (effet en % sur la quantité — négatif pour une perte, positif pour un gain)</label>
                            <div className="space-y-1">
                                {(format.yieldGrid.stages || []).map((stage, i) => (
                                    <div key={stage.id} className="flex items-center gap-2">
                                        <input type="text" value={stage.name || ''} onChange={(e) => handleYieldStageChange(i, 'name', e.target.value)} placeholder="ex. Cuisson" className="flex-1 p-1 border rounded text-sm" />
                                        <input type="text" inputMode="decimal" value={stage.percentEffect || ''} onChange={(e) => handleYieldStageChange(i, 'percentEffect', e.target.value)} placeholder="ex. -30" className="w-24 p-1 border rounded text-right text-sm" />
                                        <span className="text-xs text-gray-500">%</span>
                                        <button onClick={() => handleRemoveYieldStage(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddYieldStage} className="mt-1 text-xs text-blue-600 hover:text-blue-800">+ Ajouter une étape</button>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600">Taux de rejet des produits finis (%)</label>
                            <p className="text-xs text-gray-500 mb-1">Distinct d'une perte de procédé : des unités déjà produites, retirées après coup (ex. contrôle qualité).</p>
                            <input type="text" inputMode="decimal" value={format.yieldGrid.rejectRate || ''} onChange={(e) => handleFormatNestedChange('yieldGrid', 'rejectRate', e.target.value)} className="w-32 p-1.5 border rounded text-right text-sm" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700">Quantité produite calculée : {(computedYieldUnits ?? 0).toFixed(2)}</p>
                    </div>
                )}
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
                    <input type="checkbox" id="isResaleProduct" checked={!!format.isResaleProduct} onChange={(e) => handleFormatResaleToggle(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"/>
                    Considérer comme un produit de revente
                    <Tooltip text="Cochez cette case pour les formats achetés et revendus sans transformation (ex: boissons, croustilles). Cela simplifiera la fiche de coût à un simple coût d'achat. Propre à ce format : un même produit peut avoir un format cuisiné et un format revendu tel quel." />
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


            {!format.isResaleProduct && (
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
                <div className="flex justify-end mb-2">
                    <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyIngredientsFrom} label="les ingrédients" />
                </div>
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
                            {(format.ingredients || []).map((item, index) => {
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
                        <p className="font-bold text-green-800">Coût Matières (unité): <span>{formatCurrency(costs.costMatierePerPortion)} $</span></p>
                    </div>
                </div>
                </div>
            )}
            </div>

            {/* Emballage (Phase 2.2) — poste de coût séparé du coût matière, voir
                04-Conception-Modele.md. Même patron visuel que les Ingrédients (table de rendu
                identique), en-tête et couleur propres pour le distinguer. */}
            <div id="tutorial-section-recipe-packaging" className="p-4 bg-orange-50 rounded-lg relative z-10">
                <div
                    onClick={() => toggleSection('packaging')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('packaging')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('packaging')}
                >
                    <h2 className="text-xl font-semibold text-orange-700">2. Emballage</h2>
                    <ChevronDown className={`h-6 w-6 text-orange-700 transform transition-transform duration-200 ${openRecipeSections.has('packaging') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('packaging') && (
                <div className="mt-4">
                <div className="flex justify-end mb-2">
                    <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyPackagingItemsFrom} label="l'emballage" />
                </div>
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="min-w-full">
                        <thead className="bg-orange-100">
                            <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emballage</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût U. ($)</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût Total ($)</th>
                                <th className="relative px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(format.packagingItems || []).map((item, index) => {
                                const basePkg = basePackaging.find(pkg => pkg.id === item.id);
                                const recipeUnit = item.recipeUnit || basePkg?.unit;
                                const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[basePkg?.unit]?.factor || 1);
                                const quantityInBaseUnit = parseLocaleNumber(item.quantity) * conversionFactor;
                                const baseCost = quantityInBaseUnit * parseLocaleNumber(basePkg?.unitPrice || 0);
                                const lossPercentage = (parseLocaleNumber(basePkg?.lossPercentage) || 0) / 100;
                                const displayedUnitPrice = (basePkg?.unitPrice || 0) / (CONVERSION_FACTORS[basePkg?.unit]?.factor || 1) * (CONVERSION_FACTORS[recipeUnit]?.factor || 1);
                                const totalCost = lossPercentage > 0 && lossPercentage < 1 ? baseCost / (1 - lossPercentage) : baseCost;

                                return (
                                    <tr
                                        key={item.rowId || index}
                                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-orange-50/50'} transition-all ${item.rowId === newlyAddedRowId ? 'new-row' : ''}`}
                                    >
                                        <td className="px-2 py-2 w-1/4">
                                            <Combobox
                                                options={basePackaging}
                                                value={basePackaging.find(pkg => pkg.id === item.id) || null}
                                                onChange={(selection) => handlePackagingUpdate(index, selection)}
                                                getOptionLabel={(option) => option.name}
                                                getOptionKey={(option) => option.id}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="text" inputMode="decimal" value={item.quantity || ''} onChange={e => handlePackagingValueChange(index, 'quantity', e.target.value)} className={`w-full p-1 border rounded text-right ${!isValidNumber(item.quantity) ? 'border-red-500' : 'border-gray-300'}`}/>
                                            {!isValidNumber(item.quantity) && <ValidationMessage message="Invalide" />}
                                        </td>
                                        <td className="px-2 py-2">
                                            <select
                                                value={item.recipeUnit || basePkg?.unit}
                                                onChange={e => handlePackagingValueChange(index, 'recipeUnit', e.target.value)}
                                                className="w-full p-1 border rounded"
                                                disabled={!basePkg}
                                            >
                                                {getCompatibleUnits(basePkg?.unit).map(unit => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-2"><input type="text" value={formatUnitPrice(displayedUnitPrice)} readOnly disabled className="w-full p-1 bg-gray-100 border-0 rounded text-right"/></td>
                                        <FlashingCell value={totalCost} />
                                        <td className="px-2 py-2 text-center"><button onClick={() => removePackagingRow(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={20}/></button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <button id="tutorial-add-packaging-to-recipe" onClick={addPackagingRow} className="mt-4 text-sm text-orange-600 hover:text-orange-800">+ Ajouter un emballage</button>
                <div className="mt-4 p-3 bg-orange-100 rounded-md space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                        <p className="text-orange-800">Coût Emballage (base): <span>{formatCurrency(costs.totalBasePackagingCost)} $</span></p>
                        <p className="text-orange-800">Coût des Pertes (stock): <span>{formatCurrency(costs.totalPackagingLossCost)} $</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-orange-200 pt-2">
                        <p className="font-bold text-orange-800">Total Coût Emballage (recette): <span>{formatCurrency(costs.totalPackagingCost)} $</span></p>
                        <p className="font-bold text-orange-800">Coût Emballage (unité): <span>{formatCurrency(costs.costPackagingPerPortion)} $</span></p>
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
                    <h2 className="text-xl font-semibold text-yellow-700">3. Processus de production et main-d'œuvre</h2>
                    <ChevronDown className={`h-6 w-6 text-yellow-700 transform transition-transform duration-200 ${openRecipeSections.has('labor') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('labor') && (
                    <div className="mt-4">
                <div className="flex justify-end mb-2">
                    <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyProductionStepsFrom} label="les étapes" />
                </div>
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
                            {(format.productionSteps || []).map((step, index) => {
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
                {/* Diagramme de Gantt */}
                    <div className="mt-6">
                        <GanttChart productionSteps={format.productionSteps} />
                    </div>
                <div className="mt-4 p-3 bg-yellow-100 rounded-md space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                        <p className="text-yellow-800">Total Coût Main-d'œuvre Direct: <span>{formatCurrency(costs.totalDirectLaborCost)} $</span></p>
                        <p className="text-yellow-800">Total Coût Main-d'œuvre Indirect: <span>{formatCurrency(costs.totalLaborCost - costs.totalDirectLaborCost)} $</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-yellow-200 pt-2">
                        <p className="font-bold text-yellow-800">Total Main-d'oeuvre (recette): <span>{formatCurrency(costs.totalLaborCost)} $</span></p>
                        <p className="font-bold text-yellow-800">Coût Main-d'oeuvre (unité): <span>{formatCurrency(costs.costLaborPerPortion)} $</span></p>
                    </div>
                    </div>
                </div>
                )}
            </div>
            </>
             )}


            {format.isResaleProduct && (
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
                    <div className="flex justify-end mb-2">
                        <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyResalePurchaseFrom} label="le coût d'achat" />
                    </div>
                    <div>
                        <label htmlFor="purchaseCost" className="block text-sm font-medium text-gray-700">Coût d'achat par unité ($)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            id="purchaseCost"
                            value={format.purchaseCost || ''}
                            onChange={(e) => handleFormatChange('purchaseCost', e.target.value)}
                            className={`mt-1 block w-full max-w-xs rounded-md shadow-sm p-2 border text-right ${!isValidNumber(format.purchaseCost) ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {!isValidNumber(format.purchaseCost) && <ValidationMessage message="Veuillez entrer un nombre positif." />}
                    </div>
                    <div className="mt-4 p-3 bg-green-100 rounded-md grid grid-cols-2 gap-4">
                        <p className="font-bold text-green-800">Total Coût Direct: <span>{formatCurrency(costs.totalDirectCostPerPortion)} $</span></p>
                        <p className="font-bold text-green-800">Coût par Unité: <span>{formatCurrency(costs.totalDirectCostPerPortion)} $</span></p>
                    </div>
                    {/* NOUVEAU: Gestion des allergènes pour les produits de revente */}
                    {format.isResaleProduct && (
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
                                assignedAllergens={format.manualAllergens || []}
                                onUpdateAllergens={handleResaleAllergenChange}
                            />
                        </>
                    )}
                        </div>
                    )}
                </div>
            )}

            {/* Coûts additionnels : sous-traitance et vieillissement (Phase 1.4/1.5) — masqués par
                défaut, rattachés au FORMAT sélectionné (voir 04-Conception-Modele.md). */}
            <div id="tutorial-section-recipe-additional" className="p-4 bg-pink-50 rounded-lg">
                <div
                    onClick={() => toggleSection('additional')}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('additional')}
                    className="w-full flex justify-between items-center cursor-pointer"
                    aria-expanded={openRecipeSections.has('additional')}
                >
                    <h2 className="text-xl font-semibold text-pink-700">4. Coûts additionnels</h2>
                    <ChevronDown className={`h-6 w-6 text-pink-700 transform transition-transform duration-200 ${openRecipeSections.has('additional') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('additional') && (
                    <div className="mt-4 space-y-6">
                        <div className="flex justify-end">
                            <CopyFromFormatControl formats={formats} currentFormatId={format.id} onCopy={copyAdditionalCostsFrom} label="les coûts additionnels" />
                        </div>
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700">
                                <input type="checkbox" checked={!!format.subcontracting?.enabled} onChange={(e) => handleFormatNestedToggle('subcontracting', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2" />
                                Sous-traitance
                                <Tooltip text="Coût d'une opération de fabrication confiée à un tiers pour ce format (ex. embouteillage externe). S'ajoute aux coûts directs (matière + main-d'œuvre) et affecte donc la marge sur coût primaire." />
                            </label>
                            {format.subcontracting?.enabled && (
                                <div className="mt-2 space-y-1">
                                    {(format.subcontracting.items || []).map((item, i) => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <input type="text" value={item.name || ''} onChange={(e) => handleSubcontractingItemChange(i, 'name', e.target.value)} placeholder="Sous-traitant" className="flex-1 p-1 border rounded text-sm" />
                                            <input type="text" value={item.operation || ''} onChange={(e) => handleSubcontractingItemChange(i, 'operation', e.target.value)} placeholder="Opération" className="flex-1 p-1 border rounded text-sm" />
                                            <input type="text" inputMode="decimal" value={item.cost || ''} onChange={(e) => handleSubcontractingItemChange(i, 'cost', e.target.value)} placeholder="Coût $" className="w-24 p-1 border rounded text-right text-sm" />
                                            <button onClick={() => handleRemoveSubcontractingItem(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                    <button onClick={handleAddSubcontractingItem} className="text-xs text-blue-600 hover:text-blue-800">+ Ajouter une opération</button>
                                    <p className="text-sm font-semibold text-gray-700 pt-1">Total sous-traitance : {formatCurrency(costs.totalSubcontractingCost)} $</p>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700">
                                <input type="checkbox" checked={!!format.aging?.enabled} onChange={(e) => handleFormatNestedToggle('aging', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2" />
                                Vieillissement / affinage
                                <Tooltip text="Charge d'intérêt de portage pour un format qui doit vieillir ou affiner en inventaire avant la vente (ex. fermentation). Calculée sur le total des charges directes du lot ; incluse dans la marge nette mais pas dans la marge sur coût primaire." />
                            </label>
                            {format.aging?.enabled && (
                                <div className="mt-2 grid grid-cols-2 gap-3 max-w-md">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600">Taux d'intérêt annuel (%)</label>
                                        <input type="text" inputMode="decimal" value={format.aging.interestRate || ''} onChange={(e) => handleFormatNestedChange('aging', 'interestRate', e.target.value)} className="mt-1 w-full p-1.5 border rounded text-right text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600">Durée (mois)</label>
                                        <input type="text" inputMode="decimal" value={format.aging.months || ''} onChange={(e) => handleFormatNestedChange('aging', 'months', e.target.value)} className="mt-1 w-full p-1.5 border rounded text-right text-sm" />
                                    </div>
                                    <p className="col-span-2 text-sm font-semibold text-gray-700">Coût de vieillissement : {formatCurrency(costs.totalAgingCost)} $</p>
                                </div>
                            )}
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
                    <h2 className="text-xl font-semibold text-blue-700">5. Récapitulatif</h2>
                    <ChevronDown className={`h-6 w-6 text-blue-700 transform transition-transform duration-200 ${openRecipeSections.has('recap') ? 'rotate-180' : ''}`} />
                </div>
                {openRecipeSections.has('recap') && (
                    <div className="mt-4">
                {/* Sélecteur de canal (06/10) : pilote tout ce qui dépend du prix dans cette
                    section (% de coût, marge de contribution, marge brute, prix de vente) — pas
                    la marge nette, qui n'apparaît plus ici du tout (voir Résumé → Par SKU).
                    Masqué pendant une simulation de prix (axe différent, simule le canal
                    principal uniquement). */}
                {!isSimulating && channelBreakdown.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-sm font-medium text-gray-700">Canal :</span>
                        {channelBreakdown.length > 1 ? (
                            <select
                                value={selectedChannelData?.channelId || ''}
                                onChange={(e) => setSelectedChannelId(e.target.value)}
                                className="p-1 border rounded text-sm border-gray-300"
                            >
                                {channelBreakdown.map(cb => <option key={cb.channelId} value={cb.channelId}>{cb.channelName}</option>)}
                            </select>
                        ) : (
                            <span className="text-sm text-gray-500">{selectedChannelData.channelName}</span>
                        )}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-4">
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">
                            Coût Matière (%)
                            <Tooltip text="Le pourcentage du prix de vente que représente le coût des ingrédients." />
                            {getCostTargetIndicator(simulatedCosts ? simulatedCosts.costMatierePercent : marginView.costMatierePercent, generalInfo.foodCostTarget)}
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                             {simulatedCosts
                                ? renderComparison(costs.costMatierePercent, simulatedCosts.costMatierePercent, formatPercent, false, '%')
                                : `${formatPercent(marginView.costMatierePercent)}%`}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">
                            Coût Emballage (%)
                            <Tooltip text="Le pourcentage du prix de vente que représente le coût de l'emballage — poste séparé du coût matière." />
                            {getCostTargetIndicator(simulatedCosts ? simulatedCosts.costPackagingPercent : marginView.costPackagingPercent, generalInfo.packagingCostTarget)}
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                             {simulatedCosts
                                ? renderComparison(costs.costPackagingPercent, simulatedCosts.costPackagingPercent, formatPercent, false, '%')
                                : `${formatPercent(marginView.costPackagingPercent)}%`}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">
                            Coût Main-d'oeuvre (%)
                            <Tooltip text="Le pourcentage du prix de vente que représente le coût total de la main-d'œuvre (direct et indirect)." />
                            {getCostTargetIndicator(simulatedCosts ? simulatedCosts.costLaborPercent : marginView.costLaborPercent, generalInfo.laborCostTarget)}
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                            {simulatedCosts
                                ? renderComparison(costs.costLaborPercent, simulatedCosts.costLaborPercent, formatPercent, false, '%')
                                : `${formatPercent(marginView.costLaborPercent)}%`}
                        </p>
                    </div>
                </div>
                {/* Un seul total de coût ici (06/10) : le coût de PRODUCTION, avant frais fixes.
                    Les frais indirects et le coût de revient complet (qui les inclut) n'ont plus
                    leur place dans cet onglet — voir Résumé → Par SKU. */}
                <div className="flex justify-center mb-4">
                    <div className={`w-full md:w-1/2 p-3 bg-white rounded-lg shadow text-center ${flashTotalCost ? 'animate-flash' : ''}`}>
                        <div className="text-sm text-gray-500 flex items-center justify-center">Coût de Production <Tooltip text="La somme des coûts de matières, d'emballage, de main-d'œuvre et de sous-traitance directement attribuables à la production de ce format — avant frais fixes." /></div>
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(costs.totalDirectCostPerPortion)} $</p>
                    </div>
                </div>
                {/* Marge de contribution et marge brute (= coût primaire), par canal sélectionné
                    ci-dessus. PAS de marge nette ici (décision utilisateur du 06/10) : elle a
                    besoin de l'allocation des frais fixes, pas encore multi-canal avant la Phase
                    4 — le rapport multi-canal pour la marge nette vit dans Résumé → Par SKU. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Marge de contribution <Tooltip text="Prix de vente moins le coût matière seul. C'est ce qui reste pour couvrir la main-d'œuvre, les frais indirects et le profit." /></div>
                        <p className={`text-xl font-bold ${getMarginTextColorClass(simulatedCosts ? simulatedCosts.margeContributionPercent : marginView.margeContributionPercent)}`}>
                            {simulatedCosts ? (
                                <>
                                    <span>{`${formatCurrency(simulatedCosts.margeContributionDollar)}$ / ${formatPercent(simulatedCosts.margeContributionPercent)}%`}</span>
                                    <span className="block text-sm font-normal text-gray-500">
                                        (diff: {simulatedCosts.margeContributionDollar - costs.margeContributionDollar >= 0 ? '+' : ''}{formatCurrency(simulatedCosts.margeContributionDollar - costs.margeContributionDollar)}$)
                                    </span>
                                </>
                            ) : (
                                `${formatCurrency(marginView.margeContributionDollar)}$ / ${formatPercent(marginView.margeContributionPercent)}%`
                            )}
                        </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow">
                        <div className="text-sm text-gray-500 flex items-center justify-center">Marge brute (coût primaire) <Tooltip text="Prix de vente moins les coûts directs (matière + emballage + main-d'œuvre + sous-traitance). Profit avant de déduire les frais indirects et le vieillissement. La MO est traitée comme un coût semi-variable." /></div>
                        <p className={`text-xl font-bold ${getMarginTextColorClass(simulatedCosts ? simulatedCosts.margeBrutePercent : marginView.margeBrutePercent)}`}>
                            {simulatedCosts ? (
                                <>
                                    <span>{`${formatCurrency(simulatedCosts.margeBruteDollar)}$ / ${formatPercent(simulatedCosts.margeBrutePercent)}%`}</span>
                                    <span className="block text-sm font-normal text-gray-500">
                                        (diff: {simulatedCosts.margeBruteDollar - costs.margeBruteDollar >= 0 ? '+' : ''}{formatCurrency(simulatedCosts.margeBruteDollar - costs.margeBruteDollar)}$)
                                    </span>
                                </>
                            ) : (
                                `${formatCurrency(marginView.margeBruteDollar)}$ / ${formatPercent(marginView.margeBrutePercent)}%`
                            )}
                        </p>
                    </div>
                </div>
                {/* Prix de vente au bas de la cascade, centré et à la taille d'une carte — celui
                    du canal sélectionné ci-dessus hors simulation. */}
                <div className="flex justify-center mt-4">
                    <div className="w-full md:w-1/3 p-3 bg-white rounded-lg shadow text-center border-l-4 border-blue-500">
                        <p className="text-sm text-gray-500">Prix de Vente</p>
                        <p className="text-2xl font-bold text-blue-800">
                            {simulatedCosts
                                ? renderComparison(parseLocaleNumber(format.prixVente), parseLocaleNumber(simulatedPrice), formatCurrency, true, ' $')
                                : `${formatCurrency(selectedChannelData ? selectedChannelData.netPrice : parseLocaleNumber(format.prixVente))} $`}
                        </p>
                    </div>
                </div>
                {/* Point mort réintroduit le 19/10, en bas de la cascade — valeur déjà calculée par
                    analysisData (voir plus haut), jamais recalculée ici. Masqué pendant une
                    simulation de prix, comme le sélecteur de canal : le point mort affiché reste
                    celui du prix réel, pas une projection sur le prix simulé. */}
                {!isSimulating && (
                    <div className="flex justify-center mt-4">
                        <div className="w-full md:w-1/3 p-3 bg-white rounded-lg shadow text-center">
                            <div className="text-sm text-gray-500 flex items-center justify-center">
                                Point Mort
                                <Tooltip text="Unités à vendre dans ce canal pour couvrir la part des frais fixes allouée à ce SKU — déjà calculé pour le Rapport (Par SKU), simplement affiché ici." />
                            </div>
                            <p className="text-xl font-bold text-gray-800">
                                {breakEvenUnits != null ? `${breakEvenUnits} unités` : 'N/A'}
                            </p>
                        </div>
                    </div>
                )}
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
