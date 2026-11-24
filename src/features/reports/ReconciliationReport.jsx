import React, { useMemo } from 'react';
import { formatCurrency, formatNumber, sumLineAmounts, sumAmountsMap } from '../../utils.js';
import { Tooltip, EmptyState } from '../../components/common.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import { computeRealVsTheoreticalReconciliation } from '../../engine/analysisData.js';

// Réconciliation réel / théorique (extraite le 21/11 de l'État des résultats, dernière section : elle vit maintenant dans Rapport et suivi →
// Vue d'ensemble, sous la matrice Activité × Canal — les deux portent sur l'entreprise entière). Phase 4.4 : compare, à l'échelle de l'ENTREPRISE, le
// réel saisi (revenus et charges directes de l'État des résultats) au théorique du modèle de recettes. Un diagnostic, jamais un intrant de calcul.
// Une donnée absente reste absente : sans aucun chiffre réel saisi, un message remplace le tableau (jamais des zéros comparés au théorique).
export const ReconciliationReport = () => {
    const { revenueLines, directCostLines, analysisData, generalInfo, goToTab } = useProject();
    const totalRevenue = useMemo(() => (revenueLines || []).reduce((sum, line) => sum + sumAmountsMap(line.amounts), 0), [revenueLines]);
    const totalDirectCosts = useMemo(() => sumLineAmounts(directCostLines || []), [directCostLines]);
    const reconciliation = useMemo(
        () => computeRealVsTheoreticalReconciliation({
            totalRevenue, totalDirectCosts,
            activeProducts: analysisData.activeProducts, unitsSoldById: analysisData.unitsSoldById,
            menuRevenue: analysisData.menuRevenue, totalIndirects: generalInfo.totalIndirects,
        }),
        [totalRevenue, totalDirectCosts, analysisData.activeProducts, analysisData.unitsSoldById, analysisData.menuRevenue, generalInfo.totalIndirects]
    );
    const hasRealData = totalRevenue !== 0 || totalDirectCosts !== 0;

    return (
        <div id="tutorial-section-reconciliation" className="p-4 bg-gray-100 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    Réconciliation réel / théorique
                    <Tooltip tip="ff.reconciliation" />
                </h2>
                <button type="button" onClick={() => goToTab('income-statement')} className="text-sm text-blue-600 hover:text-blue-800 underline">Modifier les chiffres réels →</button>
            </div>
            {!hasRealData ? (
                <EmptyState message="Saisissez vos chiffres réels (revenus et charges directes) dans l'État des résultats pour les comparer à ce que prévoit votre modèle de recettes.">
                    <button onClick={() => goToTab('income-statement')} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">Aller à l'État des résultats</button>
                </EmptyState>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                    <span className="flex items-center justify-center">Poste<Tooltip tip="ff.recPoste" /></span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                    <span className="flex items-center justify-center">Réel ($)<Tooltip tip="ff.recReel" /></span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                    <span className="flex items-center justify-center">Théorique ($)<Tooltip tip="ff.recTheorique" /></span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                    <span className="flex items-center justify-center">Écart ($)<Tooltip tip="ff.recEcart" /></span>
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                    <span className="flex items-center justify-center">Écart (%)<Tooltip tip="ff.recEcartPct" /></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reconciliation.rows.map((row) => {
                                const isMarge = row.label === 'Bénéfice net';
                                return (
                                    <tr key={row.label} className={isMarge ? 'font-bold border-t-2 border-gray-300' : ''}>
                                        <td className="px-4 py-2">{row.label}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(row.real)}&nbsp;$</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(row.theoretical)}&nbsp;$</td>
                                        <td className="px-4 py-2 text-right">{row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff)}&nbsp;$</td>
                                        <td className="px-4 py-2 text-right">
                                            {row.diffPercent != null ? `${row.diffPercent >= 0 ? '+' : ''}${formatNumber((row.diffPercent * 100), 1)}\u00A0%` : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
