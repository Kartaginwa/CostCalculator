// Géométrie de la page du rapport (A4) et feuille de style du MOTEUR DE MISE EN PAGE (phase 3 de la refonte de l'export PDF, 22/11).
// Le moteur ne connaît aucun contenu : il découpe des blocs en pages d'une hauteur fixe. Les styles du contenu (tableaux, tuiles, graphiques)
// sont ceux des gabarits du rapport (phase 4) ; ils doivent être présents dans le document pendant la mesure, polices comprises.

export const PAGE = {
    widthMm: 210, heightMm: 297,
    marginXMm: 14,   // marges gauche et droite du corps
    topMm: 40,       // réservé à l'en-tête
    bottomMm: 14,    // réservé au pied de page
    footBottomMm: 5.5,
};

export const bodyWidthMm = (g = PAGE) => g.widthMm - 2 * g.marginXMm;
export const bodyHeightMm = (g = PAGE) => g.heightMm - g.topMm - g.bottomMm;

/** Feuille de style de la page et de la mesure. `.rl-body` (la page) et `.rl-measure` (la mesure) donnent la MÊME largeur et le même contexte de mise en forme. */
export const layoutCss = (g = PAGE) => `
@page{size:A4;margin:0}
.rl-sheet{margin:0 auto;break-after:page;page-break-after:always}
.rl-sheet:last-child{break-after:auto;page-break-after:auto}
.rl-page{width:${g.widthMm}mm;height:${g.heightMm}mm;position:relative;overflow:hidden;background:#fff}
.rl-head{position:absolute;left:${g.marginXMm}mm;right:${g.marginXMm}mm;top:0;height:${g.topMm}mm}
.rl-body{position:absolute;left:${g.marginXMm}mm;right:${g.marginXMm}mm;top:${g.topMm}mm;bottom:${g.bottomMm}mm;overflow:hidden}
.rl-foot{position:absolute;left:${g.marginXMm}mm;right:${g.marginXMm}mm;bottom:${g.footBottomMm}mm;display:flex;justify-content:space-between}
.rl-measure-host{position:absolute;left:-99999px;top:0}
.rl-body.rl-measure{position:static;display:flow-root;width:${bodyWidthMm(g)}mm;margin-left:${g.marginXMm}mm;height:auto;overflow:visible}
.rl-suite{font-weight:400;opacity:.6}
`;
