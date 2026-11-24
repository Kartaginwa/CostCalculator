// Tableau de volatilité des prix d'achat (ingrédients et emballages) du Rapport et suivi. Extrait de SummaryTable.jsx le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils.js';
import { useSessionState, useStateResetOnChange } from '../../ui-utils.jsx';
import { Tooltip, Pagination } from '../../components/common.jsx';

// Libellé et style du niveau de volatilité (faible / modérée / élevée).
const VOLATILITY_TIERS = {
    elevee: { label: 'élevée', className: 'text-red-700 font-semibold' },
    moderee: { label: 'modérée', className: 'text-orange-600 font-medium' },
    faible: { label: 'faible', className: 'text-gray-500' },
};

// Tableau de volatilité générique (Phase 6, 15/10) : extrait de l'ancien bloc « Volatilité des
// prix d'achat » (ingrédients seulement) pour le réutiliser tel quel sur l'emballage — même
// tri/filtre/pagination, même visuel (badge de palier).
export const VolatilityTable = ({ volatility, itemLabel, nameColumnLabel, filterPlaceholder, memoryKey }) => {
    const [sort, setSort] = useSessionState(`${memoryKey}.sort`, { key: 'amplitudePercent', direction: 'descending' });
    const [filterName, setFilterName] = useSessionState(`${memoryKey}.filterName`, '');
    const [filterProvider, setFilterProvider] = useSessionState(`${memoryKey}.filterProvider`, 'all');
    const [perPage, setPerPage] = useState(10);
    const [page, setPage] = useStateResetOnChange(1, [filterName, filterProvider, perPage]); // revient à la page 1 si un filtre change

    const providers = useMemo(
        () => ['all', ...[...new Set(volatility.list.map(v => v.provider).filter(Boolean))].sort()],
        [volatility]
    );
    const filtered = useMemo(() => {
        let list = volatility.list;
        if (filterName.trim()) {
            const q = filterName.toLowerCase();
            list = list.filter(v => (v.name || '').toLowerCase().includes(q));
        }
        if (filterProvider !== 'all') list = list.filter(v => v.provider === filterProvider);
        const dir = sort.direction === 'ascending' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sort.key], bv = b[sort.key];
            if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
            return ((av || 0) - (bv || 0)) * dir;
        });
    }, [volatility, filterName, filterProvider, sort]);
    const paged = useMemo(() => filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage), [filtered, page, perPage]);
    const requestSort = (key) => setSort(prev => ({
        key, direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending',
    }));

    if (!volatility.hasEnoughData) {
        return <p className="text-sm text-gray-500">Créez au moins 2 points de référence pour analyser la volatilité {itemLabel}.</p>;
    }

    const columns = [
        { key: 'name', label: nameColumnLabel, align: 'left' },
        { key: 'provider', label: 'Fournisseur', align: 'left' },
        { key: 'currentPrice', label: 'Prix actuel', align: 'right', tip: "vol.prixActuel" },
        { key: 'trendPercent', label: 'Tendance', align: 'right', tip: "vol.tendance" },
        { key: 'amplitudePercent', label: 'Volatilité (amplitude)', align: 'right', tip: "vol.amplitude" },
    ];

    return (
        <>
            <div className="flex flex-wrap gap-3 mb-3">
                <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder={filterPlaceholder}
                    className="p-2 border rounded-md text-sm w-56"
                />
                <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="p-2 border rounded-md text-sm w-56">
                    {providers.map(p => <option key={p} value={p}>{p === 'all' ? 'Tous les fournisseurs' : p}</option>)}
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 border-b">
                            {columns.map(col => (
                                <th key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                        <button onClick={() => requestSort(col.key)} className={`inline-flex items-center gap-1 hover:text-gray-800 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                            {col.label}
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${sort.key === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                                        </button>
                                        {col.tip && <Tooltip tip={col.tip} />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(v => {
                            const tier = VOLATILITY_TIERS[v.tier] || VOLATILITY_TIERS.faible;
                            return (
                                <tr key={v.id} className={`border-b border-gray-100 ${v.tier === 'elevee' ? 'bg-orange-50' : ''}`}>
                                    <td className="py-2 px-3">{v.name}</td>
                                    <td className="py-2 px-3 text-gray-500">{v.provider || '—'}</td>
                                    <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(v.currentPrice)} $</td>
                                    <td className={`py-2 px-3 text-right ${v.trendPercent > 0.5 ? 'text-red-600' : v.trendPercent < -0.5 ? 'text-green-600' : 'text-gray-500'}`}>
                                        {v.trendPercent > 0.5 ? '▲' : v.trendPercent < -0.5 ? '▼' : '→'} {formatNumber(Math.abs(v.trendPercent), 0)} %
                                    </td>
                                    <td className={`py-2 px-3 text-right ${tier.className}`}>
                                        {formatNumber(v.amplitudePercent, 0)} % · {tier.label}
                                    </td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr><td colSpan={columns.length} className="py-4 text-center text-gray-500">Aucun élément ne correspond au filtre.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination
                totalItems={filtered.length}
                itemsPerPage={perPage}
                currentPage={page}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
            />
        </>
    );
};
