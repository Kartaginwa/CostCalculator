# Imports et intégrations — état actuel et refonte prévue

Ce fichier isole le sujet des assistants d'import, qui traverse plusieurs phases de la feuille de
route (Frais fixes, Circuits de vente) et mérite son propre suivi pour ne pas se perdre au milieu
de l'implémentation d'une phase.

## État actuel

- **`ImportWizardModal.jsx`** (onglet Ingrédients) : importe une liste d'ingrédients (nom,
  fournisseur, prix, format, perte %) depuis un fichier externe, avec mapping de colonnes
  (`APP_FIELDS` dans `utils.js`). Reste pertinent tel quel pour la version transformation — sera
  simplement dupliqué/adapté pour le catalogue Packaging (mêmes champs).
- **`SalesReportImportWizardModal.jsx`** (onglet Paramètres → Produits et SKUs, ex-
  `PosImportWizardModal.jsx`, remplacé le 06/10) : importe un rapport de vente PAR CANAL — un
  export comptable (QuickBooks, Odoo...), un rapport par distributeur/circuit, ou tout fichier
  listant plat, quantité vendue et prix — nom du plat, format, canal, prix net, quantité vendue,
  date. Met à jour `format.channelPrices[]` (prix net + volume par canal) plutôt qu'un
  `prixVente`/`salesMix` à plat ; le `salesMix` de chaque format et `generalInfo.totalRevenue`
  sont ensuite re-dérivés des volumes réels (voir `src/engine/salesMixFromChannels.js`). Import
  ADDITIF : un fichier ne couvre généralement qu'un canal à la fois, les autres entrées
  `channelPrices` restent intactes.

## Constat de l'utilisateur (22/09) — ✅ résolu le 06/10

1. **L'import « POS » doit viser des rapports de vente / états des résultats plutôt qu'un POS.**
   Un transformateur n'a généralement pas de système de caisse — ses données de vente viennent de
   rapports de vente (par distributeur, par circuit) ou de l'état des résultats produit par sa
   comptabilité.

   **Détail validé le 06/10** (une fois les Formats de vente et les Circuits de vente en place) :
   - Canal non reconnu dans le fichier → proposé à la **création** par défaut, avec possibilité de
     lier manuellement à un canal existant ou d'ignorer la ligne.
   - Format non reconnu → **jamais** de création automatique (touche la recette) — seulement lier
     à un format existant, ou ignorer la ligne.
   - Doit fonctionner avec des exports comptables (QuickBooks, Odoo), pas seulement un POS —
     mots-clés de correspondance de colonnes volontairement larges ; un format source précis
     pourra être affiné plus tard sans toucher au modèle sous-jacent (format × canal).
   Voir `03-Feuille-de-route.md`, Phase 3.4, pour le détail d'implémentation.

2. **Un import dédié doit exister dans la section Frais fixes pour l'état des résultats.**
   Objectif : importer directement les lignes de dépenses catégorisées (et les revenus) depuis un
   état des résultats externe, plutôt que de tout ressaisir à la main. Nuance importante
   soulevée par l'utilisateur : *idéalement*, les revenus devraient pouvoir être ventilés par SKU
   (produit) dans la section Résultats de l'import — mais l'utilisateur note lui-même que **ce
   n'est presque jamais le cas dans un état des résultats réel** (les EF agrègent généralement les
   revenus en une ou quelques lignes, sans détail par produit). L'assistant d'import devra donc :
   - supporter le cas courant (revenus agrégés, pas de détail SKU) sans le traiter comme une
     erreur ;
   - offrir, quand la source le permet, une ventilation par SKU en option (ex. un export
     comptable plus détaillé, ou un rapport de vente complémentaire) ;
   - mapper les lignes de dépenses vers les catégories du nouvel état de résultats (frais
     généraux de production, frais financiers, frais d'administration, frais de vente).
   *Statut : ✅ résolu le 15/10 — voir Phase 4.7 ci-dessous.*

## Phase 4.7 — Assistant d'import de l'état des résultats — ✅ terminée le 15/10

`IncomeStatementImportWizardModal.jsx` — **deux sources possibles**, pas seulement un fichier
structuré :

- **Fichier structuré (CSV/Excel)** : même patron en 4 étapes que
  `SalesReportImportWizardModal.jsx`, mais sans étape d'agrégation (un état des résultats liste
  déjà un poste par ligne). Étape 2 (mapping) via `INCOME_STATEMENT_APP_FIELDS` (`utils.js`) —
  Poste et Montant requis ; Type, Catégorie et Produit/SKU optionnels.
- **PDF textuel** — **ajouté en correction le 15/10, suite à un retour utilisateur** : la 1ère
  version de cette phase avait reporté le PDF à une amélioration future, en misant sur le CSV/Excel
  comme format principal. L'utilisateur a fait remarquer qu'un état des résultats est le plus
  souvent REÇU en PDF (export natif du comptable) — le CSV/Excel est le cas rare, pas l'inverse.
  Corrigé le même jour : un PDF n'a pas de vraies colonnes, donc pas d'étape 2 — chaque ligne de
  texte est reconstruite par position (regroupement des fragments `pdf.js` par coordonnée Y,
  tolérance 2 unités), puis `parsePdfStatementLine` (`utils.js`, pur, testé unitairement) isole le
  poste et son montant en fin de ligne (gère `$`, séparateurs espace/virgule/point, parenthèses
  pour un montant négatif). Saute directement de l'étape 1 à l'étape 3 (résolution). Pas de PDF
  scanné/image (demanderait de l'OCR, hors scope) — message d'erreur explicite si aucune ligne
  n'est reconnue. `pdfjs-dist` (nouvelle dépendance, ESM pur depuis la v6 — pas de build UMD comme
  XLSX.js/jsPDF, donc importé directement via Vite plutôt que vendu dans `public/libs/`) est
  chargé en différé (`React.lazy`) pour ne jamais alourdir le chargement initial de l'app : ~450 kB
  + ~1.26 Mo de worker, seulement au moment d'ouvrir l'assistant.
- **Étape 3 (résolution, commune aux deux sources)** : chaque ligne devine son Type (Revenu/Dépense
  — mots-clés sur la colonne Type si mappée, sinon sur le libellé/catégorie) et sa Catégorie de
  Frais fixes (`guessExpenseCategory`, mots-clés larges, retombe sur "Frais d'administration" si
  rien ne correspond — jamais "Frais généraux de production" par défaut, qui impliquerait à tort
  un lien avec la production). Poste et Montant restent éditables ligne par ligne (correction
  manuelle, surtout utile pour un PDF où le texte est reconstruit automatiquement).
  - **Ventilation par SKU** : fichier structuré SEULEMENT (un PDF textuel n'a pas de colonne
    Produit/SKU séparée) — quand la colonne Produit/SKU est mappée et que son texte correspond au
    `platName` d'un produit existant (`activityId` de ce produit), le revenu est automatiquement
    rattaché à CETTE activité plutôt qu'à Général. Le cas courant (revenus agrégés sans détail
    produit, ou tout import PDF) retombe simplement sur Général, librement modifiable.
- **Étape 4 (confirmation)** : choix Additif (par défaut, recommandé) vs Remplacer — Remplacer
  écrase ENTIÈREMENT les tableaux Revenus ET Frais fixes par le contenu du fichier (un état des
  résultats importé est traité comme la nouvelle source de vérité complète, pas une correction
  partielle d'une seule ligne).
- Chaque ligne importée devient une ligne de Revenus/Frais fixes « normale », immédiatement
  éditable comme si elle avait été saisie à la main (`repartitionKey: 'manual'` pour les Frais
  fixes importés).
- Tests : 2 tests e2e dédiés (`e2e/income-statement-import.spec.js` pour le CSV,
  `e2e/income-statement-import-pdf.spec.js` pour le PDF — fixture générée par
  `scripts/generate-income-statement-pdf-fixture.cjs` via jsPDF, poste et montant écrits par deux
  appels `.text()` séparés pour reproduire fidèlement la mise en page d'un export réel), 6 tests
  unitaires pour `parsePdfStatementLine`/`guessExpenseCategory`. **189/189 tests unitaires**,
  **39/39 tests e2e**, lint propre, `dist/` reconstruit (bundle principal revérifié à sa taille
  d'avant l'ajout de `pdfjs-dist`, grâce au chargement différé).

## Impact sur la feuille de route

- **Phase 3.4 (Circuits de vente) : terminée le 06/10** — refonte de l'import des ventes.
- **Phase 4.7 (Frais fixes) : terminée le 15/10** — assistant d'import de l'état des résultats
  (point 2 ci-dessus), PDF textuel ET fichier structuré CSV/Excel.
