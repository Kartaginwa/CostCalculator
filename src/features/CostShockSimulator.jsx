import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import { parseLocaleNumber, formatCurrency, formatPercent } from '../utils.js';
import { computeAnalysisData } from '../engine/analysisData.js';
import { applyCostShocks, shockIsActive } from '../engine/costScenario.js';
import { useProject } from '../state/ProjectContext.jsx';
import { Tooltip } from '../components/common.jsx';

let nextShockId = 1;
const makeShock = () => ({ id: nextShockId++, scope: 'all', provider: '', selectedIds: [], percent: '' });

const scopeOptions = [
    { value: 'all', label: 'Tous les ingrédients' },
    { value: 'provider', label: 'Par fournisseur' },
    { value: 'selection', label: 'Sélection d\'ingrédients' },
];

const shockLabel = (s) => {
    const pct = parseLocaleNumber(s.percent);
    const sign = pct > 0 ? '+' : '';
    const scope = s.scope === 'all' ? 'Tous les ingrédients'
        : s.scope === 'provider' ? (s.provider || 'Fournisseur')
        : `${s.selectedIds.length} ingrédient(s)`;
    return `${scope} ${sign}${pct} %`;
};

// Affiche une valeur « actuel → scénario » avec l'écart. `unit` : '%pt' (points de %) ou '$'.
// `higherIsWorse` : true pour food cost / point mort (une hausse est défavorable → rouge), false
// pour la marge (une hausse est favorable → vert).
const DeltaRow = ({ label, current, shocked, unit, tooltip, higherIsWorse = true }) => {
    const delta = shocked - current;
    const negligible = Math.abs(delta) < 1e-9;
    const isWorse = higherIsWorse ? delta > 0 : delta < 0;
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
                <span className="font-semibold text-gray-800">{fmt(shocked)}</span>
                <span className={`text-xs font-medium w-24 text-right ${negligible ? 'text-gray-400' : isWorse ? 'text-red-600' : 'text-green-600'}`}>
                    {negligible ? '—' : fmtDelta}
                </span>
            </span>
        </div>
    );
};

// Simulateur de choc sur les coûts d'intrants (onglet Résumé).
// Applique un ou plusieurs chocs de prix (tous / par fournisseur / sélection) aux ingrédients et
// recalcule l'analyse pour montrer l'impact sur le food cost, la marge, le point mort et les plats
// qui passent sous leur cible. Transitoire : les scénarios ne sont pas sauvegardés dans le projet.
export const CostShockSimulator = () => {
    const { products, baseIngredients, laborDatabase, generalInfo, analysisData } = useProject();
    const [expanded, setExpanded] = useState(false);
    const [shocks, setShocks] = useState([]);

    const providers = useMemo(
        () => [...new Set(baseIngredients.map(i => i.provider).filter(Boolean))].sort(),
        [baseIngredients]
    );
    const activeShocks = useMemo(() => shocks.filter(shockIsActive), [shocks]);

    const shockedIngredients = useMemo(
        () => applyCostShocks(baseIngredients, activeShocks),
        [baseIngredients, activeShocks]
    );
    // generalInfo (contexte) = calculatedGeneralInfo : contient déjà les champs bruts + calculés,
    // on peut donc le passer comme les deux arguments de computeAnalysisData. Les prix d'ingrédients
    // n'affectent ni la productivité ni la MO, donc calculatedGeneralInfo reste valide.
    const shockedAnalysis = useMemo(
        () => activeShocks.length > 0
            ? computeAnalysisData(products, shockedIngredients, laborDatabase, generalInfo, generalInfo)
            : null,
        [activeShocks.length, products, shockedIngredients, laborDatabase, generalInfo]
    );

    const target = parseLocaleNumber(generalInfo.foodCostTarget);
    const perDish = useMemo(() => {
        if (!shockedAnalysis) return [];
        const shockedById = new Map(shockedAnalysis.productsWithCosts.map(p => [p.id, p]));
        return (analysisData.activeProducts || []).map(p => {
            const after = shockedById.get(p.id);
            const currentFc = p.costs.costMatierePercent;
            const shockedFc = after ? after.costs.costMatierePercent : currentFc;
            return {
                id: p.id, name: p.platName, currentFc, shockedFc,
                crossesTarget: target > 0 && currentFc * 100 <= target && shockedFc * 100 > target,
                overTarget: target > 0 && shockedFc * 100 > target,
            };
        }).sort((a, b) => (b.shockedFc - b.currentFc) - (a.shockedFc - a.currentFc));
    }, [shockedAnalysis, analysisData, target]);

    const addShock = () => setShocks(prev => [...prev, makeShock()]);
    const removeShock = (id) => setShocks(prev => prev.filter(s => s.id !== id));
    const updateShock = (id, patch) => setShocks(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    const toggleSelected = (id, ingId) => setShocks(prev => prev.map(s => {
        if (s.id !== id) return s;
        const set = new Set(s.selectedIds);
        if (set.has(ingId)) set.delete(ingId); else set.add(ingId);
        return { ...s, selectedIds: [...set] };
    }));

    return (
        <div className="mt-8 bg-white rounded-xl shadow border border-indigo-100">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex justify-between items-center p-4 text-left"
                aria-expanded={expanded}
            >
                <span className="text-lg font-bold text-indigo-800 flex items-center">
                    Simulation — choc sur les coûts d'intrants
                    <Tooltip text="Applique un ou plusieurs chocs de prix d'achat (ex. +15 % sur un fournisseur) et montre l'impact sur les marges, le food cost et les cibles. N'est pas sauvegardé dans le projet." />
                    {activeShocks.length > 0 && (
                        <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {activeShocks.length} choc{activeShocks.length > 1 ? 's' : ''} actif{activeShocks.length > 1 ? 's' : ''}
                        </span>
                    )}
                </span>
                <ChevronDown className={`h-6 w-6 text-indigo-700 transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="p-4 pt-0">
                    {baseIngredients.length === 0 ? (
                        <p className="text-sm text-gray-500">Ajoutez des ingrédients pour simuler un choc de coûts.</p>
                    ) : (
                        <>
                            {/* Définition des chocs */}
                            <div className="space-y-3">
                                {shocks.map(s => (
                                    <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select
                                                value={s.scope}
                                                onChange={(e) => updateShock(s.id, { scope: e.target.value })}
                                                className="rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                            >
                                                {scopeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>

                                            {s.scope === 'provider' && (
                                                <select
                                                    value={s.provider}
                                                    onChange={(e) => updateShock(s.id, { provider: e.target.value })}
                                                    className="rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                                                >
                                                    <option value="">— Choisir un fournisseur —</option>
                                                    {providers.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            )}

                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={s.percent}
                                                    onChange={(e) => updateShock(s.id, { percent: e.target.value })}
                                                    placeholder="ex. +15"
                                                    className="w-24 rounded-md border-gray-300 shadow-sm p-2 border text-sm text-right"
                                                />
                                                <span className="text-sm text-gray-600">%</span>
                                            </div>

                                            <button onClick={() => removeShock(s.id)} className="ml-auto text-red-500 hover:text-red-700 p-1" title="Retirer ce choc">
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>

                                        {s.scope === 'selection' && (
                                            <div className="mt-2 max-h-36 overflow-y-auto border border-gray-200 rounded bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {baseIngredients.map(ing => (
                                                    <label key={ing.id} className="flex items-center text-sm text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={s.selectedIds.includes(ing.id)}
                                                            onChange={() => toggleSelected(s.id, ing.id)}
                                                            className="h-4 w-4 mr-2 text-indigo-600"
                                                        />
                                                        {ing.name} {ing.provider ? <span className="text-gray-400 ml-1">({ing.provider})</span> : null}
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
                                {shocks.length > 0 && (
                                    <button onClick={() => setShocks([])} className="text-sm text-gray-500 hover:text-gray-700">Réinitialiser</button>
                                )}
                            </div>

                            {/* Résultats */}
                            {shockedAnalysis && (
                                <div className="mt-5">
                                    <div className="p-2 mb-4 bg-amber-100 text-amber-900 rounded-md text-sm flex items-center flex-wrap gap-x-2">
                                        <AlertTriangle className="inline h-4 w-4" />
                                        <span className="font-semibold">Scénario actif :</span>
                                        {activeShocks.map((s, i) => (
                                            <span key={s.id}>{shockLabel(s)}{i < activeShocks.length - 1 ? ' ·' : ''}</span>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                        <div>
                                            <DeltaRow label="Food cost moyen pondéré" current={analysisData.weightedMaterialCost} shocked={shockedAnalysis.weightedMaterialCost} unit="%pt" tooltip="Coût matière moyen du menu, pondéré par la popularité." />
                                            <DeltaRow label="Marge brute moyenne pondérée" current={analysisData.weightedGrossMargin} shocked={shockedAnalysis.weightedGrossMargin} unit="%pt" higherIsWorse={false} />
                                            <DeltaRow label="Point mort du menu ($)" current={analysisData.globalBreakEven} shocked={shockedAnalysis.globalBreakEven} unit="$" />
                                        </div>
                                        <div className="text-sm text-gray-600 flex items-center">
                                            {target > 0
                                                ? <span>Cible de food cost : <strong>{target} %</strong>. Les plats qui la dépassent sous le scénario sont surlignés ci-dessous.</span>
                                                : <span>Définissez une cible de food cost (onglet Paramètres) pour repérer les plats qui la dépassent.</span>}
                                        </div>
                                    </div>

                                    {/* Impact par plat */}
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="py-2 pr-4">Plat</th>
                                                    <th className="py-2 px-4 text-right">Food cost actuel</th>
                                                    <th className="py-2 px-4 text-right">Food cost scénario</th>
                                                    <th className="py-2 pl-4 text-right">Écart</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {perDish.map(d => (
                                                    <tr key={d.id} className={`border-b border-gray-100 ${d.crossesTarget ? 'bg-red-50' : ''}`}>
                                                        <td className="py-2 pr-4">
                                                            {d.name}
                                                            {d.crossesTarget && <span className="ml-2 text-xs font-semibold text-red-600">passe sous la cible ✗</span>}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-gray-500">{formatPercent(d.currentFc)} %</td>
                                                        <td className={`py-2 px-4 text-right font-semibold ${d.overTarget ? 'text-red-600' : 'text-gray-800'}`}>{formatPercent(d.shockedFc)} %</td>
                                                        <td className={`py-2 pl-4 text-right ${d.shockedFc > d.currentFc ? 'text-red-600' : 'text-green-600'}`}>
                                                            {d.shockedFc >= d.currentFc ? '▲' : '▼'} {(Math.abs(d.shockedFc - d.currentFc) * 100).toFixed(1)} pt
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
