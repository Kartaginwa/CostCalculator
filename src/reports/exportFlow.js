// Déroulement de l'export du rapport PDF, hors composant (phase 6 de la refonte de l'export, 22/11) : préparation du modèle à l'ouverture de la fenêtre, puis composition,
// impression et enregistrement. Les modules du rapport sont chargés à la demande (ils ne pèsent pas sur le démarrage de l'application).
import { saveReportPdf, suggestedReportName, toDataUrl } from './exportPdf.js';

/** Construit le modèle de données du rapport (chapitres disponibles, période…) ; lève une erreur si le projet est inutilisable. */
export async function prepareReportModel(inputs) {
    const { buildReportModel } = await import('./report/model.js');
    return buildReportModel(inputs);
}

/**
 * Compose le rapport, l'imprime et l'enregistre. Ne lève jamais d'exception.
 * @returns {Promise<{ status: 'saved' | 'canceled' | 'browser-print' | 'error', path?: string, message?: string }>}
 */
export async function runReportExport({ model, options, companyName, logoUrl, appLogoUrl }) {
    try {
        // La fenêtre d'impression n'a aucun accès au réseau : les logos sont intégrés au rapport.
        const [{ buildReport }, companyLogo, appLogo] = await Promise.all([import('./report/buildReport.js'), toDataUrl(logoUrl), toDataUrl(appLogoUrl)]);
        const result = await buildReport({ model: { ...model, company: { ...model.company, logo: companyLogo } } }, { ...options, appLogo, generatedOn: new Date() });
        return await saveReportPdf(result.html, suggestedReportName(companyName));
    } catch (error) {
        console.error('Erreur de génération du rapport:', error);
        return { status: 'error', message: 'La génération du rapport a échoué.' };
    }
}
