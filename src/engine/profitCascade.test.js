import { describe, it, expect } from 'vitest';
import { demoContext } from './testing/demoFindingsContext.js';
import { computeProfitCascade } from './profitCascade.js';

describe('cascade du revenu au bénéfice net', () => {
    const c = demoContext();
    const cas = computeProfitCascade(c.channelSummaries);

    it('reprend les totaux par canal : ventes prévues de la Vue d\'ensemble, frais fixes saisis', () => {
        expect(cas.revenue).toBeCloseTo(c.analysis.menuRevenue, 2);
        expect(cas.fixed).toBeCloseTo(28000, 1);
    });
    it('respecte les identités du moteur (revenu − charges directes = brut ; brut − frais fixes − vieillissement = net)', () => {
        expect(cas.revenue - cas.material - cas.packaging - cas.labor - cas.subcontracting).toBeCloseTo(cas.gross, 6);
        expect(cas.gross - cas.fixed - cas.aging).toBeCloseTo(cas.net, 6);
    });
    it('« sur chaque dollar » : les parts font 100 %', () => {
        expect(cas.perDollar.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 9);
        expect(cas.perDollar.map(x => x.key)).toEqual(['material', 'packaging', 'labor', 'subcontracting', 'fixed', 'net']);
    });
    it('une étape nulle n\'est pas une étape ; les totaux restent', () => {
        const flat = computeProfitCascade([{ revenueTotal: 100, costMatiereTotal: 40, margeBruteTotal: 60, totalIndirectTotal: 20, margeNetteTotal: 40 }]);
        expect(flat.steps.map(s => s.key)).toEqual(['revenue', 'material', 'gross', 'fixed', 'net']);
    });
    it('absent sans ventes', () => {
        expect(computeProfitCascade([])).toBeNull();
        expect(computeProfitCascade(undefined)).toBeNull();
        expect(computeProfitCascade([{ revenueTotal: 0 }])).toBeNull();
    });
});
