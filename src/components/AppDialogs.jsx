import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle, AlertTriangle, Info, X, FilePlus, FolderOpen, FileText } from 'lucide-react';

// Composant de notification (Version améliorée avec option Annuler)
export const Notification = ({ message, type, onClose, onUndo }) => {
    useEffect(() => {
        // Une notification avec une action "Annuler" reste plus longtemps
        const duration = onUndo ? 5000 : 2500;
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, onUndo]);

    const typeStyles = {
        success: { bg: 'bg-green-500', icon: <CheckCircle className="h-5 w-5 text-white" /> },
        error: { bg: 'bg-red-500', icon: <AlertTriangle className="h-5 w-5 text-white" /> },
        info: { bg: 'bg-blue-500', icon: <Info className="h-5 w-5 text-white" /> }
    };

    const { bg, icon } = typeStyles[type] || typeStyles.info;

    return (
        <div className={`fixed top-5 right-5 z-50 flex items-center p-4 rounded-lg shadow-lg text-white ${bg} animate-fade-in-down`}>
            <div className="flex-shrink-0">
                {icon}
            </div>
            <div className="ml-3 text-sm font-medium">
                {message}
            </div>
            <div className="ml-4 flex items-center space-x-2">
                {onUndo && (
                    <button onClick={onUndo} className="bg-white/10 hover:bg-white/30 px-2 py-1 rounded-md font-bold text-xs uppercase transition-colors">
                        Annuler
                    </button>
                )}
                <button onClick={onClose} className="p-1 rounded-md hover:bg-white/20 focus:outline-none">
                    <X className="h-4 w-4 text-white" />
                </button>
            </div>
        </div>
    );
};

// Composant de la fenêtre de bienvenue
export const WelcomeModal = ({ onNew, onOpen, onExample }) => {
    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col justify-center items-center p-4">
            <img src="./Logo_RestoCalculateur3.png" alt="Resto Calculateur Logo" className="h-32 sm:h-48 w-auto mb-8" />
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800">Bienvenue sur Resto Calculateur</h1>
                <p className="text-lg text-gray-600 mt-2">Votre outil pour maîtriser le coût de revient de vos plats.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <button onClick={onNew} className="group flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-green-50 transition-all duration-300">
                    <FilePlus className="h-12 w-12 text-green-500 group-hover:text-green-600 mb-3" />
                    <h2 className="text-xl font-semibold text-gray-700">Créer un nouveau projet</h2>
                    <p className="text-sm text-gray-500 mt-1">Commencer avec une feuille blanche.</p>
                </button>
                <button onClick={onOpen} className="group flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-blue-50 transition-all duration-300">
                    <FolderOpen className="h-12 w-12 text-blue-500 group-hover:text-blue-600 mb-3" />
                    <h2 className="text-xl font-semibold text-gray-700">Ouvrir un projet existant</h2>
                    <p className="text-sm text-gray-500 mt-1">Charger un fichier .json sauvegardé.</p>
                </button>
                <button onClick={onExample} className="group flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-indigo-50 transition-all duration-300">
                    <FileText className="h-12 w-12 text-indigo-500 group-hover:text-indigo-600 mb-3" />
                    <h2 className="text-xl font-semibold text-gray-700">Explorer un projet démo</h2>
                    <p className="text-sm text-gray-500 mt-1">Découvrir les fonctionnalités avec des données d'exemple.</p>
                </button>
            </div>
        </div>
    );
};

// --- NOUVEAU: MODAL POUR LES OPTIONS PDF ---
export const PdfOptionsModal = ({ isOpen, onClose, onConfirm, initialData }) => {
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title);
            setSubtitle(initialData.subtitle);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm({ title, subtitle });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Options du Rapport PDF</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="pdfTitle" className="block text-sm font-medium text-gray-700">Titre du rapport</label>
                        <input
                            type="text"
                            id="pdfTitle"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="pdfSubtitle" className="block text-sm font-medium text-gray-700">Présenté à</label>
                        <input
                            type="text"
                            id="pdfSubtitle"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                        />
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={handleConfirm}
                    >
                        Générer le PDF
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL D'ONBOARDING ---
export const OnboardingModal = ({ isOpen, onStart, onSkip }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Bienvenue dans votre nouveau projet !</h2>
                <p className="text-gray-600 mb-8">
                    Souhaitez-vous suivre un court guide pour vous familiariser avec les fonctionnalités principales ?
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onStart}
                        className="px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Commencer le guide
                    </button>
                    <button
                        onClick={onSkip}
                        className="px-6 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Explorer par moi-même
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPOSANT DU TUTORIEL (VERSION FINALE) ---
export const TutorialGuide = ({ run, stepIndex, onStepChange, onEnd, setActiveTab, activeTab }) => {
    const [position, setPosition] = useState(null);

    const steps = [
    // Introduction
    { selector: '#tutorial-main-functions', content: "Bienvenue dans le tour guidé ! Commençons par les fonctions principales. Ces boutons vous permettent de gérer vos projets : créer, sauvegarder et ouvrir.", tab: 'info' },
    { selector: '#tutorial-tab-bar', content: "La navigation se fait via ces onglets. Nous allons les parcourir un par un pour explorer les fonctionnalités de l'application.", tab: 'info' },
    // Onglet Paramètres
    { selector: '#tutorial-section-info-entreprise', content: "L'onglet 'Paramètres' est le point de départ. Cette première section vous permet de définir les informations de base de votre entreprise pour les rapports.", tab: 'info' },
    { selector: '#tutorial-section-info-objectifs', content: "Vous pouvez définir ici des objectifs de coûts. L'application vous indiquera si vous les respectez dans l'onglet 'Résumé'.", tab: 'info' },
    { selector: '#tutorial-section-info-activites', content: "Définissez ici vos activités de production (ex. Confitures, Produits séchés) — elles serviront à répartir vos frais indirects par activité dans l'onglet État des résultats.", tab: 'info' },
    { selector: '#tutorial-section-info-menu', content: "Enfin, retrouvez ici tous vos produits (SKU) : sélectionnez-en un dans la liste à gauche pour afficher et modifier son détail complet à droite (formats, prix par canal...). Pour ce tour, nous avons pré-rempli un exemple.", tab: 'info' },
    // Onglet Ingrédients
    { selector: '#tab-ingredients', content: "Passons à l'onglet 'Ingrédients'.", tab: 'info' },
    { selector: '#tutorial-section-ingredients-db', content: "C'est votre base de données centrale pour toutes vos matières premières. Vous y définissez les prix d'achat et les taux de perte.", tab: 'ingredients' },
    { selector: '#tutorial-section-ingredients-abc', content: "L'analyse ABC classe automatiquement vos ingrédients par importance financière, vous aidant à concentrer vos efforts de gestion.", tab: 'ingredients' },
    { selector: '#tutorial-section-ingredients-rapport', content: "Basé sur vos ventes, ce rapport estime automatiquement les quantités d'ingrédients à acheter pour la période.", tab: 'ingredients' },
    // Onglet Main d'oeuvre
    { selector: '#tab-labor', content: "Continuons avec l'onglet 'Main-d'œuvre'.", tab: 'ingredients' },
    { selector: '#tutorial-section-labor-db', content: "Ici, vous pouvez définir les différents postes (Cuisinier, Commis...) et y assigner des employés avec leurs salaires et charges.", tab: 'labor' },
    { selector: '#tutorial-section-labor-rapport', content: "Ce rapport compare les heures de travail prévues à celles réellement nécessaires, vous donnant un aperçu de votre productivité.", tab: 'labor' },
    // Onglet Recette
    { selector: '#tab-recipe', content: "Allons maintenant au cœur du calculateur : l'onglet 'Production'.", tab: 'labor' },
    { selector: '#tutorial-section-recipe-header', content: "Commencez par définir ici les informations de base de votre recette, comme le nombre de portions qu'elle produit.", tab: 'recipe' },
    { selector: '#tutorial-section-recipe-ingredients', content: "Ensuite, construisez la fiche de coût en y ajoutant les ingrédients.", tab: 'recipe' },
    { selector: '#tutorial-section-recipe-labor', content: "Détaillez les étapes de production. Le coût de la main-d'œuvre sera calculé automatiquement.", tab: 'recipe' },
    { selector: '#recap-section', content: "Et voici le résultat ! Cette section récapitule votre coût de production et calcule vos marges de contribution et brute en temps réel — les frais fixes (Général/Activité/Canal) se retrouvent dans l'onglet Rapport, par SKU.", tab: 'recipe' },
    // Onglet Résumé
    { selector: '#tab-summary', content: "L'onglet 'Résumé' vous donne une vue d'ensemble de la performance de votre menu.", tab: 'recipe' },
    { selector: '#tutorial-section-summary-table', content: "Ce tableau vous permet de comparer rapidement la rentabilité de tous vos plats.", tab: 'summary' },
    { selector: '#tutorial-contribution-chart', content: "Ce graphique classe vos plats selon leur contribution réelle en dollars à votre profit, vous montrant vos piliers financiers.", tab: 'summary' },
    { selector: '#strategic-analysis', content: "L'analyse stratégique classe automatiquement vos plats (Étoiles, Vaches à lait...) pour vous aider à prendre des décisions éclairées.", tab: 'summary' },
    // Onglet Suivi
    { selector: '#tab-tracking', content: "Enfin, l'onglet 'Suivi' vous permet de sauvegarder des 'photos' de votre projet à différents moments.", tab: 'summary' },
    { selector: '#tutorial-section-tracking-global', content: "Vous pouvez suivre l'évolution de vos indicateurs globaux sur ce graphique.", tab: 'tracking' },
    { selector: '#tutorial-section-tracking-product', content: "Ou analyser en détail l'évolution des coûts pour un produit spécifique.", tab: 'tracking' },
    { selector: '#tutorial-section-tracking-ingredient', content: "Ce graphique vous permet de suivre l'évolution du prix de vos ingrédients clés dans le temps.", tab: 'tracking' },
    { selector: '#tutorial-section-tracking-management', content: "Gérez vos points de référence ici. En créer un sauvegardera l'état actuel de votre projet. C'est la fin du tour !", tab: 'tracking' },
];

    useEffect(() => {
        if (!run || !steps[stepIndex]) {
            setPosition(null);
            return;
        }
        const currentStep = steps[stepIndex];
        if (activeTab !== currentStep.tab) {
            setActiveTab(currentStep.tab);
        }
        const updatePosition = () => {
            const targetElement = document.querySelector(currentStep.selector);
            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                setPosition(rect);
            } else { setPosition(null); }
        };
        const timer = setTimeout(() => {
            const targetElement = document.querySelector(currentStep.selector);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'center' });
            }
            setTimeout(updatePosition, 300);
        }, 150);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [run, stepIndex, activeTab, setActiveTab]);

    if (!run || !position || !steps[stepIndex]) return null;

    const currentStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;
    const tooltipWidth = 320; // max-w-sm
    const tooltipHeight = 150; // Estimation
    const margin = 15;

    // --- Logique de positionnement Y ---
    // Place la bulle en dessous par défaut
    let tooltipY = position.bottom + margin;
    // Si elle sort en bas, on la place au-dessus
    if (tooltipY + tooltipHeight > window.innerHeight) {
        tooltipY = position.top - tooltipHeight - margin;
    }
    // S'assure qu'elle ne sorte jamais par le haut
    if (tooltipY < margin) {
        tooltipY = margin;
    }

    // --- Logique de positionnement X (AMÉLIORÉE) ---
    // Essaie de centrer la bulle d'aide par rapport à l'élément cible
    let tooltipX = position.left + (position.width / 2) - (tooltipWidth / 2);
    // S'assure qu'elle ne sorte jamais par la gauche
    if (tooltipX < margin) {
        tooltipX = margin;
    }
    // S'assure qu'elle ne sorte jamais par la droite
    if (tooltipX + tooltipWidth > window.innerWidth) {
        tooltipX = window.innerWidth - tooltipWidth - margin;
    }
    const handleNext = () => onStepChange(stepIndex + 1);
    const handlePrev = () => onStepChange(stepIndex - 1);

    return ReactDOM.createPortal(
        <>
            <div
                className="fixed rounded-md z-[101] pointer-events-none transition-all duration-300"
                style={{
                    top: position.top - 5,
                    left: position.left - 5,
                    width: position.width + 10,
                    height: position.height + 10,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                }}
            ></div>
            <div
                className="fixed bg-white rounded-lg p-4 shadow-xl max-w-sm w-full z-[102] transition-all duration-300"
                style={{ top: tooltipY, left: tooltipX }}
            >
                <p className="text-gray-700 mb-4">{currentStep.content}</p>
                <div className="flex justify-between items-center">
                    <button onClick={onEnd} className="text-xs text-gray-500 hover:text-gray-800">Passer le guide</button>
                    <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-4">{stepIndex + 1} / {steps.length}</span>
                        {stepIndex > 0 && <button onClick={handlePrev} className="text-sm text-gray-600 hover:text-gray-900 mr-4">Précédent</button>}
                        {isLastStep ? (
                            <button onClick={onEnd} className="px-4 py-1 text-sm rounded-md text-white bg-green-600 hover:bg-green-700">Terminer</button>
                        ) : (
                            <button onClick={handleNext} className="px-4 py-1 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700">Suivant</button>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};
