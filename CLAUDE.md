# RestoCalculateur (Transfo Calculateur)

Outil de calcul de coût de revient pour un transformateur alimentaire (pas un restaurant) :
recettes multi-formats, emballage, circuits de vente à prix/volumes distincts, frais fixes
catégorisés. React 18 + Vite + Electron. Moteur de calcul pur dans `src/engine/`, testé via
Vitest ; UI testée via Playwright (`e2e/`).

## Avant toute chose : lire la feuille de route

Toute la planification, l'état d'avancement et le raisonnement derrière les décisions vivent dans
`Projet_Claude/`, pas dans ce fichier :

- **`03-Feuille-de-route.md`** — état d'avancement par phase, avec dates et tests passés. Toujours
  commencer ici pour savoir ce qui est fait et ce qui reste à faire.
- **`02-Journal-Decisions.md`** — décisions d'architecture majeures et leur justification (prises
  tôt dans le projet, avant le découpage en phases).
- **`04-Conception-Modele.md`** — modèle de données détaillé.
- **`05-Imports-Integrations.md`** — spécification des assistants d'import.
- **`06-Analyse-Chiffrier-SymbiOse.md`** — analyse d'un chiffrier réel fourni comme inspiration
  (pas un modèle à reproduire tel quel).
- **`01-Analyse-Besoins.md`** — besoins initiaux.

Après chaque phase ou sous-étape complétée, mettre à jour `03-Feuille-de-route.md` (date,
décisions prises, tests passés) — c'est la mémoire du projet entre les sessions.

## Conventions établies

- **Communication avec l'utilisateur en français.**
- **Rien n'est considéré terminé sans le cycle de vérification complet, et les 4 doivent être
  propres :**
  ```
  npx eslint .
  npx vitest run
  npx playwright test
  npx vite build
  ```
- **Scripts d'investigation temporaires** : préfixe `_debug-*.test.js` (Vitest) ou `_debug-*.spec.js`
  (Playwright) pour vérifier une hypothèse avec les vraies données du projet démo plutôt que de
  raisonner dans le vide. Toujours supprimés après usage — jamais commités.
- **Une donnée absente reste absente, jamais forcée à 0** — principe appliqué partout
  (`channelBreakdown` omet un canal sans prix, la matrice BCG exclut un SKU sans volume réel
  plutôt que de le classer à 0 %, etc.). Nouveau code doit suivre le même principe plutôt que de
  combler un trou avec une valeur par défaut arbitraire.
- **`Inspiration/`** contient des chiffriers/calculateurs réels d'autres organisations (MAPAQ,
  SymbiOse), fournis par l'utilisateur comme référence — données tierces/sensibles, dans
  `.gitignore`, jamais à committer.
