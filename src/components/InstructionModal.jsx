import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// --- MODAL D'INSTRUCTIONS (VERSION FINALE COMPLÈTE ET EXHAUSTIVE) ---
export const InstructionModal = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const contentRef = useRef(null);
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);


    // Fonction pour surligner le texte de recherche
    const highlightText = (text, highlight) => {
        if (!text) return '';
        if (!highlight.trim()) {
            return text;
        }
        const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.split(regex).map((part, index) =>
            regex.test(part) ? <mark key={index} className="bg-yellow-200 px-1 rounded-sm">{part}</mark> : part
        );
    };

    const handleLinkClick = (e, id) => {
        e.preventDefault();
        const element = contentRef.current.querySelector(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(0);
            return;
        }

        const results = Array.from(contentRef.current.querySelectorAll('mark'));
        setSearchResults(results);
        setCurrentResultIndex(0);

        if (results.length > 0) {
            results[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchTerm]);

    const navigateResults = (direction) => {
        if (searchResults.length === 0) return;

        const newIndex = direction === 'next'
            ? (currentResultIndex + 1) % searchResults.length
            : (currentResultIndex - 1 + searchResults.length) % searchResults.length;

        setCurrentResultIndex(newIndex);
        searchResults[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Guide d'utilisation exhaustif</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
                        <X className="h-6 w-6 text-gray-600" />
                    </button>
                </div>
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="mb-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                placeholder="Rechercher un terme (ex: 'Marge Nette', 'Analyse ABC')..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 border rounded-md border-gray-300"
                            />
                            {searchTerm.trim() && (
                                <div className="flex items-center space-x-1 text-sm text-gray-600 flex-shrink-0">
                                    <span>
                                        {searchResults.length > 0 ? currentResultIndex + 1 : 0} / {searchResults.length}
                                    </span>
                                    <button onClick={() => navigateResults('prev')} disabled={searchResults.length === 0} className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50">↑</button>
                                    <button onClick={() => navigateResults('next')} disabled={searchResults.length === 0} className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50">↓</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                        <nav className="w-1/3 pr-4 overflow-y-auto">
                            <h3 className="font-semibold text-lg mb-2">Table des matières</h3>
                            <ul className="space-y-1 text-sm">
                                <li><a href="#guide-intro" onClick={(e) => handleLinkClick(e, '#guide-intro')} className="font-bold text-blue-700 hover:underline">Introduction</a></li>
                                <li><a href="#guide-gestion" onClick={(e) => handleLinkClick(e, '#guide-gestion')} className="font-bold text-blue-700 hover:underline">Gestion de projet</a></li>
                                <li>
                                    <a href="#guide-parametres" onClick={(e) => handleLinkClick(e, '#guide-parametres')} className="font-bold text-blue-700 hover:underline">Onglet 1: Paramètres</a>
                                    <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-param-entreprise" onClick={(e) => handleLinkClick(e, '#guide-param-entreprise')} className="text-gray-600 hover:underline">Informations sur l'entreprise</a></li>
                                        <li><a href="#guide-param-objectifs" onClick={(e) => handleLinkClick(e, '#guide-param-objectifs')} className="text-gray-600 hover:underline">Objectifs stratégiques</a></li>
                                        <li><a href="#guide-param-units" onClick={(e) => handleLinkClick(e, '#guide-param-units')} className="text-gray-600 hover:underline">Unités de mesure</a></li>
                                        <li><a href="#guide-param-activites" onClick={(e) => handleLinkClick(e, '#guide-param-activites')} className="text-gray-600 hover:underline">Activités de production</a></li>
                                        <li><a href="#guide-param-channels" onClick={(e) => handleLinkClick(e, '#guide-param-channels')} className="text-gray-600 hover:underline">Canaux de vente</a></li>
                                        <li><a href="#guide-param-menu" onClick={(e) => handleLinkClick(e, '#guide-param-menu')} className="text-gray-600 hover:underline">Produits et SKUs</a></li>
                                        <li><a href="#guide-param-import-pos" onClick={(e) => handleLinkClick(e, '#guide-param-import-pos')} className="text-gray-600 hover:underline">Assistant d'importation d'un rapport de ventes</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-ingredients" onClick={(e) => handleLinkClick(e, '#guide-ingredients')} className="font-bold text-blue-700 hover:underline">Onglet 2: Ingrédients</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-ing-db" onClick={(e) => handleLinkClick(e, '#guide-ing-db')} className="text-gray-600 hover:underline">Base de données</a></li>
                                        <li><a href="#guide-ing-comparaison" onClick={(e) => handleLinkClick(e, '#guide-ing-comparaison')} className="text-gray-600 hover:underline">Outil de comparaison</a></li>
                                        <li><a href="#guide-ing-import" onClick={(e) => handleLinkClick(e, '#guide-ing-import')} className="text-gray-600 hover:underline">Assistant d'importation</a></li>
                                        <li><a href="#guide-ing-abc" onClick={(e) => handleLinkClick(e, '#guide-ing-abc')} className="text-gray-600 hover:underline">Analyse ABC</a></li>
                                        <li><a href="#guide-ing-rapport" onClick={(e) => handleLinkClick(e, '#guide-ing-rapport')} className="text-gray-600 hover:underline">Rapport d'achats</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-packaging" onClick={(e) => handleLinkClick(e, '#guide-packaging')} className="font-bold text-blue-700 hover:underline">Onglet 3: Packaging</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-pkg-db" onClick={(e) => handleLinkClick(e, '#guide-pkg-db')} className="text-gray-600 hover:underline">Base de données</a></li>
                                        <li><a href="#guide-pkg-import" onClick={(e) => handleLinkClick(e, '#guide-pkg-import')} className="text-gray-600 hover:underline">Assistant d'importation</a></li>
                                        <li><a href="#guide-pkg-abc" onClick={(e) => handleLinkClick(e, '#guide-pkg-abc')} className="text-gray-600 hover:underline">Analyse ABC</a></li>
                                        <li><a href="#guide-pkg-rapport" onClick={(e) => handleLinkClick(e, '#guide-pkg-rapport')} className="text-gray-600 hover:underline">Rapport d'achats</a></li>
                                    </ul>
                                </li>
                                 <li>
                                    <a href="#guide-maindoeuvre" onClick={(e) => handleLinkClick(e, '#guide-maindoeuvre')} className="font-bold text-blue-700 hover:underline">Onglet 4: Main-d'œuvre</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-mo-db" onClick={(e) => handleLinkClick(e, '#guide-mo-db')} className="text-gray-600 hover:underline">Base de données</a></li>
                                        <li><a href="#guide-mo-rapport" onClick={(e) => handleLinkClick(e, '#guide-mo-rapport')} className="text-gray-600 hover:underline">Rapport de productivité</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-frais-fixes" onClick={(e) => handleLinkClick(e, '#guide-frais-fixes')} className="font-bold text-blue-700 hover:underline">Onglet 5: État des résultats</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-ff-periode" onClick={(e) => handleLinkClick(e, '#guide-ff-periode')} className="text-gray-600 hover:underline">Période de référence</a></li>
                                        <li><a href="#guide-ff-revenus" onClick={(e) => handleLinkClick(e, '#guide-ff-revenus')} className="text-gray-600 hover:underline">Revenus</a></li>
                                        <li><a href="#guide-ff-charges-directes" onClick={(e) => handleLinkClick(e, '#guide-ff-charges-directes')} className="text-gray-600 hover:underline">Charges directes réelles</a></li>
                                        <li><a href="#guide-ff-liste" onClick={(e) => handleLinkClick(e, '#guide-ff-liste')} className="text-gray-600 hover:underline">Frais fixes</a></li>
                                        <li><a href="#guide-ff-reconciliation" onClick={(e) => handleLinkClick(e, '#guide-ff-reconciliation')} className="text-gray-600 hover:underline">Réconciliation réel / théorique</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-recette" onClick={(e) => handleLinkClick(e, '#guide-recette')} className="font-bold text-blue-700 hover:underline">Onglet 6: Production</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-recette-header" onClick={(e) => handleLinkClick(e, '#guide-recette-header')} className="text-gray-600 hover:underline">En-tête de la recette</a></li>
                                        <li><a href="#guide-recette-ing" onClick={(e) => handleLinkClick(e, '#guide-recette-ing')} className="text-gray-600 hover:underline">1. Ingrédients</a></li>
                                        <li><a href="#guide-recette-packaging" onClick={(e) => handleLinkClick(e, '#guide-recette-packaging')} className="text-gray-600 hover:underline">2. Emballage</a></li>
                                        <li><a href="#guide-recette-mo" onClick={(e) => handleLinkClick(e, '#guide-recette-mo')} className="text-gray-600 hover:underline">3. Processus de production</a></li>
                                        <li><a href="#guide-recette-recap" onClick={(e) => handleLinkClick(e, '#guide-recette-recap')} className="text-gray-600 hover:underline">5. Récapitulatif</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-resume" onClick={(e) => handleLinkClick(e, '#guide-resume')} className="font-bold text-blue-700 hover:underline">Onglet 7: Rapport</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-resume-tableau" onClick={(e) => handleLinkClick(e, '#guide-resume-tableau')} className="text-gray-600 hover:underline">Tableau comparatif</a></li>
                                        <li><a href="#guide-resume-contribution" onClick={(e) => handleLinkClick(e, '#guide-resume-contribution')} className="text-gray-600 hover:underline">Classement par contribution</a></li>
                                        <li><a href="#guide-resume-strategie" onClick={(e) => handleLinkClick(e, '#guide-resume-strategie')} className="text-gray-600 hover:underline">Analyse stratégique</a></li>
                                        <li><a href="#guide-exports" onClick={(e) => handleLinkClick(e, '#guide-exports')} className="text-gray-600 hover:underline">Exports (PDF & Excel)</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-suivi" onClick={(e) => handleLinkClick(e, '#guide-suivi')} className="font-bold text-blue-700 hover:underline">Onglet 8: Suivi</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-suivi-points" onClick={(e) => handleLinkClick(e, '#guide-suivi-points')} className="text-gray-600 hover:underline">Points de référence</a></li>
                                        <li><a href="#guide-suivi-graphiques" onClick={(e) => handleLinkClick(e, '#guide-suivi-graphiques')} className="text-gray-600 hover:underline">Graphiques d'évolution</a></li>
                                    </ul>
                                </li>
                                <li><a href="#guide-definitions" onClick={(e) => handleLinkClick(e, '#guide-definitions')} className="font-bold text-blue-700 hover:underline">Glossaire : Dictionnaire des termes clés</a></li>
                                <li><a href="#guide-conclusion" onClick={(e) => handleLinkClick(e, '#guide-conclusion')} className="font-bold text-blue-700 hover:underline">Conclusion</a></li>
                            </ul>
                        </nav>
                        <div ref={contentRef} className="w-2/3 pl-4 border-l overflow-y-auto text-sm leading-relaxed">
                            <div className="space-y-10">
                                <section id="guide-intro">
                                    <h3 className="text-xl font-semibold mb-2">{highlightText('Introduction', searchTerm)}</h3>
                                    <p>{highlightText("Bienvenue dans Resto Calculateur. Cet outil a été conçu pour aller bien au-delà d'un simple calcul de coûts. C'est un véritable instrument de pilotage stratégique pour votre menu, vous aidant à comprendre la rentabilité de chaque plat, à optimiser vos coûts et à prendre des décisions éclairées pour maximiser vos profits. Ce guide détaille chaque fonctionnalité pour vous permettre d'en tirer le plein potentiel. Pour une prise en main encore plus rapide, un tutoriel guidé interactif est également disponible et se lance automatiquement lors de la création d'un nouveau projet.", searchTerm)}</p>
                                </section>
                                <section id="guide-gestion">
                                    <h3 className="text-xl font-semibold mb-2">{highlightText('Gestion de projet', searchTerm)}</h3>
                                    <p className="mb-4">{highlightText("Les boutons situés en haut à droite de l'application sont le centre de contrôle de vos projets. Voici le détail de chaque fonction :", searchTerm)}</p>
                                    <ul className="list-disc list-inside space-y-2 pl-4">
                                        <li><strong>{highlightText("Guide d'utilisation :", searchTerm)}</strong> {highlightText("Ouvre ce guide complet pour vous aider à maîtriser toutes les fonctionnalités de l'application.", searchTerm)}</li>
                                        <li><strong>{highlightText('Nouveau :', searchTerm)}</strong> {highlightText("Réinitialise l'application pour commencer un nouveau projet vierge. Une confirmation vous sera demandée.", searchTerm)}</li>
                                        <li><strong>{highlightText('Sauvegarder :', searchTerm)}</strong> {highlightText("Enregistre l'ensemble de votre travail (informations, ingrédients, plats, etc.) dans un unique fichier .json sur votre ordinateur.", searchTerm)}</li>
                                        <li><strong>{highlightText('Ouvrir :', searchTerm)}</strong> {highlightText("Charge un projet précédemment sauvegardé à partir d'un fichier .json. Attention, cela remplacera le projet actuellement ouvert.", searchTerm)}</li>
                                    </ul>
                                    <p className="mt-4">{highlightText("De plus, la suppression d'items (plats, ingrédients, etc.) est sécurisée par un système d'annulation : une notification apparaît, vous laissant plusieurs secondes pour annuler une suppression accidentelle.", searchTerm)}</p>
                                </section>
                                <section id="guide-parametres">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 1: Paramètres", searchTerm)}</h3>
                                    <p className="mb-4">{highlightText("Cette section est le point de départ de toute analyse. Vous y définissez les informations globales qui serviront de base à tous les calculs.", searchTerm)}</p>
                                    <div id="guide-param-entreprise" className="space-y-2">
                                         <h4 className="text-lg font-semibold">{highlightText("Informations sur l'entreprise", searchTerm)}</h4>
                                         <p>{highlightText("Cette section vous permet de personnaliser vos rapports. Le nom et le logo que vous entrez ici apparaîtront sur la page de garde de vos exports PDF.", searchTerm)}</p>
                                    </div>
                                     <div id="guide-param-objectifs" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Objectifs stratégiques", searchTerm)}</h4>
                                        <p>{highlightText("Définissez des pourcentages cibles pour vos coûts. Dans l'onglet 'Rapport', des symboles apparaîtront à côté des coûts de chaque plat pour indiquer visuellement s'ils respectent ou non ces objectifs.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-units" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Unités de mesure", searchTerm)}</h4>
                                        <p>{highlightText("Le bouton « Gérer les unités de mesure » ouvre une fenêtre où vous cochez les unités offertes partout où une unité peut être choisie (Ingrédients, Packaging, Produits et SKUs, Recette & Calcul). Les 5 unités de base (g, kg, ml, L, unité) sont actives par défaut ; vous pouvez en activer d'autres (ex. lb, hL, tonne, douzaine) si votre production en a besoin. Décocher une unité déjà utilisée par une donnée existante ne la supprime pas — cette donnée garde sa valeur.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-activites" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Activités de production", searchTerm)}</h4>
                                        <p>{highlightText("Une activité de production regroupe les produits qui partagent un même procédé de fabrication (ex. Confitures, Produits séchés). Créez-les ici avant de créer vos produits, puisque chaque produit doit être rattaché à une activité. Elles serviront à répartir vos frais indirects par activité dans l'onglet État des résultats (fonctionnalité à venir).", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-channels" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Canaux de vente", searchTerm)}</h4>
                                        <p>{highlightText("Un canal de vente est une chaîne de mise en marché : une liste ordonnée de maillons (ex. Producteur → Distributeur → Détaillant), chacun appliquant une marge ou un markup sur le prix du maillon précédent, jusqu'au prix de vente suggéré au consommateur. Un canal « Vente directe » existe par défaut, sans maillon — il correspond au prix de vente unique habituel. Chaque carte de canal n'affiche qu'un résumé (« N maillons » ou « Aucun maillon ») ; le bouton « Gérer les maillons » ouvre une fenêtre dédiée pour les ajouter, les modifier ou les supprimer.", searchTerm)}</p>
                                        <ul className="list-disc list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Markup vs marge :', searchTerm)}</strong> {highlightText("Un markup est un % appliqué sur le prix précédent (le coût d'entrée de ce maillon) ; une marge est un % du prix de VENTE à ce maillon, pas du coût — les deux donnent des résultats différents pour le même pourcentage, d'où la distinction explicite à chaque maillon.", searchTerm)}</li>
                                            <li><strong>{highlightText('Rattachement à un format :', searchTerm)}</strong> {highlightText("Cette section définit seulement la structure (nom, maillons, %) de chaque canal. Le rattachement d'un format de vente précis à un canal, avec son prix net, se fera dans Produits et SKUs (à venir).", searchTerm)}</li>
                                        </ul>
                                    </div>
                                    <div id="guide-param-menu" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Produits et SKUs", searchTerm)}</h4>
                                        <p>{highlightText("C'est la liste maîtresse de toutes vos recettes et de leurs formats de vente. À gauche, une liste compacte de tous vos produits (nom, catégorie, nombre de formats) — cliquez-en un pour afficher son détail complet à droite. Un produit peut être vendu sous plusieurs formats — l'emballage et la quantité, ex. un pot de confiture de 250 ml et un pot de 500 ml — chacun avec sa propre fiche recette, son propre SKU, prix et mix des ventes ; le détail à droite liste donc tous les formats du produit sélectionné. Chaque produit créé ici apparaît dans le menu déroulant de l'onglet 'Recettes et produits', où vous détaillez la recette et les coûts de chacun de ses formats.", searchTerm)}</p>
                                        <ul className="list-decimal list-inside space-y-2 pl-4 mt-2">
                                            <li><strong>{highlightText('En-tête du détail (par recette) :', searchTerm)}</strong> {highlightText("Nom du plat, ligne de fabrication et catégorie, communs à tous les formats de cette recette ; boutons pour dupliquer ou supprimer la recette en entier (tous ses formats).", searchTerm)}</li>
                                            <li><strong>{highlightText('Format :', searchTerm)}</strong> {highlightText("La quantité et l'unité de ce format (ex. 250 ml) — c'est l'emballage que vous vendez, remplace l'ancienne 'quantité par portion'.", searchTerm)}</li>
                                            <li><strong>{highlightText('SKU :', searchTerm)}</strong> {highlightText("Le numéro de référence de ce format — pas une donnée indépendante : il se déduit automatiquement de la recette et du format à la création (librement modifiable ensuite).", searchTerm)}</li>
                                            <li><strong>{highlightText('PDS ($) :', searchTerm)}</strong> {highlightText("Le prix de détail suggéré au consommateur pour ce format, saisi manuellement — une seule valeur pour tous ses canaux (le prix tablette visé ne varie généralement pas par canal, contrairement au prix net producteur). Sert à générer automatiquement le prix net de chaque canal (voir Canaux de vente ci-dessous).", searchTerm)}</li>
                                            <li><strong>{highlightText('Canaux de vente :', searchTerm)}</strong> {highlightText("Le prix net et le volume de ce format diffèrent selon le canal. Le bouton « Générer », à côté de chaque canal, calcule son prix net à partir du PDS ci-dessus en redescendant la cascade de maillons de ce canal — le prix net reste ensuite librement modifiable à la main.", searchTerm)}</li>
                                            <li><strong>{highlightText('Mix des ventes (%) :', searchTerm)}</strong> {highlightText("Un des chiffres les plus importants. Il représente la popularité de ce format en pourcentage des ventes. La somme de tous les formats 'Au Menu' devrait idéalement être de 100%.", searchTerm)}</li>
                                            <li><strong>{highlightText('Au Menu (case à cocher) :', searchTerm)}</strong> {highlightText("Détermine si ce format doit être inclus dans les calculs d'analyse (ex: analyse stratégique, rapport d'achats). Décochez cette case pour les formats saisonniers ou en développement.", searchTerm)}</li>
                                            <li><strong>{highlightText('Actions sur un format :', searchTerm)}</strong> {highlightText("Dupliquez ou supprimez ce format ; le bouton « Ajouter un format » en bas du détail en crée un nouveau, vierge, pour cette recette.", searchTerm)}</li>
                                        </ul>
                                        <p className="mt-2">{highlightText("Vous pouvez aussi ajouter un nouveau format directement depuis l'onglet Production (fenêtre « Ajouter un format »), et copier une section de la fiche recette (ingrédients, étapes de production...) d'un format à un autre sans dupliquer le format en entier — voir la section suivante.", searchTerm)}</p>
                                        <p className="mt-2">{highlightText("Navigation dans la liste : utilisez les filtres (nom, activité, catégorie) et les contrôles de pagination sous la liste de gauche pour retrouver un produit parmi un grand nombre de recettes. Ajouter un produit ou un duplicata le sélectionne automatiquement pour en afficher tout de suite le détail.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-import-pos" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Assistant d'importation d'un rapport de ventes", searchTerm)}</h4>
                                        <p>{highlightText("Cet assistant lit un rapport de ventes (Excel ou CSV) — un export comptable (QuickBooks, Odoo...), un rapport par distributeur, ou tout fichier listant plat, quantité vendue et prix — et met à jour le prix net et le volume de vos formats PAR CANAL DE VENTE :", searchTerm)}</p>
                                        <ul className="list-disc list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText("Agrégation des ventes :", searchTerm)}</strong> {highlightText("Il regroupe automatiquement toutes les lignes d'un même plat × format × canal pour calculer la quantité totale vendue.", searchTerm)}</li>
                                            <li><strong>{highlightText("Résolution du format et du canal :", searchTerm)}</strong> {highlightText("Si une colonne Format ou Canal est mappée et qu'une valeur ne correspond à rien d'existant, vous choisissez pour chaque ligne : lier à un format/canal existant, créer un nouveau canal (jamais un nouveau format automatiquement), ou ignorer la ligne.", searchTerm)}</li>
                                            <li><strong>{highlightText("Détection de la période :", searchTerm)}</strong> {highlightText("Si une colonne de date est mappée, l'assistant met à jour la 'Période de référence' pour correspondre aux dates du rapport.", searchTerm)}</li>
                                            <li><strong>{highlightText("Recalcul du mix des ventes :", searchTerm)}</strong> {highlightText("Le mix des ventes de TOUS les formats du menu se redéduit des volumes par canal déjà saisis (cet import et les précédents) — un format sans aucun volume importé apparaîtra à 0 %.", searchTerm)}</li>
                                            <li><strong>{highlightText("Liaison manuelle :", searchTerm)}</strong> {highlightText("Si un plat du rapport ne correspond pas exactement à un nom existant, vous pouvez le lier manuellement pour éviter les doublons.", searchTerm)}</li>
                                        </ul>
                                    </div>
                                </section>
                                <section id="guide-ingredients">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 2: Ingrédients", searchTerm)}</h3>
                                    <p className="mb-4">{highlightText("Cet onglet est votre base de données centrale pour toutes vos matières premières. Une gestion rigoureuse ici est la clé de la précision de vos coûts.", searchTerm)}</p>
                                    <div id="guide-ing-db" className="space-y-2 mt-4">
                                         <h4 className="text-lg font-semibold">{highlightText("Base de données des ingrédients", searchTerm)}</h4>
                                         <p>{highlightText("Cette section est votre inventaire de matières premières. Une gestion rigoureuse ici est la clé de la précision de vos coûts. Voici le détail des colonnes clés :", searchTerm)}</p>
                                         <ul className="list-decimal list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Prix unitaire ($) :', searchTerm)}</strong> {highlightText("Ce coût est calculé automatiquement (`Prix Achat` / `Format Achat`) et sert de base à tous les calculs dans vos recettes.", searchTerm)}</li>
                                            <li><strong>{highlightText('Taux de perte (%) :', searchTerm)}</strong> {highlightText("Crucial pour un calcul réaliste. Ce champ représente la perte de matière avant la production (péremption, produits abîmés, gaspillage en stock). Ce pourcentage est utilisé dans le 'Rapport d'achats et pertes' pour calculer le 'Coût Perdu' et ajuster le 'Coût d'Achat Requis'.", searchTerm)}</li>
                                            <li><strong>{highlightText('Dernière MàJ :', searchTerm)}</strong> {highlightText("La date de la dernière modification du prix d'achat. Un point jaune apparaît si la date est supérieure à 30 jours, vous alertant qu'il est peut-être temps de vérifier ce prix.", searchTerm)}</li>
                                            <li><strong>{highlightText('Actions :', searchTerm)}</strong> {highlightText("L'icône d'alerte permet de gérer les allergènes. Elle change de couleur (rouge) si des allergènes sont assignés à l'ingrédient, vous donnant un repère visuel immédiat.", searchTerm)}</li>
                                         </ul>
                                         <p className="mt-2">{highlightText("N'oubliez pas d'utiliser les contrôles de pagination en bas du tableau pour naviguer dans les longues listes d'ingrédients.", searchTerm)}</p>
                                    </div>
                                     <div id="guide-ing-comparaison" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Outil de comparaison des ingrédients", searchTerm)}</h4>
                                        <p>{highlightText("Utilisez le champ 'Comparer un ingrédient' pour visualiser côte à côte les différents fournisseurs pour un même produit. L'outil calcule le 'prix efficace', qui tient compte du taux de perte en stock, vous révélant le coût réel de l'ingrédient une fois utilisable en cuisine.", searchTerm)}</p>
                                    </div>
                                     <div id="guide-ing-import" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Assistant d'importation d'ingrédients", searchTerm)}</h4>
                                        <p>{highlightText("Importez rapidement votre liste de prix. L'assistant offre plusieurs options pour faciliter le processus :", searchTerm)}</p>
                                        <ul className="list-disc list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText("Choix de l'onglet :", searchTerm)}</strong> {highlightText("Si votre fichier Excel contient plusieurs feuilles, l'assistant vous demandera de choisir laquelle importer.", searchTerm)}</li>
                                            <li><strong>{highlightText("Fournisseur par défaut :", searchTerm)}</strong> {highlightText("Si votre fichier ne contient pas de colonne pour le fournisseur, vous pouvez en spécifier un par défaut qui sera appliqué à tous les nouveaux ingrédients.", searchTerm)}</li>
                                            <li><strong>{highlightText("Gestion des doublons :", searchTerm)}</strong> {highlightText("L'outil gère intelligemment les doublons en se basant sur la combinaison (SKU/PLU + Fournisseur) ou (Nom + Format + Fournisseur) pour éviter les erreurs.", searchTerm)}</li>
                                            <li><strong>{highlightText("Liaison manuelle :", searchTerm)}</strong> {highlightText("Vous pouvez lier manuellement un ingrédient importé à un ingrédient déjà existant dans votre base de données.", searchTerm)}</li>
                                        </ul>
                                    </div>
                                    <div id="guide-ing-abc" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Analyse ABC des ingrédients", searchTerm)}</h4>
                                        <p>{highlightText("Basée sur le principe de Pareto (80/20), cette analyse classe vos ingrédients par importance financière pour vous aider à concentrer vos efforts. Le calcul se fait en classant vos ingrédients par valeur de consommation totale sur la période, puis en les répartissant comme suit :", searchTerm)}</p>
                                        <ul className="list-disc list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Catégorie A :', searchTerm)}</strong> {highlightText("Les quelques ingrédients qui représentent les premiers 70% de votre coût total. Ce sont vos produits les plus importants, à négocier et à contrôler de très près.", searchTerm)}</li>
                                            <li><strong>{highlightText('Catégorie B :', searchTerm)}</strong> {highlightText("Les ingrédients qui amènent le total cumulé de 70% à 90%. Leur importance est moyenne.", searchTerm)}</li>
                                            <li><strong>{highlightText('Catégorie C :', searchTerm)}</strong> {highlightText("Tous les autres ingrédients, qui représentent les derniers 10% de vos coûts. Leur contrôle peut être plus souple.", searchTerm)}</li>
                                        </ul>
                                    </div>
                                     <div id="guide-ing-rapport" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Rapport d'achats et pertes", searchTerm)}</h4>
                                        <p>{highlightText("Cet outil puissant estime vos besoins en matières premières pour la période en se basant sur vos recettes et vos ventes. Il distingue le 'Coût Net' (la valeur de la matière utilisée dans les plats) du 'Coût Perdu' (la valeur de la perte en stock), vous donnant un 'Coût d'Achat Requis' total et réaliste.", searchTerm)}</p>
                                    </div>
                                </section>
                                <section id="guide-packaging">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 3: Packaging", searchTerm)}</h3>
                                    <p className="mb-4">{highlightText("Cet onglet est le catalogue de vos emballages (pots, couvercles, étiquettes, boîtes...), distinct des ingrédients et comptabilisé comme un poste de coût à part dans vos fiches recettes — jamais fusionné au coût matière.", searchTerm)}</p>
                                    <div id="guide-pkg-db" className="space-y-2">
                                        <h4 className="text-lg font-semibold">{highlightText("Base de données des emballages", searchTerm)}</h4>
                                        <p>{highlightText("Même structure que la base de données des ingrédients : fournisseur, format d'achat, unité, prix d'achat, taux de perte (bris, rebuts) et prix unitaire calculé automatiquement. Utilisez les contrôles de filtre, de tri et de pagination pour naviguer dans une longue liste.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-pkg-import" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Assistant d'importation d'emballages", searchTerm)}</h4>
                                        <p>{highlightText("Même assistant que celui des ingrédients : téléversez un fichier CSV ou Excel, associez ses colonnes aux champs de l'application, puis vérifiez et confirmez l'import. Détecte automatiquement si un emballage du fichier correspond déjà à un emballage existant (mise à jour) ou s'il doit être ajouté (nouveau).", searchTerm)}</p>
                                    </div>
                                    <div id="guide-pkg-abc" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Analyse ABC des emballages", searchTerm)}</h4>
                                        <p>{highlightText("Même principe que l'analyse ABC des ingrédients (Pareto 80/20) : classe vos emballages par importance financière, en fonction de ce qui est réellement consommé par vos formats de vente. N'apparaît que pour un emballage effectivement rattaché à au moins un format.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-pkg-rapport" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Rapport d'achats et pertes (emballages)", searchTerm)}</h4>
                                        <p>{highlightText("Même outil que pour les ingrédients, mais pour vos emballages : estime vos besoins d'achat pour la période, en distinguant le coût net (emballage réellement utilisé) du coût perdu (bris, rebuts).", searchTerm)}</p>
                                    </div>
                                </section>
                                <section id="guide-maindoeuvre">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 4: Main-d'œuvre", searchTerm)}</h3>
                                    <p>{highlightText("Cette section vous permet de détailler et de comprendre le coût réel de votre main-d'œuvre en cuisine. C'est un élément essentiel du coût de revient, souvent sous-estimé.", searchTerm)}</p>
                                    <div id="guide-mo-db" className="space-y-4 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Base de données de la main-d'œuvre", searchTerm)}</h4>
                                        <p>{highlightText("Ici, vous créez des 'postes' (ex: Chef de Cuisine, Cuisinier, Plongeur) et assignez-y des employés. Pour chaque employé, vous pouvez détailler :", searchTerm)}</p>
                                        <ul className="list-decimal list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Salaire horaire ($) :', searchTerm)}</strong> {highlightText("Le salaire brut de l'employé.", searchTerm)}</li>
                                            <li><strong>{highlightText('Charges (%) :', searchTerm)}</strong> {highlightText("Les charges sociales et patronales en pourcentage du salaire (ex: 16% pour les normes du travail au Québec).", searchTerm)}</li>
                                            <li><strong>{highlightText('Vacances (%) :', searchTerm)}</strong> {highlightText("Le pourcentage mis de côté pour les vacances (ex: 4% ou 6%).", searchTerm)}</li>
                                            <li><strong>{highlightText('% Temps productif attendu :', searchTerm)}</strong> {highlightText("Pourcentage du temps de travail qui devrait être passé en production. Un chef qui passe 20% de son temps en gestion administrative aura un taux de 80%.", searchTerm)}</li>
                                            <li><strong>{highlightText('Heures travaillées :', searchTerm)}</strong> {highlightText("Le nombre total d'heures travaillées par cet employé pour la période de référence définie dans l'onglet 'Paramètres'.", searchTerm)}</li>
                                        </ul>
                                        <p><strong>{highlightText('Calcul du coût moyen pondéré :', searchTerm)}</strong> {highlightText("Pour chaque poste, l'application calcule un coût horaire moyen, pondéré par le nombre d'heures de chaque employé. C'est ce coût moyen qui est utilisé dans les fiches recettes pour une précision maximale.", searchTerm)}</p>
                                    </div>
                                     <div id="guide-mo-rapport" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Rapport de productivité pour la période", searchTerm)}</h4>
                                        <p>{highlightText("Cet outil stratégique compare les heures de travail que vous payez à celles qui sont réellement nécessaires pour produire ce que vous vendez. Il vous aide à identifier les sureffectifs ou les inefficacités.", searchTerm)}</p>
                                         <ul className="list-decimal list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Heures productives attendues :', searchTerm)}</strong> {highlightText("Basé sur les heures travaillées et le % de temps productif, c'est le nombre d'heures que votre équipe devrait passer en production.", searchTerm)}</li>
                                            <li><strong>{highlightText('Heures productives réelles :', searchTerm)}</strong> {highlightText("Calculé à partir de vos fiches recettes et de vos ventes estimées, c'est le nombre d'heures de travail réellement requis pour la production.", searchTerm)}</li>
                                            <li><strong>{highlightText("Taux d'utilisation (%) :", searchTerm)}</strong> {highlightText("Le ratio entre les heures réelles et attendues. Un taux très bas peut indiquer un sureffectif ou une inefficacité.", searchTerm)}</li>
                                         </ul>
                                    </div>
                                </section>
                                <section id="guide-frais-fixes">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 5: État des résultats", searchTerm)}</h3>
                                    <p>{highlightText("Votre état des résultats réel — revenus et frais fixes, tels qu'ils apparaissent dans votre vraie comptabilité — distinct du modèle théorique de vos recettes (Production).", searchTerm)}</p>
                                    <div id="guide-ff-periode" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Période de référence", searchTerm)}</h4>
                                        <p>{highlightText("Tout en haut de l'onglet, avant Revenus : la période sur laquelle les revenus et frais fixes ci-dessous sont basés (semaine, mois, etc.). L'assistant d'import (bouton « Importer l'état des résultats ») la détecte et la renseigne automatiquement à partir des dates du fichier importé, quand elles y figurent — sinon, choisissez-la manuellement, y compris une période personnalisée avec dates de début et de fin.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-ff-revenus" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Revenus", searchTerm)}</h4>
                                        <p>{highlightText("Chaque poste de revenu réel choisit une clé de répartition : « Général » (un revenu non attribuable à une activité de production précise), une activité de production précise, ou « Saisie manuelle » pour ventiler librement un même poste entre plusieurs activités à la fois. La ventilation par canal de vente affichée à côté de chaque ligne est calculée automatiquement à partir de votre mix de vente déclaré : c'est une estimation indicative, pas une donnée réelle vérifiée, et elle n'entre dans aucun calcul.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-ff-charges-directes" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Charges directes réelles", searchTerm)}</h4>
                                        <p>{highlightText("Vos charges directes réelles, catégorisées par type de coût — Matière première, Main-d'œuvre directe, Emballage, Sous-traitance — plutôt que par les catégories de frais fixes ci-dessous, qui décrivent une fonction d'entreprise plutôt qu'une nature de coût de production. Contrairement aux revenus, l'activité et le canal de vente ne se choisissent pas ligne par ligne : chaque montant réel est réparti automatiquement selon le coût théorique du modèle de recette, apparié à son propre type de coût (une charge de Matière première se répartit selon le coût théorique de matière première de chaque activité, pas selon un autre type) — une estimation indicative, jamais un intrant de calcul.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-ff-liste" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Frais fixes", searchTerm)}</h4>
                                        <p>{highlightText("Chaque poste de dépense qui n'est pas directement lié à la production d'un plat précis (loyer, électricité, marketing, salaires administratifs, assurances, frais bancaires...) est listé ici individuellement. Pour chaque poste, indiquez un libellé, une catégorie (Frais généraux de production, Frais de vente/mise en marché, Frais d'administration ou Frais financiers) et un montant. IMPORTANT : n'y incluez pas le coût de la main-d'œuvre de cuisine, déjà calculé en détail dans l'onglet 'Main-d'œuvre'. Le total de cette liste (Sous-total du tableau) alimente directement le calcul des frais indirects de chaque plat.", searchTerm)}</p>
                                        <p className="mt-2">{highlightText("« Méthode d'attribution », en haut à droite de cette section : s'applique à TOUS les plats. « Au prorata des ventes » répartit selon le mix des ventes ; « Au prorata du temps de production » répartit selon les heures de main-d'œuvre de chaque plat. Les deux méthodes répartissent l'intégralité des frais indirects.", searchTerm)}</p>
                                        <p className="mt-2">{highlightText("Répartissez chaque dépense entre Général, vos activités de production et vos canaux de vente (colonnes de droite) — un seul bassin partagé : la somme de TOUTES ces colonnes (activités et canaux confondus) ne doit pas dépasser le montant de la ligne. Un petit indicateur (coche verte ou avertissement) le confirme — purement informatif, jamais un blocage : une dépense qui ne s'applique naturellement qu'à une partie des colonnes (ex. un loyer n'a pas de canal) peut simplement laisser les autres vides.", searchTerm)}</p>
                                        <p className="mt-2">{highlightText("La « Clé de répartition » propose plusieurs raccourcis : « Selon les ventes »/« Selon les charges directes » répartissent le montant proportionnellement à vos revenus ou charges directes réels déjà saisis plus haut, UNIQUEMENT entre vos activités — jamais vos canaux, dont la ventilation dans les sections Revenus/Charges directes ci-dessus est strictement indicative (pas une donnée réelle, voir ces sections) ; une activité ou un canal précis attribue 100 % du montant à cette seule colonne (pour les dépenses attribuables à un seul endroit — c'est la façon d'assigner un montant à un canal) ; une clé personnalisée (bouton « Gérer les clés de répartition », en haut de l'onglet) applique un pourcentage que vous définissez vous-même, sur les activités et/ou les canaux, réutilisable sur plusieurs lignes. Tant qu'une clé autre que « Manuel » est active, la grille se recalcule automatiquement si vous changez le Montant (donc jamais figée sur une valeur périmée) et n'est plus éditable cellule par cellule ; repassez à « Manuel » pour la modifier librement — la dernière valeur calculée sert alors de point de départ.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-ff-reconciliation" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Réconciliation réel / théorique", searchTerm)}</h4>
                                        <p>{highlightText("Compare, au niveau de l'entreprise entière, vos Revenus et Charges directes réels (saisis ci-dessus) au théorique implicite de votre modèle de recettes — le prix net et le volume réel saisis par canal pour chaque format (section Produits et SKUs), jamais un chiffre d'affaires global déclaré. Un grand écart signale que le modèle (prix, volumes réels, coûts de recette) ne reflète plus bien la réalité comptable, ou qu'une partie de vos ventes réelles n'a pas encore de volume saisi par canal — même logique que le rapport de productivité de l'onglet Main-d'œuvre (heures attendues vs réelles). Toujours à l'échelle de l'entreprise, jamais par activité ou canal (le détail y serait partiellement circulaire). Les frais fixes n'y figurent pas : leur conversion en taux se fera toujours par contenant (Général/Activité/Canal) et par produit, jamais comme une seule moyenne globale — voir la section Frais fixes ci-dessus.", searchTerm)}</p>
                                    </div>
                                </section>
                                <section id="guide-recette">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 6: Production", searchTerm)}</h3>
                                    <p>{highlightText("C'est le cœur de l'application, où vous assemblez la fiche de coût détaillée de chaque plat. Chaque modification ici met à jour les coûts en temps réel.", searchTerm)}</p>

                                    <div className="space-y-4 mt-4">
                                        <div id="guide-recette-formats" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("Sélecteur de format", searchTerm)}</h4>
                                            <p>{highlightText("Sous le choix de la recette, le bandeau affiche les FORMATS de ce produit — l'emballage et la quantité (ex. « 250 ml », « 1 kg »), pas le SKU. Le SKU est un simple numéro de référence déduit de la recette et du format (géré dans Paramètres → Produits et SKUs) ; le format, lui, est l'attribut qui compte : chaque format a sa propre fiche recette (ingrédients, production, rendement) totalement indépendante des autres formats du même produit. Deux raccourcis pratiques :", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText('Ajouter un format :', searchTerm)}</strong> {highlightText("Ouvre une fenêtre pour créer un nouveau format (quantité + unité) directement depuis cet écran, soit vierge, soit comme copie complète d'un format existant (point de départ pratique pour un format très semblable). Le SKU se déduit automatiquement de la recette et du format saisis, sauf si vous en précisez un. Le nouveau format apparaît aussitôt dans Paramètres → Produits et SKUs, sans étape supplémentaire.", searchTerm)}</li>
                                                <li><strong>{highlightText('Copier depuis un format (à même chaque section) :', searchTerm)}</strong> {highlightText("Une fois plusieurs formats créés, chaque section (Ingrédients, Processus de production, Coûts additionnels, Quantité produite et rendement) affiche un petit contrôle pour copier UNIQUEMENT cette section depuis un autre format du même produit — pratique pour réutiliser une recette de base tout en ajustant ce qui diffère réellement (ex. l'étape de conditionnement). La quantité/unité de chaque format n'est jamais copiée : c'est justement ce qui les distingue, elle se modifie dans Paramètres.", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-header" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("En-tête de la recette", searchTerm)}</h4>
                                            <p>{highlightText("Cette première partie définit les caractéristiques de base du format sélectionné :", searchTerm)}</p>
                                            <ul className="list-decimal list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText('Format de ce SKU :', searchTerm)}</strong> {highlightText("Rappel en lecture seule de la quantité et de l'unité de ce format (ex: 250 g, 1 unité) — modifiable dans Paramètres → Produits et SKUs, pas ici. Cette information sert à calculer le coût unitaire, par exemple le coût au gramme.", searchTerm)}</li>
                                                <li><strong>{highlightText("Quantité produite :", searchTerm)}</strong> {highlightText("La quantité de ce format que la recette complète permet de produire, dans son unité (ex. 40 unités de 250 ml, ou 47,3 kg pour un format en kg — un entier n'est exigé que pour une unité de compte). Peut être calculée automatiquement via une grille de rendement plutôt que saisie directement.", searchTerm)}</li>
                                                <li><strong>{highlightText('Considérer comme une sous-recette :', searchTerm)}</strong> {highlightText("Cochez cette case si cette recette est une 'mise en place' (ex: une sauce de base, une garniture) qui sera utilisée comme ingrédient dans d'autres plats. Une fois cochée, elle apparaîtra dans la liste déroulante des ingrédients.", searchTerm)}</li>
                                                <li><strong>{highlightText('Considérer comme un produit de revente :', searchTerm)}</strong> {highlightText("Cochez cette case pour les formats achetés et revendus sans transformation (ex: boissons, croustilles). Cela simplifie la fiche de coût à un simple coût d'achat et permet une gestion distincte des allergènes.", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-ing" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("1. Ingrédients", searchTerm)}</h4>
                                            <p>{highlightText("Ajoutez les ingrédients de votre recette. Pour une organisation claire, vous pouvez réorganiser l'ordre des lignes par un simple glisser-déposer.", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Ingrédient :', searchTerm)}</strong> {highlightText("Sélectionnez un ingrédient de votre base de données. Les sous-recettes (mises en place) apparaîtront également dans cette liste.", searchTerm)}</li>
                                                <li><strong>{highlightText('Quantité :', searchTerm)}</strong> {highlightText("La quantité nécessaire pour la recette complète (et non pour une seule portion).", searchTerm)}</li>
                                                <li><strong>{highlightText('Unité :', searchTerm)}</strong> {highlightText("L'unité s'ajuste automatiquement à l'ingrédient. Vous pouvez la changer pour une unité compatible (ex: 'g' vers 'kg'). Le coût sera recalculé.", searchTerm)}</li>
                                                <li><strong>{highlightText('Rendement (%) :', searchTerm)}</strong> {highlightText("Crucial pour la précision. Indiquez ici la perte de matière *pendant* la production (ex: 80% pour 1kg de carottes qui donne 800g après épluchage).", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-packaging" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("2. Emballage", searchTerm)}</h4>
                                            <p>{highlightText("Ajoutez les emballages de ce format (pots, couvercles, étiquettes, boîtes...), tirés du catalogue de l'onglet Packaging. C'est un poste de coût séparé du coût matière — jamais fusionné avec vos ingrédients — qui apparaît comme son propre pourcentage dans le récapitulatif.", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Emballage :', searchTerm)}</strong> {highlightText("Sélectionnez un emballage de votre catalogue (onglet Packaging).", searchTerm)}</li>
                                                <li><strong>{highlightText('Quantité :', searchTerm)}</strong> {highlightText("La quantité nécessaire pour la recette complète (ex. 1 pot, 1 couvercle, 1 étiquette par unité produite).", searchTerm)}</li>
                                            </ul>
                                            <p className="mt-2">{highlightText("Absent pour un produit de revente (statut réglé dans l'en-tête ci-dessus) : son coût d'achat couvre déjà tout, y compris l'emballage dans lequel il vous est livré.", searchTerm)}</p>
                                        </div>

                                        <div id="guide-recette-mo" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("3. Processus de production", searchTerm)}</h4>
                                             <p>{highlightText("Cette section est cruciale pour calculer le coût de votre main-d'œuvre directe. Voici le détail des fonctionnalités :", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Tableau des étapes :', searchTerm)}</strong> {highlightText("Décrivez chaque action ('Taillage', 'Cuisson'), assignez du personnel en cliquant sur 'Modifier', puis définissez un début et une durée pour chaque étape au format HH:MM:SS.", searchTerm)}</li>
                                                <li><strong>{highlightText('Coûts calculés :', searchTerm)}</strong> {highlightText("Les coûts directs (salaires) et indirects (inefficacité) sont calculés en temps réel pour chaque étape.", searchTerm)}</li>
                                                <li><strong>{highlightText('Résumé de production :', searchTerm)}</strong> {highlightText("Les indicateurs de 'Durée Processus', 'Temps Personnel' et 'Intensité M-O' vous donnent un aperçu rapide de l'efficacité de votre flux de production.", searchTerm)}</li>
                                                <li><strong>{highlightText('Diagramme de Gantt :', searchTerm)}</strong> {highlightText("Ce graphique en dessous du tableau vous offre une vue d'ensemble visuelle du déroulement de la production, en gérant intelligemment les tâches qui se chevauchent.", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-recap" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("5. Récapitulatif", searchTerm)}</h4>
                                            <p>{highlightText("Cette section synthétise votre COÛT DE PRODUCTION (matière + emballage + main-d'œuvre + sous-traitance) et calcule en temps réel vos ratios et marges qui en découlent. Utilisez le mode 'Simuler un nouveau prix' pour voir instantanément l'impact d'un changement de prix.", searchTerm)}</p>
                                            <p className="mt-2">{highlightText("Les frais fixes (Général/Activité/Canal, voir l'onglet État des résultats) et le coût de revient complet qui en découle — avec la marge nette — ne sont pas calculés ici : ils vivent dans l'onglet Rapport, par SKU, où chaque produit a son propre taux d'absorption selon le driver choisi pour son activité/canal (Paramètres). Le point mort, lui, est affiché en bas de ce récapitulatif — pas recalculé ici, simplement la même valeur déjà établie dans Rapport (Par SKU), pour un repère immédiat sans changer d'onglet.", searchTerm)}</p>
                                             <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Ratios de coûts (%) :', searchTerm)}</strong> {highlightText("Montrent la part du prix de vente que représentent vos matières, votre emballage et votre main-d'œuvre. Ils sont comparés à vos objectifs.", searchTerm)}</li>
                                                <li><strong>{highlightText('Coût de production :', searchTerm)}</strong> {highlightText("La somme de vos coûts directs — ce qu'il vous en coûte de fabriquer une portion, AVANT les frais fixes.", searchTerm)}</li>
                                                <li><strong>{highlightText('Marge de contribution :', searchTerm)}</strong> {highlightText("Prix de vente moins le coût matière seul — ce qui reste pour couvrir la main-d'œuvre, les frais fixes et le profit.", searchTerm)}</li>
                                                <li><strong>{highlightText('Marge brute :', searchTerm)}</strong> {highlightText("Prix de vente moins le coût de production complet (matière + emballage + main-d'œuvre + sous-traitance) — l'argent disponible pour couvrir les frais fixes et le profit.", searchTerm)}</li>
                                                <li><strong>{highlightText('Point mort :', searchTerm)}</strong> {highlightText("Le nombre d'unités de ce format, dans le canal sélectionné, à vendre pour couvrir la part des frais fixes qui lui est allouée. Pendant une simulation de prix, reste affiché et compare le point mort réel à celui du prix simulé, comme les autres tuiles.", searchTerm)}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                                <section id="guide-resume">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 7: Rapport", searchTerm)}</h3>
                                    <p>{highlightText("Cet onglet transforme vos données en intelligence d'affaires, vous donnant une vue d'ensemble stratégique de votre menu.", searchTerm)}</p>
                                     <div className="space-y-4 mt-4">
                                        <div id="guide-resume-tableau" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("Tableau comparatif", searchTerm)}</h4>
                                            <p>{highlightText("Comparez la performance de tous vos plats d'un seul coup d'œil. Les codes de couleur pour les marges vous aident à identifier instantanément les bons et les mauvais élèves. Un produit vendu sous plusieurs formats (ex. confiture en pot de 250 ml et de 500 ml) apparaît comme autant de lignes distinctes, chacune désambiguïsée par son format entre parenthèses (ex. « Confiture de fraises (250 ml) ») — chaque format a sa propre fiche recette et ses propres coûts, donc sa propre ligne d'analyse.", searchTerm)}</p>
                                        </div>
                                        <div id="guide-resume-contribution" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("Classement par contribution totale", searchTerm)}</h4>
                                            <p>{highlightText("Ce graphique à barres classe vos plats non pas sur leur pourcentage de marge, mais sur le montant total en dollars qu'ils génèrent pour payer vos frais fixes (`Marge Brute $` x `Unités Vendues`). Il révèle vos véritables 'piliers financiers'.", searchTerm)}</p>
                                        </div>
                                        <div id="guide-resume-strategie" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("Analyse stratégique (Menu Engineering)", searchTerm)}</h4>
                                            <p>{highlightText("Cet outil puissant, basé sur la matrice du Boston Consulting Group (BCG), vous aide à prendre des décisions stratégiques sur votre menu. Il classe chaque plat en croisant deux axes :", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText("L'axe de la popularité :", searchTerm)}</strong> {highlightText("Un plat est 'populaire' si son mix des ventes est supérieur à la moyenne de tous vos plats.", searchTerm)}</li>
                                                <li><strong>{highlightText("L'axe de la rentabilité :", searchTerm)}</strong> {highlightText("Un plat est 'rentable' si sa marge brute en dollars est supérieure à la marge brute moyenne de tous vos plats.", searchTerm)}</li>
                                            </ul>
                                            <p className="mt-2">{highlightText("Ce croisement donne quatre catégories avec des recommandations claires :", searchTerm)}</p>
                                            <ul className="list-decimal list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText('Étoiles (Populaires, rentables) :', searchTerm)}</strong> {highlightText("Vos meilleurs produits. Protégez leur qualité, assurez leur visibilité et maintenez leur rentabilité. Ce sont les piliers de votre menu.", searchTerm)}</li>
                                                <li><strong>{highlightText('Vaches à lait (Populaires, peu rentables) :', searchTerm)}</strong> {highlightText("Ces plats se vendent bien mais rapportent peu. L'objectif est d'augmenter leur marge sans trop affecter leur popularité. Analysez leur fiche recette pour réduire les coûts ou envisagez une légère augmentation de prix.", searchTerm)}</li>
                                                <li><strong>{highlightText('Dilemmes (Peu populaires, rentables) :', searchTerm)}</strong> {highlightText("Ces plats sont rentables, mais ne se vendent pas assez. L'objectif est de booster leurs ventes : meilleure description sur le menu, suggestion par le personnel, promotion, etc.", searchTerm)}</li>
                                                <li><strong>{highlightText('Poids morts (Peu populaires, peu rentables) :', searchTerm)}</strong> {highlightText("Ces plats ne contribuent que très peu à votre succès. Pensez à les réinventer complètement ou à les retirer du menu pour simplifier vos opérations.", searchTerm)}</li>
                                            </ul>
                                        </div>
                                         <div id="guide-exports" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("Exports (PDF & Excel)", searchTerm)}</h4>
                                            <p className="mb-4">{highlightText("L'application vous permet d'exporter vos données dans deux formats professionnels, accessibles depuis cet onglet. Chaque format a un usage spécifique :", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText("Générer un rapport PDF :", searchTerm)}</strong> {highlightText("Crée un rapport de plusieurs pages, visuellement soigné, idéal pour les présentations, l'archivage ou le partage avec des partenaires. Il inclut des tableaux de bord, des analyses stratégiques, des graphiques et une fiche de coût détaillée par FORMAT — un produit vendu en plusieurs formats génère donc une fiche distincte pour chacun, désambiguïsée dans son titre.", searchTerm)}</li>
                                                <li><strong>{highlightText("Exporter vers Excel :", searchTerm)}</strong> {highlightText("Génère un fichier .xlsx contenant toutes vos données brutes (tableau de bord, listes d'ingrédients et de main-d'œuvre, une feuille de coût détaillée par FORMAT). Ce format est parfait si vous souhaitez effectuer des analyses plus poussées, créer vos propres graphiques ou intégrer les données dans d'autres systèmes comptables.", searchTerm)}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                                <section id="guide-suivi">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 8: Suivi", searchTerm)}</h3>
                                    <p>{highlightText("Cet onglet transforme votre analyse statique en un suivi dynamique de vos performances dans le temps.", searchTerm)}</p>
                                     <div className="space-y-4 mt-4">
                                        <div id="guide-suivi-points" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("Points de référence", searchTerm)}</h4>
                                            <p>{highlightText("En créant des 'photos' de votre projet à différents moments (ex: avant et après un changement de fournisseur), vous pouvez sauvegarder l'état de vos coûts, de vos prix, et de vos marges.", searchTerm)}</p>
                                        </div>
                                        <div id="guide-suivi-graphiques" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("Graphiques d'évolution", searchTerm)}</h4>
                                            <p>{highlightText("L'application génère automatiquement des graphiques interactifs pour suivre l'évolution de vos indicateurs clés globaux, des coûts d'un FORMAT spécifique (« Analyse par format »), ou même du prix d'un ingrédient, vous permettant de mesurer concrètement l'impact de vos décisions. Si un produit a plusieurs formats, chacun apparaît séparément dans la liste déroulante, désambiguïsé par son nom (ex. « Confiture de fraises (500 ml) ») — ses points de référence antérieurs à la création de ce format n'affichent simplement aucune donnée avant cette date.", searchTerm)}</p>
                                        </div>
                                    </div>
                                </section>
                                 <section id="guide-definitions">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Glossaire : Dictionnaire des termes clés", searchTerm)}</h3>
                                    <ul className="list-disc list-inside space-y-3 pl-4">
                                        <li><strong>{highlightText("Analyse ABC :", searchTerm)}</strong> {highlightText("Une méthode de classification des stocks (ingrédients) en trois catégories (A, B, C) en fonction de leur valeur de consommation, pour prioriser les efforts de gestion.", searchTerm)}</li>
                                        <li><strong>{highlightText("Contribution totale :", searchTerm)}</strong> {highlightText("Le profit total en dollars généré par un plat sur une période (`Marge Brute Unitaire $` x `Unités Vendues`). Cet indicateur révèle les plats qui contribuent le plus à payer les frais fixes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût d'achat requis :", searchTerm)}</strong> {highlightText("Le coût total que vous devriez budgéter pour un ingrédient, incluant le coût de la matière productive et le coût de la perte en stock.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût d'emballage :", searchTerm)}</strong> {highlightText("Le coût des contenants, couvercles, étiquettes et autres emballages d'un format (onglet Packaging). Poste SÉPARÉ du coût matière — jamais fusionné — qui apparaît comme son propre pourcentage du prix de vente.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût de revient total :", searchTerm)}</strong> {highlightText("L'indicateur le plus important. C'est la somme de TOUS les coûts (directs et indirects). Il représente ce que vous coûte réellement une portion servie au client.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût matière moyen pondéré :", searchTerm)}</strong> {highlightText("La moyenne du coût matière de tous vos plats, pondérée par leur popularité (mix des ventes). Cet indicateur vous donne le coût matière réel d'une vente 'typique' sur votre menu.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût main-d'œuvre moyen pondéré :", searchTerm)}</strong> {highlightText("Similaire au coût matière, il s'agit de la moyenne du coût de main-d'œuvre de vos plats, pondérée par leur popularité.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût moyen pondéré (Main-d'œuvre) :", searchTerm)}</strong> {highlightText("Le coût horaire moyen d'un poste, calculé en tenant compte du salaire et du nombre d'heures de chaque employé assigné à ce poste.", searchTerm)}</li>
                                        <li><strong>{highlightText("Format :", searchTerm)}</strong> {highlightText("L'emballage et la quantité sous lesquels un produit est vendu (ex. un pot de 250 ml, un sac de 1 kg). Un produit peut avoir plusieurs formats, chacun avec sa propre fiche recette, son propre SKU, prix et mix des ventes — et donc sa propre ligne dans le Rapport, le Suivi et les exports. Se gère dans Paramètres → Produits et SKUs.", searchTerm)}</li>
                                        <li><strong>{highlightText("Heures productives (attendues vs. réelles) :", searchTerm)}</strong> {highlightText("Compare les heures de travail que vous payez et qui devraient être productives, avec les heures réellement nécessaires pour la production vendue. C'est un indicateur clé d'efficacité.", searchTerm)}</li>
                                        <li><strong>{highlightText("Intensité M-O (Main-d'œuvre) :", searchTerm)}</strong> {highlightText("Un ratio (`Temps Personnel` / `Durée Processus`) qui indique l'efficacité du flux de production. Un ratio supérieur à 1 signifie que plusieurs personnes travaillent en même temps.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge brute :", searchTerm)}</strong> {highlightText("`Prix de Vente - Coûts Directs (Matières + Emballage + Main d'œuvre)`. C'est l'argent généré par le plat pour payer les frais fixes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge brute moyenne pondérée :", searchTerm)}</strong> {highlightText("La marge brute moyenne de l'ensemble de votre menu, en tenant compte de la popularité de chaque plat. C'est un indicateur clé de la rentabilité globale de vos ventes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge nette :", searchTerm)}</strong> {highlightText("`Prix de Vente - Coût de Revient Total`. C'est le profit réel que vous empochez après avoir payé TOUTES les charges liées à ce plat.", searchTerm)}</li>
                                        <li><strong>{highlightText("Mix des ventes (%) :", searchTerm)}</strong> {highlightText("La popularité d'un plat, exprimée en pourcentage de vos ventes totales. La somme de tous les plats 'Au Menu' devrait idéalement être de 100%.", searchTerm)}</li>
                                        <li><strong>{highlightText("Point mort du menu analysé :", searchTerm)}</strong> {highlightText("Le chiffre d'affaires que votre menu doit générer pour couvrir l'ensemble des frais indirects qui lui sont alloués. Il est calculé en divisant les frais indirects par la marge brute moyenne pondérée.", searchTerm)}</li>
                                        <li><strong>{highlightText("Point mort du produit :", searchTerm)}</strong> {highlightText("Estime le nombre d'unités d'un plat que vous devez vendre durant une période pour couvrir la part des frais indirects qui lui est allouée.", searchTerm)}</li>
                                        <li><strong>{highlightText("Prix efficace (Ingrédient) :", searchTerm)}</strong> {highlightText("Le coût réel d'un ingrédient après avoir pris en compte le coût de sa perte en stock. Il est utilisé dans l'outil de comparaison.", searchTerm)}</li>
                                        <li><strong>{highlightText("SKU :", searchTerm)}</strong> {highlightText("Le numéro de référence d'un format précis — pas une donnée saisie indépendamment, mais déduite automatiquement de la recette (nom du produit) et du format (quantité + unité) à la création. Librement modifiable ensuite si vous avez votre propre système de codification.", searchTerm)}</li>
                                        <li><strong>{highlightText("Taux de perte vs. rendement :", searchTerm)}</strong> {highlightText("Le **Taux de Perte** (onglet Ingrédients) concerne la perte *avant* la production (ex: produits périmés). Le **Rendement** (onglet Recette) concerne la perte *pendant* la production (ex: parures de légumes).", searchTerm)}</li>
                                    </ul>
                                </section>
                                 <section id="guide-conclusion">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Conclusion : Un outil à votre service", searchTerm)}</h3>
                                    <p className="mb-4">{highlightText("Vous avez maintenant un aperçu complet de la puissance de Resto Calculateur. De la simple fiche de coût à l'analyse stratégique poussée, cet outil est conçu pour être votre partenaire dans l'optimisation de la rentabilité de votre établissement.", searchTerm)}</p>
                                    <div className="p-4 bg-blue-50 border-l-4 border-blue-500">
                                        <h4 className="font-bold text-gray-800">{highlightText("Une note sur la rigueur", searchTerm)}</h4>
                                        <p className="mt-2">{highlightText("Il est crucial de se rappeler que la pertinence des analyses générées par cette application dépend directement de la qualité et de la précision des données que vous y entrez. Des prix d'achat à jour, un mix des ventes réaliste et des fiches recettes précises sont les fondations sur lesquelles reposent tous les indicateurs stratégiques. L'application est un puissant copilote, mais c'est votre rigueur en tant que pilote qui garantit la justesse de la destination.", searchTerm)}</p>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
