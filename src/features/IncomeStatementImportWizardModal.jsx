import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseLocaleNumber, excelSerialDateToJSDate, INCOME_STATEMENT_APP_FIELDS, guessExpenseCategory, parsePdfStatementLine, EXPENSE_CATEGORIES } from '../utils.js';

// pdf.js a besoin d'un worker séparé pour décoder le PDF hors du thread principal — `?url` (Vite)
// renvoie l'URL de l'asset buildé (même origine, conforme à la CSP `script-src 'self'` déjà en
// place pour XLSX.js/jsPDF), jamais un CDN distant.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const REVENUE_KEYWORDS = ['vente', 'ventes', 'revenu', 'revenue', 'income', 'chiffre'];
const EXPENSE_KEYWORDS = ['dépense', 'depense', 'expense', 'charge', 'frais'];
const inferType = (typeText, label, categoryText) => {
    const t = (typeText || '').toLowerCase();
    if (t) {
        if (REVENUE_KEYWORDS.some(kw => t.includes(kw))) return 'revenue';
        if (EXPENSE_KEYWORDS.some(kw => t.includes(kw))) return 'expense';
    }
    const haystack = `${label} ${categoryText}`.toLowerCase();
    if (REVENUE_KEYWORDS.some(kw => haystack.includes(kw))) return 'revenue';
    return 'expense';
};

// Reconstruit les lignes de texte d'un PDF en regroupant ses éléments par position Y (une page de
// PDF n'a pas de notion de « ligne » native — seulement des fragments de texte positionnés) : deux
// fragments dont le Y diffère de moins de Y_TOLERANCE sont considérés sur la même ligne visuelle,
// joints dans l'ordre de lecture (gauche à droite). `parsePdfStatementLine` (utils.js) isole
// ensuite le poste et son montant dans chaque ligne reconstruite.
const Y_TOLERANCE = 2;
const extractLinesFromPdf = async (arrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items
            .filter((it) => it.str && it.str.trim())
            .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
            .sort((a, b) => (b.y - a.y) || (a.x - b.x));

        let currentLine = null;
        items.forEach((it) => {
            if (currentLine && Math.abs(currentLine.y - it.y) <= Y_TOLERANCE) {
                currentLine.parts.push(it.str);
            } else {
                if (currentLine) lines.push(currentLine.parts.join(' '));
                currentLine = { y: it.y, parts: [it.str] };
            }
        });
        if (currentLine) lines.push(currentLine.parts.join(' '));
    }
    return lines;
};

// Phase 4.7 : importe directement les lignes de Revenus et de Frais fixes de l'onglet État des
// résultats depuis un export comptable externe, plutôt que de tout ressaisir à la main — voir
// Projet_Claude/05-Imports-Integrations.md, point 2. Contrairement à
// SalesReportImportWizardModal.jsx (qui agrège de nombreuses transactions par plat×canal), un état
// des résultats liste déjà UN poste par ligne avec son montant : pas d'étape d'agrégation.
//
// Deux sources possibles (retour utilisateur du 15/10 : le PDF textuel, pas le CSV/Excel, est le
// format le plus courant pour un état des résultats reçu d'un comptable) :
// - **Fichier structuré (CSV/Excel)** : étape 2 classique de correspondance des colonnes (vraies
//   colonnes disponibles) — INCOME_STATEMENT_APP_FIELDS.
// - **PDF textuel** : pas de colonnes réelles à mapper — chaque ligne est reconstruite par
//   position (extractLinesFromPdf), puis `parsePdfStatementLine` isole poste + montant. L'étape 2
//   est donc entièrement sautée (step passe directement de 1 à 3) : seul Poste/Montant sont
//   disponibles, Type/Catégorie/Activité restent devinés puis corrigés à l'étape 3 comme pour un
//   fichier structuré sans ces colonnes. Jamais de PDF scanné/image (demanderait de l'OCR, hors
//   scope) — message d'erreur explicite si aucune ligne n'est reconnue.
//
// Ventilation par SKU (optionnelle, décidée le 22/09, fichiers structurés seulement — un PDF
// textuel n'a pas de colonne Produit/SKU séparée) : quand la colonne Produit/SKU est mappée et
// correspond au nom d'un produit existant, un revenu est automatiquement rattaché à l'activité de
// production de ce produit plutôt qu'à Général.
export const IncomeStatementImportWizardModal = ({ isOpen, onClose, onImportComplete, productsWithCosts, activityBuckets }) => {
    const [step, setStep] = useState(1);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sourceType, setSourceType] = useState(null); // 'structured' | 'pdf'

    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState([]);
    const [fileData, setFileData] = useState([]);

    const [mappings, setMappings] = useState({});

    // Ligne brute commune aux deux sources, avant devinette de type/catégorie/activité : { label,
    // amount, typeText, categoryText, skuText } — skuText/categoryText/typeText restent '' pour un
    // PDF (pas de colonnes séparées).
    const [baseRows, setBaseRows] = useState([]);

    const [processedData, setProcessedData] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [importMode, setImportMode] = useState('additive');

    useEffect(() => {
        if (step === 2) {
            const initialMappings = {};
            const assignedAppFields = new Set();

            headers.forEach(header => {
                const lowerHeader = String(header).toLowerCase();
                const bestMatch = INCOME_STATEMENT_APP_FIELDS.find(field =>
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

    // Résolution ligne par ligne : type (Revenu/Dépense), catégorie (Dépense) ou activité visée
    // (Revenu, via correspondance SKU) — devinés, toujours modifiables en étape 3. Ne dépend plus
    // que de `baseRows`, commun aux deux sources (structuré ou PDF).
    useEffect(() => {
        if (step !== 3) return;

        const dataToProcess = baseRows.map((row, index) => {
            const type = inferType(row.typeText, row.label, row.categoryText);
            const category = guessExpenseCategory(row.label, row.categoryText);

            let activityKey = 'general';
            if (row.skuText) {
                const match = productsWithCosts.find(p => (p.platName || '').toLowerCase() === row.skuText.toLowerCase());
                if (match?.activityId && activityBuckets.some(b => b.key === match.activityId)) activityKey = match.activityId;
            }

            return { id: `import_${Date.now()}_${index}`, label: row.label, amount: row.amount, type, category, activityKey, skuText: row.skuText };
        });

        setProcessedData(dataToProcess);
        setSelectedItems(new Set(dataToProcess.filter(i => i.amount > 0).map(i => i.id)));
    }, [step, baseRows, productsWithCosts, activityBuckets]);

    const resetWizard = () => {
        setStep(1);
        setSourceType(null);
        setFileName('');
        setHeaders([]);
        setFileData([]);
        setMappings({});
        setBaseRows([]);
        setProcessedData([]);
        setSelectedItems(new Set());
        setImportMode('additive');
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
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        setSourceType(isPdf ? 'pdf' : 'structured');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (isPdf) {
                    const lines = await extractLinesFromPdf(e.target.result);
                    const rows = lines
                        .map((line) => parsePdfStatementLine(line))
                        .filter(Boolean)
                        .map((r) => ({ label: r.label, amount: Math.abs(r.amount), typeText: '', categoryText: '', skuText: '' }));

                    if (rows.length === 0) {
                        alert("Aucun poste n'a pu être reconnu dans ce PDF. Vérifiez qu'il s'agit bien d'un PDF textuel (pas une image scannée), ou essayez un export CSV/Excel.");
                        resetWizard();
                        return;
                    }
                    setBaseRows(rows);
                    setStep(3);
                    return;
                }

                if (typeof window.XLSX === 'undefined') {
                    alert("La bibliothèque de lecture de fichiers n'est pas chargée. Veuillez réessayer.");
                    return;
                }
                const data = new Uint8Array(e.target.result);
                // codepage 65001 = UTF-8 — voir SalesReportImportWizardModal.jsx pour le détail.
                const workbook = window.XLSX.read(data, { type: 'array', codepage: 65001 });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { cellDates: true });

                if (jsonData.length === 0) {
                    alert("Le fichier semble vide.");
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

    // Transition étape 2 -> 3 (fichier structuré seulement — un PDF y arrive directement depuis
    // l'étape 1) : matérialise les lignes brutes à partir du mapping choisi.
    const handleProceedFromMapping = () => {
        const reverseMappings = {};
        for (const header in mappings) {
            if (mappings[header] !== 'ignore') reverseMappings[mappings[header]] = header;
        }
        const rows = fileData
            .map((row) => ({
                label: String(row[reverseMappings.label] || '').trim(),
                amount: Math.abs(parseLocaleNumber(row[reverseMappings.amount])),
                typeText: reverseMappings.type ? String(row[reverseMappings.type] || '').trim() : '',
                categoryText: reverseMappings.category ? String(row[reverseMappings.category] || '').trim() : '',
                skuText: reverseMappings.sku ? String(row[reverseMappings.sku] || '').trim() : '',
            }))
            .filter((r) => r.label);
        setBaseRows(rows);
        setStep(3);
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

    const handleRowFieldChange = (itemId, field, value) => {
        setProcessedData(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
    };

    const isNextStepDisabled = useMemo(() => {
        if (step === 2) {
            const requiredFields = INCOME_STATEMENT_APP_FIELDS.filter(f => f.required).map(f => f.key);
            const mappedFields = Object.values(mappings);
            return !requiredFields.every(rf => mappedFields.includes(rf));
        }
        if (step === 3) {
            return selectedItems.size === 0;
        }
        return false;
    }, [step, mappings, selectedItems]);

    const selectedRevenueCount = useMemo(() => processedData.filter(i => selectedItems.has(i.id) && i.type === 'revenue').length, [processedData, selectedItems]);
    const selectedExpenseCount = useMemo(() => processedData.filter(i => selectedItems.has(i.id) && i.type === 'expense').length, [processedData, selectedItems]);

    // Période de référence (18/10) : détectée depuis la colonne Date si mappée — fichier structuré
    // (CSV/Excel) seulement ; `mappings`/`fileData` restent vides pour un PDF (parsé directement en
    // lignes, voir extractLinesFromPdf plus haut), donc `dateHeader` n'y est jamais trouvé et
    // minDate/maxDate restent null sans erreur — même patron que
    // SalesReportImportWizardModal.jsx::handleConfirmImport.
    const handleConfirmImport = () => {
        let minDate = null;
        let maxDate = null;
        const dateHeader = Object.keys(mappings).find(h => mappings[h] === 'date');
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

        const selected = processedData.filter(item => selectedItems.has(item.id));
        const revenueItems = selected.filter(i => i.type === 'revenue').map(i => ({ label: i.label, amount: parseLocaleNumber(i.amount), activityKey: i.activityKey }));
        const expenseItems = selected.filter(i => i.type === 'expense').map(i => ({ label: i.label, amount: parseLocaleNumber(i.amount), category: i.category }));

        onImportComplete({ revenueItems, expenseItems, mode: importMode, newStartDate: formatDate(minDate), newEndDate: formatDate(maxDate) });
        handleClose();
    };

    const handleBack = () => setStep(sourceType === 'pdf' && step === 3 ? 1 : step - 1);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Assistant d'importation de l'état des résultats (Étape {step}/4)</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200">
                        <X className="h-6 w-6 text-gray-600" />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {isLoading && <div className="text-center"><p>Lecture du fichier en cours...</p></div>}

                    {!isLoading && step === 1 && (
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-4">Étape 1: Téléverser votre état des résultats</h3>
                            <p className="text-gray-600 mb-8">
                                Le cas le plus courant : un <strong>PDF textuel</strong> (export natif de votre
                                comptable ou de votre logiciel comptable). Un export comptable structuré
                                (QuickBooks, Odoo...) en CSV/Excel fonctionne aussi.
                                <br />
                                Formats supportés : .pdf, .csv, .xls, .xlsx. Pas de PDF scanné/image (sans texte
                                reconnaissable).
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".pdf, application/pdf, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
                            <p className="text-gray-600 mb-6">
                                Associez les colonnes de votre fichier <span className="font-semibold text-gray-800">{fileName}</span> aux
                                champs de l'application. Les champs marqués d'un astérisque (*) sont obligatoires. Type, Catégorie et
                                Produit/SKU sont optionnels : la Catégorie et le Type de chaque ligne peuvent être devinés et corrigés à
                                l'étape suivante.
                            </p>
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
                                            {INCOME_STATEMENT_APP_FIELDS.map(field => (
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
                                Vérifiez chaque ligne : le Poste et le Montant restent modifiables (utile surtout pour un PDF, où le
                                texte est reconstruit automatiquement), puis Revenu ou Dépense, et enfin sa catégorie (Dépense) ou
                                l'activité de production visée (Revenu — « Général » si aucun produit n'a été reconnu). Une ligne à
                                0 $ est désélectionnée par défaut.
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
                                            <th className="p-2 text-left">Poste</th>
                                            <th className="p-2 text-right">Montant</th>
                                            <th className="p-2 text-left">Type</th>
                                            <th className="p-2 text-left">Catégorie / Activité</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {processedData.map(item => (
                                            <tr key={item.id} className={item.amount === 0 ? 'opacity-50' : ''}>
                                                <td className="p-2 text-center">
                                                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectionChange(item.id)} />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={(e) => handleRowFieldChange(item.id, 'label', e.target.value)}
                                                        title={item.skuText ? `Produit/SKU source : ${item.skuText}` : ''}
                                                        className="w-full p-1 border border-gray-300 rounded-md text-xs font-medium"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={item.amount}
                                                        onChange={(e) => handleRowFieldChange(item.id, 'amount', e.target.value)}
                                                        onBlur={(e) => handleRowFieldChange(item.id, 'amount', parseLocaleNumber(e.target.value))}
                                                        className="w-24 p-1 border border-gray-300 rounded-md text-xs text-right"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full p-1 border rounded-md text-xs" value={item.type} onChange={(e) => handleRowFieldChange(item.id, 'type', e.target.value)}>
                                                        <option value="revenue">Revenu</option>
                                                        <option value="expense">Dépense</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    {item.type === 'expense' ? (
                                                        <select className="w-full p-1 border rounded-md text-xs" value={item.category} onChange={(e) => handleRowFieldChange(item.id, 'category', e.target.value)}>
                                                            {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                    ) : (
                                                        <select className="w-full p-1 border rounded-md text-xs" value={item.activityKey} onChange={(e) => handleRowFieldChange(item.id, 'activityKey', e.target.value)}>
                                                            {activityBuckets.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                                                        </select>
                                                    )}
                                                </td>
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
                            <div className="p-4 bg-gray-100 rounded-lg space-y-3 text-left max-w-md mx-auto">
                                <p>Vous êtes sur le point d'ajouter :</p>
                                <ul className="list-disc list-inside">
                                    <li><strong>{selectedRevenueCount}</strong> ligne(s) de revenu.</li>
                                    <li><strong>{selectedExpenseCount}</strong> ligne(s) de frais fixes.</li>
                                </ul>
                                <div className="border-t pt-3 space-y-2">
                                    <label className="flex items-start gap-2 text-sm">
                                        <input type="radio" name="importMode" checked={importMode === 'additive'} onChange={() => setImportMode('additive')} className="mt-0.5" />
                                        <span><strong>Ajouter</strong> à mes lignes existantes (recommandé) — les lignes déjà saisies restent intactes.</span>
                                    </label>
                                    <label className="flex items-start gap-2 text-sm">
                                        <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="mt-0.5" />
                                        <span><strong>Remplacer</strong> entièrement mes lignes de Revenus et de Frais fixes actuelles par celles de ce fichier.</span>
                                    </label>
                                </div>
                            </div>
                            <p className="text-gray-600 my-8">
                                Êtes-vous sûr de vouloir continuer ?
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <button onClick={handleClose} className="px-4 py-2 border rounded-md text-sm">Annuler</button>
                    <div className="flex space-x-2">
                        {step > 1 && (
                            <button onClick={handleBack} className="px-4 py-2 border rounded-md text-sm">Précédent</button>
                        )}
                        {step === 2 && (
                            <button onClick={handleProceedFromMapping} disabled={isNextStepDisabled} className="px-4 py-2 border rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400" title={isNextStepDisabled ? "Veuillez associer tous les champs obligatoires (*)." : ""}>
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
