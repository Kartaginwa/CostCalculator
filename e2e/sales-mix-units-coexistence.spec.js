// Révision du 06/10 (Phase 3.4) : le mix des ventes en % saisi à la main doit rester utilisable
// sans jamais toucher aux canaux — coexiste avec le mode "unités" (channelPrices.volume), détecté
// automatiquement par format. Un format sans unité garde son % intact ; un format avec au moins
// une unité bascule en mode automatique (% dérivé, champ désactivé) sans écraser les autres
// formats encore en % manuel. Voir src/engine/salesMixFromChannels.js.
import { test, expect } from '@playwright/test';

test('mix des ventes : un format passé aux unités ne touche pas au % manuel des autres formats', async ({ page }) => {
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

    // Note le % manuel actuel d'un autre plat du menu démo (seul format du projet démo resté sans
    // aucune unité saisie — voir initialState.js), avant toute manipulation.
    const otherSection = allSections.nth(sectionNames.indexOf('Sauce à spaghetti maison'));
    const otherSalesMixInput = otherSection.locator('tbody tr').first().locator('input[inputmode="decimal"]').nth(1);
    const otherSalesMixBefore = await otherSalesMixInput.inputValue();
    await expect(otherSalesMixInput).toBeEnabled();

    // Rattache une unité réelle à TOUS les canaux du format d'un autre plat (Poulet général Tao).
    const targetSection = allSections.nth(sectionNames.indexOf('Poulet général Tao, riz et légumes'));
    const formatRow = targetSection.locator('tbody tr').first();
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    const volumeInputs = detailRow.locator('input[placeholder="Volume (u.)"]');
    const volumeCount = await volumeInputs.count();
    for (let i = 0; i < volumeCount; i++) {
        await volumeInputs.nth(i).fill('25');
    }
    await page.waitForTimeout(300);

    // Le % manuel de l'AUTRE plat n'a pas bougé.
    await expect(otherSalesMixInput).toHaveValue(otherSalesMixBefore);

    // Le champ % du format qui vient de recevoir une unité devient désactivé (mode automatique).
    const targetSalesMixInput = formatRow.locator('input[inputmode="decimal"]').nth(1);
    await expect(targetSalesMixInput).toBeDisabled();

    // Retirer les unités (sur tous les canaux) redonne la main sur le % (repasse en manuel, réactivé).
    for (let i = 0; i < volumeCount; i++) {
        await volumeInputs.nth(i).fill('0');
    }
    await page.waitForTimeout(300);
    await expect(targetSalesMixInput).toBeEnabled();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
