import { describe, it, expect } from 'vitest';
import { isDiscreteUnit, isValidPositiveNumber, sumLineAmounts, sumAmountsMap, formatCurrency, guessExpenseCategory, parsePdfStatementLine, filterActiveUnits, DEFAULT_ACTIVE_UNITS, getCompatibleUnits } from './utils.js';

describe('formatCurrency', () => {
    it('ajoute un espace comme séparateur de milliers, point comme séparateur décimal', () => {
        expect(formatCurrency(160000)).toBe('160 000.00');
        expect(formatCurrency(1000)).toBe('1 000.00');
        expect(formatCurrency(1234567.5)).toBe('1 234 567.50');
    });

    it("n'ajoute aucun séparateur sous 1000", () => {
        expect(formatCurrency(999.9)).toBe('999.90');
        expect(formatCurrency(0)).toBe('0.00');
    });

    it('gère les valeurs négatives (signe avant les chiffres groupés)', () => {
        expect(formatCurrency(-160000)).toBe('-160 000.00');
    });

    it('retourne « 0.00 » pour une valeur non numérique, sans planter', () => {
        expect(formatCurrency('abc')).toBe('0.00');
        expect(formatCurrency(undefined)).toBe('0.00');
    });
});

describe('isDiscreteUnit', () => {
    it("une unité de compte (« unité ») est discrète", () => {
        expect(isDiscreteUnit('unité')).toBe(true);
    });

    it('les unités de poids/volume sont continues', () => {
        expect(isDiscreteUnit('kg')).toBe(false);
        expect(isDiscreteUnit('g')).toBe(false);
        expect(isDiscreteUnit('L')).toBe(false);
        expect(isDiscreteUnit('ml')).toBe(false);
    });

    it('une unité inconnue est traitée comme discrète par défaut (comportement historique, prudent)', () => {
        expect(isDiscreteUnit('caisse')).toBe(true);
        expect(isDiscreteUnit(undefined)).toBe(true);
    });
});

describe('filterActiveUnits (retour utilisateur du 19/10 — unités de mesure activables)', () => {
    it('ne garde que les unités activées parmi une liste plus large', () => {
        const result = filterActiveUnits(getCompatibleUnits('g'), ['g', 'kg']);
        expect(result).toEqual(['g', 'kg']);
    });

    it("garde TOUJOURS la valeur actuelle même si elle n'est plus active (donnée existante jamais cassée)", () => {
        const result = filterActiveUnits(getCompatibleUnits('g'), ['g', 'kg'], 'oz');
        expect(result).toContain('oz');
        expect(result).toEqual(expect.arrayContaining(['g', 'kg', 'oz']));
    });

    it('retombe sur DEFAULT_ACTIVE_UNITS si activeUnits est vide ou absent', () => {
        const allMassUnits = getCompatibleUnits('g');
        expect(filterActiveUnits(allMassUnits, [])).toEqual(allMassUnits.filter(u => DEFAULT_ACTIVE_UNITS.includes(u)));
        expect(filterActiveUnits(allMassUnits, undefined)).toEqual(allMassUnits.filter(u => DEFAULT_ACTIVE_UNITS.includes(u)));
    });

    it("n'ajoute jamais une unité qui n'était pas déjà dans la liste fournie, même si activée", () => {
        // 'unité' est active par défaut mais absente de la famille masse (getCompatibleUnits('g')).
        const result = filterActiveUnits(getCompatibleUnits('g'), DEFAULT_ACTIVE_UNITS);
        expect(result).not.toContain('unité');
    });
});

describe('isValidPositiveNumber', () => {
    it('accepte un nombre décimal positif', () => {
        expect(isValidPositiveNumber('47.3')).toBe(true);
        expect(isValidPositiveNumber('47,3')).toBe(true);
    });

    it('rejette zéro, les négatifs et les valeurs vides', () => {
        expect(isValidPositiveNumber('0')).toBe(false);
        expect(isValidPositiveNumber('-5')).toBe(false);
        expect(isValidPositiveNumber('')).toBe(false);
        expect(isValidPositiveNumber(null)).toBe(false);
    });
});

describe('sumLineAmounts', () => {
    it('additionne le montant de chaque ligne', () => {
        const lines = [
            { id: '1', amount: 600 },
            { id: '2', amount: '400' }, // saisie textuelle, comme un champ non encore flouté
        ];
        expect(sumLineAmounts(lines)).toBe(1000);
    });

    it('retourne 0 pour une liste vide ou absente', () => {
        expect(sumLineAmounts([])).toBe(0);
        expect(sumLineAmounts(undefined)).toBe(0);
    });
});

describe('sumAmountsMap', () => {
    it('additionne les valeurs de toutes les clés (plusieurs contenants à la fois — Saisie manuelle)', () => {
        expect(sumAmountsMap({ general: 1000, act_1: 500, act_2: '250' })).toBe(1750);
    });

    it('fonctionne avec une seule clé non nulle (répartition Général ou une activité précise)', () => {
        expect(sumAmountsMap({ act_1: 90000 })).toBe(90000);
    });

    it('retourne 0 pour un objet vide ou absent', () => {
        expect(sumAmountsMap({})).toBe(0);
        expect(sumAmountsMap(undefined)).toBe(0);
    });
});

describe('guessExpenseCategory', () => {
    it('reconnaît un mot-clé de production', () => {
        expect(guessExpenseCategory('Loyer (espace de production)')).toBe('Frais généraux de production');
    });

    it('reconnaît un mot-clé de vente même via la colonne catégorie source', () => {
        expect(guessExpenseCategory('Frais de transport', 'Commissions')).toBe('Frais de vente / mise en marché');
    });

    it('retombe sur Frais d\'administration — jamais Frais généraux de production — si rien ne correspond', () => {
        expect(guessExpenseCategory('Poste inconnu xyz')).toBe("Frais d'administration");
    });
});

describe('parsePdfStatementLine', () => {
    it('isole le poste et le montant en fin de ligne (texte reconstruit depuis un PDF)', () => {
        expect(parsePdfStatementLine('Loyer (espace de production)        9 000,00 $')).toEqual({ label: 'Loyer (espace de production)', amount: 9000 });
    });

    it('gère un montant entre parenthèses comme négatif', () => {
        expect(parsePdfStatementLine('Ajustement comptable (500.00)')).toEqual({ label: 'Ajustement comptable', amount: -500 });
    });

    it('gère un point de suite sans espace avant le montant', () => {
        expect(parsePdfStatementLine('Assurances..........2 200.00')).toEqual({ label: 'Assurances..........', amount: 2200 });
    });

    it('retourne null pour une ligne sans aucun montant (en-tête de section)', () => {
        expect(parsePdfStatementLine('REVENUS')).toBeNull();
    });

    it('retourne null pour une ligne vide ou absente', () => {
        expect(parsePdfStatementLine('')).toBeNull();
        expect(parsePdfStatementLine(undefined)).toBeNull();
    });

    it('retourne null quand le montant isolé vaut 0 (sous-total sans valeur réelle)', () => {
        expect(parsePdfStatementLine('Sous-total 0.00')).toBeNull();
    });
});
