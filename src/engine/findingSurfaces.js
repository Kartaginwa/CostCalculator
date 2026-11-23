// Filtres par SURFACE des constats (phase 2 de la refonte de l'export PDF, 22/11) : fonctions pures qui choisissent, parmi les constats déjà classés
// par computeKeyFindings (portée, sujet, gravité), ceux qu'une surface affiche : Forces / Faiblesses, un chapitre du rapport, la fiche d'un format.
// Aucun calcul de donnée ici : on trie et on filtre ce que les règles ont produit.
import { SEVERITY_ORDER } from './findingMeta.js';

const SUPPLY_SUBJECTS = new Set(['approvisionnement', 'fournisseur', 'ingrédient', 'emballage']);
const CHANNEL_ACTIVITY_SUBJECTS = new Set(['canal', 'activité', 'activité × canal']);
const PRODUCT_SUBJECTS = new Set(['format', 'produit']);

/** Chapitre du rapport (2 à 6) où un constat est détaillé. La main-d'œuvre prime sur le sujet (le bénéfice par heure d'un format va au chapitre 6). */
export const chapterOf = (f) => {
    if (f.theme === 'Main-d\'œuvre') return 6;
    if (f.theme === 'Approvisionnement' || SUPPLY_SUBJECTS.has(f.subjectType)) return 5;
    if (CHANNEL_ACTIVITY_SUBJECTS.has(f.subjectType) || f.theme === 'Canaux' || f.theme === 'Activités') return 4;
    if (PRODUCT_SUBJECTS.has(f.subjectType) || f.theme === 'Produits') return 3;
    return 2; // Rentabilité, Coûts, Réel vs théorique, Évolution, frais fixes : les résultats de l'entreprise
};

// Du plus grave au moins grave ; à gravité égale, l'ordre de pertinence du moteur (rank) puis l'identifiant, pour un résultat stable.
const bySeverity = (a, b) => (SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]) || (b.rank - a.rank) || a.id.localeCompare(b.id);

/**
 * Forces / Faiblesses (écran et chapitre 1) : tous les constats de gravité MAJEURE. Un constat général majeur y figure d'office ; un constat spécifique
 * majeur y est PROMU (`promoted`), qu'il soit par entité ou agrégé. Une seule règle de promotion, aucune règle dupliquée.
 * @returns {{ forces: object[], faiblesses: object[] }} chaque constat marqué `promoted`
 */
export function strengthsAndWeaknesses(findings) {
    const major = (findings || []).filter(f => f.severity === 'major').map(f => ({ ...f, promoted: f.scope === 'specific' }));
    return { forces: major.filter(f => f.tone === 'force'), faiblesses: major.filter(f => f.tone === 'faiblesse') };
}

/** Constats d'un chapitre (2 à 6), toutes gravités, du plus grave au moins grave. Les constats généraux y figurent pour le chapitre 2 (résultats). */
export function chapterFindings(findings, chapter) {
    return (findings || []).filter(f => chapterOf(f) === chapter).sort(bySeverity);
}

/**
 * Constats de la fiche d'un format : ceux dont le sujet est ce format, et celui de son produit (écart de marge entre formats). Triés par gravité.
 * @param {string|number} formatId   identifiant de la ligne du format (sujet des constats `sku-*`)
 * @param {string|number} [productId] identifiant du produit du format (sujet de `format-gap-of-*`)
 */
export function ficheFindings(findings, formatId, productId) {
    const fid = String(formatId), pid = productId == null ? null : String(productId);
    return (findings || []).filter(f => f.subject && ((f.subject.type === 'format' && f.subject.id === fid) || (pid != null && f.subject.type === 'produit' && f.subject.id === pid)))
        .sort(bySeverity);
}

// ---------- surfaces de l'application (23/11) : chaque constat a UNE adresse principale, pour répandre les constats sans les répéter ----------
//   - Objectifs stratégiques (sous les tuiles de la Vue d'ensemble) : le groupe « objectif » ;
//   - Amélioration / détérioration (sous l'évolution des marges) : le groupe « évolution », de portée générale ;
//   - Forces et faiblesses (sous la matrice activité × canal) : les constats majeurs, comme le chapitre 1 du rapport PDF, sur le groupe « structure » ;
//   - bandeau de fin de sous-onglet : les constats qui renvoient à ce sous-onglet, sauf ceux qui ont leur adresse dans la Vue d'ensemble (objectifs, évolution générale, généraux majeurs). Un constat SPÉCIFIQUE majeur reste dans son sous-onglet même quand il est promu dans
//     Forces et faiblesses : c'est le seul recouvrement, voulu (le sous-onglet doit montrer le plus grave de son sujet).
// Un format n'apparaît que dans la fiche de ce format (Par SKU, SKU choisi), jamais dans les autres bandeaux.

/** Un seul exemplaire d'un texte identique (un constat par entité peut redire mot pour mot un constat agrégé), le plus grave d'abord. */
export const dedupeFindings = (list) => { const seen = new Set(); return (list || []).filter(f => { const k = `${f.title}|${f.detail}`; if (seen.has(k)) return false; seen.add(k); return true; }); };

/** Objectifs stratégiques : écart aux cibles saisies, atteints (forces) ou à atteindre (faiblesses). */
export const objectiveFindings = (all) => dedupeFindings((all || []).filter(f => f.group === 'objectif' && f.subject?.type !== 'format')); // la version par format vit dans la fiche du format

/** Amélioration / détérioration : l'évolution de l'entreprise dans son ensemble (les tendances d'un canal, d'un produit ou d'un intrant vont dans leur sous-onglet). */
export const evolutionFindings = (all) => dedupeFindings((all || []).filter(f => f.group === 'evolution' && f.scope === 'general'));

/**
 * Constats du chapitre 2 du rapport PDF (Résultats) : ceux qui n'ont AUCUNE adresse dans l'application, c'est-à-dire les constats généraux de gravité moyenne ou mineure qui
 * renvoient à la Vue d'ensemble ou à Simulation (ni objectif, ni évolution générale, ni général majeur : ceux-là ont leur bloc ; Simulation n'a pas de bandeau).
 * Du plus grave au moins grave. Avec les trois blocs de la Vue d'ensemble, les bandeaux des sous-onglets et la fiche d'un format, c'est la quatrième et dernière adresse.
 */
export const resultsFindings = (all) => dedupeFindings((all || []).filter(f => f.subject?.type !== 'format' && f.scope === 'general' && f.severity !== 'major'
    && f.group !== 'objectif' && f.group !== 'evolution' && ['overview', 'simulation'].includes(f.link?.subTab)).sort(bySeverity));

/**
 * Forces et faiblesses de la Vue d'ensemble : exactement les règles du chapitre 1 du rapport PDF (strengthsAndWeaknesses), hors objectifs et évolution qui ont
 * leur propre bloc : les constats de gravité majeure, généraux d'office et spécifiques promus. Les plus importants d'abord.
 */
export function overviewStrengths(all) {
    const { forces, faiblesses } = strengthsAndWeaknesses((all || []).filter(f => f.group === 'structure' && f.subject?.type !== 'format'));
    return { forces: dedupeFindings(forces), faiblesses: dedupeFindings(faiblesses) };
}

/**
 * Constats du bandeau de fin d'un sous-onglet (hors Vue d'ensemble et Simulation), du plus grave au moins grave.
 * @param {string} subTab  identifiant du sous-onglet (portfolio, bySku, byActivity, byChannel, ingredients, packaging, labor)
 * @param {object} [sel]   Par SKU : { formatId, productId } du SKU choisi, pour y ajouter les constats de sa fiche
 * @returns {{ forces: object[], faiblesses: object[], all: object[] }}
 */
export function tabFindings(all, subTab, { formatId, productId } = {}) {
    if (subTab === 'overview' || subTab === 'simulation') return { forces: [], faiblesses: [], all: [] }; // pas de bandeau : la Vue d'ensemble a ses trois blocs, Simulation aucun
    // Adresse dans la Vue d'ensemble : les objectifs, l'évolution générale et les généraux majeurs. Un constat général de gravité moyenne ou mineure n'y a pas
    // sa place (Forces et faiblesses = comme le PDF) : il va dans le bandeau du sous-onglet qu'il cite, s'il en cite un (sinon il reste dans le chapitre 2 du PDF).
    const homeInOverview = (f) => f.group === 'objectif' || (f.scope === 'general' && (f.severity === 'major' || f.group === 'evolution'));
    let list = (all || []).filter(f => f.link?.subTab === subTab && f.subject?.type !== 'format' && !homeInOverview(f));
    if (subTab === 'bySku' && formatId != null) list = list.concat(ficheFindings(all, formatId, productId));
    const sorted = dedupeFindings(withoutRedundancy(list.sort(bySeverity)));
    return { forces: sorted.filter(f => f.tone === 'force'), faiblesses: sorted.filter(f => f.tone === 'faiblesse'), all: sorted };
}

// Dans un bandeau, une règle agrégée et sa version par entité peuvent dire presque la même chose : on garde la plus utile et on écarte l'autre.
//   - agrégé gardé (il nomme déjà les éléments) : « N ingrédients de classe A à prix volatil », « perte stock prévue », « marges différentes selon le format » ;
//   - par entité gardé (il en dit davantage) : l'état de chaque poste de production (le « poste le plus sollicité » agrégé n'en nomme qu'un).
const hasId = (list, re) => list.some(f => re.test(f.id));
export const withoutRedundancy = (list) => list.filter(f => {
    if (/^volatile-item-(ing|pkg)-/.test(f.id)) return !hasId(list, new RegExp(`^volatile-a-${f.id.split('-')[2]}$`));
    if (/^loss-item-/.test(f.id)) return !hasId(list, /^loss-high$/);
    if (/^format-gap-of-/.test(f.id)) return !hasId(list, /^format-gap$/);
    if (/^post-(underused|overloaded|used)$/.test(f.id)) return !hasId(list, /^post-state-/);
    return true;
});
