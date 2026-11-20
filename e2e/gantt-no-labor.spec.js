import { test, expect } from '@playwright/test';

// Diagramme de production : les étapes faites sans main-d'œuvre ont leur propre ligne, pour que toute la recette soit visible.
const openRecipe = async (page, productName) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.locator('#tab-recipe')).toBeVisible();
    await page.locator('#tab-recipe').click();
    const select = page.locator('select').first();
    const index = await select.evaluate((s, name) => [...s.options].findIndex((o) => o.text.trim() === name), productName);
    await select.selectOption({ index });
};

test('Une étape sans personnel apparaît dans la ligne « Sans main-d\'œuvre » du diagramme', async ({ page }) => {
    await openRecipe(page, 'Bouillon de poulet maison');
    const row = page.getByTestId('gantt-row-sans-main-doeuvre');
    await expect(row).toBeVisible();
    await expect(row.getByText('Sans main-d\'œuvre')).toBeVisible();
    await expect(row.getByText('Refroidissement rapide')).toBeVisible();
    // Les étapes avec personnel gardent leur ligne de poste
    await expect(page.getByTestId('gantt-row').filter({ hasText: 'Cuisinier de production' })).toBeVisible();
});

test('Sans étape sans personnel, la ligne n\'existe pas ; en ajouter une la fait apparaître', async ({ page }) => {
    await openRecipe(page, 'Chili con carne mijoté');
    await expect(page.getByTestId('gantt-row-sans-main-doeuvre')).toHaveCount(0);
    await page.getByRole('button', { name: '+ Ajouter une étape' }).click();
    await expect(page.getByTestId('gantt-row-sans-main-doeuvre')).toBeVisible();
});
