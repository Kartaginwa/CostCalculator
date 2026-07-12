import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, HelpCircle, ChevronDown } from 'lucide-react';
import { formatCurrency, parseLocaleNumber, MAJOR_ALLERGENS } from '../utils.js';
import { useValueFlash } from '../ui-utils.jsx';

// Composant pour les messages de validation
export const ValidationMessage = ({ message }) => (
    <p className="mt-1 text-xs text-red-600 flex items-center">
        <AlertTriangle size={12} className="mr-1 flex-shrink-0" />
        <span>{message}</span>
    </p>
);

// Composant pour les info-bulles avec Portal
export const Tooltip = ({ text }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top - 10, // Position above the trigger
                left: rect.left + rect.width / 2, // Center horizontally
            });
        }
        setIsVisible(true);
    };

    const tooltipContent = isVisible ? (
        ReactDOM.createPortal(
            <div
                className="fixed p-2 w-64 bg-gray-800 text-white text-xs rounded-md shadow-lg z-50 transform -translate-x-1/2 -translate-y-full"
                style={{ top: position.top, left: position.left }}
            >
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>,
            document.getElementById('tooltip-root')
        )
    ) : null;

    return (
        <span
            className="inline-flex items-center ml-2"
            ref={triggerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            <HelpCircle size={14} className="text-gray-400 cursor-help" />
            {tooltipContent}
        </span>
    );
};

// --- NOUVEAU COMPOSANT DE PAGINATION ---
export const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange, onItemsPerPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Items par page:</span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                    className="p-1 border rounded-md text-sm"
                >
                    {[10, 25, 50, 100].map(size => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>

            {/* Affiche la navigation des pages seulement si nécessaire */}
            {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
                    >
                        Précédent
                    </button>
                    <span className="text-sm text-gray-700">
                        Page {currentPage} sur {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
                    >
                        Suivant
                    </button>
                </div>
            )}
        </div>
    );
};

// --- NOUVEAU COMPOSANT COMBOBOX (CHAMP DE SAISIE + LISTE DÉROULANTE) - VERSION FINALE CORRIGÉE ---
export const Combobox = ({ options, value, onChange, getOptionLabel, getOptionKey }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value ? getOptionLabel(value) : '');
    const wrapperRef = useRef(null); // Réf pour le conteneur du champ de saisie
    const dropdownRef = useRef(null); // Réf pour le menu déroulant lui-même
    const [dropdownStyle, setDropdownStyle] = useState({});

    // Met à jour le texte du champ si la valeur parente change (ex: changement de recette)
    useEffect(() => {
        if (!isOpen) {
            setInputValue(value ? getOptionLabel(value) : '');
        }
    }, [value, getOptionLabel, isOpen]);

    // Gère la fermeture du menu en cliquant à l'extérieur
    useEffect(() => {
        const handleClickOutside = (event) => {
            // On ferme SEULEMENT si le clic est en dehors du champ ET en dehors du menu déroulant
            if (
                wrapperRef.current && !wrapperRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, dropdownRef]); // On ajoute dropdownRef aux dépendances

    // Calcule la position du menu déroulant
    const calculatePosition = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 2,
                left: rect.left,
                width: rect.width,
            });
        }
    };

    const openDropdown = () => {
        calculatePosition();
        setIsOpen(true);
    };

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        return options.filter(option =>
            getOptionLabel(option).toLowerCase().includes(inputValue.toLowerCase())
        );
    }, [options, inputValue, getOptionLabel]);

    const handleSelect = (option) => {
        onChange(option); // Met à jour l'état du parent avec l'objet sélectionné
        setInputValue(getOptionLabel(option)); // Met à jour immédiatement le texte du champ
        setIsOpen(false); // Ferme le menu
    };

    const handleInputChange = (e) => {
        const newInputValue = e.target.value;
        setInputValue(newInputValue);
        openDropdown();

        const exactMatch = options.find(opt => getOptionLabel(opt).toLowerCase() === newInputValue.toLowerCase());
        if (exactMatch) {
            onChange(exactMatch);
        } else {
            onChange(newInputValue);
        }
    };

    const dropdownContent = isOpen ? ReactDOM.createPortal(
        <ul ref={dropdownRef} style={dropdownStyle} className="z-50 bg-white border rounded-md max-h-60 overflow-y-auto shadow-lg">
            {filteredOptions.length > 0 ? (
                filteredOptions.map(option => (
                    <li
                        key={getOptionKey(option)}
                        onClick={() => handleSelect(option)}
                        className="p-2 hover:bg-blue-100 cursor-pointer text-sm"
                    >
                        {getOptionLabel(option)}
                    </li>
                ))
            ) : (
                <li className="p-2 text-sm text-gray-500">Aucun ingrédient trouvé</li>
            )}
        </ul>,
        document.body
    ) : null;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="flex items-center">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={openDropdown}
                    className="w-full p-1 border rounded"
                    placeholder="Saisir ou sélectionner..."
                />
                <button type="button" onClick={() => isOpen ? setIsOpen(false) : openDropdown()} className="absolute right-1 p-1">
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {dropdownContent}
        </div>
    );
};

// Palette hissée hors du composant : une constante recréée à chaque rendu invaliderait la
// mémoïsation de postColorMap ci-dessous à chaque fois.
const GANTT_POST_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-pink-500', 'bg-amber-500', 'bg-teal-500'];

export const GanttChart = ({ productionSteps }) => {
    // Les hooks doivent s'exécuter dans le même ordre à chaque rendu : on ne peut pas les
    // placer après un retour anticipé (sinon React plante dès qu'on passe de 0 à 1 étape).
    // On retombe donc sur un tableau vide plutôt que de sortir avant les hooks. Mémoïsé pour
    // que les useMemo ci-dessous ne recalculent pas à chaque rendu quand productionSteps est
    // vide (sinon `[]` recrée une référence différente à chaque fois).
    const steps = useMemo(() => productionSteps || [], [productionSteps]);

    // Calculate total duration for the timeline
    const totalDuration = useMemo(() => {
        if (steps.length === 0) return 1;
        return Math.max(1, ...steps.map(step => parseLocaleNumber(step.startTime) + parseLocaleNumber(step.duration)));
    }, [steps]);

    // Color mapping for posts
    const postColorMap = useMemo(() => {
        const postNames = new Set(steps.flatMap(step => (step.personnel || []).map(p => p.postId)));
        const uniquePosts = Array.from(postNames);
        return uniquePosts.reduce((acc, post, index) => {
            acc[post] = GANTT_POST_COLORS[index % GANTT_POST_COLORS.length];
            return acc;
        }, {});
    }, [steps]);

    // The core layout logic to handle overlapping tasks
    const layoutData = useMemo(() => {
        const postsData = {};
        const allPosts = Object.keys(postColorMap);

        allPosts.forEach(post => {
            // 1. Get all individual tasks for this post
            // An "étape" with 2 cooks becomes 2 separate tasks for the chart
            const tasks = steps.flatMap(step =>
                (step.personnel || [])
                .filter(p => p.postId === post)
                .map(() => ({ // Create one task per person
                    name: step.stepName,
                    start: parseLocaleNumber(step.startTime),
                    duration: parseLocaleNumber(step.duration),
                    end: parseLocaleNumber(step.startTime) + parseLocaleNumber(step.duration),
                    id: step.stepId
                }))
            ).sort((a, b) => a.start - b.start);

            // 2. Assign tasks to vertical "tracks" to avoid visual overlap
            const tracks = []; // Each track will store the end time of the last task on it
            const laidOutTasks = tasks.map(task => {
                let assignedTrack = -1;
                // Find the first available track
                for (let i = 0; i < tracks.length; i++) {
                    if (task.start >= tracks[i]) {
                        assignedTrack = i;
                        break;
                    }
                }
                // If no track is free, create a new one
                if (assignedTrack === -1) {
                    assignedTrack = tracks.length;
                    tracks.push(0);
                }
                // Place the task and update the track's end time
                tracks[assignedTrack] = task.end;
                return { ...task, track: assignedTrack };
            });

            postsData[post] = {
                tasks: laidOutTasks,
                trackCount: tracks.length // The number of tracks determines the row height
            };
        });
        return postsData;
    }, [steps, postColorMap]);

    if (steps.length === 0) {
        return (
            <div className="text-center p-4 bg-gray-50 rounded-md text-sm text-gray-500">
                Ajoutez des étapes de production pour visualiser le diagramme de Gantt.
            </div>
        );
    }

    // Time intervals for the X-axis (in minutes)
    const timeIntervals = [];
    const totalDurationInMinutes = Math.ceil(totalDuration / 60);
    if (totalDurationInMinutes > 0) {
        // Définir un intervalle raisonnable en minutes
        const step = totalDurationInMinutes > 120 ? 15 : (totalDurationInMinutes > 60 ? 10 : (totalDurationInMinutes > 20 ? 5 : 2));
        for (let i = 0; i <= totalDurationInMinutes; i += step) {
            timeIntervals.push(i);
        }
        // S'assure que la dernière étiquette est présente si elle n'est pas un multiple de l'intervalle
        if (timeIntervals[timeIntervals.length - 1] < totalDurationInMinutes && totalDurationInMinutes > step) {
             timeIntervals.push(totalDurationInMinutes);
        }
    }

    const BAR_HEIGHT = 24; // Corresponds to Tailwind's h-6
    const BAR_GAP = 4; // Corresponds to Tailwind's space-y-1

    return (
        <div className="p-4 border rounded-lg bg-white">
            <h3 className="text-lg font-semibold mb-4">Diagramme de production</h3>
            <div className="relative">
                {/* Axe du temps */}
                <div className="flex items-center h-6 border-b-2 border-gray-300">
                    <div className="w-28 pr-2 flex-shrink-0"></div> {/* Espace pour les noms de postes */}
                    <div className="flex-1 relative ml-2">
                        {timeIntervals.map(timeInMinutes => (
                            <div key={timeInMinutes} className="absolute text-xs text-gray-500 h-full flex flex-col items-center" style={{ left: `${(timeInMinutes * 60 / totalDuration) * 100}%` }}>
                                <span className="absolute -translate-x-1/2">{timeInMinutes}'</span>
                                <div className="h-full border-l border-gray-200 mt-6"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lignes pour chaque poste (hauteur dynamique) */}
                <div className="mt-2">
                    {Object.entries(layoutData).map(([post, data]) => {
                        // The row height is now dynamic based on the number of tracks
                        const rowHeight = data.trackCount * (BAR_HEIGHT + BAR_GAP) + BAR_GAP;
                        return (
                            <div key={post} className="flex" style={{ minHeight: `${rowHeight}px` }}>
                                <div className="w-28 text-sm font-medium text-gray-600 pr-2 text-right border-r border-gray-200 pt-2 flex-shrink-0">{post}</div>
                                <div className="flex-1 relative ml-2">
                                    {data.tasks.map((task, index) => (
                                        <div
                                            key={`${task.id}-${index}`}
                                            className={`absolute h-6 rounded-md text-white text-xs flex items-center px-2 overflow-hidden ${postColorMap[post]}`}
                                            style={{
                                                top: `${task.track * (BAR_HEIGHT + BAR_GAP) + BAR_GAP}px`,
                                                left: `${(task.start / totalDuration) * 100}%`,
                                                width: `${(task.duration / totalDuration) * 100}%`,
                                            }}
                                            title={`${task.name} (de ${(task.start / 60).toFixed(1)}' à ${(task.end / 60).toFixed(1)}')`}
                                        >
                                            <span className="truncate">{task.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

// --- NOUVEAU COMPOSANT DE SAISIE DE TEMPS (STYLE CHAMP MASQUÉ) ---
export const TimeInput = ({ totalSeconds, onChange }) => {
    const [time, setTime] = useState({ h: '00', m: '00', s: '00' });
    const hoursRef = useRef(null);
    const minutesRef = useRef(null);
    const secondsRef = useRef(null);

    // Met à jour l'affichage interne si la valeur parente change
    useEffect(() => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        setTime({
            h: String(h).padStart(2, '0'),
            m: String(m).padStart(2, '0'),
            s: String(s).padStart(2, '0'),
        });
    }, [totalSeconds]);

    // Gère la mise à jour et le déplacement du focus
    const handleChange = (e, part, nextRef) => {
        const { value } = e.target;
        // N'accepte que les chiffres et limite à 2 caractères
        if (/^\d{0,2}$/.test(value)) {
            setTime(prev => ({ ...prev, [part]: value }));
            if (value.length === 2 && nextRef) {
                nextRef.current.focus();
            }
        }
    };

    // Gère la validation en quittant le champ
    const handleBlur = () => {
        const h = Math.min(99, parseInt(time.h, 10) || 0);
        const m = Math.min(59, parseInt(time.m, 10) || 0);
        const s = Math.min(59, parseInt(time.s, 10) || 0);
        const newTotalSeconds = (h * 3600) + (m * 60) + s;
        onChange(newTotalSeconds); // Appelle la fonction parente pour sauvegarder
    };

    // Gère les touches fléchées et le retour arrière
    const handleKeyDown = (e, part, prevRef) => {
        if (e.key === 'Backspace' && e.target.value === '' && prevRef) {
            prevRef.current.focus();
        }
    };

    return (
        <div
            className="flex items-center p-1 border rounded bg-white w-24 justify-around"
            onBlur={handleBlur}
        >
            <input
                ref={hoursRef}
                type="text"
                value={time.h}
                onChange={(e) => handleChange(e, 'h', minutesRef)}
                onKeyDown={(e) => handleKeyDown(e, 'h', null)}
                className="w-7 text-center outline-none [appearance:textfield]"
                placeholder="HH"
            />
            <span className="text-gray-400">:</span>
            <input
                ref={minutesRef}
                type="text"
                value={time.m}
                onChange={(e) => handleChange(e, 'm', secondsRef)}
                onKeyDown={(e) => handleKeyDown(e, 'm', hoursRef)}
                className="w-7 text-center outline-none [appearance:textfield]"
                placeholder="MM"
            />
            <span className="text-gray-400">:</span>
            <input
                ref={secondsRef}
                type="text"
                value={time.s}
                onChange={(e) => handleChange(e, 's', null)}
                onKeyDown={(e) => handleKeyDown(e, 's', minutesRef)}
                className="w-7 text-center outline-none [appearance:textfield]"
                placeholder="SS"
            />
        </div>
    );
};

// --- MODAL DE GESTION DES ALLERGÈNES ---
export const AllergenModal = ({ isOpen, onClose, ingredientName, assignedAllergens, onUpdateAllergens }) => {
    if (!isOpen) return null;

    const handleCheckboxChange = (allergenKey, isChecked) => {
        const newAllergens = isChecked
            ? [...assignedAllergens, allergenKey]
            : assignedAllergens.filter(key => key !== allergenKey);
        onUpdateAllergens(newAllergens);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-2xl w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Gérer les allergènes pour : <span className="font-bold">{ingredientName}</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {MAJOR_ALLERGENS.map(allergen => (
                        <label key={allergen.key} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={assignedAllergens.includes(allergen.key)}
                                onChange={(e) => handleCheckboxChange(allergen.key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{allergen.name}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:text-sm"
                        onClick={onClose}
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- MODAL D'ASSIGNATION DU PERSONNEL (VERSION AMÉLIORÉE) ---
export const PersonnelModal = ({ isOpen, onClose, step, laborDatabase, onUpdatePersonnel }) => {
    if (!isOpen) return null;

    const handleCountChange = (postId, newCount) => {
        const otherPersonnel = (step.personnel || []).filter(p => p.postId !== postId);
        const newPersonnelForPost = Array.from({ length: newCount }, () => ({ postId }));
        onUpdatePersonnel([...otherPersonnel, ...newPersonnelForPost]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Assigner le personnel pour : "{step.stepName}"</h3>
                <div className="space-y-4">
                    {laborDatabase.length > 0 ? (
                        laborDatabase.map(post => {
                            const maxCount = post.employees?.length || 0;
                            // Ne pas afficher les postes sans employés définis
                            if (maxCount === 0) return null;

                            const currentCount = (step.personnel || []).filter(p => p.postId === post.postName).length;

                            return (
                                <div key={post.id} className="flex items-center justify-between py-2 border-b">
                                    <label htmlFor={`personnel-count-${post.id}`} className="block text-sm font-medium text-gray-700">
                                        {post.postName}
                                        <span className="text-xs text-gray-500 ml-2">({maxCount} disponible(s))</span>
                                    </label>
                                    <select
                                        id={`personnel-count-${post.id}`}
                                        value={currentCount}
                                        onChange={(e) => handleCountChange(post.postName, parseInt(e.target.value, 10))}
                                        className="w-24 p-2 border rounded-md border-gray-300"
                                    >
                                        {Array.from({ length: maxCount + 1 }, (_, i) => (
                                            <option key={i} value={i}>{i}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-gray-500">Veuillez d'abord définir des postes et des employés dans l'onglet "Main-d'œuvre".</p>
                    )}
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );
};

// Composant réutilisable pour une cellule de tableau qui flashe lors d'un changement de valeur
export const FlashingCell = ({ value, formatter = formatCurrency }) => {
    const isFlashing = useValueFlash(value);

    return (
        <td className={`px-2 py-2 ${isFlashing ? 'animate-flash' : ''}`}>
            <input
                type="text"
                value={formatter(value)}
                readOnly
                disabled
                className="w-full p-1 bg-gray-50 border-0 rounded text-right"
            />
        </td>
    );
};

export const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full">
                <div className="flex items-center">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 ml-4" id="modal-title">
                        {title}
                    </h3>
                </div>
                <div className="mt-2">
                    <p className="text-sm text-gray-500">
                        {children}
                    </p>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onConfirm}
                    >
                        Confirmer
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
