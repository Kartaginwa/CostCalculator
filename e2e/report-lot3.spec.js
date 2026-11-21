// Refonte de Rapport et suivi (21/11, lot 3) : constats clés — test de présentation en trois groupes (Objectifs stratégiques, Amélioration / détérioration,
// Forces et faiblesses), trois lignes chacun, avec un lien « Voir tout » par groupe.
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

test('Vue d\'ensemble : trois groupes de constats, trois lignes au maximum chacun, sous la matrice Activité × Canal', async ({ page }) => {
    const errors = await startDemo(page);
    const block = page.locator('#tutorial-section-key-findings');
    await expect(block.getByRole('heading', { name: 'Constats clés' })).toBeVisible();
    for (const [id, title] of [['objectif', 'Objectifs stratégiques'], ['evolution', 'Amélioration / détérioration'], ['structure', 'Forces et faiblesses']]) {
        const group = block.getByTestId(`findings-group-${id}`);
        await expect(group.getByRole('heading', { name: title })).toBeVisible();
        // Deux colonnes (positifs à gauche, négatifs à droite), trois lignes au maximum chacune.
        await expect(group.getByTestId('preview-force')).toBeVisible();
        await expect(group.getByTestId('preview-faiblesse')).toBeVisible();
        for (const tone of ['force', 'faiblesse']) expect(await group.getByTestId(`preview-${tone}`).locator('li').count(), `${id} ${tone}`).toBeLessThanOrEqual(3);
        expect(await group.locator('li').count(), id).toBeGreaterThan(0);
        await expect(group.getByRole('button', { name: /Voir tout \(\d+\)/ })).toBeVisible();
    }
    // Le groupe « Forces et faiblesses » a plus de trois constats dans le démo : le lien en donne le nombre.
    const structure = block.getByTestId('findings-group-structure');
    const count = Number((await structure.getByRole('button', { name: /Voir tout/ }).innerText()).match(/\((\d+)\)/)[1]);
    expect(count).toBeGreaterThan(3);
    // Les blocs se suivent verticalement.
    const ys = [];
    for (const id of ['objectif', 'evolution', 'structure']) ys.push((await block.getByTestId(`findings-group-${id}`).boundingBox()).y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    await expect(structure).toContainText('58 % des revenus, 15 % du bénéfice net');
    // Ordre : tuiles, graphique d'évolution, matrice Activité × Canal, constats.
    const y = async (sel) => (await page.locator(sel).first().boundingBox()).y;
    expect(await y('[data-tour="kpi-tiles"]')).toBeLessThan(await y('#tutorial-section-tracking-global'));
    expect(await y('#tutorial-section-tracking-global')).toBeLessThan(await y('#tutorial-section-key-findings'));
    expect(await y('h2:has-text("Bénéfices / pertes des activités par canaux")')).toBeLessThan(await y('#tutorial-section-key-findings'));
    expect(errors, errors.join('\n')).toEqual([]);
});

test('« Voir tout » ouvre la fenêtre du groupe, séparée en constats positifs et négatifs, et se ferme avec Échap', async ({ page }) => {
    await startDemo(page);
    const structure = page.locator('#tutorial-section-key-findings').getByTestId('findings-group-structure');
    const total = Number((await structure.getByRole('button', { name: /Voir tout/ }).innerText()).match(/\((\d+)\)/)[1]);
    await structure.getByRole('button', { name: /Voir tout/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Forces et faiblesses' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: `Forces et faiblesses (${total})` })).toBeVisible();
    await expect(dialog.getByTestId('findings-force').getByRole('heading', { name: 'Forces' })).toBeVisible();
    await expect(dialog.getByTestId('findings-faiblesse').getByRole('heading', { name: 'Faiblesses' })).toBeVisible();
    expect(await dialog.locator('li').count()).toBe(total);
    await expect(dialog.getByTestId('findings-force').getByText('Rentabilité', { exact: true }).or(dialog.getByTestId('findings-force').getByText('Produits', { exact: true })).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Le groupe des objectifs a ses propres intitulés.
    const objectif = page.locator('#tutorial-section-key-findings').getByTestId('findings-group-objectif');
    await objectif.getByRole('button', { name: /Voir tout/ }).click();
    const dialog2 = page.getByRole('dialog', { name: 'Objectifs stratégiques' });
    await expect(dialog2.getByRole('heading', { name: 'Objectifs atteints' })).toBeVisible();
    await expect(dialog2.getByRole('heading', { name: 'Objectifs à atteindre' })).toBeVisible();
});

test('Le lien d\'un constat ouvre le bon sous-onglet', async ({ page }) => {
    await startDemo(page);
    await page.locator('#tutorial-section-key-findings').getByTestId('findings-group-structure').getByRole('button', { name: 'Voir Par Canal →' }).first().click();
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
