import React from 'react';
import { formatCurrency, formatNumber } from '../../utils.js';
import { Tooltip } from '../../components/common.jsx';
import { useSessionState } from '../../ui-utils.jsx';

// Rapport d'achats et perte stock pour la période, commun aux ingrédients et aux emballages (extrait le 21/11 des onglets Ingrédients et
// Emballage, voir AbcAnalysis.jsx). Données : analysisData.js (computePurchasingAndAbc).
// « Perte stock » : la quantité à acheter EN PLUS pour compenser la perte au stockage et à la manutention (taux de perte du catalogue × quantité
// requise par vos ventes). Elle est prévue, jamais mesurée — la perte réelle se lit dans la Réconciliation réel / théorique.
// Les lignes n'ont plus d'id `ingredient-row-…` : l'id existait aussi dans le tableau de saisie (doublon dans le DOM).
export const PurchasingReport = ({ id, report, itemLabel, selectId, memoryKey }) => {
    const [filterProvider, setFilterProvider] = useSessionState(memoryKey, 'summary');
    const providers = Object.keys(report.groupedByProvider).sort();
    return (
        <div id={id} className="mt-2">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Rapport d'achats et perte stock pour la période</h2>
            </div>
            <p className="text-sm font-medium text-gray-500">Totaux — tous les fournisseurs</p>
            <div className="mt-2 p-4 bg-blue-100 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <h3 className="text-lg font-semibold text-blue-800">Coût net total (production)</h3>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(report.grandTotal.purchase)} $</p>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-red-800">Coût total de la perte stock</h3>
                    <p className="text-2xl font-bold text-red-900">{formatCurrency(report.grandTotal.loss)} $</p>
                </div>
                <div className="md:col-span-1">
                    <h3 className="text-lg font-semibold text-gray-800">Coût d'Achat Total Requis</h3>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.grandTotal.total)} $</p>
                </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
                <b>Perte stock</b> : quantité à acheter en plus pour compenser la perte au stockage et à la manutention (taux de perte du catalogue × quantité requise). Elle est prévue, pas mesurée.
            </p>
            <div className="mt-6 max-w-xs">
                <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">Détail par fournisseur</label>
                <select
                    id={selectId}
                    value={filterProvider}
                    onChange={e => setFilterProvider(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                >
                    <option value="summary">Totaux seulement</option>
                    <option value="all">Tous les fournisseurs</option>
                    {providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}
                </select>
            </div>

            <div className="space-y-6 mt-6">
                {Object.entries(report.groupedByProvider)
                    .filter(([provider]) => {
                        if (filterProvider === 'summary') return false;
                        if (filterProvider === 'all') return true;
                        return provider === filterProvider;
                    })
                    .map(([provider, data]) => (
                        <div key={provider} className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">{provider}</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{itemLabel}</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Qté nette (Production)<Tooltip tip="rapport.qteNette" /></div></th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Coût net (Production)<Tooltip tip="rapport.coutNet" /></div></th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Qté perte stock<Tooltip tip="rapport.qtePerteStock" /></div></th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Coût perte stock<Tooltip tip="rapport.coutPerteStock" /></div></th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"><div className="flex items-center">Coût d'achat requis<Tooltip tip="rapport.achatRequis" /></div></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                                <td className="px-4 py-2">{formatNumber(item.totalQuantity, 2)} {item.unit}</td>
                                                <td className="px-4 py-2">{formatCurrency(item.purchaseCost)} $</td>
                                                <td className="px-4 py-2">{formatNumber(item.lossQuantity, 2)} {item.unit}</td>
                                                <td className="px-4 py-2 text-red-600">{formatCurrency(item.lossCost)} $</td>
                                                <td className="px-4 py-2 font-bold">{formatCurrency(item.totalCost)} $</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr>
                                            <td colSpan="2" className="px-4 py-2 text-right text-gray-800">Sous-total</td>
                                            <td className="px-4 py-2 text-gray-800">{formatCurrency(data.totalPurchase)} $</td>
                                            <td className="px-4 py-2"></td>
                                            <td className="px-4 py-2 text-red-600">{formatCurrency(data.totalLoss)} $</td>
                                            <td className="px-4 py-2 text-gray-800">{formatCurrency(data.totalCost)} $</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};
