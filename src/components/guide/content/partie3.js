import { fromApp } from '../guideFormat.js';
import { DEMO, DEMO_RAPPORT } from '../guideNumbers.js';

// Partie 3 — Lire vos résultats et décider (onglet Rapport et suivi).
// Chiffres : projet démo (voir guideNumbers.js, vérifiés par e2e/guide-demo-numbers.spec.js).

const d = fromApp;
const S = DEMO_RAPPORT.bySkuDetail;
const A = DEMO_RAPPORT.activites;
const C = DEMO_RAPPORT.canaux;

export const partie3 = {
    id: 'guide-partie-3',
    title: 'Partie 3 — Lire vos résultats et décider',
    lead: 'Les rapports transforment vos données en réponses. Cette partie explique comment les lire, et surtout quoi en faire.',
    chapters: [
        // =====================================================================================
        {
            id: 'guide-rapport-apercu',
            title: 'L\'onglet Rapport et suivi : vue générale',
            blocks: [
                { type: 'callout', kind: 'pourquoi', text: 'Tout ce que vous avez saisi converge ici. Cet onglet répond aux questions qui comptent : mes produits sont-ils rentables ? Dans quel canal gagne-t-on, dans lequel perd-on ? Quelle hausse de coûts m\'est supportable ? Mes décisions ont-elles porté leurs fruits depuis six mois ?' },
                { type: 'p', text: 'En haut, trois boutons : {{Exporter vers Excel}}, {{Générer un rapport PDF}} et {{Point de référence}} (voir [[guide-points-reference|plus bas]]). Dessous, neuf sous-onglets, en quatre groupes séparés par un trait :' },
                {
                    type: 'table', head: ['Sous-onglet', 'Question à laquelle il répond'], wrapCells: true, rows: [
                        ['{{Vue d\'ensemble}}', 'Comment va mon entreprise, et mes résultats réels suivent-ils mon modèle ?'],
                        ['{{Portefeuille}}', 'Quels produits sont stratégiques, lesquels rapportent le plus, où perd-on ?'],
                        ['{{Par SKU}}', 'Comment un produit se comporte-t-il dans chacun de ses canaux ?'],
                        ['{{Par Activité}}', 'Quelle ligne de production est rentable ?'],
                        ['{{Par Canal}}', 'Quel circuit de vente est rentable ?'],
                        ['{{Ingrédients}} et {{Emballages}}', 'Où va mon argent d\'achat, combien dois-je acheter, quels prix bougent ?'],
                        ['{{Main-d\'œuvre}}', 'Mon équipe est-elle bien utilisée, et où part son temps ?'],
                        ['{{Simulation}}', 'Et si mes coûts augmentaient de 8 % ?'],
                    ],
                },
                { type: 'h', id: 'guide-rapport-verifications', text: 'Le panneau « points à vérifier »' },
                { type: 'p', text: 'Un rapport n\'est fiable que si les données dont il dépend sont complètes. Quand l\'application repère un problème qui fausse les résultats, un bandeau ambre apparaît en haut de l\'onglet ; il disparaît quand tout est cohérent. Cliquez dessus pour le déplier : chaque point comporte un lien {{Corriger dans…}} qui vous amène à l\'onglet concerné.' },
                {
                    type: 'ul', items: [
                        'Des **produits sans nom**.',
                        'Des **formats actifs sans prix de vente** : leurs marges ne peuvent pas être calculées.',
                        'Un **répartition des ventes** qui ne totalise pas 100 % (ou qui n\'est pas renseigné) : les moyennes pondérées sont faussées.',
                        'Des **ingrédients ou des emballages sans prix d\'achat**.',
                        'Des **prix non mis à jour depuis plus de 30 jours**.',
                        'Des **lignes de recette orphelines** : un ingrédient, un emballage ou une sous-recette supprimé alors qu\'une recette l\'utilisait encore. La ligne est comptée à 0 $, ce qui fait baisser le coût sans bruit.',
                        'Une **unité d\'une autre famille** que celle de l\'ingrédient (des grammes pour un ingrédient acheté au litre) : l\'application suppose alors une densité de 1.',
                        'Un **pourcentage de perte de 100 % ou plus**, ignoré dans le calcul.',
                        'Un format **rattaché deux fois au même canal**, ou à un canal supprimé, et un produit lié à une **activité qui n\'existe plus**.',
                        'Une **quantité de format nulle**, remplacée par 1 dans certains calculs.',
                        'Un format **sans quantité produite par lot** (le coût du lot entier serait attribué à une seule portion), ou une **quantité négative** dans une recette.',
                        'Une **boucle de sous-recettes** (A utilise B qui utilise A) : le coût de ces recettes n\'est pas défini.',
                        'Un format **vendu à un prix net de 0 $** (compté comme offert, à confirmer) ou **sans aucun volume vendu** (aucun frais fixe ne lui est réparti : son coût complet est incomplet).',
                        'Des **points de référence anciens**, enregistrés sans le détail par canal : leur point mort est approximatif.',
                        'Des **frais fixes non répartis**, ou répartis en trop.',
                    ],
                },
                { type: 'p', text: 'Pour éviter ces erreurs à la source, l\'application demande une confirmation avant de supprimer un ingrédient, un emballage ou une sous-recette utilisé ailleurs, déplace les produits d\'une activité supprimée vers une autre, retire d\'un canal supprimé ses prix et ses volumes, et ne propose plus un canal déjà utilisé par le même format. Une copie de produit ou de format repart sans volumes de vente, pour ne pas compter les ventes deux fois.' },
                { type: 'callout', kind: 'astuce', text: 'Prenez l\'habitude d\'ouvrir cet onglet par le panneau : s\'il est présent, corrigez avant d\'interpréter quoi que ce soit.' },
                { type: 'callout', kind: 'retenir', text: 'Six sous-onglets, six questions. Un bandeau ambre signale les données à corriger avant de se fier aux chiffres.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-vue-ensemble',
            title: 'Vue d\'ensemble',
            blocks: [
                { type: 'h', id: 'guide-rapport-kpi', text: 'Indicateurs clés de rentabilité' },
                { type: 'p', text: 'Six tuiles résument vos produits :' },
                {
                    type: 'table', head: ['Tuile', 'Ce qu\'elle mesure', 'Projet démo'], wrapCells: true, rowIds: ['guide-kpi-matiere', 'guide-kpi-emballage', 'guide-kpi-mo', 'guide-kpi-marge-brute', 'guide-kpi-point-mort', 'guide-kpi-marge-securite'], rows: [
                        ['{{Coût Matière Moyen Pondéré}}', 'La part du prix de vente que représente, en moyenne, le coût matière de tous vos produits.', d(DEMO.apercu.coutMatiere)],
                        ['{{Coût Emballage Moyen Pondéré}}', 'Idem pour l\'emballage.', d(DEMO.apercu.coutEmballage)],
                        ['{{Coût Main-d\'œuvre Moyen Pondéré}}', 'Idem pour la main-d\'œuvre.', d(DEMO.apercu.coutMO)],
                        ['{{Marge Brute Moyenne Pondérée}}', 'La marge brute moyenne des produits actifs.', d(DEMO.apercu.margeBrute)],
                        ['{{Point Mort des Produits Actifs}}', 'Le chiffre d\'affaires que les produits actifs doivent générer pour couvrir l\'ensemble des frais fixes et de la main-d\'œuvre directe qui lui sont alloués.', d(DEMO.apercu.pointMortMenu)],
                        ['{{Marge de sécurité}}', 'De combien vos ventes prévues peuvent baisser avant d\'atteindre le point mort : (ventes prévues − point mort) ÷ ventes prévues.', d(DEMO.apercu.margeSecurite)],
                    ],
                },
                { type: 'p', text: 'Les trois premières tuiles affichent un voyant de comparaison à vos objectifs (coche verte ou triangle rouge). Ces moyennes sont **pondérées par le revenu** de chaque produit : un produit qui génère beaucoup de ventes pèse davantage (voir [[guide-concept-mix|chapitre 9]]). Elles reposent sur la vue « tous canaux » de chaque produit : le prix net de chaque canal, pondéré par son volume.' },
                { type: 'callout', kind: 'astuce', text: `Les trois ratios de coûts et la marge brute ne totalisent pas tout à fait 100 % : ici ${d(DEMO.apercu.coutMatiere)} + ${d(DEMO.apercu.coutEmballage)} + ${d(DEMO.apercu.coutMO)} + ${d(DEMO.apercu.margeBrute)} = 98,08 %. La différence de 1,92 % est la part de la sous-traitance, un coût direct qui n'a pas sa propre tuile.` },
                { type: 'callout', kind: 'attention', text: 'Le point mort des produits actifs est un chiffre d\'affaires (en dollars), pas un nombre d\'unités : des produits très différents n\'ont pas d\'unité commune. Comparez-le à votre chiffre d\'affaires réel de la période : s\'il lui est supérieur, vous perdez de l\'argent en moyenne.' },
                { type: 'p', text: 'La {{marge de sécurité}} répond à une question simple : **de combien mes ventes peuvent-elles baisser avant que je perde de l\'argent ?** À 20 %, vos ventes prévues peuvent reculer d\'un cinquième avant d\'atteindre le point mort. Une marge négative signifie que les ventes prévues sont déjà sous le point mort.' },
                { type: 'callout', kind: 'pourquoi', text: 'C\'est l\'indicateur à consulter avant de vous engager dans une dépense fixe (loyer, équipement, embauche) : plus la marge de sécurité est mince, moins vous avez de place pour une mauvaise surprise. Le point mort donne la cible en dollars ; la marge de sécurité dit à quelle distance vous en êtes.' },
                { type: 'callout', kind: 'attention', text: 'La marge de sécurité repose sur les ventes **prévues** (prix net × volumes saisis dans Produits et SKUs), pas sur vos revenus réels, et sur le même point mort que la tuile voisine (main-d\'œuvre directe traitée comme un coût fixe). Elle reste vide (—) sans ventes prévues.' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo : ventes prévues de ${d(DEMO.etat.revenusTheorique)}, point mort de ${d(DEMO.apercu.pointMortMenu)} : la marge de sécurité est de ${d(DEMO.apercu.margeSecurite)}.` },

                { type: 'h', id: 'guide-rapport-constats', text: 'Constats clés' },
                { type: 'p', text: 'Sous les tuiles, les {{constats clés}} disent ce que vos chiffres révèlent de votre entreprise, en **forces** (ce qui va bien) et en **faiblesses** (ce qui mérite votre attention). Ils ne viennent pas d\'une intelligence artificielle : ce sont des règles fixes, appliquées à vos données, avec un chiffre et un lien vers l\'endroit où agir. Cinq constats au plus s\'affichent par colonne, les plus importants d\'abord ; {{Voir tous les constats}} ouvre une fenêtre qui les montre tous, regroupés par thème.' },
                {
                    type: 'ul', items: [
                        { label: 'Rentabilité et coûts.', text: 'La marge de sécurité, le bénéfice net prévu, les coûts comparés à vos cibles, et les produits qui dépassent la cible de coût matière.' },
                        { label: 'Produits, canaux et activités.', text: 'Les produits qui perdent de l\'argent dans un canal, ceux qui sont rentables partout, les étoiles et les poids morts, la dépendance à un canal, l\'activité déficitaire ou à très faible marge.' },
                        { label: 'Approvisionnement.', text: 'La dépendance à un fournisseur, les ingrédients de classe A à prix volatil, la perte stock prévue.' },
                        { label: 'Main-d\'œuvre.', text: 'La paie non utilisée, le produit qui rapporte le plus (ou le moins) à l\'heure, la marge de croissance.' },
                        { label: 'Réel et évolution.', text: 'L\'écart entre votre résultat réel et le modèle, et la variation de la marge brute et du coût matière depuis votre premier point de référence.' },
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'Un constat n\'apparaît que si la donnée existe : sans cible saisie dans Paramètres, aucun constat sur les cibles ; sans chiffres réels dans l\'État des résultats, aucun constat sur l\'écart réel / théorique ; sans au moins deux points de référence, aucun constat sur l\'évolution. Les problèmes de données (un produit sans prix, par exemple) ne sont pas des constats : ils restent dans le panneau « points à vérifier ».' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, la marge de sécurité de ${d(DEMO.apercu.margeSecurite)} est une force, alors que la dépendance aux Grandes surfaces (58 % des revenus, 15 % du bénéfice net) est une faiblesse.` },
                { type: 'callout', kind: 'retenir', text: 'Une force et une faiblesse peuvent concerner le même produit sans se contredire : le Pâté chinois (340 g) rapporte beaucoup à l\'heure de main-d\'œuvre (force), mais c\'est aussi une vache à lait, très vendu pour une marge unitaire modeste (faiblesse). Ce sont deux angles différents.' },

                { type: 'h', id: 'guide-rapport-evolution', text: 'Évolution des marges et coûts moyens' },
                { type: 'p', text: 'Un graphique montre l\'évolution de vos coûts moyens (matière, emballage, main-d\'œuvre) et de votre marge brute moyenne, d\'un point de référence à l\'autre. Chaque point est calculé comme les tuiles ci-dessus : une moyenne pondérée par le revenu de chaque produit à cette date, de sorte que le dernier point du graphique correspond à la tuile. Il sert à vérifier si vos décisions portent leurs fruits : un changement de fournisseur a-t-il fait baisser le coût matière ? Une hausse de prix a-t-elle amélioré la marge ? Le graphique est vide tant qu\'aucun point de référence n\'existe. Les 15 points les plus récents sont affichés par défaut ; la gestion des points permet de choisir lesquels alimentent les graphiques.' },


                { type: 'h', id: 'guide-rapport-matrices', text: 'Bénéfices / pertes des activités par canaux' },
                { type: 'p', text: 'Ce tableau croise vos activités de production avec vos canaux de vente : le bénéfice net, ou la perte, de chaque activité dans chacun de ses canaux, avec une ligne et une colonne {{Total}}. Un « — » signifie qu\'il n\'y a aucune vente dans ce canal : jamais un zéro inventé. Des codes de couleur permettent de repérer d\'un coup d\'œil les combinaisons qui font gagner ou perdre de l\'argent.' },
                { type: 'callout', kind: 'pourquoi', text: 'Cette matrice montre où se cachent vos pertes. Une activité globalement rentable peut perdre de l\'argent dans un canal précis ; un canal qui fait beaucoup de chiffre d\'affaires peut ne rien rapporter.' },

                { type: 'h', id: 'guide-ff-reconciliation', text: 'Réconciliation réel / théorique' },
                { type: 'p', text: 'Compare, pour l\'entreprise entière, vos revenus et vos charges directes réels (saisis plus haut) à ce que prévoit votre modèle de recettes : le prix net et le volume réel saisis par canal pour chaque format (Paramètres → Produits et SKUs), multipliés par les coûts de vos recettes. Ce n\'est jamais un chiffre d\'affaires global déclaré.' },
                { type: 'p', text: 'Pourquoi : un grand écart signale que le modèle ne reflète plus la réalité comptable. Les causes habituelles : des prix, des volumes ou des coûts de recette à mettre à jour, ou des ventes réelles dont le volume n\'a pas encore été saisi par canal. C\'est la même logique que le rapport de productivité de l\'onglet Main-d\'œuvre (heures attendues contre heures réelles).' },
                {
                    type: 'table', caption: 'Réconciliation du projet démo', head: ['Poste', 'Réel', 'Théorique', 'Écart'], rows: [
                        ['Revenus', d(DEMO.etat.revenus), d(DEMO.etat.revenusTheorique), '+286,41 $ (+0,4 %)'],
                        ['Charges directes', d(DEMO.etat.chargesDirectes), d(DEMO.etat.chargesDirectesTheorique), '+2 643,65 $ (+5,8 %)'],
                        ['Bénéfice brut', d(DEMO.etat.beneficeBrut), d(DEMO.etat.beneficeBrutTheorique), '-2 357,24 $ (-6,9 %)'],
                        ['Bénéfice net', d(DEMO.etat.beneficeNet), d(DEMO.etat.beneficeNetTheorique), '-2 299,48 $ (-36,5 %)'],
                    ],
                },
                {
                    type: 'table', caption: 'Les colonnes de la réconciliation', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
                    rowIds: ['guide-ff-rec-poste', 'guide-ff-rec-reel', 'guide-ff-rec-theorique', 'guide-ff-rec-ecart', 'guide-ff-rec-ecart-pct'],
                    rows: [
                        ['{{Poste}}', 'Revenus, charges directes, bénéfice brut et bénéfice net. Le bénéfice brut est les revenus moins les charges directes ; le bénéfice net est le bénéfice brut moins le total des frais fixes (ce total, unique, est soustrait identiquement du réel et du théorique).'],
                        ['{{Réel ($)}}', 'Le montant tel que saisi dans l\'État des résultats.'],
                        ['{{Théorique ($)}}', 'Le montant que prédit votre modèle de recettes : le prix net et le volume réel par canal de chaque format, multipliés par leurs coûts. Une estimation fondée sur vos hypothèses, pas une donnée réelle.'],
                        ['{{Écart ($)}}', 'Réel moins théorique. Positif : votre résultat réel dépasse ce que le modèle prévoyait. Négatif : il est en dessous.'],
                        ['{{Écart (%)}}', 'Le même écart, exprimé en pourcentage du théorique, pour comparer l\'ampleur des écarts d\'une ligne à l\'autre.'],
                    ],
                },
                { type: 'p', text: 'Lecture : le réel dépasse légèrement le théorique pour les revenus (+0,4 %), mais les charges directes réelles dépassent aussi celles du modèle (+5,8 %) : le bénéfice net réel (4 000,00 $) est inférieur de 36,5 % à celui du modèle (6 299,48 $). Un écart de charges directes de cet ordre signale en général des coûts que les recettes ne voient pas (rebuts, gaspillage, prix d\'achat plus élevés que ceux saisis). Regardez d\'abord les écarts en dollars : le pourcentage du bénéfice net est amplifié parce que ce bénéfice est une petite différence entre de grands montants.' },
                { type: 'p', text: 'La comparaison se fait toujours à l\'échelle de l\'entreprise, jamais par activité ou par canal, parce que le détail serait en partie circulaire. Bénéfice brut = revenus moins charges directes ; bénéfice net = bénéfice brut moins le total des frais fixes (sous-total du tableau des dépenses). Ce total est soustrait identiquement du réel et du théorique : l\'écart entre les deux colonnes vient donc du bénéfice brut, auquel s\'ajoute seulement, côté théorique, le coût de vieillissement de vos produits (une charge financière qui n\'existe pas dans les charges directes réelles).' },

                { type: 'callout', kind: 'retenir', text: 'Lisez dans cet ordre : les tuiles (santé générale), l\'évolution (la tendance), la matrice Activité × Canal (où l\'on perd), puis la réconciliation (le modèle reflète-t-il la réalité ?). Pour l\'analyse produit par produit, passez au {{Portefeuille}}.' },
                { type: 'words', items: [
                    { term: 'Marge brute moyenne pondérée', def: 'la marge brute moyenne des produits actifs, chaque produit pesant selon son revenu.' },
                    { term: 'Réconciliation', def: 'la comparaison entre le réel (État des résultats) et le théorique (modèle de recettes).' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-portefeuille',
            title: 'Portefeuille : l\'ensemble de vos produits',
            blocks: [
                { type: 'callout', kind: 'pourquoi', text: 'Le sous-onglet {{Portefeuille}} regroupe les analyses qui portent sur **tous vos produits à la fois** : lesquels sont stratégiques, lesquels rapportent le plus, et dans quels canaux chacun gagne ou perd.' },
                { type: 'h', id: 'guide-rapport-bcg', text: 'La matrice stratégique des produits' },
                { type: 'p', text: 'La matrice classe chaque produit en croisant sa popularité et sa rentabilité (voir [[guide-concept-menu|chapitre 12]]). Le sélecteur {{Analyse BCG pour :}} permet de la calculer pour tous les canaux (pondéré par volume), ou pour un canal à la fois : un produit peut être une étoile dans un canal et un poids mort dans un autre. Chaque ligne indique la popularité du produit et sa marge brute par unité.' },
                { type: 'p', text: 'La matrice se lit comme un tableau de quatre cases : la **popularité** en colonnes (élevée à gauche, faible à droite) et la **rentabilité** en lignes (élevée en haut, faible en bas).' },
                {
                    type: 'table', caption: 'Matrice du projet démo (tous canaux)', head: ['Catégorie', 'Produits'], wrapCells: true, rows: [
                        ['**Étoiles**', 'Poulet général Tao (9,1 % des ventes, marge 3,28 $) ; Saumon teriyaki (6,5 %, 4,24 $) ; Sauté de poulet thaï 350 g (7,1 %, 3,58 $)'],
                        ['**Dilemmes**', 'Pâté chinois 900 g (4,0 %, 6,51 $) ; Sauté de poulet thaï 900 g (3,6 %, 6,38 $)'],
                        ['**Vaches à lait**', 'Soupe-repas aux légumes et poulet (21,6 %, 2,55 $) ; Chili con carne mijoté (10,7 %, 2,10 $) ; Pâté chinois 340 g (9,1 %, 3,10 $) ; Potage à la courge musquée (7,8 %, 2,97 $) ; Sauce artisanale du Terroir (13,7 %, 2,84 $)'],
                        ['**Poids morts**', 'Purée de pommes de terre (4,3 %, 1,81 $) ; Sauce à spaghetti maison (2,6 %, 2,31 $)'],
                    ],
                },
                { type: 'p', text: 'Comment en tirer des actions :' },
                {
                    type: 'ul', itemIds: ['guide-bcg-etoiles', 'guide-bcg-vaches', 'guide-bcg-dilemmes', 'guide-bcg-poids-morts'], items: [
                        { label: 'Étoiles.', text: 'Protégez-les : qualité constante, bonne visibilité, approvisionnement sécurisé. Surveillez le prix de leurs ingrédients de catégorie A.' },
                        { label: 'Vaches à lait.', text: 'La soupe-repas est le produit actif le plus vendu (21,6 %), mais ne rapporte que 2,55 $ par unité en moyenne. Deux leviers : réduire son coût (recette, fournisseur, rendement) ou relever légèrement son prix, en vérifiant l\'effet avec la simulation de prix de l\'onglet Production.' },
                        { label: 'Dilemmes.', text: 'Ils rapportent beaucoup par unité mais se vendent peu : travaillez leur présentation, leur promotion, leur place dans les canaux. Un produit rentable qu\'on ne vend pas ne fait gagner personne.' },
                        { label: 'Poids morts.', text: 'La purée de pommes de terre ne rapporte que 1,81 $ par unité et se vend peu : réinventez-la (prix, recette) ou retirez-la. La sauce à spaghetti maison (2,6 %, 2,31 $) est dans le même cas. Avant de retirer un produit, vérifiez qu\'il n\'est pas l\'ingrédient d\'une autre recette : l\'application vous préviendrait avant la suppression.' },
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'La marge utilisée ici est la marge **brute** en dollars par unité, avant les frais fixes. Un produit « rentable » dans la matrice peut quand même avoir une marge nette négative dans un canal coûteux : confirmez toujours dans le rapport Par SKU.' },

                { type: 'h', id: 'guide-rapport-contribution', text: 'Classement par contribution totale au profit' },
                { type: 'p', text: 'Ce graphique à barres classe vos produits non par leur pourcentage de marge, mais par le **montant total en dollars** qu\'ils génèrent pour payer vos frais fixes : marge brute par unité × unités vendues. Il révèle vos véritables piliers financiers : un produit à 20 % de marge qui se vend en très grandes quantités peut peser plus qu\'un produit à 50 % qui se vend peu. Le nombre de produits affichés se règle en bas du graphique ({{Items par page}}, boutons {{Précédent}} et {{Suivant}}).' },

                { type: 'h', id: 'guide-rapport-matrice-sku', text: 'Marges nettes des SKUs par canaux' },
                { type: 'p', text: 'Ce tableau donne la marge nette, en % du prix de vente, de chaque produit dans chacun de ses canaux. Le bouton {{Éditer le produit}} d\'une ligne ouvre la fiche du produit dans l\'onglet Production. Un « — » signifie que ce produit n\'est pas vendu dans ce canal : jamais un zéro inventé. Des codes de couleur permettent de repérer d\'un coup d\'œil les combinaisons qui font gagner ou perdre de l\'argent.' },
                { type: 'callout', kind: 'pourquoi', text: 'Un produit peut être rentable dans un canal et perdre de l\'argent dans un autre. Cette matrice montre où se cachent vos pertes.' },
                { type: 'callout', kind: 'retenir', text: 'Lisez dans cet ordre : la matrice (quels produits sont stratégiques), la contribution (qui paie les frais fixes), les marges par canal (où l\'on perd).' },
                { type: 'words', items: [
                    { term: 'Contribution totale', def: 'marge brute par unité × unités vendues : l\'argent qu\'un produit apporte pour payer les frais fixes.' },
                ] },
            ],
        },


        // =====================================================================================
        {
            id: 'guide-rapport-par-sku',
            title: 'Par SKU : le détail d\'un produit dans chaque canal',
            blocks: [
                { type: 'p', text: 'Ce sous-onglet est le plus riche de l\'application. Choisissez un format dans la liste {{SKU :}} : en haut, quatre tuiles rappellent son coût de production (matière, emballage, main-d\'œuvre, total). Dessous, un tableau suit **le même produit dans chacun de ses canaux de vente**, section par section.' },
                {
                    type: 'table', head: ['Section', 'Ce qu\'elle montre'], wrapCells: true, rows: [
                        ['{{PDS et frais de mise en marché}}', 'Le prix de détail suggéré, puis la part prélevée par chaque maillon du canal, en dollars, et le total des frais de mise en marché par unité.'],
                        ['{{Marge brute}}', 'Le prix de vente net, le bénéfice brut (prix moins coûts directs) et la marge brute en %.'],
                        ['{{Répartition des charges fixes}}', 'Les frais fixes par unité, en trois parts : Général (toute l\'entreprise), Activité (la ligne de production du produit) et Canal (propre à chaque canal), puis leur total.'],
                        ['{{Coût net et marge nette}}', 'Le coût de revient complet par unité, le bénéfice net et la marge nette en %.'],
                        ['{{Seuil de rentabilité par canal de vente}}', 'Le revenu total du canal, les frais totaux, le bénéfice ou la perte, et le point mort en unités.'],
                    ],
                },
                { type: 'h', id: 'guide-sku-lignes', text: 'Les lignes du tableau, une par une', level: 5 },
                {
                    type: 'dl', items: [
                        { id: 'guide-sku-ligne-cout-production', term: 'Coût de production (total)', def: 'Matière + emballage + main-d\'œuvre + sous-traitance, avant tout frais indirect. Il ne varie jamais d\'un canal à l\'autre : c\'est le même produit, fabriqué de la même façon.' },
                        { id: 'guide-sku-ligne-pds', term: 'PDS', def: 'Le prix de détail suggéré au consommateur pour ce format. Une seule valeur, la même pour tous les canaux (saisie dans Paramètres → Produits et SKUs).' },
                        { id: 'guide-sku-ligne-maillons', term: 'Une ligne par maillon (distributeur, détaillant…)', def: 'La marge ou la majoration de ce maillon, en dollars, pour ce canal : une partie de l\'écart entre le PDS et le prix net qui vous revient. Elle est calculée à partir de la cascade de maillons du canal, pas du prix net réellement saisi. Un « — » signifie que ce canal ne passe pas par ce maillon, ou que le PDS n\'est pas saisi pour ce format.' },
                        { id: 'guide-sku-ligne-frais-mise-marche', term: 'Frais de mise en marché totaux par unité', def: 'La somme de tous les maillons ci-dessus pour ce canal : le PDS moins le prix net que produirait la cascade de maillons du canal (bouton Générer de Produits et SKUs), jamais le prix net réellement saisi.' },
                        { id: 'guide-sku-ligne-prix-vente', term: 'Prix de vente', def: 'Le prix net de ce format dans ce canal : ce qui vous revient par unité.' },
                        { id: 'guide-sku-ligne-benefice-brut', term: 'Bénéfice brut', def: 'Prix net moins coût de production. Avant frais fixes.' },
                        { id: 'guide-sku-ligne-marge-brute', term: 'Marge brute', def: 'En % du prix de vente net de ce canal : (prix − coûts directs) ÷ prix.' },
                        { id: 'guide-sku-ligne-ff-general', term: 'Frais fixes — Général', def: 'La part du bassin « Général » (frais de structure, non rattachables à une activité ou à un canal précis : salaire de direction, assurances) attribuée à ce produit, selon la règle de répartition (CICI) choisie pour Général dans l\'État des résultats. Elle est la même quel que soit le canal.' },
                        { id: 'guide-sku-ligne-ff-activite', term: 'Frais fixes — Activité', def: 'La part du bassin de l\'activité de production de ce produit, selon la règle de répartition (CICI) choisie pour cette activité (coûts directs, temps de production ou volume physique). Elle aussi est la même pour tous les canaux.' },
                        { id: 'guide-sku-ligne-ff-canal', term: 'Frais fixes — Canal', def: 'La part du bassin propre au canal de cette colonne : elle varie d\'un canal à l\'autre, contrairement aux deux lignes précédentes. Il n\'y a pas de règle au choix ici : c\'est toujours un pourcentage d\'imputation sur le coût de production de ce produit.' },
                        { id: 'guide-sku-ligne-ff-total', term: 'Frais fixes totaux par unité', def: 'Général + Activité + Canal : la part des frais fixes totaux attribuée à ce produit dans ce canal. Elle exclut le vieillissement, une charge financière présentée à part.' },
                        { id: 'guide-sku-ligne-vieillissement', term: 'Vieillissement', def: 'L\'intérêt de portage sur le capital immobilisé pendant l\'affinage de ce format (saisi dans Production → Coûts additionnels). Le même montant quel que soit le canal ; il est déduit du bénéfice net, pas du bénéfice brut. La ligne n\'apparaît que si le vieillissement est activé.' },
                        { id: 'guide-sku-ligne-cout-net', term: 'Coût net', def: 'Le coût de revient complet par unité : coût de production + frais fixes alloués (+ vieillissement, s\'il y a lieu).' },
                        { id: 'guide-sku-ligne-benefice-net', term: 'Bénéfice net', def: 'Le profit réel par unité une fois tous les coûts déduits (production + frais fixes).' },
                        { id: 'guide-sku-ligne-marge-nette', term: 'Marge nette', def: 'En % du prix de vente net de ce canal : (prix − coût de revient total) ÷ prix.' },
                        { id: 'guide-sku-ligne-revenu-total', term: 'Revenu total', def: 'Prix de vente × volume réel vendu dans ce canal (saisi dans Produits et SKUs).' },
                        { id: 'guide-sku-ligne-frais-totaux', term: 'Frais totaux', def: 'Coût net par unité (production + frais fixes alloués) × volume réel vendu dans ce canal.' },
                        { id: 'guide-sku-ligne-benefice-perte', term: 'Bénéfices / Pertes', def: 'Revenu total moins frais totaux : le profit réel de ce produit dans ce canal, au volume réellement vendu.' },
                        { id: 'guide-sku-ligne-point-mort', term: 'Point mort', def: 'Le nombre d\'unités à vendre dans ce canal pour couvrir la part des frais fixes attribuée à ce produit (la main-d\'œuvre de production étant traitée comme fixe pour la période).' },
                    ],
                },
                { type: 'p', text: 'Sous le tableau, un graphique montre l\'évolution des coûts et de la marge nette de ce produit d\'un point de référence à l\'autre. Le bouton {{Éditer ce SKU dans Production}} ouvre sa fiche.' },
                { type: 'h', id: 'guide-sku-exemple', text: 'Lire un exemple complet : le Chili con carne mijoté' },
                { type: 'p', text: `Le coût de production du Chili est de ${d(DEMO.chili.coutProduction)} par unité, quel que soit le canal. Voici ce qui se passe ensuite, canal par canal.` },
                {
                    type: 'table', head: ['', 'Vente directe', 'Épiceries', 'Grandes surfaces'], rows: [
                        ['PDS', d(DEMO.bySku.pds), d(DEMO.bySku.pds), d(DEMO.bySku.pds)],
                        ['Prélevé par les maillons', '—', d(DEMO.bySku.margeEpicier), `${d(DEMO.bySku.margeDetaillant)} + ${d(DEMO.bySku.majorationDistribution)}`],
                        ['Prix net (de vente)', d(DEMO.chili.prixVente), d(DEMO.bySku.prixEpiceries), d(DEMO.bySku.prixGrandesSurfaces)],
                        ['Bénéfice brut (marge brute)', `${d(S.beneficeBrutDirecte)} (${d(S.margeBruteDirecte)})`, `${d(S.beneficeBrutEpiceries)} (${d(S.margeBruteEpiceries)})`, `${d(S.beneficeBrutGrandesSurfaces)} (${d(S.margeBruteGrandesSurfaces)})`],
                        ['Frais fixes par unité', d(S.fraisFixesTotalDirecte), d(S.fraisFixesTotalEpiceries), d(S.fraisFixesTotalGrandesSurfaces)],
                        ['Coût net (coût de revient complet)', d(S.coutNetDirecte), d(S.coutNetEpiceries), d(S.coutNetGrandesSurfaces)],
                        ['Bénéfice net (marge nette)', `${d(S.beneficeNetDirecte)} (${d(DEMO.bySku.margeNetteDirecte)})`, `${d(S.beneficeNetEpiceries)} (${d(DEMO.bySku.margeNetteEpiceries)})`, `${d(S.beneficeNetGrandesSurfaces)} (${d(DEMO.bySku.margeNetteGrandesSurfaces)})`],
                        ['Revenu total / frais totaux', `${d(S.revenuDirecte)} / ${d(S.fraisTotauxDirecte)}`, `${d(S.revenuEpiceries)} / ${d(S.fraisTotauxEpiceries)}`, `${d(S.revenuGrandesSurfaces)} / ${d(S.fraisTotauxGrandesSurfaces)}`],
                        ['Bénéfice / perte', d(S.resultatDirecte), d(S.resultatEpiceries), d(S.resultatGrandesSurfaces)],
                        ['Point mort', d(DEMO.bySku.pointMortDirecte), d(DEMO.bySku.pointMortEpiceries), d(DEMO.bySku.pointMortGrandesSurfaces)],
                    ],
                },
                { type: 'p', text: 'Ce qu\'il faut en conclure :' },
                {
                    type: 'ul', items: [
                        'Le même produit, avec le même coût de fabrication, est **rentable en vente directe** (marge nette de 18,25 %), à peine **à l\'équilibre en épicerie** (−0,76 %) et **déficitaire en grande surface** (−9,61 %). La seule différence est le prix net, que les maillons font baisser de 8,09 $ à 5,46 $.',
                        'Le produit est un des produits actifs les plus vendus : le canal où il perd le plus est aussi celui où il se vend le plus (4 286,10 $ de revenus contre 922,26 $ en vente directe).',
                        'La part de frais fixes propre à chaque canal (« Canal ») change aussi : 1,10 $ en vente directe, 0,82 $ en épicerie, 0,47 $ en grande surface, parce que ces coûts se répartissent sur des volumes différents.',
                        'Le point mort grimpe de 575 unités en vente directe à 1 365 en grande surface : il faut vendre bien plus pour couvrir les mêmes frais quand la marge unitaire est plus faible.',
                    ],
                },
                { type: 'callout', kind: 'pourquoi', text: 'Voilà pourquoi la marge brute d\'un produit ne suffit pas à décider. Les décisions possibles : relever le prix net en grande surface (renégocier le PDS ou la marge du distributeur), réduire le coût de production, ne plus offrir ce produit dans ce canal, ou accepter la perte comme coût d\'accès à ce client si d\'autres produits y sont rentables.' },
                { type: 'callout', kind: 'retenir', text: 'Par SKU suit un produit du prix en tablette jusqu\'à son bénéfice net, canal par canal. Comparez les marges nettes entre canaux : c\'est là que se découvrent les produits qui perdent de l\'argent sans qu\'on le voie.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-activite-canal',
            title: 'Par Activité et Par Canal',
            blocks: [
                { type: 'p', text: 'Ces deux sous-onglets ont la même mise en page que Par SKU, mais pour un **segment** plutôt qu\'un seul produit : « Par Activité » présente chaque activité de production, réduite à son propre total (tous canaux confondus) ; « Par Canal » fait de même pour vos canaux de vente. Les colonnes sont classées par bénéfice net décroissant : le segment le plus rentable en premier.' },
                { type: 'p', text: 'Ils diffèrent volontairement de Par SKU sur quatre points :' },
                {
                    type: 'ul', items: [
                        'Pas de section « PDS et frais de mise en marché » : les maillons sont propres à chaque produit, les additionner entre produits différents n\'aurait pas de sens.',
                        'Tous les montants sont des **totaux en dollars** du segment, pas des dollars par unité : des produits différents n\'ont pas d\'unité de vente commune.',
                        'Les pourcentages (marge brute, marge nette) se calculent en divisant la **somme** des marges en dollars par la **somme** des revenus, jamais en moyennant les pourcentages de chaque produit (voir [[guide-concept-mix|chapitre 9]]).',
                        'Le point mort s\'exprime en **dollars de revenu**, non en unités.',
                    ],
                },
                { type: 'h', id: 'guide-seg-lignes', text: 'Les lignes du tableau, une par une', level: 5 },
                {
                    type: 'dl', items: [
                        { id: 'guide-seg-ligne-revenu', term: 'Revenu total', def: 'Prix de vente × volume réel vendu, tous canaux confondus pour ce segment (volumes saisis dans Produits et SKUs).' },
                        { id: 'guide-seg-ligne-cout', term: 'Coût de production', def: '(Matière + emballage + main-d\'œuvre + sous-traitance) × volume réel vendu, avant tout frais fixe.' },
                        { id: 'guide-seg-ligne-brut', term: 'Bénéfice brut', def: 'Revenu total moins coût de production. Avant frais fixes.' },
                        { id: 'guide-seg-ligne-marge-brute', term: 'Marge brute', def: 'Bénéfice brut en % du revenu total, avant frais fixes.' },
                        { id: 'guide-seg-ligne-frais-fixes', term: 'Frais fixes', def: 'La part des frais fixes attribuée à ce segment (Général + Activité + Canal), au volume réel vendu.' },
                        { id: 'guide-seg-ligne-net', term: 'Bénéfice net', def: 'Le profit réel de ce segment une fois tous les coûts déduits (production + frais fixes).' },
                        { id: 'guide-seg-ligne-marge-nette', term: 'Marge nette', def: 'Bénéfice net en % du revenu total.' },
                        { id: 'guide-seg-ligne-point-mort', term: 'Point mort', def: 'Le revenu que ce segment doit générer pour couvrir ses frais fixes (dont la main-d\'œuvre, traitée comme fixe pour la période). Il s\'exprime en **dollars de revenu**, pas en unités : des produits très différents n\'ont pas d\'unité de vente commune. La méthode est celle du ratio de marge de contribution pondéré en dollars, la même que pour le point mort des produits actifs.' },
                    ],
                },
                { type: 'h', id: 'guide-activite-main-oeuvre', text: 'La section Main-d\'œuvre de Par Activité' },
                { type: 'p', text: 'Sous le tableau, une section {{Main-d\'œuvre}} ajoute trois lignes pour chaque activité : les **heures de main-d\'œuvre** réellement requises, leur **part** du total et le **bénéfice brut par heure**. Elle montre quelle activité rentabilise le mieux le temps de l\'équipe. Les produits de revente, qui n\'ont aucune main-d\'œuvre, sont exclus du bénéfice brut par heure.' },
                { type: 'h', id: 'guide-activite-exemple', text: 'Lire Par Activité : le projet démo' },
                {
                    type: 'table', head: ['', 'Mets principaux', 'Sauces et acc.', 'Soupes et potages'], rows: [
                        ['Revenu total', d(A.plats.revenu), d(A.sauces.revenu), d(A.soupes.revenu)],
                        ['Coût de production', d(A.plats.cout), d(A.sauces.cout), d(A.soupes.cout)],
                        ['Bénéfice brut (marge brute)', `${d(A.plats.brut)} (${d(A.plats.margeBrute)})`, `${d(A.sauces.brut)} (${d(A.sauces.margeBrute)})`, `${d(A.soupes.brut)} (${d(A.soupes.margeBrute)})`],
                        ['Frais fixes', d(A.plats.fraisFixes), d(A.sauces.fraisFixes), d(A.soupes.fraisFixes)],
                        ['Bénéfice net (marge nette)', `${d(A.plats.net)} (${d(A.plats.margeNette)})`, `${d(A.sauces.net)} (${d(A.sauces.margeNette)})`, `${d(A.soupes.net)} (${d(A.soupes.margeNette)})`],
                        ['Point mort', d(A.plats.pointMort), d(A.sauces.pointMort), d(A.soupes.pointMort)],
                    ],
                },
                { type: 'p', text: 'Les trois activités sont rentables, mais pas autant : les mets principaux surgelés ont une marge nette de 11,01 % et portent l\'entreprise, les soupes et potages de 4,89 % et les sauces et accompagnements de 1,35 % seulement. Ces deux dernières ont une marge brute semblable (autour de 40 %), mais leurs frais fixes (7 580,81 $ et 4 734,65 $) en absorbent presque tout. Leur point mort (19 453,51 $ et 12 040,16 $) est proche de leur chiffre d\'affaires réel (20 829,93 $ et 12 447,00 $) : la moindre baisse de volume ou de prix les ferait passer sous le seuil de rentabilité.' },
                { type: 'h', id: 'guide-canal-exemple', text: 'Lire Par Canal : le projet démo' },
                {
                    type: 'table', head: ['', 'Vente directe', 'Épiceries', 'Grandes surfaces'], rows: [
                        ['Revenu total', d(C.directe.revenu), d(C.epiceries.revenu), d(C.grandes.revenu)],
                        ['Bénéfice brut (marge brute)', `${d(C.directe.brut)} (${d(C.directe.margeBrute)})`, `${d(C.epiceries.brut)} (${d(C.epiceries.margeBrute)})`, `${d(C.grandes.brut)} (${d(C.grandes.margeBrute)})`],
                        ['Bénéfice net (marge nette)', `${d(C.directe.net)} (${d(C.directe.margeNette)})`, `${d(C.epiceries.net)} (${d(C.epiceries.margeNette)})`, `${d(C.grandes.net)} (${d(C.grandes.margeNette)})`],
                        ['Point mort', d(C.directe.pointMort), d(C.epiceries.pointMort), d(C.grandes.pointMort)],
                    ],
                },
                { type: 'p', text: 'Les grandes surfaces représentent près de 60 % du chiffre d\'affaires des produits actifs, mais ne dégagent qu\'une marge nette de 1,98 % (915,81 $). La vente directe, la plus petite, est la plus rentable (marge nette de 26,76 %). Remarquez que la somme des bénéfices nets des canaux (3 448,69 $ + 1 934,99 $ + 915,81 $) est de 6 299,49 $, soit, à un cent d\'arrondi près, le bénéfice net théorique de la réconciliation (6 299,48 $) : c\'est le bénéfice net théorique de la réconciliation. Les trois rapports (par SKU, par activité, par canal) se recoupent exactement.' },
                { type: 'callout', kind: 'pourquoi', text: 'Ces deux rapports transforment des dizaines de produits en quelques lignes lisibles, celles sur lesquelles on peut agir : revoir le prix d\'une ligne de production, renégocier un canal, ou décider d\'en abandonner un.' },
                { type: 'callout', kind: 'retenir', text: 'Par Activité et Par Canal additionnent vos produits en segments. Comparez la marge nette des segments : ceux qui perdent de l\'argent sont vos priorités.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-intrants',
            title: 'Ingrédients et Emballages : vos achats',
            blocks: [
                { type: 'callout', kind: 'pourquoi', text: 'Les sous-onglets {{Ingrédients}} et {{Emballages}} ont le même gabarit, et ils restent séparés : l\'emballage n\'est jamais fusionné avec la matière. Chacun répond à trois questions : où va l\'argent (analyse ABC), combien faut-il acheter (rapport d\'achats et perte stock), et les prix bougent-ils (évolution et volatilité).' },
                { type: 'h', id: 'guide-ing-abc', text: 'L\'analyse ABC des ingrédients' },
                { type: 'p', text: 'L\'analyse ABC classe vos ingrédients par importance financière (voir [[guide-concept-suivi|chapitre 11]] pour la méthode). Trois cartes présentent les catégories A, B et C, avec la part de chaque ingrédient dans le coût total consommé. Un badge {{volatile}} s\'ajoute aux ingrédients dont le prix bouge beaucoup (il faut au moins deux points de référence pour qu\'il apparaisse).' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, la catégorie A compte quatre ingrédients (bœuf haché, poitrine de poulet, filet de saumon et riz basmati) pour ${d(DEMO.ingredients.abcA)} du coût total. Les trois premiers n'atteignent que 64,8 % : le riz basmati, qui franchit la barre des 70 %, est inclus dans la catégorie A.` },
                { type: 'p', text: 'L\'analyse porte uniquement sur les ingrédients **réellement consommés** par vos produits actifs, compte tenu des volumes vendus : un ingrédient qui ne sert à aucune recette n\'y figure pas.' },

                { type: 'h', id: 'guide-ing-rapport-achats', text: 'Le rapport d\'achats et perte stock' },
                { type: 'p', text: 'Ce rapport estime ce que vous devez acheter pour la période, en partant de vos recettes et de vos ventes : pour chaque ingrédient, la quantité requise est la quantité de la recette multipliée par le nombre de lots à produire, ce nombre se déduisant des volumes saisis dans Produits et SKUs. Trois totaux, pour tous les fournisseurs, s\'affichent en premier :' },
                {
                    type: 'ul', items: [
                        { label: 'Coût net total (production).', text: 'La valeur de la matière réellement utilisée dans vos produits.' },
                        { label: 'Coût total de la perte stock.', text: 'La valeur de ce qui se perd en stock avant utilisation.' },
                        { label: 'Coût d\'achat total requis.', text: 'La somme des deux : ce qu\'il faut réellement acheter, et donc budgéter.' },
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'La {{perte stock}} est **prévue**, pas mesurée : c\'est le taux de perte saisi dans le catalogue, appliqué aux quantités que vos ventes requièrent. La perte réellement constatée se lit dans la {{Réconciliation réel / théorique}} de la Vue d\'ensemble.' },
                { type: 'p', text: `Dans le projet démo : ${d(DEMO.ingredients.coutNet)} de coût net, ${d(DEMO.ingredients.pertes)} de perte stock, soit ${d(DEMO.ingredients.achatRequis)} d'achats requis.` },
                { type: 'h', id: 'guide-rapport-fournisseurs', text: 'Achats par fournisseur', level: 5 },
                { type: 'p', text: 'Un premier tableau montre, pour chaque fournisseur, son coût d\'achat requis et sa **part des achats**. Une barre orange et la mention {{dépendance}} signalent un fournisseur qui pèse 40 % ou plus des achats : s\'il fait défaut ou augmente ses prix, une grande part de vos achats est touchée. C\'est aussi votre levier de négociation. Les achats dont le fournisseur n\'est pas renseigné sont regroupés sous « Non spécifié ».' },
                { type: 'callout', kind: 'exemple', text: 'Dans le projet démo, la Boucherie Nordique pèse 50 % des achats d\'ingrédients : c\'est une dépendance.' },
                { type: 'p', text: 'Le tableau de détail réunit toutes les lignes, tous fournisseurs confondus. Un clic sur un titre de colonne le trie ; il est trié par défaut sur le {{Coût perte stock}}, du plus élevé au plus faible : les pertes les plus coûteuses sont en haut. La liste {{Fournisseur}} limite le détail à un seul fournisseur, et le nombre de lignes par page se règle en bas. Pour chaque ligne : la quantité nette, le taux de perte stock, le coût net, la quantité de perte stock et son coût.' },
                {
                    type: 'table', caption: 'Les colonnes du détail', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
                    rowIds: ['guide-ing-ra-qte-nette', 'guide-ing-ra-cout-net', 'guide-ing-ra-qte-perdue', 'guide-ing-ra-cout-perdu', 'guide-ing-ra-achat-requis'],
                    rows: [
                        ['{{Qté nette (Production)}}', 'La quantité de l\'ingrédient réellement utilisée dans vos produits, d\'après vos ventes de la période.'],
                        ['{{Coût net (Production)}}', 'Le coût de cette quantité : la valeur de la matière qui est transformée en produits vendus.'],
                        ['{{Qté perte stock}}', 'La quantité à acheter en plus pour compenser ce qui se perd en stock avant d\'être utilisé, selon le taux de perte de l\'ingrédient.'],
                        ['{{Coût perte stock}}', 'Le coût de cette perte stock.'],
                        ['{{Coût d\'achat requis}}', 'La somme du coût net et du coût de la perte stock : ce qu\'il faut réellement acheter et budgéter pour cet ingrédient.'],
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'Ce rapport n\'est aussi juste que vos volumes : si vous n\'avez saisi aucun volume de vente dans Produits et SKUs, il n\'a rien à calculer et affiche des zéros.' },

                { type: 'h', id: 'guide-emb-abc', text: 'Emballages : analyse ABC et rapport d\'achats' },
                { type: 'p', text: 'L\'analyse ABC et le rapport d\'achats et perte stock existent aussi pour l\'emballage, dans le sous-onglet {{Emballages}}, avec le même principe. L\'analyse n\'inclut que les emballages réellement rattachés à au moins un format de vente. Dans le projet démo, la catégorie A de l\'emballage représente 71,5 % des coûts.' },

                { type: 'h', id: 'guide-rapport-prix', text: 'Évolution des prix et volatilité' },
                { type: 'p', text: 'Chacun de ces sous-onglets suit aussi le prix de vos ingrédients (ou de vos emballages) dans le temps, d\'un point de référence à l\'autre. Il se compose de deux éléments :' },
                {
                    type: 'ul', items: [
                        { label: 'Évolution du prix.', text: 'Choisissez un ingrédient (ou un emballage) dans la liste : un graphique montre l\'évolution de son prix unitaire. C\'est idéal pour suivre l\'inflation et l\'effet de vos négociations.' },
                        { label: 'Volatilité des prix d\'achat.', text: 'Un tableau classe les ingrédients par **amplitude** (l\'écart entre le prix le plus bas et le plus haut, en % de la moyenne), avec la **tendance** et le palier de volatilité. Il se filtre par nom et par fournisseur.' },
                    ],
                },
                {
                    type: 'dl', items: [
                        { id: 'guide-intrants-prix-actuel', term: 'Prix actuel', def: 'Le dernier prix unitaire connu, c\'est-à-dire celui du point de référence le plus récent.' },
                        { id: 'guide-intrants-tendance', term: 'Tendance', def: 'La variation entre le premier et le dernier point de référence, en %. Une hausse est signalée en rouge, une baisse en vert.' },
                        { id: 'guide-intrants-volatilite', term: 'Volatilité (amplitude)', def: 'L\'écart entre la valeur la plus basse et la plus haute du prix, en % de la moyenne, avec son palier (faible sous 10 %, modéré de 10 % à moins de 20 %, élevé à partir de 20 %).' },
                    ],
                },
                { type: 'p', text: 'Ces mesures existent dès deux points de référence ; le projet démo en compte dix-neuf, ce qui donne des séries longues. Le tableau se croise avec l\'analyse ABC ci-dessus : un ingrédient de catégorie A dont le prix est volatil est une priorité d\'approvisionnement.' },
                { type: 'callout', kind: 'astuce', text: 'Le tableau est trié par amplitude décroissante : les prix les plus capricieux sont en haut. Regardez d\'abord la colonne de tendance : un prix volatil mais sans tendance fluctue autour d\'une moyenne ; un prix à tendance haussière régulière appelle une action (contrat, second fournisseur, révision de prix).' },
                { type: 'p', text: 'Les emballages, un poste séparé, ont leur propre sous-onglet : jamais fusionnés avec les ingrédients.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-main-oeuvre',
            title: 'Main-d\'œuvre : l\'utilisation de votre équipe',
            blocks: [
                { type: 'callout', kind: 'pourquoi', text: 'Le sous-onglet {{Main-d\'œuvre}} de Rapport et suivi ne sert pas à saisir vos employés (c\'est l\'onglet du même nom) : il montre ce que leur temps produit, et ce qu\'il vous coûte quand il n\'est pas utilisé.' },
                { type: 'h', id: 'guide-mo-productivite', text: 'Le rapport de productivité' },
                { type: 'p', text: 'Dans le sous-onglet {{Main-d\'œuvre}}, ce rapport compare, **poste par poste**, les heures que vous payez à celles dont vos recettes ont réellement besoin pour produire ce que vous vendez :' },
                {
                    type: 'ul', itemIds: ['guide-mo-prod-attendues', 'guide-mo-prod-reelles', 'guide-mo-prod-difference', 'guide-mo-prod-utilisation'], items: [
                        { label: 'Heures productives attendues.', text: 'Les heures travaillées de chaque employé multipliées par son % de temps productif.' },
                        { label: 'Heures productives réelles.', text: 'Le temps que les étapes de vos recettes mobilisent, multiplié par le nombre de lots que vos ventes demandent. Le temps de fabrication des sous-recettes est compté lui aussi, à hauteur de ce que vos produits en consomment, même si une sous-recette n\'est jamais vendue seule.' },
                        { label: 'Différence (h).', text: 'Les heures attendues moins les heures réelles : les heures productives payées mais non utilisées.' },
                        { label: 'Taux d\'utilisation (%).', text: 'Les heures réelles ÷ les heures attendues.' },
                    ],
                },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, l'équipe de production a ${d(DEMO.mo.heuresAttendues)} productives attendues, pour ${d(DEMO.mo.heuresReelles)} réellement requises : un taux d'utilisation de ${d(DEMO.mo.utilisation)}. Le « Cuisinier de production » est utilisé à 90,31 %, l'« Opérateur d'emballage » à 90,55 %, le « Contrôleur qualité » à 88,47 %. Le « Responsable de production », lui, est à 0 % : aucune étape de recette ne lui est affectée.` },
                { type: 'callout', kind: 'pourquoi', text: 'Un taux d\'utilisation bas signale de la capacité payée et inutilisée : trop de personnel pour le volume vendu, des recettes qui ne reflètent pas le travail réel, ou des ventes qui n\'ont pas encore été saisies. C\'est un levier de rentabilité majeur, car **ce coût est réparti sur tous vos produits** (voir [[guide-concept-capacite|chapitre 10]]).' },
                { type: 'callout', kind: 'attention', text: 'Une personne présente dans cet onglet mais affectée à aucune étape, comme le responsable de production du démo, fait baisser le taux d\'utilisation global. Son coût n\'est pas perdu : il est réparti sur toutes les recettes sous forme de coût indirect de main-d\'œuvre. Si cette personne ne fait pas de production, mieux vaut la retirer de l\'onglet et la saisir dans les frais fixes.' },

                { type: 'h', id: 'guide-mo-paie-inutilisee', text: 'La paie non utilisée' },
                { type: 'p', text: 'Sous le tableau, la {{paie non utilisée}} chiffre en dollars ce que le taux d\'utilisation exprime en pourcentage : la paie versée pour des heures qui ne servent pas à produire, c\'est-à-dire le temps non productif prévu et la capacité productive inutilisée. Cette somme n\'est pas perdue : elle est absorbée dans le coût de revient de vos produits.' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, la paie totale est de ${d(DEMO.mo.paieTotale)} et ${d(DEMO.mo.paieNonUtilisee)} ne servent pas à produire (${d(DEMO.mo.partNonUtilisee)}).` },

                { type: 'h', id: 'guide-mo-croissance', text: 'La marge de croissance' },
                { type: 'p', text: 'La {{marge de croissance}} estime ce que l\'équipe actuelle pourrait produire de plus sans embauche : les **heures productives libres** des postes de production, multipliées par le revenu (et par le bénéfice brut) moyen d\'une heure de main-d\'œuvre des produits fabriqués. Elle donne un ordre de grandeur pour décider s\'il vaut la peine de chercher des clients avant d\'embaucher.' },
                { type: 'callout', kind: 'attention', text: 'C\'est une estimation indicative. Elle suppose que le mix de produits et de canaux reste le même, que la demande existe et que les heures libres tombent au bon poste. Les postes dont aucune recette ne demande d\'heures (comme le responsable de production du démo) et les produits de revente en sont exclus.' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo : ${d(DEMO.mo.heuresLibres)} productives libres, à ${d(DEMO.mo.revenuHeure)} de revenu et ${d(DEMO.mo.beneficeHeure)} de bénéfice brut par heure : environ 8 000 $ de ventes et 3 500 $ de bénéfice brut additionnels, arrondis à la centaine.` },

                { type: 'h', id: 'guide-mo-cascade', text: 'Où va la paie' },
                { type: 'p', text: 'Ce graphique suit les heures payées jusqu\'aux heures réellement utilisées, en trois parts, chacune avec son coût (heures × coût horaire chargé du poste) :' },
                {
                    type: 'ul', items: [
                        { label: 'Heures utilisées à produire.', text: 'Celles que vos recettes demandent vraiment.' },
                        { label: 'Productives mais inutilisées.', text: 'Des heures productives payées que vos recettes ne demandent pas. Un poste sans aucune étape de recette y figure en entier.' },
                        { label: 'Non productives.', text: 'Le temps payé hors production (administration, réunions), déjà exclu du % de temps productif attendu.' },
                    ],
                },
                { type: 'h', id: 'guide-mo-cout-heure', text: 'Le coût réel d\'une heure productive' },
                { type: 'p', text: 'Le {{coût réel d\'une heure productive}} répartit toute la paie sur les seules heures réellement utilisées à produire. Il se compare au {{taux horaire moyen chargé}} (la paie divisée par les heures payées) : l\'écart mesure ce que coûtent les heures payées sans servir.' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo : ${d(DEMO.mo.coutHeureReel)} contre ${d(DEMO.mo.tauxMoyen)} de taux moyen chargé, soit environ 25 % de plus.` },

                { type: 'h', id: 'guide-mo-capacite', text: 'Charge de travail par activité' },
                { type: 'p', text: 'Ce deuxième tableau, nommé autrefois « Capacité de production par activité », répartit les heures de main-d\'œuvre réellement requises entre vos **activités de production**, et indique la part de chaque activité dans le total. Il montre où part le temps de votre équipe, donc quelle ligne de production est la plus exigeante. Ce n\'est pas une capacité : le tableau ne compare pas ces heures à une quantité disponible. Il n\'y a pas de « heures attendues » par activité : un poste ou un employé n\'est pas rattaché à une seule activité, donc rien n\'est comparable.' },
                { type: 'p', text: 'Dans le projet démo, les mets principaux surgelés consomment 126,81 heures (36,82 % du total), les soupes et potages 210,14 heures (61,01 %), et les sauces et accompagnements 7,47 heures (2,17 %). La sauce du Terroir est un produit de revente, sans étapes de production : seule la sauce à spaghetti maison demande du temps de cuisson et de mise en pot.' },
                {
                    type: 'ul', itemIds: ['guide-mo-cap-heures', 'guide-mo-cap-part', 'guide-mo-charge-revenu-heure', 'guide-mo-charge-benefice-heure'], items: [
                        { label: 'Heures productives réelles.', text: 'Les heures de production de l\'activité, calculées à partir des étapes de vos recettes et de vos ventes de la période.' },
                        { label: 'Part du total.', text: 'La part de cette activité dans l\'ensemble des heures productives réelles.' },
                        { label: 'Revenu / heure.', text: 'Le revenu des produits fabriqués de l\'activité divisé par ses heures de main-d\'œuvre. Les produits de revente, qui n\'ont aucune main-d\'œuvre, sont exclus.' },
                        { label: 'Bénéfice brut / heure.', text: 'Le bénéfice brut de ces produits divisé par les mêmes heures : ce que rapporte une heure de l\'équipe dans cette activité.' },
                    ],
                },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, une heure rapporte ${d(DEMO.mo.heureActivite.plats)} de bénéfice brut dans les mets principaux, ${d(DEMO.mo.heureActivite.sauces)} dans les sauces et ${d(DEMO.mo.heureActivite.soupes)} dans les soupes.` },

                { type: 'h', id: 'guide-mo-rentabilite-produit', text: 'Rentabilité de l\'heure, par produit' },
                { type: 'p', text: 'Le même calcul, produit par produit : le bénéfice brut de chaque produit divisé par les heures de main-d\'œuvre de son format. Le classement montre quels produits font le meilleur usage du temps de l\'équipe. Un produit de revente reste dans la liste, marqué {{Revente}}, sans ratio. Le temps d\'une sous-recette reste attribué à son propre format, jamais au produit qui la consomme.' },
                { type: 'callout', kind: 'exemple', text: `Dans le projet démo, le Pâté chinois (340 g) rapporte ${d(DEMO.mo.heureProduit.meilleur)} et le Potage à la courge musquée ${d(DEMO.mo.heureProduit.dernier)} : le premier rentabilise bien mieux l'heure de l'équipe.` },
                { type: 'callout', kind: 'pourquoi', text: 'Quand le temps de l\'équipe est limité, ce classement dit où placer la prochaine heure. Un produit populaire mais qui rapporte peu à l\'heure est un candidat à la révision de son prix ou de sa recette.' },
            ],
        },


        // =====================================================================================
        {
            id: 'guide-rapport-simulation',
            title: 'Simulation : et si mes coûts changeaient ?',
            blocks: [
                { type: 'callout', kind: 'pourquoi', text: 'Votre fournisseur annonce 8 % de hausse. Vos employés obtiennent une augmentation. Que devient votre rentabilité ? La simulation répond à l\'avance, sans toucher à vos données, ce qui vous permet de négocier ou de réviser vos prix en connaissance de cause.' },
                { type: 'p', text: 'Le bouton {{Ajouter un choc}} crée une ligne. Chaque **choc** est défini par trois éléments :' },
                {
                    type: 'ul', items: [
                        { label: 'Un type.', text: '{{Intrants}} (le prix des ingrédients) ou {{Main-d\'œuvre}} (les salaires horaires).' },
                        { label: 'Une portée.', text: 'Pour les intrants : tous les ingrédients, un fournisseur, un format, une activité de production, ou une sélection d\'ingrédients. Pour la main-d\'œuvre : toute la main-d\'œuvre, un poste, un format, une activité, ou une sélection d\'employés.' },
                        { label: 'Un pourcentage.', text: 'La variation appliquée (positive pour une hausse, négative pour une baisse).' },
                    ],
                },
                { type: 'p', text: 'Vous pouvez cumuler plusieurs chocs : le scénario actif est résumé en haut. L\'écran compare ensuite l\'**avant** et l\'**après** :' },
                {
                    type: 'ul', items: [
                        'Les indicateurs des produits actifs : coût matière moyen pondéré (le « coût matière »), coût de main-d\'œuvre moyen pondéré, marge brute moyenne pondérée et point mort des produits actifs, avec l\'écart avec le scénario et la comparaison à vos objectifs.',
                        'L\'impact par activité de production et par circuit de vente.',
                        'La marge nette par portion de chaque produit, actuelle et en scénario.',
                    ],
                },
                {
                    type: 'dl', items: [
                        { id: 'guide-sim-indicateurs', term: 'Indicateurs des produits actifs', def: 'Le coût matière moyen pondéré (« coût matière » à l\'écran) et le coût de main-d\'œuvre moyen pondéré, en % du prix de vente ; la marge brute moyenne pondérée ; le point mort des produits actifs en dollars. Chacun est affiché « actuel → scénario », avec l\'écart, et comparé à vos objectifs. Les moyennes sont celles de la Vue d\'ensemble : pondérées par le revenu de chaque produit.' },
                        { id: 'guide-sim-impact-activite', term: 'Impact par activité de production', def: 'La marge brute et les coûts moyens de **chaque activité**, calculés avec les seuls formats de cette activité et pondérés par leur part des ventes. Cela isole l\'impact propre de l\'activité au lieu de le diluer dans la moyenne des produits actifs.' },
                        { id: 'guide-sim-impact-canal', term: 'Impact par circuit de vente', def: 'La marge brute et les coûts moyens de **chaque canal**, pondérés par le volume réel de ce canal (et non par la vue « tous canaux »). Un canal sans aucun volume saisi n\'apparaît pas.' },
                        { id: 'guide-sim-marge-portion', term: 'Marge nette par portion, par produit', def: 'Pour chaque produit : la marge nette par unité avec vos prix et salaires actuels, la marge nette une fois les chocs appliqués, et l\'écart (scénario moins actuel, en dollars par unité). Un écart négatif signifie que le choc réduit la marge.' },
                    ],
                },
                { type: 'callout', kind: 'exemple', text: 'Ajoutez un choc « Intrants — tous les ingrédients — +8 % ». Le coût matière moyen monte, la marge brute baisse et le point mort des produits actifs grimpe. Les produits dont les ingrédients pèsent le plus lourd (souvent ceux de la catégorie A) sont les plus touchés : vous voyez immédiatement lesquels deviennent déficitaires. Ajoutez ensuite un second choc limité à un fournisseur pour voir l\'effet d\'une hausse ciblée.' },
                { type: 'callout', kind: 'attention', text: 'La simulation applique les chocs à vos **prix d\'achat et salaires actuels**, sans modifier vos prix de vente : elle montre l\'effet d\'une hausse de coûts que vous absorberiez. Pour voir l\'effet d\'un changement de prix de vente, utilisez le mode simulation de l\'onglet Production.' },
                { type: 'p', text: 'Votre scénario est **enregistré avec le projet** : il reste là quand vous changez d\'onglet et quand vous rouvrez le fichier. Le bouton {{Réinitialiser}} l\'efface. Les chocs se rapportent à des éléments précis (un fournisseur, un poste, un employé) : si vous supprimez ensuite un de ces éléments, le choc correspondant ne trouve plus sa cible.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-points-reference',
            title: 'Les points de référence',
            blocks: [
                { type: 'p', text: 'Un **point de référence** est une photo de votre projet à un moment donné : vos prix d\'achat, vos coûts, vos marges, vos prix de vente. Les graphiques d\'évolution et les tableaux de volatilité se construisent à partir de ces photos. Sans point de référence, l\'application ne montre que le présent ; avec, elle montre aussi le chemin parcouru.' },
                { type: 'p', text: 'Le bouton {{Point de référence}}, sous les boutons d\'export, ouvre un menu à deux choix :' },
                {
                    type: 'ul', items: [
                        { label: 'Nouveau point de référence.', text: 'Une fenêtre vous demande un **nom** (par exemple « Avant le changement de fournisseur ») et, facultativement, une **note descriptive** (« Promotion estivale, nouveau fournisseur… »). Le point enregistre l\'état de vos coûts, de vos prix et de vos marges.' },
                        { label: 'Gérer les points de référence.', text: 'Une fenêtre liste vos points ; vous pouvez les filtrer par nom ou par note, les trier, les **renommer et les annoter**, les **supprimer**, et choisir **lesquels alimentent les graphiques** (les 15 plus récents par défaut).' },
                    ],
                },
                { type: 'callout', kind: 'astuce', text: 'Créez un point de référence **avant** chaque changement important (révision de prix, nouveau fournisseur, nouvelle recette), puis un autre **après**. À défaut, prenez-en un à intervalle régulier, par exemple chaque mois : c\'est l\'habitude qui rend les graphiques utiles.' },
                { type: 'p', text: 'Si un produit a plusieurs formats, chacun est suivi séparément. Les points de référence antérieurs à la création d\'un nouveau format n\'affichent simplement aucune donnée pour lui avant cette date.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-exports',
            title: 'Exports : PDF et Excel',
            blocks: [
                { type: 'p', text: 'Deux boutons, en haut de l\'onglet, produisent des documents que vous pouvez partager hors de l\'application. Ils ont des usages différents.' },
                {
                    type: 'table', head: ['Export', 'Usage', 'Contenu'], wrapCells: true, rows: [
                        ['{{Générer un rapport PDF}}', 'Présentations, archivage, partage avec des partenaires, banquiers ou investisseurs.', 'Un rapport soigné de plusieurs pages : page de garde avec le nom et le logo de l\'entreprise, tableaux de bord, analyses stratégiques, graphiques et une **fiche de coût détaillée par format**. Une fenêtre vous demande le **titre** du rapport et le destinataire ({{Présenté à}}).'],
                        ['{{Exporter vers Excel}}', 'Analyses poussées, graphiques personnalisés, intégration à d\'autres systèmes.', 'Un classeur .xlsx avec les données brutes : tableau de bord, résumé, ingrédients, main-d\'œuvre, et une feuille de coût détaillée par format.'],
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'Un export reflète l\'état de l\'application au moment où vous le générez. Vérifiez le panneau « points à vérifier » avant : un rapport remis à un tiers avec des données incomplètes vous engage.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-decider',
            title: 'Quand un chiffre vous inquiète : que faire ?',
            lead: 'Un guide de décision : le symptôme, ses causes probables, où regarder dans l\'application, et les actions possibles.',
            blocks: [
                { type: 'p', text: 'Aucun rapport ne décide à votre place. Mais certains constats reviennent souvent, et les pistes d\'action aussi. Ce tableau les rassemble : pour chaque symptôme, il indique l\'endroit de l\'application où l\'investiguer.' },
                {
                    type: 'table', head: ['Ce que vous constatez', 'Causes probables', 'Où regarder', 'Actions possibles'], wrapCells: true, rows: [
                        ['Coût matière au-dessus de la cible', 'Hausse de prix d\'un ingrédient ; recette trop généreuse ; pertes ou rendement mal estimés', 'Ingrédients (comparaison) ; Production (rendement) ; Rapport → Ingrédients (ABC, achats)', 'Comparer les fournisseurs ; ajuster la recette ; viser les ingrédients de catégorie A ; relever le prix (tester avec la simulation de prix)'],
                        ['Marge brute correcte, marge nette négative', 'Frais fixes lourds pour le volume vendu ; volumes plus faibles que prévu', 'Rapport → Par SKU (section Répartition des charges fixes) ; État des résultats', 'Augmenter le volume ; réduire les frais fixes ; relever le prix ; vérifier la règle de répartition (CICI)'],
                        ['Marge nette négative dans un seul canal', 'Maillons qui prélèvent trop ; frais propres au canal', 'Rapport → Par SKU, Par Canal ; Paramètres → Canaux de vente', 'Renégocier la marge d\'un intermédiaire ; ajuster le prix net ; retirer le produit de ce canal'],
                        ['Point mort supérieur à ce que vous pouvez vendre', 'Marge unitaire trop faible ; frais fixes trop élevés', 'Rapport → Par SKU (point mort), Vue d\'ensemble', 'Relever la marge (prix, coût) ; réduire les frais fixes ; simplifier la liste de produits'],
                        ['Taux d\'utilisation de la main-d\'œuvre bas', 'Trop de personnel pour le volume ; étapes sans personnel affecté ; ventes non saisies', 'Rapport → Main-d\'œuvre (rapport de productivité)', 'Vérifier les recettes ; réaffecter ou réduire des heures ; vendre plus avec la même équipe'],
                        ['Grand écart entre réel et théorique', 'Fiches périmées ; volumes non saisis ; classement différent des coûts', 'Rapport → Vue d\'ensemble (Réconciliation) ; État des résultats', 'Mettre à jour prix et volumes ; vérifier le double comptage de la main-d\'œuvre ; revoir les recettes'],
                        ['Ingrédient de catégorie A au prix volatil', 'Marché instable ; dépendance à un fournisseur', 'Rapport → Ingrédients (ABC, évolution des prix)', 'Contrat à prix fixe ; second fournisseur ; clause d\'indexation ; ajuster le prix de vente'],
                        ['Vache à lait (très vendu, peu rentable)', 'Prix trop bas pour son coût', 'Rapport → Portefeuille (matrice stratégique)', 'Réduire le coût ; relever légèrement le prix ; tester avec la simulation'],
                        ['Poids mort (peu vendu, peu rentable)', 'Produit en fin de vie ; mauvaise place parmi les produits', 'Rapport → Portefeuille (matrice stratégique)', 'Le repenser ; le retirer, après avoir vérifié qu\'il n\'est pas sous-recette d\'un autre'],
                        ['Un produit paraît trop rentable pour être vrai', 'Ingrédients ou emballages sans prix ; étapes sans personnel ; quantités pour une portion', 'Panneau « points à vérifier » ; Production', 'Compléter les prix ; affecter le personnel ; saisir les quantités du lot entier'],
                    ],
                },
                { type: 'callout', kind: 'retenir', text: 'Un chiffre inquiétant est un point de départ, pas un verdict. Remontez toujours à sa cause (le prix, le coût, le volume, la répartition) avant d\'agir : l\'application permet de tester une décision (simulation de prix, simulation de chocs) avant de la prendre.' },
            ],
        },
    ],
};
