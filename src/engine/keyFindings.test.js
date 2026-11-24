import { describe, it, expect } from 'vitest';
import { computeKeyFindings, buildKeyFindingsContext, FINDING_RULES } from './keyFindings.js';
import { STRUCTURAL } from './findingMeta.js';
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
    it('rien ne s\'applique : aucun constat, jamais d\'invention', () => {
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
    it('trie par poids décroissant ; une règle qui échoue se tait sans empêcher les autres', () => {
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
    it('marge de sécurité : négative = urgent (100), mince = faiblesse, confortable = force, entre les deux = muette', () => {
        const run = (rev, be) => find(computeKeyFindings(ctx({ analysis: { menuRevenue: rev, globalBreakEven: be } })), 'safety');
        expect(run(100000, 120000)).toMatchObject({ tone: 'faiblesse', weight: 100 });
        expect(run(100000, 96000)).toMatchObject({ tone: 'faiblesse', weight: 85 });
        expect(run(100000, 80000)).toMatchObject({ tone: 'force' });
        const between = (T.safetyMarginLow + T.safetyMarginComfortable) / 2;
        expect(run(100000, 100000 * (1 - between))).toBeUndefined();
        expect(run(0, 50000)).toBeUndefined();
    });
    it('coût vs cible : sans cible saisie la règle est muette ; au-dessus = faiblesse ; en dessous = force', () => {
        const base = { weightedMaterialCost: 0.35, weightedPackagingCost: 0.07, weightedLaborCost: 0.14 };
        expect(computeKeyFindings(ctx({ analysis: base, info: { foodCostTarget: '' } })).all.filter(f => f.id.startsWith('cost-'))).toEqual([]);
        const r = computeKeyFindings(ctx({ analysis: base, info: { foodCostTarget: '32', packagingCostTarget: '8', laborCostTarget: '22' } }));
        expect(find(r, 'cost-matiere').tone).toBe('faiblesse');
        expect(find(r, 'cost-emballage').tone).toBe('force');
        expect(find(r, 'cost-mo').tone).toBe('force');
    });
    it('produits au-dessus de la cible de coût matière : dits dans le détail du constat du coût matière, sans constat à part', () => {
        const p = (name, pct) => ({ displayName: name, costs: { costMatierePercent: pct }, channelBreakdown: [] });
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [p('A', 0.40), p('B', 0.20), p('C', 0.35)], weightedMaterialCost: 0.33 }, info: { foodCostTarget: '32' } }));
        expect(find(r, 'cost-matiere-products')).toBeUndefined();
        expect(find(r, 'cost-matiere').detail).toContain('2 produits sur 3 dépassent cette cible : A, C');
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
    it('activités : déficitaire, très faible marge, toutes bénéficiaires', () => {
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
    it('fournisseur en dépendance et ingrédient de classe A volatil ; stable seulement avec assez de relevés', () => {
        const shares = { rows: [{ provider: 'Boucherie', total: 600, share: 0.6, isDependent: true }], total: 1000 };
        const abc = { A: [{ name: 'Bœuf' }, { name: 'Riz' }] };
        const volatile = { hasEnoughData: true, pointCount: 19, byName: { Bœuf: { isVolatile: true, amplitudePercent: 22 }, Riz: { isVolatile: false } } };
        const r = computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc }, top: { ingredientShares: shares, ingredientVolatility: volatile } }));
        expect(find(r, 'supplier-ing').title).toContain('Boucherie : 60 %');
        expect(find(r, 'volatile-a-ing').title).toContain('1 ingrédient de classe A');
        const stable = { ...volatile, byName: { Bœuf: { isVolatile: false }, Riz: { isVolatile: false } } };
        expect(find(computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc }, top: { ingredientVolatility: stable } })), 'stable-a-ing').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ analysis: { abcAnalysisData: abc } })), 'stable-a-ing')).toBeUndefined(); // moins de 2 relevés : muette
    });
    it('perte en stock : élevée (faiblesse, avec l\'article le plus coûteux) ou faible (force)', () => {
        const report = (loss) => ({ grandTotal: { loss, total: 1000 }, groupedByProvider: { P: { items: [{ name: 'Bœuf', lossCost: loss }] } } });
        const hi = find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(60) } })), 'loss-high');
        expect(hi.detail).toContain('Bœuf');
        expect(find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(5) } })), 'loss-low').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ analysis: { purchasingReportData: report(20) } })), 'loss-high')).toBeUndefined(); // 2 % : entre les seuils
    });
    it('paie non utilisée : seuil haut = faiblesse, seuil bas = force', () => {
        const run = (share) => computeKeyFindings(ctx({ top: { cascade: { payroll: 10000, unusedShare: share, unusedPay: share * 10000 } } }));
        expect(find(run(0.22), 'labor-unused').tone).toBe('faiblesse');
        expect(find(run(0.05), 'labor-used').tone).toBe('force');
        expect(find(run(0.12), 'labor-unused')).toBeUndefined();
    });
    it('rentabilité de l\'heure : meilleur et mauvais produits (au moins trois produits avec ratio), revente ignorée', () => {
        const row = (name, hours, gp, isResale = false) => ({ name, hours, grossProfit: gp, isResale, grossProfitPerHour: isResale ? null : gp / hours });
        const rows = [row('A', 10, 2500), row('B', 10, 1500), row('C', 10, 300), row('R', 0, 4000, true)];
        // La moyenne est celle de l'écran Main-d'œuvre (marge de croissance) : le constat la lit, il ne la recalcule pas.
        const r = computeKeyFindings(ctx({ top: { productRows: rows, growth: { freeHours: 0, additionalRevenue: 0, grossProfitPerHour: 100 } } }));
        expect(find(r, 'product-best-hour').title).toContain('« A »');
        expect(find(r, 'product-worst-hour').title).toContain('« C »');
        expect(computeKeyFindings(ctx({ top: { productRows: rows.slice(0, 2) } })).all).toEqual([]);
    });
    it('marge de croissance : seulement à partir d\'une part minimale des heures productives attendues', () => {
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
    it('évolution : comparée au DERNIER point de référence (un seul suffit), muette sans point', () => {
        const point = (name, timestamp, gross, mat) => ({ name, timestamp, productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: gross, costMatierePercent: mat, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] });
        const a = { weightedGrossMargin: 0.40, weightedMaterialCost: 0.36 };
        expect(computeKeyFindings(ctx({ analysis: a })).all).toEqual([]);
        expect(find(computeKeyFindings(ctx({ analysis: a, top: { trackingPoints: [point('Premier', '2026-01-01', 0.45, 0.33)] } })), 'history-gross').title).toContain('Premier');
        const r = computeKeyFindings(ctx({ analysis: a, top: { trackingPoints: [point('Premier', '2026-01-01', 0.45, 0.33), point('Dernier', '2026-06-01', 0.42, 0.34)] } }));
        expect(find(r, 'history-gross').title).toContain('constante');
        expect(find(r, 'history-gross')).toMatchObject({ tone: 'faiblesse' });
        expect(find(r, 'history-material')).toMatchObject({ tone: 'faiblesse' });
    });
});

describe('constats clés — trois groupes (test)', () => {
    it('chaque constat appartient à un seul groupe : objectifs (cibles), évolution (points de référence), forces et faiblesses (le reste)', () => {
        const r = computeKeyFindings(ctx({
            analysis: { weightedMaterialCost: 0.35, menuRevenue: 100000, globalBreakEven: 120000, weightedGrossMargin: 0.40 },
            info: { foodCostTarget: '32' },
            top: { trackingPoints: [
                { name: 'Premier', timestamp: '2026-01-01', productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: 0.45, costMatierePercent: 0.33, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] },
                { name: 'Dernier', timestamp: '2026-06-01', productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: 0.44, costMatierePercent: 0.34, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] },
            ] },
        }));
        const g = r.groups;
        expect(g.objectif.all.map(f => f.id)).toEqual(['cost-matiere']);
        expect(g.evolution.all.map(f => f.id)).toContain('history-gross');
        expect(g.structure.all.map(f => f.id)).toContain('safety');
        // partition : aucun constat perdu, aucun en double
        const total = g.objectif.all.length + g.evolution.all.length + g.structure.all.length;
        expect(total).toBe(r.all.length);
        r.all.forEach(f => expect(['objectif', 'evolution', 'structure']).toContain(f.group));
    });
    it('chaque groupe sépare ses constats positifs et négatifs', () => {
        const r = computeKeyFindings(ctx({ analysis: { weightedPackagingCost: 0.07, weightedMaterialCost: 0.35 }, info: { foodCostTarget: '32', packagingCostTarget: '8' } }));
        expect(r.groups.objectif.forces.map(f => f.id)).toEqual(['cost-emballage']);
        expect(r.groups.objectif.faiblesses.map(f => f.id)).toEqual(['cost-matiere']);
    });
});

describe('constats clés — règles de tendance', () => {
    const row = (id, cost, price, vol, net) => ({ id, displayName: `Plat ${id}`, onMenu: true, costs: { totalCostPerPortion: cost }, channelBreakdown: [{ channelId: 'c1', netPrice: price, volume: vol, margeNettePercent: net }] });
    const snap = (name, ts, rows) => ({ name, timestamp: ts, productsWithCosts: rows, generalInfo: {} });
    const base = (now, then, extra = {}) => ctx({ analysis: { activeProducts: now, weightedGrossMargin: 0.5, weightedMaterialCost: 0.3, weightedPackagingCost: 0.05, weightedLaborCost: 0.2 }, top: { trackingPoints: [snap('Départ', '2026-01-01', then)], ...extra } });
    it('muettes sans point de référence (un seul suffit pour comparer à aujourd’hui)', () => {
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [row('a', 5, 10, 100, 0.2)] }, top: { trackingPoints: [snap('Seul', '2026-01-01', [row('a', 5, 10, 100, 0.2)])] } }));
        expect(r.all.filter(f => f.id.startsWith('history-') && f.id !== 'history-revenue')).toEqual([]);
    });
    it('revenus en hausse (force) et en baisse (faiblesse)', () => {
        expect(find(computeKeyFindings(base([row('a', 5, 10, 150, 0.2)], [row('a', 5, 10, 100, 0.2)])), 'history-revenue').tone).toBe('force');
        expect(find(computeKeyFindings(base([row('a', 5, 10, 50, 0.2)], [row('a', 5, 10, 100, 0.2)])), 'history-revenue').tone).toBe('faiblesse');
    });
    it('marge nette en baisse', () => {
        const f = find(computeKeyFindings(base([row('a', 5, 10, 100, 0.1)], [row('a', 5, 10, 100, 0.2)])), 'history-net');
        expect(f.tone).toBe('faiblesse');
        expect(f.group).toBe('evolution');
    });
    it('coût de revient en hausse sans hausse de prix : érosion de marge', () => {
        const r = computeKeyFindings(base([row('a', 6, 10, 100, 0.2)], [row('a', 5, 10, 100, 0.2)]));
        expect(find(r, 'history-sku-cost-up').tone).toBe('faiblesse');
        expect(find(r, 'history-erosion').detail).toContain('Plat a');
        // le prix suit : plus d'érosion
        expect(find(computeKeyFindings(base([row('a', 6, 12, 100, 0.2)], [row('a', 5, 10, 100, 0.2)])), 'history-erosion')).toBeUndefined();
    });
    it('coût de revient en baisse : force', () => {
        expect(find(computeKeyFindings(base([row('a', 4, 10, 100, 0.2)], [row('a', 5, 10, 100, 0.2)])), 'history-sku-cost-down').tone).toBe('force');
    });
    it('hausse soutenue d\'un ingrédient (3 relevés) : faiblesse ; 2 relevés seulement : muette', () => {
        const mk = (count) => ({ hasEnoughData: true, pointCount: count, list: [{ id: 1, name: 'Beurre', provider: 'X', count, trendPercent: 25 }], byName: {} });
        const hit = computeKeyFindings(base([], [], { ingredientVolatilityRecent: mk(3) }));
        expect(find(hit, 'history-price-up-ing').detail).toContain('Beurre');
        expect(find(computeKeyFindings(base([], [], { ingredientVolatilityRecent: mk(2) })), 'history-price-up-ing')).toBeUndefined();
    });
    it('canal en croissance', () => {
        const mk = (vol) => [{ id: 'a', displayName: 'Plat a', onMenu: true, costs: {}, channelBreakdown: [{ channelId: 'c2', netPrice: 10, volume: vol, margeNettePercent: 0.2 }] }];
        expect(find(computeKeyFindings(base(mk(200), mk(100))), 'history-channel-up').title).toContain('Grandes surfaces');
    });
});

describe('constats clés — séries et règles complémentaires', () => {
    const point = (name, timestamp, gross) => ({ name, timestamp, productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: gross, costMatierePercent: 0.3, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] });
    it('une baisse constante sur trois valeurs est une tendance, qui remplace la variation simple', () => {
        const r = computeKeyFindings(ctx({ analysis: { weightedGrossMargin: 0.40 }, top: { trackingPoints: [point('A', '2025-01-01', 0.46), point('B', '2025-06-01', 0.43)] } }));
        expect(find(r, 'history-gross').title).toContain('constante');
        expect(find(r, 'history-gross').tone).toBe('faiblesse');
    });
    it('pas de tendance si la mesure remonte entre deux relevés', () => {
        const r = computeKeyFindings(ctx({ analysis: { weightedGrossMargin: 0.40 }, top: { trackingPoints: [point('A', '2025-01-01', 0.40), point('B', '2025-06-01', 0.46)] } }));
        expect(find(r, 'history-gross').title).not.toContain('constante');
    });
    const seg = (o) => ({ channelId: 'c1', channelName: 'Direct', revenueTotal: 100000, margeBruteTotal: 40000, costLaborTotal: 10000, costAgingTotal: 0, totalIndirectTotal: 20000, totalDirectCostTotal: 60000, costMatiereTotal: 30000, costPackagingTotal: 5000, costIndirectChannelTotal: 0, margeNetteTotal: 20000, margeNettePercent: 0.2, ...o });
    it('frais fixes : couverture, poids dans les revenus, main-d’œuvre dans les coûts', () => {
        const r = computeKeyFindings(ctx({ top: { channelSummaries: [seg()] } }));
        expect(find(r, 'fixed-cover').tone).toBe('force');
        expect(find(r, 'fixed-share')).toBeUndefined();
        const lourd = computeKeyFindings(ctx({ top: { channelSummaries: [seg({ totalIndirectTotal: 40000, costLaborTotal: 30000, margeBruteTotal: 20000 })] } }));
        expect(find(lourd, 'fixed-share').tone).toBe('faiblesse');
        expect(find(lourd, 'fixed-cover').tone).toBe('faiblesse');
    });
    it('sensibilité : le bénéfice résiste ou non à +5 % des intrants', () => {
        const net = (v) => ({ rows: [{ label: 'Bénéfice net', theoretical: v, real: null, diffPercent: null }] });
        expect(find(computeKeyFindings(ctx({ top: { channelSummaries: [seg()], reconciliation: net(20000) } })), 'sens-inputs').tone).toBe('force');
        expect(find(computeKeyFindings(ctx({ top: { channelSummaries: [seg()], reconciliation: net(1000) } })), 'sens-inputs').tone).toBe('faiblesse');
    });
    it('canaux : écart de marge et frais de mise en marché', () => {
        const rows = [seg({ channelId: 'a', channelName: 'A', margeNettePercent: 0.3, margeNetteTotal: 30000 }), seg({ channelId: 'b', channelName: 'B', margeNettePercent: 0.05, margeNetteTotal: 5000, costIndirectChannelTotal: 20000 })];
        const r = computeKeyFindings(ctx({ top: { channelSummaries: rows } }));
        expect(find(r, 'channel-gap').tone).toBe('faiblesse');
        expect(find(r, 'channel-fees').detail).toBeTruthy();
    });
    it('main-d’œuvre : poste surchargé et poste sous-utilisé', () => {
        const info = { productivityReport: { rows: [{ postName: 'Cuisine', actual: 10, expected: 8, utilization: 125 }, { postName: 'Emballage', actual: 3, expected: 10, utilization: 30 }], byActivity: [] } };
        const r = computeKeyFindings(ctx({ info }));
        expect(find(r, 'post-overloaded').title).toContain('1 poste');
        expect(find(r, 'post-underused').detail).toContain('Emballage');
    });
    it('approvisionnement : un autre fournisseur moins cher pour le même ingrédient (perte incluse)', () => {
        const used = { groupedByProvider: { X: { items: [{ id: 1, name: 'Beurre', unit: 'kg', unitPrice: 10, lossPercentage: 0, totalQuantity: 100, totalCost: 1000, purchaseCost: 1000 }] } }, grandTotal: { total: 1000, loss: 0 } };
        const base = [{ id: 1, name: 'Beurre', unit: 'kg', unitPrice: 10, provider: 'X' }, { id: 2, name: 'beurre', unit: 'kg', unitPrice: 8, provider: 'Y', lossPercentage: 0 }];
        const r = computeKeyFindings(ctx({ analysis: { purchasingReportData: used }, top: { baseIngredients: base } }));
        expect(find(r, 'supplier-cheaper').detail).toContain('Y');
    });
});

describe('constats clés — évolution : point identique à aujourd’hui, 12 mois, hiérarchie', () => {
    const iso = (monthsAgo) => new Date(Date.now() - monthsAgo * 30.4 * 86400000).toISOString();
    const point = (name, monthsAgo, gross) => ({ name, timestamp: iso(monthsAgo), productsWithCosts: [{ onMenu: true, salesMix: '100', prixVente: '10', costs: { margeBrutePercent: gross, costMatierePercent: 0.3, costPackagingPercent: 0, costLaborPercent: 0 }, channelBreakdown: [] }] });
    it('un dernier point identique à la situation actuelle est écarté : on compare au précédent', () => {
        const r = computeKeyFindings(ctx({ analysis: { weightedGrossMargin: 0.40, weightedMaterialCost: 0.3 }, top: { trackingPoints: [point('Avant', 2, 0.44), point('Situation actuelle', 0, 0.40)] } }));
        expect(find(r, 'history-gross').title).toContain('Avant');
    });
    it('recul de 12 mois : le relevé d’il y a un an, quand il diffère du relevé récent', () => {
        const r = computeKeyFindings(ctx({ analysis: { weightedGrossMargin: 0.40, weightedMaterialCost: 0.3 }, top: { trackingPoints: [point('Il y a un an', 12, 0.48), point('Récent', 1, 0.41)] } }));
        expect(find(r, 'history-gross-12m').title).toContain('sur 12 mois');
        expect(find(r, 'history-gross-12m').tone).toBe('faiblesse');
    });
    it('hiérarchie : la survie passe avant tout, puis l’impact en $ à l’intérieur d’un niveau', () => {
        const r = computeKeyFindings(ctx({
            analysis: { menuRevenue: 100000, globalBreakEven: 120000 },
            top: { cascade: { payroll: 50000, unusedShare: 0.2, unusedPay: 10000 }, channelSummaries: [] },
        }));
        const ids = r.all.map(f => f.id);
        expect(ids.indexOf('safety')).toBeLessThan(ids.indexOf('labor-unused'));
        expect(find(r, 'safety').tier).toBe(1);
        expect(find(r, 'labor-unused').tier).toBe(3);
        expect(find(r, 'labor-unused').impact).toBe(10000);
        for (let i = 1; i < r.all.length; i++) expect(r.all[i - 1].rank).toBeGreaterThanOrEqual(r.all[i].rank);
    });
    it('même niveau : le constat au plus grand impact en $ passe en premier', () => {
        const mk = (name, loss) => ({ groupedByProvider: { X: { items: [{ id: 1, name, unit: 'kg', unitPrice: 10, lossPercentage: 0, totalQuantity: 100, totalCost: 1000, purchaseCost: 1000, lossCost: loss }] } }, grandTotal: { total: 1000, loss } });
        const r = computeKeyFindings(ctx({ analysis: { menuRevenue: 100000, purchasingReportData: mk('Beurre', 900) }, top: { cascade: { payroll: 50000, unusedShare: 0.2, unusedPay: 500 } } }));
        const ids = r.all.map(f => f.id);
        expect(ids.indexOf('loss-high')).toBeLessThan(ids.indexOf('labor-unused'));
    });
});

describe('constats clés — forces miroirs et gravité structurelle (23/11)', () => {
    it('toutes les cibles de coûts atteintes (au moins deux saisies) : une force majeure ; une seule dépassée : aucune', () => {
        const a = { weightedMaterialCost: 0.30, weightedPackagingCost: 0.05, weightedLaborCost: 0.2 };
        const ok = computeKeyFindings(ctx({ analysis: a, info: { foodCostTarget: '32', packagingCostTarget: '8', laborCostTarget: '22' } }));
        expect(find(ok, 'targets-all-met')).toMatchObject({ tone: 'force', severity: 'major', scope: 'general' });
        expect(find(ok, 'targets-all-met').title).toContain('3 cibles');
        const one = computeKeyFindings(ctx({ analysis: a, info: { foodCostTarget: '32' } }));
        expect(find(one, 'targets-all-met')).toBeUndefined();
        const over = computeKeyFindings(ctx({ analysis: { ...a, weightedMaterialCost: 0.35 }, info: { foodCostTarget: '32', packagingCostTarget: '8' } }));
        expect(find(over, 'targets-all-met')).toBeUndefined();
    });
    const prod = (id, margin) => ({ id, displayName: `Plat ${id}`, onMenu: true, channelBreakdown: [{ channelId: 'c1', margeNettePercent: margin, netPrice: 10, volume: 100 }] });
    it('aucun produit ne perd d\'argent : force majeure, qui remplace « N produits rentables »', () => {
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [prod('a', 0.2), prod('b', 0.1), prod('c', 0.3)] } }));
        expect(find(r, 'sku-none-losing')).toMatchObject({ tone: 'force', severity: 'major' });
        expect(find(r, 'sku-positive')).toBeUndefined();
        const mixed = computeKeyFindings(ctx({ analysis: { activeProducts: [prod('a', 0.2), prod('b', -0.1), prod('c', 0.3)] } }));
        expect(find(mixed, 'sku-none-losing')).toBeUndefined();
        expect(find(mixed, 'sku-positive')).toBeDefined();
    });
    const seg = (id, name, rev) => ({ channelId: id, channelName: name, revenueTotal: rev, margeNetteTotal: rev * 0.1, margeNettePercent: 0.1, margeBruteTotal: rev * 0.4, costLaborTotal: 0, costAgingTotal: 0, totalIndirectTotal: 0, totalDirectCostTotal: rev * 0.6, costMatiereTotal: 0, costPackagingTotal: 0, costIndirectChannelTotal: 0 });
    it('revenus bien répartis entre les canaux : force majeure ; un canal à 40 % ou plus : la dépendance, pas la force', () => {
        const even = computeKeyFindings(ctx({ top: { channelSummaries: [seg('c1', 'Direct', 3500), seg('c2', 'Épiceries', 3200), seg('c3', 'GS', 3300)] } }));
        expect(find(even, 'channel-balanced')).toMatchObject({ tone: 'force', severity: 'major' });
        expect(find(even, 'channel-dependency')).toBeUndefined();
        const dep = computeKeyFindings(ctx({ top: { channelSummaries: [seg('c1', 'Direct', 6000), seg('c2', 'GS', 2000)] } }));
        expect(find(dep, 'channel-dependency').severity).toBe('major');
        expect(find(dep, 'channel-balanced')).toBeUndefined();
    });
    it('fournisseurs répartis dès trois fournisseurs sans dépendance : force majeure', () => {
        const shares = (rows) => ({ rows, total: 100 });
        const ok = computeKeyFindings(ctx({ top: { ingredientShares: shares([{ provider: 'A', share: 0.28, isDependent: false }, { provider: 'B', share: 0.27, isDependent: false }, { provider: 'C', share: 0.25, isDependent: false }]) } }));
        expect(find(ok, 'supplier-spread')).toMatchObject({ tone: 'force', severity: 'major' });
        const dep = computeKeyFindings(ctx({ top: { ingredientShares: shares([{ provider: 'A', share: 0.5, isDependent: true }, { provider: 'B', share: 0.3, isDependent: false }, { provider: 'C', share: 0.2, isDependent: false }]) } }));
        expect(find(dep, 'supplier-spread')).toBeUndefined();
    });
    it('un constat spécifique sans enjeu en dollars n\'est plus majeur à cause de son poids (« rentable partout »)', () => {
        const r = computeKeyFindings(ctx({ analysis: { activeProducts: [prod('a', 0.2), prod('b', -0.1)] } }));
        expect(find(r, 'sku-best')).toBeUndefined(); // 2 canaux requis
        const two = (id, m) => ({ ...prod(id, m), channelBreakdown: [{ channelId: 'c1', margeNettePercent: m, netPrice: 10, volume: 100 }, { channelId: 'c2', margeNettePercent: m, netPrice: 10, volume: 100 }] });
        const best = computeKeyFindings(ctx({ analysis: { activeProducts: [two('a', 0.2), prod('b', -0.1)] } }));
        expect(find(best, 'sku-best').severity).toBe('medium');
    });
    it('chaque faiblesse structurelle a sa force miroir, de même gravité', () => {
        const pairs = [['channel-dependency', 'channel-balanced'], ['supplier-ing', 'supplier-spread'], ['sku-losers', 'sku-none-losing'], ['profit-concentration', 'profit-spread'], ['labor-unused', 'labor-used'], ['cost-matiere', 'targets-all-met']];
        for (const [, mirror] of pairs) expect(STRUCTURAL.test(mirror), mirror).toBe(true);
        for (const [weakId] of pairs.slice(0, 5)) expect(STRUCTURAL.test(weakId) || weakId === 'labor-unused', weakId).toBe(true);
    });
});
