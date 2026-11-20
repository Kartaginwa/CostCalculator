# RAPPORT D'AUDIT — Calculs et méthodologie de coût de revient

**Application auditée :** RestoCalculateur (« Transfo Calculateur »), dossier `RestoCalculateur - Work`, branche `master`, dernier commit `ba81802`
**Date :** 2026-11-20 — **Nature :** audit indépendant en lecture seule (aucun fichier de l'application modifié)
**Données utilisées :** jeu de démonstration intégré (« Boréal Mets Préparés inc. »). Aucune donnée réelle d'entreprise.

---

## 1. Sommaire exécutif

**Opinion globale : CONFORME AVEC RÉSERVES** pour l'usage de l'outil comme **instrument de gestion** (calcul du coût de revient complet, tarification, rentabilité par produit, canal et activité).
**NON CONFORME tel quel à un usage de valorisation des stocks ou de reddition de comptes** selon IAS 2 / chapitre 3031 « Stocks » du Manuel de CPA Canada (réf. à faire valider, voir §2.3). L'application ne contient pas de module de stocks ; l'écart est donc conditionnel à l'usage qu'on fait des coûts unitaires.

**Exactitude arithmétique : confirmée.** Un recalcul indépendant (Python, `decimal`) de 13 formats de produits, 36 marges par canal et des pools de frais fixes reproduit l'application avec un écart absolu maximal de **6,4 × 10⁻⁵ $ par portion** (0,002 % au plus). Cet écart a une cause identifiée (constat 5). Les cohérences internes tiennent exactement : frais fixes absorbés = frais fixes saisis (28 000,0000 $ ; écart 0,0000), paie chargée absorbée = paie totale (écart 0,0000), bénéfice net par lignes = bénéfice net par bilan (5 500,07 $ ; écart 0,0000).

**Principaux constats (15 au total : 2 majeurs, 11 modérés, 2 mineurs ; aucun critique) :**

| # | Constat | Gravité | Impact mesuré (jeu de démo) |
|---|---|---|---|
| 1 | Toute la capacité de main-d'œuvre inutilisée est imputée aux produits, sans plancher ; discontinuité à volume nul | Majeur | 2 519 $ de capacité inutilisée absorbés (22,8 % de la paie) ; à demi-volume, coût complet du Tao 8,25 $ au lieu de 5,31 $ (+55 %) |
| 2 | Le « coût de revient » intègre administration, vente et frais financiers | Majeur | 16 000 $ sur 28 000 $ de frais fixes (57 %) ; coût complet absorbé 73 703 $ contre ≈ 55 123 $ de coût inventoriable indicatif (−25,2 %, soit 18 580 $) |
| 3 | Sous-recette hybride : emballage et conditionnement imputés au plat parent ; MO de sous-recette classée en « matière » | Modéré | 552,58 $ imputés en trop aux pâtés si la purée est utilisée en vrac (+7,3 % du coût direct) ; 2 336 $ de MO classés en « matière » |
| 4 | Vieillissement d'une sous-recette non transmis au plat parent | Modéré | Purée à 12 %/6 mois : 0,1248 $/portion absente du pâté |
| 5 | `nbPortions` stocké vs calculé (grille de rendement) : trois consommateurs lisent la mauvaise valeur | Modéré | Achats sous-estimés de 599 $ (−3,0 %) dans le scénario testé ; 6 × 10⁻⁵ $ dans le démo |
| 6 | Frais de canal non entièrement absorbés si un prix net ≤ 0 coexiste avec un volume | Modéré | 271,77 $ sur 3 544 $ (7,7 %) non absorbés, sans avertissement |
| 7 | SKU actif sans volume : aucun frais fixe imputé | Modéré | Marge de la sauce spaghetti surévaluée (≈ 2,7 $/portion de frais fixes manquants, indicatif) |
| 8 | Rendements et quantités produites non contrôlés (nbPortions vide → 1) | Modéré | Coût direct du Tao ×18,9 si la quantité est vide (62,46 $ vs 3,31 $ direct) |
| 9 | Boucle de sous-recettes : coût 0 silencieux, cache pollué, dépendant de l'ordre | Modéré | Pâté 340 g : coût direct 3,48 $ → 2,16 $ selon le chemin d'évaluation |
| 10 | Frais fixes répartis au prorata du coût direct : le prix d'une matière modifie le coût des autres produits | Modéré | +10 % sur le bœuf : frais fixes unitaires du Tao −1,4 %, du pâté +3,1 % |
| 11 | Pas de coût d'acquisition complet (transport, escomptes, droits, taxes, change), pas de valorisation CMP/PEPS ni de date de prix | Modéré | Non quantifiable (aucune donnée) |
| 12 | Pas d'analyse d'écarts prix/rendement/efficience ; écart réel–théorique non imputé | Modéré | 2 357,67 $ (+5,2 %) de charges directes réelles au-delà du théorique |
| 13 | Coproduits/sous-produits non gérés (limite connue, différée) | Modéré | Non applicable au démo |
| 14 | Arrondis, périodes et unités : règles implicites | Mineur | Aucun écart de bouclage mesuré |
| 15 | Gouvernance : pas d'historique, de piste d'audit, de contrôle d'accès, de sauvegarde automatique | Mineur à modéré | — |

**Priorités :** (1) introduire un coût « inventoriable » distinct du coût complet de gestion (constats 1-2) ; (2) corriger les trois défauts objectifs de cohérence (constats 5, 6, 9) et les contrôles de données manquants (8, 9) ; (3) définir le traitement des sous-recettes hybrides et du vieillissement (3-4) ; (4) analyse d'écarts et historique des prix (11-12, 15).

---

## 2. Portée, objectifs et limites

### 2.1 Fichiers et modules examinés
Lus intégralement : `src/engine/calculateCosts.js` (527 l.), `analysisData.js` (1 259 l.), `laborHours.js`, `analysisPipeline.js`, `yieldCalculator.js`, `projectChecks.js`, `src/utils.js`. Lus en extraits ciblés : `src/App.jsx` (absorption de la MO, pools, liste des sous-recettes), `src/state/initialState.js` (jeu de démonstration), `projectSerialization.js`, `IngredientsTab.jsx`, `RecipeCalculator.jsx`, `priceVolatility.js`, `costScenario.js`, tests `calculateCosts.test.js`. Documentation : `CLAUDE.md`, `Projet_Claude/` (recherche ciblée).

### 2.2 Exécutions
- `audit/recalculs/recalcul_independant.py` : recalcul indépendant (Decimal) — **sans réutiliser le code de l'application**.
- `audit/recalculs/harness_app.test.js` : exécution de la logique de l'application sur le jeu de démo **uniquement** (aucun projet réel, aucune base). Cas limites et sensibilités (annexe A1).
- Suite de tests existante (`npx vitest run`) : 21 fichiers, 356 tests, tous réussis.

### 2.3 Limites et hypothèses
- Aucune donnée réelle : les chiffres illustrent le comportement du moteur, pas la situation d'une entreprise.
- Exports PDF/Excel, assistants d'import, interface et tests Playwright : non audités ou non exécutés (annexe A3).
- Couverture de code non mesurée.
- **Références normatives** (IAS 2, chapitre 3031) : citées pour situer le sujet ; je ne garantis pas la numérotation exacte des paragraphes — **à vérifier par un professionnel**. Aucun avis fiscal ou juridique n'est donné.
- Hypothèse d'usage : outil de gestion (tarification/rentabilité), sans stock. Voir A3.

---

## 3. Description du modèle de coûtage implémenté

### 3.1 Méthode
**Coût complet par absorption, calculé par format de vente (SKU), à partir de recettes « standard » théoriques** (quantités de la fiche × prix d'achat courants), avec volumes de période saisis par canal. Ce n'est ni un coût réel par lots, ni un coût standard avec écarts, ni de l'ABC au sens strict (trois « moteurs » seulement : coût direct, temps de MO, volume physique). Un rapprochement **agrégé** réel/théorique existe (`analysisData.js:775-811`).

### 3.2 Flux de calcul

| Étape | Formule implémentée | Source |
|---|---|---|
| 1. Prix unitaire d'achat | `prix d'achat ÷ format d'achat` (stocké, non recalculé) | `IngredientsTab.jsx:200` |
| 2. Quantité produite (lot) | `nbPortions` saisi (vide → 1), ou grille : `base × Π(1+effet) × (1−rejet) ÷ taille` | `calculateCosts.js:57-66` ; `yieldCalculator.js:14-26` |
| 3. Matière par ligne | `qté × conversion × prix ÷ (1−perte catalogue)` puis `÷ rendement de ligne` ; perte ignorée si ≥ 100 % | `calculateCosts.js:130-144` |
| 3b. Sous-recette comme ingrédient | prix = `coût DIRECT par portion ÷ taille de portion` (matière + emballage + MO + sous-traitance ; **sans** frais fixes ni vieillissement) | `calculateCosts.js:115-127` |
| 4. Emballage | même logique que la matière, sans rendement | `calculateCosts.js:190-215` |
| 5. Main-d'œuvre | `Σ (durée/3600 × taux moyen pondéré du poste)` par personne et par étape ; taux = `taux × (1+charges) × (1+vacances)` ; puis `÷ facteur de productivité` | `calculateCosts.js:161-182,218` |
| 5b. Facteur de productivité | `coût des heures nécessaires ÷ paie chargée de tous les postes`, plafonné à 100 % ; ≤ 0 → 1 | `App.jsx:333-341` ; `calculateCosts.js:68` |
| 6. Sous-traitance | somme des coûts saisis (par lot) | `calculateCosts.js:224-226` |
| 7. Coût direct / portion | `(matière + emballage + MO + sous-traitance) ÷ nbPortions` | `calculateCosts.js:322-338` |
| 8. Frais fixes | trois pools : Général (clé `directCost`/`laborTime`/`volume`), Activité (idem, au choix), Canal (majoration % du coût direct) ; part d'un format = `pool × (driver du format ÷ driver total) ÷ volume vendu` | `analysisData.js:152-207, 911-944, 1009-1093` |
| 9. Vieillissement | `(matière+emballage+MO+sous-traitance) × (taux/12) × mois` | `calculateCosts.js:344-350` |
| 10. Coût complet / portion | `direct + frais fixes + vieillissement` | `calculateCosts.js:352` |
| 11. Marges | par canal : `prix net − coût complet (avec part de canal)` | `calculateCosts.js:420-447, 486-527` |

Ordre des opérations : perte catalogue → rendement de ligne → coûts de transformation ajoutés ensuite (MO, emballage) → division par le lot → frais fixes (au volume vendu). Cet ordre est cohérent (pas d'application de la perte après ajout des coûts de transformation).

### 3.3 Sources des données
Prix : fiches ingrédients/emballages saisies ou importées (un seul prix courant par article). Volumes : saisis par format et par canal. Frais fixes : lignes de l'état des résultats avec clé de répartition. Paie : onglet Main-d'œuvre (heures et taux par employé).

### 3.4 Écarts documentation/code
- Les commentaires du code sont riches et, sur les points vérifiés, fidèles. Une exception : le commentaire du pool « Général » de `calculateCosts.js:228-239` décrit ce bloc comme « repli historique » alors que `method !== 'laborTime'` active encore une soupape de sécurité (`calculateCosts.js:315-320`) — sans effet quand les pools sont fournis. Mineur.
- `App.jsx:330` annonce un facteur « plafonné à 100 % » alors que la valeur exposée (`kitchenProductivity`, `App.jsx:341`) peut dépasser 100 % (154 % au double du volume) ; le plafond n'est appliqué qu'à l'usage (`calculateCosts.js:68`). Effet nul sur les coûts, mais l'indicateur affiché peut surprendre. Mineur.

### 3.5 Cartographie des fichiers de calcul

| Fichier | Rôle |
|---|---|
| `src/engine/calculateCosts.js` | Coût d'un format, récursion des sous-recettes, marges, ventilation par canal |
| `src/engine/analysisData.js` | Pools de frais fixes, drivers, agrégations par activité/canal, réconciliation, achats, ABC, matrice de menu |
| `src/engine/laborHours.js` + `src/App.jsx:295-380` + `src/engine/analysisPipeline.js` | Heures de MO nécessaires, taux d'absorption |
| `src/engine/yieldCalculator.js` | Rendement (grille d'étapes + rejet) |
| `src/utils.js` | Parsing numérique, conversions d'unités, catégories |
| `src/engine/costScenario.js`, `CostShockSimulator.jsx` | Simulateur de chocs de coûts |
| `src/engine/projectChecks.js` | Contrôles d'intégrité (avertissements) |

---

## 4. Résultats des tests de recalcul

### 4.1 Coût par portion — application vs recalcul indépendant
(Valeurs en $ par portion ; détail de tous les postes : `audit/annexes/recalcul_resultats.md`.)

| Produit (format) | Champ | Valeur application ($) | Valeur recalculée ($) | Écart ($) | Écart (%) |
|---|---|---:|---:|---:|---:|
| Bouillon de poulet (sous-recette, 1 L) | Coût direct / portion | 2.106694 | 2.106658 | -3.6e-05 | -0.0017 |
| Bouillon de poulet (sous-recette, 1 L) | Coût complet / portion | 2.106694 | 2.106658 | -3.6e-05 | -0.0017 |
| Purée maison 250 g (hybride) | Coût direct / portion | 2.079248 | 2.079241 | -6.6e-06 | -0.0003 |
| Purée maison 250 g (hybride) | Coût complet / portion | 3.348436 | 3.348431 | -5.2e-06 | -0.0002 |
| Pâté chinois 340 g | Coût direct / portion | 3.481904 | 3.481894 | -1.0e-05 | -0.0003 |
| Pâté chinois 340 g | Coût complet / portion | 5.597567 | 5.597560 | -7.4e-06 | -0.0001 |
| Pâté chinois 900 g (vieillissement) | Coût direct / portion | 9.276744 | 9.276713 | -3.1e-05 | -0.0003 |
| Pâté chinois 900 g (vieillissement) | Coût complet / portion | 14.943005 | 14.942980 | -2.5e-05 | -0.0002 |
| Poulet général Tao 400 g | Coût direct / portion | 3.310908 | 3.310890 | -1.7e-05 | -0.0005 |
| Poulet général Tao 400 g | Coût complet / portion | 5.305741 | 5.305722 | -1.9e-05 | -0.0004 |
| Saumon teriyaki 380 g | Coût direct / portion | 5.509809 | 5.509791 | -1.8e-05 | -0.0003 |
| Saumon teriyaki 380 g | Coût complet / portion | 8.881804 | 8.881789 | -1.4e-05 | -0.0002 |
| Sauté thaï 350 g | Coût direct / portion | 2.929279 | 2.929267 | -1.2e-05 | -0.0004 |
| Sauté thaï 350 g | Coût complet / portion | 4.708144 | 4.708132 | -1.2e-05 | -0.0002 |
| Sauté thaï 900 g (sous-traité + vieill.) | Coût direct / portion | 9.354676 | 9.354658 | -1.7e-05 | -0.0002 |
| Sauté thaï 900 g (sous-traité + vieill.) | Coût complet / portion | 15.040139 | 15.040135 | -3.6e-06 | -0.0000 |
| Chili 400 g | Coût direct / portion | 3.811550 | 3.811538 | -1.2e-05 | -0.0003 |
| Chili 400 g | Coût complet / portion | 6.108472 | 6.108462 | -9.2e-06 | -0.0002 |
| Soupe 0,75 L (grille de rendement) | Coût direct / portion | 3.467549 | 3.467501 | -4.8e-05 | -0.0014 |
| Soupe 0,75 L (grille de rendement) | Coût complet / portion | 5.621400 | 5.621339 | -6.1e-05 | -0.0011 |
| Potage 0,75 L | Coût direct / portion | 4.762840 | 4.762804 | -3.6e-05 | -0.0008 |
| Potage 0,75 L | Coût complet / portion | 7.735766 | 7.735731 | -3.5e-05 | -0.0005 |
| Sauce spaghetti 500 ml (sans volume) | Coût direct / portion | 4.454856 | 4.454838 | -1.8e-05 | -0.0004 |
| Sauce spaghetti 500 ml (sans volume) | Coût complet / portion | 4.454856 | 4.454838 | -1.8e-05 | -0.0004 |
| Sauce Terroir (revente) | Coût direct / portion | 4.200000 | 4.200000 | +0.0e+00 | +0.0000 |
| Sauce Terroir (revente) | Coût complet / portion | 6.842984 | 6.842991 | +7.6e-06 | +0.0001 |


*Lecture :* écart maximal sur l'ensemble des postes (matière, emballage, MO, sous-traitance, frais fixes Général/Activité/Canal, vieillissement) : **6,44 × 10⁻⁵ $** par portion ; sur les 36 marges nettes par canal : même maximum. Cause unique : le constat 5 (l'application calcule les heures de MO de la soupe avec `nbPortions` = 46,65 stocké au lieu de 46,648 calculé par la grille de rendement). Preuve : en reproduisant ce choix dans le script, l'écart de productivité tombe à 1,1 × 10⁻¹⁴ point (77,214577 % de part et d'autre). Les écarts de −0,002 % sur les lignes « MO » en découlent directement.

### 4.2 Cohérence interne et réconciliation

| Contrôle | Résultat | Écart |
|---|---|---|
| Σ(frais fixes par portion × volume vendu) = frais fixes saisis (28 000 $) | 28 000,0000 $ | 0,0000 $ |
| Σ(MO propre × volume) + MO des sous-recettes = paie chargée (11 058,23 $) | 11 058,2336 $ | 0,0000 $ |
| Σ(prix net × volume) − Σ(coût direct × volume) − 28 000 − vieillissement (60,47 $) = Σ(marge nette × volume) | 5 500,0720 $ des deux côtés | 0,0000 $ |
| Coût unitaire × volume = coût du lot (toutes recettes) | vérifié implicitement par le recalcul des 13 formats | < 1 × 10⁻⁴ $ |
| Prix unitaire stocké = prix d'achat ÷ format (18 ingrédients, 8 emballages) | 0 divergence | — |

**Réconciliation avec la comptabilité générale (jeu de démo, par totaux) :** revenus réels 80 000 $ vs théoriques 79 202,64 $ (+0,99 %) ; charges directes réelles 48 000 $ vs théoriques 45 642,33 $ (écart +2 357,67 $, +5,2 %). Par nature (après reclassement des coûts de sous-recettes, voir constat 3) : matière réelle 31 800 $ vs 27 768 $ (+14,5 %) ; emballage 5 900 $ vs 5 794 $ (+1,8 %) ; MO 9 300 $ vs 11 058 $ (−15,9 %) ; sous-traitance 1 000 $ vs 1 022 $ (−2,1 %). La réconciliation de l'application ne compare que les totaux (`analysisData.js:799-808`) ; des écarts de signes opposés s'y compensent (constat 12).

### 4.3 Sensibilités (jeu de démo, par portion, $)

| Scénario | Produit | Avant | Après | Variation | Vérification manuelle |
|---|---|---:|---:|---:|---|
| Prix du bœuf +10 % | Pâté 340 g, coût direct | 3,4819 | 3,6409 | +0,1590 (+4,6 %) | 3 000 g × 9,75 $/kg ÷ 0,92 = 31,79 $/lot ; ×10 % ÷ 20 = 0,1590 ✔ |
| Rendement poulet 100 % → 80 % | Tao, coût direct | 3,3109 | 3,6077 | +0,2968 (+9,0 %) | 3,6 kg × 6,20 ÷ 0,94 = 23,745 $/lot ; ÷0,8 → +5,936 $ ÷ 20 = 0,2968 ✔ |
| Volume ×0,5 | Tao, coût complet | 5,3057 | 8,2528 | +55,5 % | productivité 77,2 % → 38,6 % (MO ×2, frais fixes ×2) |
| Volume ×0,25 | Tao, coût complet | 5,3057 | 14,3414 | +170 % | productivité 19,3 % |
| Volume ×2 | Tao, coût complet | 5,3057 | 4,1114 | −22,5 % | productivité plafonnée : la MO tombe à 0,6369 $ (taux horaire plein) |
| Volume ×0,005 | Tao, coût complet | 5,3057 | 633,18 | — | productivité 0,39 % |
| Volume = 0 | Tao, coût complet | 5,3057 | 3,1230 | — | productivité 0 → facteur 1 : discontinuité (constat 1) |

### 4.4 Cas limites exécutés sur la logique de l'application

| Cas | Observation | Constat |
|---|---|---|
| Perte d'ingrédient = 100 % | traitée comme 0 % (coût du pâté 3,35 $ < 3,48 $ du cas de base à 8 %) ; avertie par `projectChecks` | 14 (mitigé) |
| `nbPortions` vide | remplacé par 1 : Tao à 62,46 $ au lieu de 3,31 $ (direct) | 8 |
| Boucle A→B→A de sous-recettes | coût 0 de la branche en boucle, 2 `console.error`, résultats différents selon l'entrée | 9 |
| Prix net 0 avec volume sur un canal | 271,77 $ du pool de 3 544 $ non absorbés | 6 |
| Vieillissement sur une sous-recette | pâté inchangé (5,5976 $) alors que la purée porte 0,1248 $/portion | 4 |
| Grille de rendement, `nbPortions` stocké 20 vs calculé 15,2 | productivité 77,21 % vs 79,02 % ; achats 19 190 $ vs 19 789 $ | 5 |
| Quantité négative saisie | coût matière négatif accepté par le moteur (−0,47 $) | 14 |
| Famille d'unités différente (g saisi pour un ingrédient en kg → ml) | conversion à densité 1, sans erreur (avertie par `projectChecks`) | 14 (mitigé) |
| `portionSize` = 0 sur une sous-recette | taille remplacée par 1 : pâté à 193,42 $ au lieu de 5,60 $ ; avertie par `projectChecks` | 8 |
| Volume nul partout | aucun frais fixe imputé ; productivité 0 → MO au taux plein | 1 |

### 4.5 Tests existants
356 tests Vitest réussis (21 fichiers). Couverture de code non mesurée. Tests présents sur la boucle circulaire (`calculateCosts.test.js:420`, vérifie l'absence de plantage et un coût nul, **pas** la justesse), le vieillissement, la grille de rendement et la productivité. **Aucun test détecté** pour : sous-recette vieillie utilisée comme ingrédient, prix net nul avec volume (fuite de pool), `nbPortions` stocké vs grille (heures, achats), plancher de capacité, coût d'une unité à volume faible.

---

## 5. Constats détaillés

### Constat 1 — Imputation de toute la capacité de main-d'œuvre inutilisée, sans plancher de capacité normale
**Gravité : Majeur — Confiance : élevée (faits) ; jugement professionnel (conclusion)**

*Description et preuve.* Le facteur d'absorption est `coût des heures nécessaires ÷ paie de tous les postes` (`App.jsx:333-341`) ; la MO de chaque recette est divisée par ce facteur (`calculateCosts.js:68,218`). La paie entière — y compris les heures non nécessaires — est donc répartie sur les unités vendues. Au volume du démo, productivité = 77,2146 % ; capacité inutilisée = 11 058,23 − 8 538,75 = **2 519,49 $** (22,8 % de la paie), logée dans le coût des produits (MO du Tao : 0,8249 $ au lieu de 0,6369 $, +29,5 %). Plus le volume baisse, plus le coût unitaire explose (table 4.3 : ×0,5 → +55 % ; ×0,25 → +170 % ; ×0,005 → 633 $/portion), alors qu'à volume exactement nul le facteur retombe à 1 (`calculateCosts.js:68`) et le coût à 3,12 $ : **discontinuité**. Le choix est assumé (« décision du 19/11 », `App.jsx:325-331`).

*Référence.* IAS 2 (répartition des frais généraux fixes de production sur la base de la **capacité normale** ; les frais non imputés du fait d'une production faible sont passés en charges de la période) ; chapitre 3031 : principe équivalent — *à vérifier*. En comptabilité de gestion, l'absorption de la capacité inutilisée est un vecteur classique de « spirale de la mort » : la baisse de volume hausse le coût, donc le prix plancher.

*Impact.* Démo : 2 521 $ (73 702,57 $ de coût complet absorbé vs 71 181,30 $ à capacité normale, `recalcul_resultats.json`), soit 3,4 % du coût complet ; jusqu'à +170 % unitaire en cas de baisse de volume de 75 %. Méthode : recalcul avec facteur = 1 (taux horaire plein) vs facteur de l'application.

*Recommandation.* Séparer coût de production et coût de sous-activité : `MO_unitaire = taux_horaire_plein × durée` ; `sous_activité_période = paie − coût_heures_nécessaires` présentée comme charge de période. Si l'absorption doit rester, borner : `facteur = clamp(utilisation ÷ capacité_normale, plancher, 1)` avec une capacité normale saisie (ex. moyenne pluriannuelle), et supprimer la discontinuité à 0 (`facteur = plancher` plutôt que 1).

*Effort.* Moyen.

### Constat 2 — Le « coût de revient » unitaire inclut l'administration, la vente et les frais financiers
**Gravité : Majeur (conditionnel à l'usage) — Confiance : élevée (faits)**

*Description et preuve.* `computeIndirectPools` répartit **toutes** les lignes de frais fixes (`analysisData.js:911-944`, `sumLineAmounts(expenseLines)`), quelle que soit leur catégorie (`utils.js:302-307`). Au démo : frais de production 12 000 $, vente 7 500 $, administration 7 500 $, financiers 1 000 $ (`initialState.js:260-268`) : 57 % du pool n'est pas du coût de production. Ces montants entrent dans `totalCostPerPortion` (`calculateCosts.js:352`).

*Référence.* IAS 2 : les frais d'administration non liés à la production, les frais de vente et les coûts d'entreposage non nécessaires au processus sont **exclus** du coût des stocks et passés en charges ; chapitre 3031 : principe analogue — *à vérifier*. Le coût complet à des fins de tarification est, lui, légitime.

*Impact.* Coût complet absorbé par les volumes du démo : 73 702,57 $ ; coût inventoriable indicatif (coût direct à capacité normale + frais de production seulement, sans frais de canal ni vieillissement) : 55 122,61 $ ; écart **18 579,95 $ (−25,2 %)**, composé de 16 000 $ de frais non productifs, ≈ 2 519 $ de capacité inutilisée (constat 1) et 60 $ d'intérêt de vieillissement. Méthode : `recalcul_independant.py`, variante `only_production_overhead` + `productivity_mode='normal'`.

*Recommandation.* Ajouter à chaque catégorie de frais un indicateur « inventoriable » (oui : frais généraux de production ; non : vente, administration, financiers) et produire deux vues : `coût_de_production = direct + frais_production × part_driver` (valorisation) et `coût_complet_gestion = coût_de_production + autres frais` (tarification). Nommer clairement chaque vue.

*Effort.* Moyen.

### Constat 3 — Sous-recettes : emballage et conditionnement imputés au parent ; MO et emballage classés en « matière »
**Gravité : Modéré — Confiance : élevée (mécanique), moyenne (impact, selon l'usage de la sous-recette)**

*Description et preuve.* Une sous-recette utilisée comme ingrédient apporte son coût direct **complet** (`calculateCosts.js:124` : `totalDirectCostPerPortion ÷ taille`), c'est-à-dire matière + **emballage** + **MO** + sous-traitance, puis ce total est inscrit dans `totalIngredientsCost` (`calculateCosts.js:140-153`) donc dans `costMatierePerPortion` (`calculateCosts.js:330`). Au démo, la purée (vendue en barquette de 250 g **et** utilisée dans les pâtés) transmet 0,5773 $ d'emballage et 0,1277 $ de MO de conditionnement par portion de purée (0,36 portion de purée par pâté 340 g). Conséquences : (a) si l'usage interne se fait en vrac, le pâté est surchargé de 0,2538 $/portion (+7,3 % du coût direct ; 0,6768 $ pour le format 900 g) ; (b) 2 336,06 $ de MO et 452,51 $ d'emballage apparaissent en « matière » (30 556 $ affichés contre 27 768 $ de matière réelle), ce qui fausse le pourcentage matière/MO/emballage et la ventilation des charges directes réelles par type (`analysisData.js:567-572, 578-592`).

*Référence.* Bonne pratique : coût de transformation séparé par nature ; coûts de conditionnement non encourus ne doivent pas être incorporés (IAS 2, coûts réellement encourus pour amener le stock à son état actuel).

*Impact.* Démo : 552,58 $ (452,51 emballage + 100,07 MO de conditionnement) imputés aux pâtés sur la période, **si** la purée est utilisée en vrac ; reclassement de 2 788,57 $ de « matière » vers MO/emballage. Méthode : `recalcul_independant.py`, champs `ing_sub_pack`, `ing_sub_lab`.

*Recommandation.* (i) Conserver la décomposition des coûts de la sous-recette (matière/emballage/MO/sous-traitance) et la propager aux postes correspondants du parent : `parent.MO += sous.MO_par_portion × portions_utilisées`. (ii) Permettre de désigner, par ligne d'ingrédient, le format « vrac » de la sous-recette (sans emballage) et avertir quand un format emballé est utilisé comme ingrédient.

*Effort.* Moyen.

### Constat 4 — Le vieillissement (coût de portage) d'une sous-recette n'est pas transmis au parent
**Gravité : Modéré — Confiance : élevée**

*Description et preuve.* Le prix d'une sous-recette comme ingrédient exclut le vieillissement (`calculateCosts.js:124` utilise `totalDirectCostPerPortion`, alors que `costAgingPerPortion` est un poste distinct, `calculateCosts.js:344-352`). Test E6 : purée à 12 %/6 mois → vieillissement 0,1248 $/portion ; coût complet du pâté inchangé (5,5976 $).

*Référence.* IAS 23 (coûts d'emprunt incorporables pour un actif exigeant une longue période de préparation, ex. affinage) et IAS 2 : si l'affinage est une étape de production, son coût doit suivre le produit dans le coût du parent — *à vérifier*. L'utilisation d'un taux saisi (et non du coût d'emprunt réel) est un choix de gestion acceptable.

*Impact.* Conditionnel (absent du démo) : 0,36 × 0,1248 = 0,0449 $/portion de pâté 340 g (+0,8 % du coût complet) pour le paramétrage testé.

*Recommandation.* Inclure `costAgingPerPortion` de la sous-recette dans `unitPrice` (`calculateCosts.js:124`) ou signaler à l'utilisateur que le portage d'une sous-recette n'est pas reporté.

*Effort.* Faible.

### Constat 5 — `nbPortions` stocké vs calculé par la grille de rendement
**Gravité : Modéré — Confiance : élevée (erreur objective, impact conditionnel)**

*Description et preuve.* Quand la grille de rendement est active, `calculateCosts.js:57-66` utilise la quantité **calculée** (par ex. 15,2), mais le champ stocké `fmt.nbPortions` n'est jamais mis à jour (`RecipeCalculator.jsx:734-737` l'affiche calculé, grisé, sans l'écrire). Trois consommateurs lisent la valeur **stockée** : les heures de MO (`laborHours.js:58,65`), le rapport d'achats/ABC (`analysisData.js:226`), et indirectement la productivité. Au démo : 46,65 stocké vs 46,648 calculé → 6,4 × 10⁻⁵ $ (c'est la source de l'écart unique du §4.1). Cas testé (E11, Tao à grille : stocké 20, calculé 15,2) : productivité 77,21 % au lieu de 79,02 %, achats prévisionnels 19 190 $ au lieu de 19 789 $ (−599 $, −3,0 %).

*Référence.* Bonne pratique : une seule source de vérité pour une quantité ; cohérence des calculs (étape 3 de la méthodologie).

*Recommandation.* Exposer `nbPortions` effectif (calculé) via une fonction unique (`effectiveNbPortions(fmt)` dans `yieldCalculator.js`) utilisée par `calculateCosts`, `laborHours`, `computePurchasingAndAbc` et le simulateur.

*Effort.* Faible.

### Constat 6 — Frais de canal partiellement non absorbés si un prix net ≤ 0 coexiste avec un volume
**Gravité : Modéré — Confiance : élevée**

*Description et preuve.* Le dénominateur du pool de canal inclut tout volume > 0 d'un canal connu (`analysisData.js:199-203`), mais `computeChannelBreakdown` écarte la ligne dont le prix net n'est pas > 0 (`calculateCosts.js:490`) : cette ligne ne reçoit jamais sa part. Test E7 : prix net du Tao en grandes surfaces mis à 0 avec son volume : pool de 3 544 $, **3 272,23 $ absorbés** ; 271,77 $ (7,7 %) disparaissent sans avertissement (le contrôle `missing-channel`, `projectChecks.js`, ne couvre que les canaux supprimés). Même type d'incohérence : `portionsSold` additionne les volumes de tous les canaux, y compris supprimés ou sans prix (`calculateCosts.js:270`), alors que les marges n'utilisent que les canaux valides.

*Référence.* Réconciliation : les frais répartis doivent égaler les frais à répartir (§3 de la méthodologie).

*Recommandation.* Construire le dénominateur et `portionsSold` sur le même ensemble que `channelBreakdown` (canal existant ET prix net > 0), ou compter l'écart dans un avertissement `projectChecks` (« volume sans prix »).

*Effort.* Faible.

### Constat 7 — Un SKU actif sans volume réel reçoit zéro frais fixes
**Gravité : Modéré — Confiance : moyenne (choix de conception documenté)**

*Description et preuve.* `portionsSold` reste `null` sans volume (`calculateCosts.js:273-278`) ; aucune part n'est imputée (`analysisData.js:1009`). La sauce à spaghetti du démo (actif, 12 % du mix manuel, volumes 0) affiche un coût complet de 4,4549 $ = son coût direct, aucune part de frais fixes. Le principe « donnée absente reste absente » est cohérent avec le reste du moteur, mais la marge affichée (prix 7,19 $) est celle d'un produit non chargé : indicativement, avec le même ratio frais fixes/coût direct que le reste du menu (28 000 ÷ 45 642 ≈ 61 %), ≈ 2,7 $/portion manquent.

*Recommandation.* Afficher « coût complet incomplet » sur ces lignes et les exclure des classements de rentabilité, ou imputer une part provisoire sur la base du mix.

*Effort.* Faible.

### Constat 8 — Quantités produites, rendements et tailles de portion non contrôlés par le moteur
**Gravité : Modéré — Confiance : élevée**

*Description et preuve.* `nbPortions` vide ou 0 → 1 (`calculateCosts.js:57`) ; taille de portion vide → 1 (`calculateCosts.js:118,354`) ; rendement de ligne vide → 100 % (`calculateCosts.js:141-144`) ; quantité négative acceptée (E5). Tests : `nbPortions` vide → Tao 62,46 $ au lieu de 3,31 $ (×18,9) ; `portionSize` = 0 sur la purée → pâté à 193,42 $ (au lieu de 5,60 $). L'interface met un champ en rouge (`RecipeCalculator.jsx:737`) sans bloquer ; `projectChecks` signale `portionSize` mais **pas** `nbPortions` vide. Il n'existe pas de contrôle de bilan-matières (quantité produite vs intrants) ni de distinction entre perte normale et anormale (la grille impose un taux de rejet unique : `yieldCalculator.js:21-22`) ; dans le démo les rapports sortie/intrants vont de 0,86 (chili) à 1,25 (soupe) — non concluant, l'eau ajoutée n'étant pas un intrant (annexe A1).

*Référence.* IAS 2 : les pertes **anormales** de matières, de main-d'œuvre ou de production sont passées en charges, non incorporées ; les pertes normales font partie du coût.

*Recommandation.* Refuser (ou signaler comme erreur bloquante) toute quantité ≤ 0 ; ajouter à `projectChecks` : `nbPortions` ≤ 0, quantités négatives, rendement hors [1 %, 150 %] ; distinguer « perte normale » (incluse) et « perte anormale » (charge de période) dans le modèle de rendement.

*Effort.* Faible (contrôles) à moyen (pertes anormales).

### Constat 9 — Boucle de sous-recettes : coût nul silencieux et cache dépendant de l'ordre
**Gravité : Modéré — Confiance : élevée**

*Description et preuve.* À la détection d'une boucle, `calculateCosts.js:30-42` retourne des coûts à 0 et un `console.error`. Ce résultat tronqué est ensuite mis en cache (`memo[fmt.id]`, `calculateCosts.js:405-407`) : le résultat d'un format dépend du point d'entrée. Test E3 (pâté 340 g ⇄ purée) : coût direct du pâté 2,1559 $ (au lieu de 3,4819 $) tandis que la purée passe de 2,0792 $ à 2,1108 $. L'interface n'empêche que l'auto-référence directe (`RecipeCalculator.jsx:323`) ; aucun contrôle `projectChecks` ne détecte un cycle indirect.

*Référence.* Étape 3 : récursivité des recettes imbriquées, boucles.

*Recommandation.* Détecter les cycles à la saisie et dans `projectChecks` ; ne pas mettre en cache un résultat issu d'une branche tronquée ; retourner `NaN`/`null` plutôt que 0 pour marquer le coût comme invalide.

*Effort.* Faible.

### Constat 10 — Répartition des frais fixes au prorata du coût direct (prix des matières comme moteur)
**Gravité : Modéré — Confiance : élevée (mécanique), jugement (conclusion)**

*Description et preuve.* Moteur par défaut `directCost` (`calculateCosts.js:241` ; `analysisData.js:131`) : la part d'un produit est proportionnelle à `coût direct × volume`. Un frais fixe (loyer, électricité) ne varie pas avec le prix d'achat des matières. Test S1 : +10 % sur le bœuf ne change ni le pool ni les volumes, mais déplace le coût des frais fixes : pâté 340 g de 2,1157 à 2,1804 $ (+3,1 %), Tao de 1,9948 à 1,9660 $ (−1,4 %). Les moteurs « temps de MO » et « volume physique » existent mais ne sont pas par défaut et reposent respectivement sur `durée × nombre de personnes` (`calculateCosts.js:251-255`) et sur la famille d'unités.

*Référence.* Bonne pratique ABC : choisir un inducteur de coût qui reflète la consommation de la ressource (heures-machine, surface, volume), sans lien avec le prix des intrants ; IAS 2 : base de répartition « systématique et rationnelle ».

*Recommandation.* Retenir par défaut un inducteur de capacité (heures de MO ou volume) pour les frais de production ; réserver `directCost` aux frais de nature proportionnelle à la valeur (assurance des stocks).

*Effort.* Faible (changement de défaut) à moyen (inducteurs supplémentaires).

### Constat 11 — Coût d'acquisition incomplet ; pas de méthode de valorisation ni de date de prix
**Gravité : Modéré — Confiance : élevée (absence constatée) ; moyenne (impact)**

*Description et preuve.* Le prix unitaire est `prix d'achat ÷ format` (`IngredientsTab.jsx:200`). Une recherche dans `src/` ne trouve ni transport à l'entrée, ni escompte, ni droits, ni taxes, ni devise, ni taux de change. Un seul prix courant par article : pas de PEPS, de coût moyen pondéré, de coût standard révisé ni d'historique daté ; `lastUpdated` ne sert qu'à un avertissement de 30 jours (`projectChecks.js:7`). Les recettes n'ont pas de version. Les « points de référence » (`trackingPoints`) sont des instantanés manuels.

*Référence.* IAS 2 : le coût d'acquisition comprend le prix d'achat, les droits et taxes non récupérables, le transport et la manutention, déduction faite des escomptes et rabais ; formules de coût autorisées : PEPS, coût moyen pondéré (coût standard acceptable s'il approxime le coût réel).

*Recommandation.* Permettre de saisir un « coût rendu » (prix − escomptes + transport + droits) avec les composantes visibles ; documenter dans l'écran que le prix saisi doit être **hors taxes récupérables** ; ajouter un historique des prix horodaté et une date d'effet par recette.

*Effort.* Moyen à élevé.

### Constat 12 — Pas d'analyse d'écarts ; l'écart réel–théorique n'est pas imputé
**Gravité : Modéré — Confiance : élevée**

*Description et preuve.* La réconciliation (`analysisData.js:775-811`) ne compare que revenus, charges directes, bénéfice brut et net, **en totaux**. Aucune décomposition en écart de prix, de quantité/rendement, d'efficience de la MO ou de volume ; l'écart n'est imputé à aucun produit. Au démo : 2 357,67 $ de charges directes réelles non expliquées par le théorique (+5,2 %) et, par nature, des écarts de signes opposés qui se compensent (matière +14,5 %, MO −15,9 %).

*Référence.* Coût standard : analyse d'écarts (prix, quantité, efficience, volume) et traitement (imputation aux stocks ou aux coûts des ventes).

*Recommandation.* Pour chaque nature de coût, calculer `écart_prix = (prix_réel − prix_standard) × qté_réelle` et `écart_quantité = (qté_réelle − qté_standard) × prix_standard`, puis présenter l'écart par nature (et non seulement total) ; décider du traitement (charge de période par défaut).

*Effort.* Moyen.

### Constat 13 — Coproduits et sous-produits non pris en charge
**Gravité : Modéré (majeur pour la découpe/abattage) — Confiance : élevée**

*Description et preuve.* Aucun mécanisme d'allocation des coûts conjoints ni de crédit de sous-produit : une perte de catalogue a une valeur de récupération nulle (`calculateCosts.js:135-139`). Limite connue du projet (memory : « Deferred: joint-cost allocation »).

*Référence.* Allocation des coûts conjoints par valeur de marché relative ou valeur nette de réalisation ; sous-produits à la VNR en réduction du coût principal.

*Recommandation.* Prévoir un « produit co-généré » à la recette (quantité, valeur de marché) avec allocation par valeur relative au point de séparation.

*Effort.* Élevé.

### Constat 14 — Arrondis, unités et périodes : règles implicites
**Gravité : Mineur — Confiance : moyenne à élevée**

*Description.* (a) Arithmétique en virgule flottante IEEE-754, sans arrondi des coûts unitaires ; seules les allocations de frais fixes sont arrondies au cent (`analysisData.js:50-78`) avec un seuil d'ajustement de 0,05 $ (`analysisData.js:928`). Aucun écart de bouclage mesuré (écarts de 0,0000 $ aux contrôles §4.2) ; la règle d'arrondi n'est pas documentée à un endroit unique. (b) Conversion masse↔volume à densité 1, sans densité par ingrédient (`utils.js:256`) ; avertie par `projectChecks` (`unit-mismatch`) mais non bloquée. Pas de poids variable. (c) Aucune normalisation temporelle automatique entre heures de MO, frais fixes et volumes (période de référence de l'état des résultats informative) — *non vérifié* en interface. (d) Formule de taux de MO répétée à trois endroits (`calculateCosts.js:169`, `App.jsx:299,338`, `analysisPipeline.js:15`) : risque de divergence future. (e) Taux de MO : facteur multiplicatif `(1+charges)(1+vacances)` — choix discutable mais défendable si les charges s'appliquent à la paie de vacances ; ni heures supplémentaires ni temps d'installation/nettoyage distincts (modélisables comme étapes).

*Recommandation.* Documenter la règle d'arrondi ; centraliser le taux chargé dans une fonction ; ajouter une densité optionnelle par ingrédient ; ajouter un contrôle de cohérence des périodes.

*Effort.* Faible.

### Constat 15 — Gouvernance : piste d'audit, historisation, accès, sauvegarde
**Gravité : Mineur à modéré — Confiance : élevée (constat), moyenne (portée)**

*Description et preuve.* Persistance par fichier JSON local sans sauvegarde automatique (« L'app n'a pas de sauvegarde automatique », `App.jsx:880`) ; aucun journal des modifications (qui, quand, ancienne/nouvelle valeur), aucun contrôle d'accès ni séparation des tâches (application mono-poste), aucune version de recettes ni de prix, historique limité aux relevés manuels (`SummaryTable.jsx:1204`). La migration des anciens projets est testée (`projectSerialization.test.js`, 32 tests). Contrôles de saisie présents mais non bloquants (champ en rouge). Panneau « Points à vérifier » (`projectChecks.js`) : bonne pratique, à étendre (constats 6, 8, 9).

*Référence.* Contrôles généraux (piste d'audit, gestion des changements).

*Recommandation.* Journal d'événements horodaté dans le fichier de projet ; sauvegarde automatique avec rotation ; versionnage des recettes et des prix ; signature d'intégrité (empreinte) du fichier de projet.

*Effort.* Moyen à élevé.

---

## 6. Points forts constatés
- Arithmétique exacte et reproductible : recalcul indépendant à 6 × 10⁻⁵ $ près ; bouclages parfaits (frais fixes, paie, bénéfice net).
- Moteur pur, séparé de l'interface, testé (356 tests) ; formule de conversion d'unités unique (`utils.js:256`) ; constantes de conversion exactes (gallons US/impérial distingués).
- Évite le double comptage des frais fixes pour les sous-recettes (seul le coût direct est transmis, `calculateCosts.js:119-124`) ; heures de MO des sous-recettes jamais vendues comptées (`laborHours.js`).
- Principe « une donnée absente reste absente » appliqué avec constance ; agrégations pondérées par le revenu (évite le paradoxe de Simpson, `analysisData.js:292-302`).
- Panneau de contrôles d'intégrité qui détecte références manquantes, unités incompatibles, pertes ≥ 100 %, canaux dupliqués/supprimés, frais fixes non répartis (`projectChecks.js`).
- Frais fixes non répartis jamais perdus (basculés dans Général et signalés, `analysisData.js:925-933`).
- Séparation matière / emballage / MO / sous-traitance / vieillissement ; réconciliation réel/théorique présente.

---

## 7. Plan d'action priorisé

| Prio | Constats | Action | Gravité | Impact | Effort | Échéance |
|---|---|---|---|---|---|---|
| 1 | 1, 2 | Introduire le coût « inventoriable » (frais de production, capacité normale) distinct du coût complet de gestion ; renommer les vues | Majeur | 18 580 $ (25 %) du coût absorbé au démo | Moyen | Court (1-2 mois) |
| 2 | 5 | Fonction unique `effectiveNbPortions` | Modéré | −3 % achats (cas testé) | Faible | Court |
| 3 | 6 | Aligner dénominateurs de pool/volume sur `channelBreakdown` + avertissement | Modéré | 7,7 % du pool de canal (cas testé) | Faible | Court |
| 4 | 8, 9 | Contrôles bloquants : quantités ≤ 0, cycles indirects ; ne pas mettre en cache une branche tronquée | Modéré | ×18,9 / coûts faux | Faible | Court |
| 5 | 3, 4 | Propager la décomposition des coûts et le vieillissement des sous-recettes ; format « vrac » | Modéré | 552,58 $ ; 2 789 $ reclassés | Moyen | Moyen (3-6 mois) |
| 6 | 10 | Défaut `laborTime`/`volume` pour les frais de production | Modéré | ±3 % d'allocation | Faible | Moyen |
| 7 | 12 | Analyse d'écarts par nature | Modéré | 2 358 $ (+5,2 %) | Moyen | Moyen |
| 8 | 11, 15 | Coût rendu, historique des prix, versions, journal, sauvegarde | Modéré | non quantifié | Moyen-élevé | Long (6-12 mois) |
| 9 | 7, 14 | Marquer les coûts incomplets ; densités ; règle d'arrondi | Mineur | — | Faible | Moyen |
| 10 | 13 | Coproduits (si usage découpe/abattage) | Modéré | — | Élevé | Long |

---

## 8. Cas de tests recommandés

Entrée / résultat attendu / justification. Toutes les valeurs « attendues » sont à produire par le script `audit/recalculs/recalcul_independant.py` après correction.

| # | Entrée | Résultat attendu | Justification |
|---|---|---|---|
| T1 | Volume du démo ×0,25, capacité normale = volume du démo | MO du Tao = 0,6369 $ ; sous-activité de période = paie − heures nécessaires ; coût de production inchangé quelle que soit la baisse de volume | IAS 2 : capacité normale (constat 1) |
| T2 | Volume = 0 partout | Aucun saut de coût vs volume 0,5 % ; coût unitaire défini (taux plein) | Continuité du modèle |
| T3 | Catégorie « Administration » 7 500 $ marquée non inventoriable | Coût de production sans cette part ; coût complet de gestion avec | IAS 2 (constat 2) |
| T4 | Grille de rendement : stocké 20, calculé 15,2 | Heures de MO, achats, coûts utilisent 15,2 ; productivité 79,02 % | Source unique (constat 5) |
| T5 | Prix net 0 avec volume 675 sur un canal | Σ absorbé = pool (3 544 $) ou avertissement explicite | Réconciliation (constat 6) |
| T6 | Sous-recette vieillie 12 %/6 mois utilisée dans un pâté | Pâté +0,0449 $/portion (0,36 × 0,1248) | Constat 4 |
| T7 | Purée emballée utilisée comme ingrédient | Avertissement ; avec format vrac : pâté sans les 0,2538 $/portion d'emballage et de conditionnement | Constat 3 |
| T8 | Boucle A→B→A | Erreur explicite ; aucun coût partiel en cache ; mêmes résultats quel que soit le point d'entrée | Constat 9 |
| T9 | `nbPortions` vide, quantité négative, rendement 0 | Refus ou erreur bloquante ; jamais de substitution silencieuse par 1 | Constat 8 |
| T10 | +10 % du prix du bœuf avec inducteur « heures de MO » | Coût de frais fixes des autres produits inchangé | Constat 10 |
| T11 | Coût rendu : 100 $ − 5 % escompte + 8 $ transport | Prix unitaire = 103 $ ÷ format | IAS 2 (constat 11) |
| T12 | Réel vs standard : matière 31 800 $ vs 27 768 $ | Écart de prix et de quantité présentés séparément, total 4 032 $ | Analyse d'écarts (constat 12) |

---

## 9. Annexes

- **A1** — Détail des recalculs : `audit/annexes/recalcul_resultats.md` et `.json` ; sorties de l'application : `app_output_demo.json`, `app_output_edgecases.json`, `app_output_complements.json` ; données d'entrée : `demo_inputs.json` ; scripts : `audit/recalculs/recalcul_independant.py`, `audit/recalculs/harness_app.test.js`.
- **A2** — Inventaire des valeurs codées en dur : `audit/annexes/A2_valeurs_codees_en_dur.md`.
- **A3** — Questions en suspens et éléments non vérifiés : `audit/annexes/A3_questions_en_suspens.md`.
- Journal : `audit/journal_audit.md`.

Reproduction : `npx vitest run audit/recalculs/harness_app.test.js` puis `python -I audit/recalculs/recalcul_independant.py`.
