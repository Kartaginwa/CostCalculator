import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { SCENES, CHAPTERS, TOTAL_DURATION, INTRO_MS, SETTLE_MS, NAV_STEP_MS, POINT_LEAD, hasIntro, sceneLength, expandSteps } from './tourScript.js';
import {
    resolveEl, makeReader, setFieldValue, selectOptionByText, clickEl, hoverEl, hoverAtEl, pressEscape, scrollToEl, focusField, blurField,
} from './tourDom.js';

// Lecteur de la visite guidée : joue le scénario (tourScript.js) sur l'instance de l'application contenue dans
// `rootRef`. Rien à cliquer : le pointeur se déplace, les champs se remplissent lettre à lettre, des étiquettes
// expliquent ce qu'on regarde (certaines affichent une valeur lue EN DIRECT dans l'application), les sous-titres
// apparaissent mot à mot. La petite barre du bas (pause, scènes, chapitres, vitesse, quitter) sert seulement à
// reprendre la main. À la fin, la visite se ferme d'elle-même et l'utilisateur retrouve exactement ce qu'il avait.
//
// Continuité : l'application jouée n'est remontée à neuf que lorsqu'on SAUTE des scènes (précédent, chapitre). En lecture
// normale, rien ne repart de zéro : la page ne revient en haut que lorsqu'un onglet (ou un sous-onglet) change, et ce
// changement est montré (pointeur + clic). Les modifications faites par les scènes s'accumulent, comme dans un vrai travail.

const SPEEDS = [0.75, 1, 1.5];
const RETRY_MS = 3000;            // une cible peut mettre un instant à exister
const TYPE_END_HOLD = 500;        // le curseur reste un instant dans le champ une fois la saisie finie
const BAR_H = 44;                 // hauteur de la barre du bas
const fmt = (ms) => { const s = Math.round(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SCENE_STARTS = [];
SCENES.reduce((acc, _, i) => { SCENE_STARTS.push(acc); return acc + sceneLength(i); }, 0);
const EXPANDED = SCENES.map((s) => expandSteps(s.steps));
const CHAPTER_RANGES = CHAPTERS.map((_, ci) => {
    const idxs = SCENES.map((s, i) => (s.chapter === ci ? i : -1)).filter((i) => i >= 0);
    const first = idxs[0]; const last = idxs[idxs.length - 1];
    return { first, start: SCENE_STARTS[first], end: SCENE_STARTS[last] + sceneLength(last) };
});
const reduceMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Couleurs du logo de l'application, sur un thème clair (cartes de titre).
const GREEN = '#1ba33b'; const BLUE = '#1b7bd0'; const NAVY = '#22303f';

// Caméra : la page doit toujours montrer ce dont on parle. Les zones réservées sont la barre d'onglets collée (haut)
// et les sous-titres + la barre de contrôle (bas).
const CAM_TOP = 82; const CAM_BOTTOM = 156;
const stuckCache = new WeakMap();
const isStuck = (el) => { // dans une fenêtre fixe ou collée (guide, modale, barre d'onglets) : la page n'a pas à défiler
    if (stuckCache.has(el)) return stuckCache.get(el);
    let stuck = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        const st = window.getComputedStyle(n);
        // collé verticalement seulement : une colonne collée à gauche (étiquettes de tableau) défile avec la page
        if (st.position === 'fixed' || (st.position === 'sticky' && st.top !== 'auto')) { stuck = true; break; }
    }
    stuckCache.set(el, stuck);
    return stuck;
};
const inZone = (el) => {
    const r = el.getBoundingClientRect();
    const avail = window.innerHeight - CAM_BOTTOM - CAM_TOP;
    if (r.height <= avail) return r.top >= CAM_TOP - 6 && r.bottom <= window.innerHeight - CAM_BOTTOM + 6;
    return r.top >= CAM_TOP - 40 && r.top <= CAM_TOP + avail * 0.45; // élément plus haut que l'écran : son début doit être visible
};

const STYLES = `
@keyframes tourWord { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes tourIntro { 0% { opacity: 0; } 12% { opacity: 1; } 86% { opacity: 1; } 100% { opacity: 0; } }
@keyframes tourIntroText { 0% { opacity: 0; transform: translateY(26px) scale(.96); } 16% { opacity: 1; transform: none; } 100% { opacity: 1; transform: scale(1.03); } }
@keyframes tourFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes tourPulse { 0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,.22), 0 0 16px rgba(59,130,246,.40); } 50% { box-shadow: 0 0 0 8px rgba(59,130,246,.12), 0 0 26px rgba(59,130,246,.55); } }
`;

// Sous-titre : les mots apparaissent un à un ; **gras** = mots clés mis en couleur.
const Caption = ({ text }) => {
    const tokens = []; // mots et blancs d'origine : « étoiles, » reste collé à sa virgule
    text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach((part) => {
        const bold = part.startsWith('**');
        (bold ? part.slice(2, -2) : part).split(/(\s+)/).filter(Boolean).forEach((t) => tokens.push({ t, bold, space: /^\s+$/.test(t) }));
    });
    let wordIndex = 0;
    return (
        <>
            {tokens.map((x, i) => {
                if (x.space) return ' ';
                const delay = Math.min(wordIndex++ * 55, 2400);
                return (
                    <span key={i} className={x.bold ? 'font-bold text-sky-300' : ''}
                        style={{ display: 'inline-block', animation: `tourWord 300ms ${delay}ms both ease-out` }}>{x.t}</span>
                );
            })}
        </>
    );
};

// Le halo et le pointeur glissent vers une NOUVELLE cible, puis la suivent exactement (sans retard) pendant que la page défile.
const glide = (el, ms, props) => {
    if (!el) return;
    el.style.transition = props;
    clearTimeout(el._glideTimer);
    el._glideTimer = setTimeout(() => { el.style.transition = 'opacity 250ms'; }, ms + 40);
};

export const TourPlayer = ({ rootRef, onExit, onResetApp }) => {
    const [idx, setIdx] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [speed, setSpeed] = useState(1);
    const [clock, setClock] = useState(0);
    const [notes, setNotes] = useState([]);
    const [introOn, setIntroOn] = useState(hasIntro(0));
    const [fading, setFading] = useState(false);

    const idxRef = useRef(0);
    const playingRef = useRef(true);
    const speedRef = useRef(1);
    const elapsedRef = useRef(hasIntro(0) ? -INTRO_MS : 0);
    const firedRef = useRef(new Set());
    const extraRef = useRef([]);            // gestes ajoutés à l'exécution (navigation entre onglets)
    const pendingRef = useRef([]);
    const typingRef = useRef([]);
    const tabRef = useRef('info');          // où se trouve l'application jouée (elle seule bouge : l'utilisateur est bloqué)
    const subRef = useRef('overview');
    const haloTargetRef = useRef(null);
    const cursorTargetRef = useRef(null);
    const noteTargetsRef = useRef(new Map());
    const noteDataRef = useRef([]);
    const hoveredRef = useRef(null);
    const focusRef = useRef(null);          // ce dont on parle : la caméra le garde à l'écran
    const camAtRef = useRef(0);
    const lastScrollYRef = useRef(0);
    const fadeTimerRef = useRef(null);
    const finishingRef = useRef(false);
    const layerRef = useRef(null);
    const haloEl = useRef(null);
    const cursorEl = useRef(null);
    const barRef = useRef(null);
    const segFills = useRef([]);
    const lastClockRef = useRef(-1);
    const introOnRef = useRef(hasIntro(0));

    // Pendant la visite, l'utilisateur ne fait pas défiler la page : seule la caméra le fait (cadres bien placés).
    useEffect(() => {
        const html = document.documentElement;
        const prev = { overflowY: html.style.overflowY, gutter: html.style.scrollbarGutter };
        html.style.overflowY = 'hidden'; html.style.scrollbarGutter = 'stable';
        const stop = (e) => { if (e.isTrusted) e.preventDefault(); };
        document.addEventListener('wheel', stop, { passive: false, capture: true });
        document.addEventListener('touchmove', stop, { passive: false, capture: true });
        return () => {
            html.style.overflowY = prev.overflowY; html.style.scrollbarGutter = prev.gutter;
            document.removeEventListener('wheel', stop, { capture: true }); document.removeEventListener('touchmove', stop, { capture: true });
        };
    }, []);

    // --- gestes -----------------------------------------------------------------------------------------
    const moveCursorTo = useCallback((target) => {
        if (cursorTargetRef.current !== target) glide(cursorEl.current, 700, 'transform 700ms cubic-bezier(.4,0,.2,1), opacity 250ms');
        cursorTargetRef.current = target;
    }, []);
    const setHalo = useCallback((el) => {
        if (haloTargetRef.current !== el) glide(haloEl.current, 450, 'transform 450ms ease-out, width 450ms ease-out, height 450ms ease-out, opacity 250ms');
        haloTargetRef.current = el;
    }, []);

    const run = useCallback((step) => {
        const r = rootRef.current;
        if (!r) return true;
        if (step.unless && r.querySelector(step.unless)) return true;
        const find = () => resolveEl(r, step.target);
        switch (step.do) {
            case 'point': { const el = find(); if (!el) return false; moveCursorTo(el); focusRef.current = el; return true; }
            case 'highlight': {
                if (step.target === null) { setHalo(null); return true; }
                const el = find(); if (!el) return false;
                setHalo(el); focusRef.current = el;
                if (!step.noPointer) moveCursorTo(el);
                return true;
            }
            case 'press': {
                const el = find(); if (!el) return false;
                if (!step.silent) {
                    moveCursorTo(el); focusRef.current = el;
                    const c = cursorEl.current;
                    if (c) { c.dataset.pressed = '1'; setTimeout(() => { c.dataset.pressed = ''; }, 260); }
                }
                clickEl(el);
                // le suivi d'onglet ne change qu'une fois le clic réellement fait (on peut sauter des scènes sans jamais naviguer)
                if (step.track) { if (step.track.kind === 'tab') tabRef.current = step.track.to; else subRef.current = step.track.to; }
                return true;
            }
            case 'scroll': { const el = find(); if (!el) return false; scrollToEl(el, step.block || 'center'); return true; }
            case 'scrollTop': window.scrollTo({ top: 0, behavior: step.instant || reduceMotion() ? 'auto' : 'smooth' }); return true;
            case 'hover': { const el = find(); if (!el) return false; hoveredRef.current = el; focusRef.current = el; hoverEl(el, true); return true; }
            case 'unhover': { if (hoveredRef.current) hoverEl(hoveredRef.current, false); hoveredRef.current = null; return true; }
            case 'hoverAt': {
                const el = find(); if (!el) return false;
                const pt = hoverAtEl(el, step.fx, step.fy);
                if (pt) { moveCursorTo({ virtual: true, el, fx: step.fx, fy: step.fy }); focusRef.current = el; }
                return true;
            }
            case 'escape': pressEscape(); return true;
            case 'select': {
                const el = find(); if (!el) return false;
                return selectOptionByText(el, step.option);
            }
            case 'type': {
                const el = find(); if (!el) return false;
                setHalo(el); moveCursorTo(el); focusRef.current = el;
                focusField(el);
                setFieldValue(el, '');
                typingRef.current = typingRef.current.filter((j) => j.el !== el);
                typingRef.current.push({ el, text: step.text, rate: step.rate || 80, start: elapsedRef.current, n: 0, doneAt: null });
                return true;
            }
            case 'note': {
                const el = find(); if (!el) return false;
                noteTargetsRef.current.set(step.id, el); focusRef.current = el;
                const data = { id: step.id, text: step.text, side: step.side || 'top', read: step.read ? makeReader(r, step.read) : null, value: '', readAt: -1e9 };
                noteDataRef.current = [...noteDataRef.current.filter((n) => n.id !== step.id), data];
                setNotes(noteDataRef.current);
                return true;
            }
            case 'unnote': {
                noteDataRef.current = step.id ? noteDataRef.current.filter((n) => n.id !== step.id) : [];
                if (!step.id) noteTargetsRef.current.clear();
                setNotes(noteDataRef.current);
                return true;
            }
            case 'guideOpen': { const el = r.querySelector('[title="Guide d\'utilisation"]'); if (!el) return false; clickEl(el); return true; }
            case 'guideClose': { const el = r.querySelector('[aria-label="Fermer le guide"]'); if (el) clickEl(el); return true; }
            default: return true;
        }
    }, [rootRef, moveCursorTo, setHalo]);

    const cleanupScene = useCallback(() => {
        if (hoveredRef.current) { hoverEl(hoveredRef.current, false); hoveredRef.current = null; }
        typingRef.current.forEach((j) => blurField(j.el));
        typingRef.current = [];
        haloTargetRef.current = null; focusRef.current = null;
        noteDataRef.current = []; noteTargetsRef.current.clear(); setNotes([]);
        pendingRef.current = []; extraRef.current = [];
    }, []);

    const quit = useCallback(() => { clearTimeout(fadeTimerRef.current); cleanupScene(); onExit(); }, [cleanupScene, onExit]);

    const finish = useCallback(() => {
        if (finishingRef.current) return;
        finishingRef.current = true;
        setFading(true);
        setTimeout(quit, 600);
    }, [quit]);

    // Navigation d'une scène : l'onglet (et le sous-onglet) voulus. Cachée derrière la carte de titre si la scène en a une,
    // sinon montrée : pointeur sur l'onglet, clic. Renvoie le temps à prévoir avant le début de la scène.
    const planNav = useCallback((scene, intro, base) => {
        const need = [];
        if (scene.tab && scene.tab !== tabRef.current) need.push({ kind: 'tab', to: scene.tab });
        if (scene.tab === 'summary') {
            const sub = scene.subtab || 'overview';
            if (sub !== subRef.current) need.push({ kind: 'sub', to: sub });
        }
        const sel = (n) => (n.kind === 'tab' ? `#tab-${n.to}` : `[data-tour="subtab-${n.to}"]`);
        if (!need.length) return 0;
        if (intro) {
            need.forEach((n, k) => extraRef.current.push({ at: base + 150 + k * 260, do: 'press', target: sel(n), silent: true, track: n }));
            extraRef.current.push({ at: base + 150 + need.length * 260, do: 'scrollTop', instant: true });
            return 0;
        }
        need.forEach((n, k) => {
            const t = base + k * NAV_STEP_MS;
            extraRef.current.push({ at: t, do: 'point', target: sel(n) }, { at: t + POINT_LEAD, do: 'press', target: sel(n), track: n });
            if (n.kind === 'sub') extraRef.current.push({ at: t + POINT_LEAD + 250, do: 'scrollTop' });
        });
        return need.length * NAV_STEP_MS;
    }, []);

    const goTo = useCallback((i) => {
        if (i >= SCENES.length) { finish(); return; }
        const next = Math.max(0, i);
        // L'application jouée repart d'une copie neuve du démo seulement si on saute des scènes ; sinon elle continue.
        const fresh = next !== idxRef.current + 1;
        cleanupScene();
        const r = rootRef.current;
        const intro = hasIntro(next);
        clearTimeout(fadeTimerRef.current);
        if (fresh) {
            tabRef.current = 'info'; subRef.current = 'overview';
            if (r) { r.style.transition = 'none'; r.style.opacity = '0'; }
            onResetApp();
            // l'application neuve apparaît en fondu (temps réel : indépendant de la pause et de la vitesse)
            fadeTimerRef.current = setTimeout(() => { if (rootRef.current) { rootRef.current.style.transition = 'opacity 260ms ease-out'; rootRef.current.style.opacity = '1'; } }, SETTLE_MS + 120);
        }
        const base = (intro ? -INTRO_MS : 0) - (fresh ? SETTLE_MS : 0);
        const navTime = planNav(SCENES[next], intro, base);
        elapsedRef.current = base - navTime;
        // les gestes de navigation (déjà datés depuis `base - navTime`) : on les recale sur le nouveau départ
        extraRef.current.forEach((x) => { x.at = x.at - navTime; });
        extraRef.current.forEach((x) => { x.done = false; });
        firedRef.current = new Set();
        idxRef.current = next;
        introOnRef.current = intro; setIntroOn(intro);
        setIdx(next);
    }, [cleanupScene, finish, onResetApp, rootRef, planNav]);

    // --- boucle d'animation -----------------------------------------------------------------------------
    useEffect(() => {
        let raf; let last = performance.now();
        const frame = (now) => {
            const dt = Math.min(now - last, 100); last = now;
            const i = idxRef.current;
            const scene = SCENES[i];
            const r = rootRef.current;
            const introMs = hasIntro(i) ? INTRO_MS : 0;
            if (playingRef.current && !finishingRef.current) {
                elapsedRef.current += dt * speedRef.current;
                const el = elapsedRef.current;
                if (introOnRef.current && el >= 0) { introOnRef.current = false; setIntroOn(false); }
                // navigation ajoutée à l'exécution, puis gestes du scénario
                extraRef.current.forEach((x) => { if (!x.done && x.at <= el) { x.done = true; if (!run(x)) pendingRef.current.push({ s: x, since: el }); } });
                EXPANDED[i].forEach((s, k) => {
                    if (firedRef.current.has(k)) return;
                    const due = s.setup ? el >= (introMs ? -introMs + 700 : 0) : s.at <= el;
                    if (!due) return;
                    firedRef.current.add(k);
                    if (!run(s)) pendingRef.current.push({ s, since: el });
                });
                if (pendingRef.current.length) {
                    pendingRef.current = pendingRef.current.filter((p) => {
                        if (el - p.since <= RETRY_MS) return !run(p.s);
                        // un geste dont la cible n'existe pas : abandonné sans bruit, mais consigné (les tests le vérifient)
                        (window.__tourMisses = window.__tourMisses || []).push(`${scene.id} : ${p.s.do} ${JSON.stringify(p.s.target)}`);
                        return false;
                    });
                }
                // saisie lettre à lettre
                typingRef.current = typingRef.current.filter((j) => {
                    const target = clamp(Math.floor((el - j.start) / j.rate), 0, j.text.length);
                    if (target !== j.n) { j.n = target; setFieldValue(j.el, j.text.slice(0, target)); }
                    if (j.n >= j.text.length) {
                        if (j.doneAt === null) j.doneAt = el;
                        if (el - j.doneAt > TYPE_END_HOLD) { blurField(j.el); return false; }
                    }
                    return true;
                });
                if (el >= scene.duration) goTo(i + 1);
            }
            // progression
            const cur = Math.min(idxRef.current, SCENES.length - 1);
            const done = SCENE_STARTS[cur] + clamp(elapsedRef.current + (hasIntro(cur) ? INTRO_MS : 0), 0, sceneLength(cur));
            CHAPTER_RANGES.forEach((c, ci) => {
                const f = segFills.current[ci];
                if (f) f.style.width = `${clamp((done - c.start) / (c.end - c.start), 0, 1) * 100}%`;
            });
            const sec = Math.floor(done / 1000);
            if (sec !== lastClockRef.current) { lastClockRef.current = sec; setClock(done); }

            // caméra : si l'élément dont on parle n'est pas (assez) visible, la page défile en douceur jusqu'à lui
            const fe = focusRef.current;
            if (fe && playingRef.current && now - camAtRef.current > 300) {
                camAtRef.current = now;
                const y = window.scrollY; const moving = Math.abs(y - lastScrollYRef.current) > 1.5; lastScrollYRef.current = y;
                if (!moving && document.contains(fe) && fe.getClientRects().length && !isStuck(fe) && !inZone(fe)) scrollToEl(fe, 'center');
            }
            // halo et pointeur suivent leur cible à chaque image (la page défile en douceur)
            const vw = window.innerWidth; const vh = window.innerHeight;
            const h = haloEl.current; const ht = haloTargetRef.current;
            if (h) {
                if (ht && document.contains(ht) && ht.getClientRects().length) {
                    const rr = ht.getBoundingClientRect();
                    const top = Math.max(4, rr.top - 6); const bottom = Math.min(vh - BAR_H - 4, rr.bottom + 6);
                    const left = Math.max(4, rr.left - 6); const right = Math.min(vw - 4, rr.right + 6);
                    // un cadre dont le haut est sorti de l'écran (on parle maintenant d'une partie plus bas) s'efface plutôt que d'être coupé
                    const visible = bottom > top && right > left && rr.top > -20;
                    h.style.opacity = visible ? '1' : '0';
                    h.style.transform = `translate(${left}px, ${top}px)`;
                    h.style.width = `${Math.max(0, right - left)}px`; h.style.height = `${Math.max(0, bottom - top)}px`;
                } else h.style.opacity = '0';
            }
            const c = cursorEl.current; const ct = cursorTargetRef.current;
            if (c) {
                const ce = ct && ct.virtual ? ct.el : ct;
                if (ce && document.contains(ce) && ce.getClientRects().length) {
                    const rr = ce.getBoundingClientRect();
                    let x; let y;
                    if (ct.virtual) { x = rr.left + rr.width * ct.fx; y = rr.top + rr.height * ct.fy; }
                    else { x = clamp(rr.width < 220 ? rr.left + rr.width / 2 : rr.left + 48, 8, vw - 30); y = clamp(rr.top + Math.min(rr.height / 2, 26), 8, vh - BAR_H - 70); }
                    c.style.transform = `translate(${x}px, ${y}px)`; c.style.opacity = (rr.bottom < 0 || rr.top > vh) ? '0' : '1';
                } else if (!c.style.transform) { c.style.transform = `translate(${vw - 120}px, ${vh - 200}px)`; c.style.opacity = '0'; }
            }
            // étiquettes : position + valeur lue en direct
            const layer = layerRef.current;
            if (layer && r) {
                const placed = [];
                noteDataRef.current.forEach((n) => {
                    const bubble = layer.querySelector(`[data-note-id="${n.id}"]`);
                    const target = noteTargetsRef.current.get(n.id);
                    if (!bubble) return;
                    if (!target || !document.contains(target) || !target.getClientRects().length) { bubble.style.opacity = '0'; return; }
                    const probe = target.getBoundingClientRect();
                    if (!isStuck(target) && (probe.bottom < 60 || probe.top > vh - 120)) { bubble.style.opacity = '0'; return; } // cible sortie du cadre : l'étiquette s'efface
                    if (n.read) {
                        if (now - n.readAt > 250) { n.readAt = now; n.value = n.read(); } // relecture ~4 fois par seconde
                        const label = n.text.replace('{v}', n.value || '…');
                        const span = bubble.firstChild;
                        if (span && span.textContent !== label) span.textContent = label;
                    }
                    const w = bubble.offsetWidth; const hh = bubble.offsetHeight;
                    const tr = probe;
                    const maxY = vh - CAM_BOTTOM + 6; // une étiquette ne passe jamais sous les sous-titres
                    let side = n.side;
                    if (side === 'top' && tr.top - hh - 14 < 70) side = 'bottom';
                    if (side === 'bottom' && tr.bottom + hh + 14 > maxY) side = 'top';
                    let x; let y;
                    if (side === 'top') { x = tr.left + tr.width / 2 - w / 2; y = tr.top - hh - 14; }
                    else if (side === 'bottom') { x = tr.left + tr.width / 2 - w / 2; y = tr.bottom + 14; }
                    else if (side === 'right') { x = tr.right + 14; y = tr.top + tr.height / 2 - hh / 2; }
                    else { x = tr.left - w - 14; y = tr.top + tr.height / 2 - hh / 2; }
                    if (side === 'right' && x + w > vw - 8) { x = tr.left + tr.width / 2 - w / 2; y = tr.top - hh - 14; side = 'top'; }
                    x = clamp(x, 8, vw - w - 8); y = clamp(y, 8, maxY - hh);
                    // jamais deux étiquettes l'une sur l'autre : la suivante se décale au-delà de celle déjà posée
                    for (const p of placed) {
                        if (x < p.x + p.w + 6 && x + w + 6 > p.x && y < p.y + p.h + 6 && y + hh + 6 > p.y) {
                            y = side === 'top' && p.y - hh - 6 >= 70 ? p.y - hh - 6 : p.y + p.h + 6;
                            y = clamp(y, 8, maxY - hh);
                        }
                    }
                    placed.push({ x, y, w, h: hh });
                    bubble.style.transform = `translate(${x}px, ${y}px)`;
                    bubble.style.opacity = '1';
                    const arrow = bubble.querySelector('[data-arrow]');
                    if (arrow) {
                        const horizontal = side === 'top' || side === 'bottom';
                        arrow.style.left = horizontal ? `${clamp(tr.left + tr.width / 2 - x - 5, 12, w - 22)}px` : side === 'right' ? '-5px' : `${w - 5}px`;
                        arrow.style.top = horizontal ? (side === 'top' ? `${hh - 5}px` : '-5px') : `${clamp(tr.top + tr.height / 2 - y - 5, 8, hh - 18)}px`;
                    }
                });
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, [goTo, run, rootRef]);

    // --- contrôles -------------------------------------------------------------------------------------------
    const setPlay = useCallback((v) => { playingRef.current = v; setPlaying(v); }, []);
    const togglePlay = useCallback(() => setPlay(!playingRef.current), [setPlay]);
    const changeSpeed = (v) => { speedRef.current = v; setSpeed(v); };

    useEffect(() => {
        const onKey = (e) => {
            if (!e.isTrusted) return; // les touches simulées par la visite elle-même (fermer le guide…) ne la pilotent pas
            const inBar = barRef.current && barRef.current.contains(e.target);
            if (e.key === 'Escape') { e.preventDefault(); quit(); }
            else if (e.key === ' ' && !inBar) { e.preventDefault(); togglePlay(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idxRef.current + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idxRef.current - 1); }
            else if (!inBar) { e.preventDefault(); e.stopPropagation(); } // aucune frappe de l'utilisateur ne doit atteindre l'application jouée (ni faire défiler la page)
        };
        const onHidden = () => { if (document.hidden) setPlay(false); };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('keypress', onKey, true);
        document.addEventListener('visibilitychange', onHidden);
        return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('keypress', onKey, true); document.removeEventListener('visibilitychange', onHidden); };
    }, [goTo, quit, setPlay, togglePlay]);

    const scene = SCENES[idx];
    const chapter = CHAPTERS[scene.chapter];
    const introTitle = idx === 0 ? scene.introTitle : chapter.title;
    const introSub = idx === 0 ? scene.introSub : chapter.sub;

    return (
        <div ref={layerRef} data-testid="tour-layer" data-scene={scene.id}>
            <style>{STYLES}</style>
            {/* Bloque tout clic sur l'application jouée : seule la barre du bas répond. */}
            <div className="fixed inset-0 z-[100]" aria-hidden="true" />
            <div ref={haloEl} data-testid="tour-halo" className="fixed left-0 top-0 z-[105] pointer-events-none rounded-lg border-[3px] border-blue-500"
                style={{ opacity: 0, animation: 'tourPulse 1.8s ease-in-out infinite', transition: 'opacity 250ms' }} />

            {notes.map((n) => (
                <div key={n.id} data-note-id={n.id} data-testid="tour-note"
                    className="fixed left-0 top-0 z-[108] pointer-events-none max-w-[17rem] rounded-xl bg-blue-600 text-white text-[13px] font-semibold leading-snug px-3 py-2 shadow-xl"
                    style={{ opacity: 0 }}>
                    <span>{n.read ? n.text.replace('{v}', '…') : n.text}</span>
                    <i data-arrow className="absolute block h-2.5 w-2.5 rotate-45 bg-blue-600" />
                </div>
            ))}

            <div ref={cursorEl} data-testid="tour-cursor" className="group fixed left-0 top-0 z-[110] pointer-events-none data-[pressed='1']:scale-75" style={{ opacity: 0, transition: 'opacity 250ms' }}>
                <span className="absolute -left-3 -top-3 h-8 w-8 rounded-full bg-blue-500/50 opacity-0 group-data-[pressed='1']:opacity-100 group-data-[pressed='1']:animate-ping" />
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white" stroke="#1f2937" strokeWidth="1.5" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
                    <path d="M5 3l14 8-6 2 4 7-3 1.5-4-7-5 4z" />
                </svg>
            </div>

            {introOn && (
                <div key={`intro-${scene.id}`} data-testid="tour-intro" className="fixed inset-0 z-[126] flex items-center justify-center backdrop-blur-md"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.97) 0%, rgba(241,247,253,.97) 55%, rgba(231,246,236,.97) 100%)', animation: `tourIntro ${INTRO_MS}ms ease-in-out both` }}>
                    <div className="text-center px-6" style={{ animation: `tourIntroText ${INTRO_MS}ms ease-out both` }}>
                        {idx === 0
                            ? <img src="./Logo_RestoCalculateur3.png" alt="Logo TransfoCalculateur" className="h-44 sm:h-56 w-auto mx-auto mb-8" />
                            : <div className="text-[10rem] leading-none font-black -mb-16 select-none" style={{ color: 'rgba(27,163,59,.16)' }}>{scene.chapter}</div>}
                        <div className={`${idx === 0 ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl'} font-black tracking-tight`} style={{ color: NAVY }}>{introTitle}</div>
                        <div className="mx-auto my-5 h-1.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${GREEN}, ${BLUE})` }} />
                        {introSub && <div className="text-xl sm:text-2xl font-semibold" style={{ color: BLUE }}>{introSub}</div>}
                    </div>
                </div>
            )}

            <div className="fixed left-1/2 -translate-x-1/2 z-[120] w-[min(46rem,calc(100vw-2rem))] pointer-events-none" style={{ bottom: BAR_H + 16 }}>
                <div key={scene.id} role="status" aria-live="polite" data-testid="tour-caption"
                    className="bg-gray-900/90 text-white text-[16px] leading-snug rounded-2xl px-5 py-3.5 shadow-2xl text-center backdrop-blur">
                    <div className="text-[11px] uppercase tracking-widest text-blue-300 mb-1 font-semibold">{chapter.title}</div>
                    <Caption text={scene.caption} />
                </div>
            </div>

            {/* Petite barre du bas */}
            <div ref={barRef} data-testid="tour-controls" className="fixed bottom-0 inset-x-0 z-[130] bg-gray-900/95 text-gray-200 backdrop-blur" style={{ height: BAR_H }}>
                <div className="flex gap-0.5 h-1.5" role="group" aria-label="Chapitres">
                    {CHAPTER_RANGES.map((c, ci) => (
                        <button key={CHAPTERS[ci].id} onClick={() => { goTo(c.first); setPlay(true); }} title={CHAPTERS[ci].title} aria-label={`Chapitre : ${CHAPTERS[ci].title}`}
                            className="relative h-1.5 bg-gray-700 hover:h-2.5 hover:bg-gray-600 transition-all overflow-hidden" style={{ flexGrow: c.end - c.start, flexBasis: 0 }}>
                            <span ref={(el) => { segFills.current[ci] = el; }} className="absolute left-0 top-0 h-full bg-blue-500" style={{ width: 0 }} />
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 px-3 text-xs" style={{ height: BAR_H - 6 }}>
                    <button onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Scène précédente" title="Scène précédente (←)" className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"><SkipBack className="h-4 w-4" /></button>
                    <button onClick={togglePlay} data-testid="tour-toggle" aria-label={playing ? 'Pause' : 'Lecture'} title="Pause / lecture (espace)" className="p-1.5 rounded hover:bg-white/10">
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => goTo(idx + 1)} aria-label="Scène suivante" title="Scène suivante (→)" className="p-1.5 rounded hover:bg-white/10"><SkipForward className="h-4 w-4" /></button>
                    <span className="ml-2 tabular-nums text-gray-400" data-testid="tour-time">{fmt(clock)} / {fmt(TOTAL_DURATION)}</span>
                    <span className="ml-3 hidden md:inline text-gray-500">{chapter.title} · scène {idx + 1}/{SCENES.length}</span>
                    <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Vitesse">
                        {SPEEDS.map((v) => (
                            <button key={v} onClick={() => changeSpeed(v)} aria-pressed={speed === v}
                                className={`px-2 py-0.5 rounded ${speed === v ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>{String(v).replace('.', ',')}×</button>
                        ))}
                    </div>
                    <button onClick={quit} data-testid="tour-quit" className="ml-2 inline-flex items-center px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-100"><X className="h-3.5 w-3.5 mr-1" /> Quitter</button>
                </div>
            </div>

            {fading && <div className="fixed inset-0 z-[140] bg-gray-100 pointer-events-none" style={{ animation: 'tourFadeIn 600ms ease-in both' }} />}
        </div>
    );
};
