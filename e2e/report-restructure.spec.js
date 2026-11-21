// Refonte de Rapport et suivi (21/11, lot 1) : neuf sous-onglets en quatre groupes, rapports rapatriés depuis les onglets de saisie
// (ABC et achats, productivité, réconciliation), liens « Voir l'analyse → » et pagination du classement par contribution.
import { test, expect } from '@playwright/test';

const SUBTABS = ['overview', 'portfolio', 'bySku', 'byActivity', 'byChannel', 'ingredients', 'packaging', 'labor', 'simulation'];

const startDemo = async (page) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    return errors;
};

test('Rapport et suivi : neuf sous-onglets, chacun s\'ouvre sans erreur', async ({ page }) => {
    const errors = await startDemo(page);
    await page.locator('#tab-summary').click();
    for (const id of SUBTABS) {
        const tab = page.locator(`[data-tour="subtab-${id}"]`);
        await expect(tab, id).toBeVisible();
        await tab.click();
        await expect(tab, id).toHaveAttribute('aria-current', 'page');
    }
    // L'ancien sous-onglet « Intrants » n'existe plus.
    await expect(page.locator('[data-tour="subtab-intrants"]')).toHaveCount(0);
    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test('Vue d\'ensemble : la réconciliation suit la matrice Activité × Canal ; la matrice stratégique est au Portefeuille', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tab-summary').click();
    await expect(page.getByText('Bénéfices / pertes des activités par canaux')).toBeVisible();
    await expect(page.locator('#tutorial-section-reconciliation')).toBeVisible();
    // La matrice stratégique n'est plus dans la Vue d'ensemble…
    await expect(page.getByText('Matrice stratégique des produits')).toHaveCount(0);
    // …elle est au Portefeuille, avec ses axes.
    await page.locator('[data-tour="subtab-portfolio"]').click();
    await expect(page.getByText('Matrice stratégique des produits')).toBeVisible();
    await expect(page.getByText('Popularité élevée')).toBeVisible();
    await expect(page.getByText('Rentabilité faible')).toBeVisible();
});

test('Portefeuille : le classement par contribution se pagine (lignes par page et pages)', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tab-summary').click();
    await page.locator('[data-tour="subtab-portfolio"]').click();
    const section = page.locator('#tutorial-contribution-chart');
    await expect(section.getByText('Page 1 sur 2')).toBeVisible();
    await section.getByRole('button', { name: 'Suivant' }).click();
    await expect(section.getByText('Page 2 sur 2')).toBeVisible();
    // Toutes les lignes sur une seule page : plus de navigation.
    await section.locator('select').selectOption('25');
    await expect(section.getByText(/Page \d+ sur/)).toHaveCount(0);
});

test('Onglets de saisie : les rapports ont quitté la page, sans phrase de renvoi (retour utilisateur)', async ({ page }) => {
    await startDemo(page);
    // Ingrédients : plus d'ABC, de rapport d'achats ni de renvoi.
    await page.locator('#tab-ingredients').click();
    await expect(page.getByText('Analyse ABC des ingrédients')).toHaveCount(0);
    await expect(page.getByText("Rapport d'achats et perte stock")).toHaveCount(0);
    await expect(page.getByText(/se trouvent dans/)).toHaveCount(0);
    // Emballage.
    await page.locator('#tab-packaging').click();
    await expect(page.getByText('Analyse ABC des emballages')).toHaveCount(0);
    await expect(page.getByText(/se trouvent dans/)).toHaveCount(0);
    // Main-d'œuvre : plus de rapport de productivité dans l'onglet de saisie.
    await page.locator('#tab-labor').click();
    await expect(page.locator('#tutorial-section-labor-rapport')).toHaveCount(0);
    await expect(page.getByText(/se trouvent dans/)).toHaveCount(0);
    // État des résultats : plus de réconciliation ni de renvoi.
    await page.locator('#tab-income-statement').click();
    await expect(page.locator('#tutorial-section-reconciliation')).toHaveCount(0);
    await expect(page.getByText(/se trouve dans/)).toHaveCount(0);
    // Les rapports sont bien dans Rapport et suivi.
    await page.locator('#tab-summary').click();
    await expect(page.locator('#tutorial-section-reconciliation')).toBeVisible();
    await page.locator('[data-tour="subtab-ingredients"]').click();
    await expect(page.locator('#tutorial-section-ingredients-abc')).toBeVisible();
    await page.locator('[data-tour="subtab-packaging"]').click();
    await expect(page.locator('#tutorial-section-packaging-abc')).toBeVisible();
    await page.locator('[data-tour="subtab-labor"]').click();
    await expect(page.locator('#tutorial-section-labor-rapport')).toBeVisible();
});

test('Rapport sans chiffres réels : un message remplace la réconciliation (jamais des zéros comparés au théorique)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('#tutorial-section-reconciliation').getByText(/Saisissez vos chiffres réels/)).toBeVisible();
    expect(errors, `Erreurs page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
