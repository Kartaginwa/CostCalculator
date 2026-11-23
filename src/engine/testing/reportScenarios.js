// Scénarios de recette du rapport PDF (phase 7, 22/11) : le projet démo, modifié de façon à produire les cas limites (projet vide, sans PDS, sans relevés, sans chiffres
// réels, un seul produit, cinquante produits, noms piégés, un seul canal…). Partagé par les tests Vitest (modèle et gabarits) et Playwright (mise en page et impression).
import { getDefaultState, getEmptyState } from '../../state/initialState.js';
import { computeProjectAnalysis } from '../analysisPipeline.js';
import { computeCalculatedGeneralInfo } from '../calculatedGeneralInfo.js';

/** Les entrées d'un rapport pour un état de projet quelconque (mêmes fonctions du moteur que l'application). */
export const inputsFromState = (s) => {
    const base = computeProjectAnalysis({
        products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase, generalInfo: s.generalInfo,
        salesChannels: s.salesChannels, productionActivities: s.productionActivities, expenseLines: s.expenseLines, revenueLines: s.revenueLines,
        directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys,
    });
    const calculatedGeneralInfo = computeCalculatedGeneralInfo({
        generalInfo: base.generalInfo, products: s.products, baseIngredients: s.ingredientsList, laborDatabase: s.laborDatabase,
        productionActivities: s.productionActivities, salesChannels: s.salesChannels,
    });
    return { project: { ...s }, analysisData: base.data, calculatedGeneralInfo };
};

const eachFormat = (s, fn) => s.products.forEach(p => p.formats.forEach(f => fn(f, p)));

/** Copie un produit sous de nouveaux identifiants (pour gonfler un projet). */
const cloneProduct = (p, n) => ({
    ...structuredClone(p), id: `${p.id}_c${n}`, platName: `${p.platName} n° ${n}`,
    formats: p.formats.map(f => ({ ...structuredClone(f), id: `${f.id}_c${n}`, sku: `${f.sku || 'SKU'}-C${n}`, channelPrices: f.channelPrices.map(cp => ({ ...cp, id: `${cp.id}_c${n}` })) })),
});

export const SCENARIOS = {
    'demo': { label: 'projet démo', state: () => getDefaultState() },
    'vide': { label: 'projet vide', state: () => getEmptyState() },
    'sans-pds': { label: 'aucun PDS saisi', state: () => { const s = getDefaultState(); eachFormat(s, f => { f.pds = ''; }); return s; } },
    'sans-releves': { label: 'aucun point de référence', state: () => { const s = getDefaultState(); s.trackingPoints = []; return s; } },
    'un-releve': { label: 'un seul point de référence', state: () => { const s = getDefaultState(); s.trackingPoints = s.trackingPoints.slice(0, 1); return s; } },
    'sans-chiffres-reels': { label: 'aucun chiffre réel (revenus, charges directes)', state: () => { const s = getDefaultState(); s.revenueLines = []; s.directCostLines = []; return s; } },
    'avec-periode': { label: 'période saisie', state: () => { const s = getDefaultState(); s.generalInfo = { ...s.generalInfo, startDate: '2026-10-01', endDate: '2026-10-31' }; return s; } },
    'un-produit': { label: 'un seul produit', state: () => { const s = getDefaultState(); s.products = s.products.filter(p => p.isIngredient || p.id === 'prod_chili'); return s; } },
    'cinquante-produits': {
        label: 'cinquante formats actifs',
        state: () => {
            const s = getDefaultState();
            const finished = s.products.filter(p => !p.isIngredient);
            const sellable = finished.flatMap(p => p.formats).length; // 10 formats vendus dans le démo
            const copies = [];
            for (let n = 1; copies.flatMap(p => p.formats).length + sellable < 50; n++) finished.forEach(p => { if (copies.flatMap(x => x.formats).length + sellable < 50) copies.push(cloneProduct(p, n)); });
            s.products = [...s.products, ...copies];
            return s;
        },
    },
    'produit-sans-prix': {
        label: 'un format sans prix de vente (courbe en $/unité)',
        state: () => {
            const s = getDefaultState();
            const f = s.products.find(p => p.id === 'prod_chili').formats[0];
            f.prixVente = 0; f.pds = ''; f.channelPrices = f.channelPrices.map(cp => ({ ...cp, netPrice: 0 }));
            // Les points de référence enregistrés suivent le même format : il n'avait pas de prix non plus à ces dates.
            s.trackingPoints = s.trackingPoints.map(pt => ({ ...pt, productsWithCosts: pt.productsWithCosts.map(r => (r.id === 'fmt_chili' ? { ...r, prixVente: 0 } : r)) }));
            return s;
        },
    },
    'noms-pieges': {
        label: 'noms avec du HTML et des caractères spéciaux',
        state: () => {
            const s = getDefaultState();
            s.companyName = '<script>alert(1)</script> & "Fils" inc.';
            s.products.find(p => p.id === 'prod_chili').platName = '<img src=x onerror=alert(1)> Chili & "frites"';
            s.ingredientsList[0].name = '<b>Bœuf</b> & cie';
            s.salesChannels[0].name = 'Vente <i>directe</i>';
            return s;
        },
    },
    'un-canal': {
        label: 'un seul canal de vente',
        state: () => {
            const s = getDefaultState();
            const keep = s.salesChannels[0].id;
            s.salesChannels = [s.salesChannels[0]];
            eachFormat(s, f => { f.channelPrices = f.channelPrices.filter(cp => cp.channelId === keep); });
            return s;
        },
    },
    'sans-volumes': { label: 'aucun volume de vente', state: () => { const s = getDefaultState(); eachFormat(s, f => f.channelPrices.forEach(cp => { cp.volume = 0; })); return s; } },
    'sans-nom-ni-logo': { label: 'entreprise sans nom ni logo', state: () => { const s = getDefaultState(); s.companyName = ''; s.logoUrl = ''; return s; } },
    'aucun-poste': { label: 'aucune main-d\'œuvre saisie', state: () => { const s = getDefaultState(); s.laborDatabase = []; return s; } },
    'sans-fournisseur': { label: 'ingrédients sans fournisseur', state: () => { const s = getDefaultState(); s.ingredientsList.forEach(i => { i.provider = ''; }); return s; } },
};

/** Les entrées d'un scénario, ou une erreur claire s'il n'existe pas. */
export const scenarioInputs = (name) => {
    const sc = SCENARIOS[name];
    if (!sc) throw new Error(`Scénario inconnu : ${name}`);
    return inputsFromState(sc.state());
};
