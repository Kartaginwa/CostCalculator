# Feuille de route

Plan de réalisation par phases. Voir `04-Conception-Modele.md` pour le détail conceptuel de
chaque entité, `06-Analyse-Chiffrier-SymbiOse.md` pour les trouvailles issues du chiffrier de
l'utilisateur, et `02-Journal-Decisions.md` pour la justification de chaque décision.

Statut : à valider avec l'utilisateur avant de démarrer chaque phase. Mis à jour au fil de
l'avancement. Les phases 1, 3 (Circuits de vente) et 4 (Frais fixes) sont détaillées jusqu'au
niveau des fichiers du code, parce que ce sont les plus larges/risquées ; les autres restent à un
niveau plus haut et seront détaillées à leur tour le moment venu. Ordre d'exécution revu le 05/10 —
voir l'encadré « Réordonnancement » avant la Phase 3.

## Principes transversaux (s'appliquent à toutes les phases)

- **Ni le MAPAQ ni le chiffrier SymbiOse ne sont reproduits tels quels** — ce sont des sources
  d'inspiration. Chaque décision de méthode retient l'approche la plus juste sur le plan du
  calcul, puis la rend utilisable pour un entrepreneur non-CPA — jamais l'inverse.
- **UI/UX équivalent ou meilleur, partout** : chaque nouvel écran doit être au moins de la même
  qualité que le reste de l'app, idéalement meilleur. Une bonne idée introduite dans une phase
  doit être évaluée pour propagation aux écrans existants plutôt que de rester isolée.
- **Info-bulles dès la livraison** : chaque nouvelle fonctionnalité inclut ses info-bulles au
  moment de sa livraison, jamais remises à plus tard.
- **Guide d'utilisation mis à jour incrémentalement** : chaque phase qui ajoute une fonctionnalité
  visible met à jour le guide (`InstructionModal`) en conséquence, avec une passe finale de
  consolidation pédagogique en Phase 7.
- Chaque phase (et sous-étape) se termine par un rapport (programmation, UI, UX, méthodologie)
  avant de passer à la suivante.

---

## Phase 1 — Fondation : Activité de production + Recette mère/Formats de vente

La phase la plus large et la plus risquée : restructure le cœur du modèle produit. Chaque
sous-étape est non régressive — l'app reste fonctionnelle après chacune.

### 1.1 — Activités de production (entité autonome) — ✅ terminée le 22/09
- `src/state/initialState.js` : `productionActivities` ajouté à `getEmptyState()` et
  `getDefaultState()` (activité « Général » par défaut).
- `src/state/projectReducer.js` : action `SET_PRODUCTION_ACTIVITIES` + `toProjectState`.
- `src/App.jsx` : setter câblé partout où un état complet est chargé (nouveau projet, exemple,
  tutoriel, ouverture de fichier, sauvegarde), exposé dans `projectContextValue`.
- `src/state/projectSerialization.js` : `buildProjectData`/`parseProjectData`, avec migration —
  un projet sans `productionActivities` reçoit automatiquement une activité « Général ».
- UI : nouvelle section « Lignes de production » dans Paramètres (`ProductInfo.jsx`) — ajout,
  renommage, suppression avec notification annulable, garde-fou empêchant de supprimer la
  dernière ligne restante. Info-bulle incluse.
- Tests : 3 nouveaux cas unitaires (reducer, sérialisation, migration) + un test e2e Playwright
  dédié (création/édition/suppression/garde-fou), capture d'écran vérifiée visuellement.
- Suite complète validée : 61/61 tests unitaires, 3/3 tests e2e, build de production propre.
- **Aucun impact sur le moteur de calcul** à ce stade — activités pas encore utilisées ailleurs
  (comme prévu, ce sera fait en 1.2 et en Phase 3).

### 1.2 — Rattachement des produits à une activité — ✅ terminée le 22/09
- `activityId` ajouté au schéma `products` (`initialState.js` — produits de démo rattachés à
  « Général » ; `handleAddNewProduct` et `handlePosImport` dans `App.jsx` — nouveaux produits
  rattachés à la première activité disponible).
- Migration dans `parseProjectData` : produits sans `activityId` → première activité disponible
  (« Général » par défaut) ; `activityId` déjà présent toujours préservé.
- UI : sélecteur d'activité dans `RecipeCalculator.jsx` (sous le choix du plat, avec info-bulle) ;
  colonne « Ligne de production » (éditable) + filtre dédié dans le tableau du menu de
  `ProductInfo.jsx`.
- **Correctif transversal** : en testant, la nouvelle rangée de champ a poussé le contenu de la
  page vers le bas et révélé une fragilité préexistante du composant `Combobox` (menu déroulant
  qui pouvait s'afficher hors écran quand le champ est proche du bas de la fenêtre). Corrigé dans
  `common.jsx` : le menu s'ouvre désormais vers le haut quand la place manque en dessous — comme
  un `<select>` natif. Pertinent pour toute la suite du projet, puisque plusieurs phases à venir
  ajoutent des champs à ce même écran.
- Tests : 2 nouveaux cas unitaires de migration (produit sans `activityId`, `activityId` déjà
  présent préservé) ; suite complète revalidée après le correctif du Combobox : 63/63 tests
  unitaires, 3/3 tests e2e (dont la régression détectée puis corrigée), vérification visuelle par
  capture d'écran.

**Correctif du 22/09 (suite au retour utilisateur)** : le sélecteur ajouté dans Recette & Calcul
faisait doublon et n'était pas au bon endroit. Corrigé conformément à la structure du chiffrier
SymbiOse (la ligne de production se choisit une seule fois, à la création du produit) :
- Retiré de `RecipeCalculator.jsx`.
- Section « Menu et recettes » renommée **« Produits et SKUs »** dans `ProductInfo.jsx` ; colonne
  et filtre « Ligne de production » repositionnés juste après le nom du produit (2e colonne),
  avant la catégorie — même ordre que la feuille « 1 - Produits » de SymbiOse.
- Guide d'utilisation et tour guidé mis à jour en conséquence (nouvelle section « Lignes de
  production », renommage de « Menu et recettes »).
- `dist/` reconstruit (`npm run build`) — nécessaire pour que la version Electron/`npm start`
  reflète le code courant ; le serveur de dev (`npm run dev` / tests e2e) est toujours à jour, lui.

### 1.3 — Modèle de données : recette mère + formats (sans changer le moteur ni l'UI) — ✅ terminée le 23/09
- Choix d'implémentation : plutôt que de déplacer les champs de vente
  (`prixVente`/`nbPortions`/`portionSize`/`portionUnit`/`salesMix`/`onMenu`/`indirectCosts.portionsSold`)
  hors du produit (ce qui aurait cassé tous les écrans/le moteur actuels), un `formats[]` est
  ajouté **en parallèle** — une duplication temporaire et assumée. Les champs « à plat » restent
  la source de vérité pour le moteur/l'UI jusqu'à la 1.4 (moteur par format) et la 1.5 (UI
  multi-formats), qui basculeront la lecture vers `formats` et pourront alors retirer les champs
  à plat désormais redondants.
- `buildDefaultFormat()` (nouveau, `initialState.js`) construit ce format par défaut à partir des
  champs à plat déjà normalisés d'un produit, avec un SKU auto-généré (`generateSlug`, déjà
  utilisé pour les ingrédients — réutilisé pour la cohérence plutôt que d'inventer un second
  schéma de génération d'identifiant).
- Câblé partout où un produit est créé ou chargé : produits de démo (`initialState.js`),
  `handleAddNewProduct`/`handlePosImport` (`App.jsx`), migration dans `parseProjectData`
  (produit sans `formats` → un format construit depuis ses champs actuels ; `formats` déjà
  présent — cas d'un projet sauvegardé après la 1.5 — toujours préservé tel quel, jamais régénéré).
- `handlePosImport` (mise à jour d'un produit existant) garde désormais `formats[0]` synchronisé
  avec les champs à plat qu'il modifie, pour éviter une dérive silencieuse entre les deux tant que
  la duplication existe.
- **Bug préexistant corrigé au passage** : `handleDuplicateProduct` référençait un champ `labor`
  qui n'existe plus (renommé `productionSteps` lors d'un refactor antérieur) — dupliquer un
  produit chargé depuis un fichier plantait l'application. Découvert en construisant la
  duplication des formats (qui touche cette même fonction) ; aucun test ne couvrait ce bouton.
  Corrigé, et couverture e2e ajoutée pour éviter une régression silencieuse à l'avenir.
- Tests : 3 nouveaux cas unitaires (format par défaut construit correctement, formats existants
  préservés sans régénération, présence dans le cycle sauvegarde/chargement) + 1 nouveau test e2e
  pour la duplication de produit (couvre le bug corrigé). Suite complète : 65/65 tests unitaires,
  4/4 tests e2e, lint propre, `dist/` reconstruit.

### 1.4 — Moteur de calcul par format + rendement + sous-traitance/vieillissement — ✅ terminée le 23/09
- `src/engine/calculateCosts.js` : nouveau paramètre optionnel de fin de liste `format`, repli
  automatique sur `product.formats?.[0]` puis sur `product` lui-même si aucun format n'existe —
  **rétrocompatible à 100 %** : les ~25 tests existants et tous les appelants actuels
  (`analysisData.js`, `RecipeCalculator.jsx`, `initialState.js`, `exportToExcel.js`) continuent de
  fonctionner sans modification, puisqu'un produit à un seul format donne des résultats
  identiques qu'on lise ses champs sur lui-même ou sur son format. Cache mémoïsé désormais keyé
  par `format.id` (et non `product.id`) — nécessaire pour que deux formats d'un même produit ne se
  partagent jamais un résultat en cache.
- `src/engine/analysisData.js` : passe explicitement `p.formats?.[0]` à `calculateCosts` (clarté ;
  comportement déjà couvert par le repli automatique).
- Nouveau `src/engine/yieldCalculator.js` (`computeYieldUnits`) : fonction pure, module de
  rendement **autonome** (aucune dépendance aux étapes de production/main-d'œuvre) — cascade
  d'étapes nommées à effet en % sur une quantité de départ, puis un taux de rejet des produits
  finis appliqué après coup. Intégré dans `calculateCosts.js` : quand `format.yieldGrid.enabled`
  est vrai, remplace la saisie manuelle du nombre de portions par la valeur calculée.
- Sous-traitance (`format.subcontracting`) et vieillissement (`format.aging`) : rattachés au
  **format** (décision tranchée en implémentant — voir `04-Conception-Modele.md`), masqués par
  défaut (`enabled` absent → 0 $, aucun changement de comportement). Sous-traitance ajoutée aux
  charges directes (marge brute) ; vieillissement calculé sur le total des charges directes du lot
  et inclus dans la marge nette seulement (comme au MAPAQ).
- Tests : 7 nouveaux cas pour `computeYieldUnits` (étapes, gains/pertes, rejet, cas limites) + 7
  nouveaux cas pour `calculateCosts` (format explicite, cache indépendant par format,
  sous-traitance activée/désactivée, vieillissement activé/désactivé, grille de rendement).
  **79/79 tests unitaires**, **4/4 tests e2e**, lint propre.
- **Non-régression vérifiée par capture d'écran** : les chiffres du Résumé (projet démo) après le
  refactor sont identiques au dollar et au centième de pourcent près à ceux d'avant — confirmation
  la plus forte possible qu'aucun comportement n'a changé pour un projet à un seul format par
  produit (le cas de 100 % des projets existants, tant que la Phase 1.5 n'a pas encore été livrée).
- `dist/` reconstruit.

### 1.5 — UI de gestion des formats — ✅ terminée le 23/09
- `RecipeCalculator.jsx` réécrit : bandeau d'onglets de formats (SKU affiché, badge « défaut » sur
  le premier format non supprimable, boutons dupliquer/supprimer), champ SKU éditable, et tous les
  champs de vente (prix, portions, taille, unité, mix, portions vendues) qui éditent désormais le
  **format sélectionné** plutôt que le produit à plat.
- Coûts affichés recalculés directement pour le format sélectionné (plus seulement via
  `analysisData`, qui ne connaît encore que le premier format) — chaque onglet de format montre
  ses propres coûts/marges en temps réel, y compris en mode simulation de prix.
- Nouvelle section « 3. Coûts additionnels » (sous-traitance + vieillissement, masquées par
  défaut derrière une case à cocher) et grille de rendement intégrée sous le champ « Nombre de
  portions » (désactivé et calculé automatiquement quand la grille est active) — sections
  renumérotées en conséquence (Frais indirects devient 4, Récapitulatif devient 5).
- **Stratégie de synchronisation temporaire** (documentée en tête de fichier et dans
  `04-Conception-Modele.md`) : éditer le format PAR DÉFAUT (index 0) met aussi à jour les champs
  à plat du produit, pour que Paramètres/Résumé/rapports (qui ne lisent pas encore `formats[]` —
  Phase 1.6) restent corrects sans modification. Éditer un format additionnel n'apparaît que dans
  cet écran jusqu'à la Phase 1.6.
- **Correctif de lint découvert en cours de route** : la règle `react-hooks/purity` (famille
  React Compiler) signalait un faux positif sur `Date.now()`/`Math.random()` dans un gestionnaire
  d'événement isolé, alors que le même patron est utilisé ailleurs dans ce fichier et dans
  `App.jsx` sans être signalé. Suivant le précédent déjà établi pour `set-state-in-effect`,
  rétrogradée à `warn` dans `eslint.config.mjs` avec justification en commentaire.
- Vérification : suite complète **79/79 tests unitaires**, **4/4 tests e2e**, lint sans erreur
  bloquante, `dist/` reconstruit. Non-régression confirmée par capture d'écran (Résumé du projet
  démo identique au dollar près à avant la 1.5). Nouvelles fonctionnalités vérifiées visuellement
  et fonctionnellement : ajout d'un 2e format avec ses propres valeurs isolées du format par
  défaut, activation de la grille de rendement, activation de la sous-traitance.

**Correctif du 23/09 (suite au retour utilisateur)** : la gestion des formats (ajout/duplication/
suppression, SKU, prix, mix, au menu) vivait dans Recette & Calcul — mauvais endroit selon le
même principe déjà établi au correctif de la 1.2 (« la ligne de production devrait être
sélectionnée dans Paramètres, dès le départ, comme dans le chiffrier SymbiOse ») : la création et
la gestion des formats/SKU doivent se faire dans Paramètres → Produits et SKUs, qui devient un
tableau **une ligne par format/SKU** (et non plus une ligne par produit), à l'image de la feuille
« 1 - Produits » de SymbiOse. Recette & Calcul reste l'écran de detail (recette, coûts, rendement,
sous-traitance) et ne garde qu'un **sélecteur** de format.
- `src/utils.js` : `FORMAT_FLAT_MIRROR_FIELDS` déplacé ici (était dupliqué dans
  `RecipeCalculator.jsx`) pour être partagé avec `App.jsx`.
- `App.jsx` : nouveaux gestionnaires `handleAddFormat`, `handleDuplicateFormat`,
  `handleDeleteFormat` (garde-fou identique à celui retiré de `RecipeCalculator.jsx` : le format
  par défaut, index 0, ne peut pas être supprimé tant qu'il reste d'autres formats — il alimente le
  miroir vers les champs à plat) et `handleFormatValueChange` (édite `sku`/`prixVente`/
  `salesMix`/`onMenu` d'un format, avec le même miroir vers les champs à plat que dans
  `RecipeCalculator.jsx` quand c'est le format par défaut).
- `ProductInfo.jsx` : le tableau « Produits et SKUs » est reconstruit sur une liste aplatie
  `rows` (une entrée par `{produit, format}`), avec une nouvelle colonne **SKU** et les colonnes
  Prix de vente/Mix des ventes/Au menu qui éditent désormais le format via
  `handleFormatValueChange` (elles éditaient auparavant les champs à plat du produit, sans jamais
  toucher `formats[]` — un écart introduit par la 1.5, puisque `calculateCosts` lit déjà le format
  depuis cette phase-là ; corrigé au passage). Actions par ligne : ajouter/dupliquer/supprimer ce
  format, plus dupliquer/supprimer le plat en entier (recette complète) — ce dernier bouton de
  suppression masqué quand il ferait doublon avec la suppression du format (produit à un seul
  format). L'avertissement « total du mix des ventes » se calcule maintenant sur les formats
  affichés plutôt que sur les champs à plat des produits, pour rester cohérent avec ce qui est
  visible et modifiable à l'écran.
- `RecipeCalculator.jsx` : le bandeau de formats n'est plus qu'un sélecteur (clic sur un onglet) —
  boutons ajouter/dupliquer/supprimer et champ SKU retirés, ainsi que les gestionnaires
  correspondants et l'import `FORMAT_FLAT_MIRROR_FIELDS` local (remplacé par l'import partagé).
- Section « 4. Frais indirects » : le champ « Nombre de portions vendues ou envisagées »
  (`format.indirectCosts.portionsSold`) retiré de cet écran à la demande de l'utilisateur — le
  moteur (`calculateCosts.js`) l'estime déjà automatiquement à partir du revenu et du mix des
  ventes quand la valeur n'est pas renseignée manuellement, ce qui reste le comportement par
  défaut. Seuls le rappel de la méthode d'attribution active et le récapitulatif des totaux
  demeurent dans cette section.
- Vérification : suite complète **79/79 tests unitaires**, **4/4 tests e2e** (dont la duplication
  de produit et les lignes de production, tous deux repassés sans changement de sélecteur), lint
  sans erreur bloquante, `dist/` reconstruit. Non-régression confirmée par capture d'écran :
  tableau Produits et SKUs du projet démo (une ligne par produit, puisque chaque produit démo n'a
  qu'un seul format) et section Frais indirects du Récapitulatif (mêmes totaux qu'avant le retrait
  du champ).

### 1.5bis — Correction du modèle : chaque format a sa propre fiche recette — ✅ terminée le 23/09
**Diagnostic de départ (retour utilisateur)** : « L'ajout d'un numéro de SKU ne règle pas le
problème du format... un code SKU ne permet pas des calculs basés sur le volume, notamment des
calculs de pertes. » En vérifiant, le diagnostic était fondé : `calculateCosts.js` calculait le
coût matière/MO du lot une seule fois pour la recette mère puis chaque format le divisait par son
propre nombre de portions — un même lot partagé entre deux formats aurait vu son coût compté deux
fois. Analyse de `06-Analyse-Chiffrier-SymbiOse.md` (trouvaille n°1 et n°6) à l'appui : la solution
n'est pas de répartir un lot partagé, mais d'abandonner l'idée du lot partagé — chaque SKU a sa
propre fiche recette complète (comme la feuille « Coût Prod. » de SymbiOse, un bloc par SKU) et
son propre rendement (matières premières engagées → quantité finale obtenue, cascade déjà bâtie en
1.4 conservée telle quelle). Voir `04-Conception-Modele.md` section 2bis pour le raisonnement
complet et le vocabulaire retenu (« recette mère » = regroupement organisationnel uniquement).
- `src/state/initialState.js` : `ingredients`, `productionSteps`, `isResaleProduct`,
  `purchaseCost`, `manualAllergens` déménagés du produit vers chaque format —
  `buildDefaultFormat()` les copie désormais dans le premier format construit, et le nouvel
  helper `stripFormatOwnedFields()` les retire du produit juste après (appelé à chaque point de
  création/migration : démo, `handleAddNewProduct`, `handlePosImport`, migration de sauvegarde).
- `src/state/projectSerialization.js` : migration à trois générations de fichiers — (1) avant la
  1.3 (pas de `formats` du tout) : premier format construit depuis les champs à plat du produit ;
  (2) 1.3-1.5 (`formats` existe mais sans fiche recette encore, qui vivait sur le produit) : le
  format par défaut (index 0 seulement) hérite des champs à plat du produit ; (3) après ce
  correctif (chaque format porte déjà sa fiche complète) : préservé tel quel. Couverte par un
  nouveau cas de test dédié à la génération 2.
- `src/engine/calculateCosts.js` : lit `fmt.ingredients`/`fmt.productionSteps`/
  `fmt.isResaleProduct`/`fmt.purchaseCost` (le format) au lieu de `product.*` — élimine tout
  besoin d'allocation de coût entre formats, chaque format calcule son coût en entier à partir de
  sa propre liste.
- `src/engine/analysisData.js`, `src/reports/exportToExcel.js`, `src/reports/generatePdf.js`,
  `src/App.jsx` (calcul de `totalDirectLaborHoursNeeded`/productivité cuisine) : mis à jour pour
  lire la fiche recette depuis `product.formats?.[0]` (repli sur le produit lui-même si absent,
  compatibilité avec les anciennes fixtures de test) plutôt que directement sur le produit —
  ces écrans restent limités au premier format d'un produit jusqu'à la Phase 1.6, comme les champs
  de vente.
- `src/features/RecipeCalculator.jsx` : toute la section recette (ingrédients, processus de
  production, statut revente, coût d'achat, allergènes manuels) édite désormais le FORMAT
  sélectionné plutôt que le produit — nouveau `updateFormat()` générique, nouveau
  `handleFormatResaleToggle()` (bascule le statut revente et vide la recette de CE format, plus
  seulement du produit).
- `src/App.jsx` : `handleDuplicateProduct` et `handleDuplicateFormat` régénèrent maintenant les
  `rowId`/`stepId` des ingrédients/étapes à l'intérieur de chaque format dupliqué (ils y vivent
  désormais) ; `handleAddFormat` initialise un format vierge avec une fiche recette vide plutôt que
  d'omettre ces champs (le moteur suppose toujours un tableau, jamais `undefined`).
- Tests : 4 cas existants de `calculateCosts.test.js` mis à jour (les formats de test définissent
  maintenant leurs propres ingrédients, plus ceux du produit) ; 3 cas de `projectSerialization.test.js`
  mis à jour + 1 nouveau cas pour la migration génération 2. **80/80 tests unitaires**, **4/4 tests
  e2e**, lint sans erreur bloquante, `dist/` reconstruit.
- **Non-régression vérifiée par un test e2e dédié** (temporaire, supprimé après usage) : ajout d'un
  2e format à un produit démo à 4 ingrédients depuis Paramètres → le nouveau format démarre avec
  une fiche recette VIDE ; ajouter un ingrédient sur ce nouveau format n'affecte PAS les 4
  ingrédients du format par défaut (preuve directe de l'indépendance des fiches recette, exactement
  le comportement que le correctif visait à garantir).

### 1.5ter — Restructuration UI : Paramètres en sections par recette + outils de copie entre SKU — ✅ terminée le 24/09
Suite de la 1.5bis, sur demande explicite de l'utilisateur : conserver la hiérarchie
recette mère → formats pour la **navigation**, mais rendre son usage plus naturel maintenant que
chaque format est autonome. Compréhension reformulée et confirmée avec l'utilisateur avant
implémentation (voir échange du 23-24/09) — trois volets :
- **Paramètres → Produits et SKUs, restructuré en sections par recette** (`ProductInfo.jsx`) : une
  carte par produit (nom, ligne de production, catégorie, actions dupliquer/supprimer le plat en
  en-tête), contenant la liste de ses SKU (SKU, prix, mix, au menu, actions dupliquer/supprimer ce
  format) et un bouton « Ajouter un format » par carte. Tri/filtre/pagination portent désormais sur
  les PRODUITS (regroupements), pas sur les lignes de format individuelles — le tri par
  prix/mix/SKU n'avait plus de sens à ce niveau une fois que plusieurs SKU peuvent coexister sous
  une même recette.
- **Sélecteur de format restylé** (`RecipeCalculator.jsx`) : bandeau d'onglets soulignés,
  dans le même langage visuel que la barre de navigation principale de l'app (`border-b-2`,
  actif en bleu), remplace l'ancien bandeau de pastilles pleines jugé « pas très beau ».
- **Fenêtre modale d'ajout de SKU** (`AddFormatModal`, nouveau composant dans `common.jsx`) :
  accessible directement depuis Recette & Calcul via un bouton « Ajouter un SKU », sans changer
  d'onglet. Crée un format vierge ou une copie complète d'un SKU existant (« copier à la base »).
  Écrit dans le même état central que Paramètres via les gestionnaires déjà existants
  (`onAddFormat`/`onDuplicateFormat`, désormais aussi passés à `RecipeCalculator`, étendus d'un
  paramètre `sku`/`skuOverride` optionnel) — un seul chemin d'écriture, le nouveau SKU apparaît
  donc aussitôt dans les deux écrans.
- **Copie section par section entre SKU** (`CopyFromFormatControl`, nouveau composant réutilisable
  dans `common.jsx`) : posé à même chaque section de Recette & Calcul (portions/rendement,
  ingrédients, processus de production, coûts additionnels) — invisible s'il n'y a qu'un seul
  format sur le produit. Remplace le bouton « dupliquer le format en bloc » qui vivait auparavant
  dans cet écran (la duplication complète reste offerte, mais seulement à la création via la
  fenêtre modale — « copier à la base »).
- Tests e2e existants mis à jour pour la nouvelle structure (sections au lieu d'un tableau plat) :
  `e2e/smoke.spec.js` et `e2e/product-duplication.spec.js` ciblent maintenant
  `[id^="product-section-"]` plutôt que `table tbody tr`. **80/80 tests unitaires**, **4/4 tests
  e2e**, lint sans erreur bloquante, `dist/` reconstruit.
- **Vérification fonctionnelle par test e2e dédié** (temporaire, supprimé après usage) : création
  d'un SKU vierge nommé via la fenêtre modale → sélectionné automatiquement, fiche recette vide
  confirmée (0 ingrédient) → utilisation du contrôle « copier depuis » pour récupérer les 4
  ingrédients du format par défaut → confirmés présents après copie. Couvre le parcours complet
  proposé par l'utilisateur (créer un SKU sans quitter Recette & Calcul, puis peupler sa fiche par
  copie ciblée plutôt que par clonage intégral).
- Guide d'utilisation (`InstructionModal.jsx`) mis à jour : section Paramètres → Produits et SKUs
  décrit la nouvelle structure en sections ; nouvelle sous-section « Sélecteur de format (SKU) »
  dans Recette & Calcul pour la modale et les contrôles de copie.

### 1.5quater — Correction de terminologie : SKU = recette + format, pas un synonyme — ✅ terminée le 04/10
**Retour utilisateur** : « J'ai l'impression que tu mélange SKU et format. [...] Pour moi, le SKU,
c'est un numéro. Le format c'est un emballage et une quantité. » Précisé ensuite : « Le SKU est
l'addition de la recette et du format. Il s'exprime comme un numéro de référence. » Confirme et
clarifie la trouvaille n°1 de `06-Analyse-Chiffrier-SymbiOse.md` (SKU = Ligne + Catégorie + Produit
+ **Format**, un code composite) que l'implémentation avait respectée dans la donnée
(`generateSlug` combine déjà nom + `portionSize` + `portionUnit`) mais pas dans la présentation :
le SKU était affiché comme l'attribut principal (onglets, bouton « Ajouter un SKU ») alors que le
format (quantité/unité — déjà présent dans RestoCalculateur comme « quantité par portion ») restait
un champ séparé, jamais relié visuellement au mot « format ». Correctif **purement présentation et
relocalisation de champs — aucun changement à la structure de calcul** (`calculateCosts.js` non
touché ; mêmes noms de champs `portionSize`/`portionUnit`/`nbPortions`, lus de la même façon).
- `utils.js` : nouvel helper `formatQuantityLabel(portionSize, portionUnit)` (ex. « 250 ml »),
  utilisé partout où le format doit s'afficher à la place du SKU.
- `initialState.js` : nouvel helper `buildFormatSku(platName, portionSize, portionUnit,
  fallbackId)`, factorisé depuis `buildDefaultFormat` — le SKU se déduit désormais explicitement
  de la recette + du format à CHAQUE création de format (pas seulement le premier), via
  `App.jsx` (`handleAddFormat`/`handleDuplicateFormat`, étendus d'un paramètre `overrides`
  `{ sku, portionSize, portionUnit }` optionnel).
- **Paramètres → Produits et SKUs** (`ProductInfo.jsx`) : nouvelle colonne **Format** (quantité +
  unité, éditable) ajoutée avant la colonne SKU — c'est ici, et seulement ici, qu'on modifie le
  format d'un SKU existant (via `handleFormatValueChange`, déjà générique, aucun changement de
  logique requis).
- **Recette & Calcul** (`RecipeCalculator.jsx`) : le bandeau d'onglets affiche désormais le FORMAT
  (ex. « 250 ml ») plutôt que le SKU ; bouton renommé « Ajouter un format ». Les champs « Quantité
  par portion » et « Unité » retirés de cet écran (c'était le format en double, dixit
  l'utilisateur) — remplacés par un simple rappel en lecture seule (« Format de ce SKU : 250 ml —
  modifiable dans Paramètres »). Le champ « Nombre de portions » renommé « Nombre d'unités
  produites » (même champ `nbPortions`, juste reformulé pour une entreprise de transformation).
  Le contrôle de copie associé (`copyPortionsAndYieldFrom` → `copyYieldFrom`) ne copie plus le
  format entre SKU (c'est justement ce qui les distingue), seulement le nombre d'unités et la
  grille de rendement.
- `AddFormatModal` (`common.jsx`) : redessinée pour demander la Quantité + Unité du nouveau format
  en premier (champs requis), le SKU devenant un champ optionnel explicitement sous-titré
  « sinon déduit automatiquement de la recette et du format ».
- Tests : **80/80 tests unitaires inchangés** (aucun test de `calculateCosts.test.js` à modifier —
  confirmation directe qu'aucune structure de calcul n'a été touchée), **4/4 tests e2e**, lint
  propre, `dist/` reconstruit.
- **Vérification fonctionnelle par test e2e dédié** (temporaire, supprimé après usage) : modifier
  la quantité du format par défaut dans Paramètres (1000 ml → 1200 ml) se répercute correctement
  sur l'onglet affiché dans Recette & Calcul ; création d'un nouveau format (750 ml) via la fenêtre
  modale affiche bien « 750 ml » comme onglet. Capture d'écran à l'appui.
- Guide d'utilisation mis à jour : section Produits et SKUs (nouvelle colonne Format, SKU
  repositionné comme numéro dérivé) et section Recette & Calcul (sélecteur de format, en-tête de
  recette) reformulées avec la terminologie corrigée.

### 1.6 — Propagation aux écrans consommateurs + QA de non-régression

Scindée en sous-étapes en cours de route (reconnaissance préalable par agent dédié : 9 fichiers
consommateurs, plusieurs avec un risque de rétrocompatibilité réel — voir 1.6a).

#### 1.6a — Moteur d'analyse (`analysisData.js`) + boucles dupliquées — ✅ terminée le 04/10
**Fondation de toute la Phase 1.6.** `computeAnalysisData` produisait une ligne par PRODUIT
(toujours son premier format, via `p.formats?.[0]`) ; produit désormais une ligne par **FORMAT**.
- `src/engine/analysisData.js` : chaque ligne de `productsWithCosts` continue d'exposer les mêmes
  champs à plat que les écrans existants attendent (`prixVente`, `salesMix`, `onMenu`, `nbPortions`,
  `platName`...) — mais tirés du format précis de cette ligne, pas du produit ni de son premier
  format. Nouveaux champs : `id` devient l'id du FORMAT (unique même entre deux formats d'un même
  produit, pour que toute logique déjà indexée par `.id` — clés React, `Map`, recherches — reste
  juste sans modification), `productId` (id du produit d'origine, pour remonter à lui),
  `formatIndex`, `format` (l'objet format complet attaché à la ligne). Repli sur le produit
  lui-même comme « format implicite » unique quand `formats[]` est absent (anciennes fixtures de
  test) — résultat strictement identique à avant pour tout produit à un seul format, le cas de
  tous les projets existants.
- Rapport d'achats et analyse ABC corrigés au passage : lisaient `product.formats?.[0]` (une
  RE-dérivation du premier format, même quand la ligne représentait déjà un format précis) plutôt
  que `product.format` (le format réellement attaché à la ligne) — un écart qui aurait fait
  calculer deux fois le même format et jamais le second pour un produit multi-formats.
- `contributionData` désambiguïsé : quand plusieurs formats actifs du même produit apparaissent
  (ex. deux barres « Confiture de fraises »), le nom affiché devient « Confiture de fraises
  (250 ml) » / « (500 ml) » — nouvel helper `formatQuantityLabel` (déjà utilisé en 1.5quater).
- **Deux autres boucles « premier format seulement » corrigées pour cohérence** (identifiées par
  la même reconnaissance, dupliquaient la logique de `analysisData.js` sans passer par elle) :
  `src/App.jsx` (reconstruction des heures de MO nécessaires pour la productivité cuisine) et
  `src/state/initialState.js` (`buildTrackingHistory`, le générateur de l'historique de démo) —
  toutes deux aplaties par format désormais, même patron que le moteur d'analyse.
- **PosImportWizardModal.jsx confirmé hors-portée** par la reconnaissance : ne lit ni n'écrit
  `analysisData`, cible déjà explicitement le format 0 par conception — refonte prévue en Phase 5,
  aucune action requise ici. *(Note du 14/10 : ce « Phase 5 » date d'avant le réordonnancement du
  05/10 — ce n'est pas l'ancienne Phase 5 « Main-d'œuvre hors-recette » abandonnée ce jour, voir
  plus bas. La refonte multi-formats de PosImportWizardModal reste donc non assignée à une phase
  précise ; à re-planifier le jour où elle devient nécessaire.)*
- Tests : 5 nouveaux cas dédiés aux formats multiples dans `analysisData.test.js` (une ligne par
  format avec id/productId/formatIndex distincts, coût calculé à partir de SA PROPRE fiche recette,
  rapport d'achats qui cumule la consommation des deux formats au lieu d'ignorer le second,
  désambiguïsation de `contributionData`, non-régression du cas à un seul format). **85/85 tests
  unitaires** (80 + 5), **4/4 tests e2e**, lint propre, `dist/` reconstruit. Non-régression
  confirmée par capture d'écran : Résumé et Suivi du projet démo visuellement identiques à avant
  (tous les produits de démo n'ayant encore qu'un seul format, aucune ligne supplémentaire
  n'apparaît nulle part).

#### 1.6b — Résumé + simulateur de chocs — ✅ terminée le 04/10
`SummaryTable.jsx` affiche déjà une ligne par `productsWithCosts` sans modification (automatique
depuis 1.6a) — restait le bouton d'édition, qui ne savait naviguer que vers un PRODUIT
(`editingProductIndex`), jamais vers le bon onglet de format dans Recette & Calcul.
- **`src/App.jsx`** : nouvel état `editingFormatIndex` (défaut 0), nouveau `editProduct(index,
  formatIndex = 0)` (utilisé par le Résumé — `product.productId`/`product.formatIndex`, fournis
  par chaque ligne depuis la 1.6a), et `selectProductForRecipe(index)` (utilisé par le sélecteur
  de plat interne à Recette & Calcul, qui remet toujours le format à 0 puisqu'il change de recette
  sans viser un format précis). `editingFormatIndex` passé à `RecipeCalculator` via un nouveau
  prop `initialFormatIndex`.
- **`src/features/RecipeCalculator.jsx`** : l'effet qui réinitialisait l'onglet de format à 0 à
  chaque changement de produit dépend maintenant aussi de `initialFormatIndex` — se resynchronise
  sur le format ciblé sans interférer avec un clic ultérieur de l'utilisateur sur un autre onglet
  (l'effet ne redéclenche que si `editingProductIndex` ou `initialFormatIndex` changent, pas à
  chaque rendu).
- **`src/features/SummaryTable.jsx`** : bouton d'édition corrigé
  (`products.findIndex(p => p.id === product.productId)` au lieu de `product.id`, qui ne
  correspond plus à rien depuis que `.id` est l'id du format) ; nom de ligne et items des quadrants
  stratégiques (Étoiles/Vaches à lait/Dilemmes/Poids morts) utilisent `displayName` plutôt que
  `platName` pour rester désambiguïsés quand un produit a plusieurs formats.
- **`src/engine/analysisData.js` (amélioration DRY)** : `displayName` calculé une seule fois par
  ligne à la construction (nom seul si le produit n'a qu'un format, nom + format sinon) plutôt que
  re-dérivé indépendamment dans chaque écran consommateur — `contributionData` simplifié pour le
  réutiliser directement.
- **`src/features/CostShockSimulator.jsx`** : la recherche par `Map` indexée sur `.id`
  fonctionnait déjà correctement sans modification (les deux côtés de la comparaison utilisent
  systématiquement l'id de format depuis la 1.6a) — confirmé par vérification, pas de correctif
  nécessaire ; seul le libellé du tableau d'impact par plat basculé sur `displayName`.
- Tests : 2 nouveaux cas unitaires dédiés à `displayName` dans `analysisData.test.js`
  (**87/87 tests unitaires**), nouveau test e2e **permanent**
  `e2e/summary-format-navigation.spec.js` (ajoute un 2e format à un produit démo, vérifie les deux
  lignes désambiguïsées dans le Résumé, clique éditer sur le 2e format, confirme l'ouverture sur le
  bon produit ET le bon onglet de format) — **5/5 tests e2e**, lint propre, `dist/` reconstruit.

**Reste à faire dans la 1.6 :**

#### 1.6c — Suivi (`TrackingTab.jsx`) — ✅ terminée le 04/10
Pressentie comme la question de rétrocompatibilité la plus délicate du projet : les points de
référence déjà sauvegardés (avant la 1.6a) ont une `productsWithCosts` à l'ancienne forme (une
ligne par PRODUIT, sans `format`/`formatIndex`/`productId`/`displayName`) ; les nouveaux points en
ont une par FORMAT. En pratique, **aucune migration n'a été nécessaire** : la forme de ligne
choisie en 1.6a est un sur-ensemble strict de l'ancienne (mêmes champs `costs`/`salesMix`/
`onMenu`/`platName`, plus de nouveaux champs d'identité) — chaque ligne, ancienne ou nouvelle,
reste lisible telle quelle partout où `TrackingTab.jsx` les consomme (`globalKpiData`,
`productKpiData` — déjà tolérant à une entrée manquante via son repli existant). Confirmé en
lisant `projectSerialization.js` : `trackingPoints` traverse un cycle sauvegarde/chargement sans
aucune transformation de `productsWithCosts`, donc un ancien point survit intact au chargement
d'un projet.
- **Seul correctif réellement nécessaire** : `trackableProducts` (menu déroulant « Analyse par
  format ») stockait `p.platName` comme libellé — ambigu dès qu'un produit a plusieurs formats,
  puisque chacun garderait le même nom dans la liste. Extrait en fonction pure testable
  `buildTrackableProducts` (nouveau `src/engine/trackingAnalysis.js`, même patron que
  `priceVolatility.js`) : utilise `p.displayName || p.platName` — nom seul pour une ancienne ligne
  (pas de régression), nom + format pour une ligne récente.
- Section renommée « Analyse par recette » → **« Analyse par format »** (cohérent avec la
  correction de terminologie de la 1.5quater — le menu déroulant liste désormais des formats, pas
  des recettes).
- `src/state/initialState.js` (`buildTrackingHistory`, démo) complété avec `displayName`, pour que
  l'historique de démonstration suive exactement la même règle que `computeAnalysisData` — logique
  de désambiguïsation factorisée dans un nouvel helper partagé `buildRowDisplayName` (`utils.js`),
  utilisé par les deux au lieu d'être dupliquée une troisième fois.
- Tests : nouveau fichier `trackingAnalysis.test.js`, 6 cas (formats multiples désambiguïsés,
  repli sur `platName` pour une ancienne ligne sans `displayName`, **cohabitation d'un ancien point
  et d'un nouveau point dans le même historique sans planter**, déduplication d'un format suivi
  sur plusieurs points, non-régression à un seul format, liste vide). **93/93 tests unitaires**
  (87 + 6), **5/5 tests e2e**, lint propre, `dist/` reconstruit.

#### 1.6d — Rapports (`generatePdf.js`, `exportToExcel.js`) — ✅ terminée le 04/10
**`generatePdf.js`** bouclait déjà sur `productsWithCosts` (donc déjà une page par FORMAT depuis
la 1.6a) mais affichait encore `product.platName` dans les titres de page, l'évolution des
indicateurs et l'Annexe A — remplacé par `product.displayName` partout. Même chose dans la matrice
d'ingénierie de menu (`drawQuadrant`) : les items de `menuEngineeringData` sont des lignes
`productsWithCosts` complètes, donc `item.platName` → `item.displayName` sans autre changement.
Correctif plus substantiel : `reportFormat = product.formats?.[0] || product` (marqué depuis la
1.5bis comme « pas encore étendu à plusieurs formats ») relisait toujours le PREMIER format du
produit, peu importe la ligne affichée — un vrai bug qui aurait donné la même fiche ingrédients/
étapes pour les deux formats d'un même produit. Corrigé en `product.format || product.formats?.[0]
|| product` : chaque ligne de `productsWithCosts` porte déjà son propre format attaché (`format`,
ajouté en 1.6a) — on le lit directement au lieu de le rederiver. Les recherches dans l'historique
de suivi (`getProductKpiDataForPdf(trackingPoints, product.id)`) n'ont pas eu besoin de correctif :
`product.id` est déjà l'id du FORMAT depuis la 1.6a, et la comparaison `String(p.id) ===
String(productId)` dans l'historique fonctionne identiquement pour un ancien point (une ligne =
un produit, id inchangé) ou un nouveau (une ligne = un format) — même principe de cohabitation
sans migration validé en 1.6c.

**`exportToExcel.js`** était plus problématique : contrairement au PDF, il ignorait complètement
`productsWithCosts` et refaisait son propre calcul via deux boucles `products.forEach` + appels
indépendants à `calculateCosts(product, ...)` (une 4e implémentation parallèle du calcul de coût,
repérée lors de la reconnaissance préalable à la Phase 1.6). Restructuré pour boucler sur
`productsWithCosts` (comme le PDF et tous les écrans depuis 1.6a/b/c) : feuille « Résumé » et
fiches de coût individuelles produisent maintenant une ligne/un onglet par FORMAT, en réutilisant
les coûts déjà calculés par `computeAnalysisData` (`product.costs`) au lieu de les recalculer —
élimine la duplication de logique en plus de régler le problème de granularité. `product.formats
?.[0] || product` remplacé par `product.format || product` (même correctif que le PDF). Libellés
« Nombre de portions » → « Nombre d'Unités Produites » et « Taille par portion » → « Format »
(cohérence de vocabulaire avec la 1.5quater). Le paramètre `products` (devenu inutile après le
passage à `productsWithCosts`) a été retiré des deps et de l'appel dans `App.jsx`, ainsi que
l'import désormais inutilisé de `calculateCosts`.

Le risque déjà identifié (noms de feuille Excel tronqués à 31 caractères, collision possible entre
deux formats d'un même produit si leurs étiquettes désambiguïsées partagent un préfixe trop long)
reste présent et non traité ici — simple troncature comme avant, à surveiller si le besoin se
précise.
- Tests : aucun nouveau test unitaire (ces deux modules n'ont pas de couverture dédiée au-delà du
  garde-fou bibliothèque absente dans `reports.test.js`, resté inchangé et toujours vert). Vérifié
  manuellement avec un test e2e temporaire (créé puis supprimé) qui ajoute un 2e format à « Poutine
  décadente » dans le projet démo puis déclenche les deux exports : aucune erreur console/page.
  **93/93 tests unitaires**, **5/5 tests e2e** (suite permanente), lint propre (0 erreur — les
  avertissements `no-unused-vars` restants sur des champs d'`analysisData` non consommés par les
  rapports sont préexistants, inchangés par cette sous-étape), `dist/` reconstruit.

#### 1.6e — Vérification de non-régression globale — ✅ terminée le 04/10, Phase 1.6 close
Balayage de tout le code consommant `product.id`/`products.find(...)` à la recherche d'autres
effets du changement d'identité de ligne introduit en 1.6a (`id` = id du FORMAT, pas du produit).

**Régression trouvée et corrigée** : `ingredientsList` (`App.jsx`), la liste des ingrédients
sélectionnables dans Recette & Calcul (ingrédients de base + sous-recettes), construisait ses
entrées de sous-recette à partir de `productsWithCosts` avec `id: p.id` — c'est-à-dire l'id du
FORMAT depuis la 1.6a, plus l'id du PRODUIT comme avant. Or `calculateCosts.js` résout une
sous-recette en cherchant `allProducts.find(p => p.id === item.id)` dans le tableau de produits
BRUT (ids de produits, jamais d'ids de format) — et c'est cet id de `ingredientsList` qui est
stocké comme `item.id` dès qu'on sélectionne une sous-recette dans le sélecteur de Recette &
Calcul (`Combobox` → `handleIngredientUpdate` → `id: selection.id`). Résultat : **toute
sous-recette ajoutée via ce sélecteur depuis la 1.6a coûtait silencieusement 0 $ dans le plat
parent** (son id ne correspondait plus à rien dans `allProducts`). Les sous-recettes déjà câblées
dans les données de démo (ids de produits codés en dur dans `initialState.js`) n'étaient pas
affectées — seules les sous-recettes ajoutées via l'interface après la 1.6a l'étaient, ce qui
explique que personne ne l'ait remarqué en testant avec le projet démo. Corrigé en filtrant sur
`formatIndex === 0` (une sous-recette absorbe toujours son premier format — voir
`calculateCosts.js`, décision antérieure à la Phase 1.6 et non remise en question ici) et en
exposant `id: p.productId` plutôt que `id: p.id`. Corrige du même coup un effet de bord connexe :
le filtre d'auto-exclusion dans `RecipeCalculator.jsx` (`ingredientsList.filter(ing => ing.id !==
product.id)`, qui empêche un produit de se sélectionner lui-même comme ingrédient) comparait lui
aussi un id de format à un id de produit et ne filtrait donc plus rien.
- Validation de la correction : reproduite manuellement en annulant temporairement le correctif
  (le nouveau test échoue proprement avec `0.00 $` au lieu du montant attendu), puis confirmée de
  nouveau verte une fois le correctif restauré — la régression est bien ce que le test verrouille,
  pas un faux positif.
- Reste du balayage (`App.jsx`, `calculateCosts.js`, `ProductInfo.jsx`, `RecipeCalculator.jsx`,
  `PosImportWizardModal.jsx`, `generatePdf.js`) : aucune autre occurrence de `formats?.[0]` ou de
  comparaison par `.id` ne s'est révélée affectée — toutes opèrent soit sur le tableau de produits
  brut (ids de produits, non affecté par la 1.6a), soit sur des formats/employés/postes sans lien
  avec l'identité de ligne de `productsWithCosts`.
- Guide d'utilisation (`InstructionModal.jsx`) : trois sections mises à jour pour refléter les
  formats multiples désormais visibles hors de Recette & Calcul — Résumé (« Tableau comparatif » :
  une ligne par format, désambiguïsée), Suivi (« Graphiques d'évolution » : liste déroulante par
  format plutôt que par recette), Exports (une fiche PDF / feuille Excel par format). Glossaire
  complété avec deux entrées manquantes malgré le pivot de vocabulaire de la 1.5quater : **Format**
  et **SKU**.
- Tests : nouveau test e2e **permanent** `e2e/subrecipe-ingredient-picker.spec.js` (verrouille la
  régression ci-dessus : crée une sous-recette via l'interface, la sélectionne comme ingrédient
  d'un second plat via le sélecteur, vérifie un coût matière non nul). **93/93 tests unitaires**
  (inchangé — la régression vivait dans `App.jsx`, hors du périmètre testé par Vitest), **6/6
  tests e2e** (5 + 1), lint propre (0 erreur), `dist/` reconstruit.

**Phase 1.6 (formats multiples propagés à tout le projet) est maintenant complète** : 1.6a
(moteur) → 1.6b (Résumé + navigation) → 1.6c (Suivi) → 1.6d (Rapports) → 1.6e (non-régression +
guide), toutes terminées.

#### 1.6f — Corrections issues de la validation manuelle (04/10)
Neuf points soulevés en validant l'application dans le navigateur (voir la checklist de
validation). Pour chacun : analyse, correctif, puis vérification par un test automatisé
(permanent quand le correctif touche un comportement durable, temporaire quand il s'agissait
simplement de confirmer visuellement un rendu).

1. **SKU figé à la création d'un produit** — un produit vierge ("" comme nom) générait un SKU basé
   sur ce nom vide, qui ne se régénérait JAMAIS une fois le vrai nom saisi. Rendu dynamique :
   `App.jsx` régénère le SKU de chaque format tant qu'il correspond encore à ce que l'ancien nom
   aurait produit (donc pas encore modifié manuellement) — à chaque frappe sur le nom du produit,
   ou à chaque changement de quantité/unité d'un format. Un bug a été trouvé et corrigé dans ce
   correctif lui-même en le vérifiant : `buildDefaultFormat` (format par défaut à la création) et
   `handleAddFormat`/`handleDuplicateFormat` (bouton « Ajouter un format ») utilisent deux
   conventions de repli différentes pour le SKU auto-généré (id du PRODUIT vs id du FORMAT) — la
   détection essaie maintenant les deux.
2. **Menu déroulant Catégorie filtré par la valeur déjà choisie** — `Combobox` (`common.jsx`,
   partagé avec le sélecteur d'ingrédient) filtrait ses options sur la valeur du champ dès
   l'ouverture ; si une catégorie était déjà choisie, ouvrir le menu ne montrait plus qu'elle-même.
   Corrigé en ignorant le filtre tant que le menu vient juste de s'ouvrir (jusqu'à la première
   frappe) — bénéficie aussi au sélecteur d'ingrédient. Le champ Catégorie de Paramètres (texte +
   `<datalist>` natif, qui souffre du même travers côté navigateur) a été migré vers ce même
   `Combobox` pour en profiter.
3. **« Copier depuis un format » absent pour un produit de revente** — la section « Coût d'Achat »
   propre aux produits de revente (case « Considérer comme un produit de revente ») n'avait pas de
   contrôle de copie, contrairement aux sections ingrédients/étapes/coûts additionnels. Ajouté
   (`copyResalePurchaseFrom`, copie coût d'achat + allergènes manuels entre formats).
4. **Sous-recette à plusieurs formats : quel coût utiliser comme ingrédient ?** — question de
   fond : si une sous-recette a 2 formats à recettes différentes, laquelle utiliser quand on la
   sélectionne comme ingrédient d'un autre plat ? Avant ce correctif, `calculateCosts.js` absorbait
   toujours le PREMIER format de la sous-recette, peu importe lequel l'utilisateur avait
   sélectionné dans le menu déroulant d'ingrédient — qui d'ailleurs n'en proposait qu'un par
   sous-recette (fusionnés). **Solution retenue** : chaque FORMAT d'une sous-recette est maintenant
   une entrée distincte du sélecteur d'ingrédient (désambiguïsée, ex. « Sauce demi-glace maison
   (500 ml) »), et `calculateCosts.js` résout une référence par id de FORMAT en priorité (par id de
   PRODUIT en repli, pour les données antérieures à ce correctif — absorbe alors son premier
   format, comportement historique inchangé). Le filtre d'auto-exclusion (un produit ne peut pas se
   choisir lui-même comme ingrédient) a été corrigé au passage : il comparait un id de format à
   `product.id`, sans jamais matcher depuis la 1.6a.
5. **Simulateur de choc — écart sans pourcentage** — la colonne « Écart » de l'impact par plat
   n'affichait que le delta en $. Ajout du pourcentage que ce delta représente par rapport à la
   marge actuelle, entre parenthèses (ex. « ▼ 1.82 $ (16.7 %) »).
6. **Sous-recettes à 0 % partout dans Suivi → Analyse par format** — une sous-recette jamais vendue
   seule a un prix de vente nul, donc TOUS ses ratios en % (coût matière, coût MO...) sont forcés à
   0 par `calculateCosts.js` (division par un prix nul) : le graphique affichait une ligne plate à
   0 % trompeuse. Le graphique bascule maintenant automatiquement sur les coûts en $/unité
   (toujours significatifs) quand le format sélectionné n'a jamais eu de prix de vente sur les
   points affichés, avec un texte explicatif. Même correctif appliqué au graphique d'évolution par
   produit du PDF (et ses ratios statiques, qui affichent désormais « N/A » plutôt qu'un
   « 0,00 % » trompeur quand le format n'a pas de prix).
7. **Conformité du graphique « Évolution des marges et coûts moyens »** — vérifié en comparant,
   via un test e2e temporaire, les KPIs pondérés affichés en LIVE dans Résumé (au moment précis de
   chaque point de référence) au recalcul exact de la formule du graphique à partir du projet
   sauvegardé : les deux concordent à la précision flottante près, avant et après l'ajout d'un 2e
   format à un produit. **La formule est correcte** — le filage de données ne contenait pas
   l'anomalie soupçonnée ; elle était probablement la même perception que le point 6 (sous-recette
   à 0 %), déjà corrigée.
8. **Export Excel ne fonctionnant pas sous `npm start`** — n'a pas pu être reproduit directement
   (Electron ne peut pas se lancer dans cet environnement d'exécution sandboxé). Cause la plus
   probable : `npm start` (`electron .`) charge le contenu de `dist/` tel qu'il est au moment de
   l'appel et ne le reconstruit JAMAIS lui-même — un `dist/` pas reconstruit après un changement de
   code en est la cause la plus probable (`npm run start:built` reconstruit puis lance, `npm start`
   seul ne fait que lancer). En plus de reconstruire `dist/` à chaque étape comme d'habitude,
   trois renforcements défensifs, bénéfiques indépendamment de la cause exacte : `exportToExcel.js`
   référence maintenant `window.XLSX` (et non la variable globale bare `XLSX`), cohérent avec
   `ImportWizardModal.jsx`/`PosImportWizardModal.jsx` ; les noms de feuille Excel en collision après
   troncature à 31 caractères (risque déjà identifié en 1.6d, qui aurait fait planter
   `book_append_sheet`) reçoivent désormais un suffixe numérique automatique ; le message d'erreur
   affiché à l'utilisateur inclut maintenant le détail de l'exception, pour qu'une panne future
   soit diagnosticable sans avoir à reproduire l'environnement exact.
9. **Sous-recettes et mise en page dans l'export PDF** — même correctif qu'au point 6 (coûts en
   $/unité plutôt que ratios à 0 %) appliqué au graphique d'évolution par produit du PDF. Pour la
   cohérence des sauts de page : repéré que les "Sections 4 & 5" d'une fiche de coût (tableau KPI
   en `autoTable`, qui pagine seul en cas de dépassement, côte à côte avec le point mort/
   classification en texte positionné à la main, sans awareness de page) pouvaient se désynchroniser
   sur deux pages différentes si le contenu précédent (ingrédients + étapes de production) avait
   déjà rempli la page — contrairement aux quadrants de la matrice stratégique, qui vérifiaient déjà
   la place disponible avant de dessiner. Un saut de page préventif (même garde que les quadrants)
   force maintenant ces deux colonnes sur la même page.
- Tests : 2 nouveaux tests unitaires dans `calculateCosts.test.js` (sous-recette à plusieurs
  formats résolue au format précisément référencé ; référence historique par id de produit non
  régressée), vérification manuelle de chacun des 9 points via des tests e2e temporaires (créés
  puis supprimés) — tous passés après correctif. **95/95 tests unitaires**, **6/6 tests e2e**
  (suite permanente inchangée), lint propre (0 erreur), `dist/` reconstruit.

#### 1.6g — Correctif du point 1 : le SKU ne se régénérait pas après une DUPLICATION (04/10)
Signalé après la 1.6f : le SKU se régénère bien pour un format neuf, mais pas pour une copie
(produit dupliqué puis renommé, ou format dupliqué puis changé de quantité/unité).

**Cause** : `handleDuplicateProduct` et `handleDuplicateFormat` suffixaient `-copie` au SKU de
l'ORIGINAL sans jamais le reconstruire — la copie portait donc, dès sa création, un SKU qui ne
correspondait déjà plus à son propre nom/format (ex. une copie nommée « Tartare de saumon (Copie) »
gardait le SKU `tartare-de-saumon-1-unite-copie`, bâti sur l'ancien nom). La détection « SKU encore
auto-généré » (`isAutoGeneratedSku`, ajoutée en 1.6f) ne pouvait donc plus jamais reconnaître ce
SKU comme auto, et ne le régénérait plus ensuite.
- **`handleDuplicateProduct`** : si le SKU de l'original était encore auto, la copie reçoit
  directement un SKU reconstruit sur son NOUVEAU nom (« ... (Copie) ») — jamais besoin de suffixe,
  puisque le nom diffère déjà de l'original. Un SKU personnalisé par l'utilisateur reste intact
  (suffixé, comme avant).
- **`handleDuplicateFormat`** (dupliquer un seul format, bouton Paramètres) : le nom du produit ne
  change pas à la différence d'un produit dupliqué, donc si la quantité/l'unité ne changent pas
  non plus (duplication simple, sans passer par la fenêtre « Ajouter un format »), reconstruire le
  SKU donnerait un doublon EXACT de celui de l'original. Un suffixe `-copie` reste donc nécessaire
  dans ce seul cas précis — mais `isAutoGeneratedSku` le reconnaît désormais comme toujours « auto »
  (il retire ce suffixe avant de comparer), donc changer la quantité du format dupliqué juste
  après — le geste naturel suivant — régénère bien le SKU, sans suffixe cette fois.
- Tests : 2 nouveaux tests e2e **permanents**, ajoutés à `e2e/product-duplication.spec.js` (SKU
  d'un produit dupliqué régénéré au renommage de la copie ; SKU d'un format dupliqué régénéré
  proprement — sans suffixe résiduel — au changement de sa quantité). **95/95 tests unitaires**,
  **8/8 tests e2e** (6 + 2), lint propre (0 erreur), `dist/` reconstruit.

Prochaine étape : Phase 2 (Packaging) ou toute autre phase du document partagé avec le collègue
externe, sur nouveau "go" — ou une nouvelle ronde de validation si d'autres points apparaissent.

---

## Phase 2 — Onglet Packaging

Découpée en 4 sous-étapes, sur le même principe que la Phase 1 : chaque sous-étape est
non régressive, l'app reste fonctionnelle après chacune.

### 2.1 — Modèle de données `basePackaging` + onglet « Packaging » (catalogue, sans impact sur le moteur) — ✅ terminée le 05/10
Même patron que la 1.1 (Activités de production) : nouvelle entité + sa propre UI de gestion,
zéro impact sur le moteur de calcul à ce stade (rien n'y est encore rattaché).
- Nouvelle tranche d'état `basePackaging`, structurellement identique à `baseIngredients`
  (fournisseur, format d'achat, unité, prix d'achat, taux de perte, prix unitaire dérivé,
  dernière MàJ) — voir `04-Conception-Modele.md`. Sans allergènes (non pertinent pour un
  emballage) ni `isRecipe` (pas de notion de sous-recette pour le packaging).
- Câblée dans tout le cycle de vie du projet : `getEmptyState()`/`getDefaultState()`
  (`initialState.js`, 6 emballages de démo), `projectReducer.js` (action `SET_BASE_PACKAGING`),
  `projectSerialization.js` (`buildProjectData`/`parseProjectData`, migration vers catalogue vide
  pour un projet antérieur à cette phase), `App.jsx` (nouveau setter, câblé sur tous les chemins
  de chargement : tutoriel, nouveau projet, projet d'exemple, réinitialisation, ouverture de
  fichier — et `projectContextValue`).
- Nouvel onglet **Packaging** (entre Ingrédients et Main-d'œuvre dans la barre de navigation) :
  nouveau composant `PackagingTab.jsx`, miroir du cœur de `IngredientsTab.jsx` (tableau
  filtrable/triable/paginé, ajout/duplication/suppression avec notification annulable) —
  volontairement **sans** l'analyse ABC, le rapport d'achats, l'outil de comparaison de prix ni
  l'assistant d'import : ces outils dépendent de la consommation réelle par format, qui n'existe
  pas encore avant la 2.2 (rattachement à un format de vente). Les ajouter aujourd'hui aurait
  affiché des rapports vides ou trompeurs.
- Guide d'utilisation : nouvelle section « Onglet 3 : Packaging », renumérotation des onglets
  suivants (Main-d'œuvre 3→4, Recette & Calcul 4→5, Résumé 5→6, Suivi 6→7).
- Tests : 2 nouveaux cas unitaires dans `projectReducer.test.js` (action `SET_BASE_PACKAGING`,
  `toProjectState`) + 3 dans `projectSerialization.test.js` (migration vers catalogue vide,
  normalisation d'un item partiel, round-trip sauvegarde/chargement), 1 cas mis à jour (liste des
  tranches exportées). 2 nouveaux tests e2e **permanents** `e2e/packaging-tab.spec.js` (ajout/
  modification/duplication/suppression d'un emballage sans erreur ; survie à un cycle sauvegarde/
  chargement). **97/97 tests unitaires** (95 + 2), **10/10 tests e2e** (8 + 2), lint propre
  (0 erreur), `dist/` reconstruit.

**Correctif (05/10, retour utilisateur)** : il manquait les info-bulles sur le nouveau catalogue
(principe transversal « Info-bulles dès la livraison », oublié dans la livraison initiale).
Ajoutées sur 3 colonnes — Taux de perte, Prix Unitaire (nouvelle, absente aussi côté ingrédients),
Dernière MàJ — et, pour cette dernière, le point jaune d'alerte (>30 jours) que sa bulle décrit
n'avait pas non plus été repris depuis `IngredientsTab.jsx` : ajouté en même temps, pour que la
bulle ne décrive pas une fonctionnalité absente. Vérifié par un test e2e temporaire (survol des 3
bulles, contenu attendu visible), supprimé après coup. **97/97 tests unitaires**, **10/10 tests
e2e**, lint propre, `dist/` reconstruit.

### 2.2 — Rattachement à un format de vente + moteur de calcul — ✅ terminée le 05/10
- Nouvelle section **« 2. Emballage »** dans `RecipeCalculator.jsx` (couleur `teal`, propre et
  distincte des sections Ingrédients/Main-d'œuvre/Indirects), rattachée au **format** — chaque
  format a son propre emballage, comme ses propres ingrédients. Même patron que les ingrédients
  (`Combobox` alimenté par `basePackaging`, quantité, unité, coût unitaire en lecture seule, coût
  total, `CopyFromFormatControl` « copier l'emballage »), sans glisser-déposer (liste généralement
  courte) ni colonne rendement (un emballage ne « rétrécit » pas pendant la production — seul le
  taux de perte du catalogue, bris/rebuts, s'applique). Absente pour un produit de revente (pas
  de recette du tout dans ce cas) — `isResaleProduct` vide désormais aussi `packagingItems`, comme
  `ingredients`/`productionSteps`. Sections renumérotées en conséquence (1 Ingrédients → 2
  Emballage → 3 Production → 4 Coûts additionnels → 5 Indirects → 6 Récapitulatif).
- Nouveau poste de coût dans `calculateCosts.js` : `totalPackagingCost` / `costPackagingPerPortion`
  / `costPackagingPercent` — jamais fusionné au coût matière, intégré à `totalDirectCostPerPortion`/
  `totalRecipeCost`/la base du vieillissement au même titre que la sous-traitance. `basePackaging`
  ajouté en **tout dernier paramètre** de `calculateCosts`/`computeAnalysisData` (défaut `[]`) :
  plusieurs appelants passent déjà `format` positionnellement, l'insérer plus tôt aurait
  silencieusement décalé leurs arguments.
- Récapitulatif (section 6) : 4e tuile « Coût Emballage (%) », tooltips des coûts/marges directs
  mis à jour pour mentionner l'emballage (ex. « Total Coûts Directs »).
- Migration : un format déjà sauvegardé sans `packagingItems` reçoit une liste vide (aucun
  changement de coût pour les projets existants).
- Guide d'utilisation : nouvelle section « 2. Emballage » sous Recette & Calcul, renumérotation
  des sections suivantes, 3 descriptions de coûts/marges directs complétées (glossaire inclus) et
  nouvelle entrée de glossaire « Coût d'emballage ».
- Tests : 4 nouveaux cas unitaires dans `calculateCosts.test.js` (calcul de base, taux de perte du
  catalogue, absence pour un produit de revente, impact sur la marge nette) ; 1 nouveau + 1 mis à
  jour dans `projectSerialization.test.js` (migration vers catalogue vide, préservation d'un format
  déjà complet incluant son `packagingItems`). 2 nouveaux tests e2e **permanents**
  `e2e/packaging-recipe-integration.spec.js` (ajout d'un emballage et reflet au récapitulatif ;
  absence de la section pour un produit de revente). **102/102 tests unitaires** (97 + 5), **12/12
  tests e2e** (10 + 2), lint propre (0 erreur), `dist/` reconstruit.

### 2.3 — Propagation aux écrans consommateurs — ✅ partiellement terminée le 05/10
- Récapitulatif de recette : 4 postes (matière, **emballage**, main-d'œuvre, indirects) — fait
  dès la 2.2 (tuile dédiée + tooltips mis à jour).
- `analysisData.js` : nouveau KPI pondéré `weightedPackagingCost` (même formule que
  `weightedMaterialCost`/`weightedLaborCost`, pondéré par le mix des ventes).
- **Résumé** (`SummaryTable.jsx`) : tuile « Coût Emballage Moyen Pondéré » dans le tableau de bord
  stratégique (grille passée de 2 à 3 colonnes), colonne « Coût Emb. (%) » dans le tableau détaillé
  par plat (triable, comme les autres colonnes).
- **Rapport PDF** (`generatePdf.js`) : ligne « Coût Emballage Moyen Pondéré » dans les KPIs globaux
  du tableau de bord ; nouvelle table « Détail du Coût d'Emballage » par fiche de coût (même
  patron que les ingrédients, couleur teal — cohérent avec la section Emballage de Recette &
  Calcul), visible seulement si le format a des emballages rattachés ; ligne « Ratio Coût
  Emballage » dans les KPIs de chaque fiche.
- **Export Excel** (`exportToExcel.js`) : ligne « Coût Emballage Moyen Pondéré » (Tableau de Bord),
  colonne « Coût Emballage (%) » (feuille Résumé), section « Emballage » + lignes récap (fiches
  individuelles) — même patron que les ingrédients.
- Tooltips et glossaire du guide mis à jour pour mentionner l'emballage partout où « matière +
  main-d'œuvre » étaient cités comme les seuls coûts directs.
- Tests : 1 nouveau cas unitaire dans `analysisData.test.js` (pondération du coût emballage par
  mix des ventes). 1 nouveau test e2e **permanent** `e2e/packaging-reports.spec.js` — rattache un
  emballage réel à un format, exporte PDF et Excel, et **parse le fichier Excel obtenu** (via la
  bibliothèque `xlsx`, pas juste une vérification d'absence d'erreur) pour confirmer que les
  nouvelles colonnes/lignes contiennent les bonnes valeurs. **103/103 tests unitaires** (102 + 1),
  **13/13 tests e2e** (12 + 1), lint propre (0 erreur), `dist/` reconstruit.

**Suite de la 2.3 — ✅ terminée le 05/10 (demande explicite : « il faudrait tout appliquer »)**
Analyse ABC, rapport d'achats et assistant d'import pour le Packaging, symétriques à ceux des
ingrédients.

- **`analysisData.js`** : les sections 5 (rapport d'achats) et 6 (analyse ABC) — identiques pour
  les ingrédients et, maintenant, le packaging — ont été extraites dans une fonction partagée
  `computePurchasingAndAbc(catalogue, activeProducts, unitsSoldById, recipeField)`, appelée une
  fois par catalogue (`'ingredients'` / `'packagingItems'`) plutôt que dupliquées une 3e fois.
  Nouvelles clés `packagingPurchasingReportData`/`packagingAbcAnalysisData`, toujours séparées de
  celles des ingrédients (jamais fusionnées).
- **`PackagingTab.jsx`** : sections « Analyse ABC des emballages » et « Rapport d'achats et pertes
  » ajoutées, même structure visuelle que `IngredientsTab.jsx` — sans le badge « volatile » (le
  suivi historique des prix, Suivi, ne couvre pas encore le packaging ; resterait à faire si
  étendu en Phase 6). Message explicite si aucun emballage n'est encore consommé par un format.
- **Assistant d'import** : `ImportWizardModal.jsx` (ingrédients) généralisé et renommé
  `CatalogImportWizardModal.jsx` plutôt que dupliqué — accepte `itemLabel`/`itemLabelPlural`
  (textes affichés) et `extraNewItemFields` (champs propres au type de catalogue : `isRecipe`/
  `allergens` pour les ingrédients, aucun pour le packaging). `APP_FIELDS` (mapping de colonnes)
  déjà agnostique du type d'item, réutilisé tel quel pour les deux catalogues — seul le libellé du
  champ « Nom » se personnalise. `IngredientsTab.jsx` mis à jour pour utiliser le composant
  généralisé ; comportement vérifié inchangé pour les ingrédients (test de régression dédié).
- Guide d'utilisation : 3 nouvelles sous-sections sous Packaging (import, ABC, rapport d'achats).
- Tests : 2 nouveaux cas unitaires dans `analysisData.test.js` (rapport/ABC du packaging séparés
  de ceux des ingrédients ; catalogue vide sans erreur). 2 nouveaux tests e2e **permanents**
  (`e2e/packaging-abc-import.spec.js` : ABC/rapport d'achats avec consommation réelle ; assistant
  d'import du packaging) + vérification manuelle (temporaire, supprimée) que l'assistant
  d'import des ingrédients affiche toujours son propre libellé après la généralisation.
  **105/105 tests unitaires** (103 + 2), **15/15 tests e2e** (13 + 2), lint propre (0 erreur),
  `dist/` reconstruit.

**Correction post-2.3 — ✅ terminée le 05/10** (retour de validation : totaux incomplets, couleur
pas assez distincte, vocabulaire « portion », suivi historique manquant)
- **Moteur** (`calculateCosts.js`) : le calcul du coût d'emballage, qui ne retournait qu'un seul
  total, a été refactorisé en accumulateur exposant séparément `totalBasePackagingCost` et
  `totalPackagingLossCost` (même patron que `totalBaseIngredientsCost`/`totalLossCost`) — la perte
  stock de l'emballage n'était jusqu'ici nulle part visible.
- **Recette & Calcul** : le bas de la section « 2. Emballage » affichait une seule valeur (« Coût
  Emballage (portion) »). Remplacé par le même bloc à 4 valeurs que les Ingrédients (coût de base,
  coût des pertes stock, total pour la recette, coût à l'unité) — toutes les occurrences
  résiduelles de « portion » dans cet onglet (Matières, Emballage, Main-d'œuvre, Indirects, « Coût
  par Portion », tooltip Marge Nette, tooltip Coût de Revient Total) renommées en « unité ».
- **Couleur** : la section Emballage (teal) était trop proche visuellement du vert des Ingrédients.
  Changée pour le rose (`pink-*`), seule couleur encore inutilisée dans la page (vert=Ingrédients,
  jaune=MO, orange=Coûts additionnels, violet=Indirects, bleu=Récapitulatif). Synchronisé dans le
  rapport PDF (en-tête/pied de la table « Détail du Coût d'Emballage », anciennement `#0D9488`
  teal → `#DB2777` rose).
- **Suivi** (`TrackingTab.jsx`) : nouvelle section « Évolution du prix des emballages », symétrique
  à celle des ingrédients mais toujours SÉPARÉE (jamais fusionnée — principe constant de la Phase
  2). `handleSaveSnapshot` capture désormais aussi `basePackaging` dans chaque nouveau point de
  référence. Les points historiques du projet démo (18 mois générés en Phase 1.6g) ont été étendus
  avec un historique de prix du Packaging (`PACKAGING_PRICE_PROFILES` dans `initialState.js`, même
  patron que les ingrédients) pour que la démo illustre la fonctionnalité dès l'ouverture, sans
  attendre la création d'un nouveau point.
- Tests : assertion ajoutée au test unitaire existant de perte d'emballage
  (`calculateCosts.test.js`, vérifie les 2 nouveaux champs). 1 nouveau test e2e **permanent**
  `e2e/packaging-tracking-totals.spec.js` (2 cas : totaux complets + couleur rose côté Recette &
  Calcul ; présence et séparation de l'évolution Packaging côté Suivi). Mise à jour d'un test e2e
  existant (`packaging-recipe-integration.spec.js`) dont l'assertion textuelle visait l'ancien
  libellé « (portion) ». **105/105 tests unitaires, 17/17 tests e2e**, lint propre (0 erreur),
  `dist/` reconstruit.

**Phase 2 (Packaging) est maintenant fonctionnellement complète** : 2.1 (catalogue) → 2.2
(rattachement à un format + moteur) → 2.3 (propagation complète : Résumé, rapports, ABC, achats,
import) → correction post-2.3 (totaux, couleur, vocabulaire, suivi historique) → 2.4
(vérification de non-régression globale, ci-dessous).

### 2.4 — Vérification de non-régression — ✅ terminée le 05/10
- Suite complète : `npx eslint .` (0 erreur), `npx vitest run` (105/105), `npx playwright test`
  (17/17), `npx vite build` (dist/ reconstruit) — exécutée après la correction post-2.3 ci-dessus.
- Vérification manuelle du flux complet dans l'app (dev server) : catalogue Packaging, rattachement
  à une recette, propagation Résumé/PDF/Excel/ABC/achats/import, et désormais le suivi historique —
  aucune régression constatée sur les onglets existants (Ingrédients, Main-d'œuvre, Résumé, Suivi).
- **Phase 2 est close.**

---

## Correctif méthodologique — Quantité produite et type d'unité — ✅ terminée le 05/10

Retour utilisateur (hors numérotation de phase — touche le modèle de format, utilisé par toutes
les phases, pas seulement le Packaging) : la validation de « quantité produite » (`nbPortions`)
exigeait un entier dans tous les cas, ce qui empêche un producteur vendant au poids (ex.
transformation de viande, 47,3 kg issus d'un lot) de saisir sa quantité manuellement sans détourner
la grille de rendement. Voir `04-Conception-Modele.md` (section 5) pour la décision complète,
y compris l'idée de facteur d'échelle de lot explicitement écartée (la cuisson/transformation ne
scale pas linéairement — décision de l'utilisateur).

- **`utils.js`** : `CONVERSION_FACTORS` porte désormais un champ `type` (`'discrete'` pour
  « unité », `'continuous'` pour g/kg/ml/L) ; nouvelle fonction `isDiscreteUnit(unit)` (défaut
  discret si l'unité est inconnue — le plus prudent) et `isValidPositiveNumber` (comme
  `isValidPositiveInteger`, mais accepte les décimales).
- **`calculateCosts.js`** : `nbPortions` n'est plus tronqué via `parseInt` — lu avec
  `parseLocaleNumber`, qui préserve les décimales. Aucun changement pour les formats en « unité »
  (déjà validés comme entiers côté UI, donc déjà des entiers à ce stade).
- **Recette & Calcul** : le champ « Nombre d'unités produites » renommé « Quantité produite »
  (le libellé précédent impliquait un compte discret). Sa validation (bordure rouge, message
  d'erreur, `inputMode`) dépend maintenant de l'unité du format sélectionné via `isDiscreteUnit` —
  entier obligatoire pour « unité », décimales permises pour g/kg/ml/L. Guide d'utilisation
  (`InstructionModal.jsx`) mis à jour en conséquence.
- Tests : nouveau fichier `src/utils.test.js` (5 cas : classification discret/continu, validation
  décimale). 1 nouveau cas unitaire dans `calculateCosts.test.js` (quantité manuelle fractionnaire
  sur un format en kg, non tronquée). 1 nouveau test e2e **permanent**
  `e2e/unit-type-quantity.spec.js` (décimale acceptée en kg, entier toujours exigé en « unité »).
  **111/111 tests unitaires** (105 + 6), **18/18 tests e2e** (17 + 1), lint propre (0 erreur),
  `dist/` reconstruit.

---

## Réordonnancement du 05/10 — Phases 3/4/5 renumérotées

Décidé avec l'utilisateur : l'ancienne Phase 3 (Comptabilité) répartit les frais **par activité de
production ET par canal de vente** (deux axes, voir `04-Conception-Modele.md`) — mais « canal de
vente » n'existe comme donnée que depuis l'ancienne Phase 5. La construire avant aurait forcé un
canal unique factice, puis une reprise à l'arrivée des vrais circuits (même type de faux départ que
le modèle de formats du 23/09). **Nouvel ordre : Circuits de vente → Frais fixes (ex-Comptabilité,
renommé — ce n'est pas une comptabilité complète, seulement la catégorisation/répartition des frais
fixes) → Main-d'œuvre hors-recette → Intégration/QA → Revalidation UI/UX.** Numérotation des phases
mise à jour en conséquence (aucune des phases concernées n'était commencée).

Dépendance inverse repérée en sens inverse : la propagation du **point mort par circuit**
(ex-5.4) a elle-même besoin de l'allocation par canal de la Phase Frais fixes pour avoir un sens —
initialement scindée en conséquence (marge par circuit avec la Phase 3, point mort par circuit
différé en Phase 4.5). **Correction du 06/10** : cette scission s'est révélée inutile — l'allocation
GLOBALE déjà disponible (`generalInfo.totalIndirects × salesMix%`) suffit à calculer un point mort
différent par canal dès maintenant (seule la marge brute du canal, au dénominateur, change). Fait
avec la Phase 3 ; la Phase 4.2 ne fera qu'améliorer la PRÉCISION du montant alloué, pas introduire
le calcul.

Placement UI revu à la même occasion (suggestion de l'utilisateur) : les canaux de vente suivent le
même patron que les activités de production (`productionActivities`) — une liste de référence
courte, modifiée occasionnellement, consommée par d'autres écrans — donc gérée dans **Paramètres**
(nouvelle section, juste après « Activités de production »), pas dans un onglet dédié. Le
rattachement prix/volumes par format × circuit s'ajoute à la section **Produits et SKUs**
existante, là où vivent déjà `prixVente`/`salesMix`/`onMenu` par format.

---

## Phase 3 — Circuits de vente (section Paramètres, pas un onglet dédié)

### 3.1 — Modèle de données et moteur de la cascade — ✅ terminée le 05/10
- **Moteur** : `src/engine/salesChannelCascade.js`, `computeSalesChannelCascade({ links, anchorIndex,
  anchorValue })` — fonction pure (même patron que `calculateCosts.js`/`yieldCalculator.js`).
  Calcule la cascade de prix (coût de revient → ... → PDSF) à partir d'une liste ordonnée de
  maillons, chacun marge (% du prix de vente à ce maillon) ou markup (% du prix précédent) — les
  deux étiquetés explicitement, jamais confondus. Ancrée à n'importe quel maillon (pas seulement le
  coût) : le reste de la chaîne se déduit vers l'avant/l'arrière à partir des % déjà définis, sans
  jamais les modifier.
- **Tranche d'état** `salesChannels` ajoutée partout où `productionActivities` existe déjà (même
  patron) : `projectReducer.js` (`SET_SALES_CHANNELS`), `projectSerialization.js` (migration : un
  projet antérieur reçoit un seul circuit « Vente directe » sans maillon — collapse au
  comportement actuel à prix unique), `initialState.js`, `App.jsx`/`ProjectContext`.
- **UI** : nouvelle section « Canaux de vente » dans Paramètres (`ProductInfo.jsx`), juste après
  « Lignes de production » — pas un onglet dédié (voir réordonnancement du 05/10). Gère la
  STRUCTURE de chaque circuit (nom, maillons réordonnables par ajout/suppression — nom, type
  marge/markup, %) ; ne calcule aucun $ ici (pas de coût de revient disponible dans ce contexte
  générique) — le rattachement format × circuit avec de vrais prix viendra en 3.2 dans Produits et
  SKUs. Garde-fou : au moins un circuit doit toujours exister (comme les lignes de production).
  Info-bulles (distinction markup/marge à chaque maillon) + guide d'utilisation mis à jour.
- Tests : 8 cas unitaires pour le moteur de cascade (ancrage au coût, ancrage ailleurs dans la
  chaîne, aucun maillon, cas limites 100 %/-100 %), 7 cas pour la migration/sérialisation de
  `salesChannels`. 1 nouveau test e2e **permanent** `e2e/sales-channels-params.spec.js` (canal,
  maillons, suppression avec garde-fou). **121/121 tests unitaires** (111 + 10), **19/19 tests
  e2e** (18 + 1), lint propre (0 erreur), `dist/` reconstruit.

### 3.2 — Prix et volumes par format × circuit — ✅ terminée le 05/10

Discussion méthodologique préalable (voir aussi `04-Conception-Modele.md`) :
- **Volume = nombre d'unités réelles**, pas un % (décision utilisateur — plus naturel, et plus
  simple à faire correspondre aux futurs rapports de vente importés, Phase 3.4).
- **Emplacement** : un accordéon repliable par format dans Produits et SKUs (pas une modale, pas
  un nouvel onglet) — choisi après avoir évalué 4 options, en fonction de la tâche réelle visée
  (mettre à jour le prix de tout un catalogue pour un nouveau canal, d'un coup, sans naviguer
  format par format). La colonne « Prix de vente ($) » disparaît, remplacée par un résumé
  « N canal(aux) » cliquable.
- **Un format peut n'être rattaché à AUCUN canal** (explicitement demandé — ex. un grand format
  réservé à la restauration, absent des canaux de détail).

Implémentation :
- **Modèle** : `format.prixVente` (un seul nombre) remplacé par `format.channelPrices` — un
  tableau `{ id, channelId, netPrice, volume }`, un par canal où ce format est vendu. Le PREMIER
  élément du tableau est le canal « principal » (étoile dans l'UI, promouvable) : son `netPrice`
  alimente en miroir `format.prixVente`, que `calculateCosts.js` continue de lire tel quel —
  **aucun changement au moteur de coût/marge dans cette sous-étape** (le coût ne varie pas par
  canal, seule la marge en dépendrait — ça, c'est la Phase 3.3). `volume` est capturé mais pas
  encore consommé par un calcul (la conversion en mix des ventes global est prévue en 3.3).
- Migration : un format existant sans `channelPrices` en reçoit un sur le canal `channel_default`,
  avec son ancien `prixVente` — comportement inchangé pour tout projet antérieur à cette phase.
- `App.jsx` : nouveau handler dédié `handleFormatChannelPricesChange` (remplace tout le tableau en
  un seul dispatch, avec le miroir `prixVente`) — pas deux appels à `handleFormatValueChange`, qui
  se seraient écrasés l'un l'autre (fermeture sur un `products` figé).
- Un nouveau format (« Ajouter un format ») démarre volontairement SANS canal attaché ; un nouveau
  PRODUIT démarre avec le canal par défaut (rattaché dès la création, sinon invisible partout).
- Tests : migration (`projectSerialization.test.js`, 2 nouveaux/mis à jour cas). 1 nouveau test e2e
  **permanent** `e2e/channel-prices-produits-skus.spec.js` (ajout, canal principal, retrait,
  format sans canal). Vérification manuelle (temporaire, supprimée) que le prix net édité ici se
  reflète bien dans le Récapitulatif de Recette & Calcul — confirmé. **121/121 tests unitaires**
  (inchangé en nombre, cas mis à jour), **20/20 tests e2e** (19 + 1), lint propre (0 erreur),
  `dist/` reconstruit.

### 3.3 — Propagation aux écrans consommateurs (marge par circuit, moteur channel-aware)

**Partie moteur — ✅ terminée le 06/10**
- `calculateCosts.js` : la section marges extraite en fonction pure exportée
  `computeMarginsForPrice(prixVente, costs)` — les coûts ne varient pas par canal, seul le prix en
  dépend, donc inutile de recalculer toute la fiche de coût par canal. `portionSize` ajouté au
  résultat de `calculateCosts` (nécessaire à `computeMarginsForPrice` appelée en dehors).
- Nouvelle fonction exportée `computeChannelBreakdown(costs, channelPrices, salesChannels)` :
  ventilation complète (prix net, volume, toutes les marges/%) par canal pour un format. Un canal
  supprimé depuis, ou sans prix net saisi, est **omis** (pas forcé à 0$) — leçon tirée du chiffrier
  SymbiOse de l'utilisateur (`06-Analyse-Chiffrier-SymbiOse.md`) : une grille produit × canal avec
  des canaux inutilisés à 0 $ génère des `#DIV/0!` en cascade dans son fichier réel ; une valeur
  absente doit rester absente, jamais un calcul forcé.
- `analysisData.js` : chaque ligne de `productsWithCosts` reçoit un `channelBreakdown` (nouveau
  paramètre `salesChannels`, optionnel, défaut `[]` — même convention que `basePackaging`).
  `CostShockSimulator.jsx` mis à jour en conséquence.
- Tests : 5 nouveaux cas dans `calculateCosts.test.js` (ventilation par canal, canal sans prix
  omis, canal supprimé omis, format sans canal), 2 dans `analysisData.test.js`. **128/128 tests
  unitaires** (121 + 7), **20/20 tests e2e** (inchangé, aucune UI encore branchée sur ce nouveau
  calcul), lint propre (0 erreur), `dist/` reconstruit.

**Partie UI — ✅ terminée le 06/10 (Recette & Calcul + Résumé).** Inspiration tirée du chiffrier
SymbiOse de l'utilisateur (`06-Analyse-Chiffrier-SymbiOse.md`), qui a déjà ce besoin résolu : un
rapport détaillé grille SKU × canal (« Rapport - Coût Revient unit. », « Rapport - Marges détails »)
et un dashboard consolidé séparé (« Rapport - Marges », le rapport final).

Répartition des responsabilités, décidée avec l'utilisateur (06/10) : **Recette & Calcul = coût de
production + marge brute** (ne dépend que du prix, calculable dès maintenant, par canal) ;
**Résumé « Par SKU » = marge nette** (dépend de l'allocation des frais fixes, qui deviendra
elle-même multi-canal seulement en Phase 4 — ce rapport gagnera en précision automatiquement à ce
moment-là, sans retouche).

- **`RecipeCalculator.jsx`** : nouveau bloc additif « Marge brute par canal » sous le récapitulatif
  existant (inchangé par ailleurs) — sélecteur de canal (affiché seulement si le format en a
  plusieurs), prix net, coût de production (`totalDirectCostPerPortion`, toujours identique peu
  importe le canal), marge brute $/%. N'apparaît pas en mode simulation de prix (combinerait deux
  axes de variation à la fois). Revient au canal principal à chaque changement de format.
- **`SummaryTable.jsx` (Résumé)** restructuré en deux sous-onglets : **« Par SKU »** (la table
  détaillée déjà existante, devenue multi-canal via un filtre — « Canal principal » par défaut,
  comportement inchangé ; un format non vendu dans le canal choisi s'affiche grisé « Non vendu dans
  ce canal », jamais à 0 $ forcé) et **« Vue d'ensemble »** (le dashboard de KPIs pondérés
  `StrategicAnalysis`, inchangé). `CostShockSimulator` reste visible en permanence, hors des
  sous-onglets (outil transversal). Le filtre par canal ne change QUE les colonnes dépendantes du
  prix (prix vente, % de coût, les 3 niveaux de marge) ; `Coût Total ($)` reste celui du canal
  principal dans tous les cas (invariant par canal).
- Tests : 2 nouveaux tests e2e **permanents** — `e2e/channel-margins-recette-calcul.spec.js`
  (bascule de canal met à jour prix net + marge brute) et `e2e/channel-filter-resume.spec.js`
  (sous-onglets + filtre par canal + état grisé « non vendu »). **128/128 tests unitaires**
  (inchangé), **22/22 tests e2e** (20 + 2), lint propre (0 erreur), `dist/` reconstruit.
- `TrackingTab.jsx`/rapports PDF/Excel : pas encore étendus au multi-canal — à faire si le besoin
  se confirme, une fois la Phase 4 (Frais fixes) en place pour une marge nette par canal vraiment
  fiable. Le **point mort par circuit** était alors différé en Phase 4.5 — *note du 06/10 : ce
  report s'est révélé inutile, voir le correctif « Refonte du 06/10 » plus bas, qui l'implémente
  avec l'allocation globale déjà disponible.*

### 3.4 — Refonte de l'import des ventes — ✅ terminée le 06/10

Détail validé avec l'utilisateur avant implémentation (voir `05-Imports-Integrations.md`) :
- **Canal non reconnu** dans le fichier → proposé à la **création** par défaut (comme un nouveau
  plat déjà aujourd'hui), avec possibilité de lier manuellement à un canal existant ou d'ignorer
  la ligne.
- **Format non reconnu** → **jamais** de création automatique (touche la recette, pas la vente) —
  seulement lier à un format existant du produit, ou ignorer la ligne.
- Doit fonctionner avec des exports comptables (QuickBooks, Odoo...), pas seulement un POS — mots-
  clés de correspondance de colonnes volontairement larges (« class », « location », « point of
  sale »...) ; un format source précis pourra être affiné plus tard sans toucher au modèle.

Implémentation :
- **`PosImportWizardModal.jsx` remplacé par `SalesReportImportWizardModal.jsx`** (ancien supprimé
  — pas de coexistence de deux mécanismes d'import des ventes). Agrège maintenant par (plat,
  format, canal) plutôt que par plat seul ; étape 3 ajoute une résolution par ligne pour le format
  et le canal (menus déroulants : lier à existant / créer un canal / ignorer la ligne), en plus du
  rattachement manuel à un plat existant déjà présent avant.
- **Import ADDITIF, pas un remplacement complet** : contrairement à l'ancien import (un seul
  export de caisse supposé représenter tout le menu, donc tous les produits non importés étaient
  remis à 0), un rapport de vente ne couvre généralement qu'UN canal/distributeur à la fois — les
  entrées `channelPrices` des formats non mentionnés dans le fichier restent intactes.
- **`src/engine/salesMixFromChannels.js`** (nouveau, pur, testé) : `computeSalesMixFromChannelPrices`
  redéduit le `salesMix` de CHAQUE format à partir du volume total de ses `channelPrices` (tous
  canaux confondus), en part du volume total de tout le menu — remplace le mix à plat saisi par
  l'ancien import. Utilisé par l'import (avec le chiffre d'affaires total, lui aussi re-dérivé des
  volumes réels) ; **pas** câblé dans l'édition manuelle d'un prix par canal dans Produits et SKUs
  (ça écraserait silencieusement un `salesMix` existant et valide tant qu'aucun volume n'est
  encore saisi nulle part — voir commentaire dans `App.jsx`, `handleFormatChannelPricesChange`).
- **Correctif (trouvé en testant)** : `window.XLSX.read` sans option `codepage` lit un `.csv`
  accentué en Latin-1 par défaut, corrompant les noms (« Suprême » → « SuprÃªme ») et faisant
  rater silencieusement la correspondance avec un plat existant (aurait créé un doublon). Corrigé
  avec `codepage: 65001` (UTF-8) dans `SalesReportImportWizardModal.jsx` **et**
  `CatalogImportWizardModal.jsx` (même bug latent, même origine).
- Bouton renommé « Importer depuis POS » → « Importer un rapport de ventes » ; guide d'utilisation
  mis à jour.
- Tests : 5 cas unitaires pour `computeSalesMixFromChannelPrices`. 1 nouveau test e2e
  **permanent** `e2e/sales-report-import.spec.js` — téléverse un vrai `.csv` (accentué), vérifie
  la résolution du format/canal à l'étape 3, confirme l'import, et vérifie le canal créé +
  `channelPrices` mis à jour dans Produits et SKUs. **133/133 tests unitaires** (128 + 5),
  **23/23 tests e2e** (22 + 1), lint propre (0 erreur), `dist/` reconstruit.

**Révision du 06/10 — coexistence % manuel / unités dans `salesMix`.** Retour utilisateur :
l'app doit rester utilisable sans jamais toucher aux canaux — le mix des ventes en % saisi à la
main (comportement historique) devait donc rester un mode de saisie à part entière, pas remplacé
par les unités.
- `computeSalesMixFromChannelPrices` révisé : détecte automatiquement, PAR FORMAT, s'il est en
  mode « % manuel » (jamais d'unité saisie — valeur intacte, jamais touchée) ou « unités » (au
  moins une unité saisie quelque part dans ses `channelPrices[]` — % **déduit automatiquement**,
  plus précis). Les formats « unités » se partagent le reste du 100 % une fois la somme des %
  manuels retirée, au prorata de leurs unités réelles. Si les % manuels occupent déjà tout
  l'espace, un format qui bascule en unités obtient 0 % jusqu'à ce que l'utilisateur fasse de la
  place manuellement — pas de vol silencieux de part ; l'avertissement existant (somme ≠ 100 %)
  reste le signal visible de ce cas.
- Devenu sûr à appliquer EN DIRECT sur chaque édition de prix/volume par canal dans Produits et
  SKUs (`handleFormatChannelPricesChange`), plus seulement à l'import — un format encore en %
  manuel n'est jamais écrasé.
- `ProductInfo.jsx` : le champ % d'un format en mode « unités » devient désactivé (lecture seule),
  avec une info-bulle expliquant pourquoi et comment reprendre la main (retirer les unités).
- Tests : 5 nouveaux cas unitaires pour la coexistence (manuel intact, partage du reste au
  prorata, 0 % si plus de place). 1 nouveau test e2e **permanent**
  `e2e/sales-mix-units-coexistence.spec.js`. **137/137 tests unitaires** (133 + 4 net),
  **24/24 tests e2e** (23 + 1), lint propre (0 erreur), `dist/` reconstruit.

**Correctif du 06/10 — la marge nette restait affichée par SKU dans Recette & Calcul.** Retour
utilisateur : la révision de 3.3 avait seulement AJOUTÉ un bloc « Marge brute par canal », sans
retirer les trois anciennes tuiles de marge (Contribution/Coût primaire/Nette, toujours liées au
canal principal) — contradiction avec la décision du 06/10 (Recette & Calcul = coût de production
+ marge brute SEULEMENT, la marge nette vit dans Résumé → Par SKU). Corrigé :
- Tuile « Marge Nette » **retirée** du récapitulatif de Recette & Calcul.
- Le sélecteur de canal déplacé en haut du récapitulatif, pilote maintenant TOUT ce qui dépend du
  prix dans cette section : les 4 % de coût, Marge de contribution, Marge brute (= coût primaire)
  et Prix de Vente — plus seulement un bloc séparé en bas de page (fusionné dans la grille
  existante, bloc dédié retiré).
- Hors simulation de prix (comportement inchangé pendant une simulation, toujours ancré sur le
  canal principal).
- Test e2e `channel-margins-recette-calcul.spec.js` mis à jour pour vérifier l'absence de la tuile
  Marge Nette et la réactivité de l'ensemble du récapitulatif au changement de canal.

**Demande du 06/10 — simulateur de chocs dans son propre sous-onglet.** `SummaryTable.jsx` gagne
un 3e sous-onglet **« Simulation »** (à côté de Par SKU / Vue d'ensemble). `CostShockSimulator`
reçoit une nouvelle prop `collapsible` (défaut `true`, comportement inchangé partout ailleurs) ;
à `false` dans ce sous-onglet, le contenu s'affiche directement — être dans l'onglet est déjà le
geste d'ouverture, plus besoin de redéplier derrière un second clic.

**137/137 tests unitaires, 24/24 tests e2e** (après mise à jour de `smoke.spec.js` pour la nouvelle
navigation du simulateur), lint propre (0 erreur), `dist/` reconstruit.

**Phase 3 (Circuits de vente) est maintenant complète** : 3.1 (modèle + moteur de cascade) → 3.2
(prix/volumes par format × circuit) → 3.3 (marge par circuit, moteur + UI Recette & Calcul/Résumé)
→ 3.4 (import des ventes par canal + coexistence %/unités du mix des ventes) → correctifs du 06/10
(marge nette retirée de Recette & Calcul, sous-onglet Simulation dans Résumé).

**Refonte du 06/10 — séparation nette coût de production / marge, et Résumé → Par SKU devient une
vraie fiche par SKU.** Retour utilisateur : même après le correctif ci-dessus, Recette & Calcul
restait encombré de notions qui n'y ont pas leur place (frais indirects, point mort — des concepts
qui dépendent des frais fixes, donc de l'analyse globale, pas de la recette elle-même). Et le
sous-onglet « Par SKU » de Résumé, malgré son nom, affichait un tableau de TOUS les SKU — pas un
résumé d'UN SEUL SKU comme le fait le chiffrier SymbiOse de l'utilisateur (voir
`06-Analyse-Chiffrier-SymbiOse.md`). Décision : le point mort par circuit n'a pas besoin d'attendre
l'allocation par canal de la Phase 4.2 — l'allocation GLOBALE actuelle
(`generalInfo.totalIndirects × salesMix%`) suffit déjà à produire un point mort différent par
canal, puisque seul le dénominateur (la marge brute du canal) change. La section 4.5 ci-dessous,
qui différait ce calcul, est donc **retirée** : c'est fait.
- **Moteur** (`calculateCosts.js`) : `computeChannelBreakdown` accepte un 4e paramètre
  `allocatedIndirects` et calcule `breakEvenUnits` par canal
  (`Math.ceil(allocatedIndirects / margeBruteDollar)`, `null` si non fourni ou marge ≤ 0).
  `analysisData.js` calcule cette allocation par format (même formule que l'ancien
  `breakEvenForProduct` de `RecipeCalculator.jsx`) et la transmet. 3 nouveaux tests (engine +
  intégration).
- **Recette & Calcul** (`RecipeCalculator.jsx`) : ne montre plus que le **coût de production**
  (matière + emballage + MO + sous-traitance, `totalDirectCostPerPortion`, en une seule tuile
  centrée) et la **marge brute** — plus de tuile Coût Indirect (%), plus de ligne Coût de Revient
  Total, plus de bloc Point Mort. Le sélecteur de canal en haut du récap pilote toujours tout ce
  qui dépend du prix.
- **Résumé → Par SKU** (`SummaryTable.jsx`) : devient une fiche d'**UN SEUL SKU** sélectionné via
  un menu déroulant, montrant sa cascade de coûts à travers chacun de ses canaux (Volume, Prix net,
  Marge brute, Frais indirects alloués, Marge nette, **Point mort** — en évidence) — inspiré du
  rapport détaillé SymbiOse (grille SKU × canal), avec les couleurs de marge et infobulles déjà en
  place ailleurs dans l'app. Message d'état vide si le SKU n'a aucun canal rattaché.
- **Résumé → Vue d'ensemble** : absorbe l'ancien tableau « Par SKU » (toutes les lignes, triable/
  paginable/filtrable par canal — inchangé) ET le graphique de contribution aux frais fixes, en
  plus du dashboard d'analyse stratégique déjà présent — à la demande explicite de l'utilisateur
  après avoir vu la première version du sous-onglet.
- Tests e2e : `channel-filter-resume.spec.js` et `summary-format-navigation.spec.js` mis à jour
  pour naviguer vers « Vue d'ensemble » avant d'interagir avec le tableau détaillé/le filtre par
  canal (ce contenu n'est plus affiché par défaut sous Résumé).
- **140/140 tests unitaires, 24/24 tests e2e**, lint propre (0 erreur, warnings préexistants
  inchangés), `dist/` reconstruit.

**Correctif visuel du 06/10 — « Par SKU » ne correspondait toujours pas au visuel demandé.**
Retour utilisateur avec capture du chiffrier SymbiOse (onglet « Rapport - Coût de revient unit. »)
à l'appui : le sous-onglet devait reproduire sa structure par groupes de lignes, canaux en
COLONNES (pas en sections). Corrigé dans `BySkuWaterfall` (`SummaryTable.jsx`) :
- Table réorganisée en 4 groupes de lignes avec en-tête de section (gras/italique, fond gris),
  comme le chiffrier : **Revenu et marge brute** (Prix net, Bénéfice brut, Marge brute) →
  **Répartition des charges fixes** (Frais fixes totaux par unité — pas encore ventilé par ligne de
  production/canal, prévu Phase 4.2) → **Coût net et marge nette** (Coût net, Bénéfice net, Marge
  nette) → **Seuil de rentabilité par canal de vente** (Volume, Revenu total, Dépenses totales,
  Bénéfice/Perte, Point mort). Les groupes « Frais de mise en marché » et la ventilation des
  charges fixes par canal/ligne de production du chiffrier original ne sont volontairement pas
  repris (pas encore modélisés) ; les frais d'expédition sont absorbés dans les frais fixes plutôt
  que traités à part, à la demande de l'utilisateur.
- Revenu total / Dépenses totales / Bénéfice-Perte : simple arithmétique (`netPrice × volume`,
  etc.) à partir des champs déjà présents dans `channelBreakdown` — aucun nouveau calcul moteur
  nécessaire.
- **Vue d'ensemble** : titre « Tableau détaillé par SKU » ajouté au-dessus du tableau multi-SKU ;
  colonnes M. contrib. ($/%) et M. coût prim. ($/%) retirées pour l'alléger (ces paliers
  intermédiaires restent visibles en détail dans Par SKU) — le tableau passe de 13 à 9 colonnes.
- **Analyse stratégique** : la grille de 5 indicateurs passe de `grid-cols-3` (qui laissait la
  dernière ligne de 2 tuiles collée à gauche) à `flex flex-wrap justify-center`, pour que cette
  dernière ligne reste centrée.
- Vérification visuelle via capture d'écran Playwright (page Résumé, sous-onglets Par SKU et Vue
  d'ensemble) en plus du cycle de tests habituel. **140/140 tests unitaires, 24/24 tests e2e**,
  lint propre, `dist/` reconstruit.

**Deuxième correctif visuel du 06/10 — ajustements fins après capture d'écran du chiffrier
SymbiOse (onglet « Rapport - Marges » cette fois) :**
- **Par SKU** : les 4 lignes Volume/Revenu total/Dépenses totales/Bénéfice-Perte retirées de la
  section « Seuil de rentabilité par canal de vente » (redondantes, pas utiles d'après
  l'utilisateur) — ne reste que le Point mort, mis en évidence.
- **Par SKU** : la tuile « Emballage + MO + S-T » éclatée en tuiles séparées **Emballage**,
  **Main-d'œuvre**, et **Coûts additionnels** (renommée — « S-T » = sous-traitance, terme confus
  hors contexte). Cette dernière ne s'affiche QUE si `costSubcontractingPerPortion > 0`, et son
  titre devient le nom de l'opération/du sous-traitant saisi (`format.subcontracting.items`) plutôt
  que l'intitulé générique — plusieurs opérations sont jointes par « + ».
- **Recette & Calcul** : couleurs des sections « 2. Emballage » et « 4. Coûts additionnels »
  permutées (rose ↔ orange) à la demande de l'utilisateur.
- **Vue d'ensemble** : l'ancien tableau détaillé triable/paginable à un seul canal à la fois
  (avec son filtre `#summaryChannelFilter`) est **remplacé** par une matrice SKU × canal —
  **« Marges nettes des SKUs par canaux »** — inspirée du rapport « Marges » du chiffrier SymbiOse :
  une colonne par canal de vente (`salesChannels`, tous affichés simultanément — le filtre devient
  inutile), cellule = marge nette (%) de ce SKU dans ce canal, teinte verte/rouge à l'intensité de
  la marge (réutilise `getMarginCellStyle`), « — » si le SKU n'est pas vendu dans ce canal (jamais
  un 0 % forcé). Positionnée sous le graphique « Classement par contribution totale au profit »
  (demande explicite). Pas de regroupement « Vente directe / Vente au détail » en en-tête comme
  dans le chiffrier original : `salesChannels` ne modélise pas encore de type de canal.
- Code mort retiré avec l'ancien tableau : `getRowView`, `getMarginStyle`, `getCostTargetStyle`,
  `headers`, `selectedChannelId`.
- Tests e2e : `channel-filter-resume.spec.js` réécrit pour la matrice (plus de filtre par canal) ;
  `packaging-tracking-totals.spec.js` mis à jour pour la couleur orange de la section Emballage.
  Vérification visuelle par capture d'écran Playwright (Par SKU, Vue d'ensemble, Recette & Calcul,
  et un SKU avec sous-traitance activée pour confirmer l'affichage conditionnel/le nom dynamique de
  la tuile). **140/140 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Nouveau projet démo du 06/10 — remplacement complet de « Bistro Le Local ».** Demande explicite
de l'utilisateur : le projet démo chargé par « Explorer un projet démo » (`getDefaultState`,
`initialState.js`) devait LUI-MÊME devenir l'exemple de transformation alimentaire construit plus
tôt ce jour-là (d'abord livré à tort comme un fichier `.json` séparé à ouvrir) — pas un second
exemple à côté de l'ancien restaurant.
- **Bistro Le Local entièrement retiré** : ingrédients, emballage, main-d'œuvre, produits,
  `PRICE_PROFILES`/`PACKAGING_PRICE_PROFILES` — remplacés par **Boréal Mets Préparés inc.**
  (mets préparés congelés, 3 lignes de production, 3 canaux de vente, 18 ingrédients, 8 emballages,
  4 postes de MO dont 2 avec plusieurs employés, 11 produits/13 formats) — voir le détail dans le
  rapport de statut (lien plus bas).
- **11 tests e2e cassés par le changement de données**, corrigés un par un (noms de produits/
  emballages substitués par leurs équivalents du nouveau menu) : `channel-filter-resume`,
  `packaging-abc-import`, `packaging-recipe-integration`, `packaging-reports`,
  `packaging-tracking-totals`, `product-duplication` (×2 cas), `sales-mix-units-coexistence`,
  `sales-report-import` (+ sa fixture CSV), `summary-format-navigation`, `unit-type-quantity`.
- **Trois bugs de fond révélés par cette migration** (pas seulement des noms à substituer) :
  - `fmt.prixVente` doit mirorer `channelPrices[0].netPrice` (convention tenue par l'UI, pas par le
    moteur) — oublié dans la construction programmatique des données, ce qui faussait l'Analyse
    stratégique (prix à 0 $ pour le calcul "canal principal"). Corrigé par une passe de
    normalisation explicite après la définition des produits.
  - Le mix des ventes en % devient automatiquement « verrouillé » (mode unités) dès qu'un format a
    un volume non nul sur au moins un canal (voir `salesMixFromChannels.js`) — or TOUS les formats
    du nouveau menu avaient des volumes par défaut, rendant le mode « % manuel » totalement
    inaccessible dans la démo. Un format (Sauce à spaghetti maison) est désormais délibérément à
    volume nul partout, pour que les deux modes coexistent réellement dans l'exemple.
  - Le lot de `sub_bouillon` (bouillon de poulet maison) était initialement beaucoup trop petit
    (8 L) pour son temps de cuisson (2 h), donnant un coût/litre ×4 trop élevé une fois propagé aux
    soupes qui l'utilisent — corrigé en portant le lot à 40 L (même temps de cuisson, coût
    main-d'œuvre amorti sur un vrai volume de production).
- **Fragilité de tests révélée en cours de route** (indices `nth(1)` qui supposaient à tort qu'un
  format n'avait qu'un seul canal avant ajout, ou qu'un produit dupliqué resterait au même index
  après le retri alphabétique de la liste) : corrigée en ciblant soit `.last()`, soit une valeur de
  champ exacte (jamais un index recalculé après une action qui réordonne la liste).
- **140/140 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Correctif du 06/10 — mix des ventes du projet démo à 109 %.** Retour utilisateur : le bandeau
d'avertissement (« devrait être de 100 % ») restait visible. Les 12 formats actifs du nouveau menu
démo sommaient 109 % — rééquilibrés proportionnellement (facteur ≈0,917, arrondis à l'entier en
ajustant pour retomber exactement sur 100 %) : Chili 16→15, Pâté chinois 14→13 / 5 (inchangé),
Tao 10→9, Saumon 9→8, Thaï 9→8 / 4 (inchangé), Soupe-repas 10→9, Potage 8→7, Sauce à spaghetti
13→12, Sauce du Terroir 7→6, Purée 4 (inchangée). Vérifié que ce rééquilibrage ne fait flancher
aucun test (aucun ne vérifie une valeur de mix précise du menu démo).

**Demandes du 06/10 — Prix de détail suggéré (PDS) dans Produits et SKUs, et ajustements de
Résumé/Rapport.**
- **Produits et SKUs — accordéon des canaux** : titres de colonnes ajoutés au-dessus de la liste
  des canaux d'un format (Canal / Prix net ($) / PDS ($) / Volume (u.)). Nouveau champ **PDS** par
  canal, calculé automatiquement à partir du prix net et de la cascade de maillons du canal
  (`computeSalesChannelCascade`, `salesChannelCascade.js` — Phase 3.1, jusqu'ici jamais branché à
  l'UI) : ancré sur le prix net (maillon 0), projeté vers l'avant jusqu'au dernier maillon. Un canal
  sans maillon (ex. vente directe) donne PDS = prix net. Modifiable à la main ; une fois modifié,
  reste figé (`pdsManual`, nouveau champ sur `channelPrices[]`) même si le prix net change ensuite —
  ne se recalcule plus jamais automatiquement tant que l'utilisateur ne l'a pas lui-même retiré/
  resaisi à vide.
- **Résumé renommé « Rapport »** (titre de l'onglet de navigation uniquement — le contenu de la
  page et ses sous-onglets restent les mêmes). Mentions correspondantes mises à jour dans le guide
  intégré (`InstructionModal.jsx`).
- **Ordre des sous-onglets inversé** : « Vue d'ensemble » est maintenant le premier et actif par
  défaut (était « Par SKU »).
- **Par SKU** : le libellé de la ligne de seuil de rentabilité simplifié de « Point mort (seuil de
  rentabilité) » à « Point mort » (le nom de la section au-dessus, « Seuil de rentabilité par canal
  de vente », suffit à donner le contexte).
- Tests e2e mis à jour pour le nouveau nom d'onglet et le nouvel ordre des sous-onglets
  (`channel-filter-resume.spec.js`, `summary-format-navigation.spec.js`). Vérification visuelle par
  capture d'écran Playwright du PDS auto-calculé (avec et sans cascade), de la bascule en mode
  manuel figé, et du nouvel ordre des sous-onglets.
- **140/140 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Demandes du 06/10 — tri par canal dans la matrice, objectif coût d'emballage, et diagnostic
BCG/contribution.**
- **Marges nettes des SKUs par canaux** : chaque colonne de canal devient triable (clé
  `channel:<id>`, résolue dans `sortedProducts` via le `channelBreakdown` de la ligne) — un SKU non
  vendu dans ce canal (« — ») reste toujours en fin de liste, peu importe le sens du tri, jamais
  traité comme 0 %.
- **Objectifs stratégiques** (Paramètres) : nouveau champ **Objectif coût d'emballage (%)**
  (`generalInfo.packagingCostTarget`), entre coût matière et coût main-d'œuvre. Indicateur ✓/⚠️
  câblé aux deux endroits qui l'utilisaient déjà pour les deux autres postes : la tuile « Coût
  Emballage Moyen Pondéré » de Vue d'ensemble, et la tuile « Coût Emballage (%) » du récapitulatif
  de Recette & Calcul (qui n'avait jamais eu d'indicateur). Valeur par défaut du projet démo : 8 %.
**Correctif du 06/10 — KPIs pondérés, BCG et contribution devenus « channel-aware ».** Suite du
diagnostic ci-dessus : retour utilisateur — modifier le prix net d'un format sur un canal AUTRE que
le canal principal ne bougeait ni le classement par contribution, ni la matrice BCG, ni les KPIs
pondérés, parce que ces trois vues lisaient `p.costs`/`p.prixVente` (construits une seule fois par
`calculateCosts()` à partir de `fmt.prixVente`, mirroir du *canal principal* seulement), jamais
`p.channelBreakdown`. Décisions de l'utilisateur sur les 3 options proposées : KPIs pondérés →
recalculés (option A) ; contribution → somme réelle par canal (option B) ; BCG → une 3e option,
proposée par l'utilisateur et retenue après validation : un sélecteur de canal dédié, pour une
analyse BCG « tous canaux » OU limitée à un seul.
- **`analysisData.js`** : nouvelle fonction `blendAcrossChannels(costs, channelBreakdown)` — combine
  les coûts/marges d'un SKU à travers TOUS ses canaux, pondérés par le volume RÉEL de chacun
  (`channelBreakdown[].volume`) ; repli exact sur `costs` (canal principal) si aucun canal n'a de
  volume renseigné (aucune régression sur les projets/tests existants, qui ne peuplent pas toujours
  `channelPrices`). Attachée à chaque ligne de `productsWithCosts` (`row.blended`).
  - **KPIs pondérés** (Coût Matière/Emballage/MO Moyen Pondéré, Marge Brute Moyenne Pondérée, Point
    Mort du Menu Analysé) : utilisent désormais `p.blended.*` au lieu de `p.costs.*`.
  - **Contribution** : somme réelle `channelBreakdown[].volume × margeBruteDollar` à travers tous
    les canaux d'un SKU (cohérent avec son titre « contribution **totale** ») ; repli sur l'ancienne
    estimation (unités reconstruites × marge canal principal) si aucun volume réel n'est renseigné.
  - **BCG** : nouvelle fonction pure exportée `computeMenuEngineeringQuadrants(rows)` — classe une
    liste déjà réduite à `{ id, displayName, popularity, margeBruteDollar, volume }`, réutilisable
    aussi bien pour la vue « tous canaux » par défaut (moteur, pondérée via `blendAcrossChannels`)
    que pour un canal précis (recalculée côté client, voir plus bas), sans jamais relancer tout le
    pipeline `computeAnalysisData`.
- **`SummaryTable.jsx` — Analyse stratégique** : nouveau sélecteur « Analyse BCG pour : » (Tous les
  canaux / un canal précis). Un canal choisi recalcule popularité (part du volume propre à CE canal,
  pas le mix global) et marge (`channelBreakdown` de ce canal) pour chaque SKU qui y est vendu — un
  SKU absent de ce canal est exclu (jamais forcé à 0). Permet de voir qu'un SKU peut être une étoile
  en vente directe et un poids mort en grande surface, l'intérêt même de la proposition retenue.
- Tests e2e inchangés (144/144 tests unitaires inclut 5 nouveaux : pondération par canal des KPIs,
  somme réelle de la contribution, et `computeMenuEngineeringQuadrants` isolée). Vérification
  visuelle par capture d'écran Playwright reproduisant le scénario rapporté (prix à 2250 $ sur un
  canal secondaire) : la contribution, la matrice BCG et les KPIs pondérés réagissent désormais
  immédiatement ; le sélecteur de canal BCG isole correctement un seul canal.
- **144/144 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Investigation du 07/10 — un SKU « poids mort » en tous-canaux mais jamais en poids mort par
canal.** Retour utilisateur : pourquoi « Purée de pommes de terre maison » apparaît en poids mort
quand on sélectionne tous les canaux, mais jamais en poids mort dans aucune analyse limitée à un
seul canal ? Deux causes distinctes identifiées, via un script Vitest temporaire chargeant le
projet démo réel (supprimé après usage) :
- **Bug de données du projet démo (corrigé) :** les `salesMix` saisis à la main dans
  `initialState.js` n'avaient jamais été repassés par `computeSalesMixFromChannelPrices` — la
  fonction que l'app applique automatiquement à chaque édition de `channelPrices` (voir
  `App.jsx` → `handleFormatChannelPricesChange`). Résultat : les `salesMix` du démo étaient
  incohérents avec les volumes par canal réellement saisis, une situation qui ne peut pas survenir
  via un usage normal de l'UI. Corrigé : les `salesMix` de 11 formats (produit + format, deux
  occurrences chacun) recalculés pour correspondre exactement à ce que
  `computeSalesMixFromChannelPrices` en déduit (ex. Purée : 4 → 5.36). Le 12e format actif, « Sauce
  à spaghetti maison », reste inchangé à 12 % — c'est le seul en mode 100 % manuel (volume nul sur
  tous les canaux), conservé tel quel par conception pour démontrer la coexistence des deux modes.
  Somme totale toujours 100 % (88 recalculés + 12 manuel).
- **Effet structurel, pas un bug (expliqué à l'utilisateur) :** même avec `salesMix` parfaitement
  synchronisé, 3 SKUs (Purée, Potage à la courge musquée, Sauce artisanale du Terroir) restent
  classés « poids mort » en tous-canaux tout en étant « vache à lait » dans CHACUN des 3 canaux
  pris séparément. Cause : la popularité « tous canaux » (`salesMix`) mesure une part du menu
  GLOBAL, dilué par le 12 % fixe de Sauce à spaghetti (qui réduit le pool disponible aux 11 autres
  formats à 88 %, même si elle n'apparaît dans le volume réel d'aucun canal) ; la popularité par
  canal, elle, se calcule fraîchement sur SEULEMENT les SKUs réellement vendus dans ce canal (pas
  de dilution par un produit à volume nul). Un SKU peut donc dépasser le seuil de son propre
  groupe de comparaison (plus petit, non dilué) par canal, tout en restant sous le seuil du groupe
  combiné, plus dilué, de la vue tous-canaux — un effet d'agrégation légitime (apparenté au
  paradoxe de Simpson), pas une erreur du moteur.
- Script d'investigation (`_debug-bcg-investigate.test.js`) supprimé après usage, conformément à la
  convention établie dans cette session (fichiers `_debug-*` temporaires, jamais conservés).
- **144/144 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Correctif du 07/10 — popularité « tous canaux » redéfinie sur le volume RÉEL (plus salesMix).**
Suite à l'effet structurel ci-dessus, retour utilisateur : si ça permet des analyses BCG exactes,
corriger. Décision : la popularité de la vue « tous canaux » utilise désormais le volume RÉEL
agrégé à travers tous les canaux d'un SKU (`p.blended.totalVolume`, déjà calculé par
`blendAcrossChannels`) — exactement la même base que chaque vue limitée à un seul canal, qui n'a
jamais utilisé `salesMix`. Élimine complètement l'effet de dilution par les formats en mode
manuel (aucune donnée de volume réel), puisque chaque popularité se calcule maintenant sur le même
type de grandeur (unités réellement vendues) quel que soit le périmètre choisi.
- **`analysisData.js`** : nouvelle variable `totalRealVolumeAllChannels` (somme de
  `p.blended.totalVolume` sur tous les `activeProducts`). Si > 0, popularité d'un SKU =
  `p.blended.totalVolume / totalRealVolumeAllChannels × 100` et son `volume` (pour le seuil de
  rentabilité pondéré) = `p.blended.totalVolume`. Repli exact sur l'ancien calcul (`salesMix` +
  unités reconstruites du revenu total) UNIQUEMENT si AUCUN produit actif n'a de volume réel sur
  aucun canal (projet sans circuits de vente, anciens tests) — aucune régression, les 144 tests
  existants (qui ne définissent pas de `channelPrices` pour leurs scénarios BCG) passent sans
  modification.
- Effet pour un format en mode 100 % manuel (volume nul sur tous les canaux, ex. « Sauce à
  spaghetti maison » du démo) : sa popularité « tous canaux » devient 0 % (il n'a mesurément aucun
  volume réel), alors qu'avant il occupait artificiellement 12 % via son `salesMix` fixe — c'est le
  comportement correct et attendu selon la méthodologie BCG/menu engineering classique (la
  popularité mesure des unités réellement vendues, pas une estimation manuelle).
- **`SummaryTable.jsx`** : infobulle du sélecteur de canal BCG et commentaire mis à jour pour
  refléter que la popularité « tous canaux », comme la marge, vient désormais du volume réel.
- Tests : 2 nouveaux cas dans `analysisData.test.js` (popularité réelle vs salesMix dilué — un SKU
  suivi par canal à 1000 unités réelles mais 10 % de salesMix dilué obtient ~100 % de popularité,
  pas 10 % ; et le repli rétrocompatible quand aucun canal n'a de volume). Vérifié sur le projet
  démo réel (script temporaire, supprimé après usage) : les 3 SKUs auparavant incohérents (Purée,
  Potage à la courge musquée, Sauce artisanale du Terroir) sont désormais classés « vache à lait »
  en tous-canaux ET dans chacun des 3 canaux — cohérence totale retrouvée.
- **146/146 tests unitaires (144 + 2), 24/24 tests e2e**, lint propre, `dist/` reconstruit.

**Correctif du 07/10 — un SKU sans AUCUN volume réel est EXCLU de la matrice BCG, jamais forcé à
0 %.** Retour utilisateur : un produit qui n'est pas vraiment vendu (son exemple : la Sauce à
spaghetti maison, qu'il pensait être une sous-recette) ne devrait pas apparaître dans la matrice,
car ça fausse les résultats. Précision apportée : dans le projet démo, ce produit n'est pas
techniquement une sous-recette (`isIngredient: false`) — c'est un produit du menu démo gardé
volontairement à 0 volume réel sur tous les canaux pour illustrer le mode manuel du mix des
ventes. Mais le principe soulevé est juste et plus général : un SKU sans aucune donnée de volume
réel n'a tout simplement pas de performance de vente à classer, et l'inclure avec 0 % de
popularité (comme le correctif précédent le faisait) fausse quand même le seuil de popularité des
AUTRES SKU, puisque ce seuil se calcule sur `rows.length` (plus de lignes = seuil plus bas pour
tout le monde, même si le $ de marge moyen pondéré n'était lui pas affecté par un SKU à volume
nul).
- **`analysisData.js`** : `menuEngineeringCandidates` filtre `activeProducts` pour exclure tout
  SKU dont `p.blended.totalVolume <= 0`, UNIQUEMENT quand des données de volume réel existent par
  ailleurs pour le menu (`totalRealVolumeAllChannels > 0` — sinon le filtre viderait la matrice en
  entier pour tout projet n'utilisant pas les circuits de vente, repli inchangé dans ce cas).
- **`SummaryTable.jsx`** : même principe appliqué à la vue par canal — un `channelBreakdown` avec
  un prix saisi mais un volume de 0 (prix préparé pour un canal où rien n'a encore été vendu) est
  désormais exclu lui aussi, pas seulement les canaux totalement absents du `channelBreakdown`.
- Vérifié sur le projet démo réel (script temporaire, supprimé après usage) : la Sauce à spaghetti
  maison n'apparaît plus ni en tous-canaux, ni dans aucun des 3 canaux (11 SKU sur 12 actifs dans
  la matrice tous-canaux désormais, au lieu de 12).
- Test `analysisData.test.js` mis à jour (le SKU en mode manuel sans volume réel est maintenant
  absent des quadrants, plutôt que présent à 0 % de popularité).
- **146/146 tests unitaires, 24/24 tests e2e**, lint propre, `dist/` reconstruit.

---

## Phase 4 — État des résultats (ex-« Frais fixes » 05/10, ex-« Comptabilité »)

Renommée une 2e fois le 12/10 (ex-« Frais fixes ») : la portée s'élargit des frais fixes seuls à un
état de résultats réel complet (revenus, charges directes, frais fixes) avec réconciliation contre
le modèle théorique de recettes — voir ci-dessous. Toujours pas une comptabilité complète (pas
d'AR/AP, pas de taxes), mais plus large qu'une simple catégorisation de dépenses.

**Méthodologie revalidée le 12/10** avant de démarrer l'implémentation : relecture directe des
formules de l'Agro-Calculateur MAPAQ (onglet `Rev-Dep`) et du chiffrier SymbiOse (`6 - Rep. charges
fixes`, `Rapport - Coût Revient unit.`), confrontées aux règles de comptabilité de gestion. Détail
complet et justification dans `04-Conception-Modele.md` (section Activité de production) ; résumé
des décisions qui en découlent :
- **Montant $ manuel = méthode principale** de répartition par poste de dépense (vérifiée en temps
  réel, comme la colonne VÉRIFICATION de SymbiOse), une clé prédéfinie/personnalisée n'étant qu'un
  raccourci optionnel de pré-remplissage — pas l'inverse.
- **« Général » n'est pas un 3e axe symétrique à Activité/Canal** : c'est une allocation directe au
  produit à une seule étape (pas de regroupement intermédiaire), justifiée comptablement comme un
  coût « facility-sustaining » (ABC) — contrairement à Activité/Canal, qui exigent un pool
  intermédiaire reconverti en taux. Le MAPAQ n'a pas besoin de cette catégorie (une seule dimension
  de regroupement, sa clé « ventes » jouant déjà ce rôle neutre).
- **Conversion du pool canal en taux par unité, mécanisme ajouté** (absent du plan précédent) :
  taux plat = pool du canal ÷ volume total vendu dans ce canal, avec moyenne pondérée via
  `blendAcrossChannels` (Phase 3) pour un format vendu par plusieurs canaux.

**2e revalidation le 12/10**, après la 4.1 : pourquoi se limiter aux frais fixes ? Détail complet
dans `04-Conception-Modele.md` (section 1bis) ; résumé :
- **Revenus réels, nouvelle section** — même patron que les frais fixes, mais seulement
  Général/Activité (pas de canal éditable : un revenu vient toujours d'une activité précise, ou de
  Général pour un revenu non rattachable à un produit modélisé — remplace
  `menuRevenuePercentage`). Le canal reste affiché, mais **dérivé automatiquement** (indicatif
  seulement, jamais dans un calcul) à partir du `channelBreakdown` théorique de l'activité.
- **Charges directes réelles, nouvelle section** — ventilées par type (Matière première,
  Main-d'œuvre directe, Emballage, Sous-traitance — vocabulaire déjà utilisé par
  `calculateCosts.js`), pas par les 4 catégories de frais fixes. Toute clé de répartition qui s'en
  servirait utilise le total agrégé, jamais la ventilation par type (diagnostic seulement).
- **Tableau de réconciliation réel/théorique** — compare, au niveau de l'entreprise, le réel saisi
  au théorique implicite du modèle de recettes. Rigoureux au niveau entreprise ; au niveau activité,
  partiellement circulaire (la répartition utilise déjà le mix théorique) donc présenté comme
  indicatif.
- **`generalInfo.menuRevenuePercentage` disparaît** — remplacé par une ligne de revenu « Général ».
  Touche 9 fichiers, retrait à faire proprement (pas en silence).
- **Onglet renommé « État des résultats »** (ex-« Frais fixes », qui en devient une sous-section).

### 4.1 — État de résultats catégorisé — ✅ terminée le 12/10
- Nouveau tableau `expenseLines` (racine de l'état, même patron que `productionActivities`/
  `salesChannels`) : une ligne = `{ id, label, category, amount }`, catégorie parmi les 4 retenues
  (`EXPENSE_CATEGORIES`, `utils.js`). Remplace l'ancien champ unique `generalInfo.totalIndirects`
  comme donnée saisie — ce champ reste présent mais devient **entièrement dérivé** (`sumExpenseLines`),
  jamais ressaisi directement : un seul point d'écriture (`handleUpdateExpenseLines`, `App.jsx`)
  recalcule le total à chaque ajout/édition/suppression de ligne, pour qu'il ne puisse jamais
  dériver de la liste qui le compose.
- `src/state/initialState.js` : `expenseLines: []` dans `getEmptyState()` ; démo migrée en 8 lignes
  catégorisées (`demoExpenseLines`) sommant exactement 28 000 $ — même total qu'avant, aucune
  dérive des chiffres déjà affichés ailleurs dans la démo.
- `src/state/projectSerialization.js` : migration — un projet antérieur (pas d'`expenseLines`, mais
  un `totalIndirects` à plat) reçoit une ligne unique migrée (« Frais indirects (migré) »,
  catégorie Frais généraux de production, montant exact) ; un projet déjà sur `expenseLines` est
  préservé tel quel. Dans tous les cas, `generalInfo.totalIndirects` est recalculé comme la somme
  exacte des lignes au chargement (défensif : élimine toute possibilité de dérive même si un
  fichier sauvegardé était incohérent).
- `src/engine/calculateCosts.js`/`analysisData.js`/`exportToExcel.js`/`generatePdf.js` : **aucune
  modification** — ces modules continuent de lire `generalInfo.totalIndirects` comme avant ; comme
  ce champ est maintenant toujours synchronisé avec `expenseLines`, ils restent corrects sans
  changement. Conforme au découpage prévu : 4.1 est strictement données + UI, la logique
  d'allocation à trois contenants (Général/Activité/Canal) et sa conversion en taux restent pour
  4.2/4.3.
- UI : **nouvel onglet dédié « Frais fixes »** (`src/features/ExpensesTab.jsx`, 8e onglet de
  l'application, entre Main-d'œuvre et Recette & Calcul) — pas une section dans Paramètres comme
  livré dans une première passe, corrigé suite au retour utilisateur : `01-Analyse-Besoins.md`
  (ligne 51) prévoyait dès le départ un « nouvel onglet Comptabilité » pour cet état de résultats,
  le même traitement que Packaging (« nouvel onglet Packaging », ligne 52) — un module de cette
  ampleur n'est pas une sous-section de Paramètres. Ajout/édition/suppression de ligne avec
  annulation (même patron que « Lignes de production »). Paramètres garde un champ « Frais
  indirects totaux ($) » en lecture seule (même patron que « Coût main-d'œuvre cuisine total »,
  dont le détail vit aussi dans un autre onglet). Info-bulles incluses, guide d'utilisation
  (`InstructionModal.jsx`) mis à jour : nouvelle section de premier niveau « Onglet 5 : Frais
  fixes » (Recette & Calcul/Rapport/Suivi renumérotés 6/7/8 en conséquence), ancre retirée de
  Paramètres.
- Tests : 2 nouveaux cas unitaires (`sumExpenseLines`), 3 nouveaux cas de migration/préservation
  (`projectSerialization.test.js`), reducer mis à jour (`SET_EXPENSE_LINES`), nouveau test e2e
  **permanent** `e2e/expense-lines-params.spec.js` (ajout/édition/suppression avec annulation, total
  dérivé, re-testé après le passage à l'onglet dédié). **151/151 tests unitaires** (146 + 5),
  **25/25 tests e2e** (24 + 1), lint propre (0
  erreur), `dist/` reconstruit. Non-régression confirmée par capture d'écran Playwright (onglet
  Frais fixes du projet démo : mêmes 28 000 $ qu'avant, répartis sur 8 lignes lisibles).

### 4.2 — Onglet renommé « État des résultats » + Revenus réels — ✅ terminée le 12/10
- `src/features/ExpensesTab.jsx` renommé en `src/features/IncomeStatementTab.jsx` (fichier +
  composant) pour accueillir plusieurs sections ; bandeau d'onglets (`App.jsx`) mis à jour : id
  `tab-income-statement`, libellé « État des résultats ». « Frais fixes » devient une sous-section
  de cet onglet (déplacée telle quelle, aucun changement de logique) plutôt qu'un onglet à lui seul.
- Nouveau tableau `revenueLines` (même patron que `expenseLines` — reducer `SET_REVENUE_LINES`,
  `getEmptyState`/`getDefaultState`, migration dans `projectSerialization.js`, wiring `App.jsx`) :
  une ligne = `{ id, label, bucket, amount }`, `bucket` = `'general'` ou l'id d'une activité de
  production — pas de canal éditable (voir `04-Conception-Modele.md`, section 1bis). Démo migrée en
  4 lignes (une par activité + une « Général ») sommant exactement 160 000 $ (= `totalRevenue`).
- **Ventilation par canal indicative** : nouvelle fonction pure `computeChannelRevenueShareByActivity`
  (`analysisData.js`) — agrège le revenu théorique (`channelBreakdown[].netPrice × volume`) de tous
  les formats d'une activité, par canal, normalisé en parts (%). Appliquée côté UI au montant réel
  saisi. Jamais un intrant de calcul, uniquement informatif.
- **Migration de `sumExpenseLines` vers `sumLineAmounts`** (`utils.js`) : fonction déjà générique
  (somme `.amount`), renommée pour refléter qu'elle sert maintenant aux deux listes plutôt que de
  dupliquer le même calcul sous un nom trompeur.
- **`generalInfo.menuRevenuePercentage` n'a pas été retiré à cette étape** : `revenueLines` a été
  ajouté en parallèle, comme `expenseLines` en 4.1 — données + UI seulement, le moteur
  (`calculateCosts.js`/`analysisData.js`) continue de lire `totalRevenue`/`menuRevenuePercentage`
  sans changement jusqu'à ce qu'il consomme réellement `revenueLines` (4.5/4.6) — même principe de
  risque minimal que la 4.1.
- Tests : 3 nouveaux cas unitaires (`computeChannelRevenueShareByActivity`), reducer/sérialisation
  mis à jour pour `revenueLines` (préservation, repli `'general'` si l'activité référencée a été
  supprimée — jamais une référence orpheline), 2 nouveaux tests e2e **permanents**
  (`e2e/income-statement-params.spec.js`, renommé depuis `expense-lines-params.spec.js`) couvrant
  Frais fixes (re-testé dans le nouvel onglet) et Revenus (ajout/suppression avec annulation,
  présence de la ventilation indicative). **157/157 tests unitaires** (151 + 6 : 3 pour
  `computeChannelRevenueShareByActivity`, 3 pour la migration/préservation de `revenueLines`),
  **26/26 tests e2e** (24 + 2), lint propre (0 erreur), `dist/` reconstruit.

**Correctifs du 12/10 (suite au retour utilisateur sur la première livraison de 4.2)** :
1. **Sous-totaux par groupe, tentative initiale** — Revenus et Frais fixes groupés (par contenant /
   par catégorie) avec une rangée de sous-total après chaque groupe.
2. **Ventilation par canal en colonnes, pas en note** — les deux tableaux (Revenus, Frais fixes)
   sont passés d'une mise en page en lignes flex à un vrai `<table>`. Pour les Revenus, chaque canal
   de vente devient sa propre colonne à droite de Poste/Activité/Montant (montant indicatif par
   canal, « — » si non applicable — ex. une ligne Général). Les Frais fixes n'ont pas encore ces
   colonnes (pas de contenant Activité/Canal avant la 4.5) — comportement attendu, pas un oubli,
   confirmé avec l'utilisateur.

**Correctif du 12/10 (2e retour, sur la tentative #1)** : malentendu sur le point 1 — l'utilisateur
voulait dire le **total** (existant) affiché selon le patron visuel de « Coût Moyen Pondéré du
Poste » (libellé gris au-dessus, valeur en gras en dessous), pas de nouveaux sous-totaux par
groupe. Les rangées de sous-total par groupe (et le regroupement/tri des lignes qui allait avec)
ont été **retirées** — Revenus et Frais fixes sont redevenus de simples listes à plat (même ordre
de saisie, aucun tri par contenant/catégorie), pour que le tableau des revenus garde « presque la
même forme » que celui des frais fixes, comme demandé. Seul le total de fin de section est
désormais affiché en bloc à deux lignes (`text-sm text-gray-600` / `text-xl font-bold
text-gray-800`), identique au patron de l'onglet Main-d'œuvre. Colonnes par canal (point 2)
inchangées, acceptées telles quelles.
- Non-régression confirmée par capture d'écran Playwright du projet démo (totaux 160 000 $ et
  28 000 $ inchangés, affichés dans le nouveau style). **157/157 tests unitaires, 26/26 tests e2e**
  (assertions de texte ajustées : `getByRole('heading', ...)` pour éviter la collision avec le
  nouveau libellé « Total des revenus »/« Total des frais fixes »), lint propre, `dist/` reconstruit.

**Correctifs du 13/10 (3e retour)** :
1. **Renommage « Lignes de production » → « Activités de production »**, partout dans l'app (titres
   de section, boutons, placeholders, notifications, filtres, tour guidé, guide d'utilisation,
   commentaires) — tranche la question ouverte laissée le 12/10, pour rester cohérent avec la
   colonne « Activité » du tableau Revenus. `productionActivities`/`activityId` (code) inchangés,
   seul le texte visible change. `e2e/production-activities.spec.js` mis à jour en conséquence.
2. **Colonnes de contenant (Général + une par activité) ajoutées avant les colonnes de canal dans
   Revenus**, avec un mécanisme de répartition révisé en profondeur — voir
   `04-Conception-Modele.md` section 1bis pour la justification complète. Résumé : la colonne
   « Activité » (menu déroulant à une seule valeur) devient **« Répartition »**, avec une nouvelle
   option **« Saisie manuelle »** inspirée de la colonne « Répartition » de l'Agro-Calculateur MAPAQ
   (onglet `Rev-Dep`) — hors saisie manuelle, le comportement est inchangé (un seul contenant actif,
   affiché dans sa colonne, Montant reste l'unique champ éditable) ; en saisie manuelle, les
   colonnes de contenant deviennent directement éditables (une ligne peut alors se ventiler sur
   plusieurs activités à la fois, comme dans SymbiOse) et Montant devient un total calculé.
   - **Changement de schéma** : `revenueLines[i].{bucket, amount}` → `{repartition, amounts}`
     (`amounts` = `{ [contenant]: montant }`, une seule clé non nulle hors mode manuel). Migration
     dans `projectSerialization.js` (deux générations couvertes) ; un contenant orphelin (activité
     supprimée depuis la sauvegarde) refond son montant dans Général plutôt que de le perdre.
     `sumLineAmounts` (générique sur `{amount}`) ne s'applique plus à `revenueLines` — nouveau
     `sumAmountsMap` (`utils.js`) pour les objets `amounts`.
   - Ventilation par canal (indicative) généralisée : somme pondérée de tous les contenants
     non-Général de la ligne (couvre nativement le cas multi-contenants de la saisie manuelle).
   - Tests : 3 nouveaux cas unitaires (`sumAmountsMap`), 2 cas de sérialisation remplacés par 4 (3
     générations : forme actuelle avec saisie manuelle, migration depuis l'ancienne forme à plat,
     refonte d'un contenant orphelin en mode manuel sans perte). Nouveau test e2e **permanent**
     (colonnes de contenant avant canal, bascule en Saisie manuelle, ventilation sur 2 contenants à
     la fois, total recalculé). **161/161 tests unitaires, 27/27 tests e2e**, lint propre, `dist/`
     reconstruit. Non-régression et nouveau comportement confirmés par capture d'écran Playwright.

**Correctifs du 13/10 (4e retour, polish UI/UX)** :
1. **« Contenant » renommé « Activités de production »** (en-tête de groupe de colonnes, Revenus).
2. **Tableaux compactés** pour éliminer le défilement horizontal : paddings et polices réduits
   (`text-sm` sur toutes les cellules, `px-3 py-2` → `px-1`/`px-2 py-1`), largeurs minimales
   resserrées par colonne, conteneur de l'onglet élargi (`max-w-7xl` → `max-w-[1600px]`). À 1440 px
   de large (résolution laptop courante), le tableau Revenus au complet (4 lignes démo, 3 activités,
   3 canaux) tient sans défilement horizontal. Libellés de poste tronqués visuellement acceptés en
   échange (valeur complète toujours au survol via `title`).
3. **Séparateur de milliers (espace) dans `formatCurrency`** (`utils.js`) — ex. « 160 000.00 $ » au
   lieu de « 160000.00 $ ». Fonction partagée par 15 fichiers (tout affichage monétaire de l'app),
   changement global et rétrocompatible (même valeur numérique, juste le groupement visuel).
   4 nouveaux cas unitaires dédiés. Toute la suite e2e repassée pour confirmer qu'aucun autre écran
   (Rapport, exports, Packaging...) n'en dépendait avec une assertion de texte exacte incompatible —
   confirmé, seules les assertions internes à `income-statement-params.spec.js` à ajuster.
4. **Trois zones de colonnes visuellement distinctes** (Revenus) : « Paramètres généraux » (gris),
   « Activités de production » (fond bleu clair), « Canaux de commercialisation » (fond ambre clair,
   toujours marqué indicatif) — bordures `border-l-2` plus marquées aux frontières de groupe.
- Tests : `e2e/income-statement-params.spec.js` entièrement réaligné sur le nouveau format de
  montant et les nouveaux libellés/placeholders. **165/165 tests unitaires** (161 + 4, dont
  `formatCurrency`), **28/28 tests e2e**, lint propre, `dist/` reconstruit. Non-régression confirmée
  par capture d'écran Playwright à 1440 px (aucun défilement horizontal, zones bien distinguées).

**Correctif du 13/10 (5e retour)** : la séparation des 3 zones par couleur de fond (bleu/ambre) a
été retirée — remplacée par une seule bordure claire (`border-l border-gray-300` en en-tête,
`border-gray-200` dans le corps) à **chaque frontière de zone uniquement** (première colonne
Général, première colonne de canal), pas répétée sur chaque colonne individuelle comme la version
précédente (`border-l-2` sur chaque `<th>`/`<td>`) — nulle part ailleurs dans le tableau. **165/165
tests unitaires, 27/27 tests e2e**, lint propre, `dist/` reconstruit. Confirmé par capture d'écran :
les 3 zones restent clairement lisibles (libellés de groupe + deux traits verticaux), sans couleur
ni bordures parasites.

**Correctif du 13/10 (6e retour)** : les bordures de frontière de zone (point précédent) étaient
trop discrètes pour bien séparer visuellement les sections. Renforcées — `border-l-4 border-gray-400`
(au lieu de `border-l`/`border-l-2 border-gray-200/300`), même couleur/épaisseur en en-tête et dans
le corps pour lire comme un seul trait continu de haut en bas. Toujours seulement aux 2 frontières
de zone, toujours sans couleur de fond. **165/165 tests unitaires, 27/27 tests e2e**, lint propre,
`dist/` reconstruit. Confirmé par capture d'écran : les 3 zones (Paramètres généraux / Activités de
production / Canaux de commercialisation) sont maintenant nettement délimitées.

**Correctif du 13/10 (7e retour)** : le rendu bordures épaisses + gris jugé laid par l'utilisateur.
Plutôt que d'itérer encore sur l'épaisseur/couleur d'une bordure, proposition d'un changement
d'approche — validée par l'utilisateur plutôt qu'un détail de plus à ajuster : abandonner les
bordures de séparation entièrement, remplacées par les **3 couleurs déjà établies dans Recette &
Calcul** pour ses sections numérotées (1. Ingrédients `bg-green-50`/`text-green-700`, 3. Processus
`bg-yellow-50`/`text-yellow-700`, 6. Récapitulatif `bg-blue-50`/`text-blue-700` —
`RecipeCalculator.jsx`). Les 3 zones de Revenus reprennent exactement cette palette sur toute leur
hauteur (en-tête + corps) : **1. Paramètres généraux** (vert), **2. Activités de production**
(jaune), **3. Canaux de commercialisation** (bleu) — numérotées comme les sections de Recette &
Calcul, sans bordure superposée (la transition de couleur suffit à séparer visuellement). Table
passée en `border-separate border-spacing-0` pour un rendu de fond propre sans artefact entre
cellules adjacentes de couleurs différentes. **165/165 tests unitaires, 27/27 tests e2e** (libellé
de test ajusté pour le préfixe numéroté), lint propre, `dist/` reconstruit. Confirmé par capture
d'écran : rendu nettement plus propre et cohérent avec le langage visuel déjà établi ailleurs dans
l'app.

**Correctif du 13/10 (8e retour)** : rendu jugé encore « laid » par l'utilisateur — pas la couleur
en soi, mais le fait que les 3 zones restaient collées (une seule bande continue), pas lisibles
comme de vraies sous-sections. Proposition acceptée : simuler visuellement **3 rectangles détachés
aux coins arrondis** (comme les encadrés verts/jaune/bleu de Recette & Calcul, mais juxtaposés à
l'horizontale plutôt qu'empilés à la verticale), **sans modifier le tableau lui-même** (mêmes
lignes/colonnes de données, même comportement). Implémenté par pur habillage visuel :
- Colonnes d'écart décoratives (`<th>`/`<td>` vides, `w-3 p-0`, aucune couleur de fond — donc
  transparentes sur le fond gris de la section) insérées entre les 3 zones, créant un vrai espace
  visuel plutôt qu'une simple transition de couleur.
- Coins arrondis : `rounded-t-lg` sur la cellule d'en-tête de groupe de chaque zone (une seule
  cellule à colSpan, donc les deux coins supérieurs d'un coup) ; `rounded-bl-lg`/`rounded-br-lg`
  calculés dynamiquement sur la **dernière ligne** du tableau (ajout/suppression de revenus
  recalcule automatiquement quelle ligne est « la dernière »), première/dernière colonne de chaque
  zone.
- Colonne Actions (poubelle) : aucune couleur de fond, confirmé neutre.
- Table passée de `divide-y` (sur `<table>`/`<tbody>`) à une bordure basse par cellule
  conditionnelle (`border-b border-gray-200`, omise sur la dernière ligne) — nécessaire pour ne pas
  casser l'arrondi du coin inférieur avec un trait qui dépasserait du rectangle.
- Un seul test e2e ajusté (l'ajout d'une colonne d'écart décale l'index de la colonne Général de 3
  à 4 dans `td.nth()`). **165/165 tests unitaires, 27/27 tests e2e**, lint propre, `dist/`
  reconstruit. Confirmé par capture d'écran (incluant un zoom sur les coins arrondis) : les 3 zones
  se lisent maintenant clairement comme des sous-sections distinctes et détachées.

**Correctif du 13/10 (9e retour)** : deux derniers ajustements visuels + vérification d'une
régression signalée.
- Numérotation (« 1. », « 2. », « 3. ») retirée des 3 libellés d'en-tête de zone — jugée inutile
  une fois les zones visuellement détachées (rectangles arrondis du retour précédent). Libellés
  simplifiés : « Paramètres généraux », « Activités de production », « Canaux de commercialisation
  (indicatif) ».
- Incohérence de teinte corrigée : les cellules du corps de tableau utilisaient une opacité
  `/60` (`bg-green-50/60`, `bg-yellow-50/60`, `bg-blue-50/60`) alors que l'en-tête utilisait la
  couleur pleine — rendant le corps visiblement plus foncé que l'en-tête (capture d'écran fournie
  par l'utilisateur). Classes alignées sur les couleurs pleines de l'en-tête sur toute la hauteur
  de chaque zone.
- Régression signalée : les onglets Rapport et Suivi « ne fonctionnaient plus ». Investigation via
  script de test temporaire (`_debug-*`, supprimé après usage) : chargement du projet démo,
  bascule d'une ligne de revenu en Saisie manuelle avec saisie réelle dans une cellule de
  contenant, puis navigation vers Rapport et Suivi — captures d'écran des deux onglets, écouteurs
  d'erreurs console/page actifs. **Aucune erreur détectée**, les deux onglets s'affichent
  normalement (matrice BCG, graphiques de contribution, tableau des marges par canal pour Rapport ;
  graphiques d'évolution, volatilité, gestion des points de référence pour Suivi). Aucune cause
  identifiée par ce scénario — à documenter avec des étapes de reproduction plus précises si le
  problème persiste côté utilisateur.
- Test e2e ajusté (libellé de zone sans préfixe numéroté). **165/165 tests unitaires, 27/27 tests
  e2e** (incluant les deux smoke tests qui naviguent dans tous les onglets, Rapport et Suivi
  compris, sans erreur), lint propre, `dist/` reconstruit.

**Correctif du 13/10 (10e retour)** : remise en place d'une rangée de sous-totaux sous le tableau
Revenus, mais **par colonne chiffrée** cette fois (pas une seule rangée de sous-total générique
comme la version retirée au 7e retour) — un sous-total par contenant (Général + chaque activité)
et, indicativement, un sous-total par canal, en plus du total global déjà affiché sous le tableau
(inchangé, toujours au patron « Coût Moyen Pondéré du Poste »). Rangée ajoutée en `<tfoot>`,
reprenant la couleur pleine de chaque zone (vert/jaune/bleu) et les coins arrondis du bas (déplacés
de la dernière ligne de donnée vers cette nouvelle rangée — les lignes de données ont maintenant
toutes une bordure basse uniforme, sans arrondi). Sous-total Montant = total global (les deux
sont dérivés des mêmes données, donc toujours identiques — pas de risque de dérive). Un test e2e
dédié vérifie qu'un sous-total par contenant agrège bien plusieurs lignes (ex. « Soupes et
potages » cumule 2 lignes distinctes), pas seulement le total général ; 2 assertions existantes
ajustées (`.first()`) car le montant global apparaît désormais 2 fois dans la section (sous-total
Montant + total sous le tableau). **165/165 tests unitaires, 27/27 tests e2e**, lint propre,
`dist/` reconstruit. Confirmé par capture d'écran.

### 4.3 — Charges directes réelles *(terminée le 13/10)*
- Nouvelle section « Charges directes réelles » dans l'onglet État des résultats, entre Revenus et
  Frais fixes, ventilée par **type de coût** (Matière première, Main-d'œuvre directe, Emballage,
  Sous-traitance — nouvelle constante `DIRECT_COST_TYPES` dans `utils.js`) — pas par les 4
  catégories de frais fixes, qui décrivent une fonction d'entreprise plutôt qu'une nature de coût
  de production (voir `04-Conception-Modele.md`, section 1bis). Vocabulaire repris tel quel de
  `calculateCosts.js` en vue de la réconciliation réel/théorique (4.4).
- Nouveau tableau `directCostLines` (même patron que `expenseLines`/`revenueLines` — reducer
  `SET_DIRECT_COST_LINES`, `getEmptyState`/`getDefaultState`, pass-through dans
  `projectSerialization.js` sans migration à écrire puisque le champ est entièrement nouveau,
  wiring complet dans `App.jsx`) : une ligne = `{ id, label, category, amount }`, `category` ∈
  `DIRECT_COST_TYPES`. Démo migrée en 4 lignes (une par type) sommant 100 000 $, plausible pour un
  chiffre d'affaires de 160 000 $ (`demoRevenueLines`).
- **Risque minimal, même principe que 4.1/4.2** : données + UI seulement, pas encore consommé par
  le moteur (`calculateCosts.js`/`analysisData.js` ne lisent pas `directCostLines`) — le total
  agrégé n'est donc pas encore une clé de répartition utilisable ailleurs ; ce branchement attend
  la 4.5/4.6, qui consommera aussi `expenseLines`/`revenueLines` de la même façon.
- **Extraction du sous-composant `CategorizedLinesTable`** (`IncomeStatementTab.jsx`) : la table
  « poste + catégorie + montant » est strictement identique entre Frais fixes et Charges directes
  réelles (même structure, seules la liste de catégories et les étiquettes diffèrent) — factorisée
  une fois qu'elle sert à deux sections plutôt que dupliquée une deuxième fois.
- Guide d'utilisation (`InstructionModal.jsx`) : nouvelle entrée de table des matières et section
  « Charges directes réelles » sous Onglet 5, même traitement que Revenus/Frais fixes en 4.1/4.2
  (pas reporté à l'info-bulle globale de la 4.7).
- Tests : reducer/sérialisation mis à jour pour `directCostLines` (absence → liste vide,
  préservation telle quelle — pas de migration à écrire), 1 nouveau test e2e **permanent**
  (`e2e/income-statement-params.spec.js`) couvrant ajout/édition/suppression avec annulation et
  total recalculé. **167/167 tests unitaires** (165 + 2), **28/28 tests e2e** (27 + 1), lint propre
  (0 erreur), `dist/` reconstruit. Confirmé par capture d'écran (section bien positionnée entre
  Revenus et Frais fixes, même langage visuel).

**Correctif du 13/10 (4.3bis) — répartition Activités/Canaux des charges directes, discutée et
validée avec l'utilisateur avant implémentation** (voir le fil de discussion : méthodologie
proposée, réponse sur le nombre de sous-totaux, renommage canal, comparaison MAPAQ, harmonisation
des colonnes — intégralement repris dans `04-Conception-Modele.md`, section 1bis) :
- **Charges directes réelles gagne les zones Activités/Canaux de vente**, même forme que Revenus
  (3 zones colorées, sous-total par colonne). Contrairement à Revenus, la ventilation est
  **entièrement dérivée** (pas de sélecteur manuel) : `computeDirectCostAllocation` (nouvelle
  fonction pure, `analysisData.js`) répartit chaque ligne par activité puis par canal via un driver
  théorique **apparié à son propre type de coût** (`DIRECT_COST_TYPE_FIELDS` : Matière première →
  `costMatierePerPortion`, Main-d'œuvre directe → `costLaborPerPortion`, Emballage →
  `costPackagingPerPortion`, Sous-traitance → `costSubcontractingPerPortion`) — jamais une clé
  croisée (ex. emballage réel avec une clé de main-d'œuvre théorique), ni une clé de ventes (un
  coût suit la production, pas le prix). Repli sur Général quand aucune activité n'a de donnée
  théorique du type concerné. Affiché **ligne par ligne**, pas seulement au sous-total — même
  principe déjà appliqué à la ventilation canal des revenus (dérivée au niveau de l'activité,
  répétée sur chaque ligne), jamais signalé comme un problème.
- **Colonnes harmonisées entre les 3 tableaux** : Poste | Catégorie | Clé de répartition | Montant
  partout, avec une cellule neutre « — » quand une colonne ne s'applique pas encore à un tableau
  donné (Catégorie pour Revenus, Clé de répartition pour Charges directes — toujours dérivée — et,
  en attendant la Phase 4.5, pour Frais fixes). Revenus renomme sa colonne « Répartition » en
  « Clé de répartition ».
- **Renommage « Canaux de commercialisation » → « Canaux de vente »**, partout dans l'app, pour
  s'aligner sur le vocabulaire déjà établi ailleurs (section Paramètres, docs, tests) — seul
  l'onglet État des résultats utilisait encore l'ancien terme.
- **Comparaison avec MAPAQ** (`Rev-Dep`, ligne 108) : confirmé que MAPAQ ne répartit pas du tout ses
  charges directes par activité/canal — il rapatrie directement le théorique de sa feuille de coût
  de production. RestoCalculateur va un cran plus loin (réconciliation exacte au montant réel)
  plutôt que de reproduire cette limite.
- Tests : 4 nouveaux tests unitaires (`computeDirectCostAllocation` — répartition normale, activité
  sans driver théorique omise, pas de clé croisée entre types, repli sur Général quand aucune
  donnée théorique n'existe) ; e2e étendu (zones Activités/Canaux de vente visibles, répartition
  d'une nouvelle ligne vérifiée, indices de colonnes Revenus ajustés). **171/171 tests unitaires**
  (167 + 4), **28/28 tests e2e**, lint propre, `dist/` reconstruit. Confirmé par capture d'écran :
  les 3 tableaux partagent maintenant la même forme, et le sous-total de chaque type de charge
  directe reconstitue exactement son montant réel.

**Correctif du 13/10 (suite) — zones Activités/Canaux de vente pour Frais fixes** : à la demande de
l'utilisateur, Frais fixes gagne les mêmes zones colorées que Revenus/Charges directes (même forme
visuelle pour les 3 tableaux de l'onglet), mais avec les cellules Activités/Canaux affichées en
« — » (espace réservé neutre, pas « indicatif ») : aucune donnée n'est encore calculée là, le
mécanisme réel (saisie manuelle + vérification) appartient à la Phase 4.5, pas encore implémentée.
`CategorizedLinesTable` (devenue inutilisée — Charges directes et maintenant Frais fixes ont chacun
leur propre table zonée) retirée plutôt que laissée en code mort. Tests e2e étendus (zones visibles,
placeholders confirmés) ; 2 assertions existantes corrigées (`.first()`) pour le même doublon de
montant qu'ont déjà Revenus/Charges directes (rangée Sous-total + total sous le tableau).
**171/171 tests unitaires, 28/28 tests e2e**, lint propre, `dist/` reconstruit. Confirmé par capture
d'écran.

**Nouvelle sous-phase planifiée (4.8, voir plus bas)** : à la toute fin de la Phase 4, un tableau
récapitulatif sous Frais fixes montrera le total des frais par activité ET par canal (inspiré de la
feuille `6 - Rep. charges fixes` du chiffrier SymbiOse) — dépend de 4.5/4.6, donc reporté après.

**Correctif du 13/10 (suite) — titres de colonnes centrés, largeurs uniformisées entre les 3
tableaux** : tous les en-têtes de colonne (2e rangée de `<thead>`) passent en `text-center` (étaient
un mélange de `text-left`/`text-right` selon la colonne) ; les 4 colonnes de tête (Poste/Catégorie/
Clé de répartition/Montant) et les colonnes de contenant/canal reçoivent des `min-w` identiques
dans les 3 tableaux (150/130/120/100/85 px), au lieu de largeurs ad hoc différentes par tableau.
Police des cellules de données (`<input>`/`<select>`/`<td>`, pas les boutons ni les totaux sous le
tableau) réduite de `text-sm` à `text-xs` pour que les montants formatés (ex. « 90 000.00 $ »)
restent sur une seule ligne sans élargir les colonnes — évite le retour du défilement horizontal
(voir le retour du 13/10 plus haut : « rend l'expérience déplaisante »). Confirmé à 1280px ET
1600px de large : aucun défilement horizontal, aucun retour à la ligne dans les cellules de montant.
**171/171 tests unitaires, 28/28 tests e2e** (texte/structure inchangés, seul le style est touché),
lint propre, `dist/` reconstruit.

### 4.4 — Tableau de réconciliation réel/théorique — ✅ terminée le 13/10
- Nouvelle section « Réconciliation réel / théorique » sous Frais fixes, dans l'onglet État des
  résultats : compare, au niveau de **l'entreprise entière** (jamais par activité/canal — le détail
  y serait partiellement circulaire, même limite déjà documentée pour les revenus en 4.2), Revenus/
  Charges directes/Marge réels (saisis en 4.2/4.3) au théorique implicite du modèle de recettes.
  Même patron visuel que le rapport de productivité MO déjà présent dans l'app (« heures attendues »
  vs « heures réelles », `LaborDatabaseTab.jsx`) : table simple avec colonnes Réel/Théorique/
  Écart ($)/Écart (%), pas la structure à 3 zones colorées des 3 tableaux au-dessus (pas de détail
  activité/canal ici).
- **Théorique** = `menuRevenue`/`unitsSoldById` déjà calculés par `computeAnalysisData`
  (reconstruction du volume à partir du mix des ventes et du chiffre d'affaires du menu — ces
  champs existaient déjà en variables locales, simplement **exposés** dans l'objet retourné plutôt
  que redérivés en double) : Revenus théorique = `menuRevenue` (identité exacte avec Σ `prixVente`
  × volumes reconstruits, par construction) ; Charges directes théorique = Σ
  `costs.totalDirectCostPerPortion` × volume reconstruit, sur les produits actifs ; Marge théorique
  = la différence des deux. Nouvelle fonction pure `computeRealVsTheoreticalReconciliation`
  (`analysisData.js`), prend les totaux déjà calculés en entrée (pas de nouvel état).
- Écart (%) absent (« — », jamais 0 %) quand le théorique d'une ligne est nul — même principe que
  partout ailleurs dans l'app (donnée absente jamais comblée par du 0).
- Tests : 2 nouveaux tests unitaires (`computeRealVsTheoreticalReconciliation` — calcul correct,
  écart % absent quand théorique nul) ; 1 nouveau test e2e **permanent** confirmant que la démo
  (revenus réels = théoriques par construction, 160 000 $ des deux côtés — bon test de cohérence)
  affiche un écart de 0,0 % sur les revenus et une marge cohérente des deux côtés (Revenus − Charges
  directes). **173/173 tests unitaires** (171 + 2), **29/29 tests e2e** (28 + 1), lint propre,
  `dist/` reconstruit. Confirmé par capture d'écran.

**Correctif du 13/10 (suite) — retrait de « Frais fixes par unité théorique »** (erreur de
raisonnement, signalée par l'utilisateur) : la 1re livraison de 4.4 affichait un taux
`generalInfo.totalIndirects ÷ totalUnitsSold` (une seule moyenne globale, pool total ÷ unités
totales). Ce calcul ne correspond à **aucune** des formules déjà spécifiées en 4.6 — qui sont
TOUJOURS par contenant (Général/Activité/Canal, Phase 4.5) et par PRODUIT, jamais une division à
plat du pool total par un total d'unités. L'origine de l'erreur : une mauvaise lecture d'une note
de la feuille de route (« Frais fixes par unité = pool réel ÷ unités théoriques ») qui décrivait en
réalité le mécanisme déjà prévu pour le seul contenant **Général** (`indirectCostMethod` existant,
réutilisé tel quel, par produit — voir 4.6), pas une statistique d'entreprise. Retiré de
`computeRealVsTheoreticalReconciliation` (retourne seulement `{ rows }` désormais), de
`computeAnalysisData` (`totalUnitsSold` n'était exposé que pour ce calcul — retiré du retour, reste
une variable locale), de l'UI, des tests et du guide. La conversion en taux de la Phase 4.6 restera
par contenant/par produit, calculée dans `calculateCosts.js` et affichée dans le rapport par SKU —
jamais une moyenne globale dans l'État des résultats. **173/173 tests unitaires, 29/29 tests e2e**,
lint propre, `dist/` reconstruit.

**Correctif du 13/10 (suite) — largeurs de colonnes toujours différentes malgré des `min-w`
identiques** : en layout de table `auto` (par défaut), chaque `<table>` calcule ses largeurs de
colonne à partir de SON PROPRE contenu (texte des `placeholder`, options des `<select>`...) — des
`min-w` identiques entre 3 tableaux SÉPARÉS ne garantissent pas des largeurs rendues identiques dès
que le contenu diffère (ex. le `<select>` Clé de répartition de Revenus contient des noms
d'activités longs qui n'existent pas dans les cellules « — » de Charges directes/Frais fixes).
Passage à `table-layout: fixed` (classe `table-fixed`) sur les 3 tableaux, avec des largeurs EXACTES
(`w-[Npx]`, plus `min-w-`) sur chaque colonne — identiques dans les 3 tableaux, y compris la colonne
Actions (`w-10`, auparavant sans largeur déclarée). Les largeurs sont maintenant garanties
identiques indépendamment du contenu. **173/173 tests unitaires, 29/29 tests e2e**, lint propre,
`dist/` reconstruit. Confirmé par capture d'écran : les 3 zones colorées ont exactement la même
largeur dans les 3 tableaux.

**Correctif du 13/10 (suite) — le correctif précédent ne fonctionnait toujours pas** (signalé par
l'utilisateur : « je ne vois pas les modifications appliquées »). Cause réelle : `table-layout:
fixed` ne lit les largeurs de colonne QUE sur la **toute première rangée** du tableau (ou un
`<colgroup>`) — jamais sur une rangée suivante. Nos tableaux ont une 1re rangée d'en-tête de ZONE
avec des cellules `colSpan` sans largeur individuelle ; les classes `w-[Npx]` posées sur la 2e
rangée (en-têtes de colonne, correctif précédent) étaient donc silencieusement ignorées — le
navigateur répartissait l'espace à parts égales entre colonnes non dimensionnées, d'où une
uniformité accidentelle entre les 3 tableaux (par coïncidence de structure identique) mais aucune
différenciation réelle des largeurs. Symptôme additionnel : l'input Montant (`w-24` fixe, 96px en
dur sur l'`<input>`) débordait de sa cellule une fois celle-ci réellement rétrécie, causant le
décalage visuel remarqué par l'utilisateur.
- **Vraie correction** : `<colgroup>` explicite (`IncomeStatementColGroup`, nouveau composant
  partagé) avant le `<thead>` des 3 tableaux — seule méthode fiable pour des largeurs de colonne
  individuelles indépendantes de la structure des rangées d'en-tête. Tous les `input`/`span`
  à largeur fixe en dur (`w-24`, `w-20`) remplacés par `w-full` pour s'adapter à la largeur réelle
  de leur colonne plutôt que d'entrer en conflit avec elle.
- **Contrainte d'espace réelle découverte en testant** : à 1280px de large (plus petite largeur
  testée), l'espace disponible pour le tableau est de 1168px ; l'agencement équilibré d'origine
  (Poste 150/Catégorie 130/Clé 120/Montant 100, contenants/canaux 85) totalisait déjà 1159px — une
  marge de 9px seulement. Élargir la zone verte de 1/8 tout en réduisant Montant à 75px (demande
  initiale) poussait le total à 1224px (débordement + retour à la ligne de Montant) ; réduire
  ensuite les contenants/canaux à 74px pour compenser faisait déborder LEUR contenu à la place
  (« 90 000.00 $ » ne tient pas sous 85px). Aucune combinaison ne satisfait simultanément
  « zone verte +1/8 », « aucun retour à la ligne nulle part » et « aucun défilement horizontal » à
  1280px — **compromis retenu, testé et validé empiriquement** (vérification directe de
  `scrollWidth`/`clientWidth`, pas seulement visuelle) : Poste 160/Catégorie 140/Clé
  répartition 130/Montant 85 (contenants/canaux ramenés à 85, valeur déjà éprouvée sans
  retour à la ligne), espaceurs 12→8px. Zone verte élargie de 500→515px (+3 %, bien en-deçà du
  1/8 demandé — la marge d'espace disponible ne permet pas plus sans réintroduire un défilement
  horizontal ou un retour à la ligne). Total : 1166px ≤ 1168px disponibles, aucun débordement.
- **173/173 tests unitaires, 29/29 tests e2e**, lint propre, `dist/` reconstruit. Confirmé par
  capture d'écran ET par mesure directe (`scrollWidth === clientWidth`, aucun retour à la ligne
  dans les cellules de montant).

**Correctif du 13/10 (suite) — Montant élargi pour supporter 7 chiffres, Poste réduit en
contrepartie** : demande explicite de l'utilisateur après le compromis précédent — que le
sous-total puisse afficher un montant à 8 chiffres (« 10 000 000.00 $ », 15 caractères) sans retour
à la ligne. Poste (160→125px) réduit pour financer Montant (85→120px), total inchangé (toujours
1166px, aucun débordement réintroduit). Vérifié en saisissant un montant réel de 10 000 000 $ dans
une ligne de revenu démo : le sous-total « 10 070 000.00 $ » s'affiche sur une seule ligne, aucun
défilement horizontal (`scrollWidth === clientWidth`, confirmé). Les colonnes Activités/Canaux
(85px, inchangées) ne sont pas dimensionnées pour un montant à 8 chiffres concentré sur un seul
contenant — cas marginal non demandé, non traité ici. **173/173 tests unitaires, 29/29 tests e2e**,
lint propre, `dist/` reconstruit.

**Correctif du 13/10 (suite) — Montant à 120px était trop large** (retour utilisateur : « tu as
exagéré », demande explicite d'une largeur « pile suffisante »). Plutôt que d'estimer à l'œil,
mesure directe dans le navigateur (`getBoundingClientRect().width` d'un `<span>` portant exactement
les classes `text-xs font-bold` de la cellule Sous-total, injecté puis retiré du DOM) : le texte
« 10 000 000.00 $ » occupe **89,1px**, plus 16px de padding (`px-2`) = **105,1px minimum**. Montant
ramené de 120px à **106px** (1px de marge pour l'arrondi sous-pixel) ; les 14px libérés redonnés à
Poste (125→139px), conformément à l'objectif d'origine (plus d'espace pour les 3 premières
colonnes). Total inchangé (1166px), aucun débordement. Vérifié à nouveau en saisissant 10 000 000 $
dans une ligne de revenu démo : « 10 070 000.00 $ » tient pile sur une ligne, sans espace excédentaire
visible. **173/173 tests unitaires, 29/29 tests e2e**, lint propre, `dist/` reconstruit.

**Correctif du 13/10 (suite) — cible révisée à 100 milliards $** : l'utilisateur a testé des
montants encore plus grands (999 990 000 $, puis confirmation que 10M$ était la bonne cible pour ce
cas précis) avant de préciser la vraie borne voulue : **100 G$** (100 000 000 000 $), pas 10 M$.
Même méthode de mesure directe dans le navigateur : « 100 000 000 000.00 $ » (`text-xs font-bold`)
occupe 120,0px, + 16px de padding = **136,0px minimum**. Montant ramené de 106px à **137px** (1px
de marge) ; Poste réduit en contrepartie (139→108px) pour garder le total inchangé (1166px, aucun
débordement). Vérifié en saisissant 99 999 960 000 $ dans une ligne de revenu démo : le sous-total
« 100 000 030 000.00 $ » tient pile sur une ligne. **173/173 tests unitaires, 29/29 tests e2e**,
lint propre, `dist/` reconstruit.

**Correctif du 13/10 (suite) — cible DÉFINITIVE fixée à 99 999 999,99 $**, après plusieurs
allers-retours sur la largeur de Montant (10M$ → 100G$ → ceci). Borne demandée explicitement par
l'utilisateur : jusqu'à 99 999 999,99 $ sans débordement ; au-delà, un retour à la ligne est normal
et acceptable. « 99 999 999.99 $ » a exactement la même longueur que « 10 000 000.00 $ » (15
caractères) : même mesure directe qu'au premier essai, 89,1px de texte + 16px de padding = 105,1px
minimum. **Montant = 106px** (valeur définitive). L'espace libéré par rapport à 137px (100G$) est
redonné cette fois aux **3** premières colonnes (pas seulement Poste, comme demandé explicitement) :
Poste 108→117px, Catégorie 140→151px, Clé de répartition 130→141px — réparti proportionnellement à
leur largeur respective. Total inchangé (1166px ≤ 1168px disponibles à 1280px de large, aucun
débordement). Vérifié en saisissant 99 929 999,99 $ dans une ligne de revenu démo (sous-total exact
= 99 999 999,99 $) : tient pile sur une ligne. **173/173 tests unitaires, 29/29 tests e2e**, lint
propre, `dist/` reconstruit.
- **Valeurs finales des colonnes** (`IncomeStatementTab.jsx`, constantes `COL_WIDTH_*`) : Poste
  117px, Catégorie 151px, Clé de répartition 141px, Montant 106px, contenants/canaux 85px,
  espaceurs 8px, Actions 40px — total 1166px. Toute largeur de colonne DOIT désormais passer par un
  `<colgroup>` (`IncomeStatementColGroup`), jamais par des classes `w-[Npx]` sur les `<th>` (ignorées
  par `table-layout: fixed` en présence d'une 1re rangée à cellules `colSpan`, cause du bug corrigé
  plus haut). Pour retoucher une largeur à l'avenir : mesurer d'abord le texte réel dans le
  navigateur (`getBoundingClientRect()` avec les classes exactes de la cellule), ne jamais deviner.

**Correctif du 13/10 (suite) — Poste/Catégorie/Clé de répartition égales, encadrés gris et totaux
redondants retirés** : 3 demandes de l'utilisateur en une fois.
- **Poste/Catégorie/Clé de répartition à largeur égale** : l'utilisateur a remarqué que Poste
  n'avait pas vraiment profité des derniers ajustements (était resté la plus étroite des 3,
  117px contre 151/141px). Les 3 colonnes sont maintenant **strictement égales** (136px chacune,
  409px répartis aussi également que le permettent des pixels entiers), Montant inchangé à 106px
  (cible définitive de 99 999 999,99 $, non retouchée). Total inchangé (1165px, toujours sous les
  1168px disponibles).
- **Encadrés gris retirés** : les 3 tableaux (Revenus, Charges directes réelles, Frais fixes)
  perdent leur fond `bg-gray-100 rounded-lg p-4` — redevenus de simples sections sans encadré,
  directement sur le fond blanc de la carte. La section Réconciliation réel/théorique **garde** son
  encadré gris (seule exception demandée).
- **Totaux redondants retirés** : les blocs « Total des revenus »/« Total des charges directes
  réelles »/« Total des frais fixes » (affichés sous chaque tableau, dupliquant exactement la
  rangée « Sous-total » déjà présente dans le tableau) sont retirés — un seul total par section
  désormais, dans la rangée Sous-total. `totalRevenue`/`totalDirectCosts`/
  `generalInfo.totalIndirects` restent utilisés ailleurs (rangées Sous-total, tableau de
  réconciliation), aucune variable rendue orpheline.
- Tests e2e mis à jour : assertions sur « Total des X » retirées, `.first()` devenu inutile sur
  plusieurs montants retiré (un seul nœud de texte correspond désormais, plus de doublon avec le
  bloc de total disparu). **173/173 tests unitaires, 30/30 tests e2e**, lint propre, `dist/`
  reconstruit. Confirmé par capture d'écran.

**Correctif du 13/10 (suite) — infobulles pour utilisateurs non-comptables** : à la demande de
l'utilisateur, ajout d'info-bulles (`Tooltip`, même composant que le reste de l'app) sur les
colonnes dont le titre suppose un vocabulaire comptable, dans les 4 tableaux de l'onglet :
- **Catégorie** (Revenus/Charges directes/Frais fixes) : explique pourquoi la colonne est vide pour
  Revenus (pas de catégorie comptable à classer), ce que recouvre chaque type de coût pour Charges
  directes (Matière première/MO directe/Emballage/Sous-traitance), et chaque catégorie de frais
  fixes (Frais généraux de production/de vente/d'administration/financiers).
- **Clé de répartition** (les 3 tableaux) : explique le choix Général/Activité/Saisie manuelle pour
  Revenus, pourquoi la colonne est vide pour Charges directes (dérivée automatiquement — pas
  éditable) et pour Frais fixes (pas encore active, Phase 4.5).
- **Colonne « Général »** des Activités de production (Revenus/Charges directes) : explique ce que
  représente ce contenant par rapport aux activités précises.
- **Les 5 colonnes de la Réconciliation réel/théorique** : Poste (définition de la ligne Marge),
  Réel, Théorique, Écart ($), Écart (%).
Aucun changement de structure/comportement, uniquement des info-bulles ajoutées. **173/173 tests
unitaires, 30/30 tests e2e**, lint propre, `dist/` reconstruit. Confirmé par capture d'écran.

**Correctif du 13/10 (suite) — boutons « Ajouter » alignés sur le style de Main-d'œuvre** : les 3
boutons « Ajouter un revenu »/« Ajouter une charge directe »/« Ajouter une dépense » (auparavant
boutons pleins verts avec icône `PlusCircle`, en haut de section à côté du titre) remplacés par le
style lien texte bleu de « + Ajouter un employé » (`LaborDatabaseTab.jsx`) — `text-sm text-blue-600
hover:text-blue-800`, préfixe « + » plutôt qu'une icône — et déplacés **au même endroit** qu'en
Main-d'œuvre : en bas de section (`mt-4`), sous le tableau, plutôt qu'en haut à côté du titre.
Import `PlusCircle` (lucide-react) retiré, devenu inutilisé. Les 3 titres de section (`<h2>`)
simplifiés en conséquence (n'ont plus besoin du `flex justify-between` pour partager la ligne avec
le bouton). Tests e2e inchangés (le texte du bouton reste une sous-chaîne du libellé affiché, donc
toujours trouvé par `getByText`). **173/173 tests unitaires, 30/30 tests e2e**, lint propre, `dist/`
reconstruit. Confirmé par capture d'écran.

### 4.5 — Allocation à trois contenants (Général, Activité, Canal) — ✅ terminée le 13/10
- Par ligne de frais fixes : saisie manuelle du montant $ sur **deux axes indépendants** — Général +
  chaque activité de production (`activityAllocations`, même structure que `revenueLines.amounts`
  en 4.2) d'un côté, chaque canal de vente (`channelAllocations`, aucun contenant Général
  équivalent) de l'autre — chacun vérifié en temps réel contre le Montant de la ligne, sans jamais
  exiger que les deux axes se correspondent entre eux (une dépense peut légitimement ne s'appliquer
  qu'à un seul axe, ex. un loyer n'a aucune raison de se répartir par canal). Indicateur
  (`AllocationCheckBadge`) purement diagnostique : coche verte si les 2 axes sont à 100 %,
  avertissement avec détail par axe en infobulle sinon — jamais bloquant.
- « Clé de répartition » (`repartitionKey`) : `manual` (défaut), ou pré-remplissage ponctuel
  (modifiable ensuite) proportionnel aux sous-totaux déjà calculés pour les Revenus (4.2,
  `bucketTotals`/`channelTotals`) ou les Charges directes réelles (4.3bis,
  `directCostBucketTotals`/`directCostChannelTotals`) — aucun nouveau calcul moteur. La clé
  **personnalisée nommée** (bibliothèque réutilisable façon MAPAQ) est **reportée** : hors scope de
  ce round, demanderait une UI de gestion dédiée.
- Réconciliation à la migration : id d'activité orphelin refond dans Général (comme
  `revenueLines`) ; id de canal orphelin conservé tel quel (aucun équivalent neutre côté canal).
- Nettoyage UI concurrent (demandé par l'utilisateur pendant ce round) : colonnes Poste/Catégorie/
  Clé de répartition alignées à largeur égale (136px chacune) et colonne Montant resserrée à la
  largeur exacte nécessaire pour afficher 99 999 999,99 $ sans saut de ligne (106px, mesuré
  empiriquement en navigateur — au-delà, le débordement est normal et attendu), via un
  `<colgroup>` explicite (seule méthode fiable sous `table-layout: fixed` avec un en-tête
  multi-lignes à `colSpan` — une largeur posée sur une 2e ligne d'en-tête est silencieusement
  ignorée par le navigateur) ; encadrés gris retirés de toutes les sous-sections sauf la
  Réconciliation ; totaux de sous-section retirés (redondants avec les sous-totaux) ; infobulles
  ajoutées sur Catégorie/Clé de répartition/contenant Général/les 5 colonnes de Réconciliation ;
  boutons « Ajouter... » remis au style lien bleu de l'onglet Main d'œuvre, déplacés en bas de
  section.
- Correction méthodologique en cours de route : une donnée « Frais fixes par unité théorique »
  (moyenne plate `totalIndirects / totalUnitsSold`) avait été ajoutée par erreur — ne correspond à
  aucune des formules de conversion documentées (toujours par contenant ET par produit, jamais une
  division globale). Entièrement retirée (fonction, UI, tests, guide) suite à la correction de
  l'utilisateur ; voir note de clarification ajoutée dans `04-Conception-Modele.md`.
- **175/175 tests unitaires, 32/32 tests e2e**, lint propre, `npx vite build` propre. Confirmé par
  capture d'écran.

### 4.5bis — Verrouillage par clé, sélection directe, clés personnalisées — ✅ terminée le 14/10
Quatre retours utilisateur après usage réel de la grille de 4.5, avant de passer à la 4.6 (voir
détails tranchés dans `04-Conception-Modele.md`, section « Révision Phase 4.5bis ») :
- **Verrouillage** : une ligne dont la clé de répartition n'est pas Manuel n'a plus ses cellules
  éditables sur l'axe que cette clé détermine (affichées en texte, comme les colonnes indicatives
  de Charges directes) — élimine le risque de double-saisie silencieuse qu'un pré-remplissage
  ponctuel toujours éditable permettait. La grille verrouillée n'est plus une valeur stockée : elle
  se recalcule en direct (`expenseLineEffectiveAllocations`) à chaque changement de Montant, pour
  ne jamais afficher un nombre figé périmé. Revenir à Manuel fige la dernière valeur calculée comme
  point de départ éditable.
- **Sélection directe d'une seule activité ou d'un seul canal** (inspirée de la colonne
  « Répartition » de l'Agro-Calculateur, onglet Rev-Dep) : la liste « Clé de répartition » liste
  désormais aussi chaque activité (dont Général) et chaque canal individuellement — pour les
  dépenses attribuables à une seule colonne.
- **Clés de répartition personnalisées, livrées** (initialement reportées en 4.5) : un % par
  activité et/ou par canal, nommé et réutilisable sur plusieurs lignes, géré dans une fenêtre
  modale dédiée (bouton « Gérer les clés de répartition » en haut de l'onglet). Nouvelle tranche
  d'état `repartitionKeys`, threadée de bout en bout (reducer, App.jsx, sérialisation — avec
  réconciliation des orphelins au chargement, même asymétrie Activités/Canaux qu'ailleurs).
- **Arrondi à 2 décimales** (`round2`, `utils.js`) sur toute la grille Activités/Canaux (saisie
  manuelle et valeurs dérivées) — évite les décimales résiduelles d'un calcul proportionnel.
- Le résumé par Général/Activité/Canal en bas du tableau Frais fixes (demandé façon « VALEUR DES
  CHARGES » du chiffrier SymbiOse) existait déjà — rangée « Sous-total » du tableau — confirmé
  suffisant par l'utilisateur, aucun ajout nécessaire.

**Correction (même jour, 14/10)** — le modèle « deux axes indépendants » ci-dessus (chaque axe
réclamant séparément 100 % du Montant) était une erreur, repérée par l'utilisateur en testant le
badge de vérification : avec « Selon les ventes », l'axe Canaux ne pouvait quasiment jamais
reconstituer 100 % du montant, car la ventilation par canal des Revenus est **indicative
uniquement** (jamais un intrant de calcul) — l'utiliser comme une vraie donnée ici était déjà une
erreur en soi, et calculer séparément « 100 % côté Activités » ET « 100 % côté Canaux » pour la
même dépense l'aurait fait compter deux fois lors de l'agrégation en Phase 4.6. Corrigé vers le
modèle SymbiOse (une seule rangée de vérification par dépense, pas une par axe) : voir
`04-Conception-Modele.md`, section « Correction (même jour, 14/10...) » pour le détail complet.
- Activités et Canaux forment désormais **un seul bassin partagé** par ligne — `locked` (un seul
  indicateur) et `diff` (un seul écart) remplacent `activityLocked`/`channelLocked` et
  `activityDiff`/`channelDiff`.
- « Selon les ventes »/« Selon les charges directes » ne remplissent plus QUE l'axe Activités —
  plus aucune donnée dérivée de la ventilation indicative par canal des Revenus/Charges directes.
  Un montant n'est désormais attribuable à un canal que par sélection directe de ce canal, clé
  personnalisée, ou saisie manuelle.
- Sélection directe d'une activité (ou d'un canal) verrouille désormais la ligne ENTIÈRE (le bassin
  étant partagé, 100 % dans une colonne ne laisse plus rien pour l'autre groupe).
- **177/177 tests unitaires, 35/35 tests e2e** (tests de verrouillage/vérification réécrits pour le
  modèle corrigé), lint propre, `npx vite build` propre. Confirmé par capture d'écran.

**Complément (même jour, 14/10)** — avant de passer à la 4.6 :
- **Bouton « Gérer les clés de répartition »** recoloré en vert (même style que le bouton
  « Nouveau », `bg-green-500`), pour cohérence avec les autres boutons principaux de l'app.
- **Clés par défaut visibles dans la fenêtre modale, en lecture seule** : « Selon les ventes » et
  « Selon les charges directes » y apparaissent désormais avec leur répartition par activité
  ACTUELLE (recalculée à l'ouverture, selon les Revenus/Charges directes réels déjà saisis),
  clairement marquées non modifiables (icône verrou) — pour que leur fonctionnement soit visible,
  jamais une boîte noire. Jamais de colonne Canaux pour ces deux clés (elles ne répartissent que
  sur l'axe Activités, voir la correction ci-dessus).
- **Projet démo complété** : les 8 lignes de frais fixes portent désormais chacune une clé de
  répartition choisie selon le tableau « Contenant suggéré par défaut » (section 1,
  `04-Conception-Modele.md`) — Loyer (Manuel, par surface réelle), Électricité (Selon les charges
  directes), Marketing (Manuel, par canal réel), Commissions (nouvelle clé personnalisée démo
  « Ventes par canal (hors Général) », au prorata des ventes réelles par canal), Salaire de
  direction/Assurances/Comptabilité/Frais bancaires (sélection directe de l'activité Général). Les
  28 000 $ de frais fixes démo se répartissent maintenant exactement sur les colonnes Activités +
  Canaux (confirmé par capture d'écran) — données de test réalistes et complètes pour la Phase 4.6.
  Voir aussi la Phase 4.8 plus bas, résolue par ce même constat.

### 4.6 — Conversion en taux par produit — ✅ terminée le 14/10

**Méthodologie, vérifiée avant implémentation** (à la demande de l'utilisateur, qui a explicitement
demandé une confirmation de rigueur comptable avant de donner le feu vert) — voir le détail complet
dans `04-Conception-Modele.md`, section Phase 4.6 :
- Comparaison des formules RÉELLES (pas juste la structure) de SymbiOse (`Rapport - Coût Revient
  unit.`) et de l'Agro-Calculateur (`Synthèse`) : les deux réduisent, après simplification
  algébrique, à un taux **plat $/unité dans la portée du contenant** (pool ÷ volume). Rejeté pour
  RestoCalculateur : un driver purement volumétrique ignore que les formats varient en taille
  (ex. 220 g vs 1 kg chez SymbiOse même) — un driver doit refléter la consommation RÉELLE de
  ressources (principe ABC, Cooper & Kaplan), pas un décompte brut d'unités.
- Driver retenu pour **Activité** : **coût direct combiné** (matière + emballage + main-d'œuvre +
  sous-traitance, pas un seul composant) par défaut, ou **temps de main-d'œuvre** — les deux déjà
  calculés par format, évitant d'inventer un nouveau concept de données (« unités produites ») que
  l'app ne suit pas. Choisi **par activité** (Paramètres → Activités de production), pas par
  produit — inspiré du « Coefficient d'imputation » de l'Agro-Calculateur, qui s'avère en réalité
  être juste la sélection de l'activité (dont le driver est déjà fixé), pas un choix libre par
  recette. Deux activités peuvent choisir des drivers différents sans casser la réconciliation :
  chaque pool se normalise contre SES PROPRES produits seulement.
- **Général** : mécanisme `indirectCostMethod` existant (ventes/temps de MO) inchangé, appliqué à un
  pool réduit à sa seule part Général (plus la totalité des frais fixes comme avant).
- **Canal : voir la correction du même jour ci-dessous** — la 1ʳᵉ version de cette sous-phase
  proposait un driver au choix par canal (ventes/coût direct/temps de MO), corrigée depuis.

**Implémentation** :
- `engine/analysisData.js` : logique « quelle clé remplit quel contenant » de l'onglet État des
  résultats (`expenseLineEffectiveAllocations`) extraite en fonctions pures
  (`computeExpenseLineEffectiveAllocations`, `computeExpensePoolTotals`,
  `computeDirectCostLineAllocations`, `computeBucketTotalsFromAmounts`, `buildActivityBuckets`) —
  IncomeStatementTab.jsx les importe désormais au lieu de les dupliquer. Nouvelle
  `computeIndirectCostDriverTotals` agrège, par activité et par canal, les DEUX/TROIS drivers
  possibles (toujours les deux, pas seulement celui choisi — permet de changer de driver sans
  recalcul).
- `App.jsx` : calcul en **deux passes** — `computeAnalysisData` sans pools (brouillon, juste pour
  lire les coûts directs/volumes déjà fiables de chaque produit) → pools construits à partir de ce
  brouillon → `computeAnalysisData` à nouveau, cette fois avec les pools (Général réduit,
  Activité/Canal ajoutés). `indirectPools` est un paramètre optionnel en toute fin de signature
  (comme `basePackaging`/`salesChannels` avant lui) : absent, comportement strictement inchangé
  (CostShockSimulator.jsx, pas encore mis à jour, et les ~30 appels positionnels existants de
  analysisData.test.js continuent de fonctionner sans modification).
- `engine/calculateCosts.js` : `productionTimeSeconds`/`portionsSold`/`nbPortions` exposés dans le
  résultat (calculés une fois, peu importe la méthode Général) ; `computeChannelBreakdown` accepte
  un `channelPools` optionnel — chaque canal du format reçoit SA PROPRE part de canal, en plus de
  Général+Activité déjà communs à tous ses canaux → marge nette différente par canal, pas
  seulement à cause du prix.
- Nouveaux champs exposés par `costs` : `costIndirectGeneralPerPortion`,
  `costIndirectActivityPerPortion`, `costIndirectChannelPerPortion` (celui-ci blendé par volume
  réel sur l'ensemble des canaux du format, pour une vue agrégée) — `costIndirectPerPortion` reste
  leur somme (champ existant, rétrocompatible).
- **Paramètres** : sélecteur de driver (+ infobulle « guide de décision causal », pas juste une
  définition) ajouté par activité (Activités de production) seulement — défaut `directCost`,
  migration transparente pour les projets antérieurs. **Pas** de sélecteur par canal (voir
  correction ci-dessous).
- **Recette & Calcul** : section « 5. Frais indirects » retirée (demande explicite de
  l'utilisateur — cet onglet ne montre plus que le COÛT DE PRODUCTION) ; Récapitulatif renuméroté
  5 (était 6) ; guide/tutoriel mis à jour en conséquence (et une incohérence préexistante du guide
  — méthodes d'indirects mortes jamais vraiment branchées, marge nette/point mort déjà retirés le
  06/10 mais jamais documentés comme tels — corrigée au passage).
- **Rapport → Par SKU** : la cascade par canal (inspirée de SymbiOse, déjà en place depuis le 06/10
  avec une note explicite « pas encore ventilé... arrive en Phase 4 ») affiche maintenant le détail
  Général/Activité/Canal (3 nouvelles rangées) avant le total — Général et Activité identiques
  quel que soit le canal (comme chez SymbiOse), Canal variable par colonne.
- **177/177 → 183/183 tests unitaires** (3 nouveaux tests de réconciliation exacte des pools dans
  analysisData.test.js), **37/37 tests e2e** (2 nouveaux tests driver + 1 nouveau test Rapport par
  SKU ; 2 régressions trouvées et corrigées en cours de route — un texte de test figé sur l'ancien
  numéro de section, un sélecteur `select` devenu ambigu avec le nouveau driver de canal), lint
  propre, `npx vite build` propre. Confirmé par capture d'écran.

**Correction (même jour, 14/10, 2e retour utilisateur)** — la proposition initiale pour Canal
(driver au choix : ventes/charges directes/temps de MO, par analogie avec Activité) a été
repoussée : l'utilisateur s'est rappelé que dans l'Agro-Calculateur, le CICI ne se choisit
**qu'à l'activité**, jamais par circuit. Vérification formule par formule de la matrice « Coût de
revient complet » (`Synthèse`, lignes 27+) — voir le détail complet dans
`04-Conception-Modele.md`, section 1ter, point 4 : **aucun sélecteur de driver par circuit dans
l'Agro-Calculateur**. Le circuit applique toujours une **majoration % sur le coût de production
déjà établi** (peu importe quel driver d'activité l'a produit) — jamais un mécanisme indépendant.
C'est la méthode traditionnelle « majoration sur coût de production », qui hérite automatiquement
de la fidélité déjà établie à l'activité et se réconcilie exactement par construction.
- Retiré : le sélecteur de driver par canal (Paramètres → Circuits de vente), le champ
  `indirectCostDriver` sur `salesChannels` (demo, défaut, migration), l'infobulle correspondante.
- `computeIndirectCostDriverTotals` : `channelDriverTotals[canalId]` redevient un seul nombre (la
  valeur totale au coût de production transitant par ce canal), plus un objet à 3 drivers.
- `computeChannelBreakdown` : `channelPools[canalId] = { amount, driverTotal }` (sans `driver`) ;
  la part de canal = coût de production du produit × (pool ÷ driverTotal), toujours.
- Tests mis à jour : le test de réconciliation du canal dans analysisData.test.js recalculé avec
  un vrai coût de production (ingrédient à 1 $) plutôt qu'un driver « ventes » qui n'existe plus ;
  le test e2e du sélecteur de canal (Phase 4.6) supprimé (plus de sélecteur à tester).
- **180/180 tests unitaires**, lint propre, `npx vite build` propre. Confirmé par capture d'écran.

### 4.7 — Assistant d'import de l'état des résultats — ✅ terminée le 15/10 (PDF + fichiers structurés)
- Voir `05-Imports-Integrations.md` pour le détail complet : import des lignes de revenus/dépenses
  catégorisées — `IncomeStatementImportWizardModal.jsx`, même patron en 4 étapes que
  `SalesReportImportWizardModal.jsx` mais sans étape d'agrégation (un état des résultats liste déjà
  un poste par ligne). Type et Catégorie devinés par mots-clés (`guessExpenseCategory`),
  ventilation par activité (fichier structuré seulement) quand la colonne Produit/SKU reconnaît un
  plat existant, choix Additif/Remplacer à la confirmation.
- **Correction (même jour, 15/10, retour utilisateur)** : la 1ère version livrée ne couvrait que le
  CSV/Excel, le **PDF textuel** étant repoussé à plus tard. L'utilisateur a fait remarquer qu'un
  état des résultats est reçu en PDF bien plus souvent qu'en Excel (export natif du comptable) —
  l'ordre de priorité était inversé. Corrigé le même jour, pas reporté : un PDF n'a pas de vraies
  colonnes, donc aucune étape 2 — `pdf.js` (`pdfjs-dist`, chargé en différé via `React.lazy` pour
  ne jamais alourdir le chargement initial) reconstruit chaque ligne de texte par position (les
  fragments à la même hauteur Y, tolérance 2 unités, sont regroupés), puis `parsePdfStatementLine`
  (`utils.js`, fonction pure testée unitairement) isole le poste et son montant en fin de ligne.
  Saute directement de l'étape 1 à l'étape 3. Pas de PDF scanné/image (OCR, hors scope) — message
  d'erreur explicite si aucune ligne n'est reconnue.
- Tests : 2 tests e2e (`e2e/income-statement-import.spec.js` pour le CSV,
  `e2e/income-statement-import-pdf.spec.js` pour le PDF, fixture générée par
  `scripts/generate-income-statement-pdf-fixture.cjs`), 6 tests unitaires pour
  `parsePdfStatementLine`/`guessExpenseCategory`. **189/189 tests unitaires**, **39/39 tests e2e**,
  lint propre, `npx vite build` propre (bundle principal revérifié à sa taille d'origine malgré
  l'ajout de `pdfjs-dist`, grâce au chargement différé).

### 4.8 — Tableau récapitulatif des frais par activité et par canal — ✅ résolue le 14/10 (fusionnée
dans la 4.5bis)
- Demandée le 13/10 : un tableau récapitulatif sous Frais fixes, **par activité de production ET
  par canal de vente**, avec une colonne « Général » et une vérification que la somme des colonnes
  égale le total — inspiré du chiffrier SymbiOse (feuille `6 - Rep. charges fixes`, analysée dans
  `06-Analyse-Chiffrier-SymbiOse.md`, section 3).
- **Confirmé le 14/10 (pendant la 4.5bis) : la rangée « Sous-total » déjà livrée en 4.5 EST ce
  tableau récapitulatif** — elle affiche exactement un total par activité ET par canal, avec Général
  comme contenant à part entière, et la vérification par ligne (Phase 4.5bis) confirme maintenant
  que la somme de toutes les colonnes égale exactement le total des frais fixes (28 000 $ dans la
  démo, voir capture d'écran). L'utilisateur a validé que ce Sous-total suffit — pas de tableau
  séparé à construire.
- La variante « combiné avec les charges directes de la 4.3bis » envisagée dans la demande initiale
  n'a pas été retenue : aucune demande en ce sens depuis, portée non confirmée.

---

## Phase 5 — ❌ abandonnée le 14/10 (voir correction ci-dessous)

~~Main-d'œuvre hors-recette (module léger, ex-Phase 4)~~
~~- Par employé : répartition en % du temps entre production hors-recette, administration, vente.~~
~~- Alimente la section Frais fixes (salaires admin/vente comme frais catégorisés) — dépendance~~
~~  molle : en son absence, ce montant reste saisi manuellement, comme toute donnée de cette app~~
~~  avant qu'une automatisation ne s'y greffe.~~

**Correction (14/10)** — l'utilisateur a questionné la rigueur comptable de cette phase avant son
démarrage, une fois Frais fixes (4.1-4.6) terminé. Réponse, après vérification :
- **En comptabilité réelle, un salaire n'est jamais scindé par % de temps estimé.** Il est enregistré
  par la paie comme **une seule ligne au grand livre**, par poste/département — scinder par estimé
  (« 20 % du temps du chef en admin ») est une technique de **comptabilité de gestion** (allocation
  analytique), pas un fait comptable. Aucune paie standard ne le fait, et un petit transformateur
  n'a généralement pas de suivi du temps assez fin pour le justifier.
- **Ça aurait cassé le principe fondateur de Frais fixes** (Phase 4.1 : « l'état des résultats réel
  — tel qu'il apparaît dans votre vraie comptabilité ») : injecter un montant estimé (ex. une ligne
  « Frais d'administration » synthétique à partir d'un % de salaire) crée soit un double comptage
  (si la ligne réelle « Salaires de production » n'est pas aussi réduite d'autant — ce que la vraie
  comptabilité ne fait jamais), soit un écart permanent et inexpliqué avec le document comptable réel
  que l'utilisateur consulte en parallèle.
- **Argument d'efficacité, également valide** : configurer un % par employé est une nouvelle saisie
  de données — pas moins d'effort que d'entrer directement 1-2 montants en Frais fixes, qui eux
  correspondent exactement à la vraie comptabilité. L'automatisation ne réduisait pas la saisie,
  elle la déplaçait vers un résultat moins fiable.
- **Confirmation croisée** : ni SymbiOse ni l'Agro-Calculateur (nos deux références validées) ne
  scindent un salaire non-recette par % de temps. Leurs modules de main-d'œuvre calculent le coût
  direct d'une recette, jamais une allocation analytique de salaire — cette idée n'avait jamais été
  vérifiée contre une référence réelle, seulement envisagée le 22/09, avant que Frais fixes existe.
- **Conclusion** : la saisie manuelle déjà en place (depuis la 4.1) est la méthode la PLUS
  rigoureuse ici, pas un pis-aller en attendant une automatisation. Rien à construire — la Phase 4
  couvre déjà entièrement ce besoin.

---

## Phase 6 — Intégration transversale et QA technique
- Extension du simulateur de chocs de coûts et du suivi historique/volatilité aux formats,
  activités de production et circuits.
- Extension du rapport de productivité existant (`productivityReport`) pour grouper aussi par
  activité de production (capacité de production par ligne), plutôt qu'un nouveau rapport séparé.
- Tests unitaires (moteur, sérialisation) et vérification manuelle dans l'app.

---

### 6.1 — Simulateur de chocs de coûts : portées « par format » et « par activité » — ✅ terminée le 15/10
- Deux nouvelles portées pour les chocs d'INTRANTS et de MAIN-D'ŒUVRE : `'format'` (target = un
  format de vente précis) et `'activity'` (target = une activité de production) —
  `CostShockSimulator.jsx`. Résolues en une sélection concrète d'ingrédients/employés
  (`expandShockScopes`, `engine/costScenario.js`, fonction pure testée unitairement) à partir de ce
  que ce format/cette activité consomme réellement (ingrédients directs du format, postes utilisés
  dans ses étapes de production) — réutilise le filtrage `'selection'` déjà existant dans
  `applyCostShocks`/`applyLaborShocks` plutôt que de dupliquer la logique de correspondance : ces
  deux fonctions restent inchangées.
- Rapport d'impact étendu avec deux nouveaux tableaux (`computeActivityImpact`,
  `computeChannelImpact`, `engine/analysisData.js`) : marge brute / food cost / coût MO moyens
  pondérés, actuel → scénario, **par activité de production** (pondéré par le mix de vente des
  seuls formats de cette activité — isole son impact propre de la moyenne globale du menu) et
  **par circuit de vente** (pondéré par le volume RÉEL de ce canal, pas la vue tous-canaux).
- **Portée volontairement écartée** : pas de choc directement « sur un circuit » (ex. simuler une
  hausse de la marge d'un distributeur) — un canal n'est pas un COÛT du point de vue du
  transformateur (ses maillons déterminent le prix consommateur, pas son propre coût de revient).
  L'extension aux circuits se fait donc côté RAPPORT (tableau d'impact ci-dessus), pas côté ciblage
  du choc.
- Découverte en testant (comportement correct, pas un bug) : un choc d'intrants scopé à UNE
  activité peut faire bouger une AUTRE activité si elles partagent un ingrédient (son prix est
  global, jamais scopé par activité) — attendu, documenté dans le test e2e dédié plutôt que
  mal-interprété comme une fuite de portée.
- Tests : 12 nouveaux tests unitaires (`costScenario.test.js` ×6, `analysisData.test.js` ×6), 1
  nouveau test e2e (`e2e/cost-shock-simulator-scopes.spec.js`). **201/201 tests unitaires**,
  **41/41 tests e2e**, lint propre, `npx vite build` propre (bundle principal inchangé — aucune
  nouvelle dépendance).

### 6.2 — Suivi historique / volatilité : étendu à l'emballage et au coût direct par format — ✅ terminée le 15/10
- `engine/priceVolatility.js` généralisé : la logique d'amplitude/tendance/palier (auparavant
  seulement `computeIngredientVolatility`, lisant `pt.baseIngredients`) est extraite dans une
  fonction interne commune, réutilisée par deux nouvelles fonctions exportées :
  - `computePackagingVolatility` — même analyse, sur `pt.basePackaging` (poste toujours séparé des
    ingrédients, voir Phase 2).
  - `computeFormatCostVolatility` — sur le **coût direct total par portion** de chaque FORMAT
    (matière + emballage + main-d'œuvre + sous-traitance), déjà figé dans `pt.productsWithCosts`
    à chaque point de référence — aucun recalcul nécessaire, chaque snapshot contient déjà ce
    qu'il faut (confirmé en recherche avant de commencer : bonne nouvelle, pas un chantier de
    schéma de snapshot comme redouté initialement).
- `TrackingTab.jsx` : le bloc de tableau (tri/filtre/pagination/badge de palier), auparavant
  dupliqué pour les ingrédients seulement, extrait en composant réutilisable `VolatilityTable` —
  deux nouvelles sections : « Volatilité des prix d'achat — Emballage » (sous le graphique
  d'évolution du prix des emballages) et « Volatilité du coût direct par format » (sous le
  graphique « Analyse par format »). Pas de colonne Fournisseur pour les formats (n'a pas de sens).
- **Activités/circuits de vente, volontairement pas étendus ici** : contrairement aux formats et à
  l'emballage, un point de référence (snapshot) ne capture ni `productionActivities` ni
  `salesChannels` — une volatilité par activité/canal demanderait d'abord d'ajouter ces champs au
  schéma de snapshot (`handleSaveSnapshot`, `TrackingTab.jsx`), un chantier distinct et plus
  structurant que cette sous-étape. Reporté, pas abandonné.
- Tests : 4 nouveaux tests unitaires (`priceVolatility.test.js`), 1 nouveau test e2e
  (`e2e/tracking-volatility-packaging-format.spec.js`), 1 test e2e existant corrigé
  (`smoke.spec.js` : titre « Volatilité des prix d'achat » devenu ambigu avec le nouveau titre
  « — Emballage », `exact: true` ajouté). **205/205 tests unitaires**, **42/42 tests e2e**, lint
  propre, `npx vite build` propre.

### 6.3 — Rapport de productivité : extension par activité de production — ✅ terminée le 15/10 (Phase 6 complète)
- `App.jsx` (`calculatedGeneralInfo`) : la boucle existante qui accumule
  `totalDirectLaborHoursNeededByPost` (heures de MO réellement nécessaires, par POSTE) accumule
  maintenant AUSSI `totalDirectLaborHoursNeededByActivity` (même boucle, une seule passe — pas de
  recalcul séparé) en groupant par `product.activityId` plutôt que `person.postId`. Un format sans
  activité assignée ne contribue à aucune activité (jamais rattaché à « Général » arbitrairement).
- `productivityReport.byActivity` (nouveau champ, même objet — pas un rapport séparé, comme demandé) :
  une ligne par activité, avec les heures réellement nécessaires et sa part (%) du total du menu.
  **Pas de « heures attendues » par activité** (contrairement au rapport par poste) : un poste/
  employé n'est pas rattaché à une seule activité, rien d'analogue à comparer — la donnée n'existe
  simplement pas, et inventer une répartition aurait été arbitraire.
- `LaborDatabaseTab.jsx` : nouveau tableau « Capacité de production par activité » sous le rapport
  par poste existant (Activité / Heures Productives Réelles / Part du total).
- Vérifié contre les vraies données démo (script `_debug-*` temporaire, supprimé après usage) :
  Plats principaux surgelés 64,8 %, Soupes et potages 19,4 %, Sauces et accompagnements 15,9 % —
  somme exacte à 100 %.
- Tests : 1 nouveau test e2e (`e2e/productivity-report-by-activity.spec.js`). **205/205 tests
  unitaires inchangés** (logique dans `App.jsx`, pas le moteur — même patron que le reste de
  `calculatedGeneralInfo`, jamais extrait en fonction pure testable isolément), **43/43 tests
  e2e**, lint propre, `npx vite build` propre.

**Phase 6 — terminée le 15/10** (6.1 simulateur de chocs, 6.2 volatilité, 6.3 productivité).

## Phase 6.4 — Suppression de « Frais et revenus » (Paramètres) et de son influence sur le coût de revient — ✅ terminée le 18/10

Retour utilisateur du 18/10 : la section « Frais et revenus » de Paramètres (période de référence,
revenus totaux, % du menu analysé, méthode d'attribution, heures d'opération...) devait être
déplacée/retirée, et ses données ne devaient plus influencer le coût de revient. Vérification
méthodologique complète avant toute transformation (comme demandé), détaillée ci-dessous — un vrai
bug a été trouvé en cours de route, pas seulement un déplacement de champs.

**1. Période de référence** — déplacée telle quelle (aucune donnée perdue) tout en haut de l'onglet
État des résultats, avant Revenus (`IncomeStatementTab.jsx`). L'assistant d'import de l'état des
résultats (Phase 4.7) la détecte maintenant automatiquement depuis une colonne Date du fichier
(`INCOME_STATEMENT_APP_FIELDS`, nouveau champ `date`), même patron que l'import de rapport de
ventes (`App.jsx::handleSalesReportImport`) — bascule la période en « Personnalisée » avec les
dates min/max du fichier, sans écraser une période déjà choisie si le fichier n'a pas de date
reconnaissable (fichier structuré seulement ; un PDF textuel n'a pas de colonne par ligne).

**2. `menuRevenuePercentage` — retiré, confirmé redondant (pas seulement déplacé)** : son rôle dans
`calculateCosts.js` (réduire le bassin de frais indirects par un second %, dans les deux méthodes
d'attribution) faisait DOUBLE EMPLOI avec la Phase 4.6 — le bassin Général y est déjà correctement
scopé par la répartition Activité/Canal des Frais fixes avant même d'arriver dans ce calcul.
Appliquer encore un % « part du menu analysé » par-dessus l'aurait réduit une seconde fois. Retiré
des 3 points d'usage (`calculateCosts.js` lignes ~236/282/298 avant correction) et de
`analysisData.js` (`globalBreakEven`, qui réduisait `totalIndirects` par ce même %).

**3. `totalRevenue` — retiré comme intrant de coût, remplacé par le volume RÉEL par canal partout
où c'était possible**, jamais par rien (jamais une estimation fabriquée — voir addendum du 19/10
ci-dessous : une tentative de repli sur `totalRevenue` a été explorée puis explicitement rejetée,
pas seulement laissée de côté) :
   - `calculateCosts.js` : le repli de `portionsSold` (quand `fmt.indirectCosts.portionsSold`
     n'est pas saisi) utilise maintenant `fmt.channelPrices[].volume` — la même donnée réelle que
     `channelBreakdown` utilise déjà ailleurs dans le moteur.
   - `App.jsx` (`calculatedGeneralInfo`) : la reconstruction `totalDirectLaborHoursNeeded` (qui
     alimente `kitchenProductivity` et le rapport de productivité, Phase 6.3) utilise maintenant le
     même volume réel par canal, plus `totalRevenue × menuRevenuePercentage / prix moyen pondéré`.
   - `analysisData.js` : `menuRevenue`/`unitsSoldById` (utilisés par les KPIs pondérés, le rapport
     d'achats, l'analyse ABC, le point mort global $, et la réconciliation réel/théorique) viennent
     maintenant de `p.blended.totalVolume` (volume réel agrégé, déjà calculé pour la matrice BCG)
     et de `Σ netPrice × volume` par canal — plus aucune lecture de `generalInfo.totalRevenue`.

**4. Bug trouvé et corrigé en cours de vérification (pas qu'un simple retrait)** : un premier
repli de `portionsSold` à **1 unité** (quand ni `portionsSold` ni volume réel par canal n'existent)
produisait un coût indirect par portion délirant — tout le bassin divisé par une seule unité (ex.
1 125 $/portion sur « Sauce à spaghetti maison » dans la démo, repéré en vérifiant contre le vrai
rapport Par SKU). Corrigé : sans AUCUNE donnée réelle, `portionsSold` reste `null` et le coût
indirect « ventes » de ce format reste absent (0 $), jamais une estimation fabriquée — même
principe que `channelBreakdown` partout ailleurs dans le moteur. Un SKU encore en % manuel (jamais
de volume réel saisi) affiche donc honnêtement 0 $ de frais fixes tant qu'aucune vente réelle n'y
est rattachée, plutôt qu'un chiffre inventé.

**5. `indirectCostMethod` (méthode d'attribution ventes/temps de MO)** — reste un intrant actif du
moteur (aucune autre donnée ne peut le remplacer) : relocalisé dans État des résultats, à côté de
la liste Frais fixes qu'il gouverne, plutôt que supprimé.

**6. Champs devenus orphelins, section supprimée** : `period`/`startDate`/`endDate` (relocalisés,
voir point 1), `totalRevenue`/`menuRevenuePercentage` (retirés, voir points 2-3),
`totalIndirects`/`totalKitchenLaborCost` affichés en Paramètres (simples miroirs — la vraie donnée
vit dans Frais fixes/Main-d'œuvre, déjà affichée là), `operationHours`/`operationCostPerHour`
(jamais lus par le moteur de calcul, purement diagnostiques, sans autre utilité une fois la section
retirée). La section `#tutorial-section-info-frais` est donc entièrement supprimée de
`ProductInfo.jsx` — plus aucune donnée saisie là n'était connectée à quoi que ce soit après les
points 1-5. Nettoyage en cascade : guide d'utilisation (`InstructionModal.jsx`), tutoriel
(`AppDialogs.jsx`), rapports PDF/Excel (lignes Revenus Totaux/Heures d'opération/Coût horaire
d'opération retirées, orphelines).
- Tests : 209/209 tests unitaires (nouveaux : repli sur volume réel, cas totalement absent → 0 $,
  priorité à `portionsSold` explicite — `calculateCosts.test.js` ; reconstruction par volume réel,
  format sans volume → 0 — `analysisData.test.js`), 46/46 tests e2e (nouveaux :
  `e2e/income-statement-period.spec.js` ×3 — période relocalisée, détection auto par import, bascule
  en Personnalisée avec les bonnes dates — et re-vérification chiffre par chiffre de
  `réconciliation réel/théorique` et `Par SKU : Général/Activité/Canal` contre les vraies données
  démo recalculées), lint propre, `npx vite build` propre.

**Addendum du 19/10 — tentative de repli sur `totalRevenue` EXPLORÉE PUIS REJETÉE (ne pas la
retenter sans relire ce paragraphe) :** un premier retour utilisateur avait fait remarquer que le
point 3 ci-dessus laissait un format sans volume réel par canal propre honnêtement absent (0 $ de
frais indirects « ventes »), alors que le revenu TOTAL réel de l'entreprise (lignes de revenus
réels de l'État des résultats) reste une donnée calculable même dans ce cas — ce qui semblait, à
tort, être une lacune de rigueur comptable. Une hiérarchie à 3 niveaux a donc été implémentée
(`portionsSold` saisi → volume réel par canal → reconstruit depuis `generalInfo.totalRevenue` ÷
prix moyen pondéré × part du mix de vente), avec `generalInfo.totalRevenue` redevenu un champ DÉRIVÉ
de `revenueLines` (même patron que `totalIndirects`).

**Un second retour utilisateur a identifié le vrai problème, plus fondamental : ce repli mélangeait
deux jeux de données que l'architecture de l'app garde délibérément indépendants.** Le moteur de
coût de revient (théorique — modèle de recette : `prixVente`, `salesMix`, `fmt.channelPrices`) et
l'État des résultats (réel — `revenueLines`, `expenseLines`) sont deux sources séparées PAR
CONCEPTION, précisément pour que la Réconciliation réel/théorique (Phase 4.4, point 3 de
04-Conception-Modele.md) ait un sens — elle existe pour MESURER l'écart entre ces deux sources, pas
pour qu'une alimente discrètement l'autre. En repliant le volume théorique d'un SKU sans donnée de
canal sur `generalInfo.totalRevenue` (réel), le théorique de ce SKU devenait partiellement composé
du réel même auquel la réconciliation le compare — un écart artificiellement rétréci, sans gain de
rigueur comptable réel : ce n'est pas qu'une « estimation » un peu moins précise, c'est une
contamination d'une source de données par l'autre, qui masque exactement le signal que la
réconciliation est censée révéler (une partie des ventes réelles n'a pas encore de volume saisi par
canal). La propriété « 100 % du bassin de frais indirects doit être alloué » qui motivait
l'addendum n'était d'ailleurs pas réellement en péril : elle porte sur le partage en DOLLARS du
bassin (`allocatedIndirects = totalIndirects × salesMixPercent / totalActiveSalesMix`, calculé
indépendamment de `portionsSold`), pas sur le TAUX par unité — un SKU sans volume réel ne peut
légitimement pas afficher de coût PAR PORTION (on ne peut pas diviser par une quantité inconnue),
exactement comme `channelBreakdown` omet un canal sans prix ou la matrice BCG exclut un SKU sans
volume réel (principe déjà établi, voir CLAUDE.md) — ce n'était pas une incohérence à corriger.

**Entièrement annulé** : les 3 points d'entrée (`calculateCosts.js`, `App.jsx::calculatedGeneralInfo`,
`analysisData.js::unitsSoldById`/`menuRevenue`) sont revenus à la hiérarchie à 2 niveaux du point 3
ci-dessus (`portionsSold` saisi → volume réel par canal → absent, jamais 1 unité, jamais
`totalRevenue`) ; `generalInfo.totalRevenue` n'est plus dérivé de `revenueLines`
(`App.jsx::handleUpdateRevenueLines` et `projectSerialization.js` retirés) — il n'a plus aucun
lecteur dans le moteur de coût, exactement comme au point 3. Laissé en champ inerte dans la forme
par défaut de `generalInfo` (même traitement que `menuRevenuePercentage`, point 2 ci-dessus — retirer
sa migration/ses tests serait un nettoyage non lié à cette correction). Les tests et valeurs e2e du
point 3 ci-dessus (209/209 unitaires, 46/46 e2e, dont `channel-filter-resume.spec.js` 0.83 $/2.63 $
et `income-statement-params.spec.js` réconciliation à 75 366.10 $/+112.3 %) sont donc à nouveau les
valeurs correctes et actuelles — re-confirmées propres (lint, `npx vitest run`, `npx playwright
test`, `npx vite build`) après cette annulation.

**Addendum du 19/10 (suite) — mise à jour du projet démo (`initialState.js`) et audit méthodologique
complet contre l'app réellement affichée :**
- Nettoyage de données/commentaires devenus faux après les Phases 4.1-6.4 : `demoRevenueLines` et
  `demoDirectCostLines` étaient commentés « pas encore consommé(es) par le moteur » — faux depuis
  les clés de répartition (Phase 4.5bis) et la Réconciliation réel/théorique (Phase 4.4), qui les
  lisent activement. `generalInfo.totalRevenue` (160 000 $, champ d'affichage inerte — jamais lu par
  le moteur de coût, voir addendum précédent) est maintenant calculé depuis `demoRevenueLines`
  (`sumAmountsMap`), comme `totalIndirects` l'est déjà depuis `demoExpenseLines`, plutôt qu'un
  chiffre recopié à la main qui dériverait silencieusement si la liste change. `operationHours`
  (`getDefaultState`/`getEmptyState`) supprimé : plus aucun lecteur depuis la suppression de la
  section « Frais et revenus » (Phase 6.4, point 6) — même sort que `operationCostPerHour`.
- Audit méthodologique contre le projet démo réellement rendu (navigateur, pas seulement les
  assertions e2e déjà en place) :
  - Frais fixes : sous-total 28 000,00 $ ; somme des colonnes Général + 3 Activités + 3 Canaux =
    28 000,00 $ (à l'arrondi) — le pool se réconcilie exactement à l'étape d'allocation (Phase 4.5).
  - Réconciliation réel/théorique : 160 000 $/75 366,10 $ (+112,3 %) Revenus, 100 000 $/72 960,44 $
    (+37,1 %) Charges directes, 60 000 $/2 405,66 $ (+2394,1 %) Marge — valeurs identiques à celles
    déjà confirmées (voir addendum précédent), donc stables après la mise à jour des données démo.
  - Par SKU, « Sauce à spaghetti maison » (le seul format du menu démo sans AUCUN volume réel saisi
    sur aucun canal — volontairement, voir `sales-mix-units-coexistence.spec.js`) : Frais fixes —
    Général/Activité/Canal affichent honnêtement 0,00 $ sur les 3 canaux (jamais une estimation),
    Point mort affiche N/A sur les 3 canaux, alors que son coût matière/emballage/MO (2,26 $/1,34 $/
    3,98 $) reste pleinement calculé — seule la part « ventes » du coût indirect, qui a besoin d'un
    volume pour devenir un taux, est absente.
  - Matrice stratégique (BCG, section « Analyse stratégique et point mort global ») : 0 occurrence
    de « Sauce à spaghetti maison » — exclue comme prévu (décisions du 06-07/10). La matrice séparée
    « Marges nettes des SKUs par canaux » (basée sur le prix net, pas le volume) l'inclut bien, elle
    — comportement distinct et correct, pas une incohérence.
- Tests : 209/209 unitaires, 46/46 e2e, lint et `npx vite build` propres après ce nettoyage (aucune
  valeur numérique n'a changé — la mise à jour ne touchait que des commentaires et le mode de calcul
  d'un champ d'affichage inerte, jamais lu par le moteur).

**Correction (retour utilisateur) — PDS manquant sur chaque format/SKU démo** : l'audit ci-dessus
avait vérifié les calculs mais pas la complétude des données saisies elles-mêmes — aucun format du
projet démo n'avait de PDS (Prix de Détail Suggéré, Phase 3.2bis), alors que `demoChannelPriceSet`
dérive déjà les 3 prix nets de chaque format À PARTIR d'un prix tablette identique à ce que le PDS
représente (vérifié formule par formule contre `computeNetPriceFromPds`/`salesChannelCascade.js` :
épiceries/grandes surfaces reproduisent exactement ce que le PDS donnerait). Cette valeur existait
donc déjà implicitement dans les données, simplement jamais exposée comme champ `pds` du format.
Corrigé par un nouveau petit assembleur `demoFormatPricing(retailPrice, opts)` qui regroupe `{ pds:
retailPrice, channelPrices: demoChannelPriceSet(retailPrice, opts) }` — aucune valeur de prix net
existante n'a changé, seul le champ `pds` a été ajouté (`...demoFormatPricing(...)` remplace
`channelPrices: demoChannelPriceSet(...)` aux 12 formats vendus de la démo). Exception documentée :
le canal « Vente directe » (sans maillon) donnerait normalement prix net = PDS exactement, mais la
démo lui applique volontairement un rabais de 10 % depuis l'origine (`directRatio`, antérieur au
PDS) — cliquer sur « Générer » pour ce canal précis écraserait donc ce rabais, comme pour tout
format réel, un geste volontaire de l'utilisateur jamais appliqué automatiquement. `format-pds-
generate-net-price.spec.js` ajusté : vidait auparavant un PDS absent par défaut pour tester l'état
désactivé du bouton « Générer » — vide maintenant explicitement le champ d'un format qui EN a un,
pour tester la même chose sans dépendre d'une case vide accidentelle des données démo. Vérifié
ensuite dans le navigateur (script Playwright temporaire) : les 12 formats vendus affichent tous un
PDS cohérent avec leur prix net déjà saisi ; seul « Bouillon de poulet maison » (sous-recette
`onMenu: false`, jamais vendue sur aucun canal) reste sans PDS — correct, pas un oubli. 209/209
unitaires, 46/46 e2e (après correction du test ci-dessus), lint et `npx vite build` propres.

## Phase 7 — Revalidation UI/UX transversale et consolidation du guide
Phase dédiée, distincte du QA technique de la Phase 6, une fois toutes les fonctionnalités en
place :
- Passage en revue de l'ensemble de l'app pour cohérence visuelle et d'expérience — repérer les
  bonnes idées nées dans une phase spécifique et les propager aux écrans qui en bénéficieraient.
- Étiquetage markup vs marge vérifié partout où un pourcentage de profit apparaît.
- **Consolidation pédagogique du guide d'utilisation** (`InstructionModal`) : passe finale pour
  s'assurer que le guide explique le pourquoi (pas seulement où cliquer) et couvre l'ensemble des
  nouvelles fonctionnalités.
- Rapport final de fin de projet (programmation, UI, UX, méthodologie).

---

## Corrections UX du 15/10 (avant Phase 6/7)
Trois demandes ponctuelles de l'utilisateur, faites exprès avant de démarrer la Phase 6/7 (la
Phase 7 en particulier suppose « toutes les fonctionnalités en place » — les faire maintenant évite
de repasser sur ces écrans après coup) :

1. **Packaging : outil « Comparer un emballage »** — dupliqué depuis `IngredientsTab.jsx` (même
   logique exacte : filtre par nom, prix unitaire corrigé du taux de perte = « prix efficace »,
   meilleur prix en évidence). `basePackaging` partage déjà la même forme que `baseIngredients`
   (nom, fournisseur, prix unitaire, taux de perte, unité) — aucune adaptation de données requise.
2. **Renommage de l'onglet « Recette & Calcul » → « Recettes et produits »** — bouton d'onglet
   (`App.jsx`), guide d'utilisation (`InstructionModal.jsx`, TOC + corps), tutoriel
   (`AppDialogs.jsx`), info-bulle d'édition de SKU (`SummaryTable.jsx`). Le titre interne de la page
   (« Recette et calcul pour : [sélecteur] », dans `RecipeCalculator.jsx`) n'a pas été touché —
   demande explicitement limitée au titre de l'ONGLET.
3. **Produits et SKUs : le PDS change de nature** — retour utilisateur direct sur la Phase 3.2.
   Avant : un « Prix de détail suggéré » calculé automatiquement PAR CANAL à partir du prix net
   (cascade descendante). Maintenant : le PDS est saisi manuellement UNE SEULE FOIS par format
   (nouvelle colonne, à droite du SKU — le prix tablette visé au consommateur ne varie
   généralement pas par canal, contrairement au prix net producteur) ; chaque canal propose un
   bouton **« Générer »** qui calcule son prix net en REMONTANT sa cascade de maillons à partir de
   ce PDS (`computeNetPriceFromPds`, direction inverse de l'ancienne implémentation — le moteur
   `computeSalesChannelCascade` supportait déjà nativement l'ancrage à n'importe quel maillon, donc
   aucun changement dans `engine/salesChannelCascade.js`). Le prix net généré reste ensuite
   librement modifiable à la main — le bouton ne fige rien. Les champs `cp.pds`/`cp.pdsManual`
   (par canal) disparaissent ; un ancien projet sauvegardé qui les contiendrait encore les ignore
   simplement (orphelins inertes, aucune migration nécessaire).
- Tests : 1 nouveau test e2e (`e2e/format-pds-generate-net-price.spec.js`, valeurs attendues
  dérivées des % réels des canaux du projet démo), `e2e/sales-mix-units-coexistence.spec.js`
  corrigé (décalage d'index d'un `input[inputmode="decimal"]` causé par la nouvelle colonne PDS).
  **189/189 tests unitaires inchangés**, **40/40 tests e2e**, lint propre, `npx vite build` propre.

## Refonte UI du 19/10 — Produits et SKUs en vue maître-détail

Retour utilisateur : la section « Produits et SKUs » (Paramètres) prenait trop de place — chaque
produit était une carte avec son propre `<table>` complet (en-tête de colonnes répété à chaque
produit), rendant la navigation difficile dès qu'il y avait plus de quelques produits. Plusieurs
propositions explorées (panneau latéral/drawer, modale avec navigation précédent/suivant, vue
maître-détail), présentées avec des maquettes ASCII comparatives. **Accordéon explicitement
écarté par l'utilisateur** ("seulement en dernier recours") — voir la mémoire persistante
`feedback_ui_density_preference` : pour tout futur écran liste + détail imbriqué dans ce projet,
privilégier modale/drawer/maître-détail plutôt que l'accordéon comme première proposition.

**Direction retenue : vue maître-détail à deux colonnes.** Une liste compacte de tous les produits
à gauche (nom, catégorie, nombre de formats — une ligne par produit, pas de tableau), scroll
indépendant ; le détail complet du produit sélectionné à droite (même contenu qu'avant : en-tête
du produit, tableau des formats, prix par canal repliables), scroll indépendant lui aussi. La
hauteur de la liste de gauche ne grandit plus jamais avec le détail d'un produit — c'est ce qui
réglait le problème de place. Patron déjà présent dans l'app (`InstructionModal.jsx`, nav + contenu
en deux colonnes) et dans l'esprit de « Recettes et produits » (un seul plat affiché à la fois, via
un sélecteur) — ici avec une vraie liste visible à la place d'un simple menu déroulant.

**Simplification de state, bénéfice inattendu de la refonte** : `src/features/ProductInfo.jsx`
gérait un mécanisme élaboré (`newlyAddedId`, `isSortDisabled`, `prevProductsLength`,
`handleBlurRow`, 2 `useEffect`) pour garder la ligne d'un produit fraîchement ajouté visible et
épinglée le temps que le tri alphabétique la déplace dans la liste à plat. Avec une sélection par
**id** (`selectedProductId`, nouveau state local) plutôt que par position, ce bricolage n'est plus
nécessaire : un seul `useEffect` générique détecte tout id apparu dans `products` (comparaison
d'ensembles avant/après) et le sélectionne directement — couvre à la fois l'ajout d'un item, la
duplication d'un produit (qui s'insère APRÈS l'original, pas en tête — l'ancien mécanisme ne
l'aurait de toute façon pas géré), et même la restauration via « Annuler » une suppression (bonus
non demandé, qui découle naturellement du même mécanisme). Un second `useEffect` garde la
sélection valide : si le produit sélectionné disparaît de la liste filtrée/triée actuelle (supprimé,
ou masqué par un filtre), retombe sur le premier produit visible. `selectedProductId` est
volontairement **local à `ProductInfo`**, jamais partagé avec `editingProductIndex`/
`editingFormatIndex` d'`App.jsx` (qui pilotent l'onglet Recette & Calcul, réinitialisés par
plusieurs chemins non liés à cet écran) — éviter un couplage surprenant entre les deux onglets.

**Comportement responsive** : en dessous du breakpoint `md`, les deux colonnes ne peuvent pas être
côte à côte — un booléen local `mobileShowDetail` bascule l'affichage (liste OU détail, avec un
bouton « Retour à la liste »), ignoré à partir de `md` où les deux restent toujours visibles.
Profitée de cette passe pour corriger un débordement pré-existant du bandeau d'en-tête
(titre + boutons « Importer un rapport de ventes »/« Ajouter un item ») sur petit écran, repéré
lors de la vérification visuelle (empilement `flex-col`/`sm:flex-row` au lieu d'un `flex
justify-between` rigide).

**Portée volontairement limitée** : seul le contenu de `#tutorial-section-info-menu` a changé —
Informations sur l'entreprise, Objectifs stratégiques, Activités de production et Canaux de vente
(reste de l'onglet Paramètres) sont inchangés. Le `<table>` des formats et le détail repliable des
prix par canal, à l'intérieur du panneau de droite, sont repris quasi verbatim de l'ancienne version
— seule la structure EXTÉRIEURE (carte par produit répétée) a disparu.

**Décidé et différé pendant cette même conversation** (gardés en mémoire persistante, pas d'action
ce jour-là) :
- Renommer la case « Au Menu » en « Actif/Inactif » + réflexion sur où afficher ce statut ailleurs
  dans l'app (`deferred_onmenu_rename`) — l'utilisateur avait d'abord demandé de la supprimer,
  croyant à tort qu'elle ne servait qu'à `menuRevenuePercentage` (déjà retiré) ; clarifié qu'elle
  pilote en réalité `format.onMenu`, lu dans tout le moteur (coût de revient, matrice BCG, mix des
  ventes, point mort) — pas touchée.
- Recherche par SKU (le filtre « nom » ne cherche pas dans le SKU), lien direct vers la recette
  depuis cette liste, indice plus visible sur le bouton « Générer » désactivé
  (`deferred_productinfo_ux_ideas`).

**Fichiers touchés** : `src/features/ProductInfo.jsx` (cœur du changement — uniquement le bloc
`#tutorial-section-info-menu` et son state associé) ; `src/components/AppDialogs.jsx` (reformulation
de l'étape de tutoriel ciblant cette section) ; `src/components/InstructionModal.jsx`
(reformulation de la section `guide-param-menu` : liste + détail au lieu d'« une section par
recette ») ; 11 fichiers e2e adaptés au nouveau modèle d'interaction (sélectionner le produit dans
la liste de gauche avant d'interagir avec son détail — les interactions À L'INTÉRIEUR du panneau de
détail, elles, gardent exactement les mêmes locators qu'avant) :
`channel-prices-produits-skus.spec.js`, `format-pds-generate-net-price.spec.js`,
`channel-margins-recette-calcul.spec.js`, `channel-filter-resume.spec.js`,
`sales-mix-units-coexistence.spec.js` (devait lire deux produits : sélectionner l'un, lire sa
valeur, sélectionner l'autre, revenir vérifier), `sales-report-import.spec.js`,
`product-duplication.spec.js` (simplifié : plus besoin de retrouver le duplicata par un id généré,
la sélection automatique s'en charge), `smoke.spec.js`, `subrecipe-ingredient-picker.spec.js`,
`summary-format-navigation.spec.js`, `unit-type-quantity.spec.js`. Découverte en cours de route :
le texte d'état vide (« cliquez sur « Ajouter un item » ») entrait en collision avec
`getByText('Ajouter un item')` ambigu dans 2 de ces fichiers — corrigé par
`getByRole('button', { name: ... })`, plus précis.

Sauvegarde Git faite avant de commencer cette refonte (commit `31bdb2e`, demandé explicitement par
l'utilisateur comme filet de sécurité) — voir plan complet archivé si besoin de retracer le
raisonnement détaillé des choix de design.

- Tests : 209/209 unitaires (inchangés — cet écran n'a pas de couverture unitaire, tout vit dans
  `src/engine`/`src/state`), 46/46 e2e (après les 11 fichiers adaptés), vérification visuelle
  (desktop + mobile 390px, script Playwright temporaire supprimé après usage) confirmant le
  comportement liste/détail et le repli mobile, lint et `npx vite build` propres.

**Correction du même jour (retour utilisateur, captures d'écran) — débordements dans le panneau de
détail plus étroit :** le passage d'un tableau pleine page à une colonne de détail plus étroite a
révélé 3 problèmes de mise en page, invisibles dans l'ancienne disposition plein écran :
1. **Le `<table>` des formats n'avait aucun `overflow-x-auto`** — sous ~830 px de large utile, les
   dernières colonnes (Mix, Au Menu, Actions) disparaissaient carrément hors champ au lieu de
   rester accessibles. Vérifié par script Playwright temporaire (`el.scrollWidth` vs `clientWidth`)
   avant et après correctif. Corrigé en enveloppant le tableau d'un conteneur `overflow-x-auto`,
   avec `whitespace-nowrap` sur chaque en-tête de colonne (plus de "CANAUX / DE / VENTE" étalé sur
   3 lignes) et les libellés les plus longs raccourcis ("Canaux de vente" → "Canaux", "Mix des
   Ventes (%)" → "Mix (%)" — signification complète toujours dans l'infobulle).
2. **En-tête du produit (Nom du plat/Activité/Catégorie/actions)** : largeurs fixes (`w-48`) qui
   tenaient sur la pleine largeur de page mais plus dans ~300-800 px — select natif et Combobox
   tronqués. Restructuré : Nom du plat seul sur sa ligne (jamais cramé), Activité/Catégorie
   en-dessous sur une grille `sm:grid-cols-2` qui se replie à 1 colonne plutôt que de tronquer.
3. **`Pagination` (`src/components/common.jsx`, composant partagé)** : `flex justify-between`
   rigide faisait couper "Items par page :" et "Page X sur Y" mot par mot dans la colonne de
   gauche (~288 px). Corrigé en `flex-wrap` + `whitespace-nowrap` par groupe — passe proprement à 2
   lignes au lieu de casser chaque mot ; comportement inchangé en pleine largeur (Ingrédients,
   Packaging), confirmé par la suite e2e complète.
- Tests : 209/209 unitaires, 46/46 e2e, lint et `npx vite build` propres après ce correctif.

**Révision du même jour (retour utilisateur) — le scroll horizontal lui-même jugé désagréable,
remplacé par une compaction au lieu d'un défilement :** plutôt que de garder le `overflow-x-auto`
comme solution principale, resserré les 7 colonnes du tableau des formats pour qu'elles tiennent
sans défilement à partir de ~1024 px de large (vérifié par script Playwright temporaire mesurant
`scrollWidth` vs `clientWidth` à 1920/1440/1280/1100/1024 px — overflow ramené à 0 partout) :
paddings de cellule `px-4` → `px-2`, polices des champs alignées sur `text-sm` (déjà la norme un
niveau plus bas, dans le détail des prix par canal — incohérence corrigée au passage), largeurs
resserrées (SKU `w-40`→`w-28`, PDS/Mix `w-24`→`w-16`, quantité `w-16`→`w-12`), icônes d'action
réduites (16px → 14px), colonne de liste de gauche rétrécie (`md:w-72 lg:w-80` →
`md:w-60 lg:w-64`, donne plus de place à la colonne de détail). `overflow-x-auto` gardé comme filet
de sécurité silencieux (aucun effet tant que le contenu tient) pour les cas extrêmes, pas comme
solution principale. Le libellé du bouton « N canal/canaux » (déplié/replié) n'a volontairement
PAS été raccourci malgré la tentation initiale — plusieurs tests e2e vérifient ce texte exact
(`channel-prices-produits-skus.spec.js`, `sales-report-import.spec.js`) ; la place a été trouvée
ailleurs plutôt que de risquer une régression de test pour un gain marginal.
- Tests : 209/209 unitaires, 46/46 e2e (aucun ajusté — gains de place purement visuels, aucun texte
  vérifié par un test n'a changé), lint et `npx vite build` propres.

## Canaux de vente du 19/10 — maillons déplacés dans une modale (`ChannelLinksModal`)

Retour utilisateur : la liste des maillons d'un canal s'affichait en permanence (un canal à 2
maillons prenait ~150 px), même problème que Produits et SKUs avant sa refonte maître-détail.
L'utilisateur a lui-même suggéré de reprendre le patron du `PersonnelModal` existant (assignation
du personnel par étape de production, dans Recette & Calcul : une ligne résumé + lien « Modifier »
qui ouvre une modale) — confirmé après présentation de 2 autres directions (aperçu en cascade
inline + modale, compaction pure sans modale) via maquettes ASCII comparatives.

**Nouveau composant `ChannelLinksModal`** (`src/components/common.jsx`, juste après
`PersonnelModal`, même style de modale centrée `fixed inset-0 bg-opacity-50`) : liste les maillons
d'UN canal (nom, marge/markup, %, suppression, bouton « Ajouter un maillon »), fermeture par
« Terminé ». Reçoit `channel` + les 3 handlers déjà existants dans `ProductInfo.jsx`
(`handleAddLink`/`handleLinkChange`/`handleRemoveLink`, inchangés — seule leur consommation côté UI
change). Chaque carte de canal, dans `ProductInfo.jsx`, n'affiche plus que : nom du canal + une
ligne résumé (« N maillons » / « Aucun maillon ») + bouton « Gérer les maillons » qui ouvre la
modale via un nouveau state local `linksModalChannelId`. Gain de hauteur : un canal à 2 maillons
passe de ~150 px à ~50 px dans l'écran principal, peu importe son nombre de maillons.
- Fichiers touchés : `src/components/common.jsx` (nouveau `ChannelLinksModal`),
  `src/features/ProductInfo.jsx` (remplace le bloc inline par le résumé + la modale),
  `src/components/InstructionModal.jsx` (reformulation de `guide-param-channels`),
  `e2e/sales-channels-params.spec.js` (seul test touchant l'édition inline des maillons — adapté
  pour passer par la modale).
- Tests : 209/209 unitaires, 46/46 e2e, vérification visuelle (0, 1 et 2 maillons) confirmant la
  réduction de hauteur et le bon fonctionnement de la modale, lint et `npx vite build` propres.

## Petites corrections UX du 19/10 (suite)

1. **Renommage de l'onglet « Recettes et produits » → « Production »** — bouton d'onglet
   (`App.jsx`), guide d'utilisation (`InstructionModal.jsx` : TOC, titre de section, 2 mentions
   croisées), tutoriel (`AppDialogs.jsx`), info-bulle d'édition de SKU (`SummaryTable.jsx`). Le
   titre interne de la page (« Recette et calcul pour : [sélecteur] », dans `RecipeCalculator.jsx`)
   n'a volontairement pas été touché — même limitation explicite qu'au renommage du 15/10
   (demande portant sur le nom de l'ONGLET, pas le titre interne). 2 tests e2e adaptés
   (`channel-margins-recette-calcul.spec.js`, `unit-type-quantity.spec.js`).

2. **Position de défilement conservée par onglet** — retour utilisateur : changer d'onglet puis
   revenir au précédent ne redonnait ni le haut de page ni la position quittée, mais un mélange
   des deux (le scroll du navigateur reste un seul état global ; `renderActiveTab()` ne garde
   qu'un seul onglet monté à la fois — switch, pas de montage simultané — donc rien ne « se
   souvient » nativement d'un onglet à l'autre). Corrigé par un suivi manuel dans
   `scrollPositionsRef` (`App.jsx`, keyé par `activeTab`) : un listener `scroll` met à jour la
   position courante en continu (pas de capture ponctuelle au moment de quitter l'onglet,
   plus robuste) ; au changement d'onglet, restauration via `window.scrollTo` après un court délai
   (100 ms, même patron que les cas similaires déjà présents dans l'app) pour laisser le temps au
   contenu — parfois chargé en lazy (`Suspense`) — d'atteindre sa hauteur finale avant de
   positionner le défilement. Vérifié par script Playwright temporaire (défilement exact restauré
   au pixel près après un aller-retour d'onglet).
- Tests : 209/209 unitaires, 46/46 e2e, lint et `npx vite build` propres.

3. **Point mort réintroduit en bas du récapitulatif de Production** — retiré le 06/10 (décision de
   l'époque : concept dépendant des frais fixes/de l'analyse globale, pas de la recette elle-même,
   déplacé vers Rapport → Par SKU, avec son propre calcul local `breakEvenForProduct` alors
   supprimé). L'utilisateur a demandé de le remettre, mais explicitement **sans le recalculer** :
   affiche directement `breakEvenUnits`, déjà calculé par le pipeline complet
   (`analysisData.productsWithCosts[...].channelBreakdown[...]`, qui a accès à l'allocation réelle
   des frais fixes — RecipeCalculator seul ne l'a pas, son `computeChannelBreakdown` local est
   appelé sans le paramètre `allocatedIndirects`). Nouvelle tuile en bas de la cascade du
   récapitulatif (après Prix de Vente), retrouve l'entrée correspondant au format et au canal
   actuellement sélectionnés dans `analysisData`, affiche `N/A` si absente (aucun canal rattaché,
   ou marge ≤ 0) — jamais une valeur forcée. Masquée pendant une simulation de prix (reste celle du
   prix réel, comme le sélecteur de canal). Bénéfice confirmé par test : modifier un prix net dans
   Produits et SKUs puis revenir sur Production met à jour le point mort immédiatement, puisque
   `analysisData` se recalcule déjà à chaque changement de `products` — aucune synchronisation à
   maintenir, contrairement à l'ancien calcul local dupliqué. Guide d'utilisation mis à jour
   (`guide-recette-recap`).
- Tests : 209/209 unitaires, 46/46 e2e, vérification fonctionnelle par script Playwright temporaire
  (point mort affiché, et baisse bien après une hausse du prix net du canal), lint et
  `npx vite build` propres.

**Correction du même jour — le point mort s'effaçait pendant la simulation de prix.** Retour
utilisateur : les autres tuiles du récapitulatif (Coût Matière %, Marge de contribution, Marge
brute, Prix de Vente) affichent déjà un comparatif réel/simulé pendant une simulation
(`renderComparison`, `RecipeCalculator.jsx`) — le point mort, lui, disparaissait entièrement
(`{!isSimulating && (...)}`). Corrigé en lui appliquant le même comparatif, PAS en recalculant
l'allocation des frais fixes (Général/Activité/Canal, Phase 4.6) : `allocatedIndirects` (la part $
allouée à ce format) ne dépend pas du prix, donc identique au prix réel ou simulé — déduite du
canal PRINCIPAL déjà calculé par `analysisData` (`margeBruteDollar × breakEvenUnits`, en inversant
la formule existante), puis seule la division finale est refaite avec la marge brute du prix
simulé (`Math.ceil(allocatedIndirects ÷ margeBruteDollar simulée)`) — exactement la même formule
que `computeChannelBreakdown` utilise déjà pour le prix réel, appliquée localement au prix simulé
seulement (jamais une ré-implémentation de l'allocation elle-même). Basé sur le canal PRINCIPAL
pendant la simulation (comme `costs`/`simulatedCosts`), puisque le sélecteur de canal reste masqué
à ce moment-là — cohérent avec le reste du récapitulatif. `renderComparison(..., higherIsBetter:
false)` colore correctement la variation : moins d'unités à vendre après une hausse de prix
s'affiche en vert. Guide d'utilisation mis à jour.
- Tests : 209/209 unitaires, 46/46 e2e, vérification visuelle par script Playwright temporaire
  (point mort reste affiché en mode simulation, comparatif correctement coloré), lint et
  `npx vite build` propres.

## Unités de mesure activables (20/10)

Retour utilisateur : les unités (g, kg, ml, L, unité) étaient codées en dur partout où une unité
se choisit — aucun moyen de calculer à l'hectolitre, à la tonne, en livres, etc. Première piste
(unités personnalisées à facteur de conversion libre) écartée par l'utilisateur lui-même : « créer
ses propres unités ne reviendrait qu'à généré des problèmes pour le convertisseur ». Solution
retenue : une modale à cases à cocher (même patron que `AllergenModal`) activant/désactivant des
unités parmi un catalogue étendu déjà défini et validé par l'app (pas de conversion libre, donc
aucun risque d'incohérence) — les 5 historiques restant actives par défaut. Catalogue validé par
une recherche web (norme GS1/UN·CEFACT Rec 20 pour les codes d'unités, réglementation ACIA pour le
statut métrique obligatoire/impérial facultatif sur l'étiquetage canadien) : ajout de oz, lb,
tonne (masse), cl, hL, fl oz, gal (volume), douzaine (discrète) — 13 unités au total dans
`CONVERSION_FACTORS` (`src/utils.js`).

**Nouvel état de projet persisté `activeUnits`** — suit exactement le patron déjà établi pour
`salesChannels`/`productionActivities` : `initialState.js` (défaut = les 5 historiques via le
nouvel export `DEFAULT_ACTIVE_UNITS`), `projectReducer.js` (`SET_ACTIVE_UNITS`), `App.jsx`
(`setActiveUnits`, propagé dans tous les handlers reset/démo/chargement), `projectSerialization.js`
(migration à repli gardé par longueur — un projet sauvegardé avant cette fonctionnalité n'a jamais
`activeUnits`, retombe proprement sur les 5 historiques, aucune régression).

**Nouveau helper partagé `filterActiveUnits(units, activeUnits, currentValue)`** (`src/utils.js`) —
garde TOUJOURS `currentValue` dans la liste même si cette unité a été désactivée depuis, pour ne
jamais casser silencieusement un ingrédient/format/ligne de recette existant dont le `<select>` se
retrouverait avec une valeur ne correspondant à aucune option (principe « donnée absente reste
absente, jamais forcée » appliqué à l'inverse : une donnée déjà présente n'est jamais invalidée).
Un seul helper, réutilisé aux 6 points d'appel partout où une unité se choisit — confirmé
explicitement par l'utilisateur que la portée doit couvrir Ingrédients et Packaging en plus de
Produits et SKUs, pas seulement un écran isolé.

**Nouvelle modale `UnitsModal`** (`src/components/common.jsx`, juste après `AllergenModal`, même
style exact) : cases à cocher groupées par famille (Masse/Volume/Discrètes), regroupement dérivé
live de `CONVERSION_FACTORS[u].base` (pas de structure parallèle à maintenir). Bouton déclencheur
« Gérer les unités de mesure » dans Paramètres (`ProductInfo.jsx`), nouvelle section compacte
placée juste après Informations sur l'entreprise/Objectifs stratégiques, avant Activités de
production.

- Fichiers touchés : `src/utils.js` (catalogue étendu, `DEFAULT_ACTIVE_UNITS`,
  `UNIT_BASE_FAMILY_LABELS`, `filterActiveUnits`), `src/components/common.jsx` (`UnitsModal`,
  `AddFormatModal` reçoit `activeUnits`), `src/state/initialState.js`, `projectReducer.js`,
  `projectSerialization.js`, `App.jsx` (plomberie `activeUnits` identique au patron
  `salesChannels`), `src/features/IngredientsTab.jsx`, `PackagingTab.jsx`, `ProductInfo.jsx`
  (bouton + select de format), `RecipeCalculator.jsx` (2 selects de ligne de recette + passage du
  prop à `AddFormatModal`). Hors scope, volontairement : `CatalogImportWizardModal.jsx` (chaîne de
  reconnaissance de synonymes textuels depuis un fichier importé, pas un contrôle de « choix » —
  limite documentée, correction manuelle possible après import via les selects désormais
  dynamiques).
- Tests : 215/215 unitaires (nouveaux : `filterActiveUnits` dans `utils.test.js`, migration
  `activeUnits` dans `projectSerialization.test.js`, `SET_ACTIVE_UNITS`/`toProjectState` dans
  `projectReducer.test.js`), 46/46 e2e, vérification fonctionnelle par script Playwright temporaire
  (activation de « lb »/« douzaine » propagée à Ingrédients/Packaging/Produits et SKUs/Recette &
  Calcul ; désactivation d'une unité déjà utilisée par une donnée existante confirmée sans casse du
  select correspondant), lint et `npx vite build` propres.

## Restructuration du rapport Par SKU et ajout du Bénéfice brut/net (20/10)

Deux retours utilisateur distincts, traités ensemble :

1. **Rapport → Par SKU, section « Revenu et marge brute »** : l'utilisateur voulait retrouver la
   structure du chiffrier SymbiOse (`Rapport - Coût Revient unit.`, confirmé par lecture directe du
   fichier `Inspiration/Coût de revient_SymbiOse.xlsx`) — PDS, puis le coût des maillons, puis le
   prix net. Nouvel ordre des lignes : **PDS** (prix de détail suggéré du format, `format.pds`,
   identique pour tous les canaux — « — » si non saisi) → **Frais de mise en marché** (PDS moins
   prix de vente de CE canal — le total déjà implicite dans la cascade de maillons, contrairement à
   SymbiOse qui le détaille en 3 lignes séparées que notre modèle de maillons ne modélise pas
   séparément) → **Prix de vente** (renommé depuis « Prix net », valeur inchangée). Bénéfice
   brut/Marge brute inchangés, toujours après.
2. **Rapport → Par SKU, section « Seuil de rentabilité par canal de vente »** : ajout de 3 lignes
   avant le Point mort existant, reprenant les totaux du même chiffrier SymbiOse (section « SEUIL
   DE RENTABILITÉ PAR CANAL DE VENTE ») — **Revenu total** (prix de vente × volume réel du canal),
   **Frais totaux** (coût net par unité × volume réel) et **Bénéfices / Pertes** (marge nette $ ×
   volume réel). Toutes les trois affichent « — » quand aucun volume réel n'est saisi pour ce canal
   (jamais un total à 0 $ inventé — même principe que le reste de l'app).
3. **État des résultats → Réconciliation réel/théorique** : la ligne « Marge » (Revenus − Charges
   directes) renommée **Bénéfice brut** ; nouvelle ligne **Bénéfice net** = Bénéfice brut moins le
   total des frais fixes (`generalInfo.totalIndirects`, déjà affiché en sous-total du tableau
   Dépenses). Un seul total de frais fixes existe dans l'app (saisi une fois, jamais modélisé par
   produit) — soustrait identiquement du réel ET du théorique dans `computeRealVsTheoreticalReconciliation`
   (`engine/analysisData.js`), pour que l'écart entre les deux colonnes ne vienne jamais de ce total
   commun, uniquement du Bénéfice brut au-dessus. Déroge volontairement au principe du 13/10 (« pas
   de taux de frais fixes par unité ») : ici c'est un total $, pas une nouvelle moyenne par unité.
- Fichiers touchés : `src/features/SummaryTable.jsx` (`BySkuWaterfall`), `src/engine/analysisData.js`
  (`computeRealVsTheoreticalReconciliation`), `src/engine/analysisData.test.js`,
  `src/features/IncomeStatementTab.jsx` (passe `totalIndirects`, renomme la ligne mise en évidence),
  `src/components/InstructionModal.jsx` (guide de la Réconciliation).
- Tests : 216/216 unitaires (nouveau test `computeRealVsTheoreticalReconciliation` avec
  `totalIndirects`), 46/46 e2e (test de réconciliation du projet démo adapté aux nouvelles valeurs
  attendues), vérification fonctionnelle par script Playwright temporaire (toutes les nouvelles
  lignes affichées avec les bonnes valeurs sur un SKU multi-canal du projet démo), lint et
  `npx vite build` propres.
