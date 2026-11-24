import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Tooltip } from '../../components/common.jsx';

// Tri par colonne des tableaux de rapport (retour utilisateur, 21/11) : un clic sur un titre trie le tableau, un second clic inverse le sens.
// Une colonne de texte se trie d'abord de A à Z ; une colonne numérique, du plus grand au plus petit. Une valeur absente (null, « — ») reste
// TOUJOURS en fin de liste, quel que soit le sens : jamais interprétée comme 0 (même règle que les autres tableaux de l'application).
export const nextSort = (prev, key, isText = false) => (
    prev && prev.key === key
        ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: isText ? 'ascending' : 'descending' }
);

export const sortRows = (rows, sort, accessors = {}) => {
    if (!sort || !sort.key) return rows;
    const get = accessors[sort.key] || ((r) => r[sort.key]);
    const dir = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const av = get(a), bv = get(b);
        const aNull = av == null || (typeof av === 'number' && Number.isNaN(av));
        const bNull = bv == null || (typeof bv === 'number' && Number.isNaN(bv));
        if (aNull || bNull) return aNull === bNull ? 0 : (aNull ? 1 : -1);
        if (typeof av === 'string' || typeof bv === 'string') return dir * String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' });
        return dir * (av - bv);
    });
};

// Titre de colonne triable, avec infobulle facultative ; la flèche indique la colonne et le sens du tri courant.
export const SortableTh = ({ label, sortKey, sort, onSort, tip, isText = false, align = 'left', className = 'px-4 py-2 text-xs font-medium text-gray-500' }) => {
    const active = sort && sort.key === sortKey;
    return (
        <th className={`${className} ${align === 'right' ? 'text-center' : 'text-center'}`} aria-sort={active ? sort.direction : 'none'}>
            <span className={`inline-flex items-center ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                <button type="button" onClick={() => onSort(sortKey, isText)} className="inline-flex items-center hover:text-gray-800">
                    {label}
                    {active ? <span className="ml-1">{sort.direction === 'ascending' ? '▲' : '▼'}</span> : <ArrowUpDown size={14} className="ml-1 text-gray-400" />}
                </button>
                {tip && <Tooltip tip={tip} />}
            </span>
        </th>
    );
};
