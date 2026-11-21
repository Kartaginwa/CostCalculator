import React from 'react';
import { formatNumber } from '../../utils.js';
import { Tooltip } from '../../components/common.jsx';
import { useProject } from '../../state/ProjectContext.jsx';

// Rapport de productivité et charge de travail par activité (extraits le 21/11 de l'onglet Main-d'œuvre : l'onglet ne garde que la saisie des
// postes et des employés, l'analyse vit dans Rapport et suivi → Main-d'œuvre). Données : `generalInfo.productivityReport` (App.jsx).
export const LaborReport = () => {
    const { generalInfo } = useProject();
    const productivityReport = generalInfo.productivityReport;
    return (
        <div className="space-y-8">
            <div id="tutorial-section-labor-rapport">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Rapport de productivité pour la période</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Poste</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                    <div className="flex items-center">Heures Productives Attendues<Tooltip tip="mo.attendues" /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                    <div className="flex items-center">Heures Productives Réelles<Tooltip tip="mo.reelles" /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                    <div className="flex items-center">Différence (h)<Tooltip tip="mo.difference" /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                    <div className="flex items-center">Taux d'Utilisation (%)<Tooltip tip="mo.utilisation" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {productivityReport.rows.map(row => (
                                <tr key={row.postName}>
                                    <td className="px-4 py-2 font-medium">{row.postName}</td>
                                    <td className="px-4 py-2">{formatNumber(row.expected, 2)} h</td>
                                    <td className="px-4 py-2">{formatNumber(row.actual, 2)} h</td>
                                    <td className="px-4 py-2">{formatNumber(row.difference, 2)} h</td>
                                    <td className="px-4 py-2">{formatNumber(row.utilization, 2)} %</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td className="px-4 py-2 text-left">Total</td>
                                <td className="px-4 py-2">{formatNumber(productivityReport.totals.expected, 2)} h</td>
                                <td className="px-4 py-2">{formatNumber(productivityReport.totals.actual, 2)} h</td>
                                <td className="px-4 py-2">{formatNumber(productivityReport.totals.difference, 2)} h</td>
                                <td className="px-4 py-2">{formatNumber(productivityReport.totals.utilization, 2)} %</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Charge de travail par activité (ex-« Capacité de production par activité », renommée le 21/11 : le tableau montre où part le temps de
                l'équipe, pas une capacité — aucune capacité disponible n'y est comparée). Pas de « heures attendues » par activité : un poste ou
                un employé n'est pas rattaché à une seule activité. Seulement la part des heures de main-d'œuvre réellement nécessaires que
                CHAQUE activité consomme, du total. */}
            {productivityReport.byActivity && productivityReport.byActivity.length > 0 && (
                <div id="tutorial-section-labor-charge">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                        Charge de travail par activité
                        <Tooltip tip="mo.charge" />
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Activité</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Heures Productives Réelles<Tooltip tip="mo.chargeHeures" /></div></th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Part du total<Tooltip tip="mo.chargePart" /></div></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {productivityReport.byActivity.map(row => (
                                    <tr key={row.activityId}>
                                        <td className="px-4 py-2 font-medium">{row.activityName}</td>
                                        <td className="px-4 py-2">{formatNumber(row.actual, 2)} h</td>
                                        <td className="px-4 py-2">{formatNumber(row.sharePercent, 2)} %</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
