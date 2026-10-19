// Phase 6 (15/10) : le suivi de volatilité ne portait que sur les ingrédients — étendu à
// l'emballage (même analyse, poste séparé, voir Phase 2) et au coût direct par format (matière +
// emballage + MO + sous-traitance déjà figés dans chaque point de référence, voir
// engine/priceVolatility.js::computePackagingVolatility/computeFormatCostVolatility). Le projet
// démo a 19 points de référence mensuels avec des profils de prix réalistes (initialState.js,
// PACKAGING_PRICE_PROFILES) — largement assez pour exercer les deux nouveaux tableaux.
import { test, expect } from '@playwright/test';

test('Suivi : volatilité étendue à l\'emballage et au coût direct par format (Phase 6, 15/10)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-tracking').click();
    await page.waitForTimeout(300);

    // Volatilité — Emballage : tableau distinct de celui des ingrédients, colonnes Emballage/
    // Fournisseur/Prix actuel (pas de ligne "Créez au moins 2 points..." puisque le projet démo en
    // a 19).
    const packagingSection = page.locator('#tutorial-section-tracking-packaging');
    await expect(packagingSection.getByRole('heading', { name: 'Volatilité des prix d\'achat — Emballage' })).toBeVisible();
    await expect(packagingSection.getByText('Créez au moins 2 points de référence')).toHaveCount(0);
    const packagingTable = packagingSection.locator('table');
    await expect(packagingTable.locator('th', { hasText: 'Emballage' })).toBeVisible();
    await expect(packagingTable.locator('th', { hasText: 'Fournisseur' })).toBeVisible();
    await expect(packagingTable.locator('tbody tr')).not.toHaveCount(0);

    // Volatilité — coût direct par format : pas de colonne Fournisseur (n'a pas de sens pour un
    // format), libellé de la colonne prix adapté ("Coût direct actuel", pas "Prix actuel").
    const productSection = page.locator('#tutorial-section-tracking-product');
    await expect(productSection.getByRole('heading', { name: 'Volatilité du coût direct par format' })).toBeVisible();
    const formatTable = productSection.locator('table');
    await expect(formatTable.locator('th', { hasText: 'Format' })).toBeVisible();
    await expect(formatTable.locator('th', { hasText: 'Fournisseur' })).toHaveCount(0);
    await expect(formatTable.locator('th', { hasText: 'Coût direct actuel' })).toBeVisible();
    await expect(formatTable.locator('tbody tr')).not.toHaveCount(0);

    // Filtrer par nom de format fonctionne (même composant générique que les ingrédients/l'emballage).
    await productSection.getByPlaceholder('Filtrer par format…').fill('Chili');
    await expect(formatTable.locator('tbody tr')).not.toHaveCount(0);
    await expect(formatTable.locator('tbody tr').first()).toContainText('Chili');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
