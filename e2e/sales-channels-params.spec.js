// Phase 3.1 : structure des Circuits de vente (nom du canal + maillons marge/markup %), gérée dans
// Paramètres juste après les Lignes de production — pas un onglet dédié (voir
// Projet_Claude/03-Feuille-de-route.md, réordonnancement du 05/10). Le rattachement prix/volumes
// par format × circuit (Phase 3.2) n'existe pas encore : cette section ne définit que la structure.
import { test, expect } from '@playwright/test';

test('gestion des circuits de vente dans Paramètres : canal, maillons, suppression avec garde-fou', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    const section = page.locator('#tutorial-section-info-channels');
    await expect(section).toBeVisible();
    await expect(section.getByText('Canaux de vente')).toBeVisible();

    const channelCards = section.locator('.space-y-3 > div');
    await expect(channelCards).toHaveCount(1);
    const channelNameInput = (card) => card.locator('input[type="text"]').first();

    // Un canal "Vente directe" par défaut, sans maillon.
    await expect(channelNameInput(channelCards.first())).toHaveValue('Vente directe');

    // Ajouter un 2e canal et le nommer.
    await section.getByText('Ajouter un canal').click();
    await expect(channelCards).toHaveCount(2);
    const secondCard = channelCards.nth(1);
    await channelNameInput(secondCard).fill('Grande distribution');
    await expect(channelNameInput(secondCard)).toHaveValue('Grande distribution');

    // Ajouter un maillon à ce 2e canal.
    await secondCard.getByText('Ajouter un maillon').click();
    await secondCard.locator('input[placeholder="ex. Distributeur"]').fill('Distributeur');
    await secondCard.locator('select').selectOption('margin');
    await secondCard.locator('input[inputmode="decimal"]').fill('20');
    await expect(secondCard.locator('input[placeholder="ex. Distributeur"]')).toHaveValue('Distributeur');

    // Supprimer ce maillon (bouton Trash2 de la ligne de maillon, pas celui du canal).
    await secondCard.locator('.pl-4 button').last().click();
    await expect(secondCard.locator('input[placeholder="ex. Distributeur"]')).toHaveCount(0);

    // Supprimer le canal "Vente directe" (garde "Grande distribution"), notification avec Annuler.
    await section.locator('button[title="Supprimer le circuit de vente"]').first().click();
    await expect(channelCards).toHaveCount(1);
    await expect(page.getByText('a été supprimé')).toBeVisible();

    // Empêche de supprimer le dernier circuit restant.
    await section.locator('button[title="Supprimer le circuit de vente"]').first().click();
    await expect(page.getByText('Vous devez conserver au moins un circuit de vente.')).toBeVisible();
    await expect(channelCards).toHaveCount(1);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
