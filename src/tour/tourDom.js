// Visite guidée — outils pour piloter l'instance de l'application jouée dans le calque de la visite.
// Tout passe par le DOM de cette instance (jamais celui de l'application de l'utilisateur) : les cibles
// sont cherchées DANS `root`, car des identifiants (#tab-ingredients…) existent aussi dans l'application cachée.

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Une cible est : un sélecteur CSS ; { sel, nth } (n-ième élément du sélecteur) ; { btn, contains?, within? }
// (bouton dont le texte est ce libellé) ; { text, within?, up? } (plus petit élément dont le texte commence par
// `text`, puis `up` niveaux plus haut — pour viser la carte qui l'entoure).
export const resolveEl = (root, target) => {
    if (!root || !target) return null;
    if (typeof target === 'string') return root.querySelector(target);
    const scope = target.within ? root.querySelector(target.within) : root;
    if (!scope) return null;
    if (target.btn) {
        const label = norm(target.btn);
        return [...scope.querySelectorAll('button')].filter((b) => (target.contains ? norm(b.textContent).includes(label) : norm(b.textContent) === label))[target.nth || 0] || null;
    }
    if (target.sel) return scope.querySelectorAll(target.sel)[target.nth || 0] || null;
    if (target.text) {
        const wanted = norm(target.text);
        const hits = [...scope.querySelectorAll('*')].filter((e) => { const t = norm(e.textContent); return t.startsWith(wanted) && t.length < wanted.length + 45; });
        if (!hits.length) return null;
        let el = hits.sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0];
        for (let i = 0; i < (target.up || 0) && el.parentElement; i++) el = el.parentElement;
        return el;
    }
    return null;
};

// Lit une valeur affichée : le contenu d'un champ, ou le nombre qui suit une étiquette (« Coût Matière (%) » → « 34,86% »).
// `makeReader(root, spec)` renvoie une fonction qui relit la valeur à la demande ; l'élément d'étiquette n'est cherché
// qu'une fois (puis seulement s'il disparaît), pour que la lecture en direct reste légère.
// `spec` : { sel, nth } pour un champ ; { label, within?, nth? } pour un nombre à côté d'une étiquette.
const VALUE_RE = /-?\d[\d\s]*(?:,\d+)?\s?(?:\$\/h|\$|%|h|unités)?/;
const locateLabel = (root, spec) => {
    const scope = spec.within ? [...root.querySelectorAll(spec.within)][spec.nth || 0] : root;
    if (!scope) return null;
    const wanted = norm(spec.label);
    const all = [...scope.querySelectorAll('*')];
    const inline = all.filter((e) => { const t = norm(e.textContent); return t.startsWith(wanted) && t.length > wanted.length && t.length < wanted.length + 45; });
    if (inline.length) return { el: inline.sort((x, y) => norm(x.textContent).length - norm(y.textContent).length)[0], wanted, inline: true };
    const exact = all.find((e) => norm(e.textContent) === wanted);
    return exact ? { el: exact, wanted, inline: false } : null;
};
const extract = (hit) => {
    if (hit.inline) { const m = norm(hit.el.textContent).slice(hit.wanted.length).match(VALUE_RE); return m ? m[0].trim() : ''; }
    for (let n = hit.el.nextElementSibling; n; n = n.nextElementSibling) {
        const m = norm(n.textContent).match(VALUE_RE);
        if (m && /\d/.test(m[0])) return m[0].trim();
    }
    return '';
};
export const makeReader = (root, spec) => {
    let hit = null;
    return () => {
        if (!spec) return '';
        if (spec.sel) { const el = resolveEl(root, spec); return el ? (el.value !== undefined ? el.value : norm(el.textContent)) : ''; }
        if (!hit || !root.contains(hit.el)) hit = locateLabel(root, spec);
        return hit ? extract(hit) : '';
    };
};

// Écrit une valeur dans un champ contrôlé par React (le setter natif contourne le suivi de valeur de React).
export const setFieldValue = (el, value) => {
    if (!el) return false;
    const isSelect = el instanceof window.HTMLSelectElement;
    const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : isSelect ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    el.dispatchEvent(new window.Event(isSelect ? 'change' : 'input', { bubbles: true }));
    return true;
};

export const selectOptionByText = (el, text) => {
    if (!el || !el.options) return false;
    const opt = [...el.options].find((o) => o.text.trim() === text || o.text.trim().startsWith(text));
    return opt ? setFieldValue(el, opt.value) : false;
};

export const clickEl = (el) => { if (el) el.click(); return !!el; };

// Place le curseur clignotant dans le champ pendant la saisie (aucun clavier utilisateur n'y arrive : voir TourPlayer).
export const focusField = (el) => { try { el.focus({ preventScroll: true }); } catch { /* sans effet */ } };
export const blurField = (el) => { try { el.blur(); } catch { /* sans effet */ } };

// Survol : React déduit onMouseEnter / onMouseLeave de mouseover / mouseout.
export const hoverEl = (el, on) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent(on ? 'mouseover' : 'mouseout', { bubbles: true, cancelable: true, relatedTarget: null }));
    return true;
};

// Survol à un endroit précis d'un élément (graphique : fx, fy = fraction de la largeur / hauteur). Les graphiques
// réagissent à mousemove ; on renvoie le point visé, pour y amener le pointeur.
export const hoverAtEl = (el, fx, fy) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * fx; const y = r.top + r.height * fy;
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    el.dispatchEvent(new window.MouseEvent('mouseover', init));
    el.dispatchEvent(new window.MouseEvent('mousemove', init));
    return { x, y };
};

export const pressEscape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

// Défilement doux qui tient compte de la barre d'onglets collée (en haut) et des sous-titres / contrôles (en bas) :
// la cible est centrée dans la zone réellement visible, ou alignée en haut si elle est plus haute que cette zone.
const TOP_RESERVED = 76;
const BOTTOM_RESERVED = 150;
export const scrollToEl = (el, block = 'center') => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const avail = window.innerHeight - BOTTOM_RESERVED - TOP_RESERVED;
    const delta = block === 'start' || r.height > avail
        ? r.top - TOP_RESERVED - 10
        : r.top - (TOP_RESERVED + (avail - r.height) / 2);
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: reduce ? 'auto' : 'smooth' });
};

export const isVisible = (el) => !!el && el.getClientRects().length > 0;
