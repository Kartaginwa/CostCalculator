// État des résultats (onglet dédié, Phase 4.1/4.2) : revenus réels et frais fixes réels, chacun en
// section distincte — ajout/édition/suppression avec annulation, total dérivé, et pour les
// revenus, une ventilation par canal purement indicative (jamais un calcul réel).
import { test, expect } from '@playwright/test';

test("gestion des frais fixes dans l'onglet État des résultats", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Créer un nouveau projet').click();
    const skip = page.getByText('Explorer par moi-même');
    if (await skip.count() > 0) await skip.click();

    await page.locator('#tab-income-statement').click();
    await expect(page.locator('#tutorial-section-income-statement').getByRole('heading', { name: 'État des résultats' })).toBeVisible();

    const section = page.locator('#tutorial-section-expenses');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Frais fixes' })).toBeVisible();
    await expect(section.getByText('Aucune dépense listée')).toBeVisible();

    // Ajoute une première dépense
    await section.getByText('Ajouter une dépense').click();
    const rows = section.locator('input[placeholder="Poste de dépense (ex. Loyer)"]');
    await expect(rows).toHaveCount(1);
    const firstExpenseRow = section.locator('tbody tr').first();
    await rows.nth(0).fill('Loyer');
    await firstExpenseRow.locator('select').first().selectOption('Frais généraux de production');
    await firstExpenseRow.locator('input[placeholder="Montant ($)"]').fill('600');
    await firstExpenseRow.locator('input[placeholder="Montant ($)"]').blur();

    // Le total des frais fixes n'est affiché qu'une fois, dans la rangée « Sous-total » du tableau
    // (plus de bloc « Total des frais fixes » redondant sous le tableau).
    await expect(section.getByText('600.00 $', { exact: true })).toBeVisible();

    // Zones Activités/Canaux de vente (Phase 4.5) : désormais éditables, sur 2 axes indépendants —
    // une ligne fraîchement ajoutée n'a encore rien de réparti (champs vides), avec un badge
    // d'avertissement (purement informatif) tant qu'aucun axe n'est complété.
    await expect(section.getByText('Activités de production', { exact: true })).toBeVisible();
    await expect(section.getByText('Canaux de vente', { exact: true })).toBeVisible();
    const activityInputs = firstExpenseRow.locator('td input[inputmode="decimal"]');
    // Projet vierge : 1 seule activité par défaut (« Général ») + le contenant Général du bucket =
    // 2 contenants d'activité, 1 seul canal par défaut — Montant + 2 + 1 = 4 champs decimal.
    await expect(activityInputs).toHaveCount(4);
    await expect(firstExpenseRow.locator('[class*="text-amber"]')).toBeVisible();

    // Ajoute une deuxième dépense dans une autre catégorie
    await section.getByText('Ajouter une dépense').click();
    await expect(rows).toHaveCount(2);
    const secondExpenseRow = section.locator('tbody tr').nth(1);
    await rows.nth(1).fill('Assurances');
    await secondExpenseRow.locator('select').first().selectOption("Frais d'administration");
    await secondExpenseRow.locator('input[placeholder="Montant ($)"]').fill('400');
    await secondExpenseRow.locator('input[placeholder="Montant ($)"]').blur();

    // Séparateur de milliers (espace) dans l'affichage des montants : "1 000.00 $".
    await expect(section.getByText('1 000.00 $', { exact: true })).toBeVisible();

    // Supprime "Loyer" (garde "Assurances"), vérifie la notification avec option Annuler et le
    // total recalculé — puis que Paramètres reflète bien ce total en lecture seule.
    await section.locator('button[title="Supprimer cette dépense"]').first().click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('a été supprimée')).toBeVisible();
    await expect(section.getByText('400.00 $', { exact: true })).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("gestion des charges directes réelles dans l'onglet État des résultats (Phase 4.3)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-direct-costs');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Charges directes réelles' })).toBeVisible();
    // Démo : 4 lignes pré-remplies (une par type de coût), total 100 000 $.
    const rows = section.locator('input[placeholder="Poste de charge directe (ex. Achats de matières premières)"]');
    await expect(rows).toHaveCount(4);
    await expect(section.getByText('100 000.00 $', { exact: true })).toBeVisible();

    // Phase 4.3bis : Activités de production et Canaux de vente ventilés INDICATIVEMENT (dérivé du
    // coût théorique du modèle de recette, apparié au type de coût de chaque ligne) — jamais saisi.
    await expect(section.getByText('Activités de production (indicatif)', { exact: true })).toBeVisible();
    await expect(section.getByText('Canaux de vente (indicatif)', { exact: true })).toBeVisible();
    // La rangée Sous-total ventile chaque type de coût par activité : la somme des 4 colonnes
    // d'activité (incluant Général) reconstitue exactement le total réel de 100 000 $.
    const subtotalRow = section.locator('tfoot tr');
    await expect(subtotalRow.getByText('Sous-total', { exact: true })).toBeVisible();

    // Ajoute une ligne catégorisée par type de coût (pas une catégorie de frais fixes) — même
    // type (Sous-traitance) que la ligne démo déjà 100 % attribuée à une seule activité : la
    // nouvelle ligne doit se répartir exactement de la même façon (même driver théorique).
    await section.getByText('Ajouter une charge directe').click();
    await expect(rows).toHaveCount(5);
    const newRow = section.locator('tbody tr').last();
    await rows.nth(4).fill('Sous-traitance surgélation additionnelle');
    await section.locator('select').nth(4).selectOption('Sous-traitance');
    await section.locator('input[placeholder="Montant ($)"]').nth(4).fill('2000');
    await section.locator('input[placeholder="Montant ($)"]').nth(4).blur();
    await expect(section.getByText('102 000.00 $', { exact: true })).toBeVisible();
    // La nouvelle ligne affiche son montant intégral (2000$) dans UNE colonne d'activité indicative
    // (pas de valeur saisie — purement dérivée du même coût théorique que la ligne démo).
    await expect(newRow.getByText('2 000.00 $', { exact: true })).toBeVisible();

    // Suppression avec annulation
    await section.locator('button[title="Supprimer cette charge directe"]').last().click();
    await expect(rows).toHaveCount(4);
    await expect(page.getByText('a été supprimée')).toBeVisible();
    await expect(section.getByText('100 000.00 $', { exact: true })).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("gestion des revenus dans l'onglet État des résultats, avec répartition indicative par canal", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-revenue');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Revenus' })).toBeVisible();
    // Démo : 4 lignes pré-remplies, total 160 000 $.
    const rows = section.locator('input[placeholder="Poste de revenu"]');
    await expect(rows).toHaveCount(4);
    // Le total n'est affiché qu'une fois, dans la rangée « Sous-total » du tableau.
    await expect(section.getByText('160 000.00 $', { exact: true })).toBeVisible();

    // Une ligne rattachée à une activité affiche une ventilation par canal indicative.
    await expect(section.getByText('Canaux de vente', { exact: false }).first()).toBeVisible();

    // Ajoute une ligne "Général" : pas de ventilation par canal affichée pour celle-ci.
    await section.getByText('Ajouter un revenu').click();
    await expect(rows).toHaveCount(5);
    await rows.nth(4).fill('Revenu test');
    await section.locator('select').nth(4).selectOption('general');
    await section.locator('input[placeholder="Montant ($)"]').nth(4).fill('1000');
    await section.locator('input[placeholder="Montant ($)"]').nth(4).blur();
    await expect(section.getByText('161 000.00 $', { exact: true })).toBeVisible();

    // Suppression avec annulation
    await section.locator('button[title="Supprimer ce revenu"]').last().click();
    await expect(rows).toHaveCount(4);
    await expect(page.getByText('a été supprimé')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Revenus : colonnes par contenant (Général + activités) avant les colonnes canal, et Saisie manuelle multi-contenant", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();
    const section = page.locator('#tutorial-section-revenue');
    const firstRow = section.locator('tbody tr').first();

    // Colonnes "Activités de production" (Général + 3 activités) avant les colonnes "canal" — la
    // 1re ligne (Plats principaux surgelés, 90 000 $) affiche son montant dans SA colonne seulement.
    await expect(section.getByText('Activités de production', { exact: true })).toBeVisible();
    await expect(firstRow.getByText('90 000.00 $', { exact: true })).toBeVisible();
    await expect(firstRow.locator('td').nth(5)).toHaveText('—'); // colonne Général : non applicable (0=Poste, 1=Catégorie placeholder, 2=Clé de répartition, 3=Montant, 4=écart décoratif, 5=Général)

    // Bascule la 1re ligne en Saisie manuelle : Montant devient un total en lecture seule, et les
    // 4 cellules de contenant (Général + 3 activités) deviennent éditables individuellement.
    await firstRow.locator('select').first().selectOption('manual');
    const bucketInputs = firstRow.locator('td input[inputmode="decimal"]');
    await expect(bucketInputs).toHaveCount(4); // plus de champ Montant éditable en mode manuel
    await expect(firstRow.getByText('90 000.00 $', { exact: true })).toBeVisible(); // total inchangé

    // Ventile manuellement sur 2 contenants à la fois (Général + une 2e activité) — le total se
    // recalcule comme la somme des cellules, pas comme un seul montant.
    await bucketInputs.nth(0).fill('10000'); // Général
    await bucketInputs.nth(0).blur();
    await bucketInputs.nth(2).fill('20000'); // Soupes et potages (3e colonne de contenant)
    await bucketInputs.nth(2).blur();
    // Plats principaux (90000, déjà présent) + Général (10000) + Soupes et potages (20000) = 120000
    await expect(firstRow.getByText('120 000.00 $', { exact: true })).toBeVisible();
    // Total global : 120000 (ligne 1) + 40000 (Soupes) + 25000 (Sauces) + 5000 (Général) = 190000
    await expect(section.getByText('190 000.00 $', { exact: true })).toBeVisible();

    // Rangée « Sous-total » : un sous-total par colonne de contenant, pas seulement le total global —
    // « Soupes et potages » cumule la contribution de 2 lignes (20000 saisis manuellement sur la
    // ligne 1 + 40000 déjà présents sur la ligne 2) = 60000.
    const subtotalRow = section.locator('tfoot tr');
    await expect(subtotalRow.getByText('Sous-total', { exact: true })).toBeVisible();
    await expect(subtotalRow.getByText('60 000.00 $', { exact: true })).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("réconciliation réel/théorique dans l'onglet État des résultats (Phase 4.4)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-reconciliation');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Réconciliation réel / théorique' })).toBeVisible();

    // Démo : revenus réels (160 000 $, lignes de revenus réels) vs théorique — corrigé le 18/10,
    // confirmé le 19/10 (voir Projet_Claude/03-Feuille-de-route.md, addendum du 19/10) : le
    // théorique vient UNIQUEMENT du volume RÉEL par canal (prix net × volume), jamais de
    // generalInfo.totalRevenue (réel) — ce serait mélanger les deux jeux de données que cette
    // réconciliation doit justement garder indépendants ; les deux ne coïncident pas par
    // construction, les canaux réels ne couvrant qu'un sous-ensemble des revenus totaux de
    // l'entreprise.
    const revenueRow = section.locator('tbody tr', { hasText: 'Revenus' });
    await expect(revenueRow.getByText('160 000.00 $', { exact: true }).first()).toBeVisible();
    await expect(revenueRow.getByText('75 366.10 $', { exact: true })).toBeVisible();
    await expect(revenueRow.getByText('+112.3 %', { exact: true })).toBeVisible();

    // Charges directes : réel (100 000 $, saisi) vs théorique (dérivé du modèle de recette, sur
    // le même volume réel par canal) — un écart non nul, comme pour les revenus.
    const directCostsRow = section.locator('tbody tr', { hasText: 'Charges directes' });
    await expect(directCostsRow.getByText('100 000.00 $', { exact: true })).toBeVisible();
    await expect(directCostsRow.getByText('72 960.44 $', { exact: true })).toBeVisible();

    // Marge = Revenus - Charges directes, des deux côtés (réel ET théorique).
    const margeRow = section.locator('tbody tr', { hasText: 'Marge' });
    await expect(margeRow.getByText('60 000.00 $', { exact: true })).toBeVisible();
    await expect(margeRow.getByText('2 405.66 $', { exact: true })).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Revenus : la colonne Montant tient 99 999 999.99 $ sur une seule ligne, sans débordement horizontal (cible définitive du 13/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-revenue');
    const firstMontantInput = section.locator('input[placeholder="Montant ($)"]').first();
    // 99 929 999.99 + 40 000 + 25 000 + 5 000 (autres lignes démo inchangées) = 99 999 999.99 $.
    await firstMontantInput.fill('99929999.99');
    await firstMontantInput.blur();

    // Le sous-total doit s'afficher en un seul nœud de texte (pas de saut de ligne au milieu).
    const subtotalRow = section.locator('tfoot tr');
    await expect(subtotalRow.getByText('99 999 999.99 $', { exact: true })).toBeVisible();

    // Aucun défilement horizontal introduit par cette largeur de colonne.
    const scrollDiv = section.locator('.overflow-x-auto').first();
    const scrollWidth = await scrollDiv.evaluate(el => el.scrollWidth);
    const clientWidth = await scrollDiv.evaluate(el => el.clientWidth);
    expect(scrollWidth, 'le tableau Revenus déborde horizontalement').toBeLessThanOrEqual(clientWidth);

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Frais fixes : allocation manuelle à un seul bassin partagé (Activités + Canaux confondus), vérification en temps réel (Phase 4.5, corrigé le 14/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-expenses');
    // Chaque ligne démo porte désormais une clé de répartition déterminée selon la méthodologie
    // comptable documentée dans initialState.js (plus aucune ligne n'est laissée blanche/Manuel) —
    // une ligne fraîchement ajoutée (toujours Manuel, rien réparti) est donc le point de départ le
    // plus robuste pour ce test de saisie manuelle depuis un état vide.
    await section.getByText('Ajouter une dépense').click();
    const row = section.locator('tbody tr').last();
    await row.locator('input[placeholder="Poste de dépense (ex. Loyer)"]').fill('Frais divers (test)');
    const montantInput = row.locator('input[placeholder="Montant ($)"]');
    await montantInput.fill('3000');
    await montantInput.blur();
    await expect(row.locator('[class*="text-amber"]')).toBeVisible();

    // Répartit manuellement sur des colonnes d'activité (1500 + 1500 = 3000 = Montant, Canaux reste
    // vide) : Activités et Canaux forment UN SEUL bassin partagé — une fois le montant complet
    // réparti côté Activités, il n'y a plus rien à verser côté Canaux. Index des champs decimal de
    // la ligne : 0 = Montant, 1 = Général, 2..4 = activités, 5..7 = canaux (démo : Général + 3
    // activités, 3 canaux).
    const bucketInputs = row.locator('td input[inputmode="decimal"]');
    await bucketInputs.nth(2).fill('1500'); // 1re activité (Plats principaux surgelés)
    await bucketInputs.nth(2).blur();
    await bucketInputs.nth(3).fill('1500'); // 2e activité (Soupes et potages)
    await bucketInputs.nth(3).blur();

    // 1500+1500 = 3000 = Montant (Canaux à 0 n'a plus besoin d'être complété) : badge vert, le
    // bassin partagé est entièrement réparti.
    await expect(row.locator('[class*="text-green"]')).toBeVisible();

    // Ajouter quoi que ce soit côté Canaux dépasserait maintenant le Montant (3000 déjà réparti) :
    // badge d'avertissement de nouveau — jamais bloquant, purement informatif.
    await bucketInputs.nth(5).fill('100');
    await bucketInputs.nth(5).blur();
    await expect(row.locator('[class*="text-amber"]')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Frais fixes : la clé de répartition « Selon les ventes » verrouille la grille (recalcul en direct) ; repasser en Manuel fige la dernière valeur, de nouveau éditable (Phase 4.5bis, 14/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-expenses');
    // "Comptabilité et services professionnels" (2000 $) : Général par défaut dans la démo — change
    // la clé pour « Selon les ventes », peu importe la clé de départ.
    const row = section.locator('tbody tr').filter({ has: page.locator('input[value="Comptabilité et services professionnels"]') });
    await row.locator('select').nth(1).selectOption('sales');

    // 2000 $ réparti au prorata des revenus réels par activité (90000/40000/25000/5000 sur 160000) :
    // Général = 2000×5000/160000 = 62.50 ; Plats = 2000×90000/160000 = 1125.00. Verrouillé : affiché
    // en texte (pas un <input>) — seul Montant reste éditable tant que la clé n'est pas Manuel.
    await expect(row.getByText('62.50 $', { exact: true })).toBeVisible();
    await expect(row.getByText('1 125.00 $', { exact: true })).toBeVisible();
    await expect(row.locator('td input[inputmode="decimal"]')).toHaveCount(1); // Montant seulement
    // « Selon les ventes » ne touche QUE l'axe Activités (jamais Canaux, purement indicatif côté
    // Revenus) : la répartition par activité couvre déjà 100 % du montant (Général est l'un des
    // contenants d'activité) — badge vert, plus d'écart artificiel côté Canaux (correction du 14/10).
    await expect(row.locator('[class*="text-green"]')).toBeVisible();

    // Repasser à Manuel fige (« bake in ») la dernière valeur calculée comme point de départ éditable
    // — jamais une liaison permanente, modifiable ensuite cellule par cellule.
    await row.locator('select').nth(1).selectOption('manual');
    const bucketInputs = row.locator('td input[inputmode="decimal"]');
    await expect(bucketInputs).toHaveCount(8); // Montant + 4 activités + 3 canaux
    await expect(bucketInputs.nth(1)).toHaveValue('62.5'); // Général
    await expect(bucketInputs.nth(2)).toHaveValue('1125'); // Plats principaux surgelés

    await bucketInputs.nth(1).fill('100');
    await bucketInputs.nth(1).blur();
    await expect(bucketInputs.nth(1)).toHaveValue('100');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Frais fixes : sélection directe d'une seule activité ou d'un seul canal verrouille toute la ligne (bassin partagé), 100 % dans cette seule colonne (Phase 4.5bis, corrigé le 14/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-expenses');
    const row = section.locator('tbody tr').filter({ has: page.locator('input[value="Assurances"]') });
    // "— Une seule activité —" liste Général + chaque activité ; on choisit "Soupes et potages".
    await row.locator('select').nth(1).selectOption({ label: 'Soupes et potages' });

    // 100 % du montant (2500 $) dans cette seule colonne d'activité ; le bassin est un seul tout
    // partagé (Activités + Canaux confondus) — plus rien à verser côté Canaux, donc toute la ligne
    // est verrouillée (seul Montant reste un <input>).
    await expect(row.getByText('2 500.00 $', { exact: true })).toBeVisible();
    const bucketInputs = row.locator('td input[inputmode="decimal"]');
    await expect(bucketInputs).toHaveCount(1);
    await expect(row.locator('[class*="text-green"]')).toBeVisible();

    // Même logique côté Canaux : sélectionner un canal précis attribue 100 % du montant à cette
    // seule colonne de canal, rien côté Activités — c'est la SEULE façon d'attribuer un montant à
    // un canal par une clé prédéfinie (jamais via Selon les ventes/charges directes, qui ne
    // touchent que l'axe Activités).
    const row2 = section.locator('tbody tr').filter({ has: page.locator('input[value="Frais bancaires et intérêts"]') });
    await row2.locator('select').nth(1).selectOption({ label: 'Épiceries indépendantes' });
    await expect(row2.getByText('1 000.00 $', { exact: true })).toBeVisible();
    const bucketInputs2 = row2.locator('td input[inputmode="decimal"]');
    await expect(bucketInputs2).toHaveCount(1);
    await expect(row2.locator('[class*="text-green"]')).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Frais fixes : les montants saisis dans la grille Activités/Canaux sont arrondis à 2 décimales (Phase 4.5bis)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    const section = page.locator('#tutorial-section-expenses');
    // "Loyer" est en Manuel dans la démo (répartition par surface de production réellement occupée)
    // — ses cellules d'activité restent éditables, contrairement aux lignes verrouillées par clé.
    const row = section.locator('tbody tr').filter({ has: page.locator('input[value="Loyer (espace de production)"]') });
    const bucketInputs = row.locator('td input[inputmode="decimal"]');
    await bucketInputs.nth(2).fill('33.4567'); // 1re activité (Plats principaux surgelés)
    await bucketInputs.nth(2).blur();
    await expect(bucketInputs.nth(2)).toHaveValue('33.46');

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});

test("Clés de répartition personnalisées : création dans la fenêtre modale, application sur une ligne (Phase 4.5bis, 14/10)", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.getByText('Explorer un projet démo').click();
    await page.locator('#tab-income-statement').click();

    await page.getByText('Gérer les clés de répartition').click();
    const modal = page.getByRole('heading', { name: 'Clés de répartition', exact: true }).locator('..').locator('..');
    await modal.getByText('Ajouter une clé').click();
    // La démo porte déjà une clé personnalisée (« Ventes par canal (hors Général) », pour les
    // Commissions) : .last() cible la carte nouvellement ajoutée, pas la carte démo.
    await modal.getByPlaceholder('Nom de la clé (ex. Équipe de vente)').last().fill('Équipe de vente');
    const card = modal.locator('div.border.border-gray-200.rounded-lg').filter({ has: page.locator('input[value="Équipe de vente"]') });
    // Deux colonnes % : Activités (Général + 3 activités) puis Canaux (3 canaux) — on cible la 1re
    // activité (Général) à 40 % et le 1er canal à 60 %, dans la carte de la nouvelle clé seulement.
    const pctInputs = card.locator('input[inputmode="decimal"]');
    await pctInputs.nth(0).fill('40');
    await pctInputs.nth(0).blur();
    await pctInputs.nth(4).fill('60'); // 1er input de la colonne Canaux (après les 4 d'Activités)
    await pctInputs.nth(4).blur();
    await page.getByText('Fermer').click();

    const section = page.locator('#tutorial-section-expenses');
    const row = section.locator('tbody tr').filter({ has: page.locator('input[value="Marketing et promotion"]') });
    await row.locator('select').nth(1).selectOption({ label: 'Équipe de vente' });

    // Marketing = 4000 $ : 40 % en Général = 1 600.00 $, 60 % sur le 1er canal = 2 400.00 $.
    await expect(row.getByText('1 600.00 $', { exact: true })).toBeVisible();
    await expect(row.getByText('2 400.00 $', { exact: true })).toBeVisible();

    expect(errors, `Erreurs console/page inattendues :\n${errors.join('\n')}`).toEqual([]);
});
