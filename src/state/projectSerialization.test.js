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
        basePackaging: s.basePackaging,
        products: s.products,
        trackingPoints: s.trackingPoints,
        laborDatabase: s.laborDatabase,
        productionActivities: s.productionActivities,
        salesChannels: s.salesChannels,
        uiSettings: s.uiSettings,
    };
};

describe('buildProjectData', () => {
    it("n'exporte que les tranches attendues (pas de bruit)", () => {
        const data = buildProjectData(demoState());
        expect(Object.keys(data).sort()).toEqual(
            ['baseIngredients', 'basePackaging', 'companyName', 'generalInfo', 'laborDatabase', 'logoUrl', 'productionActivities', 'salesChannels', 'products', 'trackingPoints', 'uiSettings'].sort()
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
        expect(parsed.productionActivities).toEqual(state.productionActivities);
        expect(parsed.salesChannels).toEqual(state.salesChannels);
        // Les ids étant déjà présents, aucune régénération : égalité stricte des ids.
        expect(parsed.products.map(p => p.id)).toEqual(state.products.map(p => String(p.id)));
        expect(parsed.baseIngredients.map(i => i.id)).toEqual(state.baseIngredients.map(i => String(i.id)));
        expect(parsed.basePackaging.map(p => p.id)).toEqual(state.basePackaging.map(p => String(p.id)));
        expect(parsed.basePackaging.length).toBe(state.basePackaging.length);
        // Les coûts calculés d'un plat sont préservés à l'identique.
        expect(parsed.products[0].prixVente).toBe(state.products[0].prixVente);
        // Les ingrédients vivent sur le format (chaque SKU a sa propre fiche recette — voir
        // 04-Conception-Modele.md), pas sur le produit.
        expect(parsed.products[0].formats[0].ingredients.length).toBe(state.products[0].formats[0].ingredients.length);
        // Le format de vente par défaut (Phase 1.3) traverse le cycle sans se dupliquer ni
        // changer de valeurs.
        expect(parsed.products[0].formats).toEqual(state.products[0].formats);
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

    it('crée un catalogue Packaging vide pour un projet antérieur à la Phase 2 (sans basePackaging)', () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas de basePackaging
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.basePackaging).toEqual([]);
    });

    it('normalise un item Packaging partiel (id manquant, lossPercentage/lastUpdated absents)', () => {
        const legacy = { basePackaging: [{ name: 'Pot de verre 250 ml', purchaseFormat: 24, unit: 'unité', purchasePrice: 18 }] };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.basePackaging).toHaveLength(1);
        const [pkg] = parsed.basePackaging;
        expect(pkg.id).toBeTruthy();
        expect(pkg.lossPercentage).toBe(0);
        expect(pkg.lastUpdated).toBeTruthy();
        expect(pkg.uniqueId).toBe('');
    });

    it('crée une ligne de production "Général" par défaut pour un projet antérieur à cette notion', () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas de productionActivities
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.productionActivities).toHaveLength(1);
        expect(parsed.productionActivities[0].name).toBe('Général');
    });

    it('crée un circuit de vente "Vente directe" par défaut pour un projet antérieur à la Phase 3 (sans salesChannels)', () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas de salesChannels
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.salesChannels).toHaveLength(1);
        expect(parsed.salesChannels[0].name).toBe('Vente directe');
        expect(parsed.salesChannels[0].links).toEqual([]);
    });

    it('préserve les circuits de vente déjà présents sur un projet', () => {
        const legacy = { salesChannels: [{ id: 'c1', name: 'Grande distribution', links: [{ id: 'l1', name: 'Distributeur', type: 'margin', percent: 20 }] }] };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.salesChannels).toEqual(legacy.salesChannels);
    });

    it('remplit les valeurs par défaut des produits partiels', () => {
        const legacy = { products: [{ id: 'p1', platName: 'Test', prixVente: 10 }] };
        const parsed = parseProjectData(legacy, getEmptyState());
        const p = parsed.products[0];
        expect(p.nbPortions).toBe(1);
        expect(p.portionSize).toBe(1);
        expect(p.onMenu).toBe(true);
        expect(p.indirectCosts).toBeDefined();
        // Ingrédients/étapes de production vivent désormais sur le format, pas sur le produit.
        expect(p.formats[0].ingredients).toEqual([]);
        expect(p.formats[0].productionSteps).toEqual([]);
    });

    it('rattache un produit antérieur aux activités de production à la ligne "Général" par défaut', () => {
        const legacy = { products: [{ id: 'p1', platName: 'Test', prixVente: 10 }] }; // pas d'activityId
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.products[0].activityId).toBe('act_general');
    });

    it('préserve l\'activityId déjà présent sur un produit', () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }, { id: 'act_2', name: 'Séchage' }],
            products: [{ id: 'p1', platName: 'Test', prixVente: 10, activityId: 'act_2' }],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.products[0].activityId).toBe('act_2');
    });

    it("construit un format de vente par défaut pour un produit antérieur à cette notion, à partir de ses champs \"à plat\"", () => {
        const legacy = {
            products: [{ id: 'p1', platName: 'Confiture de fraises', prixVente: 12, nbPortions: 1, portionSize: 250, portionUnit: 'ml', salesMix: 5, onMenu: true, indirectCosts: { portionsSold: 50 } }],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        const [format] = parsed.products[0].formats;
        expect(parsed.products[0].formats).toHaveLength(1);
        expect(format.prixVente).toBe(12);
        expect(format.portionSize).toBe(250);
        expect(format.portionUnit).toBe('ml');
        expect(format.salesMix).toBe(5);
        expect(format.onMenu).toBe(true);
        expect(format.indirectCosts.portionsSold).toBe(50);
        expect(format.sku).toBeTruthy();
        // Phase 3.2 : prix net migré vers le canal par défaut.
        expect(format.channelPrices).toEqual([{ id: 'cp_p1', channelId: 'channel_default', netPrice: 12, volume: 0 }]);
    });

    it('préserve les formats déjà présents (avec leur propre fiche recette, dont le packaging) sur un produit sans les régénérer', () => {
        // Génération 3+ : sauvegarde postérieure à la correction du 23/09 (et à la Phase 2.2 pour
        // packagingItems) — chaque format porte déjà sa propre fiche recette complète, doit
        // traverser le cycle sans être modifié.
        const legacy = {
            products: [{
                id: 'p1', platName: 'Confiture de fraises', prixVente: 12,
                formats: [
                    {
                        id: 'fmt_1', sku: 'CONF-250ML', prixVente: 12, nbPortions: 1, portionSize: 250, portionUnit: 'ml', salesMix: 5, onMenu: true, indirectCosts: { portionsSold: 50 },
                        ingredients: [{ rowId: 'r1', id: 'ing_1', quantity: 1, recipeUnit: 'kg', yieldPercentage: 100 }],
                        packagingItems: [{ rowId: 'pk1', id: 'pkg_1', quantity: 1, recipeUnit: 'unité' }],
                        productionSteps: [{ stepId: 's1', stepName: 'Cuisson', personnel: [], startTime: 0, duration: 600 }],
                        isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                    },
                    {
                        id: 'fmt_2', sku: 'CONF-500ML', prixVente: 20, nbPortions: 1, portionSize: 500, portionUnit: 'ml', salesMix: 3, onMenu: true, indirectCosts: { portionsSold: 30 },
                        ingredients: [{ rowId: 'r2', id: 'ing_1', quantity: 2, recipeUnit: 'kg', yieldPercentage: 100 }],
                        packagingItems: [],
                        productionSteps: [],
                        isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                    },
                ],
            }],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        // channelPrices (Phase 3.2) est la seule migration attendue ici : un prix net sur le canal
        // par défaut, repris de l'ancien prixVente — tout le reste traverse inchangé.
        expect(parsed.products[0].formats).toEqual(legacy.products[0].formats.map(f => ({
            ...f,
            channelPrices: [{ id: `cp_${f.id}`, channelId: 'channel_default', netPrice: f.prixVente, volume: 0 }],
        })));
    });

    it("attribue un catalogue d'emballage vide à un format sauvegardé avant la Phase 2.2 (sans packagingItems)", () => {
        const legacy = {
            products: [{
                id: 'p1', platName: 'Confiture de fraises', prixVente: 12,
                formats: [
                    { id: 'fmt_1', sku: 'CONF-250ML', prixVente: 12, nbPortions: 1, portionSize: 250, portionUnit: 'ml', salesMix: 5, onMenu: true, indirectCosts: { portionsSold: 50 }, ingredients: [], productionSteps: [], isResaleProduct: false, purchaseCost: 0, manualAllergens: [] },
                ],
            }],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.products[0].formats[0].packagingItems).toEqual([]);
    });

    it("complète le format par défaut d'un produit sauvegardé entre les Phases 1.3-1.5 (formats sans fiche recette encore, ingrédients sur le produit)", () => {
        // Génération 2 : `formats` existe déjà (Phase 1.3-1.5), mais la fiche recette
        // (ingrédients/étapes/revente) vivait encore sur le produit à cette époque.
        const legacy = {
            products: [{
                id: 'p1', platName: 'Confiture de fraises', prixVente: 12,
                ingredients: [{ id: 'ing_1', quantity: 1, recipeUnit: 'kg', yieldPercentage: 100 }],
                productionSteps: [{ stepName: 'Cuisson', personnel: [], startTime: 0, duration: 600 }],
                isResaleProduct: false, purchaseCost: 0,
                formats: [
                    { id: 'fmt_1', sku: 'CONF-250ML', prixVente: 12, nbPortions: 1, portionSize: 250, portionUnit: 'ml', salesMix: 5, onMenu: true, indirectCosts: { portionsSold: 50 } },
                ],
            }],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        const [format] = parsed.products[0].formats;
        // Le format par défaut hérite des ingrédients/étapes qui vivaient sur le produit.
        expect(format.ingredients).toHaveLength(1);
        expect(format.ingredients[0].id).toBe('ing_1');
        expect(format.productionSteps).toHaveLength(1);
        // Le produit lui-même ne porte plus ces champs après migration.
        expect(parsed.products[0].ingredients).toBeUndefined();
        expect(parsed.products[0].productionSteps).toBeUndefined();
    });
});
