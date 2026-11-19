// Export PDF du guide d'utilisation et d'apprentissage (Phase 7).
// Fonction « données → document » : lit la structure du guide (src/components/guide/content) et
// la met en page avec jsPDF (fourni en global, comme pour le rapport d'analyse). Le guide du PDF
// est donc TOUJOURS identique à celui de la fenêtre : un seul contenu, deux rendus.
import { frTypo } from '../components/guide/guideFormat.js';

const MM = 0.3528; // 1 pt en mm
const PAGE = { w: 210, h: 297, left: 18, right: 18, top: 20, bottom: 20 };
const WIDTH = PAGE.w - PAGE.left - PAGE.right;
const COLORS = {
    text: [31, 41, 55], muted: [107, 114, 128], link: [29, 78, 216], rule: [209, 213, 219],
    retenir: { bar: [59, 130, 246], fill: [239, 246, 255], head: [30, 64, 175] },
    exemple: { bar: [34, 197, 94], fill: [240, 253, 244], head: [22, 101, 52] },
    attention: { bar: [245, 158, 11], fill: [255, 251, 235], head: [146, 64, 14] },
    astuce: { bar: [99, 102, 241], fill: [238, 242, 255], head: [55, 48, 163] },
    pourquoi: { bar: [168, 85, 247], fill: [250, 245, 255], head: [107, 33, 168] },
    mots: { bar: [156, 163, 175], fill: [249, 250, 251], head: [55, 65, 81] },
};
const TITLES = { retenir: 'À RETENIR', exemple: 'EXEMPLE', attention: 'ATTENTION', astuce: 'ASTUCE', pourquoi: 'POURQUOI C\'EST IMPORTANT', mots: 'LES MOTS DE CE CHAPITRE' };

// Les polices standard de PDF ne contiennent que le jeu Windows-1252 : on remplace les rares
// caractères hors de ce jeu (flèches, signe moins mathématique…) par un équivalent lisible.
const EXTRA_CODES = new Set([0x152, 0x153, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x2039, 0x203a]);
const pdfSafe = (s) => {
    const replaced = String(s)
        .replace(/→/g, '›').replace(/−/g, '-').replace(/≈/g, '~').replace(/≥/g, '>=').replace(/≤/g, '<=');
    let out = '';
    for (const ch of replaced) {
        const code = ch.codePointAt(0);
        if (code === 0x2009 || code === 0x202f) out += String.fromCharCode(0xa0); // espaces fines → insécable
        else if (code <= 0xff || EXTRA_CODES.has(code)) out += ch;
    }
    return out;
};

// Balisage du guide → suite de « fragments » stylés.
const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g;
const toRuns = (text) => frTypo(text).split(INLINE).filter(Boolean).map((part) => {
    if (part.startsWith('**')) return { t: part.slice(2, -2), style: 'bold' };
    if (part.startsWith('__')) return { t: part.slice(2, -2), style: 'italic' };
    if (part.startsWith('{{')) return { t: part.slice(2, -2), style: 'ui' };
    if (part.startsWith('[[')) { const [target, label] = part.slice(2, -2).split('|'); return { t: label || target, style: 'link', target }; }
    return { t: part, style: 'normal' };
});
const plain = (text) => toRuns(text).map((r) => r.t).join('');

export function generateGuidePdf(parts, { showNotification, appLogoBase64 = null, appLogoDimensions = { width: 1, height: 1 } } = {}) {
    if (typeof window === 'undefined' || !window.jspdf || !window.jspdf.jsPDF) {
        if (showNotification) showNotification({ message: 'La bibliothèque PDF n\'est pas chargée. Veuillez réessayer.', type: 'error' });
        return null;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageOf = {}; // ancre → numéro de page (pour le sommaire)
    let y = PAGE.top;

    const setStyle = (style, size, color) => {
        const font = style === 'bold' || style === 'ui' ? 'bold' : style === 'italic' ? 'italic' : 'normal';
        doc.setFont('helvetica', font);
        doc.setFontSize(size);
        const c = color || (style === 'link' ? COLORS.link : COLORS.text);
        doc.setTextColor(c[0], c[1], c[2]);
    };
    // jsPDF ne connaît pas la largeur de « œ » (il en ignore la mesure) : on mesure « oe », très proche.
    const widthOf = (t, style, size) => { setStyle(style, size); return doc.getTextWidth(pdfSafe(t).replace(/œ/g, 'oe').replace(/Œ/g, 'OE')); };
    const newPage = () => { doc.addPage(); y = PAGE.top; };
    const ensure = (h) => { if (y + h > PAGE.h - PAGE.bottom) newPage(); };
    const mark = (id) => { if (id) pageOf[id] = doc.getNumberOfPages(); };

    // --- paragraphe : découpe en lignes avec styles mélangés ----------------------------------------
    const NB = String.fromCharCode(0xa0);
    const layout = (runs, width, size, firstIndent = 0) => {
        // 1. mots stylés. Une espace ordinaire permet de couper la ligne ; une espace insécable colle le
        //    mot au précédent (« prix : » reste ensemble). Les insécables sont mesurées et dessinées comme
        //    des espaces ordinaires (la police PDF mesure mal le caractère insécable).
        const tokens = [];
        let pendingSpace = false;
        runs.forEach((r) => {
            pdfSafe(r.t).split(' ').forEach((word, i) => {
                if (i > 0) pendingSpace = true;
                if (word === '') return;
                word.split(NB).forEach((sub, k) => {
                    if (sub === '') return;
                    tokens.push({ w: sub, style: r.style, spaceBefore: k === 0 && pendingSpace && tokens.length > 0, nb: k > 0 });
                });
                pendingSpace = false;
            });
        });
        // 2. paquets insécables, puis remplissage des lignes
        const space = widthOf(' ', 'normal', size);
        const chunks = [];
        tokens.forEach((tk) => {
            tk.wlen = widthOf(tk.w, tk.style, size);
            if (tk.nb && chunks.length) chunks[chunks.length - 1].push(tk); else chunks.push([tk]);
        });
        const lines = []; let line = []; let x = firstIndent;
        chunks.forEach((chunk) => {
            const chunkW = chunk.reduce((acc, tk, i) => acc + tk.wlen + (i > 0 ? space : 0), 0);
            const gap = line.length && chunk[0].spaceBefore ? space : 0;
            if (line.length && x + gap + chunkW > width) { lines.push(line); line = []; x = 0; }
            let cx = x + (line.length && chunk[0].spaceBefore ? space : 0);
            chunk.forEach((tk, i) => {
                if (i > 0) cx += space;
                line.push({ w: tk.w, style: tk.style, x: cx });
                cx += tk.wlen;
            });
            x = cx;
        });
        if (line.length) lines.push(line);
        return lines;
    };
    const lineH = (size) => size * MM * 1.42;

    // dry = true : on calcule seulement la hauteur, sans dessiner ni changer de page.
    const paragraph = (text, { x = PAGE.left, width = WIDTH, size = 10, dry = false, indentFirst = 0, hanging = null, color = null, space = 2.4, bold = false } = {}) => {
        const runs = toRuns(text);
        if (bold) runs.forEach((r) => { if (r.style === 'normal') r.style = 'bold'; });
        const lines = layout(runs, width, size, indentFirst);
        const h = lines.length * lineH(size);
        if (dry) return h + space;
        lines.forEach((ln, i) => {
            ensure(lineH(size));
            ln.forEach((tk) => {
                setStyle(tk.style, size, color);
                doc.text(tk.w, x + tk.x, y + size * MM * 0.95);
            });
            y += lineH(size);
        });
        y += space;
        return h + space;
    };

    const bullet = (marker, runsText, { x, width, size = 10, dry = false }) => {
        const indent = 6;
        if (!dry) { ensure(lineH(size)); setStyle('normal', size); doc.text(marker, x, y + size * MM * 0.95); }
        return paragraph(runsText, { x: x + indent, width: width - indent, size, dry, space: 1.4 });
    };
    const itemText = (item) => (typeof item === 'string' ? item : `**${item.label}** ${item.text}`);

    // --- tableaux (autoTable) -------------------------------------------------------------------------
    const table = (block, { x = PAGE.left, width = WIDTH } = {}) => {
        if (block.caption) paragraph(block.caption, { x, width, size: 9, bold: true, space: 1 });
        const body = block.rows.map((row) => row.map((c) => pdfSafe(plain(String(c)))));
        const head = [block.head.map((h) => pdfSafe(plain(h)))];
        const numeric = !block.wrapCells;
        doc.autoTable({
            head, body, startY: y, margin: { left: x, right: PAGE.w - x - width, top: PAGE.top, bottom: PAGE.bottom },
            styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 1.8, textColor: COLORS.text, lineColor: COLORS.rule, lineWidth: 0.1, overflow: 'linebreak' },
            headStyles: { fillColor: [243, 244, 246], textColor: COLORS.text, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: numeric ? Object.fromEntries(block.head.map((_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])) : {},
            didParseCell: (data) => { if (block.boldLast && data.section === 'body' && data.row.index === body.length - 1) data.cell.styles.fontStyle = 'bold'; },
            didDrawPage: () => {},
            theme: 'grid',
            // les lignes ancrées (rowIds) servent au sommaire : on ne suit pas leur page, elles n'y figurent pas
        });
        y = doc.lastAutoTable.finalY + 4;
    };

    // --- encadrés ---------------------------------------------------------------------------------------
    const hasTable = (blocks) => (blocks || []).some((b) => b.type === 'table' || (b.type === 'callout' && hasTable(b.blocks)));
    const renderBlocks = (blocks, opts) => {
        const { x = PAGE.left, width = WIDTH, dry = false } = opts || {};
        let total = 0;
        (blocks || []).forEach((b) => { total += renderBlock(b, { x, width, dry }); });
        return total;
    };
    const callout = (block, { x, width, dry }) => {
        const c = COLORS[block.kind] || COLORS.retenir;
        const title = block.title || TITLES[block.kind] || '';
        const pad = 3.2; const barW = 1.1;
        const inner = { x: x + barW + pad, width: width - barW - pad * 2 };
        const children = block.blocks || (block.text ? [{ type: 'p', text: block.text }] : []);
        const measure = () => 4.2 + renderBlocks(children, { ...inner, dry: true }) + pad * 2 - 1.6;
        if (dry) return measure() + 3;
        const boxable = !hasTable(children);
        if (boxable) {
            const h = measure();
            if (h < PAGE.h - PAGE.top - PAGE.bottom - 5) {
                ensure(h + 3);
                doc.setFillColor(...c.fill); doc.rect(x, y, width, h, 'F');
                doc.setFillColor(...c.bar); doc.rect(x, y, barW, h, 'F');
                const top = y; y += pad;
                doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...c.head);
                doc.text(pdfSafe(title), inner.x, y + 2.4); y += 4.2;
                renderBlocks(children, { ...inner, dry: false });
                y = top + h + 3;
                return h + 3;
            }
        }
        // encadré trop long ou contenant un tableau : titre coloré + contenu, filet à gauche sur la première page
        ensure(14);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...c.head);
        doc.text(pdfSafe(title), x, y + 2.4); y += 4.4;
        const start = y; const startPage = doc.getNumberOfPages();
        renderBlocks(children, { x: x + 3, width: width - 3, dry: false });
        if (doc.getNumberOfPages() === startPage) { doc.setFillColor(...c.bar); doc.rect(x, start - 0.6, 0.9, y - start + 0.6, 'F'); }
        y += 1.5;
        return 0;
    };

    function renderBlock(b, ctx) {
        const { x, width, dry } = ctx;
        switch (b.type) {
            case 'p': return paragraph(b.text, { x, width, dry });
            case 'h': {
                const size = b.level === 5 ? 10.5 : 13;
                const before = b.level === 5 ? 3 : 7;
                if (dry) return before + paragraph(b.text, { x, width, size, dry: true, bold: true, space: 1.6 });
                ensure(before + lineH(size) * 2 + 10);
                if (b.id) mark(b.id);
                y += before;
                paragraph(b.text, { x, width, size, bold: true, space: 1.6, color: [17, 24, 39] });
                return 0;
            }
            case 'ul': case 'ol': case 'steps': {
                let h = 0;
                b.items.forEach((it, i) => {
                    const marker = b.type === 'ul' ? '•' : `${i + 1}.`;
                    h += bullet(pdfSafe(marker), itemText(it), { x: x + 1, width: width - 1, dry });
                });
                return h + (dry ? 1.2 : 0);
            }
            case 'table': {
                if (dry) return 30;
                table(b, { x, width });
                return 0;
            }
            case 'callout': return callout(b, { x, width, dry });
            case 'words': {
                const text = b.items.map((w) => `**${w.term} :** ${w.def}`);
                return callout({ kind: 'mots', title: b.title, blocks: text.map((t) => ({ type: 'p', text: t })) }, { x, width, dry });
            }
            case 'dl': {
                let h = 0;
                b.items.forEach((w) => {
                    if (!dry) { ensure(lineH(10) * 2.5); if (w.id) mark(w.id); }
                    h += paragraph(`**${w.term}**`, { x, width, dry, space: 0.4 });
                    h += paragraph(w.def, { x: x + 4, width: width - 4, dry, size: 9.5, space: 2.6, color: [55, 65, 81] });
                });
                return h;
            }
            default: return 0;
        }
    }

    // --- page de couverture : même présentation que la page de garde du rapport d'analyse -------------------------
    // (cadre, logo de l'application centré, titre, sous-titre, date) — voir generatePdf.js.
    doc.setDrawColor(...COLORS.muted); doc.setLineWidth(0.5);
    doc.rect(10, 10, PAGE.w - 20, PAGE.h - 20);
    let logoY = 80;
    if (appLogoBase64 && appLogoDimensions.width > 0) {
        const maxWidth = 120; const maxHeight = 120;
        const ratio = appLogoDimensions.width / appLogoDimensions.height;
        let lw = maxWidth; let lh = maxWidth / ratio;
        if (lh > maxHeight) { lh = maxHeight; lw = maxHeight * ratio; }
        try {
            doc.addImage(appLogoBase64, 'PNG', (PAGE.w - lw) / 2, logoY, lw, lh);
            logoY += lh;
        } catch (e) { console.error("Erreur d'image du logo pour le PDF du guide:", e); logoY = 130; }
    } else {
        doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55);
        doc.text('TransfoCalculateur', PAGE.w / 2, 115, { align: 'center' });
        logoY = 130;
    }
    doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55);
    doc.text(doc.splitTextToSize(pdfSafe("Guide d'utilisation et d'apprentissage"), PAGE.w - 80), PAGE.w / 2, logoY + 30, { align: 'center' });
    doc.setFontSize(18); doc.setFont('helvetica', 'normal'); doc.setTextColor(75, 85, 99);
    doc.text(doc.splitTextToSize(pdfSafe("Comprendre le coût de revient et utiliser l'application"), PAGE.w - 80), PAGE.w / 2, 205, { align: 'center' });
    doc.setFontSize(12); doc.setTextColor(...COLORS.muted);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-CA', { dateStyle: 'long' })}`, PAGE.w / 2, PAGE.h - 30, { align: 'center' });

    // --- sommaire : page 2, rempli à la fin (on connaît alors les numéros de page) ---------------------------
    doc.addPage();
    const tocPage = doc.getNumberOfPages();

    // --- contenu ---------------------------------------------------------------------------------------------
    parts.forEach((part) => {
        newPage();
        mark(part.id);
        doc.setFillColor(243, 244, 246); doc.rect(0, 0, PAGE.w, 34, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(17, 24, 39);
        const tl = doc.splitTextToSize(pdfSafe(part.title), WIDTH);
        doc.text(tl, PAGE.left, 20);
        y = 44;
        if (part.lead) paragraph(part.lead, { size: 10.5, color: COLORS.muted, space: 6 });
        part.chapters.forEach((chapter, ci) => {
            if (ci > 0) ensure(60);
            mark(chapter.id);
            y += ci > 0 ? 6 : 0;
            paragraph(chapter.title, { size: 15, bold: true, color: [17, 24, 39], space: 1 });
            doc.setDrawColor(...COLORS.rule); doc.line(PAGE.left, y, PAGE.w - PAGE.right, y); y += 3;
            if (chapter.lead) paragraph(chapter.lead, { size: 10, color: COLORS.muted, space: 3 });
            renderBlocks(chapter.blocks, { x: PAGE.left, width: WIDTH, dry: false });
        });
    });

    // --- sommaire (liens cliquables) -----------------------------------------------------------------------------
    doc.setPage(tocPage);
    let ty = PAGE.top;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(17, 24, 39);
    doc.text('Table des matières', PAGE.left, ty + 4); ty += 14;
    parts.forEach((part) => {
        const partTitle = pdfSafe(part.title);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(17, 24, 39);
        ty += 2;
        doc.text(partTitle, PAGE.left, ty);
        doc.text(String(pageOf[part.id] || ''), PAGE.w - PAGE.right, ty, { align: 'right' });
        doc.link(PAGE.left, ty - 4, WIDTH, 5, { pageNumber: pageOf[part.id] || tocPage });
        ty += 5.4;
        part.chapters.forEach((chapter) => {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); doc.setTextColor(...COLORS.text);
            const label = doc.splitTextToSize(pdfSafe(chapter.title), WIDTH - 22)[0];
            doc.text(label, PAGE.left + 5, ty);
            doc.text(String(pageOf[chapter.id] || ''), PAGE.w - PAGE.right, ty, { align: 'right' });
            doc.link(PAGE.left + 5, ty - 3.6, WIDTH - 5, 4.6, { pageNumber: pageOf[chapter.id] || tocPage });
            ty += 4.5;
        });
    });

    // --- pieds de page ---------------------------------------------------------------------------------------------------
    const total = doc.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(...COLORS.rule); doc.line(PAGE.left, PAGE.h - 14, PAGE.w - PAGE.right, PAGE.h - 14);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.muted);
        doc.text('TransfoCalculateur — Guide d\'utilisation et d\'apprentissage', PAGE.left, PAGE.h - 9);
        doc.text(`Page ${i - 1} sur ${total - 1}`, PAGE.w - PAGE.right, PAGE.h - 9, { align: 'right' });
    }
    doc.setProperties({ title: 'TransfoCalculateur — Guide d\'utilisation et d\'apprentissage', subject: 'Coût de revient', creator: 'TransfoCalculateur' });
    doc.save('Guide_utilisation_TransfoCalculateur.pdf');
    return doc;
}
