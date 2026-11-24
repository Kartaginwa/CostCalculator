import { describe, it, expect } from 'vitest';
import { demoContext } from './testing/demoFindingsContext.js';
import { computeKeyFindings } from './keyFindings.js';
import { computeReadings, computeTrendRows, readReconciliation, readEvolution, readCells, readLabor } from './reportReadings.js';

// Tableau d'évolution et blocs « Ce que cela veut dire » : chiffres du projet démo, silence sans données.
// Les espaces des montants sont des espaces insécables (toLocaleString fr-CA) : on les neutralise avant de comparer.
const flat = (list) => list.map(s => s.replace(/[\u00a0\u202f]/g, ' '));

describe('« Ce que cela veut dire » (démo)', () => {
    const c = demoContext();
    const r = computeReadings(c);
    const rec = flat(r.reconciliation), cells = flat(r.cells), labor = flat(r.labor);

    it('réconciliation : trois phrases, seuil de 5 %', () => {
        expect(rec).toHaveLength(3);
        expect(rec[0]).toContain('alignés sur le modèle');
        expect(rec[1]).toMatch(/au-dessus du modèle de 2 644 \$ \(\+5,8 %\) : pertes, rendements/);
        expect(rec[2]).toMatch(/4 000 \$\) est sous le modèle de 2 299 \$ ; l'écart vient surtout des charges directes/);
    });
    it('évolution : sommet, creux, remontée, écart à 12 mois', () => {
        expect(r.evolution[0]).toContain('culminé à 46,0\u00A0%');
        expect(r.evolution[0]).toContain('creux à 41,5\u00A0%');
        expect(r.evolution[1]).toContain('remonte de 1,6 point');
        expect(r.evolution[2]).toMatch(/2,1 points sous son niveau d'il y a 12 mois/);
    });
    it('activité × canal : les deux cases en perte de l\'application', () => {
        expect(cells).toHaveLength(1);
        expect(cells[0]).toMatch(/^2 combinaisons activité × canal perdent de l'argent, pour 580 \$/);
        expect(cells[0]).toContain('Grandes surfaces');
    });
    it('main-d\'œuvre : paie non utilisée, heure productive, marge de croissance (87,39 $/h de l\'écran Main-d\'œuvre)', () => {
        expect(labor[0]).toMatch(/^22 % de la paie/);
        expect(labor[1]).toContain('32,11 $');
        expect(labor[2]).toContain('87,39 $');
    });
});

describe('une seule moyenne de bénéfice brut par heure : celle de l\'écran Main-d\'œuvre', () => {
    it('le constat existant et les constats par format citent la même moyenne (87 $), jamais 108 $', () => {
        const c = demoContext();
        expect(c.growth.grossProfitPerHour).toBeCloseTo(87.39, 2);
        const all = computeKeyFindings(c, { entities: true }).all;
        expect(all.find(f => f.id === 'product-best-hour').detail).toContain('moyenne\u00A0: 87');
        const hours = all.filter(f => f.id.startsWith('sku-hour-'));
        expect(hours.length).toBeGreaterThan(0);
        hours.forEach(f => { expect(f.detail).toContain('87'); expect(f.detail).not.toContain('108'); });
    });
    it('sans marge de croissance (aucune heure libre), la comparaison est muette plutôt que recalculée', () => {
        const c = { ...demoContext(), growth: null };
        const all = computeKeyFindings(c, { entities: true }).all;
        expect(all.find(f => f.id === 'product-best-hour').detail).not.toContain('moyenne');
        expect(all.some(f => f.id === 'product-worst-hour' || f.id.startsWith('sku-hour-'))).toBe(false);
    });
});

describe('tableau d\'évolution (démo)', () => {
    const c = demoContext();
    const rows = computeTrendRows(c);
    const row = (id) => rows.find(x => x.id === id);

    it('aujourd\'hui : les valeurs de la Vue d\'ensemble', () => {
        expect(row('gross').now).toBe(c.analysis.weightedGrossMargin);
        expect(row('material').now).toBe(c.analysis.weightedMaterialCost);
    });
    it('il y a 3 relevés et il y a 12 mois : écarts en points', () => {
        expect(row('gross').threeBack.delta).toBeCloseTo(0.016, 3);
        expect(row('gross').yearAgo.delta).toBeCloseTo(-0.0215, 3);
        expect(row('material').threeBack.delta).toBeCloseTo(-0.0145, 3);
    });
    it('une mesure en $ porte une variation relative', () => {
        expect(row('breakeven').kind).toBe('rel');
        expect(row('breakeven').threeBack.delta).toBeCloseTo(-0.028, 3);
    });
});

describe('silence sans données', () => {
    it('sans relevés : aucune ligne comparative, aucune lecture d\'évolution', () => {
        const c = { ...demoContext(), trackingPoints: [] };
        expect(readEvolution(c)).toEqual([]);
        computeTrendRows(c).forEach(x => { expect(x.threeBack).toBeNull(); expect(x.yearAgo).toBeNull(); });
    });
    it('sans chiffres réels : pas de lecture de réconciliation', () => {
        expect(readReconciliation({ ...demoContext(), hasRealData: false })).toEqual([]);
    });
    it('sans activité ni canal : pas de lecture de matrice ; sans cascade : pas de lecture de main-d\'œuvre', () => {
        expect(readCells({ ...demoContext(), productionActivities: [] })).toEqual([]);
        expect(readLabor({ cascade: null, growth: null })).toEqual([]);
    });
});
