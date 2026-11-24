import { describe, it, expect } from 'vitest';
import { INDICATORS, INDICATOR_GROUPS, CUSTOM_INDICATOR_IDS, DEFAULT_OBJECTIVES, ENTITY_KINDS, evaluateObjectives, subjectsOf, fmtObjValue } from './objectives.js';
import { INDICATOR_DOCS } from './objectiveDocs.js';
import { computeKeyFindings } from './keyFindings.js';
import { demoContext } from './testing/demoFindingsContext.js';

// Objectifs sur mesure « par entité » (24/11) : un ingrédient, un emballage, un fournisseur, un poste, un format, un canal ou une activité précis.
const withCustom = (customObjectives) => { const c = demoContext(); return { ...c, info: { ...c.info, customObjectives } }; };
const mk = (id, indicator, subject, dir, value) => ({ id, indicator, subject, dir, value, name: '' });

describe('catalogue élargi', () => {
    it('chaque indicateur proposé existe, a une description (sauf les six rédigés à la main) et aucun des neuf par défaut n\'est répété', () => {
        const defaults = new Set(DEFAULT_OBJECTIVES.map(o => o.id));
        for (const id of CUSTOM_INDICATOR_IDS) {
            expect(INDICATORS[id], id).toBeTruthy();
            expect(defaults.has(id), id).toBe(false);
            expect(INDICATORS[id].custom, id).toBe(true);
        }
        const handWritten = ['margeSecurite', 'pointMort', 'revenus', 'partFournisseur', 'partCanal', 'margeProduitMin'];
        for (const id of CUSTOM_INDICATOR_IDS.filter(i => !handWritten.includes(i))) expect(INDICATOR_DOCS[id], id).toBeTruthy();
        for (const [id, text] of Object.entries(INDICATOR_DOCS)) { expect(text.length, id).toBeLessThanOrEqual(150); expect(CUSTOM_INDICATOR_IDS, id).toContain(id); }
        expect(new Set(CUSTOM_INDICATOR_IDS).size).toBe(CUSTOM_INDICATOR_IDS.length);
        expect(INDICATOR_GROUPS.length).toBe(8);
    });
    it('un indicateur « par entité » porte un type de sujet connu', () => {
        for (const id of CUSTOM_INDICATOR_IDS) if (INDICATORS[id].entity) expect(ENTITY_KINDS[INDICATORS[id].entity], id).toBeTruthy();
    });
});

describe('valeurs sur le projet démo', () => {
    it('chaque indicateur donne une valeur finie pour au moins un sujet (donnée reprise, jamais inventée)', () => {
        const c = demoContext();
        for (const id of CUSTOM_INDICATOR_IDS) {
            const ind = INDICATORS[id];
            const subjects = ind.entity ? subjectsOf(c, id) : [{ id: null }];
            expect(subjects.length, id).toBeGreaterThan(0);
            expect(subjects.some(s => Number.isFinite(ind.value(c, s.id))), id).toBe(true);
        }
    });
    it('un sujet inconnu ou absent reste absent (null), jamais 0', () => {
        const c = demoContext();
        for (const id of CUSTOM_INDICATOR_IDS.filter(i => INDICATORS[i].entity)) expect(INDICATORS[id].value(c, 'inexistant'), id).toBeNull();
    });
    it('les valeurs reprennent celles des rapports', () => {
        const c = demoContext();
        const canal = c.channelSummaries[0];
        expect(INDICATORS.canalMargeNette.value(c, String(canal.channelId))).toBeCloseTo(canal.margeNettePercent * 100, 9);
        const post = c.info.productivityReport.rows.find(r => r.actual > 0 && r.expected > 0);
        expect(INDICATORS.posteUtilisation.value(c, post.postName)).toBeCloseTo(post.utilization, 9);
        const share = c.ingredientShares.rows[0];
        expect(INDICATORS.fournIngPart.value(c, share.provider)).toBeCloseTo(share.share * 100, 9);
        const total = c.channelSummaries.reduce((s, r) => s + r.revenueTotal, 0);
        expect(INDICATORS.canalPart.value(c, String(canal.channelId))).toBeCloseTo(canal.revenueTotal / total * 100, 9);
    });
});

describe('objectifs sur mesure par entité', () => {
    it('évalue un objectif sur un sujet précis, avec un libellé « sujet · indicateur »', () => {
        const c0 = demoContext();
        const ing = subjectsOf(c0, 'ingPart').find(s => /Bœuf/.test(s.label));
        const o = evaluateObjectives(withCustom([mk('c1', 'ingPart', ing.id, 'max', '20')])).find(x => x.key === 'c1');
        expect(o.label).toBe('Bœuf haché mi-maigre · part dans les achats d\'ingrédients');
        expect(o.met).toBe(false);
        expect(o.current).toBeGreaterThan(20);
        expect(o.subjectLabel).toBe('Bœuf haché mi-maigre');
    });
    it('un sujet qui n\'existe plus rend l\'objectif muet (sans donnée), pas faux', () => {
        const o = evaluateObjectives(withCustom([mk('c1', 'canalPart', 'disparu', 'max', '40')])).find(x => x.key === 'c1');
        expect(o).toMatchObject({ current: null, met: null, hasTarget: true });
        expect(o.label).toContain('Sujet introuvable');
    });
    it('« au plus 0 produit déficitaire » est un objectif valide (zéro permis pour un nombre)', () => {
        const o = evaluateObjectives(withCustom([mk('c1', 'produitsDeficitaires', '', 'max', '0')])).find(x => x.key === 'c1');
        expect(o.hasTarget).toBe(true);
        expect(o.met).toBe(false);
        expect(o.gap).toBe(o.current);
        const n = evaluateObjectives(withCustom([mk('c2', 'ingPart', 'x', 'max', '0')])).find(x => x.key === 'c2');
        expect(n.hasTarget).toBe(false); // un pourcentage à 0 n'a pas de sens
    });
    it('un objectif par entité donne un constat à son nom, lié au bon sous-onglet', () => {
        const c0 = demoContext();
        const post = subjectsOf(c0, 'posteUtilisation').find(s => /Opérateur de production/.test(s.label));
        const r = computeKeyFindings(withCustom([mk('c1', 'posteUtilisation', post.id, 'min', '95')]));
        const f = r.all.find(x => x.id === 'obj-c1');
        expect(f.tone).toBe('faiblesse');
        expect(f.link.subTab).toBe('labor');
        expect(f.title).toContain('Opérateur de production');
        expect(f.detail).toContain('au moins 95,0 %');
    });
    it('formate chaque unité', () => {
        expect(fmtObjValue(34.56, '%')).toBe('34,6 %');
        expect(fmtObjValue(1.84, 'fois')).toBe('1,8 fois');
        expect(fmtObjValue(5, 'n')).toBe('5');
        expect(fmtObjValue(null, '%')).toBe('—');
        expect(fmtObjValue(1200, '$')).toContain('$');
    });
});
