import { fromApp } from '../guideFormat.js';
import { DEMO } from '../guideNumbers.js';
import { INDICATORS, INDICATOR_GROUPS } from '../../../engine/objectives.js';
import { INDICATOR_DOCS } from '../../../engine/objectiveDocs.js';

// Tables des indicateurs d'objectifs sur mesure ajoutés le 24/11 : générées depuis le catalogue (engine/objectives.js) et ses descriptions (objectiveDocs.js),
// les mêmes textes que les infobulles de la fenêtre « Gérer les objectifs ». Un identifiant d'ancre par indicateur : guide-obj-ind-<id>.
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const sens = (id) => (INDICATORS[id].dir === 'min' ? 'Au moins' : 'Au plus');
const indicatorTable = (group, ids, withGroup) => ({
    type: 'table', head: ['Indicateur', 'Ce qu\'il mesure', 'Sens habituel'], wrapCells: true,
    rowIds: ids.map(id => `guide-obj-ind-${id.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`),
    rows: ids.map(id => [withGroup ? `${group} : ${lowerFirst(INDICATORS[id].label)}` : INDICATORS[id].label, INDICATOR_DOCS[id], sens(id)]),
});
const ENTITY_GROUPS = INDICATOR_GROUPS.filter(g => g.label !== 'Entreprise');
const ENTERPRISE_NEW = INDICATOR_GROUPS[0].ids.filter(id => INDICATOR_DOCS[id]);

// Partie 2 — Utiliser l'application. Chapitre « Paramètres ».
// Les chiffres du projet démo sont lus dans DEMO (vérifiés par e2e/guide-demo-numbers.spec.js).

const d = fromApp;
const dp = (s) => fromApp(s).replace(/\s?%/, ' %'); // « 34.86% » à l'écran → « 34,86 % » dans le guide

export const chapitreParametres = {
    id: 'guide-parametres',
    title: 'Onglet 1 — Paramètres',
    lead: 'Le point de départ de toute analyse : ce que vous y définissez sert de base à tous les autres onglets.',
    blocks: [
        { type: 'callout', kind: 'pourquoi', text: 'Cet onglet décrit **le cadre** de votre entreprise : qui vous êtes, comment vous mesurez, comment vous produisez, par où vous vendez, et ce que vous vendez. Les onglets suivants (ingrédients, recettes, rapports) ne font que remplir ce cadre. Prenez le temps de le soigner : une activité mal définie ici se retrouve dans tous les rapports.' },
        { type: 'p', text: 'L\'onglet contient six sections, à remplir dans l\'ordre où elles apparaissent. Les trois dernières (activités, canaux, produits) sont les plus importantes.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-entreprise', text: 'Informations sur l\'entreprise' },
        { type: 'p', text: 'Saisissez le {{Nom de l\'entreprise}}. Vous pouvez aussi ajouter un logo, soit en important un fichier ({{Importer un logo (fichier)}}), soit en collant l\'adresse d\'une image ({{Importer un logo (URL)}}). Le nom et le logo servent à personnaliser vos exports : ils apparaissent sur la page de garde du rapport PDF. Le nom sert aussi à nommer le fichier de sauvegarde.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-objectifs', text: 'Objectifs stratégiques' },
        { type: 'p', text: 'Quatre champs vous permettent de fixer vos objectifs principaux : le **pourcentage maximal du prix de vente** que chaque famille de coûts devrait représenter ({{Objectif coût matière (%)}}, {{Objectif coût d\'emballage (%)}} et {{Objectif coût main-d\'œuvre (%)}}) et la **marge brute minimale** ({{Objectif marge brute (%)}}).' },
        { type: 'p', text: 'Ces cibles agissent comme des **voyants** dans l\'application. Dans le récapitulatif de l\'onglet Production, à côté de chaque ratio de coût, une coche verte indique que la cible est respectée ; un triangle rouge indique qu\'elle est dépassée. Les mêmes comparaisons se retrouvent dans le rapport. Un champ laissé vide n\'affiche aucun voyant.' },
        { type: 'callout', kind: 'exemple', text: `Le projet démo fixe ses cibles à 32 % pour la matière, 8 % pour l'emballage et 22 % pour la main-d'œuvre. Son Chili con carne mijoté a un coût matière de ${dp(DEMO.chili.coutMatierePct)} du prix de vente : la cible de 32 % est dépassée, le voyant est rouge. Son coût d'emballage (7,56 %) et sa main-d'œuvre (7,58 %) respectent leurs cibles : voyants verts.` },
        { type: 'callout', kind: 'astuce', text: 'Si vous ne savez pas quelles cibles choisir, partez de vos chiffres historiques ou de la moyenne de votre secteur, puis resserrez-les au fil du temps. Une cible n\'a de valeur que si elle est réaliste : trop facile, elle ne signale rien ; trop sévère, tous les voyants sont rouges.' },

        { type: 'h', id: 'guide-obj-gerer', text: 'Gérer les objectifs' },
        { type: 'p', text: 'Le bouton {{Gérer les objectifs}}, à la fin de la section, ouvre une fenêtre où se trouvent **tous** vos objectifs. Un objectif compare une valeur que l\'application mesure déjà à la cible que vous choisissez. Il produit un voyant à côté de la valeur concernée (coche verte ou triangle rouge) et un constat dans le bloc « Objectifs stratégiques » de la Vue d\'ensemble. Dans la fenêtre, un objectif atteint est surligné en vert.' },
        { type: 'p', text: 'Les quatre objectifs principaux sont les champs ci-dessus : les saisir ici ou dans la fenêtre revient au même. Cinq autres existent par défaut, sans valeur tant que vous n\'en choisissez pas une (une suggestion apparaît en grisé) :' },
        {
            type: 'table', head: ['Objectif', 'Ce qu\'il mesure', 'Sens'], wrapCells: true,
            rowIds: ['guide-obj-marge-nette', 'guide-obj-utilisation', 'guide-obj-paie-non-utilisee', 'guide-obj-perte-stock', 'guide-obj-frais-fixes'],
            rows: [
                ['Marge nette', 'Le bénéfice net prévu divisé par les ventes prévues, tous coûts et frais fixes déduits : le chiffre du constat « Bénéfice net prévu ».', 'Au moins'],
                ['Taux d\'utilisation des postes', 'La ligne Total du tableau « Taux d\'Utilisation (%) » de Main-d\'œuvre : les heures réelles de production divisées par les heures attendues.', 'Au moins'],
                ['Paie non utilisée', 'La part de la paie versée sans produire, affichée dans « Utilisation de la masse salariale » (Main-d\'œuvre). Elle comprend les heures payées mais non productives ; elle diffère donc du taux d\'utilisation, qui ne compte que les heures de production.', 'Au plus'],
                ['Perte stock', 'La perte stock prévue divisée par les achats d\'ingrédients, comme dans le rapport d\'achats.', 'Au plus'],
                ['Frais fixes', 'Les frais fixes répartis divisés par les revenus prévus.', 'Au plus'],
            ],
        },
        { type: 'p', id: 'guide-obj-marge-brute', text: 'La marge brute reprend la marge brute moyenne pondérée de la tuile du même nom, avec le sens « au moins ».' },
        { type: 'p', id: 'guide-obj-sens', text: 'Le **sens** d\'un objectif par défaut est fixe : un coût se lit « au plus » et une marge « au moins ». Les voyants et les constats reposent sur ce sens ; l\'inverser donnerait des résultats absurdes. Pour un autre sens, créez un objectif sur mesure.' },
        { type: 'p', text: 'Un objectif peut être **désactivé sans être supprimé** : il garde sa valeur, mais n\'agit plus nulle part (ni voyant, ni constat). Réactivez-le quand vous voulez. Un objectif sans valeur, ou dont la donnée est absente, reste muet.' },
        { type: 'h', id: 'guide-obj-sur-mesure', text: 'Objectifs sur mesure' },
        { type: 'p', text: 'Avec {{Ajouter un objectif sur mesure}}, vous créez jusqu\'à **20 objectifs** : un nom facultatif, un indicateur choisi dans la liste, un sens (« au plus » ou « au moins ») et une valeur. Le sens se présélectionne selon l\'indicateur, mais vous pouvez le changer. Il n\'y a pas de formule libre : seuls les indicateurs que l\'application calcule déjà sont proposés. Ils se rangent en deux familles : ceux de l\'**entreprise entière**, et ceux qui visent **un sujet précis** (un ingrédient, un emballage, un fournisseur, un poste, un format, un canal ou une activité). Pour ces derniers, un menu {{Sujet}} apparaît à côté de l\'indicateur ; un sujet absent du projet (supprimé, ou sans ventes) rend l\'objectif muet. Les neuf objectifs par défaut ne sont pas répétés dans la liste.' },
        {
            type: 'table', head: ['Indicateur', 'Ce qu\'il mesure', 'Sens habituel'], wrapCells: true,
            rowIds: ['guide-obj-ind-securite', 'guide-obj-ind-point-mort', 'guide-obj-ind-revenus', 'guide-obj-ind-fournisseur', 'guide-obj-ind-canal', 'guide-obj-ind-produit'],
            rows: [
                ['Marge de sécurité', 'De combien les ventes prévues peuvent baisser avant le point mort.', 'Au moins'],
                ['Point mort', 'Le chiffre d\'affaires à atteindre pour couvrir les frais fixes.', 'Au plus'],
                ['Revenus prévus', 'Les ventes prévues de tous les produits actifs.', 'Au moins'],
                ['Part du premier fournisseur', 'La part du premier fournisseur dans les achats d\'ingrédients.', 'Au plus'],
                ['Part du premier canal', 'La part du premier canal dans les revenus prévus (au moins deux canaux).', 'Au plus'],
                ['Marge nette du produit le moins rentable', 'La marge nette du produit le moins rentable, tous canaux confondus : un plancher de marge par produit.', 'Au moins'],
            ],
        },
        { type: 'p', text: '**Autres indicateurs de l\'entreprise.**' },
        indicatorTable('Entreprise', ENTERPRISE_NEW, false),
        ...ENTITY_GROUPS.flatMap(g => [{ type: 'p', text: `**Sur ${lowerFirst(g.label)}.**` }, indicatorTable(g.label, g.ids, true)]),
        { type: 'callout', kind: 'exemple', text: 'Pour ne jamais dépendre d\'un seul canal, créez « Part du premier canal », au plus 40 %. Pour exiger qu\'aucun produit ne tombe sous 5 % de marge nette, créez « Marge nette du produit le moins rentable », au moins 5 %. Pour surveiller un ingrédient précis, choisissez la famille « Un ingrédient », l\'indicateur « Part dans les achats d\'ingrédients », le sujet voulu, puis « au plus » 25 %.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-unites', text: 'Unités de mesure' },
        { type: 'p', text: 'Le bouton {{Gérer les unités de mesure}} ouvre une fenêtre où vous cochez les unités proposées partout où l\'on peut en choisir une (ingrédients, emballage, produits et SKUs, production). Cinq unités sont actives par défaut : g, kg, ml, L et unité. Vous pouvez en activer d\'autres si votre production en a besoin.' },
        {
            type: 'table', head: ['Famille', 'Unités disponibles', 'Particularité'], wrapCells: true, rows: [
                ['Masse', 'g, kg, oz, lb, tonne', 'Les conversions entre unités d\'une même famille sont automatiques (1 kg = 1 000 g).'],
                ['Volume', 'ml, L, cl, hL, fl oz US, gal US, fl oz imp, gal imp', 'Idem au sein de la famille. Les gallons et les onces liquides existent en version américaine (US : 1 gal = 3,785 L) et impériale (imp : 1 gal = 4,546 L, courante au Canada) : choisissez celle de votre fournisseur.'],
                ['Discrètes (comptables)', 'unité, douzaine', 'Se comptent entier. Une quantité produite exprimée en unités doit être un nombre entier ; en kg ou en L, elle peut avoir des décimales.'],
            ],
        },
        { type: 'callout', kind: 'attention', text: 'L\'application ne convertit **jamais** entre familles : on ne passe pas de kilogrammes à des litres, car cela demanderait la densité du produit, une donnée qu\'elle ne peut pas deviner. Si vous achetez de l\'huile au litre, vos recettes devront donc l\'exprimer en volume (ml, L…) et non en poids : seules les unités de la même famille que celle de l\'ingrédient sont proposées. Si vous changez plus tard l\'unité d\'un ingrédient déjà utilisé pour celle d\'une autre famille, l\'application vous avertit et le panneau {{Points à vérifier}} signale les recettes à corriger : sans cela, le coût serait calculé avec une densité de 1.' },
        { type: 'p', text: 'Décocher une unité déjà utilisée par une donnée existante ne supprime pas cette donnée : elle garde sa valeur.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-activites', text: 'Activités de production' },
        { type: 'p', text: 'Une **activité de production** regroupe les produits qui partagent un même procédé de fabrication : une ligne de surgélation, un atelier de mise en conserve, un procédé de pasteurisation. Un projet neuf contient déjà une activité, « Activité 1 » : renommez-la ou ajoutez-en d\'autres avec {{Ajouter une activité}}. Il en faut au moins une.' },
        { type: 'callout', kind: 'pourquoi', text: 'Les activités servent à deux choses. Elles permettent de **répartir vos frais fixes** (le loyer d\'un atelier de surgélation ne se partage pas comme celui d\'une salle de conditionnement) et de **lire la rentabilité par activité de production** dans les rapports. Créez vos activités avant vos produits, puisque chaque produit doit être rattaché à l\'une d\'elles.' },
        { type: 'callout', kind: 'exemple', text: 'Le projet démo a trois activités : Mets principaux surgelés, Soupes et potages, Sauces et accompagnements. Chacune porte ses frais fixes propres (par exemple une partie du loyer de l\'espace de production) et a son propre rapport de rentabilité.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-canaux', text: 'Canaux de vente' },
        { type: 'p', text: 'Un **canal de vente** est une chaîne de mise en marché (voir le [[guide-concept-canaux|chapitre 7]] de la Partie 1). Chaque carte de canal porte un nom et le bouton {{Gérer les maillons}}, qui ouvre une fenêtre où vous décrivez les intermédiaires, du premier (celui qui achète chez vous) au dernier (celui qui vend au consommateur). Un canal « Vente directe » existe par défaut, sans aucun maillon : il correspond au cas où vous vendez directement au consommateur à votre prix. Il en faut au moins un.' },
        {
            type: 'steps', items: [
                'Cliquez sur {{Ajouter un canal}} et nommez-le (ex. « Épiceries indépendantes »).',
                'Cliquez sur {{Gérer les maillons}}, puis {{Ajouter un maillon}} pour chaque intermédiaire, dans l\'ordre : du plus proche de vous au plus proche du consommateur.',
                'Pour chaque maillon, donnez un nom, choisissez {{Marge}} ou {{Majoration}}, puis saisissez le pourcentage. Une infobulle à côté du champ rappelle la différence avec un exemple.',
            ],
        },
        { type: 'callout', kind: 'attention', text: 'Le choix entre **marge** et **majoration** n\'est pas un détail : pour le même pourcentage, les deux donnent des prix différents. Une marge se calcule sur le prix de vente de l\'intermédiaire, une majoration sur son prix d\'achat. Demandez à vos partenaires comment ils expriment leur pourcentage, ou relisez le chapitre [[guide-concept-marge-majoration|Marge ou majoration ?]].' },
        { type: 'callout', kind: 'exemple', text: `Dans le projet démo, le canal « Épiceries indépendantes » a un maillon : l'épicier indépendant, avec une marge de 30 %. Le canal « Grandes surfaces » en a deux : un centre de distribution (majoration de 12 %) puis un détaillant national (marge de 32 %). Pour un PDS de ${d(DEMO.bySku.pds)}, le producteur reçoit donc ${d(DEMO.bySku.prixEpiceries)} en épicerie et ${d(DEMO.bySku.prixGrandesSurfaces)} en grande surface : les intermédiaires gardent ${d(DEMO.bySku.margeEpicier)} dans le premier cas, et ${d(DEMO.bySku.margeDetaillant)} plus ${d(DEMO.bySku.majorationDistribution)} dans le second.` },
        { type: 'p', text: 'Cette section ne définit que la **structure** de chaque canal. C\'est dans la section Produits et SKUs, juste en dessous, que vous rattachez chaque format de vente à un canal, avec son prix net et son volume.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-produits', text: 'Produits et SKUs' },
        { type: 'p', text: 'C\'est la liste maîtresse de tout ce que vous vendez. Elle distingue trois niveaux, qu\'il faut bien comprendre :' },
        {
            type: 'table', head: ['Niveau', 'Ce que c\'est', 'Exemple (projet démo)'], wrapCells: true, rows: [
                ['Le **produit**', 'Une recette, avec son nom, son activité et sa catégorie.', 'Pâté chinois traditionnel'],
                ['Le **format**', 'L\'emballage et la quantité sous lesquels le produit est vendu. Chaque format a sa propre fiche recette, son prix et sa répartition des ventes.', '340 g et 900 g'],
                ['Le **SKU**', 'Le numéro de référence d\'un format (de l\'anglais « stock keeping unit », unité de gestion de stock). Il est déduit automatiquement du produit et du format, mais vous pouvez le remplacer par votre propre codification.', 'Un code propre à chaque format'],
            ],
        },
        { type: 'p', text: 'À gauche de l\'écran, une liste compacte de tous vos produits (nom, catégorie, nombre de formats). Cliquer sur un produit affiche son détail à droite. Les produits qui servent d\'ingrédient à d\'autres recettes sont signalés « Sous-recette ».' },

        { type: 'h', id: 'guide-param-produits-creer', text: 'Créer un produit, étape par étape', level: 5 },
        {
            type: 'steps', items: [
                'Cliquez sur {{Ajouter un item}}. Le nouveau produit est sélectionné et le curseur se place sur son nom.',
                'Saisissez le **nom**, choisissez l\'**activité de production** et la **catégorie** (vous pouvez en taper une nouvelle ; les catégories existantes sont proposées).',
                'Dans le tableau des formats, renseignez la **quantité et l\'unité** du premier format (par exemple 400 g). Le **SKU** se génère seul.',
                'Saisissez le **PDS** ($), le prix de détail suggéré au consommateur. Une seule valeur par format, quel que soit le canal.',
                'Ouvrez la ligne des canaux (le bouton de la colonne Canaux, par exemple {{1 canal}}) pour rattacher le format à chacun de ses canaux : le **prix net** et le **volume** (unités vendues pendant la période). Le bouton {{Générer}} calcule le prix net à partir du PDS en redescendant les maillons du canal ; vous pouvez ensuite le corriger à la main.',
                'Pour un deuxième format (autre taille), cliquez sur {{Ajouter un format}} en bas du détail.',
                'Allez dans l\'onglet Production pour décrire la recette de chaque format.',
            ],
        },

        { type: 'h', id: 'guide-param-produits-colonnes', text: 'Les colonnes du tableau des formats', level: 5 },
        {
            type: 'table', head: ['Colonne', 'À quoi elle sert'], wrapCells: true, rowIds: ['guide-param-col-format', 'guide-param-col-sku', 'guide-param-col-pds', 'guide-param-col-canaux', 'guide-param-col-mix', 'guide-param-col-menu', null], rows: [
                ['{{Format}}', 'La quantité et l\'unité de ce format (ex. 250 ml).'],
                ['{{SKU}}', 'Le numéro de référence du format, généré à partir du produit et du format ; modifiable.'],
                ['{{PDS ($)}}', 'Le prix de détail suggéré au consommateur. Sert à générer le prix net de chaque canal.'],
                ['{{Canaux}}', 'Le nombre de canaux où ce format est vendu ; cliquer ouvre la ligne de détail : prix net et volume par canal. L\'étoile marque le **canal principal**, dont le prix alimente les marges affichées dans l\'onglet Production. Un format n\'est pas forcément vendu dans tous les canaux.'],
                ['{{Part des ventes (%)}}', 'La part de ce format dans vos ventes. Elle est **calculée automatiquement** à partir des volumes que vous saisissez par canal (c\'est plus précis qu\'un pourcentage tapé à la main). Si aucun volume n\'est saisi, vous pouvez taper cette part vous-même.'],
                ['{{Actif}}', 'Case à cocher : ce format est-il compris dans les analyses ? Décochez-la pour un format saisonnier ou en développement : il disparaît des moyennes, du point mort des produits actifs, du rapport d\'achats et des classements.'],
                ['Actions', 'Dupliquer le format, ou le supprimer (avec possibilité d\'annuler pendant quelques secondes).'],
            ],
        },
        { type: 'callout', kind: 'attention', text: 'Si la somme des parts des ventes des formats « actif » n\'est pas de 100 %, un bandeau jaune vous le signale (il n\'apparaît que lorsque la somme n\'est pas nulle). Une somme de 90 % ou de 120 % fausse toutes les moyennes pondérées du rapport : corrigez-la, ou saisissez les volumes réels par canal, qui calculent cette part à votre place.' },
        { type: 'callout', kind: 'astuce', text: 'Pour un nouveau format très semblable à un autre (une autre taille de la même recette), utilisez {{Dupliquer ce format}} : vous partez de la même fiche recette et n\'avez qu\'à ajuster ce qui diffère. Pour dupliquer tout le produit, y compris tous ses formats, utilisez {{Dupliquer le produit}}.' },
        { type: 'p', text: 'En haut de la liste, trois filtres (par nom, par activité, par catégorie), deux boutons de tri **A → Z** et **Z → A**, et des contrôles de pagination. Vos filtres et le produit sélectionné sont retrouvés quand vous revenez sur cet onglet.' },
        { type: 'callout', kind: 'exemple', text: 'Dans le projet démo, le « Pâté chinois traditionnel » est un seul produit à **deux formats** (340 g et 900 g), chacun avec sa recette, son prix et sa part des ventes. Dans les rapports, il apparaît donc sur deux lignes distinctes, désambiguïsées par le format entre parenthèses.' },

        // ---------------------------------------------------------------------------------
        { type: 'h', id: 'guide-param-import-ventes', text: 'Assistant d\'importation d\'un rapport de ventes' },
        { type: 'p', text: 'Plutôt que de saisir à la main les prix nets et les volumes de chaque format par canal, vous pouvez importer un rapport de ventes : un export comptable (QuickBooks, Odoo…), un rapport fourni par un distributeur, ou tout fichier Excel ou CSV qui liste un produit, une quantité vendue et un prix. Le bouton {{Importer un rapport de ventes}} lance un assistant en quatre étapes.' },
        {
            type: 'steps', items: [
                { label: 'Téléverser.', text: 'Choisissez le fichier (.csv, .xls ou .xlsx). Pour un classeur Excel, l\'assistant lit le **premier onglet** : placez-y vos données.' },
                { label: 'Faire correspondre les colonnes.', text: 'Associez chaque colonne de votre fichier à un champ de l\'application : le nom du produit, le prix net et la quantité vendue sont obligatoires ; le format, le canal, la catégorie, la date de transaction et le total net de la ligne sont facultatifs. L\'assistant devine les correspondances d\'après les titres des colonnes ; corrigez-les au besoin.' },
                { label: 'Vérifier et résoudre.', text: 'Pour chaque ligne, vous confirmez à quel produit, quel format et quel canal elle correspond. Une ligne dont le format n\'est pas résolu est désélectionnée par défaut. Pour un canal inconnu, l\'assistant propose d\'en créer un, de le lier à un canal existant ou d\'ignorer la ligne. Il ne crée jamais un nouveau format à votre place.' },
                { label: 'Confirmer.', text: 'Un récapitulatif indique ce qui sera ajouté ou mis à jour avant que vous validiez.' },
            ],
        },
        { type: 'p', text: 'Ce qui se passe à l\'importation :' },
        {
            type: 'ul', items: [
                { label: 'Regroupement.', text: 'Toutes les lignes d\'un même produit, format et canal sont regroupées : les quantités s\'additionnent. Le prix net retenu est celui de la première ligne du groupe : assurez-vous donc qu\'il est identique pour toutes les lignes d\'un même regroupement.' },
                { label: 'Mise à jour.', text: 'Le prix net et le volume du format sont mis à jour pour le canal concerné.' },
                { label: 'Parts des ventes recalculées.', text: 'La répartition des ventes de **tous** les formats actifs est recalculée à partir des volumes par canal (cet import et les précédents). Un format sans aucun volume importé apparaît à 0 %.' },
                { label: 'Période.', text: 'Si une colonne de date est associée, l\'assistant renseigne la période de référence de l\'État des résultats à partir des dates du rapport.' },
            ],
        },
        { type: 'callout', kind: 'attention', text: 'Pour un nouveau projet, vérifiez toujours que le canal et le format sont correctement liés avant de confirmer : un volume importé sur le mauvais canal fausse la marge de ce canal, et les parts des ventes recalculées changent toutes vos moyennes.' },

        { type: 'callout', kind: 'retenir', text: 'Paramètres définit le cadre : activités, canaux, unités, objectifs, et la liste des produits avec leurs formats, prix nets et volumes. Un produit contient un ou plusieurs formats ; chaque format a sa recette (dans Production) et son SKU.' },
        { type: 'words', items: [
            { term: 'Activité de production', def: 'un groupe de produits qui partagent un procédé de fabrication.' },
            { term: 'Canal, maillon', def: 'une chaîne de mise en marché et chacun de ses intermédiaires.' },
            { term: 'Produit, format, SKU', def: 'la recette ; sa version vendue (taille et emballage) ; la référence de cette version.' },
            { term: 'PDS', def: 'le prix de détail suggéré au consommateur final.' },
            { term: 'Prix net, volume', def: 'ce qui revient au producteur par unité dans un canal, et le nombre d\'unités vendues dans ce canal pour la période.' },
            { term: 'Part des ventes', def: 'la part d\'un format dans vos ventes totales.' },
            { term: 'Actif', def: 'indique si un format entre dans les analyses.' },
        ] },
    ],
};
