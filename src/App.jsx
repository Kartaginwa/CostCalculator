import React, { useState, useReducer, useRef, useMemo, useCallback, useEffect, useContext, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import {
    Users, ChefHat, Table, Info, ShoppingCart, Save, FolderOpen,
    PlusCircle, Settings, Package, TrendingUp,
} from 'lucide-react';

import { todayLocalISO, parseLocaleNumber, FORMAT_FLAT_MIRROR_FIELDS, sumLineAmounts, loadedHourlyRate } from './utils.js';
import {
    computeAnalysisData, computeIndirectPools,
} from './engine/analysisData.js';
import { computeSalesMixFromChannelPrices } from './engine/salesMixFromChannels.js';
import { findSubRecipeUsages, formatNameList } from './engine/usage.js';
import { computeLaborHoursNeeded } from './engine/laborHours.js';
import { clearFormatVolumes, mirrorFirstFormat } from './engine/productEdits.js';
import { generatePdf as generatePdfReport } from './reports/generatePdf.js';
import { exportToExcel as exportToExcelReport } from './reports/exportToExcel.js';
import { getDefaultState, getEmptyState, buildDefaultFormat, stripFormatOwnedFields, buildFormatSku } from './state/initialState.js';
import { projectReducer, toProjectState } from './state/projectReducer.js';
import { buildProjectData, parseProjectData } from './state/projectSerialization.js';
import { ProjectContext } from './state/ProjectContext.jsx';

import { Notification, WelcomeModal, OnboardingModal, PdfOptionsModal } from './components/AppDialogs.jsx';
import { TourSession } from './tour/TourSession.jsx';
import { InstructionModal } from './components/InstructionModal.jsx';
import { ConfirmationModal } from './components/common.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

import { ProductInfo } from './features/ProductInfo.jsx';
import { IngredientsTab } from './features/IngredientsTab.jsx';
import { PackagingTab } from './features/PackagingTab.jsx';
import { LaborDatabaseTab } from './features/LaborDatabaseTab.jsx';
import { IncomeStatementTab } from './features/IncomeStatementTab.jsx';
import { resetSessionMemory, SessionScopeContext, TooltipHostContext } from './ui-utils.jsx';

// Code-splitting : ces vues/wizards sont chargés à la demande (chunks séparés). Cela sort du
// bundle initial les dépendances lourdes qu'ils tirent — notamment recharts (SummaryTable, qui a
// absorbé l'ex-TrackingTab.jsx le 24/10) — et le code volumineux de RecipeCalculator et des
// assistants d'import.
const RecipeCalculator = lazy(() => import('./features/RecipeCalculator.jsx').then(m => ({ default: m.RecipeCalculator })));
const SummaryTable = lazy(() => import('./features/SummaryTable.jsx').then(m => ({ default: m.SummaryTable })));
const SalesReportImportWizardModal = lazy(() => import('./features/SalesReportImportWizardModal.jsx').then(m => ({ default: m.SalesReportImportWizardModal })));

// `tourMode` : instance de l'application jouée par la visite guidée (src/tour/). Elle charge sa propre copie du
// projet démo, ne partage aucune mémoire avec l'instance de l'utilisateur et ne peut rien sauvegarder.
const App = ({ tourMode = false } = {}) => {
    const sessionScope = useContext(SessionScopeContext);
    const [tooltipHost, setTooltipHost] = useState(null);
    // --- ÉTATS ---
    const [isProjectLoaded, setIsProjectLoaded] = useState(tourMode);

    // Données du projet (produits, ingrédients, main-d'œuvre, infos générales...) : centralisées
    // dans un reducer et exposées via ProjectContext pour éviter de les faire descendre
    // manuellement à travers chaque onglet (voir src/state/projectReducer.js).
    // Instance de la visite guidée : elle démarre directement sur sa propre copie du projet démo (rien à charger après coup).
    const [tourDemo] = useState(() => (tourMode ? getDefaultState() : null));
    const [projectState, dispatch] = useReducer(projectReducer, undefined, () => toProjectState(tourDemo || getEmptyState()));
    const { companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings } = projectState;

    // Setters stables (dispatch seul en dépendance, garanti stable par React) : la résolution
    // des mises à jour fonctionnelles (value => ...) se fait dans le reducer lui-même plutôt
    // que par fermeture sur projectState ici. Nécessaire pour pouvoir mémoïser sereinement
    // projectContextValue plus bas (sinon un nouveau setter à chaque rendu invaliderait le memo).
    const {
        setCompanyName, setLogoUrl, setGeneralInfo, setBaseIngredients, setBasePackaging,
        setProducts, setLaborDatabase, setTrackingPoints, setProductionActivities, setSalesChannels, setActiveUnits, setExpenseLines, setRevenueLines, setDirectCostLines, setRepartitionKeys, setUiSettings,
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
            setActiveUnits: makeSetter('SET_ACTIVE_UNITS'),
            setExpenseLines: makeSetter('SET_EXPENSE_LINES'),
            setRevenueLines: makeSetter('SET_REVENUE_LINES'),
            setDirectCostLines: makeSetter('SET_DIRECT_COST_LINES'),
            setRepartitionKeys: makeSetter('SET_REPARTITION_KEYS'),
            setUiSettings: makeSetter('SET_UI_SETTINGS'),
        };
    }, [dispatch]);

    const [activeTab, setActiveTab] = useState('info');
    // Mémorise la position de défilement de chaque onglet (retour utilisateur du 19/10), pour y
    // revenir exactement au même endroit en y revenant — plutôt que de repartir du haut, ou de
    // garder la position pixel de l'onglet précédent (qui ne correspond à rien de sensé une fois
    // le contenu remplacé). `renderActiveTab()` ne garde qu'un seul onglet monté à la fois (switch,
    // pas de montage simultané) : la position ne peut donc pas survivre nativement au changement,
    // d'où ce suivi manuel par onglet, keyé en ref pour ne jamais déclencher de re-render.
    const scrollPositionsRef = useRef({});
    const tourActiveRef = useRef(false);
    useEffect(() => {
        const handleScroll = () => {
            if (tourActiveRef.current) return; // pendant la visite, c'est l'autre instance qui fait défiler la page
            scrollPositionsRef.current[activeTab] = window.scrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [activeTab]);
    useEffect(() => {
        // Léger délai : le contenu de l'onglet (parfois chargé en lazy, voir Suspense plus bas)
        // doit d'abord avoir sa hauteur finale, sinon window.scrollTo n'a souvent nulle part où
        // aller — même patron de délai court déjà utilisé ailleurs dans l'app pour ce genre de
        // contrainte de timing DOM (ex. ProductInfo.jsx, scroll sur une ligne nouvellement ajoutée).
        const id = setTimeout(() => {
            window.scrollTo(0, scrollPositionsRef.current[activeTab] || 0);
        }, 100);
        return () => clearTimeout(id);
    }, [activeTab]);
    const [editingProductIndex, setEditingProductIndex] = useState(0);
    // Format ciblé au moment de naviguer vers Recette & Calcul (Phase 1.6b) : par défaut 0, ou le
    // format précis d'où vient la navigation (ex. clic sur une ligne du Résumé, qui représente
    // désormais un format, pas un produit). RecipeCalculator le consomme une fois pour initialiser
    // son onglet sélectionné, puis reprend la main sur ses propres clics d'onglet locaux.
    const [editingFormatIndex, setEditingFormatIndex] = useState(0);
    // Confirmation générique avant une suppression à conséquences (ex. une sous-recette utilisée par d'autres recettes).
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const requestConfirmation = useCallback((confirmation) => setPendingConfirmation(confirmation), []);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDemoConfirm, setShowDemoConfirm] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    // Ancre de section du guide à atteindre à l'ouverture (ex. depuis une infobulle : openGuide('guide-resume-simulation')).
    const [guideAnchor, setGuideAnchor] = useState(null);
    const openGuide = useCallback((anchor = null) => { setGuideAnchor(anchor); setShowInstructions(true); }, []);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const fileInputRef = useRef(null);
    const [appLogoBase64, setAppLogoBase64] = useState(null);
    const [appLogoDimensions, setAppLogoDimensions] = useState({ width: 1, height: 1 });
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    // Visite guidée : tant qu'elle joue, l'application de l'utilisateur reste montée (donc intacte) mais cachée.
    const [tourActive, setTourActive] = useState(false);
    const tourScrollRef = useRef(0);
    const [, setUndoState] = useState(null); // Pour la logique d'annulation

    const [openPostIds, setOpenPostIds] = useState(() => new Set(tourDemo ? tourDemo.laborDatabase.map(p => p.id) : []));
    const [openRecipeSections, setOpenRecipeSections] = useState(new Set(['ingredients', 'packaging', 'labor', 'indirects', 'recap']));

    // Position de l'utilisateur dans Rapport et suivi (24/10, retour utilisateur) : sous-onglet actif
    // et sélections (SKU/ingrédient/emballage), levées ici plutôt qu'en useState local de
    // SummaryTable — même patron que editingProductIndex/openRecipeSections ci-dessus pour
    // Production — pour que ça survive à une navigation vers un autre onglet puis un retour ici
    // (ex. vérifier un ingrédient, puis revenir exactement sur le même sous-onglet et le même SKU).
    const [reportActiveSubTab, setReportActiveSubTab] = useState('overview');
    const [reportSelectedSkuId, setReportSelectedSkuId] = useState(null);
    const [reportSelectedIngredientId, setReportSelectedIngredientId] = useState('');
    const [reportSelectedPackagingId, setReportSelectedPackagingId] = useState('');
    // Sous-onglets Par Activité / Par Canal : une ligne par activité/canal (révisé le 02/11), plus
    // de sélection à persister — `reportActiveSubTab` seul suffit pour revenir au bon sous-onglet.

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
                return sum + (paidHours * loadedHourlyRate(emp));
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
        // Les heures nécessaires viennent de `computeLaborHoursNeeded` (engine/laborHours.js) : les ventes de chaque format
        // actif ET ce que les autres recettes consomment de leurs sous-recettes, même jamais vendues seules (19/11 : avant,
        // le temps de fabrication d'une sous-recette non vendue n'était compté nulle part). Par poste, par activité de
        // production (celle de la recette qui la fabrique) et au total.
        const {
            byPost: totalDirectLaborHoursNeededByPost,
            byActivity: totalDirectLaborHoursNeededByActivity,
            total: totalDirectLaborHoursNeeded,
        } = computeLaborHoursNeeded(products, baseIngredients, salesChannels);

        // TOUS les postes de l'onglet Main-d'œuvre doivent se retrouver dans le coût des produits (décision du 19/11) :
        // les heures employées, la capacité inutilisée, le temps non productif (déjà reflété par le « % temps productif
        // attendu » de chaque employé) et même un poste sans aucune étape de recette.
        // Le facteur d'absorption est donc : coût direct des heures nécessaires ÷ masse salariale de TOUS les postes.
        // Chaque recette porte alors sa part de la paie, au prorata de son coût de main-d'œuvre directe : la paie de la
        // cuisine est entièrement répartie sur les produits quand le volume la remplit. La valeur exposée
        // (`kitchenProductivity`) peut dépasser 100 % quand le volume dépasse la paie ; c'est son USAGE qui est plafonné à
        // 100 % (calculateCosts.js) : au-delà, la main-d'œuvre est comptée au taux horaire plein, jamais moins — un surplus de
        // capacité n'enlève pas de coût.
        // Le coût d'un poste est son taux moyen pondéré par les heures payées, comme dans calculateCosts.js.
        const directLaborCostNeeded = laborDatabase.reduce((total, post) => {
            const emps = post.employees || [];
            const hours = emps.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
            if (!(hours > 0)) return total;
            const cost = emps.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours) * loadedHourlyRate(emp), 0);
            return total + (totalDirectLaborHoursNeededByPost[post.postName] || 0) * (cost / hours);
        }, 0);
        const kitchenProductivity = autoCalculatedLaborCost > 0 ? (directLaborCostNeeded / autoCalculatedLaborCost) * 100 : 100;

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
    }, [generalInfo, products, baseIngredients, laborDatabase, autoCalculatedLaborCost, productionActivities, salesChannels]);
    // --- MOTEUR DE DONNÉES CENTRALISÉ ET MÉMORISÉ ---
    // Source unique de vérité pour les coûts : computeAnalysisData calcule productsWithCosts une
    // seule fois (avec un memo partagé) puis en dérive tous les KPIs. Défini ici, avant
    // ingredientsList, pour que ce dernier — comme les autres consommateurs (RecipeCalculator,
    // Rapport et suivi) — réutilise ces coûts au lieu de relancer un calcul redondant.
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
    const analysisDataDraft = useMemo(
        () => computeAnalysisData(products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels),
        [products, baseIngredients, laborDatabase, generalInfo, calculatedGeneralInfo, basePackaging, salesChannels]
    );

    // Pools de frais fixes : construits par le moteur (computeIndirectPools), le même appel que le simulateur de
    // chocs. La part de frais fixes qu'aucune ligne n'a répartie est comptée dans Général (jamais perdue) ;
    // `indirectPools.meta` la signale (vérifications du projet).
    const indirectPools = useMemo(
        () => computeIndirectPools(analysisDataDraft.productsWithCosts, { expenseLines, repartitionKeys, revenueLines, directCostLines, productionActivities, salesChannels, generalInfo }),
        [expenseLines, repartitionKeys, revenueLines, directCostLines, productionActivities, salesChannels, analysisDataDraft.productsWithCosts, generalInfo]
    );

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
                    lastUpdated: todayLocalISO()
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
        const newFormat = clearFormatVolumes(JSON.parse(JSON.stringify(formatToDuplicate)));
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
        showNotification({ message: 'Format copié sans ses volumes de vente : saisissez-les dans la colonne Canaux.', type: 'info' });
    };

    const handleDeleteFormat = (productIndex, formatIndex) => {
        const product = products[productIndex];
        if (product.formats.length <= 1) {
            // Dernier format du produit : supprime le produit entier (même comportement et
            // même notification annulable que le bouton "Supprimer le produit" existant).
            handleDeleteProduct(productIndex);
            return;
        }
        const formatToDelete = product.formats[formatIndex];
        // Une sous-recette dont CE format est utilisé ailleurs : prévenir avant de laisser des lignes de recette sans référence.
        const usages = findSubRecipeUsages(products, product, formatToDelete.id);
        const performDelete = () => {
            const newFormats = product.formats.filter((_, i) => i !== formatIndex);
            // Le premier format alimente les champs « à plat » du produit : si c'est lui qu'on retire, le suivant prend le relais.
            const updated = mirrorFirstFormat({ ...product, formats: newFormats });
            const newProducts = [...products];
            newProducts[productIndex] = updated;
            setProducts(newProducts);
            setEditingFormatIndex(prev => (editingProductIndex !== productIndex ? prev : Math.max(0, Math.min(prev > formatIndex ? prev - 1 : prev, newFormats.length - 1))));

            showNotification({
                message: `Le format "${formatToDelete.sku || 'sans SKU'}" a été supprimé.`,
                type: 'info',
                // Annuler remet CE format à sa place, sans toucher au reste du projet (les modifications faites entre-temps sont conservées).
                onUndo: () => {
                    setProducts(current => current.map(p => {
                        if (p.id !== product.id) return p;
                        const restored = [...(p.formats || [])];
                        restored.splice(Math.min(formatIndex, restored.length), 0, formatToDelete);
                        return mirrorFirstFormat({ ...p, formats: restored });
                    }));
                    setNotification(null);
                }
            });
        };
        if (usages.length > 0) {
            requestConfirmation({
                title: 'Supprimer ce format ?',
                message: `Le format « ${formatToDelete.sku || 'sans SKU'} » de la sous-recette « ${product.platName || 'Sans nom'} » est utilisé dans : ${formatNameList(usages)}. Ces recettes compteront cette ligne à 0 $ jusqu'à ce que vous choisissiez un autre ingrédient. Vous pourrez annuler juste après.`,
                onConfirm: performDelete,
            });
            return;
        }
        performDelete();
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
        // Une sous-recette utilisée par d'autres recettes : prévenir avant de leur retirer un ingrédient (le moteur le compterait à 0 $).
        const usages = findSubRecipeUsages(products, productToDelete);
        if (usages.length > 0) {
            requestConfirmation({
                title: 'Supprimer cette sous-recette ?',
                message: `« ${productToDelete.platName || 'Sans nom'} » est utilisée comme ingrédient dans : ${formatNameList(usages)}. Ces recettes compteront cette ligne à 0 $ jusqu'à ce que vous choisissiez un autre ingrédient. Vous pourrez annuler juste après.`,
                onConfirm: () => performDeleteProduct(indexToDelete),
            });
            return;
        }
        performDeleteProduct(indexToDelete);
    };

    const performDeleteProduct = (indexToDelete) => {
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
            message: `Le produit "${productToDelete.platName}" a été supprimé.`,
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
        newProduct.formats = (newProduct.formats || []).map(clearFormatVolumes).map(f => {
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
        // Les champs « à plat » (miroir du premier format) repartent eux aussi sans ventes.
        newProduct.salesMix = 0;
        newProducts.splice(indexToDuplicate + 1, 0, newProduct);
        setProducts(newProducts);
        showNotification({ message: 'Produit copié sans ses volumes de vente : saisissez-les dans la colonne Canaux de chaque format.', type: 'info' });
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
    const startTour = useCallback(() => {
        tourScrollRef.current = window.scrollY;
        tourActiveRef.current = true;
        setShowInstructions(false);
        setShowOnboardingModal(false);
        setTourActive(true);
        window.scrollTo(0, 0);
    }, []);

    const handleSkipTutorial = () => {
        setShowOnboardingModal(false);
    };

    // Fin de la visite : `action` = ce que l'utilisateur a choisi sur la carte finale (rien, le démo, un projet neuf, le guide).
    const endTour = (action) => {
        tourActiveRef.current = false;
        setTourActive(false);
        resetSessionMemory('tour:');
        const y = tourScrollRef.current;
        setTimeout(() => window.scrollTo(0, y), 0);
        if (action === 'guide') openGuide();
        if (action === 'new') setShowResetConfirm(true);
        if (action === 'demo') { if (isProjectLoaded) setShowDemoConfirm(true); else handleConfirmLoadExample(); }
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
        setActiveUnits(emptyState.activeUnits);
        setExpenseLines(emptyState.expenseLines);
        setRevenueLines(emptyState.revenueLines);
        setDirectCostLines(emptyState.directCostLines);
        setRepartitionKeys(emptyState.repartitionKeys);
        setOpenPostIds(new Set()); // Vide la liste pour un nouveau projet
        setEditingProductIndex(0);
        setActiveTab('info');
        setShowResetConfirm(false);
        resetSessionMemory(sessionScope); setProjectEpoch(e => e + 1);
        setIsProjectLoaded(true);
        setBaselineTick(t => t + 1);
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
        setActiveUnits(defaultState.activeUnits);
        setExpenseLines(defaultState.expenseLines);
        setRevenueLines(defaultState.revenueLines);
        setDirectCostLines(defaultState.directCostLines);
        setRepartitionKeys(defaultState.repartitionKeys);
        setOpenPostIds(new Set(defaultState.laborDatabase.map(p => p.id)));
        setEditingProductIndex(0);
        setActiveTab('info');
        if (!tourMode) showNotification({ message: "Projet d'exemple chargé avec succès !", type: 'success' });
        resetSessionMemory(sessionScope); setProjectEpoch(e => e + 1);
        setIsProjectLoaded(true);
        setBaselineTick(t => t + 1);
    };

    // --- MODIFICATIONS NON SAUVEGARDÉES ---
    // L'app n'a pas de sauvegarde automatique : le travail vit en mémoire jusqu'au clic sur
    // « Sauvegarder ». On compare la sérialisation courante à celle prise au dernier
    // chargement / enregistrement (baselineTick déclenche la prise de photo après que les
    // nouveaux états ont été appliqués).
    const currentProjectJson = useMemo(() => JSON.stringify(buildProjectData({
        companyName, logoUrl, generalInfo, baseIngredients, basePackaging,
        products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings,
    })), [companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings]);
    const [savedProjectJson, setSavedProjectJson] = useState(null);
    const [baselineTick, setBaselineTick] = useState(0);
    useEffect(() => {
        if (baselineTick > 0) setSavedProjectJson(currentProjectJson);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baselineTick]);
    const hasUnsavedChanges = !tourMode && isProjectLoaded && savedProjectJson !== null && currentProjectJson !== savedProjectJson;
    useEffect(() => {
        if (!hasUnsavedChanges) return undefined;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedChanges]);

    const saveProject = () => {
        try {
            const projectData = buildProjectData({
                companyName, logoUrl, generalInfo, baseIngredients, basePackaging,
                products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings,
            });

            const jsonString = JSON.stringify(projectData, null, 2);
            setSavedProjectJson(JSON.stringify(projectData));
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

    const [showOpenConfirm, setShowOpenConfirm] = useState(false);
    // Change à chaque nouveau projet / ouverture / démo : force le remontage de l'onglet affiché pour
    // que sa mémoire locale (filtres, sélection) reparte de zéro avec le nouveau projet.
    const [projectEpoch, setProjectEpoch] = useState(0);
    const openProject = () => {
        if (hasUnsavedChanges) { setShowOpenConfirm(true); return; }
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
                setActiveUnits(parsed.activeUnits);
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
                resetSessionMemory(sessionScope); setProjectEpoch(e => e + 1);
                setIsProjectLoaded(true);
                setBaselineTick(t => t + 1);
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
    
    // Deux blocs frères (et non un seul conteneur) : la barre d'onglets est « collante » (sticky) et
    // ne peut l'être que par rapport à un parent aussi haut que la page — le conteneur d'App.
    // L'en-tête (logo + boutons) défile normalement ; seule la barre reste en haut. Son
    // espacement du dessous (mb-4) existe au repos seulement : barre collée, le contenu défile juste dessous
    // (décision du 18/11 : l'interstice fixe sur fond de page n'était pas esthétique).
    const renderContent = () => (
            <>
            <div className="w-full max-w-7xl mt-2">
                <div className="flex justify-between items-end mb-4">
                    <img src="./Logo_RestoCalculateur3.png" alt="Logo TransfoCalculateur" className="h-28 w-auto" />
                    <div id="tutorial-main-functions" className="flex space-x-2 items-center">
                        {hasUnsavedChanges && (
                            <span data-testid="unsaved-indicator" title="Votre travail n'est conservé qu'en mémoire : cliquez sur « Sauvegarder » pour l'enregistrer dans un fichier." className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 mr-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>Modifications non sauvegardées
                            </span>
                        )}
                        <button onClick={() => openGuide()} title="Guide d'utilisation" className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-200 hover:bg-gray-300">
                            <Info className="h-5 w-5" />
                        </button>
                        <button onClick={() => setShowResetConfirm(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            <PlusCircle className="h-5 w-5 mr-2" /> Nouveau projet
                        </button>
                        <button onClick={saveProject} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            <Save className="h-5 w-5 mr-2" /> Sauvegarder
                        </button>
                        <button onClick={openProject} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                            <FolderOpen className="h-5 w-5 mr-2" /> Ouvrir
                        </button>
                    </div>
                </div>
            </div>
            <div className="sticky top-0 z-30 w-full max-w-7xl mb-4">
                <div id="tutorial-tab-bar" className="flex bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden">
                    <button id="tab-info" aria-current={activeTab === 'info' ? 'page' : undefined} onClick={() => setActiveTab('info')} className={getTabClasses('info')}><Settings className="h-5 w-5 mr-2" /> Paramètres</button>
                    <button id="tab-ingredients" aria-current={activeTab === 'ingredients' ? 'page' : undefined} onClick={() => setActiveTab('ingredients')} className={getTabClasses('ingredients')}><ShoppingCart className="h-5 w-5 mr-2" /> Ingrédients</button>
                    <button id="tab-packaging" aria-current={activeTab === 'packaging' ? 'page' : undefined} onClick={() => setActiveTab('packaging')} className={getTabClasses('packaging')}><Package className="h-5 w-5 mr-2" /> Emballage</button>
                    <button id="tab-labor" aria-current={activeTab === 'labor' ? 'page' : undefined} onClick={() => setActiveTab('labor')} className={getTabClasses('labor')}><Users className="h-5 w-5 mr-2" /> Main-d'œuvre</button>
                    <button id="tab-recipe" aria-current={activeTab === 'recipe' ? 'page' : undefined} onClick={() => setActiveTab('recipe')} className={getTabClasses('recipe')}><ChefHat className="h-5 w-5 mr-2" /> Production</button>
                    <button id="tab-income-statement" aria-current={activeTab === 'income-statement' ? 'page' : undefined} onClick={() => setActiveTab('income-statement')} className={getTabClasses('income-statement')}><Table className="h-5 w-5 mr-2" /> État des résultats</button>
                    <button id="tab-summary" aria-current={activeTab === 'summary' ? 'page' : undefined} onClick={() => setActiveTab('summary')} className={getTabClasses('summary')}><TrendingUp className="h-5 w-5 mr-2" /> Rapport et suivi</button>
                </div>
            </div>
            </>
        );

        // Données et setters du projet, exposés via ProjectContext pour éviter de les faire
        // descendre manuellement à travers chaque onglet. Seul l'état UI local à un onglet
        // (pagination, accordéons ouverts...) continue de transiter par les props ci-dessous.
        // Mémoïsé : tous les setters/handlers ici sont stables (voir plus haut), donc cet objet
        // ne change de référence que lorsque les données qu'il transporte changent réellement —
        // sans quoi tous les onglets se re-rendraient à chaque rendu de App, quelle qu'en soit la cause.
        const projectContextValue = useMemo(() => ({
            goToTab: setActiveTab,
            openGuide,
            startTour: tourMode ? null : startTour,
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
            activeUnits, onUpdateActiveUnits: setActiveUnits,
            expenseLines, onUpdateExpenseLines: handleUpdateExpenseLines,
            revenueLines, onUpdateRevenueLines: setRevenueLines,
            directCostLines, onUpdateDirectCostLines: setDirectCostLines,
            repartitionKeys, onUpdateRepartitionKeys: setRepartitionKeys,
            analysisData, indirectPools,
            uiSettings, setUiSettings,
            showNotification, setNotification, requestConfirmation,
        }), [
            tourMode, startTour, openGuide, requestConfirmation,
            companyName, setCompanyName, logoUrl, setLogoUrl,
            calculatedGeneralInfo, handleUpdateGeneralInfo,
            products, setProducts, baseIngredients, setBaseIngredients, ingredientsList,
            basePackaging, setBasePackaging,
            laborDatabase, setLaborDatabase, trackingPoints, setTrackingPoints,
            productionActivities, setProductionActivities, salesChannels, setSalesChannels,
            activeUnits, setActiveUnits,
            expenseLines, handleUpdateExpenseLines, revenueLines, setRevenueLines,
            directCostLines, setDirectCostLines, repartitionKeys, setRepartitionKeys,
            analysisData, indirectPools, uiSettings, setUiSettings, showNotification, setNotification,
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
                        activeSubTab={reportActiveSubTab}
                        onActiveSubTabChange={setReportActiveSubTab}
                        selectedSkuId={reportSelectedSkuId}
                        onSelectedSkuIdChange={setReportSelectedSkuId}
                        selectedIngredientId={reportSelectedIngredientId}
                        onSelectedIngredientIdChange={setReportSelectedIngredientId}
                        selectedPackagingId={reportSelectedPackagingId}
                        onSelectedPackagingIdChange={setReportSelectedPackagingId}
                    />;

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
                <TooltipHostContext.Provider value={tooltipHost}>
                <div className="bg-gray-100 min-h-screen p-4 flex flex-col items-center" style={tourActive ? { display: 'none' } : undefined}>
                    {notification && notification.message && (
                        <Notification
                            message={notification.message}
                            type={notification.type}
                            onClose={notification.onClose}
                            onUndo={notification.onUndo}
                        />
                    )}
                    <ConfirmationModal
                        isOpen={!!pendingConfirmation}
                        onClose={() => setPendingConfirmation(null)}
                        onConfirm={() => { const action = pendingConfirmation?.onConfirm; setPendingConfirmation(null); if (action) action(); }}
                        title={pendingConfirmation?.title || ''}
                    >
                        {pendingConfirmation?.message}
                    </ConfirmationModal>
                    <ConfirmationModal
                        isOpen={showDemoConfirm}
                        onClose={() => setShowDemoConfirm(false)}
                        onConfirm={() => { setShowDemoConfirm(false); handleConfirmLoadExample(); }}
                        title="Charger le projet démo"
                    >
                        Le projet démo remplacera votre projet actuel. Les modifications non sauvegardées seront perdues. Voulez-vous continuer ?
                    </ConfirmationModal>
                    <ConfirmationModal
                        isOpen={showResetConfirm}
                        onClose={() => setShowResetConfirm(false)}
                        onConfirm={handleConfirmReset}
                        title="Réinitialiser le projet"
                    >
                        Êtes-vous sûr de vouloir effacer toutes les données et commencer un nouveau projet ? Cette action est irréversible.
                    </ConfirmationModal>
                    <ConfirmationModal
                        isOpen={showOpenConfirm}
                        onClose={() => setShowOpenConfirm(false)}
                        onConfirm={() => { setShowOpenConfirm(false); fileInputRef.current.click(); }}
                        title="Ouvrir un autre projet"
                    >
                        Vous avez des modifications non sauvegardées. Ouvrir un autre projet les remplacera. Voulez-vous continuer ?
                    </ConfirmationModal>

                    <OnboardingModal
                        isOpen={showOnboardingModal}
                        onStart={startTour}
                        onSkip={handleSkipTutorial}
                    />
                    <InstructionModal
                        isOpen={showInstructions}
                        anchor={guideAnchor}
                        appLogoBase64={appLogoBase64}
                        appLogoDimensions={appLogoDimensions}
                        onClose={() => { setShowInstructions(false); setGuideAnchor(null); }}
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
                            onTour={tourMode ? undefined : startTour}
                        />
                    ) : (
                        <>
                            {renderContent()}
                            {/* key={activeTab} : un onglet qui plante affiche l'UI de récupération
                                sans emporter le reste de l'app ; changer d'onglet remonte le garde-fou. */}
                            <ErrorBoundary key={activeTab}>
                                <Suspense fallback={<div className="w-full text-center py-16 text-gray-500">Chargement…</div>}>
                                    <React.Fragment key={projectEpoch}>{renderActiveTab()}</React.Fragment>
                                </Suspense>
                            </ErrorBoundary>
                            <footer className="w-full text-center py-4 mt-8 text-gray-500 text-sm">
                                <p>© {new Date().getFullYear()} Antoine Thibault-Lepage. Tous droits réservés.</p>
                            </footer>
                        </>
                    )}
                </div>
                <div id="tooltip-root" ref={setTooltipHost}></div>
                </TooltipHostContext.Provider>
                {tourActive && !tourMode && ReactDOM.createPortal(
                    <TourSession AppComponent={App} onExit={endTour} />,
                    document.getElementById('tour-root') || document.body
                )}
            </ProjectContext.Provider>
        );
    };

export default App;
