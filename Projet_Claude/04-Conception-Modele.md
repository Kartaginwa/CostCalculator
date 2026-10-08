# Conception du modèle — version approfondie

Ce document remplace la vision simplifiée du 22/09 (« groupe de produits ») par un modèle plus
complet, suite aux précisions de l'utilisateur et à l'analyse des deux chiffriers d'inspiration
(MAPAQ, SymbiOse — voir `01-Analyse-Besoins.md` et `06-Analyse-Chiffrier-SymbiOse.md`). **Statut :
validé.** Ce document reflète le modèle final.

**Principe méthodologique retenu** : ni le MAPAQ ni le chiffrier SymbiOse ne sont reproduits tels
quels — les deux sont des sources d'inspiration. Pour chaque décision de méthode, la question est
« quelle est l'approche la plus juste sur le plan du calcul », puis « comment la rendre utilisable
par un entrepreneur non-CPA » — jamais l'inverse. La qualité de l'app se mesure à la justesse de
ses calculs et à la souplesse de son approche, pas à sa simplicité apparente.

**Principe UI/UX transversal** : ce principe s'applique à toutes les phases, pas à une seule.
Chaque nouvel écran doit être au moins équivalent, idéalement meilleur, que le reste de l'app en
qualité visuelle et en expérience. Une bonne idée introduite dans une phase (un patron
d'interaction, une façon de présenter un calcul) doit être évaluée pour propagation aux écrans
existants plutôt que de rester isolée. Une phase dédiée (Phase 7, voir `03-Feuille-de-route.md`)
revalide l'ensemble de l'app une fois tout construit.

## Entités du modèle

### 1. Activité de production *(nouvelle entité, remplace « groupe de produits »)*

Terminologie alignée sur le MAPAQ à la demande de l'utilisateur. Une activité de production
regroupe des produits qui partagent une même ligne de fabrication (ex. « Confitures »,
« Produits séchés », « Mises en conserve »). Chaque produit est rattaché à **une** activité.

L'activité de production est le point d'ancrage de **deux** mécanismes :
- **Allocation des dépenses de l'entreprise** (section Frais fixes) : chaque poste de dépense
  catégorisé est réparti — sur **deux axes**, par activité de production ET par canal de vente
  (validé par le chiffrier SymbiOse, voir `06-Analyse-Chiffrier-SymbiOse.md`) — selon la méthode
  choisie pour ce poste : une **clé de répartition prédéfinie** (au prorata des ventes, du temps
  de main-d'œuvre, des charges directes), une **clé personnalisée créée par l'utilisateur**
  (comme dans le MAPAQ : on nomme la clé et on lui définit ses propres pourcentages par activité/
  canal), ou un **montant manuel** saisi directement quand l'entrepreneur connaît exactement la
  somme à attribuer (comme le permet déjà le MAPAQ à l'Étape 7 de son guide). Langage concret dans
  l'UI, jamais « CICI » ou jargon comptable.
- **Conversion du pool d'indirects de l'activité en un taux par produit** : une fois qu'une
  activité connaît son pool de frais indirects, ce pool est reconverti en un taux par produit
  selon une méthode choisie **pour cette activité** (au prorata des ventes du produit, de son
  temps de main-d'œuvre, ou de son coût direct) — c'est la méthode déjà présente dans RestoCalculateur,
  simplement appliquée par activité plutôt que globalement pour toute l'entreprise.

**Catégories de frais — nécessaires, pas juste pour se repérer.** Chaque poste de dépense de
l'état de résultats appartient à une catégorie, qui a deux effets concrets (pas seulement
organisationnels) : (1) elle suggère un **axe d'allocation par défaut**, sans l'imposer — un frais
de vente n'a normalement aucune raison de se répartir entre les lignes de production, un frais
général de production n'a normalement aucune raison de se répartir entre les canaux, mais rien
n'empêche une exception manuelle (ex. un loyer partiellement dédié à une ligne, comme dans le
chiffrier SymbiOse) ; (2) elle permet un **rapprochement propre avec un état des résultats
comptable réel**, nécessaire pour l'assistant d'import (voir `05-Imports-Integrations.md`) et pour
un tableau de bord type « d'où viennent mes coûts ». Quatre catégories retenues :

| Catégorie | Axe suggéré par défaut |
|---|---|
| Frais généraux de production | Général ou Activité de production |
| Frais de vente / mise en marché | Général ou Canal de vente |
| Frais d'administration | Général (ventilable manuellement si pertinent) |
| Frais financiers | Général (rarement rattachable à une ligne/canal) |

C'est un modèle à **deux étages** (entreprise → activités/canaux → produits), fidèle au MAPAQ,
mais présenté avec un vocabulaire métier et une réconciliation exacte automatique (pas de
vérification manuelle ±10 % comme chez MAPAQ) — avec, en prime, la vérification en temps réel du
total réparti (comme la colonne « VÉRIFICATION » du chiffrier SymbiOse).

### 2. Packaging *(nouveau module, PAS un ingrédient)*

- Catalogue séparé `basePackaging` (miroir structurel de `baseIngredients` : fournisseur, format
  d'achat, unité, prix, perte %).
- Dans l'onglet Recette & Calcul : une **section dédiée**, visuellement et structurellement
  distincte de la section Ingrédients (même table de rendu, autre en-tête, autre couleur de
  section — comme les sections actuelles Ingrédients/Main-d'œuvre/Indirects). Rattachée au
  **format de vente** (voir section 2bis), pas directement à la recette mère, puisque chaque
  format a son propre emballage.
- Poste de coût **séparé** dans `calculateCosts.js` : `totalPackagingCost` /
  `costPackagingPerPortion` / `costPackagingPercent`, jamais fusionné dans le coût matière.
- Le récapitulatif de recette affichera donc 4 % (et non 3) : matière, **emballage**,
  main-d'œuvre, indirects — chacun comme part du coût de revient total, calculé par format.

### 2bis. Recette mère et formats de vente *(décision : vrai système de formats)*

Un **produit** (la recette) est un **regroupement organisationnel** (nom, catégorie, ligne de
production) qui rassemble un ou plusieurs **formats de vente** apparentés — ex. « Confiture de
fraises » → formats 250 ml et 500 ml. C'est le format, pas le produit, qui est l'unité réelle de
coûtation : chaque format porte sa **propre fiche recette complète et autonome** — ingrédients,
étapes de production/main-d'œuvre, rendement, sous-traitance/vieillissement, prix, mix des ventes,
statut revente. Deux formats du même produit peuvent avoir des ingrédients et des étapes de
fabrication entièrement différents.

**Vocabulaire précisé le 04/10 (retour utilisateur) : le format n'est pas le SKU.**
- **Format** = l'emballage et la quantité (ex. « 250 ml », « 1 kg »). C'est l'attribut qu'une
  personne choisit, et c'est la continuité directe de ce qui existait déjà dans RestoCalculateur
  sous le nom de « quantité par portion » (`portionSize`/`portionUnit`) — pas un concept ajouté en
  parallèle.
- **SKU** = un numéro/code de référence **dérivé** de la recette + du format (ex. SymbiOse :
  `TEM-01-TU` = ligne + catégorie + produit + **format**). Ce n'est pas une donnée saisie
  indépendamment ; il se génère automatiquement (`buildFormatSku`, combine le nom du produit et le
  format) et reste librement modifiable ensuite.
- Implication concrète : le format (quantité + unité) s'édite dans **Paramètres → Produits et
  SKUs** (nouvelle colonne Format) ; Recette & Calcul affiche le format — pas le SKU — comme
  étiquette de ses onglets, et ne garde plus de champs « Quantité par portion »/« Unité » séparés
  (c'était le format en double). Voir Phase 1.5quater dans `03-Feuille-de-route.md`.

**Décision tranchée le 23/09, après un premier essai erroné.** L'idée initiale — un seul lot de
recette mère partagé, avec son coût réparti entre formats au prorata du rendement de chacun — a
été abandonnée en cours d'implémentation : elle aurait fait porter à CHAQUE format 100 % du coût
du lot (comme si chaque format était fabriqué en lot séparé), une double comptabilisation dès
qu'un produit a plus d'un format actif. Confirmé sans ambiguïté par l'analyse du chiffrier
SymbiOse (`06-Analyse-Chiffrier-SymbiOse.md`, trouvaille n°1) : la feuille « Coût Prod. » y est un
**bloc répété par SKU**, chacun avec ses propres quantités de matières premières et son propre
rendement (poids/volume final obtenu ÷ matières premières engagées, puis un taux de rejet des
produits finis) — pas un lot commun réparti après coup. Confirmé également par « Rapport -
Capacité de prod », qui calcule les lots nécessaires **par SKU** : chaque SKU tourne ses propres
lots de production, il n'y a pas de lot partagé à l'échelle du produit. Le modèle retenu supprime
donc tout besoin d'allocation de coût entre formats : chaque format calcule son coût en entier,
à partir de sa propre liste.

Chaque format a également :
- un **code SKU dérivé** (auto-généré à partir de la recette + du format, éditable) — pratique
  professionnelle confirmée par le chiffrier SymbiOse (`LIGNE-CATEGORIE-PRODUIT-FORMAT`) ;
- son propre **emballage** (module Packaging, à venir — recoupe directement la notion de format) ;
- ses propres **prix par circuit de vente** (section 3, à venir).

C'est le changement le plus structurant du projet : il touche `products` (regroupement +
`formats[]`, chacun avec sa fiche recette), `calculateCosts.js` (coût calculé entièrement à partir
du format), et tous les écrans qui affichent un produit (Recette & Calcul, Résumé, Suivi, rapports,
POS import). **Fondation à construire en premier**, avant Packaging et Frais fixes, puisque ces
deux modules s'y rattachent.

**État d'implémentation (Phases 1.3-1.5 + correctifs du 23/09, terminées) :**
`products[i].formats[]` existe, chaque format porte sa propre fiche recette (`ingredients`,
`productionSteps`, `isResaleProduct`, `purchaseCost`, `manualAllergens` — déménagés du produit vers
le format ; `stripFormatOwnedFields`/`buildDefaultFormat` dans `initialState.js`), et
`calculateCosts.js` lit tout depuis le format sélectionné (voir `03-Feuille-de-route.md`).
**Répartition des responsabilités entre écrans** : la **gestion** des formats — création,
duplication, suppression, SKU, prix, mix des ventes, au menu — se fait dans **Paramètres →
Produits et SKUs** (`ProductInfo.jsx`), qui affiche une ligne par format/SKU, comme la feuille
« 1 - Produits » du chiffrier SymbiOse ; c'est là qu'on ajoute un format à un produit, pas dans
Recette & Calcul. `RecipeCalculator.jsx` garde un **sélecteur** de format (onglets cliquables) et
sert à éditer le détail d'un format déjà créé — recette, coûts, rendement,
sous-traitance/vieillissement. **Stratégie de transition délibérée** (limitée aux champs de
vente) : tant que les autres écrans (Résumé, Suivi, rapports, import POS) ne lisent pas encore
`formats[]` directement, éditer le format PAR DÉFAUT (index 0) — depuis Paramètres ou Recette &
Calcul — met aussi à jour en miroir les champs « à plat » historiques du produit (`prixVente`,
`nbPortions`, `portionSize`, `portionUnit`, `salesMix`, `onMenu`, constante partagée
`FORMAT_FLAT_MIRROR_FIELDS` dans `utils.js`) — ces écrans restent donc corrects sans modification.
Ce miroir ne s'applique **pas** à la fiche recette (ingrédients/étapes/revente) : celle-ci n'a
jamais existé « à plat » sur le produit dans les écrans non encore convertis, donc rien à y
mettre en miroir. Un format additionnel (au-delà du premier) n'apparaît que dans Paramètres et
Recette & Calcul jusqu'à la Phase 1.6, qui étendra tous les écrans consommateurs à `formats[]` et
pourra alors retirer le miroir des champs de vente. Le format par défaut (index 0) ne peut pas
être supprimé tant qu'il reste d'autres formats, précisément parce qu'il alimente ce miroir.

**Restructuration UI (Phase 1.5ter, terminée le 24/09) :** Paramètres → Produits et SKUs est une
vue groupée par recette (une section par produit, contenant la liste de ses formats). Recette &
Calcul a un sélecteur de format restylé (onglets soulignés, même langage visuel que la barre de
navigation principale), un bouton pour ajouter un format via une fenêtre modale (`AddFormatModal`,
dont les changements s'appliquent directement dans Paramètres — même état central, pas de copie,
via les gestionnaires `onAddFormat`/`onDuplicateFormat` partagés), et des contrôles « copier depuis
un autre format » (`CopyFromFormatControl`) à même chaque section (nombre d'unités/rendement,
ingrédients, production, coûts additionnels), invisibles s'il n'y a qu'un seul format. Le bouton
« dupliquer le format en bloc » qui vivait dans Recette & Calcul a été retiré de cet écran ; la
copie complète (« copier à la base ») reste offerte, mais seulement à la création d'un nouveau
format via la fenêtre modale.

**Correction de terminologie (Phase 1.5quater, terminée le 04/10) :** voir l'encadré « Vocabulaire
précisé le 04/10 » plus haut. En bref : le sélecteur et la modale affichaient le SKU comme
attribut principal alors que le format (quantité/unité) aurait dû l'être — corrigé sans toucher
`calculateCosts.js` ni aucune structure de calcul. Voir `03-Feuille-de-route.md` pour le détail des
deux sous-étapes.

### 3. Circuit de vente *(section Paramètres, au-delà du prix multiple)*

**Placement UI revu le 05/10** (suggestion de l'utilisateur) : un circuit de vente joue le même
rôle structurel qu'une activité de production (`productionActivities`, section 1) — une entité de
référence courte, modifiée occasionnellement, consommée par d'autres écrans. Géré dans **Paramètres**
(nouvelle section, juste après Activités de production), pas dans un onglet dédié comme envisagé
initialement. Le rattachement prix net/volumes par format × circuit s'ajoute à la section Produits
et SKUs existante, là où vivent déjà `prixVente`/`salesMix`/`onMenu` par format.

Un circuit n'est plus juste « un prix différent » — c'est une **chaîne de mise en marché** avec
des maillons (rôles) qui prennent chacun une marge :

```
Coût de revient (producteur)
   ↓ (marge du producteur)
Prix net producteur  ──────────────┐
   ↓ (commission courtier, si applicable)
   ↓ (marge distributeur, si applicable)
   ↓ (marge détaillant, si applicable)
Prix de vente suggéré au consommateur (PDSF)
```

- Chaque circuit est composé d'une liste ordonnée de **maillons** (ex. Producteur → Courtier →
  Distributeur → Détaillant → Consommateur), configurable par circuit — un circuit « Vente
  directe à la ferme » n'a qu'un maillon ; un circuit « Grande distribution » peut en avoir 3-4.
- Chaque maillon calcule sa marge/markup en % **sur le prix payé au maillon précédent**
  (cascade standard du commerce de détail — décision : pas de base configurable par maillon,
  pour rester simple et compréhensible).
- Distinction **markup vs marge** rendue explicite dans l'UI à chaque maillon (erreur classique :
  un markup de 30 % sur le coût ≠ une marge de 30 % sur le prix de vente) — l'outil doit calculer
  et étiqueter clairement les deux pour éviter la confusion à un entrepreneur non-CPA.
- **Cascade éditable à n'importe quel maillon** (décision) : l'utilisateur peut modifier le prix
  ou la marge à n'importe quel niveau de la chaîne (coût de revient, prix net producteur, prix
  courtier, prix distributeur, prix détaillant, prix consommateur) et les autres valeurs se
  recalculent automatiquement en respectant les % de marge définis — que l'entrepreneur parte
  d'un coût connu ou d'un prix tablette visé (ex. concurrence). Implémentation : un seul maillon
  « actif » (source de la saisie) à la fois par circuit ; changer de maillon actif recalcule toute
  la chaîne à partir de ce nouveau point d'ancrage.
- Le prix net réellement reçu par circuit (pour chaque format de vente) alimente le moteur de
  calcul existant (marges, point mort) — chaque circuit aura donc sa propre marge nette par
  format, cohérent avec la demande de circuits multiples.

### 4. Main-d'œuvre par activité *(extension ciblée, pas un doublon du système actuel)*

RestoCalculateur calcule déjà la main-d'œuvre de production de façon **ascendante** (bottom-up) :
temps par étape de recette × coût horaire du poste. C'est plus précis que l'approche MAPAQ (une
ligne « taux $/h × minutes » saisie à plat) — **à garder tel quel**, ne pas remplacer.

Ce qui manque : le temps du personnel **non directement attribuable à une recette** — supervision,
nettoyage général, administration, vente — qui chez MAPAQ est capturé par la répartition en % du
temps de chaque employé entre activités/administration/vente. C'est ce temps-là qui doit nourrir :
- la section Frais fixes (les salaires admin/vente deviennent des frais catégorisés, pas des
  coûts de recette) ;
- éventuellement la méthode « au prorata de la main-d'œuvre » d'une activité, si son pool
  d'indirects inclut de la supervision non capturée par les recettes.

**Décision : module léger.** Par employé, répartir son temps en % entre « Production (via
recettes — déjà calculé) », une ou plusieurs activités en supervision/temps non-recette,
« Administration » et « Vente ». Ne réplique pas le système complet du MAPAQ (pas de répartition
par circuit de vente pour la main-d'œuvre) — reste focalisé sur nourrir la section Frais fixes.

### 5. Module de rendement de transformation *(module autonome, distinct des étapes de recette)*

**Ne réutilise pas** la liste des étapes de production existante (celle qui gère le personnel et
le Gantt de main-d'œuvre) : cette dernière fonctionne déjà bien pour les plats et ne doit pas être
mise à risque en la surchargeant d'un second rôle (suivi de quantité/masse) qui n'a rien à voir
avec le suivi du temps.

À la place, un module séparé, propre à chaque format de vente, avec sa propre liste d'étapes
(nom libre + effet en % sur la quantité), réordonnable, aussi longue que nécessaire — même niveau
de rigueur que la cascade du MAPAQ (rendement %, pertes de fabrication), sans être limité à des
champs fixes (« Perte 1 », « Perte 2 »), et sans jargon. Le total se met à jour en direct au fur
et à mesure de l'ajout d'étapes, jusqu'au nombre d'unités de vente obtenues pour ce format.

**Séparément**, un **taux de rejet des produits finis**, appliqué après la cascade de rendement
(inspiré du chiffrier SymbiOse) : distinct méthodologiquement, puisqu'un rejet de contrôle qualité
survient après la transformation, pas pendant — les mélanger fausserait l'analyse de chacun.

**Correctif du 05/10 — la « quantité produite » n'est pas toujours un compte entier.** Retour
utilisateur : un producteur alimentaire (ex. transformation de viande) vend parfois au poids, pas
à la pièce — un lot donné peut légitimement produire 47,3 kg, pas un nombre entier d'« unités ».
Or la saisie manuelle de `nbPortions` (quand la grille de rendement est désactivée) exigeait un
entier dans tous les cas, forçant un contournement (activer la grille de rendement juste pour
obtenir une valeur décimale) même quand aucun rendement en cascade n'était nécessaire.

Décision : la contrainte « entier obligatoire » ne s'applique plus qu'aux formats dont l'unité
(`portionUnit`) est une unité de **compte** (« unité ») ; les formats en unité de **mesure**
continue (kg, g, L, ml) acceptent une quantité produite décimale, saisie manuellement OU calculée
par la grille de rendement — les deux chemins restent disponibles comme avant, seule la
contrainte d'arrondi change. Classification portée directement par `CONVERSION_FACTORS`
(`utils.js`, champ `type: 'discrete' | 'continuous'`) plutôt que par un réglage séparé à
maintenir en parallèle — une unité absente de cette table reste discrète par défaut
(comportement historique, le plus prudent). Voir `isDiscreteUnit`/`isValidPositiveNumber`
(`utils.js`) et `03-Feuille-de-route.md`.

**Idée explicitement écartée (même échange)** : un facteur d'échelle qui multiplierait
proportionnellement toutes les quantités d'ingrédients d'un format pour simuler un lot plus
gros/petit (« règle de trois »). Rejetée à la demande de l'utilisateur : en alimentaire, les
pertes de transformation, temps de cuisson et rendements ne scalent pas linéairement avec la
taille du lot — un multiplicateur automatique donnerait une fausse précision. Un changement de
taille de lot reste donc une saisie manuelle assumée (dupliquer un format via
`CopyFromFormatControl`/« copier à la base », puis ajuster chaque quantité), jamais un calcul
automatique. Un **journal des lots de production réels** (distinct de la recette de référence,
à la manière des points de suivi) a aussi été envisagé puis écarté : hors du périmètre voulu pour
l'application, qui n'est pas un ERP de suivi de production.

### 6. Sous-traitance et vieillissement *(postes de coût optionnels, masqués par défaut)*

Deux nouveaux postes de coût direct dans le moteur de calcul par format :
- **Sous-traitance** : coût d'une opération donnée à l'externe (nom du sous-traitant, opération,
  coût) — confirmé par le chiffrier SymbiOse.
- **Vieillissement** : charges d'intérêt de portage pour un produit qui doit affiner/vieillir en
  inventaire avant la vente (taux d'intérêt × durée) — confirmé par le guide MAPAQ, pertinent pour
  la fermentation/l'affinage.

**Décision : les deux sont masqués par défaut** dans la fiche de recette, révélés seulement par
une case à cocher ou un sélecteur — même patron que les cases « sous-recette » / « produit de
revente » déjà présentes dans l'app. Évite d'alourdir l'interface pour les recettes qui n'en ont
pas besoin (la majorité).

**Rattachement tranché en Phase 1.4 : les deux vivent sur le FORMAT, pas sur la recette mère.**
La sous-traitance est typiquement une opération propre à un format précis (ex. l'embouteillage du
format 4 L confié à un tiers, mais pas les pots de 250 ml faits maison) ; le vieillissement dépend
aussi du format (un format vrac peut affiner plus longtemps qu'un format détail). Implémenté dans
`calculateCosts.js` : la sous-traitance rejoint les charges directes (donc la marge brute) ; le
vieillissement reste à part, comme au MAPAQ (calculé sur le total des charges directes du lot,
inclus dans la marge nette mais pas dans la marge brute).

## Raffinements professionnels transversaux

- **Rentabilité et point mort par circuit** : puisque chaque circuit a un prix net différent, le
  Résumé et le Suivi devront pouvoir montrer marge et point mort **par circuit**, pas seulement
  globalement.
- **Étiquetage clair markup vs marge** partout dans l'app où un pourcentage de profit est saisi
  ou affiché — cohérence terminologique pour un utilisateur non-CPA.
- **Info-bulles dès la livraison** : chaque nouvelle fonctionnalité (à partir de la Phase 1)
  inclut ses info-bulles au moment de sa livraison, jamais remises à une passe finale.
- **Guide d'utilisation** : mise à jour incrémentale à chaque phase, avec une passe finale de
  consolidation pédagogique en Phase 7 (voir `03-Feuille-de-route.md`) — le guide doit expliquer
  le pourquoi, pas seulement où cliquer, et couvrir l'ensemble des nouvelles fonctionnalités.

## Impact sur la feuille de route

L'« activité de production » devient une fondation transversale (Frais fixes en dépend
directement) — elle doit être introduite tôt. Voir `03-Feuille-de-route.md` pour le plan complet
(y compris le réordonnancement du 05/10 : Circuits de vente avant Frais fixes), incluant la Phase 7
de revalidation UI/UX transversale.
