// --- FONCTIONS UTILITAIRES PURES ---
// Ce module ne dépend d'aucun framework UI (ni React, ni lucide) : il peut donc être importé
// par le moteur de calcul (src/engine/) sans y traîner la couche de présentation. Les
// utilitaires qui rendent du JSX ou reposent sur des hooks React vivent dans ui-utils.jsx.

// Formate un nombre en devise (version sécurisée) — espace comme séparateur de milliers (ex.
// « 160 000.00 »), point comme séparateur décimal conservé tel quel (pas la virgule du fr-CA
// complet, pour rester cohérent avec le reste de l'UI qui utilise déjà le point en affichage).
export const formatCurrency = (value) => {
    // Tente de convertir la valeur en nombre, peu importe son type initial
    const num = parseFloat(String(value).replace(',', '.'));
    // Si la conversion échoue (par exemple, pour un objet), isNaN sera vrai
    if (isNaN(num)) {
        return '0.00'; // Retourne une valeur par défaut sécuritaire au lieu de planter
    }
    const [intPart, decPart] = num.toFixed(2).split('.');
    const sign = intPart.startsWith('-') ? '-' : '';
    const digits = sign ? intPart.slice(1) : intPart;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${sign}${grouped}.${decPart}`;
};
// Formate un nombre en pourcentage
export const formatPercent = (value) => (value * 100 || 0).toFixed(2);
// Gère les entrées numériques avec point ou virgule
export const parseLocaleNumber = (stringValue) => {
    if (stringValue === null || stringValue === undefined) return 0;

    // 1. Convertit en chaîne de caractères
    const s = String(stringValue);

    // 2. Supprime tous les caractères qui ne sont pas des chiffres, un point, une virgule ou un signe moins.
    // Cela élimine les symboles de devise, les espaces, etc.
    const cleaned = s.replace(/[^0-9,.-]/g, '');

    // 3. Remplace la virgule par un point pour la conversion en nombre
    const standardized = cleaned.replace(',', '.');

    // 4. Tente de convertir la chaîne nettoyée en nombre
    return parseFloat(standardized) || 0;
};

// Arrondit à 2 décimales (montants en argent) — évite les décimales résiduelles d'un calcul
// proportionnel (ex. 62.499999999999993) ou d'une saisie utilisateur trop précise.
export const round2 = (value) => Math.round(parseLocaleNumber(value) * 100) / 100;

export const generateSlug = (name, provider, format, unit) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return '';
    }

    let combined = name.trim();
    if (provider && typeof provider === 'string' && provider.trim() !== '') {
        combined += `-${provider.trim()}`;
    }
    // Ajout du format et de l'unité à la chaîne
    if (format) {
        combined += `-${String(format).trim()}`;
    }
    if (unit && typeof unit === 'string' && unit.trim() !== '') {
        combined += `-${unit.trim()}`;
    }

    return combined
        .toLowerCase()
        // Remplace les accents par des lettres de base
        .normalize("NFD").replace(/\p{Diacritic}/gu, "")
        // Remplace tout ce qui n'est pas une lettre, un chiffre ou un tiret par un tiret
        .replace(/[^a-z0-9-]/g, '-')
        // Remplace les tirets multiples par un seul
        .replace(/-+/g, '-')
        // Supprime les tirets au début ou à la fin
        .replace(/^-|-$/g, '');
};

// Étiquette lisible d'un format de vente (quantité + unité) — ex. "250 ml". Le format (emballage
// + quantité) est l'attribut qu'une personne choisit ; le SKU n'est qu'une référence dérivée de la
// recette + de ce format (voir Projet_Claude/04-Conception-Modele.md, correction du 04/10).
export const formatQuantityLabel = (portionSize, portionUnit) => {
    if (!portionSize) return '';
    return `${portionSize} ${portionUnit || ''}`.trim();
};

// Étiquette d'affichage désambiguïsée d'une ligne produit×format (nom seul si ce produit n'a
// qu'un format dans `formatsList`, nom + format sinon — ex. « Confiture de fraises (250 ml) »).
// Partagée entre analysisData.js (temps réel) et initialState.js (historique de démo) pour que
// les deux appliquent exactement la même règle — voir Phase 1.6, Projet_Claude/03-Feuille-de-route.md.
export const buildRowDisplayName = (platName, formatsList, fmt, formatIndex) =>
    formatsList.length > 1
        ? `${platName} (${formatQuantityLabel(fmt.portionSize, fmt.portionUnit) || fmt.sku || `Format ${formatIndex + 1}`})`
        : platName;

// Formate un nombre de secondes en chaîne HH:MM:SS
export const formatSecondsToTime = (totalSeconds) => {
    if (totalSeconds === null || isNaN(totalSeconds) || totalSeconds < 0) {
        return '';
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
};

// Convertit un numéro de série de date Excel en objet Date JavaScript
export const excelSerialDateToJSDate = (serial) => {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;
    total_seconds -= seconds;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate(), hours, minutes, seconds);
}

// --- FONCTIONS DE VALIDATION ---
export const isNotEmpty = (value) => value != null && String(value).trim() !== '';

export const isValidNumber = (value) => {
    if (!isNotEmpty(value)) return false;
    const parsed = String(value).replace(',', '.');
    return !isNaN(parseFloat(parsed)) && isFinite(parsed) && parseFloat(parsed) >= 0;
};

export const isValidPositiveInteger = (value) => {
    if (!isNotEmpty(value)) return false;
    const num = Number(String(value).replace(',', '.'));
    return Number.isInteger(num) && num > 0;
};

// Comme isValidPositiveInteger, mais accepte les décimales — pour une quantité produite exprimée
// dans une unité continue (kg, L...) plutôt qu'un compte d'unités (voir isDiscreteUnit ci-dessous).
export const isValidPositiveNumber = (value) => isValidNumber(value) && parseLocaleNumber(value) > 0;

export const isValidPercentage = (value) => {
    if (!isNotEmpty(value)) return false;
    const num = parseLocaleNumber(value);
    // Use the base isValidNumber to check for valid number format and non-negativity
    return isValidNumber(value) && num <= 100;
};

// --- MOTEUR DE CONVERSION D'UNITÉS ---
// `type` distingue une unité de mesure continue (poids/volume — une quantité produite peut être
// fractionnaire, ex. 47,3 kg) d'une unité de compte discrète (ex. « unité » — toujours un nombre
// entier). Utilisé par isDiscreteUnit ci-dessous pour adapter la validation de « quantité
// produite » (RecipeCalculator.jsx) à l'unité réellement choisie, plutôt que d'imposer un entier
// partout (ce qui empêchait un producteur vendant au poids de saisir un lot manuellement).
// Catalogue complet (retour utilisateur du 19/10) : les 5 historiques + un ensemble plus large
// qu'un projet peut activer/désactiver (voir `activeUnits`, state de projet, et `UnitsModal`,
// common.jsx) — jamais une unité personnalisée à facteur libre (risque d'incohérence silencieuse
// dans tout le convertisseur), seulement un choix parmi ce catalogue contrôlé. Facteurs de
// conversion vérifiés contre la norme GS1/UN·CEFACT Recommandation 20 (codes KGM/GRM/LTR/LBR/ONZ/
// TNE). Ordre d'insertion = ordre d'affichage dans la modale (petit → grand par famille) —
// `UnitsModal` itère ce catalogue directement, pas de structure parallèle à maintenir.
export const CONVERSION_FACTORS = {
    // Masse (base 'g')
    'g': { base: 'g', factor: 1, type: 'continuous' },
    'kg': { base: 'g', factor: 1000, type: 'continuous' },
    'oz': { base: 'g', factor: 28.3495, type: 'continuous' },
    'lb': { base: 'g', factor: 453.592, type: 'continuous' },
    'tonne': { base: 'g', factor: 1000000, type: 'continuous' },
    // Volume (base 'ml')
    'ml': { base: 'ml', factor: 1, type: 'continuous' },
    'L': { base: 'ml', factor: 1000, type: 'continuous' },
    'cl': { base: 'ml', factor: 10, type: 'continuous' },
    'hL': { base: 'ml', factor: 100000, type: 'continuous' },
    'fl oz': { base: 'ml', factor: 29.5735, type: 'continuous' },
    'gal': { base: 'ml', factor: 3785.41, type: 'continuous' },
    // Discrète (base 'unité')
    'unité': { base: 'unité', factor: 1, type: 'discrete' },
    'douzaine': { base: 'unité', factor: 12, type: 'discrete' },
};

// Libellés de famille pour le regroupement visuel dans UnitsModal — dérivés de `.base`, jamais une
// 2e liste d'unités à tenir à jour en parallèle de CONVERSION_FACTORS.
export const UNIT_BASE_FAMILY_LABELS = { g: 'Masse', ml: 'Volume', 'unité': 'Discrètes' };

// Unités actives par défaut (projets neufs, et repli pour tout projet sauvegardé avant cette
// fonctionnalité — voir projectSerialization.js) : exactement les 5 historiques, jamais désactivées
// silencieusement par une migration.
export const DEFAULT_ACTIVE_UNITS = ['g', 'kg', 'ml', 'L', 'unité'];

// Une unité absente de cette table (cas rare) est traitée comme discrète par défaut — comportement
// historique (entier obligatoire), le plus prudent tant qu'elle n'est pas explicitement classée.
export const isDiscreteUnit = (unit) => (CONVERSION_FACTORS[unit]?.type || 'discrete') === 'discrete';

export const getCompatibleUnits = (baseUnit) => {
    if (!baseUnit) return []; // Si aucune unité n'est fournie, ne retourne aucune option
    const baseType = CONVERSION_FACTORS[baseUnit]?.base;
    if (!baseType) return [baseUnit]; // Si l'unité est inconnue, elle est la seule option
    return Object.keys(CONVERSION_FACTORS).filter(u => CONVERSION_FACTORS[u].base === baseType);
};

// Filtre une liste d'unités (déjà compatibles ou non) sur celles activées par le projet (voir
// `activeUnits`, state de projet) — EN GARDANT TOUJOURS `currentValue` même si désactivée depuis :
// sinon un format/ingrédient existant utilisant une unité qu'on désactive plus tard se retrouve
// avec un <select> dont la valeur ne correspond à aucune <option> (donnée existante cassée
// silencieusement — contraire au principe "donnée absente reste absente, jamais forcée"). Repli sur
// DEFAULT_ACTIVE_UNITS si `activeUnits` est vide/absent (ne devrait plus arriver une fois la
// migration de projectSerialization.js en place, mais reste un filet de sécurité défensif).
export const filterActiveUnits = (units, activeUnits, currentValue) => {
    const activeSet = new Set(activeUnits?.length ? activeUnits : DEFAULT_ACTIVE_UNITS);
    return units.filter(u => activeSet.has(u) || u === currentValue);
};

// Formate un coût unitaire avec plus de précision si nécessaire
export const formatUnitPrice = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    if (value > 0 && value < 0.01) {
        return value.toFixed(4); // Affiche plus de décimales pour les petits montants
    }
    return value.toFixed(2);
};

// Champs de format également présents "à plat" sur le produit (Phase 1.3-1.5). Tant que les
// écrans qui ne lisent pas encore formats[] directement (Résumé, rapports, analyse — Phase 1.6)
// existent, éditer le format PAR DÉFAUT (index 0) d'un produit met aussi à jour ces champs en
// miroir — voir Projet_Claude/04-Conception-Modele.md. Partagé entre App.jsx et
// RecipeCalculator.jsx pour ne pas dupliquer la liste.
export const FORMAT_FLAT_MIRROR_FIELDS = ['prixVente', 'nbPortions', 'portionSize', 'portionUnit', 'salesMix', 'onMenu'];

// --- FRAIS FIXES (Phase 4) ---
// Quatre catégories retenues (classification comptable par fonction — voir
// Projet_Claude/04-Conception-Modele.md) : chacune suggère un contenant d'allocation par défaut
// (Général/Activité/Canal, Phase 4.2) sans l'imposer. Pas les 6 catégories du MAPAQ ni les 3 blocs
// de SymbiOse tels quels — ni l'un ni l'autre n'est reproduit littéralement (principe du projet).
export const EXPENSE_CATEGORIES = [
    'Frais généraux de production',
    'Frais de vente / mise en marché',
    "Frais d'administration",
    'Frais financiers',
];

// --- CHARGES DIRECTES RÉELLES (Phase 4.3) ---
// Ventilées par TYPE DE COÛT (nature de la dépense de production), pas par les 4 catégories de
// frais fixes ci-dessus (qui décrivent une fonction d'entreprise) — vocabulaire repris tel quel de
// calculateCosts.js (totalIngredientsCost/totalLaborCost/totalPackagingCost/
// totalSubcontractingCost) pour que la ventilation réelle parle le même langage que le théorique
// qu'elle sera comparée à terme (réconciliation, Phase 4.4). Purement diagnostic à ce stade :
// jamais un intrant de calcul en aval (voir Projet_Claude/04-Conception-Modele.md, section 1bis).
export const DIRECT_COST_TYPES = [
    'Matière première',
    "Main-d'œuvre directe",
    'Emballage',
    'Sous-traitance',
];

// Pool total d'une liste de lignes { amount }  — réutilisé pour `expenseLines` (Phase 4.1) ET
// `revenueLines` (Phase 4.2). Dérivé à chaque endroit où la liste change (jamais ressaisi
// indépendamment) pour que le total affiché reste toujours l'image exacte de ses lignes — zéro
// risque de dérive entre les deux.
export const sumLineAmounts = (lines) =>
    (lines || []).reduce((sum, line) => sum + parseLocaleNumber(line.amount), 0);

// Revenus réels (Phase 4.2, révisé le 13/10) : chaque ligne répartit son montant entre un ou
// plusieurs contenants (Général/activités) via `amounts` (`{ [bucketKey]: montant }`), pas un seul
// champ `amount` — nécessaire pour la « Saisie manuelle » (une ligne peut être ventilée sur
// plusieurs contenants à la fois, comme dans le chiffrier SymbiOse), alors que les autres modes de
// répartition (Général ou une activité précise) n'ont jamais qu'une seule clé non nulle. Additionne
// les valeurs d'un seul objet `amounts` ; le total d'une liste `revenueLines` se fait avec
// `lines.reduce((s, l) => s + sumAmountsMap(l.amounts), 0)`.
export const sumAmountsMap = (amounts) =>
    Object.values(amounts || {}).reduce((sum, v) => sum + parseLocaleNumber(v), 0);

// --- GESTION DES ALLERGÈNES ---
export const MAJOR_ALLERGENS = [
    { key: 'gluten', name: 'Gluten' }, { key: 'crustaceans', name: 'Crustacés' },
    { key: 'eggs', name: 'Œufs' }, { key: 'fish', name: 'Poisson' },
    { key: 'peanuts', name: 'Arachides' }, { key: 'soybeans', name: 'Soja' },
    { key: 'milk', name: 'Lait' }, { key: 'nuts', name: 'Noix' },
    { key: 'celery', name: 'Céleri' }, { key: 'mustard', name: 'Moutarde' },
    { key: 'sesame', name: 'Sésame' }, { key: 'sulphites', name: 'Sulphites' },
    { key: 'lupin', name: 'Lupin' }, { key: 'molluscs', name: 'Mollusques' },
];

// Phase 3.4 : remplace POS_APP_FIELDS — l'import vise maintenant des rapports de vente par canal
// (distributeur, courtier...) plutôt qu'un export de caisse à point de vente unique. `channel` et
// `format` sont nouveaux (mappent vers format × canal, voir SalesReportImportWizardModal.jsx) ;
// mots-clés volontairement larges pour les exports comptables courants (QuickBooks « Class »,
// Odoo « Point of Sale »/« Équipe commerciale »...) — à affiner si un format source précis pose
// problème, sans changer le modèle de données sous-jacent.
export const SALES_REPORT_APP_FIELDS = [
    { key: 'platName', label: "Nom du plat", required: true, keywords: ['nom', 'item', 'produit', 'plat', 'description'] },
    { key: 'format', label: "Format (ex. 250 ml)", keywords: ['format', 'taille', 'variant', 'sku'] },
    { key: 'channel', label: "Canal de vente", keywords: ['canal', 'channel', 'circuit', 'class', 'location', 'point of sale', 'équipe', 'distributeur'] },
    { key: 'category', label: "Catégorie", keywords: ['catégorie', 'category', 'groupe'] },
    { key: 'prixVente', label: "Prix net ($)", required: true, keywords: ['prix', 'vente', 'price', 'cost', '$', 'revenue', 'net'] },
    { key: 'quantitySold', label: "Quantité vendue (unités)", required: true, keywords: ['quantité', 'qty', 'vendue', 'sold', 'unités', 'mix'] },
    { key: 'transactionDate', label: "Date de transaction", keywords: ['date', 'jour', 'transaction'] },
    { key: 'totalNetPrice', label: "Total Net Ligne ($)", keywords: ['total', 'net', 'montant'] }
];

// Phase 4.7 : assistant d'import de l'état des résultats (Revenus + Frais fixes), voir
// Projet_Claude/05-Imports-Integrations.md. Un état des résultats réel liste déjà un poste par
// ligne avec son montant — pas d'agrégation multi-lignes à faire comme pour un rapport de ventes
// (SALES_REPORT_APP_FIELDS). `type` distingue Revenu/Dépense quand la source le précise
// explicitement (ex. export QuickBooks avec une colonne Type/Compte) ; sinon déduit par ligne à
// l'étape de résolution (signe du montant, ou choix manuel). `sku` est optionnel — permet une
// ventilation par activité quand la source détaille le produit visé par un revenu (voir
// `guessExpenseCategory` plus bas pour les dépenses ; côté revenu, la correspondance se fait sur
// `productsWithCosts[].platName` → `.activityId` directement dans le composant, pas ici).
// `date` (ajouté le 18/10) : optionnelle, sert uniquement à détecter automatiquement la Période de
// référence (min/max des dates du fichier) — même patron que SALES_REPORT_APP_FIELDS.
// `transactionDate` ci-dessous (excelSerialDateToJSDate). Fichier structuré (CSV/Excel) seulement :
// un PDF textuel n'a pas de colonne par ligne, voir IncomeStatementImportWizardModal.jsx.
export const INCOME_STATEMENT_APP_FIELDS = [
    { key: 'label', label: 'Poste (description)', required: true, keywords: ['poste', 'compte', 'description', 'nom', 'libellé', 'account'] },
    { key: 'amount', label: 'Montant ($)', required: true, keywords: ['montant', 'solde', 'amount', 'total', 'net', '$'] },
    { key: 'type', label: 'Type (Revenu / Dépense)', keywords: ['type', 'nature', 'sens'] },
    { key: 'category', label: 'Catégorie comptable', keywords: ['catégorie', 'category', 'classe', 'class'] },
    { key: 'sku', label: 'Produit/SKU visé (revenu seulement)', keywords: ['produit', 'sku', 'plat', 'item'] },
    { key: 'date', label: 'Date (période de référence)', keywords: ['date', 'jour', 'période', 'period'] },
];

// Devine la catégorie de Frais fixes (EXPENSE_CATEGORIES) la plus plausible à partir du texte
// d'une ligne importée (poste + catégorie source, si mappée) — mots-clés volontairement larges
// pour les exports comptables courants, affinable sans changer le modèle sous-jacent (même
// principe que SALES_REPORT_APP_FIELDS). Retombe sur "Frais d'administration", la catégorie la
// plus générique/catch-all en comptabilité réelle, quand rien ne correspond — jamais "Frais
// généraux de production" par défaut, qui impliquerait à tort un lien avec la production.
const EXPENSE_CATEGORY_KEYWORDS = [
    { category: 'Frais généraux de production', keywords: ['loyer', 'électricité', 'chauffage', 'entretien', 'réparation', 'atelier', 'usine', 'production', 'eau', 'gaz'] },
    { category: 'Frais de vente / mise en marché', keywords: ['marketing', 'publicité', 'promotion', 'commission', 'distribution', 'vente', 'livraison', 'transport'] },
    { category: 'Frais financiers', keywords: ['banque', 'bancaire', 'intérêt', 'financement', 'financier'] },
    { category: "Frais d'administration", keywords: ['administration', 'bureau', 'comptabilité', 'direction', 'salaire', 'assurance', 'légal', 'informatique', 'fourniture'] },
];
export const guessExpenseCategory = (...texts) => {
    const haystack = texts.filter(Boolean).join(' ').toLowerCase();
    const match = EXPENSE_CATEGORY_KEYWORDS.find(({ keywords }) => keywords.some((kw) => haystack.includes(kw)));
    return match ? match.category : "Frais d'administration";
};

// Un état des résultats est le plus souvent reçu en PDF (export natif du comptable), pas en
// CSV/Excel — contrairement à SALES_REPORT_APP_FIELDS (un rapport de ventes détaillé, lui,
// provient typiquement d'un système qui exporte nativement en tableau). Un PDF textuel n'a pas de
// vraies colonnes : chaque ligne reconstruite (voir IncomeStatementImportWizardModal.jsx, qui
// regroupe les éléments de texte par position Y) ressemble à « Loyer .......... 9 000,00 $ » — le
// poste suivi de son montant, les deux séparés par de l'espace ou des points de suite. Cette
// fonction pure isole le dernier nombre plausible de la ligne (gère $ optionnel, séparateur de
// milliers espace/virgule, décimale point/virgule, parenthèses pour un montant négatif) ; retourne
// null pour une ligne sans montant reconnaissable (en-tête de section, date de page, ligne vide...)
// — jamais une valeur devinée à l'aveugle, l'utilisateur reste la seule source de vérité pour
// corriger ou rejeter chaque ligne à l'étape de résolution du wizard.
const TRAILING_AMOUNT_PATTERN = /\(?-?\$?\s?\d[\d\s.,]*\)?\s*\$?\s*$/;
export const parsePdfStatementLine = (rawLine) => {
    const line = String(rawLine || '').trim();
    if (!line) return null;
    const match = line.match(TRAILING_AMOUNT_PATTERN);
    if (!match) return null;
    const amountText = match[0].trim();
    const label = line.slice(0, line.length - match[0].length).trim();
    if (!label) return null;
    const isNegative = amountText.includes('(');
    const numeric = parseLocaleNumber(amountText.replace(/[()$]/g, '').trim());
    if (isNaN(numeric) || numeric === 0) return null;
    return { label, amount: isNegative ? -Math.abs(numeric) : Math.abs(numeric) };
};

export const APP_FIELDS = [
    { key: 'name', label: "Nom de l'ingrédient", required: true, keywords: ['nom', 'item', 'produit', 'ingrédient', 'description'] },
    { key: 'uniqueId', label: "Identifiant Unique (SKU/PLU)", keywords: ['sku', 'plu', 'id', 'code', 'identifiant', 'unique'] },
    { key: 'provider', label: 'Fournisseur', keywords: ['fournisseur', 'provider', 'distributeur'] },
    { key: 'purchaseFormat', label: "Format d'Achat", keywords: ['format', 'taille', 'poids net', 'purchase format'] },
    { key: 'unit', label: "Unité de Base", keywords: ['unité', 'unit', 'uom'] },
    { key: 'purchasePrice', label: "Prix d'Achat", required: true, keywords: ['prix', 'coût', 'price', 'cost', '$'] },
    { key: 'quantityAndUnit', label: "Quantité et Unité Combinées (ex: '20 kg')", keywords: ['quantité', 'unité', 'combiné', 'format', 'poids', 'volume'] },
    { key: 'lossPercentage', label: 'Taux de perte (%)', keywords: ['perte', 'loss', 'gaspillage', 'waste'] },
];
