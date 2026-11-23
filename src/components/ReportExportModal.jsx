// Fenêtre d'export du rapport PDF (phase 6 de la refonte de l'export, 22/11). Remplace l'ancienne fenêtre « Options du Rapport PDF » : titre, « présenté à »,
// chapitres (grisés, avec la raison, quand ils n'ont pas de données), commentaire de la direction par chapitre (imprimé seulement s'il est saisi), et la case
// des salaires individuels. Disposition « liste à gauche, détail à droite » : les huit chapitres restent visibles, celui qu'on édite occupe le panneau.
import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEscapeKey } from '../ui-utils.jsx';
import { Tooltip } from './common.jsx';
import { CHAPTERS } from '../reports/report/strings.js';
import { COMMENTABLE_CHAPTER_IDS, MAX_COMMENT_LENGTH, MAX_TITLE_LENGTH, REPORT_CHAPTER_IDS } from '../state/reportOptions.js';

// Le contenu n'existe que pendant que la fenêtre est ouverte : chaque ouverture repart des choix enregistrés dans le projet (aucun état à réinitialiser).
const ReportExportContent = ({ onClose, onConfirm, options, availability, period, busy, defaultTitle, defaultAudience }) => {
    useEscapeKey(!busy, onClose);
    const [draft, setDraft] = useState(options);
    const [selectedId, setSelectedId] = useState('1');

    const unavailable = (id) => (availability && availability[id]) || null;
    const checked = (id) => draft.chapters.includes(id) && !unavailable(id);
    const chosen = REPORT_CHAPTER_IDS.filter(checked);
    const toggle = (id) => setDraft(d => ({ ...d, chapters: d.chapters.includes(id) ? d.chapters.filter(x => x !== id) : REPORT_CHAPTER_IDS.filter(x => x === id || d.chapters.includes(x)) }));
    const setComment = (id, text) => setDraft(d => ({ ...d, comments: { ...d.comments, [id]: text.slice(0, MAX_COMMENT_LENGTH) } }));
    const available = REPORT_CHAPTER_IDS.filter(id => !unavailable(id));
    const allChosen = available.every(checked);
    const selected = CHAPTERS.find(c => c.id === selectedId) || CHAPTERS[0];
    const commentable = COMMENTABLE_CHAPTER_IDS.includes(selected.id);
    const commentText = draft.comments[selected.id] || '';
    const hasComment = (id) => !!(draft.comments[id] || '').trim();

    const confirm = () => onConfirm({ ...draft, chapters: chosen });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true" aria-labelledby="report-export-title">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
                <div className="px-6 pt-5 pb-3 border-b">
                    <h3 id="report-export-title" className="text-lg font-medium text-gray-900">Exporter le rapport PDF</h3>
                    <p className="text-xs text-gray-500 mt-1">Choisissez les chapitres à inclure. Ce que vous saisissez ici est enregistré avec le projet.</p>
                </div>

                <div className="px-6 py-4 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="reportTitle" className="block text-sm font-medium text-gray-700">Titre du rapport</label>
                            <input type="text" id="reportTitle" value={draft.title} maxLength={MAX_TITLE_LENGTH} placeholder={defaultTitle}
                                onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} className="mt-1 w-full p-2 border rounded-md border-gray-300 text-sm" />
                        </div>
                        <div>
                            <label htmlFor="reportPresentedTo" className="block text-sm font-medium text-gray-700">Présenté à</label>
                            <input type="text" id="reportPresentedTo" value={draft.presentedTo} maxLength={MAX_TITLE_LENGTH} placeholder={defaultAudience}
                                onChange={(e) => setDraft(d => ({ ...d, presentedTo: e.target.value }))} className="mt-1 w-full p-2 border rounded-md border-gray-300 text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 inline-flex items-center">Chapitres<Tooltip tip="export.chapitres" /></span>
                                <button type="button" className="text-xs text-blue-600 hover:text-blue-800"
                                    onClick={() => setDraft(d => ({ ...d, chapters: allChosen ? [] : [...REPORT_CHAPTER_IDS] }))}>
                                    {allChosen ? 'Tout décocher' : 'Tout cocher'}
                                </button>
                            </div>
                            <ul className="border rounded-md divide-y" aria-label="Chapitres du rapport">
                                {CHAPTERS.map(c => {
                                    const reason = unavailable(c.id), isSel = c.id === selected.id;
                                    return (
                                        <li key={c.id} className={`flex items-start gap-2 px-3 py-2 ${isSel ? 'bg-blue-50' : ''} ${reason ? 'opacity-60' : ''}`}>
                                            <input type="checkbox" id={`chap-${c.id}`} className="mt-1" checked={checked(c.id)} disabled={!!reason} onChange={() => toggle(c.id)}
                                                aria-label={`Inclure ${c.id === 'A' ? 'les annexes' : `le chapitre ${c.n}`}`} />
                                            <button type="button" className="text-left flex-1 min-w-0" onClick={() => setSelectedId(c.id)} aria-current={isSel ? 'true' : undefined}>
                                                <span className="block text-sm font-medium text-gray-800 truncate">{c.id === 'A' ? 'Annexes' : `${c.n}. ${c.title}`}</span>
                                                {reason && <span className="block text-xs text-gray-500">Données manquantes</span>}
                                                {!reason && hasComment(c.id) && <span className="block text-xs text-blue-700">Commentaire saisi</span>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="md:col-span-3 border rounded-md p-4 bg-gray-50 min-h-[14rem]" aria-live="polite">
                            <h4 className="text-sm font-semibold text-gray-800">{selected.id === 'A' ? 'Annexes et méthodes' : `${selected.n}. ${selected.title}`}</h4>
                            <p className="text-xs text-gray-600 mt-1">{selected.question}</p>
                            <p className="text-xs text-gray-500 mt-1">Onglet : {selected.tab}</p>
                            {unavailable(selected.id) ? (
                                <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 flex gap-2"><AlertTriangle className="h-4 w-4 flex-shrink-0" />{unavailable(selected.id)}</p>
                            ) : commentable ? (
                                <div className="mt-3">
                                    <label htmlFor="reportComment" className="block text-sm font-medium text-gray-700">Commentaire de la direction <span className="font-normal text-gray-500">(facultatif)</span><Tooltip tip="export.commentaire" /></label>
                                    <textarea id="reportComment" rows={5} value={commentText} onChange={(e) => setComment(selected.id, e.target.value)}
                                        className="mt-1 w-full p-2 border rounded-md border-gray-300 text-sm" placeholder="Votre lecture de ces résultats, imprimée à la fin du chapitre." />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>Sans texte, rien n’est imprimé : aucune case vide.</span>
                                        <span>{commentText.length} / {MAX_COMMENT_LENGTH}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3">
                                    <label className="flex items-start gap-2 text-sm text-gray-800">
                                        <input type="checkbox" className="mt-1" checked={draft.includeSalaries} onChange={(e) => setDraft(d => ({ ...d, includeSalaries: e.target.checked }))} />
                                        <span>Inclure les salaires individuels (annexe C)<Tooltip tip="export.salaires" /></span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1 ml-6">Décoché par défaut : un rapport transmis à un banquier ou à un investisseur ne doit pas contenir les salaires sans que vous l’ayez voulu.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {!period && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 flex gap-2" role="note">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>Les dates de début et de fin de la période ne sont pas saisies (État des résultats) : la période ne sera pas imprimée dans le rapport.</span>
                        </p>
                    )}
                </div>

                <div className="px-6 py-3 border-t flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                    {busy && <span className="sm:mr-auto text-xs text-gray-600 inline-flex items-center gap-2" role="status"><Loader2 className="h-4 w-4 animate-spin" />Composition du rapport en cours…</span>}
                    <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Annuler</button>
                    <button type="button" disabled={busy || chosen.length === 0} onClick={confirm}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Générer le PDF</button>
                </div>
            </div>
        </div>
    );
};

export const ReportExportModal = (props) => (props.isOpen ? <ReportExportContent {...props} /> : null);
