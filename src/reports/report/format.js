// Mise en forme des nombres et du texte du rapport PDF (phase 4 de la refonte de l'export, 22/11) : espace insécable pour les milliers, virgule décimale,
// vrai signe moins (−). Une valeur absente s'imprime « — » : jamais un zéro, jamais « NaN » ou « undefined ».
export const NBSP = ' ';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Arrondi numérique (coordonnées d'un graphique, opacité d'une couleur) : un nombre, jamais un texte d'affichage. */
export const rnd = (v, d = 2) => Number(v.toFixed(d));

/** Nombre avec d décimales ; « — » si la valeur est absente. */
export const f = (n, d = 0) => {
    if (!isNum(n)) return '—';
    const [int, dec] = Math.abs(n).toFixed(d).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    const negative = n < 0 && Number(Math.abs(n).toFixed(d)) !== 0;
    return (negative ? '−' : '') + grouped + (dec ? ',' + dec : '');
};
export const usd = (n, d = 0) => (isNum(n) ? f(n, d) + NBSP + '$' : '—');
export const sgn = (n, d = 0) => (isNum(n) ? (n > 0 ? '+' : '') + f(n, d) : '—');
/** Ratio (0,35) en pourcentage (35 %). */
export const pc = (r, d = 1) => (isNum(r) ? f(r * 100, d) + NBSP + '%' : '—');
/** Pourcentage déjà en % (35) avec son signe. */
export const pn = (v, d = 1) => (isNum(v) ? f(v, d) + NBSP + '%' : '—');
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « août 26 » : étiquette courte d'un point de référence (à partir de sa date, jamais de son nom libre). */
export const shortMonth = (timestamp) => { const d = new Date(timestamp); return Number.isNaN(d.getTime()) ? '' : `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
/** « 21 novembre 2026 ». */
export const longDate = (date) => { const d = date instanceof Date ? date : new Date(date); return Number.isNaN(d.getTime()) ? '' : `${d.getDate() === 1 ? '1er' : d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };

// Couleur d'une cellule de marge : celle de l'application (vert pour une marge positive, rouge pour une perte, plus foncé quand elle est plus forte).
export const marginCell = (m) => {
    if (!isNum(m) || m === 0) return 'background:#fff;color:#000';
    const a = Math.min(Math.abs(m) / 0.8, 1) * 0.85 + 0.15, text = a > 0.6 ? '#fff' : '#000';
    return m > 0 ? `background:rgba(22,163,74,${rnd(a, 3)});color:${text}` : `background:rgba(220,38,38,${rnd(a, 3)});color:${text}`;
};
export const heat = (r) => (r < 0 ? ['var(--red-bg)', 'var(--red-t)'] : r < 0.10 ? ['var(--amber-bg)', 'var(--amber-t)'] : ['var(--green-bg)', 'var(--green-t)']);
