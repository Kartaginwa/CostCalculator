// Parité entre l'ancien PDF et le nouveau rapport (phase 7, 22/11) : chaque ligne de la fiche de parité (Projet_Claude/13-Fiche-Parite-Export-PDF.md) dont le statut est
// « conservé », « amélioré » ou « déplacé » est vérifiée dans le texte du PDF imprimé du projet démo. Les éléments retirés (camemberts, nom de la méthode
// d'attribution, détail base / perte / rendement par ligne, coût direct et indirect par étape) sont vérifiés ABSENTS : la perte est assumée, pas accidentelle.
import { test, expect } from '@playwright/test';

const compose = (page) => page.evaluate(async () => {
    const { demoInputs } = await import('/src/engine/testing/demoFindingsContext.js');
    const { buildReportModel } = await import('/src/reports/report/model.js');
    const { buildReport } = await import('/src/reports/report/buildReport.js');
    const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
    const model = buildReportModel({ project: { ...state, trackingPoints, companyName: 'Boréal Mets Préparés inc.' }, analysisData, calculatedGeneralInfo });
    const r = await buildReport({ model }, { generatedOn: new Date(2026, 10, 22), includeSalaries: true });
    document.body.innerHTML = r.body;
    const style = document.createElement('style'); style.textContent = r.css; document.head.appendChild(style);
    return {
        marks: r.map.marks, chapters: r.map.chapters, total: r.totalPages,
        facts: {
            products: model.fiches.map(f => ({ id: f.id, name: f.name, activity: f.activity, ingredients: f.lines.ingredients.map(l => l.name), packaging: f.lines.packaging.map(l => l.name), steps: f.lines.steps.map(l => l.name), allergens: f.allergens, resale: f.status === 'resale' })),
            ingredients: model.catalogues.ingredients.map(i => i.name), packaging: model.catalogues.packaging.map(i => i.name),
            providers: [...new Set(model.catalogues.ingredients.map(i => i.provider))],
            posts: model.labor.posts.map(p => p.name), employees: model.labor.posts.flatMap(p => p.employees.map(e => e.name)),
            contribution: model.portfolio.contribution.map(c => c.name),
        },
    };
});

const norm = (s) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

test('parité : tout ce que l\'ancien PDF imprimait se retrouve dans le nouveau rapport', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto('/');
    const out = await compose(page);
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push(norm((await (await doc.getPage(i)).getTextContent()).items.map(t => t.str).join(' ')));
    const all = pages.join('\n');
    const has = (txt, label) => expect(all, label || txt).toContain(norm(txt));
    const { facts } = out;

    // --- Pages générales ---
    // Couverture : titre, « présenté à », date ; en-tête : entreprise ; pied : date et « Page n sur N »
    has('Rapport d’analyse du coût de revient'); has('Préparé à l’attention des gestionnaires de Boréal Mets Préparés inc.'); has('Date : 22 novembre 2026');
    expect(pages[3]).toContain('Boréal Mets Préparés inc.'); has('Rapport généré le 22 novembre 2026');
    pages.slice(1).forEach((t, i) => expect(t).toContain(`Page ${i + 2} sur ${out.total}`));
    // Paramètres généraux : frais fixes et main-d'œuvre dans la cascade du revenu au bénéfice, et la masse salariale
    has('Du revenu au bénéfice net'); has('Frais fixes'); has('Utilisation de la masse salariale');
    // KPI globaux
    for (const k of ['Coût matière', 'Coût d’emballage', 'Coût de main-d’œuvre', 'Marge brute', 'Point mort', 'Marge de sécurité']) has(k, `KPI ${k}`);
    // Classement par contribution : tous les produits (l'ancien PDF n'en imprimait que 5)
    has('Classement par contribution totale au profit');
    facts.contribution.forEach(n => has(n, `contribution ${n}`));
    // Matrice stratégique : quatre quadrants et leurs consignes
    has('Matrice stratégique');
    for (const q of ['Étoiles', 'Vaches à lait', 'Dilemmes', 'Poids morts', 'Mettez-les en avant', 'Optimisez leurs coûts', 'Envisagez de les promouvoir', 'Pensez à les retirer']) has(q, `quadrant ${q}`);
    // ABC des ingrédients (et des emballages) : toutes les lignes
    has('Classement ABC');
    facts.ingredients.forEach(n => has(n, `ABC ingrédient ${n}`)); facts.packaging.forEach(n => has(n, `ABC emballage ${n}`));
    // Synthèse des achats : coût net, perte stock, achat requis ; fournisseurs
    for (const k of ['Coût net (ingrédients)', 'Perte stock prévue', 'Achat requis (ingrédients)', 'Coût net (emballages)', 'Achat requis (emballages)', 'Fournisseurs']) has(k, `achats ${k}`);
    facts.providers.forEach(n => has(n, `fournisseur ${n}`));
    // Rapport de productivité par poste : mêmes colonnes
    has('Rapport de productivité par poste');
    for (const k of ['Heures attendues', 'Heures réelles', 'Différence', 'Taux d’utilisation']) has(k, `productivité ${k}`);
    facts.posts.forEach(n => has(n, `poste ${n}`));
    // Évolution globale : les quatre lignes de l'application, dont l'emballage ajouté
    has('Évolution des indicateurs');
    for (const k of ['Marge brute', 'Coût matière', 'Coût emballage', 'Coût main-d’œuvre']) has(k, `évolution ${k}`);
    has('Il y a 3 relevés'); has('Il y a 12 mois');
    // Page de titre vide de la « partie 2 » : supprimée
    expect(all).not.toMatch(/Partie 2/);

    // --- Fiche d'un produit (une par format) ---
    const markPage = (id) => out.marks[`fiche:${id}`];
    const sorted = facts.products.map(p => markPage(p.id)).sort((a, b) => a - b);
    for (const p of facts.products) {
        const from = markPage(p.id), next = sorted.find(x => x > from) || (out.chapters.chA - 0);
        const seg = pages.slice(from - 1, next - 1).join('\n');
        const inSeg = (txt, label) => expect(seg, `fiche « ${p.name} » : ${label || txt}`).toContain(norm(txt));
        // Le nom d'une ligne de recette peut passer à la ligne dans sa petite cellule : le PDF intercale alors les autres colonnes entre ses mots (ou coupe un mot composé au trait d'union) ; on vérifie chaque mot.
        const inSegWords = (txt, label) => norm(txt).split(/[ -]/).filter(w => w.length > 2).forEach(w => expect(seg, `fiche « ${p.name} » : ${label} (mot « ${w} »)`).toContain(w));
        inSeg(p.name);
        for (const k of ['PDS :', 'Unités produites :', 'Format par portion :', 'Statut :', 'Allergènes :']) inSeg(k);
        p.allergens.forEach(a => inSeg(a, `allergène ${a}`));
        // KPI du produit : coûts et ratios, marge de contribution, cascade jusqu'à la marge nette et au point mort, point mort de CHAQUE canal
        for (const k of ['Coût de production (total)', 'Cascade de marge par canal', 'Bénéfice brut', 'Marge brute', 'Bénéfice net', 'Marge nette', 'Point mort', 'Frais fixes totaux par unité']) inSeg(k);
        if (!p.resale) {
            // Recette : chaque ligne de matières, d'emballage et chaque étape, avec leurs totaux
            p.ingredients.forEach(n => inSegWords(n, `matière ${n}`)); p.packaging.forEach(n => inSegWords(n, `emballage ${n}`)); p.steps.forEach(n => inSegWords(n, `étape ${n}`));
            inSeg('Recette détaillée'); inSeg('Ingrédient'); inSeg('Étape'); inSeg('Matières');
            expect(seg).toContain('Marge de contribution');
        }
        // Évolution du produit
        inSeg('Évolution des indicateurs du produit');
    }

    // --- Annexes ---
    has('Annexe A — Ingrédients'); has('Annexe B — Emballages'); has('Annexe C — Équipe'); has('Annexe D — Glossaire');
    for (const k of ['Fournisseur', 'Format d’achat', 'Prix d’achat', 'Perte', 'Prix unitaire']) has(k, `annexe ${k}`);
    for (const k of ['Employé', 'Salaire horaire', 'Charges', 'Vacances', 'Heures payées', 'Coût chargé']) has(k, `annexe C ${k}`);
    facts.employees.forEach(n => has(n, `employé ${n}`));

    // --- Retiré, et assumé (jamais par accident) ---
    expect(all).not.toContain('Méthode d\'attribution');            // nom de la méthode des frais indirects : le modèle passe aux CICI
    expect(all).not.toMatch(/Prix de vente \(camembert\)|Répartition du prix de vente/); // camemberts : remplacés par les tuiles et la cascade
    expect(all).not.toContain('Coût direct');                     // vocabulaire direct / indirect de la main-d'œuvre : absent du rapport
    expect(all).not.toContain('Rendement (%)');                   // rendement par ligne : retiré (décision D2)
});
