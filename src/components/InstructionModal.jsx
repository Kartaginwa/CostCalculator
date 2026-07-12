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
                                        <li><a href="#guide-param-frais" onClick={(e) => handleLinkClick(e, '#guide-param-frais')} className="text-gray-600 hover:underline">Frais et revenus</a></li>
                                        <li><a href="#guide-param-objectifs" onClick={(e) => handleLinkClick(e, '#guide-param-objectifs')} className="text-gray-600 hover:underline">Objectifs stratégiques</a></li>
                                        <li><a href="#guide-param-menu" onClick={(e) => handleLinkClick(e, '#guide-param-menu')} className="text-gray-600 hover:underline">Menu et recettes</a></li>
                                        <li><a href="#guide-param-import-pos" onClick={(e) => handleLinkClick(e, '#guide-param-import-pos')} className="text-gray-600 hover:underline">Assistant d'importation POS</a></li>
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
                                    <a href="#guide-maindoeuvre" onClick={(e) => handleLinkClick(e, '#guide-maindoeuvre')} className="font-bold text-blue-700 hover:underline">Onglet 3: Main-d'œuvre</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-mo-db" onClick={(e) => handleLinkClick(e, '#guide-mo-db')} className="text-gray-600 hover:underline">Base de données</a></li>
                                        <li><a href="#guide-mo-rapport" onClick={(e) => handleLinkClick(e, '#guide-mo-rapport')} className="text-gray-600 hover:underline">Rapport de productivité</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-recette" onClick={(e) => handleLinkClick(e, '#guide-recette')} className="font-bold text-blue-700 hover:underline">Onglet 4: Recette & Calcul</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-recette-header" onClick={(e) => handleLinkClick(e, '#guide-recette-header')} className="text-gray-600 hover:underline">En-tête de la recette</a></li>
                                        <li><a href="#guide-recette-ing" onClick={(e) => handleLinkClick(e, '#guide-recette-ing')} className="text-gray-600 hover:underline">1. Ingrédients</a></li>
                                        <li><a href="#guide-recette-mo" onClick={(e) => handleLinkClick(e, '#guide-recette-mo')} className="text-gray-600 hover:underline">2. Processus de production</a></li>
                                        <li><a href="#guide-recette-indirects" onClick={(e) => handleLinkClick(e, '#guide-recette-indirects')} className="text-gray-600 hover:underline">3. Frais indirects</a></li>
                                        <li><a href="#guide-recette-recap" onClick={(e) => handleLinkClick(e, '#guide-recette-recap')} className="text-gray-600 hover:underline">4. Récapitulatif</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-resume" onClick={(e) => handleLinkClick(e, '#guide-resume')} className="font-bold text-blue-700 hover:underline">Onglet 5: Résumé</a>
                                     <ul className="pl-4 list-disc list-inside mt-1 space-y-1">
                                        <li><a href="#guide-resume-tableau" onClick={(e) => handleLinkClick(e, '#guide-resume-tableau')} className="text-gray-600 hover:underline">Tableau comparatif</a></li>
                                        <li><a href="#guide-resume-contribution" onClick={(e) => handleLinkClick(e, '#guide-resume-contribution')} className="text-gray-600 hover:underline">Classement par contribution</a></li>
                                        <li><a href="#guide-resume-strategie" onClick={(e) => handleLinkClick(e, '#guide-resume-strategie')} className="text-gray-600 hover:underline">Analyse stratégique</a></li>
                                        <li><a href="#guide-exports" onClick={(e) => handleLinkClick(e, '#guide-exports')} className="text-gray-600 hover:underline">Exports (PDF & Excel)</a></li>
                                    </ul>
                                </li>
                                <li>
                                    <a href="#guide-suivi" onClick={(e) => handleLinkClick(e, '#guide-suivi')} className="font-bold text-blue-700 hover:underline">Onglet 6: Suivi</a>
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
                                    <div id="guide-param-frais" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Frais et revenus", searchTerm)}</h4>
                                        <p>{highlightText("C'est le moteur financier de l'application. La précision des chiffres entrés ici est cruciale.", searchTerm)}</p>
                                        <ul className="list-decimal list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText('Période de référence :', searchTerm)}</strong> {highlightText("Définit la période (ex: un mois) sur laquelle tous vos calculs financiers sont basés. Il est essentiel que tous les chiffres suivants (revenus, frais, heures) correspondent à cette même période.", searchTerm)}</li>
                                            <li><strong>{highlightText('Revenus totaux ($) :', searchTerm)}</strong> {highlightText("Votre chiffre d'affaires total pour la période, toutes sources confondues.", searchTerm)}</li>
                                            <li><strong>{highlightText('Portion des revenus du menu analysé (%) :', searchTerm)}</strong> {highlightText("Permet d'affiner l'analyse. Si les plats de ce calculateur représentent 80% de vos ventes (le reste étant des boissons non analysées, par exemple), entrez 80. Cela rendra l'allocation des frais indirects plus juste.", searchTerm)}</li>
                                            <li><strong>{highlightText('Frais indirects totaux ($) :', searchTerm)}</strong> {highlightText("Tous les coûts qui ne sont pas directement attribuables à un plat : loyer, électricité, salaires administratifs, marketing, etc. IMPORTANT : Assurez-vous de soustraire le coût de la main-d'œuvre de la cuisine de ce montant, car il est déjà calculé en détail dans l'onglet 'Main-d'œuvre'.", searchTerm)}</li>
                                            <li><strong>{highlightText('Coût main-d\'œuvre cuisine total ($) :', searchTerm)}</strong> {highlightText("Ce champ est calculé automatiquement à partir des données de l'onglet 'Main-d'œuvre'.", searchTerm)}</li>
                                            <li><strong>{highlightText('Heures totales d\'opération :', searchTerm)}</strong> {highlightText("Le nombre d'heures d'ouverture de votre établissement. Utilisé pour calculer le 'Coût horaire d'opération', une donnée clé pour certaines méthodes de calcul de frais indirects.", searchTerm)}</li>
                                        </ul>
                                    </div>
                                     <div id="guide-param-objectifs" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Objectifs stratégiques", searchTerm)}</h4>
                                        <p>{highlightText("Définissez des pourcentages cibles pour vos coûts. Dans l'onglet 'Résumé', des symboles apparaîtront à côté des coûts de chaque plat pour indiquer visuellement s'ils respectent ou non ces objectifs.", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-menu" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Menu et recettes", searchTerm)}</h4>
                                        <p>{highlightText("C'est la liste maîtresse de tous les plats, boissons ou produits que vous souhaitez analyser. Chaque ligne créée ici apparaîtra dans le menu déroulant de l'onglet 'Recette & Calcul'.", searchTerm)}</p>
                                        <ul className="list-decimal list-inside space-y-2 pl-4 mt-2">
                                            <li><strong>{highlightText('Prix de vente ($) :', searchTerm)}</strong> {highlightText("Le prix affiché sur votre menu pour le client, taxes en sus.", searchTerm)}</li>
                                            <li><strong>{highlightText('Catégorie :', searchTerm)}</strong> {highlightText("Permet de regrouper vos plats (ex: Entrées, Plats principaux) pour une meilleure organisation et pour filtrer les données.", searchTerm)}</li>
                                            <li><strong>{highlightText('Mix des ventes (%) :', searchTerm)}</strong> {highlightText("Un des chiffres les plus importants. Il représente la popularité d'un plat en pourcentage des ventes. La somme de tous les plats 'Au Menu' devrait idéalement être de 100%.", searchTerm)}</li>
                                            <li><strong>{highlightText('Au Menu (case à cocher) :', searchTerm)}</strong> {highlightText("Détermine si un plat doit être inclus dans les calculs d'analyse (ex: analyse stratégique, rapport d'achats). Décochez cette case pour les plats saisonniers ou en développement.", searchTerm)}</li>
                                        </ul>
                                        <p className="mt-2">{highlightText("Navigation dans les tableaux : Pour les longues listes, utilisez les contrôles de pagination situés en bas du tableau pour changer de page et choisir le nombre d'items à afficher (10, 25, 50, ou 100).", searchTerm)}</p>
                                    </div>
                                    <div id="guide-param-import-pos" className="space-y-2 mt-4">
                                        <h4 className="text-lg font-semibold">{highlightText("Assistant d'importation depuis POS", searchTerm)}</h4>
                                        <p>{highlightText("Cet assistant puissant lit un rapport de ventes (Excel ou CSV) pour automatiser la saisie :", searchTerm)}</p>
                                        <ul className="list-disc list-inside space-y-2 pl-4">
                                            <li><strong>{highlightText("Agrégation des ventes :", searchTerm)}</strong> {highlightText("Il regroupe automatiquement toutes les lignes d'un même produit pour calculer la quantité totale vendue.", searchTerm)}</li>
                                            <li><strong>{highlightText("Détection de la période :", searchTerm)}</strong> {highlightText("Si une colonne de date est mappée, l'assistant met à jour la 'Période de référence' pour correspondre aux dates du rapport.", searchTerm)}</li>
                                            <li><strong>{highlightText("Recalcul du mix des ventes :", searchTerm)}</strong> {highlightText("Il ajuste automatiquement le mix des ventes de tous les plats importés pour qu'il corresponde parfaitement au rapport, garantissant une précision maximale.", searchTerm)}</li>
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
                                <section id="guide-maindoeuvre">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 3: Main-d'œuvre", searchTerm)}</h3>
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
                                <section id="guide-recette">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 4: Recette & calcul", searchTerm)}</h3>
                                    <p>{highlightText("C'est le cœur de l'application, où vous assemblez la fiche de coût détaillée de chaque plat. Chaque modification ici met à jour les coûts en temps réel.", searchTerm)}</p>

                                    <div className="space-y-4 mt-4">
                                        <div id="guide-recette-header" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("En-tête de la recette", searchTerm)}</h4>
                                            <p>{highlightText("Cette première partie définit les caractéristiques de base de votre plat :", searchTerm)}</p>
                                            <ul className="list-decimal list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText('Nombre de portions :', searchTerm)}</strong> {highlightText("Le nombre de portions que la recette complète permet de produire.", searchTerm)}</li>
                                                <li><strong>{highlightText('Quantité par portion et unité :', searchTerm)}</strong> {highlightText("Définit la taille d'une seule portion (ex: 250 g, 1 unité). Cette information est utilisée pour calculer le coût unitaire, par exemple le coût au gramme.", searchTerm)}</li>
                                                <li><strong>{highlightText('Considérer comme une sous-recette :', searchTerm)}</strong> {highlightText("Cochez cette case si cette recette est une 'mise en place' (ex: une sauce de base, une garniture) qui sera utilisée comme ingrédient dans d'autres plats. Une fois cochée, elle apparaîtra dans la liste déroulante des ingrédients.", searchTerm)}</li>
                                                <li><strong>{highlightText('Considérer comme un produit de revente :', searchTerm)}</strong> {highlightText("Cochez cette case pour les produits achetés et revendus sans transformation (ex: boissons, croustilles). Cela simplifie la fiche de coût à un simple coût d'achat et permet une gestion distincte des allergènes.", searchTerm)}</li>
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

                                        <div id="guide-recette-mo" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("2. Processus de production", searchTerm)}</h4>
                                             <p>{highlightText("Cette section est cruciale pour calculer le coût de votre main-d'œuvre directe. Voici le détail des fonctionnalités :", searchTerm)}</p>
                                            <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Tableau des étapes :', searchTerm)}</strong> {highlightText("Décrivez chaque action ('Taillage', 'Cuisson'), assignez du personnel en cliquant sur 'Modifier', puis définissez un début et une durée pour chaque étape au format HH:MM:SS.", searchTerm)}</li>
                                                <li><strong>{highlightText('Coûts calculés :', searchTerm)}</strong> {highlightText("Les coûts directs (salaires) et indirects (inefficacité) sont calculés en temps réel pour chaque étape.", searchTerm)}</li>
                                                <li><strong>{highlightText('Résumé de production :', searchTerm)}</strong> {highlightText("Les indicateurs de 'Durée Processus', 'Temps Personnel' et 'Intensité M-O' vous donnent un aperçu rapide de l'efficacité de votre flux de production.", searchTerm)}</li>
                                                <li><strong>{highlightText('Diagramme de Gantt :', searchTerm)}</strong> {highlightText("Ce graphique en dessous du tableau vous offre une vue d'ensemble visuelle du déroulement de la production, en gérant intelligemment les tâches qui se chevauchent.", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-indirects" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("3. Frais indirects", searchTerm)}</h4>
                                            <p>{highlightText("Choisissez ici comment vous souhaitez allouer une part de vos frais généraux (loyer, électricité...).", searchTerm)}</p>
                                             <ul className="list-disc list-inside space-y-2 pl-4">
                                                <li><strong>{highlightText("Montant fixe :", searchTerm)}</strong> {highlightText("Simple et direct. Vous attribuez un montant en dollars fixe à chaque portion vendue.", searchTerm)}</li>
                                                <li><strong>{highlightText('Pourcentage du prix de vente :', searchTerm)}</strong> {highlightText("Un pourcentage du prix de vente du plat est ajouté comme coût indirect. Utile pour les commissions ou les redevances.", searchTerm)}</li>
                                                <li><strong>{highlightText('Pourcentage des coûts directs :', searchTerm)}</strong> {highlightText("Un pourcentage de la somme des coûts de matières et de main-d'œuvre est ajouté. Utile pour couvrir les frais administratifs liés à la production.", searchTerm)}</li>
                                                <li><strong>{highlightText("Basé sur l'intensité de la main-d'œuvre :", searchTerm)}</strong> {highlightText("Alloue les frais en fonction du temps de personnel total investi dans la recette. Idéal pour les plats complexes qui mobilisent beaucoup votre équipe.", searchTerm)}</li>
                                                <li><strong>{highlightText('Allocation par portion :', searchTerm)}</strong> {highlightText("Répartit une part des frais indirects totaux (basée sur le mix des ventes) sur un nombre de portions que vous estimez vendre. Idéal pour des cas uniques ou des événements spéciaux.", searchTerm)}</li>
                                                <li><strong>{highlightText("Allocation en fonction des ventes :", searchTerm)}</strong> {highlightText("Répartit le pool de frais indirects entre tous les plats actifs du menu au prorata de leur mix des ventes, normalisé sur la somme des mix actifs, puis divise le résultat par le nombre de portions vendues. C'est la méthode qui reflète le mieux la popularité relative de chaque plat.", searchTerm)}</li>
                                            </ul>
                                        </div>

                                        <div id="guide-recette-recap" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("4. Récapitulatif", searchTerm)}</h4>
                                            <p>{highlightText("Cette section synthétise tous les coûts et calcule en temps réel vos indicateurs de performance clés (KPIs). Utilisez le mode 'Simuler un nouveau prix' pour voir instantanément l'impact d'un changement de prix.", searchTerm)}</p>
                                             <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                                                <li><strong>{highlightText('Ratios de coûts (%) :', searchTerm)}</strong> {highlightText("Montrent la part du prix de vente que représentent vos matières, votre main-d'œuvre et vos frais indirects. Ils sont comparés à vos objectifs.", searchTerm)}</li>
                                                <li><strong>{highlightText('Coût de revient total :', searchTerm)}</strong> {highlightText("L'indicateur le plus important. C'est la somme de TOUS les coûts. Il représente ce que vous coûte réellement une portion servie au client.", searchTerm)}</li>
                                                <li><strong>{highlightText('Marge brute :', searchTerm)}</strong> {highlightText("Représente le profit généré avant de payer les frais généraux. C'est l'argent disponible pour payer le loyer, l'électricité, etc.", searchTerm)}</li>
                                                <li><strong>{highlightText('Marge nette :', searchTerm)}</strong> {highlightText("Représente le profit final et réel que vous faites sur chaque portion vendue.", searchTerm)}</li>
                                                <li><strong>{highlightText('Point mort du produit :', searchTerm)}</strong> {highlightText("Estime le nombre d'unités que vous devez vendre pour couvrir la part des frais indirects allouée à ce plat.", searchTerm)}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                                <section id="guide-resume">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 5: Résumé", searchTerm)}</h3>
                                    <p>{highlightText("Cet onglet transforme vos données en intelligence d'affaires, vous donnant une vue d'ensemble stratégique de votre menu.", searchTerm)}</p>
                                     <div className="space-y-4 mt-4">
                                        <div id="guide-resume-tableau" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("Tableau comparatif", searchTerm)}</h4>
                                            <p>{highlightText("Comparez la performance de tous vos plats d'un seul coup d'œil. Les codes de couleur pour les marges vous aident à identifier instantanément les bons et les mauvais élèves.", searchTerm)}</p>
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
                                                <li><strong>{highlightText("Générer un rapport PDF :", searchTerm)}</strong> {highlightText("Crée un rapport de plusieurs pages, visuellement soigné, idéal pour les présentations, l'archivage ou le partage avec des partenaires. Il inclut des tableaux de bord, des analyses stratégiques, des graphiques et les fiches de coût détaillées de chaque produit.", searchTerm)}</li>
                                                <li><strong>{highlightText("Exporter vers Excel :", searchTerm)}</strong> {highlightText("Génère un fichier .xlsx contenant toutes vos données brutes (tableau de bord, listes d'ingrédients et de main-d'œuvre, fiches de coût détaillées). Ce format est parfait si vous souhaitez effectuer des analyses plus poussées, créer vos propres graphiques ou intégrer les données dans d'autres systèmes comptables.", searchTerm)}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                                <section id="guide-suivi">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Onglet 6: Suivi", searchTerm)}</h3>
                                    <p>{highlightText("Cet onglet transforme votre analyse statique en un suivi dynamique de vos performances dans le temps.", searchTerm)}</p>
                                     <div className="space-y-4 mt-4">
                                        <div id="guide-suivi-points" className="space-y-2">
                                            <h4 className="text-lg font-semibold">{highlightText("Points de référence", searchTerm)}</h4>
                                            <p>{highlightText("En créant des 'photos' de votre projet à différents moments (ex: avant et après un changement de fournisseur), vous pouvez sauvegarder l'état de vos coûts, de vos prix, et de vos marges.", searchTerm)}</p>
                                        </div>
                                        <div id="guide-suivi-graphiques" className="space-y-2 mt-4">
                                            <h4 className="text-lg font-semibold">{highlightText("Graphiques d'évolution", searchTerm)}</h4>
                                            <p>{highlightText("L'application génère automatiquement des graphiques interactifs pour suivre l'évolution de vos indicateurs clés globaux, des coûts d'un plat spécifique, ou même du prix d'un ingrédient, vous permettant de mesurer concrètement l'impact de vos décisions.", searchTerm)}</p>
                                        </div>
                                    </div>
                                </section>
                                 <section id="guide-definitions">
                                    <h3 className="text-2xl font-bold mb-4 border-b pb-2">{highlightText("Glossaire : Dictionnaire des termes clés", searchTerm)}</h3>
                                    <ul className="list-disc list-inside space-y-3 pl-4">
                                        <li><strong>{highlightText("Analyse ABC :", searchTerm)}</strong> {highlightText("Une méthode de classification des stocks (ingrédients) en trois catégories (A, B, C) en fonction de leur valeur de consommation, pour prioriser les efforts de gestion.", searchTerm)}</li>
                                        <li><strong>{highlightText("Contribution totale :", searchTerm)}</strong> {highlightText("Le profit total en dollars généré par un plat sur une période (`Marge Brute Unitaire $` x `Unités Vendues`). Cet indicateur révèle les plats qui contribuent le plus à payer les frais fixes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût d'achat requis :", searchTerm)}</strong> {highlightText("Le coût total que vous devriez budgéter pour un ingrédient, incluant le coût de la matière productive et le coût de la perte en stock.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût de revient total :", searchTerm)}</strong> {highlightText("L'indicateur le plus important. C'est la somme de TOUS les coûts (directs et indirects). Il représente ce que vous coûte réellement une portion servie au client.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût horaire d'opération :", searchTerm)}</strong> {highlightText("Calculé (`Frais Indirects Totaux` / `Heures d'Opération`), il représente le coût de fonctionnement de votre établissement par heure, hors coûts directs.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût matière moyen pondéré :", searchTerm)}</strong> {highlightText("La moyenne du coût matière de tous vos plats, pondérée par leur popularité (mix des ventes). Cet indicateur vous donne le coût matière réel d'une vente 'typique' sur votre menu.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût main-d'œuvre moyen pondéré :", searchTerm)}</strong> {highlightText("Similaire au coût matière, il s'agit de la moyenne du coût de main-d'œuvre de vos plats, pondérée par leur popularité.", searchTerm)}</li>
                                        <li><strong>{highlightText("Coût moyen pondéré (Main-d'œuvre) :", searchTerm)}</strong> {highlightText("Le coût horaire moyen d'un poste, calculé en tenant compte du salaire et du nombre d'heures de chaque employé assigné à ce poste.", searchTerm)}</li>
                                        <li><strong>{highlightText("Heures productives (attendues vs. réelles) :", searchTerm)}</strong> {highlightText("Compare les heures de travail que vous payez et qui devraient être productives, avec les heures réellement nécessaires pour la production vendue. C'est un indicateur clé d'efficacité.", searchTerm)}</li>
                                        <li><strong>{highlightText("Intensité M-O (Main-d'œuvre) :", searchTerm)}</strong> {highlightText("Un ratio (`Temps Personnel` / `Durée Processus`) qui indique l'efficacité du flux de production. Un ratio supérieur à 1 signifie que plusieurs personnes travaillent en même temps.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge brute :", searchTerm)}</strong> {highlightText("`Prix de Vente - Coûts Directs (Matières + Main d'œuvre)`. C'est l'argent généré par le plat pour payer les frais fixes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge brute moyenne pondérée :", searchTerm)}</strong> {highlightText("La marge brute moyenne de l'ensemble de votre menu, en tenant compte de la popularité de chaque plat. C'est un indicateur clé de la rentabilité globale de vos ventes.", searchTerm)}</li>
                                        <li><strong>{highlightText("Marge nette :", searchTerm)}</strong> {highlightText("`Prix de Vente - Coût de Revient Total`. C'est le profit réel que vous empochez après avoir payé TOUTES les charges liées à ce plat.", searchTerm)}</li>
                                        <li><strong>{highlightText("Mix des ventes (%) :", searchTerm)}</strong> {highlightText("La popularité d'un plat, exprimée en pourcentage de vos ventes totales. La somme de tous les plats 'Au Menu' devrait idéalement être de 100%.", searchTerm)}</li>
                                        <li><strong>{highlightText("Point mort du menu analysé :", searchTerm)}</strong> {highlightText("Le chiffre d'affaires que votre menu doit générer pour couvrir l'ensemble des frais indirects qui lui sont alloués. Il est calculé en divisant les frais indirects par la marge brute moyenne pondérée.", searchTerm)}</li>
                                        <li><strong>{highlightText("Point mort du produit :", searchTerm)}</strong> {highlightText("Estime le nombre d'unités d'un plat que vous devez vendre durant une période pour couvrir la part des frais indirects qui lui est allouée.", searchTerm)}</li>
                                        <li><strong>{highlightText("Prix efficace (Ingrédient) :", searchTerm)}</strong> {highlightText("Le coût réel d'un ingrédient après avoir pris en compte le coût de sa perte en stock. Il est utilisé dans l'outil de comparaison.", searchTerm)}</li>
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
