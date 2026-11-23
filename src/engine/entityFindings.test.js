import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { computeKeyFindings, buildKeyFindingsContext, tierOf } from './keyFindings.js';
import { classifyFinding, severityOf } from './findingMeta.js';

// Classement des constats à deux axes (portée, gravité) et constats PAR ENTITÉ (phase 2 de la refonte de l'export PDF, 22/11).
// Chiffres de référence : projet démo (mêmes valeurs que le guide et les écrans).

import { demoContext } from './testing/demoFindingsContext.js';
const byId = (res, id) => res.all.find(f => f.id === id);

describe('classement : chaque identifiant du moteur a une portée', () => {
    it('tout identifiant écrit dans keyFindings.js et entityFindings.js est classé', () => {
        const unclassified = [];
        for (const file of ['keyFindings.js', 'entityFindings.js']) {
            const src = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
            for (const m of src.matchAll(/(?:force|weak|finding)\(\s*(`[^`]*`|'[^']*')/g)) {
                const id = m[1].slice(1, -1).replace(/\$\{[^}]*\}/g, 'x');
                if (id === 'x' || id === 'cost-x' || /^history-x(-12m)?$/.test(id)) continue; // identifiants dynamiques testés ci-dessous
                if (!classifyFinding(id)) unclassified.push(id);
            }
        }
        expect(unclassified).toEqual([]);
    });

    it('les objectifs de coût (cost-matiere, cost-emballage, cost-mo) sont classés', () => {
        ['matiere', 'emballage', 'mo'].forEach(k => expect(classifyFinding(`cost-${k}`)).toEqual({ scope: 'general', subjectType: 'entreprise' }));
    });

    it('les mesures d\'évolution (history-<mesure> et -12m) sont toutes classées', () => {
        for (const metric of ['gross', 'net', 'material', 'packaging', 'labor', 'revenue', 'breakeven']) {
            expect(classifyFinding(`history-${metric}`)).toMatchObject({ scope: 'general' });
            expect(classifyFinding(`history-${metric}-12m`)).toMatchObject({ scope: 'general' });
        }
    });

    it('portées : général pour l\'entreprise, spécifique pour un produit, un canal, un poste, un fournisseur', () => {
        expect(classifyFinding('safety')).toEqual({ scope: 'general', subjectType: 'entreprise' });
        expect(classifyFinding('rec-net').scope).toBe('general');
        expect(classifyFinding('channel-dependency')).toEqual({ scope: 'specific', subjectType: 'canal' });
        expect(classifyFinding('sku-loss-fmt_x')).toEqual({ scope: 'specific', subjectType: 'format' });
        expect(classifyFinding('sku-positive')).toEqual({ scope: 'specific', subjectType: 'produit' }); // l'agrégé n'est pas confondu avec « sku-positive-<id> »
        expect(classifyFinding('post-state-Cuisinier')).toEqual({ scope: 'specific', subjectType: 'poste' });
        expect(classifyFinding('supplier-dep-ing-X')).toEqual({ scope: 'specific', subjectType: 'approvisionnement' });
        expect(classifyFinding('identifiant-inconnu')).toBeNull();
    });
});

describe('gravité', () => {
    it('majeure : niveau 1, impact ≥ 3 % des ventes, constat structurel, ou général de poids ≥ 80 ; moyenne : poids ≥ 50 ou impact ≥ 1 % ; sinon mineure', () => {
        const f = (weight, impact = null, scope = 'general', id = 'x') => ({ id, weight, impact, scope });
        expect(severityOf(f(30), 100000, 1)).toBe('major');
        expect(severityOf(f(80), 100000, 2)).toBe('major');
        // spécifique : le poids seul ne rend plus un constat majeur (« rentable partout », poids 80, est moyen)
        expect(severityOf(f(80, null, 'specific', 'sku-best'), 100000, 2)).toBe('medium');
        // structurel : majeur par nature, faiblesse comme force miroir
        expect(severityOf(f(36, null, 'specific', 'supplier-spread'), 100000, 3)).toBe('major');
        expect(severityOf(f(38, null, 'specific', 'profit-spread'), 100000, 2)).toBe('major');
        expect(severityOf(f(40, 3000), 100000, 3)).toBe('major');
        expect(severityOf(f(50), 100000, 2)).toBe('medium');
        expect(severityOf(f(40, 1000), 100000, 3)).toBe('medium');
        expect(severityOf(f(49, 999), 100000, 3)).toBe('minor');
        expect(severityOf(f(40), 0, 3)).toBe('minor'); // sans ventes, l'impact ne compte pas
    });

    it('sensibilité : un bénéfice qui résiste n\'est plus de niveau 1 ; la gravité suit l\'ampleur de la perte simulée', () => {
        const res = computeKeyFindings(demoContext());
        expect(tierOf({ id: 'sens-inputs', tone: 'force' })).toBe(3);
        expect(tierOf({ id: 'sens-inputs', tone: 'faiblesse' })).toBe(1);
        expect(byId(res, 'sens-inputs')).toMatchObject({ tone: 'force', severity: 'medium' }); // −1 664 $ ≈ 2 % des ventes
        expect(byId(res, 'sens-labor')).toMatchObject({ tone: 'force', severity: 'minor' }); // −553 $ ≈ 0,7 % des ventes
    });
});

describe('constats par entité (démo)', () => {
    const ctx = demoContext();
    const base = computeKeyFindings(ctx);
    const res = computeKeyFindings(ctx, { entities: true });

    it('par défaut, rien ne change : 50 constats agrégés (dont 6 objectifs), aucun constat par entité', () => {
        expect(base.all).toHaveLength(50);
        expect(base.all.every(f => !/^(sku-class|sku-loss|sku-over-cost|sku-hour|cell-deficit|post-state|supplier-dep|volatile-item|loss-item|format-gap-of)-/.test(f.id))).toBe(true);
    });

    it('avec les entités : les versions agrégées sont conservées et les versions par entité s\'y ajoutent', () => {
        expect(res.all.length).toBeGreaterThan(base.all.length);
        base.all.forEach(f => expect(byId(res, f.id)).toBeTruthy());
        ['sku-losers', 'bcg-cows', 'supplier-ing', 'loss-high', 'format-gap'].forEach(id => expect(byId(res, id).form).toBe('aggregate'));
    });

    it('tout constat porte portée, gravité, type de sujet et forme ; un constat par entité porte son sujet', () => {
        expect(new Set(res.all.map(f => f.id)).size).toBe(res.all.length);
        for (const f of res.all) {
            expect(['general', 'specific']).toContain(f.scope);
            expect(['major', 'medium', 'minor']).toContain(f.severity);
            expect(f.subjectType).toBeTruthy();
            expect(f.form).toBe(f.subject ? 'entity' : 'aggregate');
            if (f.subject) expect(f.subject).toMatchObject({ type: expect.any(String), id: expect.any(String), name: expect.any(String) });
        }
        // Les constats par entité déjà existants (canal, activité) reçoivent leur sujet sans que la règle ait changé.
        const withActivity = computeKeyFindings({ ...ctx, productionActivities: [{ id: 'act_x', name: 'Activité X' }], activitySummaries: [{ activityId: 'act_x', activityName: 'Activité X', margeNetteTotal: -10, revenueTotal: 100, margeNettePercent: -0.1 }] });
        expect(withActivity.all.find(f => f.id === 'activity-deficit-act_x').subject).toEqual({ type: 'activité', id: 'act_x', name: 'Activité X' });
    });

    it('format : le Chili est une vache à lait, perd dans 2 canaux sur 3 (≈ 425 $), dépasse la cible de coût matière', () => {
        expect(byId(res, 'sku-class-fmt_chili')).toMatchObject({ tone: 'faiblesse', subject: { type: 'format', id: 'fmt_chili' } });
        const loss = byId(res, 'sku-loss-fmt_chili');
        expect(loss.title).toContain('2 canaux sur 3');
        expect(loss.detail).toContain('Grandes surfaces');
        expect(loss.impact).toBeCloseTo(424.9, 0);
        expect(byId(res, 'sku-over-cost-fmt_chili').detail).toContain('34,9 %');
        expect(byId(res, 'sku-hour-fmt_chili')).toMatchObject({ tone: 'force' }); // 117 $/h contre 87 $ (moyenne de l'écran Main-d'œuvre)
    });

    it('format : les cinq formats perdants, les quatre au-dessus de la cible, les rentables partout, les bons et mauvais usages du temps', () => {
        expect(res.all.filter(f => f.id.startsWith('sku-loss-')).map(f => f.id).sort()).toEqual(['sku-loss-fmt_chili', 'sku-loss-fmt_potage', 'sku-loss-fmt_sauce_spag', 'sku-loss-fmt_sauce_terroir', 'sku-loss-fmt_thai_f']);
        expect(res.all.filter(f => f.id.startsWith('sku-over-cost-'))).toHaveLength(4);
        expect(res.all.filter(f => f.id.startsWith('sku-positive-'))).toHaveLength(7);
        // Avec la moyenne de l'écran Main-d'œuvre (87 $/h, toutes les heures de production), huit formats sont de bons usages du temps et aucun ne passe sous la moitié.
        const hour = res.all.filter(f => f.id.startsWith('sku-hour-'));
        expect(hour).toHaveLength(8);
        expect(hour.every(f => f.tone === 'force')).toBe(true);
        expect(byId(res, 'sku-hour-fmt_pate_s')).toMatchObject({ tone: 'force' });
    });

    it('produit à plusieurs formats : l\'écart de marge du Sauté de poulet thaï (27,4 % contre 4,0 %)', () => {
        const gap = byId(res, 'format-gap-of-prod_thai');
        expect(gap.subject.type).toBe('produit');
        expect(gap.detail).toContain('27,4 %');
        expect(gap.detail).toContain('4,0 %');
    });

    it('activité × canal : seules les soupes et les sauces en grandes surfaces perdent de l\'argent', () => {
        const cells = res.all.filter(f => f.id.startsWith('cell-deficit-'));
        expect(cells.map(f => f.id).sort()).toEqual(['cell-deficit-act_sauces-channel_gs', 'cell-deficit-act_soupes-channel_gs']);
        expect(cells.find(f => f.id.includes('sauces')).impact).toBeCloseTo(392.8, 0);
        expect(cells[0].subject.type).toBe('activité × canal');
    });

    it('postes : un constat par poste de production, bien occupé', () => {
        const posts = res.all.filter(f => f.id.startsWith('post-state-'));
        expect(posts.map(f => f.subject.id).sort()).toEqual(['Contrôleur qualité', 'Cuisinier de production', 'Opérateur d\'emballage']);
        posts.forEach(f => expect(f.tone).toBe('force'));
    });

    it('approvisionnement : fournisseurs en dépendance, éléments volatils de classe A, ingrédients qui pèsent dans la perte stock', () => {
        expect(byId(res, 'supplier-dep-ing-Boucherie Nordique').subject.type).toBe('fournisseur');
        expect(byId(res, 'supplier-dep-pkg-Emballages Boréal')).toBeTruthy();
        expect(res.all.filter(f => f.id.startsWith('volatile-item-ing-'))).toHaveLength(4);
        const lossItems = res.all.filter(f => f.id.startsWith('loss-item-'));
        expect(lossItems.map(f => f.id).sort()).toEqual(['loss-item-ing_boeuf', 'loss-item-ing_poulet']);
        expect(byId(res, 'loss-item-ing_boeuf').impact).toBeCloseTo(459, 0);
    });

    it('évolution par format : un coût de revient qui monte de 25 % ressort comme constat du format', () => {
        const nowCost = demoContext().analysis.activeProducts.find(p => p.id === 'fmt_chili').costs.totalCostPerPortion;
        const rise = computeKeyFindings(demoContext((points) => {
            const point = points[points.length - 2];
            const row = point.productsWithCosts.find(p => p.id === 'fmt_chili');
            row.costs.totalCostPerPortion = nowCost / 1.25; // aujourd'hui : +25 % par rapport à ce relevé
            return points;
        }), { entities: true });
        const f = byId(rise, 'sku-cost-trend-fmt_chili');
        expect(f).toMatchObject({ tone: 'faiblesse', group: 'evolution', subject: { type: 'format', id: 'fmt_chili' } });
        expect(f.title).toContain('hausse de 25 %');
    });

    it('sans données, les règles par entité se taisent', () => {
        expect(computeKeyFindings(buildKeyFindingsContext({}), { entities: true }).all).toEqual([]);
    });
});
