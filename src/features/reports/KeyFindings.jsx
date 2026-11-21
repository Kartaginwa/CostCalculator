import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '../../components/common.jsx';
import { useEscapeKey } from '../../ui-utils.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import { parseLocaleNumber } from '../../utils.js';
import {
    buildKeyFindingsContext, computeKeyFindings, FINDING_GROUPS, FINDING_THEMES, VISIBLE_FINDINGS_PER_GROUP,
} from '../../engine/keyFindings.js';

// Constats clés (lot 3, 21/11) — TEST de présentation en trois groupes, trois lignes chacun : Objectifs stratégiques, Amélioration / détérioration,
// Forces et faiblesses. Chaque groupe a son lien « Voir tout » qui ouvre une fenêtre avec ses constats, séparés en positifs et négatifs et regroupés
// par thème. Règles : engine/keyFindings.js (catalogue dans Projet_Claude/10-Constats-Cles.md). Aucun constat sans donnée : si rien ne s'applique, le
// bloc ne s'affiche pas ; un groupe sans donnée invite à la renseigner (ce n'est pas un avertissement).
// Infobulle de chaque groupe (clés écrites en toutes lettres : le registre vérifie qu'aucune n'est orpheline).
const GROUP_TIPS = { objectif: "constats.objectif", evolution: "constats.evolution", structure: "constats.structure" };

const Finding = ({ f, onGo }) => (
    <li>
        <div className="text-sm font-semibold text-gray-800">{f.title}</div>
        <div className="text-xs text-gray-600">{f.detail}</div>
        {/* Un constat de la Vue d'ensemble n'a pas de lien : on y est déjà. */}
        {f.link.subTab !== 'overview' && <button type="button" onClick={() => onGo(f.link.subTab)} className="text-xs text-blue-600 hover:text-blue-800 underline">Voir {f.link.label} →</button>}
    </li>
);

const ModalColumn = ({ tone, title, findings, onGo }) => (
    <div data-testid={`findings-${tone}`} className={`p-4 border-l-4 rounded-r-lg ${tone === 'force' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <h3 className={`font-bold text-lg mb-2 ${tone === 'force' ? 'text-green-800' : 'text-red-800'}`}>{title}</h3>
        {findings.length === 0 && <p className="text-sm text-gray-500">Aucun constat pour l'instant.</p>}
        {FINDING_THEMES.map(theme => {
            const items = findings.filter(f => f.theme === theme);
            return items.length ? (
                <div key={theme} className="mb-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{theme}</div>
                    <ul className="list-none p-0 m-0 space-y-3">{items.map(f => <Finding key={f.id} f={f} onGo={onGo} />)}</ul>
                </div>
            ) : null;
        })}
    </div>
);

const GroupModal = ({ group, data, onClose, onGo }) => {
    useEscapeKey(true, onClose);
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-label={group.label} className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">{group.label} ({data.all.length})</h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"><X size={22} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModalColumn tone="force" title={group.forceLabel} findings={data.forces} onGo={onGo} />
                    <ModalColumn tone="faiblesse" title={group.weakLabel} findings={data.faiblesses} onGo={onGo} />
                </div>
            </div>
        </div>
    );
};

// Une colonne de l'aperçu : trois constats au maximum, du plus important au moins important (le reste est dans la fenêtre « Voir tout »).
const PreviewColumn = ({ tone, title, findings, onGo }) => (
    <div data-testid={`preview-${tone}`} className={`px-3 py-2 border-l-4 rounded-r-lg ${tone === 'force' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <h4 className={`font-bold text-sm mb-1 ${tone === 'force' ? 'text-green-800' : 'text-red-800'}`}>{title}</h4>
        {findings.length === 0
            ? <p className="text-sm text-gray-500">Aucun constat pour l'instant.</p>
            : <ul className="list-none p-0 m-0 space-y-2">{findings.slice(0, VISIBLE_FINDINGS_PER_GROUP).map(f => <Finding key={f.id} f={f} onGo={onGo} />)}</ul>}
    </div>
);

export const KeyFindings = () => {
    const { analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines, goToReport, goToTab } = useProject();
    const [openGroup, setOpenGroup] = useState(null);
    const result = useMemo(() => computeKeyFindings(buildKeyFindingsContext({
        analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines,
    })), [analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines]);

    if (result.all.length === 0) return null;
    const go = (subTab) => { setOpenGroup(null); goToReport(subTab); };
    const hasTargets = ['foodCostTarget', 'packagingCostTarget', 'laborCostTarget'].some(k => parseLocaleNumber(generalInfo[k]) > 0);

    // Invitation affichée quand un groupe est vide faute de donnée (jamais un avertissement).
    const emptyMessage = (id) => {
        if (id === 'objectif' && !hasTargets) return (
            <>Saisissez vos cibles de coûts dans Paramètres pour suivre vos objectifs. <button type="button" onClick={() => goToTab('info')} className="text-blue-600 hover:text-blue-800 underline">Aller à Paramètres</button></>
        );
        if (id === 'evolution' && trackingPoints.length < 1) return 'Créez un point de référence pour suivre l\'évolution de votre entreprise.';
        return 'Aucun constat pour l\'instant.';
    };

    return (
        <div id="tutorial-section-key-findings" className="mt-6 p-4 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">Constats clés<Tooltip tip="constats.titre" /></h2>
            <div className="space-y-3">
                {FINDING_GROUPS.map(group => {
                    const data = result.groups[group.id];
                    return (
                        <div key={group.id} data-testid={`findings-group-${group.id}`}>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-base font-semibold text-gray-700 flex items-center">{group.label}<Tooltip tip={GROUP_TIPS[group.id]} /></h3>
                                {data.all.length > 0 && (
                                    <button type="button" onClick={() => setOpenGroup(group.id)} className="text-sm text-blue-600 hover:text-blue-800 underline">Voir tout ({data.all.length})</button>
                                )}
                            </div>
                            {data.all.length === 0
                                ? <p className="text-sm text-gray-500 p-4 bg-white rounded-lg shadow">{emptyMessage(group.id)}</p>
                                : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <PreviewColumn tone="force" title={group.forceLabel} findings={data.forces} onGo={go} />
                                        <PreviewColumn tone="faiblesse" title={group.weakLabel} findings={data.faiblesses} onGo={go} />
                                    </div>
                                )}
                        </div>
                    );
                })}
            </div>
            {openGroup && <GroupModal group={FINDING_GROUPS.find(g => g.id === openGroup)} data={result.groups[openGroup]} onClose={() => setOpenGroup(null)} onGo={go} />}
        </div>
    );
};
