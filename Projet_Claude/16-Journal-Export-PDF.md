# Journal des décisions — refonte de l'export PDF (22/11/2026)

Statut : **phases 0 à 8 faites le 22/11.** Ce document est le point d'entrée : il résume ce qui a été décidé, pourquoi, où c'est dans le code, et ce qui reste ouvert. Le détail de chaque étape est dans `03-Feuille-de-route.md` ; le plan d'origine dans `12-Plan-Export-PDF.md`.

## 1. Règles du chantier (posées par l'utilisateur)
1. **Aucun calcul recopié** : tout chiffre du rapport vient des moteurs que les écrans utilisent déjà. Quand un moteur ne l'exposait pas, on a *extrait* le calcul existant (jamais réécrit).
2. **Aucune IA** : les constats viennent des règles de l'application, les blocs « Ce que cela veut dire » de gabarits fixes, le glossaire du guide.
3. **Tout est local** : impression dans l'application, sans navigateur externe, sans serveur, sans réseau.
4. Les quatre vérifications propres à chaque étape : `npx eslint .`, `npx vitest run`, `npx playwright test`, `npx vite build`.
5. Rien n'est validé dans Git sans demande.

## 2. Décisions de conception (maquette et plan)
| # | Décision | Raison |
|---|---|---|
| D1 | HTML composé dans l'application, imprimé par Chromium (fenêtre cachée d'Electron) | Un moteur de mise en page fluide à écrire une seule fois ; texte sélectionnable ; symboles natifs ; testable (Playwright + pdfjs) |
| D2 | Détail de recette : trois petits tableaux (matières, emballage, main-d'œuvre par étape) avec le coût de chaque ligne | Lisibilité ; perte assumée de la base, de la perte et du rendement par ligne |
| D3 | Graphiques identiques à ceux de l'application (mêmes variables ; $/unité sans prix) | Cohérence écran / rapport |
| D4 | Constats revus pour **toutes** les sections, classés sur deux axes (portée, gravité) | Les constats servent au rapport et, plus tard, aux onglets |
| D5 | Commentaire de la direction saisi à l'export, **enregistré avec le projet**, imprimé seulement s'il existe | Aucune case vide ; poids négligeable |
| D7 | Pile de polices Helvetica / Arial ; Arimo non incluse | Mesure et impression sur la même machine |
| D8 | Pas de courbes de prix par ingrédient | Trop lourd |
| D9, D10 | Palette et visuels de la maquette validée | Uniformité |
| D11 | Promotion des constats majeurs (par entité et agrégés) vers la synthèse ; versions agrégées conservées | Les agrégés restent des constats à part entière |
| — | Moyenne de bénéfice brut par heure : **celle de l'écran Main-d'œuvre** (marge de croissance, 87,39 $/h sur le démo) | Règle 1 ; le constat « moins bon usage du temps » disparaît sur le démo |
| — | Sensibilité traitée comme un test de résistance : gravité selon la perte simulée | Un résultat qui résiste n'est pas une question de survie |
| — | Chaque fiche commence sur sa page ; une cascade ne se coupe qu'entre deux sections ; au moins 2 lignes de chaque côté d'une coupure | Lisibilité |
| — | Options d'export dans `uiSettings.reportOptions` (comme le scénario de chocs) | Aucun changement du réducteur ni de la liste des tranches du fichier |

## 3. Où est quoi
- **Moteur de constats** : `src/engine/` — `findingKit.js`, `findingMeta.js` (portée, gravité), `entityFindings.js` (constats par entité), `findingSurfaces.js` (Forces / Faiblesses, chapitres, fiches), `reportReadings.js` (tableau d'évolution, quatre lectures), `profitCascade.js`, `skuCascade.js`, `trackingSeries.js`, `reportThresholds.js` (tous les seuils).
- **Extractions du moteur** : `calculateCostLines` (`calculateCosts.js`, détail de recette), `calculatedGeneralInfo.js` (sorti de `App.jsx`), `allergens.js` (sorti de `RecipeCalculator.jsx`).
- **Mise en page** : `src/reports/layout/` — contrat de contenu par attributs `data-*` (voir l'en-tête de `paginate.js`), composition en plusieurs passes.
- **Rapport** : `src/reports/report/` — `model.js` (aucun calcul), `chapters.js`, `fiches.js`, `annexes.js`, `front.js`, `charts.js`, `styles.js`, `strings.js` (textes centralisés), `glossary.js`, `period.js`, `buildReport.js`.
- **Impression** : `electron/reportPrint.cjs`, `electron/preload.cjs` (seul pont : `reportBridge.printToPdf`), `src/reports/exportPdf.js` (repli navigateur), `src/reports/exportFlow.js`.
- **Fenêtre d'export** : `src/components/ReportExportModal.jsx` ; options : `src/state/reportOptions.js`.
- **Scénarios de recette** : `src/engine/testing/reportScenarios.js`.
- **Guide** : chapitre « Exporter le rapport PDF et le classeur Excel » (`guide-exports`) ; infobulles `export.*` ; visite : une bulle sur le bouton du rapport.
- **Supprimé** : l'ancien `generatePdf.js` (1 150 lignes) et son test.

## 4. Comment vérifier
- Rapport complet du démo : `Projet_Claude/Exemple-Rapport.pdf` (44 pages ; commentaire d'exemple au chapitre 2 ; période saisie en exemple).
- Parité avec l'ancien PDF : `e2e/report-parity.spec.js` ; cas limites : `src/reports/report/scenarios.test.js` et `e2e/report-scenarios.spec.js` ; impression réelle : `e2e/electron-report.spec.js` (dev, production, application empaquetée).
- Reconstruire l'application : `npm run build`, puis `npx electron-builder --win` (installateur NSIS dans `release/`, ignoré par Git).

## 5. Pièges rencontrés (à ne pas refaire)
- Le compilateur React refuse un gestionnaire défini **avant** les valeurs calculées qu'il utilise, et les blocs `finally` dans un composant.
- Un bloc « collé au suivant » en fin de fiche absorbait le saut de page de la fiche suivante (corrigé dans le moteur de mise en page, test de régression).
- `ELECTRON_RUN_AS_NODE` (hérité de VS Code) empêche Electron de démarrer : le retirer de l'environnement.
- La règle du projet interdit `toFixed` brut dans les rapports : utiliser `rnd` (`format.js`).
- Les fichiers du dépôt sont en CRLF : normaliser les fichiers créés.

## 6. Ce qui reste ouvert
1. Allergène **« soy »** du démo (clé attendue : « soybeans ») : à corriger dans `initialState.js` (6 occurrences) si l'utilisateur le décide.
2. **Relecture des textes des constats** (`15-Revue-Textes-Constats.md`) avec la révision de la langue avant la livraison.
3. Police Arimo : facultatif.
4. Constats visibles aussi **dans les onglets** de l'application et règles de moindre valeur du catalogue (phase 9 du plan, après la mise en service).
5. Rien n'est validé dans Git.
