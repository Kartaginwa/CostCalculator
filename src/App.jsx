import React, { useState, useReducer, useRef, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import {
    Users, ChefHat, Table, Info, ShoppingCart, Save, FolderOpen,
    PlusCircle, TrendingUp, Settings, Package, Receipt,
} from 'lucide-react';

import { parseLocaleNumber, FORMAT_FLAT_MIRROR_FIELDS, sumLineAmounts, sumAmountsMap } from './utils.js';
import {
    computeAnalysisData, buildActivityBuckets, computeBucketTotalsFromAmounts,
    computeDirectCostLineAllocations, computeExpenseLineEffectiveAllocations,
    computeExpensePoolTotals, computeIndirectCostDriverTotals,
} from './engine/analysisData.js';
import { computeSalesMixFromChannelPrices } from './engine/salesMixFromChannels.js';
import { generatePdf as generatePdfReport } from './reports/generatePdf.js';
import { exportToExcel as exportToExcelReport } from './reports/exportToExcel.js';
import { getDefaultState, getEmptyState, buildDefaultFormat, stripFormatOwnedFields, buildFormatSku } from './state/initialState.js';
import { projectReducer, toProjectState } from './state/projectReducer.js';
import { buildProjectData, parseProjectData } from './state/projectSerialization.js';
import { ProjectContext } from './state/ProjectContext.jsx';

import { Notification, WelcomeModal, OnboardingModal, TutorialGuide, PdfOptionsModal } from './components/AppDialogs.jsx';
import { InstructionModal } from './components/InstructionModal.jsx';
import { ConfirmationModal } from './components/common.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

import { ProductInfo } from './features/ProductInfo.jsx';
import { IngredientsTab } from './features/IngredientsTab.jsx';
import { PackagingTab } from './features/PackagingTab.jsx';
import { LaborDatabaseTab } from './features/LaborDatabaseTab.jsx';
import { IncomeStatementTab } from './features/IncomeStatementTab.jsx';

// Code-splitting : ces vues/wizards sont chargés à la demande (chunks séparés). Cela sort du
// bundle initial les dépendances lourdes qu'ils tirent — notamment recharts (SummaryTable,
// TrackingTab) — et le code volumineux de RecipeCalculator et des assistants d'import.
const RecipeCalculator = lazy(() => import('./features/RecipeCalculator.jsx').then(m => ({ default: m.RecipeCalculator })));
const SummaryTable = lazy(() => import('./features/SummaryTable.jsx').then(m => ({ default: m.SummaryTable })));
const TrackingTab = lazy(() => import('./features/TrackingTab.jsx').then(m => ({ default: m.TrackingTab })));
const SalesReportImportWizardModal = lazy(() => import('./features/SalesReportImportWizardModal.jsx').then(m => ({ default: m.SalesReportImportWizardModal })));

const App = () => {
    // --- ÉTATS ---
    const [isProjectLoaded, setIsProjectLoaded] = useState(false);

    // Données du projet (produits, ingrédients, main-d'œuvre, infos générales...) : centralisées
    // dans un reducer et exposées via ProjectContext pour éviter de les faire descendre
    // manuellement à travers chaque onglet (voir src/state/projectReducer.js).
    const [projectState, dispatch] = useReducer(projectReducer, undefined, () => toProjectState(getEmptyState()));
    const { companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings } = projectState;

    // Setters stables (dispatch seul en dépendance, garanti stable par React) : la résolution
    // des mises à jour fonctionnelles (value => ...) se fait dans le reducer lui-même plutôt
    // que par fermeture sur projectState ici. Nécessaire pour pouvoir mémoïser sereinement
    // projectContextValue plus bas (sinon un nouveau setter à chaque rendu invaliderait le memo).
    const {
        setCompanyName, setLogoUrl, setGeneralInfo, setBaseIngredients, setBasePackaging,
        setProducts, setLaborDatabase, setTrackingPoints, setProductionActivities, setSalesChannels, setExpenseLines, setRevenueLines, setDirectCostLines, setRepartitionKeys, setUiSettings,
    } = useMemo(() => {
        const makeSetter = (type) => (value) => dispatch({ type, payload: value });
        return {
            setCompanyName: makeSetter('SET_COMPANY_NAME'),
            setLogoUrl: makeSetter('SET_LOGO_URL'),
            setGeneralInfo: makeSetter('SET_GENERAL_INFO'),
            setBaseIngredients: makeSetter('SET_BASE_INGREDIENTS'),
            setBasePackaging: makeSetter('SET_BASE_PACKAGING'),
            setProducts: makeSetter('SET_PRODUCTS'),
            setLaborDatabase: makeSetter('SET_LABOR_DATABASE'),
            setTrackingPoints: makeSetter('SET_TRACKING_POINTS'),
            setProductionActivities: makeSetter('SET_PRODUCTION_ACTIVITIES'),
            setSalesChannels: makeSetter('SET_SALES_CHANNELS'),
            setExpenseLines: makeSetter('SET_EXPENSE_LINES'),
            setRevenueLines: makeSetter('SET_REVENUE_LINES'),
            setDirectCostLines: makeSetter('SET_DIRECT_COST_LINES'),
            setRepartitionKeys: makeSetter('SET_REPARTITION_KEYS'),
            setUiSettings: makeSetter('SET_UI_SETTINGS'),
        };
    }, [dispatch]);

    const [activeTab, setActiveTab] = useState('info');
    const [editingProductIndex, setEditingProductIndex] = useState(0);
    // Format ciblé au moment de naviguer vers Recette & Calcul (Phase 1.6b) : par défaut 0, ou le
    // format précis d'où vient la navigation (ex. clic sur une ligne du Résumé, qui représente
    // désormais un format, pas un produit). RecipeCalculator le consomme une fois pour initialiser
    // son onglet sélectionné, puis reprend la main sur ses propres clics d'onglet locaux.
    const [editingFormatIndex, setEditingFormatIndex] = useState(0);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
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
    const [openRecipeSections, setOpenRecipeSections] = useState(new Set(['ingredients', 'packaging', 'labor', 'indirects', 'recap']));

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfOptions, setPdfOptions] = useState({ title: '', subtitle: '' });
    const [isSalesImportWizardOpen, setIsSalesImportWizardOpen] = useState(false);

    // Phase 3.4 : remplace handlePosImport — écrit sur `format.channelPrices` (prix net + volume
    // par canal) plutôt que sur un `prixVente`/`salesMix` à plat. Import ADDITIF : un rapport de
    // vente ne couvre généralement qu'UN canal/distributeur à la fois (pas tout le menu comme
    // l'ancien export de caisse), donc on ne remet plus à zéro les produits non importés — seules
    // les entrées channelPrices explicitement présentes dans le fichier sont créées/mises à jour.
    // `salesMix` est ensuite entièrement RE-DÉRIVÉ de l'état réel des volumes (voir
    // computeSalesMixFromChannelPrices), pas accumulé import après import.
    const handleSalesReportImport = (importData) => {
        const { items, newStartDate, newEndDate } = importData;

        let workingChannels = [...salesChannels];
        const resolveChannelId = (resolution) => {
            if (resolution.type === 'matched') return resolution.channelId;
            const newChannel = { id: `channel_${Date.now()}_${Math.random()}`, name: resolution.newChannelName, links: [] };
            workingChannels = [...workingChannels, newChannel];
            return newChannel.id;
        };

        let workingProducts = [...products];
        items.forEach(item => {
            const channelId = resolveChannelId(item.channelResolution);

            if (item.productStatus === 'new') {
                const newProduct = {
                    id: String(Date.now() + Math.random()),
                    platName: item.platName,
                    category: item.category,
                    activityId: productionActivities[0]?.id || '',
                    prixVente: Number(item.netPrice.toFixed(2)),
                    nbPortions: 1, portionSize: 1, portionUnit: 'unité',
                    isIngredient: false, isResaleProduct: false, purchaseCost: 0,
                    salesMix: 0, onMenu: true,
                    manualAllergens: [], ingredients: [], productionSteps: [],
                    indirectCosts: { method: 'salesAllocation', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 }
                };
                newProduct.formats = [buildDefaultFormat(newProduct)];
                newProduct.formats[0].channelPrices = [{ id: `cp_${Date.now()}_${Math.random()}`, channelId, netPrice: item.netPrice, volume: item.volume }];
                workingProducts = [stripFormatOwnedFields(newProduct), ...workingProducts];
                return;
            }

            const productIndex = workingProducts.findIndex(p => p.id === item.existingProductId);
            if (productIndex === -1) return;
            const product = workingProducts[productIndex];
            const newFormats = product.formats.map(f => {
                if (f.id !== item.formatId) return f;
                const existingEntry = (f.channelPrices || []).find(cp => cp.channelId === channelId);
                const newChannelPrices = existingEntry
                    ? f.channelPrices.map(cp => cp.channelId === channelId ? { ...cp, netPrice: item.netPrice, volume: item.volume } : cp)
                    : [...(f.channelPrices || []), { id: `cp_${Date.now()}_${Math.random()}`, channelId, netPrice: item.netPrice, volume: item.volume }];
                // Le premier élément reste le canal "principal" (miroir prixVente) — voir
                // handleFormatChannelPricesChange ; on ne réordonne jamais ici.
                return { ...f, channelPrices: newChannelPrices, prixVente: parseLocaleNumber(newChannelPrices[0].netPrice), onMenu: true };
            });
            workingProducts[productIndex] = { ...product, formats: newFormats, category: item.category || product.category };
        });

        // `totalRevenue` renvoyé par computeSalesMixFromChannelPrices n'est plus recalé sur
        // generalInfo (retiré le 18/10, avec toute la section « Frais et revenus » — plus aucun
        // calcul de coût de revient n'en dépend, voir Projet_Claude/03-Feuille-de-route.md).
        const { products: finalProducts } = computeSalesMixFromChannelPrices(workingProducts);

        setSalesChannels(workingChannels);
        setProducts(finalProducts);
        setGeneralInfo(prev => ({
            ...prev,
            period: 'custom',
            startDate: newStartDate || prev.startDate,
            endDate: newEndDate || prev.endDate,
        }));

        showNotification({
            message: `Importation réussie ! ${items.length} ligne(s) traitée(s).`,
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
        // Volumes RÉELS par canal (corrigé le 18/10, confirmé le 19/10 — voir
        // Projet_Claude/03-Feuille-de-route.md, addendum du 19/10) : plus de reconstruction à
        // partir du revenu déclaré (`totalRevenue`, réel) — ce serait mélanger les deux jeux de
        // données que la Réconciliation réel/théorique doit garder indépendants. Repli direct sur
        // `fmt.channelPrices[].volume`, la même donnée réelle que `channelBreakdown` utilise déjà
        // dans analysisData.js. Un format sans aucun volume réel saisi contribue 0 heure de MO
        // nécessaire (jamais une estimation fabriquée) — conséquence acceptée : la productivité
        // cuisine et le rapport de productivité restent à 0 tant qu'aucune vente réelle n'est
        // saisie par canal pour ce format.
        // Une entrée par FORMAT actif (Phase 1.6 — même aplatissement que analysisData.js), pas par
        // produit : chaque format a son propre prix/mix/nbPortions/étapes de production.
        const activeFormatRows = products.flatMap(product =>
            (product.formats && product.formats.length > 0 ? product.formats : [product])
                .filter(fmt => fmt.onMenu)
                .map(fmt => ({ product, fmt }))
        );

        const totalDirectLaborHoursNeededByPost = {};
        // Phase 6 (15/10) : même boucle, accumulateur supplémentaire par ACTIVITÉ de production
        // (product.activityId) plutôt qu'une 2e passe séparée — share/batchesNeeded déjà calculés
        // une seule fois ici. Un format sans activité assignée ne contribue à aucune activité
        // (jamais rattaché à "Général" arbitrairement).
        const totalDirectLaborHoursNeededByActivity = {};
        activeFormatRows.forEach(({ product, fmt }) => {
            const portionsSold = (fmt.channelPrices || []).reduce((sum, cp) => sum + (parseLocaleNumber(cp.volume) || 0), 0);
            const batchesNeeded = portionsSold / (parseLocaleNumber(fmt.nbPortions) || 1);

            (fmt.productionSteps || []).forEach(step => {
                (step.personnel || []).forEach(person => {
                    const hours = (parseLocaleNumber(step.duration) / 3600) * batchesNeeded;
                    if (!totalDirectLaborHoursNeededByPost[person.postId]) {
                        totalDirectLaborHoursNeededByPost[person.postId] = 0;
                    }
                    totalDirectLaborHoursNeededByPost[person.postId] += hours;
                    if (product.activityId) {
                        totalDirectLaborHoursNeededByActivity[product.activityId] = (totalDirectLaborHoursNeededByActivity[product.activityId] || 0) + hours;
                    }
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

        // Phase 6 (15/10) : capacité de production PAR ACTIVITÉ (ligne de production) — pas de
        // "expected" par activité (un poste/employé n'est pas rattaché à une seule activité, donc
        // rien à comparer analogue au "expected" par poste) : seulement la part des heures de MO
        // réellement nécessaires que CETTE activité consomme, du total du menu.
        productivityReport.byActivity = productionActivities.map(activity => {
            const actual = totalDirectLaborHoursNeededByActivity[activity.id] || 0;
            const sharePercent = totalDirectLaborHoursNeeded > 0 ? (actual / totalDirectLaborHoursNeeded) * 100 : 0;
            return { activityId: activity.id, activityName: activity.name, actual, sharePercent };
        });

        return {
            ...generalInfo,
            totalKitchenLaborCost: autoCalculatedLaborCost,
            kitchenProductivity: kitchenProductivity,
            productivityReport: productivityReport,
            // Total des heures de MO nécessaires au menu : dénominateur de la méthode d'attribution
            // « temps de production » (taux = frais indirects / ce total → réconcilie exactement).
            totalDirectLaborHoursNeeded: totalDirectLaborHoursNeeded,
        };
    }, [generalInfo, products, laborDatabase, autoCalculatedLaborCost, productionActivities]);
    // --- MOTEUR DE DONNÉES CENTRALISÉ ET MÉMORISÉ ---
    // Source unique de vérité pour les coûts : computeAnalysisData calcule productsWithCosts une
    // seule fois (avec un memo partagé) puis en dérive tous les KPIs. Défini ici, avant
    // ingredientsList, pour que ce dernier — comme les autres consommateurs (RecipeCalculator,
    // TrackingTab, rapports) — réutilise ces coûts au lieu de relancer un calcul redondant.
    //
    // Phase 4.6 — Conversion des frais fixes (Général/Activité/Canal) en taux par produit : calcul
    // en DEUX passes, nécessaire parce que les pools Activité/Canal ont besoin des coûts directs et
    // des volumes de CHAQUE produit (eux-mêmes calculés par computeAnalysisData) pour se normaliser,
    // avant de pouvoir répartir ces mêmes pools SUR ces produits :
    //  1. `analysisDataDraft` : computeAnalysisData SANS pools (Général seul, comme avant la Phase
    //     4.6) — sert uniquement à lire les coûts directs/volumes déjà fiables de chaque produit.
    //  2. Pools construits à partir de ce brouillon (mêmes fonctions pures que l'onglet État des
    //     résultats, voir engine/analysisData.js — aucune règle dupliquée).
    //  3. `analysisData` (celui exposé au reste de l'app) : computeAnalysisData À NOUVEAU, cette
    //     fois avec les pools — Général réduit à sa seule part, Activité et Canal ajoutés.
    const activityBuckets = useMemo(() => buildActivityBuckets(productionActivities), [productionActivities]);

    const analysisDataDraft = useMemo(
        () => computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels),
        [products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels]
    );

    const indirectPools = useMemo(() => {
        const totalRevenueForPools = revenueLines.reduce((sum, line) => sum + sumAmountsMap(line.amounts), 0);
        const totalDirectCostsForPools = sumLineAmounts(directCostLines);
        const bucketTotals = computeBucketTotalsFromAmounts(revenueLines, activityBuckets);
        const { directCostBucketTotals } = computeDirectCostLineAllocations(directCostLines, analysisDataDraft.productsWithCosts, activityBuckets, salesChannels);
        const effectiveAllocations = computeExpenseLineEffectiveAllocations({
            expenseLines, repartitionKeys, activityBuckets, salesChannels,
            totalRevenue: totalRevenueForPools, totalDirectCosts: totalDirectCostsForPools,
            bucketTotals, directCostBucketTotals,
        });
        const { activityPoolTotals, channelPoolTotals } = computeExpensePoolTotals(expenseLines, effectiveAllocations, activityBuckets, salesChannels);
        const { activityDriverTotals, channelDriverTotals } = computeIndirectCostDriverTotals(analysisDataDraft.productsWithCosts, productionActivities, salesChannels);

        return {
            generalPoolAmount: activityPoolTotals.general || 0,
            activityPools: Object.fromEntries(productionActivities.map((a) => {
                const driver = a.indirectCostDriver || 'directCost';
                return [a.id, { amount: activityPoolTotals[a.id] || 0, driver, driverTotal: activityDriverTotals[a.id]?.[driver] || 0 }];
            })),
            // Canal (corrigé le 14/10) : aucun driver au choix — toujours une majoration sur le
            // coût de production déjà établi à l'activité (voir computeIndirectCostDriverTotals).
            channelPools: Object.fromEntries(salesChannels.map((c) => (
                [c.id, { amount: channelPoolTotals[c.id] || 0, driverTotal: channelDriverTotals[c.id] || 0 }]
            ))),
        };
    }, [expenseLines, repartitionKeys, revenueLines, directCostLines, activityBuckets, productionActivities, salesChannels, analysisDataDraft.productsWithCosts]);

    const analysisData = useMemo(
        () => computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels, indirectPools),
        [products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels, indirectPools]
    );

    const ingredientsList = useMemo(() => {
        // Une entrée PAR FORMAT d'une sous-recette (pas une seule par produit) : chaque format a sa
        // propre fiche recette et son propre coût (voir 04-Conception-Modele.md), donc son propre
        // coût d'ingrédient potentiel — ex. "Sauce demi-glace maison (500 ml)" et "(1 L)" peuvent
        // coûter différemment et doivent être choisis explicitement, pas fusionnés. `id` = l'id du
        // FORMAT (unique, voir Phase 1.6a) ; `calculateCosts.js` sait résoudre une sous-recette par
        // id de format (nouvelles références) ou par id de produit (anciennes données, repli sur le
        // premier format — voir son commentaire). `name` = displayName, désambiguïsé par format
        // pour qu'on puisse les distinguer dans le sélecteur d'ingrédient.
        const recipeIngredients = analysisData.productsWithCosts
            .filter(p => p.isIngredient && p.platName)
            .map(p => {
                const costs = p.costs;
                const sanitizedPortionSize = parseLocaleNumber(p.portionSize) || 1;
                const calculatedUnitPrice = sanitizedPortionSize > 0 ? costs.totalCostPerPortion / sanitizedPortionSize : 0;

                return {
                    id: p.id,
                    name: p.displayName,
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

    // `generalInfo.totalIndirects` n'est plus ressaisi directement (Phase 4.1) : c'est toujours la
    // somme exacte des lignes de dépense, recalculée ici à chaque modification pour qu'elle ne
    // puisse jamais dériver de la liste qui la compose — seul point d'écriture de `expenseLines`.
    // Résout la valeur AVANT de dispatcher (plutôt qu'un setter fonctionnel imbriqué dans un autre
    // setter) : un dispatch ne doit pas être déclenché depuis l'exécution d'un reducer.
    const handleUpdateExpenseLines = useCallback((value) => {
        const newLines = typeof value === 'function' ? value(expenseLines) : value;
        setExpenseLines(newLines);
        setGeneralInfo(prev => ({ ...prev, totalIndirects: sumLineAmounts(newLines) }));
    }, [expenseLines, setExpenseLines, setGeneralInfo]);

    // Un SKU encore auto-généré peut avoir été construit avec DEUX conventions de repli
    // différentes selon son origine : l'id du FORMAT (handleAddFormat/handleDuplicateFormat) ou
    // l'id du PRODUIT (buildDefaultFormat, utilisé pour le format par défaut à la création d'un
    // produit). Il peut aussi porter un suffixe "-copie" : handleDuplicateFormat sans format
    // explicitement changé (quantité/unité identiques à l'original) en ajoute un pour éviter un
    // SKU littéralement dupliqué, mais ce SKU reste "auto" pour autant — sinon changer la quantité
    // du format dupliqué (le geste naturel suivant) ne régénérerait plus le SKU. (handleDuplicateProduct
    // régénère lui directement un SKU propre sur le nouveau nom, sans ce suffixe — voir cette fonction.)
    const isAutoGeneratedSku = (f, platName, productId) => {
        const base = (f.sku || '').replace(/-copie$/, '');
        return base === buildFormatSku(platName, f.portionSize, f.portionUnit, f.id) ||
            base === buildFormatSku(platName, f.portionSize, f.portionUnit, productId);
    };

    const handleProductValueChange = (index, field, value) => {
        const newProducts = [...products];
        const oldProduct = newProducts[index];
        const updatedProduct = { ...oldProduct, [field]: value };

        if (field === 'onMenu' && !value) {
            updatedProduct.salesMix = 0;
        }

        // Le SKU (recette + format) se déduit automatiquement tant que l'utilisateur ne l'a pas
        // modifié lui-même — reconnu en recalculant ce que l'ancien nom aurait produit : si le SKU
        // actuel y correspond encore, il n'a pas été touché manuellement. Sans ceci, un produit
        // créé vierge (nom "") générerait un SKU figé sur ce nom vide, sans jamais se mettre à jour
        // une fois le vrai nom saisi — voir Projet_Claude/03-Feuille-de-route.md.
        if (field === 'platName' && Array.isArray(updatedProduct.formats)) {
            updatedProduct.formats = updatedProduct.formats.map(f =>
                isAutoGeneratedSku(f, oldProduct.platName, oldProduct.id)
                    ? { ...f, sku: buildFormatSku(value, f.portionSize, f.portionUnit, f.id) }
                    : f
            );
        }

        newProducts[index] = updatedProduct;
        setProducts(newProducts);
    };

    // --- GESTION DES FORMATS DE VENTE (onglet Paramètres → Produits et SKUs) ---
    // L'ajout/la duplication/la suppression d'un format se fait ici plutôt que dans Recette &
    // Calcul (qui n'en garde qu'un sélecteur) — voir Projet_Claude/02-Journal-Decisions.md.
    const handleFormatValueChange = (productIndex, formatIndex, field, value) => {
        const product = products[productIndex];
        const newFormats = product.formats.map((f, i) => {
            if (i !== formatIndex) return f;
            const updated = { ...f, [field]: value };
            if (field === 'onMenu' && !value) {
                updated.salesMix = 0;
            }
            // Même logique de SKU auto-dérivé qu'au renommage du produit (voir
            // handleProductValueChange) : régénère le SKU si l'utilisateur ne l'a pas modifié lui-même.
            if (field === 'portionSize' || field === 'portionUnit') {
                if (isAutoGeneratedSku(f, product.platName, product.id)) {
                    updated.sku = buildFormatSku(product.platName, updated.portionSize, updated.portionUnit, f.id);
                }
            }
            return updated;
        });
        const updatedProduct = { ...product, formats: newFormats };
        // Miroir temporaire vers les champs "à plat" — uniquement pour le format par défaut
        // (index 0), le temps que les autres écrans lisent formats[] directement (Phase 1.6).
        if (formatIndex === 0 && FORMAT_FLAT_MIRROR_FIELDS.includes(field)) {
            updatedProduct[field] = value;
            if (field === 'onMenu' && !value) updatedProduct.salesMix = 0;
        }
        const newProducts = [...products];
        newProducts[productIndex] = updatedProduct;
        setProducts(newProducts);
    };

    // Phase 3.2 : remplace tout le tableau `channelPrices` d'un format, en un seul dispatch avec le
    // miroir `prixVente` (lu par calculateCosts.js, pas encore channel-aware — Phase 3.3). Un
    // handler dédié plutôt que deux appels à handleFormatValueChange : ce dernier capture `products`
    // par fermeture, donc deux appels synchrones écraseraient l'un l'autre au lieu de s'empiler.
    // Le PREMIER élément du tableau est le canal "principal" dont le prix alimente ce miroir.
    const handleFormatChannelPricesChange = (productIndex, formatIndex, newChannelPrices) => {
        const product = products[productIndex];
        const mirroredPrixVente = newChannelPrices.length > 0 ? parseLocaleNumber(newChannelPrices[0].netPrice) : 0;
        const newFormats = product.formats.map((f, i) => i !== formatIndex ? f : { ...f, channelPrices: newChannelPrices, prixVente: mirroredPrixVente });
        const updatedProduct = { ...product, formats: newFormats };
        if (formatIndex === 0) {
            updatedProduct.prixVente = mirroredPrixVente;
        }
        const newProducts = [...products];
        newProducts[productIndex] = updatedProduct;
        // Révisé 06/10 : safe à recalculer en direct maintenant que computeSalesMixFromChannelPrices
        // ne touche QUE les formats qui ont déjà au moins une unité saisie quelque part — un format
        // encore en % manuel (jamais d'unité saisie) garde sa valeur intacte, jamais écrasé à 0.
        const { products: recomputedProducts } = computeSalesMixFromChannelPrices(newProducts);
        setProducts(recomputedProducts);
    };

    // `overrides` (optionnel) : { sku, portionSize, portionUnit } — utilisé par la fenêtre modale
    // d'ajout de format (Recette & Calcul), qui fixe explicitement le FORMAT (quantité/unité) du
    // nouveau SKU dès sa création (« copier à la base » copie le contenu de la recette, mais le
    // format reste une donnée propre et délibérée du nouveau SKU — voir 04-Conception-Modele.md).
    // Sans override, comportement inchangé : copie intégrale avec suffixe "-copie" sur le SKU.
    const handleDuplicateFormat = (productIndex, formatIndex, overrides = {}) => {
        const newId = String(Date.now() + Math.random());
        const product = products[productIndex];
        const formatToDuplicate = product.formats[formatIndex];
        // Clone profond : chaque format est une fiche recette autonome (ingrédients, étapes de
        // production), donc « dupliquer » en copie l'intégralité — le point de départ « copier à
        // la base » d'un nouveau SKU (voir 04-Conception-Modele.md). Nouveaux id pour ne jamais
        // partager une référence avec l'original (même précédent que handleDuplicateProduct).
        const newFormat = JSON.parse(JSON.stringify(formatToDuplicate));
        const formatChanged = overrides.portionSize !== undefined || overrides.portionUnit !== undefined;
        if (overrides.portionSize !== undefined) newFormat.portionSize = overrides.portionSize;
        if (overrides.portionUnit !== undefined) newFormat.portionUnit = overrides.portionUnit;
        // Le SKU (recette + format) se régénère automatiquement tant qu'il était encore auto sur
        // l'original. Si la quantité/unité change (override), la régénération suffit à le
        // distinguer de l'original. Si elle NE change PAS (duplication simple), on lui ajoute un
        // suffixe "-copie" pour éviter un SKU littéralement dupliqué — tout en restant reconnu
        // comme "auto" par isAutoGeneratedSku (voir sa définition), pour que changer la quantité du
        // format dupliqué juste après, le geste naturel suivant, régénère bien le SKU. Un SKU
        // personnalisé par l'utilisateur reste lui intact (suffixé, jamais régénéré).
        const wasAuto = isAutoGeneratedSku(formatToDuplicate, product.platName, product.id);
        const regeneratedSku = buildFormatSku(product.platName, newFormat.portionSize, newFormat.portionUnit, newId);
        newFormat.sku = overrides.sku
            ? overrides.sku
            : !wasAuto
                ? (formatToDuplicate.sku ? `${formatToDuplicate.sku}-copie` : '')
                : formatChanged
                    ? regeneratedSku
                    : `${regeneratedSku}-copie`;
        newFormat.id = newId;
        newFormat.ingredients = (newFormat.ingredients || []).map(ing => ({ ...ing, rowId: `ing_${Date.now()}_${Math.random()}` }));
        newFormat.packagingItems = (newFormat.packagingItems || []).map(item => ({ ...item, rowId: `pkgitem_${Date.now()}_${Math.random()}` }));
        newFormat.productionSteps = (newFormat.productionSteps || []).map(step => ({ ...step, stepId: `step_${Date.now()}_${Math.random()}` }));
        const newFormats = [...product.formats];
        newFormats.splice(formatIndex + 1, 0, newFormat);
        const newProducts = [...products];
        newProducts[productIndex] = { ...product, formats: newFormats };
        setProducts(newProducts);
    };

    const handleDeleteFormat = (productIndex, formatIndex) => {
        const product = products[productIndex];
        if (product.formats.length <= 1) {
            // Dernier format du produit : supprime le produit entier (même comportement et
            // même notification annulable que le bouton "Supprimer le plat" existant).
            handleDeleteProduct(productIndex);
            return;
        }
        if (formatIndex === 0) {
            // Le format par défaut (index 0) alimente le miroir vers les champs à plat
            // (FORMAT_FLAT_MIRROR_FIELDS) tant que Résumé/rapports/analyse ne lisent pas encore
            // formats[] directement (Phase 1.6) — on ne peut pas le supprimer tant qu'il reste
            // d'autres formats. Dupliquez-le si vous voulez en changer.
            showNotification({ message: "Le format par défaut ne peut pas être supprimé — dupliquez-le si vous voulez en changer.", type: 'error' });
            return;
        }
        const formatToDelete = product.formats[formatIndex];
        const originalProducts = JSON.parse(JSON.stringify(products));
        const newFormats = product.formats.filter((_, i) => i !== formatIndex);
        const newProducts = [...products];
        newProducts[productIndex] = { ...product, formats: newFormats };
        setProducts(newProducts);

        showNotification({
            message: `Le format "${formatToDelete.sku || 'sans SKU'}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                setProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    // `overrides` (optionnel) : { sku, portionSize, portionUnit } — voir handleDuplicateFormat.
    // Le SKU se déduit automatiquement de la recette + du format (buildFormatSku) quand il n'est
    // pas fourni explicitement, plutôt que de rester vide.
    const handleAddFormat = (productIndex, overrides = {}) => {
        const product = products[productIndex];
        const newId = `fmt_${Date.now()}_${Math.random()}`;
        const portionSize = overrides.portionSize !== undefined ? overrides.portionSize : 1;
        const portionUnit = overrides.portionUnit !== undefined ? overrides.portionUnit : 'unité';
        const newFormat = {
            id: newId,
            sku: overrides.sku || buildFormatSku(product.platName, portionSize, portionUnit, newId),
            prixVente: 0, nbPortions: 1, portionSize, portionUnit,
            // Un nouveau format démarre volontairement SANS canal de vente attaché (pas de
            // "channel_default" par défaut) : un format additionnel (ex. un grand format destiné
            // à la restauration) n'est pas forcément vendu partout où le produit l'est déjà — voir
            // Projet_Claude/04-Conception-Modele.md, Phase 3.2.
            channelPrices: [],
            salesMix: 0, onMenu: true,
            indirectCosts: { portionsSold: 100 },
            ingredients: [], packagingItems: [], productionSteps: [], isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
        };
        const newProducts = [...products];
        newProducts[productIndex] = { ...product, formats: [...product.formats, newFormat] };
        setProducts(newProducts);
    };

    const handleAddNewProduct = () => {
        const newProduct = {
            id: String(Date.now() + Math.random()),
            platName: '',
            category: '',
            activityId: productionActivities[0]?.id || '',
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
            packagingItems: [],
            productionSteps: [],
            indirectCosts: { method: 'laborIntensity', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 }
        };
        newProduct.formats = [buildDefaultFormat(newProduct)];
        const newProducts = [stripFormatOwnedFields(newProduct), ...products];
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
        // Nouveaux id pour chaque format dupliqué, et pour les ingrédients/étapes de production
        // qu'il porte (chaque format est sa propre fiche recette depuis la correction du 23/09) —
        // ne doivent jamais être partagés avec l'original (voir Phase 1.3).
        newProduct.formats = (newProduct.formats || []).map(f => {
            const newFormatId = `fmt_${Date.now()}_${Math.random()}`;
            // Si le SKU de l'original était encore auto-généré, on le régénère directement sur le
            // NOUVEAU nom ("... (Copie)") plutôt que de lui accoler un suffixe "-copie" figé : sinon,
            // le geste naturel après une duplication (renommer la copie) ne régénérerait plus jamais
            // le SKU, puisqu'il ne correspondrait déjà plus au nom au moment même de la duplication.
            // Un SKU personnalisé par l'utilisateur, lui, reste intact (suffixé pour éviter un
            // doublon exact, jamais régénéré automatiquement).
            const wasAuto = isAutoGeneratedSku(f, productToDuplicate.platName, productToDuplicate.id);
            return {
                ...f,
                id: newFormatId,
                sku: wasAuto
                    ? buildFormatSku(newProduct.platName, f.portionSize, f.portionUnit, newFormatId)
                    : (f.sku ? `${f.sku}-copie` : f.sku),
                ingredients: (f.ingredients || []).map(ing => ({ ...ing, rowId: `ing_${Date.now()}_${Math.random()}` })),
                packagingItems: (f.packagingItems || []).map(item => ({ ...item, rowId: `pkgitem_${Date.now()}_${Math.random()}` })),
                productionSteps: (f.productionSteps || []).map(step => ({ ...step, stepId: `step_${Date.now()}_${Math.random()}` })),
            };
        });

        const newProducts = [...products];
        newProducts.splice(indexToDuplicate + 1, 0, newProduct);
        setProducts(newProducts);
    };

    const editProduct = (index, formatIndex = 0) => {
        setEditingProductIndex(index);
        setEditingFormatIndex(formatIndex);
        setActiveTab('recipe');
    };

    // Utilisé par le sélecteur de plat interne à Recette & Calcul (pas par le Résumé) : remet
    // toujours le format à 0, puisqu'on change de recette sans viser un format précis.
    const selectProductForRecipe = (index) => {
        setEditingProductIndex(index);
        setEditingFormatIndex(0);
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
        setBasePackaging(defaultState.basePackaging);
        setProducts(defaultState.products);
        setTrackingPoints(defaultState.trackingPoints);
        setLaborDatabase(defaultState.laborDatabase);
        setProductionActivities(defaultState.productionActivities);
        setSalesChannels(defaultState.salesChannels);
        setExpenseLines(defaultState.expenseLines);
        setRevenueLines(defaultState.revenueLines);
        setDirectCostLines(defaultState.directCostLines);
        setRepartitionKeys(defaultState.repartitionKeys);
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
        setBasePackaging(emptyState.basePackaging);
        setProducts(emptyState.products);
        setTrackingPoints(emptyState.trackingPoints);
        setLaborDatabase(emptyState.laborDatabase);
        setProductionActivities(emptyState.productionActivities);
        setSalesChannels(emptyState.salesChannels);
        setExpenseLines(emptyState.expenseLines);
        setRevenueLines(emptyState.revenueLines);
        setDirectCostLines(emptyState.directCostLines);
        setRepartitionKeys(emptyState.repartitionKeys);
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
        setBasePackaging(emptyState.basePackaging);
        setProducts(emptyState.products);
        setTrackingPoints(emptyState.trackingPoints);
        setLaborDatabase(emptyState.laborDatabase);
        setProductionActivities(emptyState.productionActivities);
        setSalesChannels(emptyState.salesChannels);
        setExpenseLines(emptyState.expenseLines);
        setRevenueLines(emptyState.revenueLines);
        setDirectCostLines(emptyState.directCostLines);
        setRepartitionKeys(emptyState.repartitionKeys);
        setOpenPostIds(new Set()); // Vide la liste pour un nouveau projet
        setEditingProductIndex(0);
        setActiveTab('info');
        setShowResetConfirm(false);
        setIsProjectLoaded(true);
        // Affiche la modale d'onboarding pour un nouveau projet
        setShowOnboardingModal(true);
        showNotification({ message: "Le projet a été réinitialisé.", type: 'success' });
    };

    const handleConfirmLoadExample = () => {
        const defaultState = getDefaultState();
        setCompanyName(defaultState.companyName);
        setLogoUrl(defaultState.logoUrl);
        setGeneralInfo(defaultState.generalInfo);
        setBaseIngredients(defaultState.ingredientsList);
        setBasePackaging(defaultState.basePackaging);
        setProducts(defaultState.products);
        setTrackingPoints(defaultState.trackingPoints);
        setLaborDatabase(defaultState.laborDatabase); // Ajout de la ligne manquante
        setProductionActivities(defaultState.productionActivities);
        setSalesChannels(defaultState.salesChannels);
        setExpenseLines(defaultState.expenseLines);
        setRevenueLines(defaultState.revenueLines);
        setDirectCostLines(defaultState.directCostLines);
        setRepartitionKeys(defaultState.repartitionKeys);
        setOpenPostIds(new Set(defaultState.laborDatabase.map(p => p.id)));
        setEditingProductIndex(0);
        setActiveTab('info');
        showNotification({ message: "Projet d'exemple chargé avec succès !", type: 'success' }); // Appel corrigé
        setIsProjectLoaded(true);
    };

    const saveProject = () => {
        try {
            const projectData = buildProjectData({
                companyName, logoUrl, generalInfo, baseIngredients, basePackaging,
                products, trackingPoints, laborDatabase, productionActivities, salesChannels, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings,
            });

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
                const parsed = parseProjectData(data, getEmptyState());
                setCompanyName(parsed.companyName);
                setLogoUrl(parsed.logoUrl);
                setGeneralInfo(parsed.generalInfo);
                setUiSettings(parsed.uiSettings);
                setTrackingPoints(parsed.trackingPoints);
                setLaborDatabase(parsed.laborDatabase);
                setProductionActivities(parsed.productionActivities);
                setSalesChannels(parsed.salesChannels);
                setExpenseLines(parsed.expenseLines);
                setRevenueLines(parsed.revenueLines);
                setDirectCostLines(parsed.directCostLines);
                setRepartitionKeys(parsed.repartitionKeys);
                setOpenPostIds(new Set(parsed.laborDatabase.map(p => p.id)));
                setBaseIngredients(parsed.baseIngredients);
                setBasePackaging(parsed.basePackaging);
                setProducts(parsed.products);

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
        ingredientsList, basePackaging,
    });

    const exportToExcel = () => exportToExcelReport({
        showNotification, analysisData, generalInfo, calculatedGeneralInfo,
        baseIngredients, laborDatabase, companyName, ingredientsList, basePackaging,
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
                    <button id="tab-packaging" onClick={() => setActiveTab('packaging')} className={getTabClasses('packaging')}><Package className="h-5 w-5 mr-2" /> Packaging</button>
                    <button id="tab-labor" onClick={() => setActiveTab('labor')} className={getTabClasses('labor')}><Users className="h-5 w-5 mr-2" /> Main-d'œuvre</button>
                    <button id="tab-income-statement" onClick={() => setActiveTab('income-statement')} className={getTabClasses('income-statement')}><Receipt className="h-5 w-5 mr-2" /> État des résultats</button>
                    <button id="tab-recipe" onClick={() => setActiveTab('recipe')} className={getTabClasses('recipe')}><ChefHat className="h-5 w-5 mr-2" /> Recettes et produits</button>
                    <button id="tab-summary" onClick={() => setActiveTab('summary')} className={getTabClasses('summary')}><Table className="h-5 w-5 mr-2" /> Rapport</button>
                    <button id="tab-tracking" onClick={() => setActiveTab('tracking')} className={getTabClasses('tracking')}><TrendingUp className="h-5 w-5 mr-2" /> Suivi</button>
                </div>
            </div>
        );

        // Données et setters du projet, exposés via ProjectContext pour éviter de les faire
        // descendre manuellement à travers chaque onglet. Seul l'état UI local à un onglet
        // (pagination, accordéons ouverts...) continue de transiter par les props ci-dessous.
        // Mémoïsé : tous les setters/handlers ici sont stables (voir plus haut), donc cet objet
        // ne change de référence que lorsque les données qu'il transporte changent réellement —
        // sans quoi tous les onglets se re-rendraient à chaque rendu de App, quelle qu'en soit la cause.
        const projectContextValue = useMemo(() => ({
            companyName, onUpdateCompanyName: setCompanyName,
            logoUrl, onUpdateLogoUrl: setLogoUrl,
            generalInfo: calculatedGeneralInfo, onUpdateGeneralInfo: handleUpdateGeneralInfo,
            products, onUpdateProducts: setProducts,
            baseIngredients, onUpdateIngredientsList: setBaseIngredients, ingredientsList,
            basePackaging, onUpdatePackagingList: setBasePackaging,
            laborDatabase, onUpdateLaborDatabase: setLaborDatabase,
            trackingPoints, setTrackingPoints,
            productionActivities, onUpdateProductionActivities: setProductionActivities,
            salesChannels, onUpdateSalesChannels: setSalesChannels,
            expenseLines, onUpdateExpenseLines: handleUpdateExpenseLines,
            revenueLines, onUpdateRevenueLines: setRevenueLines,
            directCostLines, onUpdateDirectCostLines: setDirectCostLines,
            repartitionKeys, onUpdateRepartitionKeys: setRepartitionKeys,
            analysisData,
            showNotification, setNotification,
        }), [
            companyName, setCompanyName, logoUrl, setLogoUrl,
            calculatedGeneralInfo, handleUpdateGeneralInfo,
            products, setProducts, baseIngredients, setBaseIngredients, ingredientsList,
            basePackaging, setBasePackaging,
            laborDatabase, setLaborDatabase, trackingPoints, setTrackingPoints,
            productionActivities, setProductionActivities, salesChannels, setSalesChannels,
            expenseLines, handleUpdateExpenseLines, revenueLines, setRevenueLines,
            directCostLines, setDirectCostLines, repartitionKeys, setRepartitionKeys,
            analysisData, showNotification, setNotification,
        ]);

        const renderActiveTab = () => {

            switch (activeTab) {
                case 'info': return <ProductInfo onNewProduct={handleAddNewProduct} onDeleteProduct={handleDeleteProduct} onDuplicateProduct={handleDuplicateProduct} handleProductValueChange={handleProductValueChange} handleFormatValueChange={handleFormatValueChange} handleFormatChannelPricesChange={handleFormatChannelPricesChange} onAddFormat={handleAddFormat} onDuplicateFormat={handleDuplicateFormat} onDeleteFormat={handleDeleteFormat} itemsPerPage={uiSettings.infoItemsPerPage} onItemsPerPageChange={(value) => handleUiSettingsChange('infoItemsPerPage', value)} onOpenSalesImport={() => setIsSalesImportWizardOpen(true)} />;

                case 'ingredients':
                    return <IngredientsTab
                        itemsPerPage={uiSettings.ingredientsItemsPerPage}
                        onItemsPerPageChange={(value) => handleUiSettingsChange('ingredientsItemsPerPage', value)}
                    />;

                case 'packaging':
                    return <PackagingTab
                        itemsPerPage={uiSettings.packagingItemsPerPage}
                        onItemsPerPageChange={(value) => handleUiSettingsChange('packagingItemsPerPage', value)}
                    />;

                case 'labor': return <LaborDatabaseTab openPostIds={openPostIds} setOpenPostIds={setOpenPostIds} />;
                case 'income-statement': return <IncomeStatementTab />;
                case 'recipe': return <RecipeCalculator editingProductIndex={editingProductIndex} initialFormatIndex={editingFormatIndex} onSelectProduct={selectProductForRecipe} openRecipeSections={openRecipeSections} setOpenRecipeSections={setOpenRecipeSections} onAddFormat={handleAddFormat} onDuplicateFormat={handleDuplicateFormat} />;

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
                    />

                    <PdfOptionsModal
                        isOpen={isPdfModalOpen}
                        onClose={() => setIsPdfModalOpen(false)}
                        onConfirm={handleConfirmPdfGeneration}
                        initialData={pdfOptions}
                    />

                    {/* Rendu seulement à l'ouverture : le chunk de l'assistant n'est chargé
                        que lorsqu'on en a besoin, pas au démarrage. */}
                    {isSalesImportWizardOpen && (
                        <Suspense fallback={null}>
                            <SalesReportImportWizardModal
                                isOpen={isSalesImportWizardOpen}
                                onClose={() => setIsSalesImportWizardOpen(false)}
                                onImportComplete={handleSalesReportImport}
                                products={products}
                                salesChannels={salesChannels}
                            />
                        </Suspense>
                    )}

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
                            {/* key={activeTab} : un onglet qui plante affiche l'UI de récupération
                                sans emporter le reste de l'app ; changer d'onglet remonte le garde-fou. */}
                            <ErrorBoundary key={activeTab}>
                                <Suspense fallback={<div className="w-full text-center py-16 text-gray-500">Chargement…</div>}>
                                    {renderActiveTab()}
                                </Suspense>
                            </ErrorBoundary>
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
