// Test E2E de bout en bout : parcourt les flux principaux de l'application avec un
// vrai navigateur (Playwright) pour attraper les régressions que les tests unitaires de
// src/engine/calculateCosts.test.js ne peuvent pas voir (props manquantes, erreurs de rendu,
// hooks React mal ordonnés, etc.). Nécessite que le serveur de dev tourne sur le port 5173
// (voir npm run test:e2e, qui le démarre automatiquement).
import { test, expect } from '@playwright/test';

test.describe('Parcours projet vierge', () => {
    test('création, saisie de données, et navigation dans tous les onglets sans erreur', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

        await page.goto('/');
        await page.getByText('Créer un nouveau projet').click();
        const skip = page.getByText('Explorer par moi-même');
        if (await skip.count() > 0) await skip.click();

        // Ajouter un ingrédient
        await page.locator('#tab-ingredients').click();
        await page.locator('#tutorial-add-ingredient').click();
        await page.locator('table input[type="text"]').first().fill('Farine Test');
        const priceInputs = page.locator('table input[inputmode="decimal"]');
        await priceInputs.nth(0).fill('1');
        await priceInputs.nth(1).fill('2.50');

        // Ajouter un produit
        await page.locator('button:has-text("Paramètres")').click();
        await page.locator('#tutorial-add-item').click();
        // Le nouveau plat est prépendu en tête de liste (tri en pause) : sa section est la première.
        const newProductSection = page.locator('#tutorial-section-info-menu [id^="product-section-"]').first();
        await newProductSection.locator('input[type="text"]').first().fill('Plat Test');
        await newProductSection.locator('table input[inputmode="decimal"]').first().fill('15');

        // Méthode d'attribution des frais indirects : réglage GLOBAL (les deux méthodes) —
        // déplacé dans État des résultats le 18/10 (section Frais fixes, ex-Paramètres).
        await page.locator('#tab-income-statement').click();
        await page.locator('#indirectCostMethod').selectOption('laborTime');
        await page.locator('#indirectCostMethod').selectOption('salesAllocation');

        // Ajouter un poste et un employé
        await page.locator('#tab-labor').click();
        await page.getByText('Ajouter un poste').click();
        await page.getByText('+ Ajouter un employé').first().click();

        // Recette & Calcul : ajouter un ingrédient et une étape de production (repro du bug de
        // hook order corrigé — la toute première étape doit passer sans plantage).
        await page.locator('#tab-recipe').click();
        await page.locator('#tutorial-add-ingredient-to-recipe').click();
        const combo = page.locator('input[placeholder="Saisir ou sélectionner..."]').first();
        await combo.click();
        await combo.fill('Farine');
        const option = page.locator('li:has-text("Farine Test")').first();
        if (await option.count() > 0) await option.click();

        await page.locator('button:has-text("+ Ajouter une étape")').click();

        // Simulation de prix
        await page.getByText('Simuler un nouveau prix').click();
        await page.locator('input[type="text"]').last().fill('20');

        // Résumé : export PDF/Excel ne doivent pas planter
        await page.locator('#tab-summary').click();
        await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
            page.getByText('Exporter vers Excel').click(),
        ]);
        await page.getByText('Générer un rapport PDF').click();
        const confirmBtn = page.getByText('Générer le PDF');
        await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
            confirmBtn.click(),
        ]);

        // Suivi : créer un point de référence
        await page.locator('#tab-tracking').click();
        await page.getByText('Créer un point de référence').click();
        const saveBtn = page.getByText('Enregistrer');
        if (await saveBtn.count() > 0) await saveBtn.click();

        expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
    });
});

test.describe('Projet démo', () => {
    test('se charge et navigue dans tous les onglets sans erreur', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

        await page.goto('/');
        await page.getByText('Explorer un projet démo').click();
        await expect(page.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();

        for (const tabId of ['tab-ingredients', 'tab-labor', 'tab-recipe', 'tab-summary', 'tab-tracking']) {
            await page.locator(`#${tabId}`).click();
        }

        // Volatilité des prix (dérivée des points de référence du projet démo).
        // Onglet Suivi : le tableau de volatilité s'affiche avec des données.
        await page.locator('#tab-tracking').click();
        await expect(page.getByRole('heading', { name: 'Volatilité des prix d\'achat', exact: true })).toBeVisible();
        // Onglet Ingrédients : au moins un ingrédient (le saumon, prix variable) est marqué « volatile ».
        await page.locator('#tab-ingredients').click();
        await expect(page.getByText('volatile').first()).toBeVisible();

        // Simulateur de choc (sous-onglet « Simulation » de Résumé, 06/10 : s'affiche directement,
        // pas de second clic pour déplier) : ajouter un choc d'intrants +15 % et un choc de
        // main-d'œuvre +10 %. Le recalcul de l'analyse doit s'afficher sans erreur.
        await page.locator('#tab-summary').click();
        await page.getByText('Simulation', { exact: true }).click();
        await expect(page.getByText(/Simulation — choc sur les coûts/)).toBeVisible();
        await page.getByRole('button', { name: 'Ajouter un choc' }).click();
        await page.locator('input[placeholder="ex. +15"]').first().fill('15');
        await expect(page.getByText('Scénario actif :')).toBeVisible();
        // Deuxième choc sur la main-d'œuvre.
        await page.getByRole('button', { name: 'Ajouter un choc' }).click();
        const secondShock = page.locator('div.bg-gray-50').nth(1);
        await secondShock.locator('select').first().selectOption('labor');
        await secondShock.locator('input[placeholder="ex. +15"]').fill('10');
        await expect(page.getByText(/MO ·/)).toBeVisible();

        // Assistants d'import : ouverture/fermeture ne doivent pas planter
        await page.locator('button:has-text("Paramètres")').click();
        await page.getByText('Importer un rapport de ventes').click();
        await page.getByText('Annuler').first().click();

        await page.locator('#tab-ingredients').click();
        await page.getByText('Importer une liste').click();
        await page.getByText('Annuler').first().click();

        // Guide d'utilisation
        await page.locator('button[title="Guide d\'utilisation"]').click();
        await page.fill('input[placeholder*="Rechercher un terme"]', 'Marge Nette');

        expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
    });
});
