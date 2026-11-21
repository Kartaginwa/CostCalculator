import { test, expect } from '@playwright/test';
import { DEMO_SCREEN_CHECKS } from '../src/components/guide/guideNumbers.js';

// Les chiffres du projet démo cités dans le guide (Parties 2 et 3) doivent s'afficher à l'écran.
// Si le projet démo ou le calcul change, ce test échoue : il faut alors mettre le guide à jour
// (src/components/guide/guideNumbers.js).
const SCREENS = {
    'recipe:Chili con carne mijoté': async (page) => {
        await page.locator('#tab-recipe').click();
        const sel = page.locator('select').first();
        const idx = await sel.evaluate((s) => [...s.options].findIndex((o) => o.text.trim() === 'Chili con carne mijoté'));
        await sel.selectOption({ index: idx });
    },
    'summary:Par SKU': async (page) => {
        await page.locator('#tab-summary').click();
        await page.getByRole('button', { name: 'Par SKU', exact: true }).click();
        const sel = page.locator('select').first();
        const idx = await sel.evaluate((s) => [...s.options].findIndex((o) => o.text.trim().startsWith('Chili con carne')));
        await sel.selectOption({ index: idx });
    },
    'summary:Par Activité': async (page) => { await page.locator('#tab-summary').click(); await page.getByRole('button', { name: 'Par Activité', exact: true }).click(); },
    'summary:Par Canal': async (page) => { await page.locator('#tab-summary').click(); await page.getByRole('button', { name: 'Par Canal', exact: true }).click(); },
    "summary:Vue d'ensemble": async (page) => { await page.locator('#tab-summary').click(); await page.getByRole('button', { name: "Vue d'ensemble", exact: true }).click(); },
    'income-statement': async (page) => { await page.locator('#tab-income-statement').click(); },
    labor: async (page) => { await page.locator('#tab-labor').click(); },
    "summary:Ingrédients": async (page) => { await page.locator('#tab-summary').click(); await page.locator('[data-tour="subtab-ingredients"]').click(); },
    "summary:Portefeuille": async (page) => { await page.locator('#tab-summary').click(); await page.locator('[data-tour="subtab-portfolio"]').click(); },
    "summary:Main-d'œuvre": async (page) => { await page.locator('#tab-summary').click(); await page.locator('[data-tour="subtab-labor"]').click(); },
};

for (const [screen, strings] of Object.entries(DEMO_SCREEN_CHECKS)) {
    test(`Guide : les chiffres du démo cités pour « ${screen} » s'affichent à l'écran`, async ({ page }) => {
        await page.goto('/');
        await page.getByText('Explorer un projet démo').click();
        await expect(page.locator('#tab-ingredients')).toBeVisible();
        expect(SCREENS[screen], `écran inconnu : ${screen}`).toBeTruthy();
        await SCREENS[screen](page);
        await page.waitForTimeout(500);
        const text = await page.evaluate(() => document.body.innerText);
        // Les chaînes de référence sont écrites avec le point ; l'écran affiche la virgule décimale.
        const missing = [...new Set(strings.map((s) => s.replace(/(\d)\.(\d)/g, '$1,$2')))].filter((s) => !text.includes(s));
        expect(missing, `chiffres du guide introuvables à l'écran « ${screen} »`).toEqual([]);
    });
}
