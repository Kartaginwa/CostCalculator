import { describe, it, expect } from 'vitest';
import { SCENARIOS, scenarioInputs } from '../../engine/testing/reportScenarios.js';
import { buildReportModel } from './model.js';
import { buildUnits, ALL_CHAPTER_IDS } from './buildReport.js';

// Recette du rapport PDF : cas limites (phase 7, 22/11). Pour chacun : le modèle se construit, les gabarits se produisent, et aucun texte ne contient « NaN »,
// « undefined », « null » ni « [object » ; un nom piégé (HTML, guillemets) est toujours échappé.
const map = { marks: {}, chapters: {}, total: 0 };
const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
const run = (name) => {
    const inputs = scenarioInputs(name);
    const model = buildReportModel(inputs);
    const units = buildUnits(model, { includeSalaries: true, comments: { 1: 'Commentaire.' } }, map);
    return { model, units, html: units.map(u => u.html).join('\n'), inputs };
};

describe.each(Object.keys(SCENARIOS))('scénario « %s »', (name) => {
    it('le modèle se construit et les gabarits se produisent, sans texte invalide', () => {
        const { model, units, html } = run(name);
        expect(units.length).toBeGreaterThan(0);
        const text = textOf(html);
        expect(text).not.toMatch(/NaN|undefined|\bnull\b|\[object|Infinity/);
        expect(html).not.toMatch(/="NaN|="undefined|="Infinity|NaN%|\$NaN|,NaN|NaN,/);
        // un chapitre indisponible n'est jamais produit ; un chapitre produit a sa raison absente
        for (const u of units) expect(model.availability[u.chapter]).toBeNull();
        for (const id of ALL_CHAPTER_IDS) if (model.availability[id]) expect(units.map(u => u.chapter)).not.toContain(id);
    });
});

describe('cas particuliers', () => {
    it('projet vide : seules les annexes sont possibles, et elles ne plantent pas', () => {
        const { model, units } = run('vide');
        expect(units.map(u => u.chapter)).toEqual(['A']);
        ['1', '2', '3', '4', '5', '6', '7'].forEach(id => expect(model.availability[id]).toBeTruthy());
    });
    it('sans PDS : « — » à la place du PDS, jamais un zéro', () => {
        const { model, html } = run('sans-pds');
        expect(model.portfolio.skuTable.every(r => r.pds === null)).toBe(true);
        expect(model.fiches.every(f => f.pds === null)).toBe(true);
        expect(html).toContain('PDS : <b>—</b>');
        expect(html).not.toContain('PDS : <b>0,00');
        // la cascade n'affiche aucun écart de maillon (« — »), tout en gardant les prix de vente et les marges
        expect(model.fiches[0].cascade.channels.every(c => c.totalDelta === null)).toBe(true);
    });
    it('sans point de référence : aucune courbe, aucun tableau d\'évolution, aucun relevé annoncé', () => {
        const { model, html } = run('sans-releves');
        expect(model.trend.count).toBe(0);
        expect(model.fiches.every(f => f.series.length === 0)).toBe(true);
        expect(html).not.toContain('Évolution des indicateurs');
        expect(html).not.toContain('Évolution de la marge brute');
        expect(html).not.toContain('Il y a 3 relevés');
    });
    it('un seul point de référence : pas de courbe (il faut au moins deux points), pas de comparaison', () => {
        const { html } = run('un-releve');
        expect(html).not.toContain('<polyline');
        expect(html).not.toContain('Il y a 12 mois');
    });
    it('sans chiffres réels : l\'invitation à les saisir, jamais un tableau de zéros', () => {
        const { model, html } = run('sans-chiffres-reels');
        expect(model.recon).toBeNull();
        expect(html).toContain('Saisissez vos chiffres réels');
        expect(html).not.toContain('Théorique (modèle)');
        expect(html).not.toContain('Réel</th>');
    });
    it('période : imprimée en toutes lettres seulement si les deux dates existent', () => {
        expect(run('demo').model.period).toBeNull();
        expect(run('avec-periode').model.period).toBe('du 1er octobre 2026 au 31 octobre 2026');
    });
    it('un seul produit : une fiche, des chapitres cohérents', () => {
        const { model, units } = run('un-produit');
        expect(model.fiches.length).toBeGreaterThanOrEqual(1);
        expect(model.fiches.length).toBeLessThanOrEqual(3); // le produit et ses sous-recettes actives
        expect(units.map(u => u.chapter)).toContain('7');
    });
    it('cinquante produits : cinquante fiches, une page chacune au moins', () => {
        const { model, units } = run('cinquante-produits');
        expect(model.fiches.length).toBeGreaterThanOrEqual(50);
        const ch7 = units.find(u => u.chapter === '7').html;
        expect((ch7.match(/data-break="before"/g) || []).length).toBe(model.fiches.length);
    });
    it('un format sans prix : la courbe de la fiche est en $/unité (4 lignes), pas en % du prix', () => {
        const { model } = run('produit-sans-prix');
        const chili = model.fiches.find(f => f.id === 'fmt_chili');
        expect(chili.priced).toBe(false);
        expect(chili.series.some(s => Number.isFinite(s['Coût matière ($/u.)']))).toBe(true);
    });
    it('un format sans prix : sa fiche imprime « — » pour les pourcentages du prix et garde ses coûts', () => {
        const { model } = run('produit-sans-prix');
        const chili = model.fiches.find(f => f.id === 'fmt_chili');
        expect(chili.costs.materialPct).toBeNull();
        expect(chili.costs.material).toBeGreaterThan(0);
    });
    it('noms piégés : le HTML et les guillemets sont échappés partout, rien n\'est exécutable', () => {
        const { html } = run('noms-pieges');
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<b>Bœuf</b>');
        expect(html).not.toContain('Vente <i>directe</i>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('Chili &amp; &quot;frites&quot;');
    });
    it('un seul canal : le tableau des produits n\'a qu\'une colonne de prix et de marge', () => {
        const { model, html } = run('un-canal');
        expect(model.portfolio.channelCols).toHaveLength(1);
        expect(model.fiches[0].cascade.channels).toHaveLength(1);
        expect(html).toContain('colspan="1"');
    });
    it('sans volume de vente : aucun revenu, les chapitres qui en dépendent sont écartés avec leur raison', () => {
        const { model } = run('sans-volumes');
        expect(model.kpis.revenue).toBeNull();
        expect(model.availability['1']).toBeTruthy();
    });
    it('sans nom ni logo : en-tête sans nom, couverture sans « undefined »', () => {
        const { model } = run('sans-nom-ni-logo');
        expect(model.company).toEqual({ name: '', logo: null });
    });
    it('sans aucune main-d\'œuvre : le chapitre 6 est écarté', () => {
        const { model, units } = run('aucun-poste');
        expect(model.availability['6']).toBeTruthy();
        expect(units.map(u => u.chapter)).not.toContain('6');
    });
    it('ingrédients sans fournisseur : regroupés sous « Non spécifié », sans texte invalide', () => {
        const { html } = run('sans-fournisseur');
        expect(html).toContain('Non spécifié');
    });
});

describe('grand projet', () => {
    it('chaque quadrant de la matrice montre au plus 15 produits, et renvoie au tableau pour les autres', () => {
        const { html } = run('cinquante-produits');
        const quadrant = /<div class="q cow"[\s\S]*?<\/ul><\/div>/.exec(html);
        expect(quadrant).toBeTruthy();
        expect((quadrant[0].match(/<li/g) || []).length).toBeLessThanOrEqual(16); // 15 noms + la ligne « … et N autres »
        expect(html).toMatch(/… et \d+ autres \(voir le tableau/);
    });
    it('le classement par contribution se coupe entre deux lignes (plus de 12 produits)', () => {
        const { html } = run('cinquante-produits');
        expect(html).toContain('data-split="items" data-split-min="3"');
    });
});
