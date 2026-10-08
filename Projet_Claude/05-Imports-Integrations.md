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
   *Statut : décidé dans son principe — à concevoir en détail pendant la Phase 4 (Frais fixes).*

## Impact sur la feuille de route

- **Phase 3.4 (Circuits de vente) : terminée le 06/10** — refonte de l'import des ventes.
- Tâche restante pour la **Phase 4 (Frais fixes)** : assistant d'import de l'état des résultats
  (point 2 ci-dessus), à concevoir en détail quand cette phase démarrera.
