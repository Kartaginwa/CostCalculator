import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle, AlertTriangle, Info, X, FilePlus, FolderOpen, FileText, PlayCircle } from 'lucide-react';
import { useEscapeKey } from '../ui-utils.jsx';

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
        <div className={`fixed top-5 right-5 z-[60] flex items-center p-4 rounded-lg shadow-lg text-white ${bg} animate-fade-in-down`}>
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
export const WelcomeModal = ({ onNew, onOpen, onExample, onTour }) => {
    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col justify-center items-center p-4">
            <img src="./Logo_RestoCalculateur3.png" alt="Logo TransfoCalculateur" className="h-24 sm:h-36 w-auto mb-6" />
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Bienvenue sur TransfoCalculateur</h1>
                <p className="text-base text-gray-600 mt-2">Votre outil pour maîtriser le coût de revient de vos produits.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
                <button onClick={onNew} className="group flex flex-col items-center justify-center p-5 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-green-50 transition-all duration-300">
                    <FilePlus className="h-9 w-9 text-green-500 group-hover:text-green-600 mb-3" />
                    <h2 className="text-base font-semibold text-gray-700">Créer un nouveau projet</h2>
                    <p className="text-xs text-gray-500 mt-1">Commencer avec une feuille blanche.</p>
                </button>
                <button onClick={onOpen} className="group flex flex-col items-center justify-center p-5 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-blue-50 transition-all duration-300">
                    <FolderOpen className="h-9 w-9 text-blue-500 group-hover:text-blue-600 mb-3" />
                    <h2 className="text-base font-semibold text-gray-700">Ouvrir un projet existant</h2>
                    <p className="text-xs text-gray-500 mt-1">Charger un fichier .json sauvegardé.</p>
                </button>
                <button onClick={onExample} className="group flex flex-col items-center justify-center p-5 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-indigo-50 transition-all duration-300">
                    <FileText className="h-9 w-9 text-indigo-500 group-hover:text-indigo-600 mb-3" />
                    <h2 className="text-base font-semibold text-gray-700">Explorer un projet démo</h2>
                    <p className="text-xs text-gray-500 mt-1">Découvrir les fonctionnalités avec des données d'exemple.</p>
                </button>
                {onTour && (
                    <button data-testid="start-tour" onClick={onTour} className="group md:col-span-3 flex items-center justify-center gap-4 p-5 bg-white rounded-lg shadow-md hover:shadow-xl hover:bg-amber-50 transition-all duration-300">
                        <PlayCircle className="h-9 w-9 text-amber-500 group-hover:text-amber-600 shrink-0" />
                        <div className="text-left">
                            <h2 className="text-base font-semibold text-gray-700">Voir la visite guidée</h2>
                            <p className="text-xs text-gray-500 mt-1">Une démonstration d'environ sept minutes qui se joue toute seule : de la saisie jusqu'aux résultats.</p>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};

// --- NOUVEAU: MODAL POUR LES OPTIONS PDF ---
export const PdfOptionsModal = ({ isOpen, onClose, onConfirm, initialData }) => {
    useEscapeKey(isOpen, onClose);
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
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-xs"
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
                    Souhaitez-vous voir une visite guidée d'environ sept minutes, qui se joue toute seule, pour vous familiariser avec l'application ?
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onStart}
                        className="px-6 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Commencer la visite
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
