import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import { parseLocaleNumber, formatCurrency } from '../utils.js';
import { computeAnalysisData, computeActivityImpact, computeChannelImpact } from '../engine/analysisData.js';
import { applyCostShocks, applyLaborShocks, shockIsActive, expandShockScopes } from '../engine/costScenario.js';
import { useProject } from '../state/ProjectContext.jsx';
import { Tooltip } from '../components/common.jsx';

let nextShockId = 1;
const makeShock = () => ({ id: nextShockId++, type: 'ingredient', scope: 'all', target: '', selectedIds: [], percent: '' });

// Portées 'format'/'activity' (Phase 6, 15/10) : ciblent un format de vente ou une activité de
// production précise — résolues en une sélection concrète d'ingrédients/employés par
// `expandShockScopes` (engine/costScenario.js) avant application, à partir de ce que CE
// format/CETTE activité consomme réellement (ingrédients directs, postes utilisés dans les étapes
// de production) plutôt que de dupliquer cette résolution ici.
const scopeOptionsByType = {
    ingredient: [
        { value: 'all', label: 'Tous les ingrédients' },
        { value: 'provider', label: 'Par fournisseur' },
        { value: 'format', label: 'Par format' },
        { value: 'activity', label: "Par activité de production" },
        { value: 'selection', label: "Sélection d'ingrédients" },
    ],
    labor: [
        { value: 'all', label: "Toute la main-d'œuvre" },
        { value: 'post', label: 'Par poste' },
        { value: 'format', label: 'Par format' },
        { value: 'activity', label: "Par activité de production" },
        { value: 'selection', label: "Sélection d'employés" },
    ],
};

// Affiche « actuel → scénario » avec l'écart. `unit` : '%pt' ou '$'. `higherIsWorse` colore
// l'écart (rouge = défavorable). `targetPct` : marque en rouge si la valeur scénario dépasse la cible.
const DeltaRow = ({ label, current, shocked, unit, tooltip, higherIsWorse = true, targetPct = 0 }) => {
    const delta = shocked - current;
    const negligible = Math.abs(delta) < 1e-9;
    const isWorse = higherIsWorse ? delta > 0 : delta < 0;
    const overTarget = targetPct > 0 && shocked * 100 > targetPct;
    const fmt = (v) => unit === '$' ? `${formatCurrency(v)} $` : `${(v * 100).toFixed(1)} %`;
    const fmtDelta = unit === '$'
        ? `${delta >= 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(delta))} $`
        : `${delta >= 0 ? '▲' : '▼'} ${(Math.abs(delta) * 100).toFixed(1)} pt`;
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 text-sm">
            <span className="text-gray-600 flex items-center">{label}{tooltip && <Tooltip text={tooltip} />}</span>
            <span className="flex items-center gap-2">
                <span className="text-gray-500">{fmt(current)}</span>
                <span className="text-gray-400">→</span>
                <span className={`font-semibold ${overTarget ? 'text-red-600' : 'text-gray-800'}`}>{fmt(shocked)}{overTarget && ' ✗'}</span>
                <span className={`text-xs font-medium w-24 text-right ${negligible ? 'text-gray-400' : isWorse ? 'text-red-600' : 'text-green-600'}`}>
                    {negligible ? '—' : fmtDelta}
                </span>
            </span>
        </div>
    );
};

// Cellule compacte "actuel → scénario" pour un % au sein d'ImpactGroupTable — même logique de
// couleur que DeltaRow (rouge = coût qui augmente/marge qui baisse) mais condensée en une seule
// cellule de tableau plutôt qu'une ligne pleine largeur.
const ImpactPctCell = ({ current, shocked, higherIsWorse = true }) => {
    const delta = shocked - current;
    const negligible = Math.abs(delta) < 1e-9;
    const isWorse = higherIsWorse ? delta > 0 : delta < 0;
    return (
        <span className="whitespace-nowrap">
            <span className="text-gray-500">{(current * 100).toFixed(1)}%</span>
            <span className="text-gray-400"> → </span>
            <span className={`font-semibold ${negligible ? 'text-gray-800' : isWorse ? 'text-red-600' : 'text-green-600'}`}>{(shocked * 100).toFixed(1)}%</span>
        </span>
    );
};

// Tableau d'impact groupé (Phase 6, 15/10) : réutilisé pour « par activité » et « par circuit de
// vente » — chaque `row` vient de computeActivityImpact/computeChannelImpact (analysisData.js),
// enrichi d'un champ `after` (même forme, calculé sur shockedAnalysis plutôt que analysisData).
const ImpactGroupTable = ({ title, tooltip, rows }) => (
    <div className="overflow-x-auto">
        <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center">{title}{tooltip && <Tooltip text={tooltip} />}</p>
        <table className="min-w-full text-sm">
            <thead>
                <tr className="text-left text-gray-500 border-b">
                    <th className="py-1.5 pr-3">Nom</th>
                    <th className="py-1.5 px-3 text-right">Marge brute</th>
                    <th className="py-1.5 px-3 text-right">Food cost</th>
                    <th className="py-1.5 pl-3 text-right">Coût MO</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(row => (
                    <tr key={row.activityId || row.channelId} className="border-b border-gray-100">
                        <td className="py-1.5 pr-3">{row.label}</td>
                        <td className="py-1.5 px-3 text-right"><ImpactPctCell current={row.margeBrutePercent} shocked={row.after.margeBrutePercent} higherIsWorse={false} /></td>
                        <td className="py-1.5 px-3 text-right"><ImpactPctCell current={row.costMatierePercent} shocked={row.after.costMatierePercent} /></td>
                        <td className="py-1.5 pl-3 text-right"><ImpactPctCell current={row.costLaborPercent} shocked={row.after.costLaborPercent} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// Simulateur de choc sur les coûts (onglet Résumé). Applique un ou plusieurs chocs — sur les prix
// d'INTRANTS et/ou les salaires de MAIN-D'ŒUVRE — et recalcule l'analyse pour montrer l'impact sur
// le food cost, le coût MO, la marge, le point mort et la marge nette par plat. Transitoire : les
// scénarios ne sont pas sauvegardés dans le projet.
// `collapsible` (06/10) : repli à la Vrai dans son propre sous-onglet « Simulation » de Résumé —
// être dans cet onglet EST déjà le geste d'ouverture, inutile de redemander un clic derrière.
// Reste replié par défaut (`true`) pour tout autre usage futur hors d'un onglet dédié.
export const CostShockSimulator = ({ collapsible = true }) => {
    const { products, baseIngredients, basePackaging, salesChannels, laborDatabase, productionActivities, generalInfo, analysisData } = useProject();
    const [expanded, setExpanded] = useState(false);
    const isOpen = collapsible ? expanded : true;
    const [shocks, setShocks] = useState([]);

    const providers = useMemo(() => [...new Set(baseIngredients.map(i => i.provider).filter(Boolean))].sort(), [baseIngredients]);
    const posts = useMemo(() => (laborDatabase || []).map(p => ({ id: p.id, name: p.postName || 'Poste' })), [laborDatabase]);
    const postsById = useMemo(() => Object.fromEntries(posts.map(p => [p.id, p.name])), [posts]);
    const employees = useMemo(
        () => (laborDatabase || []).flatMap(p => (p.employees || []).map(e => ({ id: e.id, name: e.employeeName || 'Employé', post: p.postName }))),
        [laborDatabase]
    );
    // Cibles des portées 'format'/'activity' (Phase 6, 15/10) — formats actifs du menu (une entrée
    // par format, via `displayName` déjà désambiguïsé entre les formats d'un même produit).
    const formatOptions = useMemo(
        () => (analysisData.activeProducts || []).map(p => ({ id: p.id, name: p.displayName })),
        [analysisData.activeProducts]
    );
    const activitiesById = useMemo(() => Object.fromEntries((productionActivities || []).map(a => [a.id, a.name])), [productionActivities]);

    const activeShocks = useMemo(() => shocks.filter(shockIsActive), [shocks]);
    // Les portées 'format'/'activity' sont résolues en 'selection' concrète AVANT d'être appliquées
    // (expandShockScopes) — applyCostShocks/applyLaborShocks n'ont besoin de connaître que 'all' /
    // 'provider' ou 'post' / 'selection', jamais dupliquer cette résolution.
    const expandedShocks = useMemo(
        () => expandShockScopes(activeShocks, { productsWithCosts: analysisData.productsWithCosts, laborDatabase }),
        [activeShocks, analysisData.productsWithCosts, laborDatabase]
    );
    const shockedIngredients = useMemo(() => applyCostShocks(baseIngredients, expandedShocks), [baseIngredients, expandedShocks]);
    const shockedLabor = useMemo(() => applyLaborShocks(laborDatabase, expandedShocks), [laborDatabase, expandedShocks]);
    // generalInfo (contexte) = calculatedGeneralInfo : contient déjà les champs bruts + calculés. Les
    // prix d'intrants et les salaires n'affectent ni la productivité ni les heures, donc ce
    // calculatedGeneralInfo reste valide — on le passe comme les deux arguments.
    // Pas (encore) de choc simulé sur le packaging : basePackaging passé tel quel (non choqué).
    const shockedAnalysis = useMemo(
        () => activeShocks.length > 0
            ? computeAnalysisData(products, shockedIngredients, shockedLabor, generalInfo, generalInfo, basePackaging, salesChannels)
            : null,
        [activeShocks.length, products, shockedIngredients, shockedLabor, generalInfo, basePackaging, salesChannels]
    );

    // Impact par activité / par circuit de vente (Phase 6, 15/10) : les mêmes % pondérés que les
    // DeltaRow globales ci-dessous, mais recentrés sur un sous-ensemble du menu — zippe les deux
    // listes (actuel/scénario) par clé plutôt que de les afficher séparément, une activité/un canal
    // peut apparaître dans l'une et pas l'autre si le choc fait disparaître tout son volume.
    const activityImpact = useMemo(() => {
        if (!shockedAnalysis) return [];
        const current = computeActivityImpact(analysisData.activeProducts, productionActivities);
        const shocked = computeActivityImpact(shockedAnalysis.activeProducts, productionActivities);
        const shockedById = new Map(shocked.map(a => [a.activityId, a]));
        return current.map(a => ({ ...a, after: shockedById.get(a.activityId) || a }));
    }, [shockedAnalysis, analysisData.activeProducts, productionActivities]);
    const channelImpact = useMemo(() => {
        if (!shockedAnalysis) return [];
        const current = computeChannelImpact(analysisData.activeProducts, salesChannels);
        const shocked = computeChannelImpact(shockedAnalysis.activeProducts, salesChannels);
        const shockedById = new Map(shocked.map(c => [c.channelId, c]));
        return current.map(c => ({ ...c, after: shockedById.get(c.channelId) || c }));
    }, [shockedAnalysis, analysisData.activeProducts, salesChannels]);

    const foodTarget = parseLocaleNumber(generalInfo.foodCostTarget);
    const laborTarget = parseLocaleNumber(generalInfo.laborCostTarget);

    const perDish = useMemo(() => {
        if (!shockedAnalysis) return [];
        const shockedById = new Map(shockedAnalysis.productsWithCosts.map(p => [p.id, p]));
        return (analysisData.activeProducts || []).map(p => {
            const after = shockedById.get(p.id);
            const currentMargin = p.costs.margeNetteDollar;
            const shockedMargin = after ? after.costs.margeNetteDollar : currentMargin;
            const deltaAbs = Math.abs(shockedMargin - currentMargin);
            const deltaPercent = currentMargin !== 0 ? (deltaAbs / Math.abs(currentMargin)) * 100 : null;
            return {
                id: p.id, name: p.displayName, currentMargin, shockedMargin, deltaPercent,
                becomesNegative: currentMargin >= 0 && shockedMargin < 0,
                negative: shockedMargin < 0,
            };
        }).sort((a, b) => (a.shockedMargin - a.currentMargin) - (b.shockedMargin - b.currentMargin));
    }, [shockedAnalysis, analysisData]);

    const addShock = () => setShocks(prev => [...prev, makeShock()]);
    const removeShock = (id) => setShocks(prev => prev.filter(s => s.id !== id));
    const updateShock = (id, patch) => setShocks(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    const changeType = (id, type) => updateShock(id, { type, scope: 'all', target: '', selectedIds: [] });
    const toggleSelected = (id, itemId) => setShocks(prev => prev.map(s => {
        if (s.id !== id) return s;
        const set = new Set(s.selectedIds);
        if (set.has(itemId)) set.delete(itemId); else set.add(itemId);
        return { ...s, selectedIds: [...set] };
    }));

    const shockLabel = (s) => {
        const pct = parseLocaleNumber(s.percent);
        const sign = pct > 0 ? '+' : '';
        const typeLabel = s.type === 'labor' ? 'MO' : 'Intrants';
        let scope;
        if (s.scope === 'all') scope = s.type === 'labor' ? "toute la MO" : 'tous les ingrédients';
        else if (s.scope === 'provider') scope = s.target;
        else if (s.scope === 'post') scope = postsById[s.target] || 'poste';
        else if (s.scope === 'format') scope = formatOptions.find(f => f.id === s.target)?.name || 'format';
        else if (s.scope === 'activity') scope = activitiesById[s.target] || 'activité';
        else scope = `${s.selectedIds.length} sélectionné(s)`;
        return `${typeLabel} · ${scope} ${sign}${pct} %`;
    };

    const headerContent = (
        <span className="text-lg font-bold text-indigo-800 flex items-center">
            Simulation — choc sur les coûts (intrants & main-d'œuvre)
            <Tooltip text="Applique un ou plusieurs chocs sur les prix d'achat et/ou les salaires horaires, et montre l'impact sur les marges, le food cost, le coût MO et les cibles. N'est pas sauvegardé dans le projet." />
            {activeShocks.length > 0 && (
                <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {activeShocks.length} choc{activeShocks.length > 1 ? 's' : ''} actif{activeShocks.length > 1 ? 's' : ''}
                </span>
            )}
        </span>
    );

    return (
        <div className={collapsible ? 'mt-8 bg-white rounded-xl shadow border border-indigo-100' : 'bg-white rounded-xl shadow border border-indigo-100'}>
            {collapsible ? (
                <button onClick={() => setExpanded(e => !e)} className="w-full flex justify-between items-center p-4 text-left" aria-expanded={expanded}>
                    {headerContent}
                    <ChevronDown className={`h-6 w-6 text-indigo-700 transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
            ) : (
                <div className="w-full flex items-center p-4">
                    {headerContent}
                </div>
            )}

            {isOpen && (
                <div className="p-4 pt-0">
                    {(baseIngredients.length === 0 && employees.length === 0) ? (
                        <p className="text-sm text-gray-500">Ajoutez des ingrédients ou des employés pour simuler un choc de coûts.</p>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {shocks.map(s => (
                                    <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select value={s.type} onChange={(e) => changeType(s.id, e.target.value)} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm font-medium">
                                                <option value="ingredient">Intrants</option>
                                                <option value="labor">Main-d'œuvre</option>
                                            </select>

                                            <select value={s.scope} onChange={(e) => updateShock(s.id, { scope: e.target.value, target: '', selectedIds: [] })} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm">
                                                {scopeOptionsByType[s.type].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>

                                            {s.scope === 'provider' && (
                                                <select value={s.target} onChange={(e) => updateShock(s.id, { target: e.target.value })} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm">
                                                    <option value="">— Choisir un fournisseur —</option>
                                                    {providers.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            )}
                                            {s.scope === 'post' && (
                                                <select value={s.target} onChange={(e) => updateShock(s.id, { target: e.target.value })} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm">
                                                    <option value="">— Choisir un poste —</option>
                                                    {posts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            )}
                                            {s.scope === 'format' && (
                                                <select value={s.target} onChange={(e) => updateShock(s.id, { target: e.target.value })} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm">
                                                    <option value="">— Choisir un format —</option>
                                                    {formatOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                </select>
                                            )}
                                            {s.scope === 'activity' && (
                                                <select value={s.target} onChange={(e) => updateShock(s.id, { target: e.target.value })} className="rounded-md border-gray-300 shadow-sm p-2 border text-sm">
                                                    <option value="">— Choisir une activité —</option>
                                                    {(productionActivities || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            )}

                                            <div className="flex items-center gap-1">
                                                <input type="text" inputMode="decimal" value={s.percent} onChange={(e) => updateShock(s.id, { percent: e.target.value })} placeholder="ex. +15" className="w-24 rounded-md border-gray-300 shadow-sm p-2 border text-sm text-right" />
                                                <span className="text-sm text-gray-600">%</span>
                                            </div>

                                            <button onClick={() => removeShock(s.id)} className="ml-auto text-red-500 hover:text-red-700 p-1" title="Retirer ce choc">
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>

                                        {s.scope === 'selection' && (
                                            <div className="mt-2 max-h-36 overflow-y-auto border border-gray-200 rounded bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {s.type === 'ingredient'
                                                    ? baseIngredients.map(ing => (
                                                        <label key={ing.id} className="flex items-center text-sm text-gray-700">
                                                            <input type="checkbox" checked={s.selectedIds.includes(ing.id)} onChange={() => toggleSelected(s.id, ing.id)} className="h-4 w-4 mr-2 text-indigo-600" />
                                                            {ing.name} {ing.provider ? <span className="text-gray-400 ml-1">({ing.provider})</span> : null}
                                                        </label>
                                                    ))
                                                    : employees.map(emp => (
                                                        <label key={emp.id} className="flex items-center text-sm text-gray-700">
                                                            <input type="checkbox" checked={s.selectedIds.includes(emp.id)} onChange={() => toggleSelected(s.id, emp.id)} className="h-4 w-4 mr-2 text-indigo-600" />
                                                            {emp.name} {emp.post ? <span className="text-gray-400 ml-1">({emp.post})</span> : null}
                                                        </label>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 flex items-center gap-3">
                                <button onClick={addShock} className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                                    <Plus className="h-4 w-4 mr-1" /> Ajouter un choc
                                </button>
                                {shocks.length > 0 && <button onClick={() => setShocks([])} className="text-sm text-gray-500 hover:text-gray-700">Réinitialiser</button>}
                            </div>

                            {shockedAnalysis && (
                                <div className="mt-5">
                                    <div className="p-2 mb-4 bg-amber-100 text-amber-900 rounded-md text-sm flex items-center flex-wrap gap-x-2">
                                        <AlertTriangle className="inline h-4 w-4" />
                                        <span className="font-semibold">Scénario actif :</span>
                                        {activeShocks.map((s, i) => (<span key={s.id}>{shockLabel(s)}{i < activeShocks.length - 1 ? ' ·' : ''}</span>))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                        <DeltaRow label="Food cost moyen pondéré" current={analysisData.weightedMaterialCost} shocked={shockedAnalysis.weightedMaterialCost} unit="%pt" targetPct={foodTarget} tooltip="Coût matière moyen du menu, pondéré par la popularité." />
                                        <DeltaRow label="Coût MO moyen pondéré" current={analysisData.weightedLaborCost} shocked={shockedAnalysis.weightedLaborCost} unit="%pt" targetPct={laborTarget} tooltip="Coût de main-d'œuvre moyen du menu, pondéré par la popularité." />
                                        <DeltaRow label="Marge brute moyenne pondérée" current={analysisData.weightedGrossMargin} shocked={shockedAnalysis.weightedGrossMargin} unit="%pt" higherIsWorse={false} />
                                        <DeltaRow label="Point mort du menu ($)" current={analysisData.globalBreakEven} shocked={shockedAnalysis.globalBreakEven} unit="$" />
                                    </div>

                                    {(activityImpact.length > 0 || channelImpact.length > 0) && (
                                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                            {activityImpact.length > 0 && (
                                                <ImpactGroupTable
                                                    title="Impact par activité de production"
                                                    tooltip="Marge brute et coûts moyens pondérés par le mix de vente DES SEULS formats de cette activité — isole son impact propre plutôt que de le diluer dans la moyenne globale du menu."
                                                    rows={activityImpact}
                                                />
                                            )}
                                            {channelImpact.length > 0 && (
                                                <ImpactGroupTable
                                                    title="Impact par circuit de vente"
                                                    tooltip="Marge brute et coûts moyens pondérés par le volume RÉEL de ce canal (pas la vue tous-canaux) — un canal sans aucun volume saisi n'apparaît pas ici."
                                                    rows={channelImpact}
                                                />
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 overflow-x-auto">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Marge nette par portion — impact par plat</p>
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="py-2 pr-4">Plat</th>
                                                    <th className="py-2 px-4 text-right">Marge nette actuelle</th>
                                                    <th className="py-2 px-4 text-right">Marge nette scénario</th>
                                                    <th className="py-2 pl-4 text-right">Écart</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {perDish.map(d => (
                                                    <tr key={d.id} className={`border-b border-gray-100 ${d.becomesNegative ? 'bg-red-50' : ''}`}>
                                                        <td className="py-2 pr-4">
                                                            {d.name}
                                                            {d.becomesNegative && <span className="ml-2 text-xs font-semibold text-red-600">devient déficitaire ✗</span>}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-gray-500">{formatCurrency(d.currentMargin)} $</td>
                                                        <td className={`py-2 px-4 text-right font-semibold ${d.negative ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(d.shockedMargin)} $</td>
                                                        <td className={`py-2 pl-4 text-right ${d.shockedMargin < d.currentMargin ? 'text-red-600' : 'text-green-600'}`}>
                                                            {d.shockedMargin <= d.currentMargin ? '▼' : '▲'} {formatCurrency(Math.abs(d.shockedMargin - d.currentMargin))} $
                                                            {d.deltaPercent !== null && ` (${d.deltaPercent.toFixed(1)} %)`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
