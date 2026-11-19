import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { PARTS } from './guideContent.js';
import { TOOLTIP_GUIDE_MAP } from './tooltipMap.js';

// Étape 5 de la Phase 7 (infobulles) : chaque infobulle, indice ou titre d'aide de l'application doit
// pointer vers une section du guide qui existe. Ce test lit le CODE SOURCE de l'application : ajouter
// une infobulle sans l'inscrire dans tooltipMap.js (ou pointer vers une ancre inexistante) le fait échouer.

const ROOT = process.cwd();
const norm = (t) => t.replace(/\\'/g, '\'').replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

// --- ancres du guide ---------------------------------------------------------------------------------
const anchors = new Set();
const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
        if (v.id) anchors.add(v.id);
        [...(v.rowIds || []), ...(v.itemIds || [])].filter(Boolean).forEach((x) => anchors.add(x));
        Object.values(v).forEach(walk);
    }
};
PARTS.forEach((p) => { anchors.add(p.id); p.chapters.forEach((c) => { anchors.add(c.id); walk(c.blocks); }); });

// --- infobulles du code -----------------------------------------------------------------------------
const SOURCES = [['features', 'features'], ['components', 'components']];
const PATTERNS = [
    /<Tooltip\s+text=(\{`(?:[^`\\]|\\.)*`\}|"(?:[^"\\]|\\.)*"|\{'(?:[^'\\]|\\.)*'\}|\{"(?:[^"\\]|\\.)*"\})/g,
    /\b(?:tooltip|tooltipText)=(\{`(?:[^`\\]|\\.)*`\}|"(?:[^"\\]|\\.)*")/g,
    /\b(?:tip|hint):\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g,
    /\btitle=("(?:[^"\\]|\\.){40,}")/g,
];
const tooltips = [];
for (const [dir, label] of SOURCES) {
    const full = join(ROOT, 'src', dir);
    for (const name of readdirSync(full).filter((n) => n.endsWith('.jsx'))) {
        if (name === 'InstructionModal.jsx') continue;
        const src = readFileSync(join(full, name), 'utf-8');
        for (const re of PATTERNS) {
            for (const m of src.matchAll(re)) {
                let raw = m[1];
                if (raw.startsWith('{')) raw = raw.slice(1, -1);
                const text = norm(raw.slice(1, -1));
                tooltips.push({ file: `${label}/${name}`, text });
            }
        }
    }
}

describe('infobulles ↔ guide', () => {
    it('l\'extraction trouve bien toutes les infobulles du code (garde-fou du test lui-même)', () => {
        expect(tooltips.length).toBeGreaterThanOrEqual(130);
    });
    it('chaque entrée de la carte pointe vers une ancre qui existe dans le guide', () => {
        const missing = TOOLTIP_GUIDE_MAP.filter((e) => !anchors.has(e.anchor)).map((e) => `${e.file} « ${e.start} » → ${e.anchor}`);
        expect(missing).toEqual([]);
    });
    it('chaque infobulle du code est inscrite dans la carte', () => {
        const unmapped = tooltips.filter((t) => !TOOLTIP_GUIDE_MAP.some((e) => e.file === t.file && t.text.startsWith(norm(e.start))))
            .map((t) => `${t.file} : ${t.text.slice(0, 70)}…`);
        expect(unmapped).toEqual([]);
    });
    it('chaque entrée de la carte correspond encore à une infobulle du code (pas d\'entrée orpheline)', () => {
        const orphans = TOOLTIP_GUIDE_MAP.filter((e) => !tooltips.some((t) => t.file === e.file && t.text.startsWith(norm(e.start))))
            .map((e) => `${e.file} : ${e.start}`);
        expect(orphans).toEqual([]);
    });
});
