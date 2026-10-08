// Lignes de production (onglet Paramètres) : création, édition, suppression avec annulation,
// et garde-fou contre la suppression de la dernière ligne restante.
import { test, expect } from '@playwright/test';

test('gestion des lignes de production dans Paramètres', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    const section = page.locator('#tutorial-section-info-activites');
    await expect(section).toBeVisible();
    await expect(section.getByText('Lignes de production')).toBeVisible();

    // Une ligne "Général" par défaut
    await expect(section.locator('input[type="text"]')).toHaveValue('Général');

    // Ajouter une ligne
    await section.getByText('Ajouter une ligne').click();
    await expect(section.locator('input[type="text"]')).toHaveCount(2);
    await section.locator('input[type="text"]').nth(1).fill('Confitures');
    await expect(section.locator('input[type="text"]').nth(1)).toHaveValue('Confitures');

    // Supprimer la ligne "Général" (garde "Confitures"), vérifie la notification avec option Annuler
    await section.locator('button[title="Supprimer la ligne de production"]').first().click();
    await expect(section.locator('input[type="text"]')).toHaveCount(1);
    await expect(page.getByText('a été supprimée')).toBeVisible();

    // Empêche de supprimer la dernière ligne restante
    await section.locator('button[title="Supprimer la ligne de production"]').first().click();
    await expect(page.getByText('Vous devez conserver au moins une ligne de production.')).toBeVisible();
    await expect(section.locator('input[type="text"]')).toHaveCount(1);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
