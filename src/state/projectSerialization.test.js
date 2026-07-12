import { describe, it, expect } from 'vitest';
import { buildProjectData, parseProjectData } from './projectSerialization.js';
import { getDefaultState, getEmptyState } from './initialState.js';

// Construit un état "reducer" (baseIngredients) à partir de l'état plat de démonstration.
const demoState = () => {
    const s = getDefaultState();
    return {
        companyName: s.companyName,
        logoUrl: s.logoUrl,
        generalInfo: s.generalInfo,
        baseIngredients: s.ingredientsList,
        products: s.products,
        trackingPoints: s.trackingPoints,
        laborDatabase: s.laborDatabase,
        uiSettings: s.uiSettings,
    };
};

describe('buildProjectData', () => {
    it("n'exporte que les tranches attendues (pas de bruit)", () => {
        const data = buildProjectData(demoState());
        expect(Object.keys(data).sort()).toEqual(
            ['baseIngredients', 'companyName', 'generalInfo', 'laborDatabase', 'logoUrl', 'products', 'trackingPoints', 'uiSettings'].sort()
        );
    });
});

describe('round-trip sauvegarde -> chargement', () => {
    it('préserve les données d’un projet complet après build -> JSON -> parse', () => {
        const state = demoState();
        // Simule un vrai cycle disque : sérialisation puis désérialisation JSON.
        const json = JSON.parse(JSON.stringify(buildProjectData(state)));
        const parsed = parseProjectData(json, getEmptyState());

        expect(parsed.companyName).toBe(state.companyName);
        expect(parsed.logoUrl).toBe(state.logoUrl);
        // Superset : les valeurs sauvegardées sont préservées, complétées par les défauts de
        // l'état vide pour les champs ajoutés après coup (startDate, totalKitchenLaborCost...).
        expect(parsed.generalInfo).toMatchObject(state.generalInfo);
        expect(parsed.uiSettings).toEqual(state.uiSettings);
        expect(parsed.laborDatabase).toEqual(state.laborDatabase);
        // Les ids étant déjà présents, aucune régénération : égalité stricte des ids.
        expect(parsed.products.map(p => p.id)).toEqual(state.products.map(p => String(p.id)));
        expect(parsed.baseIngredients.map(i => i.id)).toEqual(state.baseIngredients.map(i => String(i.id)));
        // Les coûts calculés d'un plat sont préservés à l'identique.
        expect(parsed.products[0].prixVente).toBe(state.products[0].prixVente);
        expect(parsed.products[0].ingredients.length).toBe(state.products[0].ingredients.length);
    });

    it('applique menuRevenuePercentage=100 aux projets antérieurs à ce champ', () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas de menuRevenuePercentage
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.generalInfo.menuRevenuePercentage).toBe(100);
    });

    it("migre l'ancien format de main-d'œuvre (liste plate d'employés) vers des postes groupés", () => {
        const legacy = {
            laborDatabase: [
                { id: 'e1', postName: 'Cuisinier', employeeName: 'A', hourlyRate: 20 },
                { id: 'e2', postName: 'Cuisinier', employeeName: 'B', hourlyRate: 22 },
                { id: 'e3', postName: 'Plongeur', employeeName: 'C', hourlyRate: 17 },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        // 2 postes distincts, chacun avec sa liste d'employés.
        expect(parsed.laborDatabase).toHaveLength(2);
        const cuisinier = parsed.laborDatabase.find(p => p.postName === 'Cuisinier');
        expect(cuisinier.employees).toHaveLength(2);
        expect(parsed.laborDatabase.find(p => p.postName === 'Plongeur').employees).toHaveLength(1);
    });

    it("accepte l'ancienne clé ingredientsList comme repli de baseIngredients", () => {
        const legacy = { ingredientsList: [{ id: 'x', name: 'Sel', unitPrice: 1, unit: 'g' }] };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.baseIngredients).toHaveLength(1);
        expect(parsed.baseIngredients[0].name).toBe('Sel');
        // Champs par défaut ajoutés par la migration.
        expect(parsed.baseIngredients[0].uniqueId).toBe('');
        expect(parsed.baseIngredients[0].isRecipe).toBe(false);
    });

    it('remplit les valeurs par défaut des produits partiels', () => {
        const legacy = { products: [{ id: 'p1', platName: 'Test', prixVente: 10 }] };
        const parsed = parseProjectData(legacy, getEmptyState());
        const p = parsed.products[0];
        expect(p.nbPortions).toBe(1);
        expect(p.portionSize).toBe(1);
        expect(p.onMenu).toBe(true);
        expect(p.indirectCosts).toBeDefined();
        expect(p.ingredients).toEqual([]);
        expect(p.productionSteps).toEqual([]);
    });
});
