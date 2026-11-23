# 17 — Maquette de l'export Excel « base de données »

**Statut (23/11) : réalisé.** Voir la section « Export Excel refondu en base de données » de `03-Feuille-de-route.md`. Écarts avec cette maquette : pas de CSV (xlsx seul), pas de `Objectifs` ni de `Constats`, pas de `Matrice_activité_canal`, ajout de `Base_à_plat`, de la colonne `produit_id` et de la part matière des lignes de recette ; l'en-tête figé n'est pas pris en charge par la bibliothèque.

*Rédigée le 23/11, révisée le même jour après les retours de l'utilisateur. Proposition à valider : aucun code de l'application n'a été écrit. Une maquette visuelle (page web) et un classeur d'essai, `Maquette-Export-Excel.xlsx`, ont été générés à partir du projet démo.*

**Révision 23/11** : (1) `Objectifs` et `Constats` retirés ; (2) ajout d'une feuille `Base_à_plat` (une ligne par format × canal) comme vue unique ; (3) le coût par étape de production existe dans `calculateCostLines` (`directCost`, `totalCost`) : la colonne est conservée ; (4) la bibliothèque Excel actuelle n'écrit pas les couleurs d'en-tête (vérifié : aucun style dans le fichier produit).

## 1. L'idée en une phrase

Aujourd'hui l'Excel est un **résumé** (un tableau de bord, un tableau par format, une feuille de « fiche » par format). La proposition : en faire une **base de données** que quelqu'un d'autre (consultant, comptable, outil de tableaux de bord) peut ouvrir, filtrer et croiser, sans rien retaper et sans que l'application soit installée.

Le PDF reste la présentation. L'Excel devient la matière première.

## 2. Règles de construction

1. **Une feuille = un type de chose** (formats, ingrédients, canaux…). **Une ligne = une chose.** Aucune cellule fusionnée, aucun titre au milieu de la feuille, la ligne 1 est l'en-tête.
2. **Des identifiants stables** (`fmt_tao`, `ing_poulet`, `channel_direct`…) dans chaque feuille. Ils servent de clé pour relier les feuilles entre elles (RECHERCHEV, tableaux croisés, Power Query).
3. **Aucun calcul dans l'export.** Les valeurs « saisies » viennent de l'état du projet ; les valeurs « calculées » viennent des moteurs que l'application utilise déjà (`analysisData`, `channelBreakdown`, `calculateCostLines`, `trackingSeries`, `objectives`, `findingSurfaces`…). Même discipline que le PDF : un test compare chaque colonne à ce que l'application affiche.
4. **Une donnée absente reste une cellule vide**, jamais un 0 (règle du projet).
5. **De vrais nombres** : pas de `"500 g"` ; la quantité et l'unité sont deux colonnes. Les pourcentages sont des fractions (0,308) affichées en % par le format de cellule.
6. **Colonnes classées par couleur d'en-tête** : bleu = saisi par l'utilisateur, gris = calculé par l'application. Le consultant sait toujours ce qu'il peut modifier dans l'application et ce qui en découle.
7. **Deux feuilles d'accompagnement** : `Lisez-moi` (période, date d'export, version, comment relier les feuilles) et `Dictionnaire` (une ligne par colonne : feuille, colonne, définition, unité, saisi ou calculé, d'où vient la valeur dans l'application).

## 3. Les feuilles

Réparties en cinq familles (la couleur de l'onglet suit la famille). Les exemples sont de **vraies valeurs du projet démo**.

### A. Produits (le cœur)

**`Formats`** — une ligne par format (14 dans le démo, sous-recettes comprises ; une colonne `type` permet de les isoler).

| format_id | sku | produit | activité_id | type | actif | unités_par_lot | taille | unité | … |
|---|---|---|---|---|---|---|---|---|---|
| fmt_sub_bouillon | SR-BOUILLON-40L | Bouillon de poulet maison | act_soupes | sous-recette | non | 40 | 1 | L | … |

Suite des colonnes (calculées, source `productsWithCosts[].costs`) : coût matière, emballage, main-d'œuvre, sous-traitance, vieillissement, indirect, **coût de revient par unité**, marge brute $ et %, marge nette $ et %, marge de contribution, durée de production, coût du lot.

**`Lignes_recette`** — une ligne par ingrédient d'un format : `format_id · ingrédient_id · ingrédient · quantité · unité_recette · rendement_% · coût_de_la_ligne`. Exemple : `fmt_sub_bouillon · ing_poulet · Poitrine de poulet · 2000 · g · 100 %`. Source du coût : `calculateCostLines` (le moteur que le PDF utilise déjà).

**`Lignes_emballage`** — même forme pour l'emballage.

**`Étapes_production`** — `format_id · étape · poste · début_s · durée_s` (+ coût de l'étape si le moteur le fournit ; sinon la colonne est **omise** plutôt que recalculée — à vérifier, voir §6).

**`Allergènes`** — une ligne par couple format × allergène : `format_id · allergène` (noms français, source `computeFormatAllergens`). Se filtre ou se pivote directement.

### B. Ventes et rentabilité

**`Ventes_par_canal`** — une ligne par format × canal (la feuille la plus utile pour un consultant) :

| format_id | canal_id | prix_net | volume | marge_brute_$ | marge_brute_% | marge_nette_$ | marge_nette_% | contribution_$ | seuil_unités |
|---|---|---|---|---|---|---|---|---|---|
| (Purée maison) | channel_direct | 5,21 | 66 | 3,13 | 60,2 % | 1,60 | 30,8 % | 4,02 | 184 |

Source : `channelBreakdown` (l'Excel actuel ne contient pas ceci).

**`Canaux`** — `canal_id · nom · liens` (une ligne par intermédiaire : type, % ; ex. Épiceries indépendantes : marge de 30 %).
**`Activités`** — `activité_id · nom · clé_de_répartition_des_frais`.
**`Matrice_activité_canal`** — une ligne par case activité × canal : bénéfice net, % (source `computeActivityChannelMarginMatrix`).

### C. Intrants et fournisseurs

**`Ingrédients`** — catalogue : `id · nom · fournisseur · format_d'achat · unité · prix_d'achat · prix_unitaire · perte_% · dernière_MàJ`, plus les **achats de la période** (`quantité`, `coût_achat`, `coût_perte`, `coût_total`, source `purchasingReportData`) et la classe ABC.
Exemple : Poitrine de poulet · Boucherie Nordique · 10 kg · 62,00 $ · 6,20 $/kg · perte 6 % · 637 kg · 4 203 $.

**`Emballages`** — même forme, source `packagingPurchasingReportData`.

### D. Main-d'œuvre et frais

**`Employés`** — `employé_id · poste · nom · taux_horaire · charges_% · vacances_% · productif_% · heures · coût_horaire_chargé · coût_total`. Exemple : Mireille · Responsable de production · 32 $ · 16 % · 6 % · 85 % · 20 h.
**`Postes`** — utilisation par poste (`productivityReport.rows` : capacité attendue, réelle, % d'utilisation).
**`Frais_fixes`** — `frais_id · libellé · catégorie · montant · clé_de_répartition`. Exemple : Loyer (espace de production) · Frais généraux de production · 9 000 $ · manuelle.
**`Frais_répartition`** — pour les répartitions manuelles : `frais_id · cible (activité ou canal) · montant`. Exemple : loyer → act_plats 5 000 · act_soupes 2 500 · act_sauces 1 500.
**`Revenus`** et **`Coûts_directs`** — les lignes de l'état des résultats (id, libellé, catégorie, activité, montant).

### E. Analyse (ce que l'application conclut)

**`Suivi_global`** — une ligne par relevé (19 dans le démo : mai 2025 → nov. 2026) : date, nom du relevé, revenus, frais fixes, coût matière moyen, marge brute moyenne… (source `computeGlobalSeries`).
**`Suivi_formats`** — une ligne par relevé × format : prix, coût de revient, marges (source `computeProductSeries`). Permet de refaire n'importe quel graphique d'évolution.
**`Objectifs`** — une ligne par objectif : indicateur, cible, actif ou non, valeur mesurée, atteint (source `objectives.js`).
**`Constats`** — une ligne par constat (95 dans le démo) : `id · nature (force/faiblesse) · portée · gravité · groupe · sujet_type · sujet_id · titre · détail · onglet_de_l'application`. Mêmes règles et mêmes adresses que l'application et le PDF.

## 4. Ce que devient l'ancien export

| Ancien | Devient |
|---|---|
| Tableau de Bord | Dans `Lisez-moi` (période) + `Suivi_global` ; le détail des moyennes pondérées est dans `Formats` et `Objectifs` |
| Résumé | `Formats` (plus complet, sans mise en forme décorative) |
| Ingrédients, Main d'œuvre | `Ingrédients`, `Employés` (mis à plat, sans fusion) |
| **Une feuille « Fiche » par format** | `Lignes_recette`, `Lignes_emballage`, `Étapes_production` : les mêmes informations, en trois tables au lieu de 14 feuilles. Si on veut garder une fiche lisible, c'est le PDF qui la fournit |

## 5. Comment le construire (plan de match)

1. **Valider cette maquette** (feuilles, colonnes, ce qu'on garde ou retire).
2. **Un « modèle » de l'export**, comme `model.js` du PDF : une fonction pure qui prend l'état du projet et les calculs déjà faits, et renvoie les tables (lignes et colonnes) sans écrire de fichier. Aucune formule nouvelle.
3. **Un écrivain Excel** très mince : prend les tables, pose en-têtes colorés, formats de nombres, largeurs, filtres automatiques, volets figés, feuille Dictionnaire. Remplace `exportToExcel.js`.
4. **Tests** : (a) chaque colonne calculée égale la valeur affichée par l'application sur le démo ; (b) chaque clé étrangère pointe vers une ligne existante ; (c) aucune cellule fusionnée, aucun texte à la place d'un nombre ; (d) cas limites (projet vide, 50 produits, nom de produit avec caractères spéciaux). Un test e2e vérifie le téléchargement.
5. **Documentation** : guide (chapitre des exports), feuille de route, infobulle du bouton.

## 6. Points à trancher ou à vérifier

- **Décision** : supprimer les feuilles « Fiche » par format (proposé, le PDF les remplace) ou les garder en option ?
- **Décision** : inclure `Constats` et `Objectifs` ? Utiles pour un consultant, mais ce sont des conclusions de l'application, pas des données saisies. Proposé : oui, regroupés dans la famille E.
- **Décision** : le Dictionnaire en français uniquement (proposé) ?
- **À vérifier** : le coût par étape de production n'est peut-être pas fourni par un moteur existant (l'export actuel le recalcule lui-même). Si c'est le cas, la colonne est omise plutôt que recalculée.
- **Hors périmètre** : ré-importer cet Excel dans l'application. La sauvegarde complète reste le fichier de projet (JSON).
