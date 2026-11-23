// Moteur de mise en page du rapport PDF (phase 3 de la refonte de l'export, 22/11) : contenu synthétique, vrai navigateur, vraie impression.
// Garanties vérifiées : aucun débordement, aucun titre seul en bas de page, saut avant chaque chapitre et chaque fiche, tableaux coupés entre deux lignes
// avec en-tête répété et « (suite) », cascade coupée seulement entre deux sections, pages bien remplies, renvois « → p. N » exacts, et une feuille = une page PDF.
import { test, expect } from '@playwright/test';

const CSS = `
body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9.4pt;line-height:1.4;color:#111}
h2{font-size:16pt;margin:0 0 3mm} h3{font-size:10.5pt;margin:4mm 0 1.6mm} h3 small{font-weight:400;font-size:7.5pt;color:#6b7280}
p{margin:0 0 2.4mm}
table{width:100%;border-collapse:collapse;font-size:8.3pt} th{background:#1e3a8a;color:#fff;text-align:left;padding:1.3mm 1.8mm} td{padding:1.7mm 1.8mm;border-bottom:.2mm solid #ddd}
tfoot td{font-weight:700;background:#eee} table.bs th.sec{background:#f3f4f6;color:#555;font-style:italic} table.bs td,table.bs th{padding:.8mm 1.8mm}
.card{border:.25mm solid #ccc;border-radius:2mm;padding:2mm 2.6mm;margin-bottom:2.2mm}
.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm} .two ul{list-style:none;margin:0;padding:0} .two li{margin:0 0 1.4mm;font-size:8.2pt}
.hb{display:grid;grid-template-columns:50mm 1fr;gap:2mm;margin:.9mm 0;font-size:8.3pt} .hb i{display:block;height:4mm;background:#16a34a}
.is-dense td{padding:1.1mm 1.8mm} .rl-head,.rl-foot{font-size:7.5pt;color:#6b7280;padding-top:8mm}
`;

test('moteur de mise en page : coupures, titres collés, sauts forcés, renvois et impression', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    const out = await page.evaluate(async (css) => {
        const L = await import('/src/reports/layout/index.js');
        const style = document.createElement('style');
        style.textContent = css + L.layoutCss();
        document.head.appendChild(style);

        const lorem = (n) => 'Un texte courant qui occupe de la place dans la page, mot après mot. '.repeat(n);
        const h3 = (t) => `<h3 data-heading data-keep="next">${t} <small data-drop-on-continue>sous-titre qui ne se répète pas</small></h3>`;
        const rows = (n, p = 'Ligne') => Array.from({ length: n }, (_, i) => `<tr><td>${p} ${i + 1}</td><td>${i * 7}</td></tr>`).join('');
        const table = (id, n) => `<table data-id="${id}" data-split="rows"><thead><tr><th>Poste</th><th>Valeur</th></tr></thead><tbody>${rows(n)}</tbody><tfoot><tr><td>Total</td><td>1</td></tr></tfoot></table>`;
        const cards = (id, n) => `<div data-id="${id}" data-split="items">${Array.from({ length: n }, (_, i) => `<div class="card"><b>Constat ${i + 1}</b><br>${lorem(2)}</div>`).join('')}</div>`;
        const cols = (id, a, b) => `<div class="two" data-id="${id}" data-split="columns"><div data-col><ul>${Array.from({ length: a }, (_, i) => `<li>Force ${i + 1} : ${lorem(2)}</li>`).join('')}</ul></div><div data-col><ul>${Array.from({ length: b }, (_, i) => `<li>Faiblesse ${i + 1} : ${lorem(1)}</li>`).join('')}</ul></div></div>`;
        const bars = (n) => Array.from({ length: n }, (_, i) => `<div class="hb"${i < n - 1 ? ' data-keep="next"' : ''}><span>Barre ${i + 1}</span><i style="width:${20 + i * 8}%"></i></div>`).join('');
        const cascade = (id, sections, per) => `<table class="bs" data-id="${id}" data-split="rows" data-split-before="th.sec" data-split-min="1"><thead><tr><th>Maillon</th><th>Valeur</th></tr></thead><tbody>${Array.from({ length: sections }, (_, s) => `<tr><th class="sec" colspan="2">Section ${s + 1}</th></tr>${rows(per, `S${s + 1} ligne`)}`).join('')}</tbody></table>`;
        const mark = (k) => `<div data-mark="${k}" data-keep="next" style="height:0"></div>`;
        const ref = (map, k) => `<span class="ref" data-ref="${k}">${map.marks[k] ?? 0}</span>`;
        const fiche = (n, map) => `<div data-break="before" data-keep="next">${mark('fiche' + n)}<h2>Fiche ${n}</h2></div>` + h3('Cascade de marge') + cascade('casc' + n, 3, 9) + h3('Évolution') + table('evo' + n, 14) + `<p>${lorem(3)}</p>` + (n === 1 ? `<p>Voir la page ${ref(map, 'casc')}</p>` : '')
            // Dernier bloc de la fiche « collé au suivant » (un graphique sans légende) : il ne doit jamais entraîner le début de la fiche suivante.
            + '<div data-keep="next" style="height:14mm;background:#eee">graphique</div>';

        const build = (map) => [
            { id: 'ch1', chapter: 1, html: `<h2>Synthèse</h2>${h3('Indicateurs')}${table('big', 70)}<p>${lorem(8)}</p>${h3('Constats')}${cards('cards', 16)}${h3('Forces et faiblesses')}${cols('cols', 14, 9)}${h3('Répartition')}${bars(5)}${h3('Cascade')}${mark('casc')}${cascade('casc', 6, 5)}` },
            { id: 'ch2', chapter: 2, html: `<h2>Résultats</h2><p>${lorem(14)}</p><p>La cascade est page ${ref(map, 'casc')}, la fiche 2 page ${ref(map, 'fiche2')}, la fiche 3 page ${ref(map, 'fiche3')}.</p>${h3('Tendance')}${table('trend', 30)}` },
            { id: 'ch3', chapter: 3, dense: true, html: `<h2>Fiches produits</h2><p>${lorem(2)}</p>${fiche(1, map)}${fiche(2, map)}${fiche(3, map)}` },
        ];
        const frame = { header: (p) => `<span>Chapitre ${p.chapter}</span>`, footer: (p, total) => `<span>Page ${p.n} sur ${total}</span>` };
        const r = await L.layoutReport({ build, frame, firstPage: 3 });
        const avail = (await (async () => { const pg = L.createPaginator(); const a = pg.availableHeight; pg.dispose(); return a; })());
        document.body.innerHTML = r.html;

        const sheets = [...document.querySelectorAll('.rl-sheet')];
        const info = sheets.map((s) => {
            const body = s.querySelector('.rl-body'), kids = [...body.children];
            return {
                id: s.id, overflowPx: body.scrollHeight - body.clientHeight,
                lastKeepNext: kids.length ? kids[kids.length - 1].dataset.keep === 'next' : false,
                firstBreak: kids.length ? kids[0].dataset.break === 'before' : false,
                suiteHeads: [...body.querySelectorAll('h3 .rl-suite')].length,
                pieces: [...body.querySelectorAll('[data-id]')].map(e => ({
                    id: e.dataset.id, kind: e.dataset.split,
                    rows: e.tBodies ? e.tBodies[0].rows.length : 0, items: e.children.length,
                    thead: e.tHead ? 1 : 0, tfoot: e.tFoot ? 1 : 0,
                    firstRowIsSection: e.tBodies && e.tBodies[0].rows[0] ? !!e.tBodies[0].rows[0].querySelector('th.sec') : null,
                    li: [...e.querySelectorAll(':scope > [data-col]')].map(c => c.querySelectorAll('li').length),
                    prevIsSuite: !!(e.previousElementSibling && e.previousElementSibling.querySelector && e.previousElementSibling.querySelector('.rl-suite')),
                })),
                text: body.textContent,
            };
        });
        const refs = [...document.querySelectorAll('.ref')].map(e => ({ key: e.dataset.ref, shown: Number(e.textContent), actual: Number(e.closest('.rl-sheet').id.slice(1)), at: null }));
        const where = (k) => { const m = document.querySelector(`[data-mark="${k}"]`); return m ? Number(m.closest('.rl-sheet').id.slice(1)) : null; };
        return {
            passes: r.passes, converged: r.converged, overflow: r.overflow, total: r.map.total, map: r.map, avail,
            pages: r.pages.map(p => ({ n: p.n, unit: p.unit, used: p.used, firstBreak: false })),
            info, refs: refs.map(x => ({ ...x, target: where(x.key) })),
        };
    }, CSS);

    // La composition converge et ne déborde pas
    expect(out.converged).toBe(true);
    expect(out.overflow).toBe(false);
    expect(out.map.chapters).toMatchObject({ ch1: 3 });
    expect(out.total).toBeGreaterThanOrEqual(8);

    // Aucun contenu rogné : ce que la page montre est ce que la mesure a mesuré
    out.info.forEach(i => expect(i.overflowPx, `débordement de la page ${i.id}`).toBeLessThanOrEqual(1));

    // Aucun titre (ou bloc collé au suivant) seul en bas de page
    // (sauf devant un saut forcé : un bloc collé au suivant ne retient pas le début d'une fiche, qui commence toujours sa page)
    out.info.forEach((i, k) => { if (out.info[k + 1] && !out.info[k + 1].firstBreak) expect(i.lastKeepNext, `titre seul en bas de ${i.id}`).toBe(false); });

    // Un chapitre commence une page ; chaque fiche commence la sienne
    const firstOfUnit = (u) => out.pages.find(p => p.unit === u).n;
    expect(out.map.chapters).toEqual({ ch1: 3, ch2: firstOfUnit('ch2'), ch3: firstOfUnit('ch3') });
    const ficheSheets = out.info.filter(i => i.firstBreak);
    expect(ficheSheets.length).toBe(3); // les trois fiches ; la première suit l'introduction du chapitre et commence quand même sa propre page
    for (const k of ['fiche1', 'fiche2', 'fiche3']) expect(out.map.marks[k]).toBeGreaterThan(0);
    expect(out.map.marks.fiche2).toBeGreaterThan(out.map.marks.fiche1);
    expect(out.map.marks.fiche3).toBeGreaterThan(out.map.marks.fiche2);

    // Aucune ligne perdue ni dupliquée ; en-tête répété ; pied de tableau au dernier morceau seulement ; morceaux d'au moins 2 lignes
    const piecesOf = (id) => out.info.flatMap(i => i.pieces.filter(p => p.id === id).map(p => ({ ...p, page: i.id })));
    const big = piecesOf('big');
    expect(big.length).toBeGreaterThan(1);
    expect(big.reduce((s, p) => s + p.rows, 0)).toBe(70);
    big.forEach(p => { expect(p.thead).toBe(1); expect(p.rows).toBeGreaterThanOrEqual(2); });
    expect(big.map(p => p.tfoot)).toEqual(big.map((_, i) => (i === big.length - 1 ? 1 : 0)));
    expect(piecesOf('cards').reduce((s, p) => s + p.items, 0)).toBe(16);
    const cols = piecesOf('cols');
    expect(cols.reduce((s, p) => s + (p.li[0] || 0), 0)).toBe(14);
    expect(cols.reduce((s, p) => s + (p.li[1] || 0), 0)).toBe(9);

    // La cascade ne se coupe qu'entre deux sections, et rien ne s'y perd
    const casc = piecesOf('casc');
    expect(casc.reduce((s, p) => s + p.rows, 0)).toBe(6 * (5 + 1));
    casc.forEach(p => expect(p.firstRowIsSection).toBe(true));

    // Un morceau qui continue un bloc reprend son titre avec « (suite) »
    for (const id of ['big', 'cards', 'cols', 'casc']) {
        piecesOf(id).slice(1).forEach(p => expect(p.prevIsSuite, `${id} sur ${p.page} sans titre « (suite) »`).toBe(true));
    }

    // Les pages sont bien remplies (sauf la dernière d'une unité et celles qui précèdent un saut forcé)
    const exempt = (i) => {
        const p = out.pages[i], next = out.pages[i + 1];
        return !next || next.unit !== p.unit || out.info[i + 1].firstBreak;
    };
    out.pages.forEach((p, i) => { if (!exempt(i)) expect(p.used / out.avail, `remplissage de la page ${p.n} (${p.unit})`).toBeGreaterThanOrEqual(0.85); });

    // Renvois « → p. N » : le numéro affiché est la page où se trouve le repère
    expect(out.refs.length).toBeGreaterThanOrEqual(4);
    out.refs.forEach(r => expect(r.shown, `renvoi vers ${r.key}`).toBe(r.target));

    // Impression réelle : une feuille = une page PDF, avec son numéro dans le pied de page
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(out.info.length);
    for (let i = 1; i <= doc.numPages; i++) {
        const text = (await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' ');
        expect(text, `pied de la page PDF ${i}`).toContain(`Page ${i + 2} sur ${out.total}`);
    }
});
