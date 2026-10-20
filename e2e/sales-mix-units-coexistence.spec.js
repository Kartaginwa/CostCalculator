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

    // Vue maître-détail (refonte du 19/10) : un seul produit affiché à la fois dans le panneau de
    // droite — on sélectionne l'un, on note sa valeur, on sélectionne l'autre, on le modifie, puis
    // on revient sur le premier pour vérifier qu'il n'a pas bougé.

    // Note le % manuel actuel d'un autre plat du menu démo (seul format du projet démo resté sans
    // aucune unité saisie — voir initialState.js), avant toute manipulation.
    await menuSection.getByText('Sauce à spaghetti maison', { exact: true }).click();
    const detailPane = menuSection.locator('#product-detail-pane');
    // .nth(2) : portionSize (0), PDS (1, ajouté le 15/10), Mix des ventes (2).
    const otherSalesMixInput = detailPane.locator('tbody tr').first().locator('input[inputmode="decimal"]').nth(2);
    const otherSalesMixBefore = await otherSalesMixInput.inputValue();
    await expect(otherSalesMixInput).toBeEnabled();

    // Rattache une unité réelle à TOUS les canaux du format d'un autre plat (Poulet général Tao).
    await menuSection.getByText('Poulet général Tao, riz et légumes', { exact: true }).click();
    const formatRow = detailPane.locator('tbody tr').first();
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    const volumeInputs = detailRow.locator('input[placeholder="Volume (u.)"]');
    const volumeCount = await volumeInputs.count();
    for (let i = 0; i < volumeCount; i++) {
        await volumeInputs.nth(i).fill('25');
    }
    await page.waitForTimeout(300);

    // Le champ % du format qui vient de recevoir une unité devient désactivé (mode automatique).
    const targetSalesMixInput = formatRow.locator('input[inputmode="decimal"]').nth(2);
    await expect(targetSalesMixInput).toBeDisabled();

    // Le % manuel de l'AUTRE plat n'a pas bougé — revient dessus pour vérifier.
    await menuSection.getByText('Sauce à spaghetti maison', { exact: true }).click();
    await expect(otherSalesMixInput).toHaveValue(otherSalesMixBefore);

    // Retirer les unités (sur tous les canaux) redonne la main sur le % (repasse en manuel, réactivé).
    await menuSection.getByText('Poulet général Tao, riz et légumes', { exact: true }).click();
    for (let i = 0; i < volumeCount; i++) {
        await volumeInputs.nth(i).fill('0');
    }
    await page.waitForTimeout(300);
    await expect(targetSalesMixInput).toBeEnabled();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
