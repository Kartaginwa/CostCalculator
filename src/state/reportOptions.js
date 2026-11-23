// Options d'export du rapport PDF, enregistrées AVEC LE PROJET (phase 6 de la refonte de l'export, 22/11) : dans `uiSettings.reportOptions`, comme le scénario de
// la simulation de chocs. Poids négligeable : un titre, un destinataire, huit indicateurs de chapitre, au plus un commentaire de 1 000 caractères par chapitre,
// et la case des salaires individuels. Un projet qui n'a jamais exporté, ou un fichier modifié à la main, retombe toujours sur des valeurs sûres (normalizeReportOptions).

export const REPORT_CHAPTER_IDS = ['1', '2', '3', '4', '5', '6', '7', 'A'];
/** Chapitres qui acceptent un commentaire de la direction (les annexes n'en ont pas). */
export const COMMENTABLE_CHAPTER_IDS = ['1', '2', '3', '4', '5', '6', '7'];
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 150;

export const defaultReportOptions = () => ({
    title: '',            // vide : le rapport utilise son titre d'origine
    presentedTo: '',      // vide : « Préparé à l'attention des gestionnaires de <entreprise> »
    chapters: [...REPORT_CHAPTER_IDS],
    comments: {},         // { [identifiant de chapitre]: texte } ; un chapitre sans commentaire n'a pas de clé
    includeSalaries: false, // décoché par défaut : un rapport transmis à un banquier ne doit pas contenir les salaires sans que l'entrepreneur l'ait voulu
});

const asText = (v, max) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').slice(0, max) : '');

/** Valide et complète des options lues d'un fichier ou d'une fenêtre : jamais d'exception, jamais de valeur inattendue. */
export function normalizeReportOptions(raw) {
    const base = defaultReportOptions();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
    const chapters = Array.isArray(raw.chapters) ? REPORT_CHAPTER_IDS.filter(id => raw.chapters.map(String).includes(id)) : base.chapters;
    const comments = {};
    if (raw.comments && typeof raw.comments === 'object' && !Array.isArray(raw.comments)) {
        for (const id of COMMENTABLE_CHAPTER_IDS) {
            const text = asText(raw.comments[id], MAX_COMMENT_LENGTH);
            if (text.trim()) comments[id] = text;
        }
    }
    return {
        title: asText(raw.title, MAX_TITLE_LENGTH),
        presentedTo: asText(raw.presentedTo, MAX_TITLE_LENGTH),
        chapters,
        comments,
        includeSalaries: raw.includeSalaries === true,
    };
}
