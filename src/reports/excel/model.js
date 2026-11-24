// Modèle de l'export Excel « base de données » (23/11) : une fonction PURE qui transforme l'état du projet et les calculs déjà faits par l'application
// en tables (feuilles, colonnes, lignes). Elle n'écrit aucun fichier (voir workbook.js) et ne calcule RIEN de nouveau : chaque colonne « calculée » est lue
// dans un moteur existant (analysisData, calculateCostLines, computeFormatAllergens, computeGlobalSeries, computeIndirectPools, loadedHourlyRate…),
// exactement comme le modèle du rapport PDF. Une donnée absente reste une cellule vide (null), jamais un 0 par défaut.
//
// Forme d'une feuille : { name, family, desc, cols: [{ k, label, kind: 'in'|'calc'|'meta', fmt: 'text'|'usd'|'pct'|'int'|'num', def }], rows: [{ [k]: valeur }] }.
// `kind` : 'in' = valeur saisie dans l'application, 'calc' = valeur calculée par l'application, 'meta' = feuille d'accompagnement.
import { parseLocaleNumber as P, loadedHourlyRate, MAJOR_ALLERGENS, todayLocalISO } from '../../utils.js';
import { indirectCostMethodLabels } from '../../state/initialState.js';
import { calculateCostLines } from '../../engine/calculateCosts.js';
import { computeFormatAllergens } from '../../engine/allergens.js';
import { computeGlobalSeries } from '../../engine/trackingSeries.js';
import { computeIndirectPools, REPARTITION_ACTIVITY_PREFIX, REPARTITION_CHANNEL_PREFIX, REPARTITION_CUSTOM_PREFIX } from '../../engine/analysisData.js';


const ALLERGEN_NAME = Object.fromEntries(MAJOR_ALLERGENS.map(a => [a.key, a.name]));
const C = (k, label, kind, fmt, def) => ({ k, label, kind, fmt, def });
const sheet = (name, family, desc, cols, rows) => ({ name, family, desc, cols, rows });
// Une valeur saisie vide reste absente : P('') vaudrait 0.
const num = (v) => (v === '' || v == null || !Number.isFinite(P(v)) ? null : P(v));
const frac = (v) => (num(v) == null ? null : num(v) / 100);
const orNull = (v) => (v == null || Number.isNaN(v) ? null : v);

export function buildExcelModel({ project, analysisData, calculatedGeneralInfo, exportDate }) {
    const p = project || {};
    const a = analysisData || {};
    const g = calculatedGeneralInfo || {};
    const products = p.products || [], catalog = p.baseIngredients || p.ingredientsList || [], recipeSources = p.ingredientsList || catalog, packaging = p.basePackaging || [];
    const activities = p.productionActivities || [], channels = p.salesChannels || [], labor = p.laborDatabase || [], points = p.trackingPoints || [];
    const expenseLines = p.expenseLines || [], revenueLines = p.revenueLines || [], directCostLines = p.directCostLines || [], repartitionKeys = p.repartitionKeys || [];
    const rows = a.productsWithCosts || [];
    const actName = Object.fromEntries(activities.map(x => [x.id, x.name]));
    const chName = Object.fromEntries(channels.map(x => [x.id, x.name]));
    const bucketName = (k) => (k === 'general' ? 'Général' : actName[k] || k);
    const typeOf = (r) => (r.isIngredient ? 'sous-recette' : (r.format?.isResaleProduct ? 'revente' : 'produit fini'));
    const allergensOf = (r) => computeFormatAllergens(r.format, recipeSources).map(k => ALLERGEN_NAME[k] || k);
    const sheets = [];

    // ---------- colonnes communes aux feuilles « format » ----------
    const fmtCols = [
        C('format_id', 'format_id', 'in', 'text', 'Identifiant interne du format ; il relie toutes les feuilles entre elles.'),
        C('produit_id', 'produit_id', 'in', 'text', 'Identifiant interne du produit ; une sous-recette peut être référencée par cet identifiant ou par celui de son format.'),
        C('sku', 'sku', 'in', 'text', 'Code SKU du format (onglet Produits et SKUs).'),
        C('produit', 'produit', 'in', 'text', 'Nom du produit, avec son format.'),
        C('activite', 'activité', 'in', 'text', 'Activité de production à laquelle le produit est rattaché.'),
        C('type', 'type', 'in', 'text', 'Produit fini, sous-recette (utilisée comme ingrédient d\'une autre recette) ou produit de revente.'),
        C('actif', 'actif', 'in', 'text', 'Oui si le format est actif, c\'est-à-dire inclus dans les analyses.'),
        C('unites', 'unités_par_lot', 'in', 'int', 'Nombre d\'unités produites par la recette.'),
        C('taille', 'taille', 'in', 'num', 'Taille d\'une unité vendue.'),
        C('unite', 'unité', 'in', 'text', 'Unité de la taille.'),
        C('cout_matiere', 'coût_matière_unité', 'calc', 'usd', 'Coût des ingrédients par unité, pertes de stock comprises.'),
        C('cout_emb', 'coût_emballage_unité', 'calc', 'usd', 'Coût de l\'emballage par unité.'),
        C('cout_mo', 'coût_main_d_œuvre_unité', 'calc', 'usd', 'Coût de la main-d\'œuvre de production par unité.'),
        C('cout_sst', 'coût_sous_traitance_unité', 'calc', 'usd', 'Coût de sous-traitance par unité.'),
        C('cout_vieil', 'coût_vieillissement_unité', 'calc', 'usd', 'Coût de vieillissement (immobilisation du produit) par unité.'),
        C('cout_ind', 'coût_frais_fixes_unité', 'calc', 'usd', 'Part des frais fixes répartie sur une unité (Général et activité).'),
        C('cout_revient', 'coût_de_revient_unité', 'calc', 'usd', 'Coût de revient total par unité : somme de toutes les composantes ci-dessus.'),
    ];
    const fmtRow = (r) => ({
        format_id: r.id, produit_id: r.productId ?? null, sku: r.sku ?? null, produit: r.displayName, activite: actName[r.activityId] || null, type: typeOf(r), actif: r.onMenu ? 'oui' : 'non',
        unites: orNull(r.costs?.nbPortions), taille: orNull(r.costs?.portionSize), unite: r.format?.portionUnit || null,
        cout_matiere: orNull(r.costs?.costMatierePerPortion), cout_emb: orNull(r.costs?.costPackagingPerPortion), cout_mo: orNull(r.costs?.costLaborPerPortion),
        cout_sst: orNull(r.costs?.costSubcontractingPerPortion), cout_vieil: orNull(r.costs?.costAgingPerPortion), cout_ind: orNull(r.costs?.costIndirectPerPortion),
        cout_revient: orNull(r.costs?.totalCostPerPortion),
    });
    const marginCols = [
        C('mb_d', 'marge_brute_$', 'calc', 'usd', 'Prix net moins les coûts directs (matière, emballage, main-d\'œuvre), par unité, dans ce canal.'),
        C('mb_p', 'marge_brute_%', 'calc', 'pct', 'Marge brute en pourcentage du prix net.'),
        C('mn_d', 'marge_nette_$', 'calc', 'usd', 'Marge brute moins les frais fixes répartis (Général, activité et canal), par unité, dans ce canal.'),
        C('mn_p', 'marge_nette_%', 'calc', 'pct', 'Marge nette en pourcentage du prix net.'),
        C('mc_d', 'marge_contribution_$', 'calc', 'usd', 'Ce que chaque unité vendue apporte pour couvrir les frais fixes.'),
        C('seuil', 'seuil_de_rentabilité_unités', 'calc', 'int', 'Unités à vendre dans ce canal pour couvrir les frais fixes alloués (main-d\'œuvre traitée comme fixe).'),
    ];

    // ---------- Vue unique : format × canal ----------
    const flat = [];
    for (const r of rows) {
        const cbs = r.channelBreakdown?.length ? r.channelBreakdown : [null];
        for (const cb of cbs) flat.push({
            ...fmtRow(r), allergenes: allergensOf(r).join(', ') || null, canal_id: cb?.channelId ?? null, canal: cb?.channelName ?? null, prix: orNull(cb?.netPrice), volume: orNull(cb?.volume),
            frais_canal: orNull(cb?.costIndirectChannelPerPortion), mb_d: orNull(cb?.margeBruteDollar), mb_p: orNull(cb?.margeBrutePercent), mn_d: orNull(cb?.margeNetteDollar), mn_p: orNull(cb?.margeNettePercent),
            mc_d: orNull(cb?.margeContributionDollar), seuil: orNull(cb?.breakEvenUnits),
        });
    }
    sheets.push(sheet('Base_à_plat', 'Vue unique',
        'Tout ce qui touche un format et son canal de vente sur une seule feuille : une ligne par format et par canal. Les informations du format se répètent sur chaque ligne de canal : ne jamais additionner une colonne du format ici (utiliser la feuille Formats).',
        [...fmtCols, C('allergenes', 'allergènes', 'calc', 'text', 'Allergènes du format, déduits de ses ingrédients (ou saisis pour un produit de revente).'),
            C('canal_id', 'canal_id', 'in', 'text', 'Identifiant interne du canal de vente.'), C('canal', 'canal', 'in', 'text', 'Nom du canal de vente.'),
            C('prix', 'prix_net', 'in', 'usd', 'Prix net reçu par l\'entreprise pour ce format dans ce canal.'), C('volume', 'volume', 'in', 'int', 'Volume vendu dans ce canal sur la période.'),
            C('frais_canal', 'frais_fixes_canal_unité', 'calc', 'usd', 'Frais fixes propres à ce canal, répartis par unité.'), ...marginCols], flat));

    // ---------- Produits ----------
    sheets.push(sheet('Formats', 'Produits', 'Une ligne par format, sans répétition. Les marges sont des moyennes pondérées par les volumes de tous les canaux.',
        [...fmtCols, C('mb_d', 'marge_brute_moyenne_$', 'calc', 'usd', 'Marge brute par unité, moyenne pondérée par les volumes de tous les canaux.'),
            C('mb_p', 'marge_brute_moyenne_%', 'calc', 'pct', 'Marge brute moyenne en pourcentage du prix.'), C('vol', 'volume_total', 'calc', 'int', 'Volume vendu, tous canaux confondus.')],
        rows.map(r => ({ ...fmtRow(r), mb_d: orNull(r.blended?.margeBruteDollar), mb_p: orNull(r.blended?.margeBrutePercent), vol: orNull(r.blended?.totalVolume) }))));

    const L = { ing: [], pkg: [], step: [] };
    for (const r of rows) {
        const product = products.find(x => x.id === r.productId) || r;
        const lines = calculateCostLines(product, g, recipeSources, products, labor, r.format, packaging) || { ingredients: [], packaging: [], steps: [] };
        lines.ingredients.forEach(l => L.ing.push({ format_id: r.id, produit: r.displayName, ing_id: l.id, ing: l.name, qte: orNull(l.quantity), unite: l.unit || null, rend: l.yieldPercent == null ? null : l.yieldPercent / 100, base: orNull(l.baseCost), perte: orNull(l.lossCost), total: orNull(l.finalCost), matiere: orNull(l.matiereCost) }));
        lines.packaging.forEach(l => L.pkg.push({ format_id: r.id, produit: r.displayName, pkg_id: l.id, pkg: l.name, qte: orNull(l.quantity), unite: l.unit || null, base: orNull(l.baseCost), perte: orNull(l.lossCost), total: orNull(l.finalCost) }));
        lines.steps.forEach((l, i) => L.step.push({ format_id: r.id, produit: r.displayName, ordre: i + 1, etape: l.name, postes: (l.postIds || []).join(', ') || null, duree: orNull(l.durationSeconds), direct: orNull(l.directCost), total: orNull(l.totalCost) }));
    }
    const head = [C('format_id', 'format_id', 'in', 'text', 'Identifiant du format (voir la feuille Formats).'), C('produit', 'produit', 'in', 'text', 'Nom du produit, avec son format.')];
    sheets.push(sheet('Lignes_recette', 'Produits', 'Une ligne par ingrédient de chaque recette (une sous-recette utilisée comme ingrédient y figure aussi).',
        [...head, C('ing_id', 'ingrédient_id', 'in', 'text', 'Identifiant de l\'ingrédient (feuille Ingrédients) ou du format de la sous-recette.'), C('ing', 'ingrédient', 'in', 'text', 'Nom de l\'ingrédient.'),
            C('qte', 'quantité', 'in', 'num', 'Quantité utilisée dans la recette.'), C('unite', 'unité_recette', 'in', 'text', 'Unité de la quantité.'), C('rend', 'rendement_%', 'in', 'pct', 'Rendement : part utilisable de l\'ingrédient après parage ou cuisson.'),
            C('base', 'coût_de_base', 'calc', 'usd', 'Coût de la quantité utilisée, avant pertes.'), C('perte', 'coût_de_la_perte', 'calc', 'usd', 'Coût de la perte de stock rattachée à cette ligne.'), C('total', 'coût_total_ligne', 'calc', 'usd', 'Coût de base plus perte, pour la recette entière. Pour une sous-recette, il comprend aussi son emballage et sa main-d\'œuvre.'),
            C('matiere', 'dont_coût_matière', 'calc', 'usd', 'Part de la ligne comptée dans le coût matière du format (égale au coût total, sauf pour une sous-recette dont seule la part matière est ici).')], L.ing));
    sheets.push(sheet('Lignes_emballage', 'Produits', 'Une ligne par article d\'emballage de chaque format.',
        [...head, C('pkg_id', 'emballage_id', 'in', 'text', 'Identifiant de l\'emballage (feuille Emballages).'), C('pkg', 'emballage', 'in', 'text', 'Nom de l\'emballage.'), C('qte', 'quantité', 'in', 'num', 'Quantité utilisée pour la recette.'),
            C('unite', 'unité', 'in', 'text', 'Unité de la quantité.'), C('base', 'coût_de_base', 'calc', 'usd', 'Coût de la quantité utilisée, avant pertes.'), C('perte', 'coût_de_la_perte', 'calc', 'usd', 'Coût de la perte d\'emballage.'),
            C('total', 'coût_total_ligne', 'calc', 'usd', 'Coût de base plus perte, pour la recette entière.')], L.pkg));
    sheets.push(sheet('Étapes_production', 'Produits', 'Une ligne par étape du processus de production de chaque format.',
        [...head, C('ordre', 'ordre', 'in', 'int', 'Rang de l\'étape dans le processus.'), C('etape', 'étape', 'in', 'text', 'Nom de l\'étape.'), C('postes', 'postes', 'in', 'text', 'Postes de production affectés à l\'étape.'),
            C('duree', 'durée_secondes', 'in', 'int', 'Durée de l\'étape, en secondes.'), C('direct', 'coût_direct', 'calc', 'usd', 'Coût de la main-d\'œuvre de l\'étape, pour la recette entière.'),
            C('total', 'coût_total', 'calc', 'usd', 'Coût direct plus la part de temps non productif absorbée.')], L.step));
    const al = [];
    rows.forEach(r => allergensOf(r).forEach(n => al.push({ format_id: r.id, produit: r.displayName, allergene: n })));
    sheets.push(sheet('Allergènes', 'Produits', 'Une ligne par format et par allergène présent : prête pour un tableau croisé dynamique.',
        [...head, C('allergene', 'allergène', 'calc', 'text', 'Allergène présent, déduit des ingrédients de la recette.')], al));

    // ---------- Ventes ----------
    const linkType = (t) => (t === 'markup' ? 'majoration' : 'marge');
    sheets.push(sheet('Canaux', 'Ventes', 'Canaux de vente et intermédiaires de la cascade de prix (une ligne par intermédiaire ; un canal direct a une ligne sans intermédiaire).',
        [C('canal_id', 'canal_id', 'in', 'text', 'Identifiant interne du canal.'), C('canal', 'canal', 'in', 'text', 'Nom du canal.'), C('lien', 'intermédiaire', 'in', 'text', 'Intermédiaire entre l\'entreprise et le consommateur.'),
            C('type', 'type', 'in', 'text', 'Marge (sur le prix de vente de l\'intermédiaire) ou majoration (sur son coût d\'entrée).'), C('pct', 'pourcentage', 'in', 'pct', 'Pourcentage appliqué par l\'intermédiaire.')],
        channels.flatMap(c => (c.links?.length ? c.links : [null]).map(l => ({ canal_id: c.id, canal: c.name, lien: l ? (l.name || null) : null, type: l ? linkType(l.type) : null, pct: l ? frac(l.percent) : null })))));
    sheets.push(sheet('Activités', 'Ventes', 'Activités de production.',
        [C('id', 'activité_id', 'in', 'text', 'Identifiant interne de l\'activité.'), C('nom', 'activité', 'in', 'text', 'Nom de l\'activité.'), C('cle', 'méthode_de_répartition_des_frais_fixes', 'in', 'text', 'Méthode qui répartit les frais fixes de l\'activité entre ses produits.')],
        activities.map(x => ({ id: x.id, nom: x.name, cle: indirectCostMethodLabels[x.indirectCostDriver] || null }))));

    // ---------- Intrants ----------
    const abcOf = (data) => { const m = {}; ['A', 'B', 'C'].forEach(k => (data?.[k] || []).forEach(i => { m[i.name] = k; })); return m; };
    const buyOf = (report) => { const m = {}; Object.values(report?.groupedByProvider || {}).flatMap(x => x.items || []).forEach(i => { m[i.id] = i; }); return m; };
    const ingAbc = abcOf(a.abcAnalysisData), ingBuy = buyOf(a.purchasingReportData), pkgAbc = abcOf(a.packagingAbcAnalysisData), pkgBuy = buyOf(a.packagingPurchasingReportData);
    const itemCols = (kind) => [
        C('id', `${kind}_id`, 'in', 'text', 'Identifiant interne.'), C('nom', kind, 'in', 'text', 'Nom dans le catalogue.'), C('four', 'fournisseur', 'in', 'text', 'Fournisseur.'),
        C('fmt', 'format_d_achat', 'in', 'num', 'Quantité contenue dans un format d\'achat.'), C('unite', 'unité', 'in', 'text', 'Unité du format d\'achat.'), C('prix', 'prix_d_achat', 'in', 'usd', 'Prix d\'un format d\'achat.'),
        C('pu', 'prix_unitaire', 'calc', 'usd', 'Prix par unité (prix d\'achat divisé par le format d\'achat).'), C('perte', 'perte_%', 'in', 'pct', 'Taux de perte de stock prévu.'), C('maj', 'dernière_MàJ', 'in', 'text', 'Date de la dernière mise à jour du prix.'),
    ];
    const buyCols = [
        C('qte', 'quantité_achetée', 'calc', 'num', 'Quantité à acheter pour la production de la période, pertes comprises.'), C('cout', 'coût_total_achats', 'calc', 'usd', 'Coût des achats de la période, pertes comprises.'),
        C('cperte', 'dont_perte', 'calc', 'usd', 'Part du coût d\'achat qui correspond à la perte de stock.'), C('abc', 'classe_ABC', 'calc', 'text', 'Classe de Pareto : A pour les éléments qui pèsent le plus dans les achats, puis B, puis C.'),
    ];
    const itemRow = (i, buy, abc) => ({ id: i.id, nom: i.name, four: i.provider || null, fmt: num(i.purchaseFormat), unite: i.unit || null, prix: num(i.purchasePrice), pu: num(i.unitPrice), perte: frac(i.lossPercentage), maj: i.lastUpdated || null,
        qte: orNull(buy[i.id]?.totalQuantity), cout: orNull(buy[i.id]?.totalCost), cperte: orNull(buy[i.id]?.lossCost), abc: abc[i.name] ?? null });
    sheets.push(sheet('Ingrédients', 'Intrants', 'Catalogue des ingrédients et achats de la période.',
        [...itemCols('ingrédient'), C('alg', 'allergènes', 'in', 'text', 'Allergènes déclarés pour cet ingrédient.'), ...buyCols],
        catalog.map(i => ({ ...itemRow(i, ingBuy, ingAbc), alg: (i.allergens || []).map(k => ALLERGEN_NAME[k] || k).join(', ') || null }))));
    sheets.push(sheet('Emballages', 'Intrants', 'Catalogue des emballages et achats de la période.', [...itemCols('emballage'), ...buyCols], packaging.map(i => itemRow(i, pkgBuy, pkgAbc))));

    // ---------- Main-d'œuvre et frais ----------
    const MO = 'Main-d\'œuvre et frais';
    sheets.push(sheet('Employés', MO, 'Une ligne par employé.',
        [C('id', 'employé_id', 'in', 'text', 'Identifiant interne.'), C('poste', 'poste', 'in', 'text', 'Poste de production.'), C('nom', 'employé', 'in', 'text', 'Nom de l\'employé.'),
            C('taux', 'taux_horaire', 'in', 'usd', 'Salaire horaire.'), C('ch', 'charges_%', 'in', 'pct', 'Charges sociales de l\'employeur.'), C('vac', 'vacances_%', 'in', 'pct', 'Vacances.'),
            C('prod', 'temps_productif_%', 'in', 'pct', 'Part du temps payé consacrée à la production.'), C('h', 'heures', 'in', 'num', 'Heures payées sur la période.'),
            C('charge', 'taux_horaire_chargé', 'calc', 'usd', 'Salaire horaire avec charges et vacances.'), C('total', 'coût_total', 'calc', 'usd', 'Taux horaire chargé multiplié par les heures payées.')],
        labor.flatMap(post => (post.employees || []).map(e => ({ id: e.id, poste: post.postName, nom: e.employeeName || null, taux: num(e.hourlyRate), ch: frac(e.socialCharges), vac: frac(e.vacationPercentage), prod: frac(e.productiveTimePercentage),
            h: num(e.workedHours), charge: loadedHourlyRate(e), total: loadedHourlyRate(e) * (num(e.workedHours) || 0) })))));
    sheets.push(sheet('Postes', MO, 'Utilisation de la capacité de chaque poste de production.',
        [C('poste', 'poste', 'in', 'text', 'Poste de production.'), C('attendu', 'heures_productives_disponibles', 'calc', 'num', 'Heures payées multipliées par le temps productif.'),
            C('reel', 'heures_utilisées', 'calc', 'num', 'Heures nécessaires pour produire les volumes vendus.'), C('util', 'utilisation_%', 'calc', 'pct', 'Heures utilisées divisées par les heures disponibles.')],
        (g.productivityReport?.rows || []).map(r => ({ poste: r.postName, attendu: orNull(r.expected), reel: orNull(r.actual), util: r.utilization == null ? null : r.utilization / 100 }))));

    const keyLabel = (key) => {
        const k = key || 'manual';
        if (k === 'manual') return 'Manuelle';
        if (k === 'sales') return 'Selon les ventes';
        if (k === 'directCosts') return 'Selon les charges directes';
        if (k.startsWith(REPARTITION_ACTIVITY_PREFIX)) return `Une seule activité : ${bucketName(k.slice(REPARTITION_ACTIVITY_PREFIX.length))}`;
        if (k.startsWith(REPARTITION_CHANNEL_PREFIX)) return `Un seul canal : ${chName[k.slice(REPARTITION_CHANNEL_PREFIX.length)] || k.slice(REPARTITION_CHANNEL_PREFIX.length)}`;
        if (k.startsWith(REPARTITION_CUSTOM_PREFIX)) return `Clé personnalisée : ${(repartitionKeys.find(x => x.id === k.slice(REPARTITION_CUSTOM_PREFIX.length)) || {}).name || 'sans nom'}`;
        return k;
    };
    sheets.push(sheet('Frais_fixes', MO, 'Une ligne par frais fixe.',
        [C('id', 'frais_id', 'in', 'text', 'Identifiant interne.'), C('label', 'libellé', 'in', 'text', 'Description du frais.'), C('cat', 'catégorie', 'in', 'text', 'Catégorie de frais.'),
            C('montant', 'montant', 'in', 'usd', 'Montant sur la période.'), C('cle', 'clé_de_répartition', 'in', 'text', 'Comment le frais est réparti entre les activités et les canaux (détail dans Frais_répartition).')],
        expenseLines.map(e => ({ id: e.id, label: e.label || null, cat: e.category || null, montant: num(e.amount), cle: keyLabel(e.repartitionKey) }))));
    // Répartition effective : la même que celle de l'écran État des résultats (computeIndirectPools expose celle qu'il a utilisée).
    const pools = computeIndirectPools(rows, { expenseLines, repartitionKeys, revenueLines, directCostLines, productionActivities: activities, salesChannels: channels, generalInfo: p.generalInfo || {} });
    const alloc = pools.effectiveAllocations || {};
    sheets.push(sheet('Frais_répartition', MO, 'Où va chaque frais fixe : une ligne par frais et par activité (ou canal) qui en reçoit une part.',
        [C('id', 'frais_id', 'in', 'text', 'Identifiant du frais (feuille Frais_fixes).'), C('label', 'libellé', 'in', 'text', 'Description du frais.'), C('cible_type', 'cible_type', 'calc', 'text', 'Activité ou canal qui reçoit la part.'),
            C('cible', 'cible', 'calc', 'text', 'Nom de l\'activité ou du canal ; « Général » pour la part qui soutient toute l\'entreprise.'), C('montant', 'montant', 'calc', 'usd', 'Montant du frais attribué à cette cible.')],
        expenseLines.flatMap(e => [
            ...Object.entries(alloc[e.id]?.activityAllocations || {}).map(([k, v]) => ({ id: e.id, label: e.label || null, cible_type: 'activité', cible: bucketName(k), montant: num(v) })),
            ...Object.entries(alloc[e.id]?.channelAllocations || {}).map(([k, v]) => ({ id: e.id, label: e.label || null, cible_type: 'canal', cible: chName[k] || k, montant: num(v) })),
        ])));
    sheets.push(sheet('Revenus', MO, 'Revenus de l\'état des résultats : une ligne par montant et par activité.',
        [C('id', 'revenu_id', 'in', 'text', 'Identifiant interne.'), C('label', 'libellé', 'in', 'text', 'Description du revenu.'), C('cible', 'activité', 'in', 'text', 'Activité à laquelle le revenu est rattaché ; « Général » si aucune.'), C('montant', 'montant', 'in', 'usd', 'Montant sur la période.')],
        revenueLines.flatMap(r => Object.entries(r.amounts || {}).filter(([, v]) => num(v) != null).map(([k, v]) => ({ id: r.id, label: r.label || null, cible: bucketName(k), montant: num(v) })))));
    sheets.push(sheet('Coûts_directs', MO, 'Coûts directs de l\'état des résultats.',
        [C('id', 'coût_id', 'in', 'text', 'Identifiant interne.'), C('label', 'libellé', 'in', 'text', 'Description du coût.'), C('cat', 'catégorie', 'in', 'text', 'Catégorie de coût direct.'), C('montant', 'montant', 'in', 'usd', 'Montant sur la période.')],
        directCostLines.map(d => ({ id: d.id, label: d.label || null, cat: d.category || null, montant: num(d.amount) }))));

    // ---------- Suivi dans le temps ----------
    const series = computeGlobalSeries(points);
    const pctOf = (v) => (v == null || Number.isNaN(v) ? null : v / 100);
    sheets.push(sheet('Suivi_global', 'Suivi dans le temps', 'Une ligne par point de référence (relevé).',
        [C('date', 'date', 'in', 'text', 'Date du relevé.'), C('nom', 'relevé', 'in', 'text', 'Nom du relevé.'), C('rev', 'revenus', 'in', 'usd', 'Revenus de la période du relevé.'), C('ind', 'frais_fixes', 'in', 'usd', 'Frais fixes de la période du relevé.'),
            C('mat', 'coût_matière_moyen', 'calc', 'pct', 'Coût matière moyen pondéré par les revenus.'), C('emb', 'coût_emballage_moyen', 'calc', 'pct', 'Coût d\'emballage moyen pondéré.'), C('mo', 'coût_main_d_œuvre_moyen', 'calc', 'pct', 'Coût de main-d\'œuvre moyen pondéré.'),
            C('mb', 'marge_brute_moyenne', 'calc', 'pct', 'Marge brute moyenne pondérée.'), C('pm', 'point_mort_global', 'calc', 'usd', 'Chiffre d\'affaires nécessaire pour couvrir les frais fixes.')],
        points.map((t, i) => ({ date: String(t.timestamp || '').slice(0, 10) || null, nom: t.name || null, rev: num(t.generalInfo?.totalRevenue), ind: num(t.generalInfo?.totalIndirects),
            mat: pctOf(series[i]?.['Coût Matière Moyen']), emb: pctOf(series[i]?.['Coût Emballage Moyen']), mo: pctOf(series[i]?.["Coût Main-d'œuvre Moyen"]), mb: pctOf(series[i]?.['Marge Brute Moyenne']), pm: orNull(series[i]?.['Point Mort Global']) }))));
    sheets.push(sheet('Suivi_formats', 'Suivi dans le temps', 'Une ligne par relevé et par format : l\'historique de chaque produit. Les marges sont vides quand le format n\'avait pas de prix.',
        [C('date', 'date', 'in', 'text', 'Date du relevé.'), C('format_id', 'format_id', 'in', 'text', 'Identifiant du format.'), C('produit', 'produit', 'in', 'text', 'Nom du produit, avec son format.'), C('prix', 'prix_de_vente', 'in', 'usd', 'Prix de vente au moment du relevé.'),
            C('cout', 'coût_de_revient_unité', 'calc', 'usd', 'Coût de revient par unité au moment du relevé.'), C('mb', 'marge_brute_%', 'calc', 'pct', 'Marge brute en pourcentage du prix.'), C('mn', 'marge_nette_%', 'calc', 'pct', 'Marge nette en pourcentage du prix.')],
        points.flatMap(t => (t.productsWithCosts || []).filter(r => !r.isIngredient).map(r => {
            const priced = (num(r.prixVente) || 0) > 0;
            return { date: String(t.timestamp || '').slice(0, 10) || null, format_id: r.id, produit: r.displayName, prix: priced ? num(r.prixVente) : null, cout: orNull(r.costs?.totalCostPerPortion), mb: priced ? orNull(r.costs?.margeBrutePercent) : null, mn: priced ? orNull(r.costs?.margeNettePercent) : null };
        }))));

    // ---------- Accompagnement ----------
    const dict = sheets.flatMap(sh => sh.cols.map(c => ({ feuille: sh.name, colonne: c.label, nature: c.kind === 'in' ? 'saisi' : 'calculé', format: { usd: 'dollars', pct: 'pourcentage (fraction)', int: 'entier', num: 'nombre', text: 'texte' }[c.fmt], def: c.def })));
    sheets.push(sheet('Dictionnaire', 'Accompagnement', 'Une ligne par colonne de chaque feuille : ce qu\'elle contient, si elle est saisie ou calculée, et son type.',
        [C('feuille', 'feuille', 'meta', 'text', ''), C('colonne', 'colonne', 'meta', 'text', ''), C('nature', 'nature', 'meta', 'text', ''), C('format', 'type_de_valeur', 'meta', 'text', ''), C('def', 'définition', 'meta', 'text', '')], dict));
    const readme = [
        { a: 'Entreprise', b: p.companyName || null }, { a: 'Période de référence', b: p.generalInfo?.startDate ? `${p.generalInfo.startDate} au ${p.generalInfo.endDate}` : null }, { a: 'Date de l\'export', b: exportDate || todayLocalISO() },
        { a: 'Comment lire ce fichier', b: 'Une feuille par type d\'objet ; une ligne par objet ; la ligne 1 est l\'en-tête. Les feuilles se relient par leurs identifiants (format_id, ingrédient_id, canal_id…).' },
        { a: 'En-têtes bleus', b: 'Valeur saisie dans l\'application.' }, { a: 'En-têtes gris', b: 'Valeur calculée par l\'application : elle découle des valeurs saisies.' },
        { a: 'Pourcentages', b: 'Stockés en fractions (0,308 pour 30,8 %) et affichés en pourcentage.' }, { a: 'Cellule vide', b: 'Donnée absente ou sans objet. Une donnée absente n\'est jamais remplacée par 0.' },
        { a: 'Vue d\'ensemble', b: 'Commencer par Base_à_plat (un format dans un canal par ligne). Pour additionner des coûts de format, utiliser Formats ; pour le détail des recettes, Lignes_recette, Lignes_emballage et Étapes_production.' },
        { a: 'Dictionnaire', b: 'Définit chaque colonne de chaque feuille.' },
        ...sheets.filter(s => s.name !== 'Dictionnaire').map(s => ({ a: `Feuille ${s.name}`, b: s.desc })),
    ];
    sheets.unshift(sheet('Lisez-moi', 'Accompagnement', '', [C('a', 'Rubrique', 'meta', 'text', ''), C('b', 'Contenu', 'meta', 'text', '')], readme));
    return { sheets, exportDate: exportDate || todayLocalISO() };
}
