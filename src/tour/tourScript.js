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
// Sous-titres = texte de la narration (rédigé pour être lu à voix haute par une voix humaine ou de synthèse sous licence :
// phrases courtes, ponctuation qui respire, ni symbole ni abréviation qu'il faudrait épeler). `**mot**` = mot clé mis en
// couleur à l'écran (la voix n'en tient pas compte). Pour ajouter une voix, voir src/tour/audio/LISEZMOI.md.

export const CHAPTERS = [
    { id: 'bienvenue', title: 'Bienvenue', sub: '', narration: `Bienvenue dans TransfoCalculateur. [pause] Un outil pour connaître vos coûts de revient et fixer vos prix en confiance.` },
    { id: 'entreprise', title: 'Votre entreprise', sub: 'Qui vous êtes, ce que vous vendez, et à qui', narration: `Première étape : votre entreprise. Qui vous êtes, ce que vous vendez, et à qui.` },
    { id: 'intrants', title: 'Vos intrants', sub: 'Ce que vous achetez, ce que vous payez', narration: `Deuxième étape : vos intrants. Ce que vous achetez, et ce que vous payez.` },
    { id: 'produit', title: 'Un produit, de A à Z', sub: 'De la recette au prix de revient', narration: `Un produit, du début à la fin. De la recette jusqu'au prix de revient.` },
    { id: 'frais', title: 'Vos frais', sub: 'Ce qui ne dépend d\'aucun produit en particulier', narration: `Vos frais. Tout ce qui ne dépend d'aucun produit en particulier, et la façon de les répartir.` },
    { id: 'portrait', title: 'Le portrait de votre entreprise', sub: 'Où vous en êtes, et ce qui change', narration: `Le portrait de votre entreprise. Où vous en êtes, et ce qui change.` },
    { id: 'detail', title: 'Zoom sur vos produits', sub: 'Par produit, par activité, par canal', narration: `Zoom sur vos produits. Par produit, par activité, par canal.` },
    { id: 'coulisses', title: 'Les coulisses', sub: 'Vos achats, votre équipe, vos « et si »', narration: `Les coulisses. Vos achats, votre équipe, vos simulations.` },
    { id: 'partage', title: 'Pour le dire aux autres', sub: 'Un rapport PDF, un classeur Excel', narration: `Pour le dire aux autres. Un rapport complet, et un classeur Excel.` },
    { id: 'aide', title: 'Jamais perdu', sub: 'Où trouver l\'aide quand on en a besoin', narration: `Jamais perdu. Où trouver de l'aide, quand on en a besoin.` },
];

export const INTRO_MS = 2800;    // durée minimale de la carte de titre au début de chaque chapitre (la voix peut l'allonger)
export const INTRO_OUT_MS = 450; // fondu de sortie de la carte de titre
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
const subNote = (at, to, text) => [{ at, do: 'point', target: `[data-tour="subtab-${to}"]` }, { at: at + 100, do: 'note', id: `sub-${to}`, target: `[data-tour="subtab-${to}"]`, text, side: 'bottom' }];
const PRODUCT = { at: 0, do: 'pick', target: 'select', option: 'Chili con carne mijoté', instant: true };


// Vocabulaire de l'étape 6 : produit, actif ; jamais « plat » ni « menu ». « Colonne » (jamais « ligne ») pour un segment.
// Un sous-titre s'écrit comme il se dira : `[pause]` marque une courte pause pour la voix (jamais affichée à l'écran).
export const SCENES = [
    // --- 0. Bienvenue ---------------------------------------------------------------------------------------
    {
        id: 'accueil', chapter: 0, tab: 'info', introTitle: 'Le vrai coût de chaque produit', introSub: 'Visite guidée',
        caption: `Imaginez une petite entreprise qui fabrique des repas surgelés. Chaque mois, la même question la ronge : [pause] **combien** coûte vraiment chaque produit, et **lesquels** rapportent de l'argent ? Cette visite y répond.`,
        steps: [
            { at: 400, do: 'highlight', target: 'img[alt^="Logo"]' },
            { at: 8400, do: 'note', id: 'bar', target: '#tutorial-tab-bar', text: 'Tout se passe dans ces sept onglets', side: 'bottom' },
            { at: 8400, do: 'highlight', target: '#tutorial-tab-bar' },
        ],
    },
    {
        id: 'ordre', chapter: 0, tab: 'info',
        caption: `L'application compte **sept onglets**, de **gauche à droite**. D'abord ce que vous achetez, puis ce que coûte la fabrication, ce qui s'y ajoute, et enfin ce que tout cela vous rapporte.`,
        steps: [
            { at: 0, do: 'highlight', target: '#tutorial-tab-bar' },
            // une seule étiquette à la fois : le pointeur part vers l'onglet 600 ms avant que l'étiquette n'apparaisse, pour qu'il y soit
            // à son arrivée ; les onglets sont espacés d'au moins 0,8 s, calés sur les propositions de la voix (« de gauche à droite », « ce que vous achetez », « la fabrication », « ce qui s'y ajoute », « ce que tout cela vous rapporte ») pour que le balayage reste lisible
            ...[[2200, 'info', '① Vos produits'], [3500, 'ingredients', '② Ce que vous achetez'], [4300, 'packaging', '③ Contenants et cartons'],
                [5300, 'labor', '④ Qui fabrique, à quel coût'], [6100, 'recipe', '⑤ La recette de chaque produit'],
                [7300, 'income-statement', '⑥ Vos frais fixes'], [8700, 'summary', '⑦ Les résultats !']]
                .flatMap(([at, t, txt], i) => [...(i ? [{ at: at - 80, do: 'unnote' }] : []),
                    { at: at - 600, do: 'point', target: `#tab-${t}` }, { at, do: 'note', id: `tab-${t}`, target: `#tab-${t}`, text: txt, side: 'bottom' }]),
        ],
    },

    // --- 1. Votre entreprise ----------------------------------------------------------------------------------
    {
        id: 'entreprise', chapter: 1, tab: 'info',
        caption: `Commençons par **vous**. Le nom de l'entreprise, d'abord. [pause] Puis vos cibles : la part du prix de vente que vous acceptez de consacrer aux ingrédients. Chaque résultat sera comparé à vos objectifs.`,
        steps: [
            { at: 1300, do: 'note', id: 'nom', target: '#tutorial-company-name', text: 'Le nom de votre entreprise', side: 'right' },
            { at: 1500, do: 'type', target: '#tutorial-company-name', text: 'Boréal Mets Préparés inc.', rate: 70 },
            { at: 4600, do: 'unnote' },
            { at: 4600, do: 'scroll', target: '#tutorial-section-info-objectifs' },
            { at: 5500, do: 'note', id: 'cible', target: '#foodCostTarget', text: 'Votre cible : le coût des ingrédients ne devrait pas dépasser ce %', side: 'top' },
            { at: 6300, do: 'type', target: '#foodCostTarget', text: '30', rate: 220 },
            { at: 9800, do: 'highlight', target: '#tutorial-section-info-objectifs' },
        ],
    },
    {
        id: 'objectifs', chapter: 1, tab: 'info',
        caption: `Vos cibles ne se limitent pas aux coûts. Neuf objectifs sont déjà prêts : marge nette, paie non utilisée, frais fixes. Fixez une valeur, et chaque résultat dira s'il est atteint. [pause] Vous pouvez aussi créer les vôtres : un indicateur, un sens, une valeur.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-objectifs' },
            { at: 700, do: 'click', target: { btn: 'Gérer les objectifs' } },
            { at: 1900, do: 'note', id: 'ob1', target: { sel: '[data-testid="objectives-default"]' }, text: 'Neuf objectifs prêts à l\'emploi', side: 'top' },
            { at: 8300, do: 'unnote' },
            { at: 8500, do: 'note', id: 'ob2', target: { sel: '[data-testid="objective-margeNette"] > div:nth-child(2)' }, text: 'Fixez une valeur : la ligne passe au vert quand elle est atteinte', side: 'right' },
            { at: 8700, do: 'type', target: { sel: '[data-testid="objective-margeNette"] input[inputmode="decimal"]' }, text: '5', rate: 300 },
            { at: 12700, do: 'unnote' },
            // L'arrêt sur la création d'un objectif sur mesure : on l'ajoute, on choisit l'indicateur et la valeur, puis on le retire
            // pour que le projet démo reste tel quel.
            { at: 12800, do: 'click', target: { btn: 'Ajouter un objectif sur mesure' } },
            { at: 13700, do: 'scroll', target: { sel: '[data-testid="objectives-custom"] select[aria-label="Indicateur"]' } },
            { at: 14000, do: 'note', id: 'ob3', target: { sel: '[data-testid="objectives-custom"] select[aria-label="Indicateur"]' }, text: 'Un indicateur, un sens, une valeur', side: 'top' },
            { at: 14400, do: 'pick', target: { sel: '[data-testid="objectives-custom"] select[aria-label="Indicateur"]' }, option: 'Marge brute' },
            { at: 15000, do: 'type', target: { sel: '[data-testid="objectives-custom"] input[aria-label="Valeur de l\'objectif"]' }, text: '50', rate: 300 },
            { at: 15900, do: 'unnote' },
            { at: 16000, do: 'click', target: { sel: '[data-testid="objectives-custom"] button[aria-label="Supprimer l\'objectif"]' } },
            { at: 16700, do: 'click', target: { btn: 'Terminé' } },
        ],
    },
    {
        id: 'activites', chapter: 1, tab: 'info',
        caption: `Vous fabriquez plusieurs familles de produits ? Ce sont vos **activités** : mets surgelés, soupes, sauces. [pause] Elles servent à répartir les frais, et chaque produit appartient à l'une d'elles.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-activites' },
            { at: 700, do: 'highlight', target: '#tutorial-section-info-activites' },
            { at: 2600, do: 'note', id: 'act', target: '#tutorial-section-info-activites', text: 'Activités : « qui consomme quels frais ? »', side: 'top' },
            { at: 6800, do: 'unnote' }, { at: 8900, do: 'note', id: 'act2', target: { sel: '#tutorial-section-info-activites input', nth: 0 }, text: 'Chaque produit appartient à l\'une d\'elles', side: 'top' },
            { at: 8800, do: 'point', target: { sel: '#tutorial-section-info-activites input', nth: 0 } },
        ],
    },
    {
        id: 'canaux', chapter: 1, tab: 'info',
        caption: `Entre vous et le client, il y a parfois des intermédiaires. Chaque **canal de vente** a sa chaîne, et chaque maillon, comme un distributeur, prend sa part. [pause] Vous fixez la marge ou la majoration de chacun.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-channels' },
            { at: 700, do: 'highlight', target: '#tutorial-section-info-channels' },
            // le cadre bleu ne doit pas rester sur la page quand la fenêtre s'ouvre devant elle
            { at: 2900, do: 'highlight', target: null },
            { at: 3000, do: 'click', target: { btn: 'Gérer les maillons', within: '#tutorial-section-info-channels', nth: 1 } },
            { at: 5400, do: 'note', id: 'm1', target: { sel: `${MODAL} input`, nth: 0 }, text: 'Un maillon : par exemple un distributeur', side: 'bottom' },
            { at: 7600, do: 'unnote' }, { at: 7800, do: 'note', id: 'm2', target: { sel: `${MODAL} select`, nth: 0 }, text: 'Il prend une marge… ou une majoration', side: 'bottom' },
            { at: 8600, do: 'pick', target: { sel: `${MODAL} select`, nth: 0 }, option: 'Majoration' },
            { at: 10000, do: 'pick', target: { sel: `${MODAL} select`, nth: 0 }, option: 'Marge' },
            { at: 9800, do: 'unnote' }, { at: 9900, do: 'note', id: 'm3', target: { sel: `${MODAL} input`, nth: 1 }, text: 'Son pourcentage', side: 'bottom' },
            { at: 11500, do: 'escape' },
        ],
    },
    {
        id: 'produits', chapter: 1, tab: 'info',
        caption: `Voici **vos produits**, chacun avec ses formats, son prix et sa part des ventes. Une longue liste ? Tapez quelques lettres, et le produit que vous cherchez apparaît. [pause] Vous pouvez aussi filtrer par activité.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-menu', block: 'start' },
            { at: 5300, do: 'note', id: 'rech', target: '#filterPlatName', text: 'La recherche filtre la liste en direct', side: 'right' },
            { at: 5800, do: 'type', target: '#filterPlatName', text: 'sauce', rate: 190 },
            { at: 7900, do: 'highlight', target: '#tutorial-section-info-menu' },
            { at: 9100, do: 'type', target: '#filterPlatName', text: '', rate: 100 },
            { at: 9200, do: 'unnote' },
            { at: 9400, do: 'note', id: 'liste', target: { sel: '#tutorial-section-info-menu select', nth: 0 }, text: 'Filtrez aussi par activité ou par catégorie', side: 'bottom' },
            { at: 10000, do: 'pick', target: { sel: '#tutorial-section-info-menu select', nth: 0 }, option: 'Mets principaux surgelés' },
        ],
    },
    {
        id: 'produits-canaux', chapter: 1, tab: 'info',
        caption: `Chaque produit se vend dans un ou plusieurs **canaux**. Pour chacun, vous indiquez le prix net et le volume de ventes. [pause] Ces volumes servent ensuite à mesurer ce que chaque canal rapporte vraiment.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-info-menu', block: 'start' },
            { at: 300, do: 'click', target: { btn: 'Chili con carne mijoté', contains: true, within: '#tutorial-section-info-menu' } },
            { at: 1700, do: 'click', target: { btn: 'canaux', contains: true, within: '#tutorial-section-info-menu' } },
            { at: 3500, do: 'note', id: 'pn', target: { sel: '#tutorial-section-info-menu input[placeholder="Prix net $"]', nth: 0 }, text: 'Le prix net, canal par canal', side: 'top' },
            { at: 5300, do: 'unnote' }, { at: 5500, do: 'note', id: 'vo', target: { sel: '#tutorial-section-info-menu input[placeholder="Volume (u.)"]', nth: 0 }, text: 'Le volume vendu dans ce canal', side: 'top' },
            { at: 8500, do: 'highlight', target: { sel: '#tutorial-section-info-menu input[placeholder="Volume (u.)"]', nth: 0 } },
        ],
    },

    // --- 2. Vos intrants --------------------------------------------------------------------------------------
    {
        id: 'ingredient-saisie', chapter: 2, tab: 'ingredients',
        caption: `Maintenant, ce que vous **achetez**. Ajoutons de la farine : son fournisseur, son format, son prix, sa perte. [pause] L'application calcule seule le coût réel de chaque kilo, perte comprise.`,
        steps: [
            { at: 300, do: 'click', target: '#tutorial-add-ingredient' },
            { at: 1100, do: 'scroll', target: NEW_ING },
            { at: 1250, do: 'highlight', target: NEW_ING },
            { at: 1300, do: 'type', target: { sel: `${NEW_ING} input`, nth: 0 }, text: 'Farine de blé', rate: 60 },
            { at: 2400, do: 'type', target: { sel: `${NEW_ING} input`, nth: 1 }, text: 'Moulin Dubé', rate: 60 },
            { at: 3300, do: 'type', target: { sel: `${NEW_ING} input`, nth: 2 }, text: '10', rate: 220 },
            { at: 4100, do: 'type', target: { sel: `${NEW_ING} input`, nth: 3 }, text: '18,50', rate: 120 },
            { at: 5000, do: 'type', target: { sel: `${NEW_ING} input`, nth: 6 }, text: '3', rate: 220 },
            { at: 6400, do: 'note', id: 'pu', target: { sel: `${NEW_ING} input`, nth: 7 }, text: 'Coût unitaire : {v} $ par kg', side: 'top', read: { sel: `${NEW_ING} input`, nth: 7 } },
            { at: 6600, do: 'point', target: { sel: `${NEW_ING} input`, nth: 7 } },
            // « perte comprise » : on revient sur la perte au moment où la voix le dit
            { at: 9900, do: 'unnote' },
            { at: 10000, do: 'note', id: 'pe', target: { sel: `${NEW_ING} input`, nth: 6 }, text: 'La perte est déjà comptée', side: 'top' },
        ],
    },
    {
        id: 'allergenes', chapter: 2, tab: 'ingredients',
        caption: `Un détail qui change tout pour l'étiquetage : les **allergènes**. Cochez-les une seule fois sur l'ingrédient, et ils remontent d'eux-mêmes jusqu'à la recette.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-ingredients-db tbody tr:first-child' },
            { at: 1200, do: 'note', id: 'al0', target: '#tutorial-section-ingredients-db tbody tr:first-child button[title="Gérer les allergènes"]', text: 'Le bouton des allergènes', side: 'left' },
            { at: 1700, do: 'click', target: '#tutorial-section-ingredients-db tbody tr:first-child button[title="Gérer les allergènes"]' },
            { at: 2500, do: 'unnote' },
            { at: 2700, do: 'note', id: 'al1', target: { sel: `${MODAL} label`, nth: 0 }, text: 'Les 14 allergènes majeurs', side: 'top' },
            { at: 3300, do: 'click', target: { sel: `${MODAL} label`, nth: 0 } },
            { at: 5400, do: 'unnote' }, { at: 5600, do: 'note', id: 'al2', target: { btn: 'Terminé' }, text: 'Rien d\'autre à faire : la recette les détecte', side: 'top' },
            { at: 6600, do: 'click', target: { btn: 'Terminé' } },
        ],
    },
    {
        id: 'emballage', chapter: 2, tab: 'packaging',
        caption: `Les contenants, les étiquettes, les cartons : l'**emballage** fonctionne comme les ingrédients. [pause] Et si vos prix dorment déjà dans un chiffrier, importez-les d'un seul coup.`,
        steps: [
            { at: 500, do: 'highlight', target: '#tutorial-section-packaging-db' },
            { at: 3100, do: 'note', id: 'pk', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: 'Le prix d\'achat : le coût unitaire suit', side: 'top' },
            { at: 3400, do: 'type', target: { sel: '#tutorial-section-packaging-db tbody tr:first-child input', nth: 3 }, text: '92,40', rate: 230 },
            { at: 5600, do: 'unnote' },
            { at: 5800, do: 'note', id: 'imp', target: { btn: 'Importer une liste' }, text: 'Une longue liste ? Importez-la depuis Excel', side: 'bottom' },
            { at: 8800, do: 'point', target: { btn: 'Importer une liste' } },
        ],
    },
    {
        id: 'main-oeuvre', chapter: 2, tab: 'labor',
        caption: `Et les gens qui fabriquent ? Un poste, ses employés, leur salaire, leurs charges. [pause] Chaque employé a aussi un temps productif attendu : la part des heures payées qui sert vraiment à produire. Modifiez un salaire, et le **coût horaire du poste** suit aussitôt.`,
        steps: [
            { at: 300, do: 'highlight', target: '#tutorial-section-labor-db' },
            { at: 3300, do: 'note', id: 'sal', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: 'Salaire horaire de cet employé', side: 'top' },
            { at: 5500, do: 'unnote' },
            { at: 6100, do: 'note', id: 'tp', target: { text: '% Temps productif attendu', within: '#tutorial-section-labor-db' }, text: 'La part des heures payées qui produit vraiment', side: 'top' },
            { at: 6300, do: 'point', target: { text: '% Temps productif attendu', within: '#tutorial-section-labor-db' } },
            { at: 11700, do: 'unnote' },
            { at: 11800, do: 'type', target: { sel: '#tutorial-section-labor-db input', nth: 2 }, text: '36', rate: 260 },
            { at: 13700, do: 'note', id: 'cout', target: { text: 'Coût Moyen Pondéré du Poste' }, text: 'Coût du poste : {v}', side: 'top', read: { label: 'Coût Moyen Pondéré du Poste' } },
        ],
    },

    // --- 3. Un produit, de A à Z : les cinq parties de l'onglet Production, dans l'ordre ---------------------------------
    {
        id: 'recette', chapter: 3, tab: 'recipe',
        caption: `Place à la **recette**. Choisissez un produit : tout ce qu'il faut pour le fabriquer se présente en cinq parties, dans l'ordre. [pause] Ici, un lot de vingt unités de chili.`,
        steps: [
            { at: 900, do: 'pick', target: 'select', option: 'Chili con carne mijoté' },
            // « cinq parties, dans l'ordre » : on les survole une à une, au rythme de la voix, puis on revient à l'en-tête
            ...[[3700, '#tutorial-section-recipe-ingredients'], [4400, '#tutorial-section-recipe-packaging'], [5100, '#tutorial-section-recipe-labor'],
                [5800, '#tutorial-section-recipe-additional'], [6500, '#recap-section']]
                .flatMap(([at, sel]) => [{ at, do: 'scroll', target: sel, block: 'start' }, { at: at + 250, do: 'highlight', target: sel }]),
            { at: 7500, do: 'scroll', target: '#tutorial-section-recipe-header', block: 'start' },
            { at: 7700, do: 'highlight', target: null },
            { at: 8800, do: 'note', id: 'qte', target: { sel: '#tutorial-section-recipe-header input', nth: 0 }, text: 'Un lot = 20 unités de 400 g', side: 'right' },
        ],
    },
    {
        id: 'recette-direct', chapter: 3, tab: 'recipe',
        caption: `**Première partie**, les ingrédients. Chacun vient de votre base de données, et tout se recalcule **en direct**. [pause] Un peu plus de bœuf ? Regardez le coût des ingrédients grimper.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-ingredients', block: 'start' },
            { at: 600, do: 'highlight', target: '#tutorial-section-recipe-ingredients' },
            { at: 2500, do: 'note', id: 'ing', target: { sel: '#tutorial-section-recipe-ingredients select', nth: 0 }, text: 'Chaque ingrédient vient de votre base de données', side: 'top' },
            { at: 4500, do: 'unnote' },
            { at: 4700, do: 'note', id: 'q', target: '#tutorial-section-recipe-ingredients input[inputmode="decimal"]', text: 'Quantité de bœuf (g)', side: 'top' },
            { at: 5000, do: 'type', target: '#tutorial-section-recipe-ingredients input[inputmode="decimal"]', text: '4800', rate: 230 },
            { at: 8300, do: 'unnote' },
            { at: 8400, do: 'note', id: 'cm', target: { text: 'Coût Matières (unité)', within: '#tutorial-section-recipe-ingredients' }, text: 'Coût des ingrédients, par unité : {v}', side: 'top', read: { label: 'Coût Matières (unité)', within: '#tutorial-section-recipe-ingredients' } },
        ],
    },
    {
        id: 'recette-emballage', chapter: 3, tab: 'recipe',
        caption: `**Deuxième partie**, l'emballage : les contenants, les étiquettes, les cartons de ce produit. Même principe, avec ses propres pertes. [pause] Et le coût par unité se met à jour aussitôt.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-packaging', block: 'start' },
            { at: 600, do: 'highlight', target: '#tutorial-section-recipe-packaging' },
            { at: 3000, do: 'note', id: 'pk', target: { sel: '#tutorial-section-recipe-packaging input[inputmode="decimal"]', nth: 0 }, text: 'Combien de contenants par lot', side: 'top' },
            { at: 6700, do: 'type', target: { sel: '#tutorial-section-recipe-packaging input[inputmode="decimal"]', nth: 0 }, text: '25', rate: 250 },
            { at: 8800, do: 'unnote' },
            { at: 8900, do: 'note', id: 'cu', target: { text: 'Coût Emballage (unité)', within: '#tutorial-section-recipe-packaging' }, text: 'Emballage, par unité : {v}', side: 'top', read: { label: 'Coût Emballage (unité)', within: '#tutorial-section-recipe-packaging' } },
        ],
    },
    {
        id: 'etapes', chapter: 3, tab: 'recipe',
        caption: `**Troisième partie**, les étapes : qui travaille, quand, et pendant combien de temps. [pause] C'est de là que vient le coût de main-d'œuvre, y compris celui des heures payées qui ne servent pas à produire.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-labor', block: 'start' },
            { at: 600, do: 'highlight', target: '#tutorial-section-recipe-labor' },
            { at: 2200, do: 'note', id: 'pers', target: { text: 'Personnel', within: '#tutorial-section-recipe-labor' }, text: 'Qui fait quoi', side: 'top' },
            { at: 2900, do: 'unnote' }, { at: 3000, do: 'note', id: 'diag', target: { text: 'Diagramme de production', within: '#tutorial-section-recipe-labor' }, text: 'La chronologie, poste par poste', side: 'top' },
            { at: 5900, do: 'unnote' },
            { at: 7600, do: 'scroll', target: NON_PRODUCTIF },
            { at: 8300, do: 'highlight', target: NON_PRODUCTIF },
            { at: 8600, do: 'note', id: 'np', target: NON_PRODUCTIF, text: 'Heures payées mais non productives : {v}', side: 'top', read: { label: 'Total Coût du temps non productif (absorbé)', within: '#tutorial-section-recipe-labor' } },
        ],
    },
    {
        id: 'couts-additionnels', chapter: 3, tab: 'recipe',
        caption: `**Quatrième partie**, les coûts additionnels. Deux options, selon votre cas : la sous-traitance, quand une étape est confiée à un tiers, et le vieillissement, pour un produit qui mûrit avant d'être vendu.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#tutorial-section-recipe-additional', block: 'start' },
            { at: 1300, do: 'click', target: { text: '4. Coûts additionnels', within: '#tutorial-section-recipe-additional' } },
            { at: 2700, do: 'highlight', target: '#tutorial-section-recipe-additional' },
            { at: 4900, do: 'note', id: 'st', target: { text: 'Sous-traitance', within: '#tutorial-section-recipe-additional' }, text: 'Une étape confiée à un tiers', side: 'top' },
            { at: 8200, do: 'unnote' }, { at: 8400, do: 'note', id: 'vi', target: { text: 'Vieillissement', within: '#tutorial-section-recipe-additional' }, text: 'Un produit qui mûrit avant la vente', side: 'top' },
        ],
    },
    {
        id: 'cascade', chapter: 3, tab: 'recipe',
        caption: `**Cinquième et dernière partie**, le récapitulatif : du coût de revient complet jusqu'au point mort. [pause] Et selon le canal de vente, la marge change. Essayons les épiceries.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: '#recap-section', block: 'start' },
            { at: 3300, do: 'highlight', target: { text: 'Coût de Production', within: '#recap-section', up: 1 } },
            { at: 3500, do: 'note', id: 'cp', target: { text: 'Coût de Production', within: '#recap-section', up: 1 }, text: 'Ce que coûte une unité', side: 'right' },
            { at: 4900, do: 'unnote' },
            { at: 5200, do: 'highlight', target: { text: 'Point Mort', within: '#recap-section', up: 1 } },
            { at: 5300, do: 'note', id: 'pm', target: { text: 'Point Mort', within: '#recap-section', up: 1 }, text: 'Unités à vendre pour couvrir les frais', side: 'top' },
            { at: 6900, do: 'unnote' },
            { at: 7100, do: 'note', id: 'cn', target: '#recap-section select', text: 'Le canal de vente', side: 'bottom' },
            { at: 9300, do: 'pick', target: '#recap-section select', option: 'Épiceries' },
            { at: 10200, do: 'unnote' },
            { at: 10300, do: 'highlight', target: { text: 'Marge brute', within: '#recap-section', up: 1 } },
            { at: 10500, do: 'note', id: 'canal', target: { text: 'Marge brute', within: '#recap-section', up: 1 }, text: 'Autre canal, autre marge : {v}', side: 'top', read: { label: 'Marge brute', within: '#recap-section' } },
        ],
    },
    {
        id: 'simulation-prix', chapter: 3, tab: 'recipe',
        caption: `Et si vous changiez le **prix de vente** ? Testez-le sans toucher au vrai prix : les marges et le point mort se recalculent. [pause] Descendez trop bas, et la marge s'effondre.`,
        steps: [
            PRODUCT,
            { at: 300, do: 'scroll', target: { btn: 'Simuler un nouveau prix' } },
            { at: 1400, do: 'click', target: { btn: 'Simuler un nouveau prix' } },
            { at: 2800, do: 'scroll', target: '#simulatedPrice' },
            { at: 3300, do: 'note', id: 'sp', target: '#simulatedPrice', text: 'Le prix que vous voulez tester', side: 'top' },
            { at: 3900, do: 'type', target: '#simulatedPrice', text: '9,50', rate: 260 },
            { at: 5800, do: 'note', id: 'sm', target: { text: 'Marge brute', within: '#recap-section', up: 1 }, text: 'Marge brute : {v}', side: 'bottom', read: { label: 'Marge brute', within: '#recap-section' } },
            { at: 7800, do: 'type', target: '#simulatedPrice', text: '6,20', rate: 260 },
        ],
    },

    // --- 4. Vos frais : le réel, les frais fixes, leurs clés de répartition et le coefficient d'imputation ---------------------
    {
        id: 'revenus', chapter: 4, tab: 'income-statement',
        caption: `Jusqu'ici, c'était le modèle. [pause] Voici maintenant le **réel**, comme votre comptable le présente : ce que vous avez encaissé, puis ce que la fabrication vous a coûté.`,
        steps: [
            { at: 3000, do: 'highlight', target: '#tutorial-section-revenue' },
            { at: 6200, do: 'note', id: 'rev', target: '#tutorial-section-revenue', text: 'Ce que vous avez encaissé', side: 'top' },
            { at: 7700, do: 'unnote' }, { at: 7700, do: 'scroll', target: '#tutorial-section-direct-costs' },
            { at: 8000, do: 'highlight', target: '#tutorial-section-direct-costs' },
            { at: 8300, do: 'note', id: 'dir', target: '#tutorial-section-direct-costs', text: 'Ce que coûte la fabrication elle-même', side: 'top' },
        ],
    },
    {
        id: 'frais-fixes', chapter: 4, tab: 'income-statement',
        caption: `Les **frais fixes**, comme le loyer, les assurances ou l'entretien, ne dépendent d'aucun produit. [pause] Ajoutez-en un, dites où il va, et le total réagit aussitôt.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-expenses', block: 'start' },
            { at: 700, do: 'highlight', target: '#tutorial-section-expenses' },
            { at: 3800, do: 'note', id: 'lo', target: { sel: '#tutorial-section-expenses tbody tr:first-child input', nth: 0 }, text: 'Un frais qui ne dépend d\'aucun produit', side: 'top' },
            { at: 5500, do: 'unnote' },
            { at: 5700, do: 'click', target: { btn: '+ Ajouter une dépense' } },
            { at: 6400, do: 'scroll', target: NEW_EXPENSE },
            { at: 6450, do: 'type', target: { sel: `${NEW_EXPENSE} input`, nth: 0 }, text: 'Entretien', rate: 55 },
            { at: 7300, do: 'type', target: { sel: `${NEW_EXPENSE} input`, nth: 1 }, text: '2400', rate: 100 },
            // La nouvelle dépense doit être rattachée à un contenant : sans cela l'application signale des frais « non répartis »
            // (bandeau « points à vérifier ») pour tout le reste de la visite. On la range dans « Général ».
            { at: 8200, do: 'pick', target: { sel: `${NEW_EXPENSE} select`, nth: 1 }, option: 'Général' },
            { at: 9000, do: 'note', id: 'tot', target: { text: 'Sous-total', within: '#tutorial-section-expenses' }, text: 'Total des frais fixes : {v}', side: 'top', read: { label: 'Sous-total', within: '#tutorial-section-expenses' } },
        ],
    },
    {
        id: 'cles-repartition', chapter: 4, tab: 'income-statement',
        caption: `Mais chaque frais a une **clé de répartition** : elle décide qui le supporte. [pause] Le loyer peut être affecté à des activités précises, l'électricité suivre les charges directes, la publicité se répartir entre les canaux. Changez la clé, et les colonnes se redistribuent.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-expenses', block: 'start' },
            { at: 500, do: 'highlight', target: { text: 'Clé de répartition', within: '#tutorial-section-expenses' } },
            { at: 700, do: 'note', id: 'cle', target: { text: 'Clé de répartition', within: '#tutorial-section-expenses' }, text: 'Qui supporte ce frais ?', side: 'top' },
            { at: 4800, do: 'unnote' },
            { at: 4900, do: 'highlight', target: null },
            { at: 5200, do: 'note', id: 'k1', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(1) select', nth: 1 }, text: 'Manuel : vous répartissez vous-même', side: 'top' },
            { at: 8700, do: 'unnote' },
            { at: 8800, do: 'note', id: 'k2', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(2) select', nth: 1 }, text: 'Selon les charges directes', side: 'top' },
            { at: 10300, do: 'unnote' },
            { at: 10400, do: 'note', id: 'k3', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(3) select', nth: 1 }, text: 'Manuel, canal par canal', side: 'top' },
            { at: 12600, do: 'unnote' },
            { at: 12800, do: 'pick', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(2) select', nth: 1 }, option: 'Selon les ventes' },
            { at: 13500, do: 'note', id: 'k4', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(2) select', nth: 1 }, text: 'Autre clé : les montants se redistribuent', side: 'bottom' },
            { at: 14500, do: 'pick', target: { sel: '#tutorial-section-expenses tbody tr:nth-child(2) select', nth: 1 }, option: 'Selon les charges directes' },
        ],
    },
    {
        id: 'repartition', chapter: 4, tab: 'income-statement',
        caption: `Dernière étape : le **coefficient d'imputation des charges indirectes**. Pour chaque activité, vous choisissez la règle qui partage les frais : selon les coûts directs, le temps de production ou le volume fabriqué. [pause] Changez-la, et la part de chaque produit change.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-cici', block: 'start' },
            { at: 700, do: 'highlight', target: '#tutorial-section-cici' },
            { at: 1300, do: 'note', id: 'cici', target: '#tutorial-section-cici', text: 'CICI : la règle de partage des frais indirects', side: 'top' },
            { at: 2900, do: 'unnote' }, { at: 3100, do: 'note', id: 'cici2', target: { sel: '#tutorial-section-cici select', nth: 1 }, text: 'Une règle par activité', side: 'top' },
            { at: 6400, do: 'point', target: { sel: '#tutorial-section-cici select', nth: 1 } },
            { at: 11900, do: 'pick', target: { sel: '#tutorial-section-cici select', nth: 1 }, option: 'Au prorata du temps de production' },
            { at: 12400, do: 'unnote' }, { at: 12700, do: 'note', id: 'cici3', target: { sel: '#tutorial-section-cici select', nth: 1 }, text: 'Autre règle, autre part pour chaque produit', side: 'top' },
            { at: 13900, do: 'pick', target: { sel: '#tutorial-section-cici select', nth: 1 }, option: 'Au prorata des coûts directs' },
        ],
    },

    // --- 5. Le portrait de votre entreprise (Rapport et suivi : Vue d'ensemble) ---------------------------------------
    {
        id: 'rapport-carte', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Tout converge ici, dans **Rapport et suivi**. Neuf sous-onglets, mais quatre idées : [pause] le portrait de l'entreprise, vos produits, vos achats et votre équipe, vos simulations.`,
        steps: [
            { at: 1500, do: 'highlight', target: SUBBAR },
            ...subNote(5600, 'overview', 'Le portrait de l\'entreprise'),
            { at: 7200, do: 'unnote' },
            ...subNote(7300, 'portfolio', 'Vos produits, activités et canaux'),
            { at: 8300, do: 'unnote' },
            ...subNote(8400, 'ingredients', 'Vos achats et votre équipe'),
            { at: 10100, do: 'unnote' },
            ...subNote(10200, 'simulation', 'Vos simulations'),
        ],
    },
    {
        id: 'indicateurs', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `D'abord, le portrait d'ensemble : six chiffres comparés à vos objectifs. Un triangle rouge signale des ingrédients plus coûteux que prévu. [pause] La **marge de sécurité**, elle, dit de combien les ventes peuvent baisser avant la perte.`,
        steps: [
            { at: 300, do: 'scroll', target: KPI }, { at: 800, do: 'highlight', target: KPI },
            { at: 2300, do: 'note', id: 'k1', target: `${KPI} > div:first-child`, text: 'Coût matière moyen : {v}', side: 'top', read: { label: 'Coût Matière Moyen Pondéré' } },
            // Le triangle rouge est sur le coût matière (au-dessus de la cible) ; les deux autres coûts sont sous leur cible (crochet vert).
            { at: 3000, do: 'unnote' },
            { at: 3200, do: 'note', id: 'k2', target: `${KPI} > div:first-child`, text: 'Triangle rouge : au-dessus de votre cible', side: 'top' },
            { at: 9400, do: 'unnote' },
            { at: 9600, do: 'highlight', target: `${KPI} > div:nth-child(6)` },
            { at: 11400, do: 'note', id: 'k6', target: `${KPI} > div:nth-child(6)`, text: 'Vos ventes peuvent baisser de {v} avant la perte', side: 'top', read: { label: 'Marge de sécurité', within: KPI } },
        ],
    },
    {
        id: 'points-reference', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Pour voir le temps passer, prenez une **photo** de votre projet : un point de référence. [pause] Chaque photo ajoute un point aux courbes, et vos coûts et vos marges se mettent enfin à bouger sous vos yeux.`,
        steps: [
            { at: 700, do: 'click', target: '#tutorial-snapshot' },
            { at: 1700, do: 'click', target: { btn: 'Nouveau point de référence' } },
            { at: 2800, do: 'type', target: '#snapshotName', text: 'Avant la hausse des prix', rate: 60 },
            { at: 4950, do: 'type', target: '#snapshotNote', text: 'Prix de novembre', rate: 60 },
            { at: 6300, do: 'note', id: 'snap', target: '#snapshotName', text: 'Une photo, avec un nom que vous retrouverez', side: 'right' },
            { at: 7000, do: 'unnote' },
            { at: 7100, do: 'click', target: { btn: 'Enregistrer' } },
            { at: 8300, do: 'scroll', target: '#tutorial-section-tracking-global' },
            { at: 8500, do: 'highlight', target: '#tutorial-section-tracking-global' },
            { at: 8700, do: 'note', id: 'g1', target: '#tutorial-section-tracking-global', text: 'Chaque point de référence = un point sur ces courbes', side: 'top' },
            { at: 9100, do: 'hoverAt', target: CHART, fx: 0.96, fy: 0.4 },
            { at: 10000, do: 'unnote' }, { at: 10100, do: 'note', id: 'g2', target: '#tutorial-section-tracking-global', text: 'Votre nouvelle photo, tout à droite', side: 'top' },
            { at: 10500, do: 'hoverAt', target: CHART, fx: 0.5, fy: 0.4 },
        ],
    },
    {
        id: 'constats', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Pas envie de fouiller dans les chiffres ? Les **constats clés** le font pour vous : [pause] vos objectifs atteints ou non, ce qui s'améliore ou se détériore, vos forces et vos faiblesses.`,
        steps: [
            { at: 300, do: 'scroll', target: FIND_OBJ, block: 'start' },
            { at: 1500, do: 'highlight', target: FIND_OBJ },
            { at: 3600, do: 'note', id: 'c1', target: { text: 'Objectifs stratégiques', within: FIND_OBJ }, text: 'Vos cibles : atteintes ou non', side: 'right' },
            { at: 5500, do: 'unnote' }, { at: 5600, do: 'scroll', target: FIND_EVO, block: 'start' },
            { at: 5900, do: 'note', id: 'c2', target: { text: 'Amélioration / détérioration', within: FIND_EVO }, text: 'Ce qui bouge depuis vos derniers points de référence', side: 'right' },
            { at: 7700, do: 'unnote' }, { at: 7800, do: 'scroll', target: FINDINGS, block: 'start' },
            { at: 8300, do: 'note', id: 'c3', target: { text: 'Forces et faiblesses', within: FINDINGS }, text: 'Ce qui vous distingue, en bien comme en moins bien', side: 'right' },
        ],
    },
    {
        id: 'reconciliation', chapter: 5, tab: 'summary', subtab: 'overview',
        caption: `Dernier regard sur l'ensemble : la **réconciliation**. [pause] Ce que vous encaissez vraiment, contre ce que votre modèle de recettes prévoit. L'écart, c'est là qu'il faut chercher les pertes invisibles.`,
        steps: [
            { at: 300, do: 'scroll', target: RECON, block: 'start' },
            { at: 1700, do: 'highlight', target: RECON },
            { at: 4000, do: 'note', id: 'rec', target: { text: 'Réconciliation réel / théorique', within: RECON }, text: 'Réel contre théorique', side: 'right' },
            { at: 7900, do: 'unnote' },
            { at: 8300, do: 'highlight', target: { sel: `${RECON} tbody tr:last-child` } },
            { at: 8500, do: 'note', id: 'ecart', target: { sel: `${RECON} tbody tr:last-child` }, text: 'Écart du bénéfice net : {v}', side: 'bottom', read: { sel: `${RECON} tbody tr:last-child td`, nth: 3 } },
        ],
    },

    // --- 6. Zoom sur vos produits (Portefeuille, Par SKU, Par Activité, Par Canal) ------------------------------------
    {
        id: 'matrice', chapter: 6, tab: 'summary', subtab: 'portfolio',
        caption: `Vos produits ne se valent pas. La **matrice stratégique** les range selon leur popularité et leur rentabilité : étoiles, vaches à lait, dilemmes, poids morts. [pause] Et si vous changiez de canal ? Essayons les épiceries : le classement bouge.`,
        steps: [
            { at: 300, do: 'scroll', target: '[data-tour="bcg-title"]', block: 'start' },
            { at: 2100, do: 'highlight', target: '[data-tour="bcg-matrix"]' },
            { at: 6300, do: 'highlight', target: { text: 'Étoiles', within: '[data-tour="bcg-matrix"]', up: 2 } },
            { at: 6400, do: 'note', id: 'etoiles', target: { text: 'Étoiles', within: '[data-tour="bcg-matrix"]', up: 2 }, text: 'À promouvoir', side: 'bottom' },
            { at: 7700, do: 'unnote' },
            { at: 8800, do: 'highlight', target: { text: 'Poids morts', within: '[data-tour="bcg-matrix"]', up: 2 } },
            { at: 8850, do: 'note', id: 'poids', target: { text: 'Poids morts', within: '[data-tour="bcg-matrix"]', up: 2 }, text: 'À repenser ou retirer', side: 'bottom' },
            { at: 9900, do: 'unnote' },
            { at: 10400, do: 'note', id: 'chg', target: '#bcgChannelFilter', text: 'Choisissez un canal', side: 'right' },
            { at: 11750, do: 'pick', target: '#bcgChannelFilter', option: 'Épiceries' },
            { at: 13000, do: 'unnote' }, { at: 13300, do: 'note', id: 'chg2', target: '#bcgChannelFilter', text: 'Mêmes produits, autre canal : le classement bouge', side: 'right' },
        ],
    },
    {
        id: 'par-sku', chapter: 6, tab: 'summary', subtab: 'bySku',
        caption: `Un produit à la fois, maintenant. Du prix de vente jusqu'au point mort, voyez ce qu'il rapporte vraiment dans chacun de ses canaux. [pause] Choisissez-en un autre, et le tableau se refait.`,
        steps: [
            { at: 400, do: 'highlight', target: '#tutorial-section-summary-bysku' },
            { at: 4800, do: 'note', id: 'mn', target: { text: 'Marge nette', within: '#tutorial-section-summary-bysku' }, text: 'Marge nette par canal', side: 'top' },
            { at: 7700, do: 'unnote' },
            { at: 7900, do: 'note', id: 'sku', target: '#summarySkuSelect', text: 'Choisissez un produit', side: 'right' },
            { at: 8100, do: 'pick', target: '#summarySkuSelect', option: 'Saumon' },
        ],
    },
    {
        id: 'par-activite', chapter: 6, tab: 'summary', subtab: 'byActivity',
        caption: `Reculez d'un cran : une **colonne** par activité. [pause] Laquelle porte l'entreprise, laquelle rapporte le moins ? Tout se lit d'un seul coup d'œil.`,
        steps: [
            { at: 400, do: 'highlight', target: '#tutorial-section-summary-byactivity' },
            { at: 1300, do: 'note', id: 'ba', target: '#tutorial-section-summary-byactivity', text: 'Une colonne par activité', side: 'top' },
            { at: 3400, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 1 } },
            { at: 5000, do: 'point', target: { sel: '#tutorial-section-summary-byactivity thead th', nth: 2 } },
            { at: 7100, do: 'highlight', target: '#tutorial-section-summary-byactivity' },
        ],
    },
    {
        id: 'par-canal', chapter: 6, tab: 'summary', subtab: 'byChannel',
        caption: `Et la même chose par **canal**. Quel circuit de vente rapporte vraiment, et lequel coûte presque autant qu'il rapporte ?`,
        steps: [
            { at: 300, do: 'highlight', target: '#tutorial-section-summary-bychannel' },
            { at: 700, do: 'note', id: 'bc', target: '#tutorial-section-summary-bychannel', text: 'Une colonne par canal de vente', side: 'top' },
            { at: 2300, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 1 } },
            { at: 4100, do: 'point', target: { sel: '#tutorial-section-summary-bychannel thead th', nth: 2 } },
        ],
    },
    {
        id: 'constats-onglet', chapter: 6, tab: 'summary', subtab: 'byChannel',
        caption: `Chaque sous-onglet se termine par ses propres constats. Ici, ceux des canaux : les forces à gauche, les faiblesses à droite, les plus graves en premier. [pause] Voilà par où commencer.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-findings-byChannel', block: 'start' },
            { at: 2700, do: 'highlight', target: '#tutorial-section-findings-byChannel' },
            { at: 3000, do: 'note', id: 'cb', target: { text: 'Constats : Par Canal', within: '#tutorial-section-findings-byChannel' }, text: 'Les constats propres à ce sous-onglet', side: 'right' },
            { at: 4100, do: 'unnote' },
            // le cadre bleu s'efface avant l'ouverture : il ne doit pas passer par-dessus la fenêtre
            { at: 4200, do: 'highlight', target: null },
            { at: 4300, do: 'click', target: { btn: 'Voir tout', contains: true, within: '#tutorial-section-findings-byChannel' } },
            { at: 9800, do: 'escape' },
        ],
    },

    // --- 7. Les coulisses (Ingrédients, Emballages, Main-d'œuvre, Simulation) -------------------------------------------
    {
        id: 'achats-ingredients', chapter: 7, tab: 'summary', subtab: 'ingredients',
        caption: `Dans les coulisses, vos achats. L'analyse ABC montre les ingrédients qui pèsent le plus lourd. [pause] Plus bas, vos fournisseurs : quand un seul pèse la moitié des achats, c'est une dépendance.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-ingredients-abc' },
            { at: 700, do: 'highlight', target: '#tutorial-section-ingredients-abc' },
            { at: 2500, do: 'note', id: 'a', target: { sel: '#tutorial-section-ingredients-abc h3', nth: 0 }, text: 'Catégorie A : les gros postes de dépense', side: 'top' },
            { at: 6300, do: 'unnote' },
            { at: 6700, do: 'scroll', target: { text: 'Achats par fournisseur', within: '#tutorial-section-ingredients-rapport' } },
            { at: 7500, do: 'highlight', target: { text: 'Achats par fournisseur', within: '#tutorial-section-ingredients-rapport', up: 1 } },
            { at: 9000, do: 'note', id: 'dep', target: { text: 'dépendance', within: '#tutorial-section-ingredients-rapport' }, text: 'Un seul fournisseur pèse la moitié des achats', side: 'top' },
            { at: 11200, do: 'highlight', target: { text: 'dépendance', within: '#tutorial-section-ingredients-rapport', up: 1 } },
        ],
    },
    {
        id: 'intrants', chapter: 7, tab: 'summary', subtab: 'ingredients',
        caption: `Chaque prix a son histoire. Choisissez un ingrédient : son prix à chaque point de référence. [pause] Quand un prix s'envole, la **volatilité** vous le signale.`,
        steps: [
            { at: 300, do: 'scroll', target: '#tutorial-section-tracking-ingredient', block: 'start' },
            { at: 700, do: 'highlight', target: '#tutorial-section-tracking-ingredient select' },
            { at: 1700, do: 'note', id: 'ing', target: '#tutorial-section-tracking-ingredient select', text: 'Choisissez un ingrédient', side: 'right' },
            { at: 2000, do: 'pick', target: '#tutorial-section-tracking-ingredient select', option: 'Bœuf haché' },
            { at: 3100, do: 'unnote' },
            { at: 3300, do: 'highlight', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 } },
            { at: 3400, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.25, fy: 0.4 },
            { at: 3500, do: 'note', id: 'pt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, text: 'Son prix à chaque point de référence', side: 'top' },
            { at: 4300, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.6, fy: 0.4 },
            { at: 5000, do: 'hoverAt', target: { sel: '#tutorial-section-tracking-ingredient .recharts-wrapper', nth: 0 }, fx: 0.93, fy: 0.4 },
            { at: 6000, do: 'unnote' },
            { at: 6300, do: 'scroll', target: { text: 'Volatilité des prix d\'achat' } },
            { at: 6800, do: 'highlight', target: { text: 'Volatilité des prix d\'achat', up: 1 } },
            { at: 7000, do: 'note', id: 'vol', target: { text: 'Volatilité des prix d\'achat' }, text: 'Les prix qui ont le plus bougé', side: 'right' },
        ],
    },
    {
        id: 'emballages', chapter: 7, tab: 'summary', subtab: 'packaging',
        caption: `Même lecture pour vos **emballages** : les plus coûteux, vos fournisseurs, l'évolution des prix. Rien de nouveau à apprendre.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-packaging-abc' },
            { at: 800, do: 'highlight', target: '#tutorial-section-packaging-abc' },
            { at: 1800, do: 'note', id: 'pa', target: { sel: '#tutorial-section-packaging-abc h3', nth: 0 }, text: 'Vos contenants les plus coûteux', side: 'top' },
            { at: 2800, do: 'unnote' },
            { at: 3100, do: 'scroll', target: '#tutorial-section-tracking-packaging', block: 'start' },
            { at: 4100, do: 'note', id: 'pe', target: '#tutorial-section-tracking-packaging', text: 'Leur prix, à chaque point de référence', side: 'top' },
        ],
    },
    {
        id: 'main-oeuvre-rapport', chapter: 7, tab: 'summary', subtab: 'labor',
        caption: `Reste votre équipe. Combien d'heures payées servent vraiment ? [pause] L'écart, c'est de la **paie non utilisée**. Et ces heures libres sont des ventes possibles en plus : votre marge de croissance.`,
        steps: [
            { at: 200, do: 'scroll', target: '#tutorial-section-labor-rapport' },
            { at: 700, do: 'highlight', target: '#tutorial-section-labor-rapport' },
            { at: 1800, do: 'note', id: 'ecart', target: { text: 'Taux d\'Utilisation', within: '#tutorial-section-labor-rapport' }, text: 'Sous 100 % : des heures payées, mais inutilisées', side: 'top' },
            { at: 4500, do: 'unnote' },
            { at: 4600, do: 'scroll', target: '#tutorial-section-labor-paie' },
            { at: 5200, do: 'highlight', target: '#tutorial-section-labor-paie' },
            { at: 5400, do: 'note', id: 'pn', target: { text: 'Paie non utilisée', within: '#tutorial-section-labor-paie' }, text: 'Paie non utilisée : {v}', side: 'top', read: { label: 'Paie non utilisée', within: '#tutorial-section-labor-paie' } },
            { at: 6900, do: 'unnote' },
            { at: 7000, do: 'scroll', target: '#tutorial-section-labor-croissance' },
            { at: 7700, do: 'highlight', target: '#tutorial-section-labor-croissance' },
            { at: 9800, do: 'note', id: 'cr', target: { text: 'Ventes additionnelles possibles', within: '#tutorial-section-labor-croissance' }, text: 'Ventes additionnelles possibles : {v}', side: 'top', read: { label: 'Ventes additionnelles possibles', within: '#tutorial-section-labor-croissance' } },
        ],
    },
    {
        id: 'simulation', chapter: 7, tab: 'summary', subtab: 'simulation',
        caption: `Et si vos prix d'achat montaient de huit pour cent ? Puis de quinze ? Le simulateur montre l'effet sur la **marge**, le point mort et chaque activité, avant que cela n'arrive.`,
        steps: [
            { at: 200, do: 'click', target: { btn: 'Ajouter un choc' }, unless: '[data-tour="shock-row"]' },
            { at: 1000, do: 'note', id: 'pct', target: SHOCK_PCT, text: 'Hausse des prix d\'achat (%)', side: 'top' },
            { at: 1300, do: 'type', target: SHOCK_PCT, text: '8', rate: 300 },
            { at: 3900, do: 'scroll', target: '[data-tour="shock-results"]', block: 'start' },
            { at: 4300, do: 'highlight', target: '[data-tour="shock-results"]' },
            { at: 4600, do: 'note', id: 'mg', target: { text: 'Marge brute moyenne pondérée', within: '[data-tour="shock-results"]' }, text: 'Marge brute : {v}', side: 'top', read: { label: 'Marge brute moyenne pondérée', within: '[data-tour="shock-results"]' } },
            { at: 6400, do: 'unnote' },
            { at: 6500, do: 'note', id: 'pmort', target: { text: 'Point mort des produits actifs', within: '[data-tour="shock-results"]' }, text: 'Le point mort bouge aussi', side: 'top' },
            { at: 7600, do: 'unnote' },
            { at: 7700, do: 'note', id: 'imp', target: { text: 'Impact par activité de production', within: '[data-tour="shock-results"]' }, text: 'Et chaque activité', side: 'top' },
            { at: 2500, do: 'type', target: SHOCK_PCT, text: '15', rate: 300 },
            { at: 3800, do: 'unnote' },
        ],
    },

    // --- 8. Pour le dire aux autres (exports) -------------------------------------------------------------------------------
    {
        id: 'export-pdf', chapter: 8, tab: 'summary', subtab: 'overview',
        caption: `Un banquier, un partenaire, votre équipe veulent voir vos résultats ? Le rapport complet les met en page, prêt à imprimer. [pause] Choisissez les chapitres, ajoutez votre commentaire, et le tour est joué.`,
        steps: [
            { at: 300, do: 'scroll', target: { btn: 'Générer un rapport PDF' } },
            { at: 3500, do: 'click', target: { btn: 'Générer un rapport PDF' } },
            { at: 7900, do: 'note', id: 'ch', target: { sel: `${MODAL} ul[aria-label="Chapitres du rapport"]` }, text: 'Huit chapitres, à cocher ou à décocher', side: 'right' },
            { at: 9000, do: 'unnote' },
            { at: 9100, do: 'note', id: 'cm', target: '#reportComment', text: 'Votre lecture, imprimée à la fin du chapitre', side: 'top' },
            { at: 8800, do: 'type', target: '#reportComment', text: 'Le prix de la viande monte.', rate: 45 },
            { at: 10700, do: 'unnote' },
            { at: 10900, do: 'note', id: 'gen', target: { btn: 'Générer le PDF', within: MODAL }, text: 'Et le rapport est prêt', side: 'top' },
            { at: 11650, do: 'unnote' },
            { at: 11700, do: 'escape' },
        ],
    },
    {
        id: 'export-excel', chapter: 8, tab: 'summary', subtab: 'overview',
        caption: `Pour aller plus loin avec vos propres outils, le classeur Excel : toutes vos données, une feuille par sujet, avec un dictionnaire des colonnes. [pause] Votre comptable s'y retrouvera tout de suite.`,
        steps: [
            { at: 300, do: 'scroll', target: { btn: 'Exporter vers Excel' } },
            { at: 2300, do: 'highlight', target: { btn: 'Exporter vers Excel' } },
            { at: 3700, do: 'note', id: 'xl', target: { btn: 'Exporter vers Excel' }, text: 'Toutes les données de votre projet', side: 'bottom' },
            { at: 7300, do: 'unnote' },
            { at: 8300, do: 'note', id: 'xl2', target: { btn: 'Exporter vers Excel' }, text: 'À retravailler dans Excel ou n\'importe quel outil', side: 'bottom' },
        ],
    },

    // --- 9. Jamais perdu ---------------------------------------------------------------------------------------------------
    {
        id: 'infobulles', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Un mot vous échappe ? Passez la souris sur le point d'interrogation : une courte explication s'affiche, avec un lien « En savoir plus ».`,
        steps: [
            { at: 300, do: 'scroll', target: KPI },
            { at: 1300, do: 'point', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 2000, do: 'hover', target: `${KPI} [data-testid="tooltip-trigger"]` },
            { at: 4300, do: 'point', target: '[data-testid="tooltip-guide-link"]' },
            { at: 5800, do: 'click', target: '[data-testid="tooltip-guide-link"]' },
        ],
    },
    {
        id: 'guide-plan', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Le **guide** se divise en quatre parties : les notions de base, l'utilisation de chaque onglet, la lecture des résultats, puis le glossaire et les questions fréquentes. [pause] À gauche, la table des matières vous mène au bon chapitre.`,
        steps: [
            { at: 300, do: 'guideOpen', unless: '[aria-label="Fermer le guide"]' },
            { at: 700, do: 'click', target: { sel: '[aria-label="Table des matières"] li li a', nth: 1 } },
            { at: 1700, do: 'highlight', target: { sel: '#guide-intro-parties + ul' } },
            { at: 2000, do: 'note', id: 'gp', target: { sel: '#guide-intro-parties + ul' }, text: 'Quatre parties, de la théorie à la pratique', side: 'top' },
            { at: 10300, do: 'unnote' },
            { at: 11000, do: 'note', id: 'toc', target: { sel: '[aria-label="Table des matières"]' }, text: 'La table des matières : un chapitre, un clic', side: 'right' },
            { at: 10500, do: 'highlight', target: { sel: '[aria-label="Table des matières"]' } },
        ],
    },
    {
        id: 'guide-encadres', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Chaque chapitre est ponctué d'encadrés. L'essentiel à retenir, un exemple chiffré, une mise en garde. [pause] Une astuce, la raison d'être d'une règle, et les mots à connaître.`,
        steps: [
            { at: 300, do: 'click', target: { sel: '[aria-label="Table des matières"] li li a', nth: 3 } },
            { at: 1400, do: 'scroll', target: '#guide-intro-encadres', block: 'start' },
            { at: 2300, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="retenir"]' } },
            { at: 2400, do: 'note', id: 'e1', target: { sel: '#guide-intro-encadres ~ aside[data-callout="retenir"]' }, text: 'À retenir : l\'essentiel', side: 'right' },
            { at: 3700, do: 'unnote' },
            { at: 3800, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="exemple"]' } },
            { at: 3900, do: 'note', id: 'e2', target: { sel: '#guide-intro-encadres ~ aside[data-callout="exemple"]' }, text: 'Exemple : des chiffres à refaire', side: 'right' },
            { at: 5100, do: 'unnote' },
            { at: 5300, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="attention"]' } },
            { at: 5400, do: 'note', id: 'e3', target: { sel: '#guide-intro-encadres ~ aside[data-callout="attention"]' }, text: 'Attention : un piège à éviter', side: 'right' },
            { at: 7200, do: 'unnote' },
            { at: 7300, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="astuce"]' } },
            { at: 7400, do: 'note', id: 'e4', target: { sel: '#guide-intro-encadres ~ aside[data-callout="astuce"]' }, text: 'Astuce : gagner du temps', side: 'right' },
            { at: 8300, do: 'unnote' },
            { at: 8450, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="pourquoi"]' } },
            { at: 8550, do: 'note', id: 'e5', target: { sel: '#guide-intro-encadres ~ aside[data-callout="pourquoi"]' }, text: 'Pourquoi c\'est important', side: 'right' },
            { at: 10100, do: 'unnote' },
            { at: 10200, do: 'highlight', target: { sel: '#guide-intro-encadres ~ aside[data-callout="mots"]' } },
            { at: 10300, do: 'note', id: 'e6', target: { sel: '#guide-intro-encadres ~ aside[data-callout="mots"]' }, text: 'Les mots du chapitre', side: 'right' },
        ],
    },
    {
        id: 'guide', chapter: 9, tab: 'summary', subtab: 'overview',
        caption: `Enfin, la **recherche** : tapez un mot, et toutes ses occurrences sont surlignées. [pause] Passez de l'une à l'autre d'un seul geste, ou emportez le guide pour le lire ailleurs.`,
        steps: [
            { at: 300, do: 'guideOpen', unless: '[aria-label="Fermer le guide"]' },
            { at: 400, do: 'highlight', target: null },
            { at: 1000, do: 'type', target: '[data-testid="guide-search"]', text: 'point mort', rate: 90 },
            { at: 3000, do: 'note', id: 'res', target: { sel: `${MODAL} mark`, nth: 0 }, text: 'Chaque occurrence est surlignée', side: 'right' },
            { at: 5300, do: 'click', target: { btn: '↓' } },
            { at: 6400, do: 'click', target: { btn: '↓' } },
            { at: 7300, do: 'unnote' }, { at: 7700, do: 'note', id: 'pdf', target: { btn: 'Télécharger en PDF' }, text: 'Et un PDF à emporter', side: 'bottom' },
            { at: 7800, do: 'point', target: { btn: 'Télécharger en PDF' } },
            { at: 9100, do: 'guideClose' },
        ],
    },
    {
        id: 'depart', chapter: 9, tab: 'info',
        caption: `À vous de jouer ! Commencez par **Paramètres** : nommez votre entreprise, puis passez aux ingrédients. [pause] Avancez de gauche à droite, le reste suivra tout seul.`,
        steps: [
            { at: 0, do: 'guideClose' },
            { at: 300, do: 'scrollTop' }, // on revient sur Paramètres, que l'application rouvre là où on l'avait laissé : on repart du haut
            { at: 600, do: 'highlight', target: '#tutorial-tab-bar' },
            { at: 1300, do: 'point', target: '#tab-info' },
            { at: 1700, do: 'note', id: 'go', target: '#tab-info', text: 'Votre premier arrêt : Paramètres', side: 'bottom' },
            { at: 3000, do: 'unnote' }, { at: 3400, do: 'note', id: 'go2', target: '#tab-ingredients', text: 'Puis Ingrédients… et on avance vers la droite', side: 'bottom' },
            { at: 3100, do: 'point', target: '#tab-ingredients' },
            // « Avancez de gauche à droite » : le pointeur file jusqu'au dernier onglet, puis une dernière étiquette
            { at: 5300, do: 'unnote' },
            { at: 5400, do: 'point', target: '#tab-summary' },
            { at: 7300, do: 'note', id: 'go3', target: '#tab-summary', text: 'Les résultats se mettent à jour tout seuls', side: 'bottom' },
        ],
    },
];

// Marques de pause pour la voix : `[pause]` s'écrit dans le texte mais ne s'affiche jamais et ne compte pas dans les mots.
export const stripPauses = (t) => String(t).replace(/\s*\[(?:long )?pause\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
const words = (c) => stripPauses(c).replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;
// Temps de lecture : au moins une seconde de plus que l'action, et assez pour lire le sous-titre (≈ 3,5 mots / seconde + marge).
export const readingMs = (caption) => Math.round(words(caption) * 260) + 1200;
// Durée d'une scène : le dernier geste (avec sa saisie) + 1,8 s pour voir le résultat, sans jamais couper la lecture du sous-titre.
// Moins de temps mort : la scène s'arrête dès que le sous-titre est lu et que l'action est terminée.
const gestureEnd = (st) => st.at + (st.do === 'type' ? POINT_LEAD + String(st.text).length * (st.rate || 80) : ['click', 'pick'].includes(st.do) ? POINT_LEAD : 0);
SCENES.forEach((s) => { s.duration = Math.max(Math.max(0, ...s.steps.map(gestureEnd)) + 1800, readingMs(s.caption)); });
// Carte de titre d'un chapitre : au moins INTRO_MS, et assez longue pour que son texte soit dit (≈ 3 mots / seconde + marge).
CHAPTERS.forEach((c) => { c.introMs = Math.max(INTRO_MS, Math.round(words(c.narration) * 300) + 1000); });

// Texte de la narration d'une scène, tel qu'on le lit (sans marques de couleur ni de pause) ; `voiceOf` garde les pauses : c'est le
// texte à donner à la voix.
export const narrationOf = (scene) => stripPauses(scene.caption).replace(/\*\*/g, '');
export const voiceOf = (scene) => scene.caption.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
export const introNarrationOf = (chapterIndex) => stripPauses(CHAPTERS[chapterIndex].narration);
export const introVoiceOf = (chapterIndex) => CHAPTERS[chapterIndex].narration.replace(/\s+/g, ' ').trim();
// Nom du fichier audio de la carte de titre d'un chapitre (par exemple « intro-entreprise.mp3 »).
export const introAudioId = (chapterIndex) => `intro-${CHAPTERS[chapterIndex].id}`;

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
export const introMsOf = (i) => (hasIntro(i) ? CHAPTERS[SCENES[i].chapter].introMs : 0);
export const sceneLength = (i) => SCENES[i].duration + introMsOf(i);
export const TOTAL_DURATION = SCENES.reduce((n, _, i) => n + sceneLength(i), 0);
