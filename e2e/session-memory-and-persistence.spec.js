import { test, expect } from '@playwright/test';

// Phase 7, point 3 (18/11) : mémoire de session des filtres/sélections, scénario de chocs
// enregistré avec le projet, barre d'onglets collante.
const openDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.locator('#tab-ingredients')).toBeVisible();
};

test('Les filtres et la sélection survivent à un changement d\'onglet, puis sont vidés par un nouveau projet', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    await page.locator('#filterName').fill('Beurre');
    await page.locator('#tab-labor').click();
    await page.locator('#tab-ingredients').click();
    await expect(page.locator('#filterName')).toHaveValue('Beurre');

    // Paramètres : le produit sélectionné est conservé
    await page.locator('button:has-text("Paramètres")').first().click();
    const items = page.locator('[id^="product-list-item-"]');
    await items.nth(2).click();
    const name = await page.locator('#product-detail-pane input[type="text"]').first().inputValue();
    await page.locator('#tab-labor').click();
    await page.locator('button:has-text("Paramètres")').first().click();
    await expect(page.locator('#product-detail-pane input[type="text"]').first()).toHaveValue(name);

    // Nouveau projet : mémoire vidée
    await page.getByRole('button', { name: /Nouveau projet/ }).click();
    await page.getByRole('button', { name: /Confirmer/ }).click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-ingredients').click();
    await expect(page.locator('#filterName')).toHaveValue('');
});

test('Simulation : le choc configuré survit à l\'onglet et est enregistré dans le fichier du projet', async ({ page }) => {
    await openDemo(page);
    await page.locator('#tab-summary').click();
    await page.getByRole('button', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: /Ajouter un choc/ }).click();
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();

    await page.locator('#tab-labor').click();
    await page.locator('#tab-summary').click();
    await page.getByRole('button', { name: 'Simulation' }).click();
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Sauvegarder/ }).click();
    const file = await download;
    const path = await file.path();
    const fs = await import('node:fs');
    const saved = JSON.parse(fs.readFileSync(path, 'utf-8'));
    expect(saved.uiSettings.costShocks.length).toBe(1);
});

test('La barre d\'onglets reste en haut de l\'écran au défilement, l\'en-tête défile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await openDemo(page);
    await page.locator('#tab-ingredients').click();
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 900);
    await expect.poll(async () => page.evaluate(() => Math.round(document.querySelector('#tutorial-tab-bar').getBoundingClientRect().top))).toBe(0);
    const logoBottom = await page.evaluate(() => document.querySelector('img[alt*="Logo"]').getBoundingClientRect().bottom);
    expect(logoBottom).toBeLessThan(0);
});

test('Guide : structure en parties, sommaire cliquable, recherche, Échap le ferme', async ({ page }) => {
    await openDemo(page);
    await page.getByTitle("Guide d'utilisation").click();
    const guide = page.getByRole('heading', { name: /Guide d'utilisation et d'apprentissage/ });
    await expect(guide).toBeVisible();
    for (const title of ['Bien utiliser ce guide', 'Partie 1 — Comprendre le coût de revient', "Partie 2 — Utiliser l'application, onglet par onglet",
        'Partie 3 — Lire vos résultats et décider', 'Partie 4 — Aller plus loin']) {
        await expect(page.getByRole('heading', { name: title })).toBeAttached();
    }
    for (const title of ['Par où commencer ? Les sept étapes', '4. Coûts additionnels', 'Simulation : et si mes coûts changeaient ?', 'Glossaire']) {
        await expect(page.getByRole('heading', { name: title })).toBeAttached();
    }
    await page.getByRole('link', { name: 'Simulation : et si mes coûts changeaient ?' }).click();
    await page.getByPlaceholder(/Rechercher un terme/).fill('point mort');
    await expect(page.locator('mark').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(guide).toHaveCount(0);
});

test('Guide : les ancres fines visées par les infobulles existent dans le DOM (lignes de tableau, listes, définitions)', async ({ page }) => {
    await openDemo(page);
    await page.getByTitle("Guide d'utilisation").click();
    await expect(page.getByRole('heading', { name: /Guide d'utilisation et d'apprentissage/ })).toBeVisible();
    for (const id of ['guide-param-col-pds', 'guide-ing-col-perte', 'guide-ff-fx-categorie', 'guide-prod-tuile-ratios', 'guide-prod-col-cout-indirect',
        'guide-sku-ligne-ff-canal', 'guide-seg-ligne-point-mort', 'guide-kpi-marge-brute', 'guide-bcg-poids-morts', 'guide-sim-impact-canal', 'guide-intrants-tendance']) {
        await expect(page.locator(`#${id}`), `ancre ${id}`).toBeAttached();
    }
});

test('Guide : le bouton « Télécharger en PDF » produit un vrai PDF paginé et le dernier encadré est la note sur la rigueur', async ({ page }) => {
    await openDemo(page);
    await page.getByTitle("Guide d'utilisation").click();
    await expect(page.getByRole('heading', { name: /Guide d'utilisation et d'apprentissage/ })).toBeVisible();
    // encadré final de la conclusion
    await expect(page.locator('#guide-conclusion aside').last()).toContainText('rigueur en tant que pilote');
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 120000 }),
        page.getByRole('button', { name: /Télécharger en PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('Guide_utilisation_TransfoCalculateur.pdf');
    const path = await download.path();
    const fs = await import('node:fs');
    const buf = fs.readFileSync(path);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThan(50);
    expect(buf.length).toBeGreaterThan(100000);
});
