// Export Excel « base de données » (refonte du 23/11) : un classeur de tables à plat (une feuille par type d'objet, une ligne par objet, aucune cellule fusionnée),
// avec identifiants stables, dictionnaire des colonnes et feuille d'accompagnement, pour qu'une personne extérieure retravaille les données dans Excel ou
// ailleurs. Remplace l'ancien export-résumé, qui recalculait lui-même des coûts de ligne. Le contenu vient du modèle (excel/model.js, qui ne lit que les
// moteurs de l'application) ; la mise en forme, de excel/workbook.js. XLSX est fourni en global (xlsx-js-style, voir scripts/copy-libs).
import { buildExcelModel } from './excel/model.js';
import { buildWorkbook } from './excel/workbook.js';

export const exportToExcel = (deps) => {
    const { showNotification, analysisData, calculatedGeneralInfo, companyName, project } = deps;
    // window.XLSX (et non la variable bare XLSX) : même convention défensive que CatalogImportWizardModal.jsx/SalesReportImportWizardModal.jsx pour cette même
    // bibliothèque globale. `typeof window` d'abord : ce module est aussi importé par les tests (environnement Node, sans `window`).
    const XLSX = typeof window !== 'undefined' ? window.XLSX : undefined;
    if (typeof XLSX === 'undefined') {
        showNotification({ message: "La bibliothèque Excel (XLSX) n'a pas pu être chargée. L'exportation est impossible.", type: 'error' });
        return;
    }
    try {
        const model = buildExcelModel({ project: { ...project, companyName }, analysisData, calculatedGeneralInfo });
        const wb = buildWorkbook(XLSX, model);
        XLSX.writeFile(wb, `base_de_donnees_${(companyName || '').replace(/\s/g, '_') || 'sans_nom'}.xlsx`);
        showNotification({ message: 'Base de données Excel exportée avec succès !', type: 'success' });
    } catch (error) {
        console.error('Erreur Excel:', error);
        // Message d'erreur inclus dans la notification (pas seulement la console, pas toujours accessible en production) pour que ce type de panne reste
        // diagnosticable sans avoir à reproduire l'environnement exact (ex. Electron packagé).
        showNotification({ message: `Une erreur est survenue lors de l'exportation Excel\u00A0: ${error.message}`, type: 'error' });
    }
};
