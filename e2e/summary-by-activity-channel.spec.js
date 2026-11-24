// Rapport et suivi, sous-onglets « Par activité »/« Par canal » — révisés le 02/11 (retour
// utilisateur immédiat sur la version du 24/10) : celle-ci avait un sélecteur + une ventilation par
// l'autre axe (comme « Par SKU »), ce qui donnait l'impression de deux rapports répétés l'un de
// l'autre une fois transposés, alors que le vrai intérêt était LE TOTAL de chaque ligne. Révision :
// une table, une ligne par activité (ou par canal), chacune réduite à son propre total agrégé — $
// sommés puis divisés pour les %, jamais une moyenne de % individuels (paradoxe de Simpson) ; point
// mort en $ de revenu, pas en unités (des SKU hétérogènes n'ont pas d'unité de vente commune).
//
// Axes inversés le 02/11 (retour utilisateur, suite) : une colonne par segment, une ligne par
// indicateur — plus lisible pour comparer peu de segments côte à côte sur plusieurs indicateurs.
//
// Mise en page alignée le 02/11 sur celle de Par SKU (retour utilisateur, suite) : réutilise
// BySkuRow/BySkuSectionHeader — en-têtes de section gris, étiquette de ligne en <th> sticky avec
// infobulle, ligne d'emphase bg-indigo-50 pour Frais fixes/Point mort.
import { test, expect } from '@playwright/test';

test("Rapport et suivi : Par activité et Par canal, même mise en page que Par SKU (sections, étiquette de ligne sticky, ligne d'emphase)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();

    // Sous-onglets présents (entre Par SKU et Intrants dans le JSX).
    await expect(page.getByRole('button', { name: 'Par activité', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Par canal', exact: true })).toBeVisible();

    // Par activité : une colonne par activité, aucun sélecteur (toute la liste est déjà visible).
    await page.getByText('Par activité', { exact: true }).click();
    const byActivity = page.locator('#tutorial-section-summary-byactivity');
    await expect(byActivity.locator('select')).toHaveCount(0);
    // 3 en-têtes de section (Marge brute / Frais fixes et marge nette / Seuil de rentabilité).
    await expect(byActivity.getByText('Marge brute', { exact: true }).first()).toBeVisible();
    await expect(byActivity.getByText('Seuil de rentabilité', { exact: true })).toBeVisible();
    // « Point mort » est l'étiquette (th) de la dernière ligne, comme dans Par SKU.
    await expect(byActivity.locator('th', { hasText: 'Point mort' })).toBeVisible();
    // 3 en-têtes de section + 8 lignes d'indicateur (Revenu total, Coût de production, Bénéfice
    // brut, Marge brute, Frais fixes, Bénéfice net, Marge nette, Point mort).
    const activityRows = byActivity.locator('tbody tr');
    await expect(activityRows).toHaveCount(11);
    // Classée par Bénéfice net $ décroissant, de gauche à droite : la plus profitable en 1re colonne.
    const activityHeaders = byActivity.locator('thead th');
    await expect(activityHeaders).toHaveCount(4); // libellé + 3 activités (surgelés, soupes, sauces).
    await expect(activityHeaders.nth(1)).toContainText('Mets principaux surgelés');
    await expect(byActivity.locator('tbody tr', { hasText: 'Revenu total' })).toContainText('46 436,66 $'); // tous canaux.
    // Rangée « Marge nette » = tbody tr nth(8) (0-indexé) dans l'ordre fixe des lignes : section
    // Marge brute (header + 4 lignes), section Frais fixes et marge nette (header + Frais fixes +
    // Bénéfice net + Marge nette). Ciblée par index plutôt que par texte : le header de section
    // « Frais fixes et marge nette » contient aussi la sous-chaîne « marge nette ».
    const activityMargeNetteRow = activityRows.nth(8);
    await expect(activityMargeNetteRow).toContainText('Marge nette');
    await expect(activityMargeNetteRow).toContainText('11,01 %');

    // Par canal : même structure, une colonne par canal.
    await page.getByText('Par canal', { exact: true }).click();
    const byChannel = page.locator('#tutorial-section-summary-bychannel');
    await expect(byChannel.locator('select')).toHaveCount(0);
    const channelRows = byChannel.locator('tbody tr');
    await expect(channelRows).toHaveCount(11);
    const channelHeaders = byChannel.locator('thead th');
    await expect(channelHeaders).toHaveCount(4); // libellé + 3 canaux.
    await expect(channelHeaders.nth(1)).toContainText('Vente directe (boutique en ligne)');
    await expect(byChannel.locator('tbody tr', { hasText: 'Revenu total' })).toContainText('12 886,24 $'); // toutes activités.
    const channelMargeNetteRow = channelRows.nth(8);
    await expect(channelMargeNetteRow).toContainText('Marge nette');
    await expect(channelMargeNetteRow).toContainText('26,76 %');

    // Point mort en $ (jamais « unités », contrairement à Par SKU).
    await expect(byChannel.getByText('unités')).toHaveCount(0);

    // Position (sous-onglet) conservée après un aller-retour vers un autre onglet.
    await page.locator('#tab-ingredients').click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('button:has-text("Par canal")')).toHaveClass(/border-blue-600/);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
