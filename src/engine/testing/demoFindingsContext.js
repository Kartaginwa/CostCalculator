// Données du projet démo calculées comme l'application les calcule (mêmes fonctions du moteur), partagées par les tests de constats et de rapport.
import { getDefaultState } from '../../state/initialState.js';
import { computeProjectAnalysis } from '../analysisPipeline.js';
import { computeCalculatedGeneralInfo } from '../calculatedGeneralInfo.js';
import { buildKeyFindingsContext } from '../keyFindings.js';

/** Les entrées d'un rapport : ce que l'application a déjà calculé (analyse des données, informations générales calculées) et l'état du projet. */
export const demoInputs = (mutate) => {
    const s = getDefaultState();
    const trackingPoints = mutate ? mutate(structuredClone(s.trackingPoints)) : s.trackingPoints;
    const base = computeProjectAnalysis({
        products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase, generalInfo: s.generalInfo,
        salesChannels: s.salesChannels, productionActivities: s.productionActivities, expenseLines: s.expenseLines, revenueLines: s.revenueLines,
        directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys,
    });
    const calculatedGeneralInfo = computeCalculatedGeneralInfo({
        generalInfo: base.generalInfo, products: s.products, baseIngredients: s.ingredientsList, laborDatabase: s.laborDatabase,
        productionActivities: s.productionActivities, salesChannels: s.salesChannels,
    });
    return { state: s, trackingPoints, analysisData: base.data, calculatedGeneralInfo };
};

/** Contexte des constats du projet démo. */
export const demoContext = (mutate) => {
    const { state: s, trackingPoints, analysisData, calculatedGeneralInfo } = demoInputs(mutate);
    return buildKeyFindingsContext({
        analysisData, generalInfo: calculatedGeneralInfo, laborDatabase: s.laborDatabase, trackingPoints, salesChannels: s.salesChannels,
        productionActivities: s.productionActivities, revenueLines: s.revenueLines, directCostLines: s.directCostLines, baseIngredients: s.ingredientsList, expenseLines: s.expenseLines,
    });
};
