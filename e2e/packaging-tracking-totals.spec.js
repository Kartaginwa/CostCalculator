// Correction post-2.3 : le bas de la section "2. Emballage" de Recette & Calcul doit présenter
// les mêmes 4 valeurs que les Ingrédients (base, perte stock, total recette, coût à l'unité), avec
// une couleur distincte des autres sections, et le Suivi doit offrir une évolution de prix pour le
// Packaging, séparée de celle des ingrédients (voir Projet_Claude/03-Feuille-de-route.md). Couleur
// orange depuis le 06/10 (permutée avec « 4. Coûts additionnels », qui est passée au rose).
import { test, expect } from '@playwright/test';

test('section Emballage de Recette & Calcul : totaux complets (base, perte stock, recette, unité) en orange', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    await page.locator('#tab-recipe').click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Recette et calcul pour")').locator('~ select').selectOption({ label: 'Chili con carne mijoté' });
    await page.waitForTimeout(300);

    const packagingSection = page.locator('#tutorial-section-recipe-packaging');
    await expect(packagingSection.getByText('2. Emballage')).toBeVisible();
    await expect(packagingSection.locator('h2')).toHaveClass(/text-orange-700/);

    await packagingSection.locator('#tutorial-add-packaging-to-recipe').click();
    await page.waitForTimeout(200);
    const newRow = packagingSection.locator('tbody tr').last();
    await newRow.locator('input[placeholder="Saisir ou sélectionner..."]').click();
    await newRow.locator('input[placeholder="Saisir ou sélectionner..."]').fill('Pot de verre 500 ml');
    await page.locator('li:has-text("Pot de verre 500 ml")').first().click();
    await newRow.locator('input[inputmode="decimal"]').first().fill('1');
    await page.waitForTimeout(300);

    // Les 4 valeurs attendues, à l'image de la section Ingrédients.
    await expect(packagingSection.getByText(/Coût Emballage \(base\):/)).toBeVisible();
    await expect(packagingSection.getByText(/Coût des Pertes \(stock\):/)).toBeVisible();
    await expect(packagingSection.getByText(/Total Coût Emballage \(recette\):/)).toBeVisible();
    await expect(packagingSection.getByText(/Coût Emballage \(unité\):/)).toBeVisible();
    // Plus aucune mention de "portion" dans cette section.
    await expect(packagingSection.getByText(/portion/i)).toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test('Suivi : évolution du prix des emballages, séparée de celle des ingrédients', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    await page.locator('#tab-tracking').click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Évolution du prix des ingrédients")).toBeVisible();
    const packagingEvolution = page.locator('#tutorial-section-tracking-packaging');
    await expect(packagingEvolution.getByText("Évolution du prix des emballages")).toBeVisible();

    // Le sélecteur propose bien des emballages du catalogue de démo.
    const select = packagingEvolution.locator('select');
    await expect(select.locator('option')).not.toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
