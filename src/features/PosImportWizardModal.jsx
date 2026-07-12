import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { parseLocaleNumber, excelSerialDateToJSDate, POS_APP_FIELDS, formatCurrency } from '../utils.js';

export const PosImportWizardModal = ({ isOpen, onClose, onImportComplete, products: existingProducts }) => {
    const [step, setStep] = useState(1);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    // Données du fichier
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState([]);
    const [fileData, setFileData] = useState([]);

    // Correspondances
    const [mappings, setMappings] = useState({});

    // Étape 3: Données traitées et sélection
    const [processedData, setProcessedData] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());

        // Tente de deviner les correspondances initiales
    useEffect(() => {
        if (step === 2) {
            const initialMappings = {};
            const assignedAppFields = new Set();

            headers.forEach(header => {
                const lowerHeader = String(header).toLowerCase();
                const bestMatch = POS_APP_FIELDS.find(field =>
                    !assignedAppFields.has(field.key) &&
                    field.keywords.some(keyword => lowerHeader.includes(keyword))
                );

                if (bestMatch) {
                    initialMappings[header] = bestMatch.key;
                    assignedAppFields.add(bestMatch.key);
                } else {
                    initialMappings[header] = 'ignore';
                }
            });
            setMappings(initialMappings);
        }
    }, [step, headers]);

    // Traite les données pour l'étape 3
    useEffect(() => {
        if (step !== 3) return;

        // 1. Inverser les correspondances pour un accès facile
        const reverseMappings = {};
        for (const header in mappings) {
            if (mappings[header] !== 'ignore') {
                reverseMappings[mappings[header]] = header;
            }
        }

        // 2. NOUVEAU: Agréger les données du fichier (logique finale avec priorité au total net)
        const aggregatedData = {};
        fileData.forEach(row => {
            const platName = String(row[reverseMappings.platName] || '').trim();
            if (!platName) return;

            const key = platName.toLowerCase();
            const quantitySold = parseLocaleNumber(row[reverseMappings.quantitySold]);
            const prixVente = parseLocaleNumber(row[reverseMappings.prixVente]);

            // **LA CORRECTION CLÉ**
            // On vérifie si une colonne "Total Net Ligne" a été mappée.
            const totalNetPriceHeader = reverseMappings.totalNetPrice;
            let lineRevenue;

            if (totalNetPriceHeader && row[totalNetPriceHeader] != null) {
                // Si oui, on utilise sa valeur, car elle est la plus précise (inclut les rabais).
                lineRevenue = parseLocaleNumber(row[totalNetPriceHeader]);
            } else {
                // Sinon, on calcule le revenu en se basant sur le prix unitaire (moins précis).
                lineRevenue = prixVente * quantitySold;
            }

            console.log(`Produit: ${platName} | Utilise Total Net: ${!!(totalNetPriceHeader && row[totalNetPriceHeader] != null)} | Revenu Ligne: ${lineRevenue}`);

            if (!aggregatedData[key]) {
                // Quand on voit l'item pour la première fois, on stocke son prix pour l'affichage
                aggregatedData[key] = {
                    platName: platName,
                    category: String(row[reverseMappings.category] || '').trim(),
                    prixVente: prixVente, // Prix pour affichage
                    quantitySold: quantitySold, // Quantité totale
                    totalRevenue: lineRevenue,  // Revenu total pour calcul
                };
            } else {
                // Pour les lignes suivantes, on met à jour les totaux sans toucher au prix affiché
                aggregatedData[key].quantitySold += quantitySold;
                aggregatedData[key].totalRevenue += lineRevenue;
            }
        });

        // 3. Traiter les données agrégées
        const dataToProcess = Object.values(aggregatedData).map((item, index) => {
            const newItem = {
                id: `import_${Date.now()}_${index}`,
                ...item
            };

            const existingProduct = existingProducts.find(
                p => p.platName.toLowerCase() === newItem.platName.toLowerCase()
            );

            const status = existingProduct ? 'update' : 'new';
            return { ...newItem, status, existingId: existingProduct?.id };
        });

        setProcessedData(dataToProcess);
        setSelectedItems(new Set(dataToProcess.map(item => item.id)));

    }, [step, fileData, mappings, existingProducts]);

    const resetWizard = () => {
        setStep(1);
        setFileName('');
        setHeaders([]);
        setFileData([]);
        setMappings({});
        setProcessedData([]);
        setSelectedItems(new Set());
        setIsLoading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        resetWizard();
        onClose();
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        setIsLoading(true);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (typeof window.XLSX === 'undefined') {
                    alert("La bibliothèque de lecture de fichiers n'est pas chargée. Veuillez réessayer.");
                    setIsLoading(false);
                    return;
                }
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { cellDates: true });

                if (jsonData.length === 0) {
                    alert("Le fichier semble vide.");
                    setIsLoading(false);
                    return;
                }

                setHeaders(Object.keys(jsonData[0]));
                setFileData(jsonData);
                setStep(2);

            } catch (error) {
                console.error("Erreur de lecture du fichier:", error);
                alert("Le format du fichier est invalide ou corrompu.");
                resetWizard();
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMappingChange = (header, appFieldKey) => {
        setMappings(prev => ({ ...prev, [header]: appFieldKey }));
    };

    const handleSelectionChange = (itemId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedItems(new Set(processedData.map(item => item.id)));
        } else {
            setSelectedItems(new Set());
        }
    };
    
    const handleSelectUpdates = () => {
        const updates = processedData
            .filter(item => item.status === 'update')
            .map(item => item.id);
        setSelectedItems(new Set(updates));
    };

    const handleSelectNew = () => {
        const newItems = processedData
            .filter(item => item.status === 'new')
            .map(item => item.id);
        setSelectedItems(new Set(newItems));
    };

    const handleDeselectAll = () => {
        setSelectedItems(new Set());
    };

    const handleManualLink = (itemId, linkedProductId) => {
        setProcessedData(prevData => prevData.map(item => {
            if (item.id === itemId) {
                if (linkedProductId === 'new') {
                    return { ...item, status: 'new', existingId: null };
                }
                const existingProduct = existingProducts.find(p => p.id === linkedProductId);
                return { ...item, status: 'update', existingId: existingProduct.id };
            }
            return item;
        }));
    };

    const handleConfirmImport = () => {
        // 1. Calculer les revenus totaux du rapport POS complet à partir des données agrégées et fiables
        const totalRevenueFromReport = processedData.reduce((sum, item) => sum + item.totalRevenue, 0);

        // NOUVEAU (LOGIQUE AMÉLIORÉE): Trouver la plage de dates
        let minDate = null;
        let maxDate = null;
        const dateHeader = Object.keys(mappings).find(h => mappings[h] === 'transactionDate');

        if (dateHeader) {
            fileData.forEach(row => {
                const dateValue = row[dateHeader];
                let currentDate = null;

                if (dateValue) {
                    // Priorité 1: Si c'est un nombre, on suppose que c'est une date série Excel
                    if (typeof dateValue === 'number') {
                        currentDate = excelSerialDateToJSDate(dateValue);
                    }
                    // Priorité 2: Si c'est déjà un objet Date, on l'utilise
                    else if (dateValue instanceof Date && !isNaN(dateValue)) {
                        currentDate = dateValue;
                    } 
                    // Priorité 3 (Fallback): Si c'est du texte, on essaie de le convertir
                    else if (typeof dateValue === 'string') {
                        const parsedDate = new Date(dateValue);
                        if (!isNaN(parsedDate)) {
                            currentDate = parsedDate;
                        }
                    }
                }

                // Si une date valide a été trouvée, on la compare
                if (currentDate && !isNaN(currentDate.getTime())) {
                    if (!minDate || currentDate < minDate) {
                        minDate = currentDate;
                    }
                    if (!maxDate || currentDate > maxDate) {
                        maxDate = currentDate;
                    }
                }
            });
        }

        // Formate les dates pour l'état global au format YYYY-MM-DD
        const formatDate = (date) => {
            if (!date || !(date instanceof Date)) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const newStartDate = formatDate(minDate);
        const newEndDate = formatDate(maxDate);

        // 2. Filtrer pour ne garder que les items sélectionnés pour l'importation
        const finalData = processedData.filter(item => selectedItems.has(item.id));

        // 3. Calculer le total des unités vendues (pour le mix des ventes)
        const totalQuantitySold = finalData.reduce((sum, item) => sum + item.quantitySold, 0);

        // 4. Calculer les revenus des items sélectionnés seulement
        const selectedItemsRevenue = finalData.reduce((sum, item) => {
            return sum + item.totalRevenue;
        }, 0);

        // 5. Calculer le total des unités vendues (pour le mix des ventes)
        //const totalQuantitySold = finalData.reduce((sum, item) => sum + item.quantitySold, 0);

        // 6. NOUVEAU: Calculer et ajuster le mix des ventes pour atteindre 100%
        let itemsWithSalesMix = [];
        if (totalQuantitySold > 0) {
            // Étape A: Calculer les pourcentages avec une haute précision
            const itemsWithPreciseMix = finalData.map(item => {
                const preciseMix = (item.quantitySold / totalQuantitySold) * 100;
                return { ...item, preciseMix };
            });

            // Étape B: Arrondir les pourcentages et calculer la différence
            let roundedMixes = itemsWithPreciseMix.map(item => {
                const floorMix = Math.floor(item.preciseMix * 100) / 100;
                const remainder = item.preciseMix - floorMix;
                return { ...item, salesMix: floorMix, remainder };
            });

            const sumOfRounded = roundedMixes.reduce((sum, item) => sum + item.salesMix, 0);
            let difference = Math.round((100 - sumOfRounded) * 100); // Différence en centièmes (ex: 2 pour 0.02%)

            // Étape C: Distribuer la différence aux plus grands restes
            roundedMixes.sort((a, b) => b.remainder - a.remainder);

            for (let i = 0; i < difference; i++) {
                roundedMixes[i].salesMix += 0.01;
            }

            itemsWithSalesMix = roundedMixes.map(item => ({
                ...item,
                salesMix: item.salesMix.toFixed(2) // Assure le format final
            }));

        } else {
            itemsWithSalesMix = finalData.map(item => ({ ...item, salesMix: "0.00" }));
        }

        const newMenuRevenuePercentage = totalRevenueFromReport > 0 ? (selectedItemsRevenue / totalRevenueFromReport) * 100 : 100;

        // 7. Préparer les données finales à envoyer
        const importPayload = {
            itemsToImport: itemsWithSalesMix,
            newTotalRevenue: totalRevenueFromReport,
            newMenuRevenuePercentage: newMenuRevenuePercentage,
            newStartDate: newStartDate,
            newEndDate: newEndDate,
            importedProductIds: new Set(finalData.map(item => item.existingId).filter(Boolean))
        };

        onImportComplete(importPayload);
        handleClose();
    };

    const isNextStepDisabled = useMemo(() => {
        if (step === 2) {
            const requiredFields = POS_APP_FIELDS.filter(f => f.required).map(f => f.key);
            const mappedFields = Object.values(mappings);
            return !requiredFields.every(rf => mappedFields.includes(rf));
        }
        if (step === 3) {
            return selectedItems.size === 0;
        }
        return false;
    }, [step, mappings, selectedItems]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Assistant d'Importation depuis POS (Étape {step}/4)</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200">
                        <X className="h-6 w-6 text-gray-600" />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {isLoading && <div className="text-center"><p>Lecture du fichier en cours...</p></div>}

                    {!isLoading && step === 1 && (
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-4">Étape 1: Téléverser votre rapport de ventes</h3>
                            <p className="text-gray-600 mb-8">
                                Sélectionnez un rapport de ventes exporté depuis votre système POS (Point of Sale).
                                <br />
                                Les formats supportés sont CSV et Excel (.csv, .xls, .xlsx).
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                onChange={(e) => handleFileSelect(e.target.files[0])}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <Upload className="h-5 w-5 mr-2" />
                                Choisir un fichier
                            </button>
                        </div>
                    )}

                    {!isLoading && step === 2 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Étape 2: Correspondance des colonnes</h3>
                            <p className="text-gray-600 mb-6">Associez les colonnes de votre fichier <span className="font-semibold text-gray-800">{fileName}</span> aux champs de l'application. Les champs marqués d'un astérisque (*) sont obligatoires.</p>
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                {headers.map(header => (
                                    <div key={header} className="grid grid-cols-2 gap-4 items-center p-2 rounded-md hover:bg-gray-50">
                                        <div className="bg-gray-100 p-2 rounded-md text-gray-800 font-medium truncate" title={header}>
                                            {header}
                                        </div>
                                        <select
                                            value={mappings[header] || 'ignore'}
                                            onChange={(e) => handleMappingChange(header, e.target.value)}
                                            className="p-2 border rounded-md"
                                        >
                                            <option value="ignore">-- Ignorer cette colonne --</option>
                                            {POS_APP_FIELDS.map(field => (
                                                <option key={field.key} value={field.key}>
                                                    {field.label}{field.required ? ' *' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoading && step === 3 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Étape 3: Prévisualisation et Sélection</h3>
                            <p className="text-gray-600 mb-6">Vérifiez les données importées et sélectionnez les items à ajouter ou à mettre à jour. Vous pouvez lier manuellement un "Nouveau" plat à un plat existant si le nom diffère.</p>
                            <div className="flex items-center space-x-4 mb-4 p-2 bg-gray-50 rounded-md">
                                <span className="text-sm font-medium text-gray-700">Sélections rapides:</span>
                                <button onClick={handleSelectUpdates} className="text-sm text-blue-600 hover:underline">
                                    Importer uniquement les mises à jour
                                </button>
                                <span className="text-gray-300">|</span>
                                <button onClick={handleSelectNew} className="text-sm text-green-600 hover:underline">
                                    Importer uniquement les nouveaux
                                </button>
                                <span className="text-gray-300">|</span>
                                <button onClick={handleDeselectAll} className="text-sm text-red-600 hover:underline">
                                    Tout désélectionner
                                </button>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto pr-2 border rounded-lg">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2 w-12 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === processedData.length && processedData.length > 0}
                                                    onChange={handleSelectAll}
                                                    className="h-4 w-4"
                                                />
                                            </th>
                                            <th className="p-2 text-left">Statut</th>
                                            <th className="p-2 text-left">Nom du plat (Fichier)</th>
                                            <th className="p-2 text-left">Lier à un plat existant</th>
                                            <th className="p-2 text-right">Prix</th>
                                            <th className="p-2 text-right">Qté vendue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {processedData.map(item => (
                                            <tr key={item.id}>
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(item.id)}
                                                        onChange={() => handleSelectionChange(item.id)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    {item.status === 'new' && <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Nouveau</span>}
                                                    {item.status === 'update' && <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-200 rounded-full">Mise à jour</span>}
                                                </td>
                                                <td className="p-2 font-medium">{item.platName}</td>
                                                <td className="p-2">
                                                    {item.status === 'new' && (
                                                        <select
                                                            className="w-full p-1 border rounded-md text-xs"
                                                            onChange={(e) => handleManualLink(item.id, e.target.value)}
                                                            value="new"
                                                        >
                                                            <option value="new">-- Créer un nouveau plat --</option>
                                                            {existingProducts.map(p => (
                                                                <option key={p.id} value={p.id}>{p.platName}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {item.status === 'update' && (
                                                        <span className="text-xs text-gray-500 italic">Lié à "{existingProducts.find(p => p.id === item.existingId)?.platName}"</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right">{formatCurrency(item.prixVente)} $</td>
                                                <td className="p-2 text-right">{item.quantitySold}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 text-right text-sm font-semibold">
                                <p>{selectedItems.size} item(s) sélectionné(s) pour l'importation.</p>
                            </div>
                        </div>
                    )}
                    {!isLoading && step === 4 && (
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-4">Étape 4: Confirmation</h3>
                            <div className="p-4 bg-gray-100 rounded-lg space-y-2 text-left max-w-md mx-auto">
                                <p>Vous êtes sur le point de :</p>
                                <ul className="list-disc list-inside">
                                    <li><strong>Mettre à jour</strong> {processedData.filter(item => selectedItems.has(item.id) && item.status === 'update').length} plat(s) existant(s).</li>
                                    <li><strong>Ajouter</strong> {processedData.filter(item => selectedItems.has(item.id) && item.status === 'new').length} nouveau(x) plat(s).</li>
                                </ul>
                                <p className="border-t pt-2 mt-2">Le <strong>mix des ventes</strong> de tous les plats (existants et nouveaux) sera recalculé et les <strong>revenus totaux</strong> seront ajustés.</p>
                            </div>
                            <p className="text-gray-600 my-8">
                                Cette action modifiera votre menu. Êtes-vous sûr de vouloir continuer ?
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <button onClick={handleClose} className="px-4 py-2 border rounded-md text-sm">Annuler</button>
                    <div className="flex space-x-2">
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)} className="px-4 py-2 border rounded-md text-sm">Précédent</button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={() => setStep(3)}
                                disabled={isNextStepDisabled}
                                className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                title={isNextStepDisabled ? "Veuillez associer tous les champs obligatoires (*)." : ""}
                            >
                                Suivant
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                onClick={() => setStep(4)}
                                disabled={isNextStepDisabled}
                                className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                title={isNextStepDisabled ? "Veuillez sélectionner au moins un item." : ""}
                            >
                                Suivant
                            </button>
                        )}
                        {step === 4 && (
                            <button
                                onClick={handleConfirmImport}
                                className="px-4 py-2 border rounded-md text-sm text-white bg-green-600 hover:bg-green-700"
                            >
                                Confirmer et Importer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};