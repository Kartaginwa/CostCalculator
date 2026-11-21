import { describe, it, expect } from 'vitest';
import { computeKeyFindings, buildKeyFindingsContext, FINDING_RULES } from './keyFindings.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';

// Contexte minimal (rien ne s'applique) : chaque test n'ajoute que les données de la règle qu'il vérifie.
const emptyShares = { rows: [], total: 0 };
const vol = { hasEnoughData: false, byName: {}, pointCount: 0 };
const ctx = (o = {}) => ({
    analysis: { activeProducts: [], contributionData: [], menuEngineeringData: {}, menuRevenue: 0, globalBreakEven: 0, ...o.analysis },
    info: { productivityReport: { rows: [] }, ...o.info },
    channelNames: { c1: 'Direct', c2: 'Grandes surfaces' }, trackingPoints: [],
    channelSummaries: [], activitySummaries: [],
    ingredientVolatility: vol, packagingVolatility: vol, ingredientShares: emptyShares, packagingShares: emptyShares,
    cascade: { payroll: 0, unusedShare: null, unusedPay: 0 }, productRows: [], growth: null,
    hasRealData: false, reconciliation: { rows: [] },
    ...o.top,
});
const find = (r, id) => r.all.find(f => f.id === id);

describe('constats clés — principes', () => {
    it('rien ne s\'applique : aucun constat, jamais d\'invention', () => {
        const r = computeKeyFindings(ctx());
        expect(r.all).toEqual([]);
        expect(r.forces).toEqual([]);
        expect(r.faiblesses).toEqual([]);
    });
    it('le contexte se construit sans donnée sans lever d\'erreur, et ne produit aucun constat', () => {
        const built = buildKeyFindingsContext({});
        expect(computeKeyFindings(built).all).toEqual([]);
    });
    it('chaque constat a un ton, un thème, un poids, un titre, un détail et un lien vers un sous-onglet', () => {
        const r = computeKeyFindings(ctx({ analysis: { menuRevenue: 100000, globalBreakEven: 50000 } }));
        expect(r.all.length).toBeGreaterThan(0);
        for (const f of r.all) {
            expect(['force', 'faiblesse']).toContain(f.tone);
            expect(f.theme).toBeTruthy(); expect(f.weight).toBeGreaterThan(0); expect(f.title).toBeTruthy(); expect(f.detail).toBeTruthy();
            expect(f.link.subTab).toBeTruthy(); expect(f.link.label).toBeTruthy();
        }
    });
    it('trie par poids décroissant ; une règle qui échoue se tait sans empêcher les autres', () => {
        const boom = () => { throw new Error('donnée inattendue'); };
        FINDING_RULES.push(boom);
        try {
            const r = computeKeyFindings(ctx({ analysis: { menuRevenue: 100000, globalBreakEven: 99000 } }));
            expect(find(r, 'safety')).toBeTruthy();
        } finally { FINDING_RULES.pop(); }
        const r2 = computeKeyFindings(ctx({ analysis: { menuRevenue: 100000, globalBreakEven: 120000 } }));
        const weights = r2.all.map(f => f.weight);
        expect(weights).toEqual([...weights].sort((a, b) => b - a));
    });
});

describe('constats clés — rentabilité et coûts', () => {
    it('marge de sécurité : négative = urgent (100), mince = faiblesse, confortable = force, entre les deux = muette', () => {
        const run = (rev, be) => find(computeKeyFindings(ctx({ analysis: { menuRevenue: rev, globalBreakEven: be } })), 'safety');
        expect(run(100000, 120000)).toMatchObject({ tone: 'faiblesse', weight: 100 });
        expect(run(100000, 96000)).toMatchObject({ tone: 'faiblesse', weight: 85 });
        expect(run(100000, 80000)).toMatchObject({ tone: 'force' });
        const between = (T.safetyMarginLow + T.safetyMarginComfortable) / 2;
        expect(run(100000, 100000 * (1 - between))).toBeUndefined();
        expect(run(0, 50000)).toBeUndefined();
    });
    it('coût vs cible : sans cible saisie la règle est muette ; au-dessus = faiblesse ; en dessous = force', () => {
        const base = { weightedMaterialCost: 0.35, weightedPackagingCost: 0.07, weightedLaborCost: 0.14 };
        expect(computeKeyFindings(ctx({ analysis: base, info: { foodCostTarget: '' } })).all.filter(f => f.id.startsWith('cost-'))).toEqual([]);
        const r = computeKeyFindings(ctx({ analysis: base, info: { foodCostTarget: '32', packagingCostTarget: '8', laborCostTarget: '22' } }));
        expect(find(r, 'cost-matiere').tone).toBe('faiblesse');
        expect(find(r, 'cost-emballage').tone).toBe('force');
        expect(find(r, 'cost-mo').tone).toBe('force');
    });
    it('produits au-dessus de la cible de coût matière, produit par produit', () => {
        const p = (name, pct) => ({ displayName: name, costs: { costMatierePercent: pct }, channelBreakdown: [] });
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [p('A', 0.40), p('B', 0.20), p('C', 0.35)] }, info: { foodCostTarget: '32' } }));
        expect(find(r, 'cost-matiere-products').title).toContain('2 produits sur 3');
    });
});

describe('constats clés — produits, canaux, activités', () => {
    const prod = (name, margins) => ({ displayName: name, channelBreakdown: margins.map(([channelId, margeNettePercent]) => ({ channelId, margeNettePercent })) });
    it('produits qui perdent de l\'argent, déficitaires partout, rentables partout', () => {
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [prod('A', [['c1', 0.2], ['c2', 0.1]]), prod('B', [['c1', 0.1], ['c2', -0.05]]), prod('C', [['c1', -0.1], ['c2', -0.2]])] } }));
        expect(find(r, 'sku-losers').title).toContain('2 produits sur 3');
        expect(find(r, 'sku-losers').detail).toContain('« C »');
        expect(find(r, 'sku-negative-everywhere').title).toContain('1 produit');
        expect(find(r, 'sku-positive').tone).toBe('force');
        expect(find(r, 'sku-best').title).toContain('« A »');
    });
    it('un produit sans marge calculable n\'est jamais compté comme déficitaire', () => {
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [prod('A', [['c1', NaN]])] } }));
        expect(find(r, 'sku-losers')).toBeUndefined();
    });
    it('dépendance à un canal (revenus et part du bénéfice net), canal déficitaire, meilleure marge', () => {
        const r = computeKeyFindings(ctx({ top: { channelSummaries: [
            { channelId: 'c1', channelName: 'Direct', revenueTotal: 20000, margeNetteTotal: 5000, margeNettePercent: 0.25 },
            { channelId: 'c2', channelName: 'Grandes surfaces', revenueTotal: 80000, margeNetteTotal: 1000, margeNettePercent: 0.0125 },
            { channelId: 'c3', channelName: 'Épiceries', revenueTotal: 10000, margeNetteTotal: -500, margeNettePercent: -0.05 },
        ] } }));
        expect(find(r, 'channel-dependency').title).toContain('Grandes surfaces');
        expect(find(r, 'channel-deficit-c3').tone).toBe('faiblesse');
        expect(find(r, 'channel-best').title).toContain('Direct');
    });
    it('activités : déficitaire, très faible marge, toutes bénéficiaires', () => {
        const act = (activityId, activityName, net, pct) => ({ activityId, activityName, revenueTotal: 10000, margeNetteTotal: net, margeNettePercent: pct });
        const r1 = computeKeyFindings(ctx({ top: { activitySummaries: [act('a', 'Soupes', 900, 0.09), act('b', 'Sauces', 100, 0.01)] } }));
        expect(find(r1, 'activity-low-b')).toBeTruthy();
        expect(find(r1, 'activities-positive').tone).toBe('force');
        const r2 = computeKeyFindings(ctx({ top: { activitySummaries: [act('a', 'Soupes', 900, 0.09), act('b', 'Sauces', -100, -0.01)] } }));
        expect(find(r2, 'activity-deficit-b')).toBeTruthy();
        expect(find(r2, 'activities-positive')).toBeUndefined();
    });
});

describe('constats clés — approvisionnement et main-d\'œuvre', () => {
    it('fournisseur en dépendance et ingrédient de classe A volatil ; stable seulement avec assez de relevés', () => {
        const shares = { rows: [{ provider: 'Boucherie', total: 600, share: 0.6, isDependent: true }], total: 1000 };
        const abc = { A: [{ name: 'Bœuf' }, { name: 'Riz' }] };
        const volatile = { hasEnoughData: true, pointCount: 19, byName: { Bœuf: { isVolatile: true, amplitudePercent: 22 }, Riz: { isVolatile: false } } };
        const r = computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc }, top: { ingredientShares: shares, ingredientVolatility: volatile } }));
        expect(find(r, 'supplier-ing').title).toContain('Boucherie : 60 %');
        expect(find(r, 'volatile-a-ing').title).toContain('1 ingrédient de classe A');
        const stable = { ...volatile, byName: { Bœuf: { isVolatile: false }, Riz: { isVolatile: false } } };
        expect(find(computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc }, top: { ingredientVolatility: stable } })), 'stable-a-ing').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc } })), 'stable-a-ing')).toBeUndefined(); // moins de 2 relevés : muette
    });
    it('perte stock : élevée (faiblesse, avec l\'article le plus coûteux) ou faible (force)', () => {
        const report = (loss) => ({ grandTotal: { loss, total: 1000 }, groupedByProvider: { P: { items: [{ name: 'Bœuf', lossCost: loss }] } } });
        const hi = find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(60) } })), 'loss-high');
        expect(hi.detail).toContain('Bœuf');
        expect(find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(5) } })), 'loss-low').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(20) } })), 'loss-high')).toBeUndefined(); // 2 % : entre les seuils
    });
    it('paie non utilisée : seuil haut = faiblesse, seuil bas = force', () => {
        const run = (share) => computeKeyFindings(ctx({ top: { cascade: { payroll: 10000, unusedShare: share, unusedPay: share * 10000 } } }));
        expect(find(run(0.22), 'labor-unused').tone).toBe('faiblesse');
        expect(find(run(0.05), 'labor-used').tone).toBe('force');
        expect(find(run(0.12), 'labor-unused')).toBeUndefined();
    });
    it('rentabilité de l\'heure : meilleur et mauvais produits (au moins trois produits avec ratio), revente ignorée', () => {
        const row = (name, hours, gp, isResale = false) => ({ name, hours, grossProfit: gp, isResale, grossProfitPerHour: isResale ? null : gp / hours });
        const rows = [row('A', 10, 2500), row('B', 10, 1500), row('C', 10, 300), row('R', 0, 4000, true)];
        const r = computeKeyFindings(ctx({ top: { productRows: rows } }));
        expect(find(r, 'product-best-hour').title).toContain('« A »');
        expect(find(r, 'product-worst-hour').title).toContain('« C »');
        expect(computeKeyFindings(ctx({ top: { productRows: rows.slice(0, 2) } })).all).toEqual([]);
    });
    it('marge de croissance : seulement à partir d\'une part minimale des heures productives attendues', () => {
        const g = (h) => ({ freeHours: h, additionalRevenue: h * 250, revenuePerHour: 250, grossProfitPerHour: 100, additionalGrossProfit: h * 100 });
        const cascade = { payroll: 10000, unusedShare: 0.12, unusedPay: 1200, expectedHours: 400 };   // seuil : 5 % de 400 h = 20 h
        expect(find(computeKeyFindings(ctx({ top: { growth: g(32), cascade } })), 'labor-growth').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ top: { growth: g(12), cascade } })), 'labor-growth')).toBeUndefined();
    });
});

describe('constats clés — réel vs théorique et évolution', () => {
    const rows = (rev, direct, net) => [
        { label: 'Revenus', real: 80000, theoretical: 79714, diff: 286, diffPercent: rev },
        { label: 'Charges directes', real: 48000, theoretical: 45356, diff: 2644, diffPercent: direct },
        { label: 'Bénéfice net', real: 4000, theoretical: 6299, diff: -2299, diffPercent: net },
    ];
    it('muet sans aucun chiffre réel saisi (jamais des zéros comparés au théorique)', () => {
        expect(computeKeyFindings(ctx({ top: { hasRealData: false, reconciliation: { rows: rows(0.004, 0.058, -0.365) } } })).all.filter(f => f.id.startsWith('rec-'))).toEqual([]);
    });
    it('revenus alignés (force), charges directes au-dessus (faiblesse), bénéfice net sous le modèle (faiblesse)', () => {
        const r = computeKeyFindings(ctx({ top: { hasRealData: true, reconciliation: { rows: rows(0.004, 0.058, -0.365) } } }));
        expect(find(r, 'rec-revenue').tone).toBe('force');
        expect(find(r, 'rec-direct').tone).toBe('faiblesse');
        expect(find(r, 'rec-net').tone).toBe('faiblesse');
        expect(find(computeKeyFindings(ctx({ top: { hasRealData: true, reconciliation: { rows: rows(0.2, 0, 0.3) } } })), 'rec-net').tone).toBe('force');
    });
    it('évolution : il faut au moins deux points de référence', () => {
        const point = (name, timestamp, gross, mat) => ({ name, timestamp, productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: gross, costMatierePercent: mat, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] });
        const a = { weightedGrossMargin: 0.40, weightedMaterialCost: 0.36 };
        expect(computeKeyFindings(ctx({ analysis: a, top: { trackingPoints: [point('Premier', '2026-01-01', 0.45, 0.33)] } })).all).toEqual([]);
        const r = computeKeyFindings(ctx({ analysis: a, top: { trackingPoints: [point('Premier', '2026-01-01', 0.45, 0.33), point('Dernier', '2026-06-01', 0.42, 0.34)] } }));
        expect(find(r, 'history-gross')).toMatchObject({ tone: 'faiblesse' });
        expect(find(r, 'history-material')).toMatchObject({ tone: 'faiblesse' });
    });
});
