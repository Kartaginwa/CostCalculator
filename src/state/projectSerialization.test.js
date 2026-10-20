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
        activeUnits: s.activeUnits,
        expenseLines: s.expenseLines,
        revenueLines: s.revenueLines,
        directCostLines: s.directCostLines,
        repartitionKeys: s.repartitionKeys,
        uiSettings: s.uiSettings,
    };
};

describe('buildProjectData', () => {
    it("n'exporte que les tranches attendues (pas de bruit)", () => {
        const data = buildProjectData(demoState());
        expect(Object.keys(data).sort()).toEqual(
            ['baseIngredients', 'basePackaging', 'companyName', 'generalInfo', 'laborDatabase', 'logoUrl', 'productionActivities', 'salesChannels', 'activeUnits', 'expenseLines', 'revenueLines', 'directCostLines', 'repartitionKeys', 'products', 'trackingPoints', 'uiSettings'].sort()
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
        expect(parsed.activeUnits).toEqual(state.activeUnits);
        // Chaque ligne démo porte désormais sa propre clé de répartition explicite (Phase 4.5bis,
        // méthodologie comptable complétée le 14/10) — round-trip à l'identique, sans complément.
        expect(parsed.expenseLines).toEqual(state.expenseLines);
        expect(parsed.revenueLines).toEqual(state.revenueLines);
        expect(parsed.directCostLines).toEqual(state.directCostLines);
        expect(parsed.repartitionKeys).toEqual(state.repartitionKeys);
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

    it('crée une activité de production "Général" par défaut pour un projet antérieur à cette notion', () => {
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

    it('retombe sur les 5 unités de mesure historiques pour un projet antérieur à cette fonctionnalité (sans activeUnits)', () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas de activeUnits
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.activeUnits).toEqual(['g', 'kg', 'ml', 'L', 'unité']);
    });

    it('préserve les unités de mesure déjà activées sur un projet', () => {
        const legacy = { activeUnits: ['g', 'kg', 'lb', 'douzaine'] };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.activeUnits).toEqual(legacy.activeUnits);
    });

    it("migre l'ancien generalInfo.totalIndirects à plat vers une ligne de dépense unique (Phase 4.1)", () => {
        const legacy = { generalInfo: { totalIndirects: 1000 } }; // pas d'expenseLines
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.expenseLines).toHaveLength(1);
        expect(parsed.expenseLines[0].amount).toBe(1000);
        expect(parsed.expenseLines[0].category).toBe('Frais généraux de production');
        // totalIndirects reste exactement la somme de la liste migrée.
        expect(parsed.generalInfo.totalIndirects).toBe(1000);
    });

    it("ne migre rien quand il n'y a ni expenseLines ni totalIndirects à plat", () => {
        const legacy = {};
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.expenseLines).toEqual([]);
        expect(parsed.generalInfo.totalIndirects).toBe(0);
    });

    it('préserve les lignes de dépense déjà présentes sur un projet, sans les régénérer', () => {
        const legacy = {
            expenseLines: [
                { id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 600 },
                { id: 'exp_2', label: 'Assurances', category: "Frais d'administration", amount: 400 },
            ],
            generalInfo: { totalIndirects: 1 }, // valeur volontairement incohérente : doit être ignorée
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        // Lignes antérieures à la 4.5 : activityAllocations/channelAllocations ajoutées vides
        // (rien à répartir pour l'instant), repartitionKey normalisé à 'manual' (Phase 4.5bis).
        expect(parsed.expenseLines).toEqual([
            { id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 600, repartitionKey: 'manual', activityAllocations: {}, channelAllocations: {} },
            { id: 'exp_2', label: 'Assurances', category: "Frais d'administration", amount: 400, repartitionKey: 'manual', activityAllocations: {}, channelAllocations: {} },
        ]);
        // totalIndirects est toujours recalculé comme la somme exacte des lignes, jamais repris
        // tel quel du fichier — aucune dérive possible entre les deux après un chargement.
        expect(parsed.generalInfo.totalIndirects).toBe(1000);
    });

    it('préserve activityAllocations/channelAllocations déjà présents (Phase 4.5)', () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            expenseLines: [
                { id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 1000, activityAllocations: { general: 400, act_1: 600 }, channelAllocations: { channel_1: 1000 } },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.expenseLines[0].activityAllocations).toEqual({ general: 400, act_1: 600 });
        expect(parsed.expenseLines[0].channelAllocations).toEqual({ channel_1: 1000 });
    });

    it("refond le montant d'un contenant d'activité orphelin (activité supprimée) dans Général, sans y toucher côté canal", () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            expenseLines: [
                { id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 1000, activityAllocations: { general: 100, act_disparue: 400, act_1: 500 }, channelAllocations: { channel_disparu: 1000 } },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        // Le montant de l'activité disparue (400) rejoint le Général déjà présent (100) : 500 $.
        expect(parsed.expenseLines[0].activityAllocations).toEqual({ general: 500, act_1: 500 });
        // Un canal disparu n'a pas de contenant neutre équivalent : conservé tel quel, pas perdu.
        expect(parsed.expenseLines[0].channelAllocations).toEqual({ channel_disparu: 1000 });
    });

    it("repartitionKeys absent devient une liste vide ; une clé personnalisée est préservée et ses parts d'activité orphelines refondent dans Général", () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            repartitionKeys: [
                { id: 'rk_1', name: 'Équipe de vente', activityShares: { general: 20, act_disparue: 30, act_1: 50 }, channelShares: { channel_1: 100 } },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.repartitionKeys).toEqual([
            { id: 'rk_1', name: 'Équipe de vente', activityShares: { general: 50, act_1: 50 }, channelShares: { channel_1: 100 } },
        ]);
        expect(parseProjectData({}, getEmptyState()).repartitionKeys).toEqual([]);
    });

    it("revalide la clé de répartition d'une ligne de frais fixes : activité orpheline refond vers 'activity:general', canal/clé personnalisée orphelins retombent sur 'manual'", () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            repartitionKeys: [{ id: 'rk_1', name: 'Clé encore valide', activityShares: {}, channelShares: {} }],
            expenseLines: [
                { id: 'exp_1', label: 'Loyer', category: 'Frais généraux de production', amount: 100, repartitionKey: 'activity:act_disparue' },
                { id: 'exp_2', label: 'Commissions', category: 'Frais de vente / mise en marché', amount: 200, repartitionKey: 'channel:channel_disparu' },
                { id: 'exp_3', label: 'Marketing', category: 'Frais de vente / mise en marché', amount: 300, repartitionKey: 'custom:rk_disparue' },
                { id: 'exp_4', label: 'Assurances', category: "Frais d'administration", amount: 400, repartitionKey: 'custom:rk_1' },
                { id: 'exp_5', label: 'Électricité', category: 'Frais généraux de production', amount: 500, repartitionKey: 'activity:act_1' },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.expenseLines.map(l => l.repartitionKey)).toEqual([
            'activity:general', // activité supprimée -> refond vers Général
            'manual',           // canal supprimé -> pas d'équivalent neutre
            'manual',           // clé personnalisée supprimée -> plus de définition à appliquer
            'custom:rk_1',      // clé personnalisée toujours présente -> conservée telle quelle
            'activity:act_1',   // activité toujours présente -> conservée telle quelle
        ]);
    });

    it("revenueLines absent devient une liste vide (concept entièrement nouveau, Phase 4.2)", () => {
        const parsed = parseProjectData({}, getEmptyState());
        expect(parsed.revenueLines).toEqual([]);
    });

    it('préserve les lignes de revenu déjà présentes (nouvelle forme repartition/amounts), y compris en Saisie manuelle multi-contenants', () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }, { id: 'act_2', name: 'Sauces' }],
            revenueLines: [
                { id: 'rev_1', label: 'Ventes générales', repartition: 'general', amounts: { general: 1000 } },
                { id: 'rev_2', label: 'Ventes confitures', repartition: 'act_1', amounts: { act_1: 500 } },
                { id: 'rev_3', label: 'Ventes mixtes', repartition: 'manual', amounts: { general: 100, act_1: 200, act_2: 300 } },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.revenueLines).toEqual(legacy.revenueLines);
    });

    it("migre l'ancienne forme à plat (bucket + amount, avant la Saisie manuelle du 13/10) vers { repartition, amounts }", () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            revenueLines: [
                { id: 'rev_1', label: 'Ventes générales', bucket: 'general', amount: 1000 },
                { id: 'rev_2', label: 'Ventes confitures', bucket: 'act_1', amount: 500 },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.revenueLines).toEqual([
            { id: 'rev_1', label: 'Ventes générales', repartition: 'general', amounts: { general: 1000 } },
            { id: 'rev_2', label: 'Ventes confitures', repartition: 'act_1', amounts: { act_1: 500 } },
        ]);
    });

    it("refond le montant d'un contenant orphelin (activité supprimée depuis la sauvegarde) dans Général plutôt que de le perdre", () => {
        const legacy = {
            productionActivities: [{ id: 'act_1', name: 'Confitures' }],
            revenueLines: [
                { id: 'rev_1', label: 'Ventes', repartition: 'act_disparue', amounts: { act_disparue: 1000 } },
                { id: 'rev_2', label: 'Mixte', repartition: 'manual', amounts: { general: 100, act_disparue: 400, act_1: 200 } },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.revenueLines[0]).toEqual({ id: 'rev_1', label: 'Ventes', repartition: 'general', amounts: { general: 1000 } });
        // Le montant de l'activité disparue (400) rejoint le Général déjà présent (100) : 500 $,
        // sans perte — l'activité encore valide (act_1) reste intacte.
        expect(parsed.revenueLines[1]).toEqual({ id: 'rev_2', label: 'Mixte', repartition: 'manual', amounts: { general: 500, act_1: 200 } });
    });

    it("directCostLines absent devient une liste vide (concept entièrement nouveau, Phase 4.3)", () => {
        const parsed = parseProjectData({}, getEmptyState());
        expect(parsed.directCostLines).toEqual([]);
    });

    it('préserve les charges directes déjà présentes telles quelles (pas de migration à faire)', () => {
        const legacy = {
            directCostLines: [
                { id: 'dc_1', label: 'Matières premières', category: 'Matière première', amount: 1000 },
                { id: 'dc_2', label: 'Emballage', category: 'Emballage', amount: 200 },
            ],
        };
        const parsed = parseProjectData(legacy, getEmptyState());
        expect(parsed.directCostLines).toEqual(legacy.directCostLines);
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
