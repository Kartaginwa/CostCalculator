// Tableau d'évolution et blocs « Ce que cela veut dire » du rapport PDF (phase 2 de la refonte de l'export, 22/11).
// Texte à gabarit fixe, produit par des règles à partir des chiffres de l'application : AUCUNE IA, aucune hypothèse de cause qui ne soit déjà dans un
// constat existant, et AUCUN calcul de donnée recopié : tout vient des moteurs de l'application (réconciliation, points de référence et leurs
// mesures d'évolution, matrice activité × canal, cascade de la paie, marge de croissance). Une donnée absente rend la phrase muette.
import { formatNumber } from '../utils.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';
import { pct, usd } from './findingKit.js';
import { EVOLUTION_METRICS, historyPoints, yearAgoPoint } from './keyFindings.js';
import { deficitCells } from './entityFindings.js';
import { computeGlobalSeries } from './trackingSeries.js';

const spct = (r) => `${r >= 0 ? '+' : '−'}${pct(Math.abs(r))}`;
const plural = (n, one, many) => (n >= 2 ? many : one);
const pointsOf = (d) => `${formatNumber(Math.abs(d), 1)} point${plural(Math.abs(d), '', 's')}`;

// ---------- tableau « aujourd'hui / il y a 3 relevés / il y a 12 mois » ----------
/**
 * Une ligne par mesure d'évolution de l'application (marge brute et nette, coûts matière, emballage et main-d'œuvre, revenus, point mort), avec
 * les MÊMES valeurs que les constats d'évolution (mêmes mesures, mêmes points de référence, même fenêtre de 12 mois). `threeBack` n'existe qu'avec
 * trois relevés récents ; `yearAgo` qu'avec un relevé à environ un an. `delta` : écart en points pour une mesure en % (kind 'points'),
 * variation relative pour une mesure en $ (kind 'rel').
 */
export function computeTrendRows(c) {
    const points = historyPoints(c);
    const year = points.length >= 2 ? yearAgoPoint(points) : null;
    const yearPoint = year && year !== points[points.length - 1] ? year : null;
    return EVOLUTION_METRICS.map(m => {
        const now = m.now(c);
        if (!Number.isFinite(now)) return null;
        const compare = (label, value) => (Number.isFinite(value) ? { label, value, delta: m.kind === 'rel' ? (value > 0 ? (now - value) / value : null) : now - value } : null);
        const recent = points.slice(-3).map(p => ({ label: p.name, value: m.snap(p) })).filter(x => Number.isFinite(x.value));
        return {
            id: m.id, label: m.label, kind: m.kind, higherIsBetter: m.higherIsBetter, now,
            threeBack: recent.length === 3 ? compare(recent[0].label, recent[0].value) : null,
            yearAgo: yearPoint ? compare(yearPoint.name, m.snap(yearPoint)) : null,
        };
    }).filter(Boolean);
}

// ---------- « Ce que cela veut dire » ----------
/** Réconciliation réel / théorique : trois phrases, seuil de ± 5 % (seuils existants des constats). Muet sans chiffres réels. */
export function readReconciliation(c) {
    if (!c.hasRealData) return [];
    const row = (label) => c.reconciliation?.rows?.find(r => r.label === label);
    const rev = row('Revenus'), dir = row('Charges directes'), net = row('Bénéfice net');
    const out = [];
    if (rev && rev.diffPercent != null) {
        out.push(Math.abs(rev.diffPercent) < T.reconciliationClose
            ? `Les revenus réels sont alignés sur le modèle (${spct(rev.diffPercent)}).`
            : `Les revenus réels sont ${rev.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(rev.diff))} (${spct(rev.diffPercent)}).`);
    }
    if (dir && dir.diffPercent != null) {
        out.push(Math.abs(dir.diffPercent) >= T.reconciliationGap
            ? `Les charges directes réelles sont ${dir.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(dir.diff))} (${spct(dir.diffPercent)})${dir.diff > 0 ? ' : pertes, rendements ou prix payés plus élevés que prévu, à vérifier' : ''}.`
            : `Les charges directes réelles sont alignées sur le modèle (${spct(dir.diffPercent)}).`);
    }
    if (net && rev && dir) {
        out.push(`Le bénéfice net réel (${usd(net.real)}) est ${net.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(net.diff))} ; l'écart vient surtout ${Math.abs(rev.diff) > Math.abs(dir.diff) ? 'des revenus' : 'des charges directes'}.`);
    }
    return out;
}

/** Évolution de la marge brute (courbe de la Vue d'ensemble) : sommet, creux, mouvement depuis le creux, écart avec il y a 12 mois. Muet sous trois relevés. */
export function readEvolution(c) {
    const points = [...(c.trackingPoints || [])].filter(p => p && p.timestamp).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
    const series = computeGlobalSeries(points).map((s, i) => ({ label: s.label, v: s['Marge Brute Moyenne'], point: points[i] })).filter(x => Number.isFinite(x.v));
    if (series.length < 3) return [];
    const values = series.map(x => x.v), last = series[series.length - 1];
    const hi = values.indexOf(Math.max(...values)), lo = values.indexOf(Math.min(...values));
    if (hi === lo) return [];
    const out = [`La marge brute a culminé à ${formatNumber(values[hi], 1)} % (${series[hi].label}) et touché son creux à ${formatNumber(values[lo], 1)} % (${series[lo].label}).`];
    if (lo < series.length - 1) out.push(`Depuis son creux, elle ${last.v >= values[lo] ? 'remonte' : 'recule'} de ${pointsOf(last.v - values[lo])}.`);
    const yp = yearAgoPoint(points), then = yp ? series.find(x => x.point === yp) : null;
    if (then && then !== last) out.push(`Elle est ${pointsOf(last.v - then.v)} ${last.v >= then.v ? 'au-dessus de' : 'sous'} son niveau d'il y a 12 mois.`);
    return out;
}

/** Matrice activité × canal : les cases en perte (celles de l'application). Muet sans activité ni canal. */
export function readCells(c) {
    if (!(c.productionActivities || []).length || !Object.keys(c.channelNames || {}).length) return [];
    const cells = deficitCells(c);
    if (!cells.length) return ['Aucune combinaison activité × canal ne perd d\'argent.'];
    const loss = -cells.reduce((s, x) => s + x.cell.margeNetteTotal, 0);
    return [`${cells.length} combinaison${plural(cells.length, '', 's')} activité × canal ${plural(cells.length, 'perd', 'perdent')} de l'argent, pour ${usd(loss)} en tout : ${cells.map(x => `${x.act.name} en ${x.ch.name} (${usd(x.cell.margeNetteTotal)})`).join(', ')}.`];
}

/** Main-d'œuvre : part de la paie non utilisée, coût d'une heure réellement productive, marge de croissance (calculs de l'écran Main-d'œuvre). */
export function readLabor(c) {
    const out = [], cas = c.cascade;
    if (cas && cas.payroll > 0 && cas.unusedShare != null) out.push(`${pct(cas.unusedShare, 0)} de la paie (${usd(cas.unusedPay)} sur ${usd(cas.payroll)}) rémunère du temps qui n'est pas utilisé à produire.`);
    if (cas && cas.effectiveHourlyCost != null && cas.averageLoadedRate != null) out.push(`Une heure réellement productive coûte ${usd(cas.effectiveHourlyCost, 2)}, contre un taux moyen payé de ${usd(cas.averageLoadedRate, 2)} l'heure.`);
    const g = c.growth;
    if (g) out.push(`Les ${formatNumber(g.freeHours, 0)} heures libres des postes de production pourraient rapporter environ ${usd(Math.round(g.additionalGrossProfit / 100) * 100)} de bénéfice brut de plus (estimation, à ${usd(g.grossProfitPerHour, 2)} de bénéfice brut par heure).`);
    return out;
}

/** Les quatre blocs d'un coup. */
export const computeReadings = (c) => ({ reconciliation: readReconciliation(c), evolution: readEvolution(c), cells: readCells(c), labor: readLabor(c) });
