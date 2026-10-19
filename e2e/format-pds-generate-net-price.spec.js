// Retour utilisateur du 15/10 : le PDS (prix de détail suggéré au consommateur) devient une donnée
// du FORMAT (saisie manuelle, une seule valeur pour tous ses canaux), positionnée à droite du SKU
// — plutôt qu'une valeur déduite par canal comme avant. Le bouton « Générer », dans le détail de
// chaque canal, calcule le prix net de CE canal en redescendant sa cascade de maillons à partir du
// PDS (voir computeNetPriceFromPds dans ProductInfo.jsx, direction inverse de
// computeSalesChannelCascade). Canaux du projet démo (initialState.js) :
// - Vente directe (boutique en ligne) : aucun maillon -> prix net = PDS.
// - Épiceries indépendantes : 1 maillon marge 30 % -> prix net = PDS x (1 - 0,30).
// - Grandes surfaces : markup 12 % puis marge 32 % -> prix net = (PDS x (1 - 0,32)) / (1 + 0,12).
import { test, expect } from '@playwright/test';

test("Produits et SKUs : le bouton « Générer » calcule le prix net d'un canal à partir du PDS du format (Phase 3.2, corrigé le 15/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Paramètres")').first().click();

    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.scrollIntoViewIfNeeded();
    const allSections = menuSection.locator('[id^="product-section-"]');
    const sectionNames = await allSections.evaluateAll(els => els.map(el => el.querySelector('input[type="text"]').value));
    const section = allSections.nth(sectionNames.indexOf('Chili con carne mijoté'));
    const formatRow = section.locator('tbody tr').first();

    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    const entries = detailRow.locator('.space-y-1 > div');

    // Chaque format du projet démo a désormais un PDS réaliste (initialState.js) : le bouton
    // "Générer" est donc déjà activé. On vide le champ pour vérifier qu'il se désactive bien tant
    // qu'aucun PDS valide n'est saisi (2e input decimal de la ligne de format : portionSize, PDS).
    const pdsInput = formatRow.locator('input[inputmode="decimal"]').nth(1);
    await pdsInput.fill('');
    await pdsInput.blur();
    await expect(entries.first().getByText('Générer')).toBeDisabled();

    await pdsInput.fill('100');
    await pdsInput.blur();
    await expect(entries.first().getByText('Générer')).toBeEnabled();

    // Ordre fixe des canaux dans le projet démo (initialState.js, demoChannelPriceSet) : Vente
    // directe (0, aucun maillon), Épiceries indépendantes (1, marge 30 %), Grandes surfaces
    // (2, markup 12 % puis marge 32 %). Un <select> liste TOUS les canaux parmi ses <option> (donc
    // `hasText` matcherait les 3 entrées à la fois, voir SalesReportImportWizardModal.jsx) — on
    // indexe par position plutôt que par texte pour cette raison.
    const directEntry = entries.nth(0);
    const epiceriesEntry = entries.nth(1);
    const gsEntry = entries.nth(2);
    await expect(directEntry.locator('select')).toHaveValue('channel_direct');
    await expect(epiceriesEntry.locator('select')).toHaveValue('channel_epiceries');
    await expect(gsEntry.locator('select')).toHaveValue('channel_gs');

    // Vente directe (boutique en ligne) : aucun maillon -> prix net = PDS = 100.
    await directEntry.getByText('Générer').click();
    await expect(directEntry.locator('input[placeholder="Prix net $"]')).toHaveValue('100');

    // Épiceries indépendantes : marge 30 % -> prix net = 100 x 0,70 = 70.
    await epiceriesEntry.getByText('Générer').click();
    await expect(epiceriesEntry.locator('input[placeholder="Prix net $"]')).toHaveValue('70');

    // Grandes surfaces : markup 12 % puis marge 32 % -> prix net = (100 x 0,68) / 1,12 = 60,71.
    await gsEntry.getByText('Générer').click();
    await expect(gsEntry.locator('input[placeholder="Prix net $"]')).toHaveValue('60.71');

    // Le prix net généré reste ensuite librement modifiable à la main (pas figé par le bouton).
    await directEntry.locator('input[placeholder="Prix net $"]').fill('95');
    await expect(directEntry.locator('input[placeholder="Prix net $"]')).toHaveValue('95');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
