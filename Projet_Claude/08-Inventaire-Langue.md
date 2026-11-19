# Inventaire de la langue (Phase 7, étape 6.0)

Chaînes et sites de code repérés par catégorie (hors tests). Un même site peut apparaître dans plusieurs catégories. Rien n'est modifié.

| Catégorie | Lignes | Fichiers |
|---|---|---|
| A. Marque (« Resto Calculateur » / « TransfoCalculateur ») | 11 | 6 |
| B. Mot « plat » (à bannir) | 54 | 17 |
| C. « Au Menu » / « menu » (vocabulaire de restauration) | 69 | 17 |
| D. Anglicismes et abréviations (libellés visibles) | 34 | 15 |
| E. Champs de fichier et filtres « Aucun » | 7 | 7 |
| F. Vocabulaire restauration (restaurant, chef, cuisine…) | 42 | 12 |
| G. Formatage de nombres et dates (sites d'affichage) | 245 | 20 |

## A. Marque (« Resto Calculateur » / « TransfoCalculateur »)

11 lignes dans 6 fichiers.

### src/App.jsx (2)
- L258 : `const defaultLogoUrl = './Logo_RestoCalculateur3.png'; // Utiliser le logo local du projet`
- L1030 : `<img src="./Logo_RestoCalculateur3.png" alt="Resto Calculateur Logo" className="h-28 w-auto" />`

### src/components/AppDialogs.jsx (2)
- L52 : `<img src="./Logo_RestoCalculateur3.png" alt="Resto Calculateur Logo" className="h-32 sm:h-48 w-auto mb-8" />`
- L54 : `<h1 className="text-4xl font-bold text-gray-800">Bienvenue sur Resto Calculateur</h1>`

### src/reports/generateGuidePdf.js (4)
- L263 : `doc.text('TransfoCalculateur', PAGE.w / 2, 115, { align: 'center' });`
- L327 : `doc.text('TransfoCalculateur — Guide d\'utilisation et d\'apprentissage', PAGE.left, PAGE.h - 9);`
- L330 : `doc.setProperties({ title: 'TransfoCalculateur — Guide d\'utilisation et d\'apprentissage', subject: 'Coût de revient', creator: 'TransfoCalculateur' `
- L331 : `doc.save('Guide_utilisation_TransfoCalculateur.pdf');`

### src/reports/generatePdf.js (1)
- L251 : `doc.text('Resto Calculateur', pageWidth / 2, 115, { align: 'center' });`

### index.html (1)
- L14 : `<title>TransfoCalculateur</title>`

### package.json (1)
- L2 : `"name": "RestoCalculateur",`

## B. Mot « plat » (à bannir)

54 lignes dans 17 fichiers.

### src/App.jsx (1)
- L731 : `message: 'Le plat "${productToDelete.platName}" a été supprimé.',`

### src/components/AppDialogs.jsx (5)
- L55 : `<p className="text-lg text-gray-600 mt-2">Votre outil pour maîtriser le coût de revient de vos plats.</p>`
- L207 : `{ selector: '#tutorial-section-summary-table', content: "Ce tableau vous permet de comparer rapidement la rentabilité de tous vos plats.", tab: 'summa`
- L208 : `{ selector: '#tutorial-contribution-chart', content: "Ce graphique classe vos plats selon leur contribution réelle en dollars à votre profit, vous mon`
- L209 : `{ selector: '#strategic-analysis', content: "L'analyse stratégique classe automatiquement vos plats (Étoiles, Vaches à lait...) pour vous aider à pren`
- L210 : `{ selector: '#tutorial-section-summary-bysku', content: "Le sous-onglet 'Par SKU' détaille un seul plat à travers ses canaux de vente, et comment ses `

### src/components/guide/content/partie0.js (1)
- L58 : `{ type: 'p', text: 'Le projet démo est une entreprise fictive complète, **Boréal Mets Préparés inc.**, qui fabrique des mets préparés surgelés, des so`

### src/components/guide/content/partie2a.js (3)
- L46 : `{ type: 'callout', kind: 'exemple', text: 'Le projet démo a trois activités : Plats principaux surgelés, Soupes et potages, Sauces et accompagnements.`
- L100 : `{ type: 'callout', kind: 'astuce', text: 'Pour un nouveau format très semblable à un autre (une autre taille de la même recette), utilisez {{Dupliquer`
- L110 : `{ label: 'Faire correspondre les colonnes.', text: 'Associez chaque colonne de votre fichier à un champ de l\'application : le nom du plat, le prix ne`

### src/components/guide/content/partie2b.js (1)
- L167 : `{ type: 'p', text: 'Dans le projet démo, les plats principaux surgelés consomment 171,67 heures (66,20 % du total), les soupes et potages 87,63 heures`

### src/components/guide/content/partie2c.js (1)
- L36 : `{ type: 'callout', kind: 'exemple', text: 'Revenus du projet démo : 45 000 $ (plats principaux surgelés), 20 000 $ (soupes et potages), 12 500 $ (sauc`

### src/components/guide/content/partie3.js (9)
- L102 : `{ label: 'Marges nettes des SKUs par canaux.', text: 'La marge nette, en % du prix de vente, de chaque produit dans chacun de ses canaux. Le bouton {{`
- L215 : `type: 'table', head: ['', 'Plats principaux', 'Sauces et acc.', 'Soupes et potages'], rows: [`
- L216 : `['Revenu total', d(A.plats.revenu), d(A.sauces.revenu), d(A.soupes.revenu)],`
- L217 : `['Coût de production', d(A.plats.cout), d(A.sauces.cout), d(A.soupes.cout)],`
- L218 : `['Bénéfice brut (marge brute)', '${d(A.plats.brut)} (${d(A.plats.margeBrute)})', '${d(A.sauces.brut)} (${d(A.sauces.margeBrute)})', '${d(A.soupes.brut`
- L219 : `['Frais fixes', d(A.plats.fraisFixes), d(A.sauces.fraisFixes), d(A.soupes.fraisFixes)],`
- L220 : `['Bénéfice net (marge nette)', '${d(A.plats.net)} (${d(A.plats.margeNette)})', '${d(A.sauces.net)} (${d(A.sauces.margeNette)})', '${d(A.soupes.net)} (`
- L221 : `['Point mort', d(A.plats.pointMort), d(A.sauces.pointMort), d(A.soupes.pointMort)],`
- L224 : `{ type: 'p', text: 'Une seule activité, les plats principaux surgelés, est rentable (marge nette de 9,99 %) et porte l\'entreprise. Les deux autres pe`

### src/components/guide/guideNumbers.js (1)
- L297 : `plats: { revenu: '61 978.20 $', cout: '36 117.48 $', brut: '25 860.72 $', margeBrute: '41.73 %', fraisFixes: '19 584.72 $', net: '6 192.47 $', margeNe`

### src/features/CostShockSimulator.jsx (2)
- L366 : `<p className="text-sm font-semibold text-gray-700 mb-1">Marge nette par portion — impact par plat</p>`
- L370 : `<th className="py-2 pr-4">Plat</th>`

### src/features/ProductInfo.jsx (6)
- L459 : `placeholder="Rechercher un plat..."`
- L559 : `{/* Nom du plat sur sa propre ligne, pleine largeur (jamais cramé par`
- L566 : `<label className="block text-xs font-medium text-gray-500 uppercase">Nom du plat</label>`
- L571 : `<button onClick={() => onDuplicateProduct(productIndex)} title="Dupliquer le plat" className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full`
- L572 : `<button onClick={() => onDeleteProduct(productIndex)} title="Supprimer le plat (tous ses formats)" className="text-gray-500 hover:text-gray-700 p-1.5 `
- L697 : `<button onClick={() => onDeleteFormat(productIndex, formatIndex)} title={isOnlyFormat ? "Supprimer le plat" : "Supprimer ce format"} className="text-r`

### src/features/RecipeCalculator.jsx (1)
- L206 : `<EmptyState message="Veuillez d'abord sélectionner ou ajouter un plat.">`

### src/features/SalesReportImportWizardModal.jsx (5)
- L324 : `ou tout fichier listant plat, quantité vendue et prix — un canal par ligne si vous en`
- L378 : `Vérifiez chaque ligne : à quel plat, quel format et quel canal de vente elle correspond.`
- L395 : `<th className="p-2 text-left">Plat</th>`
- L413 : `<option value="new">-- Créer un nouveau plat --</option>`
- L458 : `<li><strong>Ajouter</strong> {processedData.filter(item => selectedItems.has(item.id) && item.channelResolution !== 'ignore' && item.productStatus ===`

### src/features/SummaryTable.jsx (4)
- L912 : `<p className="text-sm text-gray-500 mb-4">Classe chaque plat selon sa popularité et sa rentabilité (matrice de Boston Consulting Group).</p>`
- L1614 : `<p className="text-sm text-gray-500 mb-4">Ce graphique montre les plats qui génèrent le plus de profit en dollars pour couvrir vos frais fixes.</p>`
- L1765 : `Plat {getSortIcon('displayName')}`
- L1793 : `title="Éditer le plat"`

### src/reports/exportToExcel.js (2)
- L87 : `'Plat', 'Catégorie', 'Prix Vente', 'Coût Total', 'Coût Matière (%)', 'Coût Emballage (%)',`
- L96 : `product.displayName || 'Plat Inconnu',`

### src/reports/generatePdf.js (3)
- L346 : `head: [['Plat', 'Contribution ($)']],`
- L622 : `'Statut: ${product.isIngredient ? 'Sous-recette' : reportFormat.isResaleProduct ? 'Produit de revente' : 'Plat principal'}',`
- L1059 : `head: [['Plat', 'Prix Vente ($)', 'Coût Total ($)', 'Marge Brute ($)', 'Marge Brute (% prix)', 'Marge Nette ($)', 'Marge Nette (% prix)']],`

### src/state/initialState.js (7)
- L222 : `{ id: 'act_plats', name: 'Plats principaux surgelés', indirectCostDriver: 'directCost' },`
- L244 : `{ id: 'rev_plats', label: 'Ventes — Plats principaux surgelés', repartition: 'act_plats', amounts: { act_plats: 45000 } },`
- L441 : `id: 'prod_pate', platName: 'Pâté chinois traditionnel', category: 'Plat principal', activityId: 'act_plats',`
- L494 : `id: 'prod_tao', platName: 'Poulet général Tao, riz et légumes', category: 'Plat principal', activityId: 'act_plats',`
- L523 : `id: 'prod_saumon', platName: 'Saumon teriyaki, riz et légumes', category: 'Plat principal', activityId: 'act_plats',`
- L560 : `id: 'prod_thai', platName: 'Sauté de poulet thaï, riz et légumes', category: 'Plat principal', activityId: 'act_plats',`
- L618 : `id: 'prod_chili', platName: 'Chili con carne mijoté', category: 'Plat principal', activityId: 'act_plats',`

### src/utils.js (2)
- L333 : `{ key: 'platName', label: "Nom du plat", required: true, keywords: ['nom', 'item', 'produit', 'plat', 'description'] },`
- L361 : `{ key: 'sku', label: 'Produit/SKU visé (revenu seulement)', keywords: ['produit', 'sku', 'plat', 'item'] },`

## C. « Au Menu » / « menu » (vocabulaire de restauration)

69 lignes dans 17 fichiers.

### src/components/AppDialogs.jsx (3)
- L187 : `{ selector: '#tutorial-section-info-menu', content: "Enfin, retrouvez ici tous vos produits (SKU) : sélectionnez-en un dans la liste à gauche pour aff`
- L205 : `{ selector: '#tab-summary', content: "L'onglet 'Rapport et suivi' vous donne une vue d'ensemble de la performance de votre menu, et vous permet d'en s`
- L214 : `{ selector: '#tutorial-snapshot', content: "Créez un point de référence pour sauvegarder une 'photo' de votre projet, ou gérez ceux déjà créés, depuis`

### src/components/common.jsx (2)
- L220 : `const dropdownRef = useRef(null); // Réf pour le menu déroulant lui-même`
- L294 : `setIsOpen(false); // Ferme le menu`

### src/components/guide/content/partie1.js (10)
- L322 : `{ label: 'Le point mort existe à plusieurs niveaux.', text: 'Par format de produit et par canal de vente (en unités), par activité et par canal (en do`
- L339 : `{ type: 'p', text: 'Pour résumer plusieurs produits en un seul chiffre (une marge moyenne du menu, un coût matière moyen), on calcule une **moyenne po`
- L347 : `type: 'table', head: ['Méthode', 'Marge moyenne du menu'], rows: [`
- L357 : `{ term: 'Mix des ventes', def: 'la part de chaque produit dans les ventes, en pourcentage. La somme des produits « au menu » doit être de 100 %.' },`
- L444 : `id: 'guide-concept-menu',`
- L445 : `title: '12. Quels produits mettre en avant ? L\'ingénierie de menu',`
- L447 : `{ type: 'p', text: 'Pour décider quels produits promouvoir, améliorer ou abandonner, il ne suffit pas de regarder les ventes : un produit très vendu m`
- L450 : `{ label: 'La rentabilité.', text: 'Un produit est « rentable » si sa marge brute en dollars par unité atteint au moins la marge brute moyenne du menu,`
- L458 : `{ type: 'callout', kind: 'attention', text: 'La classification est relative : un produit est « rentable » par rapport à la moyenne **de votre menu**, `
- L461 : `{ term: 'Ingénierie de menu', def: 'méthode qui classe les produits selon leur popularité et leur rentabilité.' },`

### src/components/guide/content/partie2a.js (5)
- L89 : `type: 'table', head: ['Colonne', 'À quoi elle sert'], wrapCells: true, rowIds: ['guide-param-col-format', 'guide-param-col-sku', 'guide-param-col-pds'`
- L95 : `['{{Menu}}', 'Case à cocher : ce format est-il compris dans les analyses ? Décochez-la pour un format saisonnier ou en développement : il disparaît de`
- L99 : `{ type: 'callout', kind: 'attention', text: 'Si la somme des mix des formats « au menu » n\'est pas de 100 %, un bandeau jaune vous le signale (il n\'`
- L120 : `{ label: 'Mix recalculé.', text: 'Le mix des ventes de **tous** les formats au menu est recalculé à partir des volumes par canal (cet import et les pr`
- L134 : `{ term: 'Au menu', def: 'indique si un format entre dans les analyses.' },`

### src/components/guide/content/partie2b.js (1)
- L58 : `{ type: 'p', text: 'L\'analyse porte uniquement sur les ingrédients **réellement consommés** par vos produits au menu, compte tenu des volumes vendus `

### src/components/guide/content/partie2c.js (1)
- L148 : `{ type: 'p', text: '« Général » se répartit sur le menu entier ; chaque activité seulement entre ses propres produits. Les canaux n\'ont pas de CICI :`

### src/components/guide/content/partie3.js (20)
- L39 : `'Des **formats au menu sans prix de vente** : leurs marges ne peuvent pas être calculées.',`
- L56 : `{ type: 'p', text: 'Cinq tuiles résument votre menu :' },`
- L62 : `['{{Marge Brute Moyenne Pondérée}}', 'La marge brute moyenne du menu.', d(DEMO.apercu.margeBrute)],`
- L63 : `['{{Point Mort du Menu Analysé}}', 'Le chiffre d\'affaires que le menu doit générer pour couvrir l\'ensemble des frais fixes et de la main-d\'œuvre di`
- L68 : `{ type: 'callout', kind: 'attention', text: 'Le point mort du menu est un chiffre d\'affaires (en dollars), pas un nombre d\'unités : des produits trè`
- L73 : `{ type: 'h', id: 'guide-rapport-bcg', text: 'La matrice d\'ingénierie de menu' },`
- L74 : `{ type: 'p', text: 'La matrice classe chaque produit en croisant sa popularité et sa rentabilité (voir [[guide-concept-menu|chapitre 12]]). Le sélecte`
- L87 : `{ label: 'Vaches à lait.', text: 'Le Chili est le produit le plus vendu du menu (14,9 %), mais ne rapporte que 1,82 $ par unité en moyenne. Deux levie`
- L109 : `{ term: 'Marge brute moyenne pondérée', def: 'la marge brute moyenne du menu, chaque produit pesant selon son revenu.' },`
- L175 : `'Le produit est un des plus vendus du menu : le canal où il perd le plus est aussi celui où il se vend le plus (5 665,00 $ de revenus contre 1 222,40 `
- L210 : `{ id: 'guide-seg-ligne-point-mort', term: 'Point mort', def: 'Le revenu que ce segment doit générer pour couvrir ses frais fixes (dont la main-d\'œuvr`
- L234 : `{ type: 'p', text: 'Les grandes surfaces représentent près de 60 % du chiffre d\'affaires du menu, mais perdent 2 312,94 $. La vente directe, la plus `
- L282 : `'Les indicateurs du menu : coût matière moyen pondéré (le « food cost »), coût de main-d\'œuvre moyen pondéré, marge brute moyenne pondérée et point m`
- L289 : `{ id: 'guide-sim-indicateurs', term: 'Indicateurs du menu', def: 'Le coût matière moyen pondéré (appelé « food cost » à l\'écran) et le coût de main-d`
- L290 : `{ id: 'guide-sim-impact-activite', term: 'Impact par activité de production', def: 'La marge brute et les coûts moyens de **chaque activité**, calculé`
- L295 : `{ type: 'callout', kind: 'exemple', text: 'Ajoutez un choc « Intrants — tous les ingrédients — +8 % ». Le coût matière moyen monte, la marge brute bai`
- L307 : `{ type: 'p', text: 'Le bouton {{Point de référence}}, sous les boutons d\'export, ouvre un menu à deux choix :' },`
- L347 : `['Point mort supérieur à ce que vous pouvez vendre', 'Marge unitaire trop faible ; frais fixes trop élevés', 'Rapport → Par SKU (point mort), Vue d\'e`
- L351 : `['Vache à lait (très vendu, peu rentable)', 'Prix trop bas pour son coût', 'Rapport → matrice d\'ingénierie de menu', 'Réduire le coût ; relever légèr`
- L352 : `['Poids mort (peu vendu, peu rentable)', 'Produit en fin de vie ; mauvaise place dans le menu', 'Rapport → matrice d\'ingénierie de menu', 'Le repense`

### src/components/guide/content/partie4.js (6)
- L9 : `{ term: 'Au menu', def: 'Case qui indique si un format entre dans les analyses (moyennes, point mort du menu, rapports d\'achats, classements).' },`
- L34 : `{ term: 'Ingénierie de menu (matrice BCG)', def: 'Méthode qui classe les produits en étoiles, vaches à lait, dilemmes et poids morts selon leur popula`
- L43 : `{ term: 'Mix des ventes', def: 'La part de chaque produit (ou format) dans les ventes, en pourcentage. La somme des produits au menu devrait être de 1`
- L44 : `{ term: 'Moyenne pondérée', def: 'Une moyenne où chaque élément compte selon son poids. Dans l\'application, les moyennes du menu sont pondérées par l`
- L108 : `...q('Comment traiter un produit saisonnier ou en développement ?', 'Décochez la case « Menu » de son format : il reste dans l\'application, mais sort`
- L116 : `...q('Pourquoi mon rapport d\'achats est-il vide ?', 'Il part des volumes de vente saisis par canal dans Produits et SKUs, et des recettes des formats`

### src/engine/projectChecks.js (3)
- L24 : `message: '${noPrice.length} SKU${noPrice.length > 1 ? 's' : ''} au menu sans prix de vente : leurs marges ne peuvent pas être calculées.' });`
- L32 : `? 'Le mix des ventes des SKUs au menu totalise ${totalMix.toFixed(1)} % au lieu de 100 % : les moyennes pondérées sont faussées.'`
- L33 : `: 'Le mix des ventes des SKUs au menu n\'est pas renseigné : les moyennes pondérées ne sont pas fiables.' });`

### src/features/CostShockSimulator.jsx (1)
- L343 : `<DeltaRow label="Point mort du menu ($)" current={analysisData.globalBreakEven} shocked={shockedAnalysis.globalBreakEven} unit="$" />`

### src/features/LaborDatabaseTab.jsx (1)
- L336 : `activité consomme, du total du menu. */}`

### src/features/ProductInfo.jsx (2)
- L423 : `<div id="tutorial-section-info-menu" className="p-4 bg-gray-100 rounded-lg">`
- L642 : `<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Menu</th>`

### src/features/SalesReportImportWizardModal.jsx (2)
- L461 : `<p className="border-t pt-2 mt-2">Le <strong>mix des ventes</strong> de TOUS les formats du menu sera recalculé à partir des volumes par canal déjà sa`
- L464 : `Cette action modifiera votre menu et vos canaux de vente. Êtes-vous sûr de vouloir continuer ?`

### src/features/SummaryTable.jsx (5)
- L881 : `<div className="text-sm text-gray-500 flex items-center justify-center">Point Mort du Menu Analysé <Tooltip tip="kpi.pointMort" /></div>`
- L893 : `positionné au-dessus de la Matrice d'ingénierie de menu). Données ABSENTES tant`
- L898 : `<p className="text-sm text-gray-500 mb-4">Ce graphique montre l'évolution de vos coûts moyens et de votre marge brute, d'un point de référence à l'aut`
- L911 : `<h3 className="text-xl font-bold text-gray-800 mb-2">Matrice d'ingénierie de menu</h3>`
- L1547 : `: <p className="text-center text-gray-500 py-8">Aucun SKU dans le menu pour l'instant — cochez la case « Au menu » d'un format dans Paramètres → Produ`

### src/reports/exportToExcel.js (1)
- L70 : `["Point Mort du Menu:", { t: 'n', v: Number(globalBreakEven), z: currencyFormat }],`

### src/reports/generatePdf.js (2)
- L323 : `[ 'Coût Emballage Moyen Pondéré:', '${formatPercent(weightedPackagingCost)} %', 'Point Mort du Menu:', '${formatCurrency(globalBreakEven)} $'],`
- L363 : `doc.text("Analyse Stratégique du Menu", 14, yPos);`

### src/tooltips.js (4)
- L12 : `"sim.kpiMatiere": { text: "Coût matière moyen du menu, pondéré par le revenu de chaque produit.", guide: "guide-sim-indicateurs" },`
- L13 : `"sim.kpiMo": { text: "Coût de main-d'œuvre moyen du menu, pondéré par le revenu de chaque produit.", guide: "guide-sim-indicateurs" },`
- L129 : `"kpi.margeBrute": { text: "Marge brute du menu : total des marges ÷ total des ventes, chaque produit pesant selon son revenu.", guide: "guide-kpi-marg`
- L130 : `"kpi.pointMort": { text: "Chiffre d'affaires que le menu doit générer pour couvrir ses frais fixes et sa main-d'œuvre directe, au mix actuel.", guide:`

## D. Anglicismes et abréviations (libellés visibles)

34 lignes dans 15 fichiers.

### src/components/guide/content/partie1.js (1)
- L357 : `{ term: 'Mix des ventes', def: 'la part de chaque produit dans les ventes, en pourcentage. La somme des produits « au menu » doit être de 100 %.' },`

### src/components/guide/content/partie2a.js (3)
- L94 : `['{{Mix (%)}}', 'La part de ce format dans vos ventes. Elle est **calculée automatiquement** à partir des volumes que vous saisissez par canal (c\'est`
- L120 : `{ label: 'Mix recalculé.', text: 'Le mix des ventes de **tous** les formats au menu est recalculé à partir des volumes par canal (cet import et les pr`
- L133 : `{ term: 'Mix des ventes', def: 'la part d\'un format dans vos ventes totales.' },`

### src/components/guide/content/partie4.js (2)
- L28 : `{ term: 'Food cost', def: 'Anglicisme employé à l\'écran pour le coût matière : le coût des ingrédients en pourcentage du prix de vente.' },`
- L43 : `{ term: 'Mix des ventes', def: 'La part de chaque produit (ou format) dans les ventes, en pourcentage. La somme des produits au menu devrait être de 1`

### src/features/CatalogImportWizardModal.jsx (2)
- L2 : `import { Upload, X } from 'lucide-react';`
- L395 : `<Upload className="h-5 w-5 mr-2" />`

### src/features/CostShockSimulator.jsx (6)
- L87 : `<th className="py-1.5 px-3 text-right"><span className="inline-flex items-center">Food cost<Tooltip tip="sim.colMatiere" /></span></th>`
- L88 : `<th className="py-1.5 pl-3 text-right"><span className="inline-flex items-center">Coût MO<Tooltip tip="sim.colMo" /></span></th>`
- L213 : `const typeLabel = s.type === 'labor' ? 'MO' : 'Intrants';`
- L215 : `if (s.scope === 'all') scope = s.type === 'labor' ? "toute la MO" : 'tous les ingrédients';`
- L340 : `<DeltaRow label="Food cost moyen pondéré" current={analysisData.weightedMaterialCost} shocked={shockedAnalysis.weightedMaterialCost} unit="%pt" target`
- L341 : `<DeltaRow label="Coût MO moyen pondéré" current={analysisData.weightedLaborCost} shocked={shockedAnalysis.weightedLaborCost} unit="%pt" targetPct={lab`

### src/features/IncomeStatementImportWizardModal.jsx (2)
- L2 : `import { X, Upload } from 'lucide-react';`
- L361 : `<Upload className="h-5 w-5 mr-2" />`

### src/features/IncomeStatementTab.jsx (2)
- L2 : `import { Upload, Trash2, CheckCircle2, AlertCircle, X, Plus, Lock } from 'lucide-react';`
- L657 : `<Upload className="h-5 w-5 mr-2" /> Importer l'état des résultats`

### src/features/IngredientsTab.jsx (3)
- L3 : `import { ArrowUpDown, Upload, PlusCircle, AlertCircle, Copy, Trash2 } from 'lucide-react';`
- L284 : `<Upload className="h-5 w-5 mr-2" /> Importer une liste`
- L295 : `<button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounde`

### src/features/LaborDatabaseTab.jsx (1)
- L335 : `à comparer. Seulement la part des heures de MO réellement nécessaires que CHAQUE`

### src/features/PackagingTab.jsx (3)
- L3 : `import { ArrowUpDown, Copy, PlusCircle, Trash2, Upload } from 'lucide-react';`
- L212 : `<Upload className="h-5 w-5 mr-2" /> Importer une liste`
- L223 : `<button onClick={() => setIsImportWizardOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounde`

### src/features/ProductInfo.jsx (3)
- L3 : `import { ArrowDownAZ, ArrowDownZA, ArrowLeft, AlertTriangle, Upload, Copy, Trash2, PlusCircle, Layers, ChevronDown, Star } from 'lucide-react';`
- L428 : `<Upload className="h-5 w-5 mr-2" /> Importer un rapport de ventes`
- L641 : `<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Mix (%)</th>`

### src/features/SalesReportImportWizardModal.jsx (2)
- L2 : `import { X, Upload } from 'lucide-react';`
- L340 : `<Upload className="h-5 w-5 mr-2" />`

### src/reports/exportToExcel.js (1)
- L89 : `'Marge Brute (% du prix)', 'Marge Nette ($)', 'Marge Nette (% du prix)', 'Mix Ventes'`

### src/reports/generatePdf.js (1)
- L339 : `doc.text("Classement par Contribution Totale au Profit", 14, yPos);`

### src/tooltips.js (2)
- L112 : `"sku.beneficeNet": { text: "Profit réel par unité, tous les coûts déduits (production + frais fixes).", guide: "guide-sku-ligne-benefice-net" },`
- L123 : `"seg.net": { text: "Profit réel du segment, tous les coûts déduits (production + frais fixes).", guide: "guide-seg-ligne-net", complet: true },`

## E. Champs de fichier et filtres « Aucun »

7 lignes dans 7 fichiers.

### src/App.jsx (1)
- L1266 : `<input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />`

### src/features/CatalogImportWizardModal.jsx (1)
- L385 : `type="file"`

### src/features/IncomeStatementImportWizardModal.jsx (1)
- L351 : `type="file"`

### src/features/IngredientsTab.jsx (1)
- L532 : `<option value="summary">Aucun (totaux seulement)</option>`

### src/features/PackagingTab.jsx (1)
- L475 : `<option value="summary">Aucun (totaux seulement)</option>`

### src/features/ProductInfo.jsx (1)
- L292 : `<input type="file" accept="image/*" onChange={handleLogoFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 f`

### src/features/SalesReportImportWizardModal.jsx (1)
- L330 : `type="file"`

## F. Vocabulaire restauration (restaurant, chef, cuisine…)

42 lignes dans 12 fichiers.

### src/components/AppDialogs.jsx (1)
- L195 : `{ selector: '#tutorial-section-labor-db', content: "Ici, vous pouvez définir les différents postes (Cuisinier, Commis...) et y assigner des employés a`

### src/components/guide/content/partie1.js (1)
- L68 : `['Main-d\'œuvre', 'Le temps de travail consacré à fabriquer le produit, au coût réel de l\'employeur.', 'Opérateur de ligne, cuisinier, contrôleur qua`

### src/components/guide/content/partie2a.js (2)
- L45 : `{ type: 'callout', kind: 'pourquoi', text: 'Les activités servent à deux choses. Elles permettent de **répartir vos frais fixes** (le loyer d\'un atel`
- L50 : `{ type: 'p', text: 'Un **canal de vente** est une chaîne de mise en marché (voir le [[guide-concept-canaux|chapitre 7]] de la Partie 1). Chaque carte `

### src/components/guide/content/partie2b.js (5)
- L136 : `{ type: 'p', text: 'Vous organisez votre main-d\'œuvre en **postes** (par exemple « Cuisinier de production », « Opérateur d\'emballage », « Contrôleu`
- L143 : `['{{% Temps productif attendu}}', 'La part des heures travaillées que la personne devrait consacrer à fabriquer. Un cuisinier qui passe 10 % de son te`
- L147 : `{ type: 'p', text: 'Pour chaque poste, l'application calcule un **coût moyen pondéré**, en $/h, affiché au bas de la carte. C'est le coût horaire char`
- L148 : `{ type: 'callout', kind: 'exemple', text: 'Un cuisinier du projet démo gagne ${SALAIRE.taux} $/h, avec ${Math.round(SALAIRE.charges * 100)} % de charg`
- L161 : `{ type: 'callout', kind: 'exemple', text: 'Dans le projet démo, l'équipe de production a ${d(DEMO.mo.heuresAttendues)} productives attendues, pour ${d`

### src/components/guide/content/partie2c.js (10)
- L76 : `{ type: 'p', text: 'Une charge directe est un coût qui s\'attache à la fabrication d\'un produit : matières, emballage, sous-traitance, main-d\'œuvre `
- L81 : `'Une personne qui fait les deux (par exemple cuisine et vente) se partage : la part de ses heures en production va dans l\'onglet Main-d\'œuvre, le re`
- L88 : `'Salaires de la cuisine (postes de l\'onglet Main-d\'œuvre) : charges directes, « Main-d\'œuvre directe », même si votre comptable les range sous « Sa`
- L95 : `{ type: 'p', text: 'Vos cuisiniers coûtent ${money(DOUBLE_COMPTAGE.cuisiniers, 0)} par an et sont dans l'onglet Main-d'œuvre. Vos autres frais fixes s`
- L98 : `['Correcte : cuisiniers en charges directes', money(DOUBLE_COMPTAGE.correct, 0), 'Chaque produit porte ses heures de cuisine une seule fois.'],`
- L99 : `['Erreur : cuisiniers aussi en frais fixes', money(DOUBLE_COMPTAGE.erreur, 0), 'Chaque produit porte ses heures de cuisine **deux fois** : sa marge ne`
- L104 : `{ type: 'p', text: 'Si un libellé de frais fixes ressemble à de la main-d\'œuvre de production (par exemple « Salaires cuisine »), un rappel s\'affich`
- L107 : `{ type: 'p', text: 'Une cuisine salariée coûte la même chose que vous vendiez beaucoup ou peu : c\'est un coût fixe dans la réalité. L\'application la`
- L185 : `{ type: 'callout', kind: 'attention', text: 'Relisez toujours les lignes importées d\'un PDF : la reconnaissance du texte peut se tromper de poste ou `
- L283 : `{ label: 'Temps Personnel.', text: 'La somme du temps de travail de chaque personne. Exemple : 10 minutes avec 2 cuisiniers font 20 minutes de personn`

### src/components/guide/guideNumbers.js (3)
- L195 : `const cuisiniers = 60000;`
- L199 : `const erreur = correct + cuisiniers;`
- L200 : `return { cuisiniers, loyer, gerant, correct, erreur };`

### src/features/RecipeCalculator.jsx (1)
- L1486 : `{/* Prix de vente au bas de la cascade, centré et à la taille d'une carte — celui`

### src/reports/exportToExcel.js (1)
- L63 : `["Coût M-O Cuisine:", { t: 'n', v: Number(calculatedGeneralInfo.totalKitchenLaborCost), z: currencyFormat }],`

### src/reports/generatePdf.js (1)
- L300 : `'Coût M-O Cuisine:', '${formatCurrency(calculatedGeneralInfo.totalKitchenLaborCost)} $',`

### src/state/initialState.js (15)
- L365 : `{ id: 'post_cuisinier', postName: 'Cuisinier de production', employees: [`
- L402 : `{ stepId: 's_bo_1', stepName: 'Mijotage du bouillon', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 7200 },`
- L429 : `{ stepId: 's_pu_1', stepName: 'Cuisson et pilage (lot de 20 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 40`
- L461 : `{ stepId: 's_pa_1', stepName: 'Cuisson du bœuf et assemblage (lot de 20 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, `
- L484 : `{ stepId: 's_paf_1', stepName: 'Cuisson du bœuf et assemblage (lot familial de 10 portions)', personnel: [{ postId: 'Cuisinier de production' }], star`
- L513 : `{ stepId: 's_tao_1', stepName: 'Cuisson du poulet et de la sauce (lot de 20 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime:`
- L514 : `{ stepId: 's_tao_2', stepName: 'Cuisson du riz et des légumes', personnel: [{ postId: 'Cuisinier de production' }], startTime: 670, duration: 540 },`
- L546 : `{ stepId: 's_sa_1', stepName: 'Cuisson du saumon (lot de 15 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 46`
- L547 : `{ stepId: 's_sa_2', stepName: 'Cuisson du riz et des légumes', personnel: [{ postId: 'Cuisinier de production' }], startTime: 465, duration: 465 },`
- L579 : `{ stepId: 's_th_1', stepName: 'Cuisson du poulet et des légumes (lot de 20 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: `
- L587 : `subcontracting: { enabled: true, items: [{ id: 'sub_thai_item_1', name: 'Cuisine Sous-Vide Boréal', operation: 'Cuisson sous vide du poulet et des lég`
- L637 : `{ stepId: 's_ch_1', stepName: 'Mijotage du chili (lot de 20 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 67`
- L672 : `{ stepId: 's_so_1', stepName: 'Mijotage du lot (40 L)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: 5400 },`
- L705 : `{ stepId: 's_po_1', stepName: 'Mijotage et velouté (lot de 15 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration: `
- L736 : `{ stepId: 's_ss_1', stepName: 'Mijotage de la sauce (lot de 15 portions)', personnel: [{ postId: 'Cuisinier de production' }], startTime: 0, duration:`

### src/tooltips.js (1)
- L90 : `"prod.tempsPersonnel": { text: "Somme du temps de travail de chaque personne (10 min avec 2 cuisiniers = 20 min).", guide: "guide-prod-ind-temps-perso`

### src/utils.js (1)
- L184 : `const productionWord = /(cuisin|production|atelier|usine|transformation|fabrication|boulang|patiss|preparat)/.test(t);`

## G. Formatage de nombres et dates (sites d'affichage)

245 lignes dans 20 fichiers.

### src/App.jsx (1)
(sites de formatage : comptage seulement)

### src/components/common.jsx (1)
(sites de formatage : comptage seulement)

### src/components/guide/guideFormat.js (2)
(sites de formatage : comptage seulement)

### src/engine/projectChecks.js (1)
(sites de formatage : comptage seulement)

### src/engine/salesMixFromChannels.js (1)
(sites de formatage : comptage seulement)

### src/features/CatalogImportWizardModal.jsx (1)
(sites de formatage : comptage seulement)

### src/features/CostShockSimulator.jsx (9)
(sites de formatage : comptage seulement)

### src/features/IncomeStatementTab.jsx (28)
(sites de formatage : comptage seulement)

### src/features/IngredientsTab.jsx (17)
(sites de formatage : comptage seulement)

### src/features/LaborDatabaseTab.jsx (11)
(sites de formatage : comptage seulement)

### src/features/PackagingTab.jsx (18)
(sites de formatage : comptage seulement)

### src/features/ProductInfo.jsx (1)
(sites de formatage : comptage seulement)

### src/features/RecipeCalculator.jsx (32)
(sites de formatage : comptage seulement)

### src/features/SalesReportImportWizardModal.jsx (1)
(sites de formatage : comptage seulement)

### src/features/SummaryTable.jsx (60)
(sites de formatage : comptage seulement)

### src/reports/generateGuidePdf.js (1)
(sites de formatage : comptage seulement)

### src/reports/generatePdf.js (54)
(sites de formatage : comptage seulement)

### src/state/initialState.js (1)
(sites de formatage : comptage seulement)

### src/state/projectSerialization.js (1)
(sites de formatage : comptage seulement)

### src/utils.js (4)
(sites de formatage : comptage seulement)


---

## Propositions (à valider avant 6.1)

| Sujet | Actuel | Proposé |
|---|---|---|
| « Au Menu » (case à cocher, Produits et SKUs) | « Menu » / « Au menu » | **« Actif »** (décision du 18/11) ; inactif = hors des analyses |
| « Menu » dans les moyennes et le rapport | « moyenne du menu », « Point mort du menu », « Matrice d'ingénierie de menu », « Analyse stratégique du Menu » | « de la gamme » / « Point mort de la gamme », « Matrice d'ingénierie de gamme » (ou « de portefeuille ») |
| « plat » | Plat, Nom du plat, Dupliquer le plat… | « produit » (champ interne `platName` inchangé) |
| Catégorie démo « Plat principal » | idem | « Mets préparés » / « Produit principal » (à confirmer) |
| Activité démo « Plats principaux surgelés » | idem | « Mets principaux surgelés » (impacte guide et tests) |
| « Food cost » | CostShockSimulator, PDF | « Coût matière » |
| « Coût MO », « M-O », « MO » | Simulateur, PDF, Excel | « Coût main-d'œuvre » (« Coût de main-d'œuvre ») |
| « Cuisinier / cuisine » | poste démo « Cuisinier de production », étapes « Cuisson… » | « cuisine » est un geste de fabrication : à garder dans la démo ; remplacer dans les textes généraux par « production » |
| « Mix (%) » / « Mix des ventes » | Paramètres, Excel (« Mix Ventes ») | « Répartition des ventes (%) » ou « Poids dans les ventes » |
| Champ fichier | « Choose File » natif | Bouton personnalisé « Choisir un fichier » + nom du fichier ou « Aucun fichier choisi » |
| Filtre « Aucun (totaux seulement) » | Ingrédients, Emballage | « Aucun détail (totaux seulement) » ou « Totaux seulement » |
| Marque | « Resto Calculateur » (accueil, PDF rapport, logos) ; « TransfoCalculateur » (fenêtre, guide) ; `RestoCalculateur` (package.json, fichiers logo) | **Décision requise** : proposition « TransfoCalculateur » partout (cohérent avec le dépôt GitHub et la vocation transformation) |
| Nombres | `3.75 $` (point) | `3,75 $` (virgule) partout à l'affichage ; saisie : point ou virgule acceptés (inchangé) |
| Dates | `toLocaleString('fr-CA')` et `toLocaleDateString('fr-FR')` mélangés | Un seul format : « 18 novembre 2026 » (long) ; « 2026-11-18 » pour noms de fichiers |
