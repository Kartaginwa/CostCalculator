import { describe, it, expect } from 'vitest';
import { BARRES, BOISSON, FROMAGE, CAROTTES, LAITIER, CROUSTILLES, BOISSON_VEG, CASCADE, PATES, MIX, FARINE, ABC, CAPACITE, DOUBLE_COMPTAGE, BOEUF, SALAIRE } from './guideNumbers.js';

// Les chiffres des exemples du guide doivent rester arithmétiquement justes : ce test fige les
// valeurs affichées dans le texte et les relations entre elles.
const close = (a, b, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe('exemples génériques du guide', () => {
    it('barres : du coût direct au coût de revient complet', () => {
        close(BARRES.directUnit, 0.85); close(BARRES.fixesUnit, 0.3); close(BARRES.coutRevient, 1.15);
        close(BARRES.margeBrute, 0.75); close(BARRES.margeNette, 0.45); close(BARRES.perteMois, 9000);
        expect(BARRES.matieres + BARRES.emballage + BARRES.mo).toBe(BARRES.directLot);
    });
    it('boisson, fromage, carottes', () => {
        close(BOISSON.unit, 0.63); expect(BOISSON.total).toBe(12600);
        close(FROMAGE.portage, 1600); close(FROMAGE.portageParMeule, 0.8);
        close(CAROTTES.final, 39.4737, 3); close(CAROTTES.kgAcheter, 12.5);
    });
    it('laitier : la répartition reconstitue le bassin', () => {
        close(LAITIER.poolYogourt + LAITIER.poolFromage, LAITIER.poolTotal);
        close(LAITIER.parPot, 0.12); close(LAITIER.parFromage, 0.4);
    });
    it('croustilles : le coût par sac baisse avec le volume', () => {
        const unitCosts = CROUSTILLES.lignes.map((l) => l.unit);
        expect(unitCosts[0]).toBeGreaterThan(unitCosts[1]); expect(unitCosts[1]).toBeGreaterThan(unitCosts[2]);
        close(unitCosts[0], 1.2); close(unitCosts[2], 0.75);
    });
    it('marges, majoration, cascade, point mort', () => {
        close(BOISSON_VEG.contribution, 1.7); close(BOISSON_VEG.brute, 1.1); close(BOISSON_VEG.nette, 0.55);
        close(BOISSON_VEG.margeSurPrix, 0.2); close(BOISSON_VEG.majorationSurCout, 0.25);
        close(CASCADE.prixNetProducteur, 7.5); close(CASCADE.part, 0.625);
        close(CASCADE.margeDetaillantDollar + CASCADE.margeDistributeurDollar + CASCADE.prixNetProducteur, CASCADE.pds);
        expect(PATES.pointMort).toBe(41667); close(PATES.profit50, 15000, 4); close(PATES.perte30, -21000, 4);
    });
    it('mix : trois méthodes, trois résultats distincts', () => {
        close(MIX.moyenneSimple, 0.35); close(MIX.ponderUnites, 0.4); close(MIX.ponderRevenu, 70000 / 190000);
    });
    it('farine, ABC, capacité', () => {
        close(FARINE.tendance, 0.2439, 3); close(FARINE.amplitude, 0.2188, 3);
        expect(FARINE.amplitude).toBeGreaterThanOrEqual(0.2);
        expect(ABC.lignes.map((l) => l.classe).join('')).toBe('AAAABBBBCC');
        expect(ABC.A.n).toBe(4); close(ABC.A.pct, 71);
        close(CAPACITE.utilisation, 0.75); close(CAPACITE.tauxAbsorption, 0.675); close(CAPACITE.coutAbsorbe, CAPACITE.masseSalariale); close(CAPACITE.coutNonProductif, 1792);
        // toute la paie est absorbée : heures employées + capacité inutilisée + temps non productif
        close(CAPACITE.coutDirect + CAPACITE.coutInutilise + CAPACITE.coutNonProductif, CAPACITE.coutAbsorbe);
    });
    it('double comptage, bœuf, salaire chargé', () => {
        expect(DOUBLE_COMPTAGE.correct).toBe(74000); expect(DOUBLE_COMPTAGE.erreur).toBe(134000);
        close(BOEUF.prixUnitaire, 9.75); close(BOEUF.prixEfficace, 10.5978, 3);
        close(SALAIRE.charge, 26.5408, 4);
    });
});
