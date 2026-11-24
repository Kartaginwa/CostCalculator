import { describe, it, expect } from 'vitest';
import { composeDocument, renderPages, samePageMap, emptyPageMap } from './compose.js';

// Composition en plusieurs passes : la pagination est simulée (la vraie, qui mesure le DOM, est testée par Playwright : e2e/report-layout.spec.js).
const page = (marks = []) => ({ nodes: [], marks, used: 100, overflow: false });

describe('composeDocument', () => {
    it('numérote les pages à la suite, dans l\'ordre des unités, à partir de la première page donnée', async () => {
        const r = await composeDocument({
            firstPage: 3,
            build: () => [{ id: 'a' }, { id: 'b', chapter: 2, dense: true }],
            paginate: (u) => (u.id === 'a' ? [page(), page()] : [page()]),
        });
        expect(r.pages.map(p => [p.n, p.unit, p.chapter, p.dense])).toEqual([[3, 'a', 'a', false], [4, 'a', 'a', false], [5, 'b', 2, true]]);
        expect(r.map.chapters).toEqual({ a: 3, b: 5 });
        expect(r.map.total).toBe(5);
    });

    it('un repère est localisé à la première page où il apparaît', async () => {
        const r = await composeDocument({ build: () => [{ id: 'a' }], paginate: () => [page(['x']), page(['y', 'x']), page(['y'])] });
        expect(r.map.marks).toEqual({ x: 1, y: 2 });
    });

    it('converge en deux passes quand la carte ne bouge plus', async () => {
        const r = await composeDocument({ build: () => [{ id: 'a' }], paginate: () => [page(['m'])] });
        expect(r.converged).toBe(true);
        expect(r.passes).toBe(2);
    });

    it('un renvoi plus long peut déplacer un repère : la carte est recalculée jusqu\'à ce qu\'elle se stabilise', async () => {
        // Le texte du renvoi vers « m » passe à deux chiffres quand m est à la page 10 ou plus : l'unité a gagne alors une page.
        const seen = [];
        const r = await composeDocument({
            build: (map) => { seen.push(map.marks.m); return [{ id: 'a', long: (map.marks.m || 0) >= 10 }, { id: 'b' }]; },
            paginate: (u) => (u.id === 'a' ? (u.long ? [page(), page()] : [page()]) : Array.from({ length: 9 }, (_, i) => page(i === 8 ? ['m'] : []))),
        });
        expect(seen).toEqual([undefined, 10, 11]);
        expect(r.map.marks.m).toBe(11);
        expect(r.converged).toBe(true);
        expect(r.passes).toBe(3);
    });

    it('une composition qui oscille s\'arrête au nombre maximal de passes et le signale', async () => {
        let flip = false;
        const r = await composeDocument({ maxPasses: 3, build: () => [{ id: 'a' }], paginate: () => { flip = !flip; return flip ? [page()] : [page(), page()]; } });
        expect(r.converged).toBe(false);
        expect(r.passes).toBe(3);
    });

    it('sans unité : aucune page, total nul', async () => {
        const r = await composeDocument({ build: () => [], paginate: () => [] });
        expect(r.pages).toEqual([]);
        expect(r.map.total).toBe(0);
    });
});

describe('samePageMap', () => {
    it('compare repères, unités et total', () => {
        const a = { marks: { x: 1 }, chapters: { c: 1 }, total: 4 };
        expect(samePageMap(a, structuredClone(a))).toBe(true);
        expect(samePageMap(a, { ...a, total: 5 })).toBe(false);
        expect(samePageMap(a, { ...a, marks: { x: 2 } })).toBe(false);
        expect(samePageMap(a, { ...a, chapters: {} })).toBe(false);
        expect(samePageMap(emptyPageMap(), emptyPageMap())).toBe(true);
    });
});

describe('renderPages', () => {
    it('une section par page, avec en-tête, corps et pied fournis par les gabarits', () => {
        const pages = [{ n: 7, dense: false, nodes: [{ outerHTML: '<p>a</p>' }, { outerHTML: '<p>b</p>' }] }, { n: 8, dense: true, nodes: [] }];
        const html = renderPages(pages, { header: (p) => `H${p.n}`, footer: (p, t) => `F${p.n}/${t}` }, 8);
        expect(html).toContain('<section class="rl-sheet" id="p7">');
        expect(html).toContain('<div class="rl-head">H7</div><div class="rl-body"><p>a</p><p>b</p></div><div class="rl-foot">F7/8</div>');
        expect(html).toContain('<div class="rl-body is-dense"></div>');
    });
});
