# Narration de la visite guidée

Texte lu à l'écran (sous-titres) et dit par la voix. Document généré à partir de `src/tour/tourScript.js` (une seule source : si une phrase change dans le scénario, régénérer ce fichier). Durée à vitesse normale, sans voix : **9 min 21 s**, 45 scènes et 10 cartes de titre (55 clips).

## Pour générer les voix (ElevenLabs, modèle Eleven v4, voix Jeanne-Mance)

- Un fichier par clip, nommé comme l'identifiant de la colonne « Fichier », déposé dans `src/tour/audio/` (mp3). Une scène ou une carte de titre sans fichier reste muette.
- Le texte de la colonne « Texte pour la voix » contient les repères `[pause]` (balise v4, durée non réglable ; `[long pause]` pour une pause plus longue). Les sous-titres affichés à l'écran n'en contiennent pas.
- Tous les nombres sont écrits en lettres. Aucune balise d'émotion : même modèle, même voix, mêmes réglages pour tous les clips.
- Une scène attend la fin de sa voix ; la carte de titre d'un chapitre reste affichée tant que sa voix parle.
- Les fichiers de voix sans licence commerciale ne vont jamais dans Git (dossier `_essai-non-commercial/` ignoré).

## 1. Bienvenue

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-bienvenue.mp3` | 17 | Bienvenue dans TransfoCalculateur. [pause] Un outil pour connaître vos coûts de revient et fixer vos prix en confiance. |
| `accueil.mp3` | 32 | Imaginez une petite entreprise qui fabrique des repas surgelés. Chaque mois, la même question la ronge : [pause] combien coûte vraiment chaque produit, et lesquels rapportent de l'argent ? Cette visite y répond. |
| `ordre.mp3` | 31 | L'application compte sept onglets, de gauche à droite. D'abord ce que vous achetez, puis ce que coûte la fabrication, ce qui s'y ajoute, et enfin ce que tout cela vous rapporte. |

## 2. Votre entreprise — Qui vous êtes, ce que vous vendez, et à qui

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-entreprise.mp3` | 15 | Première étape : votre entreprise. Qui vous êtes, ce que vous vendez, et à qui. |
| `entreprise.mp3` | 32 | Commençons par vous. Le nom de l'entreprise, d'abord. [pause] Puis vos cibles : la part du prix de vente que vous acceptez de consacrer aux ingrédients. Chaque résultat sera comparé à vos objectifs. |
| `objectifs.mp3` | 44 | Vos cibles ne se limitent pas aux coûts. Neuf objectifs sont déjà prêts : marge nette, paie non utilisée, frais fixes. Fixez une valeur, et chaque résultat dira s'il est atteint. [pause] Vous pouvez aussi créer les vôtres : un indicateur, un sens, une valeur. |
| `activites.mp3` | 29 | Vous fabriquez plusieurs familles de produits ? Ce sont vos activités : mets surgelés, soupes, sauces. [pause] Elles servent à répartir les frais, et chaque produit appartient à l'une d'elles. |
| `canaux.mp3` | 36 | Entre vous et le client, il y a parfois des intermédiaires. Chaque canal de vente a sa chaîne, et chaque maillon, comme un distributeur, prend sa part. [pause] Vous fixez la marge ou la majoration de chacun. |
| `produits.mp3` | 34 | Voici vos produits, chacun avec ses formats, son prix et sa part des ventes. Une longue liste ? Tapez quelques lettres, et le produit que vous cherchez apparaît. [pause] Vous pouvez aussi filtrer par activité. |
| `produits-canaux.mp3` | 33 | Chaque produit se vend dans un ou plusieurs canaux. Pour chacun, vous indiquez le prix net et le volume de ventes. [pause] Ces volumes servent ensuite à mesurer ce que chaque canal rapporte vraiment. |

## 3. Vos intrants — Ce que vous achetez, ce que vous payez

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-intrants.mp3` | 14 | Deuxième étape : vos intrants. Ce que vous achetez, et ce que vous payez. |
| `ingredient-saisie.mp3` | 29 | Maintenant, ce que vous achetez. Ajoutons de la farine : son fournisseur, son format, son prix, sa perte. [pause] L'application calcule seule le coût réel de chaque kilo, perte comprise. |
| `allergenes.mp3` | 23 | Un détail qui change tout pour l'étiquetage : les allergènes. Cochez-les une seule fois sur l'ingrédient, et ils remontent d'eux-mêmes jusqu'à la recette. |
| `emballage.mp3` | 25 | Les contenants, les étiquettes, les cartons : l'emballage fonctionne comme les ingrédients. [pause] Et si vos prix dorment déjà dans un chiffrier, importez-les d'un seul coup. |
| `main-oeuvre.mp3` | 44 | Et les gens qui fabriquent ? Un poste, ses employés, leur salaire, leurs charges. [pause] Chaque employé a aussi un temps productif attendu : la part des heures payées qui sert vraiment à produire. Modifiez un salaire, et le coût horaire du poste suit aussitôt. |

## 4. Un produit, de A à Z — De la recette au prix de revient

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-produit.mp3` | 14 | Un produit, du début à la fin. De la recette jusqu'au prix de revient. |
| `recette.mp3` | 30 | Place à la recette. Choisissez un produit : tout ce qu'il faut pour le fabriquer se présente en cinq parties, dans l'ordre. [pause] Ici, un lot de vingt unités de chili. |
| `recette-direct.mp3` | 29 | Première partie, les ingrédients. Chacun vient de votre base de données, et tout se recalcule en direct. [pause] Un peu plus de bœuf ? Regardez le coût des ingrédients grimper. |
| `recette-emballage.mp3` | 29 | Deuxième partie, l'emballage : les contenants, les étiquettes, les cartons de ce produit. Même principe, avec ses propres pertes. [pause] Et le coût par unité se met à jour aussitôt. |
| `etapes.mp3` | 34 | Troisième partie, les étapes : qui travaille, quand, et pendant combien de temps. [pause] C'est de là que vient le coût de main-d'œuvre, y compris celui des heures payées qui ne servent pas à produire. |
| `couts-additionnels.mp3` | 32 | Quatrième partie, les coûts additionnels. Deux options, selon votre cas : la sous-traitance, quand une étape est confiée à un tiers, et le vieillissement, pour un produit qui mûrit avant d'être vendu. |
| `cascade.mp3` | 27 | Cinquième et dernière partie, le récapitulatif : du coût de revient complet jusqu'au point mort. [pause] Et selon le canal de vente, la marge change. Essayons les épiceries. |
| `simulation-prix.mp3` | 31 | Et si vous changiez le prix de vente ? Testez-le sans toucher au vrai prix : les marges et le point mort se recalculent. [pause] Descendez trop bas, et la marge s'effondre. |

## 5. Vos frais — Ce qui ne dépend d'aucun produit en particulier

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-frais.mp3` | 17 | Vos frais. Tout ce qui ne dépend d'aucun produit en particulier, et la façon de les répartir. |
| `revenus.mp3` | 27 | Jusqu'ici, c'était le modèle. [pause] Voici maintenant le réel, comme votre comptable le présente : ce que vous avez encaissé, puis ce que la fabrication vous a coûté. |
| `frais-fixes.mp3` | 25 | Les frais fixes, comme le loyer, les assurances ou l'entretien, ne dépendent d'aucun produit. [pause] Ajoutez-en un, dites où il va, et le total réagit aussitôt. |
| `cles-repartition.mp3` | 43 | Mais chaque frais a une clé de répartition : elle décide qui le supporte. [pause] Le loyer peut être affecté à des activités précises, l'électricité suivre les charges directes, la publicité se répartir entre les canaux. Changez la clé, et les colonnes se redistribuent. |
| `repartition.mp3` | 41 | Dernière étape : le coefficient d'imputation des charges indirectes. Pour chaque activité, vous choisissez la règle qui partage les frais : selon les coûts directs, le temps de production ou le volume fabriqué. [pause] Changez-la, et la part de chaque produit change. |

## 6. Le portrait de votre entreprise — Où vous en êtes, et ce qui change

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-portrait.mp3` | 13 | Le portrait de votre entreprise. Où vous en êtes, et ce qui change. |
| `rapport-carte.mp3` | 26 | Tout converge ici, dans Rapport et suivi. Neuf sous-onglets, mais quatre idées : [pause] le portrait de l'entreprise, vos produits, vos achats et votre équipe, vos simulations. |
| `indicateurs.mp3` | 36 | D'abord, le portrait d'ensemble : six chiffres comparés à vos objectifs. Un triangle rouge signale des ingrédients plus coûteux que prévu. [pause] La marge de sécurité, elle, dit de combien les ventes peuvent baisser avant la perte. |
| `points-reference.mp3` | 37 | Pour voir le temps passer, prenez une photo de votre projet : un point de référence. [pause] Chaque photo ajoute un point aux courbes, et vos coûts et vos marges se mettent enfin à bouger sous vos yeux. |
| `constats.mp3` | 32 | Pas envie de fouiller dans les chiffres ? Les constats clés le font pour vous : [pause] vos objectifs atteints ou non, ce qui s'améliore ou se détériore, vos forces et vos faiblesses. |
| `reconciliation.mp3` | 29 | Dernier regard sur l'ensemble : la réconciliation. [pause] Ce que vous encaissez vraiment, contre ce que votre modèle de recettes prévoit. L'écart, c'est là qu'il faut chercher les pertes invisibles. |

## 7. Zoom sur vos produits — Par produit, par activité, par canal

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-detail.mp3` | 10 | Zoom sur vos produits. Par produit, par activité, par canal. |
| `matrice.mp3` | 39 | Vos produits ne se valent pas. La matrice stratégique les range selon leur popularité et leur rentabilité : étoiles, vaches à lait, dilemmes, poids morts. [pause] Et si vous changiez de canal ? Essayons les épiceries : le classement bouge. |
| `par-sku.mp3` | 31 | Un produit à la fois, maintenant. Du prix de vente jusqu'au point mort, voyez ce qu'il rapporte vraiment dans chacun de ses canaux. [pause] Choisissez-en un autre, et le tableau se refait. |
| `par-activite.mp3` | 23 | Reculez d'un cran : une colonne par activité. [pause] Laquelle porte l'entreprise, laquelle rapporte le moins ? Tout se lit d'un seul coup d'œil. |
| `par-canal.mp3` | 20 | Et la même chose par canal. Quel circuit de vente rapporte vraiment, et lequel coûte presque autant qu'il rapporte ? |
| `constats-onglet.mp3` | 30 | Chaque sous-onglet se termine par ses propres constats. Ici, ceux des canaux : les forces à gauche, les faiblesses à droite, les plus graves en premier. [pause] Voilà par où commencer. |

## 8. Les coulisses — Vos achats, votre équipe, vos « et si »

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-coulisses.mp3` | 8 | Les coulisses. Vos achats, votre équipe, vos simulations. |
| `achats-ingredients.mp3` | 31 | Dans les coulisses, vos achats. L'analyse ABC montre les ingrédients qui pèsent le plus lourd. [pause] Plus bas, vos fournisseurs : quand un seul pèse la moitié des achats, c'est une dépendance. |
| `intrants.mp3` | 25 | Chaque prix a son histoire. Choisissez un ingrédient : son prix à chaque point de référence. [pause] Quand un prix s'envole, la volatilité vous le signale. |
| `emballages.mp3` | 19 | Même lecture pour vos emballages : les plus coûteux, vos fournisseurs, l'évolution des prix. Rien de nouveau à apprendre. |
| `main-oeuvre-rapport.mp3` | 31 | Reste votre équipe. Combien d'heures payées servent vraiment ? [pause] L'écart, c'est de la paie non utilisée. Et ces heures libres sont des ventes possibles en plus : votre marge de croissance. |
| `simulation.mp3` | 32 | Et si vos prix d'achat montaient de huit pour cent ? Puis de quinze ? Le simulateur montre l'effet sur la marge, le point mort et chaque activité, avant que cela n'arrive. |

## 9. Pour le dire aux autres — Un rapport PDF, un classeur Excel

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-partage.mp3` | 12 | Pour le dire aux autres. Un rapport complet, et un classeur Excel. |
| `export-pdf.mp3` | 32 | Un banquier, un partenaire, votre équipe veulent voir vos résultats ? Le rapport complet les met en page, prêt à imprimer. [pause] Choisissez les chapitres, ajoutez votre commentaire, et le tour est joué. |
| `export-excel.mp3` | 31 | Pour aller plus loin avec vos propres outils, le classeur Excel : toutes vos données, une feuille par sujet, avec un dictionnaire des colonnes. [pause] Votre comptable s'y retrouvera tout de suite. |

## 10. Jamais perdu — Où trouver l'aide quand on en a besoin

| Fichier | Mots | Texte pour la voix |
|---|---|---|
| `intro-aide.mp3` | 11 | Jamais perdu. Où trouver de l'aide, quand on en a besoin. |
| `infobulles.mp3` | 25 | Un mot vous échappe ? Passez la souris sur le point d'interrogation : une courte explication s'affiche, avec un lien « En savoir plus ». |
| `guide-plan.mp3` | 38 | Le guide se divise en quatre parties : les notions de base, l'utilisation de chaque onglet, la lecture des résultats, puis le glossaire et les questions fréquentes. [pause] À gauche, la table des matières vous mène au bon chapitre. |
| `guide-encadres.mp3` | 27 | Chaque chapitre est ponctué d'encadrés. L'essentiel à retenir, un exemple chiffré, une mise en garde. [pause] Une astuce, la raison d'être d'une règle, et les mots à connaître. |
| `guide.mp3` | 29 | Enfin, la recherche : tapez un mot, et toutes ses occurrences sont surlignées. [pause] Passez de l'une à l'autre d'un seul geste, ou emportez le guide pour le lire ailleurs. |
| `depart.mp3` | 26 | À vous de jouer ! Commencez par Paramètres : nommez votre entreprise, puis passez aux ingrédients. [pause] Avancez de gauche à droite, le reste suivra tout seul. |

