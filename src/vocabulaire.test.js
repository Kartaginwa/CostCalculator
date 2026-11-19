import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

// Phase 7, étape 6 : garde-fous de langue. L'application est centrée sur la transformation alimentaire :
// pas de vocabulaire de restauration (« plat », « menu »), pas d'anglicismes d'affichage, une seule graphie
// de la marque, virgule décimale à l'écran. Le test lit le code source (hors commentaires et hors tests).
const ROOT = process.cwd();
const walk = (d, out = []) => {
    for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(jsx?)$/.test(n) && !/\.test\.js$/.test(n)) out.push(p);
    }
    return out;
};
const FILES = ['src/components', 'src/features', 'src/reports', 'src/tooltips.js', 'src/state/initialState.js', 'src/engine/projectChecks.js']
    .flatMap((p) => { const full = join(ROOT, p); return statSync(full).isDirectory() ? walk(full) : [full]; });

const lines = [];
for (const f of FILES) {
    let inBlock = false;
    readFileSync(f, 'utf-8').split('\n').forEach((raw, i) => {
        let t = raw.trim();
        if (inBlock) { if (t.includes('*/')) inBlock = false; return; }
        if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) inBlock = true; return; }
        if (t.startsWith('//') || t.startsWith('*')) return;
        t = t.replace(/\{\/\*.*?\*\/\}/g, '').replace(/\s\/\/ .*$/, '');
        lines.push({ file: relative(ROOT, f).split('\\').join('/'), n: i + 1, t });
    });
}
const find = (re, allow = () => false) => lines.filter((l) => re.test(l.t) && !allow(l.t)).map((l) => `${l.file}:${l.n} ${l.t.slice(0, 90)}`);

describe('Vocabulaire : transformation alimentaire, pas restauration', () => {
    it('le mot « plat » n\'apparaît plus dans les textes affichés', () => {
        const hits = find(/\bplats?\b/i, (t) => /platName|keywords:|à plat|\.plats|plats:|act_plats|rev_plats|prod_plat/.test(t));
        expect(hits).toEqual([]);
    });
    it('« menu » ne désigne plus les produits (seul « menu déroulant » est permis)', () => {
        const hits = find(/\bau menu\b|\bdu menu\b|\bvotre menu\b|\bMenu\b(?! déroulant)/, (t) => /menuRevenue|tutorial-section-info-menu|guide-concept-menu|guide-param-col-menu|MENU DÉROULANT|menu déroulant|ce menu|ouvre un menu|Menu\.|setMenu|Menu\(/.test(t));
        expect(hits).toEqual([]);
    });
    it('aucun anglicisme d\'affichage (Food cost, Coût MO, M-O, Choose File)', () => {
        expect(find(/[Ff]ood cost|Coût MO\b|\bM-O\b|Choose File/)).toEqual([]);
    });
    it('une seule graphie de la marque : TransfoCalculateur', () => {
        expect(find(/Resto Calculateur|Resto-Calculateur/)).toEqual([]);
    });
    it('les nombres s\'affichent avec la virgule : plus de .toFixed() direct dans l\'interface ni les rapports', () => {
        const hits = find(/\.toFixed\(/, (t) => /Number\(|parseFloat|\.split\(|\?\? 0\)\.toFixed/.test(t))
            .filter((h) => /^src\/(features|reports|components)\//.test(h) && !h.startsWith('src/components/guide/guideFormat.js'));
        expect(hits).toEqual([]);
    });
    it('dates : un seul format français (fr-CA), pas de fr-FR', () => {
        expect(find(/'fr-FR'/)).toEqual([]);
    });
});
