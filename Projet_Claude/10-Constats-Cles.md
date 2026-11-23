# Constats clés — principes et catalogue des règles

Statut : **lot 3** de la refonte de Rapport et suivi (21/11). Les lots 1 et 2 sont livrés ; ce lot 3 est en cours : la **première tranche** est livrée (21/11), les autres règles du catalogue restent à faire. Le fichier des seuils existe déjà : `src/engine/reportThresholds.js`. Voir `03-Feuille-de-route.md`.

## Ce que c'est

Un encadré de la **Vue d'ensemble** de Rapport et suivi, sous les tuiles : ce que les chiffres de l'entrepreneur disent de son entreprise, **en forces et en faiblesses** (langage de gestion). Chaque constat donne un chiffre et un lien vers l'endroit où agir (`goToReport(sous-onglet)`).

## Principes (décidés avec l'utilisateur le 21/11)

- **Pas une analyse par IA.** Des règles déterministes : chaque règle est une fonction pure qui reçoit les données du projet et renvoie zéro ou un constat `{ id, ton, thème, poids, titre, détail, lien }`. Les textes sont des gabarits.
- **Deux colonnes : Forces / Faiblesses.** Pas seulement des alarmes : un constat positif est aussi utile qu'un point d'attention.
- **5 visibles au maximum par colonne**, triés par poids ; le reste dans une **fenêtre** « Voir tous les constats », regroupée par thème.
- **Jamais un avertissement de qualité des données** (produit sans prix, sans volume, relevé ancien…) : cela reste dans le panneau « points à vérifier » existant.
- **Une donnée absente reste absente** : une règle sans donnée est muette, jamais forcée à 0.
- **Seuils dans un seul fichier de configuration** (ex. fournisseur ≥ 30 % des achats, paie non utilisée ≥ 15 %), à valider avec l'utilisateur.
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

## Première tranche livrée (21/11)

Code : `src/engine/keyFindings.js` (règles, `computeKeyFindings`, `buildKeyFindingsContext`), seuils dans `src/engine/reportThresholds.js`, écran `src/features/reports/KeyFindings.jsx` (5 + 5 et fenêtre « Voir tous les constats »), tests `keyFindings.test.js` (19) et `e2e/report-lot3.spec.js` (5).

**Règles livrées (numéros du catalogue)** : 1 (marge de sécurité), 2 (bénéfice net prévu), 9 à 11 (coûts vs cibles), 80 (produits au-dessus de la cible de coût matière), 18 à 20 (produits rentables partout / qui perdent de l'argent / déficitaires partout), 21, 22, 24 (étoiles, poids morts, vaches à lait), 25 (profit concentré), 30 (dépendance à un canal, avec la part du bénéfice net), 32 et 34 (meilleure marge, canal déficitaire), 38, 39, 42 (activités), 45 et 54 (fournisseur en dépendance, ingrédients et emballages), 47, 48 (classe A volatile / stable), 51, 52 (perte stock), 58, 59 (poste bien occupé, paie non utilisée), 61, 62 (meilleur / moins bon produit à l'heure), 64 (marge de croissance), 67, 68, 70 (réel vs théorique), 3, 12 (marge brute et coût matière depuis le premier point de référence). Environ 35 règles ; environ trente constats s'appliquent au projet démo (avec les seuils d'origine : 14 forces et 16 faiblesses ; ils ont été révisés ensuite, voir ci-dessous).

**Restent à faire** : 4 à 8, 13 à 17, 23, 26 à 29, 31, 33, 35 à 37, 40, 41, 43, 44, 46, 49, 50, 53, 55 à 57, 60, 63, 65, 66, 69 et 71 à 79 (la plupart demandent l'historique des points de référence ou les scénarios du simulateur).

Un constat de la Vue d'ensemble n'a pas de lien (on y est déjà). Une règle qui échoue se tait. Les textes sont des gabarits en français de gestion ; ils sont calculés dans le moteur (jamais dans l'écran).

## Détail des règles livrées (ce que fait le code)

Source : `src/engine/keyFindings.js`. Les seuils (en gras) sont dans `src/engine/reportThresholds.js` : on les change à cet endroit seulement. Le **poids** (0 à 100) ordonne les constats ; à poids égal, l'ordre est celui de l'identifiant. Un « — » dans « Quand elle se tait » veut dire que la règle n'a pas de condition particulière au-delà de la donnée elle-même.

### Rentabilité

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 1 | `safety` | Faiblesse 100 | Marge de sécurité < 0 | « Vous êtes X $ sous le point mort » | Sans ventes prévues ou sans point mort |
| 1 | `safety` | Faiblesse 85 | 0 ≤ marge de sécurité < **10 %** | « Marge de sécurité mince : p % » | idem |
| 1 | `safety` | Force 90 | Marge de sécurité ≥ **20 %** | « Marge de sécurité de p % » + dépassement du point mort | idem ; entre 10 % et 20 % : muette |
| 2 | `net-theoretical` | Faiblesse 95 / Force 70 | Bénéfice net prévu (ventes prévues − charges directes théoriques − frais fixes − vieillissement) négatif / positif | « Bénéfice net prévu négatif : X $ » / « Bénéfice net prévu de X $ » (et part des ventes) | Sans ventes prévues ; net = 0 |

### Coûts

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 9 | `cost-matiere` | Faiblesse 85 / Force 70 | Coût matière moyen pondéré > / ≤ la cible de Paramètres | « Coût matière au-dessus de la cible » / « sous sa cible » | Aucune cible saisie |
| 10 | `cost-emballage` | Faiblesse 60 / Force 45 | Idem, emballage | idem | idem |
| 11 | `cost-mo` | Faiblesse 60 / Force 45 | Idem, main-d'œuvre | idem | idem |
| 80 | `cost-matiere-products` | Faiblesse 55 | Au moins un produit dont le coût matière dépasse la cible | « N produits sur M dépassent la cible de coût matière » + les noms | Aucune cible saisie |

### Produits

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 19 | `sku-losers` | Faiblesse 88 | Au moins un produit avec une marge nette négative dans un de ses canaux | « N produits sur M perdent de l'argent dans au moins un canal » + le pire (nom, marge, canal) | Produit sans marge calculable : jamais compté |
| 20 | `sku-negative-everywhere` | Faiblesse 92 | Produit déficitaire dans tous ses canaux | « N produits déficitaires dans tous leurs canaux » + noms | — |
| 18 | `sku-positive` | Force 60 | Au moins un produit rentable dans tous ses canaux | « N produits sur M rentables dans tous leurs canaux » | — |
| 18 | `sku-best` | Force 80 | Parmi ceux-là, à au moins 2 canaux : la meilleure marge minimale | « « Produit » est rentable partout » + fourchette des marges | Aucun produit à 2 canaux ou plus |
| 21 | `bcg-stars` | Force 50 | Au moins une étoile (matrice stratégique) | « N étoiles : à protéger » + noms | — |
| 22 | `bcg-dogs` | Faiblesse 48 | Au moins un poids mort | « N poids morts : à repenser ou retirer » | — |
| 24 | `bcg-cows` | Faiblesse 42 | Au moins une vache à lait | « N vaches à lait à optimiser » | — |
| 25 | `profit-concentration` | Faiblesse 55 | Au moins 3 produits à contribution positive et le n° 1 pèse ≥ **30 %** du profit | « « Produit » génère p % du profit » | Moins de 3 produits rentables |

### Canaux et activités

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 30 | `channel-dependency` | Faiblesse 92 | Au moins 2 canaux et le plus gros pèse ≥ **40 %** des revenus | « Canal : p % des revenus, q % du bénéfice net » (la part du bénéfice net seulement si le bénéfice total est positif) | Un seul canal |
| 34 | `channel-deficit-<id>` | Faiblesse 80 | Un canal dont le bénéfice net est négatif | « Canal perd de l'argent » | — |
| 32 | `channel-best` | Force 65 | Au moins 2 canaux ; la meilleure marge nette est positive et n'est pas celle du canal le plus gros | « Canal : la meilleure marge nette » | — |
| 38 | `activity-deficit-<id>` | Faiblesse 85 | Une activité dont le bénéfice net est négatif | « Activité perd de l'argent » | — |
| 42 | `activity-low-<id>` | Faiblesse 50 | Bénéfice net positif mais marge nette < **3 %** | « Activité : marge nette de p % » | — |
| 39 | `activities-positive` | Force 55 | Au moins 2 activités, toutes bénéficiaires | « Les N activités sont bénéficiaires » | — |

### Approvisionnement

Le poids des constats sur les **emballages** vaut 65 % de celui des ingrédients (ils pèsent moins dans les décisions).

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 45 | `supplier-ing` / `supplier-pkg` | Faiblesse 80 / 52 | Le premier fournisseur pèse ≥ **30 %** des achats | « Fournisseur : p % des achats d'ingrédients (d'emballages) » | Aucun fournisseur à 30 % |
| 47 | `volatile-a-ing` / `volatile-a-pkg` | Faiblesse 78 / 51 | Au moins un élément de classe A à prix volatil (au moins 2 points de référence) | « N ingrédients de classe A à prix volatil » + amplitudes | Moins de 2 points de référence |
| 48 | `stable-a-ing` / `stable-a-pkg` | Force 45 / 29 | Éléments de classe A, aucun volatil, historique suffisant | « Les ingrédients de classe A ont des prix stables » | Moins de 2 points de référence |
| 51 | `loss-high` | Faiblesse 42 | Perte stock prévue (ingrédients) ≥ **3 %** des achats | « Perte stock prévue : X $ (p % des achats) » + l'ingrédient le plus coûteux | Entre 1 % et 3 % |
| 52 | `loss-low` | Force 30 | Perte stock prévue < **1 %** des achats | « Perte stock faible : p % des achats » | idem |

### Main-d'œuvre

| N° | Identifiant | Ton et poids | Condition | Texte affiché | Quand elle se tait |
|---|---|---|---|---|---|
| 59 | `labor-unused` | Faiblesse 70 | Paie non utilisée ≥ **15 %** de la paie | « p % de la paie n'est pas utilisée » + montant | Sans postes ; entre 10 % et 15 % |
| 59 | `labor-used` | Force 50 | Paie non utilisée ≤ **10 %** | « Seulement p % de la paie non utilisée » | idem |
| 58 | `post-used` | Force 40 | Un poste de production (heures requises > 0) utilisé à ≥ **85 %** | « Poste à p % d'utilisation » | Aucun poste à 85 % |
| 61 | `product-best-hour` | Force 75 | Au moins 3 produits avec un bénéfice brut par heure | « « Produit » : le meilleur usage du temps » + $/h et moyenne | Moins de 3 produits ; revente ignorée |
| 62 | `product-worst-hour` | Faiblesse 45 | Le dernier produit rapporte < **50 %** de la moyenne | « « Produit » rapporte peu à l'heure » | idem |
| 64 | `labor-growth` | Force 55 | Heures libres des postes de production ≥ **5 %** des heures productives attendues | « Marge de croissance : N h libres » + ventes additionnelles estimées | Moins de 5 % d'heures libres |

### Réel vs théorique (seulement si des chiffres réels sont saisis)

| N° | Identifiant | Ton et poids | Condition | Texte affiché |
|---|---|---|---|---|
| 67 | `rec-revenue` | Force 50 | Écart des revenus réels vs modèle dans ± **5 %** | « Revenus réels alignés sur votre modèle (+p %) » |
| 68 | `rec-direct` | Faiblesse 60 | Charges directes réelles ≥ **5 %** au-dessus du modèle | « Charges directes réelles au-dessus du modèle (+p %) » |
| 70 | `rec-net` | Faiblesse 75 / Force 60 | Bénéfice net réel ≤ −**10 %** / ≥ +**10 %** du modèle | « Bénéfice net réel sous / au-dessus du modèle » |

### Évolution (au moins 2 points de référence ; comparée au plus ancien)

| N° | Identifiant | Ton et poids | Condition | Texte affiché |
|---|---|---|---|---|
| 3 | `history-gross` | Force 55 / Faiblesse 55 | Marge brute moyenne ± **1 point** ou plus | « Marge brute en hausse / en baisse de N points » |
| 12 | `history-material` | Faiblesse 50 / Force 45 | Coût matière moyen ± **1 point** ou plus | « Coût matière en hausse / en baisse de N points » |

## Seuils : valeurs retenues et repères de gestion

Source unique : `src/engine/reportThresholds.js` (valeurs écrites en pourcentage, un commentaire par seuil). **Honnêteté sur l'origine** : les premières valeurs étaient des jugements raisonnables de ma part, sans fourchette de gestion vérifiée. Le 21/11 elles ont été revues d'après des ordres de grandeur couramment admis. Il n'existe pas de norme universelle pour ces seuils : ce sont des repères, à confirmer avec un conseiller ou un comptable, puis à ajuster à la réalité de l'entreprise. Le niveau de confiance indique à quel point le repère est largement admis.

| Seuil | Valeur | Repère de gestion | Confiance |
|---|---|---|---|
| Marge de sécurité confortable / mince | 20 % / 10 % | 20 % et plus jugé confortable ; sous 10 %, un recul modeste des ventes fait perdre de l'argent (avant : 10 % / 5 %, trop indulgent) | Moyenne |
| Dépendance à un fournisseur | 30 % des achats | On évite qu'un fournisseur dépasse environ le quart au tiers des achats (25 à 40 % selon les sources ; avant : 40 %) | Moyenne |
| Dépendance à un canal | 40 % des revenus | Un client ou un canal au-delà de 25 à 40 % des ventes est un risque de concentration reconnu (avant : 50 %) | Moyenne |
| Profit concentré sur le produit n° 1 | 30 % | Repère de lecture (le tiers du profit sur un produit) ; avant : 25 % | Faible |
| Activité ou canal à très faible marge nette | 3 % | Marge nette typique de 3 à 8 % en transformation alimentaire | Moyenne |
| Perte stock élevée / faible | 3 % / 1 % des achats | Une perte de 1 à 3 % des matières est courante ; au-delà elle mérite attention | Moyenne |
| Paie non utilisée élevée / faible | 15 % / 10 % | Objectif courant de taux d'utilisation de 85 à 90 % (avant : 15 % / 8 %) | Bonne |
| Poste bien occupé | 85 % et plus | Même repère de taux d'utilisation (avant : 90 %) | Bonne |
| Produit qui rapporte peu à l'heure | sous 50 % de la moyenne | Repère de lecture, sans norme | Faible |
| Marge de croissance signalée | 5 % des heures productives attendues | Relatif plutôt qu'en heures (avant : 10 h, qui dépendait de la longueur de la période) | Faible |
| Réel vs théorique : « aligné » et écart des charges directes | ± 5 % et 5 % | En analyse des écarts, on s'intéresse en général aux écarts de plus de 5 % (avant : 2 % et 3 %) | Bonne |
| Réel vs théorique : bénéfice net | 10 % | Le bénéfice net est une petite différence entre de grands montants : seuil plus large | Moyenne |
| Évolution (marge brute, coût matière) | 1 point | Un point de marge est déjà significatif dans un secteur à marges serrées | Moyenne |

Effet sur le projet démo : la marge de sécurité de 13,89 % n'est plus une force (entre 10 % et 20 % : aucun constat) ; le fournisseur en dépendance et le canal dominant le restent.

## Essai en trois groupes et règles de tendance (21/11, non commité)

**Présentation à l'essai** : trois blocs l'un à la suite de l'autre (Objectifs stratégiques / Amélioration-détérioration / Forces et faiblesses), chacun avec deux colonnes (positifs à gauche, négatifs à droite), trois lignes au maximum par colonne, et un lien « Voir tout (n) » par bloc qui ouvre la fenêtre du groupe. Pas de barre d'onglets.

**Règles de tendance livrées** (identifiants `history-*`, groupe Amélioration / détérioration, comparées au plus ancien point de référence ; muettes avec moins de deux points) : 3 marge brute, 4 marge nette, 5 point mort, 8 revenus, 12 coût matière, 13 coût d'emballage, 14 coût de main-d'œuvre, 15 et 16 coût de revient des produits (hausse / baisse), 28 marge nette des produits, 37 revenus d'un canal, 49 et 50 prix des intrants et des emballages (au moins 3 relevés), 56 fournisseurs (variation moyenne), 74 érosion de marge (coût en hausse, prix net inchangé). Seuils dans `reportThresholds.js` (revenueChange 5 %, breakEvenChange 5 %, skuCostChange 5 %, skuMarginPoints 5 points, channelChange 10 %, priceTrend 10 %, providerTrend 8 %).

**Mise à jour du 21/11 (suite)** : la comparaison se fait maintenant avec le **dernier** point de référence (un seul suffit), et non plus avec le premier : avec un historique de plusieurs années, comparer toujours au premier n'aurait plus de sens. Une mesure qui évolue dans le même sens sur au moins trois valeurs consécutives (jusqu'aux deux ou trois derniers relevés et aujourd'hui) devient une **tendance** (« en baisse constante depuis N relevés ») qui remplace la variation simple : marge brute, marge nette, coût matière, revenus. Les tendances de prix des intrants se mesurent sur les trois derniers relevés. Le bloc des constats est placé sous la matrice Activité × Canal de la Vue d'ensemble.

**Le catalogue est maintenant entièrement programmé** (80 règles ; une règle sans donnée reste muette, c'est normal qu'elles n'apparaissent pas toutes dans le démo). Ajoutées dans cette tranche : 6, 7, 17, 23, 26, 27, 29, 33, 35, 36, 40, 41, 43, 44, 46, 53, 55, 57, 60, 63, 65, 66, 69, 71, 72, 73, 75, 76, 77, 78, 79. Seuils dans `reportThresholds.js` (section « Compléments du catalogue »). Notes : la 41 (activité sous son point mort) ne se déclenche que si l'activité n'est pas déjà déficitaire (sinon la règle « perd de l'argent » la couvre) ; 71 et 73 mesurent l'effet d'un choc de 5 % sur le bénéfice net prévu, 72 celui de 10 % sur le premier intrant ; 77 compare les fournisseurs d'un même ingrédient (même nom et même unité, perte incluse).

## Évolution et hiérarchie (21/11, révision)

**Pourquoi l'évolution avait changé** : le dernier point du projet démo est « Situation actuelle », identique à l'état d'aujourd'hui ; comparer à lui ne donnait donc aucune variation, et la tendance demandait trois valeurs distinctes. Correction : un point enregistré qui ne diffère plus d'aujourd'hui est écarté (on compare au précédent).

**Trois lectures pour chaque mesure** (marge brute, marge nette, coût matière, coût d'emballage, coût de main-d'œuvre, revenus, point mort) : variation depuis le dernier relevé utile ; tendance (même sens sur au moins trois valeurs consécutives, qui remplace la variation) ; recul de 12 mois (le relevé le plus proche d'il y a un an, à 75 jours près). Les tendances par produit (coût de revient, marge, érosion), par canal et par intrant gardent le dernier relevé utile pour référence ; les prix des intrants se mesurent sur les trois derniers relevés.

**Hiérarchie d'affichage** : niveau de gravité (1 survie : point mort, bénéfice négatif, pertes, déficits ; 2 moteurs de profit : marges, cibles, produits, canaux, évolution ; 3 efficacité : main-d'œuvre, fournisseurs, activités ; 4 information : stabilité, répartition, confort), puis, dans le niveau, l'impact en $ rapporté aux ventes (1 % des ventes = 10 points, plafonné à 100) quand la règle le connaît, sinon son poids. Fonctions \`tierOf\` et \`rankOf\` dans \`keyFindings.js\` ; chaque constat porte \`tier\`, \`impact\` et \`rank\`.

## Les constats dans toute l'application (23/11) : une adresse par constat

Suite au classement à deux axes (portée générale / spécifique, gravité majeure / moyenne / mineure) mis en place pour l'export PDF, les constats sortent de la Vue d'ensemble et se répandent dans les rapports, sans se répéter. Filtres purs dans `src/engine/findingSurfaces.js` (mêmes données que le PDF), écran dans `src/features/reports/KeyFindings.jsx`.

| Surface | Constats affichés |
|---|---|
| Vue d'ensemble, sous les tuiles : **Objectifs stratégiques** | Le groupe « objectif » (écart aux cibles), sans la version par format (elle vit dans la fiche du format) |
| Vue d'ensemble, sous l'évolution des marges et coûts moyens : **Amélioration / détérioration** | Le groupe « évolution », de portée générale seulement |
| Vue d'ensemble, sous la matrice Activité × Canal : **Forces et faiblesses** | **Exactement les règles du chapitre 1 du PDF** (`strengthsAndWeaknesses`) : les constats de gravité majeure, généraux d'office et spécifiques promus, hors objectifs et évolution ; les plus importants d'abord |
| Fin de Portefeuille, Par SKU, Par Activité, Par Canal, Ingrédients, Emballages, Main-d'œuvre : **bandeau** | Les constats qui renvoient à ce sous-onglet, toutes gravités, du plus grave au moins grave, sauf ceux qui ont déjà leur adresse dans la Vue d'ensemble (objectifs, évolution générale, généraux majeurs) ; Par SKU y ajoute la fiche du SKU choisi |
| Simulation | Aucun bandeau |

**Contre les répétitions** : la portée générale et les objectifs vivent seulement dans la Vue d'ensemble ; un constat par format n'apparaît que dans la fiche du SKU choisi ; dans un bandeau, la règle agrégée écarte sa version par entité (ingrédients volatils, perte stock, écart entre formats), sauf pour les postes de production où la version par entité en dit plus ; un texte identique n'apparaît qu'une fois. Le seul recouvrement voulu : un constat spécifique majeur promu dans Forces et faiblesses reste aussi dans son sous-onglet. Un test vérifie que chaque constat du projet démo a une adresse. **Sans adresse dans l'application** (décision du 23/11) : les constats généraux de gravité moyenne ou mineure qui renvoient à la Vue d'ensemble ou à Simulation (part des frais fixes, revenus réels alignés, résistance à un choc de coûts) ; ils restent dans le chapitre 2 du rapport PDF, l'information étant déjà visible ailleurs (tuiles, réconciliation, simulateur).

Chaque bloc : deux colonnes (positif à gauche), trois lignes au maximum par colonne, « Voir tout (n) » vers une fenêtre regroupée par thème.

## Gravité révisée et forces miroirs (23/11)

**Problème** : la gravité reprenait le poids (≥ 80 = majeure). Or le poids est un outil de tri, et les forces ont naturellement des poids plus bas que les alertes : dans le démo, Forces et faiblesses montrait un seul produit (« rentable partout », poids 80 choisi pour le classer premier, sans aucun enjeu en dollars) et presque aucune force.

**Règle actuelle** (`severityOf`, `findingMeta.js`) : **majeure** si niveau 1, impact ≥ 3 % des ventes, constat **structurel**, ou (portée générale seulement) poids ≥ 80 ; **moyenne** si poids ≥ 50 ou impact ≥ 1 % ; sinon mineure. Le poids ne rend plus un constat spécifique majeur.

**Constats structurels** (`STRUCTURAL`) : majeurs par nature, faiblesse comme force. Chaque faiblesse a son miroir : dépendance à un canal / **revenus bien répartis** (`channel-balanced`, nouveau) ; dépendance à un fournisseur / **fournisseurs répartis** (`supplier-spread`, dès trois fournisseurs sans dépendance) ; produits déficitaires / **aucun produit déficitaire** (`sku-none-losing`, nouveau) ; profit concentré / profit bien réparti ; activité déficitaire / toutes bénéficiaires ; paie non utilisée / bien utilisée ; cibles dépassées / **toutes les cibles atteintes** (`targets-all-met`, nouveau, au moins deux cibles saisies).

Démo : 4 forces majeures (bénéfice net prévu, revenus réels alignés, profit bien réparti, activités bénéficiaires) contre 7 faiblesses majeures ; la différence tient aux données (démo volontairement déficitaire), plus à la formule.
