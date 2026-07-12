import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Bar, LabelList, Cell } from 'recharts';
import { ArrowUpDown, FileDown, Pencil, AlertTriangle, Star, HelpCircle as QuestionMark, Milk, Bone } from 'lucide-react';
import { parseLocaleNumber, formatCurrency, formatPercent } from '../utils.js';
import { getCostTargetIndicator } from '../ui-utils.jsx';
import { Tooltip, Pagination } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';

// Doit être déclaré en dehors de StrategicAnalysis : un composant recréé à chaque rendu
// perdrait son état et forcerait un remontage complet de ses enfants à chaque frappe.
const Quadrant = ({ title, icon, items, bgColor, borderColor, tooltipText }) => (
    <div className={`rounded-lg p-4 ${bgColor} ${borderColor} border-2`}>
        <h3 className="font-bold text-lg mb-2 flex items-center">
            {icon} {title} <Tooltip text={tooltipText} />
        </h3>
        <ul className="text-sm space-y-2">
            {items.length > 0 ? items.map(p => (
                <li key={p.id} className="flex justify-between items-center">
                    <span>• {p.platName}</span>
                    <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                        {/* Affiche la marge de CONTRIBUTION (prix − coût matière), soit l'axe de
                            rentabilité sur lequel la matrice classe désormais les plats. */}
                        {`Pop: ${parseLocaleNumber(p.salesMix).toFixed(1)}% | Contrib.: ${formatCurrency(p.costs.margeContributionDollar)}$`}
                    </span>
                </li>
            )) : <li className="text-gray-500 list-none">Aucun</li>}
        </ul>
    </div>
);

// --- COMPOSANT D'ANALYSE STRATÉGIQUE ---
const StrategicAnalysis = ({ analysisData, generalInfo }) => {
    // Tout est déjà prêt dans analysisData
    const {
        weightedGrossMargin,
        globalBreakEven,
        weightedMaterialCost,
        weightedLaborCost,
        menuEngineeringData,
        totalSalesMix
    } = analysisData;

    const { stars, cows, questions, dogs } = menuEngineeringData;

    if (!analysisData.activeProducts || analysisData.activeProducts.length === 0) return null;

    return (
        <div id="strategic-analysis" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Analyse stratégique et point mort global</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-center">
                <div className="p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">
                        Coût Matière Moyen Pondéré
                        <Tooltip text="La moyenne du coût matière de tous vos plats, pondérée par leur popularité (mix des ventes)." />
                        {getCostTargetIndicator(weightedMaterialCost, generalInfo.foodCostTarget)}
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedMaterialCost)} %</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">
                        Coût Main-d'œuvre Moyen Pondéré
                        <Tooltip text="La moyenne du coût de main-d'œuvre de tous vos plats, pondérée par leur popularité (mix des ventes)." />
                        {getCostTargetIndicator(weightedLaborCost, generalInfo.laborCostTarget)}
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedLaborCost)} %</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">Marge Brute Moyenne Pondérée <Tooltip text="La marge brute moyenne de votre menu, en tenant compte de la popularité de chaque plat." /></div>
                    <p className="text-3xl font-bold text-blue-600">{formatPercent(weightedGrossMargin)} %</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow">
                    <div className="text-sm text-gray-500 flex items-center justify-center">Point Mort du Menu Analysé <Tooltip text="Le chiffre d'affaires que votre menu doit générer pour couvrir sa part des frais indirects." /></div>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(globalBreakEven)} $</p>
                </div>
            </div>
            {Math.round(totalSalesMix) !== 100 && totalSalesMix > 0 && (
                 <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md text-center text-sm">
                    <AlertTriangle className="inline h-4 w-4 mr-2"/>
                    Attention : Le total de votre mix des ventes est de {totalSalesMix.toFixed(1)}%. Pour une analyse précise, il devrait être de 100%.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Quadrant
                    title="Étoiles"
                    icon={<Star className="mr-2 text-yellow-500"/>}
                    items={stars}
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200"
                    tooltipText="Vos plats les plus populaires ET les plus rentables. Mettez-les en avant !"
                />
                <Quadrant
                    title="Dilemmes"
                    icon={<QuestionMark className="mr-2 text-orange-500"/>}
                    items={questions}
                    bgColor="bg-orange-50"
                    borderColor="border-orange-200"
                    tooltipText="Plats rentables mais peu populaires. Envisagez une promotion ou une meilleure place sur le menu pour stimuler les ventes."
                />
                <Quadrant
                    title="Vaches à lait"
                    icon={<Milk className="mr-2 text-gray-500"/>}
                    items={cows}
                    bgColor="bg-gray-50"
                    borderColor="border-gray-200"
                    tooltipText="Plats très populaires mais à faible marge. Cherchez à réduire leurs coûts sans sacrifier la qualité."
                />
                <Quadrant
                    title="Poids morts"
                    icon={<Bone className="mr-2 text-red-500"/>}
                    items={dogs}
                    bgColor="bg-red-50"
                    borderColor="border-red-200"
                    tooltipText="Plats ni populaires, ni rentables. Pensez à les réinventer complètement ou à les retirer du menu."
                />
            </div>
        </div>
    );
};

// Onglet 4: Résumé
export const SummaryTable = ({ onEditProduct, onOpenPdfModal, exportToExcel, itemsPerPage, onItemsPerPageChange }) => {
    const { products, generalInfo, laborDatabase, analysisData } = useProject();
    const [sortConfig, setSortConfig] = useState({ key: 'costs.margeNettePercent', direction: 'descending' });
    const [showAllContributions, setShowAllContributions] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    useEffect(() => {
        setCurrentPage(1);
    }, [sortConfig]);

    // --- LOGIQUE CENTRALISÉE ---
    const { productsWithCosts, contributionData } = analysisData;

    const sortedProducts = useMemo(() => {
        let sortableItems = [...productsWithCosts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const getNestedValue = (obj, path) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);

                let comparison = 0;
                // On détecte si la colonne est numérique (Prix, Mix ou n'importe quel champ de costs.*)
                const isNumeric = sortConfig.key.includes('costs.') || sortConfig.key === 'prixVente' || sortConfig.key === 'salesMix';

                if (isNumeric) {
                    // Conversion forcée en nombre pour éviter le tri "String" (10 < 2)
                    comparison = parseLocaleNumber(aValue) - parseLocaleNumber(bValue);
                } else {
                    // Tri alphabétique robuste pour les noms de plats
                    comparison = String(aValue || "").localeCompare(String(bValue || ""), 'fr', { sensitivity: 'base' });
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [productsWithCosts, sortConfig]);

    const displayedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedProducts, currentPage, itemsPerPage]);

    // On prépare les données pour le graphique de contribution
    const displayedContributions = useMemo(() => {
        return showAllContributions ? contributionData : contributionData.slice(0, 10);
    }, [contributionData, showAllContributions]);

    const totalContributionsCount = contributionData.length;

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="ml-2 text-gray-400" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const getMarginStyle = (marginPercent) => {
        if (!isFinite(marginPercent)) return { backgroundColor: 'white', color: 'black' };

        const absMargin = Math.abs(marginPercent);
        const intensity = Math.min(absMargin / 0.8, 1) * 0.85 + 0.15;
        const textColor = intensity > 0.6 ? 'white' : 'black';

        if (marginPercent > 0) {
            return { backgroundColor: `rgba(22, 163, 74, ${intensity})`, color: textColor }; // Green
        } else if (marginPercent < 0) {
            return { backgroundColor: `rgba(220, 38, 38, ${intensity})`, color: textColor }; // Red
        } else {
            return { backgroundColor: 'white', color: 'black' };
        }
    };

    const getCostTargetStyle = (costPercent, targetPercent) => {
        const target = parseLocaleNumber(targetPercent);
        if (!target || target <= 0) return {};

        if (costPercent * 100 <= target) {
            return { backgroundColor: '#dcfce7' }; // green-100
        } else {
            return { backgroundColor: '#fee2e2' }; // red-100
        }
    };

    const headers = [
        { key: 'platName', label: 'Plat' },
        { key: 'prixVente', label: 'Prix Vente ($)' },
        { key: 'costs.totalCostPerPortion', label: 'Coût Total ($)' },
        { key: 'costs.costMatierePercent', label: 'Coût Matière (%)' },
        { key: 'costs.costLaborPercent', label: 'Coût M-O (%)' },
        { key: 'costs.costIndirectPercent', label: 'Coût Ind. (%)' },
        { key: 'costs.margeBruteDollar', label: 'Marge Brute ($)' },
        { key: 'costs.margeBrutePercent', label: 'Marge Brute (%)' },
        { key: 'costs.margeNetteDollar', label: 'Marge Nette ($)' },
        { key: 'costs.margeNettePercent', label: 'Marge Nette (%)' },
    ];

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Résumé des produits</h1>
                <div className="flex space-x-2">
                    <button onClick={() => exportToExcel(laborDatabase)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        <FileDown className="h-5 w-5 mr-2" /> Exporter vers Excel
                    </button>
                    <button onClick={onOpenPdfModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                        <FileDown className="h-5 w-5 mr-2" /> Générer un rapport PDF
                    </button>
                </div>
            </div>
            <div id="tutorial-section-summary-table" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            {headers.map((header) => (
                                <th key={header.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <button onClick={() => requestSort(header.key)} className="flex items-center w-full">
                                        {header.label} {getSortIcon(header.key)}
                                    </button>
                                </th>
                            ))}
                            <th className="relative px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedProducts.map((product, index) => (
                            <tr key={product.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-4 whitespace-nowrap font-medium">{product.platName || `Plat ${index + 1}`}</td>
                                <td className="px-4 py-4 text-right">{formatCurrency(parseLocaleNumber(product.prixVente))}</td>
                                <td className="px-4 py-4 text-right">{formatCurrency(product.costs.totalCostPerPortion)}</td>
                                <td className="px-4 py-4 text-right" style={getCostTargetStyle(product.costs.costMatierePercent, generalInfo.foodCostTarget)}>{formatPercent(product.costs.costMatierePercent)} %</td>
                                <td className="px-4 py-4 text-right" style={getCostTargetStyle(product.costs.costLaborPercent, generalInfo.laborCostTarget)}>{formatPercent(product.costs.costLaborPercent)} %</td>
                                <td className="px-4 py-4 text-right">{formatPercent(product.costs.costIndirectPercent)} %</td>
                                <td className="px-4 py-4 text-right font-bold" style={getMarginStyle(product.costs.margeBrutePercent)}>{formatCurrency(product.costs.margeBruteDollar)}</td>
                                <td className="px-4 py-4 text-right font-bold" style={getMarginStyle(product.costs.margeBrutePercent)}>{formatPercent(product.costs.margeBrutePercent)} %</td>
                                <td className="px-4 py-4 text-right font-bold" style={getMarginStyle(product.costs.margeNettePercent)}>{formatCurrency(product.costs.margeNetteDollar)}</td>
                                <td className="px-4 py-4 text-right font-bold" style={getMarginStyle(product.costs.margeNettePercent)}>{formatPercent(product.costs.margeNettePercent)} %</td>
                                <td className="px-4 py-4 text-right">
                                    <button
                                        onClick={() => onEditProduct(products.findIndex(p => p.id === product.id))}
                                        title="Éditer le plat"
                                        className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            <Pagination
                totalItems={sortedProducts.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={onItemsPerPageChange}
            />
            </div>
            {/* NOUVEAU: Classement par Contribution Totale (Version Améliorée) */}
            <div id="tutorial-contribution-chart" className="mt-8 p-6 bg-gray-50 rounded-xl shadow-inner">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Classement par contribution totale au profit</h2>
                        <p className="text-sm text-gray-500 mb-4">Ce graphique montre les plats qui génèrent le plus de profit en dollars pour couvrir vos frais fixes.</p>
                    </div>
                    {totalContributionsCount > 10 && (
                        <button
                            onClick={() => setShowAllContributions(!showAllContributions)}
                            className="text-sm text-blue-600 hover:text-blue-800 flex-shrink-0"
                        >
                            {showAllContributions ? 'Voir les 10 principaux' : `Voir tout (${totalContributionsCount})`}
                        </button>
                    )}
                </div>
                <div style={{ width: '100%', height: 30 + displayedContributions.length * 40 }}>
                    <ResponsiveContainer>
                        <BarChart
                            layout="vertical"
                            data={displayedContributions}
                            margin={{ top: 5, right: 60, left: 100, bottom: 5 }}
                        >

                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                            <RechartsTooltip
                                formatter={(value) => `${formatCurrency(value)} $`}
                                cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }}
                                contentStyle={{ borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="totalContribution" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="totalContribution" position="right" formatter={(value) => `${formatCurrency(value)} $`} style={{ fill: '#374151', fontSize: '12px' }}/>
                                {contributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.totalContribution >= 0 ? '#10B981' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <StrategicAnalysis analysisData={analysisData} generalInfo={generalInfo} />
        </div>
    );
};
