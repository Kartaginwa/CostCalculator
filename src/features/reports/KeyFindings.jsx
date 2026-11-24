import React, { createContext, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '../../components/common.jsx';
import { useEscapeKey } from '../../ui-utils.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import { parseLocaleNumber } from '../../utils.js';
import {
    buildKeyFindingsContext, computeKeyFindings, FINDING_THEMES, VISIBLE_FINDINGS_PER_GROUP,
} from '../../engine/keyFindings.js';
import { SUBTAB_LABELS } from '../../engine/findingKit.js';
import { objectiveFindings, evolutionFindings, overviewStrengths, tabFindings } from '../../engine/findingSurfaces.js';

// Constats (refonte de Rapport et suivi, 23/11) : les mêmes constats que l'export PDF, répandus dans les rapports sans répétition. Chaque constat a une
// adresse principale (voir engine/findingSurfaces.js) :
//   - Vue d'ensemble : trois blocs séparés, chacun sous le rapport qu'il commente (<ObjectivesFindings/> sous les tuiles, <EvolutionFindings/> sous
//     l'évolution des marges, <StrengthsFindings/> sous la matrice activité × canal) ;
//   - les autres sous-onglets (sauf Simulation) : un bandeau de fin <TabFindings/> avec les constats de ce sous-onglet.
// Tous les blocs ont la même forme : deux colonnes (positifs à gauche, négatifs à droite), trois lignes au maximum par colonne, et « Voir tout »
// qui ouvre une fenêtre regroupée par thème. Aucun constat sans donnée : un bloc sans constat ne s'affiche pas (sauf une invitation à saisir la donnée).

// Le calcul est fait une fois par changement de données, même quand plusieurs blocs sont à l'écran : un fournisseur de contexte l'enveloppe autour des rapports.
const FindingsContext = createContext({ all: [], project: {} });
export const FindingsProvider = ({ children }) => {
    const project = useProject();
    const { analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines } = project;
    const all = useMemo(() => computeKeyFindings(buildKeyFindingsContext({
        analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines,
    }), { entities: true }).all, [analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, baseIngredients, expenseLines]);
    const value = useMemo(() => ({ all, project }), [all, project]);
    return <FindingsContext.Provider value={value}>{children}</FindingsContext.Provider>;
};
const useAllFindings = () => useContext(FindingsContext);

const split = (list) => ({ forces: list.filter(f => f.tone === 'force'), faiblesses: list.filter(f => f.tone === 'faiblesse') });

const Finding = ({ f, onGo, here }) => (
    <li>
        <div className="text-sm font-semibold text-gray-800">{f.title}</div>
        <div className="text-xs text-gray-600">{f.detail}</div>
        {/* Un constat n'a pas de lien vers l'endroit où l'on se trouve déjà. */}
        {f.link.subTab !== here && <button type="button" onClick={() => onGo(f.link.subTab)} className="text-xs text-blue-600 hover:text-blue-800 underline">Voir {f.link.label} →</button>}
    </li>
);

const ModalColumn = ({ tone, title, findings, onGo, here }) => (
    <div data-testid={`findings-${tone}`} className={`p-4 border-l-4 rounded-r-lg ${tone === 'force' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <h3 className={`font-bold text-lg mb-2 ${tone === 'force' ? 'text-green-800' : 'text-red-800'}`}>{title}</h3>
        {findings.length === 0 && <p className="text-sm text-gray-500">Aucun constat pour l'instant.</p>}
        {FINDING_THEMES.map(theme => {
            const items = findings.filter(f => f.theme === theme);
            return items.length ? (
                <div key={theme} className="mb-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{theme}</div>
                    <ul className="list-none p-0 m-0 space-y-3">{items.map(f => <Finding key={f.id} f={f} onGo={onGo} here={here} />)}</ul>
                </div>
            ) : null;
        })}
    </div>
);

const FindingsModal = ({ title, forceLabel, weakLabel, forces, faiblesses, onClose, onGo, here }) => {
    useEscapeKey(true, onClose);
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-label={title} className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">{title} ({forces.length + faiblesses.length})</h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"><X size={22} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModalColumn tone="force" title={forceLabel} findings={forces} onGo={onGo} here={here} />
                    <ModalColumn tone="faiblesse" title={weakLabel} findings={faiblesses} onGo={onGo} here={here} />
                </div>
            </div>
        </div>
    );
};

// Une colonne de l'aperçu : trois constats au maximum, du plus important au moins important (le reste est dans la fenêtre « Voir tout »).
const PreviewColumn = ({ tone, title, findings, onGo, here }) => (
    <div data-testid={`preview-${tone}`} className={`px-3 py-2 border-l-4 rounded-r-lg ${tone === 'force' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <h4 className={`font-bold text-sm mb-1 ${tone === 'force' ? 'text-green-800' : 'text-red-800'}`}>{title}</h4>
        {findings.length === 0
            ? <p className="text-sm text-gray-500">Aucun constat pour l'instant.</p>
            : <ul className="list-none p-0 m-0 space-y-2">{findings.slice(0, VISIBLE_FINDINGS_PER_GROUP).map(f => <Finding key={f.id} f={f} onGo={onGo} here={here} />)}</ul>}
    </div>
);

/** Un bloc de constats : titre, infobulle, « Voir tout (n) », deux colonnes. `empty` (texte ou lien) remplace les colonnes quand il n'y a aucun constat. */
const FindingsBlock = ({ id, testId, title, tip, forceLabel, weakLabel, forces, faiblesses, empty, here }) => {
    const { project: { goToReport } } = useAllFindings();
    const [open, setOpen] = useState(false);
    const total = forces.length + faiblesses.length;
    const go = (subTab) => { setOpen(false); goToReport(subTab); };
    return (
        <div id={id} data-testid={testId} className="mt-6 p-4 bg-gray-50 rounded-xl shadow-inner">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">{title}<Tooltip tip={tip} /></h3>
                {total > 0 && <button type="button" onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 underline">Voir tout ({total})</button>}
            </div>
            {total === 0
                ? <p className="text-sm text-gray-500 p-4 bg-white rounded-lg shadow">{empty || 'Aucun constat pour l\'instant.'}</p>
                : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <PreviewColumn tone="force" title={forceLabel} findings={forces} onGo={go} here={here} />
                        <PreviewColumn tone="faiblesse" title={weakLabel} findings={faiblesses} onGo={go} here={here} />
                    </div>
                )}
            {open && <FindingsModal title={title} forceLabel={forceLabel} weakLabel={weakLabel} forces={forces} faiblesses={faiblesses} onClose={() => setOpen(false)} onGo={go} here={here} />}
        </div>
    );
};

// ---------- Vue d'ensemble ----------
export const ObjectivesFindings = () => {
    const { all, project: { generalInfo, goToTab } } = useAllFindings();
    if (all.length === 0) return null;
    const { forces, faiblesses } = split(objectiveFindings(all));
    const hasTargets = ['foodCostTarget', 'packagingCostTarget', 'laborCostTarget'].some(k => parseLocaleNumber(generalInfo[k]) > 0);
    const empty = hasTargets ? undefined : (
        <>Saisissez vos cibles de coûts dans Paramètres pour suivre vos objectifs. <button type="button" onClick={() => goToTab('info')} className="text-blue-600 hover:text-blue-800 underline">Aller à Paramètres</button></>
    );
    return <FindingsBlock id="tutorial-section-findings-objectif" testId="findings-group-objectif" title="Objectifs stratégiques" tip="constats.objectif" forceLabel="Objectifs atteints" weakLabel="Objectifs à atteindre" forces={forces} faiblesses={faiblesses} empty={empty} here="overview" />;
};

export const EvolutionFindings = () => {
    const { all, project: { trackingPoints } } = useAllFindings();
    if (all.length === 0) return null;
    const { forces, faiblesses } = split(evolutionFindings(all));
    const empty = trackingPoints.length < 1 ? 'Créez un point de référence pour suivre l\'évolution de votre entreprise.' : undefined;
    return <FindingsBlock id="tutorial-section-findings-evolution" testId="findings-group-evolution" title="Amélioration / détérioration" tip="constats.evolution" forceLabel="Améliorations" weakLabel="Détériorations" forces={forces} faiblesses={faiblesses} empty={empty} here="overview" />;
};

export const StrengthsFindings = () => {
    const { all } = useAllFindings();
    if (all.length === 0) return null;
    const { forces, faiblesses } = overviewStrengths(all);
    return <FindingsBlock id="tutorial-section-key-findings" testId="findings-group-structure" title="Forces et faiblesses" tip="constats.structure" forceLabel="Forces" weakLabel="Faiblesses" forces={forces} faiblesses={faiblesses} here="overview" />;
};

// ---------- fin de sous-onglet ----------
/** Bandeau de fin d'un sous-onglet (hors Vue d'ensemble et Simulation). `selectedFormat` : Par SKU, le SKU choisi ({ id, productId }). */
export const TabFindings = ({ subTab, selectedFormat }) => {
    const { all } = useAllFindings();
    const { forces, faiblesses } = tabFindings(all, subTab, { formatId: selectedFormat?.id, productId: selectedFormat?.productId });
    if (forces.length + faiblesses.length === 0) return null;
    return <FindingsBlock id={`tutorial-section-findings-${subTab}`} testId={`tab-findings-${subTab}`} title={`Constats\u00A0: ${SUBTAB_LABELS[subTab]}`} tip="constats.onglet" forceLabel="Forces" weakLabel="Faiblesses" forces={forces} faiblesses={faiblesses} here={subTab} />;
};
