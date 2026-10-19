// Phase 4.7 : assistant d'import de l'état des résultats (Revenus + Frais fixes) depuis un export
// comptable externe — voir Projet_Claude/05-Imports-Integrations.md, point 2. Un poste par ligne
// (pas d'agrégation comme pour SalesReportImportWizardModal), résolu en Revenu/Dépense avec
// catégorie devinée par mots-clés (guessExpenseCategory), et ventilation par activité quand la
// colonne Produit/SKU reconnaît un plat existant.
import { test, expect } from '@playwright/test';
import path from 'path';

const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'income-statement-sample.csv');

test("État des résultats : assistant d'import crée des revenus (dont un ventilé par activité via SKU) et des frais fixes catégorisés automatiquement", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-income-statement').click();
    await expect(page.locator('#tutorial-section-income-statement').getByRole('heading', { name: 'État des résultats' })).toBeVisible();

    await page.getByText("Importer l'état des résultats").click();
    const modal = page.locator('div.fixed.inset-0.bg-black');
    await expect(modal.getByText(/Assistant d'importation de l'état des résultats/)).toBeVisible();

    // Étape 1 : téléversement.
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 2: Correspondance des colonnes')).toBeVisible();

    // Étape 2 : la correspondance se devine automatiquement (mots-clés) — rien à changer.
    await modal.getByRole('button', { name: 'Suivant' }).click();
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible();

    // Étape 3 : le Poste est maintenant un <input> éditable (correction manuelle, surtout utile
    // pour un PDF) — `hasText` ne porte pas sur la valeur d'un champ de formulaire, d'où le filtre
    // par `has` sur l'input lui-même plutôt que sur le texte de la ligne.
    const rowByLabel = (label) => modal.locator('tbody tr').filter({ has: page.locator(`input[value="${label}"]`) });

    // Le revenu dont le Produit/SKU reconnaît un plat existant est ventilé sur son activité
    // ("Plats principaux surgelés") plutôt que sur Général.
    const skuRow = rowByLabel('Ventes Chili con carne mijoté');
    await expect(skuRow.locator('select').first()).toHaveValue('revenue');
    await expect(skuRow.locator('select').nth(1)).toHaveValue('act_plats');

    const genericRevenueRow = rowByLabel('Ventes diverses');
    await expect(genericRevenueRow.locator('select').nth(1)).toHaveValue('general');

    // Les dépenses sans colonne Catégorie mappée se voient deviner une catégorie plausible par
    // mots-clés (guessExpenseCategory), jamais "Frais généraux de production" par défaut.
    const loyerRow = rowByLabel('Loyer entrepôt');
    await expect(loyerRow.locator('select').first()).toHaveValue('expense');
    await expect(loyerRow.locator('select').nth(1)).toHaveValue('Frais généraux de production');

    const assurancesRow = rowByLabel('Assurances');
    await expect(assurancesRow.locator('select').nth(1)).toHaveValue("Frais d'administration");

    await modal.getByRole('button', { name: 'Suivant' }).click();

    // Étape 4 : confirmation, mode Additif par défaut.
    await expect(modal.getByText('Étape 4: Confirmation')).toBeVisible();
    await expect(modal.locator('input[name="importMode"]').first()).toBeChecked();
    await modal.getByText('Confirmer et Importer').click();
    await expect(page.getByText('2 revenu(s) et 2 dépense(s) importé(s).')).toBeVisible();

    // Les lignes importées s'ajoutent (additif) à côté des 4 revenus / 8 dépenses du projet démo,
    // immédiatement éditables comme une ligne saisie à la main.
    const revenueSection = page.locator('#tutorial-section-revenue');
    await expect(revenueSection.locator('input[placeholder="Poste de revenu"]')).toHaveCount(6);
    // Le libellé est maintenant un <input> (ligne éditable) — `hasText` ne porte pas sur la valeur
    // d'un champ de formulaire, d'où le filtre par `has` sur l'input lui-même.
    const importedRevenueRow = revenueSection.locator('tbody tr').filter({ has: page.locator('input[value="Ventes Chili con carne mijoté"]') });
    await expect(importedRevenueRow.locator('input[placeholder="Montant ($)"]')).toHaveValue('15000');

    const expenseSection = page.locator('#tutorial-section-expenses');
    await expect(expenseSection.locator('input[placeholder="Poste de dépense (ex. Loyer)"]')).toHaveCount(10);
    // Deux lignes "Assurances" coexistent désormais (la démo + l'import) — la dernière du DOM est
    // la ligne importée (ajoutée en fin de liste, mode additif).
    const importedExpenseRow = expenseSection.locator('tbody tr').filter({ has: page.locator('input[value="Assurances"]') }).last();
    await expect(importedExpenseRow.locator('input[placeholder="Montant ($)"]')).toHaveValue('2200');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
