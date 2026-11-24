import React, { useMemo } from 'react';
import { formatCurrency, formatNumber } from '../../utils.js';
import { Tooltip } from '../../components/common.jsx';
import { computeActivityLaborRatios } from '../../engine/laborReport.js';

// Section « Main-d'œuvre » de Par activité (lot 2, 21/11) : ajoutée SOUS le tableau d'origine, qui reste intact (une colonne par activité, dans le même
// ordre que ce tableau : bénéfice net décroissant). Heures de main-d'œuvre réellement requises, part du total et bénéfice brut par heure (produits de
// revente exclus du bénéfice brut : ils n'ont aucune main-d'œuvre). Même mise en page que les tableaux Par SKU / Par activité (en-têtes de section grises).
export const ActivityLaborSection = ({ activitySummaries, activeProducts, productivityReport, productionActivities }) => {
    const columns = useMemo(() => {
        const hoursByActivity = Object.fromEntries((productivityReport?.byActivity || []).map(r => [r.activityId, r.actual]));
        const ratios = computeActivityLaborRatios(activeProducts, hoursByActivity, productionActivities);
        return [...activitySummaries]
            .sort((a, b) => b.margeNetteTotal - a.margeNetteTotal)
            .map(s => ratios.find(r => r.activityId === s.activityId))
            .filter(Boolean);
    }, [activitySummaries, activeProducts, productivityReport, productionActivities]);

    if (columns.length === 0) return null;
    const rowHead = 'px-4 py-2.5 text-left text-sm font-medium text-gray-600 sticky left-0 bg-inherit whitespace-nowrap';
    return (
        <div id="tutorial-section-summary-byactivity-mo" className="mt-8">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 sticky left-0 bg-gray-100">Activité</th>
                            {columns.map(c => <th key={c.activityId} className="px-4 py-2.5 text-center text-sm font-semibold text-gray-800 whitespace-nowrap">{c.activityName}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr><th colSpan={columns.length + 1} className="px-4 py-2 text-left text-xs font-bold italic tracking-wide text-gray-500 bg-gray-100">Main-d'œuvre</th></tr>
                        <tr>
                            <th className={rowHead}><span className="flex items-center">Heures de main-d'œuvre réelles<Tooltip tip="seg.heuresMo" /></span></th>
                            {columns.map(c => <td key={c.activityId} className="px-4 py-2.5 text-right text-gray-600">{formatNumber(c.hours, 2)} h</td>)}
                        </tr>
                        <tr>
                            <th className={rowHead}><span className="flex items-center">Part des heures<Tooltip tip="seg.partHeures" /></span></th>
                            {columns.map(c => <td key={c.activityId} className="px-4 py-2.5 text-right text-gray-600">{formatNumber(c.sharePercent, 2)}&nbsp;%</td>)}
                        </tr>
                        <tr className="bg-indigo-50">
                            <th className={rowHead}><span className="flex items-center">Bénéfice brut par heure de main-d'œuvre<Tooltip tip="seg.beneficeBrutHeure" /></span></th>
                            {columns.map(c => (
                                <td key={c.activityId} className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                    {c.grossProfitPerHour != null ? `${formatCurrency(c.grossProfitPerHour)}\u00A0$` : '—'}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
