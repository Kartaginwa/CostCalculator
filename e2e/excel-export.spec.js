// Export Excel « base de données » (refonte du 23/11) : le classeur téléchargé contient toutes les feuilles, des en-têtes colorés (bleu = saisi, gris = calculé),
// des nombres véritables, les allergènes en français, et des feuilles qui se relient par leurs identifiants.
import { test, expect } from '@playwright/test';
import XLSX from 'xlsx-js-style';

const exportDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();
    await page.locator('#tab-summary').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('Exporter vers Excel').click();
    const download = await downloadPromise;
    return { download, workbook: XLSX.readFile(await download.path(), { cellStyles: true }) };
};

test('le classeur téléchargé est une base de données : feuilles à plat, en-têtes colorés, nombres véritables', async ({ page }) => {
    const { download, workbook } = await exportDemo(page);
    expect(download.suggestedFilename()).toMatch(/^base_de_donnees_.*\.xlsx$/);
    expect(workbook.SheetNames.slice(0, 2)).toEqual(['Lisez-moi', 'Base_à_plat']);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(['Formats', 'Lignes_recette', 'Lignes_emballage', 'Étapes_production', 'Allergènes', 'Canaux', 'Ingrédients', 'Emballages', 'Employés', 'Frais_fixes', 'Frais_répartition', 'Suivi_global', 'Suivi_formats', 'Dictionnaire']));
    for (const name of workbook.SheetNames) expect(workbook.Sheets[name]['!merges'], name).toBeUndefined();

    // En-têtes : colonne saisie en bleu, colonne calculée en gris.
    const ws = workbook.Sheets['Formats'];
    const fill = (c) => (ws[XLSX.utils.encode_cell({ r: 0, c })].s?.fgColor?.rgb || '').toUpperCase().slice(-6);
    const labels = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
    expect(fill(labels.indexOf('sku'))).toBe('2563EB');
    expect(fill(labels.indexOf('coût_de_revient_unité'))).toBe('6B7280');

    // Une ligne par format et par canal ; les montants sont des nombres.
    const flat = XLSX.utils.sheet_to_json(workbook.Sheets['Base_à_plat']);
    expect(flat.length).toBeGreaterThan(14);
    const sold = flat.find(r => r['canal'] && typeof r['prix_net'] === 'number');
    expect(typeof sold['marge_nette_%']).toBe('number');
    expect(typeof sold['volume']).toBe('number');
});

test('les allergènes sont en français et chaque feuille de détail renvoie à un format existant', async ({ page }) => {
    const { workbook } = await exportDemo(page);
    const formatIds = new Set(XLSX.utils.sheet_to_json(workbook.Sheets['Formats']).map(r => r['format_id']));
    const allergens = XLSX.utils.sheet_to_json(workbook.Sheets['Allergènes']);
    expect(allergens.some(r => r['allergène'] === 'Soja')).toBe(true);
    expect(allergens.some(r => /^(soy|soybeans|milk|eggs|fish)$/.test(r['allergène']))).toBe(false);
    for (const sheet of ['Base_à_plat', 'Lignes_recette', 'Lignes_emballage', 'Étapes_production', 'Allergènes']) {
        for (const row of XLSX.utils.sheet_to_json(workbook.Sheets[sheet])) expect(formatIds.has(row['format_id']), `${sheet} : ${row['format_id']}`).toBe(true);
    }
    // Le dictionnaire décrit les colonnes (au moins une centaine de lignes).
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['Dictionnaire']).length).toBeGreaterThan(100);
});
