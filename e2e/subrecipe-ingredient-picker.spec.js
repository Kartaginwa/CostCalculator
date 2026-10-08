// Régression Phase 1.6a : depuis que `productsWithCosts` a une ligne par FORMAT (pas par
// produit), `App.jsx` exposait par erreur l'id du FORMAT (`fmt_<productId>`) comme id de
// sélection d'une sous-recette dans `ingredientsList` — au lieu de l'id du PRODUIT, que
// `calculateCosts.js` recherche pour résoudre une sous-recette (`allProducts.find(p => p.id ===
// item.id)`). Toute sous-recette ajoutée via le sélecteur d'ingrédient de Recette & Calcul (donc
// PAS les données de démo, câblées en dur avec de vrais id de produit) coûtait silencieusement
// 0 $ dans le plat parent. Corrigé le 04/10 (voir Projet_Claude/03-Feuille-de-route.md, Phase
// 1.6e). Ce test verrouille le chemin complet : créer une sous-recette, la sélectionner comme
// ingrédient d'un autre plat via le sélecteur, et vérifier que son coût remonte bien au parent.
import { test, expect } from '@playwright/test';

test("une sous-recette sélectionnée via le sélecteur d'ingrédient coûte correctement dans le plat parent", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    // Ingrédient de base : Farine Test, 2.50 $ / unité.
    await page.locator('#tab-ingredients').click();
    await page.locator('#tutorial-add-ingredient').click();
    await page.locator('table input[type="text"]').first().fill('Farine Test');
    const priceInputs = page.locator('table input[inputmode="decimal"]');
    await priceInputs.nth(0).fill('1');
    await priceInputs.nth(1).fill('2.50');

    // Produit 1 : "Sauce Base", marquée sous-recette, avec 2 unités de Farine Test (coût attendu
    // non nul : 2 x 2.50 $ = 5.00 $).
    await page.locator('button:has-text("Paramètres")').click();
    await page.locator('#tutorial-add-item').click();
    const section1 = page.locator('#tutorial-section-info-menu [id^="product-section-"]').first();
    await section1.locator('input[type="text"]').first().fill('Sauce Base');

    await page.locator('#tab-recipe').click();
    await page.locator('#isIngredient').check();
    await page.locator('#tutorial-add-ingredient-to-recipe').click();
    const ingredientsSection = page.locator('#tutorial-section-recipe-ingredients');
    const combo1 = ingredientsSection.locator('input[placeholder="Saisir ou sélectionner..."]').first();
    await combo1.click();
    await combo1.fill('Farine');
    await page.locator('li:has-text("Farine Test")').first().click();
    await ingredientsSection.locator('tbody tr').last().locator('input[inputmode="decimal"]').first().fill('2');
    await expect(ingredientsSection.getByText('Total Coûts Matières (recette): 5.00 $')).toBeVisible();

    // Produit 2 : "Plat Final", utilise "Sauce Base" comme ingrédient via le même sélecteur.
    await page.locator('button:has-text("Paramètres")').click();
    await page.locator('#tutorial-add-item').click();
    const section2 = page.locator('#tutorial-section-info-menu [id^="product-section-"]').first();
    await section2.locator('input[type="text"]').first().fill('Plat Final');

    await page.locator('#tab-recipe').click();
    await expect(page.locator('h1:has-text("Recette et calcul pour")').locator('~ select').first()).toHaveValue(/.*/);
    await page.locator('#tutorial-add-ingredient-to-recipe').click();
    const ingredientsSection2 = page.locator('#tutorial-section-recipe-ingredients');
    const combo2 = ingredientsSection2.locator('input[placeholder="Saisir ou sélectionner..."]').first();
    await combo2.click();
    await combo2.fill('Sauce');
    await page.locator('li:has-text("Sauce Base")').first().click();
    await ingredientsSection2.locator('tbody tr').last().locator('input[inputmode="decimal"]').first().fill('1');

    // Si la régression était présente, le coût matière du plat parent resterait à 0.00 $.
    await expect(ingredientsSection2.getByText('Total Coûts Matières (recette): 0.00 $')).toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
