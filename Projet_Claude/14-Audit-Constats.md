# Audit des constats — classement à deux axes (phase 2)

Statut : **proposition à valider** (22/11/2026). Aucun code du moteur n'est modifié. Plan : `12-Plan-Export-PDF.md` (3.4). Source : `src/engine/keyFindings.js` (45 constats sur le projet démo) et le catalogue `10-Constats-Cles.md`.

## 1. Résultat de l'audit de couverture

**Le catalogue de 80 règles est entièrement codé.** En confrontant chaque numéro du catalogue aux identifiants du code, y compris l'évolution du point mort (5), des revenus (8), de l'emballage et de la main-d'œuvre (13, 14), les 80 ont leur règle (la 31, « canal majoritaire peu rentable », est couverte par le texte de `channel-dependency`). Les notes de la feuille de route (« environ 35 règles, 45 restantes ») dataient de la première tranche.

Conséquence pour la phase 2 :
- **Aucune règle du catalogue n'est à créer.** Le travail est de **classer** chaque règle (portée, sujet, gravité), de **décliner par entité** celles qui ne le sont pas, de **relire les textes** pour leur nouvelle surface et de définir des **seuils de promotion**.
- Les lacunes réelles sont de forme, pas de couverture : sur le démo, les onglets Par SKU (2 constats) et Emballages (2) sont pauvres parce que les règles sont **agrégées** (« 4 produits dépassent la cible ») alors que la section demande des constats **par entité** (« le Chili dépasse la cible »).

## 2. Définitions proposées

- **Portée** : *générale* (l'entreprise dans son ensemble) ou *spécifique* (un thème ou une entité). Une règle spécifique déclare son **sujet** : type (`produit`, `format`, `canal`, `activité`, `fournisseur`, `ingrédient`, `emballage`, `poste`, `frais fixes`, `point de référence`) et identifiant.
- **Forme** : *par entité* (un constat par sujet) ou *agrégée* (un constat qui résume plusieurs sujets). Les deux coexistent (décision du 22/11) ; une agrégée a une portée générale ou spécifique selon ce qu'elle résume (« 5 produits sur 12 perdent de l'argent » est spécifique à la section Produits et peut être promue).
- **Gravité** (trois niveaux), calculée par la règle à partir de ce que le moteur calcule déjà (`weight`, `tier`, `impact`), pas d'un nouveau chiffre :
  - **Majeure** : `tier` 1, ou `weight` ≥ 80, ou impact ≥ 3 % des ventes ;
  - **Moyenne** : `weight` de 50 à 79, ou impact de 1 % à moins de 3 % ;
  - **Mineure** : le reste.
  Les trois seuils vont dans `reportThresholds.js` ; ils sont **à calibrer** (voir 4).
- **Promotion** : un constat spécifique ou agrégé de gravité majeure s'affiche aussi dans Forces / Faiblesses (limite par colonne), sans règle dupliquée.

## 3. Classement proposé des familles de règles

Légende : G = générale, S = spécifique. Forme : A = agrégée aujourd'hui, E = par entité aujourd'hui. « Décliner » = ajouter la version par entité (l'agrégée reste). Gravité : majeure / moyenne / mineure (indicatif, d'après le démo).

### Rentabilité et réel / théorique (chapitres 1 et 2)
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `safety` | G | entreprise | A | majeure | |
| `net-theoretical` | G | entreprise | A | majeure | |
| `fixed-cover`, `fixed-share` | G | frais fixes | A | majeure (couverture < 1) ; moyenne | |
| `sens-inputs`, `sens-labor` | G | entreprise | A | majeure (perte) ; moyenne (résiste) | Aujourd'hui `tier` 1 même quand le bénéfice résiste : à relire |
| `rec-revenue`, `rec-direct`, `rec-gross`, `rec-net` | G | réel / théorique | A | majeure (écart ≥ 3 % des ventes) ; sinon moyenne | |
| `history-net`, `history-gross`, `history-material`, `-packaging`, `-labor`, `-revenue`, `-breakeven` (et `-12m`) | G | point de référence | A | moyenne ; majeure si l'impact en $ dépasse 3 % | |

### Coûts
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `cost-matiere`, `cost-emballage`, `cost-mo` | G | entreprise | A | majeure (matière 85) ; moyenne | |
| `cost-matiere-products` | S | produit | A | moyenne | **Décliner** : un constat par format au-dessus de la cible |
| `aging-share` | S | vieillissement | A | mineure | |
| `fixed-concentration` | S | frais fixes | A | mineure | |

### Produits (chapitre 3 et fiches)
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `sku-losers`, `sku-negative-everywhere` | S (promouvable) | produit | A | majeure | **Décliner** : « le format X perd dans N canaux » (nourrit la fiche) |
| `sku-positive`, `sku-best`, `sku-missed-channel` | S | produit | A | moyenne | **Décliner** pour `sku-best` et `sku-missed-channel` |
| `bcg-stars`, `bcg-dogs`, `bcg-cows`, `bcg-questions` | S | produit | A | moyenne | **Décliner** : la classe du format (nourrit la fiche) |
| `profit-concentration`, `profit-spread` | S (promouvable) | portefeuille | A | moyenne | |
| `format-gap` | S | produit | A | moyenne | **Décliner** : par produit |
| `subrecipe-weight`, `resale-share` | S | produit ; portefeuille | A | mineure | `subrecipe-weight` à décliner |
| `history-sku-cost-up/down`, `history-sku-margin-up/down`, `history-erosion` | S | produit | A | moyenne | **Décliner** pour la fiche |

### Canaux et activités (chapitre 4)
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `channel-dependency` | S (promouvable) | canal | A | majeure (92) | |
| `channel-deficit-<canal>`, `activity-deficit-<activité>` | S | canal ; activité | E | majeure | Déjà par entité |
| `channel-best`, `channel-underused`, `channel-gap`, `channel-fees` | S | canal | A | moyenne | |
| `history-channel-up/down` | S | canal | A | moyenne | |
| `activity-low-<id>`, `activity-below-<id>`, `activity-cover-<id>` | S | activité | E | moyenne | Déjà par entité |
| `activities-positive`, `activity-dominant`, `activity-underused` | S | activité | A | moyenne / mineure | |

### Approvisionnement (chapitre 5)
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `supplier-ing`, `supplier-pkg` | S (promouvable) | fournisseur | A (le premier seulement) | majeure (ingrédients 80) ; moyenne (emballages) | **Décliner** : chaque fournisseur au-dessus du seuil |
| `volatile-a-ing/pkg`, `stable-a-ing/pkg` | S | ingrédient ; emballage | A | moyenne ; mineure | **Décliner** : par élément volatil |
| `loss-high`, `loss-low` | S | ingrédient | A | moyenne ; mineure | **Décliner** : par ingrédient à perte stock élevée (aujourd'hui, seulement le plus coûteux) |
| `supplier-spread`, `inputs-top5`, `supplier-cheaper`, `sens-item` | S | fournisseur ; ingrédient | A | mineure / moyenne | |
| `history-price-up/down-ing/pkg`, `history-provider-up/down`, `history-price-effect` | S | ingrédient ; fournisseur | A | moyenne (impact 1,2 % pour l'effet des prix) | |

### Main-d'œuvre (chapitre 6)
| Règle | Portée | Sujet | Forme | Gravité | Remarque |
|---|---|---|---|---|---|
| `labor-unused` / `labor-used` | G | équipe | A | majeure (impact 3 %) ; moyenne | |
| `post-used`, `post-underused`, `post-overloaded` | S | poste | A | mineure à moyenne | **Décliner** : un constat par poste |
| `product-best-hour`, `product-worst-hour`, `hours-vs-profit` | S | produit | A | moyenne | **Décliner** pour la fiche |
| `activity-best-hour`, `hour-cost-gap`, `labor-cost-share`, `labor-growth` | S | activité ; équipe | A | moyenne | |

## 4. Calibrage sur le projet démo (45 constats)

Avec la règle de gravité ci-dessus : **9 majeures, 22 moyennes, 14 mineures**.
- Majeures : bénéfice net prévu, résistance à +5 % des intrants et de la main-d'œuvre (`tier` 1), bénéfice net réel sous le modèle, dépendance aux grandes surfaces, produits perdants, coût matière au-dessus de la cible, produit rentable partout, fournisseur à 50 % des achats.
- Forces / Faiblesses (générales + majeures + promues) tiendrait donc **dans la limite de cinq par colonne**.
- Points à calibrer avec vous : (a) les deux constats de sensibilité sont `tier` 1 alors que le bénéfice résiste ; (b) « produit rentable partout » (80) est une force spécifique, majeure uniquement par son poids ; (c) l'impact en $ n'existe que pour une dizaine de règles : les autres se classent sur `weight` / `tier`.

## 5. Couverture par chapitre (constats spécifiques sur le démo)

| Chapitre / onglet | Constats aujourd'hui | Après déclinaison par entité |
|---|---|---|
| Vue d'ensemble (Résultats) | 11 | Inchangé (généraux) |
| Simulation | 2 | Inchangé |
| Portefeuille (Produits) | 8 | Inchangé (agrégés) |
| Par SKU / fiches | 2 | **Un constat par format** (classe, déficit, cible, heure, autre format) |
| Par Canal et Par Activité | 4 + 2 | Inchangé |
| Ingrédients | 8 | + fournisseurs, éléments volatils, pertes par entité |
| Emballages | 2 | **Même richesse que les ingrédients** (même composant) |
| Main-d'œuvre | 6 | + un constat par poste |

## 6. Ce que cela change dans le code
1. Chaque constat porte `scope` (`general` | `specific`), `subject` (`{ type, id, name }`), `form` (`entity` | `aggregate`) et `severity` (`major` | `medium` | `minor`) ; le helper `finding()` les exige (un test échoue si une règle n'en déclare pas).
2. Les filtres par surface (Vue d'ensemble, chaque onglet, chaque fiche) deviennent des fonctions pures testées ; la promotion est une règle unique.
3. Les règles agrégées sont **conservées** ; on ajoute leurs versions par entité à côté.
4. Les identifiants existants ne changent pas (ancres du guide, tests e2e).
5. Les trois seuils de gravité et la limite de Forces / Faiblesses vont dans `reportThresholds.js`.

## 7. Questions à valider
1. **Règle de gravité** (section 2) : tier 1, ou poids ≥ 80, ou impact ≥ 3 % pour la gravité majeure ; poids de 50 à 79 ou impact de 1 % à 3 % pour la moyenne. D'accord, ou faut-il d'autres seuils ?
2. **Sensibilité** (`sens-inputs`, `sens-labor`) : garder `tier` 1 quand le bénéfice résiste, ou ne les classer majeures que lorsqu'il ne résiste pas ?
3. **Limite de Forces / Faiblesses** : cinq par colonne, comme à l'écran aujourd'hui ?
4. **Ordre de travail** proposé : (a) cadre de classement et migration des 80 règles, avec tests ; (b) déclinaisons par entité (produits d'abord, pour les fiches ; puis fournisseurs, éléments, postes) ; (c) blocs « Ce que cela veut dire », tableau d'évolution et cascade (en relisant les moteurs existants avant d'écrire quoi que ce soit) ; (d) relecture des textes avec vous.

## 8. Décisions du 22/11 et réalisation

**Réponses aux quatre questions** : (1) règle de gravité validée ; (2) sensibilité : voir ci-dessous ; (3) **le rapport imprime tous les constats généraux, majeurs et promus** (la limite de cinq par colonne ne vaut que pour l'écran) ; (4) ordre de travail validé. Tous les constats existants seront relus à la lumière du classement.

**Sensibilité (+5 % des intrants, de la main-d'œuvre)** : décision prise sur le modèle d'un consultant. Une simulation est un **test de résistance**, pas un fait : on signale d'abord l'échec (le bénéfice devient négatif : niveau 1, gravité majeure) ; un résultat qui résiste est une information dont la **gravité suit l'ampleur de la perte simulée** (impact en $ rapporté aux ventes). Sur le démo : intrants −1 664 $ (≈ 2 % des ventes) = gravité moyenne ; main-d'œuvre −553 $ (≈ 0,7 %) = mineure. Le ton (force) ne change pas.

**Réalisé** (aucune règle du catalogue supprimée ou modifiée dans son texte) :
- `engine/findingKit.js` : outils partagés (textes, fabrique de constats, marge nette d'un format, écart de marge entre formats) extraits de `keyFindings.js`, réutilisés par les règles par entité.
- `engine/findingMeta.js` : classement par portée et type de sujet (un test vérifie que chaque identifiant du moteur est classé) et calcul de la gravité (seuils dans `reportThresholds.js`).
- `engine/entityFindings.js` : **constats par entité** : par format (classe stratégique, déficit par canal avec impact en $, rentable partout, coût matière au-dessus de la cible, bénéfice brut par heure), par produit (écart de marge entre formats), par case activité × canal, par poste, par fournisseur en dépendance, par élément volatil de classe A, par ingrédient qui pèse dans la perte stock ; plus, dans les tendances, le coût de revient et la marge nette de chaque format.
- `computeKeyFindings(ctx, { entities: true })` : renvoie tout le jeu, avec `scope`, `subjectType`, `subject`, `form` et `severity` sur chaque constat. **Par défaut, rien ne change pour les écrans** (45 constats sur le démo ; 94 avec les entités, dont 49 nouveaux).
- Distribution sur le démo avec les entités : majeure 9 (5 générales, 4 spécifiques), moyenne 42, mineure 43.

**À trancher (écart existant de l'application)** : la règle `product-best-hour` dit « moyenne : 108 $ » (bénéfice brut des produits ÷ heures des produits), alors que l'écran Main-d'œuvre affiche une moyenne de **87,39 $/h** (ventes et bénéfice brut ÷ **toutes** les heures de production, sous-recettes comprises). Les deux sont étiquetées « moyenne ». Les nouveaux constats par format reprennent la moyenne de la règle existante (108 $) pour rester cohérents avec elle ; il faudra choisir un seul chiffre avant la mise en service.

**Reste de la phase 2** : filtres par surface et règle de promotion ; relecture des textes des règles existantes ; blocs « Ce que cela veut dire », tableau d'évolution et cascade du revenu au bénéfice (en relisant d'abord les moteurs existants).

### Écart des 108 $ et 87,39 $/h : tranché le 22/11
Décision : **le rapport suit la méthode de l'écran Main-d'œuvre et ne recalcule rien.** La moyenne de bénéfice brut par heure est celle de la marge de croissance (`computeGrowthMargin`, déjà dans le contexte des constats) : bénéfice brut des produits fabriqués ÷ **toutes** les heures de production, sous-recettes comprises (87,39 $/h sur le démo). Le constat existant `product-best-hour` et les constats par format `sku-hour-*` la lisent ; sans marge de croissance (aucune heure libre), la comparaison est muette. Conséquence sur le démo : aucun format ne passe sous la moitié de la moyenne, donc `product-worst-hour` disparaît (45 → 44 constats agrégés) et les huit constats d'heure par format sont des forces.

### Fin de la phase 2 (22/11)
- **Filtres par surface** (`engine/findingSurfaces.js`) : Forces / Faiblesses = tous les constats majeurs (généraux, ou spécifiques **promus**, par entité ou agrégés), sans limite sur papier ; chapitres 2 à 6 = tous les constats du chapitre, du plus grave au moins grave ; fiche d'un format = ses constats et l'écart de marge de son produit.
- **Tableau d'évolution** (`computeTrendRows`) : lit les mêmes mesures et les mêmes relevés que les constats d'évolution (`EVOLUTION_METRICS`, `historyPoints`, `yearAgoPoint`, désormais partagés).
- **Quatre blocs « Ce que cela veut dire »** (`engine/reportReadings.js`) : réconciliation (seuil de 5 % des constats existants), évolution de la marge brute, cases activité × canal en perte (matrice de l'application), main-d'œuvre (paie non utilisée, heure productive, marge de croissance). Muets sans données.
- **Cascade du revenu au bénéfice et « sur chaque dollar »** (`engine/profitCascade.js`) : somme des totaux par canal déjà calculés ; identités vérifiées par test.
- **Non fait** : la ligne « principaux ingrédients » d'une fiche. Le moteur de recettes n'expose pas le coût de chaque ligne (il n'est que cumulé dans `calculateCosts`) ; l'exposer alourdirait les points de référence enregistrés. À décider en phase 4.
- **Relecture des textes** : document `15-Revue-Textes-Constats.md` (94 constats du démo, par chapitre, avec surface et gravité), à relire avec l'utilisateur.
- **Total** : 95 constats sur le démo (45 existants + 50 par entité), une fois les entrées de l'application reproduites fidèlement (rapport de productivité par activité).
