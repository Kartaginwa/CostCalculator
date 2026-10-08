import { describe, it, expect } from 'vitest';
import { isDiscreteUnit, isValidPositiveNumber } from './utils.js';

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
