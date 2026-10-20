// Couvre la Phase 1.6b : le Rapport (ex-Résumé) affiche une ligne par FORMAT (pas par produit), et
// son bouton d'édition doit naviguer vers le bon PRODUIT *et* sélectionner le bon onglet de FORMAT
// dans Recette & Calcul — un gap identifié lors de la reconnaissance préalable à cette sous-étape
// (editingProductIndex seul ne suffit plus une fois qu'un produit a plusieurs formats).
import { test, expect } from '@playwright/test';

test('Rapport : lignes désambiguïsées par format + édition ouvre le bon onglet de format', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // Ajouter un 2e format (1 unité) à "Chili con carne mijoté" via Paramètres — son format par
    // défaut est en 400 g.
    await page.locator('button:has-text("Paramètres")').first().click();
    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.scrollIntoViewIfNeeded();
    // Sélectionne le produit dans la liste de gauche (vue maître-détail, refonte du 19/10).
    await menuSection.getByText('Chili con carne mijoté', { exact: true }).click();
    const targetSection = menuSection.locator('#product-detail-pane');
    await targetSection.getByText('Ajouter un format').click();
    await page.waitForTimeout(300);
    const newFormatRow = targetSection.locator('tbody tr').nth(1);
    await newFormatRow.locator('input[inputmode="decimal"]').first().fill('1');
    await newFormatRow.locator('select').selectOption('unité');
    await page.waitForTimeout(300);

    // Rapport : les deux formats de "Chili con carne mijoté" apparaissent comme deux lignes
    // distinctes, désambiguïsées par leur format. Le tableau détaillé vit sous « Vue d'ensemble »,
    // l'onglet actif par défaut depuis le 06/10 (ordre des sous-onglets inversé) — aucun clic
    // nécessaire pour l'atteindre.
    await page.locator('button:has-text("Rapport")').first().click();
    await page.waitForTimeout(500);
    for (const s of await page.locator('select').all()) {
        if ((await s.locator('option').allTextContents()).includes('100')) { await s.selectOption('100'); break; }
    }
    await page.waitForTimeout(300);
    const summaryRows = page.locator('#tutorial-section-summary-table tbody tr');
    await expect(summaryRows.filter({ hasText: 'Chili con carne mijoté (400 g)' })).toHaveCount(1);
    await expect(summaryRows.filter({ hasText: 'Chili con carne mijoté (1 unité)' })).toHaveCount(1);

    // Cliquer éditer sur la ligne du format 1 unité doit ouvrir Recette & Calcul sur "Chili con
    // carne mijoté" avec l'onglet "1 unité" actif (pas le format par défaut "400 g").
    const rowUnite = summaryRows.filter({ hasText: 'Chili con carne mijoté (1 unité)' }).first();
    await rowUnite.locator('button[title="Éditer le plat"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator('h1:has-text("Recette et calcul pour")')).toBeVisible();
    await expect(page.locator('select').first()).toHaveValue(/.*/); // le select de produit est rendu
    const activeFormatTab = page.locator('#tutorial-section-recipe-formats button.border-blue-500');
    await expect(activeFormatTab).toHaveText(/1 unité/);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
