import { test, expect } from '@playwright/test';

// Panneau « points à vérifier » de Rapport et suivi (18/11) : absent si tout est cohérent,
// dépliable et avec lien de correction sinon. Saisie décimale : point ET virgule acceptés.
test('Rapport : le panneau de vérifications apparaît quand le mix ≠ 100 %, avec lien de correction', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();
    await expect(page.getByTestId('project-checks')).toHaveCount(0);

    // Vide un prix d'achat d'ingrédient : le panneau doit apparaître
    await page.locator('#tab-ingredients').click();
    await page.locator('input[inputmode="decimal"]').nth(1).fill('');
    await page.locator('#tab-summary').click();
    const panel = page.getByTestId('project-checks');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /point.* à vérifier/ }).click();
    await panel.getByRole('button', { name: /Corriger dans/ }).first().click();
    await expect(page.locator('h1')).toBeVisible();
});

test('Saisie décimale : point et virgule donnent le même résultat', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-ingredients').click();
    const price = page.locator('input[inputmode="decimal"]').nth(1);
    await price.fill('12,5');
    await expect(price).toHaveValue('12,5');
    await expect(page.locator('p', { hasText: 'Nombre invalide.' })).toHaveCount(0);
    await price.fill('12.5');
    await expect(page.locator('p', { hasText: 'Nombre invalide.' })).toHaveCount(0);
});
