import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, FileDown } from 'lucide-react';
import { useEscapeKey } from '../ui-utils.jsx';
import { PARTS } from './guide/guideContent.js';
import { GuideContent } from './guide/GuideBody.jsx';
import { generateGuidePdf } from '../reports/generateGuidePdf.js';
import { useProject } from '../state/ProjectContext.jsx';

// --- GUIDE D'UTILISATION ET D'APPRENTISSAGE ---
// Le contenu vit dans src/components/guide/ (données : parties → chapitres → blocs) ; ce composant
// ne fait que l'enveloppe : fenêtre, sommaire généré, recherche, ouverture à une ancre précise.
// Ajouter un chapitre = l'ajouter dans guide/content/*.js ; le sommaire et les tests suivent seuls.

const tocEntries = (chapter) => chapter.blocks
    .filter((b) => b.type === 'h' && b.id && b.level !== 5)
    .map((b) => ({ id: b.id, text: b.text.replace(/\*\*|__|\{\{|\}\}/g, '') }));

export const InstructionModal = ({ isOpen, onClose, anchor = null, appLogoBase64 = null, appLogoDimensions }) => {
    useEscapeKey(isOpen, onClose);
    const { showNotification, startTour } = useProject();
    const [isExporting, setIsExporting] = useState(false);
    const downloadPdf = () => {
        setIsExporting(true);
        // laisse le temps d'afficher « Génération… » avant le calcul de mise en page, synchrone
        setTimeout(() => {
            try {
                if (generateGuidePdf(PARTS, { showNotification, appLogoBase64, appLogoDimensions })) showNotification({ message: 'Le guide a été téléchargé en PDF.', type: 'success' });
            } catch (error) {
                console.error('Erreur de génération du PDF du guide:', error);
                showNotification({ message: 'Une erreur est survenue lors de la génération du PDF.', type: 'error' });
            } finally {
                setIsExporting(false);
            }
        }, 30);
    };
    const [searchTerm, setSearchTerm] = useState('');
    const contentRef = useRef(null);
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);

    const handleLinkClick = (e, id) => {
        e.preventDefault();
        // Lien d'action (pas une section) : lance la visite guidée. Absent dans l'instance jouée par la visite.
        if (id === 'action-visite') { if (startTour) startTour(); return; }
        const element = contentRef.current && contentRef.current.querySelector(`#${id}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Recherche : on collecte les <mark> produits par le rendu surligné, puis on y navigue.
    useEffect(() => {
        if (!isOpen) return;
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(0);
            return;
        }
        const results = Array.from(contentRef.current.querySelectorAll('mark'));
        setSearchResults(results);
        setCurrentResultIndex(0);
        if (results.length > 0) results[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchTerm, isOpen]);

    // Ouverture à une section précise (ex. depuis une infobulle) : on attend que le contenu soit monté.
    useEffect(() => {
        if (!isOpen || !anchor) return undefined;
        const t = setTimeout(() => {
            const el = contentRef.current && contentRef.current.querySelector(`#${anchor}`);
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 60);
        return () => clearTimeout(t);
    }, [isOpen, anchor]);

    const navigateResults = (direction) => {
        if (searchResults.length === 0) return;
        const newIndex = direction === 'next'
            ? (currentResultIndex + 1) % searchResults.length
            : (currentResultIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentResultIndex(newIndex);
        searchResults[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const toc = useMemo(() => PARTS.map((part) => ({
        id: part.id,
        title: part.title,
        chapters: part.chapters.map((c) => ({ id: c.id, title: c.title, subs: tocEntries(c) })),
    })), []);

    if (!isOpen) return null;

    const tocLink = (id, label, cls) => (
        <a href={`#${id}`} onClick={(e) => handleLinkClick(e, id)} className={cls}>{label}</a>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-full max-h-[92vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Guide d'utilisation et d'apprentissage</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={downloadPdf} disabled={isExporting} className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                            <FileDown className="h-4 w-4 mr-2" /> {isExporting ? 'Génération…' : 'Télécharger en PDF'}
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" aria-label="Fermer le guide">
                            <X className="h-6 w-6 text-gray-600" />
                        </button>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="mb-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                data-testid="guide-search"
                                placeholder="Rechercher un terme (ex. «&nbsp;marge nette&nbsp;», «&nbsp;point mort&nbsp;», «&nbsp;CICI&nbsp;»)…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 border rounded-md border-gray-300"
                            />
                            {searchTerm.trim() && (
                                <div className="flex items-center space-x-1 text-sm text-gray-600 flex-shrink-0">
                                    <span>{searchResults.length > 0 ? currentResultIndex + 1 : 0} / {searchResults.length}</span>
                                    <button onClick={() => navigateResults('prev')} disabled={searchResults.length === 0} className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50">↑</button>
                                    <button onClick={() => navigateResults('next')} disabled={searchResults.length === 0} className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50">↓</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                        <nav className="w-72 flex-shrink-0 pr-4 overflow-y-auto" aria-label="Table des matières">
                            <h3 className="font-semibold text-lg mb-2">Table des matières</h3>
                            <ul className="space-y-3 text-sm">
                                {toc.map((part) => (
                                    <li key={part.id}>
                                        {tocLink(part.id, part.title, 'font-bold text-blue-700 hover:underline')}
                                        <ul className="mt-1 space-y-1 pl-3 border-l border-gray-200">
                                            {part.chapters.map((chapter) => (
                                                <li key={chapter.id}>
                                                    {tocLink(chapter.id, chapter.title, 'text-gray-700 hover:underline')}
                                                    {chapter.subs.length > 0 && (
                                                        <ul className="pl-3 list-disc list-inside text-xs text-gray-500">
                                                            {chapter.subs.map((s) => (
                                                                <li key={s.id}>{tocLink(s.id, s.text, 'hover:underline')}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <div ref={contentRef} className="flex-1 pl-6 border-l overflow-y-auto text-[15px] leading-relaxed text-gray-800">
                            <GuideContent parts={PARTS} term={searchTerm} onLink={handleLinkClick} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
