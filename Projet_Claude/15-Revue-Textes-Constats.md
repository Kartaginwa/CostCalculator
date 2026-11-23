# Revue des textes des constats

*Régénérée le 23/11, après la révision de la gravité et le rangement des constats par adresse (comme dans l'application).*

Projet démo : **100 constats** (règles agrégées et règles par entité). Chaque constat affiché a **une adresse**, la même dans l'application et dans le rapport PDF (9 constats sont écartés comme redondants : voir la section « Contrôle »). Le tableau donne, pour chacun, son identifiant, sa gravité (majeure, moyenne, mineure), sa portée (générale ou particulière), son ton (force ou faiblesse), son titre et son détail, tels qu'ils seront imprimés. Dans chaque tableau, l'ordre est celui du rapport.

**À relire** : formulation, anglicismes, ton (force / faiblesse), clarté pour un lecteur qui ne connaît pas l'application. Pour corriger un texte, indiquez l'identifiant et le texte voulu. Les textes sont écrits dans `engine/keyFindings.js` et `engine/entityFindings.js`.

## Chapitre 1 · Synthèse (Vue d'ensemble de l'application)

### Objectifs stratégiques : forces (5)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| cost-emballage | Mineure | Générale | Force | Coût emballage sous sa cible | À 7,17 % contre une cible de 8 %. |
| cost-mo | Mineure | Générale | Force | Coût main-d'œuvre sous sa cible | À 13,87 % contre une cible de 22 %. |
| obj-margeBrute | Mineure | Générale | Force | Marge brute : objectif atteint | À 43,1 % contre un objectif d'au moins 40,0 %. |
| obj-perteStock | Mineure | Générale | Force | Perte stock : objectif atteint | À 4,1 % contre un objectif d'au plus 5,0 %. |
| obj-utilisation | Mineure | Générale | Force | Taux d'utilisation des postes : objectif atteint | À 87,5 % contre un objectif d'au moins 85,0 %. |

### Objectifs stratégiques : faiblesses (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| cost-matiere | Majeure | Générale | Faiblesse | Coût matière au-dessus de la cible | À 34,57 % contre une cible de 32 %. 4 produits sur 12 dépassent cette cible : Saumon teriyaki, riz et légumes, Chili con carne mijoté, Potage à la courge musquée, 1 autre. |
| obj-margeNette | Majeure | Générale | Faiblesse | Marge nette sous l'objectif | À 7,9 % contre un objectif d'au moins 10,0 %. |
| obj-fraisFixes | Moyenne | Générale | Faiblesse | Frais fixes au-dessus de l'objectif | À 35,1 % contre un objectif d'au plus 30,0 %. |
| obj-paieNonUtilisee | Majeure | Générale | Faiblesse | Paie non utilisée au-dessus de l'objectif | À 21,8 % contre un objectif d'au plus 15,0 %. |

### Amélioration : forces (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| history-net | Moyenne | Générale | Force | Marge nette en hausse constante depuis 3 relevés (+1,6 point) | De 6,3 % (« Relevé août 2026 ») à 7,9 % aujourd'hui. |
| history-gross | Moyenne | Générale | Force | Marge brute en hausse constante depuis 3 relevés (+1,6 point) | De 41,5 % (« Relevé août 2026 ») à 43,1 % aujourd'hui. |
| history-material | Moyenne | Générale | Force | Coût matière en baisse constante depuis 3 relevés (−1,5 point) | De 36,0 % (« Relevé août 2026 ») à 34,6 % aujourd'hui. |

### Détérioration : faiblesses (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| history-net-12m | Moyenne | Générale | Faiblesse | Marge nette en baisse sur 12 mois (−2,2 points) | De 10,1 % (« Relevé novembre 2025 ») à 7,9 % aujourd'hui. |
| history-gross-12m | Moyenne | Générale | Faiblesse | Marge brute en baisse sur 12 mois (−2,1 points) | De 45,2 % (« Relevé novembre 2025 ») à 43,1 % aujourd'hui. |
| history-material-12m | Moyenne | Générale | Faiblesse | Coût matière en hausse sur 12 mois (+1,8 point) | De 32,8 % (« Relevé novembre 2025 ») à 34,6 % aujourd'hui. |

### Forces de l'entreprise (4)

Constats majeurs (les plus lourds), bloc « Forces et faiblesses ».

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| net-theoretical | Majeure | Générale | Force | Bénéfice net prévu de 6 299 $ | Soit 7,9 % des ventes prévues, tous coûts et frais fixes déduits. |
| rec-revenue | Majeure | Générale | Force | Revenus réels alignés sur votre modèle (+0,4 %) | 80 000 $ réels contre 79 714 $ prévus. |
| profit-spread | Majeure | Particulière | Force | Profit bien réparti : les 3 premiers produits pèsent 39 % | Sur 12 produits contributifs : aucun ne porte à lui seul l'entreprise. |
| activities-positive | Majeure | Particulière | Force | Les 3 activités sont bénéficiaires | Bénéfice net positif pour chacune : 5 113 $, 1 019 $, 168 $. |

### Faiblesses de l'entreprise (7)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| rec-net | Majeure | Générale | Faiblesse | Bénéfice net réel sous le modèle (-36,5 %) | 4 000 $ réels contre 6 299 $ prévus. |
| channel-dependency | Majeure | Particulière | Faiblesse | Grandes surfaces : 58 % des revenus, 15 % du bénéfice net | 916 $ de bénéfice net sur 6 299 $ : le canal qui pèse le plus rapporte proportionnellement le moins. |
| sku-losers | Majeure | Particulière | Faiblesse | 5 produits sur 12 perdent de l'argent dans au moins un canal | Le pire : « Sauce à spaghetti maison », -15,7 % de marge nette (Grandes surfaces). |
| rec-direct | Majeure | Générale | Faiblesse | Charges directes réelles au-dessus du modèle (+5,8 %) | +2 644 $ : pertes, rendements ou prix payés plus élevés que prévu. |
| supplier-ing | Majeure | Particulière | Faiblesse | Boucherie Nordique : 50 % des achats d'ingrédients | Une dépendance à un seul fournisseur. |
| supplier-pkg | Majeure | Particulière | Faiblesse | Emballages Boréal : 80 % des achats d'emballages | Une dépendance à un seul fournisseur. |
| labor-unused | Majeure | Générale | Faiblesse | 21,8 % de la paie n'est pas utilisée | Soit 2 411 $ payés sans produire, absorbés dans le coût de vos produits. |

## Chapitre 2 · Résultats

### Constats complémentaires (3)

Constats généraux non majeurs qui n'ont pas d'autre adresse.

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| fixed-share | Moyenne | Générale | Faiblesse | Les frais fixes pèsent 35 % des revenus | Une structure de frais lourde exige un volume élevé pour être rentable. |
| sens-inputs | Moyenne | Générale | Force | Votre bénéfice résiste à une hausse de 5 % des intrants | Il passerait de 6 299 $ à 4 636 $. |
| sens-labor | Mineure | Générale | Force | Votre bénéfice résiste à une hausse de 5 % de la main-d'œuvre | Il passerait de 6 299 $ à 5 747 $. |

## Chapitres 3 à 6 · Bandeau de chaque sous-onglet

### Chapitre 3 · Portefeuille (8)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-losers | Majeure | Particulière | Faiblesse | 5 produits sur 12 perdent de l'argent dans au moins un canal | Le pire : « Sauce à spaghetti maison », -15,7 % de marge nette (Grandes surfaces). |
| profit-spread | Majeure | Particulière | Force | Profit bien réparti : les 3 premiers produits pèsent 39 % | Sur 12 produits contributifs : aucun ne porte à lui seul l'entreprise. |
| sku-best | Moyenne | Particulière | Force | « Sauté de poulet thaï, riz et légumes (350 g) » est rentable partout | Marge nette positive dans ses 3 canaux, de 22,6 % à 42,3 %. |
| sku-positive | Moyenne | Particulière | Force | 7 produits sur 12 rentables dans tous leurs canaux | Marge nette positive partout où ils sont vendus. |
| bcg-stars | Moyenne | Particulière | Force | 3 étoiles : à protéger | « Poulet général Tao, riz et légumes », « Saumon teriyaki, riz et légumes », « Sauté de poulet thaï, riz et légumes (350 g) » |
| bcg-dogs | Mineure | Particulière | Faiblesse | 2 poids morts : à repenser ou retirer | « Purée de pommes de terre maison », « Sauce à spaghetti maison » |
| bcg-cows | Mineure | Particulière | Faiblesse | 5 vaches à lait à optimiser | Très vendus mais peu rentables : « Pâté chinois traditionnel (340 g) », « Chili con carne mijoté », « Soupe-repas aux légumes et poulet », 2 autres. |
| bcg-questions | Mineure | Particulière | Faiblesse | 2 dilemmes : rentables, mais peu vendus | À promouvoir ou à abandonner : « Pâté chinois traditionnel (900 g) », « Sauté de poulet thaï, riz et légumes (900 g) ». |

### Chapitre 3 · Par SKU (1)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| format-gap | Mineure | Particulière | Faiblesse | 1 produit aux marges très différentes selon le format | Le plus marqué : « Sauté de poulet thaï, riz et légumes (350 g) » à 27,4 % contre « Sauté de poulet thaï, riz et légumes (900 g) » à 4,0 %. |

### Chapitre 4 · Par Canal (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| channel-dependency | Majeure | Particulière | Faiblesse | Grandes surfaces : 58 % des revenus, 15 % du bénéfice net | 916 $ de bénéfice net sur 6 299 $ : le canal qui pèse le plus rapporte proportionnellement le moins. |
| channel-underused | Moyenne | Particulière | Force | Vente directe (boutique en ligne) : forte marge, encore peu exploité | 26,8 % de marge nette (moyenne : 7,9 %) pour 16 % des revenus : un canal à développer. |
| channel-best | Moyenne | Particulière | Force | Vente directe (boutique en ligne) : la meilleure marge nette | 26,8 % de marge nette pour 16 % des revenus. |
| channel-gap | Mineure | Particulière | Faiblesse | Grand écart de marge entre vos canaux : 24,8 points | De 2,0 % (Grandes surfaces) à 26,8 % (Vente directe (boutique en ligne)). |

### Chapitre 4 · Par Activité (5)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| activities-positive | Majeure | Particulière | Force | Les 3 activités sont bénéficiaires | Bénéfice net positif pour chacune : 5 113 $, 1 019 $, 168 $. |
| activity-low-act_sauces | Moyenne | Particulière | Faiblesse | Sauces et accompagnements : marge nette de 1,3 % | 168 $ de bénéfice net sur 12 447 $ de revenus. |
| cell-deficit-act_sauces-channel_gs | Moyenne | Particulière | Faiblesse | Sauces et accompagnements en Grandes surfaces : perd de l'argent | Bénéfice net de -393 $ (-5,9 % de marge nette). |
| cell-deficit-act_soupes-channel_gs | Moyenne | Particulière | Faiblesse | Soupes et potages en Grandes surfaces : perd de l'argent | Bénéfice net de -187 $ (-1,6 % de marge nette). |
| activity-best-hour | Mineure | Particulière | Force | Mets principaux surgelés : l'activité la plus rentable à l'heure | 164 $ de bénéfice brut par heure, contre 41 $ pour Soupes et potages. |

### Chapitre 5 · Ingrédients (5)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| supplier-ing | Majeure | Particulière | Faiblesse | Boucherie Nordique : 50 % des achats d'ingrédients | Une dépendance à un seul fournisseur. |
| history-price-effect | Moyenne | Particulière | Force | Les baisses de prix font économiser 918 $ sur vos achats d'ingrédients | Aux volumes prévus, sur les 3 derniers relevés (4,8 % des achats). |
| volatile-a-ing | Moyenne | Particulière | Faiblesse | 4 ingrédients de classe A à prix volatil | Bœuf haché mi-maigre (22 %), Poitrine de poulet désossée (12 %), Filet de saumon surgelé IQF (25 %), 1 autre : amplitudes de prix sur 19 relevés. |
| loss-high | Moyenne | Particulière | Faiblesse | Perte stock prévue : 819 $ (4,1 % des achats) | La plus coûteuse : Bœuf haché mi-maigre, 459 $. |
| inputs-top5 | Mineure | Particulière | Faiblesse | Cinq ingrédients pèsent 74 % de vos achats | Sur 18 ingrédients : surveillez en priorité Bœuf haché mi-maigre, Poitrine de poulet désossée, Filet de saumon surgelé IQF, Crème 35 %, Riz basmati. |

### Chapitre 5 · Emballages (2)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| supplier-pkg | Majeure | Particulière | Faiblesse | Emballages Boréal : 80 % des achats d'emballages | Une dépendance à un seul fournisseur. |
| stable-a-pkg | Mineure | Particulière | Force | Les emballages de classe A ont des prix stables | Aucun des 4 éléments de classe A n'a un prix volatil. |

### Chapitre 6 · Main-d'œuvre (6)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| product-best-hour | Moyenne | Particulière | Force | « Pâté chinois traditionnel (340 g) » : le meilleur usage du temps | 256 $ de bénéfice brut par heure de main-d'œuvre (moyenne : 87 $). |
| labor-growth | Moyenne | Particulière | Force | Marge de croissance : 32 h libres | Environ 6 500 $ de ventes de plus possibles sans embauche (estimation). |
| hours-vs-profit | Moyenne | Particulière | Faiblesse | « Soupe-repas aux légumes et poulet » : 41 % des heures, 20 % du bénéfice brut | Un produit qui occupe beaucoup de temps pour peu de profit : à repenser (prix, recette, processus). |
| post-state-Contrôleur qualité | Mineure | Particulière | Force | Contrôleur qualité : 88 % d'utilisation | Poste de production bien occupé. |
| post-state-Cuisinier de production | Mineure | Particulière | Force | Cuisinier de production : 92 % d'utilisation | Poste de production bien occupé. |
| post-state-Opérateur d'emballage | Mineure | Particulière | Force | Opérateur d'emballage : 90 % d'utilisation | Poste de production bien occupé. |

## Chapitre 7 · Constats de chaque fiche produit

### Purée de pommes de terre maison (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-class-fmt_sub_puree | Mineure | Particulière | Faiblesse | « Purée de pommes de terre maison » : un poids mort | Peu populaire et peu rentable : à repenser ou à retirer. |
| sku-positive-fmt_sub_puree | Mineure | Particulière | Force | « Purée de pommes de terre maison » est rentable dans tous ses canaux | Marge nette de 7,3 % à 30,8 %. |
| sku-hour-fmt_sub_puree | Mineure | Particulière | Force | « Purée de pommes de terre maison » : un bon usage du temps | 182 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Pâté chinois traditionnel (340 g) (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-positive-fmt_pate_s | Mineure | Particulière | Force | « Pâté chinois traditionnel (340 g) » est rentable dans tous ses canaux | Marge nette de 12,0 % à 34,4 %. |
| sku-class-fmt_pate_s | Mineure | Particulière | Faiblesse | « Pâté chinois traditionnel (340 g) » : une vache à lait | Très vendu, mais peu rentable : à optimiser. |
| sku-hour-fmt_pate_s | Mineure | Particulière | Force | « Pâté chinois traditionnel (340 g) » : un bon usage du temps | 256 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Pâté chinois traditionnel (900 g) (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-positive-fmt_pate_f | Mineure | Particulière | Force | « Pâté chinois traditionnel (900 g) » est rentable dans tous ses canaux | Marge nette de 2,7 % à 27,5 %. |
| sku-class-fmt_pate_f | Mineure | Particulière | Faiblesse | « Pâté chinois traditionnel (900 g) » : un dilemme | Rentable, mais peu vendu : à promouvoir ou à abandonner. |
| sku-hour-fmt_pate_f | Mineure | Particulière | Force | « Pâté chinois traditionnel (900 g) » : un bon usage du temps | 183 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Poulet général Tao, riz et légumes (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-class-fmt_tao | Moyenne | Particulière | Force | « Poulet général Tao, riz et légumes » : une étoile | Très populaire et très rentable : à protéger. |
| sku-positive-fmt_tao | Mineure | Particulière | Force | « Poulet général Tao, riz et légumes » est rentable dans tous ses canaux | Marge nette de 14,5 % à 36,2 %. |
| sku-hour-fmt_tao | Mineure | Particulière | Force | « Poulet général Tao, riz et légumes » : un bon usage du temps | 128 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Saumon teriyaki, riz et légumes (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-class-fmt_saumon | Moyenne | Particulière | Force | « Saumon teriyaki, riz et légumes » : une étoile | Très populaire et très rentable : à protéger. |
| sku-over-cost-fmt_saumon | Moyenne | Particulière | Faiblesse | « Saumon teriyaki, riz et légumes » : coût matière au-dessus de la cible | 32,4 % contre une cible de 32 %. |
| sku-positive-fmt_saumon | Mineure | Particulière | Force | « Saumon teriyaki, riz et légumes » est rentable dans tous ses canaux | Marge nette de 1,7 % à 26,7 %. |
| sku-hour-fmt_saumon | Mineure | Particulière | Force | « Saumon teriyaki, riz et légumes » : un bon usage du temps | 159 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Sauté de poulet thaï, riz et légumes (350 g) (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-class-fmt_thai_s | Moyenne | Particulière | Force | « Sauté de poulet thaï, riz et légumes (350 g) » : une étoile | Très populaire et très rentable : à protéger. |
| sku-positive-fmt_thai_s | Mineure | Particulière | Force | « Sauté de poulet thaï, riz et légumes (350 g) » est rentable dans tous ses canaux | Marge nette de 22,6 % à 42,3 %. |
| format-gap-of-prod_thai | Mineure | Particulière | Faiblesse | Les formats d'un même produit n'ont pas la même marge | « Sauté de poulet thaï, riz et légumes (350 g) » à 27,4 % contre « Sauté de poulet thaï, riz et légumes (900 g) » à 4,0 %. |
| sku-hour-fmt_thai_s | Mineure | Particulière | Force | « Sauté de poulet thaï, riz et légumes (350 g) » : un bon usage du temps | 198 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Sauté de poulet thaï, riz et légumes (900 g) (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-loss-fmt_thai_f | Moyenne | Particulière | Faiblesse | « Sauté de poulet thaï, riz et légumes (900 g) » perd de l'argent dans 1 canal sur 3 | Grandes surfaces : -1,3 % |
| format-gap-of-prod_thai | Mineure | Particulière | Faiblesse | Les formats d'un même produit n'ont pas la même marge | « Sauté de poulet thaï, riz et légumes (350 g) » à 27,4 % contre « Sauté de poulet thaï, riz et légumes (900 g) » à 4,0 %. |
| sku-class-fmt_thai_f | Mineure | Particulière | Faiblesse | « Sauté de poulet thaï, riz et légumes (900 g) » : un dilemme | Rentable, mais peu vendu : à promouvoir ou à abandonner. |
| sku-hour-fmt_thai_f | Mineure | Particulière | Force | « Sauté de poulet thaï, riz et légumes (900 g) » : un bon usage du temps | 241 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Chili con carne mijoté (4)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-over-cost-fmt_chili | Moyenne | Particulière | Faiblesse | « Chili con carne mijoté » : coût matière au-dessus de la cible | 34,9 % contre une cible de 32 %. |
| sku-loss-fmt_chili | Moyenne | Particulière | Faiblesse | « Chili con carne mijoté » perd de l'argent dans 2 canaux sur 3 | Épiceries indépendantes : -0,8 % · Grandes surfaces : -9,6 % |
| sku-class-fmt_chili | Mineure | Particulière | Faiblesse | « Chili con carne mijoté » : une vache à lait | Très vendu, mais peu rentable : à optimiser. |
| sku-hour-fmt_chili | Mineure | Particulière | Force | « Chili con carne mijoté » : un bon usage du temps | 117 $ de bénéfice brut par heure, contre 87 $ en moyenne. |

### Soupe-repas aux légumes et poulet (2)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-positive-fmt_soupe | Mineure | Particulière | Force | « Soupe-repas aux légumes et poulet » est rentable dans tous ses canaux | Marge nette de 0,8 % à 26,0 %. |
| sku-class-fmt_soupe | Mineure | Particulière | Faiblesse | « Soupe-repas aux légumes et poulet » : une vache à lait | Très vendu, mais peu rentable : à optimiser. |

### Potage à la courge musquée (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-over-cost-fmt_potage | Moyenne | Particulière | Faiblesse | « Potage à la courge musquée » : coût matière au-dessus de la cible | 39,6 % contre une cible de 32 %. |
| sku-loss-fmt_potage | Moyenne | Particulière | Faiblesse | « Potage à la courge musquée » perd de l'argent dans 1 canal sur 3 | Grandes surfaces : -7,0 % |
| sku-class-fmt_potage | Mineure | Particulière | Faiblesse | « Potage à la courge musquée » : une vache à lait | Très vendu, mais peu rentable : à optimiser. |

### Sauce à spaghetti maison (2)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-loss-fmt_sauce_spag | Moyenne | Particulière | Faiblesse | « Sauce à spaghetti maison » perd de l'argent dans 2 canaux sur 3 | Épiceries indépendantes : -6,4 % · Grandes surfaces : -15,7 % |
| sku-class-fmt_sauce_spag | Mineure | Particulière | Faiblesse | « Sauce à spaghetti maison » : un poids mort | Peu populaire et peu rentable : à repenser ou à retirer. |

### Sauce artisanale du Terroir (3)

| Identifiant | Gravité | Portée | Ton | Titre | Détail |
|---|---|---|---|---|---|
| sku-over-cost-fmt_sauce_terroir | Moyenne | Particulière | Faiblesse | « Sauce artisanale du Terroir » : coût matière au-dessus de la cible | 58,4 % contre une cible de 32 %. |
| sku-loss-fmt_sauce_terroir | Moyenne | Particulière | Faiblesse | « Sauce artisanale du Terroir » perd de l'argent dans 1 canal sur 3 | Grandes surfaces : -4,2 % |
| sku-class-fmt_sauce_terroir | Mineure | Particulière | Faiblesse | « Sauce artisanale du Terroir » : une vache à lait | Très vendu, mais peu rentable : à optimiser. |

## Contrôle

- Constats rangés dans la revue : **91** sur 100 (dont 38 dans les fiches produits).
- **9 constats écartés volontairement** : un doublon d'un autre constat (même texte), ou une version par entité moins utile que la version agrégée qui nomme déjà les éléments. Ils ne s'affichent ni dans l'application ni dans le rapport : supplier-dep-ing-Boucherie Nordique, volatile-item-ing-Bœuf haché mi-maigre, volatile-item-ing-Filet de saumon surgelé IQF, volatile-item-ing-Poitrine de poulet désossée, volatile-item-ing-Riz basmati, supplier-dep-pkg-Emballages Boréal, loss-item-ing_boeuf, loss-item-ing_poulet, post-used.

## Phrases « Ce que cela veut dire »

Ces phrases du rapport sont produites par des règles fixes à partir des chiffres du projet (`engine/reportReadings.js`). Elles sont à relire comme les constats.

### Réel contre modèle (3)

- Les revenus réels sont alignés sur le modèle (+0,4 %).
- Les charges directes réelles sont au-dessus du modèle de 2 644 $ (+5,8 %) : pertes, rendements ou prix payés plus élevés que prévu, à vérifier.
- Le bénéfice net réel (4 000 $) est sous le modèle de 2 299 $ ; l'écart vient surtout des charges directes.

### Évolution (3)

- La marge brute a culminé à 46,0 % (Relevé janvier 2026) et touché son creux à 41,5 % (Relevé août 2026).
- Depuis son creux, elle remonte de 1,6 point.
- Elle est 2,1 points sous son niveau d'il y a 12 mois.

### Activité × canal (1)

- 2 combinaisons activité × canal perdent de l'argent, pour 580 $ en tout : Soupes et potages en Grandes surfaces (-187 $), Sauces et accompagnements en Grandes surfaces (-393 $).

### Main-d'œuvre (3)

- 22 % de la paie (2 411 $ sur 11 058 $) rémunère du temps qui n'est pas utilisé à produire.
- Une heure réellement productive coûte 32,11 $, contre un taux moyen payé de 25,78 $ l'heure.
- Les 32 heures libres des postes de production pourraient rapporter environ 2 800 $ de bénéfice brut de plus (estimation, à 87,39 $ de bénéfice brut par heure).
