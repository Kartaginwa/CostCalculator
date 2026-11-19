import { test, expect } from '@playwright/test';

// Rappel (18/11) : un poste de frais fixes qui ressemble à de la main-d'œuvre de production peut
// être compté deux fois (déjà dans le coût des recettes). Le rappel renvoie au guide (ouverture à
// la section « Frais fixes ») et peut être ignoré.
test('État des résultats : rappel main-d\'œuvre de production dans les frais fixes', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-income-statement').click();

    const warning = page.getByTestId('labor-double-count-warning');
    await expect(warning).toHaveCount(0);

    await page.getByText('+ Ajouter une dépense').click();
    const expenses = page.locator('#tutorial-section-expenses');
    await expenses.locator('input[type="text"]').first().fill('Salaires cuisine');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('« Salaires cuisine »');

    // Le lien ouvre le guide, à la section Frais fixes
    await warning.getByRole('button', { name: 'Voir le guide' }).click();
    await expect(page.getByRole('heading', { name: "Charge directe ou frais fixe ? La règle" })).toBeVisible();
    await page.keyboard.press('Escape');

    await warning.getByRole('button', { name: /Ignorer/ }).click();
    await expect(warning).toHaveCount(0);

    // Un libellé sans rapport ne déclenche rien
    await expenses.locator('input[type="text"]').first().fill('Salaire du gérant');
    await expect(warning).toHaveCount(0);
});
