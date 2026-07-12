import React, { useState, useRef, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { parseLocaleNumber, generateSlug, isNotEmpty, isValidNumber, isValidPercentage, APP_FIELDS, formatCurrency } from '../utils.js';
import { Tooltip } from '../components/common.jsx';

export const ImportWizardModal = ({ isOpen, onClose, baseIngredients, onUpdateIngredientsList, showNotification }) => {
    const [step, setStep] = useState(1);
    const [fileData, setFileData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const fileInputRef = useRef(null);
    const [mappings, setMappings] = useState({});
    const [processedData, setProcessedData] = useState([]);
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [workbook, setWorkbook] = useState(null);
    const [defaultProvider, setDefaultProvider] = useState('');
    const [selectedItems, setSelectedItems] = useState(new Set());

    const handleIngredientSelectUpdates = () => {
        const updates = processedData
            .filter(item => item.importStatus === 'update')
            .map(item => item.rowIndex);
        setSelectedItems(new Set(updates));
    };

    const handleIngredientSelectNew = () => {
        const newItems = processedData
            .filter(item => item.importStatus === 'new')
            .map(item => item.rowIndex);
        setSelectedItems(new Set(newItems));
    };

    const handleIngredientDeselectAll = () => {
        setSelectedItems(new Set());
    };

    // Logique de traitement et de validation des données pour l'étape 3
    useEffect(() => {
        if (step !== 3) return;

        // Trouve quelle colonne du fichier correspond à quel champ de l'app
        const reverseMappings = {};
        for (const key in mappings) {
            if (mappings[key] !== 'ignore') {
                reverseMappings[mappings[key]] = key;
            }
        }
        const dataToProcess = [];
        const seenIdentifiers = new Set(); // Pour suivre les doublons dans le fichier

        fileData.forEach((row, index) => {
            const errors = {};
            const newIngredient = {
                name: row[reverseMappings.name],
                uniqueId: row[reverseMappings.uniqueId] || '',
                provider: row[reverseMappings.provider] || defaultProvider || '',
                purchaseFormat: parseLocaleNumber(row[reverseMappings.purchaseFormat]) || 1,
                unit: row[reverseMappings.unit] || 'unité',
                purchasePrice: row[reverseMappings.purchasePrice],
                lossPercentage: parseLocaleNumber(row[reverseMappings.lossPercentage]) || 0,
            };

            const combinedQtyUnitValue = row[reverseMappings.quantityAndUnit];
            if (combinedQtyUnitValue) {
                const valueStr = String(combinedQtyUnitValue).trim();
                const match = valueStr.match(/^([\d.,]+)\s*([a-zA-ZÀ-ÿ]+.*)?$/);

                if (match) {
                    const quantityPart = match[1];
                    const unitPart = (match[2] || 'unité').trim().toLowerCase();
                    newIngredient.purchaseFormat = parseLocaleNumber(quantityPart);
                    if (['g', 'gramme', 'grammes'].includes(unitPart)) newIngredient.unit = 'g';
                    else if (['kg', 'kilo', 'kilos'].includes(unitPart)) newIngredient.unit = 'kg';
                    else if (['ml', 'millilitre', 'millilitres'].includes(unitPart)) newIngredient.unit = 'ml';
                    else if (['l', 'litre', 'litres'].includes(unitPart)) newIngredient.unit = 'L';
                    else newIngredient.unit = 'unité';
                } else {
                    errors.quantityAndUnit = `Format invalide pour '${valueStr}'.`;
                    newIngredient.purchaseFormat = 1;
                    newIngredient.unit = 'unité';
                }
            }

            if (!isNotEmpty(newIngredient.name)) errors.name = 'Le nom ne peut pas être vide.';
            if (!isValidNumber(newIngredient.purchasePrice)) errors.purchasePrice = 'Doit être un nombre positif.';
            if (!isValidNumber(newIngredient.purchaseFormat)) errors.purchaseFormat = 'Doit être un nombre positif.';
            if (!isValidPercentage(newIngredient.lossPercentage)) errors.lossPercentage = 'Doit être un pourcentage.';

            let importStatus = 'new';
            let existingId = null;

            const uniqueIdFromRow = String(newIngredient.uniqueId).trim();
            const providerFromRow = newIngredient.provider;
            const nameFromRow = newIngredient.name;

            let primaryIdentifier;
            if (uniqueIdFromRow) {
                primaryIdentifier = `${uniqueIdFromRow}::${providerFromRow}`.toLowerCase();
            } else {
                primaryIdentifier = generateSlug(nameFromRow, providerFromRow, newIngredient.purchaseFormat, newIngredient.unit);
            }

            // **LOGIQUE CORRIGÉE**: Si on a déjà vu cet identifiant dans le fichier, on ignore la ligne.
            if (seenIdentifiers.has(primaryIdentifier)) {
                return; // Passe à la ligne suivante
            }
            seenIdentifiers.add(primaryIdentifier);

            const existingIngredient = baseIngredients.find(ing => {
                const ingSku = String(ing.uniqueId || '').trim();
                const ingProvider = ing.provider || '';
                const potentialSkuIdentifier = ingSku ? `${ingSku}::${ingProvider}`.toLowerCase() : null;
                const potentialSlugIdentifier = generateSlug(ing.name, ingProvider, ing.purchaseFormat, ing.unit);
                return primaryIdentifier && (
                    (potentialSkuIdentifier && potentialSkuIdentifier === primaryIdentifier) || 
                    (potentialSlugIdentifier && potentialSlugIdentifier === primaryIdentifier)
                );
            });

            if (existingIngredient) {
                importStatus = 'update';
                existingId = existingIngredient.id;
            }

            const finalStatus = Object.keys(errors).length > 0 ? 'error' : importStatus;

            dataToProcess.push({ 
                originalData: row, 
                processed: newIngredient, 
                errors, 
                existingId: finalStatus === 'error' ? null : existingId,
                importStatus: finalStatus,
                rowIndex: index + 2
            });
        });

        setProcessedData(dataToProcess);
        setSelectedItems(new Set(dataToProcess.filter(i => i.importStatus !== 'error').map(i => i.rowIndex)));

    }, [step, fileData, mappings, baseIngredients, defaultProvider]);

    // Tente de deviner les correspondances initiales
    useEffect(() => {
        if (step === 2) {
            const initialMappings = {};
            const assignedAppFields = new Set();

            headers.forEach(header => {
                const lowerHeader = String(header).toLowerCase();
                // Trouve la meilleure correspondance basée sur les mots-clés
                const bestMatch = APP_FIELDS.find(field =>
                    !assignedAppFields.has(field.key) && // Ne l'utilise que s'il n'est pas déjà assigné
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

    const handleMappingChange = (header, appFieldKey) => {
        setMappings(prev => ({ ...prev, [header]: appFieldKey }));
    };

    const parseSheet = (wb, sheetName) => {
        const worksheet = wb.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
            showNotification({ message: "L'onglet sélectionné est vide ou ne contient pas d'en-têtes.", type: 'error' });
            resetWizard();
            return;
        }

        const detectedHeaders = jsonData[0].filter(h => h != null); // Ignore empty header cells
        const dataRows = jsonData.slice(1).map(row => {
            const rowData = {};
            detectedHeaders.forEach((header, index) => {
                rowData[header] = row[index];
            });
            return rowData;
        });

        setHeaders(detectedHeaders);
        setFileData(dataRows);
        setStep(2);
    };

    const handleFileSelect = (file) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (typeof window.XLSX === 'undefined') {
                    showNotification({ message: "La bibliothèque de lecture de fichiers n'est pas encore chargée. Veuillez réessayer dans un instant.", type: 'error' });
                    return;
                }
                const data = new Uint8Array(e.target.result);
                const wb = window.XLSX.read(data, { type: 'array' });

                const sheetNames = wb.SheetNames;
                if (sheetNames.length > 1) {
                    setSheetNames(sheetNames);
                    setWorkbook(wb);
                    setSelectedSheet(sheetNames[0]); // Pré-sélectionne le premier
                    setStep(1.5);
                } else {
                    parseSheet(wb, sheetNames[0]);
                }
            } catch (error) {
                console.error("Erreur de lecture du fichier:", error);
                showNotification({ message: "Le format du fichier est invalide.", type: 'error' });
                resetWizard();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const resetWizard = () => {
        setStep(1);
        setFileData([]);
        setHeaders([]);
        setSheetNames([]);
        setSelectedSheet('');
        setWorkbook(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSheetSelection = () => {
        if (workbook && selectedSheet) {
            parseSheet(workbook, selectedSheet);
        }
    };

    const handleClose = () => {
        resetWizard(); // Réinitialise l'état de l'assistant
        onClose(); // Appelle la fonction onClose du parent pour fermer la modale
    };

    const handleImport = () => {
        let updatedCount = 0;
        let newCount = 0;

        let ingredientsToUpdate = [...baseIngredients];

        processedData.filter(item => selectedItems.has(item.rowIndex)).forEach(item => {
            if (item.importStatus === 'error') {
                return;
            }

            const { processed } = item;
            const unitPrice = (parseLocaleNumber(processed.purchasePrice) || 0) / (processed.purchaseFormat || 1);

            if (item.importStatus === 'update') {
                updatedCount++;
                ingredientsToUpdate = ingredientsToUpdate.map(ing => {
                    if (ing.id === item.existingId) {
                        return {
                            ...ing,
                            provider: processed.provider,
                            purchaseFormat: processed.purchaseFormat,
                            unit: processed.unit,
                            purchasePrice: parseLocaleNumber(processed.purchasePrice),
                            lossPercentage: processed.lossPercentage,
                            unitPrice: unitPrice,
                            lastUpdated: new Date().toISOString().split('T')[0],
                        };
                    }
                    return ing;
                });
            } else if (item.importStatus === 'new') {
                newCount++;
                // Logique pour déterminer l'identifiant unique final
                const finalUniqueId = processed.uniqueId && String(processed.uniqueId).trim() !== ''
                    ? processed.uniqueId
                    : generateSlug(processed.name, processed.provider, processed.purchaseFormat, processed.unit);

                ingredientsToUpdate.push({
                    id: `manual_${Date.now()}_${Math.random()}`,
                    name: processed.name,
                    uniqueId: finalUniqueId, // Utilise l'identifiant du fichier ou le slug généré
                    provider: processed.provider,
                    purchaseFormat: processed.purchaseFormat,
                    unit: processed.unit,
                    purchasePrice: parseLocaleNumber(processed.purchasePrice),
                    unitPrice: unitPrice,
                    lossPercentage: processed.lossPercentage,
                    isRecipe: false,
                    lastUpdated: new Date().toISOString().split('T')[0],
                    allergens: [],
                });
            }
        });

        onUpdateIngredientsList(ingredientsToUpdate);
        // Affiche une notification de succès et ferme l'assistant
        showNotification({
            message: `Importation réussie : ${newCount} ingrédient(s) ajouté(s), ${updatedCount} mis à jour.`,
            type: 'success'
        });
        handleClose();
    };

    if (!isOpen) return null;

    const handleSelectionChange = (rowIndex) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowIndex)) {
                newSet.delete(rowIndex);
            } else {
                newSet.add(rowIndex);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allSelectableRows = processedData
                .filter(item => item.importStatus !== 'error')
                .map(item => item.rowIndex);
            setSelectedItems(new Set(allSelectableRows));
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleManualLink = (rowIndex, linkedIngredientId) => {
        setProcessedData(prevData => prevData.map(item => {
            if (item.rowIndex === rowIndex) {
                if (linkedIngredientId === 'new') {
                    return { ...item, importStatus: 'new', existingId: null };
                }
                const existingIngredient = baseIngredients.find(ing => ing.id === linkedIngredientId);
                return { ...item, importStatus: 'update', existingId: existingIngredient.id };
            }
            return item;
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Assistant d'Importation d'Ingrédients (Étape {step}/4)</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200">
                        <X className="h-6 w-6 text-gray-600" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 1 && (
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-4">Étape 1: Téléverser votre fichier</h3>
                            <p className="text-gray-600 mb-8">Sélectionnez un fichier CSV ou Excel (.csv, .xls, .xlsx) contenant votre liste d'ingrédients.</p>
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
                    {step === 1.5 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Étape 1.5: Choisir un onglet</h3>
                            <p className="text-gray-600 mb-8">Votre fichier contient plusieurs onglets. Veuillez sélectionner celui qui contient la liste d'ingrédients à importer.</p>
                            <div className="space-y-2">
                                {sheetNames.map(name => (
                                    <label key={name} className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="sheet-selection"
                                            value={name}
                                            checked={selectedSheet === name}
                                            onChange={(e) => setSelectedSheet(e.target.value)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-800">{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Étape 2: Correspondance des colonnes</h3>
                            <p className="text-gray-600 mb-6">Associez les colonnes de votre fichier aux champs de l'application. Les champs marqués d'un astérisque (*) sont obligatoires.</p>
                            <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                                <label htmlFor="defaultProvider" className="block text-sm font-medium text-gray-700 flex items-center">
                                    Fournisseur par défaut (Optionnel)
                                    <Tooltip text="Si votre fichier ne contient pas de colonne pour le fournisseur, vous pouvez en spécifier un ici. Il sera appliqué à tous les nouveaux ingrédients importés." />
                                </label>
                                <input
                                    type="text"
                                    id="defaultProvider"
                                    value={defaultProvider}
                                    onChange={(e) => setDefaultProvider(e.target.value)}
                                    placeholder="Ex: Distributeur HRI"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                />
                            </div>
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
                                            {APP_FIELDS.map(field => (
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
                    {step === 3 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Étape 3: Prévisualisation et Validation</h3>
                            <p className="text-gray-600 mb-6">Vérifiez les premières lignes de vos données. Les erreurs sont surlignées en rouge. Les ingrédients existants seront mis à jour.</p>

                            <div className="flex items-center space-x-4 mb-4 p-2 bg-gray-50 rounded-md">
                                <span className="text-sm font-medium text-gray-700">Sélections rapides:</span>
                                <button onClick={handleIngredientSelectUpdates} className="text-sm text-blue-600 hover:underline">
                                    Importer uniquement les mises à jour
                                </button>
                                <span className="text-gray-300">|</span>
                                <button onClick={handleIngredientSelectNew} className="text-sm text-green-600 hover:underline">
                                    Importer uniquement les nouveaux
                                </button>
                                <span className="text-gray-300">|</span>
                                <button onClick={handleIngredientDeselectAll} className="text-sm text-red-600 hover:underline">
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
                                                    checked={selectedItems.size > 0 && selectedItems.size === processedData.filter(item => item.importStatus !== 'error').length}
                                                    onChange={handleSelectAll}
                                                    className="h-4 w-4"
                                                />
                                            </th>
                                            <th className="p-2 text-left">Statut</th>
                                            <th className="p-2 text-left">Nom de l'ingrédient (Fichier)</th>
                                            <th className="p-2 text-left">Lier à un ingrédient existant</th>
                                            <th className="p-2 text-right">Prix d'Achat</th>
                                            <th className="p-2 text-right">Format</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {processedData.map(item => (
                                            <tr key={item.rowIndex} className={item.importStatus === 'error' ? 'bg-red-50' : ''}>
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(item.rowIndex)}
                                                        onChange={() => handleSelectionChange(item.rowIndex)}
                                                        disabled={item.importStatus === 'error'}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    {item.importStatus === 'new' && <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Nouveau</span>}
                                                    {item.importStatus === 'update' && <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-200 rounded-full">Mise à jour</span>}
                                                    {item.importStatus === 'error' && <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full" title={Object.values(item.errors).join(' ')}>Erreur</span>}
                                                </td>
                                                <td className="p-2 font-medium">{item.processed.name}</td>
                                                <td className="p-2">
                                                    {item.importStatus === 'new' && (
                                                        <select
                                                            className="w-full p-1 border rounded-md text-xs"
                                                            onChange={(e) => handleManualLink(item.rowIndex, e.target.value)}
                                                            value="new"
                                                        >
                                                            <option value="new">-- Créer un nouvel ingrédient --</option>
                                                            {baseIngredients.map(ing => (
                                                                <option key={ing.id} value={ing.id}>{ing.name} ({ing.provider})</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {item.importStatus === 'update' && (
                                                        <span className="text-xs text-gray-500 italic">
                                                            Lié à "{baseIngredients.find(ing => ing.id === item.existingId)?.name}"
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`p-2 text-right ${item.errors.purchasePrice ? 'bg-red-100' : ''}`}>
                                                    {formatCurrency(item.processed.purchasePrice)} $
                                                </td>
                                                <td className={`p-2 text-right ${item.errors.purchaseFormat || item.errors.quantityAndUnit ? 'bg-red-100' : ''}`}>
                                                    {item.processed.purchaseFormat} {item.processed.unit}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 text-right text-sm font-semibold">
                                <p>{selectedItems.size} ingrédient(s) sélectionné(s) pour l'importation.</p>
                            </div>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-4">Étape 4: Confirmation</h3>
                            <div className="p-4 bg-gray-100 rounded-lg space-y-2 text-left max-w-md mx-auto">
                                <p>Vous êtes sur le point de :</p>
                                <ul className="list-disc list-inside">
                                    <li><strong>Mettre à jour</strong> {processedData.filter(item => item.importStatus === 'update' && selectedItems.has(item.rowIndex)).length} ingrédient(s) existant(s).</li>
                                    <li><strong>Ajouter</strong> {processedData.filter(item => item.importStatus === 'new' && selectedItems.has(item.rowIndex)).length} nouveau(x) ingrédient(s).</li>
                                </ul>
                                <p className="border-t pt-2 mt-2">
                                    Les {processedData.filter(item => !selectedItems.has(item.rowIndex) && item.importStatus !== 'error').length} ingrédient(s) non sélectionné(s) et les {processedData.filter(item => item.importStatus === 'error').length} ligne(s) avec des erreurs seront ignoré(e)s.
                                </p>
                            </div>
                            <p className="text-gray-600 my-8">
                                Cette action modifiera votre base de données d'ingrédients. Êtes-vous sûr de vouloir continuer ?
                            </p>
                        </div>
                    )}
                </div>

                 <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    {step < 4 ? (
                        <button onClick={handleClose} className="px-4 py-2 border rounded-md text-sm">Annuler</button>
                    ) : (
                        <div></div> // Espace vide pour garder les boutons à droite
                    )}
                    <div className="flex space-x-2">
                        {step === 1.5 && (
                            <button onClick={handleSheetSelection} disabled={!selectedSheet} className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                                Suivant
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={() => setStep(3)}
                                disabled={!mappings[Object.keys(mappings).find(h => mappings[h] === 'name')] || !mappings[Object.keys(mappings).find(h => mappings[h] === 'purchasePrice')]}
                                className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                title={(!mappings[Object.keys(mappings).find(h => mappings[h] === 'name')] || !mappings[Object.keys(mappings).find(h => mappings[h] === 'purchasePrice')]) ? "Veuillez mapper les champs 'Nom' et 'Prix' pour continuer." : ""}
                            >
                                Suivant
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                onClick={() => setStep(4)}
                                disabled={selectedItems.size === 0}
                                className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                title={selectedItems.size === 0 ? "Veuillez sélectionner au moins un ingrédient." : ""}
                            >
                                Suivant
                            </button>
                        )}
                        {step === 4 && (
                            <button 
                                onClick={handleImport}
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