import { test, expect } from '@playwright/test';

// Phase 7, étape 5 : les infobulles sont toujours entièrement visibles, restent ouvertes quand la souris
// passe sur la bulle, s'épinglent au clic (Échap les ferme) et leur lien ouvre le guide à la bonne section.
const openDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.locator('#tab-ingredients')).toBeVisible();
};

const TABS = ['#tab-ingredients', '#tab-packaging', '#tab-labor', '#tab-income-statement', '#tab-recipe', '#tab-summary'];

for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 700 }]) {
    test(`Toutes les infobulles de tous les onglets restent dans la fenêtre (${size.width} px)`, async ({ page }) => {
        await page.setViewportSize(size);
        await openDemo(page);
        let checked = 0;
        const outside = [];
        for (const tab of TABS) {
            await page.locator(tab).click();
            const triggers = page.getByTestId('tooltip-trigger');
            const n = await triggers.count();
            for (let i = 0; i < n; i++) {
                const t = triggers.nth(i);
                await t.scrollIntoViewIfNeeded();
                await t.hover();
                const bubble = page.getByTestId('tooltip-bubble');
                await expect(bubble).toBeVisible();
                const box = await bubble.boundingBox();
                if (!box || box.x < -0.5 || box.y < -0.5 || box.x + box.width > size.width + 0.5 || box.y + box.height > size.height + 0.5) {
                    outside.push(`${tab}#${i} ${JSON.stringify(box)}`);
                }
                checked++;
                await page.mouse.move(size.width - 2, size.height - 2);
                await expect(bubble).toHaveCount(0);
            }
        }
        expect(checked).toBeGreaterThan(30);
        expect(outside).toEqual([]);
    });
}

test('La bulle reste ouverte quand la souris la rejoint, et son lien ouvre le guide à la bonne section', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-income-statement').click();
    const trigger = page.getByTestId('tooltip-trigger').first();
    await trigger.hover();
    const link = page.getByTestId('tooltip-guide-link');
    await expect(link).toBeVisible();
    await link.hover();
    await expect(page.getByTestId('tooltip-bubble')).toBeVisible();
    await link.click();
    await expect(page.getByRole('heading', { name: /Guide d'utilisation et d'apprentissage/ })).toBeVisible();
    await expect(page.getByTestId('tooltip-bubble')).toHaveCount(0);
});

test('Un clic épingle la bulle ; Échap ou un clic ailleurs la ferme', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    const trigger = page.getByTestId('tooltip-trigger').first();
    await trigger.click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    await expect(page.getByTestId('tooltip-bubble')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tooltip-bubble')).toHaveCount(0);
    await trigger.click();
    await page.mouse.move(5, 5);
    await expect(page.getByTestId('tooltip-bubble')).toBeVisible();
    await page.mouse.click(5, 300);
    await expect(page.getByTestId('tooltip-bubble')).toHaveCount(0);
});
