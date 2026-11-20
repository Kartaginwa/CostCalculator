import { test, expect } from '@playwright/test';

// Audit complémentaire du 19/11 : l'application prévient avant une suppression qui fausserait un coût, et le panneau
// « Points à vérifier » signale ce que le calcul absorbait sans bruit.
const openDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.locator('#tab-ingredients')).toBeVisible();
};

test('Supprimer un ingrédient utilisé demande une confirmation, puis le panneau signale la ligne orpheline', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    const deleteButton = page.getByTitle("Supprimer l'ingrédient").first();
    await deleteButton.click();
    const dialog = page.getByText('Supprimer cet ingrédient ?');
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/est utilisé dans :/)).toBeVisible();

    // Annuler : rien n'est supprimé
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/a été supprimé/)).toHaveCount(0);

    // Confirmer : supprimé, avec possibilité d'annuler ; le panneau de vérification le signale
    await deleteButton.click();
    await page.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText(/L'ingrédient .* a été supprimé/)).toBeVisible();
    await page.locator('#tab-summary').click();
    const panel = page.getByTestId('project-checks');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /point.* à vérifier/ }).click();
    await expect(panel.getByText(/n'existe plus/)).toBeVisible();
});

test('Supprimer une activité déplace ses produits vers une autre activité, sans point à vérifier', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-info').click();
    await page.getByTitle("Supprimer l'activité de production").first().click();
    await expect(page.getByText(/a été supprimée\..*déplacé/)).toBeVisible();
    await page.locator('#tab-summary').click();
    await expect(page.getByTestId('project-checks')).toHaveCount(0);
});

test('Un changement d\'unité vers une autre famille prévient immédiatement', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    const unitSelect = page.locator('tbody select').first();
    await unitSelect.selectOption('unité');
    await expect(page.getByText(/une autre famille d'unités/)).toBeVisible();
});

test('Les gallons et onces liquides distinguent le système américain du système impérial', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-info').click();
    await page.getByRole('button', { name: 'Gérer les unités de mesure' }).click();
    for (const label of ['gal US', 'gal imp', 'fl oz US', 'fl oz imp']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
});
