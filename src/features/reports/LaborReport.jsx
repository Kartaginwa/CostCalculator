import React, { useMemo, useState } from 'react';
import { formatCurrency, formatNumber } from '../../utils.js';
import { Tooltip, Pagination } from '../../components/common.jsx';
import { useSessionState } from '../../ui-utils.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import {
    computeLaborCascade, computeProductLaborProfitability, computeActivityLaborRatios, computeGrowthMargin,
} from '../../engine/laborReport.js';
import { SortableTh, sortRows, nextSort } from './tableSort.jsx';

// Rapports de main-d'œuvre de Rapport et suivi → Main-d'œuvre (extraits le 21/11 de l'onglet Main-d'œuvre, qui ne garde que la saisie ; enrichis au lot 2) :
//   1. rapport de productivité par poste, paie non utilisée, marge de croissance ;
//   2. où va la paie (heures payées → heures utilisées) et coût réel d'une heure productive ;
//   3. charge de travail par activité (+ revenu et bénéfice brut par heure) ;
//   4. rentabilité de l'heure de main-d'œuvre, par produit.
// Les précisions (formules, exclusions, limites d'une estimation) vivent dans les INFOBULLES, jamais en notes dans la page. Tous les tableaux se trient
// par colonne (tableSort.jsx). Les produits de revente (aucune main-d'œuvre) sont exclus des ratios par heure. Calculs : engine/laborReport.js.
const td = 'px-4 py-1.5';

const CascadeCard = ({ color, label, tip, hours, cost, hoursShare, payShare }) => (
    <div className="p-3 bg-white rounded-lg shadow">
        <div className="text-sm text-gray-500 flex items-center"><span className={`inline-block w-3 h-3 rounded-sm mr-2 ${color}`} />{label}<Tooltip tip={tip} /></div>
        <div className="text-xl font-bold text-gray-800">{formatNumber(hours, 1)} h · {formatCurrency(cost)} $</div>
        <div className="text-xs text-gray-500">{formatNumber(hoursShare * 100, 1)} % des heures · {formatNumber(payShare * 100, 1)} % de la paie</div>
    </div>
);

// Une estimation s'affiche arrondie à la centaine, avec le séparateur de milliers de l'application (ex. 8 000 $).
const roundedDollars = (value) => (Math.round(value / 100) * 100).toLocaleString('fr-CA', { maximumFractionDigits: 0 });

export const LaborReport = ({ itemsPerPage, onItemsPerPageChange }) => {
    const { generalInfo, laborDatabase, analysisData, productionActivities } = useProject();
    const productivityReport = generalInfo.productivityReport;
    const [productPage, setProductPage] = useState(1);
    const [postSort, setPostSort] = useSessionState('labor.sort.posts', { key: null, direction: 'ascending' });
    const [activitySort, setActivitySort] = useSessionState('labor.sort.activities', { key: null, direction: 'ascending' });
    const [productSort, setProductSort] = useSessionState('labor.sort.products', { key: 'grossProfitPerHour', direction: 'descending' });

    const cascade = useMemo(() => computeLaborCascade(laborDatabase, productivityReport.rows), [laborDatabase, productivityReport.rows]);
    const productRows = useMemo(
        () => computeProductLaborProfitability(analysisData.activeProducts, generalInfo.laborHoursByFormat),
        [analysisData.activeProducts, generalInfo.laborHoursByFormat]
    );
    const activityRatios = useMemo(() => {
        const hoursByActivity = Object.fromEntries((productivityReport.byActivity || []).map(r => [r.activityId, r.actual]));
        return computeActivityLaborRatios(analysisData.activeProducts, hoursByActivity, productionActivities)
            .filter(r => (productivityReport.byActivity || []).some(a => a.activityId === r.activityId));
    }, [analysisData.activeProducts, productivityReport.byActivity, productionActivities]);
    const growth = useMemo(() => computeGrowthMargin(cascade.freeProductionHours, productRows), [cascade.freeProductionHours, productRows]);

    const sortedPosts = useMemo(() => sortRows(productivityReport.rows, postSort), [productivityReport.rows, postSort]);
    const sortedActivities = useMemo(() => sortRows(activityRatios, activitySort), [activityRatios, activitySort]);
    // Classement des produits : par défaut du plus rentable au moins rentable par heure ; sans ratio (revente, sans heures) toujours en fin de liste.
    const sortedProducts = useMemo(() => sortRows(productRows, productSort), [productRows, productSort]);
    const pageCount = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
    const page = Math.min(productPage, pageCount);
    const displayedProducts = sortedProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const hasPayroll = cascade.payroll > 0;

    const onPostSort = (key, isText) => setPostSort(prev => nextSort(prev, key, isText));
    const onActivitySort = (key, isText) => setActivitySort(prev => nextSort(prev, key, isText));
    const onProductSort = (key, isText) => { setProductSort(prev => nextSort(prev, key, isText)); setProductPage(1); };

    return (
        <div className="space-y-8">
            <div id="tutorial-section-labor-rapport">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Rapport de productivité pour la période</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <SortableTh label="Poste" sortKey="postName" sort={postSort} onSort={onPostSort} isText />
                                <SortableTh label="Heures Productives Attendues" sortKey="expected" sort={postSort} onSort={onPostSort} tip="mo.attendues" />
                                <SortableTh label="Heures Productives Réelles" sortKey="actual" sort={postSort} onSort={onPostSort} tip="mo.reelles" />
                                <SortableTh label="Différence (h)" sortKey="difference" sort={postSort} onSort={onPostSort} tip="mo.difference" />
                                <SortableTh label="Taux d'Utilisation (%)" sortKey="utilization" sort={postSort} onSort={onPostSort} tip="mo.utilisation" />
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedPosts.map(row => (
                                <tr key={row.postName}>
                                    <td className={`${td} font-medium`}>{row.postName}</td>
                                    <td className={td}>{formatNumber(row.expected, 2)} h</td>
                                    <td className={td}>{formatNumber(row.actual, 2)} h</td>
                                    <td className={td}>{formatNumber(row.difference, 2)} h</td>
                                    <td className={td}>{formatNumber(row.utilization, 2)} %</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td className={`${td} text-left`}>Total</td>
                                <td className={td}>{formatNumber(productivityReport.totals.expected, 2)} h</td>
                                <td className={td}>{formatNumber(productivityReport.totals.actual, 2)} h</td>
                                <td className={td}>{formatNumber(productivityReport.totals.difference, 2)} h</td>
                                <td className={td}>{formatNumber(productivityReport.totals.utilization, 2)} %</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {hasPayroll && (
                    <div id="tutorial-section-labor-paie" className="mt-4 p-4 bg-blue-100 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <h3 className="text-lg font-semibold text-blue-800">Paie totale du personnel</h3>
                            <p className="text-2xl font-bold text-blue-900">{formatCurrency(cascade.payroll)} $</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-red-800 flex items-center justify-center">Paie non utilisée<Tooltip tip="mo.paieNonUtilisee" /></h3>
                            <p className="text-2xl font-bold text-red-900">{formatCurrency(cascade.unusedPay)} $</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Part de la paie non utilisée</h3>
                            <p className="text-2xl font-bold text-gray-900">{formatNumber(cascade.unusedShare * 100, 1)} %</p>
                        </div>
                    </div>
                )}

                {growth && (
                    <div id="tutorial-section-labor-croissance" className="mt-6 p-6 bg-gray-50 rounded-xl shadow-inner">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">Marge de croissance<Tooltip tip="mo.croissance" /></h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-white rounded-lg shadow">
                                <div className="text-sm text-gray-500">Heures productives libres</div>
                                <p className="text-3xl font-bold text-blue-600">{formatNumber(growth.freeHours, 1)} h</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg shadow">
                                <div className="text-sm text-gray-500">Ventes additionnelles possibles</div>
                                <p className="text-3xl font-bold text-blue-600">{roundedDollars(growth.additionalRevenue)} $</p>
                                <p className="text-xs text-gray-500 mt-1">{formatCurrency(growth.revenuePerHour)} $ de revenu par heure</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg shadow">
                                <div className="text-sm text-gray-500">Bénéfice brut additionnel</div>
                                <p className="text-3xl font-bold text-blue-600">{roundedDollars(growth.additionalGrossProfit)} $</p>
                                <p className="text-xs text-gray-500 mt-1">{formatCurrency(growth.grossProfitPerHour)} $ de bénéfice brut par heure</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {hasPayroll && (
                <div id="tutorial-section-labor-cascade" className="p-6 bg-gray-50 rounded-xl shadow-inner">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Où va la paie</h2>
                    <div className="flex h-8 rounded overflow-hidden" role="img" aria-label="Répartition des heures payées">
                        <div className="bg-blue-500" style={{ width: `${(cascade.usedHours / cascade.paidHours) * 100}%` }} title="Heures utilisées à produire" />
                        <div className="bg-amber-400" style={{ width: `${(cascade.idleHours / cascade.paidHours) * 100}%` }} title="Heures productives inutilisées" />
                        <div className="bg-gray-400" style={{ width: `${(cascade.nonProductiveHours / cascade.paidHours) * 100}%` }} title="Heures non productives" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <CascadeCard color="bg-blue-500" label="Heures utilisées à produire" tip="mo.cascadeUtilisees" hours={cascade.usedHours} cost={cascade.costUsed} hoursShare={cascade.usedHours / cascade.paidHours} payShare={cascade.costUsed / cascade.payroll} />
                        <CascadeCard color="bg-amber-400" label="Productives mais inutilisées" tip="mo.cascadeInutilisees" hours={cascade.idleHours} cost={cascade.costIdle} hoursShare={cascade.idleHours / cascade.paidHours} payShare={cascade.costIdle / cascade.payroll} />
                        <CascadeCard color="bg-gray-400" label="Non productives (prévues)" tip="mo.cascadeNonProductives" hours={cascade.nonProductiveHours} cost={cascade.costNonProductive} hoursShare={cascade.nonProductiveHours / cascade.paidHours} payShare={cascade.costNonProductive / cascade.payroll} />
                    </div>
                    {cascade.effectiveHourlyCost != null && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="p-4 bg-white rounded-lg shadow text-center">
                                <div className="text-sm text-gray-500 flex items-center justify-center">Coût réel d'une heure productive<Tooltip tip="mo.coutHeureReel" /></div>
                                <p className="text-3xl font-bold text-blue-600">{formatCurrency(cascade.effectiveHourlyCost)} $/h</p>
                                <p className="text-xs text-gray-500 mt-1">{formatNumber((cascade.effectiveHourlyCost / cascade.averageLoadedRate - 1) * 100, 0)} % de plus que le taux moyen chargé</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg shadow text-center">
                                <div className="text-sm text-gray-500 flex items-center justify-center">Taux horaire moyen chargé<Tooltip tip="mo.tauxHoraireMoyen" /></div>
                                <p className="text-3xl font-bold text-gray-700">{formatCurrency(cascade.averageLoadedRate)} $/h</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Charge de travail par activité (ex-« Capacité de production par activité », renommée le 21/11 : le tableau montre où part le temps de
                l'équipe, pas une capacité). Lot 2 : revenu et bénéfice brut par heure (produits de revente exclus, voir les infobulles). */}
            {sortedActivities.length > 0 && (
                <div id="tutorial-section-labor-charge">
                    <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center">
                        Charge de travail par activité
                        <Tooltip tip="mo.charge" />
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <SortableTh label="Activité" sortKey="activityName" sort={activitySort} onSort={onActivitySort} isText />
                                    <SortableTh label="Heures Productives Réelles" sortKey="hours" sort={activitySort} onSort={onActivitySort} tip="mo.chargeHeures" />
                                    <SortableTh label="Part du total" sortKey="sharePercent" sort={activitySort} onSort={onActivitySort} tip="mo.chargePart" />
                                    <SortableTh label="Revenu / heure" sortKey="revenuePerHour" sort={activitySort} onSort={onActivitySort} tip="mo.revenuHeure" />
                                    <SortableTh label="Bénéfice brut / heure" sortKey="grossProfitPerHour" sort={activitySort} onSort={onActivitySort} tip="mo.beneficeBrutHeure" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedActivities.map(row => (
                                    <tr key={row.activityId}>
                                        <td className={`${td} font-medium`}>{row.activityName}</td>
                                        <td className={td}>{formatNumber(row.hours, 2)} h</td>
                                        <td className={td}>{formatNumber(row.sharePercent, 2)} %</td>
                                        <td className={td}>{row.revenuePerHour != null ? `${formatCurrency(row.revenuePerHour)} $` : '—'}</td>
                                        <td className={`${td} font-semibold`}>{row.grossProfitPerHour != null ? `${formatCurrency(row.grossProfitPerHour)} $` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {sortedProducts.length > 0 && (
                <div id="tutorial-section-labor-produits">
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">Rentabilité de l'heure de main-d'œuvre, par produit</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <SortableTh label="Produit" sortKey="name" sort={productSort} onSort={onProductSort} isText />
                                    <SortableTh label="Heures de MO" sortKey="hours" sort={productSort} onSort={onProductSort} tip="mo.heuresProduit" />
                                    <SortableTh label="Bénéfice brut total" sortKey="grossProfit" sort={productSort} onSort={onProductSort} />
                                    <SortableTh label="Bénéfice brut / heure" sortKey="grossProfitPerHour" sort={productSort} onSort={onProductSort} tip="mo.beneficeBrutHeure" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedProducts.map(row => (
                                    <tr key={row.id}>
                                        <td className={`${td} font-medium`}>{row.name}</td>
                                        <td className={td}>{row.hours > 0 ? `${formatNumber(row.hours, 1)} h` : '—'}</td>
                                        <td className={td}>{formatCurrency(row.grossProfit)} $</td>
                                        <td className={`${td} font-semibold`}>
                                            {row.grossProfitPerHour != null ? `${formatCurrency(row.grossProfitPerHour)} $/h` : <span className="font-normal text-gray-500" title={row.isResale ? 'Produit de revente : aucune main-d\'œuvre' : 'Aucune heure de main-d\'œuvre pour ce produit'}>{row.isResale ? 'Revente' : '—'}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination totalItems={sortedProducts.length} itemsPerPage={itemsPerPage} currentPage={page} onPageChange={setProductPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
            )}
        </div>
    );
};
