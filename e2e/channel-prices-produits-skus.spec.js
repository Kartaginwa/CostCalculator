// Phase 3.2 : prix net + volume par format × canal, dans Produits et SKUs (Paramètres). La colonne
// "Prix de vente" fixe est remplacée par un détail repliable "Canaux de vente" par format — un
// format peut n'être rattaché à aucun canal (ex. un grand format réservé à la restauration), voir
// Projet_Claude/03-Feuille-de-route.md / 04-Conception-Modele.md.
import { test, expect } from '@playwright/test';

test('prix par canal dans Produits et SKUs : ajout, canal principal, retrait, format sans canal', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    // Crée un 2e canal de vente ("Grande distribution") en plus du canal par défaut.
    const channelsSection = page.locator('#tutorial-section-info-channels');
    await channelsSection.getByText('Ajouter un canal').click();
    const channelCards = channelsSection.locator('.space-y-3 > div');
    await channelCards.nth(1).locator('input[type="text"]').first().fill('Grande distribution');

    // Ajoute un nouveau produit (un seul format, rattaché au canal par défaut).
    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.getByText('Ajouter un item').click();
    await page.waitForTimeout(300);
    const newSection = menuSection.locator('[id^="product-section-"]').first();
    await newSection.locator('input[type="text"]').first().fill('Nouveau produit test');

    const formatRow = newSection.locator('tbody tr').first();
    // Le bouton de bascule "N canal(aux)" est toujours le PREMIER bouton de la ligne (avant
    // dupliquer/supprimer) — plus robuste qu'un ciblage par rôle+nom accessible, qui s'est avéré
    // peu fiable ici une fois le texte du bouton changé dynamiquement (2 canaux).
    const channelsButton = formatRow.locator('button').first();
    await expect(channelsButton).toHaveText(/1 canal/);

    // Déplie le détail, renseigne le prix net et le volume du canal par défaut.
    await channelsButton.click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    await expect(detailRow.getByText("n'est rattaché à aucun canal")).toHaveCount(0);
    const firstEntry = detailRow.locator('.space-y-1 > div').first();
    await firstEntry.locator('input[placeholder="Prix net $"]').fill('15');
    await firstEntry.locator('input[placeholder="Volume (u.)"]').fill('100');

    // Ajoute le 2e canal pour ce format.
    await detailRow.getByText('Ajouter un canal pour ce format').click();
    await expect(channelsButton).toContainText('2 canaux');
    const secondEntry = detailRow.locator('.space-y-1 > div').nth(1);
    await secondEntry.locator('select').selectOption({ label: 'Grande distribution' });
    await secondEntry.locator('input[placeholder="Prix net $"]').fill('11');
    await secondEntry.locator('input[placeholder="Volume (u.)"]').fill('400');

    // Le 2e canal devient le canal principal (étoile) : l'ordre se reflète dans la liste.
    await secondEntry.locator('button[title="Définir comme canal principal"]').click();
    const reorderedFirstEntry = detailRow.locator('.space-y-1 > div').first();
    await expect(reorderedFirstEntry.locator('select')).toHaveValue(/.*/);
    await expect(reorderedFirstEntry.locator('input[placeholder="Prix net $"]')).toHaveValue('11');

    // Retire les deux canaux : le format se retrouve sans aucun canal (cas voulu, ex. grand format
    // réservé à un circuit qui n'existe pas encore).
    await detailRow.locator('.space-y-1 > div').nth(1).locator('button').last().click();
    await detailRow.locator('.space-y-1 > div').first().locator('button').last().click();
    await expect(channelsButton).toHaveText(/Aucun canal/);
    await expect(detailRow.getByText("n'est rattaché à aucun canal")).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
