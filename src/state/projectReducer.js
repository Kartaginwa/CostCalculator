// Construit l'état initial du reducer à partir d'un état "plat" (getEmptyState()/getDefaultState()).
export const toProjectState = (flatState) => ({
    companyName: flatState.companyName,
    logoUrl: flatState.logoUrl,
    generalInfo: flatState.generalInfo,
    baseIngredients: flatState.ingredientsList,
    basePackaging: flatState.basePackaging,
    products: flatState.products,
    trackingPoints: flatState.trackingPoints,
    laborDatabase: flatState.laborDatabase,
    productionActivities: flatState.productionActivities,
    salesChannels: flatState.salesChannels,
    uiSettings: flatState.uiSettings,
});

// Résout une "valeur ou fonction de mise à jour" (même convention que useState) contre la
// valeur actuelle. Fait ici, dans le reducer, plutôt que dans les setters exposés par App.jsx,
// pour que ces derniers puissent être stables (dispatch seul en dépendance) sans avoir besoin
// de fermer sur l'état courant — ce qui permet de mémoïser le contexte du projet.
const resolve = (value, currentValue) => (typeof value === 'function' ? value(currentValue) : value);

export function projectReducer(state, action) {
    switch (action.type) {
        // Remplace en un seul dispatch toutes les tranches du projet (chargement de fichier ou
        // restauration du brouillon persisté). Atomique : un seul rendu, pas de risque d'état
        // partiellement mis à jour entre plusieurs setters.
        case 'LOAD_PROJECT':
            return { ...state, ...action.payload };
        case 'SET_COMPANY_NAME':
            return { ...state, companyName: resolve(action.payload, state.companyName) };
        case 'SET_LOGO_URL':
            return { ...state, logoUrl: resolve(action.payload, state.logoUrl) };
        case 'SET_GENERAL_INFO':
            return { ...state, generalInfo: resolve(action.payload, state.generalInfo) };
        case 'SET_BASE_INGREDIENTS':
            return { ...state, baseIngredients: resolve(action.payload, state.baseIngredients) };
        case 'SET_BASE_PACKAGING':
            return { ...state, basePackaging: resolve(action.payload, state.basePackaging) };
        case 'SET_PRODUCTS':
            return { ...state, products: resolve(action.payload, state.products) };
        case 'SET_LABOR_DATABASE':
            return { ...state, laborDatabase: resolve(action.payload, state.laborDatabase) };
        case 'SET_PRODUCTION_ACTIVITIES':
            return { ...state, productionActivities: resolve(action.payload, state.productionActivities) };
        case 'SET_SALES_CHANNELS':
            return { ...state, salesChannels: resolve(action.payload, state.salesChannels) };
        case 'SET_TRACKING_POINTS':
            return { ...state, trackingPoints: resolve(action.payload, state.trackingPoints) };
        case 'SET_UI_SETTINGS':
            return { ...state, uiSettings: resolve(action.payload, state.uiSettings) };
        default:
            return state;
    }
}
