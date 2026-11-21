import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '../../components/common.jsx';
import { useEscapeKey } from '../../ui-utils.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import { buildKeyFindingsContext, computeKeyFindings, FINDING_THEMES, VISIBLE_FINDINGS_PER_COLUMN } from '../../engine/keyFindings.js';

// Constats clés (lot 3, 21/11) : forces et faiblesses calculées à partir des chiffres du projet, sous les tuiles de la Vue d'ensemble. Cinq au plus par
// colonne ; les autres sont dans la fenêtre « Voir tous les constats ». Règles : engine/keyFindings.js (catalogue dans Projet_Claude/10-Constats-Cles.md).
// Aucun constat sans donnée : si rien ne s'applique, le bloc ne s'affiche pas.
const Finding = ({ f, onGo }) => (
    <li className="mb-3 last:mb-0">
        <div className="text-sm font-semibold text-gray-800">{f.title}</div>
        <div className="text-xs text-gray-600">{f.detail}</div>
        {/* Un constat de la Vue d'ensemble n'a pas de lien : on y est déjà. */}
        {f.link.subTab !== 'overview' && <button type="button" onClick={() => onGo(f.link.subTab)} className="text-xs text-blue-600 hover:text-blue-800 underline">Voir {f.link.label} →</button>}
    </li>
);

const Column = ({ tone, findings, limit, onGo, themed }) => {
    const isForce = tone === 'force';
    const box = isForce ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500';
    const title = isForce ? 'text-green-800' : 'text-red-800';
    const shown = limit ? findings.slice(0, limit) : findings;
    return (
        <div data-testid={`findings-${tone}`} className={`p-4 border-l-4 rounded-r-lg ${box}`}>
            <h3 className={`font-bold text-lg mb-2 flex items-center ${title}`}>
                {isForce ? 'Forces' : 'Faiblesses'}
                {limit && findings.length > limit && <span className="ml-2 text-sm font-normal">({limit} sur {findings.length})</span>}
            </h3>
            {shown.length === 0 && <p className="text-sm text-gray-500">Aucun constat pour l'instant.</p>}
            {themed ? (
                FINDING_THEMES.map(theme => {
                    const items = shown.filter(f => f.theme === theme);
                    return items.length ? (
                        <div key={theme} className="mb-3">
                            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{theme}</div>
                            <ul className="list-none p-0 m-0">{items.map(f => <Finding key={f.id} f={f} onGo={onGo} />)}</ul>
                        </div>
                    ) : null;
                })
            ) : (
                <ul className="list-none p-0 m-0">{shown.map(f => <Finding key={f.id} f={f} onGo={onGo} />)}</ul>
            )}
        </div>
    );
};

const AllFindingsModal = ({ result, onClose, onGo }) => {
    useEscapeKey(true, onClose);
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-label="Tous les constats" className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Tous les constats ({result.all.length})</h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"><X size={22} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Column tone="force" findings={result.forces} onGo={onGo} themed />
                    <Column tone="faiblesse" findings={result.faiblesses} onGo={onGo} themed />
                </div>
            </div>
        </div>
    );
};

export const KeyFindings = () => {
    const { analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines, goToReport } = useProject();
    const [open, setOpen] = useState(false);
    const result = useMemo(() => computeKeyFindings(buildKeyFindingsContext({
        analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines,
    })), [analysisData, generalInfo, laborDatabase, trackingPoints, salesChannels, productionActivities, revenueLines, directCostLines]);

    if (result.all.length === 0) return null;
    const go = (subTab) => { setOpen(false); goToReport(subTab); };
    return (
        <div id="tutorial-section-key-findings" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">Constats clés<Tooltip tip="constats.titre" /></h2>
                <button type="button" onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 underline">Voir tous les constats ({result.all.length})</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Column tone="force" findings={result.forces} limit={VISIBLE_FINDINGS_PER_COLUMN} onGo={go} />
                <Column tone="faiblesse" findings={result.faiblesses} limit={VISIBLE_FINDINGS_PER_COLUMN} onGo={go} />
            </div>
            {open && <AllFindingsModal result={result} onClose={() => setOpen(false)} onGo={go} />}
        </div>
    );
};
