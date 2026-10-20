import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ArrowUpDown, AlertTriangle, Upload, Copy, Trash2, PlusCircle, Layers, ChevronDown, Star } from 'lucide-react';
import { parseLocaleNumber, isValidNumber, isValidPositiveNumber, isValidPercentage, isNotEmpty } from '../utils.js';
import { Tooltip, ValidationMessage, Pagination, Combobox } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { computeSalesChannelCascade } from '../engine/salesChannelCascade.js';

// Prix de détail suggéré (PDS, retour utilisateur du 15/10) : maintenant une donnée du FORMAT
// (saisie manuelle, une seule valeur pour tous ses canaux — le prix tablette visé au consommateur
// ne varie typiquement pas par canal, contrairement au prix net producteur), pas une valeur
// déduite par canal comme avant. Descend la cascade de maillons du canal (markup/marge, voir
// salesChannelCascade.js) à partir de ce PDS, ancrée au DERNIER maillon (le prix consommateur),
// pour en déduire le prix net producteur de ce canal — direction inverse de l'ancienne
// implémentation. Un canal sans maillon (ex. vente directe) donne prix net = PDS. Repli null si le
// PDS n'est pas un nombre valide, pour ne jamais écraser un prix net existant par une valeur
// fausse.
const computeNetPriceFromPds = (pds, channel) => {
    const parsedPds = parseLocaleNumber(pds);
    if (!(parsedPds > 0)) return null;
    const links = channel?.links || [];
    const prices = computeSalesChannelCascade({ links, anchorIndex: links.length, anchorValue: parsedPds });
    const net = prices[0];
    return net != null ? Math.round(net * 100) / 100 : null;
};

export const ProductInfo = ({ onNewProduct, onDeleteProduct, onDuplicateProduct, handleProductValueChange, handleFormatValueChange, handleFormatChannelPricesChange, onAddFormat, onDuplicateFormat, onDeleteFormat, itemsPerPage, onItemsPerPageChange, onOpenSalesImport }) => {
    const {
        companyName, onUpdateCompanyName, logoUrl, onUpdateLogoUrl, generalInfo, onUpdateGeneralInfo, products,
        productionActivities, onUpdateProductionActivities, salesChannels, onUpdateSalesChannels,
        showNotification, setNotification,
    } = useProject();

    const [filterName, setFilterName] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterActivity, setFilterActivity] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'platName', direction: 'ascending' });
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const prevProductsLength = useRef(products.length);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSortDisabled, setIsSortDisabled] = useState(false);
    // Phase 3.2 : détail "prix par canal" repliable par format — évite d'alourdir le tableau
    // Produits et SKUs quand on n'a pas besoin de voir ce détail (voir discussion méthodologique).
    const [expandedFormatIds, setExpandedFormatIds] = useState(new Set());

    const uniqueCategories = useMemo(() => ['all', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
    // Options du sélecteur de catégorie par produit (voir plus bas), sous la forme attendue par
    // Combobox — dont la liste s'affiche TOUJOURS en entier à l'ouverture, même quand ce produit a
    // déjà une catégorie choisie, contrairement à un <input list> natif qui filtre ses suggestions
    // sur la valeur déjà saisie (voir Projet_Claude/03-Feuille-de-route.md).
    const categoryOptions = useMemo(
        () => uniqueCategories.filter(c => c !== 'all').map(c => ({ id: c, name: c })),
        [uniqueCategories]
    );

    // Toutes les paires {produit, format}, pour l'avertissement global de mix des ventes
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

        if (!isSortDisabled) {
            items.sort((a, b) => {
                const aValue = a.product[sortConfig.key];
                const bValue = b.product[sortConfig.key];
                const comparison = String(aValue || '').localeCompare(String(bValue || ''), 'fr', { sensitivity: 'base' });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }

        return items;
    }, [products, filterName, filterCategory, filterActivity, sortConfig, isSortDisabled]);

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
    }, [filterName, filterCategory, filterActivity]);

    // Detect new product addition
    useEffect(() => {
        // Si un produit a été ajouté (longueur augmentée) et que le tri est en pause
        if (products.length > prevProductsLength.current && isSortDisabled) {
            const newProduct = products[0]; // Le nouveau produit est toujours en haut de la liste
            const newFormat = newProduct?.formats?.[0];
            if (newFormat) {
                setNewlyAddedId(newFormat.id);
            }
        }
        // Met à jour la référence pour la prochaine fois
        prevProductsLength.current = products.length;
    }, [products, isSortDisabled]);

    useEffect(() => {
        // Gère la mise au point et le défilement sur la nouvelle ligne ajoutée
        if (newlyAddedId) {
            setTimeout(() => {
                const newRowElement = document.getElementById(`format-row-${newlyAddedId}`);
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

    const totalSalesMix = useMemo(() => allRows.filter(r => r.format?.onMenu).reduce((sum, r) => sum + parseLocaleNumber(r.format?.salesMix || 0), 0), [allRows]);

    const handleAddActivity = () => {
        const newActivity = { id: `act_${Date.now()}_${Math.random()}`, name: '', indirectCostDriver: 'directCost' };
        onUpdateProductionActivities([...productionActivities, newActivity]);
    };

    const handleActivityNameChange = (id, name) => {
        onUpdateProductionActivities(productionActivities.map(a => a.id === id ? { ...a, name } : a));
    };

    // Phase 4.6 — driver choisi pour convertir le pool de frais fixes de CETTE activité en taux par
    // produit (voir l'infobulle ci-dessous pour le guide de décision). Propre à chaque activité :
    // deux activités peuvent choisir des drivers différents sans que la réconciliation en souffre
    // (chaque pool se normalise contre ses propres produits — voir 04-Conception-Modele.md).
    const handleActivityDriverChange = (id, indirectCostDriver) => {
        onUpdateProductionActivities(productionActivities.map(a => a.id === id ? { ...a, indirectCostDriver } : a));
    };

    const handleRemoveActivity = (id) => {
        if (productionActivities.length <= 1) {
            showNotification({ message: "Vous devez conserver au moins une activité de production.", type: 'error' });
            return;
        }
        const activityToDelete = productionActivities.find(a => a.id === id);
        const originalList = [...productionActivities];
        const newList = productionActivities.filter(a => a.id !== id);
        onUpdateProductionActivities(newList);
        showNotification({
            message: `L'activité de production "${activityToDelete.name || 'Sans nom'}" a été supprimée.`,
            type: 'info',
            onUndo: () => {
                onUpdateProductionActivities(originalList);
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
        onUpdateSalesChannels(salesChannels.filter(c => c.id !== channelId));
        showNotification({
            message: `Le circuit de vente "${channelToDelete.name || 'Sans nom'}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdateSalesChannels(originalList);
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
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Informations sur l'entreprise</h2>
                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nom de l'entreprise</label>
                        <input type="text" id="tutorial-company-name" value={companyName} onChange={(e) => onUpdateCompanyName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4">
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

                <div id="tutorial-section-info-objectifs" className="p-4 bg-gray-100 rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Objectifs stratégiques</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label htmlFor="foodCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif coût matière (%)
                                <Tooltip text="Le pourcentage maximum du prix de vente que le coût des ingrédients devrait représenter." />
                            </label>
                            <input type="text" inputMode="decimal" id="foodCostTarget" value={generalInfo.foodCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('foodCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidPercentage(generalInfo.foodCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {!isValidPercentage(generalInfo.foodCostTarget) && <ValidationMessage message="Doit être un %." />}
                        </div>
                        <div>
                            <label htmlFor="packagingCostTarget" className="flex items-center text-sm font-medium text-gray-700">
                                Objectif coût d'emballage (%)
                                <Tooltip text="Le pourcentage maximum du prix de vente que le coût d'emballage devrait représenter." />
                            </label>
                            <input type="text" inputMode="decimal" id="packagingCostTarget" value={generalInfo.packagingCostTarget || ''} onChange={(e) => onUpdateGeneralInfo('packagingCostTarget', e.target.value)} className={`mt-1 block w-full rounded-md shadow-sm p-2 border text-right ${!isValidPercentage(generalInfo.packagingCostTarget) ? 'border-red-500' : 'border-gray-300'}`} />
                            {!isValidPercentage(generalInfo.packagingCostTarget) && <ValidationMessage message="Doit être un %." />}
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
            </div>

            <div id="tutorial-section-info-activites" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                        Activités de production
                        <Tooltip text="Une activité de production regroupe les produits qui partagent un même procédé de fabrication (ex. Confitures, Produits séchés). Elle servira à répartir vos frais indirects par activité dans l'onglet État des résultats." />
                    </h2>
                    <button onClick={handleAddActivity} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-5 w-5 mr-2" /> Ajouter une activité
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
                                className={`flex-1 p-1 border rounded ${!isNotEmpty(activity.name) ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            <select
                                value={activity.indirectCostDriver || 'directCost'}
                                onChange={(e) => handleActivityDriverChange(activity.id, e.target.value)}
                                className="p-1 border rounded text-sm border-gray-300"
                                title="Driver de conversion des frais fixes de cette activité en taux par produit"
                            >
                                <option value="directCost">Selon les charges directes</option>
                                <option value="laborTime">Selon le temps de main-d'œuvre</option>
                            </select>
                            <Tooltip text="Driver utilisé pour convertir les frais fixes rattachés à CETTE activité (onglet État des résultats) en un taux $ par produit — propre à chaque activité, sans effet sur les autres. « Selon les charges directes » (matière + emballage + main-d'œuvre + sous-traitance combinés) : choix par défaut, approprié quand le coût indirect suit globalement la valeur des intrants consommés (supervision, gestion des stocks) — capture à la fois le volume et la complexité d'un produit. « Selon le temps de main-d'œuvre » : plus précis si le coût indirect suit plutôt la CADENCE/le temps machine (supervision horaire, chauffage pendant les heures de production) qu'une pure valeur d'intrants — utile si deux produits de cette activité ont un coût matière très différent mais un temps de production similaire, sinon le produit à ingrédient cher absorberait injustement plus de frais fixes." />
                            <button onClick={() => handleRemoveActivity(activity.id)} title="Supprimer l'activité de production" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div id="tutorial-section-info-channels" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                        Canaux de vente
                        <Tooltip text="Un canal de vente est une chaîne de mise en marché (ex. vente directe, grande distribution via un courtier et un distributeur). Chaque maillon applique une marge ou un markup sur le prix du maillon précédent, jusqu'au prix de vente suggéré au consommateur. Le rattachement d'un format de vente à un canal, avec son prix net, se fait dans Produits et SKUs ci-dessous." />
                    </h2>
                    <button onClick={handleAddChannel} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <PlusCircle className="h-5 w-5 mr-2" /> Ajouter un canal
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
                                    className={`flex-1 p-1 border rounded font-medium ${!isNotEmpty(channel.name) ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                <button onClick={() => handleRemoveChannel(channel.id)} title="Supprimer le circuit de vente" className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                            <div className="pl-4 space-y-1">
                                {channel.links.map((link) => (
                                    <div key={link.id} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={link.name}
                                            onChange={(e) => handleLinkChange(channel.id, link.id, 'name', e.target.value)}
                                            placeholder="ex. Distributeur"
                                            className="flex-1 p-1 border rounded text-sm border-gray-300"
                                        />
                                        <select
                                            value={link.type}
                                            onChange={(e) => handleLinkChange(channel.id, link.id, 'type', e.target.value)}
                                            className="p-1 border rounded text-sm border-gray-300"
                                        >
                                            <option value="margin">Marge</option>
                                            <option value="markup">Markup</option>
                                        </select>
                                        <input
                                            type="text" inputMode="decimal"
                                            value={link.percent}
                                            onChange={(e) => handleLinkChange(channel.id, link.id, 'percent', e.target.value)}
                                            placeholder="ex. 20"
                                            className={`w-20 p-1 border rounded text-right text-sm ${!isValidPercentage(link.percent) ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                        <span className="text-xs text-gray-500">%</span>
                                        <Tooltip text="Markup : % appliqué sur le prix précédent (ex. le coût) — prix = précédent × (1 + %). Marge : % du prix de VENTE résultant, pas du coût — prix = précédent ÷ (1 − %). Pour un même 20 % sur un coût de 10 $ : markup → 12,00 $ (10 × 1,20) ; marge → 12,50 $ (10 ÷ 0,80), car ces 20 % représentent alors 20 % du prix de vente de 12,50 $, pas du coût de 10 $." />
                                        <button onClick={() => handleRemoveLink(channel.id, link.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => handleAddLink(channel.id)} className="pl-4 text-xs text-blue-600 hover:text-blue-800">+ Ajouter un maillon</button>
                        </div>
                    ))}
                </div>
            </div>

            <div id="tutorial-section-info-menu" className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">Produits et SKUs</h2>
                    <div className="flex items-center space-x-2">
                        <button onClick={onOpenSalesImport} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                            <Upload className="h-5 w-5 mr-2" /> Importer un rapport de ventes
                        </button>
                        <button id="tutorial-add-item" onClick={handleAddItem} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            Ajouter un item
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
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
                        <label htmlFor="filterActivity" className="block text-sm font-medium text-gray-700">Filtrer par activité de production</label>
                        <select
                            id="filterActivity"
                            value={filterActivity}
                            onChange={e => setFilterActivity(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            <option value="all">Toutes les activités</option>
                            {productionActivities.map(activity => (
                                <option key={activity.id} value={activity.id}>{activity.name || 'Sans nom'}</option>
                            ))}
                        </select>
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
                
                {allRows.length > 0 && Math.round(totalSalesMix) !== 100 && (
                    <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm flex items-center justify-center">
                        <AlertTriangle className="inline h-4 w-4 mr-2"/>
                        Attention : Le total de votre mix des ventes est de {totalSalesMix.toFixed(1)}%. Pour une analyse précise, il devrait être de 100%.
                    </div>
                )}

                <div className="flex items-center gap-4 mb-3 px-1">
                    <button onClick={() => requestSort('platName')} className="flex items-center text-xs font-medium text-gray-500 uppercase">Trier par nom {getSortIcon('platName')}</button>
                    <button onClick={() => requestSort('category')} className="flex items-center text-xs font-medium text-gray-500 uppercase">Trier par catégorie {getSortIcon('category')}</button>
                </div>

                <div className="space-y-4">
                    {displayedProducts.map(({ product, productIndex }) => {
                        const formats = product.formats || [];
                        return (
                        <div key={product.id} id={`product-section-${product.id}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-50 p-3 flex flex-wrap items-end gap-3 border-b border-gray-200">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-medium text-gray-500 uppercase">Nom du plat</label>
                                    <input type="text" value={product.platName || ''} onChange={(e) => handleProductValueChange(productIndex, 'platName', e.target.value)} className={`mt-1 w-full p-1.5 border rounded font-semibold ${!isNotEmpty(product.platName) ? 'border-red-500' : 'border-gray-300'}`} />
                                    {!isNotEmpty(product.platName) && <ValidationMessage message="Requis." />}
                                </div>
                                <div className="w-48">
                                    <label className="flex items-center text-xs font-medium text-gray-500 uppercase">
                                        Activité de production
                                        <Tooltip text="Le procédé de fabrication auquel ce produit appartient (ex. Confitures, Produits séchés) — servira à répartir vos frais indirects par activité dans l'onglet État des résultats." />
                                    </label>
                                    <select value={product.activityId || ''} onChange={(e) => handleProductValueChange(productIndex, 'activityId', e.target.value)} className="mt-1 w-full p-1.5 border rounded border-gray-300">
                                        {productionActivities.map(activity => (
                                            <option key={activity.id} value={activity.id}>{activity.name || 'Sans nom'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-48">
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
                                <div className="flex items-center gap-1 pb-1">
                                    <button onClick={() => onDuplicateProduct(productIndex)} title="Dupliquer le plat" className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full hover:bg-indigo-50"><Layers size={18}/></button>
                                    <button onClick={() => onDeleteProduct(productIndex)} title="Supprimer le plat (tous ses formats)" className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100"><Trash2 size={18}/></button>
                                </div>
                            </div>

                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            <div className="flex items-center">
                                                Format
                                                <Tooltip text="L'emballage et la quantité de ce format de vente (ex. 250 ml, 1 kg). Un produit peut avoir plusieurs formats — un pot de 250 ml et un pot de 500 ml, par exemple — chacun avec sa propre fiche recette, son propre prix et mix des ventes." />
                                            </div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            <div className="flex items-center">
                                                SKU
                                                <Tooltip text="Numéro de référence de ce format, déduit automatiquement de la recette et du format (librement modifiable)." />
                                            </div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            <div className="flex items-center">
                                                PDS ($)
                                                <Tooltip text="Prix de détail suggéré au consommateur pour ce format — saisi manuellement, une seule valeur pour tous les canaux (le prix tablette visé ne varie généralement pas par canal, contrairement au prix net producteur). Sert à générer le prix net de chaque canal via le bouton « Générer » (section Canaux de vente ci-dessous), qui redescend la cascade de maillons de ce canal à partir de ce prix." />
                                            </div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            <div className="flex items-center">
                                                Canaux de vente
                                                <Tooltip text="Le prix net et le volume de ce format diffèrent selon le canal (vente directe, distributeur...). Un format n'est pas forcément vendu dans tous les canaux — ex. un grand format réservé à la restauration. Le premier canal de la liste détermine le prix utilisé ailleurs dans l'app (marge, rapports) en attendant que ces écrans deviennent eux-mêmes multi-canal." />
                                            </div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mix des Ventes (%)</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Au Menu</th>
                                        <th className="relative px-4 py-2"><span className="sr-only">Actions</span></th>
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
                                        <tr id={`format-row-${format.id}`} className={format.id === newlyAddedId ? 'new-row' : ''} onBlur={handleBlurRow} tabIndex={-1}>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input type="text" inputMode="decimal" value={format.portionSize || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'portionSize', e.target.value)} className={`w-16 p-1 border rounded text-right ${!isValidNumber(format.portionSize) ? 'border-red-500' : 'border-gray-300'}`} />
                                                    <select value={format.portionUnit || 'unité'} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'portionUnit', e.target.value)} className="p-1 border rounded border-gray-300">
                                                        <option value="g">g</option>
                                                        <option value="kg">kg</option>
                                                        <option value="ml">ml</option>
                                                        <option value="L">L</option>
                                                        <option value="unité">unité</option>
                                                    </select>
                                                </div>
                                                {!isValidNumber(format.portionSize) && <ValidationMessage message="Quantité invalide." />}
                                            </td>
                                            <td className="px-4 py-2">
                                                <input type="text" value={format.sku || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'sku', e.target.value)} placeholder="ex. CONF-250ML" className="w-40 p-1 border rounded border-gray-300" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input type="text" inputMode="decimal" value={format.pds ?? ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'pds', e.target.value)} onBlur={(e) => handleFormatValueChange(productIndex, formatIndex, 'pds', parseLocaleNumber(e.target.value) || '')} placeholder="PDS $" title="Prix de détail suggéré au consommateur, saisi manuellement — sert à générer le prix net de chaque canal (bouton « Générer », section Canaux de vente)." className="w-24 p-1 border rounded text-right border-gray-300" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <button onClick={() => toggleFormatExpanded(format.id)} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${channelPrices.length === 0 ? 'text-orange-700 bg-orange-50' : 'text-gray-700 bg-gray-100'} hover:bg-gray-200`}>
                                                    {channelPrices.length === 0 ? 'Aucun canal' : `${channelPrices.length} ${channelPrices.length > 1 ? 'canaux' : 'canal'}`}
                                                    <ChevronDown className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input type="text" inputMode="decimal" value={format.salesMix || ''} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'salesMix', e.target.value)} disabled={!format.onMenu || isSalesMixAuto} className={`w-24 p-1 border rounded text-right ${!isValidPercentage(format.salesMix) ? 'border-red-500' : 'border-gray-300'} ${!format.onMenu || isSalesMixAuto ? 'bg-gray-100' : ''}`} />
                                                    {isSalesMixAuto && <Tooltip text="Calculé automatiquement à partir des unités vendues saisies pour ce format (onglet Canaux de vente ci-dessus) — plus précis qu'un % tapé à la main. Pour reprendre la main sur ce %, retirez toutes les unités saisies pour ce format." />}
                                                </div>
                                                {!isValidPercentage(format.salesMix) && <ValidationMessage message="Doit être un %." />}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <input type="checkbox" checked={format.onMenu} onChange={(e) => handleFormatValueChange(productIndex, formatIndex, 'onMenu', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => onDuplicateFormat(productIndex, formatIndex)} title="Dupliquer ce format" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={16}/></button>
                                                    <button onClick={() => onDeleteFormat(productIndex, formatIndex)} title={isOnlyFormat ? "Supprimer le plat" : "Supprimer ce format"} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-3 bg-gray-50">
                                                    <div className="max-w-3xl">
                                                    {channelPrices.length === 0 && (
                                                        <p className="text-sm text-gray-500">Ce format n'est rattaché à aucun canal de vente — il n'apparaîtra dans aucune analyse de marge tant qu'aucun canal n'est ajouté.</p>
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
                                                                        className="flex-1 p-1 border rounded text-sm border-gray-300"
                                                                    >
                                                                        {salesChannels.map(c => <option key={c.id} value={c.id}>{c.name || 'Sans nom'}</option>)}
                                                                    </select>
                                                                    <div>
                                                                        <label className="sr-only">Prix net ($)</label>
                                                                        <input
                                                                            type="text" inputMode="decimal"
                                                                            value={cp.netPrice}
                                                                            onChange={(e) => handleChannelPriceFieldChange(productIndex, formatIndex, format, cp.id, 'netPrice', e.target.value)}
                                                                            placeholder="Prix net $"
                                                                            className={`w-24 p-1 border rounded text-right text-sm ${!isValidNumber(cp.netPrice) ? 'border-red-500' : 'border-gray-300'}`}
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
                                                                            className={`w-28 p-1 border rounded text-right text-sm ${!isValidNumber(cp.volume) ? 'border-red-500' : 'border-gray-300'}`}
                                                                        />
                                                                    </div>
                                                                    {channel?.links?.length > 0 && (
                                                                        <Tooltip text={`Cascade de ce canal : ${channel.links.map(l => `${l.name || '(sans nom)'} ${l.type === 'markup' ? 'markup' : 'marge'} ${l.percent || 0}%`).join(' → ')}.`} />
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
                            <div className="p-2 bg-gray-50 border-t border-gray-200">
                                <button onClick={() => onAddFormat(productIndex)} className="inline-flex items-center text-sm text-green-600 hover:text-green-800">
                                    <PlusCircle size={16} className="mr-1" /> Ajouter un format
                                </button>
                            </div>
                        </div>
                    )})}
                </div>

                <Pagination
                    totalItems={filteredAndSortedProducts.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            </div>
        </div>
    );
};