# Annexe A4 — Suivi des corrections (20/11)

Le rapport `RAPPORT_AUDIT.md` décrit l'état **avant** corrections ; les chiffres de ses tableaux viennent de l'ancien jeu de démo (`demo_inputs.json`, `app_output_*.json`). Ne pas relancer le harnais en croyant retrouver ces chiffres : il lit le démo actuel (et ne s'exécute que si `AUDIT_HARNESS=1`).

| Constat | Décision de l'utilisateur | État |
|---|---|---|
| 1 Capacité inutilisée | Choix assumé (cohérent avec le point mort et la réconciliation) | Retiré |
| 2 Coût inventoriable | Coût de production et coût complet déjà présents | Retiré |
| 3 Sous-recettes (nature des coûts) | Corriger | Fait |
| 4 Vieillissement de sous-recette | Coût d'opportunité pour le prix ; suit dans la ligne vieillissement du parent | Fait |
| 5 nbPortions stocké vs calculé | Corriger, évaluer plus tard | Fait |
| 6 Prix net à 0 avec volume | Garder dans les chiffres + avertissement | Fait |
| 7 SKU sans volume | Avertissement + corriger le démo | Fait |
| 8 Valeurs manquantes | Solution acceptée : avertissements (quantité produite, quantité négative) | Fait |
| 9 Boucle de sous-recettes | Solution acceptée : détection, prévention à la saisie, pas de cache | Fait |
| 10 Répartition au coût direct | Faux problème (choix de l'utilisateur) | Retiré |
| 11 Coût d'acquisition | Essai : colonnes Escompte et Transport (ingrédients) | Fait (à juger visuellement) |
| 12 Écarts par nature | Réserves sur la classification des charges réelles | En discussion |
| 13 Coproduits | Reporté (v2) | Reporté |
| 14 Conversions / périodes / taux | Conversions déjà limitées par famille (retiré) ; infobulles de période ; taux regroupé | Fait |
| 15 Journal des modifications | Décision en attente | En attente |
| Nouveau (16) | Appel récursif sans catalogue d'emballages : coût dépendant de l'ordre des produits | Trouvé et corrigé |
| Complément (21/11) | Le vieillissement est retiré de la marge de contribution du point mort (décision de l'utilisateur) | Fait, documenté dans le guide |
| Complément (21/11) | Volumes d'un canal supprimé : écartés du volume qui répartit les frais fixes et des heures de main-d'œuvre (`activeChannelPrices`) | Fait |
| Complément (21/11) | Commentaires de code corrigés (soupape de sécurité du repli « Général », plafond de la productivité) ; annexes A2 et A3 mises à jour | Fait |
| 8 (reste) | Valeur de remplacement d'une quantité produite absente : 1 aujourd'hui ; 0 ou « non applicable » à trancher | En attente |
