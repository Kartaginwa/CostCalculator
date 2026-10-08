// Phase 2.3 : propagation du coût d'emballage aux rapports PDF/Excel. Vérifie que les deux
// exports n'échouent pas une fois un emballage réellement rattaché à un format, et que le
// fichier Excel exporté contient bien les nouvelles colonnes/lignes de coût d'emballage.
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

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
    await page.locator('h1:has-text("Recette et calcul pour")').locator('~ select').selectOption({ label: 'Saumon teriyaki, riz et légumes' });
    await page.waitForTimeout(300);
    const packagingSection = page.locator('#tutorial-section-recipe-packaging');
    await packagingSection.locator('#tutorial-add-packaging-to-recipe').click();
    await page.waitForTimeout(200);
    const newRow = packagingSection.locator('tbody tr').last();
    await newRow.locator('input[placeholder="Saisir ou sélectionner..."]').click();
    await newRow.locator('input[placeholder="Saisir ou sélectionner..."]').fill('Pot de verre 500 ml');
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

    const workbook = XLSX.readFile(path);
    const summarySheet = workbook.Sheets['Résumé'];
    const summaryRows = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
    expect(summaryRows[0]).toContain('Coût Emballage (%)');
    const saumonRow = summaryRows.find(row => String(row[0]).includes('Saumon teriyaki'));
    expect(saumonRow).toBeTruthy();
    const pkgColIndex = summaryRows[0].indexOf('Coût Emballage (%)');
    expect(saumonRow[pkgColIndex]).toBeGreaterThan(0);

    const dashboardSheet = workbook.Sheets['Tableau de Bord'];
    const dashboardRows = XLSX.utils.sheet_to_json(dashboardSheet, { header: 1 });
    expect(dashboardRows.some(row => String(row[0]).includes('Coût Emballage Moyen Pondéré'))).toBe(true);

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
