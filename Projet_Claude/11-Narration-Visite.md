# Narration de la visite guidée

Texte lu à l'écran (sous-titres) et, le jour venu, par une voix humaine. Document généré à partir de `src/tour/tourScript.js` (une seule source :
si une phrase change dans le scénario, régénérer ce fichier). Durée à vitesse normale, sans voix : **6 min 35 s**, 36 scènes, 9 chapitres.

## Pour enregistrer une voix

- Un fichier par scène, nommé **comme l'identifiant de la scène** (colonne « Fichier »), déposé dans `src/tour/audio/` : `accueil.mp3`, `ordre.mp3`…
  Formats acceptés : mp3, m4a, ogg, wav. Une scène sans fichier reste muette.
- Chaque phrase est écrite pour être dite : phrases courtes, aucun symbole à épeler. Lire le texte tel quel, sur un ton de conversation, sans le « jouer ».
- Les titres de chapitre (cartes plein écran) ne sont pas lus : la voix commence avec la scène.
- La scène attend la fin de la voix avant de passer à la suivante. Les gestes (pointeur, saisie, étiquettes) sont minutés pour la lecture des sous-titres :
  si une voix est nettement plus lente ou plus rapide, ajuster les valeurs `at` de la scène dans `tourScript.js`.
- Rythme de repère : environ 150 mots par minute.

## 1. Bienvenue

| Fichier | Mots | Texte |
|---|---|---|
| `accueil.mp3` | 32 | Imaginez une petite entreprise qui fabrique des repas surgelés. Chaque mois, la même question la ronge : combien coûte vraiment chaque produit, et lesquels rapportent de l'argent ? Cette visite y répond. |
| `ordre.mp3` | 30 | Sept onglets, de gauche à droite. D'abord ce que vous achetez, puis ce que ça coûte à fabriquer, ce qui s'y ajoute, et enfin ce que tout cela vous rapporte. |

## 2. Votre entreprise — Qui vous êtes, ce que vous vendez, et à qui

| Fichier | Mots | Texte |
|---|---|---|
| `entreprise.mp3` | 32 | Commençons par vous. Le nom de l'entreprise, d'abord. Puis vos cibles : la part du prix de vente que vous acceptez de consacrer aux ingrédients. Chaque résultat sera comparé à ces objectifs. |
| `activites.mp3` | 29 | Vous fabriquez plusieurs familles de produits ? Ce sont vos activités : mets surgelés, soupes, sauces. Elles servent à répartir les frais, et chaque produit appartient à l'une d'elles. |
| `canaux.mp3` | 32 | Entre vous et le client, il y a parfois des intermédiaires. Chaque canal de vente a sa chaîne, et chaque maillon prend sa part. Regardez : le prix s'ajuste à chaque étape. |
| `produits.mp3` | 28 | Voici vos produits, chacun avec ses formats, son prix et sa part des ventes. Une longue liste ? Tapez quelques lettres, et le produit que vous cherchez apparaît. |

## 3. Vos intrants — Ce que vous achetez, ce que vous payez

| Fichier | Mots | Texte |
|---|---|---|
| `ingredient-saisie.mp3` | 29 | Maintenant, ce que vous achetez. Ajoutons de la farine : son fournisseur, son format, son prix, sa perte. L'application calcule seule le coût réel de chaque kilo, perte comprise. |
| `allergenes.mp3` | 23 | Un détail qui change tout pour l'étiquetage : les allergènes. Cochez-les une seule fois sur l'ingrédient, et ils remontent d'eux-mêmes jusqu'à la recette. |
| `emballage.mp3` | 25 | Les contenants, les étiquettes, les cartons : l'emballage fonctionne comme les ingrédients. Et si vos prix dorment déjà dans un chiffrier, importez-les d'un seul coup. |
| `main-oeuvre.mp3` | 25 | Et les gens qui fabriquent ? Un poste, ses employés, leur salaire, leurs charges. Modifiez un salaire, et le coût horaire du poste suit aussitôt. |

## 4. Un produit, de A à Z — De la recette au prix de revient

| Fichier | Mots | Texte |
|---|---|---|
| `recette.mp3` | 26 | Place à la recette. Choisissez un produit : la quantité produite, les ingrédients, l'emballage et les étapes apparaissent. Ici, un lot de vingt unités de chili. |
| `recette-direct.mp3` | 24 | Et tout se recalcule en direct. Un peu plus de bœuf dans la recette ? Regardez le coût matière grimper… et la marge fondre. |
| `etapes.mp3` | 23 | Les étapes disent qui travaille, quand, et pendant combien de temps. C'est de là que vient le coût de main-d'œuvre de chaque unité. |
| `cascade.mp3` | 26 | Tout en bas, le récapitulatif : du coût de revient complet jusqu'au point mort. Et selon le canal de vente, la marge change. Essayez les épiceries. |
| `simulation-prix.mp3` | 31 | Et si vous changiez le prix de vente ? Testez-le sans toucher au vrai prix : les marges et le point mort se recalculent. Descendez trop bas, et la marge s'effondre. |

## 5. Vos frais — Ce qui ne dépend d'aucun produit en particulier

| Fichier | Mots | Texte |
|---|---|---|
| `revenus.mp3` | 27 | Jusqu'ici, c'était le modèle. Voici maintenant le réel, comme votre comptable le présente : ce que vous avez encaissé, puis ce que la fabrication vous a coûté. |
| `frais-fixes.mp3` | 29 | Les frais fixes, comme le loyer, les assurances ou l'entretien, ne dépendent d'aucun produit. Ajoutez-en un, dites où il va, et le total comme le bénéfice net réagissent aussitôt. |
| `repartition.mp3` | 31 | Mais chaque produit doit porter sa part de ces frais. À vous de choisir la règle de partage : selon les coûts directs, le temps de production ou le volume fabriqué. |
| `benefices.mp3` | 28 | Le bénéfice brut, c'est ce qui reste après les charges directes. Le bénéfice net, c'est ce qui reste après les frais fixes. Voilà ce qui vous revient vraiment. |

## 6. Le portrait de votre entreprise — Où vous en êtes, et ce qui change

| Fichier | Mots | Texte |
|---|---|---|
| `rapport-carte.mp3` | 29 | Tout converge ici, dans Rapport et suivi. Neuf sous-onglets, mais quatre idées : le portrait de l'entreprise, vos produits, vos achats et votre équipe, vos « et si ». |
| `indicateurs.mp3` | 37 | D'abord, le portrait d'ensemble : six chiffres comparés à vos objectifs. Un triangle rouge, et les ingrédients coûtent plus cher que prévu. La marge de sécurité, elle, dit de combien les ventes peuvent baisser avant la perte. |
| `points-reference.mp3` | 37 | Pour voir le temps passer, prenez une photo de votre projet : un point de référence. Chaque photo ajoute un point aux courbes, et vos coûts et vos marges se mettent enfin à bouger sous vos yeux. |
| `constats.mp3` | 32 | Pas envie de fouiller dans les chiffres ? Les constats clés le font pour vous : vos objectifs atteints ou non, ce qui s'améliore ou se détériore, vos forces et vos faiblesses. |
| `reconciliation.mp3` | 29 | Dernier regard sur l'ensemble : la réconciliation. Ce que vous encaissez vraiment, contre ce que votre modèle de recettes prévoit. L'écart, c'est là qu'il faut chercher les pertes invisibles. |

## 7. Zoom sur vos produits — Par produit, par activité, par canal

| Fichier | Mots | Texte |
|---|---|---|
| `matrice.mp3` | 32 | Vos produits ne se valent pas. La matrice stratégique les range selon leur popularité et leur rentabilité : étoiles, vaches à lait, dilemmes, poids morts. Changez de canal, et le classement bouge. |
| `par-sku.mp3` | 31 | Un produit à la fois, maintenant. Du prix de vente jusqu'au point mort, voyez ce qu'il rapporte vraiment dans chacun de ses canaux. Choisissez-en un autre, et le tableau se refait. |
| `par-activite.mp3` | 23 | Reculez d'un cran : une colonne par activité. Laquelle porte l'entreprise, laquelle rapporte le moins ? Tout se lit d'un seul coup d'œil. |
| `par-canal.mp3` | 20 | Et la même chose par canal. Quel circuit de vente rapporte vraiment, et lequel coûte presque autant qu'il rapporte ? |

## 8. Les coulisses — Vos achats, votre équipe, vos « et si »

| Fichier | Mots | Texte |
|---|---|---|
| `achats-ingredients.mp3` | 31 | Dans les coulisses, vos achats. L'analyse ABC montre les ingrédients qui pèsent le plus lourd. Plus bas, vos fournisseurs : quand un seul pèse la moitié des achats, c'est une dépendance. |
| `intrants.mp3` | 25 | Chaque prix a son histoire. Choisissez un ingrédient : son prix à chaque point de référence. Quand un prix s'envole, la volatilité vous le signale. |
| `emballages.mp3` | 19 | Même lecture pour vos emballages : les plus coûteux, vos fournisseurs, l'évolution des prix. Rien de nouveau à apprendre. |
| `main-oeuvre-rapport.mp3` | 31 | Reste votre équipe. Combien d'heures payées servent vraiment ? L'écart, c'est de la paie non utilisée. Et ces heures libres sont des ventes possibles en plus : votre marge de croissance. |
| `simulation.mp3` | 32 | Et si vos prix d'achat montaient de huit pour cent ? Puis de quinze ? Le simulateur montre l'effet sur la marge, le point mort et chaque activité, avant que ça n'arrive. |

## 9. Jamais perdu — Où trouver l'aide quand on en a besoin

| Fichier | Mots | Texte |
|---|---|---|
| `infobulles.mp3` | 25 | Un mot vous échappe ? Passez la souris sur le point d'interrogation : une courte explication s'affiche, avec un lien « En savoir plus ». |
| `guide.mp3` | 26 | Pour aller plus loin, le guide : chaque écran, chaque calcul, avec les chiffres du projet d'exemple. Cherchez un mot, et toutes ses occurrences sont surlignées. |
| `depart.mp3` | 26 | À vous de jouer ! Commencez par Paramètres : nommez votre entreprise, puis passez aux ingrédients. Avancez de gauche à droite, le reste suivra tout seul. |

