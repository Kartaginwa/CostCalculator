# Constats clés — principes et catalogue des règles

Statut : **lot 3** de la refonte de Rapport et suivi (21/11). Le lot 1 (rapatriement et navigation) est livré ; le lot 2 (nouveaux modules chiffrés) et ce lot 3 restent à faire. Voir `03-Feuille-de-route.md`.

## Ce que c'est

Un encadré de la **Vue d'ensemble** de Rapport et suivi, sous les tuiles : ce que les chiffres de l'entrepreneur disent de son entreprise, **en forces et en faiblesses** (langage de gestion). Chaque constat donne un chiffre et un lien vers l'endroit où agir (`goToReport(sous-onglet)`).

## Principes (décidés avec l'utilisateur le 21/11)

- **Pas une analyse par IA.** Des règles déterministes : chaque règle est une fonction pure qui reçoit les données du projet et renvoie zéro ou un constat `{ id, ton, thème, poids, titre, détail, lien }`. Les textes sont des gabarits.
- **Deux colonnes : Forces / Faiblesses.** Pas seulement des alarmes : un constat positif est aussi utile qu'un point d'attention.
- **5 visibles au maximum par colonne**, triés par poids ; le reste dans une **fenêtre** « Voir tous les constats », regroupée par thème.
- **Jamais un avertissement de qualité des données** (produit sans prix, sans volume, relevé ancien…) : cela reste dans le panneau « points à vérifier » existant.
- **Une donnée absente reste absente** : une règle sans donnée est muette, jamais forcée à 0.
- **Seuils dans un seul fichier de configuration** (ex. fournisseur ≥ 40 % des achats, utilisation < 85 %), à valider avec l'utilisateur.
- **Tests Vitest par règle** (cas qui se déclenche, cas muet, cas limite) sur le projet démo et sur des données minimales.
- Même patron que `engine/projectChecks.js`.

## Conditions de déclenchement

- **Historique requis (15 règles)** : n° 3, 4, 5, 8, 12 à 16, 28, 37, 49, 50, 55, 56 et 74. Sans au moins 2 (parfois 3) points de référence, elles restent muettes.
- **Cibles saisies dans Paramètres (3)** : n° 9 à 11 (et 80).
- **Chiffres réels dans l'État des résultats (4)** : n° 67 à 70.
- **Vieillissement activé (1)** : n° 17.
- Les autres règles fonctionnent dès le premier jour avec les données courantes.

## Catalogue (80 règles en 9 thèmes ; chacune est une force, une faiblesse, ou l'une ou l'autre selon le seuil)

**Rentabilité globale (8)** — 1 marge de sécurité confortable ou faible/négative ; 2 bénéfice net positif ou négatif ; 3 marge brute au-dessus ou sous sa moyenne des relevés ; 4 marge nette en hausse ou en baisse sur les 3 derniers relevés ; 5 point mort qui s'éloigne ou se rapproche ; 6 contribution qui couvre N fois les frais fixes, ou ne les couvre pas ; 7 poids des frais fixes dans le revenu ; 8 revenu prévu en progression ou en recul par rapport au relevé précédent.

**Coûts vs cibles (9)** — 9 matière ; 10 emballage ; 11 main-d'œuvre ; 12 coût matière en baisse ou en hausse sur 12 mois ; 13 coût emballage, même tendance ; 14 coût main-d'œuvre, même tendance ; 15 SKU dont le coût de revient a le plus augmenté ; 16 SKU dont il a le plus baissé ; 17 vieillissement qui pèse plus de X % du coût.

**Produits (12)** — 18 rentable dans tous les canaux ; 19 déficitaire dans un ou plusieurs canaux ; 20 déficitaire partout ; 21 nombre d'étoiles ; 22 poids morts ; 23 dilemmes à promouvoir ; 24 vaches à lait à optimiser ; 25 profit concentré sur le produit n° 1 ; 26 profit bien réparti (les 3 premiers pèsent moins de X %) ; 27 écart de marge entre deux formats d'un même produit ; 28 marge d'un SKU en hausse ou en baisse sur 3 relevés ; 29 sous-recette qui pèse plus de X % du coût d'un plat.

**Canaux (8)** — 30 dépendance à un canal ; 31 canal majoritaire peu rentable ; 32 canal le plus rentable ; 33 canal à forte marge sous-exploité ; 34 canal déficitaire ; 35 grand écart de marge entre canaux ; 36 frais de mise en marché supérieurs à X % du prix ; 37 canal en croissance ou en recul d'un relevé à l'autre.

**Activités (7)** — 38 activité déficitaire ; 39 toutes les activités bénéficiaires ; 40 activité qui couvre ses frais fixes avec marge ; 41 activité sous son point mort ; 42 activité à très faible marge nette ; 43 activité qui domine les revenus ; 44 activité sous-exploitée (forte marge, peu de revenu).

**Approvisionnement (12)** — 45 dépendance à un fournisseur ; 46 fournisseurs bien répartis ; 47 classe A volatile ; 48 classe A stable ; 49 prix en baisse ; 50 hausse soutenue sur un intrant important ; 51 perte stock élevée sur un intrant ; 52 perte stock faible globalement ; 53 les 5 premiers intrants pèsent plus de X % des achats ; 54 emballage de classe A volatil ; 55 effet des prix en dollars sur 12 mois (aux volumes actuels) ; 56 fournisseur dont les prix baissent ou montent plus que les autres.

**Main-d'œuvre (10)** — 57 utilisation sous un seuil ; 58 utilisation élevée ; 59 paie non utilisée ; 60 coût réel d'une heure vs taux affiché ; 61 produit le plus rentable par heure ; 62 produit le moins rentable par heure ; 63 activité la plus rentable par heure ; 64 marge de croissance disponible ; 65 poste surchargé (plus de 100 %) ; 66 part de la main-d'œuvre dans le coût de revient.

**Réel vs théorique (4)** — 67 revenus réels au-dessus ou sous le modèle ; 68 charges directes réelles au-dessus ou sous le modèle ; 69 bénéfice brut réel vs théorique ; 70 bénéfice net réel vs théorique.

**Sensibilité (3)** — 71 une hausse de 5 % des intrants fait passer sous le point mort, ou non ; 72 l'intrant dont +10 % coûte le plus ; 73 une hausse de 5 % de la main-d'œuvre, même question.

**Ajoutées après vérification de la pertinence (7, plus la 73 ci-dessus)** — 74 érosion de marge : le coût de revient d'un produit monte alors que son prix net n'a pas bougé (historique) ; 75 part des revenus venant de produits de revente (valeur ajoutée faible pour un transformateur) ; 76 produit rentable qui n'est pas vendu dans le canal le plus rentable (occasion à saisir) ; 77 un autre fournisseur offre un meilleur prix efficace (perte incluse) pour le même ingrédient ; 78 produit qui consomme X % des heures pour Y % du bénéfice brut (écart temps / profit) ; 79 concentration des frais fixes (les 3 premières lignes pèsent X % du total) ; 80 produits dont le coût matière dépasse la cible, produit par produit.

## Mise en place prévue (lot 3)

1. Registre des règles et fichier de seuils dans `src/engine/` (+ tests).
2. Encadré de la Vue d'ensemble (5 + 5) et fenêtre « Voir tous les constats ».
3. Règles livrées par tranches (une trentaine d'abord), chacune testée.
4. Infobulles et guide (chapitre Vue d'ensemble : « Constats clés », glossaire) dans le même lot.
