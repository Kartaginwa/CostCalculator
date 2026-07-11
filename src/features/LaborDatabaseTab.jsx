import React, { useState, useRef, useEffect } from 'react';
import { XCircle, ChevronDown, Copy, Trash2 } from 'lucide-react';
import { parseLocaleNumber, formatCurrency } from '../utils.jsx';
import { Tooltip } from '../components/common.jsx';
import { useProject } from '../state/ProjectContext.jsx';

export const LaborDatabaseTab = ({ openPostIds, setOpenPostIds }) => {
    const { laborDatabase, onUpdateLaborDatabase, generalInfo, showNotification, setNotification } = useProject();
    const productivityReport = generalInfo.productivityReport;

const [newlyAddedPostId, setNewlyAddedPostId] = useState(null);
const [newlyAddedEmployeeId, setNewlyAddedEmployeeId] = useState(null);

const togglePost = (postId) => {
    setOpenPostIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
            newSet.delete(postId);
        } else {
            newSet.add(postId);
        }
        return newSet;
    });
};
const prevLaborDbRef = useRef(JSON.parse(JSON.stringify(laborDatabase)));

useEffect(() => {
    if (newlyAddedPostId) {
        setTimeout(() => {
            const newPostElement = document.getElementById(`post-${newlyAddedPostId}`);
            if (newPostElement) {
                newPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const input = newPostElement.querySelector('input');
                if (input) input.focus();
            }
            // Réinitialise après un délai pour l'animation
            setTimeout(() => setNewlyAddedPostId(null), 500);
        }, 100);
    }
}, [newlyAddedPostId]);

useEffect(() => {
    if (newlyAddedEmployeeId) {
        setTimeout(() => {
            const newRowElement = document.getElementById(`employee-row-${newlyAddedEmployeeId}`);
            if (newRowElement) {
                newRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const input = newRowElement.querySelector('input');
                if (input) input.focus();
            }
            setTimeout(() => setNewlyAddedEmployeeId(null), 500);
        }, 100);
    }
}, [newlyAddedEmployeeId]);


    const handlePostChange = (postId, field, value) => {
        const newList = laborDatabase.map(post => post.id === postId ? { ...post, [field]: value } : post);
        onUpdateLaborDatabase(newList);
    };

    const handleEmployeeChange = (postId, empId, field, value) => {
        const newList = laborDatabase.map(post => {
            if (post.id === postId) {
                const updatedEmployees = post.employees.map(emp => emp.id === empId ? { ...emp, [field]: value } : emp);
                return { ...post, employees: updatedEmployees };
            }
            return post;
        });
        onUpdateLaborDatabase(newList);
    };

    const addPost = () => {
        const newPost = { id: `post_${Date.now()}`, postName: 'Nouveau Poste', employees: [] };
        setNewlyAddedPostId(newPost.id); // Met en mémoire l'ID pour le useEffect
        onUpdateLaborDatabase([...laborDatabase, newPost]);
    };

    const removePost = (postId) => {
        const postToDelete = laborDatabase.find(post => post.id === postId);
        if (!postToDelete) return;

        const originalList = [...laborDatabase];
        const newList = laborDatabase.filter(post => post.id !== postId);
        onUpdateLaborDatabase(newList);

        showNotification({
            message: `Le poste "${postToDelete.postName}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdateLaborDatabase(originalList);
                setNotification(null);
            }
        });
    };

    const addEmployee = (postId) => {
        // Ouvre l'accordéon du poste concerné au cas où il serait fermé
        setOpenPostIds(prev => new Set(prev).add(postId));

        const newEmployee = { 
            id: `emp_${Date.now()}`, 
            employeeName: '', 
            hourlyRate: 0, 
            socialCharges: 0, 
            vacationPercentage: 0, 
            productiveTimePercentage: 100, 
            workedHours: 0 
        };
        setNewlyAddedEmployeeId(newEmployee.id); // Met en mémoire l'ID du nouvel employé

        const newList = laborDatabase.map(post => {
            if (post.id === postId) {
                return { ...post, employees: [...post.employees, newEmployee] };
            }
            return post;
        });
        onUpdateLaborDatabase(newList);
    };

    const removeEmployee = (postId, empId) => {
        const originalList = JSON.parse(JSON.stringify(laborDatabase));
        const employeeName = laborDatabase.find(p => p.id === postId)?.employees.find(e => e.id === empId)?.employeeName || 'un employé';

        const newList = laborDatabase.map(post => {
            if (post.id === postId) {
                return { ...post, employees: post.employees.filter(emp => emp.id !== empId) };
            }
            return post;
        });
        onUpdateLaborDatabase(newList);

        showNotification({
            message: `L'employé "${employeeName}" a été supprimé.`,
            type: 'info',
            onUndo: () => {
                onUpdateLaborDatabase(originalList);
                setNotification(null);
            }
        });
    };
    const duplicateEmployee = (postId, empId) => {
        const newList = laborDatabase.map(post => {
            if (post.id === postId) {
                const employeeIndex = post.employees.findIndex(emp => emp.id === empId);
                if (employeeIndex === -1) return post;

                const employeeToDuplicate = post.employees[employeeIndex];
                const newEmployee = {
                    ...employeeToDuplicate,
                    id: `emp_${Date.now()}`,
                    employeeName: `${employeeToDuplicate.employeeName || 'Employé'} (Copie)`
                };

                const newEmployees = [...post.employees];
                newEmployees.splice(employeeIndex + 1, 0, newEmployee);
                return { ...post, employees: newEmployees };
            }
            return post;
        });
        onUpdateLaborDatabase(newList);
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-xl shadow-2xl max-w-7xl space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Base de données de la main-d'oeuvre</h1>
                <button id="tutorial-add-post" onClick={addPost} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                    Ajouter un poste
                </button>
            </div>


            <div id="tutorial-section-labor-db" className="space-y-6">
                {laborDatabase.map(post => {
                const totalHours = (post.employees || []).reduce((sum, emp) => sum + parseLocaleNumber(emp.workedHours), 0);
                const totalCost = (post.employees || []).reduce((sum, emp) => {
                    const baseHourlyCost = parseLocaleNumber(emp.hourlyRate) * (1 + parseLocaleNumber(emp.socialCharges) / 100) * (1 + parseLocaleNumber(emp.vacationPercentage) / 100);
                    return sum + (baseHourlyCost * parseLocaleNumber(emp.workedHours));
                }, 0);
                const weightedAverageCost = totalHours > 0 ? totalCost / totalHours : 0;

                return (
                <div key={post.id} id={`post-${post.id}`} className={`p-4 bg-gray-50 rounded-lg relative ${post.id === newlyAddedPostId ? 'new-row' : ''}`}>
                    <div
                        onClick={() => togglePost(post.id)}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && togglePost(post.id)}
                        className="w-full flex justify-between items-center text-left mb-4 cursor-pointer"
                        aria-expanded={openPostIds.has(post.id)}
                    >
                        {/* Section de gauche : Titre du poste seulement */}
                        <div className="flex items-center">
                            <input 
                                type="text" 
                                value={post.postName}
                                onChange={e => {
                                    e.stopPropagation();
                                    handlePostChange(post.id, 'postName', e.target.value);
                                }}
                                onClick={e => e.stopPropagation()}
                                className="text-2xl font-bold text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Section de droite : Actions groupées */}
                        <div className="flex items-center space-x-2">
                            {/* Icône de poubelle (maintenant à gauche) */}
                            <div onClick={e => e.stopPropagation()}>
                                <button onClick={() => removePost(post.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full">
                                    <XCircle size={24}/>
                                </button>
                            </div>
                            {/* Icône flèche qui tourne (maintenant à droite) */}
                            <ChevronDown className={`h-6 w-6 text-gray-500 transform transition-transform duration-200 ${openPostIds.has(post.id) ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {openPostIds.has(post.id) && (
                        <> 

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    {/* ... thead ... */}
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">Salaire Horaire ($)<Tooltip text="Le salaire horaire brut de l'employé, avant déduction des charges." /></div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">Charges (%)<Tooltip text="Les charges sociales et patronales en pourcentage du salaire horaire brut (ex: assurances, cotisations, etc.)." /></div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">Vacances (%)<Tooltip text="Pourcentage du salaire brut mis de côté pour les vacances." /></div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">% Temps productif attendu<Tooltip text="Pourcentage du temps de travail qui devrait être passé en production (ex: un chef à 80% si 20% de son temps est administratif)." /></div>
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                <div className="flex items-center">Heures Travaillées<Tooltip text="Indiquez le nombre total d'heures travaillées par cet employé pour la période de référence." /></div>
                                            </th>
                                            <th className="relative px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {(post.employees || []).map((emp, index) => (
                                            <tr key={emp.id} id={`employee-row-${emp.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td><input type="text" value={emp.employeeName || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'employeeName', e.target.value)} className="w-full p-1 border rounded" /></td>
                                                <td><input type="text" value={emp.hourlyRate || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'hourlyRate', e.target.value)} className="w-full p-1 border rounded text-right" /></td>
                                                <td><input type="text" value={emp.socialCharges || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'socialCharges', e.target.value)} className="w-full p-1 border rounded text-right" /></td>
                                                <td><input type="text" value={emp.vacationPercentage || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'vacationPercentage', e.target.value)} className="w-full p-1 border rounded text-right" /></td>
                                                <td><input type="text" value={emp.productiveTimePercentage || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'productiveTimePercentage', e.target.value)} className="w-full p-1 border rounded text-right" /></td>
                                                <td><input type="text" value={emp.workedHours || ''} onChange={e => handleEmployeeChange(post.id, emp.id, 'workedHours', e.target.value)} className="w-full p-1 border rounded text-right" /></td>
                                                <td className="px-2 py-2 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button onClick={() => duplicateEmployee(post.id, emp.id)} title="Dupliquer l'employé" className="text-blue-500 hover:text-blue-700 p-1 rounded-full"><Copy size={18}/></button>
                                                        <button onClick={() => removeEmployee(post.id, emp.id)} title="Supprimer l'employé" className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={18}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <div className="flex justify-between items-center mt-4">
                        {/* Bouton Nouvel employé en bas à gauche */}
                        <button onClick={() => addEmployee(post.id)} className="text-sm text-blue-600 hover:text-blue-800">
                            + Ajouter un employé
                        </button>
                        {/* Coût moyen en bas à droite */}
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Coût Moyen Pondéré du Poste</p>
                            <p className="text-xl font-bold text-gray-800">{formatCurrency(weightedAverageCost)} $/h</p>
                        </div>
                    </div>
                </div>
            )})}
            </div>
            <div id="tutorial-section-labor-rapport" className="mt-8 pt-6 border-t">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Rapport de productivité pour la période</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">Heures Productives Attendues<Tooltip text="Nombre d'heures que ce poste devrait passer en production, basé sur les heures travaillées et le % de temps productif attendu." /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">Heures Productives Réelles<Tooltip text="Nombre d'heures de production réellement nécessaires pour ce poste, calculé à partir de vos recettes et de vos ventes estimées." /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">Différence (h)<Tooltip text="Heures attendues - Heures réelles. Un chiffre positif indique un temps potentiellement non-alloué ou inefficace." /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <div className="flex items-center">Taux d'Utilisation (%)<Tooltip text="Pourcentage des heures productives attendues qui sont réellement utilisées pour la production." /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {productivityReport.rows.map(row => (
                                <tr key={row.postName}>
                                    <td className="px-4 py-2 font-medium">{row.postName}</td>
                                    <td className="px-4 py-2">{row.expected.toFixed(2)} h</td>
                                    <td className="px-4 py-2">{row.actual.toFixed(2)} h</td>
                                    <td className="px-4 py-2">{row.difference.toFixed(2)} h</td>
                                    <td className="px-4 py-2">{row.utilization.toFixed(2)} %</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td className="px-4 py-2 text-left">Total</td>
                                <td className="px-4 py-2">{productivityReport.totals.expected?.toFixed(2)} h</td>
                                <td className="px-4 py-2">{productivityReport.totals.actual?.toFixed(2)} h</td>
                                <td className="px-4 py-2">{productivityReport.totals.difference?.toFixed(2)} h</td>
                                <td className="px-4 py-2">{productivityReport.totals.utilization?.toFixed(2)} %</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};