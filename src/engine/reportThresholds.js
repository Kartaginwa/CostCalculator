// Seuils des rapports (refonte de Rapport et suivi, 21/11) : UN SEUL fichier, pour qu'un seuil se change à un seul endroit et se valide avec
// l'utilisateur. Le lot 3 (constats clés) y ajoutera les siens. Les valeurs sont des fractions (0,4 = 40 %).
export const REPORT_THRESHOLDS = {
    // Un fournisseur à cette part des achats (ou plus) est signalé comme une dépendance (rapport d'achats, Ingrédients et Emballages).
    providerDependency: 0.4,
};
