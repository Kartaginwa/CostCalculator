import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { parseLocaleNumber, excelSerialDateToJSDate, SALES_REPORT_APP_FIELDS, formatCurrency, formatQuantityLabel } from '../utils.js';

// Phase 3.4 : remplace PosImportWizardModal.jsx — vise des rapports de vente PAR CANAL (ex. un
// export par distributeur/circuit depuis QuickBooks, Odoo, ou un rapport de vente générique),
// plutôt qu'un export de caisse à un seul point de vente. Chaque ligne agrégée du fichier se
// résout vers un FORMAT (quel SKU) × un CANAL (quel circuit de vente) avant d'être appliquée —
// voir Projet_Claude/05-Imports-Integrations.md. Décisions utilisateur du 06/10 :
// - canal non reconnu -> par défaut on en CRÉE un nouveau (l'utilisateur peut plutôt lier à un
//   canal existant, ou ignorer la ligne) ;
// - format non reconnu -> on n'en crée JAMAIS un nouveau (ça touche la recette, pas la vente) —
//   seulement lier à un format existant du produit, ou ignorer la ligne.
export const SalesReportImportWizardModal = ({ isOpen, onClose, onImportComplete, products: existingProducts, salesChannels }) => {
    const [step, setStep] = useState(1);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState([]);
    const [fileData, setFileData] = useState([]);

    const [mappings, setMappings] = useState({});

    const [processedData, setProcessedData] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());

    useEffect(() => {
        if (step === 2) {
            const initialMappings = {};
            const assignedAppFields = new Set();

            headers.forEach(header => {
                const lowerHeader = String(header).toLowerCase();
                const bestMatch = SALES_REPORT_APP_FIELDS.find(field =>
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

    // Traite les données pour l'étape 3 : agrège par (plat, format, canal) — pas seulement par
    // plat comme l'ancien import, qui ne connaissait qu'un seul canal implicite — puis résout
    // chaque groupe vers un produit/format/canal réels de l'application.
    useEffect(() => {
        if (step !== 3) return;

        const reverseMappings = {};
        for (const header in mappings) {
            if (mappings[header] !== 'ignore') {
                reverseMappings[mappings[header]] = header;
            }
        }
        const formatMapped = !!reverseMappings.format;
        const channelMapped = !!reverseMappings.channel;

        const aggregated = {};
        fileData.forEach(row => {
            const platName = String(row[reverseMappings.platName] || '').trim();
            if (!platName) return;
            const formatText = formatMapped ? String(row[reverseMappings.format] || '').trim() : '';
            const channelText = channelMapped ? String(row[reverseMappings.channel] || '').trim() : '';

            const key = `${platName.toLowerCase()}|||${formatText.toLowerCase()}|||${channelText.toLowerCase()}`;
            const quantitySold = parseLocaleNumber(row[reverseMappings.quantitySold]);
            const prixVente = parseLocaleNumber(row[reverseMappings.prixVente]);
            const totalNetPriceHeader = reverseMappings.totalNetPrice;
            const lineRevenue = (totalNetPriceHeader && row[totalNetPriceHeader] != null)
                ? parseLocaleNumber(row[totalNetPriceHeader])
                : prixVente * quantitySold;

            if (!aggregated[key]) {
                aggregated[key] = { platName, formatText, channelText, category: String(row[reverseMappings.category] || '').trim(), prixVente, quantitySold, totalRevenue: lineRevenue };
            } else {
                aggregated[key].quantitySold += quantitySold;
                aggregated[key].totalRevenue += lineRevenue;
            }
        });

        const dataToProcess = Object.values(aggregated).map((item, index) => {
            const existingProduct = existingProducts.find(p => p.platName.toLowerCase() === item.platName.toLowerCase());
            const productStatus = existingProduct ? 'update' : 'new';
            const productFormats = existingProduct?.formats || [];

            // Résolution du FORMAT : jamais de création automatique (voir en-tête du fichier).
            let formatResolution = 'ignore';
            let formatId = null;
            if (productStatus === 'new') {
                formatResolution = 'n/a'; // le nouveau produit aura son propre format unique
            } else if (!formatMapped) {
                // Colonne non mappée : hypothèse d'un seul format par produit dans ce fichier.
                if (productFormats.length >= 1) { formatResolution = 'matched'; formatId = productFormats[0].id; }
            } else {
                const match = productFormats.find(f => formatQuantityLabel(f.portionSize, f.portionUnit).toLowerCase() === item.formatText.toLowerCase());
                if (match) { formatResolution = 'matched'; formatId = match.id; }
            }

            // Résolution du CANAL : par défaut on en crée un nouveau si le texte ne correspond à
            // aucun canal existant (voir en-tête du fichier).
            let channelResolution = 'matched';
            let channelId = salesChannels[0]?.id || null;
            let newChannelName = '';
            if (channelMapped && item.channelText) {
                const match = salesChannels.find(c => (c.name || '').toLowerCase() === item.channelText.toLowerCase());
                if (match) { channelId = match.id; }
                else { channelResolution = 'create'; channelId = null; newChannelName = item.channelText; }
            }

            return {
                id: `import_${Date.now()}_${index}`, ...item,
                productStatus, existingProductId: existingProduct?.id || null, availableFormats: productFormats,
                formatResolution, formatId,
                channelResolution, channelId, newChannelName,
            };
        });

        setProcessedData(dataToProcess);
        // Présélectionne tout ce qui n'a pas besoin de résolution manuelle (format non ignoré).
        setSelectedItems(new Set(dataToProcess.filter(i => i.formatResolution !== 'ignore').map(i => i.id)));
    }, [step, fileData, mappings, existingProducts, salesChannels]);

    const resetWizard = () => {
        setStep(1);
        setFileName('');
        setHeaders([]);
        setFileData([]);
        setMappings({});
        setProcessedData([]);
        setSelectedItems(new Set());
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
                // codepage 65001 = UTF-8 : sans lui, un .csv accentué (très courant dans une app
                // francophone) se lit en Latin-1 par défaut et corrompt les noms ("Suprême" ->
                // "SuprÃªme"), ce qui fait rater silencieusement la correspondance avec un plat
                // existant (créerait un doublon). N'affecte pas les .xlsx (déjà encodés).
                const workbook = window.XLSX.read(data, { type: 'array', codepage: 65001 });
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
            if (newSet.has(itemId)) newSet.delete(itemId); else newSet.add(itemId);
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        setSelectedItems(e.target.checked ? new Set(processedData.map(item => item.id)) : new Set());
    };

    const handleDeselectAll = () => setSelectedItems(new Set());

    const handleManualLink = (itemId, linkedProductId) => {
        setProcessedData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            if (linkedProductId === 'new') {
                return { ...item, productStatus: 'new', existingProductId: null, availableFormats: [], formatResolution: 'n/a', formatId: null };
            }
            const existingProduct = existingProducts.find(p => p.id === linkedProductId);
            return { ...item, productStatus: 'update', existingProductId: existingProduct.id, availableFormats: existingProduct.formats || [], formatResolution: 'ignore', formatId: null };
        }));
    };

    const handleFormatResolutionChange = (itemId, value) => {
        setProcessedData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            if (value === 'ignore') return { ...item, formatResolution: 'ignore', formatId: null };
            return { ...item, formatResolution: 'matched', formatId: value };
        }));
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (value === 'ignore') next.delete(itemId); else next.add(itemId);
            return next;
        });
    };

    const handleChannelResolutionChange = (itemId, value) => {
        setProcessedData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            if (value === 'ignore') return { ...item, channelResolution: 'ignore', channelId: null };
            if (value === 'create') return { ...item, channelResolution: 'create', channelId: null, newChannelName: item.channelText || item.newChannelName };
            return { ...item, channelResolution: 'matched', channelId: value };
        }));
    };

    const isNextStepDisabled = useMemo(() => {
        if (step === 2) {
            const requiredFields = SALES_REPORT_APP_FIELDS.filter(f => f.required).map(f => f.key);
            const mappedFields = Object.values(mappings);
            return !requiredFields.every(rf => mappedFields.includes(rf));
        }
        if (step === 3) {
            return selectedItems.size === 0;
        }
        return false;
    }, [step, mappings, selectedItems]);

    const handleConfirmImport = () => {
        let minDate = null;
        let maxDate = null;
        const dateHeader = Object.keys(mappings).find(h => mappings[h] === 'transactionDate');
        if (dateHeader) {
            fileData.forEach(row => {
                const dateValue = row[dateHeader];
                let currentDate = null;
                if (dateValue) {
                    if (typeof dateValue === 'number') currentDate = excelSerialDateToJSDate(dateValue);
                    else if (dateValue instanceof Date && !isNaN(dateValue)) currentDate = dateValue;
                    else if (typeof dateValue === 'string') {
                        const parsedDate = new Date(dateValue);
                        if (!isNaN(parsedDate)) currentDate = parsedDate;
                    }
                }
                if (currentDate && !isNaN(currentDate.getTime())) {
                    if (!minDate || currentDate < minDate) minDate = currentDate;
                    if (!maxDate || currentDate > maxDate) maxDate = currentDate;
                }
            });
        }
        const formatDate = (date) => {
            if (!date || !(date instanceof Date)) return '';
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        const items = processedData
            .filter(item => selectedItems.has(item.id) && item.channelResolution !== 'ignore' && item.formatResolution !== 'ignore')
            .map(item => ({
                platName: item.platName,
                category: item.category,
                productStatus: item.productStatus,
                existingProductId: item.existingProductId,
                formatId: item.formatId,
                channelResolution: item.channelResolution === 'create'
                    ? { type: 'create', newChannelName: item.newChannelName }
                    : { type: 'matched', channelId: item.channelId },
                netPrice: item.prixVente,
                volume: item.quantitySold,
            }));

        onImportComplete({ items, newStartDate: formatDate(minDate), newEndDate: formatDate(maxDate) });
        handleClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Assistant d'importation d'un rapport de ventes (Étape {step}/4)</h2>
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
                                Un rapport de ventes par distributeur/circuit, un export comptable (QuickBooks, Odoo...)
                                ou tout fichier listant plat, quantité vendue et prix — un canal par ligne si vous en
                                avez plusieurs.
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
                            <p className="text-gray-600 mb-6">Associez les colonnes de votre fichier <span className="font-semibold text-gray-800">{fileName}</span> aux champs de l'application. Les champs marqués d'un astérisque (*) sont obligatoires. Format et Canal sont optionnels : s'ils ne sont pas mappés, toutes les lignes sont supposées viser le premier format du produit et le premier canal de vente.</p>
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
                                            {SALES_REPORT_APP_FIELDS.map(field => (
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
                            <h3 className="text-xl font-semibold mb-2">Étape 3: Prévisualisation et résolution</h3>
                            <p className="text-gray-600 mb-6">
                                Vérifiez chaque ligne : à quel plat, quel format et quel canal de vente elle correspond.
                                Une ligne dont le format n'est pas résolu est désélectionnée par défaut — elle ne sera
                                pas importée tant que vous ne la liez pas à un format existant.
                            </p>
                            <div className="flex items-center space-x-4 mb-4 p-2 bg-gray-50 rounded-md">
                                <span className="text-sm font-medium text-gray-700">Sélections rapides:</span>
                                <button onClick={handleDeselectAll} className="text-sm text-red-600 hover:underline">
                                    Tout désélectionner
                                </button>
                            </div>
                            <div className="max-h-[55vh] overflow-y-auto pr-2 border rounded-lg">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2 w-12 text-center">
                                                <input type="checkbox" checked={selectedItems.size === processedData.length && processedData.length > 0} onChange={handleSelectAll} className="h-4 w-4" />
                                            </th>
                                            <th className="p-2 text-left">Plat</th>
                                            <th className="p-2 text-left">Produit</th>
                                            <th className="p-2 text-left">Format</th>
                                            <th className="p-2 text-left">Canal</th>
                                            <th className="p-2 text-right">Prix net</th>
                                            <th className="p-2 text-right">Qté vendue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {processedData.map(item => (
                                            <tr key={item.id} className={item.formatResolution === 'ignore' || item.channelResolution === 'ignore' ? 'opacity-50' : ''}>
                                                <td className="p-2 text-center">
                                                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectionChange(item.id)} />
                                                </td>
                                                <td className="p-2 font-medium">{item.platName}</td>
                                                <td className="p-2">
                                                    {item.productStatus === 'new' ? (
                                                        <select className="w-full p-1 border rounded-md text-xs" onChange={(e) => handleManualLink(item.id, e.target.value)} value="new">
                                                            <option value="new">-- Créer un nouveau plat --</option>
                                                            {existingProducts.map(p => <option key={p.id} value={p.id}>{p.platName}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">Lié à "{existingProducts.find(p => p.id === item.existingProductId)?.platName}"</span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    {item.productStatus === 'new' ? (
                                                        <span className="text-xs text-gray-400 italic">Nouveau format</span>
                                                    ) : (
                                                        <select className="w-full p-1 border rounded-md text-xs" value={item.formatResolution === 'matched' ? item.formatId : 'ignore'} onChange={(e) => handleFormatResolutionChange(item.id, e.target.value)}>
                                                            <option value="ignore">-- Ignorer cette ligne --</option>
                                                            {item.availableFormats.map(f => (
                                                                <option key={f.id} value={f.id}>{formatQuantityLabel(f.portionSize, f.portionUnit) || f.sku || 'Format'}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full p-1 border rounded-md text-xs" value={item.channelResolution === 'create' ? 'create' : (item.channelResolution === 'ignore' ? 'ignore' : item.channelId)} onChange={(e) => handleChannelResolutionChange(item.id, e.target.value)}>
                                                        {item.channelText && <option value="create">-- Créer le canal « {item.channelText} » --</option>}
                                                        {salesChannels.map(c => <option key={c.id} value={c.id}>{c.name || 'Sans nom'}</option>)}
                                                        <option value="ignore">-- Ignorer cette ligne --</option>
                                                    </select>
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
                                    <li><strong>Mettre à jour</strong> {processedData.filter(item => selectedItems.has(item.id) && item.formatResolution !== 'ignore' && item.channelResolution !== 'ignore' && item.productStatus === 'update').length} format(s) existant(s) (prix net + volume par canal).</li>
                                    <li><strong>Ajouter</strong> {processedData.filter(item => selectedItems.has(item.id) && item.channelResolution !== 'ignore' && item.productStatus === 'new').length} nouveau(x) plat(s).</li>
                                    <li><strong>Créer</strong> {processedData.filter(item => selectedItems.has(item.id) && item.channelResolution === 'create').length} nouveau(x) canal(aux) de vente.</li>
                                </ul>
                                <p className="border-t pt-2 mt-2">Le <strong>mix des ventes</strong> de TOUS les formats du menu sera recalculé à partir des volumes par canal déjà saisis (cet import + les précédents), et les <strong>revenus totaux</strong> seront ajustés en conséquence. <strong>Attention</strong> : un format dont aucun volume n'a encore été importé ou saisi apparaîtra à 0 % de mix des ventes après cette opération, même s'il avait une valeur avant.</p>
                            </div>
                            <p className="text-gray-600 my-8">
                                Cette action modifiera votre menu et vos canaux de vente. Êtes-vous sûr de vouloir continuer ?
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
                            <button onClick={() => setStep(3)} disabled={isNextStepDisabled} className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400" title={isNextStepDisabled ? "Veuillez associer tous les champs obligatoires (*)." : ""}>
                                Suivant
                            </button>
                        )}
                        {step === 3 && (
                            <button onClick={() => setStep(4)} disabled={isNextStepDisabled} className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400" title={isNextStepDisabled ? "Veuillez sélectionner au moins un item." : ""}>
                                Suivant
                            </button>
                        )}
                        {step === 4 && (
                            <button onClick={handleConfirmImport} className="px-4 py-2 border rounded-md text-sm text-white bg-green-600 hover:bg-green-700">
                                Confirmer et Importer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
