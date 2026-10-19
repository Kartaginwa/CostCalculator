// Phase 6 (15/10) : le simulateur de chocs de coûts (onglet Résumé → Simulation) ne portait que sur
// les ingrédients/la main-d'œuvre, sans lien avec les formats/activités/circuits — voir
// Projet_Claude/03-Feuille-de-route.md. Deux nouvelles portées ('format', 'activity') ciblent
// maintenant directement un format de vente ou une activité de production (résolues en ingrédients/
// employés concrets par engine/costScenario.js::expandShockScopes), et le rapport d'impact
// s'étend avec deux tableaux : par activité de production et par circuit de vente
// (engine/analysisData.js::computeActivityImpact/computeChannelImpact).
import { test, expect } from '@playwright/test';

test("Simulateur de chocs : portées 'par format'/'par activité' et tableaux d'impact par activité/canal", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-summary').click();
    await page.getByText('Simulation', { exact: true }).click();
    await expect(page.getByText(/Simulation — choc sur les coûts/)).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter un choc' }).click();
    const shockRow = page.locator('.space-y-3 > div').first();

    // Les deux nouvelles portées sont proposées pour les Intrants...
    const scopeSelect = shockRow.locator('select').nth(1);
    await expect(scopeSelect.locator('option', { hasText: 'Par format' })).toHaveCount(1);
    await expect(scopeSelect.locator('option', { hasText: 'Par activité de production' })).toHaveCount(1);
    // ... et pour la main-d'œuvre (même liste de portées).
    await shockRow.locator('select').first().selectOption('labor');
    const laborScopeSelect = shockRow.locator('select').nth(1);
    await expect(laborScopeSelect.locator('option', { hasText: 'Par format' })).toHaveCount(1);
    await expect(laborScopeSelect.locator('option', { hasText: 'Par activité de production' })).toHaveCount(1);

    // Choc d'intrants +1000 % ciblé sur UNE SEULE activité ("Sauces et accompagnements") : assez
    // massif pour qu'un simple test visuel (avant != après) ne dépende pas de la composition exacte
    // des recettes démo.
    await shockRow.locator('select').first().selectOption('ingredient');
    await shockRow.locator('select').nth(1).selectOption('activity');
    const activityTarget = shockRow.locator('select').nth(2);
    await activityTarget.selectOption({ label: 'Sauces et accompagnements' });
    await shockRow.locator('input[placeholder="ex. +15"]').fill('1000');
    await expect(page.getByText('Scénario actif :')).toBeVisible();

    // Tableau "Impact par activité de production" : l'activité ciblée ("Sauces et accompagnements")
    // voit son food cost bondir nettement plus que les autres activités du menu — certaines
    // partagent un ingrédient avec les sauces (prix global, pas scopé par activité) et bougent donc
    // un peu elles aussi, mais jamais autant que l'activité directement ciblée.
    const activityTable = page.locator('p', { hasText: 'Impact par activité de production' }).locator('xpath=following-sibling::table');
    const readDelta = async (rowLocator) => {
        const text = await rowLocator.locator('td').nth(2).innerText();
        const [before, after] = text.split('→').map(s => parseFloat(s.trim().replace('%', '')));
        return after - before;
    };
    const saucesDelta = await readDelta(activityTable.locator('tr', { hasText: 'Sauces et accompagnements' }));
    const platsDelta = await readDelta(activityTable.locator('tr', { hasText: 'Plats principaux surgelés' }));
    expect(saucesDelta).toBeGreaterThan(0);
    expect(saucesDelta).toBeGreaterThan(platsDelta);

    // Tableau "Impact par circuit de vente" : s'affiche aussi (3 canaux dans le projet démo).
    const channelTable = page.locator('p', { hasText: 'Impact par circuit de vente' }).locator('xpath=following-sibling::table');
    await expect(channelTable.locator('tbody tr')).toHaveCount(3);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
