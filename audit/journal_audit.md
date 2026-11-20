# Journal d'audit — RestoCalculateur (Transfo Calculateur)

Audit en lecture seule. Date : 2026-11-20. Seul le dossier `audit/` a été créé ; aucun fichier de l'application n'a été modifié (`git status` : seul `audit/` s'ajoute aux fichiers non suivis préexistants).

## Étape 0 — Exploration du code
- Fait : lecture de `CLAUDE.md`, `package.json`, `vite.config.mjs`, arborescence (146 fichiers suivis).
- Nature : application de bureau Electron + React 18 + Vite ; moteur de calcul pur dans `src/engine/` ; état dans `src/state/` ; persistance par fichier JSON (aucune base de données, aucun serveur). Tests : Vitest (`src/**/*.test.js`) et Playwright (`e2e/`).
- Calculs de coûts repérés : `src/engine/calculateCosts.js` (cœur), `src/engine/analysisData.js` (pools de frais fixes, marges par canal, réconciliation, achats), `src/engine/laborHours.js` + `src/App.jsx:295-380` + `src/engine/analysisPipeline.js` (absorption de la main-d'œuvre), `src/engine/yieldCalculator.js` (rendement), `src/utils.js` (conversions, parsing), `src/engine/costScenario.js` / `CostShockSimulator.jsx` (simulateur), `src/reports/*` (exports PDF/Excel — non audités en détail), `IngredientsTab.jsx:200` (prix unitaire). Aucune requête SQL, aucune procédure, aucune tâche planifiée, aucun import automatisé hors assistants CSV/Excel/PDF (`*ImportWizardModal.jsx`).
- Calculs côté client : la totalité (application locale).
- Secrets : aucun fichier `.env` ouvert ni lu.
- Jeu de données : `getDefaultState()` (`src/state/initialState.js:184`) — « Boréal Mets Préparés inc. », 11 produits / 13 formats, 18 ingrédients, 8 emballages, 4 postes de MO, 3 activités, 3 canaux, 28 000 $ de frais fixes.

## Étape 1 — Reconstitution du modèle
Voir rapport §3. Les commentaires du code sont très détaillés ; les écarts doc/code relevés sont consignés au rapport (constats 5, 6, 9).

## Étape 2/3 — Revue méthodologique et du code
Lecture intégrale de `calculateCosts.js`, `analysisData.js`, `laborHours.js`, `analysisPipeline.js`, `yieldCalculator.js`, `utils.js`, `projectChecks.js`, extraits de `App.jsx`, `initialState.js`, `IngredientsTab.jsx`, `RecipeCalculator.jsx`, `projectSerialization.js`.

## Étape 4 — Recalcul indépendant
- `audit/recalculs/recalcul_independant.py` (Python, `decimal`, précision 40) : réécriture de la logique sans réutiliser le code de l'application ; seules les données d'entrée du jeu de démo sont partagées (`audit/annexes/demo_inputs.json`, exportées par le harnais).
- `audit/recalculs/harness_app.test.js` (Vitest) : exécute la logique de l'application **sur le jeu de démo uniquement** (`getDefaultState`), sans fichier de projet réel ; produit `app_output_demo.json`, `app_output_edgecases.json`, `app_output_complements.json`.
- Résultat : écart absolu maximal 6,4 × 10⁻⁵ $ par portion ; entièrement expliqué par le constat 5 (diagnostic : en utilisant le `nbPortions` stocké pour les heures, l'écart tombe à 1 × 10⁻¹⁴ point).
- Suite de tests de l'application : `npx vitest run` → 21 fichiers, 356 tests, tous réussis (inclut le harnais d'audit). Couverture de code non mesurée (aucun outil de couverture configuré). Tests Playwright (`e2e/`) non exécutés (lancent l'interface Electron/navigateur — non requis pour l'audit ; non vérifié).

## Étape 5 — Contrôles et gouvernance
Voir rapport constat 15. Persistance par fichier JSON, pas de sauvegarde automatique (`App.jsx:880`), pas de contrôle d'accès, pas de journal.

## Limites
Exports PDF/Excel, assistants d'import et interface non audités ligne à ligne. Aucune donnée réelle d'entreprise n'a été fournie ni utilisée.
