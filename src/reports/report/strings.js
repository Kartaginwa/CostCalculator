// Textes fixes du rapport PDF, centralisés (phase 4 de la refonte de l'export, 22/11) : un changement de vocabulaire (main-d'œuvre, frais fixes, CICI…)
// se fait ici, à un seul endroit. Aucun texte d'IA : ce sont des libellés et des gabarits fixes.

export const CHAPTERS = [
    { id: '1', n: '1', title: 'Synthèse de direction', question: 'Où en est l’entreprise : rentabilité, solidité, direction ?', tab: 'Vue d’ensemble' },
    { id: '2', n: '2', title: 'Résultats : prévu, réel et tendance', question: 'Combien gagne-t-on vraiment, et dans quelle direction va-t-on ?', tab: 'Vue d’ensemble · Simulation' },
    { id: '3', n: '3', title: 'Produits : où l’argent se fait et se perd', question: 'Quels produits protéger, corriger ou abandonner ?', tab: 'Portefeuille · Par SKU' },
    { id: '4', n: '4', title: 'Canaux et activités', question: 'Quels canaux de vente et quelles lignes de production paient les frais fixes ?', tab: 'Par canal · Par activité' },
    { id: '5', n: '5', title: 'Approvisionnement', question: 'Où achète-t-on, à quel prix, avec quels risques ?', tab: 'Ingrédients · Emballages' },
    { id: '6', n: '6', title: 'Main-d’œuvre', question: 'L’équipe est-elle bien utilisée, et que rapporte une heure ?', tab: 'Main-d’œuvre' },
    { id: '7', n: '7', title: 'Fiches produits', question: 'Quel est le détail d’un produit, canal par canal ?', tab: 'Par SKU · Recette et calcul' },
    { id: 'A', n: 'A', title: 'Annexes et méthodes', question: 'Les listes de référence et la façon dont les chiffres sont calculés.', tab: 'Ingrédients · Emballages · Main-d’œuvre' },
];

export const COVER = {
    title: 'Rapport d’analyse du coût de revient',
    // « présenté à » saisi à l'export, sinon la formule d'origine (adressée aux gestionnaires de l'entreprise)
    presentedTo: (who) => `Préparé à l’attention de ${who}`,
    defaultLine: (company) => `Préparé à l’attention des gestionnaires de ${company}`,
};

// Classe stratégique (matrice : popularité × marge) : clé du moteur → [classe CSS, libellé, consigne du quadrant, texte du constat du produit].
export const CLASSES = {
    stars: { css: 'star', label: 'Étoile', plural: 'Étoiles', hint: 'Très populaires et très rentables. Mettez-les en avant !' },
    questions: { css: 'que', label: 'Dilemme', plural: 'Dilemmes', hint: 'Rentables mais peu populaires. Envisagez de les promouvoir.' },
    cows: { css: 'cow', label: 'Vache à lait', plural: 'Vaches à lait', hint: 'Très populaires mais peu rentables. Optimisez leurs coûts.' },
    dogs: { css: 'dog', label: 'Poids mort', plural: 'Poids morts', hint: 'Peu populaires et peu rentables. Pensez à les retirer.' },
};

// Groupes d'affichage des constats : [identifiant du groupe, titre, libellé des forces, libellé des faiblesses]
export const FINDING_GROUP_LABELS = [
    ['objectif', 'Objectifs stratégiques', 'Objectifs atteints', 'Objectifs à atteindre'],
    ['evolution', 'Amélioration / détérioration', 'Améliorations', 'Détériorations'],
    ['structure', 'Forces et faiblesses', 'Forces', 'Faiblesses'],
];

export const LABELS = {
    noFinding: 'Aucun constat pour l’instant.',
    noRealData: 'Saisissez vos chiffres réels dans l’État des résultats pour comparer le modèle à la réalité.',
    reading: 'Ce que cela veut dire',
    readingNote: 'texte produit par des règles, à partir de vos chiffres',
    comment: 'Commentaire de la direction',
    statusFinished: 'Produit fini', statusResale: 'Produit de revente', statusSub: 'Sous-recette',
    noAllergen: 'Aucun',
};

// Pastilles d'indicateur : cible respectée ou non
export const TARGET = { above: '▲ Au-dessus de la cible', below: '▼ Sous la cible' };
