import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Bar, LabelList, Cell } from 'recharts';
import { ArrowUpDown, FileDown, Pencil, AlertTriangle, ChevronDown } from 'lucide-react';
import { unnamedLabel, parseLocaleNumber, formatCurrency, formatPercent, snapshotDateLabel } from '../utils.js';
import { useSessionState, useStateResetOnChange } from '../ui-utils.jsx';
import { Pagination, EmptyState } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { CostShockSimulator } from './CostShockSimulator.jsx';
import { computeActivitySummaries, computeChannelSummaries, computeActivityChannelMarginMatrix } from '../engine/analysisData.js';
import { computeGlobalSeries, computeProductSeries, isProductPriced } from '../engine/trackingSeries.js';
import { computeProjectChecks } from '../engine/projectChecks.js';
import { computeIngredientVolatility, computePackagingVolatility } from '../engine/priceVolatility.js';
import { AbcAnalysis } from './reports/AbcAnalysis.jsx';
import { PurchasingReport } from './reports/PurchasingReport.jsx';
import { LaborReport } from './reports/LaborReport.jsx';
import { ReconciliationReport } from './reports/ReconciliationReport.jsx';
import { ActivityLaborSection } from './reports/ActivityLaborSection.jsx';
import { FindingsProvider, StrengthsFindings, TabFindings } from './reports/KeyFindings.jsx';
import { VolatilityTable } from './summary/VolatilityTable.jsx';
import { SimpleLineChart } from './summary/SimpleLineChart.jsx';
import { SnapshotDetailsModal, ManagePointsModal, PointDeReferenceMenu } from './summary/SnapshotModals.jsx';
import { BySkuWaterfall, SegmentSummaryTable } from './summary/BySkuParts.jsx';
import { StrategicAnalysis, BcgMatrix } from './summary/PortfolioParts.jsx';
import { getMarginCellStyle } from './summary/summaryUtils.js';

// Sous-onglets de Rapport et suivi (refonte du 21/11), en quatre groupes séparés par un trait : Vue d'ensemble | produits et segments |
// approvisionnement et équipe | simulation. L'ancien sous-onglet « Intrants » est scindé en Ingrédients et Emballages.
const REPORT_SUBTAB_GROUPS = [
    [{ id: 'overview', label: "Vue d'ensemble" }],
    [{ id: 'portfolio', label: 'Portefeuille' }, { id: 'bySku', label: 'Par SKU' }, { id: 'byActivity', label: 'Par activité' }, { id: 'byChannel', label: 'Par canal' }],
    [{ id: 'ingredients', label: 'Ingrédients' }, { id: 'packaging', label: 'Emballages' }, { id: 'labor', label: "Main-d'œuvre" }],
    [{ id: 'simulation', label: 'Simulation' }],
];

// Les composants du Rapport et suivi (volatilité, graphique de suivi, fenêtres des relevés, cascade Par SKU, portefeuille) vivent dans ./summary/ depuis le 24/11 (audit).
// Onglet 4: Résumé
export const SummaryTable = ({
    onEditProduct, onOpenPdfModal, exportToExcel, itemsPerPage, onItemsPerPageChange,
    // « Position » de l'utilisateur dans cet onglet (24/10, retour utilisateur) : contrôlée depuis
    // App.jsx (comme `editingProductIndex`/`openRecipeSections` le sont déjà pour Production) —
    // jamais un useState local, pour que ça survive à une navigation vers un autre onglet puis un
    // retour ici (ex. vérifier un ingrédient, puis revenir exactement sur le même sous-onglet et le
    // même SKU). Voir Projet_Claude/03-Feuille-de-route.md.
    activeSubTab, onActiveSubTabChange, selectedSkuId, onSelectedSkuIdChange,
    selectedIngredientId, onSelectedIngredientIdChange, selectedPackagingId, onSelectedPackagingIdChange,
}) => {
    const {
        products, generalInfo, laborDatabase, analysisData, salesChannels, productionActivities,
        trackingPoints, setTrackingPoints, baseIngredients, basePackaging, showNotification, setNotification, goToTab, indirectPools,
    } = useProject();
    // Valeur d'un ancien sous-onglet (« intrants ») : traitée comme Ingrédients.
    const subTab = activeSubTab === 'intrants' ? 'ingredients' : activeSubTab;
    const [sortConfig, setSortConfig] = useSessionState('summary.contributionSort', { key: 'costs.margeNettePercent', direction: 'descending' });
    const [contributionPage, setContributionPage] = useState(1);
    const [showChecks, setShowChecks] = useState(false);
    const projectChecks = useMemo(() => computeProjectChecks({
        products, baseIngredients, basePackaging, productionActivities, salesChannels, trackingPoints, fixedCosts: indirectPools?.meta,
    }), [products, baseIngredients, basePackaging, productionActivities, salesChannels, trackingPoints, indirectPools]);
    const [currentPage, setCurrentPage] = useStateResetOnChange(1, [sortConfig]);

    // --- LOGIQUE CENTRALISÉE ---
    const { productsWithCosts, contributionData } = analysisData;

    // Liste des SKU pour le sélecteur de « Par SKU », triée par nom pour rester repérable.
    const skuOptions = useMemo(
        () => [...productsWithCosts].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'fr', { sensitivity: 'base' })),
        [productsWithCosts]
    );
    // Repli robuste : aucun SKU choisi OU un SKU qui n'existe plus (changement de projet) retombe
    // sur le premier SKU disponible — jamais un tableau figé sur « Aucun SKU » alors que les produits actifs en
    // contient (l'ancienne condition `!selectedSkuId` seule ne couvrait pas ce second cas).
    useEffect(() => {
        // Préfère un SKU rattaché à au moins un canal : une sous-recette (sans canal) n'offre aucune
        // cascade à afficher, un mauvais écran d'accueil pour cet onglet.
        if (skuOptions.length > 0 && !skuOptions.some(o => o.id === selectedSkuId)) {
            onSelectedSkuIdChange((skuOptions.find(o => (o.channelBreakdown || []).length > 0) || skuOptions[0]).id);
        }
    }, [skuOptions, selectedSkuId, onSelectedSkuIdChange]);
    const selectedSkuRow = productsWithCosts.find(p => p.id === selectedSkuId) || null;

    // Par activité / Par canal (révisé le 02/11, retour utilisateur) : une ligne par activité (ou
    // par canal), chacune réduite à son propre TOTAL — plus de sélecteur, plus de ventilation par
    // l'autre axe (voir SegmentSummaryTable ci-dessus pour la justification complète du
    // changement). Une activité/un canal sans aucune vente réelle en est simplement absent (voir
    // computeActivitySummaries/computeChannelSummaries, analysisData.js).
    const activitySummaries = useMemo(
        () => computeActivitySummaries(productsWithCosts, productionActivities),
        [productsWithCosts, productionActivities]
    );
    const channelSummaries = useMemo(
        () => computeChannelSummaries(productsWithCosts, salesChannels),
        [productsWithCosts, salesChannels]
    );

    // --- SECTION SUIVI (fusionnée dans Rapport le 24/10, retour utilisateur) ---
    const priceVolatility = useMemo(() => computeIngredientVolatility(trackingPoints), [trackingPoints]);
    const packagingVolatility = useMemo(() => computePackagingVolatility(trackingPoints), [trackingPoints]);

    // Quels points de référence alimentent les graphiques ci-dessous (pas seulement la modale de
    // gestion, dont le tri/filtre/pagination restent purement locaux à son affichage) — les 15 plus
    // récents par défaut.
    const [selectedSnapshotIds, setSelectedSnapshotIds] = useState(new Set());
    useEffect(() => {
        if (trackingPoints.length > 0) {
            setSelectedSnapshotIds(new Set(trackingPoints.slice(-15).map(p => p.id)));
        } else {
            setSelectedSnapshotIds(new Set());
        }
    }, [trackingPoints]);
    const displayedTrackingPoints = useMemo(
        () => trackingPoints.filter(p => selectedSnapshotIds.has(p.id)),
        [trackingPoints, selectedSnapshotIds]
    );

    // Séries d'évolution calculées par le moteur (engine/trackingSeries.js), partagées avec le rapport PDF : mêmes variables, mêmes règles de données absentes.
    const globalKpiData = useMemo(() => computeGlobalSeries(displayedTrackingPoints), [displayedTrackingPoints]);

    // Évolution des coûts du SKU sélectionné ci-dessus (« Par SKU ») — ex-« Analyse par format » de
    // l'onglet Suivi, fusionnée le 24/10 : réutilise le MÊME sélecteur de SKU plutôt qu'un second
    // indépendant, qui pouvait pointer vers un autre produit (source de confusion).
    const productKpiData = useMemo(() => computeProductSeries(displayedTrackingPoints, selectedSkuId), [displayedTrackingPoints, selectedSkuId]);

    // Un format sans prix de vente (sous-recette jamais vendue seule) a tous ses ratios en % forcés
    // à 0 par calculateCosts.js (division par un prix nul) — le graphique basculerait alors sur une
    // ligne plate à 0 % trompeuse. On y bascule donc les coûts en $/unité, toujours significatifs.
    const selectedProductIsPriced = useMemo(() => isProductPriced(displayedTrackingPoints, selectedSkuId), [displayedTrackingPoints, selectedSkuId]);

    const trackableIngredients = useMemo(() => {
        const allIngredients = new Map();
        trackingPoints.forEach(point => {
            (point.baseIngredients || []).forEach(ing => {
                if (!allIngredients.has(ing.id)) allIngredients.set(ing.id, ing.name);
            });
        });
        return Array.from(allIngredients, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);
    useEffect(() => {
        if (trackableIngredients.length > 0 && !trackableIngredients.some(i => i.id === selectedIngredientId)) {
            onSelectedIngredientIdChange(trackableIngredients[0].id);
        }
    }, [trackableIngredients, selectedIngredientId, onSelectedIngredientIdChange]);
    const ingredientPriceData = useMemo(() => {
        if (!selectedIngredientId) return [];
        return displayedTrackingPoints.map(point => {
            const ingredientData = (point.baseIngredients || []).find(ing => String(ing.id) === String(selectedIngredientId));
            return {
                name: snapshotDateLabel(point.timestamp),
                label: point.name,
                note: point.note,
                "Prix unitaire": ingredientData ? ingredientData.unitPrice : null,
            };
        });
    }, [displayedTrackingPoints, selectedIngredientId]);

    // Emballage : toujours un suivi SÉPARÉ de celui des ingrédients (jamais fusionné), par cohérence
    // avec la Phase 2 (coût d'emballage comme poste distinct du coût matière).
    const trackablePackaging = useMemo(() => {
        const allPackaging = new Map();
        trackingPoints.forEach(point => {
            (point.basePackaging || []).forEach(pkg => {
                if (!allPackaging.has(pkg.id)) allPackaging.set(pkg.id, pkg.name);
            });
        });
        return Array.from(allPackaging, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [trackingPoints]);
    useEffect(() => {
        if (trackablePackaging.length > 0 && !trackablePackaging.some(p => p.id === selectedPackagingId)) {
            onSelectedPackagingIdChange(trackablePackaging[0].id);
        }
    }, [trackablePackaging, selectedPackagingId, onSelectedPackagingIdChange]);
    const packagingPriceData = useMemo(() => {
        if (!selectedPackagingId) return [];
        return displayedTrackingPoints.map(point => {
            const packagingData = (point.basePackaging || []).find(pkg => String(pkg.id) === String(selectedPackagingId));
            return {
                name: snapshotDateLabel(point.timestamp),
                label: point.name,
                note: point.note,
                "Prix unitaire": packagingData ? packagingData.unitPrice : null,
            };
        });
    }, [displayedTrackingPoints, selectedPackagingId]);

    // Modales « Point de référence » (menu déroulant déplacé sous les boutons d'export, 24/10 — ex-
    // bouton unique « Créer un point de référence »).
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [editingSnapshot, setEditingSnapshot] = useState(null);

    const handleSaveSnapshot = ({ name, note }) => {
        if (editingSnapshot) {
            setTrackingPoints(prev => prev.map(p => (p.id === editingSnapshot.id ? { ...p, name, note } : p)));
            showNotification({ message: "Point de référence mis à jour !", type: 'success' });
        } else {
            // On capture les coûts déjà calculés dans la source unique (analysisData.productsWithCosts)
            // plutôt que de les recalculer. Le deep-clone fige la copie, indépendante des recalculs
            // ultérieurs.
            const newSnapshot = {
                id: Date.now(),
                name: name || snapshotDateLabel(Date.now()),
                note: note || '',
                timestamp: new Date().toISOString(),
                generalInfo: { ...generalInfo },
                productsWithCosts: JSON.parse(JSON.stringify(productsWithCosts)),
                baseIngredients: JSON.parse(JSON.stringify(baseIngredients)),
                basePackaging: JSON.parse(JSON.stringify(basePackaging)),
            };
            setTrackingPoints(prev => [...prev, newSnapshot]);
            showNotification({ message: "Point de référence créé avec succès !", type: 'success' });
        }
        setIsSnapshotModalOpen(false);
        setEditingSnapshot(null);
    };

    const handleDeleteSnapshot = (idToDelete) => {
        const pointToDelete = trackingPoints.find(p => p.id === idToDelete);
        if (!pointToDelete) return;
        const originalTrackingPoints = [...trackingPoints];
        const originalSelectedIds = new Set(selectedSnapshotIds);
        const newTrackingPoints = trackingPoints.filter(p => p.id !== idToDelete);
        const newSelectedIds = new Set(selectedSnapshotIds);
        newSelectedIds.delete(idToDelete);
        setTrackingPoints(newTrackingPoints);
        setSelectedSnapshotIds(newSelectedIds);
        showNotification({
            message: `Le point de référence «\u00A0${pointToDelete.name}\u00A0» a été supprimé.`,
            type: 'info',
            onUndo: () => {
                setTrackingPoints(originalTrackingPoints);
                setSelectedSnapshotIds(originalSelectedIds);
                setNotification(null);
            }
        });
    };

    const handleSnapshotSelectionChange = (id) => {
        setSelectedSnapshotIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    };
    const handleSnapshotSelectAll = (idsInScope, checked) => {
        setSelectedSnapshotIds(prev => {
            const next = new Set(prev);
            idsInScope.forEach(id => (checked ? next.add(id) : next.delete(id)));
            return next;
        });
    };
    const openEditSnapshotModal = (snapshot) => {
        setIsManageModalOpen(false);
        setEditingSnapshot(snapshot);
        setIsSnapshotModalOpen(true);
    };

    // Trie aussi par colonne de canal (clé "channel:<id>", voir la matrice « Marges nettes des SKUs
    // par canaux ») : lit la marge nette (%) de ce canal pour ce SKU dans son channelBreakdown
    // (absent → null, un SKU non vendu dans ce canal). Un « — » (valeur null) reste toujours en fin
    // de liste, peu importe le sens du tri — jamais interprété comme 0 %, qui le classerait parmi
    // les moins rentables plutôt que de le mettre à part.
    const getNestedValue = (obj, path) => {
        if (path.startsWith('channel:')) {
            const channelId = path.slice('channel:'.length);
            const cb = (obj.channelBreakdown || []).find(c => c.channelId === channelId);
            return cb ? cb.margeNettePercent : null;
        }
        return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
    };

    const sortedProducts = useMemo(() => {
        let sortableItems = [...productsWithCosts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);

                // On détecte si la colonne est numérique (Prix, Mix, n'importe quel champ de
                // costs.*, ou une colonne de canal).
                const isNumeric = sortConfig.key.includes('costs.') || sortConfig.key === 'prixVente' || sortConfig.key === 'salesMix' || sortConfig.key.startsWith('channel:');

                if (isNumeric) {
                    const aNum = (aValue === null || aValue === undefined || aValue === '') ? null : parseLocaleNumber(aValue);
                    const bNum = (bValue === null || bValue === undefined || bValue === '') ? null : parseLocaleNumber(bValue);
                    if (aNum === null && bNum === null) return 0;
                    if (aNum === null) return 1;
                    if (bNum === null) return -1;
                    const comparison = aNum - bNum;
                    return sortConfig.direction === 'ascending' ? comparison : -comparison;
                }
                // Tri alphabétique robuste pour les noms de plats
                const comparison = String(aValue || "").localeCompare(String(bValue || ""), 'fr', { sensitivity: 'base' });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [productsWithCosts, sortConfig]);

    const displayedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedProducts, currentPage, itemsPerPage]);

    // On prépare les données pour le graphique de contribution
    // Pagination du classement par contribution (21/11, à la place de « Voir tout ») : même réglage de lignes par page que les autres tableaux.
    const totalContributionsCount = contributionData.length;
    const contributionPageClamped = Math.min(contributionPage, Math.max(1, Math.ceil(totalContributionsCount / itemsPerPage)));
    const displayedContributions = useMemo(() => {
        const start = (contributionPageClamped - 1) * itemsPerPage;
        return contributionData.slice(start, start + itemsPerPage);
    }, [contributionData, contributionPageClamped, itemsPerPage]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    // Matrice Activité × Canal (02/11, retour utilisateur — intégrée en haut de la matrice SKU ×
    // Canal ci-dessous) : mêmes règles que celle-ci (tri par colonne, « — »/jamais 0 $ pour une
    // combinaison sans vente, pagination, palette de marge) — un état de tri/pagination séparé,
    // puisque c'est une liste différente (`productionActivities`, pas `productsWithCosts`),
    // partageant seulement le même réglage de nombre de lignes par page (`itemsPerPage`, prop
    // commune aux deux tableaux).
    // Révision du 02/11 (retour utilisateur, suite) : métrique en $ (bénéfice net) plutôt qu'en %,
    // avec une ligne ET une colonne Total — une matrice en % ne peut pas avoir de total sensé
    // (sommer ou moyenner des % individuels diverge du vrai % consolidé, paradoxe de Simpson,
    // même principe que partout ailleurs dans ce fichier), alors qu'un $ se somme sans ambiguïté.
    // Les totaux réutilisent directement `activitySummaries`/`channelSummaries` (déjà calculés
    // plus haut pour Par activité/Par canal) plutôt que de re-sommer la matrice — même donnée,
    // jamais deux calculs indépendants qui pourraient diverger.
    const [activityMatrixSort, setActivityMatrixSort] = useSessionState('summary.activityMatrixSort', { key: 'activityName', direction: 'descending' });
    const [activityMatrixPage, setActivityMatrixPage] = useStateResetOnChange(1, [activityMatrixSort]);

    const activityChannelMatrix = useMemo(
        () => computeActivityChannelMarginMatrix(productsWithCosts, productionActivities, salesChannels),
        [productsWithCosts, productionActivities, salesChannels]
    );

    // Grand total (coin inférieur droit) : somme des totaux par activité — équivalente à la somme
    // des totaux par canal (les deux ventilent le même bénéfice net, juste selon un axe différent,
    // comme déjà vérifié pour Par activité/Par canal).
    const activityMatrixGrandTotal = useMemo(
        () => activitySummaries.reduce((sum, r) => sum + r.margeNetteTotal, 0),
        [activitySummaries]
    );

    const sortedActivityRows = useMemo(() => {
        // Défini dans le useMemo : il ne sert qu'ici et ne lit que des valeurs déjà listées dans les dépendances.
        const getActivityMatrixValue = (activity, key) => {
            if (key === 'total') {
                const total = activitySummaries.find(r => r.activityId === activity.id);
                return total ? total.margeNetteTotal : null;
            }
            if (key.startsWith('channel:')) {
                const channelId = key.slice('channel:'.length);
                const cell = activityChannelMatrix[activity.id]?.[channelId];
                return cell ? cell.margeNetteTotal : null;
            }
            return activity.name; // key === 'activityName'
        };
        const items = [...productionActivities];
        items.sort((a, b) => {
            const aValue = getActivityMatrixValue(a, activityMatrixSort.key);
            const bValue = getActivityMatrixValue(b, activityMatrixSort.key);
            if (activityMatrixSort.key === 'total' || activityMatrixSort.key.startsWith('channel:')) {
                // « — » (valeur absente) reste toujours en fin de liste, peu importe le sens du
                // tri — jamais interprété comme 0 $, même règle que la matrice SKU × Canal.
                const aNum = aValue === null ? null : parseLocaleNumber(aValue);
                const bNum = bValue === null ? null : parseLocaleNumber(bValue);
                if (aNum === null && bNum === null) return 0;
                if (aNum === null) return 1;
                if (bNum === null) return -1;
                const comparison = aNum - bNum;
                return activityMatrixSort.direction === 'ascending' ? comparison : -comparison;
            }
            const comparison = String(aValue || '').localeCompare(String(bValue || ''), 'fr', { sensitivity: 'base' });
            return activityMatrixSort.direction === 'ascending' ? comparison : -comparison;
        });
        return items;
    }, [productionActivities, activityChannelMatrix, activitySummaries, activityMatrixSort]);

    const displayedActivityRows = useMemo(() => {
        const startIndex = (activityMatrixPage - 1) * itemsPerPage;
        return sortedActivityRows.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedActivityRows, activityMatrixPage, itemsPerPage]);

    const requestActivityMatrixSort = (key) => {
        let direction = 'ascending';
        if (activityMatrixSort.key === key && activityMatrixSort.direction === 'ascending') {
            direction = 'descending';
        } else if (activityMatrixSort.key === key && activityMatrixSort.direction === 'descending') {
            direction = 'ascending';
        }
        setActivityMatrixSort({ key, direction });
    };

    const getActivityMatrixSortIcon = (key) => {
        if (activityMatrixSort.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return activityMatrixSort.direction === 'ascending' ? '▲' : '▼';
    };

    return (
        <FindingsProvider>
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <SnapshotDetailsModal
                isOpen={isSnapshotModalOpen}
                onClose={() => { setIsSnapshotModalOpen(false); setEditingSnapshot(null); }}
                onSave={handleSaveSnapshot}
                initialData={editingSnapshot}
            />
            <ManagePointsModal
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                trackingPoints={trackingPoints}
                selectedSnapshotIds={selectedSnapshotIds}
                onSelectionChange={handleSnapshotSelectionChange}
                onSelectAll={handleSnapshotSelectAll}
                onEditSnapshot={openEditSnapshotModal}
                onDeleteSnapshot={handleDeleteSnapshot}
            />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Rapport et suivi</h1>
                {/* Une seule ligne : Excel, PDF, puis le point de référence (à droite du PDF, 18/11). */}
                <div className="flex items-center gap-2">
                        <button onClick={() => exportToExcel(laborDatabase)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            <FileDown className="h-4 w-4 mr-2" /> Exporter vers Excel
                        </button>
                        <button onClick={onOpenPdfModal} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                            <FileDown className="h-4 w-4 mr-2" /> Générer un rapport PDF
                        </button>
                    <PointDeReferenceMenu
                        onNew={() => { setEditingSnapshot(null); setIsSnapshotModalOpen(true); }}
                        onManage={() => setIsManageModalOpen(true)}
                    />
                </div>
            </div>
            {products.length === 0 && (
                <EmptyState message="Rien à analyser pour l'instant&nbsp;: ajoutez d'abord des produits.">
                    <button onClick={() => goToTab('info')} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">Aller à Paramètres → Produits et SKUs</button>
                </EmptyState>
            )}

            {projectChecks.length > 0 && products.length > 0 && (
                <div data-testid="project-checks" className="mb-6 border border-amber-300 bg-amber-50 rounded-lg">
                    <button type="button" onClick={() => setShowChecks(o => !o)} aria-expanded={showChecks}
                        className="w-full flex items-center justify-between px-4 py-3 text-left">
                        <span className="flex items-center text-sm font-semibold text-amber-900">
                            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                            {projectChecks.length} point{projectChecks.length > 1 ? 's' : ''} à vérifier avant de vous fier à ces résultats
                        </span>
                        <ChevronDown className={`h-5 w-5 text-amber-700 transition-transform ${showChecks ? 'rotate-180' : ''}`} />
                    </button>
                    {showChecks && (
                        <ul className="px-4 pb-3 space-y-2">
                            {projectChecks.map(c => (
                                <li key={c.id} className="flex items-center justify-between gap-3 text-sm text-amber-900">
                                    <span>{c.message}</span>
                                    <button type="button" onClick={() => goToTab(c.tab)} className="flex-shrink-0 text-blue-700 hover:text-blue-900 underline whitespace-nowrap">
                                        Corriger dans {c.tabLabel}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Barre des sous-onglets (21/11, refonte de Rapport et suivi) : quatre groupes dans l'ordre — Vue d'ensemble, produits et segments,
                approvisionnement et équipe, simulation. Un trait vertical sépare les groupes (rétabli le 23/11 à la demande de l'utilisateur) ; la barre passe à la ligne
                dans une fenêtre étroite au lieu de défiler. Voir Projet_Claude/03-Feuille-de-route.md. */}
            <div data-tour="subtab-bar" className="flex flex-wrap gap-x-1 border-b border-gray-200 mb-6">
                {REPORT_SUBTAB_GROUPS.map((group, groupIndex) => (
                    <React.Fragment key={groupIndex}>
                        {groupIndex > 0 && <span aria-hidden="true" className="mx-2 self-center h-5 w-px bg-gray-300 flex-shrink-0" />}
                        {group.map(tab => (
                            <button
                                key={tab.id}
                                data-tour={`subtab-${tab.id}`}
                                aria-current={subTab === tab.id ? 'page' : undefined}
                                onClick={() => onActiveSubTabChange(tab.id)}
                                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${subTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </React.Fragment>
                ))}
            </div>

            {subTab === 'bySku' && (
            <div id="tutorial-section-summary-bysku">
                <div className="flex items-center gap-2 mb-6">
                    <label htmlFor="summarySkuSelect" className="text-sm font-medium text-gray-700">SKU&nbsp;:</label>
                    <select
                        id="summarySkuSelect"
                        value={selectedSkuId || ''}
                        onChange={(e) => onSelectedSkuIdChange(e.target.value)}
                        className="p-1.5 border rounded-md text-sm border-gray-300 flex-1 max-w-md"
                    >
                        {skuOptions.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                    {selectedSkuRow && (
                        <button
                            onClick={() => onEditProduct(products.findIndex(p => p.id === selectedSkuRow.productId), selectedSkuRow.formatIndex || 0)}
                            title="Modifier ce SKU dans Production"
                            className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50 flex-shrink-0"
                        >
                            <Pencil size={18} />
                        </button>
                    )}
                </div>
                {selectedSkuRow
                    ? <BySkuWaterfall row={selectedSkuRow} productionActivities={productionActivities} salesChannels={salesChannels} />
                    : <p className="text-center text-gray-500 py-8">Aucun SKU actif pour l'instant — cochez la case «&nbsp;Actif&nbsp;» d'un format dans Paramètres → Produits et SKUs.</p>}

                {/* Évolution des coûts de ce SKU (ex-« Analyse par format » de l'onglet Suivi,
                    fusionnée ici le 24/10, retour utilisateur, sous le tableau récapitulatif du
                    coût de revient par canal) — même SKU que ci-dessus, aucun second sélecteur. */}
                {selectedSkuRow && (
                <div id="tutorial-section-tracking-product" className="mt-8 pt-6 border-t">
                    <h2 className="text-2xl font-bold text-gray-700 mb-1">Évolution des coûts de ce SKU</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {selectedProductIsPriced
                            ? "Comment les coûts et la marge nette (%) de ce SKU ont évolué, d'un point de référence à l'autre. Un excellent moyen de mesurer l'impact de vos changements de prix ou d'optimisation des coûts."
                            : "Ce SKU n'a pas de prix de vente (sous-recette non vendue seule) : les ratios en % du prix n'ont pas de sens, les coûts sont donc affichés en $ par unité produite."}
                    </p>
                    {selectedProductIsPriced ? (
                        <SimpleLineChart
                            data={productKpiData}
                            lines={[
                                { dataKey: "Coût matière (%)", color: "#82ca9d", unit: '%' },
                                { dataKey: "Coût emballage (%)", color: "#db2777", unit: '%' },
                                { dataKey: "Coût main-d'œuvre (%)", color: "#ffc658", unit: '%' },
                                { dataKey: "Coût des frais indirects (%)", color: "#8884d8", unit: '%' },
                                { dataKey: "Marge nette (%)", color: "#ff7300", unit: '%' },
                            ]}
                            yAxisLabel="Pourcentage (%)"
                        />
                    ) : (
                        <SimpleLineChart
                            data={productKpiData}
                            lines={[
                                { dataKey: "Coût matière ($/u.)", color: "#82ca9d", unit: ' $' },
                                { dataKey: "Coût emballage ($/u.)", color: "#db2777", unit: ' $' },
                                { dataKey: "Coût main-d'œuvre ($/u.)", color: "#ffc658", unit: ' $' },
                                { dataKey: "Coût de revient ($/u.)", color: "#ff7300", unit: ' $' },
                            ]}
                            yAxisLabel="Coût ($ / unité)"
                        />
                    )}
                </div>
                )}
            </div>
            )}

            {/* Par activité / Par canal (révisé le 02/11, retour utilisateur) : une ligne par
                activité (ou par canal), chacune réduite à son propre total — plus de sélecteur, la
                liste entière est déjà visible (voir SegmentSummaryTable, computeActivitySummaries/
                computeChannelSummaries, engine/analysisData.js, pour la méthodologie : $ sommés
                jamais % moyennés, point mort en $ de revenu pas en unités). */}
            {subTab === 'byActivity' && (
            <>
            <div id="tutorial-section-summary-byactivity">
                <SegmentSummaryTable rows={activitySummaries} nameColumnLabel="Activité" idKey="activityId" nameKey="activityName" />
            </div>
            {/* Section ajoutée SOUS le tableau d'origine, qui reste intact (hors de son conteneur). */}
            <ActivityLaborSection activitySummaries={activitySummaries} activeProducts={analysisData.activeProducts} productivityReport={generalInfo.productivityReport} productionActivities={productionActivities} />
            </>
            )}

            {subTab === 'byChannel' && (
            <div id="tutorial-section-summary-bychannel">
                <SegmentSummaryTable rows={channelSummaries} nameColumnLabel="Canal" idKey="channelId" nameKey="channelName" />
            </div>
            )}

            {/* Vue d'ensemble : tuiles, évolution des marges et coûts moyens, matrice Activité × Canal, puis la Réconciliation réel / théorique
                (déplacée ici le 21/11 depuis l'État des résultats : les deux portent sur l'entreprise entière). */}
            {subTab === 'overview' && (
            <>
            <StrategicAnalysis analysisData={analysisData} generalInfo={generalInfo} globalKpiData={globalKpiData} />

            {/* 02/11, retour utilisateur : matrice Activité × Canal insérée au-dessus de la matrice
                SKU × Canal — même principe (« — » si aucune vente), mais à l'échelle de l'activité
                de production plutôt que du SKU individuel. Toutes les activités fournies
                apparaissent (même sans vente, « — » partout), comme la matrice SKU × Canal liste
                tous les SKUs. Pas de colonne « éditer » : une activité n'a pas de destination
                d'édition unique comme un SKU.
                Révisée le 02/11 (retour utilisateur, suite) : bénéfices/pertes en $ plutôt qu'en %
                — un $ se somme sans ambiguïté, ce qui permet une ligne ET une colonne Total (une
                matrice en % n'aurait pas de total sensé, voir le commentaire plus haut). La
                couleur de chaque cellule reste basée sur la marge nette % (intensité relative à
                l'échelle propre de CETTE cellule), même si la valeur affichée est en $. */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Bénéfices / pertes des activités par canaux</h2>
                <p className="text-sm text-gray-500 mb-4">Le bénéfice net (ou la perte) de chaque activité de production, pour chacun de ses canaux de vente, avec le total par activité et par canal. «&nbsp;—&nbsp;»&nbsp;: cette activité n'a aucune vente dans ce canal.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 sticky left-0 bg-gray-100">
                                <button onClick={() => requestActivityMatrixSort('activityName')} className="flex items-center w-full justify-center">
                                    Activité {getActivityMatrixSortIcon('activityName')}
                                </button>
                            </th>
                            {salesChannels.map(c => (
                                <th key={c.id} className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                                    <button onClick={() => requestActivityMatrixSort(`channel:${c.id}`)} className="flex items-center justify-end w-full">
                                        {c.name || 'Sans nom'} {getActivityMatrixSortIcon(`channel:${c.id}`)}
                                    </button>
                                </th>
                            ))}
                            {/* Colonne Total : pas de bordure ajoutée ici (retour utilisateur) — la
                                ligne des titres ne doit pas changer d'apparence ; la séparation se
                                fait seulement sur les lignes de données et la ligne Total ci-dessous. */}
                            <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                                <button onClick={() => requestActivityMatrixSort('total')} className="flex items-center justify-end w-full">
                                    Total {getActivityMatrixSortIcon('total')}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedActivityRows.map((activity, index) => {
                            const activityTotal = activitySummaries.find(r => r.activityId === activity.id);
                            return (
                                <tr key={activity.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-1.5 whitespace-nowrap font-medium sticky left-0 bg-inherit">{activity.name || 'Sans nom'}</td>
                                    {salesChannels.map(c => {
                                        const cell = activityChannelMatrix[activity.id]?.[c.id];
                                        return (
                                            <td key={c.id} className="px-3 py-1.5 text-right font-bold" style={cell ? getMarginCellStyle(cell.margeNettePercent) : undefined}>
                                                {cell ? `${formatCurrency(cell.margeNetteTotal)}\u00A0$` : <span className="text-gray-400 font-normal" title="Aucune vente dans ce canal">—</span>}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-1.5 text-right font-bold border-l-4 border-white" style={activityTotal ? getMarginCellStyle(activityTotal.margeNettePercent) : undefined}>
                                        {activityTotal ? `${formatCurrency(activityTotal.margeNetteTotal)}\u00A0$` : <span className="text-gray-400 font-normal" title="Aucune vente pour cette activité">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Ligne Total mise en évidence (02/11, retour utilisateur) : même principe
                            que la colonne Total ci-dessus — bordure du haut plus épaisse que les
                            séparateurs de lignes ordinaires, pour qu'elle se détache comme un résultat
                            agrégé plutôt qu'une activité de plus. Blanche plutôt que grise (retour
                            utilisateur) : la bordure grise tranchait mal avec les cellules déjà
                            colorées (palette de marge) — le blanc se lit comme un espacement net entre
                            cartes plutôt qu'un trait disgracieux par-dessus une couleur. Bordure posée
                            sur CHAQUE <td> plutôt que sur le <tr> (retour utilisateur, la bordure du
                            haut n'apparaissait pas) : un navigateur ne peint jamais une bordure posée
                            directement sur <tr> en mode de bordures "separate" (celui par défaut d'un
                            tableau HTML, jamais changé ici) — seules les cellules peuvent porter une
                            bordure visible. Toujours la somme sur TOUTES les activités (jamais limitée
                            à la page affichée) — réutilise channelSummaries, déjà calculé pour Par
                            Canal. */}
                        <tr className="bg-gray-100 font-bold">
                            <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-gray-100 border-t-4 border-white">Total</td>
                            {salesChannels.map(c => {
                                const channelTotal = channelSummaries.find(r => r.channelId === c.id);
                                return (
                                    <td key={c.id} className="px-3 py-1.5 text-right border-t-4 border-white" style={channelTotal ? getMarginCellStyle(channelTotal.margeNettePercent) : undefined}>
                                        {channelTotal ? `${formatCurrency(channelTotal.margeNetteTotal)}\u00A0$` : <span className="text-gray-400 font-normal" title="Aucune vente dans ce canal">—</span>}
                                    </td>
                                );
                            })}
                            <td className="px-3 py-1.5 text-right text-indigo-700 border-l-4 border-t-4 border-white">{formatCurrency(activityMatrixGrandTotal)}&nbsp;$</td>
                        </tr>
                    </tbody>
                </table>
                <Pagination
                    totalItems={sortedActivityRows.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={activityMatrixPage}
                    onPageChange={setActivityMatrixPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>

            {/* Constats : forces et faiblesses (mêmes règles que le chapitre 1 du rapport PDF), seuls sous la matrice Activité × Canal (23/11). */}
            <StrengthsFindings />

            <div className="mt-8">
                <ReconciliationReport />
            </div>
            </>
            )}

            {/* Portefeuille (21/11) : les analyses qui portent sur l'ensemble des produits — matrice stratégique, contribution au profit, marges
                nettes des SKUs par canaux. */}
            {subTab === 'portfolio' && (
            <>
            <BcgMatrix analysisData={analysisData} salesChannels={salesChannels} />

            {/* Classement par contribution totale : pagination (comme les autres tableaux) à la place de « Voir tout », lignes plus serrées. */}
            <div id="tutorial-contribution-chart" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Classement par contribution totale au profit</h2>
                <p className="text-sm text-gray-500 mb-4">Ce graphique montre les produits qui génèrent le plus de profit en dollars pour couvrir vos frais fixes.</p>
                <div style={{ width: '100%', height: 20 + displayedContributions.length * 30 }}>
                    <ResponsiveContainer>
                        <BarChart
                            layout="vertical"
                            data={displayedContributions}
                            margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                        >
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={240} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                            <RechartsTooltip
                                formatter={(value) => `${formatCurrency(value)}\u00A0$`}
                                cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }}
                                contentStyle={{ borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="totalContribution" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="totalContribution" position="right" formatter={(value) => `${formatCurrency(value)}\u00A0$`} style={{ fill: '#374151', fontSize: '12px' }}/>
                                {displayedContributions.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.totalContribution >= 0 ? '#10B981' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <Pagination
                    totalItems={totalContributionsCount}
                    itemsPerPage={itemsPerPage}
                    currentPage={contributionPageClamped}
                    onPageChange={setContributionPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>

            {/* 06/10 : matrice SKU × canal inspirée de l'onglet « Rapport - Marges » du chiffrier
                SymbiOse de l'utilisateur — remplace l'ancien tableau détaillé à un seul canal à la
                fois (son filtre par canal n'a plus lieu d'être : tous les canaux sont déjà visibles
                en colonnes ici). Pas de regroupement « Vente directe / Vente au détail » comme dans
                le chiffrier original : ça suppose un type de canal que `salesChannels` ne modélise
                pas encore. */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Marges nettes des SKUs par canaux</h2>
                <p className="text-sm text-gray-500 mb-4">La marge nette (% du prix de vente) de chaque SKU, pour chacun de ses canaux de vente. «&nbsp;—&nbsp;»&nbsp;: ce SKU n'est pas vendu dans ce canal.</p>
            </div>
            <div id="tutorial-section-summary-table" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-1 text-center text-xs font-medium text-gray-500 sticky left-0 bg-gray-100">
                                <button onClick={() => requestSort('displayName')} className="flex items-center w-full justify-center">
                                    Produit {getSortIcon('displayName')}
                                </button>
                            </th>
                            {salesChannels.map(c => (
                                <th key={c.id} className="px-3 py-1 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                                    <button onClick={() => requestSort(`channel:${c.id}`)} className="flex items-center justify-end w-full">
                                        {c.name || 'Sans nom'} {getSortIcon(`channel:${c.id}`)}
                                    </button>
                                </th>
                            ))}
                            <th className="relative px-3 py-1 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedProducts.map((product, index) => (
                            <tr key={product.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-1 whitespace-nowrap font-medium sticky left-0 bg-inherit">{product.displayName || product.platName || unnamedLabel(index)}</td>
                                {salesChannels.map(c => {
                                    const cb = (product.channelBreakdown || []).find(ch => ch.channelId === c.id);
                                    return (
                                        <td key={c.id} className="px-3 py-1 text-right font-bold" style={cb ? getMarginCellStyle(cb.margeNettePercent) : undefined}>
                                            {cb ? `${formatPercent(cb.margeNettePercent)}\u00A0%` : <span className="text-gray-400 font-normal" title="Non vendu dans ce canal">—</span>}
                                        </td>
                                    );
                                })}
                                <td className="px-3 py-1 text-right">
                                    <button
                                        onClick={() => onEditProduct(products.findIndex(p => p.id === product.productId), product.formatIndex || 0)}
                                        title="Modifier le produit"
                                        className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            <Pagination
                totalItems={sortedProducts.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={onItemsPerPageChange}
            />
            </div>
            </>
            )}

            {/* Ingrédients : analyse ABC, rapport d'achats et perte stock, puis évolution des prix et volatilité (ex-sous-onglet Intrants, bloc ingrédients). */}
            {subTab === 'ingredients' && (
            <div className="space-y-8">
                <AbcAnalysis id="tutorial-section-ingredients-abc" abc={analysisData.abcAnalysisData} volatilityByName={priceVolatility.byName} nounPlural="ingrédients" />
                <div className="pt-6 border-t">
                    <PurchasingReport id="tutorial-section-ingredients-rapport" report={analysisData.purchasingReportData} itemLabel="Ingrédient" selectId="reportFilterProvider" memoryKey="ingredients.reportFilter" itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
                <div id="tutorial-section-tracking-ingredient" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-2xl font-bold text-gray-700">Évolution du prix des ingrédients</h2>
                        <select
                            value={selectedIngredientId || ''}
                            onChange={(e) => onSelectedIngredientIdChange(e.target.value)}
                            className="p-2 border rounded-md w-72"
                        >
                            {trackableIngredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                        </select>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez un ingrédient pour voir comment son prix unitaire a évolué dans le temps. C'est idéal pour suivre l'inflation et l'impact de vos négociations avec les fournisseurs.</p>
                    <SimpleLineChart
                        data={ingredientPriceData}
                        lines={[
                            { dataKey: "Prix unitaire", color: "#82ca9d", unit: ' $' },
                        ]}
                        yAxisLabel="Prix unitaire ($)"
                    />

                    {/* Volatilité des prix d'achat — dérivée des points de référence. */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité des prix d'achat</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Amplitude du prix (écart entre son plus bas et son plus haut, en % de la moyenne) et tendance
                            {priceVolatility.hasEnoughData ? ` sur vos ${priceVolatility.pointCount} points de référence` : ''}.
                            À croiser avec la classe ABC (section Analyse ABC ci-dessus)&nbsp;: un ingrédient de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={priceVolatility}
                            memoryKey="summary.ingredientVolatility"
                            itemLabel="des ingrédients"
                            nameColumnLabel="Ingrédient"
                            filterPlaceholder="Filtrer par ingrédient…"
                        />
                    </div>
                </div>
            </div>
            )}

            {/* Emballages : même gabarit — poste SÉPARÉ des ingrédients (voir Phase 2), jamais fusionné. */}
            {subTab === 'packaging' && (
            <div className="space-y-8">
                <AbcAnalysis id="tutorial-section-packaging-abc" abc={analysisData.packagingAbcAnalysisData} volatilityByName={packagingVolatility.byName} nounPlural="emballages" emptyMessage="Aucun emballage consommé pour la période — rattachez des emballages à vos formats de vente (onglet Production) pour voir apparaître cette analyse." />
                <div className="pt-6 border-t">
                    <PurchasingReport id="tutorial-section-packaging-rapport" report={analysisData.packagingPurchasingReportData} itemLabel="Emballage" selectId="reportFilterProviderPackaging" memoryKey="packaging.reportFilter" itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
                {/* Emballage — poste SÉPARÉ des ingrédients (voir Phase 2), jamais fusionné. */}
                <div id="tutorial-section-tracking-packaging" className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-2xl font-bold text-gray-700">Évolution du prix des emballages</h2>
                        <select
                            value={selectedPackagingId || ''}
                            onChange={(e) => onSelectedPackagingIdChange(e.target.value)}
                            className="p-2 border rounded-md w-72"
                        >
                            {trackablePackaging.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                        </select>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez un emballage pour voir comment son prix unitaire a évolué dans le temps. C'est idéal pour suivre l'inflation et l'impact de vos négociations avec les fournisseurs.</p>
                    <SimpleLineChart
                        data={packagingPriceData}
                        lines={[
                            { dataKey: "Prix unitaire", color: "#db2777", unit: ' $' },
                        ]}
                        yAxisLabel="Prix unitaire ($)"
                    />

                    {/* Volatilité des prix d'achat — Emballage (Phase 6) : même analyse que les
                        ingrédients, poste SÉPARÉ (voir Phase 2). */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">Volatilité des prix d'achat</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Amplitude du prix (écart entre son plus bas et son plus haut, en % de la moyenne) et tendance
                            {packagingVolatility.hasEnoughData ? ` sur vos ${packagingVolatility.pointCount} points de référence` : ''}.
                            À croiser avec la classe ABC (section Analyse ABC ci-dessus)&nbsp;: un emballage de forte valeur au prix volatil est une priorité d'approvisionnement.
                        </p>
                        <VolatilityTable
                            volatility={packagingVolatility}
                            memoryKey="summary.packagingVolatility"
                            itemLabel="de l'emballage"
                            nameColumnLabel="Emballage"
                            filterPlaceholder="Filtrer par emballage…"
                        />
                    </div>
                </div>
            </div>
            )}

            {/* Main-d'œuvre : rapport de productivité et charge de travail par activité. */}
            {subTab === 'labor' && <LaborReport itemsPerPage={itemsPerPage} onItemsPerPageChange={onItemsPerPageChange} />}

            {/* 06/10 : sous-onglet dédié — être dans cet onglet suffit, pas besoin de redéplier
                le simulateur derrière un second clic (voir CostShockSimulator, prop collapsible). */}
            {subTab === 'simulation' && (
                <CostShockSimulator collapsible={false} />
            )}

            {/* Bandeau de constats à la fin de chaque sous-onglet, sauf Vue d'ensemble (trois blocs ci-dessus) et Simulation (23/11). */}
            {subTab !== 'overview' && subTab !== 'simulation' && (
                <TabFindings subTab={subTab} selectedFormat={subTab === 'bySku' && selectedSkuRow ? { id: selectedSkuRow.id, productId: selectedSkuRow.productId } : null} />
            )}
        </div>
        </FindingsProvider>
    );
};
