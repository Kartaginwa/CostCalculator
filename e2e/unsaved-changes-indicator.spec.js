import { test, expect } from '@playwright/test';

// Un indicateur « Modifications non sauvegardées » apparaît après une modification et
// disparaît à la sauvegarde ; Échap ferme une fenêtre modale.
test("Modifications non sauvegardées : indicateur, sauvegarde et Échap sur le guide", async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    const indicator = page.getByTestId('unsaved-indicator');
    await expect(page.getByRole('button', { name: /Sauvegarder/ })).toBeVisible();
    await expect(indicator).toHaveCount(0);

    await page.locator('input[type="text"]').first().fill('Entreprise test');
    await expect(indicator).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Sauvegarder/ }).click();
    await download;
    await expect(indicator).toHaveCount(0);

    await page.getByTitle("Guide d'utilisation").click();
    await expect(page.getByRole('heading', { name: /Guide d'utilisation/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Guide d'utilisation/ })).toHaveCount(0);
});
