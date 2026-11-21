// Refonte de Rapport et suivi (21/11, lot 3) : constats clés (forces / faiblesses), cinq par colonne et une fenêtre pour les voir tous.
import { test, expect } from '@playwright/test';

const startDemo = async (page) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-summary').click();
    return errors;
};

test('Vue d\'ensemble : cinq forces et cinq faiblesses au maximum, sous les tuiles et avant l\'évolution', async ({ page }) => {
    const errors = await startDemo(page);
    const block = page.locator('#tutorial-section-key-findings');
    await expect(block.getByRole('heading', { name: 'Constats clés' })).toBeVisible();
    await expect(block.getByTestId('findings-force').locator('li')).toHaveCount(5);
    await expect(block.getByTestId('findings-faiblesse').locator('li')).toHaveCount(5);
    // Le démo a plus de constats que ce qui est montré : la fenêtre en donne le nombre.
    await expect(block.getByRole('button', { name: /Voir tous les constats \(\d+\)/ })).toBeVisible();
    await expect(block.getByTestId('findings-force')).toContainText('est rentable partout');
    await expect(block.getByTestId('findings-faiblesse')).toContainText('58 % des revenus, 15 % du bénéfice net');
    // Ordre : tuiles, constats, puis le graphique d'évolution.
    const y = async (sel) => (await page.locator(sel).first().boundingBox()).y;
    expect(await y('[data-tour="kpi-tiles"]')).toBeLessThan(await y('#tutorial-section-key-findings'));
    expect(await y('#tutorial-section-key-findings')).toBeLessThan(await y('#tutorial-section-tracking-global'));
    expect(errors, errors.join('\n')).toEqual([]);
});

test('La fenêtre « Voir tous les constats » les regroupe par thème et se ferme avec Échap', async ({ page }) => {
    await startDemo(page);
    const block = page.locator('#tutorial-section-key-findings');
    const label = await block.getByRole('button', { name: /Voir tous les constats/ }).innerText();
    const total = Number(label.match(/\((\d+)\)/)[1]);
    await block.getByRole('button', { name: /Voir tous les constats/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Tous les constats' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: `Tous les constats (${total})` })).toBeVisible();
    // Plus de cinq constats par colonne, regroupés sous des thèmes.
    expect(await dialog.getByTestId('findings-force').locator('li').count()).toBeGreaterThan(5);
    expect(await dialog.getByTestId('findings-faiblesse').locator('li').count()).toBeGreaterThan(5);
    await expect(dialog.getByTestId('findings-force').getByText('Rentabilité', { exact: true })).toBeVisible();
    await expect(dialog.getByTestId('findings-faiblesse').getByText('Approvisionnement', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

test('Le lien d\'un constat ouvre le bon sous-onglet', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tutorial-section-key-findings').getByTestId('findings-faiblesse').getByRole('button', { name: 'Voir Par Canal →' }).first().click();
    await expect(page.locator('[data-tour="subtab-byChannel"]')).toHaveAttribute('aria-current', 'page');
});

test('Aucun avertissement de données parmi les constats', async ({ page }) => {
    await startDemo(page);
    const text = await page.locator('#tutorial-section-key-findings').innerText();
    for (const banned of ['sans prix', 'sans volume', 'à vérifier', 'périmé']) expect(text).not.toContain(banned);
});

test('Projet vierge : jamais de constat sans donnée, et aucune erreur', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-summary').click();
    await expect(page.locator('#tutorial-section-key-findings')).toHaveCount(0);
    expect(errors, errors.join(', ')).toEqual([]);
});
