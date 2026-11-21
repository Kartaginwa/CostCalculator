import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { PARTS } from './guideContent.js';
import { TIPS } from '../../tooltips.js';

// Étape 5 de la Phase 7 : le registre src/tooltips.js est l'unique source des infobulles. Ce test vérifie
// que chaque infobulle pointe vers une section du guide qui existe, reste courte, et que le code n'utilise
// que des clés connues (aucune infobulle orpheline ni en texte libre non approuvé).

const ROOT = process.cwd();
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

const files = [];
for (const dir of ['features', 'features/reports', 'components']) {
    for (const name of readdirSync(join(ROOT, 'src', dir)).filter((n) => n.endsWith('.jsx'))) {
        files.push([`${dir}/${name}`, readFileSync(join(ROOT, 'src', dir, name), 'utf-8')]);
    }
}
const allSource = files.map(([, s]) => s).join('\n');

describe('Registre des infobulles', () => {
    it('chaque infobulle avec lien pointe vers une ancre existante du guide', () => {
        const bad = Object.entries(TIPS).filter(([, t]) => !t.complet && !anchors.has(t.guide)).map(([k, t]) => `${k} -> ${t.guide}`);
        expect(bad).toEqual([]);
    });
    it('chaque texte est court (≤ 150 caractères) et non vide', () => {
        const bad = Object.entries(TIPS).filter(([, t]) => !t.text || t.text.length > 150).map(([k]) => k);
        expect(bad).toEqual([]);
    });
    it('aucun vocabulaire banni ni terme technique interne', () => {
        const forbidden = /\bplats?\b|channelPrices|facility-sustaining|food cost|\(retiré le/i;
        const bad = Object.entries(TIPS).filter(([, t]) => forbidden.test(t.text)).map(([k]) => k);
        expect(bad).toEqual([]);
    });
    it('toute clé utilisée dans le code existe dans le registre', () => {
        const used = [...allSource.matchAll(/\b(?:tip|tooltip|tooltipText)="([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
        const tipProps = [...allSource.matchAll(/\btip:\s*"([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
        const unknown = [...used, ...tipProps].filter((k) => !TIPS[k]);
        expect(unknown).toEqual([]);
    });
    it('aucune infobulle orpheline : chaque clé du registre est utilisée', () => {
        const orphans = Object.keys(TIPS).filter((k) => !allSource.includes(`"${k}"`));
        expect(orphans).toEqual([]);
    });
    it('aucun <Tooltip text=…> libre sauf texte calculé avec ancre du guide', () => {
        const free = [...allSource.matchAll(/<Tooltip\s+text=[\s\S]*?\/>/g)].map((m) => m[0]).filter((s) => !s.includes('…') && !/guide="guide-[a-z0-9-]+"/.test(s));
        expect(free).toEqual([]);
    });
});
