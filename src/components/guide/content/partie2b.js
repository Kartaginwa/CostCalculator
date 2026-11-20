import { fromApp, money, num } from '../guideFormat.js';
import { DEMO, BOEUF, SALAIRE } from '../guideNumbers.js';

// Partie 2 — Utiliser l'application. Chapitres « Ingrédients », « Emballage » et « Main-d'œuvre ».

const d = fromApp;

export const chapitreIngredients = {
    id: 'guide-ingredients',
    title: 'Onglet 2 — Ingrédients',
    lead: 'Votre catalogue de matières premières : la base de précision de tous vos coûts.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'Le coût matière représente souvent la plus grosse part du coût d\'un produit. Si un prix d\'achat est faux ou périmé, le coût de **chaque** recette qui utilise cet ingrédient est faux, et ses marges avec lui. Tenir ce catalogue à jour est le geste le plus rentable de toute l\'application.' },

        { type: 'h', id: 'guide-ing-db', text: 'La base de données des ingrédients' },
        { type: 'p', text: 'Chaque ligne du tableau est un ingrédient **tel que vous l\'achetez** : un fournisseur, un format, un prix. Pour en ajouter, cliquez sur {{Ajouter un ingrédient}} : la ligne apparaît en haut du tableau et le curseur se place sur son nom. Vous pouvez aussi {{Importer une liste}} (voir plus bas).' },
        {
            type: 'table', head: ['Colonne', 'Ce que vous y mettez'], wrapCells: true, rowIds: [null, null, 'guide-ing-col-format', 'guide-ing-col-unite', 'guide-ing-col-prix-achat', 'guide-ing-col-perte', 'guide-ing-col-prix-unitaire', 'guide-ing-col-maj', null], rows: [
                ['{{Ingrédient}}', 'Le nom de l\'ingrédient.'],
                ['{{Fournisseur}}', 'D\'où il vient. Un même ingrédient acheté chez deux fournisseurs forme deux lignes, ce qui permet de les comparer.'],
                ['{{Format d\'achat}}', 'La quantité contenue dans l\'unité que vous achetez (ex. 5 pour un sac de 5 kg).'],
                ['{{Unité de base}}', 'L\'unité de ce format (g, kg, ml, L, unité…).'],
                ['{{Prix achat ($)}}', 'Ce que vous payez pour un format entier.'],
                ['{{Taux de perte (%)}}', 'La part de l\'ingrédient qui se perd **avant** d\'être utilisée : péremption, casse, déclassement. Ce n\'est pas l\'épluchage ni la cuisson, qui relèvent du rendement de la recette.'],
                ['{{Prix unitaire ($)}}', 'Calculé automatiquement : prix d\'achat ÷ format d\'achat. C\'est lui qui sert aux recettes.'],
                ['{{Dernière màj}}', 'La date de la dernière modification du prix d\'achat, mise à jour automatiquement. Un point jaune apparaît si elle date de plus de 30 jours : c\'est un rappel de vérifier ce prix.'],
                ['Actions', 'Gérer les allergènes (l\'icône d\'alerte devient rouge quand des allergènes sont assignés), dupliquer l\'ingrédient, le supprimer (annulable quelques secondes).'],
            ],
        },
        { type: 'callout', kind: 'exemple', text: `Dans le projet démo, le bœuf haché mi-maigre s'achète par format de ${BOEUF.format} kg à ${d('48.75 $')}, avec 8 % de perte. Son prix unitaire est ${d('48.75 $')} ÷ ${BOEUF.format} = ${money(BOEUF.prixUnitaire)} le kilogramme ; son prix efficace, avec la perte, est de ${money(BOEUF.prixEfficace)}.` },
        { type: 'p', text: 'Les **sous-recettes** (voir le chapitre Production) apparaissent aussi dans cette liste, avec « Sous-recette » à la place du fournisseur. Leurs champs sont grisés : leur prix unitaire est calculé à partir de leur recette, et il se met à jour tout seul quand cette recette change.' },
        { type: 'p', text: 'Au-dessus du tableau, des filtres par nom et par fournisseur. Cliquez sur l\'en-tête d\'une colonne pour trier ; des contrôles de pagination (nombre de lignes par page) sous le tableau permettent de naviguer dans une longue liste. Vos filtres et votre tri sont mémorisés quand vous changez d\'onglet.' },
        { type: 'callout', kind: 'attention', text: 'Une ligne sans nom, sans prix, ou avec un pourcentage invalide est signalée en rouge après que vous avez quitté le champ. N\'ignorez pas ces signaux : un ingrédient sans prix compte pour 0 $ dans vos recettes, ce qui fait paraître le produit plus rentable qu\'il n\'est. Le panneau « points à vérifier » du Rapport les recense aussi.' },

        { type: 'h', id: 'guide-ing-allergenes', text: 'Les allergènes' },
        { type: 'p', text: 'L\'icône d\'alerte de chaque ligne ouvre la liste des 14 allergènes de déclaration courante : gluten, crustacés, œufs, poisson, arachides, soja, lait, noix, céleri, moutarde, sésame, sulphites, lupin et mollusques. Cochez ceux que contient l\'ingrédient. Dans l\'onglet Production, la recette affiche alors automatiquement la **liste des allergènes** de tous ses ingrédients, sans que vous ayez à la tenir à jour.' },
        { type: 'callout', kind: 'attention', text: 'L\'application collecte et affiche ces informations, mais elle ne remplace pas votre processus de contrôle et d\'étiquetage des allergènes. La fiche est aussi fiable que ce que vous avez coché : vérifiez-la avec votre fournisseur et votre responsable qualité.' },

        { type: 'h', id: 'guide-ing-comparaison', text: 'L\'outil de comparaison' },
        { type: 'p', text: 'Dans le champ {{Comparer un ingrédient}}, tapez ou choisissez un nom : l\'outil affiche côte à côte tous les fournisseurs de cet ingrédient, avec leur prix unitaire, leur perte estimée et leur **prix efficace** (voir [[guide-concept-prix-efficace|chapitre 3]]). Le meilleur prix efficace est mis en évidence par le badge {{Meilleur prix}}.' },
        { type: 'callout', kind: 'pourquoi', text: 'Le prix affiché n\'est pas le prix réel : un fournisseur plus cher mais dont la marchandise se perd moins peut revenir moins cher. L\'outil fait ce calcul à votre place.' },

        { type: 'h', id: 'guide-ing-import', text: 'L\'assistant d\'importation de listes' },
        { type: 'p', text: 'Pour importer en une fois la liste de prix d\'un fournisseur, cliquez sur {{Importer une liste}}. L\'assistant fonctionne en quatre étapes.' },
        {
            type: 'steps', itemIds: [null, 'guide-ing-import-colonnes', null, null], items: [
                { label: 'Téléverser.', text: 'Choisissez un fichier .csv, .xls ou .xlsx. Si un classeur Excel contient plusieurs onglets, l\'assistant vous demande de choisir celui à importer.' },
                { label: 'Faire correspondre les colonnes.', text: 'Associez les colonnes de votre fichier aux champs de l\'application. Obligatoires : le nom de l\'ingrédient et le prix d\'achat. Facultatifs : l\'identifiant unique (SKU ou PLU), le fournisseur, le format d\'achat, l\'unité de base, la quantité et l\'unité combinées (ex. « 20 kg » dans une seule colonne), le taux de perte. Si votre fichier n\'a pas de colonne de fournisseur, le champ {{Fournisseur par défaut}} l\'applique à tous les nouveaux ingrédients.' },
                { label: 'Prévisualiser et valider.', text: 'Chaque ligne reçoit un statut : **Nouveau**, **Mise à jour** (l\'ingrédient existe déjà) ou **Erreur** (surlignée en rouge : prix invalide, pourcentage invalide…). Vous pouvez lier manuellement une ligne à un ingrédient existant, et utiliser les sélections rapides, comme {{Importer uniquement les mises à jour}}.' },
                { label: 'Confirmer.', text: 'Un récapitulatif indique combien d\'ingrédients seront mis à jour et combien seront ajoutés. Les lignes non sélectionnées et celles en erreur sont ignorées.' },
            ],
        },
        { type: 'callout', kind: 'astuce', text: 'L\'assistant repère les doublons : il rapproche un ingrédient du fichier d\'un ingrédient existant par sa combinaison identifiant unique + fournisseur, ou à défaut nom + format + fournisseur. Importer le même fichier deux fois met donc à jour les prix au lieu de dupliquer les lignes.' },

        { type: 'h', id: 'guide-ing-abc', text: 'L\'analyse ABC des ingrédients' },
        { type: 'p', text: 'Sous le tableau, l\'analyse ABC classe vos ingrédients par importance financière (voir [[guide-concept-suivi|chapitre 11]] pour la méthode). Trois cartes présentent les catégories A, B et C, avec la part de chaque ingrédient dans le coût total consommé. Un badge {{volatile}} s\'ajoute aux ingrédients dont le prix bouge beaucoup (il faut au moins deux points de référence pour qu\'il apparaisse).' },
        { type: 'callout', kind: 'exemple', text: `Dans le projet démo, la catégorie A compte quatre ingrédients (bœuf haché, poitrine de poulet, filet de saumon et riz basmati) pour ${d(DEMO.ingredients.abcA)} du coût total. Les trois premiers n'atteignent que 64,8 % : le riz basmati, qui franchit la barre des 70 %, est inclus dans la catégorie A.` },
        { type: 'p', text: 'L\'analyse porte uniquement sur les ingrédients **réellement consommés** par vos produits actifs, compte tenu des volumes vendus : un ingrédient qui ne sert à aucune recette n\'y figure pas.' },

        { type: 'h', id: 'guide-ing-rapport-achats', text: 'Le rapport d\'achats et pertes' },
        { type: 'p', text: 'Ce rapport estime ce que vous devez acheter pour la période, en partant de vos recettes et de vos ventes : pour chaque ingrédient, la quantité requise est la quantité de la recette multipliée par le nombre de lots à produire, ce nombre se déduisant des volumes saisis dans Produits et SKUs. Trois totaux, pour tous les fournisseurs, s\'affichent en premier :' },
        {
            type: 'ul', items: [
                { label: 'Coût net total (production).', text: 'La valeur de la matière réellement utilisée dans vos produits.' },
                { label: 'Coût total des pertes.', text: 'La valeur de ce qui se perd en stock avant utilisation.' },
                { label: 'Coût d\'achat total requis.', text: 'La somme des deux : ce qu\'il faut réellement acheter, et donc budgéter.' },
            ],
        },
        { type: 'p', text: `Dans le projet démo : ${d(DEMO.ingredients.coutNet)} de coût net, ${d(DEMO.ingredients.pertes)} de pertes, soit ${d(DEMO.ingredients.achatRequis)} d'achats requis.` },
        { type: 'p', text: 'La liste {{Détail par fournisseur}} sert uniquement à afficher, sous les totaux, le détail ligne par ligne : {{Totaux seulement}}, {{Tous les fournisseurs}}, ou un fournisseur précis. Le détail indique pour chaque ingrédient la quantité nette, le coût net, la quantité perdue et le coût perdu.' },
        {
            type: 'table', caption: 'Les colonnes du détail', head: ['Colonne', 'Ce qu\'elle contient'], wrapCells: true,
            rowIds: ['guide-ing-ra-qte-nette', 'guide-ing-ra-cout-net', 'guide-ing-ra-qte-perdue', 'guide-ing-ra-cout-perdu', 'guide-ing-ra-achat-requis'],
            rows: [
                ['{{Qté nette (Production)}}', 'La quantité de l\'ingrédient réellement utilisée dans vos produits, d\'après vos ventes de la période.'],
                ['{{Coût net (Production)}}', 'Le coût de cette quantité : la valeur de la matière qui est transformée en produits vendus.'],
                ['{{Qté perdue (Stock)}}', 'La quantité qui se perd en stock avant d\'être utilisée, selon le taux de perte de l\'ingrédient.'],
                ['{{Coût perdu (Stock)}}', 'Le coût de cette quantité perdue.'],
                ['{{Coût d\'achat requis}}', 'La somme du coût net et du coût perdu : ce qu\'il faut réellement acheter et budgéter pour cet ingrédient.'],
            ],
        },
        { type: 'callout', kind: 'attention', text: 'Ce rapport n\'est aussi juste que vos volumes : si vous n\'avez saisi aucun volume de vente dans Produits et SKUs, il n\'a rien à calculer et affiche des zéros.' },

        { type: 'callout', kind: 'retenir', text: 'Chaque ligne est un ingrédient chez un fournisseur. Le prix unitaire se calcule seul. Le taux de perte ne concerne que ce qui se perd avant la production. Tenez les prix à jour : la date de dernière mise à jour et le point jaune vous y aident.' },
        { type: 'words', items: [
            { term: 'Format d\'achat', def: 'la quantité contenue dans ce que vous achetez.' },
            { term: 'Prix unitaire', def: 'le prix ramené à l\'unité de base.' },
            { term: 'Prix efficace', def: 'le prix unitaire corrigé de la perte en stock.' },
            { term: 'Analyse ABC', def: 'classement des ingrédients selon leur poids dans le coût total.' },
            { term: 'Coût d\'achat requis', def: 'le coût net plus le coût des pertes.' },
        ] },
    ],
};

// ====================================================================================================

export const chapitreEmballage = {
    id: 'guide-emballage',
    title: 'Onglet 3 — Emballage',
    lead: 'Le catalogue de tout ce qui contient, protège ou présente vos produits.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'L\'emballage est un poste de coût à part, jamais fusionné avec les ingrédients : il a ses propres fournisseurs, ses propres variations de prix, et son propre pourcentage dans vos rapports. Dans l\'exemple de la boisson du chapitre 2, il pesait presque autant que les matières.' },
        { type: 'h', id: 'guide-emb-db', text: 'La base de données des emballages' },
        { type: 'p', text: 'L\'onglet fonctionne exactement comme celui des ingrédients : mêmes colonnes ({{Emballage}}, {{Fournisseur}}, {{Format d\'achat}}, {{Unité de base}}, {{Prix achat ($)}}, {{Taux de perte (%)}}, {{Prix unitaire ($)}}, {{Dernière màj}}), mêmes filtres, mêmes tris, même outil {{Comparer un emballage}}, mêmes règles de calcul du prix unitaire et du prix efficace. L\'unité de base par défaut est « unité » (un pot, un couvercle, une étiquette). Le taux de perte représente ici les bris, les rebuts et les déclassements.' },
        { type: 'p', text: 'Ce qui change par rapport aux ingrédients : il n\'y a ni allergènes, ni sous-recettes, ni **rendement** dans les recettes. Un emballage ne « rétrécit » pas à la production, comme une carotte à l\'épluchage : seule la perte en stock s\'applique.' },
        {
            type: 'table', caption: 'Trois colonnes à bien comprendre', head: ['Colonne', 'Ce qu\'elle signifie pour un emballage'], wrapCells: true,
            rowIds: ['guide-emb-col-perte', 'guide-emb-col-prix-unitaire', 'guide-emb-col-maj'],
            rows: [
                ['{{Taux de perte (%)}}', 'La part de l\'emballage perdue **avant** d\'être utilisée : bris, rebuts, format non conforme. Même logique que le taux de perte d\'un ingrédient ([[guide-ing-col-perte|voir Ingrédients]]).'],
                ['{{Prix unitaire ($)}}', 'Calculé automatiquement : prix d\'achat ÷ format d\'achat. C\'est ce prix qui sert au coût d\'emballage d\'une recette.'],
                ['{{Dernière màj}}', 'La date de la dernière modification du prix d\'achat, mise à jour automatiquement. Un point jaune apparaît au-delà de 30 jours, pour vous rappeler de vérifier ce prix.'],
            ],
        },
        { type: 'h', id: 'guide-emb-import', text: 'Importer une liste d\'emballages' },
        { type: 'p', text: 'C\'est le même assistant que pour les ingrédients (quatre étapes : téléverser, associer les colonnes, prévisualiser et valider, confirmer). Il reconnaît un emballage déjà présent (mise à jour) ou un nouveau (ajout).' },
        { type: 'h', id: 'guide-emb-abc', text: 'Analyse ABC et rapport d\'achats' },
        { type: 'p', text: 'L\'analyse ABC et le rapport d\'achats et pertes existent aussi pour l\'emballage, avec le même principe. L\'analyse n\'inclut que les emballages réellement rattachés à au moins un format de vente. Dans le projet démo, la catégorie A de l\'emballage représente 71,5 % des coûts.' },
        { type: 'callout', kind: 'retenir', text: 'L\'emballage se saisit comme les ingrédients, mais seule la perte en stock s\'y applique. Il pèse souvent bien plus qu\'on le croit : regardez son pourcentage dans vos rapports.' },
        { type: 'words', items: [
            { term: 'Emballage', def: 'tout ce qui contient, protège ou présente le produit : pot, bouteille, couvercle, étiquette, boîte.' },
        ] },
    ],
};

// ====================================================================================================

export const chapitreMainOeuvre = {
    id: 'guide-main-oeuvre',
    title: 'Onglet 4 — Main-d\'œuvre',
    lead: 'Comprendre le coût réel du travail qui fabrique vos produits.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'La main-d\'œuvre est un élément essentiel du coût de revient, souvent sous-estimé : on pense au salaire horaire, on oublie les charges, les vacances et le temps non productif. Cet onglet décrit vos équipes ; l\'onglet Production s\'en sert ensuite pour coûter chaque étape de fabrication.' },

        { type: 'h', id: 'guide-mo-db', text: 'Postes et employés' },
        { type: 'p', text: 'Vous organisez votre main-d\'œuvre en **postes** (par exemple « Cuisinier de production », « Opérateur d\'emballage », « Contrôleur qualité »), dans lesquels vous placez des **employés**. Le bouton {{Ajouter un poste}} crée une carte de poste ; dans chaque poste, {{+ Ajouter un employé}} ajoute une ligne. Le chevron à droite de chaque carte la replie ou la déplie ; la croix rouge ronde supprime le **poste entier** et ses employés, tandis que la corbeille d\'une ligne ne supprime que l\'employé.' },
        {
            type: 'table', head: ['Colonne', 'Ce que vous y mettez'], wrapCells: true, rowIds: [null, 'guide-mo-col-salaire', 'guide-mo-col-charges', 'guide-mo-col-vacances', 'guide-mo-col-temps-productif', 'guide-mo-col-heures'], rows: [
                ['{{Employé}}', 'Le nom de la personne.'],
                ['{{Salaire Horaire ($)}}', 'Le salaire brut de l\'employé, par heure.'],
                ['{{Charges (%)}}', 'Les charges sociales de l\'employeur, en pourcentage du salaire (par exemple 16 %).'],
                ['{{Vacances (%)}}', 'Le pourcentage mis de côté pour les vacances (par exemple 4 % ou 6 %).'],
                ['{{% Temps productif attendu}}', 'La part des heures travaillées que la personne devrait consacrer à fabriquer. Un cuisinier qui passe 10 % de son temps en nettoyage et en réunions : 90 %.'],
                ['{{Heures Travaillées}}', 'Le nombre d\'heures de cette personne pendant la **période de référence** (voir l\'onglet État des résultats).'],
            ],
        },
        { type: 'p', text: `Pour chaque poste, l'application calcule un **coût moyen pondéré**, en $/h, affiché au bas de la carte. C'est le coût horaire chargé de chaque employé, pondéré par ses heures travaillées. Pour un employé : salaire × (1 + charges) × (1 + vacances). C'est ce coût moyen que l'onglet Production utilise.` },
        { type: 'callout', kind: 'exemple', text: `Un cuisinier du projet démo gagne ${SALAIRE.taux} $/h, avec ${Math.round(SALAIRE.charges * 100)} % de charges et ${Math.round(SALAIRE.vacances * 100)} % de vacances : son coût horaire chargé est de ${SALAIRE.taux} × ${num(1 + SALAIRE.charges, 2)} × ${num(1 + SALAIRE.vacances, 2)} = ${money(SALAIRE.charge)}. Le poste « Cuisinier de production » compte trois personnes (22 $/h, 22 $/h et 21 $/h, pour 60, 60 et 55 heures) : son coût moyen pondéré est de ${d(DEMO.mo.coutCuisinier)}.` },
        { type: 'callout', kind: 'attention', text: 'Ne saisissez dans un poste que les personnes qui participent à la fabrication. Le gérant, l\'administration et le représentant des ventes sont des frais fixes : ils vont dans l\'État des résultats, pas ici. Voir le chapitre [[guide-ff-liste|Frais fixes]] pour la règle complète.' },

        { type: 'h', id: 'guide-mo-productivite', text: 'Le rapport de productivité' },
        { type: 'p', text: 'Sous les postes, ce rapport compare, **poste par poste**, les heures que vous payez à celles dont vos recettes ont réellement besoin pour produire ce que vous vendez :' },
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

        { type: 'h', id: 'guide-mo-capacite', text: 'Capacité de production par activité' },
        { type: 'p', text: 'Ce deuxième tableau répartit les heures de main-d\'œuvre réellement requises entre vos **activités de production**, et indique la part de chaque activité dans le total. Il révèle quelle ligne de production est la plus exigeante en temps. Il n\'y a pas de « heures attendues » par activité : un poste ou un employé n\'est pas rattaché à une seule activité, donc rien n\'est comparable.' },
        { type: 'p', text: 'Dans le projet démo, les mets principaux surgelés consomment 130,24 heures (38,26 % du total), les soupes et potages 210,14 heures (61,74 %), et les sauces et accompagnements 0 heure : leurs recettes n\'ont pas d\'étapes de production avec du personnel affecté, ou n\'ont pas de ventes saisies.' },
        {
            type: 'ul', itemIds: ['guide-mo-cap-heures', 'guide-mo-cap-part'], items: [
                { label: 'Heures productives réelles.', text: 'Les heures de production de l\'activité, calculées à partir des étapes de vos recettes et de vos ventes de la période.' },
                { label: 'Part du total.', text: 'La part de cette activité dans l\'ensemble des heures productives réelles.' },
            ],
        },
        { type: 'callout', kind: 'retenir', text: 'Un poste regroupe des employés du même métier. Le coût moyen d\'un poste est le coût horaire chargé de ses employés, pondéré par leurs heures. Le taux d\'utilisation mesure la capacité de production payée qui sert vraiment.' },
        { type: 'words', items: [
            { term: 'Poste', def: 'un groupe d\'employés qui font le même métier.' },
            { term: 'Coût horaire chargé', def: 'salaire horaire, charges sociales et vacances compris.' },
            { term: 'Coût moyen pondéré', def: 'le coût horaire moyen d\'un poste, pondéré par les heures de chaque employé.' },
            { term: 'Temps productif', def: 'la part des heures travaillées consacrée à produire.' },
            { term: 'Taux d\'utilisation', def: 'heures nécessaires ÷ heures productives attendues.' },
        ] },
    ],
};
