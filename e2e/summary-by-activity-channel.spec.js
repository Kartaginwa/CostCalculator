// Rapport et suivi, sous-onglets « Par Activité »/« Par Canal » — révisés le 02/11 (retour
// utilisateur immédiat sur la version du 24/10) : celle-ci avait un sélecteur + une ventilation par
// l'autre axe (comme « Par SKU »), ce qui donnait l'impression de deux rapports répétés l'un de
// l'autre une fois transposés, alors que le vrai intérêt était LE TOTAL de chaque ligne. Révision :
// une table, une ligne par activité (ou par canal), chacune réduite à son propre total agrégé — $
// sommés puis divisés pour les %, jamais une moyenne de % individuels (paradoxe de Simpson) ; point
// mort en $ de revenu, pas en unités (des SKU hétérogènes n'ont pas d'unité de vente commune).
import { test, expect } from '@playwright/test';

test("Rapport et suivi : Par Activité et Par Canal listent chaque segment avec son propre total, sans sélecteur ni ventilation par l'autre axe", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();

    // Sous-onglets présents (entre Par SKU et Intrants dans le JSX).
    await expect(page.getByRole('button', { name: 'Par Activité', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Par Canal', exact: true })).toBeVisible();

    // Par Activité : une ligne par activité, aucun sélecteur (toute la liste est déjà visible).
    await page.getByText('Par Activité', { exact: true }).click();
    const byActivity = page.locator('#tutorial-section-summary-byactivity');
    await expect(byActivity.locator('select')).toHaveCount(0);
    await expect(byActivity.locator('th', { hasText: 'Point mort' })).toBeVisible();
    const activityRows = byActivity.locator('tbody tr');
    await expect(activityRows).toHaveCount(3); // Plats principaux surgelés, Soupes, Sauces.
    // Classée par Bénéfice net $ décroissant : la plus profitable en premier.
    await expect(activityRows.first()).toContainText('Plats principaux surgelés');
    await expect(activityRows.first()).toContainText('61 978.20 $'); // Revenu total, tous canaux.
    await expect(activityRows.first()).toContainText('9.99 %'); // Marge nette.

    // Par Canal : même structure, une ligne par canal.
    await page.getByText('Par Canal', { exact: true }).click();
    const byChannel = page.locator('#tutorial-section-summary-bychannel');
    await expect(byChannel.locator('select')).toHaveCount(0);
    const channelRows = byChannel.locator('tbody tr');
    await expect(channelRows).toHaveCount(3);
    await expect(channelRows.first()).toContainText('Vente directe (boutique en ligne)');
    await expect(channelRows.first()).toContainText('11 740.20 $'); // Revenu total, toutes activités.
    await expect(channelRows.first()).toContainText('20.32 %');

    // Point mort en $ (jamais « unités », contrairement à Par SKU).
    await expect(byChannel.getByText('unités')).toHaveCount(0);

    // Position (sous-onglet) conservée après un aller-retour vers un autre onglet.
    await page.locator('#tab-ingredients').click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('button:has-text("Par Canal")')).toHaveClass(/border-blue-600/);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
