import { describe, it, expect } from 'vitest';
import { SCENES, CHAPTERS, TOTAL_DURATION, INTRO_MS, readingMs, expandSteps, narrationOf } from './tourScript.js';
import { TOUR_AUDIO } from './tourAudio.js';

// La visite guidée est une donnée : on vérifie sa structure (durée cible, chapitres, gestes valides, sous-titres rédigés
// pour être lus à voix haute) sans lancer l'application.
const KNOWN = new Set(['tab', 'subtab', 'scroll', 'scrollTop', 'highlight', 'point', 'click', 'press', 'hover', 'unhover', 'select', 'type', 'note', 'unnote', 'hoverAt', 'escape', 'guideOpen', 'guideClose']);
// Sous-onglets de Rapport et suivi (REPORT_SUBTAB_GROUPS, SummaryTable.jsx) : la visite doit tous les montrer.
const REPORT_SUBTABS = ['overview', 'portfolio', 'bySku', 'byActivity', 'byChannel', 'ingredients', 'packaging', 'labor', 'simulation'];
const SCENE_COUNT = 36;

describe('Visite guidée : scénario', () => {
    it('dure entre 5 et 7 minutes 30 à vitesse normale (plus vite à 1,5×)', () => {
        expect(TOTAL_DURATION).toBeGreaterThanOrEqual(300000);
        expect(TOTAL_DURATION).toBeLessThanOrEqual(450000);
    });
    it('laisse le temps de lire : chaque scène dure au moins le temps de lecture de son sous-titre, et chaque titre de chapitre au moins 2,5 s', () => {
        SCENES.forEach((sc) => expect(sc.duration, sc.id).toBeGreaterThanOrEqual(readingMs(sc.caption)));
        expect(INTRO_MS).toBeGreaterThanOrEqual(2500);
    });
    it(`compte ${SCENE_COUNT} scènes aux identifiants uniques, réparties en ${9} chapitres existants et dans l'ordre`, () => {
        expect(SCENES).toHaveLength(SCENE_COUNT);
        expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENE_COUNT);
        expect(CHAPTERS).toHaveLength(9);
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
    it('montre chacun des neuf sous-onglets de Rapport et suivi, et aucun sous-onglet qui n\'existe plus', () => {
        const shown = new Set(SCENES.filter((s) => s.tab === 'summary').map((s) => s.subtab || 'overview'));
        REPORT_SUBTABS.forEach((id) => expect(shown.has(id), `sous-onglet « ${id} » jamais montré`).toBe(true));
        shown.forEach((id) => expect(REPORT_SUBTABS, `sous-onglet inconnu « ${id} »`).toContain(id));
    });
    it('présente les rapports déplacés dans leur nouveau sous-onglet (achats et ABC, productivité, réconciliation, constats clés)', () => {
        const sceneOf = (id) => SCENES.find((s) => s.id === id);
        expect(sceneOf('achats-ingredients').subtab).toBe('ingredients');
        expect(sceneOf('emballages').subtab).toBe('packaging');
        expect(sceneOf('main-oeuvre-rapport').subtab).toBe('labor');
        expect(sceneOf('constats').subtab).toBe('overview');
        expect(sceneOf('reconciliation').subtab).toBe('overview');
        expect(sceneOf('matrice').subtab).toBe('portfolio');
        // la réconciliation n'est plus présentée dans l'État des résultats
        SCENES.filter((s) => s.tab === 'income-statement').forEach((s) => expect(JSON.stringify(s.steps), s.id).not.toContain('reconciliation'));
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

describe('Visite guidée : narration prête pour une voix', () => {
    it('chaque sous-titre est une suite de phrases complètes, de 15 à 45 mots', () => {
        SCENES.forEach((s) => {
            const text = narrationOf(s);
            const n = text.split(/\s+/).filter(Boolean).length;
            expect(n, `${s.id} : ${n} mots`).toBeGreaterThanOrEqual(15);
            expect(n, `${s.id} : ${n} mots`).toBeLessThanOrEqual(45);
            expect(text, s.id).toMatch(/[.?!…]$/);
            expect(text[0], s.id).toMatch(/[A-ZÀÂÉÈÊÎÔÙÛ]/);
        });
    });
    it('aucun symbole ni sigle qu\'une voix devrait épeler (« % », « $ », « SKU », « ABC » mis à part), pas de parenthèse ni de flèche', () => {
        SCENES.forEach((s) => {
            const text = narrationOf(s).replace(/\bABC\b/g, '');
            expect(text, s.id).not.toMatch(/[%$→←↓↑#@=<>()[\]{}|]/);
            expect(text, s.id).not.toMatch(/\bSKU\b/);
            expect(text, s.id).not.toMatch(/\b[A-Z]{2,}\b/);
        });
    });
    it('vocabulaire de l\'application : jamais « plat » ni « menu » ; un segment est une colonne, jamais une ligne', () => {
        SCENES.forEach((s) => {
            const text = `${narrationOf(s)} ${JSON.stringify(s.steps.filter((g) => g.do === 'note').map((g) => g.text))}`;
            expect(text, s.id).not.toMatch(/\bplats?\b|\bmenus?\b/i);
            expect(text, s.id).not.toMatch(/une ligne par (activité|canal)/i);
        });
    });
    it('le ton reste vivant : au moins douze sous-titres s\'adressent directement au lecteur ou lui posent une question', () => {
        const direct = SCENES.filter((s) => /\bvous\b|\bvos?\b|\?|Imaginez|Regardez|Essayez|Choisissez|Cherchez|Testez|Commençons|Passez/i.test(narrationOf(s)));
        expect(direct.length).toBeGreaterThanOrEqual(12);
        expect(SCENES.filter((s) => /\?/.test(narrationOf(s))).length).toBeGreaterThanOrEqual(6);
    });
    it('aucune consigne procédurale (« cliquez sur », « ouvrez l\'onglet », « sélectionnez ») dans la narration', () => {
        SCENES.forEach((s) => expect(narrationOf(s), s.id).not.toMatch(/cliquez|ouvrez l|sélectionnez|appuyez|dans le menu/i));
    });
    it('chaque fichier de voix déposé dans src/tour/audio correspond à une scène (une faute de nom est signalée)', () => {
        const ids = SCENES.map((s) => s.id);
        Object.keys(TOUR_AUDIO).forEach((name) => expect(ids, `fichier audio « ${name} » sans scène`).toContain(name));
    });
});
