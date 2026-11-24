// Écrivain du classeur Excel : transforme le modèle de l'export (model.js) en classeur. Aucune donnée n'est calculée ici : seulement la mise en forme
// (en-têtes colorés, formats de nombres, largeurs, filtres automatiques). La bibliothèque est passée en paramètre (window.XLSX dans l'application,
// xlsx-js-style dans les tests) : c'est la variante « xlsx-js-style » de SheetJS, qui écrit les styles que la bibliothèque d'origine ignorait.

// En-têtes : bleu = valeur saisie, gris = valeur calculée, ardoise = feuille d'accompagnement.
export const HEADER_FILL = { in: '2563EB', calc: '6B7280', meta: '374151' };
const NUMBER_FORMATS = { usd: '"$"#,##0.00', pct: '0.0%', int: '#,##0', num: '#,##0.00' };

const headerStyle = (kind) => ({
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: HEADER_FILL[kind] || HEADER_FILL.meta } },
    alignment: { vertical: 'center' },
});

const columnWidth = (col, rows) => {
    let w = col.label.length + 3;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
        const v = rows[i][col.k];
        if (v == null || v === '') continue;
        w = Math.max(w, typeof v === 'number' ? 14 : String(v).length + 1);
    }
    return Math.min(Math.max(w, 10), col.fmt === 'text' && col.kind === 'meta' ? 90 : 48);
};

export function buildWorkbook(XLSX, model) {
    const wb = XLSX.utils.book_new();
    for (const sh of model.sheets) {
        const aoa = [sh.cols.map(c => ({ v: c.label, t: 's', s: headerStyle(c.kind) }))];
        for (const r of sh.rows) {
            aoa.push(sh.cols.map(c => {
                const v = r[c.k];
                if (v == null || v === '') return null; // donnée absente : cellule vide, jamais 0
                if (typeof v === 'number') return Number.isFinite(v) ? { t: 'n', v, z: NUMBER_FORMATS[c.fmt] } : null;
                return { t: 's', v: String(v) };
            }));
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = sh.cols.map(c => ({ wch: columnWidth(c, sh.rows) }));
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(sh.rows.length, 1), c: sh.cols.length - 1 } }) };
        XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    return wb;
}
