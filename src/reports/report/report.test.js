import { describe, it, expect } from 'vitest';
import { demoInputs } from '../../engine/testing/demoFindingsContext.js';
import { getEmptyState } from '../../state/initialState.js';
import { computeProjectAnalysis } from '../../engine/analysisPipeline.js';
import { computeCalculatedGeneralInfo } from '../../engine/calculatedGeneralInfo.js';
import { calculateCostLines } from '../../engine/calculateCosts.js';
import { f, usd, pc, sgn, esc, longDate, shortMonth, marginCell, NBSP } from './format.js';
import { formatPeriod } from './period.js';
import { selectGlossary, termIsUsed } from './glossary.js';
import { buildReportModel } from './model.js';
import { ficheHtml } from './fiches.js';
import { computeKeyFindings } from '../../engine/keyFindings.js';
import { demoContext } from '../../engine/testing/demoFindingsContext.js';
import { dedupeFindings, objectiveFindings, evolutionFindings, overviewStrengths, resultsFindings, tabFindings } from '../../engine/findingSurfaces.js';
import { buildUnits, resolveOptions } from './buildReport.js';
import { hbars, niceScale, lineChart, waterfall } from './charts.js';
import { CHAPTERS } from './strings.js';

// Rapport PDF : formats, période, glossaire, modèle de données (chiffres du projet démo, égaux à ceux des écrans) et gabarits HTML (sans navigateur).
const clean = (s) => s.replace(/[\u00a0\u202f]/g, ' ');
const noMap = { marks: {}, chapters: {}, total: 0 };

describe('formats', () => {
    it('espace insécable pour les milliers, virgule décimale, vrai signe moins', () => {
        expect(f(1234567.891, 2)).toBe(`1${NBSP}234${NBSP}567,89`);
        expect(f(-12.5, 1)).toBe('−12,5');
        expect(usd(79713.59)).toBe(`79${NBSP}714${NBSP}$`);
        expect(pc(0.3457, 2)).toBe(`34,57${NBSP}%`);
        expect(sgn(5)).toBe('+5');
        expect(sgn(-5)).toBe('−5');
    });
    it('une valeur absente s\'imprime « — » : jamais NaN, undefined ni null', () => {
        for (const v of [null, undefined, NaN, Infinity, 'x']) { expect(f(v)).toBe('—'); expect(usd(v)).toBe('—'); expect(pc(v)).toBe('—'); expect(sgn(v)).toBe('—'); }
    });
    it('un petit négatif qui s\'arrondit à zéro n\'a pas de signe moins', () => {
        expect(f(-0.0004, 2)).toBe('0,00');
    });
    it('échappe le HTML', () => {
        expect(esc('<b>"A" & B</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;');
        expect(esc(null)).toBe('');
    });
    it('dates en toutes lettres', () => {
        expect(longDate(new Date(2026, 10, 21))).toBe('21 novembre 2026');
        expect(longDate(new Date(2026, 9, 1))).toBe('1er octobre 2026');
        expect(shortMonth('2026-08-15T12:00:00')).toBe('août 26');
        expect(longDate('pas une date')).toBe('');
    });
    it('couleur d\'une cellule de marge : vert, rouge, blanc', () => {
        expect(marginCell(0.3)).toContain('22,163,74');
        expect(marginCell(-0.1)).toContain('220,38,38');
        expect(marginCell(0)).toContain('#fff');
        expect(marginCell(null)).toContain('#fff');
    });
});

describe('période', () => {
    it('imprimée en toutes lettres seulement si les deux dates existent', () => {
        expect(formatPeriod('2026-10-01', '2026-10-31')).toBe('du 1er octobre 2026 au 31 octobre 2026');
        expect(formatPeriod('', '')).toBeNull();
        expect(formatPeriod('2026-10-01', '')).toBeNull();
        expect(formatPeriod(undefined, '2026-10-31')).toBeNull();
    });
    it('une date invalide ou une fin avant le début ne s\'imprime pas', () => {
        expect(formatPeriod('2026-02-31', '2026-03-01')).toBeNull();
        expect(formatPeriod('2026-10-31', '2026-10-01')).toBeNull();
        expect(formatPeriod('octobre', '2026-10-01')).toBeNull();
    });
});

describe('glossaire', () => {
    it('ne garde que les termes présents dans le texte, au singulier ou au pluriel', () => {
        const terms = [{ term: 'Marge brute', def: 'a' }, { term: 'Perte en stock', def: 'b' }, { term: 'Point mort (seuil de rentabilité)', def: 'c' }, { term: 'Analyse ABC', def: 'd' }, { term: 'Lot', def: 'e' }];
        const text = '<p>La marge brute et les pertes en stock. Le point mort baisse. Un classement ABC.</p> Un lotissement.';
        expect(selectGlossary(text, terms).map(t => t.term)).toEqual(['Marge brute', 'Perte en stock', 'Point mort (seuil de rentabilité)', 'Analyse ABC']);
    });
    it('un mot n\'est pas trouvé à l\'intérieur d\'un autre (lot / lotissement)', () => {
        expect(termIsUsed('Lot', 'un lotissement')).toBe(false);
        expect(termIsUsed('Lot', 'un lot de 20 portions')).toBe(true);
        expect(termIsUsed('Lot', 'des lots')).toBe(true);
    });
    it('les renvois du guide [[ancre|texte]] ne gardent que le texte', () => {
        const r = selectGlossary('marge', [{ term: 'Marge', def: 'Voir la [[guide-x|marge nette]] et [[guide-y]].' }]);
        expect(r[0].def).toBe('Voir la marge nette et guide-y.');
    });
    it('sur le texte du démo : une sélection (pas tout le glossaire), sans renvoi brut', () => {
        const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
        const m = buildReportModel({ project: { ...state, trackingPoints }, analysisData, calculatedGeneralInfo });
        const text = buildUnits(m, { chapters: ['1', '2', '3', '4', '5', '6'] }, noMap).map(u => u.html).join(' ');
        const used = selectGlossary(text);
        expect(used.length).toBeGreaterThan(10);
        expect(used.length).toBeLessThan(75);
        used.forEach(d => expect(d.def).not.toContain('[['));
    });
});

describe('graphiques', () => {
    it('une série vide ou absente ne trace rien', () => {
        expect(hbars([])).toBe('');
        expect(hbars([{ n: 'a', v: NaN }])).toBe('');
        expect(lineChart({ labels: ['a', 'b'], series: [{ name: 'x', color: '#000', vals: [null, null] }], ymin: 0, ymax: 1, ystep: 1 })).toBe('');
        expect(waterfall([])).toBe('');
        expect(waterfall([{ label: 'a', value: 0, total: true }, { label: 'b', value: 1 }])).toBe('');
    });
    it('un graphique en barres court ne se coupe pas ; un long (plus de 12 lignes) se coupe entre deux lignes', () => {
        const short = hbars(Array.from({ length: 5 }, (_, i) => ({ n: `n${i}`, v: i + 1 })));
        expect(short).not.toContain('data-split');
        expect((short.match(/data-keep="next"/g) || []).length).toBe(4);
        const long = hbars(Array.from({ length: 13 }, (_, i) => ({ n: `n${i}`, v: i + 1 })));
        expect(long).toContain('data-split="items"');
        expect(long).not.toContain('data-keep');
    });
    it('échelle ronde', () => {
        expect(niceScale([41.5, 46], { ticks: 3 })).toMatchObject({ min: 40, max: 46 });
        expect(niceScale([3, 3])).toEqual({ min: 3, max: 4, step: 0.25 });
        expect(niceScale([])).toEqual({ min: 0, max: 1, step: 1 });
    });
    it('une courbe ne contient jamais NaN', () => {
        const svg = lineChart({ labels: ['a', 'b', 'c'], series: [{ name: 'x', color: '#000', vals: [1, null, 3], endLabel: '3 %' }], ymin: 0, ymax: 4, ystep: 1 });
        expect(svg).not.toMatch(/NaN|undefined/);
        expect(svg).toContain('<polyline');
    });
});

describe('modèle de données (démo)', () => {
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const m = buildReportModel({ project: { ...state, trackingPoints, companyName: 'Boréal', logoUrl: 'data:image/png;base64,AAA' }, analysisData, calculatedGeneralInfo });

    it('les indicateurs sont ceux de la Vue d\'ensemble', () => {
        expect(m.kpis.material).toBe(analysisData.weightedMaterialCost);
        expect(m.kpis.grossMargin).toBe(analysisData.weightedGrossMargin);
        expect(m.kpis.revenue).toBe(analysisData.menuRevenue);
        expect(m.kpis.safety.ratio).toBeCloseTo(0.1389, 3);
        expect(m.targets).toEqual({ material: 32, packaging: 8, labor: 22, grossMargin: 40 });
    });
    it('la cascade du revenu au bénéfice reprend les totaux par canal', () => {
        expect(m.cascade.revenue).toBeCloseTo(79713.59, 2);
        expect(m.cascade.net).toBeCloseTo(6299.49, 2);
    });
    it('une fiche par format actif, avec sa cascade, sa recette et ses constats', () => {
        expect(m.fiches).toHaveLength(12);
        const chili = m.fiches.find(x => x.name.startsWith('Chili'));
        expect(chili.cascade.channels).toHaveLength(3);
        expect(chili.findings.map(x => x.id)).toContain('sku-loss-fmt_chili');
        expect(chili.lines.ingredients.length).toBeGreaterThan(0);
        expect(chili.topIngredients).toHaveLength(3);
        expect(chili.topIngredients[0].name).toMatch(/Bœuf/);
        expect(chili.cls).toBe('cows');
    });
    it('le détail de recette d\'une fiche est celui du moteur (mêmes lignes que calculateCostLines)', () => {
        const row = analysisData.activeProducts.find(r => r.id === 'fmt_chili');
        const product = state.products.find(p => p.id === row.productId);
        const lines = calculateCostLines(product, calculatedGeneralInfo, state.ingredientsList, state.products, state.laborDatabase, row.format, state.basePackaging);
        expect(m.fiches.find(x => x.id === 'fmt_chili').lines).toEqual(lines);
    });
    it('la moyenne de bénéfice brut par heure est celle de l\'écran Main-d\'œuvre (87,39 $/h)', () => {
        expect(m.labor.average).toBeCloseTo(87.39, 2);
    });
    it('les achats : fournisseurs, ABC, perte en stock, prix volatils', () => {
        const ing = m.supply.ing;
        expect(ing.total).toBeCloseTo(19823, 0);
        expect(ing.providers[0].provider).toBe('Boucherie Nordique');
        expect(ing.topLoss.name).toMatch(/Bœuf/);
        expect(ing.abc.A.length).toBe(5);
        expect(m.supply.pkg.hasData).toBe(true);
    });
    it('chaque chapitre a ses données et les annexes listent les catalogues', () => {
        expect(Object.values(m.availability).every(v => v === null)).toBe(true);
        expect(m.catalogues.ingredients).toHaveLength(18);
        expect(m.catalogues.packaging).toHaveLength(8);
        expect(m.company).toEqual({ name: 'Boréal', logo: 'data:image/png;base64,AAA' });
    });
    it('Forces et faiblesses : les constats majeurs du groupe « structure », avec le renvoi à leur page', () => {
        const all = [...m.findings.strengths.forces, ...m.findings.strengths.faiblesses];
        expect(all.length).toBeGreaterThan(3);
        expect(all.every(x => x.severity === 'major' && x.group === 'structure')).toBe(true);
        expect(all.every(x => typeof x.mark === 'string')).toBe(true);
    });
    it('un texte identique n\'est imprimé qu\'une fois par liste (constat agrégé et constat par entité qui disent la même chose)', () => {
        expect(dedupeFindings([{ title: 'a', detail: 'b', id: 1 }, { title: 'a', detail: 'b', id: 2 }, { title: 'a', detail: 'c', id: 3 }]).map(x => x.id)).toEqual([1, 3]);
        const lists = [m.findings.objectives.forces, m.findings.objectives.faiblesses, m.findings.evolution.forces, m.findings.evolution.faiblesses, m.findings.strengths.forces, m.findings.strengths.faiblesses,
            m.findings.results, ...Object.values(m.findings.tabs), ...m.fiches.map(f => f.findings)];
        for (const list of lists) { const keys = list.map(x => `${x.title}|${x.detail}`); expect(new Set(keys).size).toBe(keys.length); }
    });
    it('aucune valeur non finie dans le modèle', () => {
        const bad = [];
        const walk = (v, path) => {
            if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path);
            else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
        };
        walk({ ...m, findings: undefined }, 'm');
        expect(bad).toEqual([]);
    });
});

describe('mêmes adresses que l\'application (engine/findingSurfaces.js)', () => {
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const m = buildReportModel({ project: { ...state, trackingPoints, companyName: 'Boréal' }, analysisData, calculatedGeneralInfo });
    const all = computeKeyFindings(demoContext(), { entities: true }).all;
    const ids = (list) => list.map(x => x.id);

    it('chapitre 1 : les trois blocs de la Vue d\'ensemble, mêmes constats dans le même ordre', () => {
        const o = objectiveFindings(all), e = evolutionFindings(all), s = overviewStrengths(all);
        expect(ids([...m.findings.objectives.forces, ...m.findings.objectives.faiblesses]).sort()).toEqual(ids(o).sort());
        expect(ids([...m.findings.evolution.forces, ...m.findings.evolution.faiblesses]).sort()).toEqual(ids(e).sort());
        expect(ids(m.findings.strengths.forces)).toEqual(ids(s.forces));
        expect(ids(m.findings.strengths.faiblesses)).toEqual(ids(s.faiblesses));
    });
    it('chapitres 3 à 6 : le bandeau de chaque sous-onglet, tel que l\'application l\'affiche', () => {
        for (const tab of ['portfolio', 'bySku', 'byChannel', 'byActivity', 'ingredients', 'packaging', 'labor']) {
            expect(ids(m.findings.tabs[tab]), tab).toEqual(ids(tabFindings(all, tab).all));
        }
        expect(ids(m.supply.ing.findings)).toEqual(ids(tabFindings(all, 'ingredients').all));
        expect(ids(m.supply.pkg.findings)).toEqual(ids(tabFindings(all, 'packaging').all));
    });
    it('chapitre 2 : les constats généraux non majeurs qui n\'ont aucune autre adresse', () => {
        expect(ids(m.findings.results)).toEqual(ids(resultsFindings(all)));
        expect(m.findings.results.length).toBeGreaterThan(0);
    });
    it('un constat par format n\'est que dans la fiche de ce format', () => {
        const everywhere = [...m.findings.objectives.forces, ...m.findings.objectives.faiblesses, ...m.findings.evolution.forces, ...m.findings.evolution.faiblesses,
            ...m.findings.strengths.forces, ...m.findings.strengths.faiblesses, ...m.findings.results, ...Object.values(m.findings.tabs).flat()];
        expect(everywhere.filter(x => x.subject?.type === 'format')).toEqual([]);
        m.fiches.forEach(F => F.findings.filter(x => x.subject?.type === 'format').forEach(x => expect(x.subject.id).toBe(F.id)));
    });
    it('la gravité du moteur est reprise : chaque liste est triée du plus grave au moins grave', () => {
        const rank = { major: 3, medium: 2, minor: 1 };
        for (const list of [m.findings.results, ...Object.values(m.findings.tabs), ...m.fiches.map(f => f.findings)]) {
            const s = list.map(x => rank[x.severity]);
            expect(s).toEqual([...s].sort((a, b) => b - a));
        }
    });
    it('fiche : les constats du produit viennent APRÈS la cascade de marge par canal, avant la recette détaillée', () => {
        const chili = m.fiches.find(f => f.id === 'fmt_chili');
        const html = ficheHtml(chili, m);
        const iCascade = html.indexOf('Cascade de marge par canal'), iFindings = html.indexOf('Constats du produit'), iRecipe = html.indexOf('Recette détaillée'), iTiles = html.indexOf('Coût de production (total)');
        expect(iTiles).toBeGreaterThan(0);
        expect(iCascade).toBeGreaterThan(iTiles);
        expect(iFindings).toBeGreaterThan(iCascade);
        expect(iRecipe).toBeGreaterThan(iFindings);
    });
    it('sections : titres des constats par sous-onglet, comme dans l\'application', () => {
        const units = buildUnits(m, {}, noMap), html = (c) => units.find(u => u.chapter === c).html;
        const order = (h, titles) => { const idx = titles.map(x => h.indexOf(x)); idx.forEach(i => expect(i).toBeGreaterThan(-1)); expect([...idx].sort((a, b) => a - b)).toEqual(idx); };
        order(html('1'), ['Objectifs stratégiques', 'Amélioration / détérioration', 'Forces et faiblesses']);
        expect(html('2')).toContain('Constats complémentaires');
        order(html('3'), ['Constats : Portefeuille', 'Constats : Par SKU']);
        order(html('4'), ['Constats : Par canal', 'Les activités de production', 'Constats : Par activité']);
        expect(html('5')).toContain('Constats : Ingrédients');
        expect(html('6')).toContain('Constats : Main-d\'œuvre');
    });
});

describe('gabarits HTML (démo)', () => {
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const project = { ...state, trackingPoints, companyName: 'Boréal' };
    const m = buildReportModel({ project, analysisData, calculatedGeneralInfo });

    it('sept chapitres et les annexes, chacun une unité, dans l\'ordre', () => {
        expect(buildUnits(m, {}, noMap).map(u => u.chapter)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'A']);
    });
    it('aucun « NaN », « undefined », « null » ni « [object » dans le texte du rapport', () => {
        const html = buildUnits(m, { includeSalaries: true, comments: { 1: 'Un commentaire' } }, noMap).map(u => u.html).join(' ');
        const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
        expect(text).not.toMatch(/NaN|undefined|\bnull\b|\[object/);
        expect(html).not.toMatch(/="NaN|="undefined|NaN%|NaN,|\$NaN/);
    });
    it('chaque fiche commence sa propre page (saut forcé) et porte son repère', () => {
        const ch7 = buildUnits(m, {}, noMap).find(u => u.chapter === '7').html;
        expect((ch7.match(/data-break="before"/g) || []).length).toBe(12);
        expect((ch7.match(/data-mark="fiche:/g) || []).length).toBe(12);
    });
    it('un commentaire de la direction n\'est imprimé que s\'il est saisi', () => {
        const without = buildUnits(m, {}, noMap).map(u => u.html).join(' ');
        expect(without).not.toContain('Commentaire de la direction');
        const withC = buildUnits(m, { comments: { 2: 'Le creux d\'août suit la hausse du bœuf.' } }, noMap);
        expect(withC.find(u => u.chapter === '2').html).toContain('Commentaire de la direction');
        expect(withC.find(u => u.chapter === '2').html).toContain('Le creux d&#39;août'.replace('&#39;', "'"));
        expect(withC.filter(u => u.chapter !== '2').every(u => !u.html.includes('Commentaire de la direction'))).toBe(true);
        expect(buildUnits(m, { comments: { 2: '   ' } }, noMap).map(u => u.html).join(' ')).not.toContain('Commentaire de la direction');
    });
    it('un commentaire est échappé (aucun HTML injecté)', () => {
        const html = buildUnits(m, { comments: { 1: '<script>alert(1)</script>' } }, noMap)[0].html;
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
    it('l\'annexe des salaires n\'est imprimée que si on la demande', () => {
        const a0 = buildUnits(m, {}, noMap).find(u => u.chapter === 'A').html, a1 = buildUnits(m, { includeSalaries: true }, noMap).find(u => u.chapter === 'A').html;
        expect(a0).not.toContain('Annexe C');
        expect(a0).not.toContain('Mireille');
        expect(a1).toContain('Annexe C');
        expect(a1).toContain('Mireille');
    });
    it('seuls les chapitres choisis sont produits ; un chapitre sans données est écarté', () => {
        expect(buildUnits(m, { chapters: ['3', '6'] }, noMap).map(u => u.chapter)).toEqual(['3', '6']);
        const empty = { ...m, availability: { ...m.availability, '6': 'Aucune paie saisie.' } };
        expect(resolveOptions(empty, {}).chapters).not.toContain('6');
        expect(buildUnits(empty, {}, noMap).map(u => u.chapter)).not.toContain('6');
    });
    it('le glossaire suit les chapitres inclus : moins de chapitres, moins de termes', () => {
        const termsOf = (chapters) => { const a = buildUnits(m, { chapters }, noMap).find(u => u.chapter === 'A').html; return Number((/(\d+) termes employés/.exec(a) || [0, 0])[1]); };
        expect(termsOf(['A'])).toBeLessThan(termsOf(['1', '2', '3', '4', '5', '6', '7', 'A']));
    });
    it('les renvois « p. N » restent « … » tant que la carte des pages est vide, puis prennent la page du repère', () => {
        const ch1 = (map) => buildUnits(m, { chapters: ['1'] }, map)[0].html;
        expect(clean(ch1(noMap))).toContain('→ p. …');
        const map = { marks: { ingr: 13, resultats: 5, 'fiche:fmt_chili': 31 }, chapters: {}, total: 44 };
        expect(clean(ch1(map))).toContain('→ p. 13');
    });
    it('le texte de période ne figure que s\'il existe : sans dates, aucune ligne « Période analysée »', () => {
        expect(m.period).toBeNull();
        const withDates = buildReportModel({ project: { ...project, generalInfo: { ...project.generalInfo, startDate: '2026-10-01', endDate: '2026-10-31' } }, analysisData, calculatedGeneralInfo: { ...calculatedGeneralInfo, startDate: '2026-10-01', endDate: '2026-10-31' } });
        expect(withDates.period).toBe('du 1er octobre 2026 au 31 octobre 2026');
    });
    it('les chapitres du sommaire sont ceux de la liste de référence', () => {
        expect(CHAPTERS.map(c => c.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'A']);
    });
});

describe('projet vide', () => {
    const s = getEmptyState();
    const base = computeProjectAnalysis({ products: s.products, baseIngredients: s.ingredientsList, basePackaging: s.basePackaging, laborDatabase: s.laborDatabase, generalInfo: s.generalInfo, salesChannels: s.salesChannels, productionActivities: s.productionActivities, expenseLines: s.expenseLines, revenueLines: s.revenueLines, directCostLines: s.directCostLines, repartitionKeys: s.repartitionKeys });
    const info = computeCalculatedGeneralInfo({ generalInfo: base.generalInfo, products: s.products, baseIngredients: s.ingredientsList, laborDatabase: s.laborDatabase, productionActivities: s.productionActivities, salesChannels: s.salesChannels });
    const m = buildReportModel({ project: { ...s, trackingPoints: [] }, analysisData: base.data, calculatedGeneralInfo: info });

    it('ne plante pas : les chapitres sans données sont écartés, avec leur raison', () => {
        ['1', '2', '3', '4', '5', '6', '7'].forEach(id => expect(typeof m.availability[id]).toBe('string'));
        expect(buildUnits(m, {}, noMap).map(u => u.chapter)).toEqual(['A']);
    });
    it('aucun « NaN » ni « undefined » dans les annexes', () => {
        expect(buildUnits(m, {}, noMap)[0].html).not.toMatch(/NaN|undefined/);
    });
});
