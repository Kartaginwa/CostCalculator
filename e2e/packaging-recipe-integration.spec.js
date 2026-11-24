// Phase 2.2 : rattachement du Packaging à un format de vente + poste de coût dans le moteur.
// Vérifie que la section "Emballage" de Recette & Calcul fonctionne (ajout d'un emballage,
// coût affiché) et que le coût d'emballage est bien compté comme poste SÉPARÉ du coût matière.
import { test, expect } from '@playwright/test';

test('section Emballage de Recette & Calcul : ajout d\'un emballage et coût reflété au récapitulatif', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);
    // Sélectionne un produit non-revente, non sous-recette : "Poulet général Tao, riz et légumes".
    await page.locator('h1:has-text("Production pour")').locator('~ select').selectOption({ label: 'Poulet général Tao, riz et légumes' });
    await page.waitForTimeout(300);

    const packagingSection = page.locator('#tutorial-section-recipe-packaging');
    await expect(packagingSection.getByText('2. Emballage')).toBeVisible();

    await packagingSection.locator('#tutorial-add-packaging-to-recipe').click();
    await page.waitForTimeout(200);
    const newRow = packagingSection.locator('tbody tr').last();
    await newRow.locator('input[placeholder="Saisir ou sélectionner…"]').click();
    await newRow.locator('input[placeholder="Saisir ou sélectionner…"]').fill('Pot de verre 500 ml');
    await page.locator('li:has-text("Pot de verre 500 ml")').first().click();
    await newRow.locator('input[inputmode="decimal"]').first().fill('1');
    await page.waitForTimeout(300);

    // Coût emballage (unité) doit maintenant être non nul.
    await expect(packagingSection.getByText(/Coût emballage \(unité\)\u00A0: 0\.00 \$/)).toHaveCount(0);

    // Le récapitulatif affiche bien un 4e poste "Coût emballage (%)" non nul.
    await page.locator('h2:has-text("5. Récapitulatif")').scrollIntoViewIfNeeded();
    await expect(page.getByText('Coût emballage (%)')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test('un produit de revente affiche la section Emballage, sans main-d\'œuvre (audit C11)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Production pour")').locator('~ select').selectOption({ label: 'Sauce artisanale du Terroir' });
    await page.waitForTimeout(300);

    await expect(page.locator('#tutorial-section-recipe-packaging')).toHaveCount(1);
    await expect(page.locator('#tutorial-section-recipe-labor')).toHaveCount(0);
});

test('produit de revente : le coût d\'achat précède l\'emballage', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Production pour")').locator('~ select').selectOption({ label: 'Sauce artisanale du Terroir' });
    await page.waitForTimeout(300);

    const purchase = await page.getByRole('heading', { name: "1. Coût d'Achat" }).boundingBox();
    const packaging = await page.getByRole('heading', { name: '2. Emballage' }).boundingBox();
    expect(purchase.y).toBeLessThan(packaging.y);
});

test('une case à cocher ne s\'active que sur la case ou son texte, pas dans l\'espace vide à côté', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);

    const box = page.locator('#isResaleProduct');
    await expect(box).not.toBeChecked();
    const label = await page.locator('label[for="isResaleProduct"]').boundingBox();
    await page.mouse.click(label.x + label.width + 80, label.y + label.height / 2);
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
});
