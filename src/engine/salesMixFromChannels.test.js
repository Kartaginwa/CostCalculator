import { describe, it, expect } from 'vitest';
import { computeSalesMixFromChannelPrices } from './salesMixFromChannels.js';

describe('computeSalesMixFromChannelPrices - tous les formats en mode "unités"', () => {
    it('répartit le mix des ventes au prorata du volume total (tous formats, tous canaux)', () => {
        const products = [
            { id: 'p1', platName: 'A', formats: [{ id: 'f1', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 30 }] }] },
            { id: 'p2', platName: 'B', formats: [{ id: 'f2', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 70 }] }] },
        ];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBeCloseTo(30);
        expect(result[1].formats[0].salesMix).toBeCloseTo(70);
    });

    it('additionne les volumes de plusieurs canaux pour un même format', () => {
        const products = [{
            id: 'p1', platName: 'A',
            formats: [{ id: 'f1', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 20 }, { channelId: 'c2', netPrice: 8, volume: 30 }] }],
        }];
        const { products: result, totalRevenue } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBeCloseTo(100); // seul format du menu
        expect(totalRevenue).toBeCloseTo(20 * 10 + 30 * 8); // 440
    });

    it('mirrore salesMix sur le produit pour le format par défaut (index 0) seulement', () => {
        const products = [{
            id: 'p1', platName: 'A', salesMix: 0,
            formats: [
                { id: 'f1', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 50 }] },
                { id: 'f2', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 50 }] },
            ],
        }];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        expect(result[0].salesMix).toBeCloseTo(50); // mirroir du format 0
        expect(result[0].formats[1].salesMix).toBeCloseTo(50);
    });
});

describe('computeSalesMixFromChannelPrices - coexistence % manuel / unités (06/10)', () => {
    it("un format sans aucune unité saisie garde son % manuel INTACT, jamais écrasé", () => {
        const products = [{ id: 'p1', platName: 'A', salesMix: 42, formats: [{ id: 'f1', salesMix: 42, channelPrices: [] }] }];
        const { products: result, totalRevenue } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBe(42);
        expect(totalRevenue).toBe(0);
    });

    it("un format sans salesMix ni channelPrices n'est pas touché (reste undefined, pas forcé à 0)", () => {
        const products = [{ id: 'p1', platName: 'A', formats: [{ id: 'f1' }] }];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBeUndefined();
    });

    it("un format en unités se voit attribuer le RESTE du 100% une fois les % manuels retirés", () => {
        const products = [
            { id: 'p1', platName: 'Manuel A', salesMix: 40, formats: [{ id: 'f1', salesMix: 40, channelPrices: [] }] },
            { id: 'p2', platName: 'Manuel B', salesMix: 35, formats: [{ id: 'f2', salesMix: 35, channelPrices: [] }] },
            { id: 'p3', platName: 'Unités C', formats: [{ id: 'f3', channelPrices: [{ channelId: 'c1', netPrice: 5, volume: 100 }] }] },
        ];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBe(40); // intact
        expect(result[1].formats[0].salesMix).toBe(35); // intact
        expect(result[2].formats[0].salesMix).toBeCloseTo(25); // 100 - 40 - 35, seul format en unités -> tout le reste
    });

    it("plusieurs formats en unités se partagent le reste au prorata de leurs volumes respectifs", () => {
        const products = [
            { id: 'p1', platName: 'Manuel', salesMix: 20, formats: [{ id: 'f1', salesMix: 20, channelPrices: [] }] },
            { id: 'p2', platName: 'Unités X', formats: [{ id: 'f2', channelPrices: [{ channelId: 'c1', netPrice: 5, volume: 30 }] }] },
            { id: 'p3', platName: 'Unités Y', formats: [{ id: 'f3', channelPrices: [{ channelId: 'c1', netPrice: 5, volume: 50 }] }] },
        ];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        // reste = 80 ; X a 30/80 des unités -> 80 * 30/80 = 30 ; Y a 50/80 -> 80 * 50/80 = 50
        expect(result[1].formats[0].salesMix).toBeCloseTo(30);
        expect(result[2].formats[0].salesMix).toBeCloseTo(50);
    });

    it("si les % manuels occupent déjà tout l'espace, un format en unités obtient 0% (pas de vol de part)", () => {
        const products = [
            { id: 'p1', platName: 'Manuel A', salesMix: 60, formats: [{ id: 'f1', salesMix: 60, channelPrices: [] }] },
            { id: 'p2', platName: 'Manuel B', salesMix: 40, formats: [{ id: 'f2', salesMix: 40, channelPrices: [] }] },
            { id: 'p3', platName: 'Unités C', formats: [{ id: 'f3', channelPrices: [{ channelId: 'c1', netPrice: 5, volume: 100 }] }] },
        ];
        const { products: result } = computeSalesMixFromChannelPrices(products);
        expect(result[0].formats[0].salesMix).toBe(60); // intact
        expect(result[1].formats[0].salesMix).toBe(40); // intact
        expect(result[2].formats[0].salesMix).toBe(0); // aucune place restante
    });
});

describe('computeSalesMixFromChannelPrices - divers', () => {
    it('ne mute pas le tableau products original (fonction pure)', () => {
        const products = [{ id: 'p1', platName: 'A', formats: [{ id: 'f1', channelPrices: [{ channelId: 'c1', netPrice: 10, volume: 10 }] }] }];
        const original = JSON.parse(JSON.stringify(products));
        computeSalesMixFromChannelPrices(products);
        expect(products).toEqual(original);
    });
});
