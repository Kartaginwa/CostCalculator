// Phase 3.4 : l'import de rapport de ventes écrit sur format.channelPrices (prix net + volume par
// canal), crée un nouveau canal quand le texte du fichier ne correspond à aucun canal existant
// (décision utilisateur du 06/10), et ne crée JAMAIS un format automatiquement — voir
// Projet_Claude/03-Feuille-de-route.md / 05-Imports-Integrations.md.
import { test, expect } from '@playwright/test';
import path from 'path';

const fixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'sales-report-sample.csv');

test('import d\'un rapport de ventes : crée un canal, met à jour le prix net + volume du format', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Paramètres")').first().click();

    const menuSection = page.locator('#tutorial-section-info-menu');
    await menuSection.getByText('Importer un rapport de ventes').click();
    const modal = page.locator('div.fixed.inset-0.bg-black');
    await expect(modal.getByText(/Assistant d'importation d'un rapport de ventes/)).toBeVisible();

    // Étape 1 : téléversement.
    await modal.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(modal.getByText('Étape 2: Correspondance des colonnes')).toBeVisible();

    // Étape 2 : la correspondance des colonnes se devine automatiquement (mots-clés).
    await modal.getByText('Suivant').click();
    await expect(modal.getByText('Étape 3: Prévisualisation et résolution')).toBeVisible();

    // Étape 3 : le plat est reconnu, le format "1 unité" aussi ; le canal, absent, est proposé à
    // la création par défaut.
    const row = modal.locator('tbody tr').filter({ hasText: 'Chili con carne mijoté' });
    await expect(row.getByText('Lié à "Chili con carne mijoté"')).toBeVisible();
    await expect(row.locator('select').nth(1)).toHaveValue('create');
    await modal.getByText('Suivant').click();

    // Étape 4 : confirmation.
    await expect(modal.getByText('Étape 4: Confirmation')).toBeVisible();
    await modal.getByText('Confirmer et Importer').click();
    await expect(page.getByText('Importation réussie')).toBeVisible();

    // Le nouveau canal existe désormais dans Paramètres.
    const channelsSection = page.locator('#tutorial-section-info-channels');
    await expect(channelsSection.locator('input[value="Nouveau Canal Test"]')).toBeVisible();

    // Le format du produit porte maintenant 4 canaux (les 3 du projet démo + le nouveau), avec le
    // bon prix net et le bon volume.
    await menuSection.scrollIntoViewIfNeeded();
    // Sélectionne le produit dans la liste de gauche (vue maître-détail, refonte du 19/10).
    await menuSection.getByText('Chili con carne mijoté', { exact: true }).click();
    const targetSection = menuSection.locator('#product-detail-pane');
    const formatRow = targetSection.locator('tbody tr').first();
    await expect(formatRow.locator('button').first()).toHaveText(/4 canaux/);
    await formatRow.locator('button').first().click();
    const detailRow = formatRow.locator('xpath=following-sibling::tr[1]');
    // Repère la ligne importée par son prix net (12 $, unique parmi les 2 entrées de ce format —
    // un filtre par texte de canal serait ambigu : le <select> de CHAQUE ligne liste tous les
    // canaux existants parmi ses <option>, « Nouveau Canal Test » y apparaît donc partout).
    const newChannelEntry = detailRow.locator('.space-y-1 > div').filter({ has: page.locator('input[placeholder="Prix net $"][value="12"]') });
    await expect(newChannelEntry.locator('input[placeholder="Volume (u.)"]')).toHaveValue('50');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
