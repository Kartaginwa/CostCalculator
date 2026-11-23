# Plan d'action — Refonte de l'export PDF (rapport d'analyse)

Statut : **plan convenu le 22/11/2026 (décisions D1 à D11) ; phases 0 et 1 faites, phase 2 faite le 22/11 (sauf relecture des textes et ligne « principaux ingrédients »), phases 3 à 8 faites le 22/11 (journal : 16-Journal-Export-PDF.md) ; voir `03-Feuille-de-route.md`** (voir section 7). Rien n'est développé. Base : la maquette validée (artefact privé https://claude.ai/artifact/PRgEHnAzgbYHqKHZ9XRxtP, copie `Projet_Claude/Maquette-Rapport-PDF.html`) et la note de mémoire `project_rapport_pdf_maquette`.

## 1. Objectif et périmètre

- Remplacer l'export actuel (`src/reports/generatePdf.js`, jsPDF, environ 30 pages fixes) par le rapport de la maquette : couverture, sommaire, 7 chapitres, annexes ; environ 40 pages sur le projet démo.
- Aucun texte généré par IA : constats de l'application, gabarits à règles fixes, glossaire du guide.
- **Hors périmètre** : export Excel (`exportToExcel.js`), PDF du guide (`generateGuidePdf.js`), visite guidée (adaptation minimale seulement).

## 2. Décision d'architecture (à valider : D1)

| | A. Rester sur jsPDF | B. Composer en HTML, imprimer avec Chromium (recommandé) |
|---|---|---|
| Mise en page fluide (coupures, titres collés, en-têtes répétés) | À écrire entièrement : jsPDF n'a aucun moteur de mise en page | Moteur de pagination de la maquette, déjà éprouvé |
| Graphiques | Dessinés à la main, un par un | SVG (les fonctions de la maquette se reprennent) |
| Symboles (▲ ▼ ≥ ≤ →) | Absents des polices standard : remplacements ou polices à intégrer | Natifs |
| Texte du PDF | Sélectionnable | Sélectionnable (impression Chromium) |
| Test | Difficile | Playwright `page.pdf()` et pdfjs-dist (déjà une dépendance) |
| Coût | 2 à 3 fois plus élevé | Moyen ; ajoute un pont Electron |

**Principe retenu pour B** : le moteur de la maquette découpe le contenu en pages fixes (A4) dans le renderer, avec en-têtes, pieds de page, numéros et renvois « → p. N » calculés ; le résultat est ensuite imprimé en PDF par Chromium. Il ne dépend donc ni des marges de page CSS ni des en-têtes d'impression (non disponibles de façon fiable dans Electron 29).

**Tout est local (condition posée par l'utilisateur)** : l'impression se fait dans l'application elle-même, par une fenêtre cachée d'Electron. Aucun navigateur externe, aucun serveur, aucun accès réseau : le rapport est composé en mémoire, imprimé, puis enregistré par la boîte « Enregistrer sous ». Le repli par `window.print()` ne sert qu'au développement dans un navigateur.

Contraintes à lever :
- `electron/preload.cjs` est vide et le renderer est en bac à sable : il faut un pont IPC (`contextBridge`) et un gestionnaire dans `main.cjs` (fenêtre cachée, `printToPDF`, boîte « Enregistrer sous »). Le durcissement actuel (pas de nouvelles fenêtres, pas de navigation) doit rester intact.
- Hors Electron (navigateur de développement, e2e) : repli par `window.print()` ; les tests utilisent `page.pdf()`.
- Vitest tourne en environnement `node` : le moteur de pagination (mesure DOM) se teste par Playwright, pas par Vitest. Les règles de contenu se testent par Vitest.

## 3. Ce que l'application doit fournir (écarts relevés par la maquette)

### 3.1 À extraire des composants vers le moteur (existe, mais pas réutilisable)
| Élément | Où c'est calculé aujourd'hui | Travail |
|---|---|---|
| Cascade PDS → marge nette → point mort par canal | `BySkuWaterfall` dans `SummaryTable.jsx` (écart des maillons, frais fixes totaux, etc.) | Fonction pure `engine/skuCascade.js` ; l'écran et le rapport l'utilisent |
| Séries d'évolution par produit (4 courbes) | `getProductKpiDataForPdf` dans `generatePdf.js` | Fonction pure dans le moteur, partagée avec l'écran Par SKU |
| Effet des variations de prix (en $) | Règle `history-price-effect` de `keyFindings.js` | Exposer le calcul (aujourd'hui seulement dans le texte du constat) |

### 3.2 Existe dans le moteur (réutilisé tel quel)
Tuiles et moyennes pondérées, points morts, marge de sécurité (`laborReport.js`), réconciliation, totaux par canal et par activité, matrice activité × canal, matrice stratégique, contribution, achats et ABC (ingrédients **et** emballages), volatilité (les deux), cascade de la paie, coût réel de l'heure, rentabilité à l'heure, marge de croissance, constats clés (≈ 35 règles), points de référence et KPI des relevés.

### 3.3 À créer (règles fixes, sans IA)
| Élément | Description | Module |
|---|---|---|
| **Constats du produit** | Constats spécifiques dont le sujet est ce format (classe, déficit par canal, coût matière au-dessus de la cible, bénéfice brut par heure, autre format) : les mêmes règles que le reste du moteur, filtrées par sujet (voir 3.4) | `engine/keyFindings.js` (règles par entité) |
| **« Ce que cela veut dire »** (4 blocs) | Gabarits : réconciliation (seuil ± 5 %), évolution (sommet, creux, écart sur 12 mois), activité × canal (cases en perte), main-d'œuvre | `engine/reportReadings.js` |
| Tableau « aujourd'hui / 3 relevés / 12 mois » | Lecture directe des points de référence (valeurs que les constats d'évolution calculent déjà) | `engine/trendRows.js` |
| Cascade du revenu au bénéfice et « sur chaque dollar de vente » | Mise en série de totaux déjà calculés | `engine/profitCascade.js` |
| Ligne « principaux ingrédients » | Tri des trois lignes les plus coûteuses d'un format | `engine/reportReadings.js` |
| Sélection des termes du glossaire | Recherche de chaque terme (singulier ou pluriel) dans le texte du rapport | `reports/glossarySelection.js` |
| Période en toutes lettres | Imprimée seulement si `startDate` et `endDate` existent | `reports/formatPeriod.js` |
| Seuils | Tout seuil nouveau (± 5 %, 10 % d'écart d'usage du temps…) dans `reportThresholds.js` | existant |

### 3.4 Constats : un classement à deux axes, pour toutes les sections
Les constats seront aussi utilisés dans l'application (onglets). On les classe donc selon deux axes, propriétés de **la règle** :

- **Portée** : *générale* (concerne l'entreprise dans son ensemble) ou *spécifique* (concerne un thème ou une entité : un produit, un canal, une activité, un fournisseur, un poste…). Une règle spécifique déclare son **sujet** (type et identifiant).
- **Gravité** : *mineure*, *moyenne* ou *majeure*, calculée par la règle (impact en $ rapporté aux ventes, ou gravité de la décision : survie, moteurs de profit, efficacité, information). Les niveaux et seuils vont dans `reportThresholds.js`.

Les groupes actuels (objectifs, évolution, structure) restent comme **type** d'affichage dans la Vue d'ensemble.

Où chaque constat s'affiche :
| Surface | Constats affichés |
|---|---|
| Vue d'ensemble (écran) et chapitre 1 (rapport) : Forces / Faiblesses | Portée générale **et** gravité majeure (limite par colonne) |
| Chaque onglet / chapitre du rapport | Portée spécifique du sujet de la section, **toutes gravités**, de la plus grave à la moins grave |
| Fiche d'un produit | Constats spécifiques dont le sujet est ce format : ce sont les mêmes règles, filtrées ; **`productFindings` n'est donc plus un module séparé** |

Conséquences à connaître :
1. **Le chapitre 1 de la maquette change** : au lieu d'imprimer tous les constats (pages 3 et 4), il n'imprime que les constats généraux et majeurs ; le reste vit dans les chapitres, où il apparaît déjà. Le rapport y gagne en lisibilité et perd la répétition. À confirmer (D11).
2. **Promotion** : un constat spécifique de gravité majeure peut aussi remonter dans Forces / Faiblesses (règle unique, pas de doublon de règle). Par exemple « Boucherie Nordique : 50 % des achats ».
3. **Versions par entité et versions agrégées coexistent** : une règle spécifique produit un constat par entité (« le Chili perd dans 2 canaux ») ; une règle agrégée résume (« 5 produits sur 12 perdent de l'argent »). **Les versions agrégées actuelles sont conservées** : elles restent des constats à part entière et **peuvent elles aussi être promues** dans Forces / Faiblesses lorsqu'elles décrivent une réalité majeure de l'entreprise. Il s'agit d'ajouter les versions par entité, pas de remplacer les agrégées.
4. **Revue de tous les constats existants** à la lumière de ce classement (décision du 22/11) : chaque règle reçoit sa portée, son sujet et sa gravité, et son texte est relu pour sa nouvelle surface ; la gravité actuelle (`tier`, `weight`, `impact`) est reprise, pas réinventée. Les identifiants restent stables (ancres du guide).

Travail prévu (phase 2) :
1. **Cadre** : métadonnées (portée, sujet, gravité), filtres par surface, migration des règles existantes, tests de classement (aucune règle sans portée ni gravité).
2. **Audit de couverture** par chapitre (règles du catalogue codées, manquantes, inutiles). Le moteur code une soixantaine de familles de règles ; le catalogue de 80 règles est plus avancé que les notes de la feuille de route. Correspondance : Rentabilité et Coûts → chapitres 1 et 2 ; Réel / théorique et Sensibilité → chapitre 2 ; Produits → chapitre 3 et fiches ; Canaux et Activités → chapitre 4 ; Approvisionnement → chapitre 5 ; Main-d'œuvre → chapitre 6 ; Évolution → chapitres 1, 2 et 5.
3. **Cible par chapitre** : minimum de constats spécifiques pour qu'aucun chapitre ne soit pauvre (la maquette en montre entre 2 et 6).
4. **Règles manquantes retenues** (tests par règle, seuils dans `reportThresholds.js`), puis les quatre blocs « Ce que cela veut dire » (gabarits).
5. Les règles de moindre valeur du catalogue restent après la mise en service (phase 9), de même que l'**affichage des constats dans les onglets** de l'application (le moteur les fournit déjà classés).

### 3.5 Données et état du projet
- **Options d'export enregistrées avec le projet** : chapitres cochés, commentaire par chapitre, case des salaires individuels. Poids négligeable : une dizaine de chaînes de texte (longueur limitée, par exemple 1 000 caractères par chapitre) et trois indicateurs. Cela touche `projectReducer`, `projectSerialization`, la migration des anciens fichiers et leurs tests.
- **Période** : les dates existent déjà (État des résultats, import) ; la fenêtre d'export signale leur absence (avertissement de la fenêtre, jamais dans le rapport).
- **Données absentes** : chaque chapitre déclare ses données requises (relevés, chiffres réels, PDS, cibles) ; sans elles il est grisé avec la raison. Le rapport n'imprime jamais de zéro à la place d'une donnée absente.

### 3.6 Vocabulaire et langue
- Le rapport ne dit pas « direct / indirect » pour la main-d'œuvre (vocabulaire à changer ailleurs) et suit « frais fixes », CICI, « perte stock », « charge de travail ». Les chaînes du rapport sont centralisées dans un seul fichier pour qu'un changement de vocabulaire soit un changement à un endroit.
- `vocabulaire.test.js` est étendu aux gabarits du rapport.
- La révision de la langue (étape déjà prévue avant le rapport final) inclut ces textes.

### 3.7 Parité des graphiques avec l'application (écarts relevés dans la maquette)
Principe de l'utilisateur : **les graphiques du rapport sont ceux de l'application, avec les mêmes variables suivies.** Relecture de `SummaryTable.jsx` :

| Graphique | Dans l'application | Dans la maquette | Correction |
|---|---|---|---|
| Évolution globale | 4 lignes : marge brute, coût matière, coût **emballage**, coût main-d'œuvre | 3 lignes (sans emballage) | Ajouter la ligne emballage |
| Évolution d'un produit avec prix | 5 lignes : coût matière, **emballage**, main-d'œuvre, frais indirects, marge nette (en %) | 4 lignes (sans emballage) | Ajouter la ligne emballage |
| Évolution d'un produit sans prix | 4 lignes en $/unité : coût matière, emballage, main-d'œuvre, coût de revient | Absent | Reprendre ce graphique (l'application le fait déjà : D3 est donc réglée) |
| Prix unitaire d'un ingrédient / d'un emballage | Courbe du prix unitaire de l'élément choisi | Absent | **Reste absent** : une courbe par élément alourdirait le rapport (D8) |
| Classement par contribution | Barres horizontales | Barres horizontales | Déjà conforme |

Couleurs : **la palette de la maquette est conservée** pour l'uniformité du rapport (D9) ; les **variables suivies** sont celles de l'application. Libellés : repris de l'application (par exemple « Coût frais indirects » tant que l'application le dit ; les chaînes sont centralisées).

Les autres visuels de la maquette (cascade du revenu au bénéfice, « sur chaque dollar de vente », barres de paie et de fournisseurs) **sont conservés tels quels** (D10). Règle de cette phase : corriger les écarts, ne rien créer de nouveau.

## 4. Phases

Légende d'effort : **S** (une séance), **M** (quelques séances), **L** (une dizaine de séances). Chaque phase se termine par les quatre vérifications (`eslint`, `vitest`, `playwright`, `vite build`), la mise à jour de `03-Feuille-de-route.md` et, s'il y a du texte visible, infobulles et guide.

| # | Phase | Livrable | Critère d'acceptation | Effort |
|---|---|---|---|---|
| 0 | Préparation | Tag Git `sauvegarde-avant-refonte-pdf` ; décisions (section 7) ; **correction de la maquette** (parité des graphiques, 3.7) ; maquette archivée dans le dépôt ; **fiche de parité** (chaque élément de l'ancien PDF : conservé, déplacé, retiré, avec la raison) | Fiche signée par l'utilisateur | S |
| 1 | Extractions du moteur | `skuCascade`, séries par produit, effet des prix ; l'écran Par SKU utilise ces fonctions | Aucun changement visible ; tests existants verts ; nouveaux tests unitaires sur le démo | M |
| 2 | Constats de toutes les sections | **Cadre à deux axes** (portée, gravité) et migration des règles ; **audit de couverture** par chapitre ; règles manquantes retenues ; constats du produit (règles filtrées par sujet) ; `reportReadings`, `trendRows`, `profitCascade` ; seuils | Chaque chapitre a sa cible de constats atteinte ; tests par règle (déclenchée, muette, limite) sur le démo et sur des données minimales ; aucune règle ne fait d'hypothèse de cause | L |
| 3 | Moteur de mise en page | `src/reports/layout/` : mesure DOM, coupures aux lignes, titres collés, en-têtes répétés, coupure de la cascade entre sections, sauts forcés (chapitre, fiche), numéros et renvois en deux passes | e2e : aucun débordement, aucun titre seul, saut avant chaque chapitre et chaque fiche, pages remplies à ≥ 85 % hors fin de chapitre | L |
| 4 | Gabarits du rapport | Couverture, sommaire, chapitres 1 à 7, annexes ; graphiques SVG (barres, courbes **identiques à ceux de l'application**, cascade, 2 × 2, cellules de couleur) ; palette (bleu, vert de la marque) ; police de la maquette (D7 ; inclusion d'Arimo reportée en fin de phase 7) | Rendu conforme à la maquette sur le démo (capture comparée) ; texte sélectionnable | L |
| 5 | Export (pont Electron) | API du préchargement, `printToPDF` en fenêtre cachée, boîte « Enregistrer sous », repli navigateur | PDF produit dans l'application empaquetée ; durcissement inchangé ; erreur claire si l'impression échoue | M |
| 6 | Fenêtre d'export et persistance | Remplace `PdfOptionsModal` : titre, « présenté à », chapitres (grisés sans données), commentaires, case des salaires ; stockage dans le projet | Anciens projets s'ouvrent ; options retrouvées à la réouverture ; commentaire absent = aucune trace dans le rapport | M |
| 7 | Recette et parité | Comparaison ancien / nouveau (fiche de parité) ; cas limites : projet vide, sans PDS, sans relevés, sans chiffres réels, sans période, 1 produit, 50 produits | Aucun `NaN` ni `undefined` dans le texte du PDF (vérifié par pdfjs-dist) ; temps de génération acceptable | M |
| 8 | Documentation et nettoyage | Guide (section « Exporter le rapport »), infobulles, glossaire, visite (mention), journal des décisions ; suppression de l'ancien `generatePdf.js` et de ses tests ; `reports.test.js` remplacé | Quatre vérifications propres ; plus de code mort | M |
| 9 | Ensuite (hors export) | Règles de moindre valeur du catalogue (3.4) ; constats du produit visibles aussi à l'écran (Par SKU) ; alignement éventuel de l'export Excel | À planifier après la mise en service | — |

**Chemin critique** : 0 → 1 → 2 → 4 (avec 3 en parallèle) → 5 → 6 → 7 → 8.
**Livraison** : l'ancien export reste disponible jusqu'à la phase 7 ; la bascule se fait à la fin de la phase 7, l'ancien code est retiré en phase 8.

## 5. Stratégie de test

- **Vitest** : chaque règle (dont le classement par portée, sujet et gravité), `reportReadings`, `trendRows`, `profitCascade`), la sélection du glossaire, le format de période, les extractions du moteur, le vocabulaire.
- **Playwright** : génération complète sur le démo avec `page.pdf()`, lecture du PDF par pdfjs-dist, vérifications : titres de chapitres, chiffres clés égaux à ceux du moteur, nombre de pages dans une fourchette, aucune page débordante, un saut avant chaque fiche, absence de `NaN`/`undefined`, glossaire limité aux termes présents.
- **Visuel** : captures des pages types (couverture, tuiles, constats, fiche, annexes) comparées à la maquette.
- **Parité** : fiche de parité vérifiée ligne par ligne à la phase 7.

## 6. Risques

| Risque | Mesure |
|---|---|
| Écart entre la mesure et l'impression (polices, DPI) | Mesure et impression sur la même machine et les mêmes polices ; police du rapport incluse dans l'application ; test e2e de débordement |
| Performance de la pagination sur un gros projet | Mesure incrémentale ; test à 50 produits ; indicateur de progression |
| Pont Electron (sécurité, empaquetage) | Fenêtre cachée en bac à sable, sans nœud, sans navigation ; test de l'application empaquetée |
| Dérive du périmètre sur les constats | Export livré avec les règles actuelles ; catalogue traité à part (phase 9) |
| Vocabulaire encore en mouvement (main-d'œuvre, CICI) | Chaînes centralisées ; relecture de la langue incluse |
| Deux chemins d'export pendant la transition | Date de bascule fixée à la phase 7 ; suppression en phase 8 |

## 7. Décisions (22/11/2026)

- **D1 — Architecture** : **retenue** (HTML composé dans l'application, impression par Chromium), tout en local : impression dans l'application, sans navigateur externe. Voir section 2.
- **D2 — Détail de recette** : **version actuelle de la maquette conservée** (trois petits tableaux).
- **D3 — Courbe d'un produit sans prix** : **réglée** : graphiques identiques à ceux de l'application (y compris le $/unité). Voir 3.7.
- **D4 — Constats** : revue de **toutes** les sections, avec un classement à deux axes (portée, gravité). Voir 3.4 et phase 2.
- **D5 — Commentaires de la direction** : saisis à la main dans la fenêtre d'export, **enregistrés avec le projet** (poids négligeable). Réglée.
- **D6 — Constats supplémentaires** : dans la phase 2, avant la mise en service. Seules les règles de moindre valeur passent après.
- **D7 — Police** : **la pile de la maquette (Helvetica, Arial)**, enjeu mineur. Arimo (licence libre, mêmes métriques qu'Arial) peut être incluse pour un rendu identique partout ; c'est un point de fin de phase 7, qui peut être mis de côté sans conséquence sur le reste.
- **D8 — Courbes de prix des intrants** : **pas de courbes par élément** (trop lourd). On corrige seulement les écarts de graphiques détectés (3.7).
- **D9 — Couleurs** : **palette de la maquette conservée**.
- **D10 — Visuels propres au rapport** : **maquette acceptée conservée**.
- **D11 — Classement des constats** : **confirmé** : deux axes, trois niveaux de gravité, promotion des constats majeurs (par entité **et agrégés**) vers Forces / Faiblesses, chapitre 1 limité aux constats généraux et majeurs, revue de tous les constats existants.

## 8. Dépendances avec d'autres chantiers

- Révision de la langue française (étape déjà planifiée) : à faire avant la phase 7 pour les textes du rapport.
- Changement de vocabulaire de la main-d'œuvre : sans effet sur l'export si les chaînes sont centralisées (3.6).
- CICI (frais fixes par activité) : le rapport ne montre déjà aucune méthode d'attribution ; rien à prévoir.
- Visite guidée : mise à jour minimale (mention de l'export) ; une scène dédiée n'est pas nécessaire.
