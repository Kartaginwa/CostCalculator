// Objectifs stratégiques (24/11) : champ « Objectif marge brute » et bouton « Gérer les objectifs » dans Paramètres, fenêtre de gestion (objectifs par défaut,
// désactivation sans suppression, objectifs sur mesure, atteints surlignés en vert), voyants et constats qui en découlent.
import { test, expect } from '@playwright/test';

const startDemo = async (page) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    return errors;
};
const openSettings = async (page) => {
    await page.locator('button:has-text("Paramètres")').first().click();
    await page.locator('#tutorial-section-info-objectifs').scrollIntoViewIfNeeded();
};
const openModal = async (page) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Gérer les objectifs' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gérer les objectifs' });
    await expect(dialog).toBeVisible();
    return dialog;
};

test('Paramètres : quatre cibles principales (la marge brute sous la main-d\'œuvre), puis le bouton bleu à la fin de la section', async ({ page }) => {
    const errors = await startDemo(page);
    await openSettings(page);
    const section = page.locator('#tutorial-section-info-objectifs');
    await expect(section.getByText('Objectif coût matière (%)')).toBeVisible();
    await expect(section.getByText('Objectif marge brute (%)')).toBeVisible();
    const yLabor = (await page.locator('#laborCostTarget').boundingBox()).y;
    const yGross = (await page.locator('#grossMarginTarget').boundingBox()).y;
    const yButton = (await section.getByRole('button', { name: 'Gérer les objectifs' }).boundingBox()).y;
    expect(yGross).toBeGreaterThan(yLabor);
    expect(yButton).toBeGreaterThan(yGross);
    await expect(page.locator('#grossMarginTarget')).toHaveValue('40');
    expect(errors, errors.join('\n')).toEqual([]);
});

test('Fenêtre : neuf objectifs par défaut, sens fixe, les atteints surlignés en vert, Échap la ferme', async ({ page }) => {
    await startDemo(page);
    const dialog = await openModal(page);
    const rows = dialog.getByTestId('objectives-default').locator('[data-testid^="objective-"]');
    await expect(rows).toHaveCount(9);
    // Sens fixe, affiché en texte : aucun menu déroulant dans les objectifs par défaut.
    await expect(dialog.getByTestId('objectives-default').locator('select')).toHaveCount(0);
    // Démo : marge brute (40 % pour ~43 %) atteinte ; marge nette (10 % pour ~8 %) à atteindre.
    const gross = dialog.getByTestId('objective-margeBrute');
    await expect(gross).toHaveAttribute('data-met', 'true');
    await expect(gross).toHaveClass(/bg-green-50/);
    await expect(gross).toContainText('Atteint');
    const net = dialog.getByTestId('objective-margeNette');
    await expect(net).toHaveAttribute('data-met', 'false');
    await expect(net).not.toHaveClass(/bg-green-50/);
    await expect(net).toContainText('À atteindre');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

test('Une valeur saisie dans la fenêtre est celle de Paramètres (une seule source)', async ({ page }) => {
    await startDemo(page);
    const dialog = await openModal(page);
    await dialog.getByLabel('Valeur de l\'objectif Marge brute').fill('55');
    await expect(dialog.getByTestId('objective-margeBrute')).toHaveAttribute('data-met', 'false'); // 43 % < 55 %
    await dialog.getByRole('button', { name: 'Terminé' }).click();
    await expect(page.locator('#grossMarginTarget')).toHaveValue('55');
});

test('Désactiver un objectif le rend muet sans effacer sa valeur ; le réactiver le rétablit', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tab-summary').click();
    const tile = page.locator('[data-tour="kpi-tiles"] > div', { hasText: 'Marge Brute Moyenne Pondérée' });
    await expect(tile.locator('svg[aria-label*="Objectif"]')).toHaveCount(1);
    const obj = page.getByTestId('findings-group-objectif');
    await expect(obj).toContainText('Marge brute : objectif atteint');

    const dialog = await openModal(page);
    await dialog.getByLabel('Activer l\'objectif Marge brute').uncheck();
    await expect(dialog.getByTestId('objective-margeBrute')).toContainText('Désactivé');
    await expect(dialog.getByLabel('Valeur de l\'objectif Marge brute')).toHaveValue('40'); // la valeur est gardée
    await dialog.getByRole('button', { name: 'Terminé' }).click();

    await page.locator('#tab-summary').click();
    await expect(tile.locator('svg[aria-label*="Objectif"]')).toHaveCount(0);
    await expect(page.getByTestId('findings-group-objectif')).not.toContainText('Marge brute : objectif atteint');

    const dialog2 = await openModal(page);
    await dialog2.getByLabel('Activer l\'objectif Marge brute').check();
    await dialog2.getByRole('button', { name: 'Terminé' }).click();
    await page.locator('#tab-summary').click();
    await expect(tile.locator('svg[aria-label*="Objectif"]')).toHaveCount(1);
});

test('Objectifs sur mesure : ajout, indicateur, sens au choix, constat, suppression, plafond de 20', async ({ page }) => {
    await startDemo(page);
    const dialog = await openModal(page);
    await dialog.getByRole('button', { name: 'Ajouter un objectif sur mesure' }).click();
    const custom = dialog.getByTestId('objectives-custom').locator('[data-testid^="objective-custom_"]').first();
    await custom.getByLabel('Nom de l\'objectif').fill('Pas de canal dominant');
    await custom.getByLabel('Indicateur').selectOption({ label: 'Part du premier canal' });
    // Le sens se présélectionne selon l'indicateur (« au plus » pour une part), et reste modifiable.
    await expect(custom.getByLabel('Sens de l\'objectif')).toHaveValue('max');
    await custom.getByLabel('Valeur de l\'objectif').fill('40');
    await expect(custom).toHaveAttribute('data-met', 'false'); // Grandes surfaces : 58 % des revenus
    await custom.getByLabel('Sens de l\'objectif').selectOption('min');
    await expect(custom).toHaveAttribute('data-met', 'true');
    await custom.getByLabel('Sens de l\'objectif').selectOption('max');
    await dialog.getByRole('button', { name: 'Terminé' }).click();

    await page.locator('#tab-summary').click();
    await page.getByTestId('findings-group-objectif').getByRole('button', { name: /Voir tout/ }).click();
    await expect(page.getByRole('dialog', { name: 'Objectifs stratégiques' })).toContainText('Pas de canal dominant au-dessus de l\'objectif');
    await page.keyboard.press('Escape');

    // Suppression, puis plafond de 20.
    const d2 = await openModal(page);
    await d2.getByRole('button', { name: 'Supprimer l\'objectif' }).click();
    await expect(d2.getByTestId('objectives-custom').locator('[data-testid^="objective-custom_"]')).toHaveCount(0);
    const add = d2.getByRole('button', { name: 'Ajouter un objectif sur mesure' });
    for (let i = 0; i < 20; i++) await add.click();
    await expect(d2.getByTestId('objectives-custom').locator('[data-testid^="objective-custom_"]')).toHaveCount(20);
    await expect(add).toBeDisabled();
    await expect(d2).toContainText('Maximum atteint');
});

test('Voyants : marge brute (tuile), utilisation et paie non utilisée (Main-d\'œuvre), perte stock (Ingrédients)', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tab-summary').click();
    await page.locator('[data-tour="subtab-labor"]').click();
    await expect(page.locator('tfoot svg[aria-label*="Objectif"]')).toHaveCount(1);
    await expect(page.locator('p:has-text("Part de la paie non utilisée") , div:has(> h3:has-text("Part de la paie non utilisée"))').first().locator('svg[aria-label*="Objectif"]')).toHaveCount(1);
    await page.locator('[data-tour="subtab-ingredients"]').click();
    await expect(page.locator('div:has(> h3:has-text("Coût total de la perte stock"))').first().locator('svg[aria-label*="Objectif"]')).toHaveCount(1);
    await page.locator('[data-tour="subtab-packaging"]').click();
    await expect(page.locator('div:has(> h3:has-text("Coût total de la perte stock"))').first().locator('svg[aria-label*="Objectif"]')).toHaveCount(0);
});

test('Projet vierge : aucun objectif actif, suggestions en grisé, la fenêtre s\'ouvre sans erreur', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    const dialog = await openModal(page);
    for (const id of ['matiere', 'margeBrute', 'margeNette', 'utilisation', 'paieNonUtilisee', 'perteStock', 'fraisFixes']) {
        await expect(dialog.getByTestId(`objective-${id}`)).toHaveAttribute('data-met', 'none');
    }
    await expect(dialog.getByLabel('Valeur de l\'objectif Taux d\'utilisation des postes')).toHaveAttribute('placeholder', 'ex. 85');
    await expect(dialog.getByLabel('Valeur de l\'objectif Taux d\'utilisation des postes')).toHaveValue('');
    expect(errors, errors.join(', ')).toEqual([]);
});

test('Infobulles de la fenêtre : chaque ligne explique ce que l\'objectif veut dire', async ({ page }) => {
    await startDemo(page);
    const dialog = await openModal(page);
    for (const id of ['margeBrute', 'margeNette', 'utilisation', 'paieNonUtilisee', 'perteStock', 'fraisFixes']) {
        expect(await dialog.getByTestId(`objective-${id}`).locator('button[aria-label], [role="button"], svg').count(), id).toBeGreaterThan(0);
    }
    await dialog.getByTestId('objective-utilisation').locator('svg').first().hover();
    await expect(page.getByText('heures réelles de production ÷ heures attendues').first()).toBeVisible();
});
