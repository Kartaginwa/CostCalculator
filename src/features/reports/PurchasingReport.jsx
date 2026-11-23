import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { formatCurrency, formatNumber, parseLocaleNumber } from '../../utils.js';
import { Tooltip, Pagination } from '../../components/common.jsx';
import { useSessionState } from '../../ui-utils.jsx';
import { computeProviderShares } from '../../engine/laborReport.js';
import { ObjectiveBadge } from '../../components/ObjectiveBadge.jsx';

// Rapport d'achats et perte stock pour la période, commun aux ingrédients et aux emballages (extrait le 21/11 des onglets Ingrédients et
// Emballage ; refondu au lot 2). Données : analysisData.js (computePurchasingAndAbc).
// « Perte stock » : la quantité à acheter EN PLUS pour compenser la perte au stockage et à la manutention (taux de perte du catalogue × quantité
// requise par vos ventes). Elle est prévue, jamais mesurée — la perte réelle se lit dans la Réconciliation réel / théorique.
// Deux tableaux : la part de chaque fournisseur dans les achats (dépendance), puis UN SEUL détail triable, filtrable par fournisseur et paginé
// (avant : un bloc par fournisseur, caché par défaut). Tri par défaut : coût de la perte stock décroissant (les pertes les plus coûteuses en haut).
const COLUMNS = (itemLabel) => [
    { key: 'name', label: itemLabel, align: 'left' },
    { key: 'provider', label: 'Fournisseur', align: 'left' },
    { key: 'totalQuantity', label: 'Qté nette', align: 'right', tip: "rapport.qteNette" },
    { key: 'lossPercent', label: 'Taux perte stock', align: 'right' },
    { key: 'purchaseCost', label: 'Coût net', align: 'right', tip: "rapport.coutNet" },
    { key: 'lossQuantity', label: 'Qté perte stock', align: 'right', tip: "rapport.qtePerteStock" },
    { key: 'lossCost', label: 'Coût perte stock', align: 'right', tip: "rapport.coutPerteStock" },
    { key: 'totalCost', label: 'Achat requis', align: 'right', tip: "rapport.achatRequis" },
];

export const PurchasingReport = ({ id, report, itemLabel, selectId, memoryKey, itemsPerPage, onItemsPerPageChange }) => {
    const [filterProvider, setFilterProvider] = useSessionState(memoryKey, 'all');
    const [sort, setSort] = useSessionState(`${memoryKey}.sort`, { key: 'lossCost', direction: 'descending' });
    const [page, setPage] = useState(1);

    const shares = useMemo(() => computeProviderShares(report), [report]);
    const providers = useMemo(() => Object.keys(report.groupedByProvider).sort(), [report]);
    const items = useMemo(() => {
        const rows = [];
        Object.entries(report.groupedByProvider).forEach(([provider, group]) => {
            group.items.forEach(item => rows.push({ ...item, provider, lossPercent: parseLocaleNumber(item.lossPercentage) || 0 }));
        });
        return rows;
    }, [report]);

    const filtered = useMemo(() => {
        const rows = filterProvider === 'all' ? items : items.filter(r => r.provider === filterProvider);
        const dir = sort.direction === 'ascending' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const av = a[sort.key], bv = b[sort.key];
            if (typeof av === 'string') return dir * av.localeCompare(bv, 'fr', { sensitivity: 'base' });
            return dir * ((av || 0) - (bv || 0));
        });
    }, [items, filterProvider, sort]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.min(page, pageCount);
    const displayed = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const requestSort = (key) => {
        setSort(prev => (prev.key === key && prev.direction === 'descending' ? { key, direction: 'ascending' } : { key, direction: 'descending' }));
        setPage(1);
    };
    const sortIcon = (key) => (sort.key !== key ? <ArrowUpDown size={14} className="ml-1 text-gray-400" /> : <span className="ml-1">{sort.direction === 'ascending' ? '▲' : '▼'}</span>);
    const th = 'px-3 py-2 text-xs font-medium text-gray-500';

    return (
        <div id={id} className="mt-2">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">Rapport d'achats et perte stock pour la période<Tooltip tip="rapport.perteStock" /></h2>
            </div>
            <p className="text-sm font-medium text-gray-500">Totaux — tous les fournisseurs</p>
            <div className="mt-2 p-4 bg-blue-100 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <h3 className="text-lg font-semibold text-blue-800">Coût net total (production)</h3>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(report.grandTotal.purchase)} $</p>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-red-800 flex items-center justify-center">Coût total de la perte stock<Tooltip tip="rapport.perteStock" /></h3>
                    <p className="text-2xl font-bold text-red-900 flex items-center justify-center">{formatCurrency(report.grandTotal.loss)} ${itemLabel === 'Ingrédient' && report.grandTotal.total > 0 && <ObjectiveBadge id="perteStock" value={(report.grandTotal.loss / report.grandTotal.total) * 100} />}</p>
                </div>
                <div className="md:col-span-1">
                    <h3 className="text-lg font-semibold text-gray-800">Coût d'Achat Total Requis</h3>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.grandTotal.total)} $</p>
                </div>
            </div>

            {shares.rows.length > 0 && (
                <div data-testid="provider-shares" className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center">Achats par fournisseur<Tooltip tip="rapport.partAchats" /></h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className={`${th} text-left`}>Fournisseur</th>
                                        <th className={`${th} text-right`}>Coût d'achat requis</th>
                                        <th className={`${th} text-left`} style={{ minWidth: 240 }}><span className="inline-flex items-center">Part des achats<Tooltip tip="rapport.partAchats" /></span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {shares.rows.map(r => (
                                        <tr key={r.provider}>
                                            <td className="px-4 py-1.5 font-medium">{r.provider}</td>
                                            <td className="px-4 py-1.5 text-right">{formatCurrency(r.total)} $</td>
                                            <td className="px-4 py-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2.5 bg-gray-200 rounded overflow-hidden">
                                                        <div className={`h-2.5 rounded ${r.isDependent ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${(r.share || 0) * 100}%` }} />
                                                    </div>
                                                    <span className="w-12 text-right">{formatNumber((r.share || 0) * 100, 0)} %</span>
                                                    <span className="w-20 text-xs font-semibold text-orange-600 whitespace-nowrap">{r.isDependent ? 'dépendance' : ''}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td className="px-4 py-1.5">Total</td>
                                        <td className="px-4 py-1.5 text-right">{formatCurrency(shares.total)} $</td>
                                        <td className="px-4 py-1.5 text-right">100 %</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Détail par {itemLabel.toLowerCase()}</h3>
                <div className="mb-3 max-w-xs">
                    <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">Fournisseur</label>
                    <select
                        id={selectId}
                        value={filterProvider}
                        onChange={e => { setFilterProvider(e.target.value); setPage(1); }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                        <option value="all">Tous les fournisseurs</option>
                        {providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}
                    </select>
                </div>
                <div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    {COLUMNS(itemLabel).map(col => (
                                        <th key={col.key} className={`${th} ${col.align === 'left' ? 'text-left' : 'text-right'} whitespace-nowrap`}>
                                            <span className={`inline-flex items-center ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                                <button type="button" onClick={() => requestSort(col.key)} className="inline-flex items-center hover:text-gray-800">
                                                    {col.label}{sortIcon(col.key)}
                                                </button>
                                                {col.tip && <Tooltip tip={col.tip} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayed.map(item => (
                                    <tr key={`${item.provider}-${item.id}`}>
                                        <td className="px-3 py-1.5 font-medium">{item.name}</td>
                                        <td className="px-3 py-1.5 text-gray-600">{item.provider}</td>
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(item.totalQuantity, 2)} {item.unit}</td>
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(item.lossPercent, 1)} %</td>
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(item.purchaseCost)} $</td>
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(item.lossQuantity, 2)} {item.unit}</td>
                                        <td className={`px-3 py-1.5 text-right whitespace-nowrap ${item.lossCost > 0 ? 'text-red-600' : ''}`}>{formatCurrency(item.lossCost)} $</td>
                                        <td className="px-3 py-1.5 text-right font-bold whitespace-nowrap">{formatCurrency(item.totalCost)} $</td>
                                    </tr>
                                ))}
                                {displayed.length === 0 && (
                                    <tr><td colSpan={COLUMNS(itemLabel).length} className="px-4 py-6 text-center text-sm text-gray-500">Aucune quantité à acheter pour la période : saisissez des volumes de vente dans Paramètres → Produits et SKUs.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination totalItems={filtered.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setPage} onItemsPerPageChange={onItemsPerPageChange} />
                </div>
            </div>
        </div>
    );
};
