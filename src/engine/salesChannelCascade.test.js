import { describe, it, expect } from 'vitest';
import { computeSalesChannelCascade, computeNetPriceFromPds } from './salesChannelCascade.js';

describe('computeSalesChannelCascade - ancré au coût de revient (cas par défaut)', () => {
    it("un seul maillon en marge (ex. vente directe à la ferme)", () => {
        const prices = computeSalesChannelCascade({
            links: [{ type: 'margin', percent: 20 }],
            anchorIndex: 0,
            anchorValue: 10,
        });
        // 10 / (1 - 0.20) = 12.5
        expect(prices).toEqual([10, 12.5]);
    });

    it("un seul maillon en markup", () => {
        const prices = computeSalesChannelCascade({
            links: [{ type: 'markup', percent: 20 }],
            anchorIndex: 0,
            anchorValue: 10,
        });
        // 10 * 1.20 = 12
        expect(prices).toEqual([10, 12]);
    });

    it("chaîne à 3 maillons (producteur, distributeur, détaillant)", () => {
        const prices = computeSalesChannelCascade({
            links: [
                { type: 'markup', percent: 50 },  // coût 10 -> prix net producteur 15
                { type: 'margin', percent: 20 },  // 15 -> 18.75
                { type: 'margin', percent: 25 },  // 18.75 -> 25
            ],
            anchorIndex: 0,
            anchorValue: 10,
        });
        expect(prices[0]).toBeCloseTo(10);
        expect(prices[1]).toBeCloseTo(15);
        expect(prices[2]).toBeCloseTo(18.75);
        expect(prices[3]).toBeCloseTo(25);
    });

    it("aucun maillon : la cascade ne contient que le prix ancré", () => {
        const prices = computeSalesChannelCascade({ links: [], anchorIndex: 0, anchorValue: 10 });
        expect(prices).toEqual([10]);
    });
});

describe('computeSalesChannelCascade - ancré ailleurs que le coût (édition à n\'importe quel maillon)', () => {
    it("ancré au prix consommateur (PDSF connu) : déduit le coût de revient en remontant la chaîne", () => {
        const prices = computeSalesChannelCascade({
            links: [
                { type: 'markup', percent: 50 },
                { type: 'margin', percent: 20 },
                { type: 'margin', percent: 25 },
            ],
            anchorIndex: 3,
            anchorValue: 25,
        });
        expect(prices[0]).toBeCloseTo(10);
        expect(prices[1]).toBeCloseTo(15);
        expect(prices[2]).toBeCloseTo(18.75);
        expect(prices[3]).toBeCloseTo(25);
    });

    it("ancré au milieu de la chaîne : recalcule à la fois vers l'avant et vers l'arrière", () => {
        const prices = computeSalesChannelCascade({
            links: [
                { type: 'markup', percent: 50 },
                { type: 'margin', percent: 20 },
            ],
            anchorIndex: 1,
            anchorValue: 15,
        });
        expect(prices[0]).toBeCloseTo(10);  // 15 / 1.5
        expect(prices[1]).toBeCloseTo(15);
        expect(prices[2]).toBeCloseTo(18.75); // 15 / (1 - 0.20)
    });
});

describe('computeSalesChannelCascade - cas limites', () => {
    it("une marge de 100% est indéfinie (évite une division par zéro)", () => {
        const prices = computeSalesChannelCascade({
            links: [{ type: 'margin', percent: 100 }],
            anchorIndex: 0,
            anchorValue: 10,
        });
        expect(prices[1]).toBeNull();
    });

    it("un markup de -100% est indéfini (évite une division par zéro)", () => {
        const prices = computeSalesChannelCascade({
            links: [{ type: 'markup', percent: -100 }],
            anchorIndex: 1,
            anchorValue: 12,
        });
        expect(prices[0]).toBeNull();
    });
});

describe('computeNetPriceFromPds — prix net déduit du PDS en redescendant les maillons', () => {
    it('un canal sans maillon (vente directe) donne prix net = PDS', () => {
        expect(computeNetPriceFromPds(10, { links: [] })).toBe(10);
    });

    it('redescend un maillon en marge (ex. marge détaillant de 20% sur le PDS)', () => {
        // PDS 10 $ au consommateur, marge détaillant 20% -> prix net producteur = 10 * (1 - 0.20) = 8.
        expect(computeNetPriceFromPds(10, { links: [{ type: 'margin', percent: 20 }] })).toBe(8);
    });

    it('arrondit à 2 décimales', () => {
        expect(computeNetPriceFromPds(10, { links: [{ type: 'margin', percent: 15 }] })).toBe(8.5);
    });

    it('retourne null si le PDS n\'est pas un nombre positif valide — jamais un prix net inventé', () => {
        expect(computeNetPriceFromPds('', { links: [] })).toBeNull();
        expect(computeNetPriceFromPds(0, { links: [] })).toBeNull();
        expect(computeNetPriceFromPds(-5, { links: [] })).toBeNull();
    });

    it('un canal absent (channel undefined) est traité comme sans maillon', () => {
        expect(computeNetPriceFromPds(10, undefined)).toBe(10);
    });
});
