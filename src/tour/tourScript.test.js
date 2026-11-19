import { describe, it, expect } from 'vitest';
import { SCENES, CHAPTERS, TOTAL_DURATION, INTRO_MS, readingMs, expandSteps } from './tourScript.js';

// La visite guidée est une donnée : on vérifie sa structure (durée cible 4 à 5 min, chapitres, gestes valides,
// sous-titres rédigés) sans lancer l'application.
const KNOWN = new Set(['tab', 'subtab', 'scroll', 'scrollTop', 'highlight', 'point', 'click', 'press', 'hover', 'unhover', 'select', 'type', 'note', 'unnote', 'hoverAt', 'escape', 'guideOpen', 'guideClose']);

describe('Visite guidée : scénario', () => {
    it('dure entre 4 min 30 et 7 minutes à vitesse normale (plus vite à 1,5×)', () => {
        expect(TOTAL_DURATION).toBeGreaterThanOrEqual(270000);
        expect(TOTAL_DURATION).toBeLessThanOrEqual(420000);
    });
    it('laisse le temps de lire : chaque scène dure au moins le temps de lecture de son sous-titre, et chaque titre de chapitre au moins 2,5 s', () => {
        SCENES.forEach((sc) => expect(sc.duration, sc.id).toBeGreaterThanOrEqual(readingMs(sc.caption)));
        expect(INTRO_MS).toBeGreaterThanOrEqual(2500);
    });
    it('compte 32 scènes aux identifiants uniques, réparties en 7 chapitres existants et dans l\'ordre', () => {
        expect(SCENES).toHaveLength(32);
        expect(new Set(SCENES.map((s) => s.id)).size).toBe(32);
        expect(CHAPTERS).toHaveLength(7);
        SCENES.forEach((s) => expect(s.chapter).toBeGreaterThanOrEqual(0) && expect(s.chapter).toBeLessThan(CHAPTERS.length));
        const chapters = SCENES.map((s) => s.chapter);
        expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);
        CHAPTERS.forEach((_, i) => expect(chapters).toContain(i));
    });
    it('chaque scène a un sous-titre, une durée raisonnable et des gestes valides, tous placés dans la durée de la scène', () => {
        SCENES.forEach((s) => {
            expect(s.caption.length, s.id).toBeGreaterThan(20);
            expect(s.duration, s.id).toBeGreaterThanOrEqual(5500);
            expect(s.duration, s.id).toBeLessThanOrEqual(21000);
            expandSteps(s.steps).forEach((g) => {
                expect(KNOWN.has(g.do), `${s.id} : geste inconnu « ${g.do} »`).toBe(true);
                expect(g.at, s.id).toBeGreaterThanOrEqual(0);
                expect(g.at, `${s.id} : geste après la fin de la scène`).toBeLessThan(s.duration);
            });
        });
    });
    it('les gestes sont expansés dans l\'ordre chronologique', () => {
        SCENES.forEach((s) => {
            const ats = expandSteps(s.steps).map((g) => g.at);
            expect(ats, s.id).toEqual([...ats].sort((a, b) => a - b));
        });
    });
    it("chaque scène déclare son onglet ; Rapport et suivi peut en plus déclarer son sous-onglet", () => {
        const TABS = ['info', 'ingredients', 'packaging', 'labor', 'recipe', 'income-statement', 'summary'];
        SCENES.forEach((sc) => { expect(TABS, sc.id).toContain(sc.tab); if (sc.subtab) expect(sc.tab, sc.id).toBe('summary'); });
    });
    it("suit l'ordre des onglets : Production avant État des résultats, puis le rapport", () => {
        const order = SCENES.map((sc) => sc.tab);
        expect(order.indexOf('recipe')).toBeLessThan(order.indexOf('income-statement'));
        expect(order.lastIndexOf('income-statement')).toBeLessThan(order.indexOf('summary'));
    });
    it("aucune scène ne remonte la page en haut d'elle-même : seul un changement d'onglet le fait", () => {
        // seule exception : « depart » revient sur Paramètres, que l'application rouvre là où on l'avait laissé
        SCENES.filter((sc) => sc.id !== 'depart').forEach((sc) => expect(sc.steps.some((g) => g.do === 'scrollTop'), sc.id).toBe(false));
    });
});

describe('Visite guidée : style', () => {
    it("chaque scène s'accompagne d'au moins une étiquette explicative ou d'une saisie (pas de scène « muette »)", () => {
        SCENES.forEach((s) => expect(s.steps.some((g) => g.do === 'note' || g.do === 'type' || g.do === 'hover'), s.id).toBe(true));
    });
    it("au moins 10 scènes tapent des mots ou des chiffres dans l'application", () => {
        expect(SCENES.filter((s) => s.steps.some((g) => g.do === 'type' && g.text)).length).toBeGreaterThanOrEqual(10);
    });
    it('le premier sous-titre entre directement dans le sujet (aucune précaution sur le projet)', () => {
        expect(SCENES[0].caption).not.toMatch(/touché|jamais|copie/i);
    });
});
