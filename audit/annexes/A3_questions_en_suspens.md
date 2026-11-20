# Annexe A3 — Questions en suspens et éléments non vérifiés

Mise à jour du 21/11, après la discussion avec l'administrateur de l'outil.

## Questions de l'audit : réponses obtenues

1. **Usage visé des coûts unitaires.** Outil de **gestion** (prix, rentabilité), pas un outil comptable. Les constats fondés sur IAS 2 ont été retirés ou reformulés (voir A4).
2. **Période de référence.** Les heures de main-d'œuvre, les frais fixes et les volumes doivent couvrir la même période ; c'est une question de saisie. L'application ne le contrôle pas : trois infobulles le rappellent.
3. **Capacité normale.** Sans objet : l'absorption de toute la paie dans le coût des produits est un choix assumé, cohérent avec le point mort et la réconciliation.
4. **Sous-recette « hybride ».** Pour un usage interne en vrac, créer une sous-recette ou un format sans emballage (fait dans le démo : « Purée de base en vrac »).
5. **Coproduits.** Hors périmètre pour le moment (v2 éventuelle).

## Question ouverte

- **Quantité produite absente.** Le moteur la remplace encore par 1 (avertissement dans « Points à vérifier »). L'administrateur estime que la bonne valeur serait 0 ou un « non applicable » : décision à prendre (voir échanges du 21/11).

## Éléments non vérifiés

- Exports PDF/Excel (`src/reports/`) : cohérence avec le moteur non testée ligne à ligne (seuls les champs de quantité produite et de taux horaire ont été reliés aux fonctions communes).
- Assistants d'import (catalogue, ventes, état des résultats, PDF) : non audités.
- Couverture de code : non mesurée (aucun outil configuré).
- Contrôles de saisie de l'interface (blocage ou simple signalement visuel) : examinés par extraits seulement.
- Aucun projet réel de l'entreprise : tous les chiffres de l'audit viennent du jeu de démonstration (avant corrections ; le démo a été modifié depuis).
- Références normatives (IAS 2, chapitre 3031) : citées de mémoire à titre de repère ; à faire valider avant toute citation externe.
