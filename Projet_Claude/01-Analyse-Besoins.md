# Analyse des besoins — RestoCalculateur → transformation alimentaire

## 1. Application actuelle (RestoCalculateur)

- Stack : Electron + React 18 (Vite), state centralisé dans un `useReducer` (`projectReducer.js`)
  exposé via `ProjectContext`. Moteur de calcul pur et testé dans `src/engine/`
  (`calculateCosts.js`, `analysisData.js`, `priceVolatility.js`, `costScenario.js`), découplé de
  l'UI. Rapports PDF/Excel générés depuis le même `analysisData`.
- Modèle de données : `baseIngredients` (catalogue), `products` (plat / sous-recette / produit de
  revente), `laborDatabase` (postes → employés), `trackingPoints` (snapshots historiques).
- Coût d'un produit = matière (avec perte de stock + rendement de préparation, cumulatifs) +
  main-d'œuvre (postes pondérés × durée des étapes, ajustée par la productivité cuisine) + frais
  indirects (une seule méthode globale : au prorata des ventes OU du temps de production,
  réconciliée exactement avec le pool de frais indirects).
- 6 onglets : Paramètres, Ingrédients, Main-d'œuvre, Recette & Calcul, Résumé (+ simulateur de
  chocs, menu-engineering), Suivi (historique, volatilité des prix).
- Conçu pour la **restauration** : un prix de vente unique par plat, un mix des ventes exprimé en
  part de popularité au menu, pas de notion de format d'emballage ni de circuit de vente.

## 2. Agro-calculateur MAPAQ (référence comptable)

Outil Excel (10 feuilles) du MAPAQ/CETAB+ pour entreprises agroalimentaires multi-activités et
multi-circuits. Concepts clés absents de RestoCalculateur :

- **Activités de production × circuits de vente** : matrice à deux axes ; chaque poste comptable
  est réparti entre les deux via des clés de répartition (manuelle, selon les ventes, les charges
  directes, les bâtiments, ou une clé personnalisée).
- **Charges directes vs indirectes** par nature comptable (frais variables / frais variables
  salaires vs frais généraux de production / financiers / administration / vente).
- **Emballages_Opérations** : catalogue miroir des ingrédients, coût de packaging comptabilisé
  comme poste distinct du coût matière.
- **Coefficient d'imputation des charges indirectes (CICI)** : 4 méthodes possibles (Direct,
  Main-d'œuvre, Volume, Superficie), choisies **par activité de production**, donc potentiellement
  différentes selon la famille de produits.
- **Grille de rendement de transformation** : quantité achetée → rendement % → pertes de
  fabrication en cascade → nombre d'unités de vente obtenues par lot.
- **Charges d'intérêt pour vieillissement** : coût de portage financier pour l'inventaire à
  rotation lente (produits affinés, stock saisonnier).
- **Coût de revient par produit ET par circuit de vente** : un même produit peut avoir un coût de
  revient différent selon le canal, car les frais de vente diffèrent par circuit.
- Limites propres à l'outil (Excel) : clés à remplir avec un conseiller, plafond de 10
  activités/10 circuits, pas d'automatisation de suivi historique ni de simulation de scénarios —
  des points où RestoCalculateur est déjà supérieur et doit le rester.

## 3. Écarts identifiés et décisions de portée prises

| # | Écart | Décision |
|---|---|---|
| 1 | Un seul prix de vente par produit | **Circuits de vente multiples** : un produit peut être vendu par plusieurs circuits à des prix différents. |
| 2 | Une seule méthode globale de répartition des frais indirects pour toute l'entreprise | **Règle par groupe de produits** : possibilité de créer des groupes de produits et d'assigner une méthode de répartition différente à chacun. |
| 3 | `generalInfo.totalIndirects` = un seul chiffre saisi à plat | **Remplacement complet** par un état de résultats catégorisé (nouvel onglet Comptabilité) — pas de coexistence avec un champ simplifié. |
| 4 | Le packaging n'a pas de catalogue ni de poste de coût dédié | **Nouvel onglet Packaging**, catalogue miroir des ingrédients, poste de coût distinct dans `calculateCosts`. |

Voir `02-Journal-Decisions.md` pour le détail et la justification de chaque décision, et
`03-Feuille-de-route.md` pour le plan de réalisation.

## 4. Ce qui reste solide et à conserver

- Moteur d'ingrédients (conversion d'unités, perte vs rendement, sous-recettes récursives).
- Réconciliation **exacte par construction** des frais indirects (supérieure à la vérification
  manuelle ±10 % de MAPAQ) — principe à garder même en enrichissant les méthodes disponibles.
- Base de main-d'œuvre par postes/employés (plus riche que la ligne "taux $/h" à plat de MAPAQ).
- Simulateur de chocs de coûts et suivi historique/volatilité — à étendre au packaging et aux
  nouveaux axes une fois ceux-ci en place.
