// Glossaire du rapport (phase 4 de la refonte de l'export, 22/11) : les définitions sont celles du glossaire du guide, mot pour mot ; le rapport n'imprime que
// les termes qui figurent dans son propre texte (sélection automatique, au singulier ou au pluriel). Un chapitre exclu fait donc disparaître ses termes.
import { GLOSSAIRE_TERMES } from '../../components/guide/content/partie4.js';

const normalize = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;|&nbsp;|&lt;|&gt;|&quot;|\u00a0|\u202f/g, ' ').replace(/[’‘]/g, "'").toLowerCase();
// « Marge brute (bénéfice brut) » se cherche sous « marge brute » ; le sigle ABC se cherche tel quel.
const baseOf = (term) => term.replace(/\s*\(.*\)\s*/, '').trim();
const ALIAS = { 'Analyse ABC': ['abc'] };
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Le guide écrit ses renvois [[ancre|texte]] : à l'impression, il ne reste que le texte.
const plainText = (s) => String(s).replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');

/** Un terme est « employé » s'il apparaît (mot entier, pluriel admis) dans le texte du rapport. */
export function termIsUsed(term, normalizedText) {
    return (ALIAS[term] || [baseOf(term)]).some(b => {
        const words = normalize(b).split(/\s+/).filter(Boolean);
        if (!words.length) return false;
        const re = new RegExp('(^|[^a-zà-ÿ0-9])' + words.map(w => escapeRegExp(w) + 's?').join('\\s+') + '(?![a-zà-ÿ0-9])');
        return re.test(normalizedText);
    });
}

/** Termes du glossaire du guide employés dans `reportHtml` (le texte du rapport, sans le glossaire lui-même). */
export function selectGlossary(reportHtml, terms = GLOSSAIRE_TERMES) {
    const text = normalize(reportHtml);
    return terms.filter(t => termIsUsed(t.term, text)).map(t => ({ term: t.term, def: plainText(t.def) }));
}

export const glossaryTotal = (terms = GLOSSAIRE_TERMES) => terms.length;
