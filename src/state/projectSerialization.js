// Sérialisation d'un projet (sauvegarde/chargement JSON), extraite de App.jsx pour être testable
// isolément. C'est ici que vit la logique de rétrocompatibilité (migration des anciens formats,
// valeurs par défaut des champs ajoutés après coup) — exactement le genre de code qui casse en
// silence. buildProjectData/parseProjectData sont des fonctions pures ; App.jsx ne garde que les
// effets de bord (Blob/download, FileReader, setters d'état).

import { buildDefaultFormat, stripFormatOwnedFields } from './initialState.js';
import { EXPENSE_CATEGORIES, sumLineAmounts, parseLocaleNumber } from '../utils.js';

// Un contenant ('general' ou l'id d'une activité) revalidé contre les activités réellement
// présentes : une activité supprimée depuis la sauvegarde ne doit jamais laisser une référence
// orpheline — repli sur 'general', jamais un montant perdu en silence (voir `revenueLines`
// ci-dessous, qui refond les montants plutôt que de les jeter).
const reconcileBucket = (bucketKey, productionActivities) =>
    (bucketKey === 'general' || productionActivities.some(a => a.id === bucketKey)) ? bucketKey : 'general';

// Construit l'objet exporté vers le fichier .json à partir de l'état courant.
export function buildProjectData({ companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings }) {
    return { companyName, logoUrl, generalInfo, baseIngredients, basePackaging, products, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, uiSettings };
}

// Reconstruit les tranches d'état à partir des données JSON chargées, en appliquant migrations et
// valeurs par défaut. `emptyState` fournit les valeurs de repli (getEmptyState()). Ne touche à
// aucun état React : retourne un objet que l'appelant applique via ses setters.
export function parseProjectData(data, emptyState) {
    const companyName = data.companyName || emptyState.companyName;
    const logoUrl = data.logoUrl || emptyState.logoUrl;

    const generalInfo = { ...emptyState.generalInfo, ...data.generalInfo };
    // Projets antérieurs à l'ajout du champ menuRevenuePercentage : on force 100 % (menu entier).
    if (data.generalInfo && data.generalInfo.menuRevenuePercentage === undefined) {
        generalInfo.menuRevenuePercentage = 100;
    }
    // Migration (21/10) : « salesAllocation » retiré des méthodes d'attribution de Général — se
    // réduisait mathématiquement toujours à un partage égal à l'unité (voir initialState.js,
    // indirectCostMethodLabels). Un projet antérieur qui l'avait choisi retombe sur le nouveau
    // défaut, « directCost » — jamais une valeur orpheline qui ne correspondrait plus à aucune
    // option du sélecteur.
    if (generalInfo.indirectCostMethod === 'salesAllocation') {
        generalInfo.indirectCostMethod = 'directCost';
    }

    // Migration (Phase 4.1) : l'ancien `generalInfo.totalIndirects` saisi à plat devient une liste
    // de lignes de dépense catégorisées. Un projet antérieur reçoit une seule ligne migrée (son
    // montant exact, catégorisée par défaut en "Frais généraux de production" — modifiable
    // ensuite) ; un projet déjà sur `expenseLines` est préservé tel quel, jamais régénéré. Dans
    // les deux cas, `totalIndirects` est recalculé comme la somme exacte des lignes juste après
    // (jamais ressaisi indépendamment) pour qu'il ne puisse pas dériver de la liste qui le compose.
    const expenseLinesRaw = (data.expenseLines && data.expenseLines.length > 0)
        ? data.expenseLines
        : (data.generalInfo?.totalIndirects > 0
            ? [{ id: 'exp_migre', label: 'Frais indirects (migré)', category: EXPENSE_CATEGORIES[0], amount: data.generalInfo.totalIndirects }]
            : []);
    generalInfo.totalIndirects = sumLineAmounts(expenseLinesRaw);

    const uiSettings = { ...emptyState.uiSettings, ...data.uiSettings };

    const trackingPoints = (data.trackingPoints || []).map(point => ({
        ...point,
        // Rétrocompatibilité : nom/note absents des anciens points de référence.
        name: point.name || new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
        note: point.note || ''
    }));

    let laborDatabase = data.laborDatabase || [];
    // Migration depuis l'ancien format « à plat » (liste d'employés sans regroupement par poste).
    if (laborDatabase.length > 0 && laborDatabase[0].employees === undefined) {
        const postsMap = new Map();
        laborDatabase.forEach(employee => {
            const postName = employee.postName || 'Non défini';
            if (!postsMap.has(postName)) {
                postsMap.set(postName, { id: `post_${Date.now()}_${postName}`, postName, employees: [] });
            }
            postsMap.get(postName).employees.push({ ...employee, id: employee.id || `emp_${Date.now()}_${Math.random()}` });
        });
        laborDatabase = Array.from(postsMap.values());
    }

    // Migration : projets antérieurs à l'ajout des activités de production (ligne de fabrication).
    // Toujours au moins une activité par défaut ("Général"), pour que l'étape suivante (rattacher
    // chaque produit à une activité) ait toujours une valeur de repli.
    // `indirectCostDriver` (Phase 4.6) : une activité antérieure à cette phase retombe sur
    // « directCost » (coût direct combiné — le driver par défaut le plus défendable, voir
    // 04-Conception-Modele.md section Phase 4.6), jamais une valeur absente qui romprait le calcul.
    const productionActivities = (data.productionActivities && data.productionActivities.length > 0)
        ? data.productionActivities.map(a => ({ ...a, indirectCostDriver: a.indirectCostDriver || 'directCost' }))
        : emptyState.productionActivities;

    // Migration : projets antérieurs à l'ajout des Circuits de vente (Phase 3) — un seul circuit
    // par défaut (« Vente directe », sans maillon), qui collapse au comportement historique à prix
    // unique (voir `initialState.js`). Pas de driver à migrer ici (Phase 4.6) : un canal n'en a
    // jamais eu — son pool se convertit toujours en majoration sur le coût de production.
    const salesChannels = (data.salesChannels && data.salesChannels.length > 0)
        ? data.salesChannels
        : emptyState.salesChannels;

    // Unités de mesure activées (19/10) : un projet sauvegardé avant cette fonctionnalité n'a
    // jamais `activeUnits` — retombe sur les 5 historiques (emptyState.activeUnits, dérivées de
    // DEFAULT_ACTIVE_UNITS), même repli "longueur-gardée" que salesChannels/productionActivities
    // ci-dessus, jamais un tableau vide qui masquerait toutes les unités partout dans l'app.
    const activeUnits = (data.activeUnits && data.activeUnits.length > 0)
        ? data.activeUnits
        : emptyState.activeUnits;

    // Clés de répartition personnalisées (Phase 4.5bis, 14/10) : gabarits % réutilisables, un axe
    // Activités et un axe Canaux par clé, chacun optionnel. Comme pour `activityAllocations`, une
    // part d'activité orpheline (activité supprimée depuis la sauvegarde) refond dans Général plutôt
    // que d'être perdue ; une part de canal orpheline est conservée telle quelle (même asymétrie que
    // channelAllocations — aucun contenant neutre équivalent côté canal).
    const repartitionKeys = (data.repartitionKeys || []).map((k) => {
        const rawActivityShares = k.activityShares || {};
        const activityShares = {};
        for (const [key, pct] of Object.entries(rawActivityShares)) {
            const reconciled = reconcileBucket(key, productionActivities);
            activityShares[reconciled] = (activityShares[reconciled] || 0) + parseLocaleNumber(pct);
        }
        return { id: k.id, name: k.name || '', activityShares, channelShares: k.channelShares || {} };
    });
    const repartitionKeyIds = new Set(repartitionKeys.map((k) => k.id));

    // Clé de répartition (par ligne de frais fixes) revalidée : une sélection directe d'activité
    // (`activity:<id>`) refond sur une activité supprimée vers `activity:general`, comme pour
    // `activityAllocations` ; une sélection de canal (`channel:<id>`) ou une clé personnalisée
    // (`custom:<id>`) devenue orpheline retombe sur `manual` — pas d'équivalent neutre côté canal,
    // et une clé personnalisée supprimée n'a plus de définition à appliquer.
    const reconcileRepartitionKey = (key) => {
        if (!key || key === 'manual' || key === 'sales' || key === 'directCosts') return key || 'manual';
        if (key.startsWith('activity:')) return `activity:${reconcileBucket(key.slice('activity:'.length), productionActivities)}`;
        if (key.startsWith('channel:')) return salesChannels.some((c) => c.id === key.slice('channel:'.length)) ? key : 'manual';
        if (key.startsWith('custom:')) return repartitionKeyIds.has(key.slice('custom:'.length)) ? key : 'manual';
        return 'manual';
    };

    // Frais fixes (Phase 4.5) : allocation à trois contenants sur deux axes indépendants —
    // `activityAllocations` (Général + activités, même espace de contenants que revenueLines) et
    // `channelAllocations` (axe séparé, pas de contenant « Général » équivalent — voir
    // 04-Conception-Modele.md, section 1 : Général est une allocation directe à une seule étape,
    // pas symétrique à Activité/Canal). Une ligne antérieure à la 4.5 reçoit simplement des objets
    // vides (rien à répartir pour l'instant, pas une erreur). Un id d'activité orphelin (activité
    // supprimée depuis la sauvegarde) refond son montant dans Général, comme pour revenueLines —
    // jamais perdu. Un id de canal orphelin est conservé tel quel : aucun contenant neutre
    // équivalent côté canal, mais le montant reste compté dans la vérification de la ligne, juste
    // sans colonne visible pour ce canal disparu.
    const expenseLines = expenseLinesRaw.map(line => {
        const rawActivityAllocations = line.activityAllocations || {};
        const activityAllocations = {};
        for (const [key, amount] of Object.entries(rawActivityAllocations)) {
            const reconciled = reconcileBucket(key, productionActivities);
            activityAllocations[reconciled] = (activityAllocations[reconciled] || 0) + parseLocaleNumber(amount);
        }
        return {
            ...line,
            repartitionKey: reconcileRepartitionKey(line.repartitionKey),
            activityAllocations,
            channelAllocations: line.channelAllocations || {},
        };
    });

    // Revenus réels (Phase 4.2, révisé le 13/10 — « Saisie manuelle ») : une liste absente devient
    // simplement vide. Deux générations à couvrir :
    //  1. Phase 4.2 initiale : `{ bucket, amount }` à plat, un seul contenant par ligne.
    //  2. Depuis le 13/10 : `{ repartition, amounts }` — `repartition` = contenant choisi (Général,
    //     une activité précise, ou 'manual' pour une ventilation libre) ; `amounts` porte le ou les
    //     montants réels par contenant (plusieurs clés seulement en mode manuel).
    // Chaque contenant est revalidé contre les activités réellement présentes ; un contenant
    // orphelin (activité supprimée depuis la sauvegarde) refond son montant dans Général plutôt que
    // de le perdre.
    const revenueLines = (data.revenueLines || []).map(line => {
        const hasNewShape = line.amounts !== undefined;
        const rawAmounts = hasNewShape ? line.amounts : { [line.bucket || 'general']: line.amount };
        const rawRepartition = hasNewShape ? line.repartition : (line.bucket || 'general');

        const amounts = {};
        for (const [bucketKey, amount] of Object.entries(rawAmounts || {})) {
            const reconciled = reconcileBucket(bucketKey, productionActivities);
            amounts[reconciled] = (amounts[reconciled] || 0) + parseLocaleNumber(amount);
        }
        const repartition = rawRepartition === 'manual' ? 'manual' : reconcileBucket(rawRepartition, productionActivities);

        return { id: line.id, label: line.label || '', repartition, amounts };
    });
    // Charges directes réelles (Phase 4.3) : même patron que `expenseLines`, catégorisées par type
    // de coût (voir utils.js, DIRECT_COST_TYPES) — champ entièrement nouveau, pas de migration à
    // écrire, une liste absente devient simplement vide.
    const directCostLines = data.directCostLines || [];

    const baseIngredients =(data.baseIngredients || data.ingredientsList || emptyState.ingredientsList).map(ing => ({
        ...ing,
        uniqueId: ing.uniqueId || '',
        isRecipe: ing.isRecipe || false,
        id: String(ing.id || `manual_${Date.now()}_${Math.random()}`),
        lossPercentage: ing.lossPercentage || 0,
        lastUpdated: ing.lastUpdated || new Date().toISOString().split('T')[0]
    }));

    // Migration : projets antérieurs à l'ajout du Packaging (Phase 2) — catalogue vide par défaut.
    const basePackaging = (data.basePackaging || emptyState.basePackaging || []).map(pkg => ({
        ...pkg,
        uniqueId: pkg.uniqueId || '',
        id: String(pkg.id || `pkg_${Date.now()}_${Math.random()}`),
        lossPercentage: pkg.lossPercentage || 0,
        lastUpdated: pkg.lastUpdated || new Date().toISOString().split('T')[0]
    }));

    const products = (data.products || emptyState.products).map(p => {
        const normalized = {
            ...p,
            id: String(p.id || Date.now() + Math.random()),
            isResaleProduct: p.isResaleProduct || false,
            purchaseCost: p.purchaseCost || 0,
            category: p.category || '',
            // Migration : produits antérieurs à l'ajout des activités de production — rattachés à
            // la première activité disponible (« Général » par défaut).
            activityId: p.activityId || productionActivities[0]?.id || '',
            portionSize: p.portionSize !== undefined ? p.portionSize : 1,
            portionUnit: p.portionUnit || 'unité',
            isIngredient: p.isIngredient || false,
            onMenu: p.onMenu !== undefined ? p.onMenu : true,
            salesMix: p.salesMix !== undefined ? p.salesMix : 0,
            prixVente: p.prixVente !== undefined ? p.prixVente : 0,
            nbPortions: p.nbPortions || 1,
            indirectCosts: p.indirectCosts || { method: 'time', fixedAmount: 0, percentSalesAmount: 0, percentDirectAmount: 0, portionsSold: 100 },
            ingredients: (p.ingredients || []).map(ing => ({ ...ing, rowId: ing.rowId || `ing_${Date.now()}_${Math.random()}`, yieldPercentage: ing.yieldPercentage || 100 })),
            productionSteps: (p.productionSteps || []).map(step => ({ ...step, stepId: step.stepId || `step_${Date.now()}_${Math.random()}` })),
            labor: undefined // Supprime l'ancienne clé
        };
        // Migration : produits antérieurs à la notion de format de vente — un format par défaut
        // est construit à partir des champs "à plat" déjà normalisés ci-dessus (prixVente,
        // nbPortions, ingredients, productionSteps...).
        //
        // Trois générations de fichiers à couvrir :
        //  1. Avant la Phase 1.3 (pas de `formats` du tout) : `buildDefaultFormat(normalized)`
        //     construit le premier format à partir des champs à plat ci-dessus.
        //  2. Phases 1.3-1.5 (`formats` existe, mais chaque format ne portait encore que les
        //     champs de vente — pas encore les ingrédients/étapes/revente, qui vivaient alors sur
        //     le produit) : on complète le format par défaut (index 0 seulement) avec ces champs
        //     à plat s'il ne les a pas déjà.
        //  3. Après la correction du 23/09 (chaque format porte déjà sa propre fiche recette
        //     complète) : ses champs sont utilisés tels quels.
        normalized.formats = (p.formats && p.formats.length > 0)
            ? p.formats.map((f, index) => ({
                ...f,
                ingredients: (f.ingredients !== undefined ? f.ingredients : (index === 0 ? normalized.ingredients : []) || [])
                    .map(ing => ({ ...ing, rowId: ing.rowId || `ing_${Date.now()}_${Math.random()}`, yieldPercentage: ing.yieldPercentage || 100 })),
                // Phase 2.2 : concept entièrement nouveau, pas de génération antérieure à couvrir —
                // un format sans packagingItems reçoit simplement un catalogue vide.
                packagingItems: (f.packagingItems || []).map(item => ({ ...item, rowId: item.rowId || `pkgitem_${Date.now()}_${Math.random()}` })),
                productionSteps: (f.productionSteps !== undefined ? f.productionSteps : (index === 0 ? normalized.productionSteps : []) || [])
                    .map(step => ({ ...step, stepId: step.stepId || `step_${Date.now()}_${Math.random()}` })),
                isResaleProduct: f.isResaleProduct !== undefined ? f.isResaleProduct : (index === 0 ? normalized.isResaleProduct : false),
                purchaseCost: f.purchaseCost !== undefined ? f.purchaseCost : (index === 0 ? normalized.purchaseCost : 0),
                manualAllergens: f.manualAllergens !== undefined ? f.manualAllergens : (index === 0 ? (p.manualAllergens || []) : []),
                // Migration : projets antérieurs à la Phase 3.2 — un seul prix net sur le canal par
                // défaut, reprenant l'ancien prixVente (comportement inchangé). Le PREMIER élément
                // du tableau reste le canal "principal" dont le prix alimente le prixVente du
                // format (voir App.jsx, handleFormatChannelPricesChange).
                channelPrices: (f.channelPrices && f.channelPrices.length > 0) ? f.channelPrices : [{
                    id: `cp_${f.id || `${Date.now()}_${Math.random()}`}`,
                    channelId: 'channel_default',
                    netPrice: f.prixVente !== undefined ? f.prixVente : (index === 0 ? normalized.prixVente : 0),
                    volume: 0,
                }],
            }))
            : [buildDefaultFormat(normalized)];
        return stripFormatOwnedFields(normalized);
    });

    return { companyName, logoUrl, generalInfo, uiSettings, trackingPoints, laborDatabase, productionActivities, salesChannels, activeUnits, expenseLines, revenueLines, directCostLines, repartitionKeys, baseIngredients, basePackaging, products };
}
