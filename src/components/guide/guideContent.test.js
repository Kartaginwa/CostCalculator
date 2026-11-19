import { describe, it, expect } from 'vitest';
import { PARTS } from './guideContent.js';
import { GLOSSAIRE_TERMES } from './content/partie4.js';
import { frTypo } from './guideFormat.js';

// Garde-fous de qualité du guide (Phase 7, point 4) : structure, ancres, liens, glossaire, termes
// périmés, lisibilité. Si l'un échoue, le guide a une erreur que l'on ne verrait pas à l'œil nu.

// --- collecte --------------------------------------------------------------------------------------
const strings = []; // { where, text }
const ids = [];
const links = [];
const SKIP_KEYS = new Set(['id', 'type', 'kind', 'level', 'boldLast', 'wrapCells', 'className', 'rowIds', 'itemIds']);

const collect = (value, where) => {
    if (typeof value === 'string') { strings.push({ where, text: value }); return; }
    if (Array.isArray(value)) { value.forEach((v) => collect(v, where)); return; }
    if (value && typeof value === 'object') {
        if (value.id) ids.push(value.id);
        [...(value.rowIds || []), ...(value.itemIds || [])].filter(Boolean).forEach((x) => ids.push(x));
        Object.entries(value).forEach(([k, v]) => { if (!SKIP_KEYS.has(k)) collect(v, where); });
    }
};
PARTS.forEach((part) => {
    ids.push(part.id);
    collect([part.title, part.lead], part.id);
    part.chapters.forEach((chapter) => {
        ids.push(chapter.id);
        collect([chapter.title, chapter.lead], chapter.id);
        collect(chapter.blocks, chapter.id);
    });
});
strings.forEach(({ text }) => { for (const m of text.matchAll(/\[\[([^\]|]+)\|?[^\]]*\]\]/g)) links.push(m[1]); });

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const allText = strings.map((s) => s.text).join('\n');
const wordCount = (allText.match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;

describe('guide : structure et ancres', () => {
    it('toutes les ancres sont uniques et bien formées', () => {
        const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dups).toEqual([]);
        expect(ids.filter((id) => !/^guide-[a-z0-9-]+$/.test(id))).toEqual([]);
    });
    it('chaque lien interne [[ancre|libellé]] pointe vers une ancre existante', () => {
        expect(links.length).toBeGreaterThan(25);
        const missing = [...new Set(links.filter((l) => !ids.includes(l)))];
        expect(missing).toEqual([]);
    });
    it('contient les cinq parties et les chapitres attendus', () => {
        expect(PARTS.map((p) => p.id)).toEqual(['guide-partie-0', 'guide-partie-1', 'guide-partie-2', 'guide-partie-3', 'guide-partie-4']);
        const chapters = PARTS.flatMap((p) => p.chapters.map((c) => c.id));
        for (const must of ['guide-demarrer', 'guide-gestion', 'guide-concept-cout-de-revient', 'guide-concept-point-mort', 'guide-parametres', 'guide-ingredients',
            'guide-emballage', 'guide-main-oeuvre', 'guide-etat-resultats', 'guide-production', 'guide-rapport-par-sku', 'guide-rapport-simulation',
            'guide-points-reference', 'guide-decider', 'guide-glossaire', 'guide-faq', 'guide-limites']) {
            expect(chapters).toContain(must);
        }
    });
    it('les ancres utilisées par l\'application (liens des infobulles, rappels) existent', () => {
        for (const a of ['guide-ff-liste', 'guide-ff-cici', 'guide-ff-reconciliation', 'guide-rapport-verifications', 'guide-concept-marge-majoration']) expect(ids).toContain(a);
    });
});

describe('guide : pédagogie', () => {
    const hasBlock = (chapter, needle) => JSON.stringify(chapter.blocks).includes(needle);
    it('chaque chapitre des parties 1 et 2 se termine par « À retenir » et « Les mots du chapitre »', () => {
        const wanted = PARTS.filter((p) => ['guide-partie-1', 'guide-partie-2'].includes(p.id)).flatMap((p) => p.chapters);
        const lacking = wanted.filter((c) => !hasBlock(c, '"kind":"retenir"') || !hasBlock(c, '"type":"words"')).map((c) => c.id);
        expect(lacking).toEqual([]);
        expect(wanted.length).toBe(19);
    });
    it('les chapitres de concepts contiennent un exemple', () => {
        const concepts = PARTS.find((p) => p.id === 'guide-partie-1').chapters;
        // le chapitre « ingénierie de menu » s'appuie sur la matrice du démo (Partie 3)
        const lacking = concepts.filter((c) => !hasBlock(c, '"kind":"exemple"')).map((c) => c.id).filter((id) => id !== 'guide-concept-menu' && id !== 'guide-concept-reel-theorique');
        expect(lacking).toEqual([]);
    });
    it('est exhaustif : volume minimal, glossaire fourni, questions fréquentes', () => {
        expect(wordCount).toBeGreaterThan(18000);
        expect(GLOSSAIRE_TERMES.length).toBeGreaterThanOrEqual(55);
        const faq = PARTS.flatMap((p) => p.chapters).find((c) => c.id === 'guide-faq');
        expect(faq.blocks.filter((b) => b.type === 'h' && b.level === 5).length).toBeGreaterThanOrEqual(15);
    });
    it('le glossaire est en ordre alphabétique', () => {
        const terms = GLOSSAIRE_TERMES.map((t) => norm(t.term));
        const sorted = [...terms].sort((a, b) => a.localeCompare(b, 'fr'));
        expect(terms).toEqual(sorted);
    });
});

describe('guide : lisibilité', () => {
    const sentences = [];
    strings.forEach(({ text }) => {
        const plain = text.replace(/\*\*|__|\{\{|\}\}/g, '').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1');
        plain.split(/(?<=[.!?])\s+/).forEach((s) => { const w = s.split(/\s+/).filter(Boolean).length; if (w >= 4) sentences.push({ w, s }); });
    });
    it('les phrases restent courtes en moyenne, et aucune n\'est démesurée', () => {
        const avg = sentences.reduce((a, b) => a + b.w, 0) / sentences.length;
        const tooLong = sentences.filter((x) => x.w > 60);
        expect(avg).toBeLessThan(22);
        expect(tooLong.map((x) => `${x.w} mots : ${x.s.slice(0, 80)}…`)).toEqual([]);
        const share = sentences.filter((x) => x.w > 35).length / sentences.length;
        expect(share).toBeLessThan(0.08);
    });
});

describe('guide : exactitude et hygiène', () => {
    it('ne contient aucun nom d\'onglet périmé ni historique de développement', () => {
        expect(allText).not.toMatch(/Recette & Calcul|Recettes et produits|onglet Recette\b|onglet 'Rapport'|Packaging\b/);
        expect(allText).not.toMatch(/Projet_Claude|SymbiOse|retour utilisateur|\([0-3]\d\/(0[1-9]|1[0-2])\)|le [0-3]\d\/(0[1-9]|1[0-2])\b/);
        expect(allText).not.toMatch(/\bundefined\b|\bNaN\b|\[object|\$\{/);
    });
    it('chaque balisage ouvert est refermé', () => {
        const bad = strings.filter(({ text }) => (text.match(/\*\*/g) || []).length % 2 !== 0
            || (text.match(/\{\{/g) || []).length !== (text.match(/\}\}/g) || []).length
            || (text.match(/\[\[/g) || []).length !== (text.match(/\]\]/g) || []).length
            || (text.match(/__/g) || []).length % 2 !== 0);
        expect(bad.map((b) => b.text.slice(0, 90))).toEqual([]);
    });
    it('utilise les noms d\'onglets actuels', () => {
        for (const tab of ['Paramètres', 'Ingrédients', 'Emballage', 'Main-d\'œuvre', 'État des résultats', 'Production', 'Rapport et suivi']) expect(allText).toContain(tab);
        expect(allText).not.toMatch(/main-d'oeuvre/i);
    });
    it('les libellés d\'écran {{…}} ne sont jamais vides', () => {
        const empties = strings.filter(({ text }) => /\{\{\s*\}\}/.test(text));
        expect(empties).toEqual([]);
    });
    it('la typographie française insère des espaces insécables avant « : ; ? ! % $ »', () => {
        expect(frTypo('Marge : 20 % du prix ; voir')).toBe('Marge : 20 % du prix ; voir');
        expect(frTypo('« bonjour »')).toBe('« bonjour »');
    });
});
