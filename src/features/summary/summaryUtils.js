// Style d'une cellule de marge, partagé par le Par SKU et le résumé de segment. Extrait de SummaryTable.jsx le 24/11 (audit).


// Même palette que getMarginStyle (table "Vue d'ensemble"), réutilisée ici pour une cellule isolée.
export const getMarginCellStyle = (marginPercent) => {
    if (!isFinite(marginPercent)) return { backgroundColor: 'white', color: 'black' };
    const absMargin = Math.abs(marginPercent);
    const intensity = Math.min(absMargin / 0.8, 1) * 0.85 + 0.15;
    const textColor = intensity > 0.6 ? 'white' : 'black';
    if (marginPercent > 0) return { backgroundColor: `rgba(22, 163, 74, ${intensity})`, color: textColor };
    if (marginPercent < 0) return { backgroundColor: `rgba(220, 38, 38, ${intensity})`, color: textColor };
    return { backgroundColor: 'white', color: 'black' };
};
