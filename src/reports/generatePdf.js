// Génération du rapport PDF — extrait de App.jsx (aucune logique modifiée).
// Fonction pure "données -> document" : reçoit tout son contexte via l'objet `deps`, ne lit
// aucun état React. jsPDF/autoTable sont fournis en global (window.jspdf) via scripts/copy-libs.
import { formatCurrency, formatPercent, parseLocaleNumber, formatSecondsToTime, CONVERSION_FACTORS, MAJOR_ALLERGENS } from '../utils.js';
import { indirectCostMethodLabels, periodTranslations } from '../state/initialState.js';
    const getGlobalKpiDataForPdf = (trackingPoints) => {
        return trackingPoints.map(point => {
            const activeProducts = point.productsWithCosts.filter(p => p.onMenu);
            const totalSalesMix = activeProducts.reduce((sum, p) => sum + parseLocaleNumber(p.salesMix), 0);
            
            if (totalSalesMix === 0) {
                return { name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note, "Marge Brute Moyenne": 0, "Coût Matière Moyen": 0, "Coût M-O Moyen": 0 };
            }

            const weightedGrossMargin = activeProducts.reduce((sum, p) => sum + (p.costs.margeBrutePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedMaterialCost = activeProducts.reduce((sum, p) => sum + (p.costs.costMatierePercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);
            const weightedLaborCost = activeProducts.reduce((sum, p) => sum + (p.costs.costLaborPercent * (parseLocaleNumber(p.salesMix) / totalSalesMix)), 0);

            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Marge Brute Moyenne": weightedGrossMargin * 100,
                "Coût Matière Moyen": weightedMaterialCost * 100,
                "Coût M-O Moyen": weightedLaborCost * 100,
            };
        });
    };
    
    const getProductKpiDataForPdf = (trackingPoints, productId) => {
        if (!productId) return [];
        return trackingPoints.map(point => {
            const productData = point.productsWithCosts.find(p => String(p.id) === String(productId));
            if (!productData) {
                return { name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }), label: point.name, note: point.note, "Coût matière (%)": null, "Coût main-d'oeuvre (%)": null, "Coût frais indirects (%)": null, "Marge nette (%)": null };
            }
            return {
                name: new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'medium' }),
                label: point.name,
                note: point.note,
                "Coût matière (%)": productData.costs.costMatierePercent * 100,
                "Coût main-d'oeuvre (%)": productData.costs.costLaborPercent * 100,
                "Coût frais indirects (%)": productData.costs.costIndirectPercent * 100,
                "Marge nette (%)": productData.costs.margeNettePercent * 100,
            };
        });
    };

export const generatePdf = (options, deps) => {
    const {
        showNotification, companyName, logoUrl, analysisData, appLogoBase64,
        appLogoDimensions, calculatedGeneralInfo, trackingPoints, laborDatabase, baseIngredients,
        ingredientsList,
    } = deps;
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            showNotification({ message: "La bibliothèque PDF n'a pas pu être chargée. L'exportation est impossible.", type: 'error' });
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 0; // Nous utiliserons cette variable pour suivre la position verticale sur la page

            // Définition d'un thème de couleurs pour le rapport
            const themeColors = {
                primary: '#2563EB',   // Bleu
                secondary: '#4B5563',  // Gris foncé
                darkText: '#1F2937',   // Texte presque noir
                lightText: '#F9FAFB',  // Texte blanc cassé
                green: '#10B981',      // Vert
                yellow: '#F59E0B',     // Jaune
                purple: '#8B5CF6',    // Mauve
                gray: '#6B7280',       // Gris moyen
                red: '#EF4444',        // Rouge
            };

                // --- FONCTIONS UTILITAIRES POUR LE PDF ---

            const addPageHeader = (title) => {
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(companyName, 14, 20);

                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.gray);
                doc.text(title, 14, 28);
                
                if (logoUrl) {
                    try {
                        doc.addImage(logoUrl, 'PNG', pageWidth - 54, 15, 40, 15, undefined, 'FAST');
                    } catch(e) { console.error("Erreur d'image du logo pour le PDF:", e); }
                }
                doc.setDrawColor(themeColors.primary);
                doc.line(14, 35, pageWidth - 14, 35);
            };

            const addFooter = () => {
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    // Ne pas mettre de pied de page sur la page de garde
                    if (i === 1) continue;
                    
                    doc.setFontSize(8);
                    doc.setTextColor(themeColors.gray);
                    doc.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
                    doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, pageHeight - 7);
                }
            };

            const drawPdfLineChart = (doc, { title, data, lines, x, y, width, height }) => {
                if (!data || data.length < 2) {
                    doc.setFontSize(10);
                    doc.setTextColor(themeColors.gray);
                    doc.text("Données insuffisantes pour afficher une évolution.", x + width / 2, y + height / 2, { align: 'center' });
                    return y + height;
                }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text(title, x, y);
                y += 5;

                const padding = { top: 10, right: 10, bottom: 30, left: 20 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;
                const chartOriginX = x + padding.left;
                const chartOriginY = y + padding.top;

                const validLines = lines.filter(line => data.some(d => d[line.dataKey] !== null && d[line.dataKey] !== undefined));
                const allValues = data.flatMap(d => validLines.map(line => d[line.dataKey])).filter(v => v !== null && v !== undefined);
                const yMin = Math.min(0, ...allValues);
                const yMax = Math.max(...allValues) * 1.1 || 10;

                const xScale = (index) => chartOriginX + (index / (data.length - 1)) * chartWidth;
                const yScale = (value) => chartOriginY + chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

                // Axes and Grid
                doc.setDrawColor(themeColors.gray);
                doc.setLineWidth(0.2);
                doc.line(chartOriginX, chartOriginY, chartOriginX, chartOriginY + chartHeight);
                doc.line(chartOriginX, chartOriginY + chartHeight, chartOriginX + chartWidth, chartOriginY + chartHeight);

                doc.setFontSize(8);
                doc.setTextColor(themeColors.gray);
                for (let i = 0; i <= 5; i++) {
                    const value = yMin + (i / 5) * (yMax - yMin);
                    const yPosTick = yScale(value);
                    doc.setDrawColor(229, 231, 235); // light gray for grid
                    doc.line(chartOriginX, yPosTick, chartOriginX + chartWidth, yPosTick);
                    doc.setDrawColor(themeColors.gray);
                    doc.text(value.toFixed(0), chartOriginX - 4, yPosTick + 2, { align: 'right' });
                }

                data.forEach((d, i) => {
                    const xPos = xScale(i);
                    doc.text(d.label.substring(0,15), xPos, chartOriginY + chartHeight + 5, { align: 'center', angle: -45 });
                });

                // Lines and Dots
                validLines.forEach(line => {
                    const hexToRgb = (hex) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
                    }
                    const rgb = hexToRgb(line.color);
                    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
                    doc.setLineWidth(0.5);
                    const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d[line.dataKey]), value: d[line.dataKey] }))
                        .filter(p => p.value !== null && p.value !== undefined);
                    
                    for (let i = 0; i < points.length - 1; i++) {
                        doc.line(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
                    }
                    
                    points.forEach(p => {
                        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                        doc.circle(p.x, p.y, 1.5, 'F');
                    });
                });

                // Legend
                let legendX = x;
                let legendY = y + height + 5;
                doc.setFontSize(9);
                validLines.forEach(line => {
                    const hexToRgb = (hex) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
                    }
                    const rgb = hexToRgb(line.color);
                    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                    doc.rect(legendX, legendY - 2.5, 3, 3, 'F');
                    doc.setTextColor(themeColors.darkText);
                    const label = line.dataKey;
                    doc.text(label, legendX + 5, legendY);
                    legendX += doc.getTextWidth(label) + 15;
                    if (legendX > x + width - 30) {
                        legendX = x;
                        legendY += 6;
                    }
                });

                return legendY + 5;
            };

            const {
                productsWithCosts, activeProducts, totalSalesMix, weightedGrossMargin,
                globalBreakEven, weightedMaterialCost, weightedLaborCost, contributionData,
                menuEngineeringData, purchasingReportData, abcAnalysisData, productivityReport
            } = analysisData;

            // --- PARTIE 1 : PAGE DE GARDE ---
            
            // Cadre de la page
            doc.setDrawColor(themeColors.gray);
            doc.setLineWidth(0.5);
            doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

            // Logo de l'application au centre
            let logoY = 80;
            if (appLogoBase64 && appLogoDimensions.width > 0) {
                const maxWidth = 120;
                const maxHeight = 120;
                const logoRatio = appLogoDimensions.width / appLogoDimensions.height;
                
                let logoWidth = maxWidth;
                let logoHeight = maxWidth / logoRatio;

                if (logoHeight > maxHeight) {
                    logoHeight = maxHeight;
                    logoWidth = maxHeight * logoRatio;
                }

                const logoX = (pageWidth - logoWidth) / 2;
                doc.addImage(appLogoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
                logoY += logoHeight;
            } else {
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text('Resto Calculateur', pageWidth / 2, 115, { align: 'center' });
                logoY = 130;
            }
            
            // Titres
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.darkText);
            const titleLines = doc.splitTextToSize(options.title, pageWidth - 80); // Split title if too long
            doc.text(titleLines, pageWidth / 2, logoY + 30, { align: 'center' });
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(themeColors.secondary);
            const subtitleLines = doc.splitTextToSize(options.subtitle, pageWidth - 80);
            doc.text(subtitleLines, pageWidth / 2, 205, { align: 'center' });
            
            // Date de génération en bas de page
            doc.setFontSize(12);
            doc.setTextColor(themeColors.gray);
            doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, pageHeight - 30, { align: 'center' });

    // --- PAGE 2 : TABLEAU DE BORD STRATÉGIQUE ---
            doc.addPage();
            addPageHeader("Tableau de bord");
            yPos = 45; // Réinitialise la position Y pour la nouvelle page

            // Section 1: Paramètres Généraux
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Paramètres Généraux", 14, yPos);
            yPos += 6;


            // Corps du tableau mis à jour avec toutes les informations
            
            const paramsBody = [
                [
                    'Période:', `${periodTranslations[calculatedGeneralInfo.period] || 'N/A'} ${calculatedGeneralInfo.period === 'custom' ? `(${calculatedGeneralInfo.startDate} au ${calculatedGeneralInfo.endDate})` : ''}`,
                    'Frais Indirects:', `${formatCurrency(calculatedGeneralInfo.totalIndirects)} $`
                ],
                [ 
                    'Revenus Totaux:', `${formatCurrency(calculatedGeneralInfo.totalRevenue)} $`,
                    'Heures d\'opération:', `${calculatedGeneralInfo.operationHours} h`
                ],
                [
                    'Coût M-O Cuisine:', `${formatCurrency(calculatedGeneralInfo.totalKitchenLaborCost)} $`,
                    'Coût horaire op.:', `${formatCurrency(calculatedGeneralInfo.operationCostPerHour)} $/h`
                ]
            ];
            doc.autoTable({
                startY: yPos,
                body: paramsBody,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });

            yPos = doc.lastAutoTable.finalY + 10;

            // Section 2: Indicateurs Clés de Performance (KPIs) Globaux
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Indicateurs Clés de Performance (KPIs) Globaux", 14, yPos);
            yPos += 8;

            const kpiBody = [
                [ 'Coût Matière Moyen Pondéré:', `${formatPercent(weightedMaterialCost)} %`, 'Marge Brute Moyenne Pondérée:', `${formatPercent(weightedGrossMargin)} %`],
                [ 'Coût Main-d\'œuvre Moyen Pondéré:', `${formatPercent(weightedLaborCost)} %`, 'Point Mort du Menu:', `${formatCurrency(globalBreakEven)} $`]
            ];
            doc.autoTable({
                startY: yPos,
                body: kpiBody,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });
            yPos = doc.lastAutoTable.finalY + 10;
            
            // Section 3: Classement par Contribution Totale au Profit
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Classement par Contribution Totale au Profit", 14, yPos);
            yPos += 6;

            const topContributors = contributionData.slice(0, 5); // Limite aux 5 premiers pour le PDF
            const contributionBody = topContributors.map(item => [item.name, `${formatCurrency(item.totalContribution)} $`]);
            doc.autoTable({
                startY: yPos,
                head: [['Plat', 'Contribution ($)']],
                body: contributionBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.green, fontStyle: 'bold' },
                styles: { fontSize: 9 },
                columnStyles: { 1: { halign: 'right' } } // AJOUTEZ CETTE LIGNE
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 4: Matrice d'Analyse Stratégique (Menu Engineering)
            const startX = 14;
            const gap = 5;
            const quadrantWidth = (pageWidth - (startX * 2) - gap) / 2;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Analyse Stratégique du Menu", 14, yPos);
            yPos += 8;

            const drawQuadrant = (data) => {
                const padding = 4;
                let textY = data.y + padding;
                let contentHeight = padding * 2;
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                const titleLines = doc.splitTextToSize(data.title, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(titleLines).h;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                const descLines = doc.splitTextToSize(data.description, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(descLines).h + 2;
                
                const itemList = data.items.length > 0 ? data.items.map(item => `• ${item.platName}`).join('\n') : '• Aucun';
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const itemLines = doc.splitTextToSize(itemList, quadrantWidth - padding * 2);
                contentHeight += doc.getTextDimensions(itemLines).h + 2;

                // Si c'est un "dryRun", on retourne seulement la hauteur calculée
                if (data.dryRun) {
                    return contentHeight;
                }

                // Sinon, on dessine comme avant
                doc.setFillColor(...data.fillColor);
                doc.setDrawColor(...data.borderColor);
                doc.setLineWidth(0.3);
                doc.roundedRect(data.x, data.y, quadrantWidth, contentHeight, 3, 3, 'FD');
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(titleLines, data.x + padding, textY, { baseline: 'top' });
                textY += doc.getTextDimensions(titleLines).h + 2;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(themeColors.secondary);
                doc.text(descLines, data.x + padding, textY, { baseline: 'top' });
                textY += doc.getTextDimensions(descLines).h + 4;
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.darkText);
                doc.text(itemLines, data.x + padding, textY, { baseline: 'top' });
                
                return contentHeight;
            };
            
            const quadrants = [
                { title: 'Étoiles', items: menuEngineeringData.stars, description: 'Très populaires et très rentables. Mettez-les en avant !', fillColor: [219, 239, 255], borderColor: [147, 197, 253] },
                { title: 'Dilemmes', items: menuEngineeringData.questions, description: 'Rentables mais peu populaires. Envisagez de les promouvoir.', fillColor: [254, 243, 226], borderColor: [253, 224, 71] },
                { title: 'Vaches à Lait', items: menuEngineeringData.cows, description: 'Très populaires mais peu rentables. Optimisez leurs coûts.', fillColor: [243, 244, 246], borderColor: [209, 213, 219] },
                { title: 'Poids Morts', items: menuEngineeringData.dogs, description: 'Peu populaires et peu rentables. Pensez à les retirer.', fillColor: [254, 226, 226], borderColor: [252, 165, 165] },
            ];
            
            // Logique améliorée pour dessiner les quadrants en gérant les sauts de page
            let currentX = startX;
            let rowMaxHeight = 0;

            quadrants.forEach((quadrant, index) => {
                // Calcule la hauteur du quadrant avant de le dessiner
                const quadrantHeight = drawQuadrant({ ...quadrant, x: currentX, y: yPos, dryRun: true });

                // Vérifie s'il y a assez de place sur la page
                if (yPos + quadrantHeight > pageHeight - 20) {
                    doc.addPage();
                    addPageHeader("Tableau de bord (suite)");
                    yPos = 45; // Réinitialise yPos pour la nouvelle page
                    rowMaxHeight = 0; // Réinitialise la hauteur de la rangée
                    currentX = startX; // Revient à la première colonne
                }
                
                // Dessine réellement le quadrant
                const actualHeight = drawQuadrant({ ...quadrant, x: currentX, y: yPos });
                rowMaxHeight = Math.max(rowMaxHeight, actualHeight);
                
                // Passe à la colonne suivante ou à la ligne suivante
                if ((index + 1) % 2 === 0) { // Après chaque 2ème quadrant
                    yPos += rowMaxHeight + gap;
                    currentX = startX;
                    rowMaxHeight = 0;
                } else {
                    currentX += quadrantWidth + gap;
                }
            });

// --- PAGE 3 : TABLEAU DE BORD (SUITE) ---
            doc.addPage();
            addPageHeader("Tableau de bord (suite)");
            yPos = 45; // Réinitialise la position Y pour la nouvelle page

            // Préparation des données spécifiques à cette page

            // Section 1: Analyse ABC des Ingrédients
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Analyse ABC des Ingrédients", 14, yPos);
            yPos += 8;
            
            const categoryCItems = abcAnalysisData.C.map(i => i.name);
            let categoryCText = categoryCItems.slice(0, 8).join('\n') || 'Aucun';
            if (categoryCItems.length > 8) {
                categoryCText += `\n...et ${categoryCItems.length - 8} autre(s)`;
            }

            const abcBody = [[
                { content: 'Catégorie A (70% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#FEE2E2' } },
                { content: 'Catégorie B (20% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#FEF3C7' } },
                { content: 'Catégorie C (10% de la valeur)', styles: { fontStyle: 'bold', fillColor: '#D1FAE5' } }
            ],[
                abcAnalysisData.A.map(i => i.name).join('\n') || 'Aucun',
                abcAnalysisData.B.map(i => i.name).join('\n') || 'Aucun',
                categoryCText
            ]];
            
            doc.autoTable({
                startY: yPos,
                body: abcBody,
                theme: 'grid',
                styles: { fontSize: 8, valign: 'top' },
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 2: Synthèse du Rapport d'Achats
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Synthèse du Rapport d'Achats", 14, yPos);
            yPos += 8;
            
            doc.autoTable({
                startY: yPos,
                theme: 'plain',
                styles: { halign: 'center' },
                tableWidth: pageWidth - 28,
                body: [[
                    { content: `Coût Net Total (Production)\n${formatCurrency(purchasingReportData.totalNetCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.primary } },
                    { content: `Coût Total des Pertes\n${formatCurrency(purchasingReportData.totalLossCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.red } },
                    { content: `Coût d'Achat Total Requis\n${formatCurrency(purchasingReportData.totalPurchaseCost)} $`, styles: { fontStyle: 'bold', textColor: themeColors.darkText } }
                ]]
            });
            yPos = doc.lastAutoTable.finalY + 10;
            
            // Section 3: Rapport de Productivité
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.primary);
            doc.text("Rapport de Productivité pour la Période", 14, yPos);
            yPos += 8;
            
            const productivityBody = productivityReport.rows.map(row => [
                row.postName,
                `${row.expected.toFixed(2)} h`,
                `${row.actual.toFixed(2)} h`,
                `${row.difference.toFixed(2)} h`,
                `${row.utilization.toFixed(2)} %`
            ]);
            doc.autoTable({
                startY: yPos,
                head: [['Poste', 'Heures Attendues', 'Heures Réelles', 'Différence (h)', 'Taux d\'Utilisation (%)']],
                body: productivityBody,
                theme: 'grid',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8 },
                foot: [[
                    { content: 'Total', styles: { fontStyle: 'bold' } },
                    `${productivityReport.totals.expected.toFixed(2)} h`,
                    `${productivityReport.totals.actual.toFixed(2)} h`,
                    `${productivityReport.totals.difference.toFixed(2)} h`,
                    `${productivityReport.totals.utilization.toFixed(2)} %`
                ]],
                footStyles: { fillColor: '#A9A9A9', fontStyle: 'bold' }
            });
            yPos = doc.lastAutoTable.finalY + 10;

            // Section 4: Suivi des Performances (anciennement Page 4)
            if (trackingPoints && trackingPoints.length > 1) {
                // Vérifie s'il y a assez de place pour le graphique, sinon sauter à la page suivante
                if (yPos + 100 > pageHeight - 20) {
                    doc.addPage();
                    addPageHeader("Tableau de bord (suite)");
                    yPos = 45;
                }
                const globalKpiData = getGlobalKpiDataForPdf(trackingPoints);
                yPos = drawPdfLineChart(doc, {
                    title: "Évolution des Indicateurs Globaux",
                    data: globalKpiData,
                    lines: [
                        { dataKey: "Marge Brute Moyenne", color: "#10B981" },
                        { dataKey: "Coût Matière Moyen", color: "#F59E0B" },
                        { dataKey: "Coût M-O Moyen", color: "#EF4444" },
                    ],
                    x: 14,
                    y: yPos,
                    width: pageWidth - 28,
                    height: 85
                });
            }

    // --- PARTIE 2 : ANALYSE DÉTAILLÉE PAR PRODUIT ---
            
            // Page 5: Page de Titre pour la Section
            doc.addPage();
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(themeColors.darkText);
            doc.text("Analyse Détaillée par Produit", pageWidth / 2, pageHeight / 2, { align: 'center' });

            // Pages 6 et suivantes: Boucle sur chaque produit
            productsWithCosts.forEach((product) => {
                const costs = product.costs; // Les coûts sont déjà calculés dans productsWithCosts
                const productivityFactor = (calculatedGeneralInfo.kitchenProductivity > 0 && calculatedGeneralInfo.kitchenProductivity <= 100) ? calculatedGeneralInfo.kitchenProductivity / 100 : 1;
                
                // --- Page A : Fiche de Coût et Indicateurs Clés ---
                doc.addPage();
                addPageHeader(`Fiche de Coût - ${product.platName}`);
                yPos = 45;
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Paramètres", 14, yPos);
                yPos += 8;

                // Section 0: Paramètres du Plat
                const recipeAllergens = (() => {
                    if (product.isResaleProduct) return product.manualAllergens || [];
                    const allergens = new Set();
                    (product.ingredients || []).forEach(item => {
                        const baseIngredient = ingredientsList.find(ing => ing.id === item.id);
                        if (baseIngredient && baseIngredient.allergens) {
                            baseIngredient.allergens.forEach(allergen => allergens.add(allergen));
                        }
                    });
                    return Array.from(allergens);
                })();
                const allergenText = recipeAllergens.length > 0 ? recipeAllergens.map(key => MAJOR_ALLERGENS.find(a => a.key === key)?.name || key).join(', ') : 'Aucun';

                doc.autoTable({
                    startY: yPos,
                    theme: 'plain',
                    styles: { fontSize: 9 },
                    body: [
                        [
                            `Prix de Vente: ${formatCurrency(parseLocaleNumber(product.prixVente))} $`,
                            `Nombre de Portions: ${product.nbPortions}`,
                            `Format par Portion: ${product.portionSize || 1} ${product.portionUnit || 'unité'}`
                        ],
                        [
                            `Statut: ${product.isIngredient ? 'Sous-recette' : product.isResaleProduct ? 'Produit de revente' : 'Plat principal'}`,
                            { content: `Allergènes: ${allergenText}`, colSpan: 2 }
                        ]
                    ]
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Section 1: Détail du Coût des Matières Premières
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Détail du Coût des Matières Premières", 14, yPos);
                yPos += 8;
                
                doc.autoTable({
                    startY: yPos,
                    head: [['Ingrédient', 'Qté', 'Unité', 'Coût Base ($)', 'Coût Perte ($)', 'Rendement (%)', 'Coût Total ($)']],
                    body: (product.ingredients || []).map(i => {
                        const baseIngredient = ingredientsList.find(ing => ing.id === i.id);
                        if (!baseIngredient) return [i.name || 'N/A', '', '', '', '', '', ''];
                        const recipeUnit = i.recipeUnit || baseIngredient.unit;
                        const conversionFactor = (CONVERSION_FACTORS[recipeUnit]?.factor || 1) / (CONVERSION_FACTORS[baseIngredient.unit]?.factor || 1);
                        const quantityInBaseUnit = parseLocaleNumber(i.quantity) * conversionFactor;
                        const baseCost = quantityInBaseUnit * parseLocaleNumber(baseIngredient.unitPrice);
                        const lossPercentage = (parseLocaleNumber(baseIngredient.lossPercentage) || 0) / 100;
                        const lossCost = lossPercentage > 0 && lossPercentage < 1 ? (baseCost / (1 - lossPercentage)) - baseCost : 0;
                        const yieldPercent = parseLocaleNumber(i.yieldPercentage) || 100;
                        const finalCost = (yieldPercent > 0 ? baseCost / (yieldPercent / 100) : baseCost) + lossCost;
                        return [
                            baseIngredient.name, i.quantity, recipeUnit,
                            formatCurrency(baseCost), formatCurrency(lossCost), `${yieldPercent} %`, formatCurrency(finalCost)
                        ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: themeColors.green, fontStyle: 'bold', fontSize: 8 },
                    styles: { fontSize: 8, halign: 'right' },
                    columnStyles: { 0: { halign: 'left' }, 2: { halign: 'left' } },
                    foot: [[
                        { content: `Totaux: Base ${formatCurrency(costs.totalBaseIngredientsCost)}$ | Perte ${formatCurrency(costs.totalLossCost)}$`, colSpan: 6, styles: { halign: 'right', fontStyle: 'normal' } }, 
                        { content: `${formatCurrency(costs.totalIngredientsCost)} $`, styles: { fontStyle: 'bold' } }
                    ]],
                    footStyles: { fillColor: '#D1FAE5', textColor: themeColors.darkText }
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Section 2: Détail du Coût de Main-d'œuvre
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Détail du Coût de Main-d'œuvre", 14, yPos);
                yPos += 8;

                doc.autoTable({
                    startY: yPos,
                    head: [['Étape', 'Personnel', 'Durée', 'Coût Direct ($)', 'Coût Indirect ($)', 'Coût Total ($)']],
                    body: (product.productionSteps || []).map(step => {
                        let stepDirectCost = 0;
                        const personnelSummary = (step.personnel || []).reduce((acc, person) => {
                            const postData = laborDatabase.find(p => p.postName === person.postId);
                            if (postData && postData.employees.length > 0) {
                                const totalHours = postData.employees.reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                                const totalPostCost = postData.employees.reduce((sum, emp) => {
                                    const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                                    return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                                }, 0);
                                const weightedAverageCost = totalHours > 0 ? totalPostCost / totalHours : 0;
                                stepDirectCost += (parseLocaleNumber(step.duration) / 3600) * weightedAverageCost;
                            }
                            acc[person.postId] = (acc[person.postId] || 0) + 1;
                            return acc;
                        }, {});
                        const stepTotalCost = stepDirectCost / productivityFactor;
                        const stepIndirectCost = stepTotalCost - stepDirectCost;
                        const personnelText = Object.entries(personnelSummary).map(([post, count]) => `${count}x ${post}`).join(', ');

                        return [ step.stepName, personnelText, formatSecondsToTime(step.duration), formatCurrency(stepDirectCost), formatCurrency(stepIndirectCost), formatCurrency(stepTotalCost) ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: themeColors.yellow, textColor: themeColors.darkText, fontStyle: 'bold', fontSize: 8 },
                    styles: { fontSize: 8, halign: 'right' },
                    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
                    foot: [[
                        { content: `Totaux: Direct ${formatCurrency(costs.totalDirectLaborCost)}$ | Indirect ${formatCurrency(costs.totalLaborCost - costs.totalDirectLaborCost)}$`, colSpan: 5, styles: { halign: 'right', fontStyle: 'normal' } },
                        { content: `${formatCurrency(costs.totalLaborCost)} $`, styles: { fontStyle: 'bold' } }
                    ]],
                    footStyles: { fillColor: '#FEF3C7', textColor: themeColors.darkText }
                });
                yPos = doc.lastAutoTable.finalY + 10;
                
                // Section 3: Frais Indirects
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Frais Indirects", 14, yPos);
                yPos += 8;
                
                const indirectsBody = [[
                    `Méthode d'attribution: ${indirectCostMethodLabels[product.indirectCosts.method] || 'N/A'}`,
                    `Montant par portion: ${formatCurrency(costs.costIndirectPerPortion)} $`
                ]];
                doc.autoTable({
                    startY: yPos,
                    body: indirectsBody,
                    theme: 'plain',
                    styles: { fontSize: 9, fontStyle: 'bold' },
                    columnStyles: { 1: { halign: 'right' } }
                });
                yPos = doc.lastAutoTable.finalY + 10;

                // Sections 4 & 5 côte à côte
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Indicateurs Clés (KPIs)", 14, yPos);
                const tableStartY = yPos + 8; // Ajoute un espace après le titre
                const rightStartY = tableStartY; // Aligne la section de droite avec le début des tables
                const tableWidth = (pageWidth - 38) / 2;


                // Section 4: Synthèse des Indicateurs Clés (KPIs)
                const kpiProductBody = [
                    ['Prix de Vente', `${formatCurrency(parseLocaleNumber(product.prixVente))} $`],
                    ['Ratio Coût Matière', `${formatPercent(costs.costMatierePercent)} %`],
                    ['Ratio Coût Main-d\'œuvre', `${formatPercent(costs.costLaborPercent)} %`],
                    ['Coût de Revient par Portion', `${formatCurrency(costs.totalCostPerPortion)} $`],
                    ['Marge Brute par Portion', `${formatCurrency(costs.margeBruteDollar)} $ (${formatPercent(costs.margeBrutePercent)} %)`],
                    ['Marge Nette par Portion', `${formatCurrency(costs.margeNetteDollar)} $ (${formatPercent(costs.margeNettePercent)} %)`],
                ];

                 doc.autoTable({
                    startY: tableStartY,
                    head: [['Indicateur', 'Valeur']],
                    body: kpiProductBody,
                    theme: 'striped',
                    headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold' },
                    columnStyles: { 
                        0: { fontStyle: 'bold' },
                        1: { halign: 'right' }
                    },
                    styles: { fontSize: 9 },
                    tableWidth: tableWidth,
                    margin: { left: 14 }
                });

                // Section 5: Point Mort et Classification
                const breakEvenInfo = (() => {
                    if (costs.margeBruteDollar <= 0) return { title: "Point Mort", value: "N/A", description: "Marge brute négative." };
                    const salesMixPercent = parseLocaleNumber(product.salesMix) / 100;
                    if (['fixed', 'percentSales', 'percentDirect'].includes(product.indirectCosts.method)) return { title: "Rentabilité", value: `${formatCurrency(costs.margeNetteDollar)}`, description: `Rentable si marge nette positive.` };
                    if (salesMixPercent <= 0) return { title: "Point Mort", value: "N/A", description: "Mix des ventes nul." };
                    const allocatedIndirects = calculatedGeneralInfo.totalIndirects * salesMixPercent;
                    const breakEvenUnits = Math.ceil(allocatedIndirects / costs.margeBruteDollar);
                    return { title: "Point Mort du Produit", value: `${breakEvenUnits} unités`, description: "Unités à vendre pour couvrir la part des frais indirects allouée." };
                })();
                
                const classificationRaw = Object.keys(menuEngineeringData).find(key => menuEngineeringData[key].some(p => p.id === product.id)) || 'N/A';
                const classificationTranslations = {
                    stars: 'Étoile',
                    questions: 'Dilemme',
                    cows: 'Vache à lait',
                    dogs: 'Poids mort'
                };
                const classification = classificationTranslations[classificationRaw] || classificationRaw;
                
                let currentRightY = rightStartY;
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text(breakEvenInfo.title, pageWidth / 2 + 5, tableStartY);
                currentRightY = tableStartY + 10;
                
                doc.setFontSize(20);
                doc.text(breakEvenInfo.value, pageWidth / 2 + 5, currentRightY);
                currentRightY += 8;
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(themeColors.gray);
                const descLines = doc.splitTextToSize(breakEvenInfo.description, tableWidth);
                doc.text(descLines, pageWidth / 2 + 5, currentRightY);
                currentRightY += doc.getTextDimensions(descLines).h + 8;
                
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.darkText);
                doc.text("Classification", pageWidth / 2 + 5, currentRightY);
                currentRightY += 10;

                doc.setFontSize(20);
                doc.text(classification, pageWidth / 2 + 5, currentRightY);

                // --- Page B : Analyse Visuelle et Opérationnelle ---
                doc.addPage();
                addPageHeader(`Analyse Visuelle - ${product.platName}`);
                yPos = 45;

                // Section 1: Graphique "Secteur de secteur" (simulé)
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(themeColors.primary);
                doc.text("Répartition du Prix de Vente et du Coût de Revient", 14, yPos);
                yPos += 15;

                // --- Logique de dessin personnalisée pour plus de contrôle ---
                const drawPieSlices = (data, centerX, centerY, radius) => {
                    const totalValue = data.reduce((sum, slice) => sum + slice.value, 0);
                    if (totalValue <= 0) return;
                    let startAngleDeg = -90;
                    data.forEach(slice => {
                        if (slice.value <= 0) return;
                        const sliceAngleDeg = (slice.value / totalValue) * 360;
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.moveTo(centerX, centerY);
                        const steps = Math.max(2, Math.ceil(Math.abs(sliceAngleDeg) / 5));
                        for (let i = 0; i <= steps; i++) {
                            const angle = startAngleDeg + (i * (sliceAngleDeg / steps));
                            const angleRad = angle * Math.PI / 180;
                            doc.lineTo(centerX + radius * Math.cos(angleRad), centerY + radius * Math.sin(angleRad));
                        }
                        doc.lineTo(centerX, centerY);
                        doc.fill();
                        startAngleDeg += sliceAngleDeg;
                    });
                };
                
                // --- Graphique principal (gauche) : Prix de Vente (taille réduite) ---
                const mainChartRadius = 35;
                const mainChartX = 14 + mainChartRadius;
                const mainChartY = yPos + mainChartRadius;
                const priceData = [
                    { label: 'Coût de Revient', value: costs.totalCostPerPortion, color: [107, 114, 128] },
                    { label: 'Marge Nette', value: costs.margeNetteDollar > 0 ? costs.margeNetteDollar : 0, color: [59, 130, 246] }
                ];
                drawPieSlices(priceData, mainChartX, mainChartY, mainChartRadius);
                
                // Légende du graphique principal (positionnée en dessous)
                let legendY = mainChartY + mainChartRadius + 8;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                priceData.forEach(slice => {
                    const totalPrixVente = costs.totalCostPerPortion + priceData[1].value;
                    if (totalPrixVente > 0) {
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.rect(14, legendY - 2.5, 3, 3, 'F');
                        doc.setTextColor(themeColors.darkText);
                        const percentage = (slice.value / totalPrixVente * 100).toFixed(1);
                        doc.text(`${slice.label}: ${percentage}% (${formatCurrency(slice.value)}$)`, 19, legendY);
                        legendY += 5;
                    }
                });

                // --- Graphique secondaire (droite) : Coût de Revient (taille réduite) ---
                const subChartRadius = 28;
                const subChartX = pageWidth - 60 - subChartRadius;
                const subChartY = yPos + mainChartRadius; // Aligné verticalement
                const costData = [
                    { label: 'Matières', value: costs.costMatierePerPortion, color: [16, 185, 129] },
                    { label: 'Main-d\'œuvre', value: costs.costLaborPerPortion, color: [245, 158, 11] },
                    { label: 'Indirects', value: costs.costIndirectPerPortion, color: [139, 92, 246] },
                ];
                drawPieSlices(costData, subChartX, subChartY, subChartRadius);
                
                // Légende du graphique secondaire (positionnée à droite)
                let subLegendX = subChartX + subChartRadius + 8;
                let subLegendY = subChartY - 5;
                if (costs.totalCostPerPortion > 0) {
                    costData.forEach(slice => {
                        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                        doc.rect(subLegendX, subLegendY - 2.5, 3, 3, 'F');
                        doc.setTextColor(themeColors.darkText);
                        const percentage = (slice.value / costs.totalCostPerPortion * 100).toFixed(1);
                        doc.text(`${slice.label}: ${percentage}% (${formatCurrency(slice.value)}$)`, subLegendX + 5, subLegendY);
                        subLegendY += 5;
                    });
                }

                // --- LOGIQUE FINALE POUR LES LIGNES DE CONNEXION (Style Arc Tangent) ---
                const totalValue = priceData.reduce((sum, slice) => sum + slice.value, 0);
                if (totalValue > 0) {
                    // Calcule l'angle de la tranche "Coût de Revient"
                    const costSliceAngleDeg = (costs.totalCostPerPortion / totalValue) * 360;
                    
                    // Le point de départ est toujours le sommet du cercle (-90 degrés).
                    const startAngleDeg = -90;
                    
                    // Calcule le point d'arrivée théorique de la tranche.
                    let endAngleDeg = startAngleDeg + costSliceAngleDeg;

                    // **LOGIQUE CLÉ :** Si la tranche est plus grande que la moitié du cercle (180 degrés),
                    // on "bloque" le point de départ de la ligne du bas au point le plus bas du cercle (90 degrés).
                    if (endAngleDeg > 90) {
                        endAngleDeg = 90;
                    }
                    
                    // Convertit les angles en radians pour le calcul
                    const startAngleRad = startAngleDeg * Math.PI / 180;
                    const endAngleRad = endAngleDeg * Math.PI / 180;

                    // Calcule les coordonnées du point de départ de la ligne du haut (toujours le sommet)
                    const p1x = mainChartX + mainChartRadius * Math.cos(startAngleRad);
                    const p1y = mainChartY + mainChartRadius * Math.sin(startAngleRad);
                    
                    // Calcule les coordonnées du point de départ de la ligne du bas (qui est maintenant "bloqué" si nécessaire)
                    const p2x = mainChartX + mainChartRadius * Math.cos(endAngleRad);
                    const p2y = mainChartY + mainChartRadius * Math.sin(endAngleRad);
                    
                    // Les points d'arrivée sur le petit cercle restent les mêmes
                    const endTopX = subChartX - subChartRadius;
                    const endTopY = subChartY - subChartRadius;
                    const endBottomX = subChartX - subChartRadius;
                    const endBottomY = subChartY + subChartRadius;

                    doc.setDrawColor(themeColors.gray);
                    doc.setLineWidth(0.2);
                    
                    // Dessine les deux lignes
                    doc.line(p1x, p1y, endTopX, endTopY);
                    doc.line(p2x, p2y, endBottomX, endBottomY);
                }

                yPos = mainChartY + mainChartRadius + 20;

                // Section 2: Évolution des Performances (taille réduite)
                if (trackingPoints && trackingPoints.length > 1) {
                    const productKpiData = getProductKpiDataForPdf(trackingPoints, product.id);
                    if(productKpiData.some(d => d["Marge nette (%)"] !== null)) {
                        
                        yPos = drawPdfLineChart(doc, {
                            title: `Évolution des Indicateurs pour "${product.platName}"`,
                            data: productKpiData,
                            lines: [
                                { dataKey: "Coût matière (%)", color: "#10B981" },
                                { dataKey: "Coût main-d'oeuvre (%)", color: "#F59E0B" },
                                { dataKey: "Coût frais indirects (%)", color: "#8B5CF6" },
                                { dataKey: "Marge nette (%)", color: "#3B82F6" },
                            ],
                            x: 14,
                            y: yPos,
                            width: pageWidth - 28,
                            height: 100 // Hauteur réduite pour que tout tienne sur une page
                        });
                    }
                }
            });

            // --- ANNEXES ---

            // Annexe A: Tableau Récapitulatif
            doc.addPage();
            addPageHeader("Annexe A: Tableau Récapitulatif");
            yPos = 45;

            const summaryAnnexBody = productsWithCosts.map(p => [
                p.platName,
                `${formatCurrency(parseLocaleNumber(p.prixVente))}`,
                `${formatCurrency(p.costs.totalCostPerPortion)}`,
                `${formatCurrency(p.costs.margeBruteDollar)}`,
                `${formatPercent(p.costs.margeBrutePercent)} %`,
                `${formatCurrency(p.costs.margeNetteDollar)}`,
                `${formatPercent(p.costs.margeNettePercent)} %`
            ]);

            doc.autoTable({
                startY: yPos,
                head: [['Plat', 'Prix Vente ($)', 'Coût Total ($)', 'Marge Brute ($)', 'Marge Brute (%)', 'Marge Nette ($)', 'Marge Nette (%)']],
                body: summaryAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 },
                 columnStyles: {
                    0: { cellWidth: 40 },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                }
            });


            // Annexe B: Liste des Ingrédients
            doc.addPage();
            addPageHeader("Annexe B: Liste des Ingrédients");
            yPos = 45;

            const ingredientsAnnexBody = baseIngredients.map(ing => [
                ing.name,
                ing.provider || 'N/A',
                `${ing.purchaseFormat} ${ing.unit}`,
                `${formatCurrency(parseLocaleNumber(ing.purchasePrice))} $`,
                `${parseLocaleNumber(ing.lossPercentage) || 0} %`,
                `${formatCurrency(ing.unitPrice)} $`
            ]);
            doc.autoTable({
                startY: yPos,
                head: [['Ingrédient', 'Fournisseur', 'Format Achat', 'Prix Achat', 'Taux Perte', 'Prix Unitaire']],
                body: ingredientsAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 }
            });

            // Annexe C: Liste des Employés
            doc.addPage();
            addPageHeader("Annexe C: Liste des Employés");
            yPos = 45;

            const laborAnnexBody = [];
            laborDatabase.forEach(post => {
                // Ajoute une ligne pour le titre du poste
                laborAnnexBody.push([{ content: post.postName, colSpan: 6, styles: { fontStyle: 'bold', fillColor: '#E5E7EB' } }]);

                if (post.employees && post.employees.length > 0) {
                    post.employees.forEach(emp => {
                        const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                        const totalEmployeeCost = baseHourlyCost * parseLocaleNumber(emp.workedHours);
                        laborAnnexBody.push([
                            emp.employeeName,
                            `${formatCurrency(parseLocaleNumber(emp.hourlyRate))} $`,
                            `${parseLocaleNumber(emp.socialCharges)} %`,
                            `${parseLocaleNumber(emp.vacationPercentage)} %`,
                            `${parseLocaleNumber(emp.workedHours)} h`,
                            `${formatCurrency(totalEmployeeCost)} $`
                        ]);
                    });
                } else {
                    laborAnnexBody.push([{ content: 'Aucun employé assigné', colSpan: 6, styles: { textColor: themeColors.gray, fontStyle: 'italic', halign: 'center' } }]);
                }
            });

            doc.autoTable({
                startY: yPos,
                head: [['Employé', 'Salaire Horaire', 'Charges (%)', 'Vacances (%)', 'Heures Travaillées', 'Coût Total Employé']],
                body: laborAnnexBody,
                theme: 'striped',
                headStyles: { fillColor: themeColors.secondary, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8 }
            });
            
            // Ajoute les pieds de page à toutes les pages (sauf la première)
            addFooter();

            // --- FIN DU RAPPORT ---
            // (Les autres pages viendront s'insérer ici)


            // Sauvegarde du document
            doc.save(`rapport_couts_${companyName.replace(/\s/g, '_') || 'sans_nom'}.pdf`);
            showNotification({ message: 'Rapport PDF généré avec succès !', type: 'success' });

        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            showNotification({ message: `Une erreur est survenue lors de la génération du PDF: ${error.message}`, type: 'error' });
        } 
};
