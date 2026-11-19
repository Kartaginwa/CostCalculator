import { test, expect } from '@playwright/test';

// Étape 7 de la Phase 7 : la visite guidée est une démonstration qui se joue seule, sur une COPIE du projet
// démo (saisie lettre à lettre, étiquettes, valeurs lues en direct), sans jamais toucher au projet de l'utilisateur.
// À la fin, elle se ferme d'elle-même : l'utilisateur retrouve ce qu'il avait (un projet, ou l'accueil).
const SCENES = 32;
const collectErrors = (page) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror : ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console : ${m.text()}`); });
    return errors;
};

test('Accueil : bouton de visite sur toute la largeur des trois autres, au même style', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('button.group');
    await expect(cards).toHaveCount(4);
    const boxes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, y: r.y, cls: e.className }; }));
    const [a, , c, tour] = boxes;
    expect(Math.abs(tour.x - a.x)).toBeLessThan(2);
    expect(Math.abs((tour.x + tour.w) - (c.x + c.w))).toBeLessThan(2);
    expect(tour.y).toBeGreaterThan(a.y + 50);
    for (const k of ['bg-white', 'rounded-lg', 'shadow-md']) expect(tour.cls).toContain(k);
});

test('La visite démarre seule, se contrôle par une petite barre (pause, scènes, chapitres, vitesse) et Échap la quitte', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.getByTestId('start-tour').click();
    await expect(page.getByTestId('tour-caption')).toContainText('Combien coûte vraiment');
    await expect(page.getByTestId('tour-caption')).not.toContainText(/touch|copie/i); // aucune précaution inutile en ouverture
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'accueil');
    // l'utilisateur ne peut pas faire défiler la page pendant la visite (la caméra s'en charge)
    expect(await page.evaluate(() => document.documentElement.style.overflowY)).toBe('hidden');

    // la barre est basse et mince
    const bar = await page.getByTestId('tour-controls').boundingBox();
    expect(bar.height).toBeLessThanOrEqual(48);
    expect(bar.y + bar.height).toBeGreaterThan(700);

    // aucun clic nécessaire : la scène suivante arrive d'elle-même (≈ 9 s à 1×, vitesse 1,5×)
    await page.getByRole('button', { name: '1,5×' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'ordre', { timeout: 12000 });

    // pause : le temps ne bouge plus
    await page.getByTestId('tour-toggle').click();
    const t1 = await page.getByTestId('tour-time').innerText();
    await page.waitForTimeout(1500);
    expect(await page.getByTestId('tour-time').innerText()).toBe(t1);
    await page.getByRole('button', { name: 'Scène suivante' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'entreprise');
    await page.getByRole('button', { name: 'Scène précédente' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'ordre');
    await page.getByRole('button', { name: 'Chapitre : Vos frais' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'revenus');

    // les clics sur l'application jouée sont bloqués
    await page.mouse.click(640, 300);
    await expect(page.getByTestId('tour-controls')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tour-layer')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.style.overflowY)).toBe('');
    await expect(page.getByText('Créer un nouveau projet')).toBeVisible();
    expect(errors).toEqual([]);
});

test('Les mots et les chiffres se tapent vraiment dans l\'application jouée, avec des étiquettes qui lisent les résultats en direct', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.getByTestId('start-tour').click();
    await page.getByRole('button', { name: '1,5×' }).click();
    await page.getByRole('button', { name: 'Chapitre : Votre entreprise' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'entreprise');
    // le nom de l'entreprise (celui du démo, pour aller avec le logo) se retape lettre à lettre dans la copie du démo
    const field = page.getByTestId('tour-app').locator('#tutorial-company-name');
    const FULL = 'Boréal Mets Préparés inc.';
    await expect.poll(async () => { const v = await field.inputValue(); return v.length > 0 && v.length < FULL.length; }, { timeout: 15000 }).toBe(true);
    await expect(field).toHaveValue(FULL, { timeout: 15000 });
    await expect(page.getByTestId('tour-note').first()).toBeVisible();

    // un ingrédient se saisit : le coût unitaire est lu en direct dans l'étiquette
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Scène suivante' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute('data-scene', 'ingredient-saisie');
    await expect(page.getByTestId('tour-app').locator('[id^="ingredient-row-manual_"] input').first()).toHaveValue('Farine de blé', { timeout: 15000 });
    await expect(page.getByTestId('tour-note').filter({ hasText: 'Coût unitaire : 1,85' })).toBeVisible({ timeout: 20000 });
});

test('La visite se joue en entier sur une copie du démo, se ferme d\'elle-même, et le projet de l\'utilisateur, ses filtres et son onglet ne bougent pas', async ({ page }) => {
    test.setTimeout(300000);
    const errors = collectErrors(page);
    await page.clock.install();
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    await page.getByText('Explorer par moi-même').click();

    // projet de l'utilisateur : un nom d'entreprise, un filtre dans Ingrédients
    await page.locator('#tutorial-company-name').fill('Mon entreprise test');
    await page.locator('#tab-ingredients').click();
    await page.locator('#filterName').fill('Beurre');
    await page.locator('#tab-labor').click();
    await expect(page.getByTestId('unsaved-indicator')).toHaveCount(1); // le projet de l'utilisateur est modifié, non sauvegardé

    // lancement par le lien du guide
    await page.getByTitle("Guide d'utilisation").click();
    await page.getByText('lancer la visite guidée').first().click();
    await expect(page.getByTestId('tour-controls')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Guide d'utilisation et d'apprentissage/ })).toHaveCount(0);

    // le démo joué est une COPIE : l'entreprise du démo s'affiche, pas celle de l'utilisateur
    await page.getByRole('button', { name: '1,5×' }).click();
    await page.clock.runFor(2500);
    await expect(page.getByTestId('tour-app').locator('#tutorial-company-name')).toHaveValue('Boréal Mets Préparés inc.');

    const seen = new Set();
    const framing = [];
    for (let i = 0; i < 400; i++) {
        // la caméra suit : une étiquette visible reste toujours dans le cadre, au-dessus des sous-titres
        const st = await page.evaluate(() => {
            const l = document.querySelector('[data-testid=tour-layer]');
            if (!l) return null;
            const bad = [...document.querySelectorAll('[data-testid=tour-note]')].filter((n) => n.style.opacity === '1').map((n) => n.getBoundingClientRect())
                .filter((b) => b.top < 6 || b.bottom > window.innerHeight - 148 || b.left < 4 || b.right > window.innerWidth - 4).length;
            const rs = [...document.querySelectorAll('[data-testid=tour-note]')].filter((n) => n.style.opacity === '1').map((n) => n.getBoundingClientRect());
            let overlap = 0;
            for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) {
                if (rs[a].left < rs[b].right - 2 && rs[a].right > rs[b].left + 2 && rs[a].top < rs[b].bottom - 2 && rs[a].bottom > rs[b].top + 2) overlap++;
            }
            return { scene: l.dataset.scene, bad: bad + overlap };
        });
        if (!st) break;
        seen.add(st.scene);
        if (st.bad) framing.push(st.scene);
        await page.clock.runFor(1000);
    }
    expect([...new Set(framing)], 'étiquettes hors du cadre').toEqual([]);
    expect(seen.size).toBe(SCENES);
    // tous les gestes du scénario ont trouvé leur cible (aucune scène « dans le vide »)
    expect(await page.evaluate(() => window.__tourMisses || []), 'gestes sans cible').toEqual([]);
    expect(await page.evaluate(() => document.documentElement.style.overflowY)).toBe('');
    // fin : aucune fenêtre, la visite se referme et on retrouve exactement ce qu'on avait
    await expect(page.getByTestId('tour-layer')).toHaveCount(0);
    await expect(page.getByTestId('tour-end-card')).toHaveCount(0);
    await expect(page.locator('#tab-labor')).toHaveClass(/border-blue|text-blue/);
    await expect(page.getByTestId('unsaved-indicator')).toHaveCount(1);
    await page.locator('#tab-info').click();
    await expect(page.locator('#tutorial-company-name')).toHaveValue('Mon entreprise test');
    await page.locator('#tab-ingredients').click();
    await expect(page.locator('#filterName')).toHaveValue('Beurre');
    expect(errors).toEqual([]);
});

test('Depuis l\'accueil : à la fin la visite se referme d\'elle-même et ramène à l\'accueil', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-tour').click();
    for (let i = 0; i < SCENES; i++) await page.getByRole('button', { name: 'Scène suivante' }).click();
    await expect(page.getByTestId('tour-layer')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText('Créer un nouveau projet')).toBeVisible();
    await expect(page.getByTestId('tour-end-card')).toHaveCount(0);
});
