// Seuils des rapports (refonte de Rapport et suivi) : UN SEUL fichier, pour qu'un seuil se change à un seul endroit.
// Les valeurs s'écrivent en pourcentage avec pct(…), plus lisible : pct(30) = 30 %.
// Ce ne sont pas des normes : il n'existe pas de seuil universel. Ce sont des ordres de grandeur de gestion couramment admis, ajustés à une
// petite entreprise de transformation alimentaire (justification et fourchettes dans Projet_Claude/10-Constats-Cles.md). À valider avec un
// conseiller ou un comptable, puis à ajuster selon votre réalité.
// Si un seuil change, mettre à jour les textes qui le citent (infobulle `rapport.partAchats`, guide).
const pct = (n) => n / 100;

export const REPORT_THRESHOLDS = {
    // ── Approvisionnement ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Un fournisseur qui pèse au moins cette part des achats est une dépendance (rapport d'achats et constat clé).
    // Repère : on évite qu'un seul fournisseur dépasse environ le quart au tiers des achats (25 à 40 % selon les sources).
    providerDependency: pct(30),
    // Perte stock prévue : élevée à partir de cette part des achats (faiblesse), faible sous l'autre seuil (force).
    // Repère : une perte de 1 à 3 % des matières achetées est courante en transformation alimentaire ; au-delà, elle mérite attention.
    lossShareHigh: pct(3),
    lossShareLow: pct(1),

    // ── Rentabilité ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Marge de sécurité (de combien les ventes peuvent baisser avant la perte) : confortable à partir du premier seuil (force),
    // mince sous le second (faiblesse) ; entre les deux, aucun constat. Négative : urgent.
    // Repère : 20 % ou plus est généralement jugé confortable ; sous 10 %, un recul modeste des ventes fait perdre de l'argent.
    safetyMarginComfortable: pct(20),
    safetyMarginLow: pct(10),
    // Une activité (ou un canal) bénéficiaire dont la marge nette est sous ce seuil est à très faible marge.
    // Repère : une marge nette de 3 à 8 % est typique en transformation alimentaire ; sous 3 %, la marge est très mince.
    lowNetMargin: pct(3),
    // Variation minimale, en points de pourcentage, de la marge brute ou du coût matière depuis le premier point de référence.
    // Repère : un point de marge est déjà significatif dans un secteur à marges serrées.
    historyPoints: pct(1),

    // ── Canaux et produits ────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Un canal qui porte au moins cette part des revenus est une dépendance commerciale.
    // Repère : un client ou un canal qui dépasse 25 à 40 % des ventes est un risque de concentration reconnu.
    channelDependency: pct(40),
    // Le produit n° 1 pèse au moins cette part du profit total (contribution) : profit trop concentré.
    productProfitShare: pct(30),
    // Un produit dont le bénéfice brut par heure est sous cette part de la moyenne fait un mauvais usage du temps de l'équipe.
    productHourLow: pct(50),

    // ── Main-d'œuvre ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Paie non utilisée : élevée à partir du premier seuil (faiblesse), faible sous le second (force).
    // Repère : un taux d'utilisation de 85 à 90 % est un objectif courant de productivité, soit 10 à 15 % de paie non utilisée.
    unusedPayHigh: pct(15),
    unusedPayLow: pct(10),
    // Un poste de production utilisé à ce taux ou plus est bien occupé (force). Repère : 85 % et plus.
    postWellUsed: pct(85),
    // Marge de croissance : heures libres minimales, en part des heures productives attendues, pour la signaler (évite un seuil en heures,
    // qui dépendrait de la longueur de la période).
    growthMinShare: pct(5),

    // ── Réel vs théorique ─────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Écart (en part du théorique) considéré « aligné » pour les revenus (force), et écart signalé pour les charges directes.
    // Repère : en analyse des écarts, on s'intéresse en général aux écarts de plus de 5 %.
    reconciliationClose: pct(5),
    reconciliationGap: pct(5),
    // Écart du bénéfice net, plus volatil (petite différence entre de grands montants) : seuil plus large. Repère : 10 %.
    reconciliationNetGap: pct(10),
};
