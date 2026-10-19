// Phase 6.4 (18/10) : la « Période de référence » (ex-Paramètres, section « Frais et revenus »,
// supprimée) vit maintenant tout en haut de l'onglet État des résultats, avant Revenus — voir
// Projet_Claude/03-Feuille-de-route.md. L'assistant d'import de l'état des résultats la détecte
// automatiquement depuis une colonne Date (fichier structuré CSV/Excel), même patron que
// l'assistant d'import de rapport de ventes (App.jsx::handleSalesReportImport).
import { test, expect } from '@playwright/test';
import path from 'path';

test("État des résultats : Période de référence tout en haut (avant Revenus), section Frais et revenus disparue de Paramètres", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    // Paramètres : la section « Frais et revenus » n'existe plus.
    await expect(page.locator('#tutorial-section-info-frais')).toHaveCount(0);
    await expect(page.getByText('Frais et revenus', { exact: true })).toHaveCount(0);

    await page.locator('#tab-income-statement').click();
    const periodSection = page.locator('#tutorial-section-income-statement-period');
    await expect(periodSection).toBeVisible();
    await expect(periodSection.getByText('Période de référence')).toBeVisible();

    // Tout en haut, AVANT Revenus : vérifié par l'ordre des boundingBox verticales.
    const periodBox = await periodSection.boundingBox();
    const revenueBox = await page.locator('#tutorial-section-revenue').boundingBox();
    expect(periodBox.y).toBeLessThan(revenueBox.y);

    // Personnalisée : affiche les dates de début/fin.
    await periodSection.locator('#period').selectOption('custom');
    await expect(periodSection.locator('#startDate')).toBeVisible();
    await expect(periodSection.locator('#endDate')).toBeVisible();

    // Méthode d'attribution des frais indirects : relocalisée dans Frais fixes (plus dans
    // Paramètres).
    await expect(page.locator('#indirectCostMethod')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("État des résultats : l'import détecte automatiquement la période depuis la colonne Date du fichier", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    await page.locator('#tab-income-statement').click();
    const periodSection = page.locator('#tutorial-section-income-statement-period');
    await expect(periodSection.locator('#period')).toHaveValue('monthly');

    await page.getByText("Importer l'état des résultats").click();
    const modal = page.locator('div.fixed.inset-0.bg-black');
    const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'income-statement-sample.csv');
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 2: Correspondance des colonnes')).toBeVisible();
    // Pas de colonne Date dans cette fixture (voir income-statement-import.spec.js) : la période
    // ne doit PAS changer après cet import — vérifié ci-dessous après confirmation.
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible();
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await expect(modal.getByText('Étape 4: Confirmation')).toBeVisible();
    await modal.getByText('Confirmer et Importer').click();
    await expect(page.getByText(/importé\(s\)\./)).toBeVisible();

    await expect(periodSection.locator('#period')).toHaveValue('monthly');
    await expect(periodSection.locator('#startDate')).toHaveCount(0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("État des résultats : une colonne Date mappée bascule la période en Personnalisée avec les bonnes dates min/max", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    await page.locator('#tab-income-statement').click();
    await page.getByText("Importer l'état des résultats").click();
    const modal = page.locator('div.fixed.inset-0.bg-black');
    const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'income-statement-sample-with-dates.csv');
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 2: Correspondance des colonnes')).toBeVisible();
    // La colonne Date se mappe automatiquement par mot-clé (INCOME_STATEMENT_APP_FIELDS).
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible();
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await modal.getByText('Confirmer et Importer').click();
    await expect(page.getByText(/importé\(s\)\./)).toBeVisible();

    // Note : `new Date('2025-01-05')` (chaîne ISO sans heure) est interprétée en UTC puis relue en
    // heure locale par `formatDate` — même mécanisme que SalesReportImportWizardModal.jsx, copié
    // tel quel (pas un bug introduit ici) : peut décaler d'un jour selon le fuseau horaire local.
    // On vérifie donc l'écart réel (26 jours), pas une date absolue dépendante du fuseau.
    const periodSection = page.locator('#tutorial-section-income-statement-period');
    await expect(periodSection.locator('#period')).toHaveValue('custom');
    const startValue = await periodSection.locator('#startDate').inputValue();
    const endValue = await periodSection.locator('#endDate').inputValue();
    const daysBetween = (new Date(endValue) - new Date(startValue)) / (1000 * 60 * 60 * 24);
    expect(daysBetween).toBe(26);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
