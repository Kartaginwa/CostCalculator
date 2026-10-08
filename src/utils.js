// --- FONCTIONS UTILITAIRES PURES ---
// Ce module ne dépend d'aucun framework UI (ni React, ni lucide) : il peut donc être importé
// par le moteur de calcul (src/engine/) sans y traîner la couche de présentation. Les
// utilitaires qui rendent du JSX ou reposent sur des hooks React vivent dans ui-utils.jsx.

// Formate un nombre en devise (version sécurisée)
export const formatCurrency = (value) => {
    // Tente de convertir la valeur en nombre, peu importe son type initial
    const num = parseFloat(String(value).replace(',', '.'));
    // Si la conversion échoue (par exemple, pour un objet), isNaN sera vrai
    if (isNaN(num)) {
        return '0.00'; // Retourne une valeur par défaut sécuritaire au lieu de planter
    }
    return num.toFixed(2);
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
export const CONVERSION_FACTORS = {
    'g': { base: 'g', factor: 1, type: 'continuous' },
    'kg': { base: 'g', factor: 1000, type: 'continuous' },
    'ml': { base: 'ml', factor: 1, type: 'continuous' },
    'L': { base: 'ml', factor: 1000, type: 'continuous' },
    'unité': { base: 'unité', factor: 1, type: 'discrete' },
};

// Une unité absente de cette table (cas rare) est traitée comme discrète par défaut — comportement
// historique (entier obligatoire), le plus prudent tant qu'elle n'est pas explicitement classée.
export const isDiscreteUnit = (unit) => (CONVERSION_FACTORS[unit]?.type || 'discrete') === 'discrete';

export const getCompatibleUnits = (baseUnit) => {
    if (!baseUnit) return []; // Si aucune unité n'est fournie, ne retourne aucune option
    const baseType = CONVERSION_FACTORS[baseUnit]?.base;
    if (!baseType) return [baseUnit]; // Si l'unité est inconnue, elle est la seule option
    return Object.keys(CONVERSION_FACTORS).filter(u => CONVERSION_FACTORS[u].base === baseType);
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
