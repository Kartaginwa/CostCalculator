import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useProject } from '../state/ProjectContext.jsx';
import { parseLocaleNumber } from '../utils.js';
import { INDICATORS, activeTarget, dirText } from '../engine/objectives.js';

// Voyant d'un objectif stratégique à côté de la valeur qu'il mesure (24/11) : coche verte si l'objectif est atteint, triangle rouge sinon. Rien ne s'affiche
// sans valeur saisie, quand l'objectif est désactivé ou sans donnée (une donnée absente reste absente). `value` : la valeur de l'indicateur dans son unité
// (34,5 pour 34,5 %). Le sens (« au plus » ou « au moins ») est celui de l'indicateur ; l'infobulle de l'icône rappelle l'objectif.
export const ObjectiveBadge = ({ id, value, info }) => {
    const { generalInfo } = useProject();
    const target = parseLocaleNumber(activeTarget(info || generalInfo, id));
    if (!(target > 0) || !Number.isFinite(value)) return null;
    const dir = INDICATORS[id].dir;
    const met = dir === 'max' ? value <= target + 1e-9 : value >= target - 1e-9;
    const title = `Objectif\u00A0: ${dirText(dir)} ${target}\u00A0%`;
    return met
        ? <CheckCircle className="text-green-500 ml-2" size={16} aria-label={`${title}\u00A0: atteint`}><title>{`${title}\u00A0: atteint`}</title></CheckCircle>
        : <AlertTriangle className="text-red-500 ml-2" size={16} aria-label={`${title}\u00A0: à atteindre`}><title>{`${title}\u00A0: à atteindre`}</title></AlertTriangle>;
};
