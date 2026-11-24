import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import { buildExcelModel } from './model.js';
import { buildWorkbook, HEADER_FILL } from './workbook.js';
import { demoInputs } from '../../engine/testing/demoFindingsContext.js';
import { computeProjectAnalysis } from '../../engine/analysisPipeline.js';
import { computeCalculatedGeneralInfo } from '../../engine/calculatedGeneralInfo.js';
import { getEmptyState } from '../../state/initialState.js';
import { MAJOR_ALLERGENS } from '../../utils.js';

// Export Excel « base de données » : le modèle ne lit que les moteurs de l'application. Ces tests vérifient (1) la structure d'une base utilisable par un tiers
// (feuilles à plat, identifiants qui se relient, aucune cellule fusionnée, une donnée absente reste vide), (2) la parité avec ce que l'application affiche,
// (3) le classeur écrit (couleurs d'en-tête, formats de nombres, relecture).

const buildFor = (state, trackingPoints = state.trackingPoints) => {
    const base = computeProjectAnalysis({
        products: state.products, baseIngredients: state.ingredientsList, basePackaging: state.basePackaging, laborDatabase: state.laborDatabase, generalInfo: state.generalInfo,
        salesChannels: state.salesChannels, productionActivities: state.productionActivities, expenseLines: state.expenseLines, revenueLines: state.revenueLines,
        directCostLines: state.directCostLines, repartitionKeys: state.repartitionKeys,
    });
    const calculatedGeneralInfo = computeCalculatedGeneralInfo({
        generalInfo: base.generalInfo, products: state.products, baseIngredients: state.ingredientsList, laborDatabase: state.laborDatabase,
        productionActivities: state.productionActivities, salesChannels: state.salesChannels,
    });
    return { analysisData: base.data, calculatedGeneralInfo, model: buildExcelModel({ project: { ...state, trackingPoints, companyName: 'Démo' }, analysisData: base.data, calculatedGeneralInfo, exportDate: '2026-11-23' }) };
};

const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
const { model } = (() => buildFor({ ...state }, trackingPoints))();
const byName = Object.fromEntries(model.sheets.map(s => [s.name, s]));
const idsOf = (name, key) => new Set(byName[name].rows.map(r => r[key]));

describe('structure du classeur', () => {
    it('les feuilles ont un nom valide et unique, Lisez-moi en premier et Base_à_plat en deuxième', () => {
        const names = model.sheets.map(s => s.name);
        expect(new Set(names.map(n => n.toLowerCase())).size).toBe(names.length);
        for (const n of names) { expect(n.length).toBeLessThanOrEqual(31); expect(n).not.toMatch(/[:\\/?*[\]]/); }
        expect(names.slice(0, 2)).toEqual(['Lisez-moi', 'Base_à_plat']);
        expect(names).toEqual(expect.arrayContaining(['Formats', 'Lignes_recette', 'Lignes_emballage', 'Étapes_production', 'Allergènes', 'Canaux', 'Activités', 'Ingrédients', 'Emballages', 'Employés', 'Postes', 'Frais_fixes', 'Frais_répartition', 'Revenus', 'Coûts_directs', 'Suivi_global', 'Suivi_formats', 'Dictionnaire']));
    });
    it('aucune feuille ne contient d\'objets de l\'ancien export (pas de résumé, pas de fiche par format)', () => {
        expect(model.sheets.some(s => /^Fiche|^Résumé|^Tableau de Bord/.test(s.name))).toBe(false);
    });
    it('chaque colonne a un libellé unique dans sa feuille, une nature et une définition ; chaque ligne n\'utilise que des colonnes connues', () => {
        for (const sh of model.sheets) {
            const labels = sh.cols.map(c => c.label);
            expect(new Set(labels).size, sh.name).toBe(labels.length);
            for (const c of sh.cols) { expect(['in', 'calc', 'meta'], `${sh.name}.${c.label}`).toContain(c.kind); if (c.kind !== 'meta') expect(c.def, `${sh.name}.${c.label}`).toBeTruthy(); }
            const keys = new Set(sh.cols.map(c => c.k));
            for (const r of sh.rows) for (const k of Object.keys(r)) expect(keys.has(k), `${sh.name}.${k}`).toBe(true);
        }
    });
    it('aucune valeur n\'est NaN, infinie ou undefined : une donnée absente est null', () => {
        for (const sh of model.sheets) for (const r of sh.rows) for (const [k, v] of Object.entries(r)) {
            expect(v === undefined, `${sh.name}.${k} undefined`).toBe(false);
            if (typeof v === 'number') expect(Number.isFinite(v), `${sh.name}.${k}`).toBe(true);
        }
    });
    it('le dictionnaire décrit chaque colonne de chaque feuille (hors Lisez-moi et lui-même), et Lisez-moi cite chaque feuille', () => {
        const described = model.sheets.filter(s => !['Lisez-moi', 'Dictionnaire'].includes(s.name));
        expect(byName['Dictionnaire'].rows.length).toBe(described.reduce((n, s) => n + s.cols.length, 0));
        const rubrics = byName['Lisez-moi'].rows.map(r => r.a);
        for (const s of described) expect(rubrics).toContain(`Feuille ${s.name}`);
    });
});

describe('parité avec les calculs de l\'application', () => {
    const rows = analysisData.productsWithCosts;
    it('Formats : une ligne par format, avec le coût de revient de l\'application', () => {
        expect(byName['Formats'].rows.length).toBe(rows.length);
        for (const r of rows) {
            const line = byName['Formats'].rows.find(x => x.format_id === r.id);
            expect(line.cout_revient).toBe(r.costs.totalCostPerPortion);
            expect(line.cout_matiere).toBe(r.costs.costMatierePerPortion);
        }
    });
    it('les composantes du coût de revient (matière, emballage, main-d\'œuvre, sous-traitance, vieillissement, frais fixes) s\'additionnent au total', () => {
        for (const l of byName['Formats'].rows) {
            const sum = l.cout_matiere + l.cout_emb + l.cout_mo + l.cout_sst + l.cout_vieil + l.cout_ind;
            expect(sum, l.format_id).toBeCloseTo(l.cout_revient, 6);
        }
    });
    it('Base_à_plat : une ligne par format et par canal, valeurs de channelBreakdown reprises telles quelles ; un format sans canal garde un canal et un prix vides', () => {
        const flat = byName['Base_à_plat'].rows;
        expect(flat.length).toBe(rows.reduce((n, r) => n + Math.max(1, r.channelBreakdown.length), 0));
        for (const r of rows) for (const cb of r.channelBreakdown) {
            const l = flat.find(x => x.format_id === r.id && x.canal_id === cb.channelId);
            expect(l.prix).toBe(cb.netPrice); expect(l.volume).toBe(cb.volume); expect(l.mn_p).toBe(cb.margeNettePercent); expect(l.seuil).toBe(cb.breakEvenUnits);
        }
        const noChannel = rows.filter(r => !r.channelBreakdown.length);
        expect(noChannel.length).toBeGreaterThan(0);
        for (const r of noChannel) { const l = flat.find(x => x.format_id === r.id); expect(l.canal).toBeNull(); expect(l.prix).toBeNull(); expect(l.mn_p).toBeNull(); }
    });
    it('Lignes_recette : le coût total des lignes d\'un format égale le coût des ingrédients de l\'application', () => {
        for (const r of rows) {
            const lines = byName['Lignes_recette'].rows.filter(x => x.format_id === r.id);
            if (!lines.length) continue;
            expect(lines.reduce((s, l) => s + l.matiere, 0), r.displayName).toBeCloseTo(r.costs.totalIngredientsCost, 6);
        }
    });
    it('Étapes_production : le coût d\'une étape est celui du moteur, la durée reste en secondes', () => {
        const steps = byName['Étapes_production'].rows;
        expect(steps.length).toBeGreaterThan(0);
        for (const s of steps) { expect(s.duree).toBeGreaterThan(0); expect(s.total).toBeGreaterThanOrEqual(s.direct); }
    });
    it('Ingrédients : un ingrédient acheté porte la quantité et le coût du rapport d\'achats', () => {
        const poulet = byName['Ingrédients'].rows.find(x => x.id === 'ing_poulet');
        const item = Object.values(analysisData.purchasingReportData.groupedByProvider).flatMap(g => g.items).find(i => i.id === 'ing_poulet');
        expect(poulet.cout).toBe(item.totalCost); expect(poulet.qte).toBe(item.totalQuantity); expect(poulet.perte).toBeCloseTo(0.06, 10);
    });
    it('Employés : taux chargé et coût total viennent de loadedHourlyRate', () => {
        const e = byName['Employés'].rows.find(x => x.nom === 'Mireille');
        expect(e.taux).toBe(32); expect(e.ch).toBeCloseTo(0.16, 10); expect(e.charge).toBeGreaterThan(32); expect(e.total).toBeCloseTo(e.charge * e.h, 8);
    });
    it('Postes : l\'utilisation est celle du rapport de productivité, en fraction', () => {
        const rowsP = calculatedGeneralInfo.productivityReport.rows;
        expect(byName['Postes'].rows.length).toBe(rowsP.length);
        for (const r of rowsP) expect(byName['Postes'].rows.find(x => x.poste === r.postName).util).toBeCloseTo(r.utilization / 100, 10);
    });
    it('Frais_répartition : la répartition reprend celle de l\'écran État des résultats et couvre le montant de chaque frais', () => {
        const fixed = byName['Frais_fixes'].rows;
        for (const f of fixed) {
            const parts = byName['Frais_répartition'].rows.filter(x => x.id === f.id);
            expect(parts.reduce((s, x) => s + x.montant, 0), f.label).toBeCloseTo(f.montant, 1);
        }
        const loyer = byName['Frais_répartition'].rows.filter(x => x.id === 'exp_loyer_prod');
        expect(loyer.map(x => `${x.cible}:${x.montant}`).sort()).toEqual(['Mets principaux surgelés:5000', 'Sauces et accompagnements:1500', 'Soupes et potages:2500'].sort());
    });
    it('Frais_fixes : la clé de répartition est lisible, jamais un code interne', () => {
        for (const f of byName['Frais_fixes'].rows) expect(f.cle).not.toMatch(/^(manual|sales|directCosts|activity:|channel:|custom:)/);
    });
    it('Suivi_global : une ligne par relevé, dans l\'ordre ; Suivi_formats : marges vides pour un format sans prix', () => {
        expect(byName['Suivi_global'].rows.map(r => r.nom)).toEqual(trackingPoints.map(t => t.name));
        const sf = byName['Suivi_formats'].rows;
        expect(sf.length).toBeGreaterThan(0);
        for (const r of sf) if (r.prix == null) { expect(r.mb).toBeNull(); expect(r.mn).toBeNull(); }
    });
    it('Canaux : une cascade de prix affiche « marge » ou « majoration » en français', () => {
        const types = new Set(byName['Canaux'].rows.map(r => r.type).filter(Boolean));
        expect([...types].sort()).toEqual(['majoration', 'marge']);
    });
});

describe('les feuilles se relient par leurs identifiants', () => {
    const formatIds = idsOf('Formats', 'format_id');
    it('chaque format_id d\'une feuille de détail existe dans Formats', () => {
        for (const n of ['Base_à_plat', 'Lignes_recette', 'Lignes_emballage', 'Étapes_production', 'Allergènes']) for (const r of byName[n].rows) expect(formatIds.has(r.format_id), `${n}\u00A0: ${r.format_id}`).toBe(true);
    });
    it('chaque ingrédient d\'une recette est dans Ingrédients ou est un format (sous-recette)', () => {
        const ing = idsOf('Ingrédients', 'id'), productIds = idsOf('Formats', 'produit_id');
        for (const r of byName['Lignes_recette'].rows) expect(ing.has(r.ing_id) || formatIds.has(r.ing_id) || productIds.has(r.ing_id), r.ing_id).toBe(true);
    });
    it('chaque emballage, canal et frais référencé existe', () => {
        const pkg = idsOf('Emballages', 'id'), canaux = idsOf('Canaux', 'canal_id'), frais = idsOf('Frais_fixes', 'id');
        for (const r of byName['Lignes_emballage'].rows) expect(pkg.has(r.pkg_id), r.pkg_id).toBe(true);
        for (const r of byName['Base_à_plat'].rows) if (r.canal_id) expect(canaux.has(r.canal_id), r.canal_id).toBe(true);
        for (const r of byName['Frais_répartition'].rows) expect(frais.has(r.id), r.id).toBe(true);
    });
    it('les identifiants sont uniques dans leur feuille', () => {
        for (const [n, k] of [['Formats', 'format_id'], ['Ingrédients', 'id'], ['Emballages', 'id'], ['Employés', 'id'], ['Frais_fixes', 'id'], ['Activités', 'id']]) {
            const ids = byName[n].rows.map(r => r[k]);
            expect(new Set(ids).size, n).toBe(ids.length);
        }
    });
});

describe('allergènes en français', () => {
    it('la feuille Allergènes et la colonne des ingrédients n\'utilisent que les noms français', () => {
        const french = new Set(MAJOR_ALLERGENS.map(a => a.name));
        for (const r of byName['Allergènes'].rows) expect(french.has(r.allergene), r.allergene).toBe(true);
        expect(byName['Allergènes'].rows.some(r => r.allergene === 'Soja')).toBe(true);
        for (const r of byName['Ingrédients'].rows) if (r.alg) for (const n of r.alg.split(', ')) expect(french.has(n), n).toBe(true);
        for (const r of byName['Base_à_plat'].rows) if (r.allergenes) for (const n of r.allergenes.split(', ')) expect(french.has(n), n).toBe(true);
    });
});

describe('une donnée absente reste absente', () => {
    it('un prix d\'achat vidé donne une cellule vide, pas 0', () => {
        const s = structuredClone(state);
        s.ingredientsList[0].purchasePrice = '';
        const { model: m } = buildFor(s, trackingPoints);
        expect(m.sheets.find(x => x.name === 'Ingrédients').rows[0].prix).toBeNull();
    });
    it('un projet vide produit un classeur sans erreur (feuilles présentes, aucune ligne de données)', () => {
        const { model: m } = buildFor(getEmptyState(), []);
        expect(m.sheets.length).toBe(model.sheets.length);
        expect(m.sheets.find(x => x.name === 'Formats').rows).toEqual([]);
        expect(m.sheets.find(x => x.name === 'Suivi_global').rows).toEqual([]);
    });
    it('un nom de produit avec des caractères spéciaux passe tel quel', () => {
        const s = structuredClone(state);
        s.products.find(x => !x.isIngredient).platName = 'Crème brûlée « maison » / 50 % : œuf';
        const { model: m } = buildFor(s, trackingPoints);
        expect(m.sheets.find(x => x.name === 'Formats').rows.some(r => r.produit.includes('Crème brûlée « maison » / 50 % : œuf'))).toBe(true);
    });
});

describe('classeur écrit', () => {
    const wb = buildWorkbook(XLSX, model);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const back = XLSX.read(bytes, { type: 'array', cellStyles: true });
    it('relu : mêmes feuilles, même nombre de lignes de données', () => {
        expect(back.SheetNames).toEqual(model.sheets.map(s => s.name));
        for (const sh of model.sheets) expect(XLSX.utils.sheet_to_json(back.Sheets[sh.name]).length, sh.name).toBe(sh.rows.length);
    });
    it('les en-têtes sont colorés : bleu pour une colonne saisie, gris pour une colonne calculée', () => {
        const ws = back.Sheets['Formats'];
        const cols = byName['Formats'].cols;
        const fill = (i) => (ws[XLSX.utils.encode_cell({ r: 0, c: i })].s?.fgColor?.rgb || '').toUpperCase().slice(-6);
        expect(fill(cols.findIndex(c => c.kind === 'in'))).toBe(HEADER_FILL.in);
        expect(fill(cols.findIndex(c => c.kind === 'calc'))).toBe(HEADER_FILL.calc);
    });
    it('aucune cellule fusionnée et un filtre automatique sur chaque feuille', () => {
        for (const n of back.SheetNames) { expect(back.Sheets[n]['!merges'], n).toBeUndefined(); expect(back.Sheets[n]['!autofilter'], n).toBeTruthy(); }
    });
    it('les nombres restent des nombres, avec leur format ($, %)', () => {
        const ws = back.Sheets['Base_à_plat'];
        const head = byName['Base_à_plat'].cols.map(c => c.label);
        const cell = (label, r) => ws[XLSX.utils.encode_cell({ r, c: head.indexOf(label) })];
        const first = byName['Base_à_plat'].rows.findIndex(r => r.mn_p != null) + 1;
        expect(cell('marge_nette_%', first).t).toBe('n'); expect(cell('marge_nette_%', first).z).toBe('0.0%');
        expect(cell('prix_net', first).z).toBe('"$"#,##0.00');
    });
});
