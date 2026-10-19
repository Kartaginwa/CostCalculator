// Phase 3.3 (UI, complétée le 06/10) : Recette & Calcul donne le coût de production + la marge
// brute (contribution + brute, pas nette) PAR CANAL — la marge nette, elle, vit dans le rapport
// « Par SKU » de Résumé. Décision utilisateur du 06/10, voir Projet_Claude/03-Feuille-de-route.md.
import { test, expect } from '@playwright/test';

test('Recette & Calcul : le récapitulatif reflète le canal sélectionné, sans jamais afficher de marge nette', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    // 2e canal de vente.
    const channelsSection = page.locator('#tutorial-section-info-channels');
    await channelsSection.getByText('Ajouter un canal').click();
    await channelsSection.locator('.space-y-3 > div').nth(1).locator('input[type="text"]').first().fill('Grande distribution');

    // Nouveau produit, prix net sur les deux canaux.
    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.getByText('Ajouter un item').click();
    await page.waitForTimeout(300);
    const section = menuSection.locator('[id^="product-section-"]').first();
    await section.locator('input[type="text"]').first().fill('Produit Multi');
    const formatRow = section.locator('tbody tr').first();
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    await detailRow.locator('input[placeholder="Prix net $"]').first().fill('20');
    await detailRow.getByText('Ajouter un canal pour ce format').click();
    const secondEntry = detailRow.locator('.space-y-1 > div').nth(1);
    await secondEntry.locator('select').selectOption({ label: 'Grande distribution' });
    await secondEntry.locator('input[placeholder="Prix net $"]').fill('15');
    await page.waitForTimeout(300);

    // Recette & Calcul : le récapitulatif affiche le canal principal par défaut (20 $), jamais de
    // tuile « Marge Nette ».
    await page.locator('button:has-text("Recettes et produits")').first().click();
    await page.waitForTimeout(300);
    await page.locator('h1:has-text("Recette et calcul pour")').locator('~ select').selectOption({ label: 'Produit Multi' });
    await page.waitForTimeout(300);
    const recap = page.locator('#recap-section');
    await recap.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await expect(recap.getByText('Marge Nette')).toHaveCount(0);
    await expect(recap.getByText('Prix de Vente')).toBeVisible();
    await expect(recap.getByText('20.00 $').first()).toBeVisible();

    // Bascule vers le 2e canal : prix net et marges passent à 15 $.
    await recap.locator('select').first().selectOption({ label: 'Grande distribution' });
    await page.waitForTimeout(300);
    await expect(recap.getByText('20.00 $')).toHaveCount(0);
    await expect(recap.getByText('15.00 $').first()).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
