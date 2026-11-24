// Rapport PDF sur le projet démo (phase 4 de la refonte de l'export, 22/11) : composé dans un vrai navigateur à partir des moteurs de l'application, puis imprimé
// (page.pdf) et relu avec pdfjs-dist. Vérifie : mise en page (aucun débordement, un saut avant chaque fiche), chiffres égaux à ceux du moteur, aucun NaN/undefined,
// chapitres choisis, commentaire et annexe des salaires facultatifs, glossaire limité aux termes employés, texte sélectionnable.
import { test, expect } from '@playwright/test';

const compose = (page, options = {}) => page.evaluate(async (opts) => {
    const { demoInputs } = await import('/src/engine/testing/demoFindingsContext.js');
    const { buildReport } = await import('/src/reports/report/buildReport.js');
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const t0 = performance.now();
    const r = await buildReport({ project: { ...state, trackingPoints, companyName: 'Boréal Mets Préparés inc.' }, analysisData, calculatedGeneralInfo }, { ...opts, generatedOn: new Date(2026, 10, 21) });
    const ms = Math.round(performance.now() - t0);
    document.body.innerHTML = r.body;
    const style = document.createElement('style'); style.textContent = r.css; document.head.appendChild(style);
    const sheets = [...document.querySelectorAll('.rl-sheet')];
    const info = sheets.map(s => {
        const body = s.querySelector('.rl-body'), kids = [...body.children];
        return { id: s.id, overflowPx: body.scrollHeight - body.clientHeight, firstBreak: kids[0]?.dataset?.break === 'before', ficheHead: !!body.querySelector('.fiche-head') };
    });
    return {
        converged: r.converged, overflow: r.overflow, passes: r.passes, total: r.totalPages, chapters: r.map.chapters, marks: r.map.marks, ms, sheets: sheets.length, info,
        glossary: Number((/(\d+) termes employés/.exec(r.body) || [0, 0])[1]),
        weightedMaterial: analysisData.weightedMaterialCost, revenue: analysisData.menuRevenue,
    };
}, options);

const pdfText = async (page) => {
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
    return pages;
};

test('rapport du démo : mise en page, chiffres et impression', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    const out = await compose(page, { includeSalaries: false });

    // Mise en page
    expect(out.converged).toBe(true);
    expect(out.overflow).toBe(false);
    expect(out.total).toBeGreaterThanOrEqual(38);
    expect(out.total).toBeLessThanOrEqual(50);
    expect(out.sheets).toBe(out.total);
    out.info.forEach(i => expect(i.overflowPx, `débordement de la page ${i.id}`).toBeLessThanOrEqual(1));
    expect(out.ms).toBeLessThan(15000);

    // Un chapitre commence une page ; chaque fiche commence la sienne (12 formats)
    expect(Object.keys(out.chapters)).toEqual(['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'chA']);
    expect(out.chapters.ch1).toBe(3);
    const ficheMarks = Object.entries(out.marks).filter(([k]) => k.startsWith('fiche:'));
    expect(ficheMarks).toHaveLength(12);
    expect(new Set(ficheMarks.map(([, p]) => p)).size).toBe(12); // une page chacune
    ficheMarks.forEach(([k, p]) => expect(out.info[p - 1].firstBreak || out.info[p - 1].ficheHead, `fiche ${k}`).toBe(true));
    const n = out.info.length;
    for (let i = 3; i <= n; i++) if (out.info[i - 1].ficheHead) expect(out.info[i - 1].firstBreak, `fiche sur la page ${i}`).toBe(true);

    // Impression : une feuille = une page PDF ; texte sélectionnable ; chiffres du moteur ; aucun NaN
    const pages = await pdfText(page);
    expect(pages).toHaveLength(out.total);
    const all = pages.join('\n');
    expect(all).not.toMatch(/NaN|undefined|\[object/);
    expect(all).toContain('Rapport d’analyse du coût de revient');
    expect(all).toContain('Boréal Mets Préparés inc.');
    pages.slice(1).forEach((t, i) => expect(t, `pied de la page ${i + 2}`).toContain(`Page ${i + 2} sur ${out.total}`));
    const flat = all.replace(/\s+/g, ' ');
    expect(flat).toContain(`${(out.weightedMaterial * 100).toFixed(2).replace('.', ',')} %`);
    expect(flat).toContain('79 714 $');
    for (const title of ['Synthèse de direction', 'Résultats : prévu, réel et tendance', 'Produits : où l’argent se fait et se perd', 'Canaux et activités', 'Approvisionnement', 'Main-d’œuvre', 'Fiches produits', 'Annexes et méthodes']) expect(flat).toContain(title);
    // Le sommaire renvoie à la page réelle de chaque chapitre
    for (const [k, p] of Object.entries(out.chapters)) expect(pages[p - 1], `chapitre ${k}`).toContain(k === 'chA' ? 'Annexe' : `Chapitre ${k.slice(2)}`);
    // Aucune donnée salariale sans la case cochée
    expect(all).not.toContain('Mireille');
    expect(all).not.toContain('Annexe C');
});

test('chapitres choisis, commentaire, salaires et glossaire', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    const full = await compose(page, {});
    const partial = await compose(page, { chapters: ['1', '3'], comments: { 1: 'Le creux d’août suit la hausse du bœuf.' }, includeSalaries: false });
    expect(partial.total).toBeLessThan(full.total);
    expect(Object.keys(partial.chapters)).toEqual(['ch1', 'ch3']);
    expect(partial.glossary).toBeLessThan(full.glossary); // moins de chapitres, moins de termes

    const text = (await pdfText(page)).join('\n');
    expect(text).toContain('Commentaire de la direction');
    expect(text).toContain('Le creux d’août suit la hausse du bœuf.');
    expect(text).not.toContain('Fiches produits'.toUpperCase());

    const withSalaries = await compose(page, { chapters: ['A'], includeSalaries: true });
    expect(Object.keys(withSalaries.chapters)).toEqual(['chA']);
    const salaryText = (await pdfText(page)).join('\n');
    expect(salaryText).toContain('Annexe C');
    expect(salaryText).toContain('Mireille');
    expect(salaryText).not.toContain('Commentaire de la direction');
});
