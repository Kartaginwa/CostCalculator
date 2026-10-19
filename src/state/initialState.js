import { calculateCosts } from '../engine/calculateCosts.js';
import { generateSlug, buildRowDisplayName, sumLineAmounts, sumAmountsMap } from '../utils.js';

// Construit le format de vente par défaut d'un produit à partir de ses champs "à plat"
// (prixVente, nbPortions, etc.) ET de sa fiche recette (ingrédients, étapes de production, statut
// revente). Depuis la correction du 23/09 (voir Projet_Claude/04-Conception-Modele.md), chaque
// format est une fiche recette autonome et complète : la recette mère n'est plus qu'un
// regroupement organisationnel (nom, catégorie, activité de production) qui n'héberge plus lui-même
// d'ingrédients ni d'étapes — voir `stripFormatOwnedFields` ci-dessous, appelé par tous les points
// de création/migration d'un produit juste après avoir construit son premier format.
// Le SKU est une référence dérivée de la recette (nom du produit) + du format (quantité/unité) —
// pas une donnée saisie indépendamment. Voir Projet_Claude/04-Conception-Modele.md (correction du
// 04/10) : SKU = recette + format, exprimé comme un numéro/code de référence.
export const buildFormatSku = (platName, portionSize, portionUnit, fallbackId) =>
    generateSlug(platName, '', portionSize, portionUnit) || `sku-${fallbackId}`;

export const buildDefaultFormat = (product) => ({
    id: `fmt_${product.id}`,
    sku: buildFormatSku(product.platName, product.portionSize, product.portionUnit, product.id),
    prixVente: product.prixVente,
    // Phase 3.2 : prix net par canal de vente. Le PREMIER élément du tableau est le canal
    // "principal" dont le prix net alimente `prixVente` (mirroir, lu par calculateCosts.js tel
    // quel — pas encore channel-aware, voir Phase 3.3) ; pas de champ `isPrimary` séparé à tenir
    // synchronisé, l'ordre du tableau suffit. Ce format de migration part sur le canal par défaut
    // ("channel_default", toujours présent sauf suppression manuelle) avec le prix déjà saisi.
    channelPrices: [{ id: `cp_${product.id}`, channelId: 'channel_default', netPrice: product.prixVente, volume: 0 }],
    nbPortions: product.nbPortions,
    portionSize: product.portionSize,
    portionUnit: product.portionUnit,
    salesMix: product.salesMix,
    onMenu: product.onMenu,
    indirectCosts: { portionsSold: product.indirectCosts?.portionsSold },
    ingredients: product.ingredients || [],
    packagingItems: product.packagingItems || [],
    productionSteps: product.productionSteps || [],
    isResaleProduct: product.isResaleProduct || false,
    purchaseCost: product.purchaseCost || 0,
    manualAllergens: product.manualAllergens || [],
});

// Champs de fiche recette désormais possédés par chaque FORMAT, pas par le produit (contrairement
// aux champs de vente de FORMAT_FLAT_MIRROR_FIELDS dans utils.js, ceux-ci ne sont PAS mis en
// miroir sur le produit : deux formats d'un même produit ont chacun leur propre recette
// indépendante). Appelé juste après avoir construit `formats[0]` à partir de ces mêmes champs, à
// chaque point de création ou de migration d'un produit.
export const stripFormatOwnedFields = (product) => {
    const { ingredients: _ingredients, packagingItems: _packagingItems, productionSteps: _productionSteps, isResaleProduct: _isResaleProduct, purchaseCost: _purchaseCost, manualAllergens: _manualAllergens, ...rest } = product;
    return rest;
};

// Profils d'évolution de prix par ingrédient, utilisés pour générer l'historique des points de
// suivi (démo). trend = inflation mensuelle ; vol = amplitude de variation ; freq = fréquence de
// l'oscillation. À m = 0 (aujourd'hui) le facteur vaut 1 → le prix actuel est celui de l'ingrédient.
const PRICE_PROFILES = {
    ing_poulet: { trend: 0.003, vol: 0.05, freq: 0.52 },
    ing_boeuf: { trend: 0.005, vol: 0.09, freq: 0.46 },       // bœuf — volatil
    ing_saumon: { trend: 0.004, vol: 0.11, freq: 0.50 },      // saumon — très volatil
    ing_carotte: { trend: 0.002, vol: 0.06, freq: 0.58 },
    ing_brocoli: { trend: 0.002, vol: 0.07, freq: 0.44 },
    ing_pois: { trend: 0.002, vol: 0.05, freq: 0.60 },
    ing_oignon: { trend: 0.002, vol: 0.06, freq: 0.54 },
    ing_mais: { trend: 0.002, vol: 0.05, freq: 0.48 },
    ing_courge: { trend: 0.002, vol: 0.08, freq: 0.40 },      // saisonnier
    ing_pdt_flocons: { trend: 0.002, vol: 0.03, freq: 0.50 },
    ing_riz: { trend: 0.003, vol: 0.04, freq: 0.56 },
    ing_creme: { trend: 0.003, vol: 0.02, freq: 0.50 },
    ing_beurre: { trend: 0.004, vol: 0.06, freq: 0.42 },
    ing_farine: { trend: 0.003, vol: 0.02, freq: 0.50 },
    ing_tomates: { trend: 0.002, vol: 0.09, freq: 0.46 },     // saisonnier
    ing_haricots: { trend: 0.002, vol: 0.03, freq: 0.52 },
    ing_epices_asiat: { trend: 0.004, vol: 0.04, freq: 0.60 },
    ing_epices: { trend: 0.002, vol: 0.02, freq: 0.50 },
};

// Mêmes profils d'évolution que PRICE_PROFILES ci-dessus, mais pour le catalogue Packaging
// (Phase 2) — poste de coût toujours SUIVI SÉPARÉMENT des ingrédients.
const PACKAGING_PRICE_PROFILES = {
    pkg_barq_s: { trend: 0.003, vol: 0.03, freq: 0.50 },
    pkg_barq_f: { trend: 0.003, vol: 0.03, freq: 0.46 },
    pkg_pellicule: { trend: 0.002, vol: 0.02, freq: 0.52 },
    pkg_boite: { trend: 0.004, vol: 0.05, freq: 0.44 },       // sensible au coût du papier
    pkg_etiquette: { trend: 0.003, vol: 0.02, freq: 0.58 },
    pkg_sac_soupe: { trend: 0.003, vol: 0.03, freq: 0.48 },
    pkg_pot_verre: { trend: 0.002, vol: 0.03, freq: 0.50 },
    pkg_couvercle: { trend: 0.002, vol: 0.02, freq: 0.54 },
};

const round = (value, decimals = 2) => {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
};

// Génère 18 mois + le point actuel de points de suivi. Pour chaque mois, on reconstruit les prix
// d'ingrédients (dérive + oscillation) puis on calcule les coûts de chaque plat via le moteur —
// données historiques cohérentes, sans avoir à coder les coûts à la main.
function buildTrackingHistory(ingredients, labor, products, generalInfo, packaging) {
    const MONTHS = 18;
    const now = new Date();
    // La productivité cuisine dépend des volumes réels et n'est pas recalculée ici : on fige à 100 %
    // (pas de majoration de MO oisive) pour l'historique de démonstration.
    const snapBase = { ...generalInfo, kitchenProductivity: 100 };
    const notes = {
        [MONTHS]: 'Première analyse de référence — ouverture de l\'activité de production.',
        12: 'Renégociation des contrats avec le boucher et le maraîcher.',
        6: 'Hausse du coût du bœuf et du saumon (approvisionnement hivernal).',
        0: 'Situation actuelle.',
    };

    const points = [];
    for (let m = MONTHS; m >= 0; m--) {
        const date = new Date(now.getFullYear(), now.getMonth() - m, 15, 12, 0, 0);
        const iso = date.toISOString();
        const dateStr = iso.split('T')[0];

        const monthIngredients = ingredients.map((ing) => {
            const prof = PRICE_PROFILES[ing.id] || { trend: 0.003, vol: 0.02, freq: 0.5 };
            const factor = 1 - prof.trend * m + prof.vol * Math.sin(m * prof.freq);
            const unitPrice = round(ing.unitPrice * factor, ing.unitPrice < 1 ? 4 : 2);
            return { ...ing, unitPrice, purchasePrice: round(unitPrice * ing.purchaseFormat, 2), lastUpdated: dateStr };
        });

        const monthPackaging = packaging.map((pkg) => {
            const prof = PACKAGING_PRICE_PROFILES[pkg.id] || { trend: 0.002, vol: 0.02, freq: 0.5 };
            const factor = 1 - prof.trend * m + prof.vol * Math.sin(m * prof.freq);
            const unitPrice = round(pkg.unitPrice * factor, pkg.unitPrice < 1 ? 4 : 2);
            return { ...pkg, unitPrice, purchasePrice: round(unitPrice * pkg.purchaseFormat, 2), lastUpdated: dateStr };
        });

        const snapGeneral = { ...snapBase, totalRevenue: round(generalInfo.totalRevenue * (1 - 0.008 * m), 0) };
        const memo = {};
        // Une entrée par FORMAT, pas par produit (Phase 1.6) — mêmes règles que analysisData.js, pour
        // que les relevés historiques générés ici aient exactement la même forme que ceux produits en
        // temps réel par computeAnalysisData (voir TrackingTab.jsx).
        const productsWithCosts = products.flatMap((p) => {
            const formatsList = (p.formats && p.formats.length > 0) ? p.formats : [p];
            return formatsList.map((fmt, formatIndex) => ({
                ...p,
                prixVente: fmt.prixVente, nbPortions: fmt.nbPortions, portionSize: fmt.portionSize,
                portionUnit: fmt.portionUnit, salesMix: fmt.salesMix, onMenu: fmt.onMenu, sku: fmt.sku,
                id: fmt.id, productId: p.id, formatIndex, format: fmt,
                // Même règle de désambiguïsation qu'analysisData.js — voir buildRowDisplayName.
                displayName: buildRowDisplayName(p.platName, formatsList, fmt, formatIndex),
                costs: calculateCosts(p, snapGeneral, monthIngredients, products, labor, null, memo, new Set(), fmt, monthPackaging),
            }));
        });

        points.push({
            id: `tp_${m}`,
            name: `Relevé ${date.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}`,
            note: notes[m] || '',
            timestamp: iso,
            generalInfo: { ...snapGeneral },
            baseIngredients: monthIngredients,
            basePackaging: monthPackaging,
            productsWithCosts,
        });
    }
    return points;
}

// Dérive les 3 prix nets (direct / épiceries / grandes surfaces) d'un prix tablette cible, en
// remontant la cascade de chaque canal (mêmes formules que salesChannelCascade.js, appliquées en
// sens inverse à partir du prix consommateur) : cohérence interne entre les % affichés sur chaque
// canal (voir `demoSalesChannels` ci-dessous) et les prix nets saisis par format.
//   - markup : prix_avant = prix_après / (1 + %)   — marge : prix_avant = prix_après * (1 - %)
// Épiceries/grandes surfaces reproduisent EXACTEMENT ce que `computeNetPriceFromPds`
// (ProductInfo.jsx) calculerait pour ces deux canaux à partir de ce même `retailPrice` comme PDS —
// vérifié formule par formule contre salesChannelCascade.js. Vente directe (sans maillon) fait
// exception : le vrai PDS donnerait prix net = PDS (aucun maillon à redescendre), mais la démo
// applique volontairement un rabais de 10 % (`directRatio`) pour ce canal — modélise un prix de
// vente en ligne plus bas que le prix tablette, une décision antérieure à l'ajout du PDS (15/10).
// Cliquer sur « Générer » pour ce canal précis écraserait donc ce rabais par le PDS plein — comme
// pour tout format existant, un geste volontaire de l'utilisateur, jamais appliqué automatiquement.
let demoChannelPriceCounter = 0;
const demoChannelPriceSet = (retailPrice, { volumeDirect = 0, volumeEpi = 0, volumeGs = 0, directRatio = 0.90 } = {}) => {
    const direct = round(retailPrice * directRatio, 2);
    const epiceries = round(retailPrice * (1 - 0.30), 2);
    const gs = round((retailPrice * (1 - 0.32)) / (1 + 0.12), 2);
    demoChannelPriceCounter += 1;
    return [
        { id: `cp_${demoChannelPriceCounter}_d`, channelId: 'channel_direct', netPrice: direct, volume: volumeDirect },
        { id: `cp_${demoChannelPriceCounter}_e`, channelId: 'channel_epiceries', netPrice: epiceries, volume: volumeEpi },
        { id: `cp_${demoChannelPriceCounter}_g`, channelId: 'channel_gs', netPrice: gs, volume: volumeGs },
    ];
};

// PDS (Prix de Détail Suggéré, Phase 3.2bis, 15/10) : une donnée du FORMAT (voir ProductInfo.jsx),
// saisie manuellement dans l'app réelle — jamais déduite. `retailPrice` ci-dessus EST ce PDS (le
// prix tablette cible qui sert déjà à dériver les 3 prix nets), donc l'exposer ici n'invente aucune
// donnée : regroupe simplement les deux dans un seul objet à spreader sur le format, pour que
// chaque SKU démo affiche un PDS cohérent avec ses prix nets déjà saisis, au lieu de rester vide.
const demoFormatPricing = (retailPrice, opts) => ({
    pds: retailPrice,
    channelPrices: demoChannelPriceSet(retailPrice, opts),
});

export const getDefaultState = () => {
    const today = new Date().toISOString().split('T')[0];

    // --- CANAUX DE VENTE (3, avec cascade de maillons réaliste) ---
    // Phase 4.6 : un canal n'a PAS de driver au choix (contrairement à une activité) — son pool de
    // frais fixes se convertit toujours en une majoration % sur le coût de production déjà établi
    // à l'activité, jamais un mécanisme indépendant (voir 04-Conception-Modele.md, section 4.6).
    const demoSalesChannels = [
        { id: 'channel_direct', name: 'Vente directe (boutique en ligne)', links: [] },
        { id: 'channel_epiceries', name: 'Épiceries indépendantes', links: [
            { id: 'link_epi_1', name: 'Épicier indépendant', type: 'margin', percent: 30 },
        ] },
        { id: 'channel_gs', name: 'Grandes surfaces', links: [
            { id: 'link_gs_1', name: 'Centre de distribution', type: 'markup', percent: 12 },
            { id: 'link_gs_2', name: 'Détaillant national', type: 'margin', percent: 32 },
        ] },
    ];

    // --- LIGNES DE PRODUCTION (3) ---
    // `indirectCostDriver` (Phase 4.6) : driver choisi pour convertir le pool de frais fixes de
    // CETTE activité en taux par produit — « directCost » (par défaut, au prorata du coût direct —
    // matière+emballage+MO+sous-traitance combinés — le driver le plus défendable par défaut, voir
    // Projet_Claude/04-Conception-Modele.md section Phase 4.6) ou « laborTime » (préférable quand le
    // frais indirect suit surtout la cadence/le temps machine plutôt que la valeur des intrants).
    const demoProductionActivities = [
        { id: 'act_plats', name: 'Plats principaux surgelés', indirectCostDriver: 'directCost' },
        { id: 'act_soupes', name: 'Soupes et potages', indirectCostDriver: 'directCost' },
        { id: 'act_sauces', name: 'Sauces et accompagnements', indirectCostDriver: 'directCost' },
    ];

    // --- REVENUS RÉELS (Phase 4.2) : une ligne par activité + une ligne "Général" pour le revenu
    // non rattachable à une activité modélisée. `repartition` = contenant choisi (Général, une
    // activité précise, ou 'manual' pour une ventilation libre sur plusieurs contenants à la fois —
    // voir 04-Conception-Modele.md section 1bis) ; `amounts` porte le ou les montants réels, une
    // seule clé non nulle hors du mode manuel. Consommé par la clé de répartition « Selon les
    // ventes » (Phase 4.5bis) et par le côté réel de la Réconciliation réel/théorique (Phase 4.4) —
    // `generalInfo.totalRevenue` ci-dessous en reste la somme exacte, pour rester cohérent si cette
    // liste change, mais n'est lui-même lu par aucun calcul de coût (voir addendum du 19/10 de
    // Projet_Claude/03-Feuille-de-route.md : le moteur théorique ne doit jamais lire ce total réel).
    const demoRevenueLines = [
        { id: 'rev_plats', label: 'Ventes — Plats principaux surgelés', repartition: 'act_plats', amounts: { act_plats: 90000 } },
        { id: 'rev_soupes', label: 'Ventes — Soupes et potages', repartition: 'act_soupes', amounts: { act_soupes: 40000 } },
        { id: 'rev_sauces', label: 'Ventes — Sauces et accompagnements', repartition: 'act_sauces', amounts: { act_sauces: 25000 } },
        { id: 'rev_divers', label: 'Revenus divers (non rattachés à une activité)', repartition: 'general', amounts: { general: 5000 } },
    ];

    // --- FRAIS FIXES (Phase 4.1, allocation Phase 4.5) : état de résultats catégorisé, remplace
    // l'ancien generalInfo.totalIndirects saisi à plat. Somme intacte (28 000 $, voir plus bas) pour
    // ne pas faire dériver les montants de frais indirects déjà affichés ailleurs dans la démo.
    //
    // Répartition (Phase 4.5/4.5bis, complétée le 14/10) : CHAQUE ligne porte désormais une clé de
    // répartition déterminée selon le tableau « Contenant suggéré par défaut » de
    // 04-Conception-Modele.md (section 1), pour que la section État des résultats serve de données
    // de test réalistes et complètes pour la Phase 4.6 (conversion en taux par produit) :
    //  - Frais généraux de production → Général ou Activité. Loyer : répartition MANUELLE par
    //    surface de production réellement occupée (donnée qu'aucune clé automatique ne peut
    //    déduire, donc le choix le plus défendable reste une saisie manuelle réfléchie). Électricité
    //    : clé « Selon les charges directes » (la consommation énergétique suit l'intensité de
    //    production, mieux approximée par le coût direct que par les ventes).
    //  - Frais de vente/mise en marché → Général ou Canal. Marketing : répartition MANUELLE par
    //    canal (dépenses publicitaires réellement engagées par circuit, traçables telles quelles en
    //    comptabilité). Commissions : clé personnalisée « Ventes par canal (hors Général) », au
    //    prorata des ventes réelles par canal (les commissions de distribution sont par nature un
    //    coût de canal, jamais d'activité).
    //  - Frais d'administration → Général. Salaire de direction/Assurances/Comptabilité : sélection
    //    directe de l'activité « Général » (coûts de structure, non rattachables à une activité ou
    //    un canal précis).
    //  - Frais financiers → Général. Frais bancaires : sélection directe de l'activité « Général »
    //    (coûts de financement, jamais rattachables à une activité ou un canal).
    const demoExpenseLines = [
        { id: 'exp_loyer_prod', label: 'Loyer (espace de production)', category: 'Frais généraux de production', amount: 9000, repartitionKey: 'manual', activityAllocations: { act_plats: 5000, act_soupes: 2500, act_sauces: 1500 }, channelAllocations: {} },
        { id: 'exp_elec', label: 'Électricité et chauffage', category: 'Frais généraux de production', amount: 3000, repartitionKey: 'directCosts', activityAllocations: {}, channelAllocations: {} },
        { id: 'exp_marketing', label: 'Marketing et promotion', category: 'Frais de vente / mise en marché', amount: 4000, repartitionKey: 'manual', activityAllocations: {}, channelAllocations: { channel_direct: 1000, channel_epiceries: 1500, channel_gs: 1500 } },
        { id: 'exp_commissions', label: 'Commissions et frais de distribution', category: 'Frais de vente / mise en marché', amount: 3500, repartitionKey: 'custom:rk_ventes_canal', activityAllocations: {}, channelAllocations: {} },
        { id: 'exp_salaire_admin', label: 'Salaire de direction', category: "Frais d'administration", amount: 3000, repartitionKey: 'activity:general', activityAllocations: {}, channelAllocations: {} },
        { id: 'exp_assurances', label: 'Assurances', category: "Frais d'administration", amount: 2500, repartitionKey: 'activity:general', activityAllocations: {}, channelAllocations: {} },
        { id: 'exp_comptabilite', label: 'Comptabilité et services professionnels', category: "Frais d'administration", amount: 2000, repartitionKey: 'activity:general', activityAllocations: {}, channelAllocations: {} },
        { id: 'exp_bancaire', label: 'Frais bancaires et intérêts', category: 'Frais financiers', amount: 1000, repartitionKey: 'activity:general', activityAllocations: {}, channelAllocations: {} },
    ];

    // Clé de répartition personnalisée de démonstration (Phase 4.5bis, 14/10) : part réelle de
    // chaque canal dans les ventes totalisables par canal (155 000 $ sur 160 000 $ — exclut les
    // 5 000 $ de « Revenus divers » saisis en Général, qui n'ont par construction aucune
    // information de canal). Pourcentages figés ici (valeurs exactes calculées une fois, pas une
    // formule — une clé personnalisée est un gabarit réutilisable, pas une valeur recalculée à
    // chaque usage, contrairement à « Selon les ventes »/« Selon les charges directes »).
    const demoRepartitionKeys = [
        { id: 'rk_ventes_canal', name: 'Ventes par canal (hors Général)', activityShares: {}, channelShares: { channel_direct: 16.01, channel_epiceries: 25.52, channel_gs: 58.47 } },
    ];

    // --- CHARGES DIRECTES RÉELLES (Phase 4.3) : même patron que les frais fixes, mais catégorisées
    // par TYPE DE COÛT (voir utils.js, DIRECT_COST_TYPES) plutôt que par fonction d'entreprise —
    // vocabulaire de calculateCosts.js. Données plausibles pour un chiffre d'affaires de 160 000 $
    // (demoRevenueLines). Consommées par la clé de répartition « Selon les charges directes »
    // (Phase 4.5bis, voir exp_elec ci-dessous) et par le côté réel de la Réconciliation
    // réel/théorique (Phase 4.4) — jamais par le calcul de coût de revient lui-même (ces montants
    // réels catégorisés n'ont pas vocation à remplacer le modèle de recette).
    const demoDirectCostLines = [
        { id: 'dc_matiere', label: 'Achats de matières premières', category: 'Matière première', amount: 54000 },
        { id: 'dc_mo_prod', label: "Main-d'œuvre de production (plancher)", category: "Main-d'œuvre directe", amount: 32000 },
        { id: 'dc_emballage', label: "Achats d'emballage", category: 'Emballage', amount: 9500 },
        { id: 'dc_soustraitance', label: 'Sous-traitance — surgélation', category: 'Sous-traitance', amount: 4500 },
    ];

    // --- INGRÉDIENTS (18 références, 5 fournisseurs) ---
    const ingredients = [
        { id: 'ing_poulet', name: 'Poitrine de poulet désossée', provider: 'Boucherie Nordique', purchaseFormat: 10, unit: 'kg', purchasePrice: 62.00, unitPrice: 6.20, isRecipe: false, lossPercentage: 6, lastUpdated: today, allergens: [] },
        { id: 'ing_boeuf', name: 'Bœuf haché mi-maigre', provider: 'Boucherie Nordique', purchaseFormat: 5, unit: 'kg', purchasePrice: 48.75, unitPrice: 9.75, isRecipe: false, lossPercentage: 8, lastUpdated: today, allergens: [] },
        { id: 'ing_saumon', name: 'Filet de saumon surgelé IQF', provider: 'Poissonnerie Boréale', purchaseFormat: 5, unit: 'kg', purchasePrice: 92.50, unitPrice: 18.50, isRecipe: false, lossPercentage: 4, lastUpdated: today, allergens: ['fish'] },
        { id: 'ing_carotte', name: 'Carottes en dés surgelées', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 18.00, unitPrice: 1.80, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_brocoli', name: 'Brocoli en bouquets surgelé', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 26.00, unitPrice: 2.60, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_pois', name: 'Petits pois surgelés', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 17.00, unitPrice: 1.70, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_oignon', name: 'Oignon jaune haché', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 12.00, unitPrice: 1.20, isRecipe: false, lossPercentage: 5, lastUpdated: today, allergens: [] },
        { id: 'ing_mais', name: 'Maïs en grains surgelé', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 15.00, unitPrice: 1.50, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_courge', name: 'Courge musquée en dés surgelée', provider: 'Maraîcher du Nord', purchaseFormat: 10, unit: 'kg', purchasePrice: 19.00, unitPrice: 1.90, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_pdt_flocons', name: 'Pommes de terre en flocons', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 10, unit: 'kg', purchasePrice: 38.00, unitPrice: 3.80, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_riz', name: 'Riz basmati', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 20, unit: 'kg', purchasePrice: 48.00, unitPrice: 2.40, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_creme', name: 'Crème 35 %', provider: 'Fromagerie du Lac', purchaseFormat: 4, unit: 'L', purchasePrice: 42.00, unitPrice: 10.50, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_beurre', name: 'Beurre non salé', provider: 'Fromagerie du Lac', purchaseFormat: 5, unit: 'kg', purchasePrice: 52.00, unitPrice: 10.40, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['milk'] },
        { id: 'ing_farine', name: 'Farine tout usage', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 20, unit: 'kg', purchasePrice: 23.00, unitPrice: 1.15, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['gluten'] },
        { id: 'ing_tomates', name: 'Tomates broyées en conserve', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 3, unit: 'kg', purchasePrice: 9.00, unitPrice: 3.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_haricots', name: 'Haricots rouges en conserve', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 3, unit: 'kg', purchasePrice: 10.50, unitPrice: 3.50, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
        { id: 'ing_epices_asiat', name: 'Prémélange gingembre-ail-soya', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 2, unit: 'kg', purchasePrice: 19.00, unitPrice: 9.50, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: ['soy'] },
        { id: 'ing_epices', name: 'Épices et assaisonnements maison', provider: 'Épicerie Grossiste Boréal', purchaseFormat: 1, unit: 'kg', purchasePrice: 20.00, unitPrice: 20.00, isRecipe: false, lossPercentage: 0, lastUpdated: today, allergens: [] },
    ];

    // --- EMBALLAGE (Phase 2) : catalogue miroir des ingrédients (fournisseur, format d'achat,
    // unité, prix, perte %), mais jamais fusionné au coût matière — voir 04-Conception-Modele.md.
    const packaging = [
        { id: 'pkg_barq_s', name: 'Barquette operable 340 ml', provider: 'Emballages Boréal', purchaseFormat: 200, unit: 'unité', purchasePrice: 84.00, unitPrice: 0.42, lossPercentage: 1, lastUpdated: today },
        { id: 'pkg_barq_f', name: 'Barquette operable 900 ml (familiale)', provider: 'Emballages Boréal', purchaseFormat: 150, unit: 'unité', purchasePrice: 102.00, unitPrice: 0.68, lossPercentage: 1, lastUpdated: today },
        { id: 'pkg_pellicule', name: 'Pellicule scellante operable', provider: 'Emballages Boréal', purchaseFormat: 500, unit: 'unité', purchasePrice: 40.00, unitPrice: 0.08, lossPercentage: 2, lastUpdated: today },
        { id: 'pkg_boite', name: 'Manchon de carton imprimé', provider: 'Cartons Pro-Nord', purchaseFormat: 100, unit: 'unité', purchasePrice: 55.00, unitPrice: 0.55, lossPercentage: 1, lastUpdated: today },
        { id: 'pkg_etiquette', name: 'Étiquette nutritionnelle / code-barres', provider: 'Impression Boréale', purchaseFormat: 1000, unit: 'unité', purchasePrice: 70.00, unitPrice: 0.07, lossPercentage: 2, lastUpdated: today },
        { id: 'pkg_sac_soupe', name: 'Sac sous-vide pour soupe 750 ml', provider: 'Emballages Boréal', purchaseFormat: 300, unit: 'unité', purchasePrice: 90.00, unitPrice: 0.30, lossPercentage: 1, lastUpdated: today },
        { id: 'pkg_pot_verre', name: 'Pot de verre 500 ml', provider: 'Emballages Boréal', purchaseFormat: 24, unit: 'unité', purchasePrice: 26.40, unitPrice: 1.10, lossPercentage: 2, lastUpdated: today },
        { id: 'pkg_couvercle', name: 'Couvercle twist-off 70 mm', provider: 'Emballages Boréal', purchaseFormat: 100, unit: 'unité', purchasePrice: 14.00, unitPrice: 0.14, lossPercentage: 1, lastUpdated: today },
    ];

    // --- MAIN-D'ŒUVRE (4 postes, dont 2 avec plusieurs employés — ligne de production réelle) ---
    const labor = [
        { id: 'post_resp', postName: 'Responsable de production', employees: [
            { id: 'emp_resp', employeeName: 'Mireille', hourlyRate: 32, socialCharges: 16, vacationPercentage: 6, productiveTimePercentage: 85, workedHours: 160 },
        ] },
        { id: 'post_cuisinier', postName: 'Cuisinier de production', employees: [
            { id: 'emp_cuisinier_1', employeeName: 'Hugo', hourlyRate: 22, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 92, workedHours: 180 },
            { id: 'emp_cuisinier_2', employeeName: 'Félix', hourlyRate: 22, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 90, workedHours: 180 },
            { id: 'emp_cuisinier_3', employeeName: 'Sarah', hourlyRate: 21, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 92, workedHours: 170 },
        ] },
        { id: 'post_emballage', postName: "Opérateur d'emballage", employees: [
            { id: 'emp_emballage_1', employeeName: 'Chantal', hourlyRate: 19, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 95, workedHours: 180 },
            { id: 'emp_emballage_2', employeeName: 'Nadia', hourlyRate: 19, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 94, workedHours: 180 },
            { id: 'emp_emballage_3', employeeName: 'Patrick', hourlyRate: 18, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 93, workedHours: 170 },
        ] },
        { id: 'post_qualite', postName: 'Contrôleur qualité', employees: [
            { id: 'emp_qualite', employeeName: 'David', hourlyRate: 24, socialCharges: 16, vacationPercentage: 4, productiveTimePercentage: 90, workedHours: 140 },
        ] },
    ];

    // --- PRODUITS (11, dont 2 avec plusieurs formats — 13 formats au total) ---
    // Chaque produit construit directement son/ses `formats[]` (plutôt que buildDefaultFormat, qui
    // ne gère qu'un format unique dérivé des champs à plat) : deux produits ont un format simple ET
    // un format familial, avec leur propre recette, sous-traitance/vieillissement — impossible à
    // exprimer avec un seul format implicite.
    const rawProducts = [
        // Sous-recette pure : jamais vendue seule.
        {
            id: 'sub_bouillon', platName: 'Bouillon de poulet maison', category: 'Sous-recette', activityId: 'act_soupes',
            isIngredient: true, onMenu: false, salesMix: 0, prixVente: 0, nbPortions: 40, portionSize: 1, portionUnit: 'L',
            formats: [{
                id: 'fmt_sub_bouillon', sku: 'SR-BOUILLON-40L', prixVente: 0, nbPortions: 40, portionSize: 1, portionUnit: 'L',
                salesMix: 0, onMenu: false, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                channelPrices: [{ id: 'cp_bouillon', channelId: 'channel_direct', netPrice: 0, volume: 0 }],
                ingredients: [
                    { rowId: 'r_bo_1', id: 'ing_poulet', quantity: 2000, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_bo_2', id: 'ing_carotte', quantity: 750, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_bo_3', id: 'ing_oignon', quantity: 750, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_bo_4', id: 'ing_epices', quantity: 50, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [],
                productionSteps: [
                    { stepId: 's_bo_1', stepName: 'Mijotage du bouillon', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 7200 },
                ],
            }],
        },
        // Sous-recette hybride : vendue seule (accompagnement) ET utilisée comme ingrédient (Pâté chinois).
        {
            id: 'sub_puree', platName: 'Purée de pommes de terre maison', category: 'Accompagnement', activityId: 'act_plats',
            isIngredient: true, onMenu: true, salesMix: 5.36, prixVente: 4.94, nbPortions: 1, portionSize: 250, portionUnit: 'g',
            formats: [{
                id: 'fmt_sub_puree', sku: 'ACC-PUREE-250G', prixVente: 4.94, nbPortions: 1, portionSize: 250, portionUnit: 'g',
                salesMix: 5.36, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['milk'],
                ...demoFormatPricing(5.49, { volumeDirect: 90, volumeEpi: 160, volumeGs: 420 }),
                ingredients: [
                    { rowId: 'r_pu_1', id: 'ing_pdt_flocons', quantity: 200, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_pu_2', id: 'ing_beurre', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_pu_3', id: 'ing_creme', quantity: 20, recipeUnit: 'ml', yieldPercentage: 100 },
                    { rowId: 'r_pu_4', id: 'ing_epices', quantity: 3, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_pu_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_pu_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_pu_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_pu_1', stepName: 'Cuisson et pilage', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 90 },
                    { stepId: 's_pu_2', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 90, duration: 30 },
                ],
            }],
        },

        // Pâté chinois traditionnel — 2 formats (simple + familial, familial avec vieillissement).
        {
            id: 'prod_pate', platName: 'Pâté chinois traditionnel', category: 'Plat principal', activityId: 'act_plats',
            isIngredient: false, onMenu: true, salesMix: 11.21, prixVente: 8.09, nbPortions: 1, portionSize: 340, portionUnit: 'g',
            formats: [
                {
                    id: 'fmt_pate_s', sku: 'PP-PATECHINOIS-340G', prixVente: 8.09, nbPortions: 1, portionSize: 340, portionUnit: 'g',
                    salesMix: 11.21, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['milk'],
                    ...demoFormatPricing(8.99, { volumeDirect: 180, volumeEpi: 320, volumeGs: 900 }),
                    ingredients: [
                        { rowId: 'r_pa_1', id: 'ing_boeuf', quantity: 150, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_pa_2', id: 'ing_mais', quantity: 90, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_pa_3', id: 'sub_puree', quantity: 90, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_pa_4', id: 'ing_oignon', quantity: 10, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_pa_5', id: 'ing_epices', quantity: 2, recipeUnit: 'g', yieldPercentage: 100 },
                    ],
                    packagingItems: [
                        { rowId: 'p_pa_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_pa_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_pa_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                    ],
                    productionSteps: [
                        { stepId: 's_pa_1', stepName: 'Cuisson du bœuf et assemblage', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 90 },
                        { stepId: 's_pa_2', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 90, duration: 45 },
                    ],
                },
                {
                    id: 'fmt_pate_f', sku: 'PP-PATECHINOIS-900G', prixVente: 19.79, nbPortions: 1, portionSize: 900, portionUnit: 'g',
                    salesMix: 4.96, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['milk'],
                    ...demoFormatPricing(21.99, { volumeDirect: 60, volumeEpi: 140, volumeGs: 420 }),
                    aging: { enabled: true, interestRate: 7, months: 1.5 },
                    ingredients: [
                        { rowId: 'r_paf_1', id: 'ing_boeuf', quantity: 400, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_paf_2', id: 'ing_mais', quantity: 240, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_paf_3', id: 'sub_puree', quantity: 240, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_paf_4', id: 'ing_oignon', quantity: 25, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_paf_5', id: 'ing_epices', quantity: 5, recipeUnit: 'g', yieldPercentage: 100 },
                    ],
                    packagingItems: [
                        { rowId: 'p_paf_1', id: 'pkg_barq_f', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_paf_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_paf_3', id: 'pkg_boite', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_paf_4', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                    ],
                    productionSteps: [
                        { stepId: 's_paf_1', stepName: 'Cuisson du bœuf et assemblage (lot familial)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 150 },
                        { stepId: 's_paf_2', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 150, duration: 90 },
                        { stepId: 's_paf_3', stepName: 'Contrôle qualité', personnel: [{ postId: 'Contrôleur qualité' }], startTime: 240, duration: 30 },
                    ],
                },
            ],
        },

        // Poulet général Tao, riz et légumes.
        {
            id: 'prod_tao', platName: 'Poulet général Tao, riz et légumes', category: 'Plat principal', activityId: 'act_plats',
            isIngredient: false, onMenu: true, salesMix: 11.21, prixVente: 8.54, nbPortions: 1, portionSize: 400, portionUnit: 'g',
            formats: [{
                id: 'fmt_tao', sku: 'PP-GENERALTAO-400G', prixVente: 8.54, nbPortions: 1, portionSize: 400, portionUnit: 'g',
                salesMix: 11.21, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['soy'],
                ...demoFormatPricing(9.49, { volumeDirect: 150, volumeEpi: 300, volumeGs: 950 }),
                ingredients: [
                    { rowId: 'r_tao_1', id: 'ing_poulet', quantity: 180, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_tao_2', id: 'ing_riz', quantity: 120, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_tao_3', id: 'ing_brocoli', quantity: 60, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_tao_4', id: 'ing_epices_asiat', quantity: 25, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_tao_5', id: 'ing_epices', quantity: 2, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_tao_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_tao_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_tao_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_tao_1', stepName: 'Cuisson du poulet et de la sauce', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 150 },
                    { stepId: 's_tao_2', stepName: 'Cuisson du riz et des légumes', personnel: [{ postId: 'Cuisinier de production' }], startTime: 150, duration: 120 },
                    { stepId: 's_tao_3', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 270, duration: 60 },
                ],
            }],
        },

        // Saumon teriyaki, riz et légumes — item premium.
        {
            id: 'prod_saumon', platName: 'Saumon teriyaki, riz et légumes', category: 'Plat principal', activityId: 'act_plats',
            isIngredient: false, onMenu: true, salesMix: 7.93, prixVente: 12.59, nbPortions: 1, portionSize: 380, portionUnit: 'g',
            formats: [{
                // SKU auto-généré (pas un code manuel comme les autres formats) : un seul produit du
                // menu démo reste volontairement dans ce mode, pour illustrer la régénération
                // automatique du SKU au renommage/changement de quantité (voir isAutoGeneratedSku,
                // App.jsx).
                id: 'fmt_saumon', sku: buildFormatSku('Saumon teriyaki, riz et légumes', 380, 'g', 'fmt_saumon'), prixVente: 12.59, nbPortions: 1, portionSize: 380, portionUnit: 'g',
                salesMix: 7.93, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['fish', 'soy'],
                ...demoFormatPricing(13.99, { volumeDirect: 140, volumeEpi: 250, volumeGs: 600 }),
                ingredients: [
                    { rowId: 'r_sa_1', id: 'ing_saumon', quantity: 180, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_sa_2', id: 'ing_riz', quantity: 110, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_sa_3', id: 'ing_brocoli', quantity: 50, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_sa_4', id: 'ing_pois', quantity: 40, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_sa_5', id: 'ing_epices_asiat', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_sa_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_sa_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_sa_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_sa_1', stepName: 'Cuisson du saumon', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 120 },
                    { stepId: 's_sa_2', stepName: 'Cuisson du riz et des légumes', personnel: [{ postId: 'Cuisinier de production' }], startTime: 120, duration: 120 },
                    { stepId: 's_sa_3', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 240, duration: 60 },
                ],
            }],
        },

        // Sauté de poulet thaï — 2 formats, familial sous-traité (cuisson sous vide) + vieillissement.
        {
            id: 'prod_thai', platName: 'Sauté de poulet thaï, riz et légumes', category: 'Plat principal', activityId: 'act_plats',
            isIngredient: false, onMenu: true, salesMix: 8.73, prixVente: 8.36, nbPortions: 1, portionSize: 350, portionUnit: 'g',
            formats: [
                {
                    id: 'fmt_thai_s', sku: 'PP-POULETTHAI-350G', prixVente: 8.36, nbPortions: 1, portionSize: 350, portionUnit: 'g',
                    salesMix: 8.73, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['soy'],
                    ...demoFormatPricing(9.29, { volumeDirect: 130, volumeEpi: 260, volumeGs: 700 }),
                    ingredients: [
                        { rowId: 'r_th_1', id: 'ing_poulet', quantity: 170, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_th_2', id: 'ing_riz', quantity: 110, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_th_3', id: 'ing_brocoli', quantity: 50, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_th_4', id: 'ing_epices_asiat', quantity: 28, recipeUnit: 'g', yieldPercentage: 100 },
                    ],
                    packagingItems: [
                        { rowId: 'p_th_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_th_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_th_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                    ],
                    productionSteps: [
                        { stepId: 's_th_1', stepName: 'Cuisson du poulet et des légumes', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 150 },
                        { stepId: 's_th_2', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 150, duration: 60 },
                    ],
                },
                {
                    id: 'fmt_thai_f', sku: 'PP-POULETTHAI-900G', prixVente: 20.69, nbPortions: 1, portionSize: 900, portionUnit: 'g',
                    salesMix: 4.4, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['soy'],
                    ...demoFormatPricing(22.99, { volumeDirect: 50, volumeEpi: 120, volumeGs: 380 }),
                    subcontracting: { enabled: true, items: [{ id: 'sub_thai_item_1', name: 'Cuisine Sous-Vide Boréal', operation: 'Cuisson sous vide du poulet et des légumes (lot familial)', cost: 2.60 }] },
                    aging: { enabled: true, interestRate: 8, months: 1 },
                    ingredients: [
                        { rowId: 'r_thf_1', id: 'ing_poulet', quantity: 440, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_thf_2', id: 'ing_riz', quantity: 280, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_thf_3', id: 'ing_brocoli', quantity: 130, recipeUnit: 'g', yieldPercentage: 100 },
                        { rowId: 'r_thf_4', id: 'ing_epices_asiat', quantity: 65, recipeUnit: 'g', yieldPercentage: 100 },
                    ],
                    packagingItems: [
                        { rowId: 'p_thf_1', id: 'pkg_barq_f', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_thf_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_thf_3', id: 'pkg_boite', quantity: 1, recipeUnit: 'unité' },
                        { rowId: 'p_thf_4', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                    ],
                    productionSteps: [
                        { stepId: 's_thf_1', stepName: 'Portionnement familial (cuisson reçue du sous-traitant)', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 0, duration: 90 },
                        { stepId: 's_thf_2', stepName: 'Contrôle qualité', personnel: [{ postId: 'Contrôleur qualité' }], startTime: 90, duration: 30 },
                    ],
                },
            ],
        },

        // Chili con carne mijoté — haut volume, marge correcte (« vache à lait »).
        {
            id: 'prod_chili', platName: 'Chili con carne mijoté', category: 'Plat principal', activityId: 'act_plats',
            isIngredient: false, onMenu: true, salesMix: 13.13, prixVente: 7.64, nbPortions: 1, portionSize: 400, portionUnit: 'g',
            formats: [{
                id: 'fmt_chili', sku: 'PP-CHILICONCARNE-400G', prixVente: 7.64, nbPortions: 1, portionSize: 400, portionUnit: 'g',
                salesMix: 13.13, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                ...demoFormatPricing(8.49, { volumeDirect: 160, volumeEpi: 380, volumeGs: 1100 }),
                ingredients: [
                    { rowId: 'r_ch_1', id: 'ing_boeuf', quantity: 160, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ch_2', id: 'ing_haricots', quantity: 120, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ch_3', id: 'ing_tomates', quantity: 150, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ch_4', id: 'ing_oignon', quantity: 30, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ch_5', id: 'ing_epices', quantity: 3, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_ch_1', id: 'pkg_barq_s', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_ch_2', id: 'pkg_pellicule', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_ch_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_ch_1', stepName: 'Mijotage du chili', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 150 },
                    { stepId: 's_ch_2', stepName: 'Portionnement et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 150, duration: 60 },
                ],
            }],
        },

        // Soupe-repas aux légumes et poulet — grille de rendement (lot de 40 L → unités de 750 ml).
        {
            id: 'prod_soupe', platName: 'Soupe-repas aux légumes et poulet', category: 'Soupe', activityId: 'act_soupes',
            isIngredient: false, onMenu: true, salesMix: 10.01, prixVente: 6.74, nbPortions: 46.65, portionSize: 0.75, portionUnit: 'L',
            formats: [{
                id: 'fmt_soupe', sku: 'SO-LEGUMESPOULET-750ML', prixVente: 6.74, nbPortions: 46.65, portionSize: 0.75, portionUnit: 'L',
                salesMix: 10.01, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                ...demoFormatPricing(7.49, { volumeDirect: 150, volumeEpi: 320, volumeGs: 780 }),
                yieldGrid: {
                    enabled: true, baseQuantity: 40, baseUnit: 'L',
                    stages: [
                        { id: 'y_so_1', name: 'Réduction à la cuisson', percentEffect: -15 },
                        { id: 'y_so_2', name: 'Incorporation des légumes et du poulet', percentEffect: 5 },
                    ],
                    rejectRate: 2,
                },
                ingredients: [
                    { rowId: 'r_so_1', id: 'sub_bouillon', quantity: 20, recipeUnit: 'L', yieldPercentage: 100 },
                    { rowId: 'r_so_2', id: 'ing_poulet', quantity: 3000, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_so_3', id: 'ing_carotte', quantity: 2500, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_so_4', id: 'ing_pois', quantity: 1500, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_so_5', id: 'ing_oignon', quantity: 1000, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_so_6', id: 'ing_epices', quantity: 60, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_so_1', id: 'pkg_sac_soupe', quantity: 47, recipeUnit: 'unité' },
                    { rowId: 'p_so_2', id: 'pkg_etiquette', quantity: 47, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_so_1', stepName: 'Mijotage du lot (40 L)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 5400 },
                    { stepId: 's_so_2', stepName: 'Mise en sacs et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 5400, duration: 2700 },
                ],
            }],
        },

        // Potage à la courge musquée — item délibérément sous-performant (« poids mort »), recette
        // trop riche (crème) pour son prix de vente : négatif dans les 3 canaux.
        {
            id: 'prod_potage', platName: 'Potage à la courge musquée', category: 'Soupe', activityId: 'act_soupes',
            isIngredient: false, onMenu: true, salesMix: 5.53, prixVente: 6.74, nbPortions: 1, portionSize: 0.75, portionUnit: 'L',
            formats: [{
                id: 'fmt_potage', sku: 'SO-COURGEMUSQUEE-750ML', prixVente: 6.74, nbPortions: 1, portionSize: 0.75, portionUnit: 'L',
                salesMix: 5.53, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: ['milk'],
                ...demoFormatPricing(7.49, { volumeDirect: 90, volumeEpi: 180, volumeGs: 420 }),
                ingredients: [
                    { rowId: 'r_po_1', id: 'ing_courge', quantity: 350, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_po_2', id: 'ing_creme', quantity: 150, recipeUnit: 'ml', yieldPercentage: 100 },
                    { rowId: 'r_po_3', id: 'sub_bouillon', quantity: 250, recipeUnit: 'ml', yieldPercentage: 100 },
                    { rowId: 'r_po_4', id: 'ing_beurre', quantity: 20, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_po_5', id: 'ing_farine', quantity: 15, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_po_6', id: 'ing_oignon', quantity: 30, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_po_7', id: 'ing_epices', quantity: 3, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_po_1', id: 'pkg_sac_soupe', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_po_2', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_po_1', stepName: 'Mijotage et velouté', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 420 },
                    { stepId: 's_po_2', stepName: 'Mise en sac et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 420, duration: 60 },
                ],
            }],
        },

        // Sauce à spaghetti maison — gros volume, marge correcte en direct, mince en épiceries/GS.
        {
            id: 'prod_sauce_spag', platName: 'Sauce à spaghetti maison', category: 'Sauce', activityId: 'act_sauces',
            isIngredient: false, onMenu: true, salesMix: 12, prixVente: 7.19, nbPortions: 1, portionSize: 500, portionUnit: 'ml',
            formats: [{
                id: 'fmt_sauce_spag', sku: 'SA-SPAGHETTI-500ML', prixVente: 7.19, nbPortions: 1, portionSize: 500, portionUnit: 'ml',
                // Volumes à 0 (délibérément) : seul format du menu démo resté en mode « % manuel »
                // du mix des ventes, pour illustrer la coexistence avec les formats « unités »
                // (tous les autres) — voir salesMixFromChannels.js.
                salesMix: 12, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: false, purchaseCost: 0, manualAllergens: [],
                ...demoFormatPricing(7.99, { volumeDirect: 0, volumeEpi: 0, volumeGs: 0 }),
                ingredients: [
                    { rowId: 'r_ss_1', id: 'ing_tomates', quantity: 350, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ss_2', id: 'ing_boeuf', quantity: 100, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ss_3', id: 'ing_oignon', quantity: 40, recipeUnit: 'g', yieldPercentage: 100 },
                    { rowId: 'r_ss_4', id: 'ing_epices', quantity: 5, recipeUnit: 'g', yieldPercentage: 100 },
                ],
                packagingItems: [
                    { rowId: 'p_ss_1', id: 'pkg_pot_verre', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_ss_2', id: 'pkg_couvercle', quantity: 1, recipeUnit: 'unité' },
                    { rowId: 'p_ss_3', id: 'pkg_etiquette', quantity: 1, recipeUnit: 'unité' },
                ],
                productionSteps: [
                    { stepId: 's_ss_1', stepName: 'Mijotage de la sauce', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 240 },
                    { stepId: 's_ss_2', stepName: 'Mise en pot et scellage', personnel: [{ postId: "Opérateur d'emballage" }], startTime: 240, duration: 60 },
                ],
            }],
        },

        // Sauce artisanale du Terroir — PRODUIT DE REVENTE (achetée d'un partenaire, relabellisée).
        {
            id: 'prod_sauce_terroir', platName: 'Sauce artisanale du Terroir', category: 'Sauce', activityId: 'act_sauces',
            isIngredient: false, onMenu: true, salesMix: 5.53, prixVente: 7.19, nbPortions: 1, portionSize: 500, portionUnit: 'ml',
            formats: [{
                id: 'fmt_sauce_terroir', sku: 'SA-TERROIR-REVENTE-500ML', prixVente: 7.19, nbPortions: 1, portionSize: 500, portionUnit: 'ml',
                salesMix: 5.53, onMenu: true, indirectCosts: { portionsSold: 0 }, isResaleProduct: true, purchaseCost: 5.20, manualAllergens: [],
                ...demoFormatPricing(7.99, { volumeDirect: 90, volumeEpi: 180, volumeGs: 420 }),
                ingredients: [], packagingItems: [], productionSteps: [],
            }],
        },
    ];

    const generalInfo = {
        period: 'monthly', totalIndirects: sumLineAmounts(demoExpenseLines),
        // `totalRevenue` : jamais lu par le moteur de coût (voir addendum du 19/10 ci-dessus) —
        // gardé ici comme simple total d'affichage, dérivé de `demoRevenueLines` pour rester
        // cohérent si cette liste change, plutôt qu'un chiffre recopié à la main.
        totalRevenue: demoRevenueLines.reduce((sum, line) => sum + sumAmountsMap(line.amounts), 0),
        foodCostTarget: 32, packagingCostTarget: 8, laborCostTarget: 22, menuRevenuePercentage: 100,
        indirectCostMethod: 'salesAllocation',
    };

    // --- DONNÉES FINALES ---
    return {
        companyName: 'Boréal Mets Préparés inc.',
        logoUrl: './demo_logo.png',
        generalInfo,
        ingredientsList: ingredients,
        basePackaging: packaging,
        // Chaque produit porte déjà son/ses `formats[]` complets (voir rawProducts ci-dessus) : pas
        // de buildDefaultFormat ici (il ne gère qu'un format unique dérivé des champs à plat). Les
        // champs à plat du produit sont simplement mis en miroir sur son premier format — même
        // convention que buildDefaultFormat/App.jsx (canal "principal" = channelPrices[0]).
        products: rawProducts.map((p) => {
            const formats = p.formats;
            return {
                ...p,
                prixVente: formats[0].prixVente,
                nbPortions: formats[0].nbPortions,
                portionSize: formats[0].portionSize,
                portionUnit: formats[0].portionUnit,
                salesMix: formats[0].salesMix,
                onMenu: formats[0].onMenu,
            };
        }),
        laborDatabase: labor,
        trackingPoints: buildTrackingHistory(ingredients, labor, rawProducts, generalInfo, packaging),
        productionActivities: demoProductionActivities,
        salesChannels: demoSalesChannels,
        expenseLines: demoExpenseLines,
        revenueLines: demoRevenueLines,
        directCostLines: demoDirectCostLines,
        repartitionKeys: demoRepartitionKeys,
        uiSettings: {
            infoItemsPerPage: 10,
            ingredientsItemsPerPage: 10,
            packagingItemsPerPage: 10,
            summaryItemsPerPage: 10,
        },
    };
};

export const getEmptyState = () => ({
    companyName: "",
    logoUrl: '',
    productionActivities: [{ id: 'act_general', name: 'Général', indirectCostDriver: 'directCost' }],
    salesChannels: [{ id: 'channel_default', name: 'Vente directe', links: [] }],
    expenseLines: [],
    revenueLines: [],
    directCostLines: [],
    repartitionKeys: [],
    generalInfo: {
        period: 'monthly',
        totalIndirects: 0,
        totalRevenue: 0,
        totalKitchenLaborCost: 0,
        startDate: '',
        endDate: '',
        foodCostTarget: '',
        packagingCostTarget: '',
        laborCostTarget: '',
        menuRevenuePercentage: 100,
        indirectCostMethod: 'salesAllocation',
    },
    ingredientsList: [],
    basePackaging: [],
    products: [],
    trackingPoints: [],
    laborDatabase: [],
    uiSettings: {
        infoItemsPerPage: 10,
        ingredientsItemsPerPage: 10,
        packagingItemsPerPage: 10,
        summaryItemsPerPage: 10,
    },
});

// Méthodes d'attribution des frais indirects retenues : une seule est choisie globalement (dans
// les Paramètres) et s'applique à tous les plats. Les deux répartissent exactement le pool de
// frais indirects (elles se réconcilient par construction) :
//   - salesAllocation : au prorata du mix des ventes ;
//   - laborTime : au prorata du temps de production (taux = frais indirects / total heures MO).
export const indirectCostMethodLabels = {
    salesAllocation: 'Au prorata des ventes',
    laborTime: 'Au prorata du temps de production',
};

export const periodTranslations = {
    monthly: 'Mensuelle',
    weekly: 'Hebdomadaire',
    quarterly: 'Trimestrielle',
    yearly: 'Annuelle',
    custom: 'Personnalisée'
};
