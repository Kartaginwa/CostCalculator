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
                { type: 'p', text: 'En haut, trois boutons : {{Exporter vers Excel}}, {{Générer un rapport PDF}} et {{Point de référence}} (voir [[guide-points-reference|plus bas]]). Dessous, six sous-onglets :' },
                {
                    type: 'table', head: ['Sous-onglet', 'Question à laquelle il répond'], wrapCells: true, rows: [
                        ['{{Vue d\'ensemble}}', 'Comment va mon entreprise dans son ensemble, et quels sont mes produits stratégiques ?'],
                        ['{{Par SKU}}', 'Comment un produit se comporte-t-il dans chacun de ses canaux ?'],
                        ['{{Par Activité}}', 'Quelle ligne de production est rentable ?'],
                        ['{{Par Canal}}', 'Quel circuit de vente est rentable ?'],
                        ['{{Intrants}}', 'Quels prix d\'achat bougent, et lesquels comptent le plus ?'],
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
                    ],
                },
                { type: 'callout', kind: 'astuce', text: 'Prenez l\'habitude d\'ouvrir cet onglet par le panneau : s\'il est présent, corrigez avant d\'interpréter quoi que ce soit.' },
                { type: 'callout', kind: 'retenir', text: 'Six sous-onglets, six questions. Un bandeau ambre signale les données à corriger avant de se fier aux chiffres.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-vue-ensemble',
            title: 'Vue d\'ensemble',
            blocks: [
                { type: 'h', id: 'guide-rapport-kpi', text: 'Analyse stratégique et point mort global' },
                { type: 'p', text: 'Cinq tuiles résument vos produits :' },
                {
                    type: 'table', head: ['Tuile', 'Ce qu\'elle mesure', 'Projet démo'], wrapCells: true, rowIds: ['guide-kpi-matiere', 'guide-kpi-emballage', 'guide-kpi-mo', 'guide-kpi-marge-brute', 'guide-kpi-point-mort'], rows: [
                        ['{{Coût Matière Moyen Pondéré}}', 'La part du prix de vente que représente, en moyenne, le coût matière de tous vos produits.', d(DEMO.apercu.coutMatiere)],
                        ['{{Coût Emballage Moyen Pondéré}}', 'Idem pour l\'emballage.', d(DEMO.apercu.coutEmballage)],
                        ['{{Coût Main-d\'œuvre Moyen Pondéré}}', 'Idem pour la main-d\'œuvre.', d(DEMO.apercu.coutMO)],
                        ['{{Marge Brute Moyenne Pondérée}}', 'La marge brute moyenne des produits actifs.', d(DEMO.apercu.margeBrute)],
                        ['{{Point Mort des Produits Actifs}}', 'Le chiffre d\'affaires que les produits actifs doivent générer pour couvrir l\'ensemble des frais fixes et de la main-d\'œuvre directe qui lui sont alloués.', d(DEMO.apercu.pointMortMenu)],
                    ],
                },
                { type: 'p', text: 'Les trois premières tuiles affichent un voyant de comparaison à vos objectifs (coche verte ou triangle rouge). Ces moyennes sont **pondérées par le revenu** de chaque produit : un produit qui génère beaucoup de ventes pèse davantage (voir [[guide-concept-mix|chapitre 9]]). Elles reposent sur la vue « tous canaux » de chaque produit : le prix net de chaque canal, pondéré par son volume.' },
                { type: 'callout', kind: 'astuce', text: `Les trois ratios de coûts et la marge brute ne totalisent pas tout à fait 100 % : ici ${d(DEMO.apercu.coutMatiere)} + ${d(DEMO.apercu.coutEmballage)} + ${d(DEMO.apercu.coutMO)} + ${d(DEMO.apercu.margeBrute)} = 98,08 %. La différence de 1,92 % est la part de la sous-traitance, un coût direct qui n'a pas sa propre tuile.` },
                { type: 'callout', kind: 'attention', text: 'Le point mort des produits actifs est un chiffre d\'affaires (en dollars), pas un nombre d\'unités : des produits très différents n\'ont pas d\'unité commune. Comparez-le à votre chiffre d\'affaires réel de la période : s\'il lui est supérieur, vous perdez de l\'argent en moyenne.' },

                { type: 'h', id: 'guide-rapport-evolution', text: 'Évolution des marges et coûts moyens' },
                { type: 'p', text: 'Un graphique montre l\'évolution de vos coûts moyens (matière, emballage, main-d\'œuvre) et de votre marge brute moyenne, d\'un point de référence à l\'autre. Chaque point est calculé comme les tuiles ci-dessus : une moyenne pondérée par le revenu de chaque produit à cette date, de sorte que le dernier point du graphique correspond à la tuile. Il sert à vérifier si vos décisions portent leurs fruits : un changement de fournisseur a-t-il fait baisser le coût matière ? Une hausse de prix a-t-elle amélioré la marge ? Le graphique est vide tant qu\'aucun point de référence n\'existe. Les 15 points les plus récents sont affichés par défaut ; la gestion des points permet de choisir lesquels alimentent les graphiques.' },

                { type: 'h', id: 'guide-rapport-bcg', text: 'La matrice stratégique des produits' },
                { type: 'p', text: 'La matrice classe chaque produit en croisant sa popularité et sa rentabilité (voir [[guide-concept-menu|chapitre 12]]). Le sélecteur {{Analyse BCG pour :}} permet de la calculer pour tous les canaux (pondéré par volume), ou pour un canal à la fois : un produit peut être une étoile dans un canal et un poids mort dans un autre. Chaque ligne indique la popularité du produit et sa marge brute par unité.' },
                {
                    type: 'table', caption: 'Matrice du projet démo (tous canaux)', head: ['Catégorie', 'Produits'], wrapCells: true, rows: [
                        ['**Étoiles**', 'Poulet général Tao (12,7 % des ventes, marge 3,02 $) ; Saumon teriyaki (9,0 %, 3,97 $) ; Sauté de poulet thaï 350 g (9,9 %, 3,30 $)'],
                        ['**Dilemmes**', 'Pâté chinois 900 g (5,6 %, 5,30 $) ; Sauté de poulet thaï 900 g (5,0 %, 5,76 $)'],
                        ['**Vaches à lait**', 'Chili con carne mijoté (14,9 %, 1,82 $) ; Pâté chinois 340 g (12,7 %, 2,56 $) ; Soupe-repas aux légumes et poulet (11,4 %, 1,75 $)'],
                        ['**Poids morts**', 'Purée de pommes de terre (6,1 %, 1,62 $) ; Potage à la courge musquée (6,3 %, 0,42 $) ; Sauce artisanale du Terroir (6,3 %, 0,15 $)'],
                    ],
                },
                { type: 'p', text: 'Comment en tirer des actions :' },
                {
                    type: 'ul', itemIds: ['guide-bcg-etoiles', 'guide-bcg-vaches', 'guide-bcg-dilemmes', 'guide-bcg-poids-morts'], items: [
                        { label: 'Étoiles.', text: 'Protégez-les : qualité constante, bonne visibilité, approvisionnement sécurisé. Surveillez le prix de leurs ingrédients de catégorie A.' },
                        { label: 'Vaches à lait.', text: 'Le Chili est le produit actif le plus vendu (14,9 %), mais ne rapporte que 1,82 $ par unité en moyenne. Deux leviers : réduire son coût (recette, fournisseur, rendement) ou relever légèrement son prix, en vérifiant l\'effet avec la simulation de prix de l\'onglet Production.' },
                        { label: 'Dilemmes.', text: 'Ils rapportent beaucoup par unité mais se vendent peu : travaillez leur présentation, leur promotion, leur place dans les canaux. Un produit rentable qu\'on ne vend pas ne fait gagner personne.' },
                        { label: 'Poids morts.', text: 'La sauce du Terroir ne rapporte que 0,15 $ par unité et se vend peu : réinventez-la (prix, recette) ou retirez-la. Avant de la retirer, vérifiez qu\'elle n\'est pas l\'ingrédient d\'une autre recette et qu\'elle ne sert pas à compléter une gamme.' },
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'La marge utilisée ici est la marge **brute** en dollars par unité, avant les frais fixes. Un produit « rentable » dans la matrice peut quand même avoir une marge nette négative dans un canal coûteux : confirmez toujours dans le rapport Par SKU.' },

                { type: 'h', id: 'guide-rapport-contribution', text: 'Classement par contribution totale au profit' },
                { type: 'p', text: 'Ce graphique à barres classe vos produits non par leur pourcentage de marge, mais par le **montant total en dollars** qu\'ils génèrent pour payer vos frais fixes : marge brute par unité × unités vendues. Il révèle vos véritables piliers financiers : un produit à 20 % de marge qui se vend en très grandes quantités peut peser plus qu\'un produit à 50 % qui se vend peu. Le bouton {{Voir tout}} affiche tous les produits.' },

                { type: 'h', id: 'guide-rapport-matrices', text: 'Les matrices par canal' },
                { type: 'p', text: 'Deux tableaux croisent vos produits ou activités avec vos canaux de vente.' },
                {
                    type: 'ul', items: [
                        { label: 'Bénéfices / pertes des activités par canaux.', text: 'Le bénéfice net, ou la perte, de chaque activité de production dans chacun de ses canaux, avec les totaux par activité et par canal.' },
                        { label: 'Marges nettes des SKUs par canaux.', text: 'La marge nette, en % du prix de vente, de chaque produit dans chacun de ses canaux. Le bouton {{Éditer le produit}} d\'une ligne ouvre la fiche du produit dans l\'onglet Production.' },
                    ],
                },
                { type: 'p', text: 'Un « — » signifie qu\'il n\'y a aucune vente dans ce canal : jamais un zéro inventé. Des codes de couleur permettent de repérer d\'un coup d\'œil les combinaisons qui font gagner ou perdre de l\'argent.' },
                { type: 'callout', kind: 'pourquoi', text: 'Ces matrices montrent où se cachent vos pertes. Une activité globalement rentable peut perdre de l\'argent dans un canal précis ; un canal qui fait beaucoup de chiffre d\'affaires peut ne rien rapporter.' },
                { type: 'callout', kind: 'retenir', text: 'Lisez dans cet ordre : les tuiles (santé générale), la matrice (quels produits), la contribution (qui paie les frais fixes), les matrices par canal (où l\'on perd).' },
                { type: 'words', items: [
                    { term: 'Marge brute moyenne pondérée', def: 'la marge brute moyenne des produits actifs, chaque produit pesant selon son revenu.' },
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
                        'Le même produit, avec le même coût de fabrication, est **rentable en vente directe** (marge nette de 17,80 %), à peine **à l\'équilibre en épicerie** (−1,07 %) et **déficitaire en grande surface** (−9,38 %). La seule différence est le prix net, que les maillons font baisser de 7,64 $ à 5,15 $.',
                        'Le produit est un des produits actifs les plus vendus : le canal où il perd le plus est aussi celui où il se vend le plus (5 665,00 $ de revenus contre 1 222,40 $ en vente directe).',
                        'La part de frais fixes propre à chaque canal (« Canal ») change aussi : 1,09 $ en vente directe, 0,81 $ en épicerie, 0,44 $ en grande surface, parce que ces coûts se répartissent sur des volumes différents.',
                        'Le point mort grimpe de 769 unités en vente directe à 1 932 en grande surface : il faut vendre bien plus pour couvrir les mêmes frais quand la marge unitaire est plus faible.',
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
                { type: 'p', text: 'Une seule activité, les mets principaux surgelés, est rentable (marge nette de 9,99 %) et porte l\'entreprise. Les deux autres perdent de l\'argent. Les sauces et accompagnements ont une marge brute de seulement 2,77 % : elle ne couvre presque rien des frais fixes, qui sont de 2 962,25 $. Leur point mort (106 858,30 $) est près de trente fois leur chiffre d\'affaires réel (3 690,30 $) : l\'activité, telle qu\'elle est aujourd\'hui, ne peut pas devenir rentable sans changer son prix ou son coût.' },
                { type: 'h', id: 'guide-canal-exemple', text: 'Lire Par Canal : le projet démo' },
                {
                    type: 'table', head: ['', 'Vente directe', 'Épiceries', 'Grandes surfaces'], rows: [
                        ['Revenu total', d(C.directe.revenu), d(C.epiceries.revenu), d(C.grandes.revenu)],
                        ['Bénéfice brut (marge brute)', `${d(C.directe.brut)} (${d(C.directe.margeBrute)})`, `${d(C.epiceries.brut)} (${d(C.epiceries.margeBrute)})`, `${d(C.grandes.brut)} (${d(C.grandes.margeBrute)})`],
                        ['Bénéfice net (marge nette)', `${d(C.directe.net)} (${d(C.directe.margeNette)})`, `${d(C.epiceries.net)} (${d(C.epiceries.margeNette)})`, `${d(C.grandes.net)} (${d(C.grandes.margeNette)})`],
                        ['Point mort', d(C.directe.pointMort), d(C.epiceries.pointMort), d(C.grandes.pointMort)],
                    ],
                },
                { type: 'p', text: 'Les grandes surfaces représentent près de 60 % du chiffre d\'affaires des produits actifs, mais perdent 2 312,94 $. La vente directe, la plus petite, est la plus rentable (marge nette de 20,32 %). Remarquez que la somme des bénéfices nets des canaux (2 385,11 $ + 287,67 $ − 2 312,94 $) est de 359,84 $ : c\'est le bénéfice net théorique de la réconciliation. Les trois rapports (par SKU, par activité, par canal) se recoupent exactement.' },
                { type: 'callout', kind: 'pourquoi', text: 'Ces deux rapports transforment des dizaines de produits en quelques lignes lisibles, celles sur lesquelles on peut agir : revoir le prix d\'une ligne de production, renégocier un canal, ou décider d\'en abandonner un.' },
                { type: 'callout', kind: 'retenir', text: 'Par Activité et Par Canal additionnent vos produits en segments. Comparez la marge nette des segments : ceux qui perdent de l\'argent sont vos priorités.' },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-rapport-intrants',
            title: 'Intrants : l\'évolution des prix d\'achat',
            blocks: [
                { type: 'p', text: 'Ce sous-onglet suit le prix de vos ingrédients et de vos emballages dans le temps, d\'un point de référence à l\'autre. Il se compose, pour chacune des deux familles, de deux éléments :' },
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
                { type: 'p', text: 'Ces mesures existent dès deux points de référence ; le projet démo en compte dix-neuf, ce qui donne des séries longues. Le tableau se croise avec l\'analyse ABC de l\'onglet Ingrédients : un ingrédient de catégorie A dont le prix est volatil est une priorité d\'approvisionnement.' },
                { type: 'callout', kind: 'astuce', text: 'Le tableau est trié par amplitude décroissante : les prix les plus capricieux sont en haut. Regardez d\'abord la colonne de tendance : un prix volatil mais sans tendance fluctue autour d\'une moyenne ; un prix à tendance haussière régulière appelle une action (contrat, second fournisseur, révision de prix).' },
                { type: 'p', text: 'Les emballages, un poste séparé, ont leur propre section : jamais fusionnés avec les ingrédients.' },
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
                        ['Coût matière au-dessus de la cible', 'Hausse de prix d\'un ingrédient ; recette trop généreuse ; pertes ou rendement mal estimés', 'Ingrédients (ABC, comparaison) ; Production (rendement) ; Rapport → Intrants', 'Comparer les fournisseurs ; ajuster la recette ; viser les ingrédients de catégorie A ; relever le prix (tester avec la simulation de prix)'],
                        ['Marge brute correcte, marge nette négative', 'Frais fixes lourds pour le volume vendu ; volumes plus faibles que prévu', 'Rapport → Par SKU (section Répartition des charges fixes) ; État des résultats', 'Augmenter le volume ; réduire les frais fixes ; relever le prix ; vérifier la règle de répartition (CICI)'],
                        ['Marge nette négative dans un seul canal', 'Maillons qui prélèvent trop ; frais propres au canal', 'Rapport → Par SKU, Par Canal ; Paramètres → Canaux de vente', 'Renégocier la marge d\'un intermédiaire ; ajuster le prix net ; retirer le produit de ce canal'],
                        ['Point mort supérieur à ce que vous pouvez vendre', 'Marge unitaire trop faible ; frais fixes trop élevés', 'Rapport → Par SKU (point mort), Vue d\'ensemble', 'Relever la marge (prix, coût) ; réduire les frais fixes ; simplifier la liste de produits'],
                        ['Taux d\'utilisation de la main-d\'œuvre bas', 'Trop de personnel pour le volume ; étapes sans personnel affecté ; ventes non saisies', 'Main-d\'œuvre → rapport de productivité', 'Vérifier les recettes ; réaffecter ou réduire des heures ; vendre plus avec la même équipe'],
                        ['Grand écart entre réel et théorique', 'Fiches périmées ; volumes non saisis ; classement différent des coûts ; temps non productif', 'État des résultats → Réconciliation', 'Mettre à jour prix et volumes ; vérifier le double comptage de la main-d\'œuvre ; revoir les recettes'],
                        ['Ingrédient de catégorie A au prix volatil', 'Marché instable ; dépendance à un fournisseur', 'Ingrédients (ABC) ; Rapport → Intrants', 'Contrat à prix fixe ; second fournisseur ; clause d\'indexation ; ajuster le prix de vente'],
                        ['Vache à lait (très vendu, peu rentable)', 'Prix trop bas pour son coût', 'Rapport → matrice stratégique des produits', 'Réduire le coût ; relever légèrement le prix ; tester avec la simulation'],
                        ['Poids mort (peu vendu, peu rentable)', 'Produit en fin de vie ; mauvaise place parmi les produits', 'Rapport → matrice stratégique des produits', 'Le repenser ; le retirer, après avoir vérifié qu\'il n\'est pas sous-recette d\'un autre'],
                        ['Un produit paraît trop rentable pour être vrai', 'Ingrédients ou emballages sans prix ; étapes sans personnel ; quantités pour une portion', 'Panneau « points à vérifier » ; Production', 'Compléter les prix ; affecter le personnel ; saisir les quantités du lot entier'],
                    ],
                },
                { type: 'callout', kind: 'retenir', text: 'Un chiffre inquiétant est un point de départ, pas un verdict. Remontez toujours à sa cause (le prix, le coût, le volume, la répartition) avant d\'agir : l\'application permet de tester une décision (simulation de prix, simulation de chocs) avant de la prendre.' },
            ],
        },
    ],
};
