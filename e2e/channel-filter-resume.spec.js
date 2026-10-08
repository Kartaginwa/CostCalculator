// Révision du 06/10 : Rapport (ex-Résumé) a 3 sous-onglets, « Vue d'ensemble » en premier et actif
// par défaut depuis le même jour (ordre inversé, demande explicite). « Par SKU » = cascade de
// coûts d'UN SEUL SKU à travers ses canaux (inspiré du rapport « Coût de revient unit. » du
// chiffrier SymbiOse de l'utilisateur). « Vue d'ensemble » = dashboard de KPIs + graphique de
// contribution + matrice « Marges nettes des SKUs par canaux » (inspirée du rapport « Marges » du
// même chiffrier — un SKU non vendu dans un canal donné affiche « — », jamais un 0 % forcé). Le
// filtre par canal unique de l'ancien tableau détaillé a disparu avec lui : tous les canaux sont
// déjà visibles en colonnes.
import { test, expect } from '@playwright/test';

test('Rapport : Vue d\'ensemble (matrice de marges nettes par canal), Par SKU (cascade par canal)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // 4e canal de vente, rattaché à un seul produit du menu démo (les 3 autres canaux du projet
    // démo sont déjà rattachés à tous les produits).
    await page.locator('button:has-text("Paramètres")').first().click();
    const channelsSection = page.locator('#tutorial-section-info-channels');
    await channelsSection.getByText('Ajouter un canal').click();
    await channelsSection.locator('.space-y-3 > div').nth(3).locator('input[type="text"]').first().fill('Grande distribution');

    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.scrollIntoViewIfNeeded();
    const allSections = menuSection.locator('[id^="product-section-"]');
    const sectionNames = await allSections.evaluateAll(els => els.map(el => el.querySelector('input[type="text"]').value));
    const targetSection = allSections.nth(sectionNames.indexOf('Poulet général Tao, riz et légumes'));
    const formatRow = targetSection.locator('tbody tr').first();
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    await detailRow.getByText('Ajouter un canal pour ce format').click();
    // La nouvelle entrée est ajoutée à la fin de la liste — jamais à l'index 1, qui suppose à tort
    // qu'un seul canal existait déjà (faux pour tous les formats du nouveau projet démo, qui ont
    // déjà 3 canaux chacun).
    const newEntry = detailRow.locator('.space-y-1 > div').last();
    await newEntry.locator('select').selectOption({ label: 'Grande distribution' });
    await newEntry.locator('input[placeholder="Prix net $"]').fill('12');
    await page.waitForTimeout(300);

    // Rapport : 3 sous-onglets, « Vue d'ensemble » actif par défaut.
    await page.locator('button:has-text("Rapport")').first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Par SKU')).toBeVisible();
    await expect(page.getByText("Vue d'ensemble")).toBeVisible();
    await expect(page.getByText('Simulation')).toBeVisible();

    // « Vue d'ensemble » : dashboard + graphique de contribution + matrice de marges par canal
    // (déjà affiché, aucun clic nécessaire).
    await expect(page.getByText('Analyse stratégique et point mort global')).toBeVisible();
    await expect(page.getByText('Classement par contribution totale au profit')).toBeVisible();
    await expect(page.getByText('Marges nettes des SKUs par canaux')).toBeVisible();

    const matrix = page.locator('#tutorial-section-summary-table');
    await expect(matrix.locator('th', { hasText: 'Grande distribution' })).toBeVisible();
    // Affiche toutes les lignes (pagination par défaut à 10, le menu démo en a 13).
    for (const s of await page.locator('select').all()) {
        if ((await s.locator('option').allTextContents()).includes('100')) { await s.selectOption('100'); break; }
    }
    await page.waitForTimeout(300);
    const rows = matrix.locator('tbody tr');
    // Le produit rattaché au nouveau canal affiche sa marge nette (%), pas un tiret.
    const attachedRow = rows.filter({ hasText: 'Poulet général Tao, riz et légumes' });
    await expect(attachedRow.getByText('—')).toHaveCount(0);
    // Un autre produit du menu démo, non rattaché à ce canal, affiche un tiret dans sa colonne.
    const unrelatedRow = rows.filter({ hasText: 'Potage à la courge musquée' });
    await expect(unrelatedRow.getByText('—')).toBeVisible();

    // « Par SKU » : sélectionne le SKU rattaché aux deux canaux, vérifie sa cascade.
    await page.getByText('Par SKU').click();
    await page.waitForTimeout(300);
    const bySku = page.locator('#tutorial-section-summary-bysku');
    await bySku.locator('#summarySkuSelect').selectOption({ label: 'Poulet général Tao, riz et légumes' });
    await page.waitForTimeout(300);
    await expect(bySku.getByText('Coût de Production (total)')).toBeVisible();
    await expect(bySku.locator('th', { hasText: 'Grande distribution' })).toBeVisible();
    await expect(bySku.getByText('Point mort')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
