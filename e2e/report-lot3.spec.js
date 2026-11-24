// Constats (refonte de Rapport et suivi, lot 3, révisé le 23/11) : un constat, une adresse. Vue d'ensemble : trois blocs séparés, chacun sous le rapport qu'il
// commente (Objectifs sous les tuiles, Amélioration / détérioration sous l'évolution des marges, Forces et faiblesses sous la matrice activité × canal).
// Autres sous-onglets (sauf Simulation) : un bandeau de fin avec les constats spécifiques du sous-onglet. Deux colonnes, trois lignes au maximum, « Voir tout ».
import { test, expect } from '@playwright/test';

const startDemo = async (page) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-summary').click();
    await page.waitForSelector('#tutorial-section-key-findings');
    return errors;
};
const TOTAL = /Voir tout \((\d+)\)/;
const countOf = async (block) => Number((await block.getByRole('button', { name: TOTAL }).innerText()).match(TOTAL)[1]);
const y = async (page, sel) => (await page.locator(sel).first().boundingBox()).y;

test('Vue d\'ensemble : trois blocs séparés, chacun sous le rapport qu\'il commente', async ({ page }) => {
    const errors = await startDemo(page);
    for (const [id, title] of [['objectif', 'Objectifs stratégiques'], ['evolution', 'Amélioration / détérioration'], ['structure', 'Forces et faiblesses']]) {
        const block = page.getByTestId(`findings-group-${id}`);
        await expect(block.getByRole('heading', { name: title })).toBeVisible();
        // Deux colonnes (positifs à gauche, négatifs à droite), trois lignes au maximum chacune.
        await expect(block.getByTestId('preview-force')).toBeVisible();
        await expect(block.getByTestId('preview-faiblesse')).toBeVisible();
        for (const tone of ['force', 'faiblesse']) expect(await block.getByTestId(`preview-${tone}`).locator('li').count(), `${id} ${tone}`).toBeLessThanOrEqual(3);
        expect(await block.locator('li').count(), id).toBeGreaterThan(0);
        await expect(block.getByRole('button', { name: TOTAL })).toBeVisible();
    }
    expect(await countOf(page.getByTestId('findings-group-structure'))).toBeGreaterThan(3);
    // Ordre : tuiles → objectifs → évolution (graphique) → amélioration / détérioration → matrice activité × canal → forces et faiblesses.
    const tiles = await y(page, '[data-tour="kpi-tiles"]'), obj = await y(page, '#tutorial-section-findings-objectif');
    const chart = await y(page, '#tutorial-section-tracking-global'), evo = await y(page, '#tutorial-section-findings-evolution');
    const matrix = await y(page, 'h2:has-text("Bénéfices / pertes des activités par canaux")'), ff = await y(page, '#tutorial-section-key-findings');
    expect(tiles).toBeLessThan(obj);
    expect(obj).toBeLessThan(chart);
    expect(chart).toBeLessThan(evo);
    expect(evo).toBeLessThan(matrix);
    expect(matrix).toBeLessThan(ff);
    // Pas de bandeau de fin dans la Vue d'ensemble : ses trois blocs suffisent.
    await expect(page.locator('[data-testid^="tab-findings-"]')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
});

test('Forces et faiblesses : les constats majeurs, mêmes règles que le rapport PDF', async ({ page }) => {
    await startDemo(page);
    const block = page.getByTestId('findings-group-structure');
    await block.getByRole('button', { name: TOTAL }).click();
    const dialog = page.getByRole('dialog', { name: 'Forces et faiblesses' });
    // Un général majeur (paie non utilisée) et un spécifique majeur promu (un canal) y figurent ; un constat d'objectif n'y est pas.
    await expect(dialog).toContainText('de la paie n\'est pas utilisée');
    await expect(dialog).toContainText('58 % des revenus, 15 % du bénéfice net');
    await expect(dialog).not.toContainText('Coût matière au-dessus de la cible');
    await page.keyboard.press('Escape');
});

test('« Voir tout » ouvre la fenêtre du bloc, séparée en constats positifs et négatifs, et se ferme avec Échap', async ({ page }) => {
    await startDemo(page);
    const structure = page.getByTestId('findings-group-structure');
    const total = await countOf(structure);
    await structure.getByRole('button', { name: TOTAL }).click();
    const dialog = page.getByRole('dialog', { name: 'Forces et faiblesses' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: `Forces et faiblesses (${total})` })).toBeVisible();
    await expect(dialog.getByTestId('findings-force').getByRole('heading', { name: 'Forces' })).toBeVisible();
    await expect(dialog.getByTestId('findings-faiblesse').getByRole('heading', { name: 'Faiblesses' })).toBeVisible();
    expect(await dialog.locator('li').count()).toBe(total);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Le bloc des objectifs a ses propres intitulés.
    await page.getByTestId('findings-group-objectif').getByRole('button', { name: TOTAL }).click();
    const dialog2 = page.getByRole('dialog', { name: 'Objectifs stratégiques' });
    await expect(dialog2.getByRole('heading', { name: 'Objectifs atteints' })).toBeVisible();
    await expect(dialog2.getByRole('heading', { name: 'Objectifs à atteindre' })).toBeVisible();
});

test('Chaque sous-onglet (sauf Simulation) se termine par un bandeau de constats, même forme que la Vue d\'ensemble', async ({ page }) => {
    const errors = await startDemo(page);
    const titles = { portfolio: 'Portefeuille', bySku: 'Par SKU', byActivity: 'Par activité', byChannel: 'Par canal', ingredients: 'Ingrédients', packaging: 'Emballages', labor: 'Main-d\'œuvre' };
    for (const [tab, label] of Object.entries(titles)) {
        await page.locator(`[data-tour="subtab-${tab}"]`).click();
        const banner = page.getByTestId(`tab-findings-${tab}`);
        await expect(banner, tab).toBeVisible();
        await expect(banner.getByRole('heading', { name: `Constats : ${label}` })).toBeVisible();
        for (const tone of ['force', 'faiblesse']) {
            await expect(banner.getByTestId(`preview-${tone}`), `${tab} ${tone}`).toBeVisible();
            expect(await banner.getByTestId(`preview-${tone}`).locator('li').count(), `${tab} ${tone}`).toBeLessThanOrEqual(3);
        }
        await expect(banner.getByRole('button', { name: TOTAL })).toBeVisible();
        // À la fin du sous-onglet : le bandeau est le dernier bloc de la page.
        const bannerY = (await banner.boundingBox()).y;
        const lastH2 = await page.evaluate(() => Math.max(...[...document.querySelectorAll('h2, h3')].filter(e => e.offsetParent && !e.closest('[data-testid^="tab-findings-"]')).map(e => e.getBoundingClientRect().y + window.scrollY)));
        expect(bannerY, tab).toBeGreaterThan(lastH2 - 1);
    }
    await page.locator('[data-tour="subtab-simulation"]').click();
    await expect(page.locator('[data-testid^="tab-findings-"]')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
});

test('Un bandeau ne répète pas la Vue d\'ensemble : un constat général n\'y figure jamais, et un texte n\'y figure qu\'une fois', async ({ page }) => {
    await startDemo(page);
    await page.locator('[data-tour="subtab-labor"]').click();
    const banner = page.getByTestId('tab-findings-labor');
    await banner.getByRole('button', { name: TOTAL }).click();
    const dialog = page.getByRole('dialog', { name: 'Constats : Main-d\'œuvre' });
    // « paie non utilisée » est un constat général : il vit dans la Vue d'ensemble.
    await expect(dialog).not.toContainText('de la paie n\'est pas utilisée');
    const titles = await dialog.locator('li > div:first-child').allTextContents();
    expect(new Set(titles).size).toBe(titles.length);
    await page.keyboard.press('Escape');
});

test('Par SKU : le bandeau suit le SKU choisi', async ({ page }) => {
    await startDemo(page);
    await page.locator('[data-tour="subtab-bySku"]').click();
    await page.locator('#summarySkuSelect').selectOption({ label: 'Chili con carne mijoté' });
    const banner = page.getByTestId('tab-findings-bySku');
    await expect(banner).toContainText('Chili con carne mijoté');
    await page.locator('#summarySkuSelect').selectOption({ label: 'Potage à la courge musquée' });
    await expect(page.getByTestId('tab-findings-bySku')).not.toContainText('« Chili con carne mijoté »');
});

test('Le lien d\'un constat ouvre le bon sous-onglet', async ({ page }) => {
    await startDemo(page);
    await page.getByTestId('findings-group-structure').getByRole('button', { name: 'Voir Par canal →' }).first().click();
    await expect(page.locator('[data-tour="subtab-byChannel"]')).toHaveAttribute('aria-current', 'page');
    // Dans son propre sous-onglet, un constat n'a pas de lien vers lui-même.
    await expect(page.getByTestId('tab-findings-byChannel').getByRole('button', { name: 'Voir Par canal →' })).toHaveCount(0);
});

test('Aucun avertissement de données parmi les constats', async ({ page }) => {
    await startDemo(page);
    const text = (await page.locator('[data-testid^="findings-group-"]').allInnerTexts()).join('\n');
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
    await expect(page.locator('[data-testid^="findings-group-"], [data-testid^="tab-findings-"]')).toHaveCount(0);
    for (const tab of ['portfolio', 'bySku', 'byActivity', 'byChannel', 'ingredients', 'packaging', 'labor']) {
        await page.locator(`[data-tour="subtab-${tab}"]`).click();
        await expect(page.locator('[data-testid^="tab-findings-"]')).toHaveCount(0);
    }
    expect(errors, errors.join(', ')).toEqual([]);
});
