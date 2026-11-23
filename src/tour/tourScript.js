// Visite guidée — scénario. Chaque scène est une donnée : onglet voulu, durée, sous-titre, et des gestes datés (`at`, en ms
// depuis le début de la scène, à vitesse 1×). Le lecteur (TourPlayer) amène lui-même l'application à l'onglet (`tab`) et au
// sous-onglet (`subtab`) de la scène, en le montrant (pointeur + clic) ou, derrière une carte de titre, sans le montrer.
// En lecture normale rien ne repart de zéro : les scènes s'enchaînent sur la même page et les changements s'accumulent.
// L'application jouée n'est remontée à neuf que si l'on saute des scènes.
//
// Gestes :
//   click      { target, unless? }             — le pointeur va sur la cible, puis clique
//   pick       { target, option, instant? }    — choisit une option d'une liste déroulante (pointeur, puis choix)
//   type       { target, text, rate? }         — saisie lettre à lettre dans un champ (rate = ms par caractère)
//   note       { id, target, text, side?, read? } — étiquette qui explique un élément ; `{v}` = valeur lue en direct
//   unnote     { id? }                         — retire une étiquette (toutes si aucun id)
//   hoverAt    { target, fx, fy }              — survol d'un point d'un graphique (fractions de largeur / hauteur)
//   scroll / highlight / point / hover / guideOpen / guideClose / escape
// Cibles : sélecteur CSS, { sel, nth }, { btn, nth?, contains?, within? }, { text, within?, up? }.
//
// Sous-titres = texte de la narration (rédigé pour être lu à voix haute le jour où la visite recevra une voix humaine :
// phrases courtes, ponctuation qui respire, ni symbole ni abréviation qu'il faudrait épeler). `**mot**` = mot clé mis en
// couleur à l'écran (la voix n'en tient pas compte). Pour ajouter une voix, voir src/tour/audio/LISEZMOI.md.

export const CHAPTERS = [
    { id: 'bienvenue', title: 'Bienvenue', sub: '' },
    { id: 'entreprise', title: 'Votre entreprise', sub: 'Qui vous êtes, ce que vous vendez, et à qui' },
    { id: 'intrants', title: 'Vos intrants', sub: 'Ce que vous achetez, ce que vous payez' },
    { id: 'produit', title: 'Un produit, de A à Z', sub: 'De la recette au prix de revient' },
    { id: 'frais', title: 'Vos frais', sub: 'Ce qui ne dépend d\'aucun produit en particulier' },
    { id: 'portrait', title: 'Le portrait de votre entreprise', sub: 'Où vous en êtes, et ce qui change' },
    { id: 'detail', title: 'Zoom sur vos produits', sub: 'Par produit, par activité, par canal' },
    { id: 'coulisses', title: 'Les coulisses', sub: 'Vos achats, votre équipe, vos « et si »' },
    { id: 'partage', title: 'Pour le dire aux autres', sub: 'Un rapport PDF, un classeur Excel' },
    { id: 'aide', title: 'Jamais perdu', sub: 'Où trouver l\'aide quand on en a besoin' },
];

export const INTRO_MS = 2800;    // carte de titre au début de chaque chapitre
export const SETTLE_MS = 160;    // le temps que l'application jouée soit remontée à neuf
export const NAV_STEP_MS = 1250; // un changement d'onglet montré : pointeur, clic
export const POINT_LEAD = 650;   // le pointeur arrive, puis le geste a lieu un instant plus tard

const NEW_ING = '[id^="ingredient-row-manual_"]';
const NEW_EXPENSE = '#tutorial-section-expenses tbody tr:last-child';
const SHOCK_PCT = '[data-tour="shock-row"] input[inputmode="decimal"]';
const KPI = '[data-tour="kpi-tiles"]';
const SUBBAR = '[data-tour="subtab-bar"]';
// Constats de la Vue d'ensemble : trois blocs séparés (23/11), chacun sous le rapport qu'il commente.
const FIND_OBJ = '#tutorial-section-findings-objectif';
const FIND_EVO = '#tutorial-section-findings-evolution';
const FINDINGS = '#tutorial-section-key-findings';
const RECON = '#tutorial-section-reconciliation';
const NON_PRODUCTIF = { text: 'Total Coût du temps non productif', within: '#tutorial-section-recipe-labor' };
const CHART = '#tutorial-section-tracking-global .recharts-wrapper';
const MODAL = '.fixed.inset-0.z-50';
const tabNote = (i, to, text) => ({ at: 700 + i * 1250, do: 'note', id: `tab-${to}`, target: `#tab-${to}`, text, side: 'bottom' });
const subNote = (at, to, text) => [{ at, do: 'point', target: `[data-tour="subtab-${to}"]` }, { at: at + 100, do: 'note', id: `sub-${to}`, target: `[data-tour="subtab-${to}"]`, text, side: 'bottom' }];
const PRODUCT = { at: 0, do: 'pick', target: 'select', option: 'Chili con carne mijoté', instant: true };

// Vocabulaire de l'étape 6 : produit, actif ; jamais « plat » ni « menu ». « Colonne » (jamais « ligne ») pour un segment.
export const SCENES = [
    // --- 0. Bienvenue ---------------------------------------------------------------------------------------
    {
        id: 'accueil', chapter: 0, tab: 'info', introTitle: 'Le vrai coût de chaque produit', introSub: 'Visite guidée · environ sept minutes et demie',
        caption: `Imaginez une petite entreprise qui fabrique des repas surgelés. Chaque mois, la même question la ronge : **combien** coûte vraiment chaque produit, et **lesquels** rapportent de l'argent ? Cette visite y répond.`,
        steps: [
            { at: 400, do: 'highlight', target: 'img[alt^="Logo"]' },
            { at: 3600, do: 'note', id: 'bar', target: '#tutorial-tab-bar', text: 'Tout se passe dans ces sept onglets', side: 'bottom' },
            { at: 3600, do: 'highlight', target: '#tutorial-tab-bar' },
        ],
    },
    {
        id: 'ordre', chapter: 0, tab: 'info',
        caption: `Sept onglets, de **gauche à droite**. D'abord ce que vous achetez, puis ce que ça coûte à fabriquer, ce qui s'y ajoute, et enfin ce que tout cela vous rapporte.`,
        steps: [
            { at: 0, do: 'highlight', target: '#tutorial-tab-bar' },
            // une seule étiquette à la fois : la précédente s'efface quand le pointeur passe à l'onglet suivant
            ...[['info', '① Vos produits'], ['ingredients', '② Ce que vous achetez'], ['packaging', '③ Contenants et cartons'],
                ['labor', '④ Qui fabrique, à quel coût'], ['recipe', '⑤ La recette de chaque produit'],
                ['income-statement', '⑥ Vos frais fixes'], ['summary', '⑦ Les résultats !']]
                .flatMap(([t, txt], i) => [...(i ? [{ at: 700 + i * 1250 - 60, do: 'unnote' }] : []), tabNote(i, t, txt)]),
            ...['info', 'ingredients', 'packaging', 'labor', 'recipe', 'income-statement', 'summary'].map((t, i) => ({ at: 700 + i * 1250, do: 'point', target: `#tab-${t}` })),
        ],
    },

    // --- 1. Votre entreprise ----------------------------------------------------------------------------------
    {
        id: 'entreprise', chapter: 1, tab: 'info',
        caption: `Commençons par **vous**. Le nom de l'entreprise, d'abord. Puis vos cibles : la part du prix de vente que vous acceptez de consacrer aux ingrédients. Chaque résultat sera comparé à ces objectifs.`,
        steps: [
            { at: 300, do: 'note', id: 'nom', target: '#tutorial-company-name', text: 'Le nom de votre entreprise', side: 'right' },
            { at: 400, do: 'type', target: '#tutorial-company-name', text: 'Boréal Mets Préparés inc.', rate: 70 },
            { at: 3900, do: 'unnote' },
            { at: 4000, do: 'scroll', target: '#tutorial-section-info-objectifs' },
            { at: 4800, do: 'note', id: 'cible', target: '#foodCostTarget', text: 'Votre cible : le coût des ingrédients ne devrait pas dépasser ce %', side: 'top' },
            { at: 5400, do: 'type', target: '#foodCostTarget', text: '30', rate: 220 },
            { at: 8400, do: 'highlight', target: '#tutorial-section-info-objectifs' },
        ],
    },
    {
        id: 'objectifs', chapter: 1, tab: 'info',
        caption: `Vos cibles ne se limitent pas aux coûts. Neuf objectifs sont déjà prêts : marge nette, paie non utilisée, frais fixes… Fixez une valeur, et chaque résultat dira s'il est atteint. Vous pouvez aussi créer les vôtres.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-objectifs' },
            { at: 800, do: 'click', target: { btn: 'Gérer les objectifs' } },
            { at: 3000, do: 'note', id: 'ob1', target: { sel: '[data-testid="objectives-default"]' }, text: 'Neuf objectifs prêts à l\'emploi', side: 'top' },
            { at: 5400, do: 'unnote' },
            { at: 5500, do: 'note', id: 'ob2', target: { sel: '[data-testid="objective-margeNette"] > div:nth-child(2)' }, text: 'Fixez une valeur : la ligne passe au vert quand elle est atteinte', side: 'right' },
            { at: 5800, do: 'type', target: { sel: '[data-testid="objective-margeNette"] input[inputmode="decimal"]' }, text: '5', rate: 300 },
            { at: 7000, do: 'unnote' },
            { at: 7100, do: 'note', id: 'ob3', target: { text: 'Objectifs sur mesure', within: MODAL }, text: 'Et vos propres objectifs, jusqu\'à vingt', side: 'right' },
            { at: 7300, do: 'point', target: { btn: 'Ajouter un objectif sur mesure' } },
            { at: 9200, do: 'unnote' },
            { at: 9400, do: 'click', target: { btn: 'Terminé' } },
        ],
    },
    {
        id: 'activites', chapter: 1, tab: 'info',
        caption: `Vous fabriquez plusieurs familles de produits ? Ce sont vos **activités** : mets surgelés, soupes, sauces. Elles servent à répartir les frais, et chaque produit appartient à l'une d'elles.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-activites' },
            { at: 900, do: 'highlight', target: '#tutorial-section-info-activites' },
            { at: 1300, do: 'note', id: 'act', target: '#tutorial-section-info-activites', text: 'Activités : « qui consomme quels frais ? »', side: 'top' },
            { at: 3300, do: 'unnote' }, { at: 3400, do: 'note', id: 'act2', target: { sel: '#tutorial-section-info-activites input', nth: 0 }, text: 'Chaque produit appartient à l\'une d\'elles', side: 'top' },
            { at: 3500, do: 'point', target: { sel: '#tutorial-section-info-activites input', nth: 0 } },
        ],
    },
    {
        id: 'canaux', chapter: 1, tab: 'info',
        caption: `Entre vous et le client, il y a parfois des intermédiaires. Chaque **canal de vente** a sa chaîne, et chaque maillon prend sa part. Regardez : le prix s'ajuste à chaque étape.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-channels' },
            { at: 900, do: 'highlight', target: '#tutorial-section-info-channels' },
            { at: 1500, do: 'click', target: { btn: 'Gérer les maillons', within: '#tutorial-section-info-channels', nth: 1 } },
            { at: 3600, do: 'note', id: 'm1', target: { sel: `${MODAL} input`, nth: 0 }, text: 'Un maillon : par exemple le distributeur', side: 'bottom' },
            { at: 6200, do: 'note', id: 'm2', target: { sel: `${MODAL} select`, nth: 0 }, text: 'Il prend une marge… ou une majoration', side: 'bottom' },
            { at: 9000, do: 'unnote' }, { at: 9000, do: 'note', id: 'm3', target: { sel: `${MODAL} input`, nth: 1 }, text: 'Son pourcentage', side: 'bottom' },
            { at: 11200, do: 'escape' },
        ],
    },
    {
        id: 'produits', chapter: 1, tab: 'info',
        caption: `Voici **vos produits**, chacun avec ses formats, son prix et sa part des ventes. Une longue liste ? Tapez quelques lettres, et le produit que vous cherchez apparaît.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-menu', block: 'start' },
            { at: 1100, do: 'note', id: 'rech', target: '#filterPlatName', text: 'La recherche filtre la liste en direct', side: 'right' },
            { at: 1500, do: 'type', target: '#filterPlatName', text: 'sauce', rate: 190 },
            { at: 4400, do: 'highlight', target: '#tutorial-section-info-menu' },
            { at: 4800, do: 'note', id: 'liste', target: { sel: '#tutorial-section-info-menu select', nth: 1 }, text: 'Filtrez aussi par activité ou par catégorie', side: 'bottom' },
            { at: 8200, do: 'type', target: '#filterPlatName', text: '', rate: 100 },
        ],
    },

    // --- 2. Vos intrants --------------------------------------------------------------------------------------
    {
        id: 'ingredient-saisie', chapter: 2, tab: 'ingredients',
        caption: `Maintenant, ce que vous **achetez**. Ajoutons de la farine : son fournisseur, son format, son prix, sa perte. L'application calcule seule le coût réel de chaque kilo, perte comprise.`,
        steps: [
            { at: 600, do: 'click', target: '#tutorial-add-ingredient' },
            { at: 1900, do: 'scroll', target: NEW_ING },
            { at: 2500, do: 'highlight', target: NEW_ING },
            { at: 2600, do: 'type', target: { sel: `${NEW_ING} input`, nth: 0 }, text: 'Farine de blé', rate: 85 },
            { at: 4700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 1 }, text: 'Moulin Dubé', rate: 85 },
            { at: 6700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 2 }, text: '10', rate: 220 },
            { at: 8000, do: 'type', target: { sel: `${NEW_ING} input`, nth: 3 }, text: '18,50', rate: 200 },
            { at: 9700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 6 }, text: '3', rate: 220 },
            { at: 10900, do: 'note', id: 'pu', target: { sel: `${NEW_ING} input`, nth: 7 }, text: 'Coût unitaire : {v} $ par kg', side: 'top', read: { sel: `${NEW_ING} input`, nth: 7 } },
            { at: 11200, do: 'point', target: { sel: `${NEW_ING} input`, nth: 7 } },
        ],
    },
    {
        id: 'allergenes', chapter: 2, tab: 'ingredients',
        caption: `Un détail qui change tout pour l'étiquetage : les **allergènes**. Cochez-les une seule fois sur l'ingrédient, et ils remontent d'eux-mêmes jusqu'à la recette.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-ingredients-db tbody tr:first-child' },
            { at: 1000, do: 'note', id: 'al0', target: '#tutorial-section-ingredients-db tbody tr:first-child button[title="Gérer les allergènes"]', text: 'Le bouton des allergènes', side: 'left' },
            { at: 1100, do: 'click', target: '#tutorial-section-ingredients-db tbody tr:first-child button[title="Gérer les allergènes"]' },
            { at: 3200, do: 'unnote' },
            { at: 3400, do: 'note', id: 'al1', target: { sel: `${MODAL} label`, nth: 0 }, text: 'Les 14 allergènes majeurs', side: 'top' },
            { at: 4600, do: 'click', target: { sel: `${MODAL} label`, nth: 0 } },
            { at: 7000, do: 'unnote' }, { at: 7100, do: 'note', id: 'al2', target: { btn: 'Terminé' }, text: 'Rien d\'autre à faire : la recette les détecte', side: 'top' },
            { at: 9800, do: 'click', target: { btn: 'Terminé' } },
        ],
    },
    {
        id: 'emballage', chapter: 2, tab: 'packaging',
        caption: `Les contenants, les étiquettes, les cartons : l'**emballage** fonctionne comme les ingrédients. Et si vos prix dorment déjà dans un chiffrier, importez-les d'un seul coup.`,
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-packaging-db' },
            { at: 1400, do: 'note', id: 'pk', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: 'Le prix d\'achat : le coût unitaire suit', side: 'top' },
            { at: 1800, do: 'type', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: '92,40', rate: 230 },
            { at: 3700, do: 'unnote' },
            { at: 3900, do: 'note', id: 'imp', target: { btn: 'Importer une liste' }, text: 'Une longue liste ? Importez-la depuis Excel', side: 'bottom' },
            { at: 4100, do: 'point', target: { btn: 'Importer une liste' } },
        ],
    },
    {
        id: 'main-oeuvre', chapter: 2, tab: 'labor',
        caption: `Et les gens qui fabriquent ? Un poste, ses employés, leur salaire, leurs charges. Modifiez un salaire, et le **coût horaire du poste** suit aussitôt.`,
        steps: [
            { at: 700, do: 'highlight', target: '#tutorial-section-labor-db' },
            { at: 1300, do: 'note', id: 'sal', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: 'Salaire horaire de cet employé', side: 'top' },
            { at: 2000, do: 'type', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: '36', rate: 260 },
            { at: 4300, do: 'note', id: 'cout', target: { text: 'Coût Moyen Pondéré du Poste' }, text: 'Coût du poste : {v}', side: 'top', read: { label: 'Coût Moyen Pondéré du Poste' } },
        ],
    },

    // --- 3. Un produit, de A à Z -------------------------------------------------------------------------------
    {
        id: 'recette', chapter: 3, tab: 'recipe',
        caption: `Place à la **recette**. Choisissez un produit : la quantité produite, les ingrédients, l'emballage et les étapes apparaissent. Ici, un lot de vingt unités de chili.`,
        steps: [
            { at: 600, do: 'pick', target: 'select', option: 'Chili con carne mijoté' },
            { at: 2400, do: 'note', id: 'qte', target: { sel: '#tutorial-section-recipe-header input', nth: 0 }, text: 'Un lot = 20 unités de 400 g', side: 'right' },
            { at: 5000, do: 'unnote' }, { at: 5000, do: 'scroll', target: '#tutorial-section-recipe-ingredients' },
            { at: 5800, do: 'highlight', target: '#tutorial-section-recipe-ingredients' },
            { at: 6400, do: 'note', id: 'ing', target: { sel: '#tutorial-section-recipe-ingredients select', nth: 0 }, text: 'Chaque ingrédient vient de votre base de données', side: 'top' },
        ],
    },
    {
        id: 'recette-direct', chapter: 3, tab: 'recipe',
        caption: `Et tout se recalcule **en direct**. Un peu plus de bœuf dans la recette ? Regardez le coût matière grimper… et la marge fondre.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-ingredients' },
            { at: 1200, do: 'highlight', target: '#tutorial-section-recipe-ingredients' },
            { at: 1500, do: 'note', id: 'q', target: '#tutorial-section-recipe-ingredients input[inputmode="decimal"]', text: 'Quantité de bœuf (g)', side: 'top' },
            { at: 2400, do: 'type', target: '#tutorial-section-recipe-ingredients input[inputmode="decimal"]', text: '4800', rate: 230 },
            { at: 4600, do: 'unnote' }, { at: 4700, do: 'scroll', target: '#recap-section' },
            { at: 5600, do: 'highlight', target: { text: 'Coût Matière (%)', within: '#recap-section', up: 1 } },
            { at: 5800, do: 'note', id: 'cm', target: { text: 'Coût Matière (%)', within: '#recap-section', up: 1 }, text: 'Coût matière : {v}', side: 'top', read: { label: 'Coût Matière (%)', within: '#recap-section' } },
            { at: 8200, do: 'highlight', target: { text: 'Marge brute', within: '#recap-section', up: 1 } },
            { at: 8400, do: 'note', id: 'mb', target: { text: 'Marge brute', within: '#recap-section', up: 1 }, text: 'Marge brute : {v}', side: 'top', read: { label: 'Marge brute', within: '#recap-section' } },
        ],
    },
    {
        id: 'etapes', chapter: 3, tab: 'recipe',
        caption: `Les **étapes** disent qui travaille, quand, et pendant combien de temps. C'est de là que vient le coût de main-d'œuvre, y compris celui des heures payées qui ne servent pas à produire.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-labor', block: 'start' },
            { at: 1200, do: 'highlight', target: '#tutorial-section-recipe-labor' },
            { at: 1500, do: 'note', id: 'pers', target: { text: 'Personnel', within: '#tutorial-section-recipe-labor' }, text: 'Qui fait quoi', side: 'top' },
            { at: 4200, do: 'note', id: 'diag', target: { text: 'Diagramme de production', within: '#tutorial-section-recipe-labor' }, text: 'La chronologie, poste par poste', side: 'top' },
            { at: 6800, do: 'unnote' },
            { at: 6900, do: 'scroll', target: NON_PRODUCTIF },
            { at: 7700, do: 'highlight', target: NON_PRODUCTIF },
            { at: 7900, do: 'note', id: 'np', target: NON_PRODUCTIF, text: 'Heures payées mais non productives : {v}', side: 'top', read: { label: 'Total Coût du temps non productif (absorbé)', within: '#tutorial-section-recipe-labor' } },
        ],
    },
    {
        id: 'cascade', chapter: 3, tab: 'recipe',
        caption: `Tout en bas, le **récapitulatif** : du coût de revient complet jusqu'au point mort. Et selon le canal de vente, la marge change. Essayez les épiceries.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#recap-section', block: 'start' },
            { at: 1100, do: 'highlight', target: { text: 'Coût de Production', within: '#recap-section', up: 1 } },
            { at: 1400, do: 'note', id: 'cp', target: { text: 'Coût de Production', within: '#recap-section', up: 1 }, text: 'Ce que coûte une unité', side: 'right' },
            { at: 3600, do: 'unnote' },
            { at: 3700, do: 'highlight', target: { text: 'Point Mort', within: '#recap-section', up: 1 } },
            { at: 3800, do: 'note', id: 'pm', target: { text: 'Point Mort', within: '#recap-section', up: 1 }, text: 'Unités à vendre pour couvrir les frais', side: 'top' },
            { at: 6000, do: 'unnote' },
            { at: 6100, do: 'pick', target: '#recap-section select', option: 'Épiceries' },
            { at: 7600, do: 'highlight', target: { text: 'Marge brute', within: '#recap-section', up: 1 } },
            { at: 7800, do: 'note', id: 'canal', target: { text: 'Marge brute', within: '#recap-section', up: 1 }, text: 'Autre canal, autre marge : {v}', side: 'top', read: { label: 'Marge brute', within: '#recap-section' } },
        ],
    },
    {
        id: 'simulation-prix', chapter: 3, tab: 'recipe',
        caption: `Et si vous changiez le **prix de vente** ? Testez-le sans toucher au vrai prix : les marges et le point mort se recalculent. Descendez trop bas, et la marge s'effondre.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: { btn: 'Simuler un nouveau prix' } },
            { at: 900, do: 'click', target: { btn: 'Simuler un nouveau prix' } },
            { at: 2800, do: 'scroll', target: '#simulatedPrice' },
            { at: 3500, do: 'note', id: 'sp', target: '#simulatedPrice', text: 'Le prix que vous voulez tester', side: 'top' },
            { at: 3800, do: 'type', target: '#simulatedPrice', text: '9,50', rate: 260 },
            { at: 5600, do: 'note', id: 'sm', target: { text: 'Marge brute', within: '#recap-section', up: 1 }, text: 'Marge brute : {v}', side: 'bottom', read: { label: 'Marge brute', within: '#recap-section' } },
            { at: 8600, do: 'type', target: '#simulatedPrice', text: '6,20', rate: 260 },
        ],
    },

    // --- 4. Vos frais --------------------------------------------------------------------------------------------
    {
        id: 'revenus', chapter: 4, tab: 'income-statement',
        caption: `Jusqu'ici, c'était le modèle. Voici maintenant le **réel**, comme votre comptable le présente : ce que vous avez encaissé, puis ce que la fabrication vous a coûté.`,
        steps: [
            { at: 700, do: 'highlight', target: '#tutorial-section-revenue' },
            { at: 900, do: 'note', id: 'rev', target: '#tutorial-section-revenue', text: 'Ce que vous avez encaissé', side: 'top' },
            { at: 4000, do: 'unnote' }, { at: 4000, do: 'scroll', target: '#tutorial-section-direct-costs' },
            { at: 4800, do: 'highlight', target: '#tutorial-section-direct-costs' },
            { at: 5000, do: 'note', id: 'dir', target: '#tutorial-section-direct-costs', text: 'Ce que coûte la fabrication elle-même', side: 'top' },
        ],
    },
    {
        id: 'frais-fixes', chapter: 4, tab: 'income-statement',
        caption: `Les **frais fixes**, comme le loyer, les assurances ou l'entretien, ne dépendent d'aucun produit. Ajoutez-en un, dites où il va, et le total comme le bénéfice net réagissent aussitôt.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-expenses', block: 'start' },
            { at: 900, do: 'highlight', target: '#tutorial-section-expenses' },
            { at: 1500, do: 'click', target: { btn: '+ Ajouter une dépense' } },
            { at: 3000, do: 'scroll', target: NEW_EXPENSE },
            { at: 3600, do: 'type', target: { sel: `${NEW_EXPENSE} input`, nth: 0 }, text: 'Entretien des équipements', rate: 75 },
            { at: 6300, do: 'type', target: { sel: `${NEW_EXPENSE} input`, nth: 1 }, text: '2400', rate: 230 },
            { at: 7800, do: 'note', id: 'tot', target: { text: 'Sous-total', within: '#tutorial-section-expenses' }, text: 'Total des frais fixes : {v}', side: 'top', read: { label: 'Sous-total', within: '#tutorial-section-expenses' } },
            // La nouvelle dépense doit être rattachée à un contenant : sans cela l'application signale des frais « non répartis »
            // (bandeau « points à vérifier ») pour tout le reste de la visite. On la range dans « Général ».
            { at: 8800, do: 'note', id: 'rep', target: { sel: `${NEW_EXPENSE} select`, nth: 1 }, text: 'Où va ce frais ? On le range dans « Général »', side: 'top' },
            { at: 9000, do: 'pick', target: { sel: `${NEW_EXPENSE} select`, nth: 1 }, option: 'Général' },
            { at: 11000, do: 'unnote' },
            { at: 11800, do: 'scroll', target: { sel: '[data-tour="profit-bar"]', nth: 1 } },
            { at: 12600, do: 'highlight', target: { sel: '[data-tour="profit-bar"]', nth: 1 } },
            { at: 12800, do: 'note', id: 'net', target: { sel: '[data-tour="profit-bar"]', nth: 1 }, text: 'Bénéfice net : {v}', side: 'top', read: { label: 'Bénéfice net', within: '[data-tour="profit-bar"]', nth: 1 } },
        ],
    },
    {
        id: 'repartition', chapter: 4, tab: 'income-statement',
        caption: `Mais chaque produit doit porter sa part de ces frais. À vous de choisir la règle de partage : selon les coûts directs, le temps de production ou le volume fabriqué.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-cici' },
            { at: 1000, do: 'highlight', target: '#tutorial-section-cici' },
            { at: 1400, do: 'note', id: 'cici', target: '#tutorial-section-cici', text: 'Une règle de partage par activité', side: 'top' },
            { at: 3600, do: 'unnote' }, { at: 3700, do: 'note', id: 'cici2', target: { sel: '#tutorial-section-cici select', nth: 0 }, text: 'Choisissez la règle', side: 'top' },
            { at: 3800, do: 'point', target: { sel: '#tutorial-section-cici select', nth: 0 } },
        ],
    },
    {
        id: 'benefices', chapter: 4, tab: 'income-statement',
        caption: `Le **bénéfice brut**, c'est ce qui reste après les charges directes. Le **bénéfice net**, c'est ce qui reste après les frais fixes. Voilà ce qui vous revient vraiment.`,
        steps: [
            { at: 200, do: 'scroll', target: { sel: '[data-tour="profit-bar"]', nth: 0 } },
            { at: 900, do: 'highlight', target: { sel: '[data-tour="profit-bar"]', nth: 0 } },
            { at: 1200, do: 'note', id: 'bb', target: { sel: '[data-tour="profit-bar"]', nth: 0 }, text: 'Revenus moins charges directes', side: 'top' },
            { at: 4000, do: 'unnote' },
            { at: 4200, do: 'highlight', target: { sel: '[data-tour="profit-bar"]', nth: 1 } },
            { at: 4500, do: 'note', id: 'bn', target: { sel: '[data-tour="profit-bar"]', nth: 1 }, text: 'Puis moins les frais fixes', side: 'top' },
        ],
    },

    // --- 5. Le portrait de votre entreprise (Rapport et suivi : Vue d'ensemble) ---------------------------------------
    {
        id: 'rapport-carte', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Tout converge ici, dans **Rapport et suivi**. Neuf sous-onglets, mais quatre idées : le portrait de l'entreprise, vos produits, vos achats et votre équipe, vos « et si ».`,
        steps: [
            { at: 300, do: 'highlight', target: SUBBAR },
            ...subNote(1100, 'overview', 'Le portrait de l\'entreprise'),
            { at: 3500, do: 'unnote' },
            ...subNote(3600, 'portfolio', 'Vos produits, activités et canaux'),
            { at: 6100, do: 'unnote' },
            ...subNote(6200, 'ingredients', 'Vos achats et votre équipe'),
            { at: 8700, do: 'unnote' },
            ...subNote(8800, 'simulation', 'Vos « et si »'),
            { at: 11300, do: 'unnote' },
            { at: 11400, do: 'note', id: 'rapport-pdf', target: { btn: 'Générer un rapport PDF' }, text: 'Et un rapport PDF complet, prêt à partager', side: 'bottom' },
        ],
    },
    {
        id: 'indicateurs', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `D'abord, le portrait d'ensemble : six chiffres comparés à vos objectifs. Un triangle rouge, et les ingrédients coûtent plus cher que prévu. La **marge de sécurité**, elle, dit de combien les ventes peuvent baisser avant la perte.`,
        steps: [
            { at: 300, do: 'scroll', target: KPI }, { at: 1000, do: 'highlight', target: KPI },
            { at: 1300, do: 'note', id: 'k1', target: `${KPI} > div:first-child`, text: 'Coût matière moyen : {v}', side: 'top', read: { label: 'Coût Matière Moyen Pondéré' } },
            // Le triangle rouge est sur le coût matière (au-dessus de la cible) ; les deux autres coûts sont sous leur cible (crochet vert).
            { at: 4000, do: 'unnote' },
            { at: 4200, do: 'note', id: 'k2', target: `${KPI} > div:first-child`, text: 'Triangle rouge : au-dessus de votre cible', side: 'top' },
            { at: 6600, do: 'unnote' },
            { at: 6800, do: 'note', id: 'k6', target: `${KPI} > div:nth-child(6)`, text: 'Vos ventes peuvent baisser de {v} avant la perte', side: 'top', read: { label: 'Marge de sécurité', within: KPI } },
        ],
    },
    {
        id: 'points-reference', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Pour voir le temps passer, prenez une **photo** de votre projet : un point de référence. Chaque photo ajoute un point aux courbes, et vos coûts et vos marges se mettent enfin à bouger sous vos yeux.`,
        steps: [
            { at: 400, do: 'click', target: '#tutorial-snapshot' },
            { at: 2000, do: 'click', target: { btn: 'Nouveau point de référence' } },
            { at: 3400, do: 'type', target: '#snapshotName', text: 'Avant la hausse des prix', rate: 75 },
            { at: 6000, do: 'type', target: '#snapshotNote', text: 'Prix de novembre', rate: 85 },
            { at: 7600, do: 'note', id: 'snap', target: '#snapshotName', text: 'Une photo, avec un nom que vous retrouverez', side: 'right' },
            { at: 9000, do: 'unnote' },
            { at: 9100, do: 'click', target: { btn: 'Enregistrer' } },
            { at: 10900, do: 'scroll', target: '#tutorial-section-tracking-global' },
            { at: 11700, do: 'highlight', target: '#tutorial-section-tracking-global' },
            { at: 11900, do: 'note', id: 'g1', target: '#tutorial-section-tracking-global', text: 'Chaque point de référence = un point sur ces courbes', side: 'top' },
            { at: 13000, do: 'hoverAt', target: CHART, fx: 0.96, fy: 0.4 },
            { at: 15000, do: 'unnote' }, { at: 15100, do: 'note', id: 'g2', target: '#tutorial-section-tracking-global', text: 'Votre nouvelle photo, tout à droite', side: 'top' },
            { at: 16500, do: 'hoverAt', target: CHART, fx: 0.5, fy: 0.4 },
            { at: 18000, do: 'hoverAt', target: CHART, fx: 0.12, fy: 0.4 },
        ],
    },
    {
        id: 'constats', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Pas envie de fouiller dans les chiffres ? Les **constats clés** le font pour vous : vos objectifs atteints ou non, ce qui s'améliore ou se détériore, vos forces et vos faiblesses.`,
        steps: [
            { at: 300, do: 'scroll', target: FIND_OBJ, block: 'start' },
            { at: 1100, do: 'highlight', target: FIND_OBJ },
            { at: 1400, do: 'note', id: 'c1', target: { text: 'Objectifs stratégiques', within: FIND_OBJ }, text: 'Vos cibles : atteintes ou non', side: 'right' },
            { at: 4000, do: 'unnote' }, { at: 4100, do: 'scroll', target: FIND_EVO, block: 'start' },
            { at: 5000, do: 'note', id: 'c2', target: { text: 'Amélioration / détérioration', within: FIND_EVO }, text: 'Ce qui bouge depuis vos derniers points de référence', side: 'right' },
            { at: 7600, do: 'unnote' }, { at: 7700, do: 'scroll', target: FINDINGS, block: 'start' },
            { at: 8600, do: 'note', id: 'c3', target: { text: 'Forces et faiblesses', within: FINDINGS }, text: 'Ce qui vous distingue, en bien comme en moins bien', side: 'right' },
        ],
    },
    {
        id: 'reconciliation', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Dernier regard sur l'ensemble : la **réconciliation**. Ce que vous encaissez vraiment, contre ce que votre modèle de recettes prévoit. L'écart, c'est là qu'il faut chercher les pertes invisibles.`,
        steps: [
            { at: 300, do: 'scroll', target: RECON, block: 'start' },
            { at: 1100, do: 'highlight', target: RECON },
            { at: 1400, do: 'note', id: 'rec', target: { text: 'Réconciliation réel / théorique', within: RECON }, text: 'Réel contre théorique', side: 'right' },
            { at: 4000, do: 'unnote' },
            { at: 4300, do: 'highlight', target: { sel: `${RECON} tbody tr:last-child` } },
            { at: 4600, do: 'note', id: 'ecart', target: { sel: `${RECON} tbody tr:last-child` }, text: 'Écart du bénéfice net : {v}', side: 'bottom', read: { sel: `${RECON} tbody tr:last-child td`, nth: 3 } },
        ],
    },

    // --- 6. Zoom sur vos produits (Portefeuille, Par SKU, Par Activité, Par Canal) ------------------------------------
    {
        id: 'matrice', chapter: 6, tab: 'summary', subtab: 'portfolio',
        caption: `Vos produits ne se valent pas. La **matrice stratégique** les range selon leur popularité et leur rentabilité : étoiles, vaches à lait, dilemmes, poids morts. Changez de canal, et le classement bouge.`,
        steps: [
            { at: 300, do: 'scroll', target: '[data-tour="bcg-title"]', block: 'start' },
            { at: 1200, do: 'highlight', target: { text: 'Étoiles', within: '[data-tour="bcg-matrix"]', up: 2 } },
            { at: 1500, do: 'note', id: 'etoiles', target: { text: 'Étoiles', within: '[data-tour="bcg-matrix"]', up: 2 }, text: 'À promouvoir', side: 'bottom' },
            { at: 3400, do: 'unnote' },
            { at: 3500, do: 'highlight', target: { text: 'Poids morts', within: '[data-tour="bcg-matrix"]', up: 2 } },
            { at: 3600, do: 'note', id: 'poids', target: { text: 'Poids morts', within: '[data-tour="bcg-matrix"]', up: 2 }, text: 'À repenser ou retirer', side: 'bottom' },
            { at: 6000, do: 'unnote' },
            { at: 6200, do: 'pick', target: '#bcgChannelFilter', option: 'Épiceries' },
            { at: 8200, do: 'note', id: 'chg', target: '#bcgChannelFilter', text: 'Mêmes produits, autre canal : le classement bouge', side: 'right' },
        ],
    },
    {
        id: 'par-sku', chapter: 6, tab: 'summary', subtab: 'bySku',
        caption: `Un produit à la fois, maintenant. Du prix de vente jusqu'au point mort, voyez ce qu'il rapporte vraiment dans chacun de ses canaux. Choisissez-en un autre, et le tableau se refait.`,
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-bysku' },
            { at: 1200, do: 'note', id: 'sku', target: '#summarySkuSelect', text: 'Choisissez un produit', side: 'right' },
            { at: 2400, do: 'pick', target: '#summarySkuSelect', option: 'Saumon' },
            { at: 5200, do: 'note', id: 'mn', target: { text: 'Marge nette', within: '#tutorial-section-summary-bysku' }, text: 'Marge nette par canal', side: 'top' },
        ],
    },
    {
        id: 'par-activite', chapter: 6, tab: 'summary', subtab: 'byActivity',
        caption: `Reculez d'un cran : une **colonne** par activité. Laquelle porte l'entreprise, laquelle rapporte le moins ? Tout se lit d'un seul coup d'œil.`,
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-byactivity' },
            { at: 900, do: 'note', id: 'ba', target: '#tutorial-section-summary-byactivity', text: 'Une colonne par activité', side: 'top' },
            { at: 2600, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 1 } },
            { at: 4300, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 2 } },
        ],
    },
    {
        id: 'par-canal', chapter: 6, tab: 'summary', subtab: 'byChannel',
        caption: `Et la même chose par **canal**. Quel circuit de vente rapporte vraiment, et lequel coûte presque autant qu'il rapporte ?`,
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-bychannel' },
            { at: 900, do: 'note', id: 'bc', target: '#tutorial-section-summary-bychannel', text: 'Une colonne par canal de vente', side: 'top' },
            { at: 2600, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 1 } },
            { at: 4300, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 2 } },
        ],
    },

    {
        id: 'constats-onglet', chapter: 6, tab: 'summary', subtab: 'byChannel',
        caption: `Chaque sous-onglet se termine par ses propres constats. Ici, ceux des canaux : les forces à gauche, les faiblesses à droite, les plus graves en premier. Voilà par où commencer.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-findings-byChannel', block: 'start' },
            { at: 1100, do: 'highlight', target: '#tutorial-section-findings-byChannel' },
            { at: 1400, do: 'note', id: 'cb', target: { text: 'Constats : Par Canal', within: '#tutorial-section-findings-byChannel' }, text: 'Les constats propres à ce sous-onglet', side: 'right' },
            { at: 4600, do: 'unnote' },
            { at: 4800, do: 'click', target: { btn: 'Voir tout', contains: true, within: '#tutorial-section-findings-byChannel' } },
            { at: 8600, do: 'escape' },
        ],
    },

    // --- 7. Les coulisses (Ingrédients, Emballages, Main-d'œuvre, Simulation) -------------------------------------------
    {
        id: 'achats-ingredients', chapter: 7, tab: 'summary', subtab: 'ingredients',
        caption: `Dans les coulisses, vos achats. L'analyse ABC montre les ingrédients qui pèsent le plus lourd. Plus bas, vos fournisseurs : quand un seul pèse la moitié des achats, c'est une dépendance.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-ingredients-abc' },
            { at: 900, do: 'highlight', target: '#tutorial-section-ingredients-abc' },
            { at: 1300, do: 'note', id: 'a', target: { sel: '#tutorial-section-ingredients-abc h3', nth: 0 }, text: 'Catégorie A : les gros postes de dépense', side: 'top' },
            { at: 4000, do: 'unnote' },
            { at: 4200, do: 'scroll', target: { text: 'Achats par fournisseur', within: '#tutorial-section-ingredients-rapport' } },
            { at: 5200, do: 'highlight', target: { text: 'Achats par fournisseur', within: '#tutorial-section-ingredients-rapport', up: 1 } },
            { at: 5500, do: 'note', id: 'dep', target: { text: 'dépendance', within: '#tutorial-section-ingredients-rapport' }, text: 'Un seul fournisseur pèse la moitié des achats', side: 'top' },
        ],
    },
    {
        id: 'intrants', chapter: 7, tab: 'summary', subtab: 'ingredients',
        caption: `Chaque prix a son histoire. Choisissez un ingrédient : son prix à chaque point de référence. Quand un prix s'envole, la **volatilité** vous le signale.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-tracking-ingredient', block: 'start' },
            { at: 1200, do: 'highlight', target: '#tutorial-section-tracking-ingredient select' },
            { at: 1500, do: 'note', id: 'ing', target: '#tutorial-section-tracking-ingredient select', text: 'Choisissez un ingrédient', side: 'right' },
            { at: 3000, do: 'pick', target: '#tutorial-section-tracking-ingredient select', option: 'Bœuf haché' },
            { at: 5200, do: 'unnote' },
            { at: 5300, do: 'highlight', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 } },
            { at: 5400, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.25, fy: 0.4 },
            { at: 5600, do: 'note', id: 'pt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, text: 'Son prix à chaque point de référence', side: 'top' },
            { at: 7600, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.6, fy: 0.4 },
            { at: 9600, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.93, fy: 0.4 },
            { at: 11400, do: 'unnote' },
            { at: 11600, do: 'scroll', target: { text: 'Volatilité des prix d\'achat' } },
            { at: 12300, do: 'highlight', target: { text: 'Volatilité des prix d\'achat', up: 1 } },
            { at: 12400, do: 'note', id: 'vol', target: { text: 'Volatilité des prix d\'achat' }, text: 'Les prix qui ont le plus bougé', side: 'right' },
        ],
    },
    {
        id: 'emballages', chapter: 7, tab: 'summary', subtab: 'packaging',
        caption: `Même lecture pour vos **emballages** : les plus coûteux, vos fournisseurs, l'évolution des prix. Rien de nouveau à apprendre.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-packaging-abc' },
            { at: 900, do: 'highlight', target: '#tutorial-section-packaging-abc' },
            { at: 1300, do: 'note', id: 'pa', target: { sel: '#tutorial-section-packaging-abc h3', nth: 0 }, text: 'Vos contenants les plus coûteux', side: 'top' },
            { at: 3600, do: 'unnote' },
            { at: 3800, do: 'scroll', target: '#tutorial-section-tracking-packaging', block: 'start' },
            { at: 4800, do: 'note', id: 'pe', target: '#tutorial-section-tracking-packaging', text: 'Leur prix, à chaque point de référence', side: 'top' },
        ],
    },
    {
        id: 'main-oeuvre-rapport', chapter: 7, tab: 'summary', subtab: 'labor',
        caption: `Reste votre équipe. Combien d'heures payées servent vraiment ? L'écart, c'est de la **paie non utilisée**. Et ces heures libres sont des ventes possibles en plus : votre marge de croissance.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-labor-rapport' },
            { at: 1000, do: 'highlight', target: '#tutorial-section-labor-rapport' },
            { at: 1500, do: 'note', id: 'ecart', target: { text: 'Taux d\'Utilisation', within: '#tutorial-section-labor-rapport' }, text: 'Sous 100 % : des heures payées, mais inutilisées', side: 'top' },
            { at: 4300, do: 'unnote' },
            { at: 4400, do: 'scroll', target: '#tutorial-section-labor-paie' },
            { at: 5300, do: 'highlight', target: '#tutorial-section-labor-paie' },
            { at: 5500, do: 'note', id: 'pn', target: { text: 'Paie non utilisée', within: '#tutorial-section-labor-paie' }, text: 'Paie non utilisée : {v}', side: 'top', read: { label: 'Paie non utilisée', within: '#tutorial-section-labor-paie' } },
            { at: 8200, do: 'unnote' },
            { at: 8300, do: 'scroll', target: '#tutorial-section-labor-croissance' },
            { at: 9200, do: 'highlight', target: '#tutorial-section-labor-croissance' },
            { at: 9400, do: 'note', id: 'cr', target: { text: 'Ventes additionnelles possibles', within: '#tutorial-section-labor-croissance' }, text: 'Ventes additionnelles possibles : {v}', side: 'top', read: { label: 'Ventes additionnelles possibles', within: '#tutorial-section-labor-croissance' } },
        ],
    },
    {
        id: 'simulation', chapter: 7, tab: 'summary', subtab: 'simulation',
        caption: `Et si vos prix d'achat montaient de huit pour cent ? Puis de quinze ? Le simulateur montre l'effet sur la **marge**, le point mort et chaque activité, avant que ça n'arrive.`,
        steps: [
            { at: 500, do: 'click', target: { btn: 'Ajouter un choc' }, unless: '[data-tour="shock-row"]' },
            { at: 2100, do: 'note', id: 'pct', target: SHOCK_PCT, text: 'Hausse des prix d\'achat (%)', side: 'top' },
            { at: 2400, do: 'type', target: SHOCK_PCT, text: '8', rate: 300 },
            { at: 4000, do: 'scroll', target: '[data-tour="shock-results"]', block: 'start' },
            { at: 4800, do: 'highlight', target: '[data-tour="shock-results"]' },
            { at: 5000, do: 'note', id: 'mg', target: { text: 'Marge brute moyenne pondérée', within: '[data-tour="shock-results"]' }, text: 'Marge brute : {v}', side: 'top', read: { label: 'Marge brute moyenne pondérée', within: '[data-tour="shock-results"]' } },
            { at: 7400, do: 'type', target: SHOCK_PCT, text: '15', rate: 300 },
        ],
    },

    // --- 8. Pour le dire aux autres (exports) -------------------------------------------------------------------------------
    {
        id: 'export-pdf', chapter: 8, tab: 'summary', subtab: 'overview',
        caption: `Un banquier, un partenaire, votre équipe veulent voir vos résultats ? Le rapport complet les met en page, prêt à imprimer. Choisissez les chapitres, ajoutez votre commentaire, et décidez si les salaires y figurent.`,
        steps: [
            { at: 300, do: 'scroll', target: { btn: 'Générer un rapport PDF' } },
            { at: 1000, do: 'click', target: { btn: 'Générer un rapport PDF' } },
            { at: 4300, do: 'note', id: 'ch', target: { sel: `${MODAL} ul[aria-label="Chapitres du rapport"]` }, text: 'Huit chapitres, à cocher ou à décocher', side: 'right' },
            { at: 6500, do: 'unnote' },
            { at: 6600, do: 'note', id: 'cm', target: '#reportComment', text: 'Votre lecture, imprimée à la fin du chapitre', side: 'top' },
            { at: 6900, do: 'type', target: '#reportComment', text: 'Le prix de la viande monte.', rate: 70 },
            { at: 9900, do: 'unnote' },
            { at: 10000, do: 'click', target: { btn: 'Annexes', contains: true, within: MODAL } },
            { at: 11400, do: 'note', id: 'sal', target: { text: 'Inclure les salaires individuels', within: MODAL }, text: 'Décoché : aucun salaire dans le rapport', side: 'top' },
            { at: 13800, do: 'unnote' },
            { at: 14300, do: 'escape' },
        ],
    },
    {
        id: 'export-excel', chapter: 8, tab: 'summary', subtab: 'overview',
        caption: `Pour aller plus loin avec vos propres outils, le classeur Excel : toutes vos données, une feuille par sujet, avec un dictionnaire des colonnes. Votre comptable s'y retrouvera tout de suite.`,
        steps: [
            { at: 300, do: 'scroll', target: { btn: 'Exporter vers Excel' } },
            { at: 900, do: 'highlight', target: { btn: 'Exporter vers Excel' } },
            { at: 1100, do: 'note', id: 'xl', target: { btn: 'Exporter vers Excel' }, text: 'Toutes les données de votre projet', side: 'bottom' },
            { at: 3600, do: 'unnote' },
            { at: 3700, do: 'note', id: 'xl2', target: { btn: 'Exporter vers Excel' }, text: 'À retravailler dans Excel ou n\'importe quel outil', side: 'bottom' },
        ],
    },

    // --- 9. Jamais perdu ---------------------------------------------------------------------------------------------------
    {
        id: 'infobulles', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Un mot vous échappe ? Passez la souris sur le point d'interrogation : une courte explication s'affiche, avec un lien « En savoir plus ».`,
        steps: [
            { at: 300, do: 'scroll', target: KPI },
            { at: 1500, do: 'point', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 2500, do: 'hover', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 6000, do: 'point', target: '[data-testid="tooltip-guide-link"]' },
            { at: 8900, do: 'click', target: '[data-testid="tooltip-guide-link"]' },
        ],
    },
    {
        id: 'guide', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Pour aller plus loin, le **guide** : chaque écran, chaque calcul, avec les chiffres du projet d'exemple. Cherchez un mot, et toutes ses occurrences sont surlignées.`,
        steps: [
            { at: 300, do: 'guideOpen', unless: '[aria-label="Fermer le guide"]' },
            { at: 2800, do: 'type', target: '[data-testid="guide-search"]', text: 'point mort', rate: 110 },
            { at: 5600, do: 'note', id: 'res', target: { sel: `${MODAL} mark`, nth: 0 }, text: 'Chaque occurrence est surlignée', side: 'right' },
            { at: 7200, do: 'click', target: { btn: '↓' } },
            { at: 9000, do: 'click', target: { btn: '↓' } },
            { at: 10800, do: 'unnote' }, { at: 10900, do: 'note', id: 'pdf', target: { btn: 'Télécharger en PDF' }, text: 'Et un PDF à emporter', side: 'bottom' },
            { at: 11100, do: 'point', target: { btn: 'Télécharger en PDF' } },
            { at: 13400, do: 'guideClose' },
        ],
    },
    {
        id: 'depart', chapter: 9, tab: 'info',
        caption: `À vous de jouer ! Commencez par **Paramètres** : nommez votre entreprise, puis passez aux ingrédients. Avancez de gauche à droite, le reste suivra tout seul.`,
        steps: [
            { at: 0, do: 'guideClose' },
            { at: 300, do: 'scrollTop' }, // on revient sur Paramètres, que l'application rouvre là où on l'avait laissé : on repart du haut
            { at: 900, do: 'highlight', target: '#tutorial-tab-bar' },
            { at: 1200, do: 'point', target: '#tab-info' },
            { at: 1500, do: 'note', id: 'go', target: '#tab-info', text: 'Votre premier arrêt : Paramètres', side: 'bottom' },
            { at: 4000, do: 'unnote' }, { at: 4100, do: 'note', id: 'go2', target: '#tab-ingredients', text: 'Puis Ingrédients… et on avance vers la droite', side: 'bottom' },
            { at: 4200, do: 'point', target: '#tab-ingredients' },
        ],
    },
];

// Temps de lecture : au moins une seconde de plus que l'action, et assez pour lire le sous-titre (≈ 3,5 mots / seconde + marge).
const words = (c) => c.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;
export const readingMs = (caption) => Math.round(words(caption) * 260) + 1200;
// Durée d'une scène : le dernier geste (avec sa saisie) + 1,8 s pour voir le résultat, sans jamais couper la lecture du sous-titre.
// Moins de temps mort : la scène s'arrête dès que le sous-titre est lu et que l'action est terminée.
const gestureEnd = (st) => st.at + (st.do === 'type' ? POINT_LEAD + String(st.text).length * (st.rate || 80) : ['click', 'pick'].includes(st.do) ? POINT_LEAD : 0);
SCENES.forEach((s) => { s.duration = Math.max(Math.max(0, ...s.steps.map(gestureEnd)) + 1800, readingMs(s.caption)); });

// Texte de la narration d'une scène (sans les marques de couleur) : ce qu'une voix lirait.
export const narrationOf = (scene) => scene.caption.replace(/\*\*/g, '');

// ---- Dérivés -----------------------------------------------------------------------------------------------------------
export const expandSteps = (steps) => steps.flatMap((s) => {
    const setup = s.at === 0 && (s.instant || s.do === 'guideClose');
    if (s.do === 'click') return [{ at: s.at, do: 'point', target: s.target, unless: s.unless }, { at: s.at + POINT_LEAD, do: 'press', target: s.target, unless: s.unless }];
    if (s.do === 'pick') {
        return s.instant
            ? [{ at: s.at, do: 'select', target: s.target, option: s.option, setup }]
            : [{ at: s.at, do: 'point', target: s.target }, { at: s.at + POINT_LEAD, do: 'select', target: s.target, option: s.option }];
    }
    if (s.do === 'type') return [{ at: s.at, do: 'point', target: s.target }, { at: s.at + POINT_LEAD, do: 'type', target: s.target, text: s.text, rate: s.rate || 80 }];
    if (s.do === 'guideClose') return [{ ...s, setup }];
    return [s];
}).sort((a, b) => a.at - b.at);

export const hasIntro = (i) => i === 0 || SCENES[i - 1].chapter !== SCENES[i].chapter;
export const sceneLength = (i) => SCENES[i].duration + (hasIntro(i) ? INTRO_MS : 0);
export const TOTAL_DURATION = SCENES.reduce((n, _, i) => n + sceneLength(i), 0);
