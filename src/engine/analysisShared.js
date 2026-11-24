// Outils communs des analyses (format actif, moyenne pondérée par canal). Extrait de analysisData.js le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { parseLocaleNumber } from '../utils.js';

// Phase 4.5bis/4.6 — contenants « Activité » partagés entre Revenus, Charges directes réelles et
// Frais fixes : Général + chaque activité de production, dans cet ordre (voir
// 04-Conception-Modele.md, section 1 : Général est une allocation directe à une seule étape, pas
// un 3e axe symétrique). Extrait ici (au lieu de rester dupliqué dans IncomeStatementTab.jsx) pour
// qu'App.jsx puisse construire les mêmes contenants lors de l'agrégation des pools (Phase 4.6).
// Un format « Actif » est le seul à compter dans les analyses (règle de l'étape 6 : « c'est seulement en
// fonction des produits actifs que les données doivent être calculées »). Un format inactif n'absorbe
// donc aucun frais fixe et n'apparaît dans aucun rapport agrégé, même s'il garde des volumes saisis.
// `!== false` : une ligne sans champ `onMenu` (anciennes données, tests) reste comptée.
export const isActiveRow = (row) => row?.onMenu !== false;

// Combine les valeurs d'un SKU à travers TOUS ses canaux, pondérées par le volume RÉEL de chaque
// canal (channelBreakdown[].volume) — remplace la vue « canal principal seulement » (`costs`) pour
// les indicateurs censés refléter toute l'activité d'un SKU, pas seulement son canal principal
// (retour utilisateur du 06/10 : changer le prix net sur un canal secondaire ne bougeait ni les
// KPIs pondérés, ni la matrice BCG, ni le classement par contribution). Repli sur `costs` (canal
// principal) si aucun canal n'a de volume renseigné pour ce SKU — impossible de pondérer sans
// données, comportement historique conservé à l'identique dans ce cas (et pour tout produit sans
// `channelPrices` du tout, ex. les anciens tests/projets).
export function blendAcrossChannels(costs, channelBreakdown) {
    const cbWithVolume = (channelBreakdown || []).filter(cb => parseLocaleNumber(cb.volume) > 0);
    const totalVolume = cbWithVolume.reduce((s, cb) => s + parseLocaleNumber(cb.volume), 0);
    if (totalVolume <= 0) {
        return {
            margeBruteDollar: costs.margeBruteDollar,
            margeBrutePercent: costs.margeBrutePercent,
            costMatierePercent: costs.costMatierePercent,
            costPackagingPercent: costs.costPackagingPercent,
            costLaborPercent: costs.costLaborPercent,
            totalVolume: 0,
        };
    }
    const weighted = (field) => cbWithVolume.reduce((s, cb) => s + (parseLocaleNumber(cb[field]) || 0) * parseLocaleNumber(cb.volume), 0) / totalVolume;
    // Pourcentages : pondérés par le REVENU de chaque canal (prix net × volume), pas par les unités.
    // Un pourcentage est « des dollars sur des dollars » : Σ(marge $) ÷ Σ(revenu $) = Σ(% × revenu) ÷ Σ(revenu).
    // Pondérer par les unités sous-estime le poids d'un canal à prix élevé (vente directe) et déforme la
    // marge de plusieurs points dès que les prix nets diffèrent d'un canal à l'autre (paradoxe de Simpson,
    // corrigé le 19/11 après l'audit de la méthode). Le $ par unité, lui, reste une moyenne par unités.
    const revenueOf = (cb) => parseLocaleNumber(cb.netPrice) * parseLocaleNumber(cb.volume);
    const totalRevenue = cbWithVolume.reduce((s, cb) => s + revenueOf(cb), 0);
    const weightedByRevenue = (field) => totalRevenue > 0
        ? cbWithVolume.reduce((s, cb) => s + (parseLocaleNumber(cb[field]) || 0) * revenueOf(cb), 0) / totalRevenue
        : weighted(field);
    return {
        margeBruteDollar: weighted('margeBruteDollar'),
        margeBrutePercent: weightedByRevenue('margeBrutePercent'),
        costMatierePercent: weightedByRevenue('costMatierePercent'),
        costPackagingPercent: weightedByRevenue('costPackagingPercent'),
        costLaborPercent: weightedByRevenue('costLaborPercent'),
        totalVolume,
    };
}
