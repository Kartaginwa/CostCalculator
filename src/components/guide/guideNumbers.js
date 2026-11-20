// Chiffres des exemples du guide : calculés ici, une seule fois, pour que chaque exemple soit
// arithmétiquement juste (le texte du guide les lit, il ne les recopie jamais à la main) et pour
// qu'un test (guideNumbers.test.js) puisse les vérifier. Les chiffres du PROJET DÉMO, eux, sont
// des valeurs lues à l'écran de l'application : l'e2e `guide-demo-numbers.spec.js` vérifie
// qu'elles s'y trouvent bien.

// --- Partie 1 : exemples génériques ---------------------------------------------------------

// Fabricant de barres protéinées (chapitre « Le coût de revient »)
export const BARRES = (() => {
    const lot = 5000;
    const matieres = 2750;
    const emballage = 900;
    const mo = 4 * 5 * 30; // 4 personnes × 5 h × 30 $/h
    const directLot = matieres + emballage + mo;
    const directUnit = directLot / lot;
    const fixes = { loyer: 7000, electricite: 3000, assurance: 1500, administration: 4500, entretien: 2000 };
    const fixesMois = Object.values(fixes).reduce((a, b) => a + b, 0);
    const volumeMois = 60000;
    const fixesUnit = fixesMois / volumeMois;
    const coutRevient = directUnit + fixesUnit;
    const prix = 1.6;
    const margeBrute = prix - directUnit;
    const margeNette = prix - coutRevient;
    const prixBas = 1.0;
    const perteUnit = coutRevient - prixBas;
    return { lot, matieres, emballage, mo, directLot, directUnit, fixes, fixesMois, volumeMois, fixesUnit, coutRevient,
        prix, margeBrute, margeNette, prixBas, perteUnit, perteMois: perteUnit * volumeMois };
})();

// Embouteillage d'une boisson (chapitre « Les familles de coûts »)
export const BOISSON = (() => {
    const lot = 20000;
    const matieres = 6400;
    const emballage = 0.22 * lot;
    const mo = 3 * 8 * 25; // 3 opérateurs × 8 h × 25 $/h
    const sousTraitance = 1200;
    const total = matieres + emballage + mo + sousTraitance;
    return { lot, matieres, emballage, mo, sousTraitance, total, unit: total / lot };
})();

// Fromage affiné (vieillissement)
export const FROMAGE = (() => {
    const meules = 2000;
    const directs = 40000;
    const tauxAnnuel = 0.08;
    const mois = 6;
    const portage = directs * tauxAnnuel / 12 * mois;
    return { meules, directs, tauxAnnuel, mois, portage, portageParMeule: portage / meules };
})();

// Pertes et rendement (carottes)
export const CAROTTES = (() => {
    const quantite = 10; // kg épluchés nécessaires à la recette
    const prix = 3; // $/kg
    const perte = 0.05;
    const rendement = 0.8;
    const base = quantite * prix;
    const apresPerte = base / (1 - perte);
    const final = apresPerte / rendement;
    return { quantite, prix, perte, rendement, base, apresPerte, final, kgAcheter: quantite / rendement };
})();

// Directs et frais fixes : transformateur laitier à deux activités
export const LAITIER = (() => {
    const pool = { loyer: 9000, electricite: 5000, administration: 4000, assurances: 2000 };
    const poolTotal = Object.values(pool).reduce((a, b) => a + b, 0);
    const directsYogourt = 60000;
    const directsFromage = 40000;
    const part = (d) => d / (directsYogourt + directsFromage);
    const poolYogourt = poolTotal * part(directsYogourt);
    const poolFromage = poolTotal * part(directsFromage);
    const unitsYogourt = 100000;
    const unitsFromage = 20000;
    return { pool, poolTotal, directsYogourt, directsFromage, poolYogourt, poolFromage, unitsYogourt, unitsFromage,
        parPot: poolYogourt / unitsYogourt, parFromage: poolFromage / unitsFromage };
})();

// Fixe ou variable : croustilles
export const CROUSTILLES = (() => {
    const variableUnit = 0.6;
    const fixes = 30000;
    const lignes = [50000, 100000, 200000].map((volume) => {
        const total = fixes + variableUnit * volume;
        return { volume, total, unit: total / volume, fixesUnit: fixes / volume };
    });
    return { variableUnit, fixes, lignes };
})();

// Marges : boisson végétale
export const BOISSON_VEG = (() => {
    const prix = 2.4;
    const matiere = 0.7;
    const emballage = 0.35;
    const mo = 0.25;
    const fixes = 0.55;
    const contribution = prix - matiere;
    const brute = prix - (matiere + emballage + mo);
    const nette = brute - fixes;
    // marge ou majoration
    const cout = 1.2;
    const prixMajore = 1.5;
    const profit = prixMajore - cout;
    return { prix, matiere, emballage, mo, fixes, contribution, brute, nette, cout, prixMajore, profit,
        margeSurPrix: profit / prixMajore, majorationSurCout: profit / cout,
        cout40: 3, prixMajoration40: 3 * 1.4, margeEquivalente40: (3 * 1.4 - 3) / (3 * 1.4),
        prixMarge40: 3 / 0.6, majorationEquivalente40: (3 / 0.6 - 3) / 3 };
})();

// Canaux : cascade de maillons (prix en rayon 12 $)
export const CASCADE = (() => {
    const pds = 12;
    const margeDetaillant = 0.3;
    const prixAuDetaillant = pds * (1 - margeDetaillant);
    const majorationDistributeur = 0.12;
    const prixNetProducteur = prixAuDetaillant / (1 + majorationDistributeur);
    return { pds, margeDetaillant, prixAuDetaillant, majorationDistributeur, prixNetProducteur,
        part: prixNetProducteur / pds, margeDetaillantDollar: pds - prixAuDetaillant,
        margeDistributeurDollar: prixAuDetaillant - prixNetProducteur };
})();

// Point mort : pâtes alimentaires
export const PATES = (() => {
    const prix = 3.2;
    const variable = 1.4; // matière + emballage
    const contribution = prix - variable;
    const fixes = 42000;
    const mo = 33000;
    const total = fixes + mo;
    const pointMort = Math.ceil(total / contribution);
    const profit = (volume) => volume * contribution - total;
    return { prix, variable, contribution, fixes, mo, total, pointMort, revenuPointMort: pointMort * prix,
        profit50: profit(50000), perte30: profit(30000) };
})();

// Mix et pondération : trois produits
export const MIX = (() => {
    const produits = [
        { nom: 'Produit A', prix: 4, margeUnit: 2, volume: 20000 },
        { nom: 'Produit B', prix: 10, margeUnit: 3, volume: 5000 },
        { nom: 'Produit C', prix: 6, margeUnit: 1.5, volume: 10000 },
    ].map((p) => ({ ...p, revenu: p.prix * p.volume, margeTotale: p.margeUnit * p.volume, margePct: p.margeUnit / p.prix }));
    const revenu = produits.reduce((s, p) => s + p.revenu, 0);
    const margeTotale = produits.reduce((s, p) => s + p.margeTotale, 0);
    const volumeTotal = produits.reduce((s, p) => s + p.volume, 0);
    const moyenneSimple = produits.reduce((s, p) => s + p.margePct, 0) / produits.length;
    const ponderUnites = produits.reduce((s, p) => s + p.margePct * p.volume / volumeTotal, 0);
    const ponderRevenu = margeTotale / revenu;
    return { produits, revenu, margeTotale, volumeTotal, moyenneSimple, ponderUnites, ponderRevenu };
})();

// Suivi dans le temps : farine, et classement ABC
export const FARINE = (() => {
    const prix = [0.82, 0.85, 0.91, 0.97, 1.02];
    const moyenne = prix.reduce((a, b) => a + b, 0) / prix.length;
    const amplitude = (Math.max(...prix) - Math.min(...prix)) / moyenne;
    const tendance = (prix[prix.length - 1] - prix[0]) / prix[0];
    return { prix, moyenne, amplitude, tendance };
})();

export const ABC = (() => {
    const valeurs = [30000, 20000, 12000, 9000, 7000, 6000, 5000, 4000, 4000, 3000];
    const total = valeurs.reduce((a, b) => a + b, 0);
    let cum = 0;
    const lignes = valeurs.map((v, i) => {
        const avant = (cum / total) * 100;
        cum += v;
        const classe = avant < 70 ? 'A' : avant < 90 ? 'B' : 'C';
        return { rang: i + 1, valeur: v, pct: (v / total) * 100, cumul: (cum / total) * 100, classe };
    });
    const sommePct = (c) => lignes.filter((l) => l.classe === c).reduce((s, l) => s + l.pct, 0);
    const compte = (c) => lignes.filter((l) => l.classe === c).length;
    return { total, lignes, A: { n: compte('A'), pct: sommePct('A') }, B: { n: compte('B'), pct: sommePct('B') }, C: { n: compte('C'), pct: sommePct('C') } };
})();

// Capacité de main-d'œuvre inutilisée
export const CAPACITE = (() => {
    const operateurs = 4;
    const heuresTravaillees = 160; // chacun, pour la période
    const tempsProductif = 0.9;
    const tauxChargeHoraire = 28;
    const disponibles = operateurs * heuresTravaillees * tempsProductif; // heures productives payées
    const necessaires = 432;
    const utilisation = necessaires / disponibles;
    const heuresPayees = operateurs * heuresTravaillees;
    // Taux d'absorption (19/11) : heures nécessaires ÷ heures PAYÉES. Toute la paie se retrouve dans le coût des produits.
    const tauxAbsorption = necessaires / heuresPayees;
    const coutDirect = necessaires * tauxChargeHoraire;
    const coutAbsorbe = coutDirect / tauxAbsorption;
    const heuresNonProductives = heuresPayees - disponibles;
    const heuresInutilisees = disponibles - necessaires;
    return { operateurs, heuresTravaillees, tempsProductif, tauxChargeHoraire, disponibles, necessaires, utilisation, coutDirect,
        heuresPayees, tauxAbsorption, coutAbsorbe, majorationHoraire: tauxChargeHoraire / tauxAbsorption, heuresNonProductives, heuresInutilisees,
        coutNonProductif: heuresNonProductives * tauxChargeHoraire, coutInutilise: heuresInutilisees * tauxChargeHoraire,
        masseSalariale: heuresPayees * tauxChargeHoraire, masseSalarialeProductive: disponibles * tauxChargeHoraire };
})();

// Où saisir la main-d'œuvre : cuisiniers dans le modèle, gérant et loyer hors modèle
export const DOUBLE_COMPTAGE = (() => {
    const cuisiniers = 60000;
    const loyer = 24000;
    const gerant = 50000;
    const correct = loyer + gerant;
    const erreur = correct + cuisiniers;
    return { cuisiniers, loyer, gerant, correct, erreur };
})();

// Ingrédient du projet démo : unité d'achat et prix efficace
export const BOEUF = (() => {
    const format = 5; // kg
    const prixAchat = 48.75;
    const perte = 0.08;
    const prixUnitaire = prixAchat / format;
    const prixEfficace = prixUnitaire / (1 - perte);
    return { format, prixAchat, perte, prixUnitaire, prixEfficace };
})();

// Salaire chargé : Hugo, cuisinier du projet démo (22 $/h, charges 16 %, vacances 4 %)
export const SALAIRE = (() => {
    const taux = 22;
    const charges = 0.16;
    const vacances = 0.04;
    const charge = taux * (1 + charges) * (1 + vacances);
    return { taux, charges, vacances, charge };
})();

// --- Projet démo : valeurs lues À L'ÉCRAN (format de l'application : point décimal) -------------
// Vérifiées par e2e/guide-demo-numbers.spec.js : si le projet démo change, ce test échoue et le
// guide doit être mis à jour.
export const DEMO = {
    // Production — Chili con carne mijoté (format 400 g, lot de 20 unités, canal « Vente directe »)
    chili: {
        coutMatiere: '2.66 $', coutEmballage: '0.58 $', coutMO: '0.58 $', coutProduction: '3.82 $',
        baseMatiere: '50.52 $', pertesMatiere: '2.75 $', baseEmballage: '11.40 $', pertesEmballage: '0.15 $',
        totalMatiereRecette: '53.27 $', totalEmballageRecette: '11.55 $', totalMORecette: '11.59 $',
        moDirectRecette: '8.81 $', moIndirectRecette: '2.78 $',
        prixVente: '7.64 $', margeContribution: '4.98$ / 65.14%', margeBrute: '3.82$ / 50.00%', pointMort: '791 unités',
        coutMatierePct: '34.86%',
    },
    // Rapport — Par SKU, Chili con carne mijoté
    bySku: {
        pds: '8.49 $', margeEpicier: '2.55 $', margeDetaillant: '2.72 $', majorationDistribution: '0.62 $',
        prixEpiceries: '5.94 $', prixGrandesSurfaces: '5.15 $',
        margeNetteDirecte: '17.11 %', margeNetteEpiceries: '-1.98 %', margeNetteGrandesSurfaces: '-10.49 %',
        fraisFixesGeneral: '0.68 $', fraisFixesActivite: '0.76 $', fraisFixesCanalDirecte: '1.08 $',
        pointMortDirecte: '791 unités', pointMortEpiceries: '1337 unités', pointMortGrandesSurfaces: '1981 unités',
    },
    // État des résultats
    etat: { revenus: '80 000.00 $', chargesDirectes: '48 000.00 $', beneficeBrut: '32 000.00 $', fraisFixes: '28 000.00 $', beneficeNet: '4 000.00 $',
        revenusTheorique: '75 366.10 $', chargesDirectesTheorique: '48 057.25 $', beneficeBrutTheorique: '27 308.85 $', beneficeNetTheorique: '-775.95 $' },
    // Main-d'œuvre
    mo: { coutCuisinier: '26.16 $/h', utilisation: '85.76 %', heuresAttendues: '302.38 h', heuresReelles: '259.31 h' },
    // Ingrédients
    ingredients: { abcA: '70.4% des coûts', coutNet: '23 218.67 $', pertes: '1 056.75 $', achatRequis: '24 275.42 $' },
    // Rapport — Vue d'ensemble
    apercu: { coutMatiere: '42.01 %', coutEmballage: '8.64 %', coutMO: '11.21 %', margeBrute: '36.23 %', pointMortMenu: '76 822.83 $' },
};

// Chaînes que le guide cite et qui doivent s'afficher à l'écran du projet démo, par écran.
// Utilisé par e2e/guide-demo-numbers.spec.js (clé = écran à ouvrir).
export const DEMO_SCREEN_CHECKS = {
    'recipe:Chili con carne mijoté': [
        DEMO.chili.coutMatiere, DEMO.chili.coutEmballage, DEMO.chili.coutMO, DEMO.chili.coutProduction, DEMO.chili.totalMatiereRecette,
        DEMO.chili.totalEmballageRecette, DEMO.chili.totalMORecette, DEMO.chili.moDirectRecette, DEMO.chili.moIndirectRecette,
        DEMO.chili.baseMatiere, DEMO.chili.pertesMatiere, DEMO.chili.baseEmballage, DEMO.chili.pertesEmballage,
        DEMO.chili.prixVente, DEMO.chili.margeContribution, DEMO.chili.margeBrute, DEMO.chili.pointMort, DEMO.chili.coutMatierePct,
        '21.7 min', '7.56%', '7.58%',
    ],
    'summary:Par SKU': [
        DEMO.bySku.pds, DEMO.bySku.margeEpicier, DEMO.bySku.margeDetaillant, DEMO.bySku.majorationDistribution, DEMO.bySku.prixEpiceries,
        DEMO.bySku.prixGrandesSurfaces, DEMO.bySku.margeNetteDirecte, DEMO.bySku.margeNetteEpiceries, DEMO.bySku.margeNetteGrandesSurfaces,
        DEMO.bySku.fraisFixesGeneral, DEMO.bySku.fraisFixesActivite, DEMO.bySku.fraisFixesCanalDirecte,
        DEMO.bySku.pointMortDirecte, DEMO.bySku.pointMortEpiceries, DEMO.bySku.pointMortGrandesSurfaces,
    ],
    'income-statement': [
        DEMO.etat.revenus, DEMO.etat.chargesDirectes, DEMO.etat.beneficeBrut, DEMO.etat.fraisFixes, DEMO.etat.beneficeNet,
        DEMO.etat.revenusTheorique, DEMO.etat.chargesDirectesTheorique, DEMO.etat.beneficeBrutTheorique, DEMO.etat.beneficeNetTheorique,
        '2 308.33 $', '472.12 $', '219.54 $', '+4 633.90 $', '+6.1 %', '-57.25 $', '-0.1 %', '+4 691.15 $', '+17.2 %', '+4 775.95 $', '+615.5 %',
    ],
    labor: [
        DEMO.mo.coutCuisinier, DEMO.mo.utilisation, DEMO.mo.heuresAttendues, DEMO.mo.heuresReelles,
        '91.74 %', '89.99 %', '86.67 %', '171.67 h', '66.20 %', '87.63 h', '33.80 %',
    ],
    ingredients: [DEMO.ingredients.abcA, DEMO.ingredients.coutNet, DEMO.ingredients.pertes, DEMO.ingredients.achatRequis],
    "summary:Vue d'ensemble": [DEMO.apercu.coutMatiere, DEMO.apercu.coutEmballage, DEMO.apercu.coutMO, DEMO.apercu.margeBrute, DEMO.apercu.pointMortMenu],
};

// --- Chiffres supplémentaires du projet démo cités dans la Partie 3 (rapports) ----------------------
export const DEMO_RAPPORT = {
    bySkuDetail: {
        revenuDirecte: '1 222.40 $', revenuEpiceries: '2 257.20 $', revenuGrandesSurfaces: '5 665.00 $',
        fraisTotauxDirecte: '1 013.21 $', fraisTotauxEpiceries: '2 301.93 $', fraisTotauxGrandesSurfaces: '6 259.00 $',
        resultatDirecte: '209.19 $', resultatEpiceries: '-44.73 $', resultatGrandesSurfaces: '-594.00 $',
        beneficeBrutDirecte: '3.82 $', beneficeBrutEpiceries: '2.12 $', beneficeBrutGrandesSurfaces: '1.33 $',
        margeBruteDirecte: '50.00 %', margeBruteEpiceries: '35.69 %', margeBruteGrandesSurfaces: '25.82 %',
        fraisFixesTotalDirecte: '2.51 $', fraisFixesTotalEpiceries: '2.24 $', fraisFixesTotalGrandesSurfaces: '1.87 $',
        fraisFixesCanalEpiceries: '0.80 $', fraisFixesCanalGrandesSurfaces: '0.44 $',
        coutNetDirecte: '6.33 $', coutNetEpiceries: '6.06 $', coutNetGrandesSurfaces: '5.69 $',
        beneficeNetDirecte: '1.31 $', beneficeNetEpiceries: '-0.12 $', beneficeNetGrandesSurfaces: '-0.54 $',
    },
    activites: {
        plats: { revenu: '61 978.20 $', cout: '36 787.05 $', brut: '25 191.15 $', margeBrute: '40.65 %', fraisFixes: '19 510.80 $', net: '5 595.56 $', margeNette: '9.03 %', pointMort: '50 529.96 $' },
        sauces: { revenu: '3 690.30 $', cout: '3 588.00 $', brut: '102.30 $', margeBrute: '2.77 %', fraisFixes: '2 931.63 $', net: '-2 829.33 $', margeNette: '-76.67 %', pointMort: '105 753.49 $' },
        soupes: { revenu: '9 697.60 $', cout: '7 682.20 $', brut: '2 015.40 $', margeBrute: '20.78 %', fraisFixes: '5 557.56 $', net: '-3 542.17 $', margeNette: '-36.53 %', pointMort: '16 703.21 $' },
    },
    canaux: {
        directe: { revenu: '11 740.20 $', brut: '6 208.99 $', margeBrute: '52.89 %', net: '2 252.14 $', margeNette: '19.18 %', pointMort: '8 050.40 $' },
        epiceries: { revenu: '18 725.50 $', brut: '7 337.43 $', margeBrute: '39.18 %', net: '12.88 $', margeNette: '0.07 %', pointMort: '18 661.96 $' },
        grandes: { revenu: '44 900.40 $', brut: '13 762.43 $', margeBrute: '30.65 %', net: '-3 040.95 $', margeNette: '-6.77 %', pointMort: '51 874.41 $' },
    },
    bcg: {
        etoileTao: 'Pop: 12.7% | Marge: 2.92$', vacheChili: 'Pop: 14.9% | Marge: 1.76$', poidsMortSauce: 'Pop: 6.3% | Marge: 0.15$',
        dilemmePate900: 'Pop: 5.6% | Marge: 5.13$',
    },
};

const R = DEMO_RAPPORT;
DEMO_SCREEN_CHECKS['summary:Par SKU'].push(...Object.values(R.bySkuDetail));
DEMO_SCREEN_CHECKS['summary:Par Activité'] = Object.values(R.activites).flatMap((o) => Object.values(o));
DEMO_SCREEN_CHECKS['summary:Par Canal'] = Object.values(R.canaux).flatMap((o) => Object.values(o));
DEMO_SCREEN_CHECKS['summary:Vue d\'ensemble'].push(...Object.values(R.bcg));
