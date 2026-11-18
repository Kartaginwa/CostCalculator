// Régression (17/11) : l'onglet Production d'un projet VIERGE (aucun produit, donc aucun format)
// ne doit jamais planter — `format` y est nul, et le calcul « a-t-on un prix de vente ? » du
// récapitulatif doit le tolérer. Le smoke test existant saisissait des données avant d'y entrer.
import { test, expect } from '@playwright/test';

test('Production : un projet vierge affiche son message d\'invitation, sans erreur', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    await page.locator('#tab-recipe').click();
    await expect(page.getByText("Veuillez d'abord sélectionner ou ajouter un plat.")).toBeVisible();
    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
