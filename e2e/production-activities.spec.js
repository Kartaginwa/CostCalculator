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

test("Activités de production : le CICI (driver de conversion des frais fixes, Phase 4.6) ne se choisit plus ici — centralisé dans État des résultats le 22/10", async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    // Plus aucun sélecteur dans cette section : seulement le nom et le bouton de suppression.
    const section = page.locator('#tutorial-section-info-activites');
    await expect(section.locator('select')).toHaveCount(0);
});

test("État des résultats : Coefficient d'imputation des charges indirectes (CICI) centralise Général et chaque activité (22/10)", async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-cici');
    await expect(section).toBeVisible();
    await expect(section.getByText("Coefficient d'imputation des charges indirectes")).toBeVisible();

    // Une ligne « Général » (générée via generalInfo.indirectCostMethod) et une ligne par
    // activité réelle du projet démo (act_plats/act_soupes/act_sauces, voir initialState.js) — un
    // seul sélecteur par ligne, même options pour les deux.
    await expect(section.getByText('Général', { exact: true })).toBeVisible();
    await expect(section.getByText('Plats principaux surgelés')).toBeVisible();
    await expect(section.locator('select')).toHaveCount(4);

    const generalSelect = section.locator('#indirectCostMethod');
    await expect(generalSelect).toHaveValue('directCost');
    await generalSelect.selectOption('laborTime');
    await expect(generalSelect).toHaveValue('laborTime');

    const activityRow = section.locator('div', { hasText: 'Plats principaux surgelés' }).last();
    const activitySelect = activityRow.locator('select');
    await expect(activitySelect).toHaveValue('directCost');
    await activitySelect.selectOption('laborTime');
    await expect(activitySelect).toHaveValue('laborTime');

    // Canal n'y figure jamais : pas de CICI pour Canal (markup seulement, Paramètres).
    await expect(section.getByText('Épiceries indépendantes')).toHaveCount(0);
});
