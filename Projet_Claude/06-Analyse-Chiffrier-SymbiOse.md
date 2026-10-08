# Analyse du chiffrier « Coût de revient_SymbiOse.xlsx »

Chiffrier personnel de l'utilisateur (17 feuilles), soumis comme référence « version ++ » à
reproduire. Lu intégralement (structure, formules et valeurs mises en cache). Ce document
consigne les trouvailles et leur impact sur `04-Conception-Modele.md` et
`03-Feuille-de-route.md`.

## État du fichier

Le fichier **n'est pas corrompu** au sens où l'utilisateur le craignait. Les seules erreurs
détectées (1 719 `#DIV/0!` dans « Rapport - Coût Revient unit. », 189 dans « Rapport - Marges »)
proviennent toutes de la même cause bénigne : la grille produit × canal couvre 12 canaux de vente,
mais la plupart des 30 SKU ne se vendent que par 2 à 4 d'entre eux. Les colonnes non utilisées ont
un prix à 0 $, ce qui déclenche une division par zéro dans les cellules de marge — un artefact de
structure de grille, pas une perte de données. **Leçon retenue pour l'app** : le moteur doit
traiter « ce format n'est pas vendu par ce canal » comme une valeur absente (N/A), jamais comme un
calcul à forcer — RestoCalculateur le fait déjà correctement ailleurs (ex. `prixVente > 0 ? … : 0`).

## Structure générale (17 feuilles)

`1-Produits` → `2-Ingrédients` + `3-Emballage` + `4-Main-d'œuvre` → `Coût Prod.` (bloc répété par
SKU) → `Rapport-Coût de Production` (rollup) → `5-Canaux de ventes` + `6-Rep. charges fixes` +
`7-Frais de mise en marché` + `8-Frais d'expédition` + `9-PDS` + `10-Marges détails` +
`11-Ventes par canaux` → `Rapport-Capacité de prod` + `Rapport-Coût Revient unit.` (le rapport
final, combine tout) → `Rapport-Marges` (dashboard final).

## Trouvailles majeures et leur impact

### 1. Confirmation forte : SKU = Ligne de production + Catégorie + Produit + **Format**

La feuille « 1 - Produits » a exactement la structure qu'on avait décidée : un code SKU
(`TEM-01-TU`) composé de la ligne de production (Tempeh/Koji/Lacto), une catégorie, le nom du
produit, et une colonne **Format** séparée (« 220 g », « Kg », « 4 litres », « Baril 200 L »...).
**Valide directement** la décision « vrai système de formats » (recette mère + formats).

### 2. Circuits de vente : modèle réel plus simple que celui qu'on a conçu

Le chiffrier n'a **pas** de chaîne séquentielle d'intermédiaires (producteur→courtier→
distributeur→détaillant, chacun éditable). Le modèle réel, à seulement deux étages :
- **Prix de détail suggéré (PDS)** : saisi **directement**, par produit × canal (pas calculé).
- **Marge du détaillant (%)** : uniquement pour les canaux « Vente au détail », un seul niveau.
  Le prix que touche l'entreprise se déduit : `Prix de vente = PDS × (1 − marge détaillant)` —
  confirme l'usage correct de « marge sur le prix de vente » (pas un markup sur le coût).
- **Frais de mise en marché** (courtage/commission, distribution, facturation) : trois % **additionnés**
  (pas cascadés), appliqués sur le prix de vente de l'entreprise (pas sur le PDS).
- **Frais d'expédition** : un montant $/unité saisi directement par produit × canal (pas calculé).

**Recommandation** : simplifier notre modèle de circuits vers cette structure à deux étages
(PDS + marge détaillant optionnelle → prix net → déductions de mise en marché → + expédition),
plutôt qu'une chaîne à N maillons complètement génériques. C'est prouvé par un usage réel,
plus simple à comprendre pour un entrepreneur non-CPA, et couvre le besoin exprimé (courtier,
distributeur, marge détaillant) sans la complexité d'une cascade à maillons illimités. *Décision
à reconfirmer avec l'utilisateur — voir section Propositions ci-dessous.*

### 3. Répartition des charges fixes : DEUX axes, pas un seul — et par montant $ direct, pas par %

Confirme et **élargit** la décision « activité de production » du 22/09 : la feuille
« 6 - Rep. charges fixes » répartit chaque compte de dépense (catégorisé en Frais d'exploitation /
d'administration / financiers) sur **deux axes simultanés** : par **ligne de production**
(colonnes D-H) ET par **canal de vente / mise en marché** (colonnes I-T, Vente directe puis Vente
au détail) — plus une colonne « Général » pour les frais non attribuables. **La répartition se
fait par saisie manuelle du montant $ dans la bonne colonne** (pas par % via une clé de
répartition), avec une colonne « VÉRIFICATION » qui confirme que la somme des colonnes égale le
montant total. C'est plus simple à comprendre qu'une clé en % pour un non-comptable.

Le rapport final combine ensuite **trois composantes de charges fixes par unité** :
- Charges fixes **générales** : pool « Général » × (part des ventes du produit) ÷ (son propre
  volume) — équivalent à notre méthode « au prorata des ventes ».
- Charges fixes **spécifiques à la ligne de production** : pool de la ligne ÷ (capacité de
  production utilisée par cette ligne, en heures) — équivalent à notre méthode « au prorata du
  temps de production », mais calculée pour la ligne entière, pas juste le produit.
- Charges fixes **spécifiques au canal de vente** : pool du canal × (part du produit dans le
  volume de CE canal) ÷ (son volume dans ce canal) — un troisième niveau d'allocation, propre au
  canal, absent de notre conception initiale.

**Impact sur Phase 4 (Frais fixes)** : ajouter l'allocation par **canal de vente**, pas
seulement par activité de production, et privilégier une **saisie manuelle du montant $ par
compte** (avec vérification automatique du total) plutôt qu'une clé en %, comme méthode principale
— plus intuitive pour un entrepreneur non-CPA. Une clé en % peut rester disponible comme raccourci
optionnel (bouton « répartir également » ou « répartir selon les ventes » qui pré-remplit la
grille, modifiable ensuite).

### 4. Sous-traitance : nouvelle catégorie de coût direct

La fiche de coût de production (« Coût Prod. ») a une section dédiée « SOUS-TRAITANCE »
(sous-traitant, opération sous-traitée, coût), distincte des ingrédients/emballage/main-d'œuvre,
incluse dans le coût de production variable total. **À ajouter** au modèle de recette (Phase 1 ou
2) comme un poste de coût de plus, pour les entreprises qui font faire une partie de leur
transformation à l'externe.

### 5. Rendement et rejets : plus simple que prévu, et en deux temps distincts

- **Rendement** = poids/volume final obtenu ÷ quantité totale de matières premières — calcul
  **à une seule étape** (pas la grille en cascade à plusieurs pertes qu'on avait empruntée au
  MAPAQ). Plus simple, probablement suffisant.
- **Produits rejetés** vs **produits finis** : un taux de rejet appliqué **après production**
  (produits finis = production totale − rejetés), distinct de la perte matière. Le coût unitaire
  se calcule sur les produits finis seulement (le rejet est absorbé par les bonnes unités, même
  principe que la perte matière mais à une étape différente du processus).

**Impact sur Phase 1** : simplifier la « grille de rendement de transformation » prévue vers ce
modèle à deux calculs simples (rendement matière→produit, puis taux de rejet des produits finis)
plutôt que la cascade multi-étapes du MAPAQ.

### 6. Capacité de production par ligne — confirme le besoin, précise le calcul

« Rapport - Capacité de prod » calcule, par SKU : ventes anticipées ÷ unités par lot = nombre de
lots nécessaires × temps de production par lot = heures nécessaires ÷ heures MO disponibles = %
de capacité utilisée — puis agrège ce % **par ligne de production** (tableau croisé). C'est
l'équivalent, par ligne de production plutôt que par poste, du `productivityReport` déjà présent
dans RestoCalculateur. **Impact** : étendre ce rapport existant pour grouper aussi par activité de
production, plutôt que de construire quelque chose de nouveau.

### 7. Main-d'œuvre : heures payées vs heures travaillées, détaillées par cause

La feuille « 4 - Main-d'œuvre » décompose les heures payées en heures **réellement travaillées**
en soustrayant explicitement vacances, congés fériés, pauses (30 min/jour) et un temps improductif
estimé (NVA, 30 min/jour) — plutôt qu'un seul pourcentage global comme le `productiveTimePercentage`
actuel de RestoCalculateur. **Raffinement mineur, non prioritaire** : on pourrait décomposer ce
pourcentage en composantes nommées pour plus de clarté, mais ce n'est pas structurant — à
considérer seulement si le temps le permet.

## Propositions de modification au plan de match

1. **Simplifier le modèle de Circuits de vente (Phase 5)** vers la structure à deux étages
   validée par l'usage réel (PDS + marge détaillant optionnelle → prix net → frais de mise en
   marché → + expédition), plutôt que la cascade à N maillons entièrement génériques décidée le
   22/09. *Décision à reconfirmer avec l'utilisateur.*
2. **Élargir l'allocation des charges fixes (Phase 3)** à deux axes — ligne de production ET
   canal de vente — avec saisie manuelle du montant $ par compte (+ vérification automatique)
   comme méthode principale plutôt qu'une clé en %.
3. **Ajouter la Sous-traitance** comme poste de coût direct dans le modèle de recette (Phase 1
   ou 2).
4. **Simplifier la grille de rendement** (Phase 1) vers un calcul à deux étapes (rendement
   matière→produit, taux de rejet des produits finis) plutôt que la cascade multi-pertes du MAPAQ.
5. **Étendre le rapport de productivité existant** (déjà dans RestoCalculateur) pour grouper par
   activité de production, plutôt que de construire un nouveau rapport de capacité.
6. Ajouter un champ **SKU** explicite par format (auto-généré, éditable) — confirmé comme pratique
   professionnelle standard par le chiffrier réel.
