// Fenêtres et menu des points de référence (relevés) du suivi dans le temps. Extrait de SummaryTable.jsx le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, Pencil, Camera, Trash2, ChevronDown } from 'lucide-react';
import { useEscapeKey, useStateResetOnChange } from '../../ui-utils.jsx';
import { Pagination } from '../../components/common.jsx';

// --- MODAL POUR LES DÉTAILS DU POINT DE RÉFÉRENCE ---
export const SnapshotDetailsModal = ({ isOpen, onClose, onSave, initialData }) => {
    useEscapeKey(isOpen, onClose);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(initialData ? initialData.name : new Date().toLocaleString('fr-CA', { dateStyle: 'long' }));
            setNote(initialData ? initialData.note : '');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ name, note });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{initialData ? 'Modifier le point de référence' : 'Nouveau point de référence'}</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="snapshotName" className="block text-sm font-medium text-gray-700">Nom du point de référence</label>
                        <input
                            type="text"
                            id="snapshotName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="snapshotNote" className="block text-sm font-medium text-gray-700">Note descriptive (optionnel)</label>
                        <textarea
                            id="snapshotNote"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md border-gray-300"
                            placeholder="Ex: Promotion estivale, nouveau fournisseur..."
                            rows="3"
                        />
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-xs"
                        onClick={handleSave}
                    >
                        Enregistrer
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MODALE « GÉRER LES POINTS DE RÉFÉRENCE » (24/10) : auparavant une section toujours visible en
// bas de l'onglet Suivi — déplacée dans une modale, ouverte à la demande depuis le menu déroulant
// « Point de référence » (voir PointDeReferenceMenu), pour ne plus encombrer la vue par défaut.
// Tri/filtre/pagination restent LOCAUX à la modale (state éphémère, se réinitialise à chaque
// ouverture — un choix délibéré, contrairement à `selectedSnapshotIds` ci-dessous qui, lui,
// contrôle quels points alimentent les graphiques et doit donc survivre à la fermeture de cette
// modale).
export const ManagePointsModal = ({ isOpen, onClose, trackingPoints, selectedSnapshotIds, onSelectionChange, onSelectAll, onEditSnapshot, onDeleteSnapshot }) => {
    useEscapeKey(isOpen, onClose);
    const [snapSort, setSnapSort] = useState({ key: 'timestamp', direction: 'descending' });
    const [snapFilter, setSnapFilter] = useState('');
    const [snapPerPage, setSnapPerPage] = useState(10);
    const [snapPage, setSnapPage] = useStateResetOnChange(1, [snapFilter, snapPerPage]);

    const filteredSnapshots = useMemo(() => {
        let list = trackingPoints;
        if (snapFilter.trim()) {
            const q = snapFilter.toLowerCase();
            list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
        }
        const dir = snapSort.direction === 'ascending' ? 1 : -1;
        return [...list].sort((a, b) => {
            if (snapSort.key === 'timestamp') return (new Date(a.timestamp) - new Date(b.timestamp)) * dir;
            return String(a[snapSort.key] || '').localeCompare(String(b[snapSort.key] || '')) * dir;
        });
    }, [trackingPoints, snapFilter, snapSort]);
    const pagedSnapshots = useMemo(
        () => filteredSnapshots.slice((snapPage - 1) * snapPerPage, (snapPage - 1) * snapPerPage + snapPerPage),
        [filteredSnapshots, snapPage, snapPerPage]
    );
    const requestSnapSort = (key) => setSnapSort(prev => ({
        key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Gestion des points de référence</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <input
                    type="text"
                    value={snapFilter}
                    onChange={(e) => setSnapFilter(e.target.value)}
                    placeholder="Filtrer par nom ou note…"
                    className="p-2 border rounded-md text-sm w-64 mb-3"
                />
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredSnapshots.length > 0 && filteredSnapshots.every(p => selectedSnapshotIds.has(p.id))}
                                        onChange={(e) => onSelectAll(filteredSnapshots.map(p => p.id), e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                {[
                                    { key: 'name', label: 'Nom' },
                                    { key: 'note', label: 'Note' },
                                    { key: 'timestamp', label: 'Date de création' },
                                ].map(col => (
                                    <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                        <button onClick={() => requestSnapSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
                                            {col.label}
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${snapSort.key === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                                        </button>
                                    </th>
                                ))}
                                <th className="relative px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pagedSnapshots.map((point, index) => (
                                <tr key={point.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedSnapshotIds.has(point.id)}
                                            onChange={() => onSelectionChange(point.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{point.name}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{point.note || "-"}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{new Date(point.timestamp).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}</td>
                                    <td className="px-4 py-2 text-right flex items-center justify-end space-x-2">
                                        <button onClick={() => onEditSnapshot(point)} className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => onDeleteSnapshot(point.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {pagedSnapshots.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Aucun point de référence ne correspond au filtre.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    totalItems={filteredSnapshots.length}
                    itemsPerPage={snapPerPage}
                    currentPage={snapPage}
                    onPageChange={setSnapPage}
                    onItemsPerPageChange={setSnapPerPage}
                />
            </div>
        </div>
    );
};

// --- MENU DÉROULANT « POINT DE RÉFÉRENCE » (24/10) : remplace le bouton unique « Créer un point de
// référence », déplacé sous les boutons d'export — deux actions désormais (nouveau point, ou gérer
// ceux existants, auparavant une section toujours visible en bas de l'onglet Suivi).
export const PointDeReferenceMenu = ({ onNew, onManage }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = React.useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                id="tutorial-snapshot"
                onClick={() => setIsOpen(o => !o)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
                <Camera className="h-4 w-4 mr-2" /> Point de référence <ChevronDown className="h-3.5 w-3.5 ml-2" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                    <button onClick={() => { setIsOpen(false); onNew(); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Nouveau point de référence
                    </button>
                    <button onClick={() => { setIsOpen(false); onManage(); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Gérer les points de référence
                    </button>
                </div>
            )}
        </div>
    );
};
