import { fromApp, money, num } from '../guideFormat.js';
import { DEMO, DOUBLE_COMPTAGE } from '../guideNumbers.js';

// Partie 2 — Utiliser l'application. Chapitres « État des résultats » et « Production ».

const d = fromApp;

// Grille de rendement : exemple du chapitre Production
const GRILLE = (() => {
    const depart = 1000; // kg
    const cuisson = -0.2;
    const eau = 0.1;
    const rejet = 0.02;
    const apresCuisson = depart * (1 + cuisson);
    const apresEau = apresCuisson * (1 + eau);
    const fini = apresEau * (1 - rejet);
    const taille = 0.4; // kg par unité (400 g)
    return { depart, cuisson, eau, rejet, apresCuisson, apresEau, fini, taille, unites: fini / taille };
})();

export const chapitreEtatResultats = {
    id: 'guide-etat-resultats',
    title: 'Onglet 6 — État des résultats',
    lead: 'Vos revenus et vos frais réels, tels que votre comptabilité les enregistre : le pont entre le modèle et la réalité.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'Les onglets précédents construisent un **modèle** : ce que vos recettes et vos prix impliquent. Cet onglet reçoit le **réel** : ce que votre comptabilité a enregistré. Il sert à deux choses : répartir vos frais fixes sur chaque produit, pour obtenir le coût de revient complet, et vérifier que votre modèle colle à la réalité (la réconciliation). Voir le [[guide-concept-reel-theorique|chapitre 13]] de la Partie 1.' },
        { type: 'p', text: 'Il se lit de haut en bas, comme un état des résultats : la période, les revenus, les charges directes, le bénéfice brut, les frais fixes, le bénéfice net, puis deux sections d\'analyse (le CICI et la réconciliation). Les colonnes de droite montrent comment chaque ligne se répartit entre vos activités de production (en jaune) et vos canaux de vente (en bleu).' },

        { type: 'h', id: 'guide-ff-periode', text: 'Période de référence' },
        { type: 'p', text: 'Tout en haut, saisissez la {{Date de début}} et la {{Date de fin}} de la période que couvrent les montants ci-dessous. L\'assistant d\'importation la renseigne seul quand le fichier contient des dates ; sinon, saisissez-la.' },
        { type: 'callout', kind: 'attention', text: 'Les trois sources de chiffres doivent couvrir **la même période** : les montants de cet onglet, les volumes de vente de Produits et SKUs, et les heures travaillées de Main-d\'œuvre. Comparer un état des résultats annuel à des volumes mensuels produit des écarts sans signification.' },

        { type: 'h', id: 'guide-ff-revenus', text: 'Revenus' },
        { type: 'p', text: 'Chaque ligne est un poste de revenu réel (par exemple « Ventes — Soupes et potages »), avec son montant. La {{Clé de répartition}} indique à quoi il se rattache : « Général » (un revenu qu\'on ne peut pas attribuer à une activité), une **activité de production** précise, ou « Saisie manuelle » pour ventiler librement un même poste entre plusieurs activités.' },
        { type: 'p', text: 'À droite, la ventilation par **canal de vente** est calculée automatiquement à partir de votre répartition des ventes déclarée. C\'est une estimation indicative, pas une donnée vérifiée : elle n\'entre dans aucun calcul.' },
        { type: 'callout', kind: 'exemple', text: `Revenus du projet démo : 45 000 $ (mets principaux surgelés), 20 000 $ (soupes et potages), 12 500 $ (sauces et accompagnements) et 2 500 $ de revenus divers rattachés à « Général », pour un total de ${d(DEMO.etat.revenus)}.` },

        {
            type: 'table', caption: 'Les colonnes du tableau des revenus', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
            rowIds: [null, 'guide-ff-rev-categorie', 'guide-ff-rev-cle', 'guide-ff-rev-general', 'guide-ff-rev-activites', 'guide-ff-rev-canaux'],
            rows: [
                ['{{Poste de revenu}}, {{Montant ($)}}', 'Le libellé et le montant réel du revenu.'],
                ['{{Catégorie}}', 'Rien à saisir : un revenu n\'a pas de catégorie comptable à classer, contrairement aux charges. La colonne existe seulement pour que les trois tableaux de l\'onglet gardent la même forme.'],
                ['{{Clé de répartition}}', 'Où compter ce revenu : « Général », une activité précise, ou « Saisie manuelle » pour répartir un même revenu entre plusieurs activités à la fois.'],
                ['{{Général}}', 'La part du revenu qu\'on ne peut pas rattacher à une activité de production précise (revenus divers, intérêts).'],
                ['Colonnes des activités', 'La répartition du revenu entre vos activités de production, selon la clé choisie.'],
                ['{{Canaux de vente (indicatif)}}', 'Estimée automatiquement à partir de la répartition des ventes déclarée : jamais une donnée saisie ni un intrant de calcul, uniquement informative.'],
            ],
        },
        { type: 'h', id: 'guide-ff-charges-directes', text: 'Charges directes réelles' },
        { type: 'p', text: 'Ici, vous saisissez vos charges de production, classées par **nature** : {{Matière première}}, {{Main-d\'œuvre directe}}, {{Emballage}} ou {{Sous-traitance}}. Ces quatre types correspondent exactement aux familles de coûts de vos recettes ([[guide-concept-familles|chapitre 2]]), ce qui rend la comparaison avec le modèle possible.' },
        { type: 'p', text: 'Contrairement aux revenus, vous ne choisissez pas l\'activité ni le canal ligne par ligne : chaque montant est réparti automatiquement selon le coût théorique de **même type** (une charge de matière première se répartit selon le coût théorique de matière première de chaque activité, jamais selon un autre type). Cette répartition est indicative.' },
        { type: 'callout', kind: 'exemple', text: `Charges directes du projet démo : 31 800 $ de matières premières, 9 300 $ de main-d'œuvre de production, 5 900 $ d'emballage et 1 000 $ de sous-traitance (surgélation), soit ${d(DEMO.etat.chargesDirectes)}.` },
        { type: 'callout', kind: 'attention', text: 'La main-d\'œuvre qui figure dans votre onglet Main-d\'œuvre se saisit **ici**, dans « Main-d\'œuvre directe », même si votre comptable la range sous « Salaires ». Voir la règle expliquée dans la section Frais fixes ci-dessous.' },

        {
            type: 'table', caption: 'Les colonnes du tableau des charges directes', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
            rowIds: [null, 'guide-ff-cd-categorie', 'guide-ff-cd-cle', 'guide-ff-cd-general', 'guide-ff-cd-activites', 'guide-ff-cd-canaux'],
            rows: [
                ['{{Poste de charge directe}}, {{Montant ($)}}', 'Le libellé et le montant réel de la charge.'],
                ['{{Catégorie}}', 'Le type de coût selon sa nature : matière première (ingrédients), main-d\'œuvre directe (salaires de production), emballage, ou sous-traitance (services externes de production).'],
                ['{{Clé de répartition}}', 'Non applicable ici : contrairement aux revenus, la répartition par activité et par canal se calcule automatiquement à partir du type de coût choisi. Rien à saisir dans cette colonne.'],
                ['{{Général}}', 'La part de la charge qui n\'a pas pu être rattachée à une activité précise : aucune recette n\'a de coût théorique de ce type pour en déduire la répartition.'],
                ['Colonnes des activités (indicatif)', 'Estimée automatiquement à partir du coût théorique de vos recettes **du même type de coût**. Jamais une donnée saisie ni un intrant de calcul.'],
                ['Colonnes des canaux (indicatif)', 'Estimée automatiquement à partir du coût théorique et du volume réel de chaque canal. Uniquement informative.'],
            ],
        },
        { type: 'h', id: 'guide-ff-benefice-brut', text: 'Bénéfice brut' },
        { type: 'p', text: 'Une barre de synthèse : **revenus moins charges directes réelles**, avant les frais fixes. Elle reprend les totaux des deux tableaux ci-dessus et se ventile **par activité** (deux totaux réels, directement soustraits). Elle n\'offre pas de détail par canal : les charges directes ne sont pas toutes connues par canal, et l\'application refuse de soustraire un côté inventé.' },
        { type: 'p', text: `Projet démo : ${d(DEMO.etat.revenus)} − ${d(DEMO.etat.chargesDirectes)} = **${d(DEMO.etat.beneficeBrut)}**.` },

        { type: 'h', id: 'guide-ff-liste', text: 'Frais fixes' },
        { type: 'p', text: 'Listez ici chaque dépense qui n\'est pas liée à un produit précis : loyer de l\'atelier, électricité, marketing, salaires d\'administration, assurances, frais bancaires. Pour chaque poste, indiquez un libellé, une catégorie (frais généraux de production, frais de vente / mise en marché, frais d\'administration ou frais financiers) et un montant. __Pourquoi ?__ Le total de cette liste est ce que vos produits doivent payer, en plus de leurs coûts directs, pour que l\'entreprise soit rentable. Ce total alimente le coût de revient complet de chaque produit.' },

        { type: 'h', id: 'guide-ff-regle', text: 'Charge directe ou frais fixe ? La règle', level: 5 },
        { type: 'p', text: 'Une charge directe est un coût qui s\'attache à la fabrication d\'un produit : matières, emballage, sous-traitance, main-d\'œuvre de production. Un frais fixe est un coût de l\'entreprise que l\'on répartit ensuite sur les produits. Pour la main-d\'œuvre, la question n\'est pas « est-ce de la cuisine ? » mais **« ce coût est-il déjà modélisé dans l\'application ? »** :' },
        {
            type: 'ul', items: [
                'Les postes de l\'onglet Main-d\'œuvre qui servent aux étapes de production sont déjà comptés dans le coût de chaque recette (durée de l\'étape × coût horaire chargé du poste, augmentée de la part de capacité inutilisée). Saisissez leur coût réel dans **Charges directes réelles → Main-d\'œuvre directe**, jamais dans les frais fixes.',
                'La main-d\'œuvre qui n\'est pas dans l\'onglet (gérant, administration, ventes) va dans les **frais fixes**.',
                'Une personne qui fait les deux (par exemple cuisine et vente) se partage : la part de ses heures en production va dans l\'onglet Main-d\'œuvre, le reste en frais fixes.',
            ],
        },
        { type: 'h', id: 'guide-ff-exemples', text: 'Où saisir quoi ? Quelques exemples', level: 5 },
        {
            type: 'ul', items: [
                'Achats de matières premières, emballages, sous-traitance : charges directes.',
                'Salaires de la cuisine (postes de l\'onglet Main-d\'œuvre) : charges directes, « Main-d\'œuvre directe », même si votre comptable les range sous « Salaires ».',
                'Salaire du gérant, de l\'administration, du représentant : frais fixes.',
                'Loyer et électricité de l\'atelier, assurances, comptabilité, frais bancaires : frais fixes.',
            ],
        },
        { type: 'h', id: 'guide-ff-double-comptage', text: 'Pourquoi cette règle : l\'exemple du double comptage', level: 5 },
        { type: 'callout', kind: 'exemple', blocks: [
            { type: 'p', text: `Vos cuisiniers coûtent ${money(DOUBLE_COMPTAGE.cuisiniers, 0)} par an et sont dans l'onglet Main-d'œuvre. Vos autres frais fixes sont le loyer (${money(DOUBLE_COMPTAGE.loyer, 0)}) et le salaire du gérant (${money(DOUBLE_COMPTAGE.gerant, 0)}).` },
            {
                type: 'table', head: ['Saisie', 'Frais fixes', 'Conséquence'], wrapCells: true, rows: [
                    ['Correcte : cuisiniers en charges directes', money(DOUBLE_COMPTAGE.correct, 0), 'Chaque produit porte ses heures de cuisine une seule fois.'],
                    ['Erreur : cuisiniers aussi en frais fixes', money(DOUBLE_COMPTAGE.erreur, 0), 'Chaque produit porte ses heures de cuisine **deux fois** : sa marge nette est sous-estimée.'],
                ],
            },
            { type: 'p', text: 'Votre bénéfice net réel, lui, ne change pas : seul le partage entre bénéfice brut et bénéfice net est faussé. L\'application est un outil de coût de revient, pas votre grand livre : elle peut classer autrement que votre comptable sans que votre profit change.' },
        ] },
        { type: 'p', text: 'Si un libellé de frais fixes ressemble à de la main-d\'œuvre de production (par exemple « Salaires cuisine »), un rappel s\'affiche au-dessus du tableau, avec un lien vers cette section. Vous pouvez l\'ignorer s\'il s\'agit de personnel hors modèle.' },

        { type: 'h', id: 'guide-ff-fixe-variable', text: 'Fixe ou variable ? Deux regards, et le temps non productif', level: 5 },
        { type: 'p', text: 'Une cuisine salariée coûte la même chose que vous vendiez beaucoup ou peu : c\'est un coût fixe dans la réalité. L\'application la regarde pourtant de deux façons, selon la question posée. __Par unité :__ chaque recette porte le coût de ses propres heures, pour savoir ce que coûte un produit. __Point mort :__ la main-d\'œuvre de production est traitée comme un coût fixe pour la période, parce que la question est « combien dois-je vendre pour couvrir mes coûts ? ».' },
        { type: 'p', text: 'L\'application répartit sur vos recettes le coût de **toutes les heures payées** de **tous les postes** de l\'onglet Main-d\'œuvre : les heures employées, la **capacité de production payée mais non utilisée** et le temps **non productif** (nettoyage, réunions, administration, déjà reflété par le « % temps productif attendu » de chaque employé). C\'est le « coût du temps non productif » de la main-d\'œuvre dans l\'onglet Production. La paie de la cuisine se retrouve donc entièrement dans le coût des produits, sans que vous ayez à saisir ce temps ailleurs.' },

        { type: 'h', id: 'guide-ff-repartir', text: 'Répartir une dépense', level: 5 },
        { type: 'p', text: 'Les colonnes de droite permettent de répartir chaque dépense entre « Général », vos activités et vos canaux. La somme des colonnes ne doit pas dépasser le montant de la ligne : un indicateur (coche verte ou avertissement) le confirme, sans jamais bloquer ; une dépense qui ne s\'applique naturellement qu\'à une partie des colonnes (un loyer n\'a pas de canal) laisse simplement les autres vides.' },
        { type: 'p', text: 'La {{Clé de répartition}} de chaque ligne propose plusieurs raccourcis :' },
        {
            type: 'ul', itemIds: ['guide-ff-cle-manuelle', 'guide-ff-cle-defaut', 'guide-ff-cle-precise', 'guide-ff-cle-personnalisee'], items: [
                { label: 'Manuel.', text: 'Vous saisissez vous-même les montants dans chaque colonne.' },
                { label: 'Selon les ventes, Selon les charges directes.', text: 'Le montant se répartit au prorata de vos revenus ou de vos charges directes réels saisis plus haut, **uniquement entre vos activités** (jamais vos canaux, dont la ventilation dans les sections Revenus et Charges directes est indicative).' },
                { label: 'Une activité ou un canal précis.', text: 'Le montant entier va à cette colonne. C\'est la façon d\'assigner une dépense à un canal.' },
                { label: 'Une clé personnalisée.', text: 'Une ventilation en pourcentages que vous définissez une fois et réutilisez sur plusieurs lignes. Elle se crée avec le bouton {{Gérer les clés de répartition}}, en haut de l\'onglet : donnez un nom à la clé, puis saisissez un pourcentage par activité et par canal. Une ligne qui applique une clé est verrouillée ; la repasser en Manuel la rend de nouveau modifiable.' },
            ],
        },
        {
            type: 'table', caption: 'Les colonnes du tableau des frais fixes', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
            rowIds: [null, 'guide-ff-fx-categorie', 'guide-ff-fx-cle', 'guide-ff-fx-general', 'guide-ff-fx-activites', 'guide-ff-fx-canaux'],
            rows: [
                ['{{Poste de dépense}}, {{Montant ($)}}', 'Le libellé et le montant réel de la dépense.'],
                ['{{Catégorie}}', 'La fonction de l\'entreprise à laquelle la dépense se rattache. Elle **suggère**, sans l\'imposer, une colonne par défaut : frais généraux de production → Général ou une activité ; frais de vente et de mise en marché → Général ou un canal de vente ; frais d\'administration et frais financiers → Général.'],
                ['{{Clé de répartition}}', 'Un raccourci optionnel qui pré-remplit la grille (voir la liste ci-dessus). Manuel laisse la grille telle quelle.'],
                ['{{Général}}', 'Une allocation à l\'entreprise entière, sans lien de causalité avec une activité ou un canal précis (salaire de direction, assurance générale). C\'est ce qu\'on appelle les **frais de structure** : ils existent même si vous ne fabriquez rien.'],
                ['Colonnes des activités', 'La part de la dépense attribuée à chaque activité de production. La somme des cellules remplies est comparée au montant de la ligne : une coche verte indique que la répartition est complète, un avertissement qu\'elle ne l\'est pas.'],
                ['Colonnes des canaux', 'La part attribuée à chaque canal de vente : un axe **indépendant** des activités. Une même dépense peut être répartie sur les deux à la fois, ou sur un seul si l\'autre ne s\'applique pas. Les valeurs dérivées d\'une clé sont verrouillées ; passez la ligne en Manuel pour les modifier.'],
            ],
        },
        { type: 'callout', kind: 'exemple', text: `Dans le projet démo, l'électricité (3 000 $) utilise la clé « Selon les charges directes » : les activités qui coûtent le plus cher à fabriquer en reçoivent la plus grande part (1 721,90 $, 813,69 $ et 464,41 $). Le loyer de l'espace de production (9 000 $) est réparti manuellement : 5 000 $, 2 500 $ et 1 500 $. Le total des frais fixes est de ${d(DEMO.etat.fraisFixes)}.` },

        { type: 'h', id: 'guide-ff-benefice-net', text: 'Bénéfice net' },
        { type: 'p', text: `Une seconde barre de synthèse : **bénéfice brut moins frais fixes**, affichée **au total de l'entreprise**, sans détail par activité ni par canal. Projet démo : ${d(DEMO.etat.beneficeBrut)} − ${d(DEMO.etat.fraisFixes)} = **${d(DEMO.etat.beneficeNet)}**.` },

        { type: 'h', id: 'guide-ff-cici', text: 'Coefficient d\'imputation des charges indirectes (CICI)' },
        { type: 'p', text: 'Une fois qu\'un bassin de frais fixes est attribué à « Général » ou à une activité (par la clé de répartition ci-dessus), il faut le répartir entre les produits qui le portent : c\'est le rôle du CICI. Vous choisissez, pour « Général » et pour chaque activité, la règle de répartition :' },
        {
            type: 'ul', items: [
                { label: 'Au prorata des coûts directs (par défaut) :', text: 'les produits chers à fabriquer portent davantage de frais fixes.' },
                { label: 'Au prorata du temps de production :', text: 'les produits qui occupent plus d\'heures de main-d\'œuvre en portent davantage.' },
                { label: 'Au prorata du volume physique :', text: 'selon les kg ou les L vendus. Utile quand le frais suit l\'encombrement (entreposage réfrigéré, capacité d\'entrepôt) plutôt que la valeur ou la cadence. Précisez alors la famille physique (Masse ou Volume) : un produit d\'une autre famille, par exemple vendu à l\'unité, reste simplement hors de ce calcul, sans conversion inventée.' },
            ],
        },
        { type: 'callout', kind: 'exemple', text: 'Un bassin de 10 000 $ réparti entre deux produits dont les coûts directs totalisent 6 000 $ et 4 000 $ donne 6 000 $ de frais fixes au premier et 4 000 $ au second.' },
        { type: 'p', text: '« Général » se répartit sur l\'ensemble des produits actifs ; chaque activité seulement entre ses propres produits. Les canaux n\'ont pas de CICI : leur coût indirect est toujours un % d\'imputation sur le coût direct (Paramètres → Canaux de vente), jamais une règle au choix.' },

        { type: 'h', id: 'guide-ff-rec-lien', text: 'La réconciliation réel / théorique' },
        { type: 'p', text: 'La comparaison de ces chiffres réels avec ce que prévoit votre modèle de recettes se trouve dans l\'onglet {{Rapport et suivi}}, sous-onglet {{Vue d\'ensemble}}. Voir [[guide-ff-reconciliation|Réconciliation réel / théorique]].' },

        { type: 'h', id: 'guide-ff-import', text: 'Importer l\'état des résultats' },
        { type: 'p', text: 'Le bouton {{Importer l\'état des résultats}} remplit les tableaux **Revenus** et **Frais fixes** à partir d\'un fichier : le plus souvent un **PDF textuel** exporté par votre comptable ou votre logiciel comptable (pas une image numérisée), ou un export structuré (QuickBooks, Odoo…) en .csv, .xls ou .xlsx. Les charges directes ne sont pas importées : saisissez-les à la main.' },
        {
            type: 'steps', items: [
                { label: 'Téléverser.', text: 'Choisissez le fichier. Pour un classeur Excel, l\'assistant lit le premier onglet.' },
                { label: 'Faire correspondre les colonnes.', text: 'Pour un fichier structuré : le poste (description) et le montant sont obligatoires ; le type (revenu ou dépense), la catégorie comptable, le produit ou SKU visé (revenus seulement) et la date sont facultatifs. Un PDF passe directement à l\'étape suivante.' },
                { label: 'Vérifier et résoudre.', text: 'Pour chaque ligne, vérifiez le poste et le montant (modifiables, utile surtout pour un PDF dont le texte est reconstitué automatiquement), le **type** (revenu ou dépense), puis la catégorie (pour une dépense) ou l\'activité visée (pour un revenu : « Général » si aucun produit n\'a été reconnu). Une ligne à 0 $ est désélectionnée par défaut. L\'assistant propose la catégorie de frais fixes d\'après des mots-clés (loyer, assurance, marketing…).' },
                { label: 'Confirmer.', text: 'Choisissez entre **Ajouter à mes lignes existantes** (recommandé : vos lignes déjà saisies restent intactes) et **Remplacer entièrement** vos lignes de revenus et de frais fixes par celles du fichier.' },
            ],
        },
        { type: 'callout', kind: 'attention', text: 'Relisez toujours les lignes importées d\'un PDF : la reconnaissance du texte peut se tromper de poste ou de signe. Et rappelez-vous la règle des frais fixes : un salaire de cuisine importé dans les frais fixes sera compté deux fois.' },

        { type: 'callout', kind: 'retenir', text: 'L\'État des résultats reçoit le réel. Les charges directes suivent la nature de vos recettes (matières, main-d\'œuvre, emballage, sous-traitance) ; les frais fixes se répartissent entre Général, activités et canaux, puis entre les produits par le CICI. La réconciliation mesure l\'écart avec votre modèle.' },
        { type: 'words', items: [
            { term: 'Bénéfice brut / net (État des résultats)', def: 'revenus moins charges directes ; puis moins frais fixes. À distinguer de la marge brute et nette d\'un produit, calculées par unité.' },
            { term: 'Clé de répartition', def: 'la façon de ventiler un frais fixe entre Général, activités et canaux.' },
            { term: 'CICI', def: 'la règle qui répartit le bassin de frais fixes d\'une activité entre ses produits.' },
            { term: 'Réconciliation', def: 'la comparaison entre le réel et le théorique.' },
        ] },
    ],
};

// ====================================================================================================

export const chapitreProduction = {
    id: 'guide-production',
    title: 'Onglet 5 — Production',
    lead: 'Le cœur de l\'application : la fiche de coût détaillée de chaque format. Chaque modification met à jour les coûts en temps réel.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'C\'est ici que se construit le **coût de production** de chaque produit : combien de matière, quel emballage, combien de temps de travail. Tout le reste de l\'application (marges, point mort, rapports) en dépend. Plus la fiche est fidèle à ce qui se passe réellement dans l\'usine, plus vos décisions seront justes.' },

        { type: 'h', id: 'guide-prod-selection', text: 'Choisir un produit et un format' },
        { type: 'p', text: 'En haut, la liste {{Production pour :}} sert à choisir le produit. Dessous, la rangée {{FORMAT}} montre les formats de ce produit (par exemple « 340 g » et « 900 g »), le format par défaut étant marqué {{défaut}}. Chaque format a une fiche recette **entièrement indépendante** : ses ingrédients, ses étapes, ses coûts.' },
        { type: 'p', text: 'Le bouton {{Ajouter un format}} ouvre une fenêtre pour créer un nouveau format sans quitter l\'onglet : quantité, unité, un SKU facultatif (déduit sinon), et la **fiche de départ** : {{Vierge}}, ou une copie en bloc de la fiche d\'un format existant, pratique pour un format très semblable. Le nouveau format apparaît aussitôt dans Paramètres → Produits et SKUs.' },
        { type: 'callout', kind: 'astuce', text: 'Une fois plusieurs formats créés, chaque section (ingrédients, processus de production, coûts additionnels, quantité produite et rendement) affiche un petit contrôle {{Copier depuis un format}} pour copier **uniquement cette section** d\'un autre format du même produit. La quantité et l\'unité d\'un format ne sont jamais copiées : c\'est justement ce qui les distingue.' },

        { type: 'h', id: 'guide-prod-entete', text: 'L\'en-tête de la fiche' },
        { type: 'h', id: 'guide-prod-quantite', text: 'La quantité produite : la recette est pour le lot entier', level: 5 },
        { type: 'p', text: 'Le rappel {{Format de ce SKU}} indique la quantité et l\'unité du format (modifiables dans Paramètres, pas ici). Le champ {{Quantité produite}} indique **combien d\'unités de ce format la recette complète permet de produire**. C\'est le plus important de l\'en-tête : toutes les quantités de la fiche (ingrédients, emballage, durée des étapes) sont pour **ce lot entier**, jamais pour une seule portion. Le coût par unité est ensuite le coût du lot divisé par cette quantité.' },
        { type: 'callout', kind: 'attention', text: 'L\'erreur la plus fréquente : saisir les quantités d\'ingrédients pour **une** portion alors que la quantité produite est de 20. Le coût par unité sera alors vingt fois trop bas. Saisissez toujours la recette complète, et indiquez combien d\'unités elle donne.' },

        { type: 'h', id: 'guide-prod-grille', text: 'La grille de rendement', level: 5 },
        { type: 'p', text: 'Plutôt que de taper la quantité produite, vous pouvez la calculer : cochez {{Calculer le nombre d\'unités produites à partir d\'une grille de rendement}}. Vous indiquez une **quantité de départ** de matière première, une suite d\'**étapes de transformation** (chacune avec un effet en % sur la quantité : négatif pour une perte, positif pour un gain), puis un **taux de rejet des produits finis**, appliqué après coup. La quantité produite est alors : quantité de départ × (1 + effet de chaque étape) × (1 − rejet) ÷ taille du format.' },
        { type: 'callout', kind: 'exemple', blocks: [
            { type: 'p', text: `On part de ${num(GRILLE.depart)} kg de matière. La cuisson fait perdre 20 % du poids, un ajout d'eau le fait regagner 10 %, et 2 % des produits finis sont rejetés au contrôle qualité. Le format est de 400 g.` },
            {
                type: 'table', head: ['Étape', 'Calcul', 'Résultat'], rows: [
                    ['Départ', '', `${num(GRILLE.depart)} kg`],
                    ['Après la cuisson (−20 %)', `${num(GRILLE.depart)} × 0,80`, `${num(GRILLE.apresCuisson)} kg`],
                    ['Après l\'ajout d\'eau (+10 %)', `${num(GRILLE.apresCuisson)} × 1,10`, `${num(GRILLE.apresEau)} kg`],
                    ['Après le rejet (−2 %)', `${num(GRILLE.apresEau)} × 0,98`, `${num(GRILLE.fini, 1)} kg`],
                    ['Unités de 400 g', `${num(GRILLE.fini, 1)} ÷ 0,4`, `${num(GRILLE.unites)} unités`],
                ], boldLast: true,
            },
        ] },
        { type: 'p', text: 'Le rejet est distinct d\'une perte de procédé : il retire des unités déjà produites. Les mélanger fausserait l\'analyse de chacun.' },

        { type: 'h', id: 'guide-prod-sous-recette', text: 'Sous-recette et produit de revente', level: 5 },
        {
            type: 'ul', items: [
                { label: 'Considérer comme une sous-recette (mise en place).', text: 'Cochez cette case pour une recette de base (une sauce, une garniture, un bouillon) qui servira d\'**ingrédient** dans d\'autres recettes. Elle apparaît alors dans la liste des ingrédients des recettes et de la base. Quand une recette l\'utilise, elle n\'apporte que son **coût direct** (jamais ses frais fixes), pour que les frais fixes ne soient pas comptés deux fois : le produit final porte les siens.' },
                { label: 'Considérer comme un produit de revente.', text: 'Cochez cette case pour un format acheté et revendu tel quel (boissons, croustilles d\'un fournisseur). La fiche se simplifie à un seul champ, {{Coût d\'achat par unité ($)}} ; les sections ingrédients, emballage et processus disparaissent, puisque le coût d\'achat couvre tout. Les allergènes se cochent alors à la main.' },
            ],
        },
        { type: 'p', text: 'Sous ces cases, la recette affiche la liste des **allergènes détectés** à partir des ingrédients (voir le chapitre Ingrédients).' },

        // -----------------------------------------------------------------------------
        { type: 'h', id: 'guide-prod-ingredients', text: '1. Ingrédients' },
        { type: 'p', text: 'Ajoutez chaque ingrédient de la recette avec {{+ Ajouter un ingrédient}}. Vous pouvez réorganiser les lignes par glisser-déposer.' },
        {
            type: 'table', head: ['Colonne', 'Ce que vous y mettez'], wrapCells: true, rowIds: [null, null, null, null, 'guide-prod-col-rendement', null], rows: [
                ['{{Ingrédient}}', 'Choisissez dans votre base ; les sous-recettes sont proposées aussi.'],
                ['{{Quantité}}', 'La quantité nécessaire pour le **lot entier**, dans l\'unité choisie.'],
                ['{{Unité}}', 'S\'ajuste à l\'ingrédient ; vous pouvez la changer pour une unité compatible de la même famille (g vers kg, ml vers L). Le coût est recalculé.'],
                ['{{Coût U. ($)}}', 'Le prix unitaire de l\'ingrédient (lecture seule).'],
                ['{{Rendement (%)}}', 'La part qui reste après la transformation (épluchage, parage, cuisson). Voir [[guide-concept-rendement|chapitre 3]]. 100 si rien ne se perd.'],
                ['{{Coût total ($)}}', 'Calculé : quantité × prix unitaire, avec la perte en stock puis le rendement.'],
            ],
        },
        { type: 'p', text: 'Sous le tableau, quatre totaux : le **coût matières de base**, le **coût des pertes en stock**, le **total des coûts matières de la recette**, et le **coût matières par unité** (le total divisé par la quantité produite).' },
        { type: 'callout', kind: 'exemple', text: `Chili con carne mijoté (projet démo), lot de 20 unités de 400 g : coût de base ${d(DEMO.chili.baseMatiere)}, pertes en stock ${d(DEMO.chili.pertesMatiere)}, total ${d(DEMO.chili.totalMatiereRecette)}. Divisé par 20 unités : **${d(DEMO.chili.coutMatiere)}** de matière par unité.` },

        { type: 'h', id: 'guide-prod-emballage', text: '2. Emballage' },
        { type: 'p', text: 'Ajoutez les emballages de ce format avec {{+ Ajouter un emballage}} : pots, couvercles, étiquettes, boîtes. Les colonnes sont celles des ingrédients, sans le rendement. La quantité est celle du lot entier (un pot, un couvercle et une étiquette par unité produite, multipliés par la quantité produite). Cette section est absente pour un produit de revente.' },
        { type: 'callout', kind: 'exemple', text: `Chili con carne mijoté : ${d(DEMO.chili.baseEmballage)} d'emballage de base, ${d(DEMO.chili.pertesEmballage)} de pertes, total ${d(DEMO.chili.totalEmballageRecette)}, soit **${d(DEMO.chili.coutEmballage)}** par unité.` },

        { type: 'h', id: 'guide-prod-processus', text: '3. Processus de production et main-d\'œuvre' },
        { type: 'p', text: 'Cette section calcule le coût du travail. Chaque ligne du tableau est une **étape de production** (« Mijotage », « Portionnement et scellage »).' },
        {
            type: 'steps', itemIds: ['guide-prod-col-etape', 'guide-prod-col-personnel', 'guide-prod-col-debut-duree'], items: [
                'Cliquez sur {{+ Ajouter une étape}} et nommez-la.',
                'Cliquez sur {{Modifier}} dans la colonne **Personnel** : une fenêtre propose chacun de vos postes (avec le nombre d\'employés disponibles) ; indiquez combien de personnes de chaque poste travaillent à cette étape.',
                'Saisissez le **Début** (le moment où l\'étape commence, mesuré depuis le début de la recette) et la **Durée** (la durée totale de l\'étape), tous deux au format HH:MM:SS. La colonne **Fin** se calcule seule.',
            ],
        },
        { type: 'p', text: 'Le début d\'une étape n\'est pas forcément la fin de la précédente : deux étapes peuvent se chevaucher quand plusieurs personnes travaillent en parallèle. Le **diagramme de production** (de Gantt) sous le tableau montre le déroulement du lot dans le temps, en gérant les chevauchements. Chaque poste a sa ligne ; les étapes sans personne affectée (refroidissement, repos, cuisson sans surveillance) sont regroupées dans une ligne grise {{Sans main-d\'œuvre}}, pour que toute la recette soit visible. Elles n\'ajoutent aucun coût de main-d\'œuvre.' },
        { type: 'p', text: 'Pour chaque étape, trois coûts s\'affichent :' },
        {
            type: 'ul', itemIds: ['guide-prod-col-cout-direct', 'guide-prod-col-cout-indirect', 'guide-prod-col-cout-total'], items: [
                { label: 'Coût du temps productif.', text: 'La durée de l\'étape × le coût horaire moyen du poste × le nombre de personnes : le salaire des heures réellement employées.' },
                { label: 'Coût du temps non productif.', text: 'Les heures payées qui ne servent pas à produire (capacité inutilisée, nettoyage, réunions), absorbées par cette étape (voir [[guide-concept-capacite|chapitre 10]]). Plus le taux d\'utilisation de votre équipe est bas, plus ce coût est élevé. Ce n\'est pas un frais indirect : c\'est de la main-d\'œuvre de production, payée mais non productive.' },
                { label: 'Coût total.', text: 'La somme des deux.' },
            ],
        },
        { type: 'p', text: 'Trois indicateurs résument l\'organisation du travail :' },
        {
            type: 'ul', itemIds: ['guide-prod-ind-duree', 'guide-prod-ind-temps-personnel', 'guide-prod-ind-intensite'], items: [
                { label: 'Durée Processus.', text: 'Le temps total écoulé entre le début de la première étape et la fin de la dernière.' },
                { label: 'Temps Personnel.', text: 'La somme du temps de travail de chaque personne. Exemple : 10 minutes avec 2 cuisiniers font 20 minutes de personnel.' },
                { label: 'Intensité de main-d\'œuvre.', text: 'Temps Personnel ÷ Durée Processus. Une intensité de 1,00 signifie qu\'une personne travaille à la fois ; au-dessus de 1, plusieurs personnes travaillent en même temps.' },
            ],
        },
        { type: 'callout', kind: 'exemple', text: `Chili con carne mijoté : la durée du processus est de 21,7 minutes, pour une intensité de 1,00 (une personne à la fois). La main-d'œuvre directe du lot est de ${d(DEMO.chili.moDirectRecette)} et la part indirecte de ${d(DEMO.chili.moIndirectRecette)}, soit ${d(DEMO.chili.totalMORecette)} pour le lot, donc **${d(DEMO.chili.coutMO)}** par unité.` },
        { type: 'callout', kind: 'attention', text: 'Une étape sans personnel affecté ne coûte rien : le coût de main-d\'œuvre serait nul, et la recette paraîtrait plus rentable qu\'elle ne l\'est. Vérifiez que chaque étape a bien son personnel.' },

        { type: 'h', id: 'guide-prod-additionnels', text: '4. Coûts additionnels' },
        { type: 'p', text: 'Deux postes facultatifs, regroupés ici parce qu\'ils ne concernent pas tous les produits, pas parce qu\'ils se comptent de la même façon. Un badge indique la nature de chaque coût : {{charge directe}} (bleu), {{charge indirecte}} (gris) ou {{charge financière}} (ambre), pour savoir où il se retrouve dans les marges.' },
        {
            type: 'ul', itemIds: ['guide-prod-soustraitance', 'guide-prod-vieillissement'], items: [
                { label: 'Sous-traitance (charge directe).', text: 'Cochez la case, puis {{+ Ajouter une opération}} pour chaque opération confiée à un tiers : le sous-traitant, l\'opération et son coût ($). Le total s\'ajoute à vos coûts directs et réduit donc la marge brute.' },
                { label: 'Vieillissement / affinage (charge financière).', text: 'Cochez la case pour un produit qui doit mûrir en inventaire avant la vente, puis renseignez le **taux d\'intérêt annuel (%)** et la **durée (mois)**. Le coût de vieillissement est : charges directes du lot × taux annuel ÷ 12 × durée, divisé par le nombre d\'unités. Il réduit la marge nette et allonge le point mort, mais ne touche pas la marge brute. Si la recette utilise une sous-recette qui vieillit, le coût de portage de cette sous-recette s\'ajoute à celui du format (jamais à ses coûts directs).' },
            ],
        },
        { type: 'p', text: 'Voir le [[guide-concept-familles-vieillissement|chapitre 2]] pour un exemple chiffré et les limites de ce calcul (intérêt simple, lot immobilisé en entier). Les normes comptables IAS 2 et IAS 23 encadrent le traitement des intérêts dans le coût des stocks : validez-le avec votre comptable.' },

        { type: 'h', id: 'guide-prod-recap', text: '5. Récapitulatif' },
        { type: 'p', text: 'Cette section synthétise votre **coût de production** (matière + emballage + main-d\'œuvre + sous-traitance) et calcule en temps réel les ratios et marges qui en découlent. Le sélecteur {{Canal :}} choisit le prix net utilisé : par défaut, le canal principal du format.' },
        {
            type: 'table', head: ['Tuile', 'Ce qu\'elle indique'], wrapCells: true, rowIds: ['guide-prod-tuile-ratios', 'guide-prod-tuile-cout-production', 'guide-prod-tuile-contribution', 'guide-prod-tuile-marge-brute', 'guide-prod-tuile-prix', 'guide-prod-tuile-point-mort'], rows: [
                ['{{Coût Matière (%)}}, {{Coût Emballage (%)}}, {{Coût Main-d\'œuvre (%)}}', 'La part du prix de vente que représente chaque famille de coût, avec un voyant de comparaison à vos objectifs (coche verte ou triangle rouge).'],
                ['{{Coût de Production}}', 'La somme de vos coûts directs par unité, avant les frais fixes.'],
                ['{{Marge de contribution}}', 'Prix de vente moins le coût matière, en $ et en % du prix.'],
                ['{{Marge brute}}', 'Prix de vente moins les coûts directs, en $ et en % du prix.'],
                ['{{Prix de Vente}}', 'Le prix net du canal sélectionné.'],
                ['{{Point Mort}}', 'Le nombre d\'unités à vendre, dans ce canal, pour couvrir la part des frais fixes qui revient à ce format, y compris la main-d\'œuvre directe traitée comme fixe. Il reprend la valeur déjà calculée dans le rapport Par SKU.'],
            ],
        },
        { type: 'callout', kind: 'exemple', text: `Chili con carne mijoté, canal « Vente directe » : coût de production ${d(DEMO.chili.coutProduction)} (${d(DEMO.chili.coutMatiere)} + ${d(DEMO.chili.coutEmballage)} + ${d(DEMO.chili.coutMO)}), prix de vente ${d(DEMO.chili.prixVente)}. Marge de contribution ${d(DEMO.chili.margeContribution)}, marge brute ${d(DEMO.chili.margeBrute)}, point mort ${d(DEMO.chili.pointMort)}.` },
        { type: 'p', text: 'Les **frais fixes** et la **marge nette** ne sont pas calculés dans cet onglet : ils dépendent de l\'État des résultats et du CICI, et vivent dans le rapport {{Par SKU}}, où chaque produit a son propre taux d\'absorption. Tant qu\'un format n\'a pas de prix de vente, les ratios de coûts, les marges et le point mort sont remplacés par « — » : saisissez un prix dans Paramètres → Produits et SKUs, ou testez-en un avec le mode simulation.' },

        { type: 'h', id: 'guide-prod-simulation', text: 'Le mode simulation de prix', level: 5 },
        { type: 'p', text: 'Le bouton {{Simuler un nouveau prix}} ouvre le {{Mode Simulation}} : saisissez un {{Prix de vente simulé ($)}} et toutes les tuiles se recalculent en affichant, à côté de chaque valeur actuelle, l\'écart avec le prix simulé. Le point mort reste affiché et compare le point mort réel à celui du prix simulé. {{Quitter}} revient au prix réel, sans rien modifier à vos données.' },
        { type: 'callout', kind: 'astuce', text: 'Utilisez la simulation avant de modifier un prix : elle montre immédiatement l\'effet d\'un prix de 5 % plus haut ou plus bas sur la marge brute et sur le point mort.' },

        { type: 'callout', kind: 'retenir', text: 'Une fiche = un format. Toutes les quantités sont pour le lot entier, et la quantité produite donne le coût par unité. Le coût de production réunit matière, emballage, main-d\'œuvre et sous-traitance ; les frais fixes et la marge nette se lisent dans les rapports.' },
        { type: 'words', items: [
            { term: 'Lot, quantité produite', def: 'ce que la recette complète donne, et son nombre d\'unités.' },
            { term: 'Sous-recette', def: 'une recette de base utilisée comme ingrédient d\'autres recettes.' },
            { term: 'Produit de revente', def: 'un format acheté et revendu sans transformation.' },
            { term: 'Grille de rendement', def: 'un calcul de la quantité produite à partir d\'une quantité de départ, d\'étapes de transformation et d\'un taux de rejet.' },
            { term: 'Intensité de main-d\'œuvre', def: 'temps personnel ÷ durée du processus.' },
            { term: 'Coût de production', def: 'matière + emballage + main-d\'œuvre + sous-traitance, par unité.' },
        ] },
    ],
};

export const _grille = GRILLE; // exporté pour le test d'arithmétique du guide
