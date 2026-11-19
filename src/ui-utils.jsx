// --- UTILITAIRES DÉPENDANTS DE REACT ---
// Séparés des utilitaires purs (utils.js) pour que le moteur de calcul puisse importer ces
// derniers sans tirer React ni lucide-react.
import { useState, useRef, useEffect, useCallback, useContext, createContext } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { parseLocaleNumber } from './utils.js';

// Hook personnalisé pour animer un "flash" lors d'un changement de valeur
export const useValueFlash = (value) => {
    const [isFlashing, setIsFlashing] = useState(false);
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (prevValueRef.current !== value) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 700);
            prevValueRef.current = value;
            return () => clearTimeout(timer);
        }
    }, [value]);

    return isFlashing;
};

//---CONFIRMATION OBJECTIF STRATÉGIQUE---
export const getCostTargetIndicator = (costPercent, targetPercent) => {
    const target = parseLocaleNumber(targetPercent);
    if (!target || target <= 0) return null;

    if (costPercent * 100 <= target) {
        return <CheckCircle className="text-green-500 ml-2" size={16} />;
    } else {
        return <AlertTriangle className="text-red-500 ml-2" size={16} />;
    }
};

// Ferme une fenêtre modale avec la touche Échap (uniquement tant qu'elle est ouverte).
export const useEscapeKey = (isOpen, onClose) => {
    useEffect(() => {
        if (!isOpen || typeof onClose !== 'function') return undefined;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);
};

// Mémorise les champs que l'utilisateur a déjà quittés (blur) : une erreur « Requis » ne
// s'affiche qu'une fois le champ touché, jamais sur une ligne fraîchement créée.
export const useTouched = () => {
    const [touched, setTouched] = useState(() => new Set());
    const touch = (id) => setTouched(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    return [(id) => touched.has(id), touch];
};

// Place le curseur dans un champ qui vient d'être créé (ligne ajoutée) : on attend le rendu suivant.
export const focusSoon = (selector, delay = 120) => {
    setTimeout(() => {
        const el = document.querySelector(selector);
        if (el && typeof el.focus === 'function') el.focus();
    }, delay);
};

// --- MÉMOIRE DE SESSION (Phase 7, point 3) ---
// Les onglets se démontent au changement d'onglet : un `useState` local y repart de zéro (filtre,
// tri, sélection...). `useSessionState` est un remplaçant direct de `useState` dont la valeur est
// gardée en mémoire pour la durée de la session (jamais enregistrée dans le fichier du projet) et
// vidée par `resetSessionMemory()` quand on crée, ouvre ou charge un autre projet. `key` doit être
// unique par état (ex. 'ingredients.filterName').
const sessionMemory = new Map();
// Portée de la mémoire : la visite guidée (seconde instance de l'application, sur une copie du démo) écrit
// sous le préfixe « tour: » pour ne jamais lire ni effacer la mémoire de session de l'utilisateur.
export const TOUR_SCOPE = 'tour:';
export const SessionScopeContext = createContext('');
export const resetSessionMemory = (scope = '') => {
    [...sessionMemory.keys()].forEach((k) => {
        if (scope ? k.startsWith(scope) : !k.startsWith(TOUR_SCOPE)) sessionMemory.delete(k);
    });
};
// Conteneur où les infobulles s'affichent : celui de l'instance d'application qui les contient (la visite
// a le sien ; l'application cachée derrière garde le sien).
export const TooltipHostContext = createContext(null);
export const useSessionState = (key, initialValue) => {
    const fullKey = useContext(SessionScopeContext) + key;
    const [value, setValue] = useState(() => (sessionMemory.has(fullKey)
        ? sessionMemory.get(fullKey)
        : (typeof initialValue === 'function' ? initialValue() : initialValue)));
    const set = useCallback((next) => {
        setValue(prev => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            sessionMemory.set(fullKey, resolved);
            return resolved;
        });
    }, [fullKey]);
    return [value, set];
};
