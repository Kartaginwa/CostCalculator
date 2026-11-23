// Composition du document en plusieurs passes (phase 3 de la refonte de l'export PDF, 22/11). Fonction pure : la pagination elle-même est injectée,
// ce qui permet de tester la convergence sans navigateur (Vitest) et la mise en page réelle avec Playwright.
//
// Pourquoi plusieurs passes : le texte des renvois (« → p. 12 ») et le sommaire dépendent des pages où tombent les repères, qui dépendent à leur tour de
// la hauteur du texte. On compose avec une carte de pages vide, puis avec la carte obtenue, jusqu'à ce qu'elle ne change plus (deux passes d'ordinaire).

/** Carte des pages : première page de chaque repère (`marks`) et de chaque unité (`chapters`), et dernier numéro de page (`total`). */
export const emptyPageMap = () => ({ marks: {}, chapters: {}, total: 0 });

const sameRecord = (a, b) => {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => a[k] === b[k]);
};
export const samePageMap = (a, b) => a.total === b.total && sameRecord(a.marks, b.marks) && sameRecord(a.chapters, b.chapters);

/**
 * @param {object}   o
 * @param {(map: object) => object[] | Promise<object[]>} o.build  fabrique les unités à partir de la carte courante ; unité = { id, chapter?, dense?, ...contenu }
 * @param {(unit: object) => object[] | Promise<object[]>} o.paginate  découpe une unité en pages { nodes, marks, used, overflow }
 * @param {number} [o.firstPage=1]  numéro de la première page paginée (la couverture et le sommaire peuvent la précéder)
 * @param {number} [o.maxPasses=5]
 * @returns {Promise<{ pages: object[], map: object, passes: number, converged: boolean }>} chaque page reçoit son numéro `n`, son `unit` et son `chapter`
 */
export async function composeDocument({ build, paginate, firstPage = 1, maxPasses = 5 }) {
    let map = emptyPageMap(), result = null;
    for (let pass = 1; pass <= maxPasses; pass++) {
        const units = await build(map);
        const next = emptyPageMap(), pages = [];
        let n = firstPage;
        for (const unit of units) {
            const recs = await paginate(unit);
            if (recs.length) next.chapters[unit.id] = n;
            for (const rec of recs) {
                for (const k of rec.marks || []) if (!(k in next.marks)) next.marks[k] = n;
                pages.push({ ...rec, n, unit: unit.id, chapter: unit.chapter ?? unit.id, dense: !!unit.dense });
                n++;
            }
        }
        next.total = n - 1;
        result = { pages, map: next, passes: pass };
        if (samePageMap(map, next)) return { ...result, converged: true };
        map = next;
    }
    return { ...result, converged: false };
}

/**
 * Assemble les pages en HTML : un `<section class="rl-sheet">` par page, avec en-tête et pied fournis par le gabarit (phase 4).
 * @param {object[]} pages  pages de composeDocument
 * @param {{ header: (page, total) => string, footer: (page, total) => string, pageClass?: string }} frame
 * @param {number} total  dernier numéro de page du rapport
 */
export function renderPages(pages, { header, footer, pageClass }, total) {
    return pages.map(p => `<section class="rl-sheet" id="p${p.n}"><div class="rl-page${pageClass ? ` ${pageClass}` : ''}"><div class="rl-head">${header(p, total)}</div>`
        + `<div class="rl-body${p.dense ? ' is-dense' : ''}">${p.nodes.map(x => x.outerHTML).join('')}</div>`
        + `<div class="rl-foot">${footer(p, total)}</div></div></section>`).join('');
}
