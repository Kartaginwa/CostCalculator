// Rapport et suivi, sous-onglets « Par Activité »/« Par Canal » — révisés le 02/11 (retour
// utilisateur immédiat sur la version du 24/10) : celle-ci avait un sélecteur + une ventilation par
// l'autre axe (comme « Par SKU »), ce qui donnait l'impression de deux rapports répétés l'un de
// l'autre une fois transposés, alors que le vrai intérêt était LE TOTAL de chaque ligne. Révision :
// une table, une ligne par activité (ou par canal), chacune réduite à son propre total agrégé — $
// sommés puis divisés pour les %, jamais une moyenne de % individuels (paradoxe de Simpson) ; point
// mort en $ de revenu, pas en unités (des SKU hétérogènes n'ont pas d'unité de vente commune).
//
// Axes inversés le 02/11 (retour utilisateur, suite) : une colonne par segment, une ligne par
// indicateur — plus lisible pour comparer peu de segments côte à côte sur plusieurs indicateurs.
import { test, expect } from '@playwright/test';

test("Rapport et suivi : Par Activité et Par Canal listent chaque segment en colonne, un indicateur par ligne, sans sélecteur ni ventilation par l'autre axe", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();

    // Sous-onglets présents (entre Par SKU et Intrants dans le JSX).
    await expect(page.getByRole('button', { name: 'Par Activité', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Par Canal', exact: true })).toBeVisible();

    // Par Activité : une colonne par activité, aucun sélecteur (toute la liste est déjà visible).
    await page.getByText('Par Activité', { exact: true }).click();
    const byActivity = page.locator('#tutorial-section-summary-byactivity');
    await expect(byActivity.locator('select')).toHaveCount(0);
    // « Point mort » est maintenant un libellé de ligne (td), plus un en-tête de colonne (th).
    await expect(byActivity.locator('td', { hasText: 'Point mort' })).toBeVisible();
    // 8 lignes d'indicateur (Revenu total, Coût de production, Bénéfice brut, Marge brute, Frais
    // fixes, Bénéfice net, Marge nette, Point mort).
    const activityRows = byActivity.locator('tbody tr');
    await expect(activityRows).toHaveCount(8);
    // Classée par Bénéfice net $ décroissant, de gauche à droite : la plus profitable en 1re colonne.
    const activityHeaders = byActivity.locator('thead th');
    await expect(activityHeaders).toHaveCount(4); // libellé + 3 activités (surgelés, soupes, sauces).
    await expect(activityHeaders.nth(1)).toContainText('Plats principaux surgelés');
    await expect(byActivity.locator('tbody tr', { hasText: 'Revenu total' })).toContainText('61 978.20 $'); // tous canaux.
    await expect(byActivity.locator('tbody tr', { hasText: 'Marge nette' })).toContainText('9.99 %');

    // Par Canal : même structure, une colonne par canal.
    await page.getByText('Par Canal', { exact: true }).click();
    const byChannel = page.locator('#tutorial-section-summary-bychannel');
    await expect(byChannel.locator('select')).toHaveCount(0);
    const channelRows = byChannel.locator('tbody tr');
    await expect(channelRows).toHaveCount(8);
    const channelHeaders = byChannel.locator('thead th');
    await expect(channelHeaders).toHaveCount(4); // libellé + 3 canaux.
    await expect(channelHeaders.nth(1)).toContainText('Vente directe (boutique en ligne)');
    await expect(byChannel.locator('tbody tr', { hasText: 'Revenu total' })).toContainText('11 740.20 $'); // toutes activités.
    await expect(byChannel.locator('tbody tr', { hasText: 'Marge nette' })).toContainText('20.32 %');

    // Point mort en $ (jamais « unités », contrairement à Par SKU).
    await expect(byChannel.getByText('unités')).toHaveCount(0);

    // Position (sous-onglet) conservée après un aller-retour vers un autre onglet.
    await page.locator('#tab-ingredients').click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('button:has-text("Par Canal")')).toHaveClass(/border-blue-600/);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
