// Outils communs des règles de constats (keyFindings.js et entityFindings.js) : mise en forme des textes, fabrique de constats, et deux calculs
// partagés (marge nette d'un format, écart de marge entre formats d'un même produit). Extraits de keyFindings.js le 22/11 (phase 2 de la refonte
// de l'export PDF) pour que les règles par entité réutilisent les MÊMES calculs que les règles agrégées, sans les recopier.
import { parseLocaleNumber as P, formatNumber } from '../utils.js';
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';

export const SUBTAB_LABELS = {
    overview: 'Vue d\'ensemble', portfolio: 'Portefeuille', bySku: 'Par SKU', byActivity: 'Par Activité', byChannel: 'Par Canal',
    ingredients: 'Ingrédients', packaging: 'Emballages', labor: 'Main-d\'œuvre', simulation: 'Simulation',
};

export const pct = (ratio, d = 1) => `${formatNumber(ratio * 100, d)} %`;
// Montant en $ avec le séparateur de milliers de l'application (ex. 11 071 $).
export const usd = (v, d = 0) => `${v.toLocaleString('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d })} $`;
export const names = (list, max = 3) => (list.length > max ? [...list.slice(0, max), `${list.length - max} autre${list.length - max > 1 ? 's' : ''}`] : list).join(', ');

// `impact` : montant en $ en jeu, quand la règle sait le calculer (sert à classer et à fixer la gravité).
// `subject` : { type, id, name } pour un constat PAR ENTITÉ (un produit, un poste, un fournisseur…) ; absent (null) pour un constat agrégé.
export const finding = (id, tone, theme, weight, title, detail, subTab, impact = null, subject = null) => ({ id, tone, theme, weight, title, detail, link: { subTab, label: SUBTAB_LABELS[subTab] }, impact, subject });
export const force = (...a) => finding(a[0], 'force', ...a.slice(1));
export const weak = (...a) => finding(a[0], 'faiblesse', ...a.slice(1));
export const subject = (type, id, name) => ({ type, id: String(id), name });

// ---------- calculs partagés ----------
export const activeRows = (rows) => (rows || []).filter(p => p && p.onMenu !== false);
// Marge nette moyenne pondérée par les revenus de chaque canal ; null sans donnée.
export const netMarginOfRows = (rows) => {
    let acc = 0, total = 0;
    for (const p of activeRows(rows)) for (const cb of p.channelBreakdown || []) {
        const r = P(cb.netPrice) * P(cb.volume);
        if (r > 0 && Number.isFinite(cb.margeNettePercent)) { acc += cb.margeNettePercent * r; total += r; }
    }
    return total > 0 ? acc / total : null;
};

// Écart de marge nette entre les formats d'un même produit (règle 27) : les produits à deux formats ou plus dont l'écart atteint le seuil, du plus
// marqué au moins marqué. Chaque entrée : { l: [{ name, margin, id, productId }], gap }.
export const computeFormatSpread = (activeProducts) => {
    const byProduct = new Map();
    for (const p of activeProducts || []) {
        const margin = netMarginOfRows([p]);
        if (margin == null || p.productId == null) continue;
        (byProduct.get(p.productId) || byProduct.set(p.productId, []).get(p.productId)).push({ name: p.displayName, margin, id: p.id, productId: p.productId });
    }
    return [...byProduct.values()].filter(l => l.length >= 2)
        .map(l => ({ l, gap: Math.max(...l.map(x => x.margin)) - Math.min(...l.map(x => x.margin)) }))
        .filter(x => x.gap >= T.formatMarginGap).sort((x, y) => y.gap - x.gap);
};
