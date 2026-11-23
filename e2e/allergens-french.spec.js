// Allergènes du projet démo : le nom français s'affiche partout (écran Recette, fenêtre des allergènes d'un ingrédient, rapport PDF), jamais la clé anglaise.
import { test, expect } from '@playwright/test';

const openDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();
};

test('écran Recette : « Soja » pour une recette qui contient le prémélange au soja, jamais « soy »', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-recipe').click();
    await page.locator('select').first().selectOption({ label: 'Poulet général Tao, riz et légumes' });
    const box = page.getByText('Allergènes détectés dans cette recette :').locator('..');
    await expect(box).toBeVisible();
    await expect(box).toContainText('Soja');
    await expect(box).not.toContainText(/\bsoy\b|soybeans/);
});

test('onglet Ingrédients : la case « Soja » du prémélange est cochée', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    await page.locator('#filterName').fill('Prémélange gingembre-ail-soya'); // la liste est paginée : on filtre jusqu'à cet ingrédient
    await page.getByTitle('Gérer les allergènes').first().click();
    const dialog = page.locator('div.fixed', { hasText: 'Gérer les allergènes pour' });
    await expect(dialog).toContainText('Prémélange gingembre-ail-soya');
    await expect(dialog.getByLabel('Soja')).toBeChecked();
});

test('rapport PDF : « Allergènes : Soja » sur la fiche, jamais « soy »', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    const text = await page.evaluate(async () => {
        const { demoInputs } = await import('/src/engine/testing/demoFindingsContext.js');
        const { buildReportModel } = await import('/src/reports/report/model.js');
        const { buildUnits } = await import('/src/reports/report/buildReport.js');
        const { state, analysisData, calculatedGeneralInfo, trackingPoints } = demoInputs();
        const model = buildReportModel({ project: { ...state, trackingPoints }, analysisData, calculatedGeneralInfo });
        const html = buildUnits(model, { chapters: ['7'] }, { marks: {}, chapters: {}, total: 0 })[0].html;
        const holder = document.createElement('div'); holder.innerHTML = html;
        return holder.textContent.replace(/\s+/g, ' ');
    });
    expect(text).toMatch(/Allergènes : [^A-Z]*Soja/);
    expect(text).not.toMatch(/\bsoy\b|soybeans/);
});
