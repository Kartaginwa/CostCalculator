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
  aucune action requise ici.
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

## Phase 4 — Frais fixes (ex-« Comptabilité », renommé le 05/10)

Renommé à la demande de l'utilisateur : cette section catégorise et répartit les frais fixes/
indirects de l'entreprise, ce n'est pas une comptabilité complète (pas d'AR/AP, pas de taxes) —
« Frais fixes » décrit mieux son contenu réel et évite d'en laisser croire plus que ce qu'elle fait.

### 4.1 — État de résultats catégorisé
- Nouvelle tranche d'état (dépenses par ligne, chacune avec catégorie — généraux de production /
  vente-mise en marché / administration / financiers — et montant total), remplace
  `generalInfo.totalIndirects`.
- Migration des projets existants (ancien `totalIndirects` à plat → à convertir ou redemander).

### 4.2 — Allocation à deux axes
- Par ligne de dépense : choix entre clé de répartition prédéfinie (ventes, temps de MO, charges
  directes), clé personnalisée créée par l'utilisateur, ou montant manuel — répartition sur les
  deux axes (activité de production, canal de vente — disponible depuis la Phase 3), avec
  vérification en temps réel du total.
- Axe suggéré par défaut selon la catégorie (voir `04-Conception-Modele.md`), jamais imposé.

### 4.3 — Conversion en taux par produit
- Méthode de conversion du pool d'indirects de chaque activité en taux par produit/format (au
  prorata des ventes / du temps de MO / du coût direct), choisie par activité — dans
  `calculateCosts.js`. Réconciliation exacte du pool conservée (principe RestoCalculateur).

### 4.4 — Assistant d'import de l'état des résultats
- Voir `05-Imports-Integrations.md` : import des lignes de dépenses catégorisées, support des
  revenus agrégés (cas courant) et ventilation par SKU en option quand la source le permet.
- Info-bulles + mise à jour du guide pour l'ensemble de la section.

---

## Phase 5 — Main-d'œuvre hors-recette (module léger, ex-Phase 4)
- Par employé : répartition en % du temps entre production hors-recette, administration, vente.
- Alimente la section Frais fixes (salaires admin/vente comme frais catégorisés) — dépendance
  molle : en son absence, ce montant reste saisi manuellement, comme toute donnée de cette app
  avant qu'une automatisation ne s'y greffe.

---

## Phase 6 — Intégration transversale et QA technique
- Extension du simulateur de chocs de coûts et du suivi historique/volatilité aux formats,
  activités de production et circuits.
- Extension du rapport de productivité existant (`productivityReport`) pour grouper aussi par
  activité de production (capacité de production par ligne), plutôt qu'un nouveau rapport séparé.
- Tests unitaires (moteur, sérialisation) et vérification manuelle dans l'app.

---

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
