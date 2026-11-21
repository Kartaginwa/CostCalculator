import React from 'react';
import { formatNumber } from '../../utils.js';

// Analyse ABC (Pareto 70/20/10 sur la valeur de consommation), commune aux ingrédients et aux emballages. Extraite le 21/11 des
// onglets Ingrédients et Emballage : l'analyse vit maintenant dans Rapport et suivi (Ingrédients / Emballages), les onglets de saisie ne
// gardent que la saisie. Les données viennent de analysisData.js (computePurchasingAndAbc), jamais recalculées ici.

// Élément de la liste, avec étiquette « volatile » si le prix est jugé volatil d'après les points de référence (croisement ABC × volatilité :
// un élément de forte valeur au prix volatil est une priorité d'approvisionnement).
const AbcItem = ({ item, volatilityByName }) => {
    const v = volatilityByName[item.name];
    return (
        <li className="flex justify-between items-center">
            <span className="flex items-center">
                {item.name}
                {v && v.isVolatile && (
                    <span
                        title={`Prix volatil : amplitude ${formatNumber(v.amplitudePercent, 0)} % entre son plus bas et son plus haut sur les points de référence.`}
                        className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                    >
                        volatile
                    </span>
                )}
            </span>
            <span className="font-mono text-gray-600">{formatNumber(item.percent, 1)}%</span>
        </li>
    );
};

const CATEGORIES = [
    { key: 'A', box: 'bg-red-50 border-red-500', title: 'text-red-800', hint: 'Très importants. À contrôler de près.' },
    { key: 'B', box: 'bg-yellow-50 border-yellow-500', title: 'text-yellow-800', hint: 'Importance moyenne.' },
    { key: 'C', box: 'bg-green-50 border-green-500', title: 'text-green-800', hint: 'Faible importance. Contrôle souple.' },
];

export const AbcAnalysis = ({ id, abc, volatilityByName = {}, nounPlural, emptyMessage }) => {
    const isEmpty = abc.A.length === 0 && abc.B.length === 0 && abc.C.length === 0;
    return (
        <div id={id} className="mt-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyse ABC des {nounPlural}</h2>
            <p className="text-sm text-gray-500 mb-4">Cet outil classe vos {nounPlural} en trois catégories selon leur importance dans vos coûts totaux, vous aidant à concentrer vos efforts de gestion là où ils comptent le plus.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CATEGORIES.map(cat => (
                    <div key={cat.key} className={`p-4 border-l-4 rounded-r-lg ${cat.box}`}>
                        <h3 className={`font-bold text-lg flex items-center ${cat.title}`}>
                            Catégorie {cat.key} <span className="ml-auto text-sm font-normal">({formatNumber(abc.totals[cat.key], 1)}% des coûts)</span>
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">{cat.hint}</p>
                        <ul className="text-sm space-y-1">
                            {abc[cat.key].map(item => <AbcItem key={item.name} item={item} volatilityByName={volatilityByName} />)}
                        </ul>
                    </div>
                ))}
            </div>
            {isEmpty && emptyMessage && <p className="text-sm text-gray-500 mt-4">{emptyMessage}</p>}
        </div>
    );
};
