// Phase 4.7 (retour utilisateur du 15/10) : le PDF textuel, pas le CSV/Excel, est le format le
// plus courant pour un état des résultats reçu d'un comptable — voir
// Projet_Claude/05-Imports-Integrations.md. Un PDF n'a pas de vraies colonnes : chaque ligne est
// reconstruite par position (extractLinesFromPdf) puis `parsePdfStatementLine` isole poste +
// montant — l'étape 2 (correspondance des colonnes) est donc entièrement sautée. Fixture générée
// avec jsPDF (voir scripts/generate-income-statement-pdf-fixture.cjs) : chaque poste et son
// montant sont écrits par deux appels `.text()` séparés à la même hauteur (x différents), pour
// reproduire fidèlement la mise en page réelle d'un export comptable (pas une seule chaîne).
import { test, expect } from '@playwright/test';
import path from 'path';

const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'income-statement-sample.pdf');

test("État des résultats : assistant d'import reconnaît un PDF textuel sans étape de mapping (Phase 4.7, 15/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-income-statement').click();

    await page.getByText("Importer l'état des résultats").click();
    const modal = page.locator('div.fixed.inset-0.bg-black');
    await expect(modal.getByText(/Assistant d'importation de l'état des résultats/)).toBeVisible();

    // Étape 1 : un PDF saute directement à l'étape 3 — jamais la correspondance de colonnes (pas
    // de vraies colonnes dans un PDF textuel).
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText('Étape 2: Correspondance des colonnes')).toHaveCount(0);

    // Les 4 lignes du PDF sont reconstruites avec leur poste ET leur montant malgré les deux
    // `.text()` séparés (label à gauche, montant à droite, même hauteur dans la fixture).
    const rowByLabel = (label) => modal.locator('tbody tr').filter({ has: page.locator(`input[value="${label}"]`) });

    const skuLikeRow = rowByLabel('Ventes Chili con carne mijoté');
    await expect(skuLikeRow.locator('input[inputMode="decimal"]')).toHaveValue('15000');
    await expect(skuLikeRow.locator('select').first()).toHaveValue('revenue');
    // Un PDF textuel n'a pas de colonne Produit/SKU séparée (contrairement à un fichier
    // structuré) : même un libellé qui nomme un plat existant retombe sur Général, jamais deviné.
    await expect(skuLikeRow.locator('select').nth(1)).toHaveValue('general');

    const loyerRow = rowByLabel('Loyer entrepot');
    await expect(loyerRow.locator('input[inputMode="decimal"]')).toHaveValue('9000');
    await expect(loyerRow.locator('select').first()).toHaveValue('expense');
    await expect(loyerRow.locator('select').nth(1)).toHaveValue('Frais généraux de production');

    // "Précédent" depuis l'étape 3 ramène à l'étape 1 (pas 2, qui n'existe pas pour ce fichier).
    await modal.getByRole('button', { name: 'Précédent' }).click();
    await expect(modal.getByText('Étape 1: Téléverser votre état des résultats')).toBeVisible();

    // Reprendre l'import jusqu'à la confirmation.
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await expect(modal.getByText('Étape 4: Confirmation')).toBeVisible();
    await expect(modal.getByText('2 ligne(s) de revenu.')).toBeVisible();
    await expect(modal.getByText('2 ligne(s) de frais fixes.')).toBeVisible();
    await modal.getByText('Confirmer et Importer').click();
    await expect(page.getByText('2 revenu(s) et 2 dépense(s) importé(s).')).toBeVisible();

    const revenueSection = page.locator('#tutorial-section-revenue');
    await expect(revenueSection.locator('input[placeholder="Poste de revenu"]')).toHaveCount(6);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
