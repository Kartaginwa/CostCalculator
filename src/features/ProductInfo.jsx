import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTouched, focusSoon, useSessionState, useStateResetOnChange } from '../ui-utils.jsx';
import { ArrowDownAZ, ArrowDownZA, ArrowLeft, AlertTriangle, Upload, Copy, Trash2, PlusCircle, Layers, ChevronDown, Star } from 'lucide-react';
import { unnamedLabel, parseLocaleNumber, isValidNumber, isValidPositiveNumber, isInvalidPercentage, isNotEmpty, CONVERSION_FACTORS, filterActiveUnits, formatNumber, unitLabel } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination, Combobox, ChannelLinksModal, UnitsModal } from '../components/common.jsx';
import { ObjectivesModal } from '../components/ObjectivesModal.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { computeNetPriceFromPds } from '../engine/salesChannelCascade.js';
import { removeChannelFromProducts } from '../engine/productEdits.js';

export const ProductInfo = ({ onNewProduct, onDeleteProduct, onDuplicateProduct, handleProductValueChange, handleFormatValueChange, handleFormatChannelPricesChange, onAddFormat, onDuplicateFormat, onDeleteFormat, itemsPerPage, onItemsPerPageChange, onOpenSalesImport }) => {
    const {
        companyName, onUpdateCompanyName, logoUrl, onUpdateLogoUrl, generalInfo, onUpdateGeneralInfo, products, onUpdateProducts,
        productionActivities, onUpdateProductionActivities, salesChannels, onUpdateSalesChannels,
        activeUnits, onUpdateActiveUnits,
        showNotification, setNotification,
    } = useProject();

    const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
    const [isObjectivesModalOpen, setIsObjectivesModalOpen] = useState(false);
    const [isNameTouched, touchName] = useTouched();
    const [filterName, setFilterName] = useSessionState('info.filterName', '');
    const [filterCategory, setFilterCategory] = useSessionState('info.filterCategory', 'all');
    const [filterActivity, setFilterActivity] = useSessionState('info.filterActivity', 'all');
    const [sortConfig, setSortConfig] = useSessionState('info.sortConfig', { key: 'platName', direction: 'ascending' });
    const [currentPage, setCurrentPage] = useStateResetOnChange(1, [filterName, filterCategory, filterActivity]); // revient à la page 1 si un filtre change
    // Phase 3.2 : détail "prix par canal" repliable par format — évite d'alourdir le tableau
    // Produits et SKUs quand on n'a pas besoin de voir ce détail (voir discussion méthodologique).
    const [expandedFormatIds, setExpandedFormatIds] = useState(new Set());
    // Id du canal dont la modale de gestion des maillons est ouverte (retour utilisateur du 19/10 :
    // même patron que PersonnelModal — une ligne résumé dans l'écran principal, le détail complet
    // des maillons vit dans une modale, voir ChannelLinksModal).
    const [linksModalChannelId, setLinksModalChannelId] = useState(null);

    // Vue maître-détail (refonte du 19/10, retour utilisateur — l'ancienne vue en liste à plat,
    // une carte par produit avec son propre tableau complet, prenait trop de place et rendait la
    // navigation difficile) : `selectedProductId` est le SEUL état de sélection, propre à cet
    // écran — volontairement PAS partagé avec `editingProductIndex`/`editingFormatIndex` d'App.jsx
    // (qui pilotent l'onglet Production ; les réutiliser ici créerait un couplage surprenant
    // entre les deux onglets, l'un n'ayant pas à changer ce que l'autre affiche).
    const [selectedProductId, setSelectedProductId] = useSessionState('info.selectedProductId', null);
    // Sur petit écran, les deux colonnes ne peuvent pas être côte à côte : bascule entre la liste
    // et le détail. Ignoré à partir du breakpoint md (les deux restent toujours visibles).
    const [mobileShowDetail, setMobileShowDetail] = useState(false);
    const prevProductIdsRef = useRef(new Set(products.map(p => p.id)));
    const logoInputRef = useRef(null);
    const [logoFileName, setLogoFileName] = useState('');

    const uniqueCategories = useMemo(() => ['all', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
    // Options du sélecteur de catégorie par produit (voir plus bas), sous la forme attendue par
    // Combobox — dont la liste s'affiche TOUJOURS en entier à l'ouverture, même quand ce produit a
    // déjà une catégorie choisie, contrairement à un <input list> natif qui filtre ses suggestions
    // sur la valeur déjà saisie (voir Projet_Claude/03-Feuille-de-route.md).
    const categoryOptions = useMemo(
        () => uniqueCategories.filter(c => c !== 'all').map(c => ({ id: c, name: c })),
        [uniqueCategories]
    );

    // Toutes les paires {produit, format}, pour l'avertissement global de répartition des ventes
    // (calculé sur l'ensemble du menu, indépendamment des filtres/pagination affichés).
    const allRows = useMemo(() => products.flatMap((product, productIndex) =>
        (product.formats && product.formats.length > 0 ? product.formats : [null]).map((format, formatIndex) => ({
            product, format, productIndex, formatIndex,
        }))
    ), [products]);

    // Vue « Produits et SKUs » groupée PAR RECETTE (un produit = une section, ses SKU listés à
    // l'intérieur) — voir Projet_Claude/04-Conception-Modele.md. Le tri/filtre/pagination portent
    // donc sur les PRODUITS, pas sur les lignes de format individuelles.
    const filteredAndSortedProducts = useMemo(() => {
        let items = products.map((product, productIndex) => ({ product, productIndex }));

        if (filterName) {
            items = items.filter(({ product }) => product.platName.toLowerCase().includes(filterName.toLowerCase()));
        }
        if (filterCategory !== 'all') {
            items = items.filter(({ product }) => product.category === filterCategory);
        }
        if (filterActivity !== 'all') {
            items = items.filter(({ product }) => product.activityId === filterActivity);
        }

        items.sort((a, b) => {
            const aValue = a.product[sortConfig.key];
            const bValue = b.product[sortConfig.key];
            const comparison = String(aValue || '').localeCompare(String(bValue || ''), 'fr', { sensitivity: 'base' });
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });

        return items;
    }, [products, filterName, filterCategory, filterActivity, sortConfig]);

    const displayedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

    // Sélectionne automatiquement tout produit qui vient d'apparaître dans `products` (ajout d'un
    // item, duplicata, ou restauration via "Annuler" une suppression) — détecté par comparaison
    // d'ids avec le rendu précédent, peu importe à quel index il atterrit (un ajout va en tête,
    // un duplicata juste après l'original). Remplace l'ancien mécanisme newlyAddedId/
    // isSortDisabled/scroll-to-row : plus besoin de "mettre le tri en pause" pour garder la
    // nouvelle ligne visible dans une liste à plat — ici, sélectionner par id suffit, le panneau
    // de détail affiche le bon produit qu'il soit trié/filtré visible ou non dans la liste.
    useEffect(() => {
        const currentIds = new Set(products.map(p => p.id));
        const addedProduct = products.find(p => !prevProductIdsRef.current.has(p.id));
        if (addedProduct) {
            setSelectedProductId(addedProduct.id);
            setCurrentPage(1);
            setMobileShowDetail(true);
        }
        prevProductIdsRef.current = currentIds;
    }, [products, setSelectedProductId, setCurrentPage]);

    // Garde la sélection valide : si le produit sélectionné disparaît de la liste filtrée/triée
    // actuelle (supprimé, ou simplement masqué par un filtre), retombe sur le premier produit
    // visible plutôt que de laisser le panneau de droite vide ou périmé.
    useEffect(() => {
        if (filteredAndSortedProducts.length === 0) {
            if (selectedProductId !== null) setSelectedProductId(null);
            return;
        }
        const stillVisible = filteredAndSortedProducts.some(({ product }) => product.id === selectedProductId);
        if (!stillVisible) {
            setSelectedProductId(filteredAndSortedProducts[0].product.id);
        }
    }, [filteredAndSortedProducts, selectedProductId, setSelectedProductId]);

    const handleAddItem = () => {
        onNewProduct();
        focusSoon('#product-detail-pane input[type="text"]', 250);
    };

    const selectedProductIndex = products.findIndex(p => p.id === selectedProductId);
    const selectedProduct = selectedProductIndex >= 0 ? products[selectedProductIndex] : null;

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

    const totalSalesMix = useMemo(() => allRows.filter(r => r.format?.onMenu).reduce((sum, r) => sum + parseLocaleNumber(r.format?.salesMix || 0), 0), [allRows]);

    const handleAddActivity = () => {
        const newActivity = { id: `act_${Date.now()}_${Math.random()}`, name: '', indirectCostDriver: 'directCost' };
        onUpdateProductionActivities([...productionActivities, newActivity]);
        focusSoon(`[id="activity-name-${newActivity.id}"]`);
    };

    const handleActivityNameChange = (id, name) => {
        onUpdateProductionActivities(productionActivities.map(a => a.id === id ? { ...a, name } : a));
    };


    const handleRemoveActivity = (id) => {
        if (productionActivities.length <= 1) {
            showNotification({ message: "Vous devez conserver au moins une activité de production.", type: 'error' });
            return;
        }
        const activityToDelete = productionActivities.find(a => a.id === id);
        const originalList = [...productionActivities];
        const originalProducts = products;
        const newList = productionActivities.filter(a => a.id !== id);
        // Les produits de l'activité supprimée passent à la première activité restante : sans cela ils gardaient un
        // identifiant disparu, affichaient une autre activité à l'écran et ne recevaient plus leurs frais d'activité.
        const fallbackActivity = newList[0];
        const movedCount = products.filter(p => p.activityId === id).length;
        onUpdateProductionActivities(newList);
        if (movedCount > 0) {
            onUpdateProducts(products.map(p => (p.activityId === id ? { ...p, activityId: fallbackActivity.id } : p)));
        }
        showNotification({
            message: `L'activité de production "${activityToDelete.name || 'Sans nom'}" a été supprimée.${movedCount > 0 ? ` ${movedCount} produit${movedCount > 1 ? 's ont été déplacés' : ' a été déplacé'} vers « ${fallbackActivity.name || 'Sans nom'} ».` : ''}`,
            type: 'info',
            onUndo: () => {
                onUpdateProductionActivities(originalList);
                if (movedCount > 0) onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    // Circuits de vente (Phase 3) — ici, on ne définit que la STRUCTURE du circuit (nom des
    // maillons, marge/markup %) : le rattachement prix/volumes par format × circuit (avec un vrai
    // coût de revient à faire cascader) viendra dans Produits et SKUs (3.2), pas ici.
    const handleAddChannel = () => {
        const newChannel = { id: `channel_${Date.now()}_${Math.random()}`, name: '', links: [] };
        onUpdateSalesChannels([...salesChannels, newChannel]);
        focusSoon(`[id="channel-name-${newChannel.id}"]`);
    };

    const handleChannelNameChange = (channelId, name) => {
        onUpdateSalesChannels(salesChannels.map(c => c.id === channelId ? { ...c, name } : c));
    };

    const handleRemoveChannel = (channelId) => {
        if (salesChannels.length <= 1) {
            showNotification({ message: "Vous devez conserver au moins un circuit de vente.", type: 'error' });
            return;
        }
        const channelToDelete = salesChannels.find(c => c.id === channelId);
        const originalList = [...salesChannels];
        const originalProducts = products;
        onUpdateSalesChannels(salesChannels.filter(c => c.id !== channelId));
        // Les prix et volumes de ce canal partent avec lui : ils restaient cachés dans les formats sans être comptés nulle part.
        const { products: cleanedProducts, removedCount } = removeChannelFromProducts(products, channelId);
        if (removedCount > 0) onUpdateProducts(cleanedProducts);
        showNotification({
            message: `Le circuit de vente "${channelToDelete.name || 'Sans nom'}" a été supprimé.${removedCount > 0 ? ` ${removedCount} prix et volume${removedCount > 1 ? 's' : ''} de vente associé${removedCount > 1 ? 's' : ''} ${removedCount > 1 ? 'ont été retirés' : 'a été retiré'}.` : ''}`,
            type: 'info',
            onUndo: () => {
                onUpdateSalesChannels(originalList);
                if (removedCount > 0) onUpdateProducts(originalProducts);
                setNotification(null);
            }
        });
    };

    const handleAddLink = (channelId) => {
        const newLink = { id: `link_${Date.now()}_${Math.random()}`, name: '', type: 'margin', percent: '' };
        onUpdateSalesChannels(salesChannels.map(c => c.id === channelId ? { ...c, links: [...c.links, newLink] } : c));
    };

    const handleLinkChange = (channelId, linkId, field, value) => {
        onUpdateSalesChannels(salesChannels.map(c => c.id === channelId
            ? { ...c, links: c.links.map(l => l.id === linkId ? { ...l, [field]: value } : l) }
            : c
        ));
    };

    const handleRemoveLink = (channelId, linkId) => {
        onUpdateSalesChannels(salesChannels.map(c => c.id === channelId
            ? { ...c, links: c.links.filter(l => l.id !== linkId) }
            : c
        ));
    };

    const toggleFormatExpanded = (formatId) => {
        setExpandedFormatIds(prev => {
            const next = new Set(prev);
            if (next.has(formatId)) next.delete(formatId); else next.add(formatId);
            return next;
        });
    };

    // Rattachement prix/volumes par format × canal (Phase 3.2). Le PREMIER élément de
    // `channelPrices` est le canal "principal" : son prix alimente le `prixVente` du format (lu
    // par calculateCosts.js, pas encore channel-aware — Phase 3.3), voir App.jsx.
    const handleAddChannelPrice = (productIndex, formatIndex, format) => {
        const usedChannelIds = new Set((format.channelPrices || []).map(cp => cp.channelId));
        const nextChannel = salesChannels.find(c => !usedChannelIds.has(c.id));
        if (!nextChannel) {
            showNotification({ message: "Ce format est déjà rattaché à tous les canaux de vente existants.", type: 'info' });
            return;
        }
        const newEntry = { id: `cp_${Date.now()}_${Math.random()}`, channelId: nextChannel.id, netPrice: '', volume: '' };
        handleFormatChannelPricesChange(productIndex, formatIndex, [...(format.channelPrices || []), newEntry]);
    };

    const handleChannelPriceFieldChange = (productIndex, formatIndex, format, channelPriceId, field, value) => {
        const newList = (format.channelPrices || []).map(cp => cp.id === channelPriceId ? { ...cp, [field]: value } : cp);
        handleFormatChannelPricesChange(productIndex, formatIndex, newList);
    };

    // Bouton "Générer" (retour utilisateur du 15/10) : remplit le prix net de CE canal à partir du
    // PDS du format (saisi manuellement, voir computeNetPriceFromPds) — n'écrase rien si le PDS
    // est absent/invalide, et le prix net reste ensuite librement modifiable à la main comme avant.
    const handleGenerateNetPriceFromPds = (productIndex, formatIndex, format, channelPriceId, channel) => {
        const netPrice = computeNetPriceFromPds(format.pds, channel);
        if (netPrice === null) return;
        handleChannelPriceFieldChange(productIndex, formatIndex, format, channelPriceId, 'netPrice', netPrice);
    };

    const handleRemoveChannelPrice = (productIndex, formatIndex, format, channelPriceId) => {
        const newList = (format.channelPrices || []).filter(cp => cp.id !== channelPriceId);
        handleFormatChannelPricesChange(productIndex, formatIndex, newList);
    };

    const handleSetPrimaryChannelPrice = (productIndex, formatIndex, format, channelPriceId) => {
        const list = format.channelPrices || [];
        const entry = list.find(cp => cp.id === channelPriceId);
        if (!entry) return;
        handleFormatChannelPricesChange(productIndex, formatIndex, [entry, ...list.filter(cp => cp.id !== channelPriceId)]);
    };

    return (
        <div id="tutorial-section-recipe-header" className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Paramètres</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="tutorial-section-info-entreprise" className="p-4 bg-gray-100 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">Informations sur l'entreprise</h2>
                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nom de l'entreprise</label>
                        <input type="text" id="tutorial-company-name" value={companyName} onChange={(e) => onUpdateCompanyName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Importer un logo (fichier)</label>
                            <input type="file" accept="image/*" ref={logoInputRef} onChange={(e) => { setLogoFileName(e.target.files[0] ? e.target.files[0].name : ''); handleLogoFileChange(e); }} className="hidden" data-testid="logo-file-input" />
                            <div className="mt-1 flex items-center gap-3">
                                <button type="button" onClick={() => logoInputRef.current && logoInputRef.current.click()} className="py-2 px-4 rounded-md text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100">Choisir un fichier</button>
                                <span className="text-sm text-gray-500 truncate">{logoFileName || 'Aucun fichier choisi'}</span>
                            </div>
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

                <div id="tutorial-section-info-objectifs" className="p-4 bg-gray-100 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">Objectifs stratégiques</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label htmlFor="foodCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif coût matière (%)
                                <Tooltip tip="obj.matiere" />
                            </label>
                            <input type="text" inputMode="decimal" id="foodCostTarget" value={generalInfo.foodCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('foodCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${isInvalidPercentage(generalInfo.foodCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {isInvalidPercentage(generalInfo.foodCostTarget) && <ValidationMessage message="Doit être un %." />}
                        </div>
                        <div>
                            <label htmlFor="packagingCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif coût d'emballage (%)
                                <Tooltip tip="obj.emballage" />
                            </label>
                            <input type="text" inputMode="decimal" id="packagingCostTarget" value={generalInfo.packagingCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('packagingCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${isInvalidPercentage(generalInfo.packagingCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {isInvalidPercentage(generalInfo.packagingCostTarget) && <ValidationMessage message="Doit être un %." />}
                        </div>
                        <div>
                            <label htmlFor="laborCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif coût main-d'œuvre (%)
                                <Tooltip tip="obj.mo" />
                            </label>
                            <input type="text" inputMode="decimal" id="laborCostTarget" value={generalInfo.laborCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('laborCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${isInvalidPercentage(generalInfo.laborCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {isInvalidPercentage(generalInfo.laborCostTarget) && <ValidationMessage message="Doit être un %." />}
                        </div>
                        <div>
                            <label htmlFor="grossMarginTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif marge brute (%)
                                <Tooltip tip="obj.margeBrute" />
                            </label>
                            <input type="text" inputMode="decimal" id="grossMarginTarget" value={generalInfo.grossMarginTarget || ''} onChange={(e) => onUpdateGeneralInfo('grossMarginTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${isInvalidPercentage(generalInfo.grossMarginTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {isInvalidPercentage(generalInfo.grossMarginTarget) && <ValidationMessage message="Doit être un %." />}
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button type="button" onClick={() => setIsObjectivesModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            Gérer les objectifs
                        </button>
                    </div>
                    <ObjectivesModal isOpen={isObjectivesModalOpen} onClose={() => setIsObjectivesModalOpen(false)} />
                </div>
            </div>

            <div className="p-4 bg-gray-100 rounded-lg flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Unités de mesure</h2>
                    <p className="text-sm text-gray-600">Choisissez les unités offertes dans les listes déroulantes (ingrédients, emballages, formats).</p>
                </div>
                <button onClick={() => setIsUnitsModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                    Gérer les unités de mesure
                </button>
            </div>
            <UnitsModal isOpen={isUnitsModalOpen} onClose={() => setIsUnitsModalOpen(false)} activeUnits={activeUnits} onUpdateActiveUnits={onUpdateActiveUnits} />

            <div id="tutorial-section-info-activites" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        Activités de production
                        <Tooltip tip="param.activites" />
                    </h2>
                    <button onClick={handleAddActivity} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-4 w-4 mr-2" /> Ajouter une activité
                    </button>
                </div>
                <div className="space-y-2">
                    {productionActivities.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm">
                            <input
                                type="text"
                                value={activity.name}
                                onChange={(e) => handleActivityNameChange(activity.id, e.target.value)}
                                placeholder="Nom de l'activité de production"
                                id={`activity-name-${activity.id}`} onBlur={() => touchName(activity.id)} className={`flex-1 p-1 border rounded ${!isNotEmpty(activity.name) && isNameTouched(activity.id) ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            <button onClick={() => handleRemoveActivity(activity.id)} title="Supprimer l'activité de production" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div id="tutorial-section-info-channels" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        Canaux de vente
                        <Tooltip tip="param.canaux" />
                    </h2>
                    <button onClick={handleAddChannel} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un canal
                    </button>
                </div>
                <div className="space-y-3">
                    {salesChannels.map((channel) => (
                        <div key={channel.id} className="bg-white p-3 rounded-md shadow-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={channel.name}
                                    onChange={(e) => handleChannelNameChange(channel.id, e.target.value)}
                                    placeholder="Nom du canal (ex. Vente directe à la ferme)"
                                    id={`channel-name-${channel.id}`} onBlur={() => touchName(channel.id)} className={`flex-1 p-1 border rounded font-medium ${!isNotEmpty(channel.name) && isNameTouched(channel.id) ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                <button onClick={() => handleRemoveChannel(channel.id)} title="Supprimer le circuit de vente" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                            <div className="pl-4 flex items-center justify-between">
                                <span className="text-sm text-gray-600">
                                    {channel.links.length === 0
                                        ? 'Aucun maillon'
                                        : `${channel.links.length} maillon${channel.links.length > 1 ? 's' : ''}`}
                                </span>
                                <button onClick={() => setLinksModalChannelId(channel.id)} className="text-xs text-blue-600 hover:text-blue-800">Gérer les maillons</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ChannelLinksModal
                isOpen={!!linksModalChannelId}
                onClose={() => setLinksModalChannelId(null)}
                channel={salesChannels.find(c => c.id === linksModalChannelId) || null}
                onAddLink={handleAddLink}
                onLinkChange={handleLinkChange}
                onRemoveLink={handleRemoveLink}
            />

            <div id="tutorial-section-info-menu" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Produits et SKUs</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={onOpenSalesImport} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                            <Upload className="h-4 w-4 mr-2" /> Importer un rapport de ventes
                        </button>
                        <button id="tutorial-add-item" onClick={handleAddItem} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un item
                        </button>
                    </div>
                </div>
                
                {allRows.length > 0 && totalSalesMix > 0 && Math.round(totalSalesMix) !== 100 && (
                    <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm flex items-center justify-center">
                        <AlertTriangle className="inline h-4 w-4 mr-2"/>
                        Attention : Le total de vos parts des ventes est de {formatNumber(totalSalesMix, 1)}%. Pour une analyse précise, il devrait être de 100%.
                    </div>
                )}

                {/* Vue maître-détail (refonte du 19/10) : liste compacte de tous les produits à
                    gauche (scroll indépendant, sa hauteur ne grandit jamais avec le détail d'un
                    produit), détail complet du produit sélectionné à droite (scroll indépendant).
                    Empilées l'une sous l'autre en dessous du breakpoint md (une seule des deux
                    visible à la fois, voir mobileShowDetail), côte à côte au-dessus. */}
                <div className="flex flex-col md:flex-row gap-4 md:max-h-[75vh]">
                    <div className={`${mobileShowDetail ? 'hidden' : 'flex'} md:flex flex-col md:w-60 lg:w-64 flex-shrink-0 md:max-h-[75vh]`}>
                        <div className="flex-shrink-0 space-y-2 mb-3">
                            <div>
                                <label htmlFor="filterPlatName" className="sr-only">Filtrer par nom</label>
                                <input
                                    type="text"
                                    id="filterPlatName"
                                    value={filterName}
                                    onChange={e => setFilterName(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                    placeholder="Rechercher un produit..."
                                />
                            </div>
                            <div>
                                <label htmlFor="filterActivity" className="sr-only">Filtrer par activité de production</label>
                                <select
                                    id="filterActivity"
                                    value={filterActivity}
                                    onChange={e => setFilterActivity(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                >
                                    <option value="all">Toutes les activités</option>
                                    {productionActivities.map(activity => (
                                        <option key={activity.id} value={activity.id}>{activity.name || 'Sans nom'}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="filterCategory" className="sr-only">Filtrer par catégorie</label>
                                <select
                                    id="filterCategory"
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                >
                                    {uniqueCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat === 'all' ? 'Toutes les catégories' : cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 px-1">
                                <span className="text-xs text-gray-500 mr-1">Tri par nom</span>
                                {[['ascending', 'A → Z', ArrowDownAZ], ['descending', 'Z → A', ArrowDownZA]].map(([dir, label, Icon]) => {
                                    const active = sortConfig.key === 'platName' && sortConfig.direction === dir;
                                    return (
                                        <button key={dir} type="button" title={label} aria-label={`Trier par nom, ${label}`} aria-pressed={active}
                                            onClick={() => setSortConfig({ key: 'platName', direction: dir })}
                                            className={`w-8 h-8 inline-flex items-center justify-center rounded border ${active ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                                            <Icon size={16} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 border border-gray-200 rounded-lg bg-white p-2">
                            {displayedProducts.length === 0 && products.length > 0 && (
                                <p className="text-sm text-gray-500 p-2">Aucun produit ne correspond à ces filtres.</p>
                            )}
                            {displayedProducts.map(({ product }) => {
                                const formatCount = product.formats?.length || 1;
                                const isSelected = product.id === selectedProductId;
                                return (
                                    <button
                                        key={product.id}
                                        id={`product-list-item-${product.id}`}
                                        onClick={() => { setSelectedProductId(product.id); setMobileShowDetail(true); }}
                                        className={`w-full text-left px-3 py-2 rounded-md border-l-4 transition-colors ${isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'}`}
                                    >
                                        <div className={`font-medium truncate ${!isNotEmpty(product.platName) ? 'text-red-600' : 'text-gray-800'}`}>
                                            {product.platName || unnamedLabel(products.findIndex(p => p.id === product.id))}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {product.category || 'Sans catégorie'} · {formatCount} format{formatCount > 1 ? 's' : ''}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-shrink-0 mt-2">
                            <Pagination
                                totalItems={filteredAndSortedProducts.length}
                                itemsPerPage={itemsPerPage}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={onItemsPerPageChange}
                            />
                        </div>
                    </div>

                    <div className={`${mobileShowDetail ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 md:max-h-[75vh]`}>
                        <button onClick={() => setMobileShowDetail(false)} className="md:hidden flex-shrink-0 mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 self-start">
                            <ArrowLeft size={16} /> Retour à la liste
                        </button>

                        <div className="flex-1 min-h-0 overflow-y-auto">
                        {!selectedProduct ? (
                            <div className="flex items-center justify-center h-40 text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg bg-white">
                                {products.length === 0
                                    ? <>Aucun produit — cliquez sur « Ajouter un item » pour commencer.</>
                                    : <>Sélectionnez un produit dans la liste à gauche.</>}
                            </div>
                        ) : (() => {
                            const productIndex = selectedProductIndex;
                            const product = selectedProduct;
                            const formats = product.formats || [];
                            return (
                        <div id="product-detail-pane" className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-50 p-3 border-b border-gray-200">
                                {/* Nom du produit sur sa propre ligne, pleine largeur (jamais cramé par
                                    les deux autres champs) ; actions alignées à droite. Activité et
                                    catégorie en-dessous, sur une grille responsive — se replient
                                    proprement à 1 colonne plutôt que de tronquer leur contenu
                                    (select natif, Combobox) dans une colonne de détail étroite. */}
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-medium text-gray-500 uppercase">Nom du produit</label>
                                        <input type="text" value={product.platName || ''} onChange={(e) => handleProductValueChange(productIndex, 'platName', e.target.value)} onBlur={() => touchName(product.id)} placeholder="Nom du produit" className={`mt-1 w-full p-1.5 border rounded font-semibold ${!isNotEmpty(product.platName) && isNameTouched(product.id) ? 'border-red-500' : 'border-gray-300'}`} />
                                        {!isNotEmpty(product.platName) && isNameTouched(product.id) && <ValidationMessage message="Requis." />}
                                    </div>
                                    <div className="flex items-center gap-1 pt-5 flex-shrink-0">
                                        <button onClick={() => onDuplicateProduct(productIndex)} title="Dupliquer le produit" className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full hover:bg-indigo-50"><Layers size={18}/></button>
                                        <button onClick={() => onDeleteProduct(productIndex)} title="Supprimer le produit (tous ses formats)" className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="flex items-center text-xs font-medium text-gray-500 uppercase">
                                            Activité de production
                                            <Tooltip tip="param.produitActivite" />
                                        </label>
                                        <select value={product.activityId || ''} onChange={(e) => handleProductValueChange(productIndex, 'activityId', e.target.value)} className="mt-1 w-full p-1.5 border rounded border-gray-300">
                                            {productionActivities.map(activity => (
                                                <option key={activity.id} value={activity.id}>{activity.name || 'Sans nom'}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase">Catégorie</label>
                                        <div className="mt-1">
                                            <Combobox
                                                options={categoryOptions}
                                                value={product.category ? { id: product.category, name: product.category } : null}
                                                onChange={(selection) => handleProductValueChange(
                                                    productIndex, 'category', typeof selection === 'object' && selection !== null ? selection.name : selection
                                                )}
                                                getOptionLabel={(option) => option.name}
                                                getOptionKey={(option) => option.id}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Compacté (retour utilisateur du 19/10 : pas de scroll horizontal,
                                quitte à réduire police/largeurs) — paddings et largeurs de colonne
                                resserrés, polices des champs alignées sur `text-sm` (déjà la norme
                                une ligne plus bas, dans le détail des prix par canal) pour que les
                                7 colonnes tiennent sans défilement sur un écran plein écran usuel.
                                overflow-x-auto conservé comme filet de sécurité silencieux (aucun
                                effet visuel tant que le contenu tient), pas comme solution
                                principale, pour les cas extrêmes (fenêtre redimensionnée très
                                étroite, zoom élevé). */}
                            <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center">
                                                Format
                                                <Tooltip tip="param.format" />
                                            </div>
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center">
                                                SKU
                                                <Tooltip tip="param.sku" />
                                            </div>
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center">
                                                PDS ($)
                                                <Tooltip tip="param.pds" />
                                            </div>
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center">
                                                Canaux
                                                <Tooltip tip="param.canauxFormat" />
                                            </div>
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Part des ventes (%)</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Actif</th>
                                        <th className="relative px-2 py-2"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {formats.map((format, formatIndex) => {
                                        const isOnlyFormat = formats.length <= 1;
                                        const channelPrices = format.channelPrices || [];
                                        const isExpanded = expandedFormatIds.has(format.id);
                                        const usedChannelIds = new Set(channelPrices.map(cp => cp.channelId));
                                        const hasUnusedChannel = salesChannels.some(c => !usedChannelIds.has(c.id));
                                        // Mode "unités" dès qu'au moins une unité est saisie quelque part pour ce
                                        // format (import ou saisie manuelle) — son % se déduit alors automatiquement
                                        // (voir computeSalesMixFromChannelPrices) et n'est plus éditable ici.
                                        const formatTotalVolume = channelPrices.reduce((sum, cp) => sum + (parseLocaleNumber(cp.volume) || 0), 0);
                                        const isSalesMixAuto = formatTotalVolume > 0;
                                        return (
                                        <React.Fragment key={format.id}>
                                        <tr id={`format-row-${format.id}`}>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input type="text" inputMode="decimal" value={format.portionSize || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'portionSize', e.target.value)} className={`w-12 p-1 border rounded text-right text-sm ${!isValidPositiveNumber(format.portionSize) ? 'border-red-500' : 'border-gray-300'}`} />
                                                    <select value={format.portionUnit || 'unité'} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'portionUnit', e.target.value)} className="p-1 border rounded border-gray-300 text-sm">
                                                        {filterActiveUnits(Object.keys(CONVERSION_FACTORS), activeUnits, format.portionUnit || 'unité').map(u => (
                                                            <option key={u} value={u}>{unitLabel(u)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {!isValidPositiveNumber(format.portionSize) && <ValidationMessage message="Quantité invalide (supérieure à 0)." />}
                                            </td>
                                            <td className="px-2 py-2">
                                                <input type="text" value={format.sku || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'sku', e.target.value)} placeholder="ex. CONF-250ML" className="w-28 p-1 border rounded border-gray-300 text-sm" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input type="text" inputMode="decimal" value={format.pds ?? ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'pds', e.target.value)} onBlur={(e) => handleFormatValueChange(productIndex, formatIndex, 'pds', parseLocaleNumber(e.target.value) || '')} placeholder="PDS $" title="Prix de détail suggéré au consommateur, saisi manuellement — sert à générer le prix net de chaque canal (bouton « Générer », section Canaux de vente)." className="w-16 p-1 border rounded text-right text-sm border-gray-300" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <button onClick={() => toggleFormatExpanded(format.id)} className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs whitespace-nowrap ${channelPrices.length === 0 ? 'text-orange-700 bg-orange-50' : 'text-gray-700 bg-gray-100'} hover:bg-gray-200`}>
                                                    {channelPrices.length === 0 ? 'Aucun canal' : `${channelPrices.length} ${channelPrices.length > 1 ? 'canaux' : 'canal'}`}
                                                    <ChevronDown className={`h-3.5 w-3.5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input type="text" inputMode="decimal" value={format.salesMix || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'salesMix', e.target.value)} disabled={!format.onMenu || isSalesMixAuto} className={`w-16 p-1 border rounded text-right text-sm ${isInvalidPercentage(format.salesMix) ? 'border-red-500' : 'border-gray-300'} ${!format.onMenu || isSalesMixAuto ? 'bg-gray-100' : ''}`} />
                                                    {isSalesMixAuto && <Tooltip tip="param.mix" />}
                                                </div>
                                                {isInvalidPercentage(format.salesMix) && <ValidationMessage message="Doit être un %." />}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input type="checkbox" checked={format.onMenu} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'onMenu', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => onDuplicateFormat(productIndex, formatIndex)} title="Dupliquer ce format" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={14}/></button>
                                                    <button onClick={() => onDeleteFormat(productIndex, formatIndex)} title={isOnlyFormat ? "Supprimer le produit" : "Supprimer ce format"} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-3 bg-gray-50">
                                                    <div className="max-w-3xl">
                                                    {channelPrices.length === 0 && (
                                                        <p className="text-xs text-gray-500">Ce format n'est rattaché à aucun canal de vente — il n'apparaîtra dans aucune analyse de marge tant qu'aucun canal n'est ajouté.</p>
                                                    )}
                                                    {channelPrices.length > 0 && (
                                                        <div className="flex items-center gap-2 px-2 pb-1">
                                                            <span className="w-4"></span>
                                                            <span className="flex-1 text-xs font-medium text-gray-500 uppercase">Canal</span>
                                                            <span className="w-24 text-xs font-medium text-gray-500 uppercase text-right">Prix net ($)</span>
                                                            <span className="w-24 text-xs font-medium text-gray-500 uppercase text-right"></span>
                                                            <span className="w-28 text-xs font-medium text-gray-500 uppercase text-right">Volume (u.)</span>
                                                            <span className="w-4"></span>
                                                            <span className="w-6"></span>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1">
                                                        {channelPrices.map((cp, cpIndex) => {
                                                            const channel = salesChannels.find(c => c.id === cp.channelId);
                                                            const isPrimary = cpIndex === 0;
                                                            const canGenerate = isValidPositiveNumber(format.pds);
                                                            return (
                                                                <div key={cp.id} className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm">
                                                                    <button
                                                                        onClick={() => handleSetPrimaryChannelPrice(productIndex, formatIndex, format, cp.id)}
                                                                        title={isPrimary ? "Canal principal (son prix alimente la marge affichée ailleurs)" : "Définir comme canal principal"}
                                                                        className={isPrimary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}
                                                                    >
                                                                        <Star size={16} fill={isPrimary ? 'currentColor' : 'none'} />
                                                                    </button>
                                                                    <select
                                                                        value={cp.channelId}
                                                                        onChange={(e) => handleChannelPriceFieldChange(productIndex, formatIndex, format, cp.id, 'channelId', e.target.value)}
                                                                        className="flex-1 p-1 border rounded text-xs border-gray-300"
                                                                    >
                                                                        {/* Un canal déjà utilisé par une autre ligne de ce format n'est plus proposé : le choisir compterait ses volumes deux fois. */}
                                                                        {salesChannels.filter(c => c.id === cp.channelId || !usedChannelIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name || 'Sans nom'}</option>)}
                                                                    </select>
                                                                    <div>
                                                                        <label className="sr-only">Prix net ($)</label>
                                                                        <input
                                                                            type="text" inputMode="decimal"
                                                                            value={cp.netPrice}
                                                                            onChange={(e) => handleChannelPriceFieldChange(productIndex, formatIndex, format, cp.id, 'netPrice', e.target.value)}
                                                                            placeholder="Prix net $"
                                                                            className={`w-24 p-1 border rounded text-right text-xs ${!isValidNumber(cp.netPrice) ? 'border-red-500' : 'border-gray-300'}`}
                                                                        />
                                                                    </div>
                                                                    <div className="w-24 flex justify-end">
                                                                        <button
                                                                            onClick={() => handleGenerateNetPriceFromPds(productIndex, formatIndex, format, cp.id, channel)}
                                                                            disabled={!canGenerate}
                                                                            title={canGenerate
                                                                                ? "Générer le prix net de ce canal à partir du PDS du format, en redescendant la cascade de maillons de ce canal. Remplace le prix net ci-dessus (reste modifiable à la main ensuite)."
                                                                                : "Saisissez d'abord un PDS valide pour ce format (colonne PDS ($), à droite du SKU)."}
                                                                            className={`px-2 py-1 text-xs rounded border ${canGenerate ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
                                                                        >
                                                                            Générer
                                                                        </button>
                                                                    </div>
                                                                    <div>
                                                                        <label className="sr-only">Volume (unités)</label>
                                                                        <input
                                                                            type="text" inputMode="decimal"
                                                                            value={cp.volume}
                                                                            onChange={(e) => handleChannelPriceFieldChange(productIndex, formatIndex, format, cp.id, 'volume', e.target.value)}
                                                                            placeholder="Volume (u.)"
                                                                            className={`w-28 p-1 border rounded text-right text-xs ${!isValidNumber(cp.volume) ? 'border-red-500' : 'border-gray-300'}`}
                                                                        />
                                                                    </div>
                                                                    {channel?.links?.length > 0 && (
                                                                        <Tooltip text={`Cascade de ce canal : ${channel.links.map(l => `${l.name || '(sans nom)'} ${l.type === 'markup' ? 'majoration' : 'marge'} ${l.percent || 0}%`).join(' → ')}.`} guide="guide-param-canaux" />
                                                                    )}
                                                                    <button onClick={() => handleRemoveChannelPrice(productIndex, formatIndex, format, cp.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                                                                </div>
                                                            );
                                                        })}
                                                        {hasUnusedChannel && (
                                                            <button onClick={() => handleAddChannelPrice(productIndex, formatIndex, format)} className="text-xs text-blue-600 hover:text-blue-800">+ Ajouter un canal pour ce format</button>
                                                        )}
                                                    </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    )})}
                                </tbody>
                            </table>
                            </div>
                            <div className="p-2 bg-gray-50 border-t border-gray-200">
                                <button onClick={() => onAddFormat(productIndex)} className="inline-flex items-center text-sm text-green-600 hover:text-green-800">
                                    <PlusCircle size={16} className="mr-1" /> Ajouter un format
                                </button>
                            </div>
                        </div>
                            );
                        })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};