// Suite à une remarque méthodologique (un producteur vendant au poids, ex. 47,3 kg d'un lot, ne
// peut pas saisir une quantité produite fractionnaire) : la validation de « Quantité produite »
// dépend désormais de l'unité du format (continue : kg/g/L/ml → décimales permises ; discrète :
// « unité » → entier obligatoire, comportement historique inchangé). Voir isDiscreteUnit (utils.js).
import { test, expect } from '@playwright/test';

test('Quantité produite : décimales permises pour un format en kg, entier toujours exigé pour « unité »', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // Ajoute un 2e format (en unité, discret) à "Chili con carne mijoté" via Paramètres — son
    // format par défaut (400 g) est continu, pour le contraste.
    await page.locator('button:has-text("Paramètres")').first().click();
    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.scrollIntoViewIfNeeded();
    // Sélectionne le produit dans la liste de gauche (vue maître-détail, refonte du 19/10).
    await menuSection.getByText('Chili con carne mijoté', { exact: true }).click();
    const targetSection = menuSection.locator('#product-detail-pane');
    await targetSection.getByText('Ajouter un format').click();
    await page.waitForTimeout(300);
    const newFormatRow = targetSection.locator('tbody tr').nth(1);
    await newFormatRow.locator('input[inputmode="decimal"]').first().fill('1');
    await newFormatRow.locator('select').selectOption('unité');
    await page.waitForTimeout(300);

    // Édite le format par défaut (400 g, continu) dans Recette & Calcul.
    await page.locator('button:has-text("Production")').first().click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Recette et calcul pour")').locator('~ select').selectOption({ label: 'Chili con carne mijoté' });
    await page.waitForTimeout(300);
    await page.locator('#tutorial-section-recipe-formats button', { hasText: '400 g' }).click();
    await page.waitForTimeout(300);

    const nbPortionsInput = page.locator('#nbPortions');
    await nbPortionsInput.fill('47.3');
    await page.waitForTimeout(200);
    await expect(nbPortionsInput).not.toHaveClass(/border-red-500/);
    await expect(page.getByText("Doit être un entier positif.")).toHaveCount(0);

    // Le nouveau format (« 1 unité », discret) refuse toujours une quantité fractionnaire.
    await page.locator('#tutorial-section-recipe-formats button', { hasText: '1 unité' }).click();
    await page.waitForTimeout(300);
    await nbPortionsInput.fill('3.5');
    await page.waitForTimeout(200);
    await expect(nbPortionsInput).toHaveClass(/border-red-500/);
    await expect(page.getByText("Doit être un entier positif.")).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
