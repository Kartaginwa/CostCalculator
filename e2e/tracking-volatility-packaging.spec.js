// Phase 6 (15/10) : le suivi de volatilité ne portait que sur les ingrédients — étendu à
// l'emballage (même analyse, poste séparé, voir Phase 2, engine/priceVolatility.js::
// computePackagingVolatility). Le projet démo a 19 points de référence mensuels avec des profils
// de prix réalistes (initialState.js, PACKAGING_PRICE_PROFILES) — largement assez pour exercer ce
// tableau. Portait aussi la volatilité du coût direct par format jusqu'au 22/10 (retiré, retour
// utilisateur — redondant avec le détail matière/emballage/MO déjà visible dans « Analyse par
// format », voir TrackingTab.jsx).
import { test, expect } from '@playwright/test';

test('Suivi : volatilité étendue à l\'emballage (Phase 6, 15/10)', async ({ page }) => {
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

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
