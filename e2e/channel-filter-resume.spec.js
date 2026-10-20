// Révision du 06/10 : Rapport (ex-Résumé) a 3 sous-onglets, « Vue d'ensemble » en premier et actif
// par défaut depuis le même jour (ordre inversé, demande explicite). « Par SKU » = cascade de
// coûts d'UN SEUL SKU à travers ses canaux (inspiré du rapport « Coût de revient unit. » du
// chiffrier SymbiOse de l'utilisateur). « Vue d'ensemble » = dashboard de KPIs + graphique de
// contribution + matrice « Marges nettes des SKUs par canaux » (inspirée du rapport « Marges » du
// même chiffrier — un SKU non vendu dans un canal donné affiche « — », jamais un 0 % forcé). Le
// filtre par canal unique de l'ancien tableau détaillé a disparu avec lui : tous les canaux sont
// déjà visibles en colonnes.
import { test, expect } from '@playwright/test';

test('Rapport : Vue d\'ensemble (matrice de marges nettes par canal), Par SKU (cascade par canal)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);

    // 4e canal de vente, rattaché à un seul produit du menu démo (les 3 autres canaux du projet
    // démo sont déjà rattachés à tous les produits).
    await page.locator('button:has-text("Paramètres")').first().click();
    const channelsSection = page.locator('#tutorial-section-info-channels');
    await channelsSection.getByText('Ajouter un canal').click();
    await channelsSection.locator('.space-y-3 > div').nth(3).locator('input[type="text"]').first().fill('Grande distribution');

    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.scrollIntoViewIfNeeded();
    // Sélectionne le produit dans la liste de gauche (vue maître-détail, refonte du 19/10).
    await menuSection.getByText('Poulet général Tao, riz et légumes', { exact: true }).click();
    const targetSection = menuSection.locator('#product-detail-pane');
    const formatRow = targetSection.locator('tbody tr').first();
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    await detailRow.getByText('Ajouter un canal pour ce format').click();
    // La nouvelle entrée est ajoutée à la fin de la liste — jamais à l'index 1, qui suppose à tort
    // qu'un seul canal existait déjà (faux pour tous les formats du nouveau projet démo, qui ont
    // déjà 3 canaux chacun).
    const newEntry = detailRow.locator('.space-y-1 > div').last();
    await newEntry.locator('select').selectOption({ label: 'Grande distribution' });
    await newEntry.locator('input[placeholder="Prix net $"]').fill('12');
    await page.waitForTimeout(300);

    // Rapport : 3 sous-onglets, « Vue d'ensemble » actif par défaut.
    await page.locator('button:has-text("Rapport")').first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Par SKU')).toBeVisible();
    await expect(page.getByText("Vue d'ensemble")).toBeVisible();
    await expect(page.getByText('Simulation')).toBeVisible();

    // « Vue d'ensemble » : dashboard + graphique de contribution + matrice de marges par canal
    // (déjà affiché, aucun clic nécessaire).
    await expect(page.getByText('Analyse stratégique et point mort global')).toBeVisible();
    await expect(page.getByText('Classement par contribution totale au profit')).toBeVisible();
    await expect(page.getByText('Marges nettes des SKUs par canaux')).toBeVisible();

    const matrix = page.locator('#tutorial-section-summary-table');
    await expect(matrix.locator('th', { hasText: 'Grande distribution' })).toBeVisible();
    // Affiche toutes les lignes (pagination par défaut à 10, le menu démo en a 13).
    for (const s of await page.locator('select').all()) {
        if ((await s.locator('option').allTextContents()).includes('100')) { await s.selectOption('100'); break; }
    }
    await page.waitForTimeout(300);
    const rows = matrix.locator('tbody tr');
    // Le produit rattaché au nouveau canal affiche sa marge nette (%), pas un tiret.
    const attachedRow = rows.filter({ hasText: 'Poulet général Tao, riz et légumes' });
    await expect(attachedRow.getByText('—')).toHaveCount(0);
    // Un autre produit du menu démo, non rattaché à ce canal, affiche un tiret dans sa colonne.
    const unrelatedRow = rows.filter({ hasText: 'Potage à la courge musquée' });
    await expect(unrelatedRow.getByText('—')).toBeVisible();

    // « Par SKU » : sélectionne le SKU rattaché aux deux canaux, vérifie sa cascade.
    await page.getByText('Par SKU').click();
    await page.waitForTimeout(300);
    const bySku = page.locator('#tutorial-section-summary-bysku');
    await bySku.locator('#summarySkuSelect').selectOption({ label: 'Poulet général Tao, riz et légumes' });
    await page.waitForTimeout(300);
    await expect(bySku.getByText('Coût de Production (total)')).toBeVisible();
    await expect(bySku.locator('th', { hasText: 'Grande distribution' })).toBeVisible();
    await expect(bySku.getByText('Point mort')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Rapport : Par SKU détaille les frais fixes par Général/Activité/Canal (Phase 4.6), Général et Activité identiques quel que soit le canal", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-summary').click();
    await page.getByText('Par SKU').click();

    // "Chili con carne mijoté" a un volume RÉEL saisi sur ses 3 canaux (contrairement à un SKU
    // encore en % manuel, dont Général/Activité/Canal resteraient absents à 0 $ — corrigé le
    // 18/10, voir calculateCosts.js : plus de repli à 1 unité, qui aurait produit un coût par
    // portion délirant au lieu de rester honnêtement absent).
    const bySku = page.locator('#tutorial-section-summary-bysku');
    await bySku.locator('#summarySkuSelect').selectOption({ label: 'Chili con carne mijoté' });

    await expect(bySku.getByText('Frais fixes — Général', { exact: true })).toBeVisible();
    // Nom de l'activité affiché entre parenthèses — pas une étiquette générique.
    await expect(bySku.getByText('Frais fixes — Activité (Plats principaux surgelés)', { exact: true })).toBeVisible();
    await expect(bySku.getByText('Frais fixes — Canal', { exact: true })).toBeVisible();

    // Général et Activité ne varient JAMAIS par canal (même ligne de frais fixes, peu importe où le
    // produit est vendu) — 3 colonnes de canal dans la démo, donc 3 occurrences de chaque valeur.
    await expect(bySku.getByText('0.75 $', { exact: true })).toHaveCount(3);
    await expect(bySku.getByText('0.78 $', { exact: true })).toHaveCount(3);
    // Canal, lui, varie réellement selon le canal (volume réel différent par canal).
    await expect(bySku.getByText('1.11 $', { exact: true })).toHaveCount(1);
    await expect(bySku.getByText('0.83 $', { exact: true })).toHaveCount(1);
    await expect(bySku.getByText('0.45 $', { exact: true })).toHaveCount(1);
    // Total par unité = Général + Activité + Canal — varie donc avec le canal, contrairement à
    // Général/Activité pris séparément.
    const totalRow = bySku.locator('tr', { hasText: 'Frais fixes totaux par unité' });
    await expect(totalRow.getByText('2.63 $', { exact: true })).toHaveCount(1);
    await expect(totalRow.getByText('2.36 $', { exact: true })).toHaveCount(1);
    await expect(totalRow.getByText('1.98 $', { exact: true })).toHaveCount(1);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
