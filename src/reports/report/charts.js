// Graphiques du rapport PDF, en SVG et HTML (phase 4 de la refonte de l'export, 22/11) : barres horizontales, courbes, cascade. Reprise de la maquette validée,
// avec les gardes d'un vrai rapport : série vide ou valeur absente = on ne trace rien (jamais un point à zéro, jamais « NaN »).
import { esc, f, usd, rnd } from './format.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const LONG_CHART = 12;

/**
 * Barres horizontales. rows : [{ n, v, color?, mark? }] ; `mark` : repère noir (une valeur) sur la piste.
 * Chaque ligne est collée à la suivante (data-keep) sauf la dernière : le graphique ne se coupe pas.
 */
export function hbars(rows, { max, color = 'var(--primary)', fmt = usd, nameW = 50, valueW = 20 } = {}) {
    const list = (rows || []).filter(r => finite(r.v));
    if (!list.length) return '';
    const m = max || Math.max(...list.map(r => r.v), ...list.map(r => r.mark).filter(finite), 1e-9);
    // Un graphique court ne se coupe pas (les lignes sont collées). Au-delà de 12 lignes (un grand projet), il se coupe entre deux lignes, d'une page à l'autre.
    const long = list.length > LONG_CHART;
    const bars = list.map((r, i) => `<div class="hb"${!long && i < list.length - 1 ? ' data-keep="next"' : ''} style="grid-template-columns:${nameW}mm 1fr ${valueW}mm"><div class="nm">${esc(r.n)}</div>`
        + `<div class="tr"><div class="fi" style="width:${rnd(Math.min(100, Math.max(0, r.v) / m * 100), 2)}%;background:${r.color || color}"></div>`
        + `${finite(r.mark) ? `<div style="position:absolute;top:-.8mm;bottom:-.8mm;left:${rnd(Math.min(100, r.mark / m * 100), 2)}%;border-left:.4mm solid var(--dark)"></div>` : ''}</div>`
        + `<div class="vl">${fmt(r.v)}</div></div>`).join('');
    return long ? `<div data-split="items" data-split-min="3">${bars}</div>` : bars;
}

/** Échelle « ronde » d'un axe : { min, max, step } couvrant les valeurs, avec environ `ticks` graduations. */
export function niceScale(values, { ticks = 4, includeZero = false } = {}) {
    const v = values.filter(finite);
    if (!v.length) return { min: 0, max: 1, step: 1 };
    let lo = Math.min(...v), hi = Math.max(...v);
    if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi === lo) { hi = lo + 1; }
    const raw = (hi - lo) / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= raw) || raw;
    return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

/**
 * Courbes (une ou plusieurs séries sur le même axe). series : [{ name, color, vals, endLabel?, dash?, ly? }] ; vals peut contenir null (trou).
 * marks : [{ i, s, t, below? }] repères de texte sur un point.
 */
export function lineChart({ w = 640, h = 190, labels, series, ymin, ymax, ystep, yfmt = v => v, xEvery = 3, marks = [], padR = 92 }) {
    const live = (series || []).filter(s => s.vals.some(finite));
    if (!live.length || !labels?.length) return '';
    const P = { l: 34, r: padR, t: 12, b: 24 }, W = w - P.l - P.r, H = h - P.t - P.b;
    const X = i => P.l + (labels.length === 1 ? 0 : i / (labels.length - 1) * W);
    const Y = v => P.t + H - (v - ymin) / (ymax - ymin) * H;
    let g = '';
    for (let v = ymin; v <= ymax + 1e-9; v += ystep) g += `<line x1="${P.l}" x2="${P.l + W}" y1="${rnd(Y(v), 2)}" y2="${rnd(Y(v), 2)}" stroke="#E5E7EB" stroke-width="1"/><text x="${P.l - 5}" y="${rnd((Y(v) + 3), 2)}" font-size="9" fill="#6B7280" text-anchor="end">${esc(yfmt(v))}</text>`;
    labels.forEach((l, i) => { if (i % xEvery === 0 || i === labels.length - 1) g += `<text x="${rnd(X(i), 2)}" y="${h - 8}" font-size="8.5" fill="#6B7280" text-anchor="middle">${esc(l)}</text>`; });
    // Étiquettes de fin de courbe : écartées les unes des autres (11 px par ligne) pour ne jamais se chevaucher.
    const ends = live.map(s => { const pts = s.vals.map((v, i) => (finite(v) ? [X(i), Y(v)] : null)).filter(Boolean); const last = pts[pts.length - 1]; return { s, y: last[1] + (s.ly || 0), h: s.endLabel ? 22 : 12 }; }).sort((a, b) => a.y - b.y);
    ends.forEach((e, i) => { if (i > 0 && e.y < ends[i - 1].y + ends[i - 1].h) e.y = ends[i - 1].y + ends[i - 1].h; });
    const labelY = new Map(ends.map(e => [e.s, e.y]));
    live.forEach(s => {
        const pts = s.vals.map((v, i) => (finite(v) ? [X(i), Y(v)] : null)).filter(Boolean);
        g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 3"' : ''} points="${pts.map(p => p.map(x => rnd(x, 2)).join(',')).join(' ')}"/>`;
        const last = pts[pts.length - 1];
        g += `<circle cx="${rnd(last[0], 2)}" cy="${rnd(last[1], 2)}" r="3.2" fill="${s.color}" stroke="#fff" stroke-width="1.5"/>`;
        const ly = labelY.get(s);
        g += `<text x="${rnd((last[0] + 7), 2)}" y="${rnd((ly - 2), 2)}" font-size="9" font-weight="700" fill="#1F2937">${esc(s.name)}</text>`;
        if (s.endLabel) g += `<text x="${rnd((last[0] + 7), 2)}" y="${rnd((ly + 9), 2)}" font-size="9" fill="#4B5563">${esc(s.endLabel)}</text>`;
    });
    marks.forEach(m => {
        const s = series[m.s], v = s?.vals[m.i];
        if (!finite(v)) return;
        const x = X(m.i), y = Y(v);
        g += `<circle cx="${rnd(x, 2)}" cy="${rnd(y, 2)}" r="3" fill="#fff" stroke="${s.color}" stroke-width="2"/><text x="${rnd(x, 2)}" y="${rnd((y + (m.below ? 13 : -7)), 2)}" font-size="8.5" font-weight="700" fill="#1F2937" text-anchor="middle">${esc(m.t)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block">${g}</svg>`;
}

/** Cascade du revenu au bénéfice. steps : [{ label, value, total?, color }] ; le premier est le total de départ. */
export function waterfall(steps, { w = 650, h = 215 } = {}) {
    const list = (steps || []).filter(s => finite(s.value));
    if (list.length < 2 || !(list[0].value > 0)) return '';
    const P = { l: 6, r: 6, t: 20, b: 34 }, W = w - P.l - P.r, H = h - P.t - P.b, max = list[0].value, slot = W / list.length, bw = slot * 0.64;
    const Y = v => P.t + H - v / max * H;
    let run = 0, g = `<line x1="${P.l}" x2="${w - P.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9CA3AF"/>`;
    list.forEach((s, i) => {
        const x = P.l + slot * i + (slot - bw) / 2;
        let top, bot;
        if (s.total) { top = s.value; bot = Math.min(0, s.value); run = s.value; } else { top = run; bot = run - s.value; run = bot; }
        const yTop = Y(Math.max(top, bot)), yBot = Y(Math.min(top, bot));
        g += `<rect x="${rnd(x, 2)}" y="${rnd(yTop, 2)}" width="${rnd(bw, 2)}" height="${rnd(Math.max(1.5, yBot - yTop), 2)}" rx="2" fill="${s.color}"/>`;
        g += `<text x="${rnd((x + bw / 2), 2)}" y="${rnd((yTop - 4), 2)}" font-size="9" font-weight="700" fill="#1F2937" text-anchor="middle">${s.total ? '' : '−'}${esc(f(s.value))}</text>`;
        const words = String(s.label).split(' ');
        g += `<text x="${rnd((x + bw / 2), 2)}" y="${h - 20}" font-size="8.5" fill="#374151" text-anchor="middle">${esc(words[0])}</text>`;
        if (words[1]) g += `<text x="${rnd((x + bw / 2), 2)}" y="${h - 9}" font-size="8.5" fill="#374151" text-anchor="middle">${esc(words.slice(1).join(' '))}</text>`;
        if (i < list.length - 1) g += `<line x1="${rnd((x + bw), 2)}" x2="${rnd((x + slot), 2)}" y1="${rnd(Y(run), 2)}" y2="${rnd(Y(run), 2)}" stroke="#9CA3AF" stroke-dasharray="2 2"/>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block">${g}</svg>`;
}
