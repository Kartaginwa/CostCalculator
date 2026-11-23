// Données générales CALCULÉES du projet : heures de main-d'œuvre nécessaires (par poste, activité et format), productivité de la cuisine et rapport de
// productivité (par poste et par activité). Extrait de App.jsx le 22/11 (phase 4 de la refonte de l'export PDF) pour que l'application et le rapport PDF
// lisent le MÊME calcul. Aucune règle n'a changé.
import { parseLocaleNumber, loadedHourlyRate } from '../utils.js';
import { computeLaborHoursNeeded } from './laborHours.js';

export function computeCalculatedGeneralInfo({ generalInfo, products, baseIngredients, laborDatabase, productionActivities, salesChannels }) {
    // Paie totale chargée de tous les postes (coût payé, utilisé ou non).
    const autoCalculatedLaborCost = laborDatabase.reduce((total, post) => {
        const postTotal = (post.employees || []).reduce((sum, emp) => {
            const paidHours = parseLocaleNumber(emp.workedHours);
            return sum + (paidHours * loadedHourlyRate(emp));
        }, 0);
        return total + postTotal;
    }, 0);
        // Volumes RÉELS par canal (corrigé le 18/10, confirmé le 19/10 — voir
        // Projet_Claude/03-Feuille-de-route.md, addendum du 19/10) : plus de reconstruction à
        // partir du revenu déclaré (`totalRevenue`, réel) — ce serait mélanger les deux jeux de
        // données que la Réconciliation réel/théorique doit garder indépendants. Repli direct sur
        // `fmt.channelPrices[].volume`, la même donnée réelle que `channelBreakdown` utilise déjà
        // dans analysisData.js. Un format sans aucun volume réel saisi contribue 0 heure de MO
        // nécessaire (jamais une estimation fabriquée) — conséquence acceptée : la productivité
        // cuisine et le rapport de productivité restent à 0 tant qu'aucune vente réelle n'est
        // saisie par canal pour ce format.
        // Les heures nécessaires viennent de `computeLaborHoursNeeded` (engine/laborHours.js) : les ventes de chaque format
        // actif ET ce que les autres recettes consomment de leurs sous-recettes, même jamais vendues seules (19/11 : avant,
        // le temps de fabrication d'une sous-recette non vendue n'était compté nulle part). Par poste, par activité de
        // production (celle de la recette qui la fabrique) et au total.
        const {
            byPost: totalDirectLaborHoursNeededByPost,
            byActivity: totalDirectLaborHoursNeededByActivity,
            total: totalDirectLaborHoursNeeded,
            hoursByFormat: laborHoursByFormat,
        } = computeLaborHoursNeeded(products, baseIngredients, salesChannels);

        // TOUS les postes de l'onglet Main-d'œuvre doivent se retrouver dans le coût des produits (décision du 19/11) :
        // les heures employées, la capacité inutilisée, le temps non productif (déjà reflété par le « % temps productif
        // attendu » de chaque employé) et même un poste sans aucune étape de recette.
        // Le facteur d'absorption est donc : coût direct des heures nécessaires ÷ masse salariale de TOUS les postes.
        // Chaque recette porte alors sa part de la paie, au prorata de son coût de main-d'œuvre directe : la paie de la
        // cuisine est entièrement répartie sur les produits quand le volume la remplit. La valeur exposée
        // (`kitchenProductivity`) peut dépasser 100 % quand le volume dépasse la paie ; c'est son USAGE qui est plafonné à
        // 100 % (calculateCosts.js) : au-delà, la main-d'œuvre est comptée au taux horaire plein, jamais moins — un surplus de
        // capacité n'enlève pas de coût.
        // Le coût d'un poste est son taux moyen pondéré par les heures payées, comme dans calculateCosts.js.
        const directLaborCostNeeded = laborDatabase.reduce((total, post) => {
            const emps = post.employees || [];
            const hours = emps.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
            if (!(hours > 0)) return total;
            const cost = emps.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours) * loadedHourlyRate(emp), 0);
            return total + (totalDirectLaborHoursNeededByPost[post.postName] || 0) * (cost / hours);
        }, 0);
        const kitchenProductivity = autoCalculatedLaborCost > 0 ? (directLaborCostNeeded / autoCalculatedLaborCost) * 100 : 100;

        const productivityReport = {
            rows: laborDatabase.map(post => {
                const expected = (post.employees || []).reduce((sum, emp) => sum + (parseLocaleNumber(emp.workedHours) * (parseLocaleNumber(emp.productiveTimePercentage) / 100)), 0);
                const actual = totalDirectLaborHoursNeededByPost[post.postName] || 0;
                const difference = expected - actual;
                const utilization = expected > 0 ? (actual / expected) * 100 : 0;
                return { postName: post.postName, expected, actual, difference, utilization };
            }),
            totals: {}
        };
        productivityReport.totals = productivityReport.rows.reduce((acc, row) => {
            acc.expected += row.expected;
            acc.actual += row.actual;
            return acc;
        }, { expected: 0, actual: 0 });
        productivityReport.totals.difference = productivityReport.totals.expected - productivityReport.totals.actual;
        productivityReport.totals.utilization = productivityReport.totals.expected > 0 ? (productivityReport.totals.actual / productivityReport.totals.expected) * 100 : 0;

        // Phase 6 (15/10) : capacité de production PAR ACTIVITÉ (ligne de production) — pas de
        // "expected" par activité (un poste/employé n'est pas rattaché à une seule activité, donc
        // rien à comparer analogue au "expected" par poste) : seulement la part des heures de MO
        // réellement nécessaires que CETTE activité consomme, du total du menu.
        productivityReport.byActivity = productionActivities.map(activity => {
            const actual = totalDirectLaborHoursNeededByActivity[activity.id] || 0;
            const sharePercent = totalDirectLaborHoursNeeded > 0 ? (actual / totalDirectLaborHoursNeeded) * 100 : 0;
            return { activityId: activity.id, activityName: activity.name, actual, sharePercent };
        });

        return {
            ...generalInfo,
            totalKitchenLaborCost: autoCalculatedLaborCost,
            kitchenProductivity: kitchenProductivity,
            productivityReport: productivityReport,
            // Total des heures de MO nécessaires au menu : dénominateur de la méthode d'attribution
            // « temps de production » (taux = frais indirects / ce total → réconcilie exactement).
            totalDirectLaborHoursNeeded: totalDirectLaborHoursNeeded,
            // Heures de main-d'œuvre par format (rentabilité de l'heure par produit, Rapport et suivi → Main-d'œuvre).
            laborHoursByFormat,
        };
}
