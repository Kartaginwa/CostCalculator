// --- UTILITAIRES DÉPENDANTS DE REACT ---
// Séparés des utilitaires purs (utils.js) pour que le moteur de calcul puisse importer ces
// derniers sans tirer React ni lucide-react.
import { useState, useRef, useEffect } from 'react';
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
