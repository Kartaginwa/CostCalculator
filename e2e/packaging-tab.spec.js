// Phase 2.1 : nouvel onglet Packaging (catalogue miroir des ingrédients, sans impact sur le
// moteur de calcul à cette sous-étape — voir Projet_Claude/03-Feuille-de-route.md).
import { test, expect } from '@playwright/test';

test('onglet Packaging : ajouter, modifier, dupliquer et supprimer un emballage sans erreur', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    await page.locator('#tab-packaging').click();
    await expect(page.getByText('Base de données des emballages')).toBeVisible();

    // Le catalogue de démo est déjà peuplé.
    const table = page.locator('#tutorial-section-packaging-db table');
    const rowCountBefore = await table.locator('tbody tr').count();
    expect(rowCountBefore).toBeGreaterThan(0);

    // Ajouter un nouvel emballage.
    await page.locator('#tutorial-add-packaging').click();
    await page.waitForTimeout(200);
    const newRow = table.locator('tbody tr').first();
    await newRow.locator('input[type="text"]').first().fill('Bouchon liège');
    await newRow.locator('input[inputmode="decimal"]').nth(1).fill('12.00'); // prix d'achat
    await page.waitForTimeout(200);
    const unitPriceCell = newRow.locator('input').nth(5); // prix unitaire calculé (lecture seule)
    await expect(unitPriceCell).not.toHaveValue('0.00');

    // Dupliquer, puis supprimer la copie. Filtre par nom pour s'affranchir du tri/pagination du
    // reste du catalogue de démo pendant qu'on cible la bonne ligne.
    await newRow.locator('button[title="Dupliquer l\'emballage"]').click();
    await page.waitForTimeout(300);
    await page.locator('#filterPackagingName').fill('Bouchon liège');
    await page.waitForTimeout(300);
    await expect(page.locator('input[value="Bouchon liège (Copie)"]')).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(2);

    const copyRow = table.locator('tr', { has: page.locator('input[value="Bouchon liège (Copie)"]') });
    await copyRow.locator('button[title="Supprimer l\'emballage"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('input[value="Bouchon liège (Copie)"]')).toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test('le catalogue Packaging survit à un cycle sauvegarde/chargement', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-packaging').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Sauvegarder")').click();
    const download = await downloadPromise;
    const path = await download.path();
    const fs = require('fs');
    const project = JSON.parse(fs.readFileSync(path, 'utf-8'));

    expect(Array.isArray(project.basePackaging)).toBe(true);
    expect(project.basePackaging.length).toBeGreaterThan(0);
    expect(project.basePackaging[0]).toHaveProperty('name');
    expect(project.basePackaging[0]).toHaveProperty('unitPrice');
});
