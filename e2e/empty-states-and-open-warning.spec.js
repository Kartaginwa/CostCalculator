import { test, expect } from '@playwright/test';

// États vides avec action (17/11) et avertissement à l'ouverture d'un autre projet.
test('Projet vierge : états vides avec action, navigation depuis Production et Rapport', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    await page.locator('#tab-ingredients').click();
    await expect(page.getByText("Aucun ingrédient dans la base pour l'instant.")).toBeVisible();
    await page.locator('#tab-labor').click();
    await expect(page.getByText("Aucun poste de main-d'œuvre pour l'instant.")).toBeVisible();

    await page.locator('#tab-recipe').click();
    await page.getByRole('button', { name: /Aller à Paramètres/ }).click();
    await expect(page.locator('#tutorial-section-info-activites')).toBeVisible();

    await page.locator('#tab-summary').click();
    await expect(page.getByText("Rien à analyser pour l'instant")).toBeVisible();
});

test('Ouvrir : demande confirmation quand il y a des modifications non sauvegardées', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('input[type="text"]').first().fill('Entreprise test');
    await page.getByRole('button', { name: /Ouvrir/ }).click();
    await expect(page.getByText('Vous avez des modifications non sauvegardées. Ouvrir un autre projet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Ouvrir un autre projet', { exact: true })).toHaveCount(0);
});
