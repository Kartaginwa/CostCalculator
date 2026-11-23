// Période du rapport (phase 4 de la refonte de l'export, 22/11) : lue des dates de début et de fin saisies dans l'État des résultats (ou lues à l'import).
// Imprimée en toutes lettres SEULEMENT si les deux dates existent et sont valides : sans dates, rien n'est imprimé (jamais une période inventée).
import { longDate } from './format.js';

const parse = (s) => {
    if (!s || typeof s !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
};

/** « du 1er octobre 2026 au 31 octobre 2026 », ou null si l'une des dates manque ou est invalide, ou si la fin précède le début. */
export function formatPeriod(startDate, endDate) {
    const a = parse(startDate), b = parse(endDate);
    if (!a || !b || b < a) return null;
    return `du ${longDate(a)} au ${longDate(b)}`;
}
