// Point d'entrée du moteur de mise en page du rapport PDF (phase 3 de la refonte de l'export, 22/11).
import { composeDocument, renderPages } from './compose.js';
import { createPaginator, nodesFromHtml } from './paginate.js';
import { PAGE } from './geometry.js';

export { composeDocument, renderPages, emptyPageMap, samePageMap } from './compose.js';
export { createPaginator, nodesFromHtml } from './paginate.js';
export { PAGE, layoutCss, bodyHeightMm, bodyWidthMm } from './geometry.js';

/**
 * Compose un document paginé dans le document courant (navigateur ou fenêtre cachée d'Electron).
 * Les styles du contenu et du moteur (`layoutCss`) doivent déjà être dans le document : la mesure en dépend. Attend les polices avant de mesurer.
 * @param {object} o
 * @param {(map: object) => object[]} o.build  unités { id, chapter?, dense?, html } à partir de la carte des pages (vide à la première passe)
 * @param {{ header: Function, footer: Function }} o.frame  gabarits d'en-tête et de pied de page
 * @param {number} [o.firstPage=1]
 * @returns {Promise<{ html: string, pages: object[], map: object, passes: number, converged: boolean, overflow: boolean }>}
 */
export async function layoutReport({ build, frame, firstPage = 1, doc = document, geometry = PAGE }) {
    if (doc.fonts?.ready) await doc.fonts.ready;
    const paginator = createPaginator(doc, geometry);
    try {
        const result = await composeDocument({
            build,
            paginate: (unit) => paginator.paginate(unit.nodes || nodesFromHtml(unit.html, doc), { dense: unit.dense }),
            firstPage,
        });
        const html = renderPages(result.pages, frame, result.map.total);
        return { ...result, html, overflow: result.pages.some(p => p.overflow) };
    } finally {
        paginator.dispose();
    }
}
