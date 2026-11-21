// Seuils des rapports (refonte de Rapport et suivi, 21/11) : UN SEUL fichier, pour qu'un seuil se change à un seul endroit et se valide avec
// l'utilisateur. Les valeurs sont des fractions (0,4 = 40 %), sauf mention contraire. Les textes d'infobulles qui citent un seuil (ex. « 40 % »)
// sont dans src/tooltips.js : les mettre à jour si un seuil change.
export const REPORT_THRESHOLDS = {
    // Un fournisseur à cette part des achats (ou plus) est signalé comme une dépendance (rapport d'achats et constat clé).
    providerDependency: 0.4,

    // --- Constats clés (lot 3) ---
    // Marge de sécurité : confortable à partir de ce seuil (force), mince sous ce seuil (faiblesse) ; négative : urgent.
    safetyMarginComfortable: 0.10,
    safetyMarginLow: 0.05,
    // Un canal qui porte au moins cette part des revenus est une dépendance.
    channelDependency: 0.5,
    // Le produit n° 1 pèse au moins cette part du profit total (contribution) : profit trop concentré.
    productProfitShare: 0.25,
    // Une activité (ou un canal) bénéficiaire dont la marge nette est sous ce seuil est à très faible marge.
    lowNetMargin: 0.03,
    // Perte stock prévue : élevée au-delà de cette part des achats, faible sous l'autre seuil.
    lossShareHigh: 0.03,
    lossShareLow: 0.01,
    // Paie non utilisée : élevée au-delà de cette part de la paie (faiblesse), faible sous l'autre seuil (force).
    unusedPayHigh: 0.15,
    unusedPayLow: 0.08,
    // Un poste de production utilisé à ce taux ou plus est bien occupé (force). Valeur en fraction.
    postWellUsed: 0.90,
    // Un produit dont le bénéfice brut par heure est sous cette part de la moyenne des produits fabriqués est un mauvais usage du temps.
    productHourLow: 0.5,
    // Marge de croissance : heures libres minimales (en heures) pour la signaler.
    growthMinHours: 10,
    // Réconciliation : écart (en fraction du théorique) considéré « aligné » (force), ou assez grand pour être signalé.
    reconciliationClose: 0.02,
    reconciliationGap: 0.03,
    reconciliationNetGap: 0.10,
    // Évolution depuis le plus ancien point de référence : variation minimale, en points de pourcentage (0,01 = 1 point).
    historyPoints: 0.01,
};
