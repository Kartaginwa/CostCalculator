import React, { useState, useReducer, useRef, useMemo, useCallback, useEffect } from 'react';
import {
    Users, ChefHat, Table, Info, ShoppingCart, Save, FolderOpen,
    PlusCircle, TrendingUp, Settings,
} from 'lucide-react';

import {
    formatCurrency, formatPercent, parseLocaleNumber, formatSecondsToTime,
    CONVERSION_FACTORS, MAJOR_ALLERGENS,
} from './utils.jsx';
import { calculateCosts } from './engine/calculateCosts.js';
import { computeAnalysisData } from './engine/analysisData.js';
import { getDefaultState, getEmptyState, indirectCostMethodLabels, periodTranslations } from './state/initialState.js';
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
    const ingredientsList = useMemo(() => {
        const recipeIngredients = products
            .filter(p => p.isIngredient && p.platName)
            .map(p => {
                const costs = calculateCosts(p, calculatedGeneralInfo, baseIngredients, products, laborDatabase);
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
    }, [products, baseIngredients, calculatedGeneralInfo, laborDatabase]);
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

    // --- MOTEUR DE DONNÉES CENTRALISÉ ET MÉMORISÉ ---
    // // modify this part : transformation de la fonction en valeur mémorisée
    const analysisData = useMemo(
        () => computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo),
        [products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo]
    );


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

    // --- NOUVELLES FONCTIONS DE PRÉPARATION DES DONNÉES POUR LE PDF ---
    const getGlobalKpiDataForPdf = (trackingPoints) => {
        return trackingPoints.map(point => {
            const activeProducts = point.productsWithCosts.filter(p => p.onMenu);
            const totalSalesMix = activeProducts.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);
            
            if (totalSalesMix === 0) {
                return { name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note, "Marge Brute Moyenne": 0, "Coût Matière Moyen": 0, "Coût M-O Moyen": 0 };
            }

            const weightedGrossMargin = activeProducts.reduce((sum, p) => sum + (p.costs.margeBrutePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedMaterialCost = activeProducts.reduce((sum, p) => sum + (p.costs.costMatierePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedLaborCost = activeProducts.reduce((sum, p) => sum + (p.costs.costLaborPercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);

            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Marge Brute Moyenne": weightedGrossMargin * 100,
                "Coût Matière Moyen": weightedMaterialCost * 100,
                "Coût M-O Moyen": weightedLaborCost * 100,
            };
        });
    };
    
    const getProductKpiDataForPdf = (trackingPoints, productId) => {
        if (!productId) return [];
        return trackingPoints.map(point => {
            const productData = point.productsWithCosts.find(p => String(p.id) === String(productId));
            if (!productData) {
                return { name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note, "Coût matière (%)": null, "Coût main-d'oeuvre (%)": null, "Coût frais indirects (%)": null, "Marge nette (%)": null };
            }
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Coût matière (%)": productData.costs.costMatierePercent * 100,
                "Coût main-d'oeuvre (%)": productData.costs.costLaborPercent * 100,
                "Coût frais indirects (%)": productData.costs.costIndirectPercent * 100,
                "Marge nette (%)": productData.costs.margeNettePercent * 100,
            };
        });
    };

    // --- GÉNÉRATION DU RAPPORT PDF (LAYOUT ORIGINAL + CALCULS CENTRALISÉS) ---
    // // you should modify this part : remplacez l'ancienne fonction generatePdf par ce bloc complet
    const generatePdf = (options) => {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            showNotification({ message: "La bibliothèque PDF n'a pas pu être chargée. L'exportation est impossible.", type: 'error' });
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 0; // Nous utiliserons cette variable pour suivre la position verticale sur la page

            // Définition d'un thème de couleurs pour le rapport
            const themeColors = {
                primary: '#2563EB',   // Bleu
                secondary: '#4B5563',  // Gris foncé
                darkText: '#1F2937',   // Texte presque noir
                lightText: '#F9FAFB',  // Texte blanc cassé
                green: '#10B981',      // Vert
                yellow: '#F59E0B',     // Jaune
                purple: '#8B5CF6',    // Mauve
                gray: '#6B7280',       // Gris moyen
                red: '#EF4444',        // Rouge
            };

                // --- FONCTIONS UTILITAIRES POUR LE PDF ---

            const addPageHeader = (title) => {
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(companyName, 14, 20);

                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.gray);
                doc.text(title, 14, 28);
                
                if (logoUrl) {
                    try {
                        doc.addImage(logoUrl, 'PNG', pageWidth - 54, 15, 40, 15, undefined, 'FAST');
                    } catch(e) { console.error("Erreur d'image du logo pour le PDF:", e); }
                }
                doc.setDrawColor(themeColors.primary);
                doc.line(14, 35, pageWidth - 14, 35);
            };

            const addFooter = () => {
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    // Ne pas mettre de pied de page sur la page de garde
                    if (i === 1) continue;
                    
                    doc.setFontSize(8);
                    doc.setTextColor(themeColors.gray);
                    doc.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
                    doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, pageHeight - 7);
                }
            };

            const drawPdfLineChart = (doc, { title, data, lines, x, y, width, height }) => {
                if (!data || data.length < 2) {
                    doc.setFontSize(10);
                    doc.setTextColor(themeColors.gray);
                    doc.text("Données insuffisantes pour afficher une évolution.", x + width / 2, y + height / 2, { align: 'center' });
                    return y + height;
                }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text(title, x, y);
                y += 5;

                const padding = { top: 10, right: 10, bottom: 30, left: 20 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;
                const chartOriginX = x + padding.left;
                const chartOriginY = y + padding.top;

                const validLines = lines.filter(line => data.some(d => d[line.dataKey] !== null && d[line.dataKey] !== undefined));
                const allValues = data.flatMap(d => validLines.map(line => d[line.dataKey])).filter(v => v !== null && v !== undefined);
                const yMin = Math.min(0, ...allValues);
                const yMax = Math.max(...allValues) * 1.1 || 10;

                const xScale = (index) => chartOriginX + (index / (data.length - 1)) * chartWidth;
                const yScale = (value) => chartOriginY + chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

                // Axes and Grid
                doc.setDrawColor(themeColors.gray);
                doc.setLineWidth(0.2);
                doc.line(chartOriginX, chartOriginY, chartOriginX, chartOriginY + chartHeight);
                doc.line(chartOriginX, chartOriginY + chartHeight, chartOriginX + chartWidth, chartOriginY + chartHeight);

                doc.setFontSize(8);
                doc.setTextColor(themeColors.gray);
                for (let i = 0; i <= 5; i++) {
                    const value = yMin + (i / 5) * (yMax - yMin);
                    const yPosTick = yScale(value);
                    doc.setDrawColor(229, 231, 235); // light gray for grid
                    doc.line(chartOriginX, yPosTick, chartOriginX + chartWidth, yPosTick);
                    doc.setDrawColor(themeColors.gray);
                    doc.text(value.toFixed(0), chartOriginX - 4, yPosTick + 2, { align: 'right' });
                }

                data.forEach((d, i) => {
                    const xPos = xScale(i);
                    doc.text(d.label.substring(0,15), xPos, chartOriginY + chartHeight + 5, { align: 'center', angle: -45 });
                });

                // Lines and Dots
                validLines.forEach(line => {
                    const hexToRgb = (hex) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
                    }
                    const rgb = hexToRgb(line.color);
                    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
                    doc.setLineWidth(0.5);
                    const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d[line.dataKey]), value: d[line.dataKey] }))
                        .filter(p => p.value !== null && p.value !== undefined);
                    
                    for (let i = 0; i < points.length - 1; i++) {
                        doc.line(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
                    }
                    
                    points.forEach(p => {
                        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                        doc.circle(p.x, p.y, 1.5, 'F');
                    });
                });

                // Legend
                let legendX = x;
                let legendY = y + height + 5;
                doc.setFontSize(9);
                validLines.forEach(line => {
                    const hexToRgb = (hex) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
                    }
                    const rgb = hexToRgb(line.color);
                    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                    doc.rect(legendX, legendY - 2.5, 3, 3, 'F');
                    doc.setTextColor(themeColors.darkText);
                    const label = line.dataKey;
                    doc.text(label, legendX + 5, legendY);
                    legendX += doc.getTextWidth(label) + 15;
                    if (legendX > x + width - 30) {
                        legendX = x;
                        legendY += 6;
                    }
                });

                return legendY + 5;
            };

            const { 
                productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin, 
                globalBreakEven, weightedMaterialCost, weightedLaborCost, contributionData, 
                menuEngineeringData, purchasingReportData, abcAnalysisData, productivityReport 
            } = analysisData;

            // --- PARTIE 1 : PAGE DE GARDE ---
            
            // Cadre de la page
            doc.setDrawColor(themeColors.gray);
            doc.setLineWidth(0.5);
            doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

            // Logo de l'application au centre
            let logoY = 80;
            if (appLogoBase64 && appLogoDimensions.width > 0) {
                const maxWidth = 120;
                const maxHeight = 120;
                const logoRatio = appLogoDimensions.width / appLogoDimensions.height;
                
                let logoWidth = maxWidth;
                let logoHeight = maxWidth / logoRatio;

                if (logoHeight > maxHeight) {
                    logoHeight = maxHeight;
                    logoWidth = maxHeight * logoRatio;
                }

                const logoX = (pageWidth - logoWidth) / 2;
                doc.addImage(appLogoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
                logoY += logoHeight;
            } else {
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text('Resto Calculateur', pageWidth / 2, 115, { align: 'center' });
                logoY = 130;
            }
            
            // Titres
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.darkText);
            const titleLines = doc.splitTextToSize(options.title, pageWidth - 80); // Split title if too long
            doc.text(titleLines, pageWidth / 2, logoY + 30, { align: 'center' });
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(themeColors.secondary);
            const subtitleLines = doc.splitTextToSize(options.subtitle, pageWidth - 80);
            doc.text(subtitleLines, pageWidth / 2, 205, { align: 'center' });
            
            // Date de génération en bas de page
            doc.setFontSize(12);
            doc.setTextColor(themeColors.gray);
            doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, pageHeight - 30, { align: 'center' });

    // --- PAGE 2 : TABLEAU DE BORD STRATÉGIQUE ---
            doc.addPage();
            addPageHeader("Tableau de bord");
            yPos = 45; // Réinitialise la position Y pour la nouvelle page

            // Section 1: Paramètres Généraux
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Paramètres Généraux", 14, yPos);
            yPos += 6;


            // Corps du tableau mis à jour avec toutes les informations
            
            const paramsBody = [
                [
                    'Période:', `${periodTranslations[calculatedGeneralInfo.period] || 'N/A'} ${calculatedGeneralInfo.period === 'custom' ? `(${calculatedGeneralInfo.startDate} au ${calculatedGeneralInfo.endDate})` : ''}`,
                    'Frais Indirects:', `${formatCurrency(calculatedGeneralInfo.totalIndirects)} $`
                ],
                [ 
                    'Revenus Totaux:', `${formatCurrency(calculatedGeneralInfo.totalRevenue)} $`,
                    'Heures d\'opération:', `${calculatedGeneralInfo.operationHours} h`
                ],
                [
                    'Coût M-O Cuisine:', `${formatCurrency(calculatedGeneralInfo.totalKitchenLaborCost)} $`,
                    'Coût horaire op.:', `${formatCurrency(calculatedGeneralInfo.operationCostPerHour)} $/h`
                ]
            ];
            doc.autoTable({
                startY: yPos,
                body: paramsBody,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });

            yPos = doc.lastAutoTable.finalY + 10;

            // Section 2: Indicateurs Clés de Performance (KPIs) Globaux
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Indicateurs Clés de Performance (KPIs) Globaux", 14, yPos);
            yPos += 8;

            const kpiBody = [
                [ 'Coût Matière Moyen Pondéré:', `${formatPercent(weightedMaterialCost)} %`, 'Marge Brute Moyenne Pondérée:', `${formatPercent(weightedGrossMargin)} %`],
                [ 'Coût Main-d\'œuvre Moyen Pondéré:', `${formatPercent(weightedLaborCost)} %`, 'Point Mort du Menu:', `${formatCurrency(globalBreakEven)} $`]
            ];
            doc.autoTable({
                startY: yPos,
                body: kpiBody,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });
            yPos = doc.lastAutoTable.finalY + 10;
            
            // Section 3: Classement par Contribution Totale au Profit
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Classement par Contribution Totale au Profit", 14, yPos);
            yPos += 6;

            const topContributors = contributionData.slice(0, 5); // Limite aux 5 premiers pour le PDF
            const contributionBody = topContributors.map(item => [item.name, `${formatCurrency(item.totalContribution)} $`]);
            doc.autoTable({
                startY: yPos,
                head: [['Plat', 'Contribution ($)']],
                body: contributionBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.green, fontStyle: 'bold' },
                styles: { fontSize: 9 },
                columnStyles: { 1: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 4: Matrice d'Analyse Stratégique (Menu Engineering)
            const startX = 14;
            const gap = 5;
            const quadrantWidth = (pageWidth - (startX * 2) - gap) / 2;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Analyse Stratégique du Menu", 14, yPos);
            yPos += 8;

            const drawQuadrant = (data) => {
                const padding = 4;
                let textY = data.y + padding;
                let contentHeight = padding * 2;
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                const titleLines = doc.splitTextToSize(data.title, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(titleLines).h;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                const descLines = doc.splitTextToSize(data.description, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(descLines).h + 2;
                
                const itemList = data.items.length > 0 ? data.items.map(item => `• ${item.platName}`).join('\n') : '• Aucun';
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const itemLines = doc.splitTextToSize(itemList, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(itemLines).h + 2;

                // Si c'est un "dryRun", on retourne seulement la hauteur calculée
                if (data.dryRun) {
                    return contentHeight;
                }

                // Sinon, on dessine comme avant
                doc.setFillColor(...data.fillColor);
                doc.setDrawColor(...data.borderColor);
                doc.setLineWidth(0.3);
                doc.roundedRect(data.x, data.y, quadrantWidth, contentHeight, 3, 3, 'FD');
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(titleLines, data.x + padding, textY, { baseline: 'top' });
                textY += doc.getTextDimensions(titleLines).h + 2;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(themeColors.secondary);
                doc.text(descLines, data.x + padding, textY, { baseline: 'top' });
                textY += doc.getTextDimensions(descLines).h + 4;
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.darkText);
                doc.text(itemLines, data.x + padding, textY, { baseline: 'top' });
                
                return contentHeight;
            };
            
            const quadrants = [
                { title: 'Étoiles', items: menuEngineeringData.stars, description: 'Très populaires et très rentables. Mettez-les en avant !', fillColor: [219, 239, 255], borderColor: [147, 197, 253] },
                { title: 'Dilemmes', items: menuEngineeringData.questions, description: 'Rentables mais peu populaires. Envisagez de les promouvoir.', fillColor: [254, 243, 226], borderColor: [253, 224, 71] },
                { title: 'Vaches à Lait', items: menuEngineeringData.cows, description: 'Très populaires mais peu rentables. Optimisez leurs coûts.', fillColor: [243, 244, 246], borderColor: [209, 213, 219] },
                { title: 'Poids Morts', items: menuEngineeringData.dogs, description: 'Peu populaires et peu rentables. Pensez à les retirer.', fillColor: [254, 226, 226], borderColor: [252, 165, 165] },
            ];
            
            // Logique améliorée pour dessiner les quadrants en gérant les sauts de page
            let currentX = startX;
            let rowMaxHeight = 0;

            quadrants.forEach((quadrant, index) => {
                // Calcule la hauteur du quadrant avant de le dessiner
                const quadrantHeight = drawQuadrant({ ...quadrant, x: currentX, y: yPos, dryRun: true });

                // Vérifie s'il y a assez de place sur la page
                if (yPos + quadrantHeight > pageHeight - 20) {
                    doc.addPage();
                    addPageHeader("Tableau de bord (suite)");
                    yPos = 45; // Réinitialise yPos pour la nouvelle page
                    rowMaxHeight = 0; // Réinitialise la hauteur de la rangée
                    currentX = startX; // Revient à la première colonne
                }
                
                // Dessine réellement le quadrant
                const actualHeight = drawQuadrant({ ...quadrant, x: currentX, y: yPos });
                rowMaxHeight = Math.max(rowMaxHeight, actualHeight);
                
                // Passe à la colonne suivante ou à la ligne suivante
                if ((index + 1) % 2 === 0) { // Après chaque 2ème quadrant
                    yPos += rowMaxHeight + gap;
                    currentX = startX;
                    rowMaxHeight = 0;
                } else {
                    currentX += quadrantWidth + gap;
                }
            });

// --- PAGE 3 : TABLEAU DE BORD (SUITE) ---
            doc.addPage();
            addPageHeader("Tableau de bord (suite)");
            yPos = 45; // Réinitialise la position Y pour la nouvelle page

            // Préparation des données spécifiques à cette page

            // Section 1: Analyse ABC des Ingrédients
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Analyse ABC des Ingrédients", 14, yPos);
            yPos += 8;
            
            const categoryCItems = abcAnalysisData.C.map(i => i.name);
            let categoryCText = categoryCItems.slice(0, 8).join('\n') || 'Aucun';
            if (categoryCItems.length > 8) {
                categoryCText += `\n...et ${categoryCItems.length - 8} autre(s)`;
            }

            const abcBody = [[
                { content: 'Catégorie A (70% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#FEE2E2' } },
                { content: 'Catégorie B (20% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#FEF3C7' } },
                { content: 'Catégorie C (10% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#D1FAE5' } }
            ],[
                abcAnalysisData.A.map(i => i.name).join('\n') || 'Aucun',
                abcAnalysisData.B.map(i => i.name).join('\n') || 'Aucun',
                categoryCText
            ]];
            
            doc.autoTable({
                startY: yPos,
                body: abcBody,
                theme: 'grid',
                styles: { fontSize: 8, valign: 'top' },
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 2: Synthèse du Rapport d'Achats
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Synthèse du Rapport d'Achats", 14, yPos);
            yPos += 8;
            
            doc.autoTable({
                startY: yPos,
                theme: 'plain',
                styles: { halign: 'center' },
                tableWidth: pageWidth - 28,
                body: [[
                    { content: `Coût Net Total (Production)\n${formatCurrency(purchasingReportData.totalNetCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.primary } },
                    { content: `Coût Total des Pertes\n${formatCurrency(purchasingReportData.totalLossCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.red } },
                    { content: `Coût d'Achat Total Requis\n${formatCurrency(purchasingReportData.totalPurchaseCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.darkText } }
                ]]
            });
            yPos = doc.lastAutoTable.finalY + 10;
            
            // Section 3: Rapport de Productivité
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Rapport de Productivité pour la Période", 14, yPos);
            yPos += 8;
            
            const productivityBody = productivityReport.rows.map(row => [
                row.postName,
                `${row.expected.toFixed(2)} h`,
                `${row.actual.toFixed(2)} h`,
                `${row.difference.toFixed(2)} h`,
                `${row.utilization.toFixed(2)} %`
            ]);
            doc.autoTable({
                startY: yPos,
                head: [['Poste', 'Heures Attendues', 'Heures Réelles', 'Différence (h)', 'Taux d\'Utilisation (%)']],
                body: productivityBody,
                theme: 'grid',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8 },
                foot: [[
                    { content: 'Total', styles: { fontStyle: 'bold' } },
                    `${productivityReport.totals.expected.toFixed(2)} h`,
                    `${productivityReport.totals.actual.toFixed(2)} h`,
                    `${productivityReport.totals.difference.toFixed(2)} h`,
                    `${productivityReport.totals.utilization.toFixed(2)} %`
                ]],
                footStyles: { fillColor: '#A9A9A9', fontStyle: 'bold' }
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 4: Suivi des Performances (anciennement Page 4)
            if (trackingPoints && trackingPoints.length > 1) {
                // Vérifie s'il y a assez de place pour le graphique, sinon sauter à la page suivante
                if (yPos + 100 > pageHeight - 20) {
                    doc.addPage();
                    addPageHeader("Tableau de bord (suite)");
                    yPos = 45;
                }
                const globalKpiData = getGlobalKpiDataForPdf(trackingPoints);
                yPos = drawPdfLineChart(doc, {
                    title: "Évolution des Indicateurs Globaux",
                    data: globalKpiData,
                    lines: [
                        { dataKey: "Marge Brute Moyenne", color: "#10B981" },
                        { dataKey: "Coût Matière Moyen", color: "#F59E0B" },
                        { dataKey: "Coût M-O Moyen", color: "#EF4444" },
                    ],
                    x: 14,
                    y: yPos,
                    width: pageWidth - 28,
                    height: 85
                });
            }

    // --- PARTIE 2 : ANALYSE DÉTAILLÉE PAR PRODUIT ---
            
            // Page 5: Page de Titre pour la Section
            doc.addPage();
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.darkText);
            doc.text("Analyse Détaillée par Produit", pageWidth / 2, pageHeight / 2, { align: 'center' });

            // Pages 6 et suivantes: Boucle sur chaque produit
            productsWithCosts.forEach((product) => {
                const costs = product.costs; // Les coûts sont déjà calculés dans productsWithCosts
                const productivityFactor = (calculatedGeneralInfo.kitchenProductivity > 0 && calculatedGeneralInfo.kitchenProductivity <= 100) ? calculatedGeneralInfo.kitchenProductivity / 100 : 1;
                
                // --- Page A : Fiche de Coût et Indicateurs Clés ---
                doc.addPage();
                addPageHeader(`Fiche de Coût - ${product.platName}`);
                yPos = 45;
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Paramètres", 14, yPos);
                yPos += 8;

                // Section 0: Paramètres du Plat
                const recipeAllergens = (() => {
                    if (product.isResaleProduct) return product.manualAllergens || [];
                    const allergens = new Set();
                    (product.ingredients || []).forEach(item => {
                        const baseIngredient = ingredientsList.find(ing => ing.id === item.id);
                        if (baseIngredient && baseIngredient.allergens) {
                            baseIngredient.allergens.forEach(allergen => allergens.add(allergen));
                        }
                    });
                    return Array.from(allergens);
                })();
                const allergenText = recipeAllergens.length > 0 ? recipeAllergens.map(key => MAJOR_ALLERGENS.find(a => a.key === key)?.name || key).join(', ') : 'Aucun';

                doc.autoTable({
                    startY: yPos,
                    theme: 'plain',
                    styles: { fontSize: 9 },
                    body: [
                        [
                            `Prix de Vente: ${formatCurrency(parseLocaleNumber(product.prixVente))} $`,
                            `Nombre de Portions: ${product.nbPortions}`,
                            `Format par Portion: ${product.portionSize || 1} ${product.portionUnit || 'unité'}`
                        ],
                        [
                            `Statut: ${product.isIngredient ? 'Sous-recette' : product.isResaleProduct ? 'Produit de revente' : 'Plat principal'}`,
                            { content: `Allergènes: ${allergenText}`, colSpan: 2 }
                        ]
                    ]
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Section 1: Détail du Coût des Matières Premières
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Détail du Coût des Matières Premières", 14, yPos);
                yPos += 8;
                
                doc.autoTable({
                    startY: yPos,
                    head: [['Ingrédient', 'Qté', 'Unité', 'Coût Base ($)', 'Coût Perte ($)', 'Rendement (%)', 'Coût Total ($)']],
                    body: (product.ingredients || []).map(i => {
                        const baseIngredient = ingredientsList.find(ing => ing.id === i.id);
                        if (!baseIngredient) return [i.name || 'N/A', '', '', '', '', '', ''];
                        const recipeUnit = i.recipeUnit || baseIngredient.unit;
                        const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[baseIngredient.unit]?.factor || 1);
                        const quantityInBaseUnit = parseLocaleNumber(i.quantity) * conversionFactor;
                        const baseCost = quantityInBaseUnit * parseLocaleNumber(baseIngredient.unitPrice);
                        const lossPercentage = (parseLocaleNumber(baseIngredient.lossPercentage) || 0) / 100;
                        const lossCost = lossPercentage > 0 && lossPercentage < 1 ? (baseCost / (1 - lossPercentage)) - baseCost : 0;
                        const yieldPercent = parseLocaleNumber(i.yieldPercentage) || 100;
                        const finalCost = (yieldPercent > 0 ? baseCost / (yieldPercent / 100) : baseCost) + lossCost;
                        return [
                            baseIngredient.name, i.quantity, recipeUnit,
                            formatCurrency(baseCost), formatCurrency(lossCost), `${yieldPercent} %`, formatCurrency(finalCost)
                        ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: themeColors.green, fontStyle: 'bold', fontSize: 8 },
                    styles: { fontSize: 8, halign: 'right' },
                    columnStyles: { 0: { halign: 'left' }, 2: { halign: 'left' } },
                    foot: [[
                        { content: `Totaux: Base ${formatCurrency(costs.totalBaseIngredientsCost)}$ | Perte ${formatCurrency(costs.totalLossCost)}$`, colSpan: 6, styles: { halign: 'right', fontStyle: 'normal' } }, 
                        { content: `${formatCurrency(costs.totalIngredientsCost)} $`, styles: { fontStyle: 'bold' } }
                    ]],
                    footStyles: { fillColor: '#D1FAE5', textColor: themeColors.darkText }
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Section 2: Détail du Coût de Main-d'œuvre
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Détail du Coût de Main-d'œuvre", 14, yPos);
                yPos += 8;

                doc.autoTable({
                    startY: yPos,
                    head: [['Étape', 'Personnel', 'Durée', 'Coût Direct ($)', 'Coût Indirect ($)', 'Coût Total ($)']],
                    body: (product.productionSteps || []).map(step => {
                        let stepDirectCost = 0;
                        const personnelSummary = (step.personnel || []).reduce((acc, person) => {
                            const postData = laborDatabase.find(p => p.postName === person.postId);
                            if (postData && postData.employees.length > 0) {
                                const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                                const totalPostCost = postData.employees.reduce((sum, emp) => {
                                    const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                                    return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                                }, 0);
                                const weightedAverageCost = totalHours > 0 ? totalPostCost / totalHours : 0;
                                stepDirectCost += (parseLocaleNumber(step.duration) / 3600) * weightedAverageCost;
                            }
                            acc[person.postId] = (acc[person.postId] || 0) + 1;
                            return acc;
                        }, {});
                        const stepTotalCost = stepDirectCost / productivityFactor;
                        const stepIndirectCost = stepTotalCost - stepDirectCost;
                        const personnelText = Object.entries(personnelSummary).map(([post, count]) => `${count}x ${post}`).join(', ');

                        return [ step.stepName, personnelText, formatSecondsToTime(step.duration), formatCurrency(stepDirectCost), formatCurrency(stepIndirectCost), formatCurrency(stepTotalCost) ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: themeColors.yellow, textColor: themeColors.darkText, fontStyle: 'bold', fontSize: 8 },
                    styles: { fontSize: 8, halign: 'right' },
                    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
                    foot: [[
                        { content: `Totaux: Direct ${formatCurrency(costs.totalDirectLaborCost)}$ | Indirect ${formatCurrency(costs.totalLaborCost - costs.totalDirectLaborCost)}$`, colSpan: 5, styles: { halign: 'right', fontStyle: 'normal' } },
                        { content: `${formatCurrency(costs.totalLaborCost)} $`, styles: { fontStyle: 'bold' } }
                    ]],
                    footStyles: { fillColor: '#FEF3C7', textColor: themeColors.darkText }
                });
                yPos = doc.lastAutoTable.finalY + 10;
                
                // Section 3: Frais Indirects
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Frais Indirects", 14, yPos);
                yPos += 8;
                
                const indirectsBody = [[
                    `Méthode d'attribution: ${indirectCostMethodLabels[product.indirectCosts.method] || 'N/A'}`,
                    `Montant par portion: ${formatCurrency(costs.costIndirectPerPortion)} $`
                ]];
                doc.autoTable({
                    startY: yPos,
                    body: indirectsBody,
                    theme: 'plain',
                    styles: { fontSize: 9, fontStyle: 'bold' },
                    columnStyles: { 1: { halign: 'right' } }
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Sections 4 & 5 côte à côte
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Indicateurs Clés (KPIs)", 14, yPos);
                const tableStartY = yPos + 8; // Ajoute un espace après le titre
                const rightStartY = tableStartY; // Aligne la section de droite avec le début des tables
                const tableWidth = (pageWidth - 38) / 2;


                // Section 4: Synthèse des Indicateurs Clés (KPIs)
                const kpiProductBody = [
                    ['Prix de Vente', `${formatCurrency(parseLocaleNumber(product.prixVente))} $`],
                    ['Ratio Coût Matière', `${formatPercent(costs.costMatierePercent)} %`],
                    ['Ratio Coût Main-d\'œuvre', `${formatPercent(costs.costLaborPercent)} %`],
                    ['Coût de Revient par Portion', `${formatCurrency(costs.totalCostPerPortion)} $`],
                    ['Marge Brute par Portion', `${formatCurrency(costs.margeBruteDollar)} $ (${formatPercent(costs.margeBrutePercent)} %)`],
                    ['Marge Nette par Portion', `${formatCurrency(costs.margeNetteDollar)} $ (${formatPercent(costs.margeNettePercent)} %)`],
                ];

                 doc.autoTable({
                    startY: tableStartY,
                    head: [['Indicateur', 'Valeur']],
                    body: kpiProductBody,
                    theme: 'striped',
                    headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold' },
                    columnStyles: { 
                        0: { fontStyle: 'bold' },
                        1: { halign: 'right' }
                    },
                    styles: { fontSize: 9 },
                    tableWidth: tableWidth,
                    margin: { left: 14 }
                });

                // Section 5: Point Mort et Classification
                const breakEvenInfo = (() => {
                    if (costs.margeBruteDollar <= 0) return { title: "Point Mort", value: "N/A", description: "Marge brute négative." };
                    const salesMixPercent = parseLocaleNumber(product.salesMix) / 100;
                    if (['fixed', 'percentSales', 'percentDirect'].includes(product.indirectCosts.method)) return { title: "Rentabilité", value: `${formatCurrency(costs.margeNetteDollar)}`, description: `Rentable si marge nette positive.` };
                    if (salesMixPercent <= 0) return { title: "Point Mort", value: "N/A", description: "Mix des ventes nul." };
                    const allocatedIndirects = calculatedGeneralInfo.totalIndirects * salesMixPercent;
                    const breakEvenUnits = Math.ceil(allocatedIndirects / costs.margeBruteDollar);
                    return { title: "Point Mort du Produit", value: `${breakEvenUnits} unités`, description: "Unités à vendre pour couvrir la part des frais indirects allouée." };
                })();
                
                const classificationRaw = Object.keys(menuEngineeringData).find(key => menuEngineeringData[key].some(p => p.id === product.id)) || 'N/A';
                const classificationTranslations = {
                    stars: 'Étoile',
                    questions: 'Dilemme',
                    cows: 'Vache à lait',
                    dogs: 'Poids mort'
                };
                const classification = classificationTranslations[classificationRaw] || classificationRaw;
                
                let currentRightY = rightStartY;
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(breakEvenInfo.title, pageWidth / 2 + 5, tableStartY);
                currentRightY = tableStartY + 10;
                
                doc.setFontSize(20);
                doc.text(breakEvenInfo.value, pageWidth / 2 + 5, currentRightY);
                currentRightY += 8;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.gray);
                const descLines = doc.splitTextToSize(breakEvenInfo.description, tableWidth);
                doc.text(descLines, pageWidth / 2 + 5, currentRightY);
                currentRightY += doc.getTextDimensions(descLines).h + 8;
                
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text("Classification", pageWidth / 2 + 5, currentRightY);
                currentRightY += 10;

                doc.setFontSize(20);
                doc.text(classification, pageWidth / 2 + 5, currentRightY);

                // --- Page B : Analyse Visuelle et Opérationnelle ---
                doc.addPage();
                addPageHeader(`Analyse Visuelle - ${product.platName}`);
                yPos = 45;

                // Section 1: Graphique "Secteur de secteur" (simulé)
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Répartition du Prix de Vente et du Coût de Revient", 14, yPos);
                yPos += 15;

                // --- Logique de dessin personnalisée pour plus de contrôle ---
                const drawPieSlices = (data, centerX, centerY, radius) => {
                    const totalValue = data.reduce((sum, slice) => sum + slice.value, 0);
                    if (totalValue <= 0) return;
                    let startAngleDeg = -90;
                    data.forEach(slice => {
                        if (slice.value <= 0) return;
                        const sliceAngleDeg = (slice.value / totalValue) * 360;
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.moveTo(centerX, centerY);
                        const steps = Math.max(2, Math.ceil(Math.abs(sliceAngleDeg) / 5));
                        for (let i = 0; i <= steps; i++) {
                            const angle = startAngleDeg + (i * (sliceAngleDeg / steps));
                            const angleRad = angle * Math.PI / 180;
                            doc.lineTo(centerX + radius * Math.cos(angleRad), centerY + radius * Math.sin(angleRad));
                        }
                        doc.lineTo(centerX, centerY);
                        doc.fill();
                        startAngleDeg += sliceAngleDeg;
                    });
                };
                
                // --- Graphique principal (gauche) : Prix de Vente (taille réduite) ---
                const mainChartRadius = 35;
                const mainChartX = 14 + mainChartRadius;
                const mainChartY = yPos + mainChartRadius;
                const priceData = [
                    { label: 'Coût de Revient', value: costs.totalCostPerPortion, color: [107, 114, 128] },
                    { label: 'Marge Nette', value: costs.margeNetteDollar > 0 ? costs.margeNetteDollar : 0, color: [59, 130, 246] }
                ];
                drawPieSlices(priceData, mainChartX, mainChartY, mainChartRadius);
                
                // Légende du graphique principal (positionnée en dessous)
                let legendY = mainChartY + mainChartRadius + 8;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                priceData.forEach(slice => {
                    const totalPrixVente = costs.totalCostPerPortion + priceData[1].value;
                    if (totalPrixVente > 0) {
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.rect(14, legendY - 2.5, 3, 3, 'F');
                        doc.setTextColor(themeColors.darkText);
                        const percentage = (slice.value / totalPrixVente * 100).toFixed(1);
                        doc.text(`${slice.label}: ${percentage}% (${formatCurrency(slice.value)}$)`, 19, legendY);
                        legendY += 5;
                    }
                });

                // --- Graphique secondaire (droite) : Coût de Revient (taille réduite) ---
                const subChartRadius = 28;
                const subChartX = pageWidth - 60 - subChartRadius;
                const subChartY = yPos + mainChartRadius; // Aligné verticalement
                const costData = [
                    { label: 'Matières', value: costs.costMatierePerPortion, color: [16, 185, 129] },
                    { label: 'Main-d\'œuvre', value: costs.costLaborPerPortion, color: [245, 158, 11] },
                    { label: 'Indirects', value: costs.costIndirectPerPortion, color: [139, 92, 246] },
                ];
                drawPieSlices(costData, subChartX, subChartY, subChartRadius);
                
                // Légende du graphique secondaire (positionnée à droite)
                let subLegendX = subChartX + subChartRadius + 8;
                let subLegendY = subChartY - 5;
                if (costs.totalCostPerPortion > 0) {
                    costData.forEach(slice => {
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.rect(subLegendX, subLegendY - 2.5, 3, 3, 'F');
                        doc.setTextColor(themeColors.darkText);
                        const percentage = (slice.value / costs.totalCostPerPortion * 100).toFixed(1);
                        doc.text(`${slice.label}: ${percentage}% (${formatCurrency(slice.value)}$)`, subLegendX + 5, subLegendY);
                        subLegendY += 5;
                    });
                }

                // --- LOGIQUE FINALE POUR LES LIGNES DE CONNEXION (Style Arc Tangent) ---
                const totalValue = priceData.reduce((sum, slice) => sum + slice.value, 0);
                if (totalValue > 0) {
                    // Calcule l'angle de la tranche "Coût de Revient"
                    const costSliceAngleDeg = (costs.totalCostPerPortion / totalValue) * 360;
                    
                    // Le point de départ est toujours le sommet du cercle (-90 degrés).
                    const startAngleDeg = -90;
                    
                    // Calcule le point d'arrivée théorique de la tranche.
                    let endAngleDeg = startAngleDeg + costSliceAngleDeg;

                    // **LOGIQUE CLÉ :** Si la tranche est plus grande que la moitié du cercle (180 degrés),
                    // on "bloque" le point de départ de la ligne du bas au point le plus bas du cercle (90 degrés).
                    if (endAngleDeg > 90) {
                        endAngleDeg = 90;
                    }
                    
                    // Convertit les angles en radians pour le calcul
                    const startAngleRad = startAngleDeg * Math.PI / 180;
                    const endAngleRad = endAngleDeg * Math.PI / 180;

                    // Calcule les coordonnées du point de départ de la ligne du haut (toujours le sommet)
                    const p1x = mainChartX + mainChartRadius * Math.cos(startAngleRad);
                    const p1y = mainChartY + mainChartRadius * Math.sin(startAngleRad);
                    
                    // Calcule les coordonnées du point de départ de la ligne du bas (qui est maintenant "bloqué" si nécessaire)
                    const p2x = mainChartX + mainChartRadius * Math.cos(endAngleRad);
                    const p2y = mainChartY + mainChartRadius * Math.sin(endAngleRad);
                    
                    // Les points d'arrivée sur le petit cercle restent les mêmes
                    const endTopX = subChartX - subChartRadius;
                    const endTopY = subChartY - subChartRadius;
                    const endBottomX = subChartX - subChartRadius;
                    const endBottomY = subChartY + subChartRadius;

                    doc.setDrawColor(themeColors.gray);
                    doc.setLineWidth(0.2);
                    
                    // Dessine les deux lignes
                    doc.line(p1x, p1y, endTopX, endTopY);
                    doc.line(p2x, p2y, endBottomX, endBottomY);
                }

                yPos = mainChartY + mainChartRadius + 20;

                // Section 2: Évolution des Performances (taille réduite)
                if (trackingPoints && trackingPoints.length > 1) {
                    const productKpiData = getProductKpiDataForPdf(trackingPoints, product.id);
                    if(productKpiData.some(d => d["Marge nette (%)"] !== null)) {
                        
                        yPos = drawPdfLineChart(doc, {
                            title: `Évolution des Indicateurs pour "${product.platName}"`,
                            data: productKpiData,
                            lines: [
                                { dataKey: "Coût matière (%)", color: "#10B981" },
                                { dataKey: "Coût main-d'oeuvre (%)", color: "#F59E0B" },
                                { dataKey: "Coût frais indirects (%)", color: "#8B5CF6" },
                                { dataKey: "Marge nette (%)", color: "#3B82F6" },
                            ],
                            x: 14,
                            y: yPos,
                            width: pageWidth - 28,
                            height: 100 // Hauteur réduite pour que tout tienne sur une page
                        });
                    }
                }
            });

            // --- ANNEXES ---

            // Annexe A: Tableau Récapitulatif
            doc.addPage();
            addPageHeader("Annexe A: Tableau Récapitulatif");
            yPos = 45;

            const summaryAnnexBody = productsWithCosts.map(p => [
                p.platName,
                `${formatCurrency(parseLocaleNumber(p.prixVente))}`,
                `${formatCurrency(p.costs.totalCostPerPortion)}`,
                `${formatCurrency(p.costs.margeBruteDollar)}`,
                `${formatPercent(p.costs.margeBrutePercent)} %`,
                `${formatCurrency(p.costs.margeNetteDollar)}`,
                `${formatPercent(p.costs.margeNettePercent)} %`
            ]);

            doc.autoTable({
                startY: yPos,
                head: [['Plat', 'Prix Vente ($)', 'Coût Total ($)', 'Marge Brute ($)', 'Marge Brute (%)', 'Marge Nette ($)', 'Marge Nette (%)']],
                body: summaryAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 },
                 columnStyles: {
                    0: { cellWidth: 40 },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                }
            });


            // Annexe B: Liste des Ingrédients
            doc.addPage();
            addPageHeader("Annexe B: Liste des Ingrédients");
            yPos = 45;

            const ingredientsAnnexBody = baseIngredients.map(ing => [
                ing.name,
                ing.provider || 'N/A',
                `${ing.purchaseFormat} ${ing.unit}`,
                `${formatCurrency(parseLocaleNumber(ing.purchasePrice))} $`,
                `${parseLocaleNumber(ing.lossPercentage) || 0} %`,
                `${formatCurrency(ing.unitPrice)} $`
            ]);
            doc.autoTable({
                startY: yPos,
                head: [['Ingrédient', 'Fournisseur', 'Format Achat', 'Prix Achat', 'Taux Perte', 'Prix Unitaire']],
                body: ingredientsAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 }
            });

            // Annexe C: Liste des Employés
            doc.addPage();
            addPageHeader("Annexe C: Liste des Employés");
            yPos = 45;

            const laborAnnexBody = [];
            laborDatabase.forEach(post => {
                // Ajoute une ligne pour le titre du poste
                laborAnnexBody.push([{ content: post.postName, colSpan: 6, styles: { fontStyle: 'bold', fillColor: '#E5E7EB' } }]);

                if (post.employees && post.employees.length > 0) {
                    post.employees.forEach(emp => {
                        const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                        const totalEmployeeCost = baseHourlyCost * parseLocaleNumber(emp.workedHours);
                        laborAnnexBody.push([
                            emp.employeeName,
                            `${formatCurrency(parseLocaleNumber(emp.hourlyRate))} $`,
                            `${parseLocaleNumber(emp.socialCharges)} %`,
                            `${parseLocaleNumber(emp.vacationPercentage)} %`,
                            `${parseLocaleNumber(emp.workedHours)} h`,
                            `${formatCurrency(totalEmployeeCost)} $`
                        ]);
                    });
                } else {
                    laborAnnexBody.push([{ content: 'Aucun employé assigné', colSpan: 6, styles: { textColor: themeColors.gray, fontStyle: 'italic', halign: 'center' } }]);
                }
            });

            doc.autoTable({
                startY: yPos,
                head: [['Employé', 'Salaire Horaire', 'Charges (%)', 'Vacances (%)', 'Heures Travaillées', 'Coût Total Employé']],
                body: laborAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 }
            });
            
            // Ajoute les pieds de page à toutes les pages (sauf la première)
            addFooter();

            // --- FIN DU RAPPORT ---
            // (Les autres pages viendront s'insérer ici)


            // Sauvegarde du document
            doc.save(`rapport_couts_${companyName.replace(/\s/g, '_') || 'sans_nom'}.pdf`);
            showNotification({ message: 'Rapport PDF généré avec succès !', type: 'success' });

        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            showNotification({ message: `Une erreur est survenue lors de la génération du PDF: ${error.message}`, type: 'error' });
        } 
    };

    const exportToExcel = (laborDatabase) => {
            if (typeof XLSX === 'undefined') {
                showNotification({ message: "La bibliothèque Excel (XLSX) n'a pas pu être chargée. L'exportation est impossible.", type: 'error' });
                return;
            }
            try {
                const { 
                    productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin, 
                    globalBreakEven, weightedMaterialCost, weightedLaborCost, contributionData, 
                    menuEngineeringData, purchasingReportData, abcAnalysisData 
                } = analysisData;
                const wb = XLSX.utils.book_new();
                const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4B5563" } }, alignment: { horizontal: "center" } };
                const titleStyle = { font: { bold: true, sz: 16 } };
                const currencyFormat = '"$"#,##0.00';
                const percentFormat = '0.00%';

                // --- Feuille 1: Tableau de Bord ---
                let ws_dashboard_data = [
                    ["Tableau de Bord Stratégique"],
                    [],
                    ["Paramètres Généraux"],
                    ["Période:", `${generalInfo.period === 'custom' ? `Personnalisée (${generalInfo.startDate} au ${generalInfo.endDate})` : (periodTranslations[generalInfo.period] || 'N/A')}`],
                    ["Revenus Totaux:", { t: 'n', v: Number(calculatedGeneralInfo.totalRevenue), z: currencyFormat }],
                    ["Frais Indirects Totaux:", { t: 'n', v: Number(calculatedGeneralInfo.totalIndirects), z: currencyFormat }],
                    ["Coût M-O Cuisine:", { t: 'n', v: Number(calculatedGeneralInfo.totalKitchenLaborCost), z: currencyFormat }],
                    ["Heures d'opération:", `${calculatedGeneralInfo.operationHours} h`],
                    ["Coût horaire op.:", { t: 'n', v: Number(calculatedGeneralInfo.operationCostPerHour), z: currencyFormat }],
                    [],
                    ["Indicateurs Clés de Performance (KPIs) Globaux"],
                    ["Coût Matière Moyen Pondéré:", { t: 'n', v: Number(weightedMaterialCost), z: percentFormat }],
                    ["Coût Main-d'œuvre Moyen Pondéré:", { t: 'n', v: Number(weightedLaborCost), z: percentFormat }],
                    ["Marge Brute Moyenne Pondérée:", { t: 'n', v: Number(weightedGrossMargin), z: percentFormat }],
                    ["Point Mort du Menu:", { t: 'n', v: Number(globalBreakEven), z: currencyFormat }],
                ];
                const ws_dashboard = XLSX.utils.aoa_to_sheet(ws_dashboard_data);
                
                ws_dashboard["A1"].s = { font: { bold: true, sz: 18 } };
                ws_dashboard["A3"].s = titleStyle;
                ws_dashboard["A11"].s = titleStyle;
                
                ws_dashboard['!cols'] = [{wch: 35}, {wch: 25}];
                XLSX.utils.book_append_sheet(wb, ws_dashboard, "Tableau de Bord");

                // --- Feuille 2: Résumé ---
                const summaryHeaders = [
                    'Plat', 'Catégorie', 'Prix Vente', 'Coût Total', 'Coût Matière (%)', 
                    'Coût Main-d\'oeuvre (%)', 'Coût Indirects (%)', 'Marge Brute ($)', 
                    'Marge Brute (%)', 'Marge Nette ($)', 'Marge Nette (%)', 'Mix Ventes'
                ];
                const summarySheetData = [summaryHeaders.map(h => ({ v: h, s: headerStyle }))];

                products.forEach(product => {
                    const costs = calculateCosts(product, calculatedGeneralInfo, baseIngredients, products, laborDatabase);
                    summarySheetData.push([
                        product.platName || `Plat Inconnu`,
                        product.category || '',
                        { t: 'n', v: Number(parseLocaleNumber(product.prixVente)), z: currencyFormat },
                        { t: 'n', v: Number(costs.totalCostPerPortion), z: currencyFormat },
                        { t: 'n', v: Number(costs.costMatierePercent), z: percentFormat },
                        { t: 'n', v: Number(costs.costLaborPercent), z: percentFormat },
                        { t: 'n', v: Number(costs.costIndirectPercent), z: percentFormat },
                        { t: 'n', v: Number(costs.margeBruteDollar), z: currencyFormat },
                        { t: 'n', v: Number(costs.margeBrutePercent), z: percentFormat },
                        { t: 'n', v: Number(costs.margeNetteDollar), z: currencyFormat },
                        { t: 'n', v: Number(costs.margeNettePercent), z: percentFormat },
                        { t: 'n', v: Number(parseLocaleNumber(product.salesMix)) / 100, z: percentFormat }
                    ]);
                });

                const ws_summary = XLSX.utils.aoa_to_sheet(summarySheetData);
                ws_summary['!cols'] = [{wch: 25}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 12}];
                XLSX.utils.book_append_sheet(wb, ws_summary, "Résumé");

                // --- Feuille 3: Ingrédients ---
                const ingredientsHeaders = ['Ingrédient', 'Fournisseur', 'SKU/PLU', 'Format Achat', 'Prix Achat', 'Taux de perte (%)', 'Prix Unitaire', 'Dernière MàJ'];
                const ingredientsSheetData = [ingredientsHeaders.map(h => ({ v: h, s: headerStyle }))];
                
                baseIngredients.forEach(i => {
                    ingredientsSheetData.push([
                        i.name,
                        i.provider,
                        i.uniqueId,
                        `${parseLocaleNumber(i.purchaseFormat)} ${i.unit}`,
                        { t: 'n', v: Number(parseLocaleNumber(i.purchasePrice)), z: currencyFormat },
                        { t: 'n', v: Number(parseLocaleNumber(i.lossPercentage) || 0), z: percentFormat },
                        { t: 'n', v: Number(i.unitPrice), z: currencyFormat },
                        i.lastUpdated
                    ]);
                });

                const ws_ingredients = XLSX.utils.aoa_to_sheet(ingredientsSheetData);
                ws_ingredients['!cols'] = [{wch: 30}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}];
                XLSX.utils.book_append_sheet(wb, ws_ingredients, "Ingrédients");

                // --- Feuille 4: Main d'oeuvre ---
                const laborHeaders = ["Employé", "Salaire Horaire", "Charges (%)", "Vacances (%)", "Heures", "Coût Total"];
                const laborSheetData = [laborHeaders.map(h => ({v: h, s: headerStyle}))];
                
                laborDatabase.forEach(post => {
                    laborSheetData.push([
                        { v: post.postName, s: { font: { bold: true }, fill: { fgColor: { rgb: "E5E7EB" } } } }
                    ]);
                    
                    (post.employees || []).forEach(emp => {
                        const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                        laborSheetData.push([
                            emp.employeeName,
                            { t: 'n', v: Number(parseLocaleNumber(emp.hourlyRate)), z: currencyFormat },
                            { t: 'n', v: Number(parseLocaleNumber(emp.socialCharges)) / 100, z: percentFormat },
                            { t: 'n', v: Number(parseLocaleNumber(emp.vacationPercentage)) / 100, z: percentFormat },
                            Number(parseLocaleNumber(emp.workedHours)),
                            { t: 'n', v: Number(baseHourlyCost * parseLocaleNumber(emp.workedHours)), z: currencyFormat }
                        ]);
                    });
                });

                const ws_labor = XLSX.utils.aoa_to_sheet(laborSheetData);
                
                ws_labor['!merges'] = [];
                let r = 1;
                laborDatabase.forEach(post => {
                    ws_labor['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: 5 } });
                    r += (post.employees || []).length + 1;
                });

                ws_labor['!cols'] = [{wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 10}, {wch: 15}];
                XLSX.utils.book_append_sheet(wb, ws_labor, "Main d'oeuvre");

                // --- Fiches de Coût Individuelles ---
                products.forEach(product => {
                    const costs = calculateCosts(product, calculatedGeneralInfo, baseIngredients, products, laborDatabase);
                    const productivityFactor = (calculatedGeneralInfo.kitchenProductivity > 0 && calculatedGeneralInfo.kitchenProductivity <= 100) ? calculatedGeneralInfo.kitchenProductivity / 100 : 1;
                    
                    let sheetData = [
                        [{ v: `Fiche de coût pour: ${product.platName}`, s: titleStyle }], [],
                        [{ v: 'Informations sur la recette', s: { font: { bold: true, sz: 12 } } }],
                        ['Nombre de portions', product.nbPortions],
                        ['Taille par portion', `${product.portionSize || 1} ${product.portionUnit || 'unité'}`],
                        [],
                        [{ v: 'Méthode des Frais Indirects', s: { font: { bold: true, sz: 12 } } }],
                    ];

                    const method = product.indirectCosts.method;
                    const methodLabel = indirectCostMethodLabels[method] || 'Non définie';
                    let methodValueCell = { v: '' }; // Cellule vide par défaut

                    if (method === 'fixed') methodValueCell = { t: 'n', v: Number(product.indirectCosts.fixedAmount), z: currencyFormat };
                    else if (method === 'percentSales') methodValueCell = { t: 'n', v: Number(product.indirectCosts.percentSalesAmount) / 100, z: percentFormat };
                    else if (method === 'percentDirect') methodValueCell = { t: 'n', v: Number(product.indirectCosts.percentDirectAmount) / 100, z: percentFormat };
                    else if (method === 'portionAllocation') methodValueCell = { v: `${product.indirectCosts.portionsSold} portions` };

                    sheetData.push([methodLabel, methodValueCell]);
                    sheetData.push([], [{ v: 'Ingrédients', s: { font: { bold: true, sz: 12 } } }]);
                    const ingHeaders = ['Nom', 'Quantité', 'Unité', 'Coût Unitaire', 'Rendement (%)', 'Coût Total'];
                    sheetData.push(ingHeaders.map(h => ({ v: h, s: headerStyle })));
                    
                    (product.ingredients || []).forEach(i => {
                        let ingredientName = i.name;
                        let recipeUnit = i.recipeUnit;
                        let displayedUnitPrice = 0;
                        let totalCost = 0;

                        const ingredientSource = ingredientsList.find(ing => ing.id === i.id);

                        if (ingredientSource) {
                            ingredientName = ingredientSource.name;
                            recipeUnit = i.recipeUnit || ingredientSource.unit;
                            const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[ingredientSource.unit]?.factor || 1);
                            const quantityInBaseUnit = parseLocaleNumber(i.quantity) * conversionFactor;
                            const baseCost = quantityInBaseUnit * parseLocaleNumber(ingredientSource.unitPrice);
                            const yieldPercent = parseLocaleNumber(i.yieldPercentage);
                            totalCost = (yieldPercent && yieldPercent > 0) ? baseCost / (yieldPercent / 100) : baseCost;
                            displayedUnitPrice = (ingredientSource.unitPrice || 0) / (CONVERSION_FACTORS[ingredientSource.unit]?.factor || 1) * (CONVERSION_FACTORS[recipeUnit]?.factor || 1);
                        }
                        
                        sheetData.push([ 
                            ingredientName, 
                            Number(parseLocaleNumber(i.quantity)), 
                            recipeUnit, 
                            { t: 'n', v: Number(displayedUnitPrice), z: currencyFormat }, 
                            { t: 'n', v: Number(parseLocaleNumber(i.yieldPercentage)) / 100, z: percentFormat }, 
                            { t: 'n', v: Number(totalCost), z: currencyFormat } 
                        ]);
                    });
                    sheetData.push(['Total Ingrédients', '', '', '', '', { t: 'n', v: Number(costs.totalIngredientsCost), z: currencyFormat }]);
                    
                    sheetData.push([], [{ v: 'Processus de production', s: { font: { bold: true, sz: 12 } } }]);
                    const laborHeaders = ['Étape', 'Personnel', 'Début', 'Durée', 'Fin', 'Coût Total ($)'];
                    sheetData.push(laborHeaders.map(h => ({ v: h, s: headerStyle })));

                    (product.productionSteps || []).forEach(step => {
                        const personnelText = (step.personnel || []).map(p => p.postId).join(', ');
                        const stepCost = (step.personnel || []).reduce((total, person) => {
                            const postData = laborDatabase.find(p => p.postName === person.postId);
                            if (!postData || !postData.employees || postData.employees.length === 0) return total;

                            const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                            const totalPostCost = postData.employees.reduce((sum, emp) => {
                                const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                                return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                            }, 0);
                            const weightedAverageCost = totalHours > 0 ? totalPostCost / totalHours : 0;
                            const costPerPerson = (parseLocaleNumber(step.duration) / 3600) * weightedAverageCost / productivityFactor;
                            return total + costPerPerson;
                        }, 0);

                        sheetData.push([
                            step.stepName,
                            personnelText,
                            formatSecondsToTime(parseLocaleNumber(step.startTime)),
                            formatSecondsToTime(parseLocaleNumber(step.duration)),
                            formatSecondsToTime(parseLocaleNumber(step.startTime) + parseLocaleNumber(step.duration)),
                            { t: 'n', v: Number(stepCost), z: currencyFormat }
                        ]);
                    });
                    sheetData.push(['Total Main-d\'oeuvre', '', '', '', '', { t: 'n', v: Number(costs.totalLaborCost), z: currencyFormat }]);

                    sheetData.push([], [{ v: 'Récapitulatif par portion', s: { font: { bold: true, sz: 12 } } }]);
                    sheetData.push(['Prix de Vente', { t: 'n', v: Number(parseLocaleNumber(product.prixVente)), z: currencyFormat }]);
                    sheetData.push(['Coût Matières (base)', { t: 'n', v: Number(costs.totalBaseIngredientsCost / product.nbPortions), z: currencyFormat }]);
                    sheetData.push(['Coût des Pertes (stock)', { t: 'n', v: Number(costs.totalLossCost / product.nbPortions), z: currencyFormat }]);
                    sheetData.push(['Coût Matières Total', { t: 'n', v: Number(costs.costMatierePerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Main-d\'oeuvre', { t: 'n', v: Number(costs.costLaborPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Indirect', { t: 'n', v: Number(costs.costIndirectPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût de Revient Total', { t: 'n', v: Number(costs.totalCostPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Matière (%)', { t: 'n', v: Number(costs.costMatierePercent), z: percentFormat }]);
                    sheetData.push(['Coût Main-d\'oeuvre (%)', { t: 'n', v: Number(costs.costLaborPercent), z: percentFormat }]);
                    sheetData.push(['Coût Indirects (%)', { t: 'n', v: Number(costs.costIndirectPercent), z: percentFormat }]);
                    sheetData.push(['Marge Brute', { t: 'n', v: Number(costs.margeBruteDollar), z: currencyFormat }, { t: 'n', v: Number(costs.margeBrutePercent), z: percentFormat }]);
                    sheetData.push(['Marge Nette', { t: 'n', v: Number(costs.margeNetteDollar), z: currencyFormat }, { t: 'n', v: Number(costs.margeNettePercent), z: percentFormat }]);
                    
                    const breakEvenInfo = (() => {
                        if (costs.margeBruteDollar <= 0) return { text: "Marge brute négative.", value: "N/A" };
                        const salesMixPercent = parseLocaleNumber(product.salesMix) / 100;
                        if (['fixed', 'percentSales', 'percentDirect'].includes(method)) return { text: `Rentable si marge nette positive.`, value: formatCurrency(costs.margeNetteDollar) };
                        if (salesMixPercent <= 0) return { text: "Mix des ventes nul.", value: "N/A" };
                        const allocatedIndirects = calculatedGeneralInfo.totalIndirects * salesMixPercent;
                        return { text: "Unités à vendre pour couvrir les frais indirects.", value: `${Math.ceil(allocatedIndirects / costs.margeBruteDollar)} unités` };
                    })();
                    sheetData.push([], ["Point Mort du Produit"], [breakEvenInfo.text, breakEvenInfo.value]);

                    const ws_product = XLSX.utils.aoa_to_sheet(sheetData, { cellStyles: true });
                    ws_product['!cols'] = [{wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}];
                    const fullSheetName = `Fiche - ${product.platName || 'Sans_Nom'}`;
                    const sanitizedSheetName = fullSheetName.substring(0, 31).replace(/[:\\/?*[\]]/g, "");
                    XLSX.utils.book_append_sheet(wb, ws_product, sanitizedSheetName);
                });
            
                XLSX.writeFile(wb, `rapport_excel_${companyName.replace(/\s/g, '_') || 'sans_nom'}.xlsx`);
                showNotification({ message: 'Rapport Excel exporté avec succès !', type: 'success' });
            } catch(error) {
                console.error("Erreur Excel:", error);
                showNotification({ message: "Une erreur est survenue lors de l'exportation Excel.", type: 'error' });
            }
        };

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