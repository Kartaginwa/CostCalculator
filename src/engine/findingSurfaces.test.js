import { describe, it, expect } from 'vitest';
import { demoContext } from './testing/demoFindingsContext.js';
import { computeKeyFindings } from './keyFindings.js';
import { strengthsAndWeaknesses, chapterFindings, ficheFindings, chapterOf, objectiveFindings, evolutionFindings, overviewStrengths, tabFindings } from './findingSurfaces.js';
import { SEVERITY_ORDER, STRUCTURAL } from './findingMeta.js';

// Filtres par surface (phase 2 de la refonte de l'export PDF, 22/11) : fonctions pures sur des constats déjà classés.
const f = (id, over) => ({ id, tone: 'faiblesse', theme: 'Coûts', scope: 'general', subjectType: 'entreprise', subject: null, severity: 'minor', rank: 1, ...over });

describe('Forces / Faiblesses et promotion', () => {
    it('garde tous les constats majeurs, généraux ou promus, et aucun autre', () => {
        const list = [
            f('a', { severity: 'major' }),
            f('b', { severity: 'major', scope: 'specific', tone: 'force' }),
            f('c', { severity: 'medium' }),
            f('d', { severity: 'minor', scope: 'specific' }),
        ];
        const { forces, faiblesses } = strengthsAndWeaknesses(list);
        expect(faiblesses.map(x => [x.id, x.promoted])).toEqual([['a', false]]);
        expect(forces.map(x => [x.id, x.promoted])).toEqual([['b', true]]);
    });
    it('sans constat, deux colonnes vides', () => {
        expect(strengthsAndWeaknesses(undefined)).toEqual({ forces: [], faiblesses: [] });
    });
});

describe('chapitre d\'un constat', () => {
    it('suit le thème et le sujet', () => {
        expect(chapterOf(f('x', { theme: 'Rentabilité' }))).toBe(2);
        expect(chapterOf(f('x', { theme: 'Évolution' }))).toBe(2);
        expect(chapterOf(f('x', { theme: 'Produits', subjectType: 'format' }))).toBe(3);
        expect(chapterOf(f('x', { theme: 'Coûts', subjectType: 'format' }))).toBe(3); // coût matière au-dessus de la cible, d'un format
        expect(chapterOf(f('x', { theme: 'Évolution', subjectType: 'canal' }))).toBe(4);
        expect(chapterOf(f('x', { theme: 'Activités', subjectType: 'activité × canal' }))).toBe(4);
        expect(chapterOf(f('x', { theme: 'Évolution', subjectType: 'approvisionnement' }))).toBe(5);
        expect(chapterOf(f('x', { theme: 'Main-d\'œuvre', subjectType: 'format' }))).toBe(6); // le bénéfice par heure d'un format va au chapitre 6
    });
});

describe('sur le projet démo', () => {
    const c = demoContext();
    const all = computeKeyFindings(c, { entities: true }).all;

    it('chaque constat a un chapitre de 2 à 6 et chaque chapitre est servi', () => {
        for (const x of all) expect([2, 3, 4, 5, 6]).toContain(chapterOf(x));
        for (const n of [2, 3, 4, 5, 6]) expect(chapterFindings(all, n).length).toBeGreaterThanOrEqual(5);
    });
    it('un chapitre est trié de la plus grave à la moins grave', () => {
        const order = { major: 3, medium: 2, minor: 1 };
        for (const n of [2, 3, 4, 5, 6]) {
            const sev = chapterFindings(all, n).map(x => order[x.severity]);
            expect(sev).toEqual([...sev].sort((a, b) => b - a));
        }
    });
    it('les constats généraux majeurs et les spécifiques majeurs promus sont tous présents', () => {
        const { forces, faiblesses } = strengthsAndWeaknesses(all);
        const ids = [...forces, ...faiblesses].map(x => x.id);
        expect(ids).toEqual(expect.arrayContaining(['rec-net', 'net-theoretical', 'cost-matiere', 'labor-unused']));
        expect(forces.concat(faiblesses).filter(x => x.promoted).every(x => x.scope === 'specific')).toBe(true);
        expect(forces.concat(faiblesses).every(x => x.severity === 'major')).toBe(true);
    });
    it('la fiche du Chili réunit ses constats par format, et seulement les siens', () => {
        const ids = ficheFindings(all, 'fmt_chili').map(x => x.id);
        expect(ids).toEqual(expect.arrayContaining(['sku-loss-fmt_chili', 'sku-class-fmt_chili', 'sku-over-cost-fmt_chili']));
        expect(ficheFindings(all, 'fmt_chili').every(x => x.subject.type === 'format' && x.subject.id === 'fmt_chili')).toBe(true);
    });
    it('la fiche reprend aussi l\'écart de marge entre formats du produit', () => {
        const gap = all.find(x => x.id.startsWith('format-gap-of-'));
        expect(gap).toBeTruthy();
        expect(ficheFindings(all, 'fmt_inconnu', gap.subject.id).map(x => x.id)).toEqual([gap.id]);
    });
});

describe('surfaces de l\'application : une adresse par constat', () => {
    const all = computeKeyFindings(demoContext(), { entities: true }).all;
    const TABS = ['portfolio', 'bySku', 'byActivity', 'byChannel', 'ingredients', 'packaging', 'labor'];
    const objectifs = objectiveFindings(all), evolution = evolutionFindings(all), strengths = overviewStrengths(all);
    const strengthsAll = [...strengths.forces, ...strengths.faiblesses];

    it('Objectifs : le groupe des objectifs, sans la version par format (elle vit dans la fiche du format)', () => {
        expect(objectifs.length).toBeGreaterThan(0);
        expect(objectifs.every(x => x.group === 'objectif' && x.subject?.type !== 'format')).toBe(true);
    });
    it('Amélioration / détérioration : l\'évolution générale seulement', () => {
        expect(evolution.length).toBeGreaterThan(0);
        expect(evolution.every(x => x.group === 'evolution' && x.scope === 'general')).toBe(true);
    });
    it('Forces et faiblesses : les mêmes règles que le PDF (majeurs seulement), sans objectifs ni évolution', () => {
        expect(strengthsAll.length).toBeGreaterThan(0);
        expect(strengthsAll.every(x => x.group === 'structure' && x.severity === 'major')).toBe(true);
        const sev = strengthsAll.map(x => SEVERITY_ORDER[x.severity]);
        for (const list of [strengths.forces, strengths.faiblesses]) {
            const s = list.map(x => SEVERITY_ORDER[x.severity]);
            expect(s).toEqual([...s].sort((a, b) => b - a));
        }
        expect(sev.length).toBe(strengthsAll.length);
        // les généraux majeurs du plan (chapitre 1) y sont tous
        expect(strengthsAll.map(x => x.id)).toEqual(expect.arrayContaining(['rec-net', 'net-theoretical', 'labor-unused']));
    });
    it('aucun constat n\'est dans deux blocs de la Vue d\'ensemble', () => {
        const ids = [...objectifs, ...evolution, ...strengthsAll].map(x => x.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
    it('un bandeau ne montre que ce qui renvoie à son sous-onglet, sans objectifs, sans général majeur ni évolution générale, sans format', () => {
        for (const t of TABS) {
            const { all: list } = tabFindings(all, t);
            expect(list.every(x => x.group !== 'objectif' && !(x.scope === 'general' && (x.severity === 'major' || x.group === 'evolution')) && x.link.subTab === t && x.subject?.type !== 'format'), t).toBe(true);
            const keys = list.map(x => `${x.title}|${x.detail}`);
            expect(new Set(keys).size, t).toBe(keys.length);
        }
    });
    it('chaque sous-onglet du démo a un bandeau', () => {
        for (const t of TABS) expect(tabFindings(all, t).all.length, t).toBeGreaterThan(0);
    });
    it('Simulation et Vue d\'ensemble n\'ont pas de bandeau', () => {
        expect(tabFindings(all, 'simulation').all).toEqual([]);
        expect(tabFindings(all, 'overview').all).toEqual([]);
    });
    it('Par SKU : la fiche du SKU choisi s\'ajoute, jamais celle des autres formats', () => {
        const fmt = all.find(x => x.subject?.type === 'format');
        const withSel = tabFindings(all, 'bySku', { formatId: fmt.subject.id });
        expect(withSel.all.some(x => x.subject?.type === 'format' && x.subject.id === fmt.subject.id)).toBe(true);
        expect(withSel.all.filter(x => x.subject?.type === 'format').every(x => x.subject.id === fmt.subject.id)).toBe(true);
        expect(tabFindings(all, 'bySku').all.some(x => x.subject?.type === 'format')).toBe(false);
    });
    it('hors des redondances voulues, chaque constat a une adresse (un seul recouvrement : le spécifique majeur promu)', () => {
        const home = new Set([...objectifs, ...evolution, ...strengthsAll].map(x => x.id));
        const tabIds = TABS.flatMap(t => tabFindings(all, t).all.map(x => x.id));
        tabIds.forEach(id => home.add(id));
        const redundant = /^(volatile-item-|loss-item-|format-gap-of-|post-(underused|overloaded|used)$|supplier-dep-)/;
        const orphans = all.filter(x => x.subject?.type !== 'format' && !home.has(x.id) && !redundant.test(x.id));
        // Sans adresse dans l’application : un constat général non majeur qui renvoie à la Vue d’ensemble ou à Simulation (il reste dans le chapitre 2 du PDF).
        expect(orphans.every(x => x.scope === 'general' && x.severity !== 'major' && ['overview', 'simulation'].includes(x.link.subTab))).toBe(true);
        // recouvrement : seulement des constats spécifiques majeurs
        const overlap = tabIds.filter(id => strengthsAll.some(x => x.id === id));
        for (const id of overlap) { const x = all.find(y => y.id === id); expect([x.scope, x.severity]).toEqual(['specific', 'major']); }
    });
    it('sans redondance : le constat agrégé écarte sa version par entité, sauf pour les postes (l\'entité en dit plus)', () => {
        const ing = tabFindings(all, 'ingredients').all.map(x => x.id);
        expect(ing).not.toContain('loss-item-ing_boeuf');
        expect(ing.some(id => id.startsWith('volatile-item-'))).toBe(false);
        const labor = tabFindings(all, 'labor').all.map(x => x.id);
        expect(labor.some(id => id.startsWith('post-state-'))).toBe(true);
        expect(labor).not.toContain('post-used');
    });
});

describe('Forces et faiblesses du démo : équilibrées, sans constat d\'un seul produit', () => {
    const all = computeKeyFindings(demoContext(), { entities: true }).all;
    const s = overviewStrengths(all);
    it('au moins trois forces majeures, et « rentable partout » (un seul produit) n\'en fait pas partie', () => {
        expect(s.forces.length).toBeGreaterThanOrEqual(3);
        const ids = [...s.forces, ...s.faiblesses].map(x => x.id);
        expect(ids).not.toContain('sku-best');
        expect(ids).not.toContain('sku-positive');
    });
    it('chaque force majeure est générale ou structurelle (miroir d\'une faiblesse majeure)', () => {
        for (const x of s.forces) expect(x.scope === 'general' || STRUCTURAL.test(x.id), x.id).toBe(true);
    });
});
