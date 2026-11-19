# Refonte de la visite guidée — cadrage et scénario (version à valider)

Statut : **scénario validé le 18/11 et réalisé le 19/11** (voir la feuille de route). Étape 7 de la Phase 7, avant le rapport final.

Décisions complémentaires (18/11) : pas de parcours court d'une minute ; pas de lancement depuis le bouton « i » ; accessible depuis l'accueil, la fenêtre « nouveau projet » et un lien dans le guide.

## Décisions prises (18/11)

| Sujet | Décision |
|---|---|
| Format | Démo qui se joue **toute seule**, sans clic pour avancer (pause, reprise, précédent/suivant, chapitres, vitesse, quitter = contrôles facultatifs) |
| Durée | **4 à 5 minutes** (cible 4 min 30) |
| Son | **Sous-titres seulement** pour commencer (voix : plus tard, éventuellement) |
| Données | Toujours sur **une copie du projet démo**, jamais sur le projet en cours (sauvegardé ou non) |
| Accès | Depuis l'accueil (« Commencer la visite ») **et** par un lien dans le guide ; plus seulement à la création d'un projet |
| Ancienne visite | **Supprimée complètement** (28 étapes, fenêtre Suivant/Précédent). Les identifiants `#tutorial-*` du DOM restent : des tests e2e s'en servent comme ancres |

## Architecture proposée

- **Isolation totale.** La visite ne partage aucun état avec le projet de l'utilisateur. Deux réalisations possibles ; je recommande la 1 :
  1. *Instance isolée* : la visite monte une seconde instance de l'application (même code, `ProjectProvider` propre, chargée avec le démo), dans un calque plein écran. Le projet de l'utilisateur reste monté mais caché, intact, sans que la visite puisse l'atteindre. Aucune sauvegarde ni écriture de fichier n'est déclenchée depuis la visite.
  2. *Remplacement temporaire* : on met le projet de l'utilisateur de côté, on charge le démo, on restaure à la fin. Plus simple, mais risque de perte en cas de plantage : **rejeté**.
- **Lecteur de scénario.** Le scénario est une liste de scènes décrites comme des données (`durée`, `onglet`, `cible`, `actions`, `sous-titre`). Le lecteur gère le minuteur, la pause, la vitesse, les chapitres, la progression.
- **Actions disponibles** : aller à un onglet / sous-onglet, choisir un produit, faire défiler jusqu'à un élément, déplacer le pointeur, mettre un élément en évidence (halo), survoler (ouvre une infobulle), ouvrir/fermer le guide, **saisir une valeur** (ex. un volume de ventes) pour montrer le recalcul en direct, annuler la saisie à la scène suivante.
- **Cibles** : des marqueurs stables `data-tour="…"` (les `#tutorial-*` existants sont réutilisés quand ils conviennent).
- **Fluidité** : transitions CSS (pointeur, halo, légende), défilement doux, aucune boîte modale pendant la lecture ; pas d'attente d'un clic.
- **Accessibilité** : légendes en région `aria-live`, contrôles au clavier (espace = pause, flèches = scène, Échap = quitter), respect de « réduire les animations ».
- **Sécurité** : le calque bloque les clics sur l'application pendant la lecture ; les contrôles de la visite sont les seuls actifs.

## Scénario (28 scènes ≈ 4 min 30)

Les sous-titres sont des brouillons ; le vocabulaire respecte l'étape 6 (produit, actif, pas de « plat » ni de « menu »).

### Chapitre 1 — Bienvenue (≈ 25 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 1 | 8 s | Écran du projet démo (Paramètres), halo sur le logo | « Bienvenue dans TransfoCalculateur. Cette visite se joue seule, sur un projet d'exemple : votre travail n'est jamais touché. » |
| 2 | 9 s | Pointeur sur « Rapport et suivi » puis retour à « Paramètres » | « L'outil répond à une question : combien coûte vraiment chacun de vos produits, et lesquels sont rentables ? » |
| 3 | 8 s | Halo sur la barre d'onglets, de gauche à droite | « Sept onglets, dans l'ordre où l'on travaille : de gauche à droite. » |

### Chapitre 2 — Préparer vos données (≈ 1 min 10 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 4 | 10 s | **Paramètres** : nom de l'entreprise, objectifs | « Paramètres : le nom de l'entreprise, vos cibles de coûts, et la vue d'ensemble de vos produits. » |
| 5 | 10 s | Paramètres : activités de production et canaux de vente | « Ici, vous définissez vos activités (surgélation, conserves…) et vos canaux de vente : la chaîne qui mène le produit au consommateur. » |
| 6 | 10 s | Paramètres : liste des produits, un produit sélectionné, ses formats | « Chaque produit a un ou plusieurs formats, avec leur prix, leur poids et leur part des ventes. La case « Actif » décide s'il compte dans les analyses. » |
| 7 | 10 s | **Ingrédients** : tableau, une ligne mise en évidence (prix, perte) | « Ingrédients : prix d'achat, formats, pertes. L'application en déduit un coût net par unité. » |
| 8 | 8 s | Ingrédients : analyse ABC et avertissement de prix volatil | « Elle repère aussi les ingrédients qui pèsent le plus lourd (catégorie A) et ceux dont le prix bouge beaucoup. » |
| 9 | 8 s | **Emballage** | « Emballage : même principe que les ingrédients, pour les contenants, étiquettes et cartons. » |
| 10 | 10 s | **Main-d'œuvre** : postes, employés, coût moyen pondéré | « Main-d'œuvre : vos postes et leur coût horaire chargé (salaire, charges, vacances). » |
| 11 | 8 s | Main-d'œuvre : rapport de productivité | « Le rapport de productivité compare les heures payées aux heures réellement nécessaires. » |

### Chapitre 3 — Vos frais (≈ 40 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 12 | 10 s | **État des résultats** : revenus, charges directes | « État des résultats : vos revenus et vos charges directes réels, tels que votre comptable les présente. » |
| 13 | 10 s | Frais fixes : liste, catégories | « Les frais fixes (loyer, assurances, marketing…) ne sont liés à aucun produit en particulier. » |
| 14 | 10 s | Clés de répartition et CICI | « L'application les répartit sur vos produits selon la règle que vous choisissez : coûts directs, temps de production ou volume. » |
| 15 | 10 s | Bénéfice brut / net en barres de synthèse | « Résultat : un bénéfice brut et un bénéfice net réels pour la période. » |

### Chapitre 4 — Calculer un produit (≈ 45 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 16 | 10 s | **Production** : choix du « Chili con carne mijoté », ingrédients de la recette | « Production : la recette d'un produit. Choisissez-le, ajoutez ses ingrédients et ses emballages. » |
| 17 | 12 s | Étapes de production et personnel | « Les étapes de fabrication indiquent qui travaille et combien de temps : de là vient le coût de main-d'œuvre. » |
| 18 | 13 s | Cascade des coûts du produit (matière, emballage, main-d'œuvre, indirects, prix de vente, marge) | « Le résultat : le coût de revient complet par unité, et la marge dégagée à chaque niveau. » |
| 19 | 10 s | **Saisie live** : le rendement ou un volume change, la cascade se recalcule, puis la valeur est annulée | « Tout est calculé en direct : changez une valeur, le coût se met à jour. » |

### Chapitre 5 — Analyser (≈ 1 min 15 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 20 | 10 s | **Rapport et suivi** : Vue d'ensemble, tuiles et objectifs | « Rapport et suivi : cinq indicateurs résument tous vos produits actifs, comparés à vos objectifs. » |
| 21 | 12 s | Matrice stratégique des produits | « La matrice classe chaque produit selon sa popularité et sa rentabilité : étoiles, vaches à lait, dilemmes, poids morts. » |
| 22 | 10 s | Par SKU : un produit, ses canaux | « Par SKU : un produit à travers chacun de ses canaux de vente, avec sa marge nette et son point mort. » |
| 23 | 10 s | Par Activité, Par Canal | « Par Activité et Par Canal : où l'entreprise gagne, où elle perd. » |
| 24 | 15 s | **Simulateur de chocs** : un choc (ex. intrants +8 %), tableaux d'impact, puis retrait | « Et si vos prix d'achat montaient de 8 % ? Le simulateur montre l'effet sur chaque produit, activité et canal. » |
| 25 | 10 s | Points de référence, graphique d'évolution | « Les points de référence enregistrent une « photo » de votre projet pour suivre son évolution. » |

### Chapitre 6 — Où trouver de l'aide (≈ 35 s)

| # | Durée | À l'écran | Sous-titre |
|---|---|---|---|
| 26 | 12 s | Survol d'une infobulle, puis « En savoir plus dans le guide → » | « Un doute sur un terme ? Passez la souris sur le point d'interrogation : une courte explication s'affiche, avec un lien vers le guide. » |
| 27 | 12 s | Ouverture du guide, sommaire, recherche, export PDF | « Le guide explique chaque écran avec les chiffres du projet d'exemple. Il se cherche par mot et se télécharge en PDF. » |
| 28 | 11 s | Bandeau « Vérifications du projet » | « L'application vous avertit aussi quand des données manquent : prix absents, répartition des ventes incomplète… » |

### Conclusion (≈ 10 s)

Carte de fin avec trois choix : **Explorer le projet démo**, **Créer mon projet** (avec la liste des premiers gestes : ingrédients, emballage, main-d'œuvre, frais, produits, recettes), **Ouvrir le guide**.

Sous-titre : « À vous de jouer. Commencez par vos ingrédients, puis avancez de gauche à droite. »

## Contrôles et comportement

- Barre en bas : ⏯ pause, ⏮ ⏭ scène, vitesse (0,75× / 1× / 1,5×), progression cliquable avec les 7 chapitres, « Quitter ».
- Pause automatique si la fenêtre perd le focus.
- Fin ou « Quitter » : retour à l'écran d'où la visite a été lancée, sans aucun changement.
- Parcours court d'une minute (chapitres 1, 4 [scènes 16 et 18], 5 [scènes 20-21] et conclusion) : **option à décider** après la première version.

## Plan de travail

1. **Cadrage et scénario** (ce document) — validation avec vous.
2. **Moteur** : lecteur de scénario, minuteur, pause, vitesse, chapitres.
3. **Isolation** : seconde instance de l'application sur une copie du démo ; preuve par test que le projet de l'utilisateur n'est pas modifié (comparaison avant/après, y compris sauvegarde et indicateur « modifications non enregistrées »).
4. **Pilotage de l'interface** : actions (navigation, ciblage, défilement, survol, saisie live) et marqueurs `data-tour`.
5. **Habillage** : pointeur, halo, sous-titres, barre de contrôle, transitions.
6. **Contenu** : textes définitifs, minutage ajusté scène par scène.
7. **Intégration** : accueil, lien dans le guide (et mise à jour du chapitre « L'écran d'accueil et le tutoriel »), suppression de l'ancienne visite et de son code.
8. **Tests** : Playwright joue toute la visite (aucune erreur console, durée dans la cible, projet de l'utilisateur intact, contrôles clavier) ; tests existants adaptés.
9. **Validation** : vous la regardez, ajustements, puis commit.

## Points à vérifier avant de commencer

- Les noms exacts des sous-onglets et des sections (à relire dans l'application au moment de la programmation).
- Que la seconde instance de l'application ne déclenche aucun effet de bord global (raccourcis, sauvegarde automatique, `beforeunload`) : à examiner à l'étape 3.

---

## Version 2 (19/11) — remaniement après le premier retour

Le scénario ci-dessus (28 scènes, halo sur de grands blocs) a été **remplacé** : 27 scènes plus courtes, chacune avec du mouvement continu, des saisies réelles et des étiquettes. La source de vérité est désormais `src/tour/tourScript.js` ; voir la feuille de route pour le détail des décisions.
