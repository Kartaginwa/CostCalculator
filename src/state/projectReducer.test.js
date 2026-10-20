import { describe, it, expect } from 'vitest';
import { projectReducer, toProjectState } from './projectReducer.js';
import { getDefaultState, getEmptyState } from './initialState.js';

const baseState = () => ({
    companyName: 'Acme',
    logoUrl: 'logo.png',
    generalInfo: { totalIndirects: 100 },
    baseIngredients: [{ id: 'a' }],
    basePackaging: [{ id: 'pkg' }],
    products: [{ id: 'p' }],
    trackingPoints: [],
    laborDatabase: [{ id: 'post' }],
    productionActivities: [{ id: 'act_general', name: 'Général' }],
    salesChannels: [{ id: 'channel_default', name: 'Vente directe', links: [] }],
    activeUnits: ['g', 'kg', 'ml', 'L', 'unité'],
    expenseLines: [{ id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 100 }],
    revenueLines: [{ id: 'rev_1', label: 'Ventes', repartition: 'general', amounts: { general: 200 } }],
    directCostLines: [{ id: 'dc_1', label: 'Matières premières', category: 'Matière première', amount: 300 }],
    uiSettings: { infoItemsPerPage: 10 },
});

describe('projectReducer', () => {
    it('remplace la valeur ciblée par une valeur directe', () => {
        const state = baseState();
        const next = projectReducer(state, { type: 'SET_COMPANY_NAME', payload: 'Bistro' });
        expect(next.companyName).toBe('Bistro');
        // Les autres champs restent inchangés (mêmes références)
        expect(next.products).toBe(state.products);
    });

    it('résout une mise à jour fonctionnelle contre la valeur courante (convention useState)', () => {
        const state = baseState();
        const next = projectReducer(state, {
            type: 'SET_PRODUCTS',
            payload: (prev) => [...prev, { id: 'p2' }],
        });
        expect(next.products).toEqual([{ id: 'p' }, { id: 'p2' }]);
        // Immuabilité : l'état d'origine n'est pas muté
        expect(state.products).toEqual([{ id: 'p' }]);
    });

    it('gère chaque type d’action sur le bon champ', () => {
        const state = baseState();
        expect(projectReducer(state, { type: 'SET_LOGO_URL', payload: 'x.png' }).logoUrl).toBe('x.png');
        expect(projectReducer(state, { type: 'SET_GENERAL_INFO', payload: { totalIndirects: 5 } }).generalInfo).toEqual({ totalIndirects: 5 });
        expect(projectReducer(state, { type: 'SET_BASE_INGREDIENTS', payload: [] }).baseIngredients).toEqual([]);
        expect(projectReducer(state, { type: 'SET_BASE_PACKAGING', payload: [] }).basePackaging).toEqual([]);
        expect(projectReducer(state, { type: 'SET_LABOR_DATABASE', payload: [] }).laborDatabase).toEqual([]);
        expect(projectReducer(state, { type: 'SET_TRACKING_POINTS', payload: [{ id: 't' }] }).trackingPoints).toEqual([{ id: 't' }]);
        expect(projectReducer(state, { type: 'SET_PRODUCTION_ACTIVITIES', payload: [] }).productionActivities).toEqual([]);
        expect(projectReducer(state, { type: 'SET_SALES_CHANNELS', payload: [] }).salesChannels).toEqual([]);
        expect(projectReducer(state, { type: 'SET_ACTIVE_UNITS', payload: ['g'] }).activeUnits).toEqual(['g']);
        expect(projectReducer(state, { type: 'SET_EXPENSE_LINES', payload: [] }).expenseLines).toEqual([]);
        expect(projectReducer(state, { type: 'SET_REVENUE_LINES', payload: [] }).revenueLines).toEqual([]);
        expect(projectReducer(state, { type: 'SET_DIRECT_COST_LINES', payload: [] }).directCostLines).toEqual([]);
        expect(projectReducer(state, { type: 'SET_UI_SETTINGS', payload: { infoItemsPerPage: 25 } }).uiSettings).toEqual({ infoItemsPerPage: 25 });
    });

    it('LOAD_PROJECT remplace toutes les tranches fournies en un seul dispatch', () => {
        const state = baseState();
        const payload = {
            companyName: 'Nouveau', logoUrl: 'n.png', generalInfo: { totalIndirects: 999 },
            baseIngredients: [{ id: 'z' }], basePackaging: [{ id: 'pkg2' }], products: [{ id: 'q' }], trackingPoints: [{ id: 't' }],
            laborDatabase: [{ id: 'l' }], productionActivities: [{ id: 'act_1', name: 'Ligne 1' }],
            salesChannels: [{ id: 'channel_1', name: 'Grande distribution', links: [] }],
            activeUnits: ['g', 'kg'],
            expenseLines: [{ id: 'exp_2', label: 'Assurances', category: "Frais d'administration", amount: 50 }],
            revenueLines: [{ id: 'rev_2', label: 'Ventes B', repartition: 'act_1', amounts: { act_1: 300 } }],
            directCostLines: [{ id: 'dc_2', label: 'Emballage', category: 'Emballage', amount: 75 }],
            uiSettings: { infoItemsPerPage: 50 },
        };
        const next = projectReducer(state, { type: 'LOAD_PROJECT', payload });
        expect(next).toEqual(payload);
        // L'état d'origine n'est pas muté.
        expect(state.companyName).toBe('Acme');
    });

    it('retourne l’état inchangé pour une action inconnue', () => {
        const state = baseState();
        expect(projectReducer(state, { type: 'UNKNOWN' })).toBe(state);
    });
});

describe('toProjectState', () => {
    it('mappe un état plat (ingredientsList) vers la forme du reducer (baseIngredients)', () => {
        const flat = getEmptyState();
        const projectState = toProjectState(flat);
        expect(projectState.baseIngredients).toBe(flat.ingredientsList);
        expect(projectState.basePackaging).toBe(flat.basePackaging);
        expect(projectState.products).toBe(flat.products);
        expect(projectState.generalInfo).toBe(flat.generalInfo);
        // La clé plate "ingredientsList" ne doit pas fuiter dans l'état du reducer
        expect(projectState).not.toHaveProperty('ingredientsList');
    });

    it('conserve toutes les tranches attendues depuis getDefaultState', () => {
        const projectState = toProjectState(getDefaultState());
        for (const key of ['companyName', 'logoUrl', 'generalInfo', 'baseIngredients', 'basePackaging', 'products', 'trackingPoints', 'laborDatabase', 'productionActivities', 'salesChannels', 'activeUnits', 'expenseLines', 'revenueLines', 'directCostLines', 'uiSettings']) {
            expect(projectState[key]).toBeDefined();
        }
        expect(projectState.baseIngredients.length).toBeGreaterThan(0);
        expect(projectState.basePackaging.length).toBeGreaterThan(0);
        expect(projectState.products.length).toBeGreaterThan(0);
        expect(projectState.salesChannels.length).toBeGreaterThan(0);
        expect(projectState.activeUnits.length).toBeGreaterThan(0);
    });
});
