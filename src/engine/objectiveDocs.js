// Descriptions des indicateurs des objectifs sur mesure ajoutés le 24/11 (ceux de la famille « Entreprise » déjà documentés à la main gardent leurs textes
// dans tooltips.js et dans le guide). Une seule source : l'infobulle de la fenêtre « Gérer les objectifs » ET la table du guide la lisent. 150 caractères au plus.
export const INDICATOR_DOCS = {
    // Entreprise
    beneficeNet: 'Bénéfice net prévu en $, comme la ligne Bénéfice net du rapport réel vs théorique, une fois tous les frais pris en compte.',
    fixedCover: 'Combien de fois la marge de contribution couvre les frais fixes (main-d\'œuvre comprise). Sous 1, elle ne les couvre pas.',
    ecartRevenus: 'Écart, en %, entre vos revenus réels et vos revenus prévus. Demande des revenus réels saisis dans Frais fixes et revenus.',
    produitsDeficitaires: 'Nombre de produits qui perdent de l\'argent dans au moins un canal. Un objectif « au plus 0 » exige qu\'aucun ne perde.',
    partPremierProduit: 'Part du premier produit dans le profit total (classement par contribution). Demande au moins deux produits rentables.',
    margeCanalMin: 'Marge nette du canal le moins rentable. Demande au moins deux canaux avec des ventes.',
    posteMoinsUtilise: 'Taux d\'utilisation du poste de production le moins utilisé (tableau Taux d\'utilisation de Main-d\'œuvre). Au moins deux postes.',
    // Un ingrédient
    ingPart: 'Part de l\'ingrédient choisi dans les achats d\'ingrédients prévus (rapport d\'achats), sans la perte.',
    ingDepense: 'Achats prévus de l\'ingrédient choisi en $ (quantité requise × prix), sans la perte, comme dans le rapport d\'achats.',
    ingPerte: 'Perte en stock prévue de l\'ingrédient choisi en $ (rapport d\'achats), selon le pourcentage de perte de sa fiche.',
    ingVolatilite: 'Amplitude du prix de l\'ingrédient choisi sur vos relevés de suivi. Demande au moins deux relevés.',
    // Un emballage
    pkgPart: 'Part de l\'emballage choisi dans les achats d\'emballages prévus (rapport d\'achats), sans la perte.',
    pkgDepense: 'Achats prévus de l\'emballage choisi en $ (quantité requise × prix), sans la perte.',
    pkgPerte: 'Perte en stock prévue de l\'emballage choisi en $, selon le pourcentage de perte de sa fiche.',
    pkgVolatilite: 'Amplitude du prix de l\'emballage choisi sur vos relevés de suivi. Demande au moins deux relevés.',
    // Un fournisseur
    fournIngPart: 'Part du fournisseur choisi dans les achats d\'ingrédients (perte comprise), comme la lecture de dépendance du rapport d\'achats.',
    fournEmbPart: 'Part du fournisseur choisi dans les achats d\'emballages (perte comprise).',
    // Un poste
    posteUtilisation: 'Taux d\'utilisation du poste choisi : heures réellement requises ÷ heures productives attendues (tableau de Main-d\'œuvre).',
    posteCoutHoraire: 'Coût d\'une heure payée du poste choisi, charges sociales comprises : sa paie chargée ÷ ses heures payées.',
    posteMasse: 'Paie chargée totale du poste choisi (tous ses employés), pour les heures saisies dans la base de main-d\'œuvre.',
    posteInutilise: 'Paie du poste choisi qui ne sert pas à produire (capacité inutilisée et temps non productif), en $.',
    posteInutilisePart: 'Part de la paie du poste choisi qui ne sert pas à produire, comme la carte Utilisation de la masse salariale, poste par poste.',
    // Un format
    fmtMargeBrute: 'Marge brute du format choisi, tous canaux confondus (pondérée par le revenu de chaque canal).',
    fmtMargeNette: 'Marge nette du format choisi, tous canaux confondus (pondérée par le revenu de chaque canal).',
    fmtMatiere: 'Coût matière du format choisi en % de son prix de vente, tous canaux confondus.',
    fmtEmballage: 'Coût d\'emballage du format choisi en % de son prix de vente, tous canaux confondus.',
    fmtMo: 'Coût de main-d\'œuvre du format choisi en % de son prix de vente, tous canaux confondus.',
    fmtBeneficeHeure: 'Bénéfice brut par heure de main-d\'œuvre du format choisi, comme le tableau de rentabilité de l\'heure de Main-d\'œuvre.',
    // Un canal
    canalMargeBrute: 'Marge brute du canal choisi (rapport Par canal), toutes activités confondues.',
    canalMargeNette: 'Marge nette du canal choisi (rapport Par canal), toutes activités confondues.',
    canalPart: 'Part du canal choisi dans les revenus prévus de l\'ensemble des canaux.',
    // Une activité
    actMargeBrute: 'Marge brute de l\'activité choisie (rapport Par activité), tous canaux confondus.',
    actMargeNette: 'Marge nette de l\'activité choisie (rapport Par activité), tous canaux confondus.',
    actPart: 'Part de l\'activité choisie dans les revenus prévus de l\'ensemble des activités.',
};
