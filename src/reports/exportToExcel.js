// Export du rapport Excel — extrait de App.jsx (aucune logique modifiée).
// Fonction pure "données -> classeur" : reçoit tout son contexte via l'objet `deps`. XLSX est
// fourni en global via scripts/copy-libs. Le contenu des feuilles est intentionnellement un
// export de données brutes (handoff spécialiste), volontairement distinct de l'analyse du PDF.
import { parseLocaleNumber, formatSecondsToTime, CONVERSION_FACTORS } from '../utils.js';
import { indirectCostMethodLabels, periodTranslations } from '../state/initialState.js';

export const exportToExcel = (deps) => {
    const {
        showNotification, analysisData, generalInfo, calculatedGeneralInfo,
        baseIngredients, basePackaging, laborDatabase, companyName, ingredientsList,
    } = deps;
            // window.XLSX (et non la variable bare XLSX) : même convention défensive que
            // CatalogImportWizardModal.jsx/SalesReportImportWizardModal.jsx pour cette même bibliothèque globale.
            // `typeof window` d'abord : ce module est aussi importé par les tests (environnement
            // Node, sans `window` du tout), où `window.XLSX` planterait avant même le test `typeof`.
            const XLSX = typeof window !== 'undefined' ? window.XLSX : undefined;
            if (typeof XLSX === 'undefined') {
                showNotification({ message: "La bibliothèque Excel (XLSX) n'a pas pu être chargée. L'exportation est impossible.", type: 'error' });
                return;
            }
            try {
                const {
                    productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin,
                    globalBreakEven, weightedMaterialCost, weightedPackagingCost, weightedLaborCost, contributionData,
                    menuEngineeringData, purchasingReportData, abcAnalysisData
                } = analysisData;
                const wb = XLSX.utils.book_new();
                // Noms de feuille déjà utilisés (insensible à la casse, comme Excel) — évite que
                // XLSX.utils.book_append_sheet lève une exception sur une collision après
                // troncature à 31 caractères (ex. deux formats d'un même produit dont le nom
                // désambiguïsé est identique une fois coupé), ce qui ferait échouer tout l'export.
                const usedSheetNames = new Set();
                const uniqueSheetName = (rawName) => {
                    const base = rawName.substring(0, 31).replace(/[:\\/?*[\]]/g, "") || 'Feuille';
                    let candidate = base;
                    let suffix = 2;
                    while (usedSheetNames.has(candidate.toLowerCase())) {
                        const suffixText = `_${suffix++}`;
                        candidate = base.substring(0, 31 - suffixText.length) + suffixText;
                    }
                    usedSheetNames.add(candidate.toLowerCase());
                    return candidate;
                };
                const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4B5563" } }, alignment: { horizontal: "center" } };
                const titleStyle = { font: { bold: true, sz: 16 } };
                const currencyFormat = '"$"#,##0.00';
                const percentFormat = '0.00%';

                // --- Feuille 1: Tableau de Bord ---
                let ws_dashboard_data = [
                    ["Tableau de Bord Stratégique"],
                    [],
                    ["Paramètres Généraux"],
                    // Revenus Totaux/Heures d'opération/Coût horaire op. retirés le 18/10 avec la
                    // section « Frais et revenus » de Paramètres — plus aucune donnée réelle
                    // derrière ces champs (voir Projet_Claude/03-Feuille-de-route.md). Le revenu
                    // réel figure maintenant dans l'État des résultats (section Revenus), pas ici.
                    ["Période:", `${generalInfo.period === 'custom' ? `Personnalisée (${generalInfo.startDate} au ${generalInfo.endDate})` : (periodTranslations[generalInfo.period] || 'N/A')}`],
                    ["Frais Indirects Totaux:", { t: 'n', v: Number(calculatedGeneralInfo.totalIndirects), z: currencyFormat }],
                    ["Coût M-O Cuisine:", { t: 'n', v: Number(calculatedGeneralInfo.totalKitchenLaborCost), z: currencyFormat }],
                    [],
                    ["Indicateurs Clés de Performance (KPIs) Globaux"],
                    ["Coût Matière Moyen Pondéré:", { t: 'n', v: Number(weightedMaterialCost), z: percentFormat }],
                    ["Coût Emballage Moyen Pondéré:", { t: 'n', v: Number(weightedPackagingCost), z: percentFormat }],
                    ["Coût Main-d'œuvre Moyen Pondéré:", { t: 'n', v: Number(weightedLaborCost), z: percentFormat }],
                    ["Marge Brute Moyenne Pondérée:", { t: 'n', v: Number(weightedGrossMargin), z: percentFormat }],
                    ["Point Mort du Menu:", { t: 'n', v: Number(globalBreakEven), z: currencyFormat }],
                ];
                const ws_dashboard = XLSX.utils.aoa_to_sheet(ws_dashboard_data);
                
                ws_dashboard["A1"].s = { font: { bold: true, sz: 18 } };
                ws_dashboard["A3"].s = titleStyle;
                ws_dashboard["A11"].s = titleStyle;
                
                ws_dashboard['!cols'] = [{wch: 35}, {wch: 25}];
                XLSX.utils.book_append_sheet(wb, ws_dashboard, "Tableau de Bord");
                usedSheetNames.add("Tableau de Bord".toLowerCase());

                // --- Feuille 2: Résumé ---
                // Une ligne par FORMAT (pas par produit) — voir productsWithCosts dans
                // analysisData.js (Phase 1.6) ; les coûts y sont déjà calculés pour le format
                // exact de chaque ligne, inutile de les recalculer ici.
                const summaryHeaders = [
                    'Plat', 'Catégorie', 'Prix Vente', 'Coût Total', 'Coût Matière (%)', 'Coût Emballage (%)',
                    'Coût Main-d\'oeuvre (%)', 'Coût Indirects (%)', 'Marge Brute ($)',
                    'Marge Brute (%)', 'Marge Nette ($)', 'Marge Nette (%)', 'Mix Ventes'
                ];
                const summarySheetData = [summaryHeaders.map(h => ({ v: h, s: headerStyle }))];

                productsWithCosts.forEach(product => {
                    const costs = product.costs;
                    summarySheetData.push([
                        product.displayName || `Plat Inconnu`,
                        product.category || '',
                        { t: 'n', v: Number(parseLocaleNumber(product.prixVente)), z: currencyFormat },
                        { t: 'n', v: Number(costs.totalCostPerPortion), z: currencyFormat },
                        { t: 'n', v: Number(costs.costMatierePercent), z: percentFormat },
                        { t: 'n', v: Number(costs.costPackagingPercent), z: percentFormat },
                        { t: 'n', v: Number(costs.costLaborPercent), z: percentFormat },
                        { t: 'n', v: Number(costs.costIndirectPercent), z: percentFormat },
                        { t: 'n', v: Number(costs.margeBruteDollar), z: currencyFormat },
                        { t: 'n', v: Number(costs.margeBrutePercent), z: percentFormat },
                        { t: 'n', v: Number(costs.margeNetteDollar), z: currencyFormat },
                        { t: 'n', v: Number(costs.margeNettePercent), z: percentFormat },
                        { t: 'n', v: Number(parseLocaleNumber(product.salesMix)) / 100, z: percentFormat }
                    ]);
                });

                const ws_summary = XLSX.utils.aoa_to_sheet(summarySheetData);
                ws_summary['!cols'] = [{wch: 25}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 12}];
                XLSX.utils.book_append_sheet(wb, ws_summary, "Résumé");
                usedSheetNames.add("Résumé".toLowerCase());

                // --- Feuille 3: Ingrédients ---
                const ingredientsHeaders = ['Ingrédient', 'Fournisseur', 'SKU/PLU', 'Format Achat', 'Prix Achat', 'Taux de perte (%)', 'Prix Unitaire', 'Dernière MàJ'];
                const ingredientsSheetData = [ingredientsHeaders.map(h => ({ v: h, s: headerStyle }))];
                
                baseIngredients.forEach(i => {
                    ingredientsSheetData.push([
                        i.name,
                        i.provider,
                        i.uniqueId,
                        `${parseLocaleNumber(i.purchaseFormat)} ${i.unit}`,
                        { t: 'n', v: Number(parseLocaleNumber(i.purchasePrice)), z: currencyFormat },
                        { t: 'n', v: Number(parseLocaleNumber(i.lossPercentage) || 0), z: percentFormat },
                        { t: 'n', v: Number(i.unitPrice), z: currencyFormat },
                        i.lastUpdated
                    ]);
                });

                const ws_ingredients = XLSX.utils.aoa_to_sheet(ingredientsSheetData);
                ws_ingredients['!cols'] = [{wch: 30}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}];
                XLSX.utils.book_append_sheet(wb, ws_ingredients, "Ingrédients");
                usedSheetNames.add("Ingrédients".toLowerCase());

                // --- Feuille 4: Main d'oeuvre ---
                const laborHeaders = ["Employé", "Salaire Horaire", "Charges (%)", "Vacances (%)", "Heures", "Coût Total"];
                const laborSheetData = [laborHeaders.map(h => ({v: h, s: headerStyle}))];
                
                laborDatabase.forEach(post => {
                    laborSheetData.push([
                        { v: post.postName, s: { font: { bold: true }, fill: { fgColor: { rgb: "E5E7EB" } } } }
                    ]);
                    
                    (post.employees || []).forEach(emp => {
                        const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                        laborSheetData.push([
                            emp.employeeName,
                            { t: 'n', v: Number(parseLocaleNumber(emp.hourlyRate)), z: currencyFormat },
                            { t: 'n', v: Number(parseLocaleNumber(emp.socialCharges)) / 100, z: percentFormat },
                            { t: 'n', v: Number(parseLocaleNumber(emp.vacationPercentage)) / 100, z: percentFormat },
                            Number(parseLocaleNumber(emp.workedHours)),
                            { t: 'n', v: Number(baseHourlyCost * parseLocaleNumber(emp.workedHours)), z: currencyFormat }
                        ]);
                    });
                });

                const ws_labor = XLSX.utils.aoa_to_sheet(laborSheetData);
                
                ws_labor['!merges'] = [];
                let r = 1;
                laborDatabase.forEach(post => {
                    ws_labor['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: 5 } });
                    r += (post.employees || []).length + 1;
                });

                ws_labor['!cols'] = [{wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 10}, {wch: 15}];
                XLSX.utils.book_append_sheet(wb, ws_labor, "Main d'oeuvre");
                usedSheetNames.add("Main d'oeuvre".toLowerCase());

                // --- Fiches de Coût Individuelles ---
                // Une fiche par FORMAT (pas par produit) — reprend productsWithCosts (coûts déjà
                // calculés pour le format exact de cette ligne, voir analysisData.js Phase 1.6).
                productsWithCosts.forEach(product => {
                    const costs = product.costs;
                    const reportFormat = product.format || product;
                    const productivityFactor = (calculatedGeneralInfo.kitchenProductivity > 0 && calculatedGeneralInfo.kitchenProductivity <= 100) ? calculatedGeneralInfo.kitchenProductivity / 100 : 1;

                    let sheetData = [
                        [{ v: `Fiche de coût pour: ${product.displayName}`, s: titleStyle }], [],
                        [{ v: 'Informations sur la recette', s: { font: { bold: true, sz: 12 } } }],
                        ['Nombre d\'unités produites', product.nbPortions],
                        ['Format', `${product.portionSize || 1} ${product.portionUnit || 'unité'}`],
                        [],
                        [{ v: 'Méthode des Frais Indirects', s: { font: { bold: true, sz: 12 } } }],
                    ];

                    // Méthode d'attribution de Général (globale, renommée le 21/10), commune à tous les plats.
                    const method = calculatedGeneralInfo.indirectCostMethod || 'directCost';
                    const methodLabel = indirectCostMethodLabels[method] || indirectCostMethodLabels.directCost;
                    const methodValueCell = product.indirectCosts?.portionsSold
                        ? { v: `${product.indirectCosts.portionsSold} portions` }
                        : { v: '' };

                    sheetData.push([methodLabel, methodValueCell]);
                    sheetData.push([], [{ v: 'Ingrédients', s: { font: { bold: true, sz: 12 } } }]);
                    const ingHeaders = ['Nom', 'Quantité', 'Unité', 'Coût Unitaire', 'Rendement (%)', 'Coût Total'];
                    sheetData.push(ingHeaders.map(h => ({ v: h, s: headerStyle })));
                    
                    (reportFormat.ingredients || []).forEach(i => {
                        let ingredientName = i.name;
                        let recipeUnit = i.recipeUnit;
                        let displayedUnitPrice = 0;
                        let totalCost = 0;

                        const ingredientSource = ingredientsList.find(ing => ing.id === i.id);

                        if (ingredientSource) {
                            ingredientName = ingredientSource.name;
                            recipeUnit = i.recipeUnit || ingredientSource.unit;
                            const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[ingredientSource.unit]?.factor || 1);
                            const quantityInBaseUnit = parseLocaleNumber(i.quantity) * conversionFactor;
                            const baseCost = quantityInBaseUnit * parseLocaleNumber(ingredientSource.unitPrice);
                            const yieldPercent = parseLocaleNumber(i.yieldPercentage);
                            totalCost = (yieldPercent && yieldPercent > 0) ? baseCost / (yieldPercent / 100) : baseCost;
                            displayedUnitPrice = (ingredientSource.unitPrice || 0) / (CONVERSION_FACTORS[ingredientSource.unit]?.factor || 1) * (CONVERSION_FACTORS[recipeUnit]?.factor || 1);
                        }
                        
                        sheetData.push([ 
                            ingredientName, 
                            Number(parseLocaleNumber(i.quantity)), 
                            recipeUnit, 
                            { t: 'n', v: Number(displayedUnitPrice), z: currencyFormat }, 
                            { t: 'n', v: Number(parseLocaleNumber(i.yieldPercentage)) / 100, z: percentFormat }, 
                            { t: 'n', v: Number(totalCost), z: currencyFormat } 
                        ]);
                    });
                    sheetData.push(['Total Ingrédients', '', '', '', '', { t: 'n', v: Number(costs.totalIngredientsCost), z: currencyFormat }]);

                    // Emballage (Phase 2.3) : poste SÉPARÉ du coût matière ci-dessus, jamais
                    // fusionné — voir 04-Conception-Modele.md. Vide pour un produit de revente ou
                    // un format sans emballage rattaché.
                    if ((reportFormat.packagingItems || []).length > 0) {
                        sheetData.push([], [{ v: 'Emballage', s: { font: { bold: true, sz: 12 } } }]);
                        const pkgHeaders = ['Nom', 'Quantité', 'Unité', 'Coût Unitaire', 'Coût Total'];
                        sheetData.push(pkgHeaders.map(h => ({ v: h, s: headerStyle })));

                        (reportFormat.packagingItems || []).forEach(i => {
                            const pkgSource = basePackaging.find(pkg => pkg.id === i.id);
                            let pkgName = i.name, recipeUnit = i.recipeUnit, displayedUnitPrice = 0, totalCost = 0;
                            if (pkgSource) {
                                pkgName = pkgSource.name;
                                recipeUnit = i.recipeUnit || pkgSource.unit;
                                const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[pkgSource.unit]?.factor || 1);
                                const quantityInBaseUnit = parseLocaleNumber(i.quantity) * conversionFactor;
                                const baseCost = quantityInBaseUnit * parseLocaleNumber(pkgSource.unitPrice);
                                const lossPercentage = (parseLocaleNumber(pkgSource.lossPercentage) || 0) / 100;
                                totalCost = lossPercentage > 0 && lossPercentage < 1 ? baseCost / (1 - lossPercentage) : baseCost;
                                displayedUnitPrice = (pkgSource.unitPrice || 0) / (CONVERSION_FACTORS[pkgSource.unit]?.factor || 1) * (CONVERSION_FACTORS[recipeUnit]?.factor || 1);
                            }
                            sheetData.push([
                                pkgName,
                                Number(parseLocaleNumber(i.quantity)),
                                recipeUnit,
                                { t: 'n', v: Number(displayedUnitPrice), z: currencyFormat },
                                { t: 'n', v: Number(totalCost), z: currencyFormat }
                            ]);
                        });
                        sheetData.push(['Total Emballage', '', '', '', { t: 'n', v: Number(costs.totalPackagingCost), z: currencyFormat }]);
                    }

                    sheetData.push([], [{ v: 'Processus de production', s: { font: { bold: true, sz: 12 } } }]);
                    const laborHeaders = ['Étape', 'Personnel', 'Début', 'Durée', 'Fin', 'Coût Total ($)'];
                    sheetData.push(laborHeaders.map(h => ({ v: h, s: headerStyle })));

                    (reportFormat.productionSteps || []).forEach(step => {
                        const personnelText = (step.personnel || []).map(p => p.postId).join(', ');
                        const stepCost = (step.personnel || []).reduce((total, person) => {
                            const postData = laborDatabase.find(p => p.postName === person.postId);
                            if (!postData || !postData.employees || postData.employees.length === 0) return total;

                            const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                            const totalPostCost = postData.employees.reduce((sum, emp) => {
                                const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                                return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                            }, 0);
                            const weightedAverageCost = totalHours > 0 ? totalPostCost / totalHours : 0;
                            const costPerPerson = (parseLocaleNumber(step.duration) / 3600) * weightedAverageCost / productivityFactor;
                            return total + costPerPerson;
                        }, 0);

                        sheetData.push([
                            step.stepName,
                            personnelText,
                            formatSecondsToTime(parseLocaleNumber(step.startTime)),
                            formatSecondsToTime(parseLocaleNumber(step.duration)),
                            formatSecondsToTime(parseLocaleNumber(step.startTime) + parseLocaleNumber(step.duration)),
                            { t: 'n', v: Number(stepCost), z: currencyFormat }
                        ]);
                    });
                    sheetData.push(['Total Main-d\'oeuvre', '', '', '', '', { t: 'n', v: Number(costs.totalLaborCost), z: currencyFormat }]);

                    sheetData.push([], [{ v: 'Récapitulatif par portion', s: { font: { bold: true, sz: 12 } } }]);
                    sheetData.push(['Prix de Vente', { t: 'n', v: Number(parseLocaleNumber(product.prixVente)), z: currencyFormat }]);
                    sheetData.push(['Coût Matières (base)', { t: 'n', v: Number(costs.totalBaseIngredientsCost / product.nbPortions), z: currencyFormat }]);
                    sheetData.push(['Coût des Pertes (stock)', { t: 'n', v: Number(costs.totalLossCost / product.nbPortions), z: currencyFormat }]);
                    sheetData.push(['Coût Matières Total', { t: 'n', v: Number(costs.costMatierePerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Emballage', { t: 'n', v: Number(costs.costPackagingPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Main-d\'oeuvre', { t: 'n', v: Number(costs.costLaborPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Indirect', { t: 'n', v: Number(costs.costIndirectPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût de Revient Total', { t: 'n', v: Number(costs.totalCostPerPortion), z: currencyFormat }]);
                    sheetData.push(['Coût Matière (%)', { t: 'n', v: Number(costs.costMatierePercent), z: percentFormat }]);
                    sheetData.push(['Coût Emballage (%)', { t: 'n', v: Number(costs.costPackagingPercent), z: percentFormat }]);
                    sheetData.push(['Coût Main-d\'oeuvre (%)', { t: 'n', v: Number(costs.costLaborPercent), z: percentFormat }]);
                    sheetData.push(['Coût Indirects (%)', { t: 'n', v: Number(costs.costIndirectPercent), z: percentFormat }]);
                    sheetData.push(['Marge Brute', { t: 'n', v: Number(costs.margeBruteDollar), z: currencyFormat }, { t: 'n', v: Number(costs.margeBrutePercent), z: percentFormat }]);
                    sheetData.push(['Marge Nette', { t: 'n', v: Number(costs.margeNetteDollar), z: currencyFormat }, { t: 'n', v: Number(costs.margeNettePercent), z: percentFormat }]);
                    
                    // Point mort (20/10, retour utilisateur) : repris TEL QUEL depuis
                    // `channelBreakdown` (analysisData.js → calculateCosts.js, computeChannelBreakdown),
                    // jamais recalculé ici séparément — même valeur que Production et Rapport → Par
                    // SKU, y compris le traitement de la main-d'œuvre comme un coût fixe pour la
                    // période. Canal PRINCIPAL (le premier), comme la tuile de Production.
                    const primaryChannelEntry = (product.channelBreakdown || [])[0] || null;
                    const breakEvenInfo = (primaryChannelEntry && primaryChannelEntry.breakEvenUnits != null)
                        ? { text: `Unités à vendre dans le canal "${primaryChannelEntry.channelName}" pour couvrir les frais fixes alloués (y compris la main-d'œuvre, traitée comme fixe pour la période).`, value: `${primaryChannelEntry.breakEvenUnits} unités` }
                        : { text: "Point mort indéfini (aucun canal rattaché à ce format, ou marge de contribution nulle ou négative).", value: "N/A" };
                    sheetData.push([], ["Point Mort du Produit"], [breakEvenInfo.text, breakEvenInfo.value]);

                    const ws_product = XLSX.utils.aoa_to_sheet(sheetData, { cellStyles: true });
                    ws_product['!cols'] = [{wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}];
                    const sheetName = uniqueSheetName(`Fiche - ${product.displayName || 'Sans_Nom'}`);
                    XLSX.utils.book_append_sheet(wb, ws_product, sheetName);
                });
            
                XLSX.writeFile(wb, `rapport_excel_${companyName.replace(/\s/g, '_') || 'sans_nom'}.xlsx`);
                showNotification({ message: 'Rapport Excel exporté avec succès !', type: 'success' });
            } catch(error) {
                console.error("Erreur Excel:", error);
                // Message d'erreur inclus dans la notification (pas seulement la console, pas
                // toujours accessible en production) pour que ce type de panne reste diagnosticable
                // sans avoir à reproduire l'environnement exact (ex. Electron packagé).
                showNotification({ message: `Une erreur est survenue lors de l'exportation Excel : ${error.message}`, type: 'error' });
            }
};
