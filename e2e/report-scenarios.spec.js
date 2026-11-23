// Recette du rapport PDF : cas limites en vrai navigateur (phase 7, 22/11). Chaque scénario est composé, paginé et imprimé (page.pdf), puis relu avec pdfjs-dist :
// aucun débordement, composition stable, un saut avant chaque fiche, aucun « NaN » ni « undefined » dans le texte du PDF, temps de génération mesuré.
import { test, expect } from '@playwright/test';

const SCENARIOS = ['vide', 'sans-pds', 'sans-releves', 'un-releve', 'sans-chiffres-reels', 'avec-periode', 'un-produit', 'produit-sans-prix', 'noms-pieges', 'un-canal', 'sans-volumes', 'sans-nom-ni-logo', 'aucun-poste', 'sans-fournisseur'];

const compose = (page, scenario, options = {}) => page.evaluate(async ({ scenario, options }) => {
    const { scenarioInputs } = await import('/src/engine/testing/reportScenarios.js');
    const { buildReportModel } = await import('/src/reports/report/model.js');
    const { buildReport } = await import('/src/reports/report/buildReport.js');
    const t0 = performance.now();
    const model = buildReportModel(scenarioInputs(scenario));
    const t1 = performance.now();
    const r = await buildReport({ model }, { ...options, generatedOn: new Date(2026, 10, 22), includeSalaries: true });
    const t2 = performance.now();
    document.body.innerHTML = r.body;
    const style = document.createElement('style'); style.textContent = r.css; document.head.appendChild(style);
    const sheets = [...document.querySelectorAll('.rl-sheet')];
    const info = sheets.map(s => {
        const body = s.querySelector('.rl-body'), kids = [...body.children];
        return { id: s.id, overflowPx: body.scrollHeight - body.clientHeight, firstBreak: kids[0]?.dataset?.break === 'before', ficheHead: !!body.querySelector('.fiche-head') };
    });
    return {
        converged: r.converged, overflow: r.overflow, passes: r.passes, total: r.totalPages, chapters: Object.keys(r.map.chapters), fiches: model.fiches.length,
        modelMs: Math.round(t1 - t0), layoutMs: Math.round(t2 - t1), sheets: sheets.length, info, htmlKb: Math.round(r.html.length / 1024),
    };
}, { scenario, options });

const pdfPages = async (page) => {
    await page.emulateMedia({ media: 'print' });
    const t0 = Date.now();
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const ms = Date.now() - t0;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
    return { pages, ms };
};

for (const name of SCENARIOS) {
    test(`scénario « ${name} » : composition stable, sans débordement, PDF sans NaN`, async ({ page }) => {
        test.setTimeout(240000);
        await page.goto('/');
        const out = await compose(page, name);
        expect(out.converged, 'composition stable').toBe(true);
        expect(out.overflow, 'aucun bloc indivisible trop haut').toBe(false);
        out.info.forEach(i => expect(i.overflowPx, `débordement de la page ${i.id}`).toBeLessThanOrEqual(1));
        expect(out.sheets).toBe(out.total);
        for (let i = 3; i <= out.info.length; i++) if (out.info[i - 1].ficheHead) expect(out.info[i - 1].firstBreak, `fiche sur la page ${i}`).toBe(true);
        const { pages } = await pdfPages(page);
        expect(pages).toHaveLength(out.total);
        const all = pages.join('\n');
        expect(all).not.toMatch(/NaN|undefined|\[object|Infinity/);
        expect(all).toContain('Rapport d’analyse du coût de revient');
        if (name === 'noms-pieges') {
            expect(all).toContain('<script>alert(1)</script>'); // imprimé comme du TEXTE, jamais exécuté
            expect(all).toContain('Chili & "frites"');
        }
    });
}

test('cinquante produits : cinquante fiches, une page chacune au moins, et un temps de génération acceptable', async ({ page }) => {
    test.setTimeout(600000);
    await page.goto('/');
    const out = await compose(page, 'cinquante-produits');
    const { pages, ms } = await pdfPages(page);
    console.log(`CINQUANTE_PRODUITS ${JSON.stringify({ fiches: out.fiches, pages: out.total, passes: out.passes, modelMs: out.modelMs, layoutMs: out.layoutMs, pdfMs: ms, htmlKb: out.htmlKb })}`);
    expect(out.converged).toBe(true);
    expect(out.overflow).toBe(false);
    expect(out.fiches).toBeGreaterThanOrEqual(50);
    expect(out.total).toBeGreaterThan(90);
    out.info.forEach(i => expect(i.overflowPx, `débordement de la page ${i.id}`).toBeLessThanOrEqual(1));
    const fichePages = out.info.filter(i => i.ficheHead && i.firstBreak).length;
    expect(fichePages).toBeGreaterThanOrEqual(50);
    expect(pages).toHaveLength(out.total);
    expect(pages.join('\n')).not.toMatch(/NaN|undefined|\[object|Infinity/);
    // Temps : composition (mesure du rendu réel) sous 90 s, modèle sous 20 s, impression sous 60 s
    expect(out.layoutMs).toBeLessThan(90000);
    expect(out.modelMs).toBeLessThan(20000);
    expect(ms).toBeLessThan(60000);
});
