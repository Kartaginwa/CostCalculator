// Chaîne de calcul complète du projet, hors interface : absorption de la main-d'œuvre → calcul « brouillon » →
// répartition des frais fixes (pools) → calcul final. Reproduit exactement ce que fait App.jsx pour l'état courant ;
// sert à fabriquer des relevés (points de référence) qui suivent la MÊME méthode que les tuiles — notamment l'historique
// du projet démo, qui était calculé sans absorption complète ni répartition des frais fixes (audit du 19/11).
import { parseLocaleNumber as P, sumLineAmounts, loadedHourlyRate } from '../utils.js';
import { computeAnalysisData, computeIndirectPools } from './analysisData.js';
import { computeLaborHoursNeeded } from './laborHours.js';

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0);

// Taux d'absorption (en %) : coût des heures nécessaires ÷ paie de TOUS les postes (décision du 19/11).
export function computeLaborAbsorption(products, laborDatabase, baseIngredients = [], salesChannels = []) {
    // Heures nécessaires : ventes de chaque format ET consommation de sous-recettes (voir laborHours.js).
    const { byPost, total } = computeLaborHoursNeeded(products, baseIngredients, salesChannels);
    const payrollOf = (employees) => sum(employees, e => P(e.workedHours) * loadedHourlyRate(e));
    const payroll = sum(laborDatabase, post => payrollOf(post.employees || []));
    const directNeeded = sum(laborDatabase, post => {
        const hours = sum(post.employees || [], e => P(e.workedHours));
        return hours > 0 ? (byPost[post.postName] || 0) * (payrollOf(post.employees || []) / hours) : 0;
    });
    return {
        kitchenProductivity: payroll > 0 ? (directNeeded / payroll) * 100 : 100,
        totalDirectLaborHoursNeeded: total,
    };
}

export function computeProjectAnalysis({
    products, baseIngredients, basePackaging, laborDatabase, generalInfo, salesChannels, productionActivities,
    expenseLines, revenueLines, directCostLines, repartitionKeys,
}) {
    const info = { ...generalInfo, totalIndirects: sumLineAmounts(expenseLines || []) };
    const absorption = computeLaborAbsorption(products, laborDatabase, baseIngredients, salesChannels);
    const calc = { ...info, ...absorption, productivityReport: { rows: [] } };
    const draft = computeAnalysisData(products, baseIngredients, laborDatabase, info, calc, basePackaging, salesChannels);
    const pools = computeIndirectPools(draft.productsWithCosts, { expenseLines, repartitionKeys, revenueLines, directCostLines, productionActivities, salesChannels, generalInfo: info });
    const data = computeAnalysisData(products, baseIngredients, laborDatabase, info, calc, basePackaging, salesChannels, pools);
    return { data, pools, generalInfo: info, kitchenProductivity: absorption.kitchenProductivity };
}
