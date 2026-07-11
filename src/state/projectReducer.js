// Construit l'état initial du reducer à partir d'un état "plat" (getEmptyState()/getDefaultState()).
export const toProjectState = (flatState) => ({
    companyName: flatState.companyName,
    logoUrl: flatState.logoUrl,
    generalInfo: flatState.generalInfo,
    baseIngredients: flatState.ingredientsList,
    products: flatState.products,
    trackingPoints: flatState.trackingPoints,
    laborDatabase: flatState.laborDatabase,
    uiSettings: flatState.uiSettings,
});

export function projectReducer(state, action) {
    switch (action.type) {
        case 'SET_COMPANY_NAME':
            return { ...state, companyName: action.payload };
        case 'SET_LOGO_URL':
            return { ...state, logoUrl: action.payload };
        case 'SET_GENERAL_INFO':
            return { ...state, generalInfo: action.payload };
        case 'SET_BASE_INGREDIENTS':
            return { ...state, baseIngredients: action.payload };
        case 'SET_PRODUCTS':
            return { ...state, products: action.payload };
        case 'SET_LABOR_DATABASE':
            return { ...state, laborDatabase: action.payload };
        case 'SET_TRACKING_POINTS':
            return { ...state, trackingPoints: action.payload };
        case 'SET_UI_SETTINGS':
            return { ...state, uiSettings: action.payload };
        default:
            return state;
    }
}
