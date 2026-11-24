// Phase 2.3 : propagation du coût d'emballage aux rapports PDF/Excel. Vérifie que les deux
// exports n'échouent pas une fois un emballage réellement rattaché à un format, et que le
// fichier Excel exporté (base de données) contient bien le coût d'emballage du format et sa ligne d'emballage.
import { test, expect } from '@playwright/test';
import XLSX from 'xlsx-js-style';

test('exports PDF/Excel avec un emballage rattaché à un format : pas d\'erreur, données présentes', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // Rattache un emballage à "Saumon teriyaki, riz et légumes".
    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Production pour")').locator('~ select').selectOption({ label: 'Saumon teriyaki, riz et légumes' });
    await page.waitForTimeout(300);
    const packagingSection = page.locator('#tutorial-section-recipe-packaging');
    await packagingSection.locator('#tutorial-add-packaging-to-recipe').click();
    await page.waitForTimeout(200);
    const newRow = packagingSection.locator('tbody tr').last();
    await newRow.locator('input[placeholder="Saisir ou sélectionner…"]').click();
    await newRow.locator('input[placeholder="Saisir ou sélectionner…"]').fill('Pot de verre 500 ml');
    await page.locator('li:has-text("Pot de verre 500 ml")').first().click();
    await newRow.locator('input[inputmode="decimal"]').first().fill('1');
    await page.waitForTimeout(300);

    // Export Excel : vérifie le contenu réel du fichier.
    await page.locator('#tab-summary').click();
    await page.waitForTimeout(300);
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('Exporter vers Excel').click();
    const download = await downloadPromise;
    const path = await download.path();

    // Base de données Excel (refonte du 23/11) : le format porte un coût d'emballage, et la ligne d'emballage du pot de verre figure dans Lignes_emballage.
    const workbook = XLSX.readFile(path);
    const formats = XLSX.utils.sheet_to_json(workbook.Sheets['Formats']);
    const saumon = formats.find(row => String(row['produit']).includes('Saumon teriyaki'));
    expect(saumon).toBeTruthy();
    expect(saumon['coût_emballage_unité']).toBeGreaterThan(0);
    const packagingLines = XLSX.utils.sheet_to_json(workbook.Sheets['Lignes_emballage']);
    expect(packagingLines.some(row => String(row['produit']).includes('Saumon teriyaki') && String(row['emballage']).includes('Pot de verre 500 ml'))).toBe(true);

    // Export PDF : juste la garantie qu'il ne plante pas (contenu non inspecté, format binaire).
    await page.getByText('Générer un rapport PDF').click();
    const confirmBtn = page.getByText('Générer le PDF');
    await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        confirmBtn.click(),
    ]);
    await page.waitForTimeout(500);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
