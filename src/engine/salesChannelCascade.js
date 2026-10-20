import { parseLocaleNumber } from '../utils.js';

// Calcule la cascade de prix d'un circuit de vente : une chaîne de maillons ordonnés (ex.
// Producteur → Courtier → Distributeur → Détaillant), chacun appliquant une marge ou un markup sur
// le prix du maillon précédent. `prices[0]` est le prix AVANT le premier maillon (typiquement le
// coût de revient), `prices[links.length]` est le prix de vente suggéré au consommateur (PDSF) —
// voir Projet_Claude/04-Conception-Modele.md, section 3.
//
// « Cascade éditable à n'importe quel maillon » (décision produit) : le calcul peut s'ancrer à
// n'importe quel point de la chaîne, pas seulement au coût de revient — ex. un entrepreneur qui
// connaît un prix tablette visé (prix consommateur) et veut en déduire le prix net producteur.
// `anchorIndex`/`anchorValue` désignent ce point de départ ; le reste de la chaîne se recalcule
// vers l'avant (marge/markup appliqués) et vers l'arrière (opération inverse), à partir des % déjà
// définis sur chaque maillon — ces % ne changent jamais ici, seuls les prix se déduisent d'eux.
//
// Distinction markup vs marge (erreur classique à éviter, voir 04-Conception-Modele.md) :
// - markup : % du prix PRÉCÉDENT (du coût d'entrée de ce maillon).
// - marge : % du prix DE VENTE à ce maillon (donc du prix qui en résulte), pas du coût.
export function computeSalesChannelCascade({ links = [], anchorIndex = 0, anchorValue } = {}) {
    const n = links.length;
    const prices = new Array(n + 1).fill(null);
    const safeAnchorIndex = Math.min(Math.max(anchorIndex, 0), n);
    prices[safeAnchorIndex] = parseLocaleNumber(anchorValue);

    for (let i = safeAnchorIndex + 1; i <= n; i++) {
        const pct = parseLocaleNumber(links[i - 1].percent) / 100;
        if (links[i - 1].type === 'markup') {
            prices[i] = prices[i - 1] * (1 + pct);
        } else {
            // marge >= 100 % est indéfinie (division par zéro ou négative) — pas un cas réaliste.
            prices[i] = pct < 1 ? prices[i - 1] / (1 - pct) : null;
        }
    }
    for (let i = safeAnchorIndex - 1; i >= 0; i--) {
        const pct = parseLocaleNumber(links[i].percent) / 100;
        if (links[i].type === 'markup') {
            // markup <= -100 % est indéfini (division par zéro ou négative) — pas un cas réaliste.
            prices[i] = pct > -1 ? prices[i + 1] / (1 + pct) : null;
        } else {
            prices[i] = prices[i + 1] * (1 - pct);
        }
    }
    return prices;
}

// Prix de détail suggéré (PDS, retour utilisateur du 15/10) : une donnée du FORMAT (saisie
// manuellement, une seule valeur pour tous ses canaux — le prix tablette visé au consommateur ne
// varie typiquement pas par canal, contrairement au prix net producteur). Descend la cascade de
// maillons du canal (markup/marge, ci-dessus) à partir de ce PDS, ancrée au DERNIER maillon (le
// prix consommateur), pour en déduire le prix net producteur de ce canal. Un canal sans maillon
// (ex. vente directe) donne prix net = PDS. Repli null si le PDS n'est pas un nombre valide, pour
// ne jamais écraser un prix net existant par une valeur fausse.
//
// Extrait de ProductInfo.jsx (20/10, retour utilisateur) : réutilisé par le rapport Par SKU pour
// calculer le coût RÉEL des maillons (« Frais de mise en marché » = PDS moins CE prix recalculé),
// jamais PDS moins le prix net RÉELLEMENT saisi pour ce canal — qui peut diverger de la cascade
// (ex. un rabais ponctuel appliqué à la main sur le prix net) et compterait alors un coût de
// maillon inexistant.
export const computeNetPriceFromPds = (pds, channel) => {
    const parsedPds = parseLocaleNumber(pds);
    if (!(parsedPds > 0)) return null;
    const links = channel?.links || [];
    const prices = computeSalesChannelCascade({ links, anchorIndex: links.length, anchorValue: parsedPds });
    const net = prices[0];
    return net != null ? Math.round(net * 100) / 100 : null;
};
