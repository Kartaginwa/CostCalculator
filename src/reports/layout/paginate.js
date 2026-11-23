// Pagination : découpe une suite de blocs (éléments DOM) en pages de hauteur fixe, en mesurant le rendu réel (phase 3 de la refonte de l'export PDF,
// 22/11). Portée de la logique de la maquette validée, avec un CONTRAT DE CONTENU explicite par attributs `data-*` :
//
//   data-keep="next"        le bloc reste sur la même page que le bloc suivant (titres, repères, lignes d'un graphique en barres).
//   data-break="before"     le bloc commence une nouvelle page (début d'une fiche). Un chapitre est une unité à part : il commence toujours une page.
//                           Un bloc « collé au suivant » juste avant lui ne l'entraîne pas : le saut est toujours respecté.
//   data-mark="clé"         repère de position : la page où il tombe sert aux renvois « → p. N » (voir compose.js).
//   data-heading            titre qui se répète en tête de page suivante quand le bloc qui le suit est coupé : il y devient « Titre (suite) ».
//   data-drop-on-continue   élément retiré de ce titre répété (sous-titre, précision).
//   data-split="rows"       tableau coupé entre deux lignes de son <tbody> (l'en-tête <thead> se répète ; le <tfoot> reste au dernier morceau).
//       data-split-before="sélecteur"  ne couper que devant une ligne qui contient ce sélecteur (la cascade ne se coupe qu'entre deux sections).
//   data-split="items"      liste de cartes : coupée entre deux enfants directs.
//   data-split="columns"    colonnes parallèles (`[data-col]` contenant des <li>) : remplies à tour de rôle, la plus courte d'abord.
//   data-split-min="n"      nombre minimal de lignes ou d'éléments de chaque côté de la coupure (2 par défaut : ni ligne veuve, ni orpheline).
//
// Un bloc qui ne tient pas sur une page vide et ne se coupe pas est placé seul sur sa page et signalé `overflow` (jamais rogné en silence).
import { PAGE, bodyHeightMm } from './geometry.js';

const TOLERANCE = 0.5; // px : l'arrondi du navigateur ne doit pas créer de saut de page inutile
const GUARD = 20000;

const isKeep = (n) => n.dataset?.keep === 'next';
const minOf = (el) => Math.max(1, Number(el.dataset.splitMin) || 2);
const markKeys = (nodes) => nodes.flatMap(n => (n.matches?.('[data-mark]') ? [n.dataset.mark] : []).concat([...(n.querySelectorAll?.('[data-mark]') || [])].map(x => x.dataset.mark)));

/**
 * Crée un paginateur lié à un document : une zone de mesure invisible, de la même largeur que le corps d'une page.
 * @returns {{ paginate: (nodes: Element[], options?: {dense?: boolean}) => Page[], availableHeight: number, dispose: () => void }}
 *   Page = { nodes, marks, used, overflow } : `used` = hauteur occupée (px), `overflow` = un bloc indivisible dépasse la page.
 */
export function createPaginator(doc = document, geometry = PAGE) {
    const host = doc.createElement('div');
    host.className = 'rl-measure-host';
    const body = doc.createElement('div');
    body.className = 'rl-body rl-measure';
    host.appendChild(body);
    const probe = doc.createElement('div');
    probe.style.height = `${bodyHeightMm(geometry)}mm`;
    host.appendChild(probe);
    doc.body.appendChild(host);
    const availableHeight = probe.getBoundingClientRect().height;
    host.removeChild(probe);

    const height = () => body.getBoundingClientRect().height;
    const fits = () => height() <= availableHeight + TOLERANCE;
    const clone = (el) => el.cloneNode(true);

    // Titres répétés en tête de page suivante, avec « (suite) » (jamais deux fois).
    const continuationHeads = (pre) => pre.filter(n => n.hasAttribute('data-heading')).map(n => {
        const c = clone(n);
        c.querySelectorAll('[data-drop-on-continue], .rl-suite').forEach(e => e.remove());
        const s = doc.createElement('span');
        s.className = 'rl-suite';
        s.textContent = ' (suite)';
        c.appendChild(s);
        c.dataset.keep = 'next';
        return c;
    });

    const splittable = (n) => {
        const k = n.dataset?.split;
        if (k === 'rows') return n.tagName === 'TABLE' && n.tBodies.length > 0 && n.tBodies[0].rows.length >= 2 * minOf(n);
        if (k === 'items') return n.children.length >= 2 * minOf(n);
        return k === 'columns';
    };

    // ---------- coupures ----------
    const rowsBuild = (el, k) => {
        const rows = [...el.tBodies[0].rows], a = clone(el), b = clone(el);
        a.tBodies[0].replaceChildren(...rows.slice(0, k).map(clone));
        if (a.tFoot) a.tFoot.remove();
        b.tBodies[0].replaceChildren(...rows.slice(k).map(clone));
        return [a, b];
    };
    const itemsBuild = (el, k) => {
        const items = [...el.children], a = clone(el), b = clone(el);
        a.replaceChildren(...items.slice(0, k).map(clone));
        b.replaceChildren(...items.slice(k).map(clone));
        return [a, b];
    };
    const columnsBuild = (el, ca, cb) => {
        const cols = [...el.querySelectorAll(':scope > [data-col]')];
        const make = (counts, rest) => {
            const c = clone(el);
            [...c.querySelectorAll(':scope > [data-col]')].forEach((col, i) => {
                const lis = [...cols[i].querySelectorAll('li')];
                col.querySelector('ul').replaceChildren(...(rest ? lis.slice(counts[i]) : lis.slice(0, counts[i])).map(clone));
            });
            return c;
        };
        const first = make([ca, cb], false), rest = make([ca, cb], true);
        [...rest.querySelectorAll(':scope > [data-col]')].forEach(c => { if (!c.querySelector('li')) c.remove(); });
        if (rest.querySelectorAll(':scope > [data-col]').length === 1) rest.style.gridTemplateColumns = '1fr';
        return [first, rest];
    };

    // Plus grand morceau de `last` qui tient sur la page déjà garnie de `pre` (qu'on suppose ajouté à `body`) ; null si aucun.
    const trySplit = (last) => {
        const test = (piece) => { body.appendChild(piece); const ok = fits(); body.removeChild(piece); return ok; };
        const kind = last.dataset.split, min = minOf(last);
        if (kind === 'rows') {
            const rows = [...last.tBodies[0].rows], at = last.dataset.splitBefore;
            for (let k = rows.length - min; k >= min; k--) {
                if (at && !rows[k].querySelector(at)) continue;
                const [a, b] = rowsBuild(last, k);
                if (test(a)) return { piece: a, rest: b };
            }
        } else if (kind === 'items') {
            for (let k = last.children.length - min; k >= min; k--) {
                const [a, b] = itemsBuild(last, k);
                if (test(a)) return { piece: a, rest: b };
            }
        } else if (kind === 'columns') {
            const totals = [...last.querySelectorAll(':scope > [data-col]')].map(c => c.querySelectorAll('li').length);
            let ca = 0, cb = 0, any = false;
            while (ca < totals[0] || cb < (totals[1] || 0)) {
                const [pa] = columnsBuild(last, ca, cb);
                body.appendChild(pa);
                const heights = [...pa.querySelectorAll(':scope > [data-col]')].map(c => c.getBoundingClientRect().height);
                body.removeChild(pa);
                const order = (heights[1] === undefined || heights[0] <= heights[1]) ? [0, 1] : [1, 0];
                let moved = false;
                for (const c of order) {
                    if ((c === 0 ? ca : cb) >= (totals[c] || 0)) continue;
                    const na = ca + (c === 0 ? 1 : 0), nb = cb + (c === 1 ? 1 : 0);
                    if (test(columnsBuild(last, na, nb)[0])) { ca = na; cb = nb; moved = true; break; }
                }
                if (!moved) break;
                any = true;
            }
            if (any && (ca < totals[0] || cb < (totals[1] || 0)) && ca + cb > 0) { const [a, b] = columnsBuild(last, ca, cb); return { piece: a, rest: b }; }
        }
        return null;
    };

    function paginate(nodes, { dense = false } = {}) {
        body.className = `rl-body rl-measure${dense ? ' is-dense' : ''}`;
        body.innerHTML = '';
        const pages = [], queue = [...nodes];
        let cur = [], guard = 0;
        const closePage = () => {
            const used = height();
            pages.push({ nodes: cur, marks: markKeys(cur), used, overflow: used > availableHeight + TOLERANCE });
            cur = [];
            body.innerHTML = '';
        };
        const append = (arr) => arr.forEach(n => { const c = clone(n); body.appendChild(c); cur.push(c); });
        const drop = (k) => { for (let i = 0; i < k; i++) { body.removeChild(body.lastChild); cur.pop(); } };

        while (queue.length && guard++ < GUARD) {
            // Un « groupe » : les blocs collés au suivant, puis ce suivant (jamais un titre seul en bas de page).
            let count = 0;
            // Un saut forcé n'est jamais absorbé : la chaîne « collé au suivant » s'arrête devant un bloc qui commence une nouvelle page.
            while (count < queue.length - 1 && isKeep(queue[count]) && queue[count + 1].dataset?.break !== 'before') count++;
            count++;
            const group = queue.slice(0, count), last = group[group.length - 1], pre = group.slice(0, -1);
            if (group[0].dataset?.break === 'before' && cur.length) { closePage(); continue; }
            append(group);
            if (fits()) { queue.splice(0, count); continue; }
            drop(group.length);
            if (splittable(last)) {
                append(pre);
                const r = trySplit(last);
                drop(pre.length);
                if (r) {
                    append(pre);
                    body.appendChild(r.piece); cur.push(r.piece);
                    queue.splice(0, count);
                    queue.unshift(...continuationHeads(pre), r.rest);
                    closePage();
                    continue;
                }
            }
            if (cur.length) { closePage(); continue; }
            append(group); queue.splice(0, count); closePage(); // indivisible et trop haut : seul sur sa page, signalé
        }
        if (cur.length) closePage();
        body.innerHTML = '';
        return pages;
    }

    return { paginate, availableHeight, dispose: () => host.remove() };
}

/** Convertit un fragment HTML en blocs de premier niveau. */
export function nodesFromHtml(html, doc = document) {
    const t = doc.createElement('div');
    t.innerHTML = html;
    return [...t.children];
}
