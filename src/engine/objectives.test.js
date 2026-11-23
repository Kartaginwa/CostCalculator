import { describe, it, expect } from 'vitest';
import { INDICATORS, DEFAULT_OBJECTIVES, MAX_CUSTOM_OBJECTIVES, evaluateObjectives, activeTarget, isObjectiveOff } from './objectives.js';
import { computeKeyFindings } from './keyFindings.js';
import { classifyFinding } from './findingMeta.js';
import { demoContext } from './testing/demoFindingsContext.js';

// Objectifs stratégiques (24/11) : catalogue, évaluation, désactivation, objectifs sur mesure et constats qui en découlent.
const baseCtx = (info = {}, analysis = {}, top = {}) => ({
    analysis: { activeProducts: [], contributionData: [], menuEngineeringData: {}, menuRevenue: 100000, globalBreakEven: 80000, weightedGrossMargin: 0.42, weightedMaterialCost: 0.33,
        weightedPackagingCost: 0.07, weightedLaborCost: 0.2, purchasingReportData: { grandTotal: { loss: 800, total: 20000 } }, ...analysis },
    info: { productivityReport: { rows: [], totals: { expected: 100, actual: 90, utilization: 90 } }, ...info },
    channelNames: {}, trackingPoints: [], channelSummaries: [{ channelId: 'c1', channelName: 'Direct', revenueTotal: 100000, totalIndirectTotal: 30000, margeNetteTotal: 8000 }],
    activitySummaries: [], ingredientVolatility: { hasEnoughData: false, byName: {}, pointCount: 0 }, packagingVolatility: { hasEnoughData: false, byName: {}, pointCount: 0 },
    ingredientShares: { rows: [{ provider: 'A', share: 0.4, isDependent: true }], total: 1 }, packagingShares: { rows: [], total: 0 },
    cascade: { payroll: 50000, unusedShare: 0.18, unusedPay: 9000 }, productRows: [], growth: null, hasRealData: false,
    reconciliation: { rows: [{ label: 'Bénéfice net', theoretical: 8000, real: null, diffPercent: null }] },
    ...top,
});
const byKey = (list, key) => list.find(o => o.key === key);

describe('catalogue', () => {
    it('neuf objectifs par défaut, une quinzaine d\'indicateurs, chaque objectif par défaut a son indicateur et son champ', () => {
        expect(DEFAULT_OBJECTIVES).toHaveLength(9);
        expect(Object.keys(INDICATORS).length).toBe(15);
        for (const o of DEFAULT_OBJECTIVES) { expect(INDICATORS[o.id]).toBeTruthy(); expect(o.field).toMatch(/Target$/); }
        expect(DEFAULT_OBJECTIVES.filter(o => o.principal).map(o => o.id)).toEqual(['matiere', 'emballage', 'mo', 'margeBrute']);
        expect(MAX_CUSTOM_OBJECTIVES).toBe(20);
    });
    it('le sens naturel : un coût « au plus », une marge « au moins »', () => {
        expect(INDICATORS.matiere.dir).toBe('max');
        expect(INDICATORS.perteStock.dir).toBe('max');
        expect(INDICATORS.margeBrute.dir).toBe('min');
        expect(INDICATORS.utilisation.dir).toBe('min');
    });
});

describe('évaluation', () => {
    it('sans valeur saisie, un objectif est muet (ni atteint, ni manqué)', () => {
        const list = evaluateObjectives(baseCtx());
        for (const o of list) { expect(o.met).toBeNull(); expect(o.gap).toBeNull(); }
        expect(list.every(o => o.hasTarget === false)).toBe(true);
    });
    it('« au plus » : atteint quand la valeur est sous la cible, manqué sinon, avec l\'écart', () => {
        const list = evaluateObjectives(baseCtx({ foodCostTarget: '32', packagingCostTarget: '8' }));
        expect(byKey(list, 'matiere')).toMatchObject({ met: false, dir: 'max', target: 32 });
        expect(byKey(list, 'matiere').gap).toBeCloseTo(1, 6);
        expect(byKey(list, 'emballage').met).toBe(true);
    });
    it('« au moins » : la marge brute et le taux d\'utilisation (ligne Total de Main-d\'œuvre)', () => {
        const list = evaluateObjectives(baseCtx({ grossMarginTarget: '40', utilizationTarget: '95' }));
        expect(byKey(list, 'margeBrute')).toMatchObject({ met: true, current: expect.closeTo(42, 6) });
        expect(byKey(list, 'utilisation')).toMatchObject({ met: false, current: 90 });
        expect(byKey(list, 'utilisation').gap).toBeCloseTo(5, 6);
    });
    it('reprend les valeurs déjà calculées : paie non utilisée, perte stock, frais fixes, marge nette', () => {
        const list = evaluateObjectives(baseCtx({ unusedPayTarget: '15', lossTarget: '5', fixedShareTarget: '35', netMarginTarget: '10' }));
        expect(byKey(list, 'paieNonUtilisee')).toMatchObject({ met: false, current: expect.closeTo(18, 6) });
        expect(byKey(list, 'perteStock')).toMatchObject({ met: true, current: expect.closeTo(4, 6) });
        expect(byKey(list, 'fraisFixes')).toMatchObject({ met: true, current: expect.closeTo(30, 6) });
        expect(byKey(list, 'margeNette')).toMatchObject({ met: false, current: expect.closeTo(8, 6) });
    });
    it('sans donnée, l\'objectif reste muet même avec une valeur : une donnée absente reste absente', () => {
        const ctx = baseCtx({ utilizationTarget: '85', productivityReport: { rows: [], totals: { expected: 0, actual: 0, utilization: 0 } } });
        expect(byKey(evaluateObjectives(ctx), 'utilisation')).toMatchObject({ met: null, current: null });
    });
    it('désactivé sans être supprimé : la valeur est gardée, mais l\'objectif n\'agit plus', () => {
        const info = { foodCostTarget: '32', objectivesOff: ['matiere'] };
        expect(isObjectiveOff(info, 'matiere')).toBe(true);
        expect(activeTarget(info, 'matiere')).toBe('');
        expect(info.foodCostTarget).toBe('32');
        const o = byKey(evaluateObjectives(baseCtx(info)), 'matiere');
        expect(o).toMatchObject({ enabled: false, met: null, hasTarget: true, target: 32 });
        expect(activeTarget({ foodCostTarget: '32' }, 'matiere')).toBe('32');
    });
});

describe('objectifs sur mesure', () => {
    const custom = (o) => ({ id: 'custom_1', indicator: 'partFournisseur', dir: 'max', value: '30', name: '', ...o });
    it('un indicateur du catalogue, un sens au choix, une valeur', () => {
        const list = evaluateObjectives(baseCtx({ customObjectives: [custom()] }));
        expect(byKey(list, 'custom_1')).toMatchObject({ kind: 'custom', label: 'Part du premier fournisseur', dir: 'max', met: false, current: expect.closeTo(40, 6) });
        expect(byKey(evaluateObjectives(baseCtx({ customObjectives: [custom({ dir: 'min', value: '30' })] })), 'custom_1').met).toBe(true);
    });
    it('un nom personnalisé, et un indicateur inconnu est ignoré (aucune formule libre)', () => {
        const list = evaluateObjectives(baseCtx({ customObjectives: [custom({ name: 'Ne pas dépendre de la boucherie' }), custom({ id: 'custom_2', indicator: 'nimporte' })] }));
        expect(byKey(list, 'custom_1').label).toBe('Ne pas dépendre de la boucherie');
        expect(byKey(list, 'custom_2')).toBeUndefined();
    });
    it('s\'applique aux indicateurs en dollars (point mort, revenus)', () => {
        const list = evaluateObjectives(baseCtx({ customObjectives: [custom({ id: 'a', indicator: 'revenus', dir: 'min', value: '120000' }), custom({ id: 'b', indicator: 'pointMort', dir: 'max', value: '90000' })] }));
        expect(byKey(list, 'a')).toMatchObject({ unit: '$', met: false, gap: 20000 });
        expect(byKey(list, 'b')).toMatchObject({ unit: '$', met: true });
    });
    it('peut être désactivé comme les autres', () => {
        const list = evaluateObjectives(baseCtx({ customObjectives: [custom()], objectivesOff: ['custom_1'] }));
        expect(byKey(list, 'custom_1')).toMatchObject({ enabled: false, met: null });
    });
});

describe('constats des objectifs', () => {
    const find = (r, id) => r.all.find(f => f.id === id);
    it('atteint : une force ; manqué : une faiblesse avec l\'écart ; dans le groupe des objectifs, de portée générale', () => {
        const r = computeKeyFindings(baseCtx({ grossMarginTarget: '40', netMarginTarget: '10', fraisFixes: undefined }));
        const ok = find(r, 'obj-margeBrute'), ko = find(r, 'obj-margeNette');
        expect(ok).toMatchObject({ tone: 'force', group: 'objectif', scope: 'general' });
        expect(ok.title).toBe('Marge brute : objectif atteint');
        expect(ok.detail).toContain('au moins 40,0 %');
        expect(ko).toMatchObject({ tone: 'faiblesse', group: 'objectif' });
        expect(ko.title).toBe('Marge nette sous l\'objectif');
    });
    it('un objectif désactivé ou sans valeur ne produit aucun constat, y compris les trois cibles de coûts', () => {
        const r = computeKeyFindings(baseCtx({ foodCostTarget: '32', packagingCostTarget: '8', laborCostTarget: '22', objectivesOff: ['matiere', 'emballage'], lossTarget: '' }));
        expect(find(r, 'cost-matiere')).toBeUndefined();
        expect(find(r, 'cost-emballage')).toBeUndefined();
        expect(find(r, 'cost-mo')).toBeDefined();
        expect(find(r, 'obj-perteStock')).toBeUndefined();
        expect(find(r, 'targets-all-met')).toBeUndefined(); // il ne reste plus qu'une cible active
    });
    it('un objectif sur mesure produit un constat à son nom', () => {
        const rows = [{ channelId: 'a', channelName: 'A', revenueTotal: 7000, totalIndirectTotal: 0, margeNetteTotal: 700 }, { channelId: 'b', channelName: 'B', revenueTotal: 3000, totalIndirectTotal: 0, margeNetteTotal: 300 }];
        const r = computeKeyFindings(baseCtx({ customObjectives: [{ id: 'custom_9', indicator: 'partCanal', dir: 'max', value: '30', name: 'Pas plus de 30 % chez un canal' }] }, {}, { channelSummaries: rows }));
        expect(find(r, 'obj-custom_9').title).toContain('Pas plus de 30 % chez un canal');
        expect(find(r, 'obj-custom_9').tone).toBe('faiblesse');
    });
    it('les identifiants obj-* sont classés (portée générale) : aucun constat sans classement', () => {
        expect(classifyFinding('obj-margeBrute')).toEqual({ scope: 'general', subjectType: 'objectif' });
        expect(classifyFinding('obj-custom_1')).toEqual({ scope: 'general', subjectType: 'objectif' });
    });
    it('sur le projet démo : les nouveaux objectifs donnent des constats atteints et à atteindre', () => {
        const all = computeKeyFindings(demoContext(), { entities: true }).all.filter(f => f.id.startsWith('obj-'));
        expect(all.length).toBeGreaterThanOrEqual(4);
        expect(all.some(f => f.tone === 'force')).toBe(true);
        expect(all.some(f => f.tone === 'faiblesse')).toBe(true);
    });
});
