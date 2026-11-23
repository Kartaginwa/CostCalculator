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
        coutMatiere: '2.66 $', coutEmballage: '0.58 $', coutMO: '0.56 $', coutProduction: '3.80 $',
        baseMatiere: '50.52 $', pertesMatiere: '2.75 $', baseEmballage: '11.40 $', pertesEmballage: '0.15 $',
        totalMatiereRecette: '53.27 $', totalEmballageRecette: '11.55 $', totalMORecette: '11.27 $',
        moDirectRecette: '8.81 $', moIndirectRecette: '2.46 $',
        prixVente: '8.09 $', margeContribution: '5.43$ / 67.08%', margeBrute: '4.29$ / 52.97%', pointMort: '575 unités',
        coutMatierePct: '32.92%',
    },
    // Rapport — Par SKU, Chili con carne mijoté
    bySku: {
        pds: '8.99 $', margeEpicier: '2.70 $', margeDetaillant: '2.88 $', majorationDistribution: '0.65 $',
        prixEpiceries: '6.29 $', prixGrandesSurfaces: '5.46 $',
        margeNetteDirecte: '18.25 %', margeNetteEpiceries: '-0.76 %', margeNetteGrandesSurfaces: '-9.61 %',
        fraisFixesGeneral: '0.71 $', fraisFixesActivite: '1.00 $', fraisFixesCanalDirecte: '1.10 $',
        pointMortDirecte: '575 unités', pointMortEpiceries: '946 unités', pointMortGrandesSurfaces: '1365 unités',
    },
    // État des résultats
    etat: { revenus: '80 000.00 $', chargesDirectes: '48 000.00 $', beneficeBrut: '32 000.00 $', fraisFixes: '28 000.00 $', beneficeNet: '4 000.00 $',
        revenusTheorique: '79 713.59 $', chargesDirectesTheorique: '45 356.35 $', beneficeBrutTheorique: '34 357.24 $', beneficeNetTheorique: '6 299.48 $' },
    // Main-d'œuvre
    mo: {
        coutCuisinier: '26.17 $/h', utilisation: '87.48 %', heuresAttendues: '393.72 h', heuresReelles: '344.42 h',
        // Lot 2 (21/11) : paie non utilisée, cascade, coût réel de l'heure, marge de croissance, bénéfice brut par heure.
        paieTotale: '11 058.23 $', paieNonUtilisee: '2 410.98 $', partNonUtilisee: '21.8 %', coutHeureReel: '32.11 $/h', tauxMoyen: '25.78 $/h',
        heuresLibres: '32.3 h', revenuHeure: '200.79 $', beneficeHeure: '87.39 $',
        heureActivite: { plats: '164.46 $', soupes: '40.92 $', sauces: '86.47 $' }, heureProduit: { meilleur: '256.24 $/h', dernier: '74.89 $/h' },
    },
    // Ingrédients
    ingredients: { abcA: '73.6% des coûts', coutNet: '19 004.06 $', pertes: '818.98 $', achatRequis: '19 823.04 $' },
    // Rapport — Vue d'ensemble
    apercu: { coutMatiere: '34.57 %', coutEmballage: '7.17 %', coutMO: '13.87 %', margeBrute: '43.10 %', pointMortMenu: '68 642.61 $', margeSecurite: '13.89 %' },
};

// Chaînes que le guide cite et qui doivent s'afficher à l'écran du projet démo, par écran.
// Utilisé par e2e/guide-demo-numbers.spec.js (clé = écran à ouvrir).
export const DEMO_SCREEN_CHECKS = {
    'recipe:Chili con carne mijoté': [
        DEMO.chili.coutMatiere, DEMO.chili.coutEmballage, DEMO.chili.coutMO, DEMO.chili.coutProduction, DEMO.chili.totalMatiereRecette,
        DEMO.chili.totalEmballageRecette, DEMO.chili.totalMORecette, DEMO.chili.moDirectRecette, DEMO.chili.moIndirectRecette,
        DEMO.chili.baseMatiere, DEMO.chili.pertesMatiere, DEMO.chili.baseEmballage, DEMO.chili.pertesEmballage,
        DEMO.chili.prixVente, DEMO.chili.margeContribution, DEMO.chili.margeBrute, DEMO.chili.pointMort, DEMO.chili.coutMatierePct,
        '21.7 min', '7.14%', '6.97%',
    ],
    'summary:Par SKU': [
        DEMO.bySku.pds, DEMO.bySku.margeEpicier, DEMO.bySku.margeDetaillant, DEMO.bySku.majorationDistribution, DEMO.bySku.prixEpiceries,
        DEMO.bySku.prixGrandesSurfaces, DEMO.bySku.margeNetteDirecte, DEMO.bySku.margeNetteEpiceries, DEMO.bySku.margeNetteGrandesSurfaces,
        DEMO.bySku.fraisFixesGeneral, DEMO.bySku.fraisFixesActivite, DEMO.bySku.fraisFixesCanalDirecte,
        DEMO.bySku.pointMortDirecte, DEMO.bySku.pointMortEpiceries, DEMO.bySku.pointMortGrandesSurfaces,
    ],
    // Les chiffres saisis restent sur l'écran de saisie ; la réconciliation (théorique et écarts) vit maintenant dans Rapport et suivi → Vue d'ensemble.
    'income-statement': [
        DEMO.etat.revenus, DEMO.etat.chargesDirectes, DEMO.etat.beneficeBrut, DEMO.etat.fraisFixes, DEMO.etat.beneficeNet,
    ],
    labor: [DEMO.mo.coutCuisinier],
    // Rapports déplacés dans Rapport et suivi (21/11) : productivité et charge de travail, achats et perte stock, réconciliation.
    "summary:Main-d'œuvre": [
        DEMO.mo.utilisation, DEMO.mo.heuresAttendues, DEMO.mo.heuresReelles,
        DEMO.mo.paieTotale, DEMO.mo.paieNonUtilisee, DEMO.mo.partNonUtilisee, DEMO.mo.coutHeureReel, DEMO.mo.tauxMoyen, DEMO.mo.heuresLibres,
        DEMO.mo.revenuHeure, DEMO.mo.beneficeHeure, DEMO.mo.heureActivite.plats, DEMO.mo.heureActivite.soupes, DEMO.mo.heureProduit.meilleur, DEMO.mo.heureProduit.dernier,
        '92.21 %', '89.88 %', '88.47 %', '126.81 h', '36.82 %', '210.14 h', '61.01 %',
    ],
    "summary:Ingrédients": ['27.8%', '20.8%', '12.4%', '7.6%', '5.0%', DEMO.ingredients.abcA, DEMO.ingredients.coutNet, DEMO.ingredients.pertes, DEMO.ingredients.achatRequis],
    "summary:Vue d'ensemble": [
        DEMO.apercu.coutMatiere, DEMO.apercu.coutEmballage, DEMO.apercu.coutMO, DEMO.apercu.margeBrute, DEMO.apercu.pointMortMenu, DEMO.apercu.margeSecurite,
        DEMO.etat.revenus, DEMO.etat.chargesDirectes, DEMO.etat.beneficeBrut, DEMO.etat.beneficeNet,
        // Constats clés (lot 3) : chiffres cités par le guide.
        '58 % des revenus, 15 % du bénéfice net',
        DEMO.etat.revenusTheorique, DEMO.etat.chargesDirectesTheorique, DEMO.etat.beneficeBrutTheorique, DEMO.etat.beneficeNetTheorique,
        '+286.41 $', '+0.4 %', '+2 643.65 $', '+5.8 %', '-2 357.24 $', '-6.9 %', '-2 299.48 $', '-36.5 %',
    ],
};

// --- Chiffres supplémentaires du projet démo cités dans la Partie 3 (rapports) ----------------------
export const DEMO_RAPPORT = {
    bySkuDetail: {
        revenuDirecte: '922.26 $', revenuEpiceries: '1 698.30 $', revenuGrandesSurfaces: '4 286.10 $',
        fraisTotauxDirecte: '753.95 $', fraisTotauxEpiceries: '1 711.19 $', fraisTotauxGrandesSurfaces: '4 698.13 $',
        resultatDirecte: '168.31 $', resultatEpiceries: '-12.89 $', resultatGrandesSurfaces: '-412.03 $',
        beneficeBrutDirecte: '4.29 $', beneficeBrutEpiceries: '2.49 $', beneficeBrutGrandesSurfaces: '1.66 $',
        margeBruteDirecte: '52.97 %', margeBruteEpiceries: '39.52 %', margeBruteGrandesSurfaces: '30.32 %',
        fraisFixesTotalDirecte: '2.81 $', fraisFixesTotalEpiceries: '2.53 $', fraisFixesTotalGrandesSurfaces: '2.18 $',
        fraisFixesCanalEpiceries: '0.82 $', fraisFixesCanalGrandesSurfaces: '0.47 $',
        coutNetDirecte: '6.61 $', coutNetEpiceries: '6.34 $', coutNetGrandesSurfaces: '5.98 $',
        beneficeNetDirecte: '1.48 $', beneficeNetEpiceries: '-0.05 $', beneficeNetGrandesSurfaces: '-0.52 $',
    },
    activites: {
        plats: { revenu: '46 436.66 $', cout: '25 581.60 $', brut: '20 855.06 $', margeBrute: '44.91 %', fraisFixes: '15 684.53 $', net: '5 112.77 $', margeNette: '11.01 %', pointMort: '36 863.65 $' },
        sauces: { revenu: '12 447.00 $', cout: '7 544.34 $', brut: '4 902.66 $', margeBrute: '39.39 %', fraisFixes: '4 734.65 $', net: '168.01 $', margeNette: '1.35 %', pointMort: '12 040.16 $' },
        soupes: { revenu: '20 829.93 $', cout: '12 230.41 $', brut: '8 599.52 $', margeBrute: '41.28 %', fraisFixes: '7 580.81 $', net: '1 018.71 $', margeNette: '4.89 %', pointMort: '19 453.51 $' },
    },
    canaux: {
        directe: { revenu: '12 886.24 $', brut: '7 466.55 $', margeBrute: '57.94 %', net: '3 448.69 $', margeNette: '26.76 %', pointMort: '7 827.49 $' },
        epiceries: { revenu: '20 463.60 $', brut: '9 361.60 $', margeBrute: '45.75 %', net: '1 934.99 $', margeNette: '9.46 %', pointMort: '17 191.67 $' },
        grandes: { revenu: '46 363.75 $', brut: '17 529.08 $', margeBrute: '37.81 %', net: '915.81 $', margeNette: '1.98 %', pointMort: '44 628.60 $' },
    },
    bcg: {
        etoileTao: 'Pop: 9.1% | Marge: 3.28$', vacheChili: 'Pop: 10.7% | Marge: 2.10$', poidsMortPuree: 'Pop: 4.3% | Marge: 1.81$',
        dilemmePate900: 'Pop: 4.0% | Marge: 6.51$',
    },
};

const R = DEMO_RAPPORT;
DEMO_SCREEN_CHECKS['summary:Par SKU'].push(...Object.values(R.bySkuDetail));
DEMO_SCREEN_CHECKS['summary:Par Activité'] = Object.values(R.activites).flatMap((o) => Object.values(o));
DEMO_SCREEN_CHECKS['summary:Par Activité'].push(DEMO.mo.heureActivite.plats, DEMO.mo.heureActivite.soupes, DEMO.mo.heureActivite.sauces);
DEMO_SCREEN_CHECKS['summary:Par Canal'] = Object.values(R.canaux).flatMap((o) => Object.values(o));
DEMO_SCREEN_CHECKS['summary:Emballages'] = ['77.3% des coûts']; // catégorie A de l'emballage (sous-onglet Emballages)
DEMO_SCREEN_CHECKS['summary:Portefeuille'] = Object.values(R.bcg); // matrice stratégique : sous-onglet Portefeuille (21/11)
// Heures par activité (sous-onglet Main-d'œuvre) citées en toutes lettres dans la partie 3.
DEMO_SCREEN_CHECKS["summary:Main-d'œuvre"].push('126.81 h', '36.82 %', '210.14 h', '61.01 %', '7.47 h', '2.17 %');
