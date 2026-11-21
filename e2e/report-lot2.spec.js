// Refonte de Rapport et suivi (21/11, lot 2) : marge de sécurité, achats par fournisseur et détail triable, paie non utilisée, cascade de la paie,
// coût réel d'une heure productive, marge de croissance, rentabilité de l'heure par activité et par produit, barre de sous-onglets sans trait.
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
const num = (text) => parseFloat(text.replace(/[^\d,-]/g, '').replace(',', '.'));

test('Vue d\'ensemble : six tuiles dont la marge de sécurité, bloc renommé « Indicateurs clés de rentabilité »', async ({ page }) => {
    const errors = await startDemo(page);
    await expect(page.getByRole('heading', { name: 'Indicateurs clés de rentabilité' })).toBeVisible();
    const tiles = page.locator('[data-tour="kpi-tiles"] > div');
    await expect(tiles).toHaveCount(6);
    const safety = tiles.filter({ hasText: 'Marge de sécurité' });
    await expect(safety.getByText('13,89 %')).toBeVisible();
    // La précision (ce que mesure la tuile) vit dans l'infobulle, pas en note dans la page.
    await expect(safety.getByText('les ventes peuvent baisser')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
});

test('Sous-onglets : aucun trait vertical, les neuf onglets sont entièrement visibles sans défilement', async ({ page }) => {
    await startDemo(page);
    const bar = page.locator('[data-tour="subtab-overview"]').locator('xpath=..');
    await expect(bar.locator('span[aria-hidden="true"]')).toHaveCount(0);
    for (const id of ['overview', 'portfolio', 'bySku', 'byActivity', 'byChannel', 'ingredients', 'packaging', 'labor', 'simulation']) {
        await expect(page.locator(`[data-tour="subtab-${id}"]`)).toBeInViewport({ ratio: 1 });
    }
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('Ingrédients : part des achats par fournisseur (dépendance) et détail unique trié sur le coût de la perte stock', async ({ page }) => {
    await startDemo(page);
    await page.locator('[data-tour="subtab-ingredients"]').click();
    const shares = page.getByTestId('provider-shares');
    const top = shares.locator('tbody tr').first();
    await expect(top).toContainText('Boucherie Nordique');
    await expect(top).toContainText('50 %');
    await expect(top).toContainText('dépendance');
    await expect(shares.locator('tbody tr').nth(1)).not.toContainText('dépendance');

    // Détail : tout sur une page, trié par coût perte stock décroissant par défaut.
    const detail = page.locator('#tutorial-section-ingredients-rapport');
    await detail.locator('select').filter({ hasText: '100' }).selectOption('100');
    const losses = await detail.locator('table').last().locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[6].innerText));
    const values = losses.map(num);
    expect(values.length).toBeGreaterThan(5);
    expect(values).toEqual([...values].sort((a, b) => b - a));

    // Le filtre par fournisseur n'affiche que ce fournisseur.
    await page.locator('#reportFilterProvider').selectOption('Boucherie Nordique');
    const providers = await detail.locator('table').last().locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[1].innerText));
    expect(providers.length).toBeGreaterThan(0);
    expect(new Set(providers)).toEqual(new Set(['Boucherie Nordique']));
});

test('Main-d\'œuvre : paie non utilisée, marge de croissance, cascade, coût réel de l\'heure, ratios par heure', async ({ page }) => {
    const errors = await startDemo(page);
    await page.locator('[data-tour="subtab-labor"]').click();
    const paie = page.locator('#tutorial-section-labor-paie');
    await expect(paie.getByText('11 058,23 $')).toBeVisible();
    await expect(paie.getByText('2 410,98 $')).toBeVisible();
    await expect(paie.getByText('21,8 %')).toBeVisible();

    const growth = page.locator('#tutorial-section-labor-croissance');
    await expect(growth.getByText('32,3 h')).toBeVisible();
    await expect(growth.getByText('248,37 $ de revenu par heure')).toBeVisible();

    const cascade = page.locator('#tutorial-section-labor-cascade');
    await expect(cascade.getByText('344,4 h · 8 647,25 $')).toBeVisible();
    await expect(cascade.getByText('32,11 $/h')).toBeVisible();
    await expect(cascade.getByText('25,78 $/h')).toBeVisible();

    const charge = page.locator('#tutorial-section-labor-charge');
    await expect(charge.locator('tbody tr').filter({ hasText: 'Mets principaux surgelés' })).toContainText('164,46 $');
    // Sauces : la revente (Sauce artisanale du Terroir) est exclue du ratio (86,47 $/h, et non un chiffre gonflé).
    await expect(charge.locator('tbody tr').filter({ hasText: 'Sauces et accompagnements' })).toContainText('86,47 $');

    const produits = page.locator('#tutorial-section-labor-produits');
    await expect(produits.locator('tbody tr').first()).toContainText('Pâté chinois traditionnel (340 g)');
    await expect(produits.locator('tbody tr').first()).toContainText('256,24 $/h');
    await produits.locator('select').selectOption('25');
    await expect(produits.locator('tbody tr').filter({ hasText: 'Sauce artisanale du Terroir' })).toContainText('Revente');
    expect(errors, errors.join('\n')).toEqual([]);
});

test('Par Activité : le tableau d\'origine reste intact, la section Main-d\'œuvre s\'ajoute dessous', async ({ page }) => {
    await startDemo(page);
    await page.locator('[data-tour="subtab-byActivity"]').click();
    const original = page.locator('#tutorial-section-summary-byactivity');
    await expect(original.getByText('Point mort', { exact: true })).toBeVisible();
    await expect(original.getByText('Frais fixes', { exact: true })).toBeVisible();
    const section = page.locator('#tutorial-section-summary-byactivity-mo');
    await expect(section.getByText('Heures de MO réelles')).toBeVisible();
    await expect(section.getByText('Bénéfice brut par heure de MO')).toBeVisible();
    await expect(section).toContainText('164,46 $');
});

test('Projet vierge : les rapports de main-d\'œuvre et d\'achats s\'ouvrent sans erreur ni donnée inventée', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-summary').click();
    for (const id of ['labor', 'ingredients', 'packaging', 'byActivity']) {
        await page.locator(`[data-tour="subtab-${id}"]`).click();
        await page.waitForTimeout(200);
    }
    await page.locator('[data-tour="subtab-labor"]').click();
    await expect(page.locator('#tutorial-section-labor-cascade')).toHaveCount(0);
    await expect(page.locator('#tutorial-section-labor-croissance')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
});

test("Main-d'œuvre : les tableaux se trient par colonne (valeurs absentes toujours en fin de liste)", async ({ page }) => {
    await startDemo(page);
    await page.locator('[data-tour="subtab-labor"]').click();

    // Productivité : tri sur le taux d'utilisation (colonne numérique : le plus grand d'abord, puis inversé).
    const posts = page.locator('#tutorial-section-labor-rapport table').first();
    const utilization = async () => (await posts.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[4].innerText))).map(num);
    await posts.getByRole('button', { name: /Taux d'Utilisation/ }).click();
    const desc = await utilization();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    await posts.getByRole('button', { name: /Taux d'Utilisation/ }).click();
    const asc = await utilization();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    // Le total reste en bas, hors du tri.
    await expect(posts.locator('tfoot')).toContainText('Total');

    // Charge de travail : tri sur le bénéfice brut par heure.
    const charge = page.locator('#tutorial-section-labor-charge table');
    await charge.getByRole('button', { name: 'Bénéfice brut / heure' }).click();
    const perHour = (await charge.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[4].innerText))).map(num);
    expect(perHour).toEqual([...perHour].sort((a, b) => b - a));

    // Produits : tri sur le nom (A à Z), puis sur les heures ; « Revente » reste en fin de liste pour le ratio.
    const produits = page.locator('#tutorial-section-labor-produits');
    await produits.locator('select').selectOption('25');
    await produits.getByRole('button', { name: 'Produit', exact: true }).click();
    const names = await produits.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[0].innerText));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
    await produits.getByRole('button', { name: 'Bénéfice brut / heure' }).click();
    await produits.getByRole('button', { name: 'Bénéfice brut / heure' }).click(); // sens inversé : la revente reste quand même en fin de liste
    await expect(produits.locator('tbody tr').last()).toContainText('Revente');
});
