import React, { useMemo } from 'react';
import { PlusCircle, Trash2, CheckCircle } from 'lucide-react';
import { Tooltip } from './common.jsx';
import { useEscapeKey } from '../ui-utils.jsx';
import { useProject } from '../state/ProjectContext.jsx';
import { formatNumber, parseLocaleNumber, isInvalidPercentage, isValidPositiveNumber } from '../utils.js';
import { buildKeyFindingsContext } from '../engine/keyFindings.js';
import { INDICATORS, INDICATOR_GROUPS, DEFAULT_OBJECTIVES, MAX_CUSTOM_OBJECTIVES, evaluateObjectives, dirText, subjectsOf, fmtObjValue, unitSuffix } from '../engine/objectives.js';

// Fenêtre « Gérer les objectifs » (24/11) : tous les objectifs stratégiques au même endroit. Les neuf objectifs par défaut (sens fixe : un coût « au plus », une marge
// « au moins »), qu'on peut désactiver sans les supprimer, et jusqu'à 20 objectifs sur mesure (indicateur, sens et valeur au choix). Un objectif atteint est surligné en vert.
// Les valeurs des quatre cibles principales sont les mêmes champs que dans Paramètres : une seule source. Voir engine/objectives.js.

// Infobulle de chaque indicateur (clés écrites en toutes lettres : le registre vérifie qu'aucune n'est orpheline).
const INDICATOR_TIPS = {
    matiere: "obj.matiere", emballage: "obj.emballage", mo: "obj.mo", margeBrute: "obj.margeBrute", margeNette: "obj.margeNette",
    utilisation: "obj.utilisation", paieNonUtilisee: "obj.paieNonUtilisee", perteStock: "obj.perteStock", fraisFixes: "obj.fraisFixes",
    margeSecurite: "objInd.margeSecurite", pointMort: "objInd.pointMort", revenus: "objInd.revenus", partFournisseur: "objInd.partFournisseur",
    partCanal: "objInd.partCanal", margeProduitMin: "objInd.margeProduitMin",
    beneficeNet: "objInd.beneficeNet", fixedCover: "objInd.fixedCover", ecartRevenus: "objInd.ecartRevenus", produitsDeficitaires: "objInd.produitsDeficitaires",
    partPremierProduit: "objInd.partPremierProduit", margeCanalMin: "objInd.margeCanalMin", posteMoinsUtilise: "objInd.posteMoinsUtilise",
    ingPart: "objInd.ingPart", ingDepense: "objInd.ingDepense", ingPerte: "objInd.ingPerte", ingVolatilite: "objInd.ingVolatilite",
    pkgPart: "objInd.pkgPart", pkgDepense: "objInd.pkgDepense", pkgPerte: "objInd.pkgPerte", pkgVolatilite: "objInd.pkgVolatilite",
    fournIngPart: "objInd.fournIngPart", fournEmbPart: "objInd.fournEmbPart",
    posteUtilisation: "objInd.posteUtilisation", posteCoutHoraire: "objInd.posteCoutHoraire", posteMasse: "objInd.posteMasse", posteInutilise: "objInd.posteInutilise", posteInutilisePart: "objInd.posteInutilisePart",
    fmtMargeBrute: "objInd.fmtMargeBrute", fmtMargeNette: "objInd.fmtMargeNette", fmtMatiere: "objInd.fmtMatiere", fmtEmballage: "objInd.fmtEmballage", fmtMo: "objInd.fmtMo", fmtBeneficeHeure: "objInd.fmtBeneficeHeure",
    canalMargeBrute: "objInd.canalMargeBrute", canalMargeNette: "objInd.canalMargeNette", canalPart: "objInd.canalPart",
    actMargeBrute: "objInd.actMargeBrute", actMargeNette: "objInd.actMargeNette", actPart: "objInd.actPart",
};

// Colonnes (une seule ligne par objectif, en-têtes alignés) : case à cocher, nom ou libellé, [indicateur], sens, valeur, valeur actuelle, état.
const DEFAULT_COLS = '2rem minmax(0,1.7fr) 5rem 8.5rem minmax(0,0.9fr) minmax(0,1.5fr)';
const CUSTOM_COLS = '2rem minmax(0,1fr) minmax(0,1.5fr) minmax(0,1.2fr) 6rem 8.5rem minmax(0,0.9fr) minmax(0,1.4fr)';
const headCls = 'grid gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-center text-gray-500';

const fmtValue = fmtObjValue;
const inputCls = (bad) => `p-1.5 text-sm border rounded-md text-right ${bad ? 'border-red-500' : 'border-gray-300'}`;
// Une valeur invalide : un pourcentage hors de 0-100, un montant ou un nombre négatif ou illisible (un nombre de produits peut valoir 0).
const invalidValue = (raw, unit) => raw !== '' && raw != null && (unit === '%' ? isInvalidPercentage(raw) : unit === 'n' ? !(Number.isFinite(parseLocaleNumber(raw)) && parseLocaleNumber(raw) >= 0) : !isValidPositiveNumber(raw));

const StatusCell = ({ o }) => {
    if (!o.enabled) return <span className="text-xs text-gray-400">Désactivé</span>;
    if (o.met == null) return <span className="text-xs text-gray-400">{o.hasTarget ? 'Sans donnée' : 'Sans valeur'}</span>;
    return o.met
        ? <span className="inline-flex items-center text-xs font-semibold text-green-700"><CheckCircle size={14} className="mr-1" />Atteint</span>
        : <span className="text-xs font-semibold text-red-700">À atteindre (écart {fmtValue(o.gap, o.unit)})</span>;
};

const ObjectivesBody = ({ onClose }) => {
    const project = useProject();
    const { generalInfo, onUpdateGeneralInfo } = project;
    const ctx = useMemo(() => buildKeyFindingsContext({
        analysisData: project.analysisData, generalInfo, laborDatabase: project.laborDatabase, trackingPoints: project.trackingPoints, salesChannels: project.salesChannels,
        productionActivities: project.productionActivities, revenueLines: project.revenueLines, directCostLines: project.directCostLines, baseIngredients: project.baseIngredients, expenseLines: project.expenseLines,
    }), [project.analysisData, generalInfo, project.laborDatabase, project.trackingPoints, project.salesChannels, project.productionActivities, project.revenueLines, project.directCostLines, project.baseIngredients, project.expenseLines]);
    const list = useMemo(() => evaluateObjectives(ctx), [ctx]);
    useEscapeKey(true, onClose);

    const off = generalInfo.objectivesOff || [];
    const customs = generalInfo.customObjectives || [];
    const setOff = (key, isOff) => onUpdateGeneralInfo('objectivesOff', isOff ? [...off.filter(k => k !== key), key] : off.filter(k => k !== key));
    const setCustoms = (next) => onUpdateGeneralInfo('customObjectives', next);
    const patchCustom = (id, patch) => setCustoms(customs.map(c => (c.id === id ? { ...c, ...patch } : c)));
    const addCustom = () => setCustoms([...customs, { id: `custom_${Date.now().toString(36)}`, indicator: 'margeSecurite', dir: INDICATORS.margeSecurite.dir, value: '', name: '', subject: '' }]);
    // Changer d'indicateur : le sens naturel se présélectionne, et le premier sujet disponible pour un indicateur « par entité » (sinon aucun).
    const changeIndicator = (id, indicator) => patchCustom(id, { indicator, dir: INDICATORS[indicator].dir, subject: subjectsOf(ctx, indicator)[0]?.id ?? '' });
    const removeCustom = (id) => { setCustoms(customs.filter(c => c.id !== id)); if (off.includes(id)) setOff(id, false); };

    const evaluable = list.filter(o => o.met != null);
    const rowCls = (o) => `grid gap-2 items-center p-2 rounded-md border-l-4 ${o.met ? 'bg-green-50 border-green-500' : 'bg-white border-transparent'} ${o.enabled ? '' : 'opacity-60'}`;
    const toggle = (o) => (
        <input type="checkbox" checked={o.enabled} onChange={(e) => setOff(o.key, !e.target.checked)} aria-label={`Activer l'objectif ${o.label}`} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
    );
    const current = (o) => <span className="text-sm font-semibold text-gray-700">{fmtValue(o.current, o.unit)}</span>;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-label="Gérer les objectifs" className="bg-white rounded-lg p-6 shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-1 flex items-center">Gérer les objectifs<Tooltip tip="obj.gerer" /></h3>
                <p className="text-xs text-gray-500 mb-4">
                    Un objectif compare une valeur que l'application mesure déjà à la cible que vous choisissez. Un objectif sans valeur, désactivé ou sans donnée ne produit aucun constat ni voyant.
                    {evaluable.length > 0 && <> <span className="font-semibold text-gray-700">{evaluable.filter(o => o.met).length} atteint{evaluable.filter(o => o.met).length > 1 ? 's' : ''} sur {evaluable.length}.</span></>}
                </p>

                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center">Objectifs par défaut<Tooltip tip="obj.sens" /></h4>
                <div className={headCls} style={{ gridTemplateColumns: DEFAULT_COLS }} aria-hidden="true">
                    <span /><span>Objectif</span><span>Sens</span><span className="flex items-center justify-center gap-1"><span className="w-20 text-center">Valeur</span><span className="w-3" /></span><span className="pl-3">Actuel</span><span>État</span>
                </div>
                <div className="space-y-1" data-testid="objectives-default">
                    {DEFAULT_OBJECTIVES.map(def => {
                        const o = list.find(x => x.key === def.id);
                        const raw = generalInfo[def.field] ?? '';
                        return (
                            <div key={def.id} data-testid={`objective-${def.id}`} data-met={o.met == null ? 'none' : String(o.met)} className={rowCls(o)} style={{ gridTemplateColumns: DEFAULT_COLS }}>
                                <div className="flex justify-center">{toggle(o)}</div>
                                <div className="flex items-center text-sm font-medium text-gray-800">{o.label}<Tooltip tip={INDICATOR_TIPS[def.id]} /></div>
                                <div className="text-xs text-gray-500">{dirText(o.dir)}</div>
                                <div className="flex items-center justify-end gap-1">
                                    <input type="text" inputMode="decimal" aria-label={`Valeur de l'objectif ${o.label}`} value={raw} placeholder={def.suggestion != null ? `ex. ${formatNumber(def.suggestion, 0)}` : 'ex. 40'}
                                        onChange={(e) => onUpdateGeneralInfo(def.field, e.target.value)} className={`${inputCls(invalidValue(raw, o.unit))} w-20 placeholder-gray-300`} />
                                    <span className="text-sm text-gray-500 w-3">{o.unit}</span>
                                </div>
                                <div className="pl-3">{current(o)}</div>
                                <div><StatusCell o={o} /></div>
                            </div>
                        );
                    })}
                </div>

                <h4 className="text-xs font-semibold text-gray-500 uppercase mt-5 mb-2 flex items-center">Objectifs sur mesure ({customs.length} sur {MAX_CUSTOM_OBJECTIVES})<Tooltip tip="obj.surMesure" /></h4>
                {customs.length > 0 && (
                    <div className={headCls} style={{ gridTemplateColumns: CUSTOM_COLS }} aria-hidden="true">
                        <span /><span>Nom (facultatif)</span><span>Indicateur</span><span>Sujet</span><span>Sens</span><span className="flex items-center justify-center gap-1"><span className="w-20 text-center">Valeur</span><span className="w-8" /></span><span className="pl-3">Actuel</span><span>État</span>
                    </div>
                )}
                <div className="space-y-1" data-testid="objectives-custom">
                    {customs.length === 0 && <p className="text-sm text-gray-500 p-2">Aucun objectif sur mesure. Choisissez un indicateur (au besoin, un sujet précis&nbsp;: un ingrédient, un poste, un canal…), un sens et une valeur.</p>}
                    {customs.map(c => {
                        const o = list.find(x => x.key === c.id);
                        if (!o) return null;
                        return (
                            <div key={c.id} data-testid={`objective-${c.id}`} data-met={o.met == null ? 'none' : String(o.met)} className={rowCls(o)} style={{ gridTemplateColumns: CUSTOM_COLS }}>
                                <div className="flex justify-center">{toggle(o)}</div>
                                <input type="text" aria-label="Nom de l'objectif" value={c.name || ''} placeholder="Nom (facultatif)" onChange={(e) => patchCustom(c.id, { name: e.target.value })} className="w-full min-w-0 p-1.5 text-sm border border-gray-300 rounded-md placeholder-gray-300" />
                                <div className="flex items-center min-w-0">
                                    <select aria-label="Indicateur" value={c.indicator} onChange={(e) => changeIndicator(c.id, e.target.value)} className="w-full min-w-0 p-1.5 text-sm border border-gray-300 rounded-md">
                                        {/* Un ancien objectif sur mesure bâti sur un des neuf indicateurs par défaut garde son choix, même s'il n'est plus proposé. */}
                                        {!INDICATOR_GROUPS.some(g => g.ids.includes(c.indicator)) && <option value={c.indicator}>{INDICATORS[c.indicator].label}</option>}
                                        {INDICATOR_GROUPS.map(g => (
                                            <optgroup key={g.label} label={g.label}>
                                                {g.ids.map(id => <option key={id} value={id}>{INDICATORS[id].label}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <Tooltip tip={INDICATOR_TIPS[c.indicator]} />
                                </div>
                                {INDICATORS[c.indicator].entity ? (
                                    <select aria-label="Sujet de l'objectif" value={c.subject ?? ''} onChange={(e) => patchCustom(c.id, { subject: e.target.value })} className="w-full min-w-0 p-1.5 text-sm border border-gray-300 rounded-md">
                                        {!subjectsOf(ctx, c.indicator).some(x => x.id === String(c.subject ?? '')) && <option value={c.subject ?? ''}>{c.subject ? 'Introuvable' : 'Choisir…'}</option>}
                                        {subjectsOf(ctx, c.indicator).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                                    </select>
                                ) : <span className="text-xs text-gray-400">Toute l'entreprise</span>}
                                <select aria-label="Sens de l'objectif" value={c.dir === 'min' ? 'min' : 'max'} onChange={(e) => patchCustom(c.id, { dir: e.target.value })} className="w-full p-1.5 text-sm border border-gray-300 rounded-md">
                                    <option value="max">au plus</option>
                                    <option value="min">au moins</option>
                                </select>
                                <div className="flex items-center justify-end gap-1">
                                    <input type="text" inputMode="decimal" aria-label="Valeur de l'objectif" value={c.value ?? ''} onChange={(e) => patchCustom(c.id, { value: e.target.value })} className={`${inputCls(invalidValue(c.value, o.unit))} w-20`} />
                                    <span className="text-sm text-gray-500 w-8 text-left">{unitSuffix(o.unit)}</span>
                                </div>
                                <div className="pl-3">{current(o)}</div>
                                <div className="flex items-center justify-between gap-1">
                                    <StatusCell o={o} />
                                    <button type="button" onClick={() => removeCustom(c.id)} aria-label="Supprimer l'objectif" title="Supprimer l'objectif" className="text-red-500 hover:text-red-700 p-1 rounded-full shrink-0"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <button type="button" onClick={addCustom} disabled={customs.length >= MAX_CUSTOM_OBJECTIVES} className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        <PlusCircle size={14} className="mr-1" />Ajouter un objectif sur mesure
                    </button>
                    {customs.length >= MAX_CUSTOM_OBJECTIVES && <span className="text-xs text-gray-500">Maximum atteint ({MAX_CUSTOM_OBJECTIVES} objectifs sur mesure).</span>}
                </div>

                <div className="mt-6 flex justify-end">
                    <button type="button" className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700" onClick={onClose}>Terminé</button>
                </div>
            </div>
        </div>
    );
};

export const ObjectivesModal = ({ isOpen, onClose }) => (isOpen ? <ObjectivesBody onClose={onClose} /> : null);
