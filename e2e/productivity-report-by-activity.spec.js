// Phase 6 (15/10) : le rapport de productivité (onglet Main-d'œuvre) ne groupait que par POSTE —
// étendu pour grouper aussi par ACTIVITÉ de production (capacité de production par ligne), voir
// Projet_Claude/03-Feuille-de-route.md. Pas de "heures attendues" par activité (un poste/employé
// n'est pas rattaché à une seule activité, rien d'analogue à comparer) — seulement la part des
// heures de main-d'œuvre réellement nécessaires que chaque activité consomme du total du menu.
import { test, expect } from '@playwright/test';

test("Main-d'œuvre : rapport de productivité étendu par activité de production (Phase 6, 15/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('#tab-labor').click();

    // Le rapport par poste existant reste inchangé.
    const byPostSection = page.locator('#tutorial-section-labor-rapport');
    await expect(byPostSection.getByRole('heading', { name: 'Rapport de productivité pour la période' })).toBeVisible();

    // Nouveau tableau "Capacité de production par activité" : une ligne par activité du projet
    // démo (Plats principaux surgelés, Soupes et potages, Sauces et accompagnements), part du
    // total qui somme à 100 %.
    const byActivitySection = page.locator('h2', { hasText: 'Capacité de production par activité' }).locator('xpath=..');
    await expect(byActivitySection.getByRole('heading', { name: 'Capacité de production par activité' })).toBeVisible();
    await expect(byActivitySection.locator('th', { hasText: 'Activité' })).toBeVisible();
    await expect(byActivitySection.locator('th', { hasText: 'Heures Productives Réelles' })).toBeVisible();
    await expect(byActivitySection.locator('th', { hasText: 'Part du total' })).toBeVisible();

    const rows = byActivitySection.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: 'Plats principaux surgelés' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Soupes et potages' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Sauces et accompagnements' })).toBeVisible();

    // Les parts (3e colonne de CHAQUE ligne) somment à 100 %.
    const shares = await rows.evaluateAll(trs => trs.map(tr => tr.querySelectorAll('td')[2].innerText));
    const total = shares.reduce((sum, text) => sum + parseFloat(text.replace('%', '').trim()), 0);
    expect(total).toBeCloseTo(100, 0);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
