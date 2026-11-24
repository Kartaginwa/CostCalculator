// Vérifications de cohérence du projet (Phase 7, 18/11) : regroupe à un seul endroit des problèmes
// de données qui, autrement, n'apparaissent que dans l'onglet concerné. Fonction pure — aucune
// donnée n'est modifiée ; chaque constat dit où aller pour le corriger (`tab`).
import { parseLocaleNumber, isNotEmpty, isValidNumber, formatNumber, areUnitsCompatible } from '../utils.js';
import { findRecipeLoops } from './usage.js';

const STALE_DAYS = 30;

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Les noms des 3 premiers éléments concernés, puis « et N autres » — assez pour retrouver le problème sans noyer le panneau.
const listNames = (names) => {
    const unique = [...new Set(names.filter(Boolean))];
    if (unique.length <= 3) return unique.join(', ');
    const rest = unique.length - 3;
    return `${unique.slice(0, 3).join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
};

// Les contrôles de références (ingrédients, emballages, activités, canaux, relevés) ne s'exécutent que si l'appelant
// fournit les listes correspondantes : une liste absente (`undefined`) veut dire « pas d'information », jamais « liste vide ».
export function computeProjectChecks({
    products = [], baseIngredients, basePackaging, productionActivities, salesChannels, trackingPoints, fixedCosts = null, now = new Date(),
}) {
    const checks = [];
    const formatsOf = (p) => (p.formats && p.formats.length > 0 ? p.formats : [p]);
    const nameOf = (p) => (isNotEmpty(p.platName) ? p.platName : 'Sans nom');

    const unnamed = products.filter(p => !isNotEmpty(p.platName)).length;
    if (unnamed > 0) {
        checks.push({ id: 'unnamed-products', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${unnamed} produit${unnamed > 1 ? 's' : ''} sans nom.` });
    }

    const menuFormats = products.flatMap(p => formatsOf(p).filter(f => f.onMenu).map(f => ({ p, f })));

    const noPrice = menuFormats.filter(({ f }) =>
        !(parseLocaleNumber(f.prixVente) > 0) && !(f.channelPrices || []).some(cp => parseLocaleNumber(cp.netPrice) > 0));
    if (noPrice.length > 0) {
        checks.push({ id: 'no-sale-price', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${noPrice.length} SKU${noPrice.length > 1 ? 's' : ''} actif${noPrice.length > 1 ? 's' : ''} sans prix de vente\u00A0: leurs marges ne peuvent pas être calculées.` });
    }

    // Volume vendu à 0 $ (20/11, audit) : gardé dans les chiffres comme un produit offert (marge négative) ; à confirmer.
    const soldAtZero = menuFormats.filter(({ f }) => (f.channelPrices || []).some(cp => parseLocaleNumber(cp.volume) > 0 && !(parseLocaleNumber(cp.netPrice) > 0)));
    if (soldAtZero.length > 0) {
        checks.push({ id: 'sold-at-zero', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${plural(soldAtZero.length, 'SKU a', 'SKUs ont')} un volume vendu à un prix net de 0\u00A0$ (${listNames(soldAtZero.map(({ p }) => nameOf(p)))})\u00A0: ces unités comptent comme offertes (marge négative). Si c'est un oubli, saisissez le prix net.` });
    }

    // Aucun volume vendu (20/11, audit) : sans volume, aucun frais fixe ne peut être réparti sur ce SKU — son coût complet est incomplet
    // et sa marge, trop belle. Un « % des ventes » seul ne suffit pas : il faut un nombre d'unités vendues.
    const noVolume = menuFormats.filter(({ f }) => !((f.channelPrices || []).some(cp => parseLocaleNumber(cp.volume) > 0)) && !(parseLocaleNumber(f.indirectCosts?.portionsSold) > 0));
    if (noVolume.length > 0) {
        checks.push({ id: 'no-volume', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${plural(noVolume.length, "SKU actif n'a", "SKUs actifs n'ont")} aucun volume vendu (${listNames(noVolume.map(({ p }) => nameOf(p)))})\u00A0: aucun frais fixe ne leur est réparti, leur coût complet est incomplet et leur marge surévaluée. Saisissez les unités vendues par canal.` });
    }

    if (menuFormats.length > 0) {
        const totalMix = menuFormats.reduce((sum, { f }) => sum + parseLocaleNumber(f.salesMix), 0);
        if (Math.round(totalMix) !== 100) {
            checks.push({ id: 'sales-mix', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
                message: totalMix > 0
                    ? `La répartition des ventes des SKUs actifs totalise ${formatNumber(totalMix, 1)}\u00A0% au lieu de 100\u00A0%\u00A0: les moyennes pondérées sont faussées.`
                    : 'La répartition des ventes des SKUs actifs n\'est pas renseignée : les moyennes pondérées ne sont pas fiables.' });
        }
    }

    // Frais fixes mal répartis (19/11) : ce qu'aucune ligne n'attribue à un contenant est compté dans Général
    // (jamais perdu) ; un dépassement gonfle les coûts. Dans les deux cas l'utilisateur doit le savoir.
    if (fixedCosts && fixedCosts.unallocated > 0) {
        checks.push({ id: 'fixed-costs-unallocated', tab: 'income-statement', tabLabel: 'État des résultats → Frais fixes',
            message: `${formatNumber(fixedCosts.unallocated, 2)}\u00A0$ de frais fixes ne sont répartis dans aucune activité ni aucun canal\u00A0: ils sont comptés dans «\u00A0Général\u00A0».` });
    }
    if (fixedCosts && fixedCosts.overAllocated > 0) {
        checks.push({ id: 'fixed-costs-over-allocated', tab: 'income-statement', tabLabel: 'État des résultats → Frais fixes',
            message: `Les frais fixes répartis dépassent le total saisi de ${formatNumber(fixedCosts.overAllocated, 2)} $\u00A0: les coûts par produit sont surévalués.` });
    }

    // --- Intégrité des données (19/11, audit complémentaire) : des erreurs que le calcul absorbe sans les signaler. ---
    const everyFormat = products.flatMap(p => formatsOf(p).map(f => ({ p, f })));
    const recipeFormats = everyFormat.filter(({ f }) => !f.isResaleProduct);

    // Boucle de sous-recettes (20/11, audit) : A utilise B qui utilise A. Le coût de ces recettes n'est pas défini.
    const loops = findRecipeLoops(products);
    if (loops.length > 0) {
        checks.push({ id: 'recipe-loop', tab: 'recipe', tabLabel: 'Production',
            message: `${plural(loops.length, 'boucle de sous-recettes', 'boucles de sous-recettes')}\u00A0: ${loops.map(l => l.join(' ↔ ')).join(' ; ')}. Une recette ne peut pas se contenir elle-même, même par plusieurs étapes\u00A0: le coût de ces recettes est faux. Retirez l'une des lignes concernées.` });
    }

    // Quantité produite par lot absente (20/11, audit) : remplacée par 1, donc le coût du lot ENTIER est attribué à une seule portion.
    const noBatchSize = recipeFormats.filter(({ f }) => !f.yieldGrid?.enabled && !(parseLocaleNumber(f.nbPortions) > 0));
    if (noBatchSize.length > 0) {
        checks.push({ id: 'batch-size', tab: 'recipe', tabLabel: 'Production',
            message: `${plural(noBatchSize.length, 'format n\'a', 'formats n\'ont')} pas de quantité produite par lot (${listNames(noBatchSize.map(({ p }) => nameOf(p)))})\u00A0: elle est comptée comme 1, donc le coût du lot entier est attribué à une seule portion.` });
    }

    // Quantité négative dans une recette (20/11, audit) : elle retrancherait un coût au lieu de l'ajouter.
    const negativeQty = recipeFormats.filter(({ f }) => [...(f.ingredients || []), ...(f.packagingItems || [])].some(row => parseLocaleNumber(row.quantity) < 0));
    if (negativeQty.length > 0) {
        checks.push({ id: 'negative-quantity', tab: 'recipe', tabLabel: 'Production',
            message: `${plural(negativeQty.length, 'recette contient', 'recettes contiennent')} une quantité négative (${listNames(negativeQty.map(({ p }) => nameOf(p)))})\u00A0: elle retranche un coût au lieu de l'ajouter.` });
    }

    // Valeur saisie illisible (23/11, audit) : le calcul lit une saisie malformée comme 0 ou en retire les caractères inattendus,
    // sans rien signaler. Seule une valeur TEXTE non vide est jugée (un champ vide reste « absent », un nombre n'a pas de format) ;
    // le signe « - » n'est pas jugé ici (les quantités négatives ont leur propre contrôle).
    const isUnreadable = (v) => typeof v === 'string' && isNotEmpty(v) && !isValidNumber(v.replace(/^\s*-/, ''));
    const recipeRows = (f) => [...(f.ingredients || []), ...(f.packagingItems || [])];
    const unreadableQty = recipeFormats.filter(({ f }) => recipeRows(f).some(row => isUnreadable(row.quantity)));
    if (unreadableQty.length > 0) {
        checks.push({ id: 'unreadable-quantity', tab: 'recipe', tabLabel: 'Production',
            message: `${plural(unreadableQty.length, 'recette contient', 'recettes contiennent')} une quantité illisible (${listNames(unreadableQty.map(({ p }) => nameOf(p)))})\u00A0: la valeur saisie peut être lue de travers ou comptée comme 0.` });
    }
    const unreadablePrice = [...(baseIngredients || []), ...(basePackaging || [])].filter(i => !i.isRecipe && isUnreadable(i.purchasePrice));
    if (unreadablePrice.length > 0) {
        checks.push({ id: 'unreadable-price', tab: 'ingredients', tabLabel: 'Ingrédients / Emballage',
            message: `${plural(unreadablePrice.length, 'article a', 'articles ont')} un prix d'achat illisible (${listNames(unreadablePrice.map(i => i.name))})\u00A0: la valeur saisie peut être lue de travers ou comptée comme 0\u00A0$.` });
    }
    // Rendement saisi à 0 (ou illisible) : le calcul l'ignore, comme si aucun rendement n'était indiqué (champ vide = 100 %).
    const zeroYield = recipeFormats.filter(({ f }) => (f.ingredients || []).some(row => isNotEmpty(row.yieldPercentage) && !(parseLocaleNumber(row.yieldPercentage) > 0)));
    if (zeroYield.length > 0) {
        checks.push({ id: 'yield-zero', tab: 'recipe', tabLabel: 'Production',
            message: `${plural(zeroYield.length, 'recette contient', 'recettes contiennent')} un rendement de 0\u00A0% ou illisible (${listNames(zeroYield.map(({ p }) => nameOf(p)))})\u00A0: il est ignoré dans le calcul, comme si aucun rendement n'était indiqué.` });
    }

    if (Array.isArray(baseIngredients)) {
        const subRecipes = products.filter(p => p.isIngredient);
        // Même résolution que calculateCosts : l'id d'une ligne désigne un FORMAT de sous-recette, ou (anciens projets) un produit.
        const subRecipeFormat = (id) => {
            for (const sp of subRecipes) {
                const match = (sp.formats || []).find(sf => sf.id === id);
                if (match) return match;
            }
            const byProduct = subRecipes.find(sp => sp.id === id);
            return byProduct ? (byProduct.formats?.[0] || byProduct) : null;
        };
        const missing = [];
        const incompatible = [];
        for (const { p, f } of recipeFormats) {
            for (const row of (f.ingredients || [])) {
                const base = baseIngredients.find(i => i.id === row.id);
                const sub = base ? null : subRecipeFormat(row.id);
                if (!base && !sub) { missing.push(p); continue; }
                const stockUnit = base ? base.unit : sub.portionUnit;
                if (row.recipeUnit && stockUnit && !areUnitsCompatible(row.recipeUnit, stockUnit)) incompatible.push(p);
            }
        }
        if (missing.length > 0) {
            checks.push({ id: 'missing-references', tab: 'recipe', tabLabel: 'Production',
                message: `${plural(missing.length, 'ligne de recette fait', 'lignes de recette font')} référence à un ingrédient ou une sous-recette qui n'existe plus (${listNames(missing.map(nameOf))}) : ${missing.length > 1 ? 'elles sont comptées' : 'elle est comptée'} à 0\u00A0$.` });
        }
        if (incompatible.length > 0) {
            checks.push({ id: 'unit-mismatch', tab: 'recipe', tabLabel: 'Production',
                message: `${plural(incompatible.length, 'ligne de recette utilise', 'lignes de recette utilisent')} une unité d'une autre famille que celle de l'ingrédient, par exemple des grammes pour un ingrédient en litres (${listNames(incompatible.map(nameOf))})\u00A0: la conversion suppose une densité de 1, et le coût est faux si elle est différente.` });
        }
    }
    if (Array.isArray(basePackaging)) {
        const affected = [];
        for (const { p, f } of everyFormat) {
            for (const row of (f.packagingItems || [])) {
                if (!basePackaging.some(i => i.id === row.id)) affected.push(p);
            }
        }
        if (affected.length > 0) {
            checks.push({ id: 'missing-packaging', tab: 'recipe', tabLabel: 'Production',
                message: `${plural(affected.length, 'ligne d\'emballage fait', 'lignes d\'emballage font')} référence à un emballage qui n'existe plus (${listNames(affected.map(nameOf))}) : ${affected.length > 1 ? 'elles sont comptées' : 'elle est comptée'} à 0\u00A0$.` });
        }
    }
    const hugeLoss = (list) => (Array.isArray(list) ? list.filter(i => !i.isRecipe && parseLocaleNumber(i.lossPercentage) >= 100) : []);
    const lossItems = [...hugeLoss(baseIngredients), ...hugeLoss(basePackaging)];
    if (lossItems.length > 0) {
        checks.push({ id: 'loss-100', tab: 'ingredients', tabLabel: 'Ingrédients / Emballage',
            message: `${plural(lossItems.length, 'article a', 'articles ont')} un pourcentage de perte de 100\u00A0% ou plus (${listNames(lossItems.map(i => i.name))})\u00A0: la perte est ignorée dans le calcul.` });
    }

    const withDuplicateChannel = everyFormat.filter(({ f }) => {
        const ids = (f.channelPrices || []).map(cp => cp.channelId);
        return new Set(ids).size !== ids.length;
    });
    if (withDuplicateChannel.length > 0) {
        checks.push({ id: 'duplicate-channel', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${plural(withDuplicateChannel.length, 'SKU est rattaché', 'SKUs sont rattachés')} deux fois au même canal de vente (${listNames(withDuplicateChannel.map(({ p }) => nameOf(p)))})\u00A0: les volumes sont comptés en double.` });
    }
    if (Array.isArray(salesChannels)) {
        const channelIds = new Set(salesChannels.map(c => c.id));
        const withMissingChannel = everyFormat.filter(({ f }) => (f.channelPrices || []).some(cp => !channelIds.has(cp.channelId)));
        if (withMissingChannel.length > 0) {
            checks.push({ id: 'missing-channel', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
                message: `${plural(withMissingChannel.length, 'SKU garde', 'SKUs gardent')} des prix et des volumes pour un canal de vente supprimé (${listNames(withMissingChannel.map(({ p }) => nameOf(p)))})\u00A0: ces ventes ne sont comptées nulle part.` });
        }
    }
    if (Array.isArray(productionActivities)) {
        const activityIds = new Set(productionActivities.map(a => a.id));
        const orphans = products.filter(p => !activityIds.has(p.activityId));
        if (orphans.length > 0) {
            checks.push({ id: 'missing-activity', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
                message: `${plural(orphans.length, 'produit est lié', 'produits sont liés')} à une activité de production qui n'existe plus (${listNames(orphans.map(nameOf))})\u00A0: choisissez une activité dans sa fiche.` });
        }
    }
    const badPortion = everyFormat.filter(({ f }) => !(parseLocaleNumber(f.portionSize) > 0));
    if (badPortion.length > 0) {
        checks.push({ id: 'portion-size', tab: 'info', tabLabel: 'Paramètres → Produits et SKUs',
            message: `${plural(badPortion.length, 'format a', 'formats ont')} une quantité nulle ou vide (${listNames(badPortion.map(({ p }) => nameOf(p)))})\u00A0: elle est remplacée par 1 dans certains calculs.` });
    }
    if (Array.isArray(trackingPoints) && trackingPoints.length > 0) {
        const legacy = trackingPoints.filter(pt => (pt.productsWithCosts || []).some(r => r.onMenu && !(r.channelBreakdown && r.channelBreakdown.length > 0)));
        if (legacy.length > 0) {
            checks.push({ id: 'legacy-snapshots', tab: 'summary', tabLabel: 'Rapport et suivi',
                message: `${plural(legacy.length, 'point de référence a été enregistré', 'points de référence ont été enregistrés')} sans le détail par canal\u00A0: leur point mort et leurs moyennes sont approximatifs et ne se comparent pas exactement aux points récents.` });
        }
    }

    const ingredientsList = baseIngredients || [];
    const packagingList = basePackaging || [];
    const missingPrice = (list) => list.filter(i => !i.isRecipe && !(parseLocaleNumber(i.purchasePrice) > 0)).length;
    const stale = (list) => {
        const limit = new Date(now); limit.setDate(limit.getDate() - STALE_DAYS);
        return list.filter(i => !i.isRecipe && i.lastUpdated && new Date(i.lastUpdated) < limit).length;
    };

    const ingNoPrice = missingPrice(ingredientsList);
    if (ingNoPrice > 0) checks.push({ id: 'ingredients-no-price', tab: 'ingredients', tabLabel: 'Ingrédients',
        message: `${plural(ingNoPrice, 'ingrédient', 'ingrédients')} sans prix d'achat.` });
    const pkgNoPrice = missingPrice(packagingList);
    if (pkgNoPrice > 0) checks.push({ id: 'packaging-no-price', tab: 'packaging', tabLabel: 'Emballage',
        message: `${plural(pkgNoPrice, 'emballage', 'emballages')} sans prix d'achat.` });

    const ingStale = stale(ingredientsList);
    if (ingStale > 0) checks.push({ id: 'ingredients-stale', tab: 'ingredients', tabLabel: 'Ingrédients',
        message: `${plural(ingStale, 'ingrédient', 'ingrédients')} dont le prix n'a pas été mis à jour depuis plus de ${STALE_DAYS} jours.` });
    const pkgStale = stale(packagingList);
    if (pkgStale > 0) checks.push({ id: 'packaging-stale', tab: 'packaging', tabLabel: 'Emballage',
        message: `${plural(pkgStale, 'emballage', 'emballages')} dont le prix n'a pas été mis à jour depuis plus de ${STALE_DAYS} jours.` });

    return checks;
}
