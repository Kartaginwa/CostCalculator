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

export const CHAPTERS = [
    { id: 'bienvenue', title: 'Bienvenue', sub: '' },
    { id: 'entreprise', title: 'Votre entreprise', sub: 'Qui vous êtes, ce que vous vendez, et à qui' },
    { id: 'intrants', title: 'Vos intrants', sub: 'Ce que vous achetez, ce que vous payez' },
    { id: 'produit', title: 'Un produit, de A à Z', sub: 'De la recette au prix de revient' },
    { id: 'frais', title: 'Vos frais', sub: 'Ce qui ne dépend d\'aucun produit en particulier' },
    { id: 'analyse', title: 'Analyser', sub: 'Où gagnez-vous vraiment de l\'argent ?' },
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
const CHART = '#tutorial-section-tracking-global .recharts-wrapper';
const MODAL = '.fixed.inset-0.z-50';
const tabNote = (i, to, text) => ({ at: 700 + i * 1250, do: 'note', id: `tab-${to}`, target: `#tab-${to}`, text, side: 'bottom' });
const PRODUCT = { at: 0, do: 'pick', target: 'select', option: 'Chili con carne mijoté', instant: true };

// Sous-titres : français vivant, vocabulaire de l'étape 6 (produit, actif ; jamais « plat » ni « menu »).
export const SCENES = [
    // --- 0. Bienvenue ---------------------------------------------------------------------------------------
    {
        id: 'accueil', chapter: 0, tab: 'info', duration: 7500, introTitle: 'Le vrai coût de chaque produit', introSub: 'Visite guidée · environ 5 minutes',
        caption: '**Combien** coûte vraiment chacun de vos produits ? Et **lesquels** vous font réellement gagner de l\'argent ? Cinq minutes pour tout comprendre.',
        steps: [
            { at: 400, do: 'highlight', target: 'img[alt^="Logo"]' },
            { at: 3600, do: 'note', id: 'bar', target: '#tutorial-tab-bar', text: 'Tout se passe dans ces sept onglets', side: 'bottom' },
            { at: 3600, do: 'highlight', target: '#tutorial-tab-bar' },
        ],
    },
    {
        id: 'ordre', chapter: 0, tab: 'info', duration: 10500,
        caption: 'Sept onglets, **sept étapes**. On avance de **gauche à droite** : ce que vous achetez, ce que ça coûte à fabriquer, ce qui s\'y ajoute, puis ce que ça rapporte.',
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

    // --- 1. Vos intrants --------------------------------------------------------------------------------------
    {
        id: 'entreprise', chapter: 1, tab: 'info', duration: 10500,
        caption: 'On commence par **vous présenter** : le nom de l\'entreprise, puis vos **cibles de coûts**. L\'application comparera chacun de vos résultats à ces objectifs.',
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
        id: 'activites', chapter: 1, tab: 'info', duration: 8000,
        caption: 'Vos **activités** de production (surgélation, conserves…) servent à **répartir les frais** : chaque produit appartient à l\'une d\'elles.',
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-activites' },
            { at: 900, do: 'highlight', target: '#tutorial-section-info-activites' },
            { at: 1300, do: 'note', id: 'act', target: '#tutorial-section-info-activites', text: 'Activités : « qui consomme quels frais ? »', side: 'top' },
            { at: 3300, do: 'unnote' }, { at: 3400, do: 'note', id: 'act2', target: { sel: '#tutorial-section-info-activites input', nth: 0 }, text: 'Chaque produit appartient à l\'une d\'elles', side: 'top' },
            { at: 3500, do: 'point', target: { sel: '#tutorial-section-info-activites input', nth: 0 } },
        ],
    },
    {
        id: 'canaux', chapter: 1, tab: 'info', duration: 13500,
        caption: 'Vos **canaux de vente** décrivent la chaîne qui mène le produit jusqu\'au client. Ouvrons ses **maillons** : chaque intermédiaire ajoute sa marge, et le prix s\'ajuste à chaque étape.',
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
        id: 'produits', chapter: 1, tab: 'info', duration: 10500,
        caption: 'Voici **vos produits** : chacun avec ses formats, son prix et sa part des ventes. Une liste longue ? **Tapez quelques lettres** pour retrouver un produit.',
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-menu', block: 'start' },
            { at: 1100, do: 'note', id: 'rech', target: '#filterPlatName', text: 'La recherche filtre la liste en direct', side: 'right' },
            { at: 1500, do: 'type', target: '#filterPlatName', text: 'sauce', rate: 190 },
            { at: 4400, do: 'highlight', target: '#tutorial-section-info-menu' },
            { at: 4800, do: 'note', id: 'liste', target: { sel: '#tutorial-section-info-menu select', nth: 1 }, text: 'Filtrez aussi par activité ou par catégorie', side: 'bottom' },
            { at: 8200, do: 'type', target: '#filterPlatName', text: '', rate: 100 },
        ],
    },
    {
        id: 'ingredient-saisie', chapter: 2, tab: 'ingredients', duration: 12500,
        caption: '**Ajoutons un ingrédient** : son nom, son fournisseur, son format, son prix. L\'application calcule seule le **coût de chaque kilo**, pertes comprises.',
        steps: [
            { at: 600, do: 'click', target: '#tutorial-add-ingredient' },
            { at: 1900, do: 'scroll', target: NEW_ING },
            { at: 2500, do: 'highlight', target: NEW_ING },
            { at: 2600, do: 'type', target: { sel: `${NEW_ING} input`, nth: 0 }, text: 'Farine de blé', rate: 85 },
            { at: 4700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 1 }, text: 'Moulin Dubé', rate: 85 },
            { at: 6700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 2 }, text: '10', rate: 220 },
            { at: 8000, do: 'type', target: { sel: `${NEW_ING} input`, nth: 3 }, text: '18,50', rate: 200 },
            { at: 9700, do: 'type', target: { sel: `${NEW_ING} input`, nth: 4 }, text: '3', rate: 220 },
            { at: 10900, do: 'note', id: 'pu', target: { sel: `${NEW_ING} input`, nth: 5 }, text: 'Coût unitaire : {v} $ par kg', side: 'top', read: { sel: `${NEW_ING} input`, nth: 5 } },
            { at: 11200, do: 'point', target: { sel: `${NEW_ING} input`, nth: 5 } },
        ],
    },
    {
        id: 'allergenes', chapter: 2, tab: 'ingredients', duration: 11500,
        caption: 'Un point fort, souvent méconnu : les **allergènes**. Cochez ceux de chaque ingrédient ; ils **remontent automatiquement** jusqu\'à la recette, prêts pour votre étiquetage.',
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
        id: 'abc', chapter: 2, tab: 'ingredients', duration: 8500,
        caption: 'L\'analyse **ABC** désigne les ingrédients qui pèsent le plus lourd dans vos coûts. Surveiller ceux-là rapporte le plus. Un prix qui bouge beaucoup ? Une **alerte** s\'affiche.',
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-ingredients-abc' },
            { at: 1000, do: 'highlight', target: '#tutorial-section-ingredients-abc' },
            { at: 1300, do: 'note', id: 'a', target: { sel: '#tutorial-section-ingredients-abc h3', nth: 0 }, text: 'Catégorie A : les gros postes de dépense', side: 'top' },
            { at: 4300, do: 'note', id: 'c', target: { sel: '#tutorial-section-ingredients-abc h3', nth: 2 }, text: 'Catégorie C : les petits détails', side: 'top' },
        ],
    },
    {
        id: 'emballage', chapter: 2, tab: 'packaging', duration: 8500,
        caption: 'L\'**emballage** suit la même logique que les ingrédients : contenants, étiquettes, cartons. Une longue liste dans un chiffrier ? **Importez-la** d\'un coup.',
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-packaging-db' },
            { at: 1400, do: 'note', id: 'pk', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: 'Le prix d\'achat : le coût unitaire suit', side: 'top' },
            { at: 1800, do: 'type', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: '0,85', rate: 230 },
            { at: 3700, do: 'unnote' },
            { at: 3900, do: 'note', id: 'imp', target: { btn: 'Importer une liste' }, text: 'Une longue liste ? Importez-la depuis Excel', side: 'bottom' },
            { at: 4100, do: 'point', target: { btn: 'Importer une liste' } },
        ],
    },
    {
        id: 'main-oeuvre', chapter: 2, tab: 'labor', duration: 11500,
        caption: 'La **main-d\'œuvre** : un poste, ses employés, leur salaire et leurs charges. Changez un salaire et le **coût horaire du poste** suit tout de suite.',
        steps: [
            { at: 700, do: 'highlight', target: '#tutorial-section-labor-db' },
            { at: 1300, do: 'note', id: 'sal', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: 'Salaire horaire de cet employé', side: 'top' },
            { at: 2000, do: 'type', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: '36', rate: 260 },
            { at: 4300, do: 'note', id: 'cout', target: { text: 'Coût Moyen Pondéré du Poste' }, text: 'Coût du poste : {v}', side: 'top', read: { label: 'Coût Moyen Pondéré du Poste' } },
        ],
    },
    {
        id: 'productivite', chapter: 2, tab: 'labor', duration: 7000,
        caption: 'Le **rapport de productivité** compare les heures payées aux heures vraiment nécessaires. L\'écart, c\'est de la **capacité inutilisée** que vous payez quand même.',
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-labor-rapport' },
            { at: 1000, do: 'highlight', target: '#tutorial-section-labor-rapport' },
            { at: 1500, do: 'note', id: 'ecart', target: { text: 'Taux d\'Utilisation', within: '#tutorial-section-labor-rapport' }, text: 'Sous 100 % : des heures payées, mais inutilisées', side: 'top' },
            { at: 3600, do: 'point', target: { sel: '#tutorial-section-labor-rapport tbody tr', nth: 0 } },
        ],
    },

    // --- 2. Un produit, de A à Z -------------------------------------------------------------------------------
    {
        id: 'recette', chapter: 3, tab: 'recipe', duration: 10500,
        caption: 'Onglet **Production** : on choisit un produit… et sa **recette** apparaît. Quantité produite, ingrédients, emballage, étapes de fabrication.',
        steps: [
            { at: 600, do: 'pick', target: 'select', option: 'Chili con carne mijoté' },
            { at: 2400, do: 'note', id: 'qte', target: { sel: '#tutorial-section-recipe-header input', nth: 0 }, text: 'Un lot = 20 unités de 400 g', side: 'right' },
            { at: 5000, do: 'unnote' }, { at: 5000, do: 'scroll', target: '#tutorial-section-recipe-ingredients' },
            { at: 5800, do: 'highlight', target: '#tutorial-section-recipe-ingredients' },
            { at: 6400, do: 'note', id: 'ing', target: { sel: '#tutorial-section-recipe-ingredients select', nth: 0 }, text: 'Chaque ingrédient vient de votre base de données', side: 'top' },
        ],
    },
    {
        id: 'recette-direct', chapter: 3, tab: 'recipe', duration: 12500,
        caption: '**Tout se recalcule en direct.** Plus de bœuf dans la recette ? Regardez le **coût matière** monter… et la marge fondre.',
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
        id: 'etapes', chapter: 3, tab: 'recipe', duration: 8500,
        caption: 'Les **étapes de fabrication** disent qui travaille, quand et combien de temps. C\'est de là que vient le **coût de main-d\'œuvre** de chaque unité.',
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-labor', block: 'start' },
            { at: 1200, do: 'highlight', target: '#tutorial-section-recipe-labor' },
            { at: 1500, do: 'note', id: 'pers', target: { text: 'Personnel', within: '#tutorial-section-recipe-labor' }, text: 'Qui fait quoi', side: 'top' },
            { at: 4200, do: 'note', id: 'diag', target: { text: 'Diagramme de production', within: '#tutorial-section-recipe-labor' }, text: 'La chronologie, poste par poste', side: 'top' },
        ],
    },
    {
        id: 'cascade', chapter: 3, tab: 'recipe', duration: 12500,
        caption: 'Le **récapitulatif** : du coût de revient complet jusqu\'au **point mort**. Et selon le **canal de vente**, la marge n\'est pas la même — essayez !',
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
        id: 'simulation-prix', chapter: 3, tab: 'recipe', duration: 14000,
        caption: 'Et si vous changiez le **prix de vente** ? Le mode **simulation** recalcule les marges et le point mort, sans toucher au prix réel. Trop bas, et la marge s\'effondre.',
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

    // --- 3. Vos frais --------------------------------------------------------------------------------------------
    {
        id: 'revenus', chapter: 4, tab: 'income-statement', duration: 8000,
        caption: 'L\'**état des résultats** reprend vos chiffres réels : vos **revenus**, puis vos **charges directes** (matières, emballage, sous-traitance), comme votre comptable les présente.',
        steps: [
            { at: 700, do: 'highlight', target: '#tutorial-section-revenue' },
            { at: 900, do: 'note', id: 'rev', target: '#tutorial-section-revenue', text: 'Ce que vous avez encaissé', side: 'top' },
            { at: 4000, do: 'unnote' }, { at: 4000, do: 'scroll', target: '#tutorial-section-direct-costs' },
            { at: 4800, do: 'highlight', target: '#tutorial-section-direct-costs' },
            { at: 5000, do: 'note', id: 'dir', target: '#tutorial-section-direct-costs', text: 'Ce que coûte la fabrication elle-même', side: 'top' },
        ],
    },
    {
        id: 'frais-fixes', chapter: 4, tab: 'income-statement', duration: 16500,
        caption: 'Les **frais fixes** — loyer, assurances, entretien — ne dépendent d\'aucun produit. **Ajoutez-en un**, dites **où il va** : le total, puis le **bénéfice net**, réagissent aussitôt.',
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
        id: 'repartition', chapter: 4, tab: 'income-statement', duration: 8500,
        caption: 'Ces frais, il faut les **répartir** entre vos produits. Vous choisissez la règle : selon les **coûts directs**, le **temps de production** ou le **volume** fabriqué.',
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-cici' },
            { at: 1000, do: 'highlight', target: '#tutorial-section-cici' },
            { at: 1400, do: 'note', id: 'cici', target: '#tutorial-section-cici', text: 'Une règle de partage par activité', side: 'top' },
            { at: 3600, do: 'unnote' }, { at: 3700, do: 'note', id: 'cici2', target: { sel: '#tutorial-section-cici select', nth: 0 }, text: 'Choisissez la règle', side: 'top' },
            { at: 3800, do: 'point', target: { sel: '#tutorial-section-cici select', nth: 0 } },
        ],
    },
    {
        id: 'benefices', chapter: 4, tab: 'income-statement', duration: 7500,
        caption: 'Le **bénéfice brut** (revenus moins charges directes) puis le **bénéfice net** (moins les frais fixes), et la **réconciliation** avec ce que le modèle calcule.',
        steps: [
            { at: 200, do: 'scroll', target: { sel: '[data-tour="profit-bar"]', nth: 0 } },
            { at: 900, do: 'highlight', target: { sel: '[data-tour="profit-bar"]', nth: 0 } },
            { at: 3200, do: 'scroll', target: '#tutorial-section-reconciliation' },
            { at: 4000, do: 'highlight', target: '#tutorial-section-reconciliation' },
            { at: 4200, do: 'note', id: 'rec', target: '#tutorial-section-reconciliation', text: 'Réel contre théorique : l\'écart se lit ici', side: 'top' },
        ],
    },

    // --- 4. Analyser ------------------------------------------------------------------------------------------------------
    {
        id: 'indicateurs', chapter: 5, tab: 'summary', subtab: 'overview', duration: 9500,
        caption: 'Voici le **tableau de bord** : cinq indicateurs pour **tous vos produits actifs**, comparés à vos objectifs. Un **triangle rouge**, c\'est un coût au-dessus de la cible.',
        steps: [
            { at: 300, do: 'scroll', target: KPI }, { at: 1000, do: 'highlight', target: KPI },
            { at: 1300, do: 'note', id: 'k1', target: `${KPI} > div:first-child`, text: 'Coût matière moyen : {v}', side: 'top', read: { label: 'Coût Matière Moyen Pondéré' } },
            // Le triangle rouge est sur le coût matière (au-dessus de la cible) ; les deux autres coûts sont sous leur cible (crochet vert).
            { at: 4000, do: 'unnote' },
            { at: 4200, do: 'note', id: 'k2', target: `${KPI} > div:first-child`, text: 'Triangle rouge : au-dessus de votre cible', side: 'top' },
            { at: 6600, do: 'unnote' },
            { at: 6800, do: 'note', id: 'k3', target: `${KPI} > div:nth-child(2)`, text: 'Crochet vert : sous la cible', side: 'top' },
        ],
    },
    {
        id: 'matrice', chapter: 5, tab: 'summary', subtab: 'overview', duration: 13500,
        caption: 'La **matrice stratégique** classe chaque produit : **étoiles**, **vaches à lait**, **dilemmes**, **poids morts**. Changez de canal : le classement change aussi.',
        steps: [
            { at: 300, do: 'scroll', target: '[data-tour="bcg-title"]', block: 'start' },
            { at: 1200, do: 'highlight', target: { text: 'Étoiles', within: '#strategic-analysis', up: 2 } },
            { at: 1500, do: 'note', id: 'etoiles', target: { text: 'Étoiles', within: '#strategic-analysis', up: 2 }, text: 'À promouvoir', side: 'bottom' },
            { at: 3400, do: 'unnote' },
            { at: 3500, do: 'highlight', target: { text: 'Poids morts', within: '#strategic-analysis', up: 2 } },
            { at: 3600, do: 'note', id: 'poids', target: { text: 'Poids morts', within: '#strategic-analysis', up: 2 }, text: 'À repenser ou retirer', side: 'bottom' },
            { at: 6000, do: 'unnote' },
            { at: 6200, do: 'pick', target: '#bcgChannelFilter', option: 'Épiceries' },
            { at: 8200, do: 'note', id: 'chg', target: '#bcgChannelFilter', text: 'Mêmes produits, autre canal : le classement bouge', side: 'right' },
        ],
    },
    {
        id: 'par-sku', chapter: 5, tab: 'summary', subtab: 'bySku', duration: 10500,
        caption: '**Par SKU** : un produit suivi à travers chacun de ses canaux. Prix, marges, frais fixes, **point mort**. Choisissez-en un autre, le tableau se refait.',
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-bysku' },
            { at: 1200, do: 'note', id: 'sku', target: '#summarySkuSelect', text: 'Choisissez un produit', side: 'right' },
            { at: 2400, do: 'pick', target: '#summarySkuSelect', option: 'Saumon' },
            { at: 5200, do: 'note', id: 'mn', target: { text: 'Marge nette', within: '#tutorial-section-summary-bysku' }, text: 'Marge nette par canal', side: 'top' },
        ],
    },
    {
        id: 'par-activite', chapter: 5, tab: 'summary', subtab: 'byActivity', duration: 7000,
        caption: '**Par Activité** : la même analyse vue d\'en haut, une colonne par activité. Où l\'entreprise **gagne**, où elle **perd** — en un coup d\'œil.',
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-byactivity' },
            { at: 900, do: 'note', id: 'ba', target: '#tutorial-section-summary-byactivity', text: 'Une colonne par activité', side: 'top' },
            { at: 2600, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 1 } },
            { at: 4300, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 2 } },
        ],
    },
    {
        id: 'par-canal', chapter: 5, tab: 'summary', subtab: 'byChannel', duration: 7000,
        caption: '**Par Canal** : la même chose, avec une colonne par circuit de vente. Lequel rapporte vraiment, lequel coûte plus qu\'il ne rapporte ?',
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-summary-bychannel' },
            { at: 900, do: 'note', id: 'bc', target: '#tutorial-section-summary-bychannel', text: 'Une colonne par canal de vente', side: 'top' },
            { at: 2600, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 1 } },
            { at: 4300, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 2 } },
        ],
    },
    {
        id: 'simulation', chapter: 5, tab: 'summary', subtab: 'simulation', duration: 14500,
        caption: '**Et si** vos prix d\'achat montaient de 8 % ? Puis de 15 % ? Le simulateur montre l\'effet sur la **marge**, le **point mort** et chaque activité.',
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
    {
        id: 'points-reference', chapter: 5, tab: 'summary', subtab: 'overview', duration: 19500,
        caption: 'Un **point de référence** est une **photo** de votre projet. Chaque photo ajoute **un point** aux graphiques d\'évolution : en les alignant, vous voyez vos coûts et vos marges **bouger dans le temps**.',
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
        id: 'intrants', chapter: 5, tab: 'summary', subtab: 'intrants', duration: 15500,
        caption: 'Le sous-onglet **Intrants** suit le **prix de chaque ingrédient** d\'un point de référence à l\'autre. Un prix qui s\'envole ? La **volatilité** le signale.',
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

    // --- 5. Jamais perdu ---------------------------------------------------------------------------------------------------
    {
        id: 'infobulles', chapter: 6, tab: 'summary', subtab: 'overview', duration: 11000,
        caption: 'Un terme qui vous échappe ? **Passez la souris** sur le point d\'interrogation : une courte explication s\'affiche, avec un lien **« En savoir plus »**.',
        steps: [
            { at: 300, do: 'scroll', target: KPI },
            { at: 1500, do: 'point', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 2500, do: 'hover', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 6000, do: 'point', target: '[data-testid="tooltip-guide-link"]' },
            { at: 8900, do: 'click', target: '[data-testid="tooltip-guide-link"]' },
        ],
    },
    {
        id: 'guide', chapter: 6, tab: 'summary', subtab: 'overview', duration: 14500,
        caption: 'Le **guide** est la bibliothèque complète : chaque écran, chaque calcul, avec les chiffres du projet d\'exemple. On y **cherche un mot** : toutes ses occurrences sont surlignées.',
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
        id: 'depart', chapter: 6, tab: 'info', duration: 8500,
        caption: 'À vous de jouer ! **Commencez par Paramètres** : nommez votre entreprise, puis passez aux **ingrédients**. Avancez de gauche à droite : le reste suivra tout seul.',
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
