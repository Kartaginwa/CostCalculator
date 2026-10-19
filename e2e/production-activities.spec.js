// Activités de production (onglet Paramètres, ex-« Lignes de production », renommé le 12/10) :
// création, édition, suppression avec annulation, et garde-fou contre la suppression de la
// dernière activité restante.
import { test, expect } from '@playwright/test';

test('gestion des activités de production dans Paramètres', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    const section = page.locator('#tutorial-section-info-activites');
    await expect(section).toBeVisible();
    await expect(section.getByText('Activités de production')).toBeVisible();

    // Une activité "Général" par défaut
    await expect(section.locator('input[type="text"]')).toHaveValue('Général');

    // Ajouter une activité
    await section.getByText('Ajouter une activité').click();
    await expect(section.locator('input[type="text"]')).toHaveCount(2);
    await section.locator('input[type="text"]').nth(1).fill('Confitures');
    await expect(section.locator('input[type="text"]').nth(1)).toHaveValue('Confitures');

    // Supprimer l'activité "Général" (garde "Confitures"), vérifie la notification avec option Annuler
    await section.locator('button[title="Supprimer l\'activité de production"]').first().click();
    await expect(section.locator('input[type="text"]')).toHaveCount(1);
    await expect(page.getByText('a été supprimée')).toBeVisible();

    // Empêche de supprimer la dernière activité restante
    await section.locator('button[title="Supprimer l\'activité de production"]').first().click();
    await expect(page.getByText('Vous devez conserver au moins une activité de production.')).toBeVisible();
    await expect(section.locator('input[type="text"]')).toHaveCount(1);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Activités de production : driver de conversion des frais fixes (Phase 4.6), par défaut « Selon les charges directes »", async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    const section = page.locator('#tutorial-section-info-activites');
    const driverSelect = section.locator('select').first();
    await expect(driverSelect).toHaveValue('directCost');
    await driverSelect.selectOption('laborTime');
    await expect(driverSelect).toHaveValue('laborTime');
});
