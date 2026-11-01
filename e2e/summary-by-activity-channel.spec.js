// Rapport et suivi, sous-onglets « Par Activité »/« Par Canal » (24/10, retour utilisateur) :
// même structure visuelle que « Par SKU », mais chaque colonne agrège plusieurs SKU (voir
// computeActivityReport/computeChannelReport, engine/analysisData.js) — $ sommés puis divisés pour
// les %, jamais une moyenne de % individuels (paradoxe de Simpson) ; point mort en $ de revenu, pas
// en unités (des SKU hétérogènes n'ont pas d'unité de vente commune). Les deux rapports sont des
// vues transposées de la MÊME agrégation Activité × Canal : un segment (ex. « Plats principaux
// surgelés » vendu via « Vente directe ») doit produire des chiffres IDENTIQUES, qu'on y arrive par
// Par Activité ou par Par Canal — vérifié ci-dessous.
import { test, expect } from '@playwright/test';

test("Rapport et suivi : Par Activité et Par Canal sont deux vues transposées de la même agrégation", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();

    // Sous-onglets Par Activité et Par Canal présents (entre Par SKU et Intrants dans le JSX).
    await expect(page.getByRole('button', { name: 'Par Activité', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Par Canal', exact: true })).toBeVisible();

    // Par Activité : « Plats principaux surgelés », colonne « Vente directe (boutique en ligne) ».
    await page.getByText('Par Activité', { exact: true }).click();
    const byActivity = page.locator('#tutorial-section-summary-byactivity');
    await byActivity.locator('#summaryActivitySelect').selectOption({ label: 'Plats principaux surgelés' });
    await expect(byActivity.locator('th', { hasText: 'Vente directe (boutique en ligne)' })).toBeVisible();
    // Une colonne Total, tous canaux confondus pour cette activité.
    await expect(byActivity.getByRole('columnheader', { name: 'Total', exact: true })).toBeVisible();
    await expect(byActivity.getByText('9 475.50 $').first()).toBeVisible(); // Revenu total, Vente directe
    await expect(byActivity.getByText('57.45 %').first()).toBeVisible(); // Marge brute, Vente directe

    // Par Canal : « Vente directe (boutique en ligne) », colonne « Plats principaux surgelés » —
    // doit afficher EXACTEMENT les mêmes $ que ci-dessus (même segment, vue transposée).
    await page.getByText('Par Canal', { exact: true }).click();
    const byChannel = page.locator('#tutorial-section-summary-bychannel');
    await byChannel.locator('#summaryChannelSelect').selectOption({ label: 'Vente directe (boutique en ligne)' });
    await expect(byChannel.locator('th', { hasText: 'Plats principaux surgelés' })).toBeVisible();
    await expect(byChannel.getByRole('columnheader', { name: 'Total', exact: true })).toBeVisible();
    await expect(byChannel.getByText('9 475.50 $').first()).toBeVisible();
    await expect(byChannel.getByText('57.45 %').first()).toBeVisible();

    // Point mort exprimé en $ (pas en « unités », contrairement à Par SKU) — même valeur des deux
    // côtés pour ce même segment.
    const breakEvenRow = byChannel.locator('tr', { hasText: 'Point mort' });
    await expect(breakEvenRow.getByText(/\d.*\$/).first()).toBeVisible();
    await expect(byChannel.getByText('unités')).toHaveCount(0);

    // Position (sous-onglet + sélection) conservée après un aller-retour vers un autre onglet.
    await page.locator('#tab-ingredients').click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('button:has-text("Par Canal")')).toHaveClass(/border-blue-600/);
    await expect(byChannel.locator('#summaryChannelSelect')).toHaveValue(/.+/);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
