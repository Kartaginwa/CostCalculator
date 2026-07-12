import React, { useState, useReducer, useRef, useMemo, useCallback, useEffect } from 'react';
import {
    Users, ChefHat, Table, Info, ShoppingCart, Save, FolderOpen,
    PlusCircle, TrendingUp, Settings,
} from 'lucide-react';

import { parseLocaleNumber } from './utils.js';
import { computeAnalysisData } from './engine/analysisData.js';
import { generatePdf as generatePdfReport } from './reports/generatePdf.js';
import { exportToExcel as exportToExcelReport } from './reports/exportToExcel.js';
import { getDefaultState, getEmptyState } from './state/initialState.js';
import { projectReducer, toProjectState } from './state/projectReducer.js';
import { ProjectContext } from './state/ProjectContext.jsx';

import { Notification, WelcomeModal, OnboardingModal, TutorialGuide, PdfOptionsModal } from './components/AppDialogs.jsx';
import { InstructionModal } from './components/InstructionModal.jsx';
import { ConfirmationModal } from './components/common.jsx';

import { ProductInfo } from './features/ProductInfo.jsx';
import { PosImportWizardModal } from './features/PosImportWizardModal.jsx';
import { IngredientsTab } from './features/IngredientsTab.jsx';
import { LaborDatabaseTab } from './features/LaborDatabaseTab.jsx';
import { RecipeCalculator } from './features/RecipeCalculator.jsx';
import { SummaryTable } from './features/SummaryTable.jsx';
import { TrackingTab } from './features/TrackingTab.jsx';

const App = () => {
    // --- ÉTATS ---
    const [isProjectLoaded, setIsProjectLoaded] = useState(false);

    // Données du projet (produits, ingrédients, main-d'œuvre, infos générales...) : centralisées
    // dans un reducer et exposées via ProjectContext pour éviter de les faire descendre
    // manuellement à travers chaque onglet (voir src/state/projectReducer.js).
    const [projectState, dispatch] = useReducer(projectReducer, undefined, () => toProjectState(getEmptyState()));
    const { companyName, logoUrl, generalInfo, baseIngredients, products, trackingPoints, laborDatabase, uiSettings } = projectState;

    // Setters stables (dispatch seul en dépendance, garanti stable par React) : la résolution
    // des mises à jour fonctionnelles (value => ...) se fait dans le reducer lui-même plutôt
    // que par fermeture sur projectState ici. Nécessaire pour pouvoir mémoïser sereinement
    // projectContextValue plus bas (sinon un nouveau setter à chaque rendu invaliderait le memo).
    const {
        setCompanyName, setLogoUrl, setGeneralInfo, setBaseIngredients,
        setProducts, setLaborDatabase, setTrackingPoints, setUiSettings,
    } = useMemo(() => {
        const makeSetter = (type) => (value) => dispatch({ type, payload: value });
        return {
            setCompanyName: makeSetter('SET_COMPANY_NAME'),
            setLogoUrl: makeSetter('SET_LOGO_URL'),
            setGeneralInfo: makeSetter('SET_GENERAL_INFO'),
            setBaseIngredients: makeSetter('SET_BASE_INGREDIENTS'),
            setProducts: makeSetter('SET_PRODUCTS'),
            setLaborDatabase: makeSetter('SET_LABOR_DATABASE'),
            setTrackingPoints: makeSetter('SET_TRACKING_POINTS'),
            setUiSettings: makeSetter('SET_UI_SETTINGS'),
        };
    }, [dispatch]);

    const [activeTab, setActiveTab] = useState('info');
    const [editingProductIndex, setEditingProductIndex] = useState(0);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showLoadExampleConfirm, setShowLoadExampleConfirm] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const fileInputRef = useRef(null);
    const [appLogoBase64, setAppLogoBase64] = useState(null);
    const [appLogoDimensions, setAppLogoDimensions] = useState({ width: 1, height: 1 });
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [runTutorial, setRunTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [, setUndoState] = useState(null); // Pour la logique d'annulation

    const [openPostIds, setOpenPostIds] = useState(new Set());
    const [openRecipeSections, setOpenRecipeSections] = useState(new Set(['ingredients', 'labor', 'indirects', 'recap']));

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfOptions, setPdfOptions] = useState({ title: '', subtitle: '' });
    const [isPosWizardOpen, setIsPosWizardOpen] = useState(false);

    const handlePosImport = (importData) => {
        const { itemsToImport, newTotalRevenue, newMenuRevenuePercentage, importedProductIds, newStartDate, newEndDate } = importData;

        const updatedProducts = products.map(p => {
            // Pour les plats existants non importés, le mix des ventes est mis à 0
            if (!importedProductIds.has(p.id)) {
                return { ...p, salesMix: 0, onMenu: false };
            }
            return p; // Les plats importés seront traités ci-dessous
        });

        const existingProductsMap = new Map(updatedProducts.map(p => [p.id, p]));

        itemsToImport.forEach(item => {
            if (item.status === 'update') {
                const existingProduct = existingProductsMap.get(item.existingId);
                if (existingProduct) {
                    // add this logic here : force explicit Number casting to prevent string issues
                    existingProduct.prixVente = Number(item.prixVente);
                    existingProduct.salesMix = Number(item.salesMix);
                    existingProduct.category = item.category;
                    existingProduct.onMenu = true;
                }
            } else if (item.status === 'new') {
                const newProduct = {
                    id: String(Date.now() + Math.random()),
                    platName: item.platName,
                    category: item.category,
                    prixVente: parseFloat(item.prixVente.toFixed(2)),
                    nbPortions: 1, portionSize: 1, portionUnit: 'unité',
                    isIngredient: false, isResaleProduct: false, purchaseCost: 0,
                    salesMix: item.salesMix,
                    onMenu: true,
                    manualAllergens: [], ingredients: [], productionSteps: [],
                    indirectCosts: { method: 'salesAllocation', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 }
                };
                existingProductsMap.set(newProduct.id, newProduct);
            }
        });

        const updatedProductsList = Array.from(existingProductsMap.values());

        setProducts(updatedProductsList);

        setGeneralInfo(prev => ({
            ...prev,
            totalRevenue: newTotalRevenue,
            menuRevenuePercentage: newMenuRevenuePercentage,
            period: 'custom',
            startDate: newStartDate, // On utilise la nouvelle date
            endDate: newEndDate,     // On utilise la nouvelle date
        }));

        showNotification({
            message: `Importation réussie ! ${itemsToImport.length} plat(s) ont été traités.`,
            type: 'success'
        });
    };

    const handleUiSettingsChange = (key, value) => {
        setUiSettings(prev => ({ ...prev, [key]: value }));
    };

    const openPdfModal = () => {
        setPdfOptions({
            title: "Rapport d'analyse du coût de revient",
            subtitle: `Préparer à l'attention des gestionnaires de ${companyName}`
        });
        setIsPdfModalOpen(true);
    };

    const handleConfirmPdfGeneration = (options) => {
        setIsPdfModalOpen(false);
        generatePdf(options); 
    };

    // Stable (ne ferme que sur des setters useState, eux-mêmes stables) : nécessaire pour que
    // projectContextValue puisse être mémoïsé sans se recréer à chaque rendu de App.
    const showNotification = useCallback(({ message, type = 'success', onUndo }) => {
        // Crée un ID unique pour cette notification pour éviter les conflits de timers
        const id = Date.now();

        const closeNotification = () => {
            // S'assure de ne fermer que la notification actuelle
            setNotification(currentNotif => (currentNotif && currentNotif.id === id ? null : currentNotif));
            // Si la notification qui se ferme avait une action "Annuler",
            // c'est à ce moment que la suppression devient "définitive" en vidant l'état d'annulation.
            if (onUndo) {
                setUndoState(null);
            }
        };

        setNotification({ id, message, type, onClose: closeNotification, onUndo });
    }, []);

    // Charger le logo de l'application pour le PDF
    useEffect(() => {
        const defaultLogoUrl = './Logo_RestoCalculateur3.png'; // Utiliser le logo local du projet
        const img = new Image();
        img.src = defaultLogoUrl;
        // crossOrigin n'est pas nécessaire pour les images locales ou de même origine
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            setAppLogoDimensions({ width: img.width, height: img.height });
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            setAppLogoBase64(dataURL);
        };
        img.onerror = (err) => {
            // This error is expected in some environments like Electron, so we just note it.
            console.log("Note: Le logo local de l'application pour le PDF n'a pas pu être chargé. C'est un comportement normal dans certains environnements.", err);
            setAppLogoBase64(null); // Fallback
        };
    }, []);

    const autoCalculatedLaborCost = useMemo(() => {
        return laborDatabase.reduce((total, post) => {
            const postTotal = (post.employees || []).reduce((sum, emp) => {
                const paidHours = parseLocaleNumber(emp.workedHours);
                const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                return sum + (paidHours * baseHourlyCost);
            }, 0);
            return total + postTotal;
        }, 0);
    }, [laborDatabase]);
    const calculatedGeneralInfo = useMemo(() => {
        const parsedOperationHours = parseLocaleNumber(generalInfo.operationHours);
        const parsedTotalIndirects = parseLocaleNumber(generalInfo.totalIndirects);
        const operationCostPerHour = parsedOperationHours > 0 ? parsedTotalIndirects / parsedOperationHours : 0;

        const totalDirectLaborHoursNeededByPost = {};
        products.filter(p => p.onMenu).forEach(product => {
            const prixVente = parseLocaleNumber(product.prixVente);
            if (!prixVente || prixVente === 0) return;

            const portionsSold = (parseLocaleNumber(generalInfo.totalRevenue) * (parseLocaleNumber(product.salesMix) / 100)) / prixVente;
            const batchesNeeded = portionsSold / (parseLocaleNumber(product.nbPortions) || 1);

            (product.productionSteps || []).forEach(step => {
                (step.personnel || []).forEach(person => {
                    if (!totalDirectLaborHoursNeededByPost[person.postId]) {
                        totalDirectLaborHoursNeededByPost[person.postId] = 0;
                    }
                    totalDirectLaborHoursNeededByPost[person.postId] += (parseLocaleNumber(step.duration) / 3600) * batchesNeeded;
                });
            });
        });

        const totalDirectLaborHoursNeeded = Object.values(totalDirectLaborHoursNeededByPost).reduce((sum, hours) => sum + hours, 0);

        const totalLaborHoursAvailable = laborDatabase.reduce((total, post) => {
            return total + (post.employees || []).reduce((sum, emp) => {
                return sum + (parseLocaleNumber(emp.workedHours) * (parseLocaleNumber(emp.productiveTimePercentage) / 100));
            }, 0);
        }, 0);

        const kitchenProductivity = totalLaborHoursAvailable > 0 ? (totalDirectLaborHoursNeeded / totalLaborHoursAvailable) * 100 : 100;
        const showProductivityWarning = autoCalculatedLaborCost > 0 && totalLaborHoursAvailable > 0 && totalDirectLaborHoursNeeded * (autoCalculatedLaborCost / totalLaborHoursAvailable) > autoCalculatedLaborCost;

        const productivityReport = {
            rows: laborDatabase.map(post => {
                const expected = (post.employees || []).reduce((sum, emp) => sum + (parseLocaleNumber(emp.workedHours) * (parseLocaleNumber(emp.productiveTimePercentage) / 100)), 0);
                const actual = totalDirectLaborHoursNeededByPost[post.postName] || 0;
                const difference = expected - actual;
                const utilization = expected > 0 ? (actual / expected) * 100 : 0;
                return { postName: post.postName, expected, actual, difference, utilization };
            }),
            totals: {}
        };
        productivityReport.totals = productivityReport.rows.reduce((acc, row) => {
            acc.expected += row.expected;
            acc.actual += row.actual;
            return acc;
        }, { expected: 0, actual: 0 });
        productivityReport.totals.difference = productivityReport.totals.expected - productivityReport.totals.actual;
        productivityReport.totals.utilization = productivityReport.totals.expected > 0 ? (productivityReport.totals.actual / productivityReport.totals.expected) * 100 : 0;

        return {
            ...generalInfo,
            totalKitchenLaborCost: autoCalculatedLaborCost,
            operationCostPerHour: operationCostPerHour,
            kitchenProductivity: kitchenProductivity,
            showProductivityWarning: showProductivityWarning,
            productivityReport: productivityReport,
        };
    }, [generalInfo, products, laborDatabase, autoCalculatedLaborCost]);
    // --- MOTEUR DE DONNÉES CENTRALISÉ ET MÉMORISÉ ---
    // Source unique de vérité pour les coûts : computeAnalysisData calcule productsWithCosts une
    // seule fois (avec un memo partagé) puis en dérive tous les KPIs. Défini ici, avant
    // ingredientsList, pour que ce dernier — comme les autres consommateurs (RecipeCalculator,
    // TrackingTab, rapports) — réutilise ces coûts au lieu de relancer un calcul redondant.
    const analysisData = useMemo(
        () => computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo),
        [products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo]
    );

    const ingredientsList = useMemo(() => {
        const recipeIngredients = analysisData.productsWithCosts
            .filter(p => p.isIngredient && p.platName)
            .map(p => {
                const costs = p.costs;
                const sanitizedPortionSize = parseLocaleNumber(p.portionSize) || 1;
                const calculatedUnitPrice = sanitizedPortionSize > 0 ? costs.totalCostPerPortion / sanitizedPortionSize : 0;

                return {
                    id: p.id,
                    name: p.platName,
                    provider: 'Sous-recette',
                    purchaseFormat: sanitizedPortionSize,
                    unit: p.portionUnit,
                    purchasePrice: costs.totalCostPerPortion,
                    unitPrice: calculatedUnitPrice,
                    isRecipe: true,
                    lastUpdated: new Date().toISOString().split('T')[0]
                };
            });
        return [...baseIngredients, ...recipeIngredients];
    }, [analysisData, baseIngredients]);
    // Stable (setGeneralInfo est lui-même stable) : nécessaire pour la mémoïsation de
    // projectContextValue.
    const handleUpdateGeneralInfo = useCallback((field, value) => {
        setGeneralInfo(prev => ({ ...prev, [field]: value }));
    }, [setGeneralInfo]);

    const handleProductValueChange = (index, field, value) => {
        const newProducts = [...products];
        const updatedProduct = { ...newProducts[index], [field]: value };

        if (field === 'onMenu' && !value) {
            updatedProduct.salesMix = 0;
        }

        newProducts[index] = updatedProduct;
        setProducts(newProducts);
    };

    const handleAddNewProduct = () => {
        const newProduct = {
            id: String(Date.now() + Math.random()),
            platName: '',
            category: '',
            prixVente: 0,
            nbPortions: 1,
            portionSize: 1,
            portionUnit: 'unité',
            isIngredient: false,
            isResaleProduct: false,
            purchaseCost: 0,
            salesMix: 0,
            onMenu: true,
            manualAllergens: [],
            ingredients: [],
            productionSteps: [],
            indirectCosts: { method: 'laborIntensity', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 }
        };
        const newProducts = [newProduct, ...products];
        setProducts(newProducts);
        setEditingProductIndex(0);
    };
    
    const handleDeleteProduct = (indexToDelete) => {
        const productToDelete = products[indexToDelete];
        if (!productToDelete) return;

        // 1. Sauvegarde l'état d'origine pour pouvoir l'annuler
        setUndoState({
            action: 'DELETE_PRODUCT',
            data: { product: productToDelete, index: indexToDelete }
        });

        // 2. Met à jour l'interface en "cachant" le produit
        const newProducts = products.filter((_, index) => index !== indexToDelete);
        setProducts(newProducts);
        if (editingProductIndex >= indexToDelete) {
            setEditingProductIndex(Math.max(0, newProducts.length - 1));
        }

        // 3. Affiche la notification avec l'option "Annuler"
        showNotification({
            message: `Le plat "${productToDelete.platName}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                // Si l'utilisateur clique sur "Annuler"
                const restoredProducts = [...newProducts];
                restoredProducts.splice(indexToDelete, 0, productToDelete);
                setProducts(restoredProducts);
                setUndoState(null); // Vide l'état d'annulation
                setNotification(null); // Ferme la notification immédiatement
            }
        });
    };
    
    const handleDuplicateProduct = (indexToDuplicate) => {
        const productToDuplicate = products[indexToDuplicate];
        const newProduct = JSON.parse(JSON.stringify(productToDuplicate));
        newProduct.id = String(Date.now() + Math.random());
        newProduct.platName = `${productToDuplicate.platName} (Copie)`;
        newProduct.ingredients = newProduct.ingredients.map(ing => ({ ...ing, rowId: `ing_${Date.now()}_${Math.random()}` }));
        newProduct.labor = newProduct.labor.map(lab => ({ ...lab, rowId: `lab_${Date.now()}_${Math.random()}` }));
        
        const newProducts = [...products];
        newProducts.splice(indexToDuplicate + 1, 0, newProduct);
        setProducts(newProducts);
    };

    const editProduct = (index) => {
        setEditingProductIndex(index);
        setActiveTab('recipe');
    };

    // --- GESTION DE PROJET (NOUVEAU / SAUVEGARDE / OUVERTURE) ---
    const handleStartTutorial = () => {
        setShowOnboardingModal(false);
        // Charge les données d'exemple pour le tour
        const defaultState = getDefaultState();
        setCompanyName(defaultState.companyName);
        setLogoUrl(defaultState.logoUrl);
        setGeneralInfo(defaultState.generalInfo);
        setBaseIngredients(defaultState.ingredientsList);
        setProducts(defaultState.products);
        setTrackingPoints(defaultState.trackingPoints);
        setLaborDatabase(defaultState.laborDatabase);
        // Démarre le tutoriel
        setTutorialStep(0);
        setActiveTab('info');
        setRunTutorial(true);
    };

    const handleSkipTutorial = () => {
        setShowOnboardingModal(false);
    };

    const handleEndTutorial = () => {
        setRunTutorial(false);
        // Réinitialise l'application à un état vierge
        const emptyState = getEmptyState();
        setCompanyName(emptyState.companyName);
        setLogoUrl(emptyState.logoUrl);
        setGeneralInfo(emptyState.generalInfo);
        setBaseIngredients(emptyState.ingredientsList);
        setProducts(emptyState.products);
        setTrackingPoints(emptyState.trackingPoints);
        setLaborDatabase(emptyState.laborDatabase);
        setEditingProductIndex(0);
        setActiveTab('info');
        window.scrollTo(0, 0); // Remonte en haut de la page
        showNotification("Le tour est terminé. Vous pouvez maintenant commencer votre projet.", "success");
    };

    const handleStepChange = (newStepIndex) => {
        setTutorialStep(newStepIndex);
    };

    const handleConfirmReset = () => {
        const emptyState = getEmptyState();
        setCompanyName(emptyState.companyName);
        setLogoUrl(emptyState.logoUrl);
        setGeneralInfo(emptyState.generalInfo);
        setBaseIngredients(emptyState.ingredientsList);
        setProducts(emptyState.products);
        setTrackingPoints(emptyState.trackingPoints);
        setLaborDatabase(emptyState.laborDatabase);
        setOpenPostIds(new Set()); // Vide la liste pour un nouveau projet
        setEditingProductIndex(0);
        setActiveTab('info');
        setShowResetConfirm(false);
        setIsProjectLoaded(true);
        // Affiche la modale d'onboarding pour un nouveau projet
        setShowOnboardingModal(true);
        showNotification({ message: "Le projet a été réinitialisé.", type: 'success' });
    };

    const handleLoadExampleClick = () => {
        setShowInstructions(false);
        setShowLoadExampleConfirm(true);
    };

    const handleConfirmLoadExample = () => {
        const defaultState = getDefaultState();
        setCompanyName(defaultState.companyName);
        setLogoUrl(defaultState.logoUrl);
        setGeneralInfo(defaultState.generalInfo);
        setBaseIngredients(defaultState.ingredientsList);
        setProducts(defaultState.products);
        setTrackingPoints(defaultState.trackingPoints);
        setLaborDatabase(defaultState.laborDatabase); // Ajout de la ligne manquante
        setOpenPostIds(new Set(defaultState.laborDatabase.map(p => p.id)));
        setEditingProductIndex(0);
        setActiveTab('info');
        setShowLoadExampleConfirm(false);
        showNotification({ message: "Projet d'exemple chargé avec succès !", type: 'success' }); // Appel corrigé
        setIsProjectLoaded(true);
    };

    const saveProject = () => {
        try {
            const projectData = {
                companyName,
                logoUrl,
                generalInfo,
                baseIngredients,
                products,
                trackingPoints,
                laborDatabase,
                uiSettings,
            };

            const jsonString = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const href = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href;
            link.download = `projet_cout_revient_${companyName.replace(/\s/g, '_') || 'sans_nom'}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(href);
            showNotification({ message: 'Projet sauvegardé avec succès !', type: 'success' });
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            showNotification('Une erreur est survenue lors de la sauvegarde.', 'error');
        }
    };

    const openProject = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const emptyState = getEmptyState();
                setCompanyName(data.companyName || emptyState.companyName);
                setLogoUrl(data.logoUrl || emptyState.logoUrl);
                const loadedGeneralInfo = { ...emptyState.generalInfo, ...data.generalInfo };
                if (data.generalInfo && data.generalInfo.menuRevenuePercentage === undefined) {
                    loadedGeneralInfo.menuRevenuePercentage = 100;
                }
                setGeneralInfo(loadedGeneralInfo);
                const loadedUiSettings = { ...getEmptyState().uiSettings, ...data.uiSettings };
                setUiSettings(loadedUiSettings);
                
                const loadedTrackingPoints = (data.trackingPoints || []).map(point => ({
                    ...point,
                    name: point.name || new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), // Backwards compatibility
                    note: point.note || ''
                }));
                setTrackingPoints(loadedTrackingPoints);
                let loadedLaborDatabase = data.laborDatabase || [];
                // Vérifie si nous devons migrer depuis l'ancien format
                if (loadedLaborDatabase.length > 0 && loadedLaborDatabase[0].employees === undefined) {
                    // C'est l'ancien format, nous le convertissons.
                    const postsMap = new Map();
                    loadedLaborDatabase.forEach(employee => {
                        const postName = employee.postName || 'Non défini';
                        if (!postsMap.has(postName)) {
                            postsMap.set(postName, {
                                id: `post_${Date.now()}_${postName}`,
                                postName: postName,
                                employees: []
                            });
                        }
                        postsMap.get(postName).employees.push({
                            ...employee,
                            id: employee.id || `emp_${Date.now()}_${Math.random()}`
                        });
                    });
                    loadedLaborDatabase = Array.from(postsMap.values());
                }
                setLaborDatabase(loadedLaborDatabase);
                setOpenPostIds(new Set(loadedLaborDatabase.map(p => p.id)));
                
                const loadedBaseIngredients = (data.baseIngredients || data.ingredientsList || emptyState.ingredientsList).map(ing => ({
                    ...ing,
                    uniqueId: ing.uniqueId || '',
                    isRecipe: ing.isRecipe || false,
                    id: String(ing.id || `manual_${Date.now()}_${Math.random()}`),
                    lossPercentage: ing.lossPercentage || 0,
                    lastUpdated: ing.lastUpdated || new Date().toISOString().split('T')[0]
                }));
                setBaseIngredients(loadedBaseIngredients);

                const loadedProducts = (data.products || emptyState.products).map(p => ({
                    ...p,
                    id: String(p.id || Date.now() + Math.random()),
                    isResaleProduct: p.isResaleProduct || false,
                    purchaseCost: p.purchaseCost || 0,
                    category: p.category || '',
                    portionSize: p.portionSize !== undefined ? p.portionSize : 1,
                    portionUnit: p.portionUnit || 'unité',
                    isIngredient: p.isIngredient || false,
                    onMenu: p.onMenu !== undefined ? p.onMenu : true,
                    salesMix: p.salesMix !== undefined ? p.salesMix : 0,
                    prixVente: p.prixVente !== undefined ? p.prixVente : 0,
                    nbPortions: p.nbPortions || 1,
                    indirectCosts: p.indirectCosts || { method: 'time', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 },
                    ingredients: (p.ingredients || []).map(ing => ({ ...ing, rowId: ing.rowId || `ing_${Date.now()}_${Math.random()}`, yieldPercentage: ing.yieldPercentage || 100 })),
                    productionSteps: (p.productionSteps || []).map(step => ({ ...step, stepId: step.stepId || `step_${Date.now()}_${Math.random()}` })),
                    labor: undefined // Supprimer l'ancienne clé
                }));
                setProducts(loadedProducts);
                
                setEditingProductIndex(0);
                setActiveTab('info');
                showNotification({ message: 'Projet importé avec succès !', type: 'success' });
                setIsProjectLoaded(true);
            } catch (error) {
                console.error("Erreur lors de la lecture du fichier JSON:", error);
                showNotification("Erreur d'importation. Vérifiez le format du fichier.", 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = null; 
    };


    // --- GÉNÉRATION DES RAPPORTS (délégués à src/reports/) ---
    // Les fonctions pures de génération vivent dans src/reports/. On leur transmet ici le
    // contexte (état + données dérivées) dont elles ont besoin ; elles ne lisent aucun état React.
    const generatePdf = (options) => generatePdfReport(options, {
        showNotification, companyName, logoUrl, analysisData, appLogoBase64,
        appLogoDimensions, calculatedGeneralInfo, trackingPoints, laborDatabase, baseIngredients,
        ingredientsList,
    });

    const exportToExcel = () => exportToExcelReport({
        showNotification, analysisData, generalInfo, calculatedGeneralInfo,
        products, baseIngredients, laborDatabase, companyName, ingredientsList,
    });

    const getTabClasses = (tabName) => `flex-1 py-4 px-1 flex items-center justify-center border-b-2 font-medium text-sm focus:outline-none transition duration-300 ease-in-out ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
    
    const renderContent = () => (
            <div className="w-full max-w-7xl mt-2 mb-4">
                <div className="flex justify-between items-end mb-4">
                    <img src="./Logo_RestoCalculateur3.png" alt="Resto Calculateur Logo" className="h-28 w-auto" />
                    <div id="tutorial-main-functions" className="flex space-x-2">
                        <button onClick={() => setShowInstructions(true)} title="Guide d'utilisation" className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-200 hover:bg-gray-300">
                            <Info className="h-5 w-5" />
                        </button>
                        <button onClick={() => setShowResetConfirm(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600">
                            <PlusCircle className="h-5 w-5 mr-2" /> Nouveau
                        </button>
                        <button onClick={saveProject} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            <Save className="h-5 w-5 mr-2" /> Sauvegarder
                        </button>
                        <button onClick={openProject} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                            <FolderOpen className="h-5 w-5 mr-2" /> Ouvrir
                        </button>
                    </div>
                </div>
                <div id="tutorial-tab-bar" className="flex bg-white rounded-xl shadow-md overflow-hidden">
                    <button onClick={() => setActiveTab('info')} className={getTabClasses('info')}><Settings className="h-5 w-5 mr-2" /> Paramètres</button>
                    <button id="tab-ingredients" onClick={() => setActiveTab('ingredients')} className={getTabClasses('ingredients')}><ShoppingCart className="h-5 w-5 mr-2" /> Ingrédients</button>
                    <button id="tab-labor" onClick={() => setActiveTab('labor')} className={getTabClasses('labor')}><Users className="h-5 w-5 mr-2" /> Main-d'œuvre</button>
                    <button id="tab-recipe" onClick={() => setActiveTab('recipe')} className={getTabClasses('recipe')}><ChefHat className="h-5 w-5 mr-2" /> Recette & Calcul</button>
                    <button id="tab-summary" onClick={() => setActiveTab('summary')} className={getTabClasses('summary')}><Table className="h-5 w-5 mr-2" /> Résumé</button>
                    <button id="tab-tracking" onClick={() => setActiveTab('tracking')} className={getTabClasses('tracking')}><TrendingUp className="h-5 w-5 mr-2" /> Suivi</button>
                </div>
            </div>
        );

        // Données et setters du projet, exposés via ProjectContext pour éviter de les faire
        // descendre manuellement à travers chaque onglet. Seul l'état UI local à un onglet
        // (pagination, accordéons ouverts...) continue de transiter par les props ci-dessous.
        // Mémoïsé : tous les setters/handlers ici sont stables (voir plus haut), donc cet objet
        // ne change de référence que lorsque les données qu'il transporte changent réellement —
        // sans quoi les 6 onglets se re-rendraient à chaque rendu de App, quelle qu'en soit la cause.
        const projectContextValue = useMemo(() => ({
            companyName, onUpdateCompanyName: setCompanyName,
            logoUrl, onUpdateLogoUrl: setLogoUrl,
            generalInfo: calculatedGeneralInfo, onUpdateGeneralInfo: handleUpdateGeneralInfo,
            products, onUpdateProducts: setProducts,
            baseIngredients, onUpdateIngredientsList: setBaseIngredients, ingredientsList,
            laborDatabase, onUpdateLaborDatabase: setLaborDatabase,
            trackingPoints, setTrackingPoints,
            analysisData,
            showNotification, setNotification,
        }), [
            companyName, setCompanyName, logoUrl, setLogoUrl,
            calculatedGeneralInfo, handleUpdateGeneralInfo,
            products, setProducts, baseIngredients, setBaseIngredients, ingredientsList,
            laborDatabase, setLaborDatabase, trackingPoints, setTrackingPoints,
            analysisData, showNotification, setNotification,
        ]);

        const renderActiveTab = () => {

            switch (activeTab) {
                case 'info': return <ProductInfo onNewProduct={handleAddNewProduct} onDeleteProduct={handleDeleteProduct} onDuplicateProduct={handleDuplicateProduct} handleProductValueChange={handleProductValueChange} itemsPerPage={uiSettings.infoItemsPerPage} onItemsPerPageChange={(value) => handleUiSettingsChange('infoItemsPerPage', value)} onOpenPosImport={() => setIsPosWizardOpen(true)} />;

                case 'ingredients':
                    return <IngredientsTab
                        itemsPerPage={uiSettings.ingredientsItemsPerPage}
                        onItemsPerPageChange={(value) => handleUiSettingsChange('ingredientsItemsPerPage', value)}
                    />;

                case 'labor': return <LaborDatabaseTab openPostIds={openPostIds} setOpenPostIds={setOpenPostIds} />;
                case 'recipe': return <RecipeCalculator editingProductIndex={editingProductIndex} onSelectProduct={setEditingProductIndex} openRecipeSections={openRecipeSections} setOpenRecipeSections={setOpenRecipeSections} />;

                case 'summary':
                    return <SummaryTable
                        onEditProduct={editProduct}
                        onOpenPdfModal={openPdfModal}
                        exportToExcel={exportToExcel}
                        itemsPerPage={uiSettings.summaryItemsPerPage}
                        onItemsPerPageChange={(value) => handleUiSettingsChange('summaryItemsPerPage', value)}
                    />;

                case 'tracking': return <TrackingTab />;
                default: return null;
            }
        }

        return (
            <ProjectContext.Provider value={projectContextValue}>
                <style>{`
        /* Styles pour les animations */
        @keyframes new-row-anim {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .new-row {
            animation: new-row-anim 0.5s ease-out forwards;
        }
        @keyframes flash {
            0% { background-color: rgba(59, 130, 246, 0); } /* blue-500 transparent */
            50% { background-color: rgba(59, 130, 246, 0.2); } /* blue-500 with opacity */
            100% { background-color: rgba(59, 130, 246, 0); }
        }
        .animate-flash {
            animation: flash 0.7s ease-out;
        }

        /* Styles existants */
        input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
                -webkit-appearance: none; 
                margin: 0; 
            }
            input[type=number] { -moz-appearance: textfield; }
            @keyframes fade-in-down {
                0% {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .animate-fade-in-down {
                animation: fade-in-down 0.5s ease-out forwards;
            }
        `}</style>
                <div className="bg-gray-100 min-h-screen p-4 flex flex-col items-center">
                    {notification && notification.message && (
                        <Notification
                            message={notification.message}
                            type={notification.type}
                            onClose={notification.onClose}
                            onUndo={notification.onUndo}
                        />
                    )}
                    <ConfirmationModal 
                        isOpen={showResetConfirm}
                        onClose={() => setShowResetConfirm(false)}
                        onConfirm={handleConfirmReset}
                        title="Réinitialiser le projet"
                    >
                        Êtes-vous sûr de vouloir effacer toutes les données et commencer un nouveau projet ? Cette action est irréversible.
                    </ConfirmationModal>

                    <ConfirmationModal 
                        isOpen={showLoadExampleConfirm}
                        onClose={() => setShowLoadExampleConfirm(false)}
                        onConfirm={handleConfirmLoadExample}
                        title="Charger un projet d'exemple"
                    >
                        Le projet actuel sera remplacé par les données d'exemple. Voulez-vous continuer ?
                    </ConfirmationModal>
                    
                    <OnboardingModal
                        isOpen={showOnboardingModal}
                        onStart={handleStartTutorial}
                        onSkip={handleSkipTutorial}
                    />
                    <TutorialGuide
                        run={runTutorial}
                        stepIndex={tutorialStep}
                        onStepChange={handleStepChange}
                        onEnd={handleEndTutorial}
                        setActiveTab={setActiveTab}
                        activeTab={activeTab}
                    />

                    <InstructionModal 
                        isOpen={showInstructions} 
                        onClose={() => setShowInstructions(false)}
                        onLoadExample={handleLoadExampleClick}
                    />

                    <PdfOptionsModal
                        isOpen={isPdfModalOpen}
                        onClose={() => setIsPdfModalOpen(false)}
                        onConfirm={handleConfirmPdfGeneration}
                        initialData={pdfOptions}
                    />

                    <PosImportWizardModal
                        isOpen={isPosWizardOpen}
                        onClose={() => setIsPosWizardOpen(false)}
                        onImportComplete={handlePosImport}
                        products={products}
                    />

                    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
                    
                    {!isProjectLoaded ? (
                        <WelcomeModal 
                            onNew={() => {
                                handleConfirmReset();
                                showNotification({ message: "Nouveau projet créé.", type: 'success' });
                            }}
                            onOpen={openProject}
                            onExample={() => {
                                handleConfirmLoadExample();
                            }}
                        />
                    ) : (
                        <>
                            {renderContent()}
                            {renderActiveTab()}
                            <footer className="w-full text-center py-4 mt-8 text-gray-500 text-sm">
                                <p>© {new Date().getFullYear()} Antoine Thibault-Lepage. Tous droits réservés.</p>
                            </footer>
                        </>
                    )}
                </div>
                <div id="tooltip-root"></div>
            </ProjectContext.Provider>
        );
    };

export default App;
