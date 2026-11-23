// Fenêtre d'export du rapport PDF (phase 6 de la refonte de l'export, 22/11) : chapitres, commentaire de la direction, salaires, enregistrement avec le projet,
// chapitres grisés sans données, avertissement de période. L'impression du navigateur est observée (print() du cadre caché), pas pilotée.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const openDemo = async (page) => {
    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await expect(page.getByText('Projet d\'exemple chargé avec succès')).toBeVisible();
};
const openExport = async (page) => {
    await page.locator('#tab-summary').click();
    await page.getByText('Générer un rapport PDF').click();
    await expect(page.getByRole('dialog', { name: 'Exporter le rapport PDF' })).toBeVisible();
};
// Capture le HTML que le navigateur s'apprête à imprimer (la boîte d'impression d'un navigateur ne se pilote pas).
const captureBrowserPrint = (page) => page.evaluate(() => {
    window.__printed = [];
    const original = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        configurable: true,
        get() { const w = original.call(this); return new Proxy(w, { get: (t, k) => (k === 'print' ? () => { window.__printed.push(this.srcdoc); } : k === 'focus' ? () => {} : t[k]) }); },
    });
});

test('chapitres, commentaire et salaires : choisis dans la fenêtre, imprimés, retrouvés à la réouverture et enregistrés avec le projet', async ({ page }) => {
    test.setTimeout(180000);
    await openDemo(page);
    await captureBrowserPrint(page);
    await openExport(page);
    const dialog = page.getByRole('dialog', { name: 'Exporter le rapport PDF' });

    // Huit chapitres, tous cochés et disponibles dans le démo
    const boxes = dialog.getByRole('checkbox', { name: /Inclure/ });
    await expect(boxes).toHaveCount(8);
    for (let i = 0; i < 8; i++) await expect(boxes.nth(i)).toBeChecked();
    for (let i = 0; i < 8; i++) await expect(boxes.nth(i)).toBeEnabled();

    // Le démo n'a pas de dates de période : avertissement dans la fenêtre (jamais dans le rapport)
    await expect(dialog.getByRole('note')).toContainText('période ne sera pas imprimée');

    // Titre et destinataire
    await dialog.getByLabel('Titre du rapport').fill('Rapport du troisième trimestre');
    await dialog.getByLabel('Présenté à').fill('la Banque du Nord');

    // Décocher les chapitres 6 et 7, écrire un commentaire au chapitre 2, cocher les salaires dans les annexes
    await dialog.getByRole('checkbox', { name: 'Inclure le chapitre 6' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Inclure le chapitre 7' }).uncheck();
    await dialog.getByRole('button', { name: /2\. Résultats/ }).click();
    await dialog.getByLabel(/Commentaire de la direction/).fill('Le creux d’août suit la hausse du prix du bœuf.');
    await expect(dialog.getByText('47 / 1000')).toBeVisible();
    await dialog.getByRole('button', { name: 'Annexes' }).click();
    await dialog.getByRole('checkbox', { name: /Inclure les salaires individuels/ }).check();

    await dialog.getByRole('button', { name: 'Générer le PDF' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 60000 }); // la fenêtre se ferme une fois le rapport envoyé à l'impression

    const printed = await page.evaluate(() => window.__printed);
    expect(printed).toHaveLength(1);
    const html = printed[0];
    expect(html).toContain('Rapport du troisième trimestre');
    expect(html).toContain('Préparé à l’attention de la Banque du Nord');
    expect(html).toContain('Le creux d’août suit la hausse du prix du bœuf.');
    expect(html).toContain('Annexe C'); // salaires individuels demandés
    expect(html).toContain('Mireille');
    expect(html).not.toContain('Chapitre 6 ');
    expect(html).not.toContain('Fiches produits');
    expect(html).not.toContain('Boréal Mets Préparés inc.'.toUpperCase());
    expect(html).toContain('Boréal Mets Préparés inc.'); // en-tête de page : nom de l'entreprise
    expect(html).toContain('data:image/'); // les logos sont intégrés : la fenêtre d'impression n'a pas de réseau

    // Réouverture : tout est retrouvé
    await openExport(page);
    const again = page.getByRole('dialog', { name: 'Exporter le rapport PDF' });
    await expect(again.getByLabel('Titre du rapport')).toHaveValue('Rapport du troisième trimestre');
    await expect(again.getByLabel('Présenté à')).toHaveValue('la Banque du Nord');
    await expect(again.getByRole('checkbox', { name: 'Inclure le chapitre 6' })).not.toBeChecked();
    await expect(again.getByRole('checkbox', { name: 'Inclure le chapitre 3' })).toBeChecked();
    await again.getByRole('button', { name: /2\. Résultats/ }).click();
    await expect(again.getByLabel(/Commentaire de la direction/)).toHaveValue('Le creux d’août suit la hausse du prix du bœuf.');
    await again.getByRole('button', { name: 'Annexes' }).click();
    await expect(again.getByRole('checkbox', { name: /Inclure les salaires individuels/ })).toBeChecked();

    // Annuler : rien n'est modifié
    await again.getByRole('button', { name: /3\. Produits/ }).click();
    await again.getByLabel(/Commentaire de la direction/).fill('Texte abandonné');
    await again.getByRole('button', { name: 'Annuler' }).click();
    await expect(again).toHaveCount(0);

    // Enregistré AVEC LE PROJET : présent dans le fichier de sauvegarde
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Sauvegarder/ }).click();
    const saved = JSON.parse(fs.readFileSync(await (await download).path(), 'utf-8'));
    expect(saved.uiSettings.reportOptions).toEqual({
        title: 'Rapport du troisième trimestre', presentedTo: 'la Banque du Nord', chapters: ['1', '2', '3', '4', '5', 'A'],
        comments: { 2: 'Le creux d’août suit la hausse du prix du bœuf.' }, includeSalaries: true,
    });
});

test('sans commentaire ni salaires : le rapport n\'imprime ni case vide ni données de salaires', async ({ page }) => {
    test.setTimeout(180000);
    await openDemo(page);
    await captureBrowserPrint(page);
    await openExport(page);
    const dialog = page.getByRole('dialog', { name: 'Exporter le rapport PDF' });
    await dialog.getByRole('button', { name: 'Générer le PDF' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 60000 });
    const html = (await page.evaluate(() => window.__printed))[0];
    expect(html).not.toContain('Commentaire de la direction');
    expect(html).not.toContain('Annexe C');
    expect(html).not.toContain('Mireille');
    expect(html).toContain('Préparé à l’attention des gestionnaires de Boréal Mets Préparés inc.');
});

test('un chapitre sans données est grisé avec sa raison, et on ne peut pas générer sans chapitre', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();
    await page.locator('#tab-summary').click();
    await page.getByText('Générer un rapport PDF').click();
    const dialog = page.getByRole('dialog', { name: 'Exporter le rapport PDF' });
    await expect(dialog).toBeVisible();
    // Projet vide : les chapitres 1 à 7 sont indisponibles (grisés), les annexes restent possibles
    for (const n of ['1', '2', '3', '4', '5', '6', '7']) {
        const box = dialog.getByRole('checkbox', { name: `Inclure le chapitre ${n}` });
        await expect(box).toBeDisabled();
        await expect(box).not.toBeChecked();
    }
    await expect(dialog.getByRole('checkbox', { name: 'Inclure les annexes' })).toBeEnabled();
    await dialog.getByRole('button', { name: /3\. Produits/ }).click();
    await expect(dialog.getByText('Aucun produit actif.')).toBeVisible();
    // Sans aucun chapitre, le bouton de génération est inactif
    await dialog.getByRole('checkbox', { name: 'Inclure les annexes' }).uncheck();
    await expect(dialog.getByRole('button', { name: 'Générer le PDF' })).toBeDisabled();
    // Échap ferme la fenêtre
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});
