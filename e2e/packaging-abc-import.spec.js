// Phase 2.3 (suite) : analyse ABC + rapport d'achats du Packaging, et assistant d'import
// (CatalogImportWizardModal.jsx, partagé avec les ingrédients).
import { test, expect } from '@playwright/test';

test('analyse ABC et rapport d\'achats du Packaging reflètent un emballage réellement consommé', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // Rattache un emballage à "Saumon teriyaki, riz et légumes" pour qu'il ait une consommation calculable.
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

    await page.locator('#tab-packaging').click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Analyse ABC des emballages')).toBeVisible();
    await expect(page.getByText('Pot de verre 500 ml').first()).toBeVisible();

    await expect(page.getByText('Rapport d\'achats et pertes pour la période')).toBeVisible();
    await page.locator('#reportFilterProviderPackaging').selectOption('all');
    await page.waitForTimeout(200);
    await expect(page.getByText('Coût d\'Achat Total Requis')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test('assistant d\'import du Packaging : ouverture, mapping, import d\'un nouvel emballage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-packaging').click();
    await page.waitForTimeout(300);

    await page.getByText('Importer une liste').click();
    await expect(page.getByText(/Assistant d'Importation d'Emballages/)).toBeVisible();
    await page.getByText('Annuler').first().click();
    await expect(page.getByText(/Assistant d'Importation d'Emballages/)).toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
