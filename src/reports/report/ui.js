// Briques HTML communes des gabarits du rapport (phase 4 de la refonte de l'export, 22/11). Elles émettent le contrat de contenu du moteur de mise en page
// (attributs data-*, voir reports/layout/paginate.js) : titres collés au suivant, listes et tableaux coupables, repères de page.
import { esc } from './format.js';
import { CHAPTERS, LABELS } from './strings.js';

/** Titre de section : collé au bloc suivant, répété « (suite) » en tête de page suivante ; `small` (précision) ne se répète pas. */
export const h3 = (title, small, { first = false } = {}) =>
    `<h3 class="s" data-heading data-keep="next"${first ? ' style="margin-top:0"' : ''}>${esc(title)}${small ? ` <small data-drop-on-continue>${esc(small)}</small>` : ''}</h3>`;
export const grpTitle = (text, small) => `<div class="grpt" data-heading data-keep="next">${esc(text)}${small ? ` <span class="mut" data-drop-on-continue style="font-weight:400">${esc(small)}</span>` : ''}</div>`;
/** Repère de position : la page où il tombe sert aux renvois « p. N » et au sommaire. */
export const mark = (key) => `<div data-mark="${esc(key)}" data-keep="next" style="height:0"></div>`;
/** Bandeau de départ d'un chapitre. */
export const chapterBanner = (id) => {
    const c = CHAPTERS.find(x => x.id === String(id));
    return `<div class="chap" data-keep="next"><div class="num">${esc(c.n)}</div><div><div class="t">${esc(c.title)}</div><div class="q">Question : ${esc(c.question)}</div></div></div>`;
};
/** Renvoi de page : « p. 12 » ; « p. … » tant que la carte des pages n'est pas connue (première passe). */
export const pageRef = (map, key) => `p.${' '}${map?.marks?.[key] ?? '…'}`;

/** Commentaire de la direction : imprimé seulement s'il a été saisi ; sans commentaire, aucune case ni aucun espace. */
export const commentBox = (text) => {
    const t = (text || '').trim();
    return t ? `<div class="cmt"><b>${esc(LABELS.comment)}</b><p>${esc(t)}</p></div>` : '';
};

/** « Ce que cela veut dire » : phrases produites par des règles ; rien si la liste est vide. */
export const reading = (items) => (items && items.length
    ? `<div class="card" style="margin-top:3mm;background:var(--softer)"><h4>${esc(LABELS.reading)} <span class="mut" style="font-weight:400;font-size:7pt">${esc(LABELS.readingNote)}</span></h4><ul style="margin:0;padding-left:4mm">${items.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`
    : '');

/** Liste de constats en cartes (deux colonnes), coupable entre deux constats. */
export const findingCards = (list) => (list && list.length
    ? `<div class="cf" data-split="items">${list.map(x => `<div class="cfi ${x.tone === 'force' ? 'f' : 'w'}"><b>${x.tone === 'force' ? 'Force' : 'Faiblesse'} · ${esc(x.title)}</b><span>${esc(x.detail)}</span></div>`).join('')}</div>`
    : '');
/** Titre de section puis constats ; rien s'il n'y a pas de constat. */
export const findingsSection = (title, list, small) => (list && list.length ? h3(title, small) + findingCards(list) : '');

/** Nom court d'un canal pour un en-tête de colonne : sans la parenthèse, tronqué. */
export const shortName = (name, max = 14) => { const s = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };

/** Une tuile de chiffre. */
export const tile = ({ label, value, note, noteClass = 'mut', small = false, style = '' }) =>
    `<div class="tile"${small || style ? ` style="${small ? 'min-height:17mm;' : ''}${style}"` : ''}><div class="l">${esc(label)}</div><div><div class="v"${small ? ' style="font-size:13pt"' : ''}>${value}</div>${note ? `<div class="c ${noteClass}">${note}</div>` : ''}</div></div>`;
