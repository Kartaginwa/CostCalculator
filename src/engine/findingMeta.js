// Classement des constats selon deux axes (décision du 22/11, voir Projet_Claude/12-Plan-Export-PDF.md 3.4 et 14-Audit-Constats.md) :
//   - PORTÉE : générale (l'entreprise dans son ensemble) ou spécifique (un thème ou une entité : produit, canal, activité, fournisseur, poste…) ;
//   - GRAVITÉ : majeure, moyenne ou mineure, calculée à partir de ce que le moteur calcule déjà (niveau, poids, impact en $), seuils dans reportThresholds.js.
// La forme (par entité ou agrégée) se lit sur le constat : il porte un `subject` ou non. Les deux formes coexistent.
import { REPORT_THRESHOLDS as T } from './reportThresholds.js';

// [motif d'identifiant, portée, type de sujet]. Premier motif qui correspond ; un test vérifie que CHAQUE identifiant du moteur est classé.
export const SCOPE_RULES = [
    // Constats par entité propres à un format (alimentent les fiches produits)
    [/^(sku-class|sku-loss|sku-positive|sku-over-cost|sku-hour|sku-cost-trend|sku-margin-trend|format-gap-of)-/, 'specific', 'format'],
    // Généraux : l'entreprise dans son ensemble
    [/^(safety|net-theoretical|fixed-cover|fixed-share|sens-inputs|sens-labor|labor-unused|labor-used|targets-all-met)$/, 'general', 'entreprise'],
    [/^cost-(matiere|emballage|mo)$/, 'general', 'entreprise'],
    [/^rec-/, 'general', 'réel / théorique'],
    [/^history-(gross|net|material|packaging|labor|revenue|breakeven)(-12m)?$/, 'general', 'point de référence'],
    // Spécifiques
    [/^(sku-losers|sku-none-losing|sku-negative-everywhere|sku-positive|sku-best|sku-missed-channel|bcg-|profit-|cost-matiere-products|format-gap|subrecipe-weight|resale-share|history-sku-|history-erosion|product-best-hour|product-worst-hour|hours-vs-profit)/, 'specific', 'produit'],
    [/^(channel-|history-channel-)/, 'specific', 'canal'],
    [/^cell-deficit-/, 'specific', 'activité × canal'],
    [/^(activity-|activities-)/, 'specific', 'activité'],
    [/^post-/, 'specific', 'poste'],
    [/^(labor-growth|hour-cost-gap|labor-cost-share)$/, 'specific', 'équipe'],
    [/^(supplier-|volatile-|stable-|loss-|inputs-top5|sens-item|history-price-|history-provider-)/, 'specific', 'approvisionnement'],
    [/^(aging-share|fixed-concentration)$/, 'specific', 'frais fixes'],
];

/** Portée et type de sujet d'un identifiant de constat ; null si l'identifiant n'est pas classé (un test l'interdit). */
export const classifyFinding = (id) => {
    for (const [re, scope, subjectType] of SCOPE_RULES) if (re.test(id)) return { scope, subjectType };
    return null;
};

export const SEVERITY_ORDER = { major: 3, medium: 2, minor: 1 };

// Constats STRUCTURELS : ils décrivent une réalité d'ensemble de l'entreprise (une dépendance, un équilibre, la couverture des frais fixes, l'alignement sur le
// modèle) et sont de gravité majeure par nature, que ce soit une faiblesse ou son miroir (une force). Chaque faiblesse structurelle a ainsi sa force symétrique :
// dépendance à un canal / revenus bien répartis ; dépendance à un fournisseur / fournisseurs bien répartis ; produits déficitaires / aucun produit déficitaire ;
// profit concentré / profit bien réparti ; activité déficitaire / toutes bénéficiaires ; paie non utilisée / bien utilisée ; cibles dépassées / toutes atteintes.
export const STRUCTURAL = /^(channel-dependency|channel-balanced|supplier-(ing|pkg|spread)$|supplier-dep-|sku-losers|sku-negative-everywhere|sku-none-losing|profit-concentration|profit-spread|activities-positive|labor-used|rec-revenue|targets-all-met|fixed-cover)/;

/**
 * Gravité d'un constat (révision du 23/11) : majeure si niveau 1, impact ≥ 3 % des ventes, constat structurel (STRUCTURAL), ou — pour la portée GÉNÉRALE seulement —
 * poids ≥ 80 ; moyenne si poids ≥ 50 ou impact ≥ 1 % des ventes ; sinon mineure. Le poids sert à trier : il ne fait plus d'un constat spécifique un constat majeur
 * (avant, « rentable partout » était majeur parce que son poids valait 80, sans aucun enjeu en dollars ; et les forces, aux poids plus bas que les alertes, n'atteignaient
 * presque jamais le seuil).
 * @param {object} f        le constat (id, scope, weight, impact)
 * @param {number} revenue  ventes prévues (sert à rapporter l'impact en $)
 * @param {number} tier     niveau de gravité de la décision (1 = survie … 4 = information)
 */
export const severityOf = (f, revenue, tier) => {
    const share = f.impact != null && revenue > 0 ? Math.abs(f.impact) / revenue : null;
    if (tier === 1 || (share != null && share >= T.severityMajorImpact) || STRUCTURAL.test(f.id || '') || (f.scope === 'general' && f.weight >= T.severityMajorWeight)) return 'major';
    if (f.weight >= T.severityMediumWeight || (share != null && share >= T.severityMediumImpact)) return 'medium';
    return 'minor';
};
