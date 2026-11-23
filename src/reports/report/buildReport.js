// Assemblage du rapport PDF (phase 4 de la refonte de l'export, 22/11) : choisit les chapitres, fabrique leurs unités HTML, les fait paginer par le moteur de mise en
// page (reports/layout) en plusieurs passes, ajoute la couverture et le sommaire, et renvoie le document complet prêt à imprimer.
import { layoutReport, renderPages } from '../layout/index.js';
import { REPORT_CSS } from './styles.js';
import { buildReportModel } from './model.js';
import { chapter1, chapter2, chapter3, chapter4, chapter5, chapter6 } from './chapters.js';
import { ficheHtml, ficheIntro } from './fiches.js';
import { annexA, annexB, annexC, annexD } from './annexes.js';
import { coverHtml, tocHtml, headerHtml, footerHtml } from './front.js';
import { chapterBanner } from './ui.js';
import { selectGlossary, glossaryTotal } from './glossary.js';
import { CHAPTERS } from './strings.js';

export const ALL_CHAPTER_IDS = CHAPTERS.map(c => c.id);
const DENSE = { '1': true, '7': true, 'A': true };
const CHAPTER_FN = { '1': chapter1, '2': chapter2, '3': chapter3, '4': chapter4, '5': chapter5, '6': chapter6 };

/**
 * Options d'export : { chapters?: string[], comments?: { [chapitre]: string }, includeSalaries?: boolean, title?, presentedTo?, generatedOn?: Date, appLogo?: string }.
 * Un chapitre demandé mais sans données est écarté (la fenêtre d'export le grise, avec la raison : model.availability).
 */
export function resolveOptions(model, options = {}) {
    const wanted = options.chapters || ALL_CHAPTER_IDS;
    return {
        ...options,
        chapters: ALL_CHAPTER_IDS.filter(id => wanted.includes(id) && !model.availability[id]),
        comments: options.comments || {},
        includeSalaries: !!options.includeSalaries,
        generatedOn: options.generatedOn || new Date(),
    };
}

/** Les unités HTML (une par chapitre inclus), à partir de la carte des pages courante. Fonction pure : testable sans navigateur. */
export function buildUnits(model, options, map) {
    const o = resolveOptions(model, options), units = [];
    for (const id of o.chapters) {
        let html = chapterBanner(id);
        if (CHAPTER_FN[id]) html += CHAPTER_FN[id](model, map, o.comments[id]);
        else if (id === '7') html += ficheIntro(model, map) + model.fiches.map(F => ficheHtml(F, model)).join('');
        else if (id === 'A') {
            const a = annexA(model), b = annexB(model, !a), c = o.includeSalaries ? annexC(model, !a && !b) : '';
            const others = units.map(u => u.html).join(' ') + a + b + c;
            html += a + b + c + annexD(selectGlossary(others), glossaryTotal(), !a && !b && !c);
        }
        units.push({ id: `ch${id}`, chapter: id, dense: !!DENSE[id], html });
    }
    return units;
}

/**
 * Compose le rapport. Nécessite un navigateur (mesure du rendu réel) : fenêtre cachée d'Electron ou page de test.
 * @returns {Promise<{ html: string, css: string, body: string, pages: object[], map: object, passes: number, converged: boolean, overflow: boolean, totalPages: number, model: object }>}
 */
export async function buildReport(inputs, options = {}) {
    const model = inputs.model || buildReportModel(inputs);
    const o = resolveOptions(model, options);
    const style = document.createElement('style');
    style.textContent = REPORT_CSS;
    document.head.appendChild(style);
    try {
        const frame = { pageClass: 'std', header: (p) => headerHtml(model, p.chapter), footer: (p, total) => footerHtml(o.generatedOn, p.n, total, p.chapter) };
        const res = await layoutReport({ build: (map) => buildUnits(model, o, map), frame, firstPage: 3 });
        const total = Math.max(res.map.total, 2);
        const cover = `<section class="rl-sheet" id="p1"><div class="rl-page"><div class="rl-body" style="inset:0">${coverHtml(model, o)}</div></div></section>`;
        const toc = renderPages([{ n: 2, chapter: null, dense: true, nodes: [{ outerHTML: tocHtml(model, res.map, o.chapters) }] }], frame, total);
        const body = cover + toc + res.html;
        const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${(model.company.name || 'Rapport').replace(/</g, '&lt;')} — rapport</title><style>${REPORT_CSS}</style></head><body>${body}</body></html>`;
        return { html, css: REPORT_CSS, body, pages: res.pages, map: res.map, passes: res.passes, converged: res.converged, overflow: res.overflow, totalPages: total, model };
    } finally {
        style.remove();
    }
}
