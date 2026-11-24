// Feuille de style du rapport PDF (phase 4 de la refonte de l'export, 22/11) : palette et styles de la maquette validée (D9, D10), pile de polices de la maquette (D7).
// Le moteur de mise en page (reports/layout) fournit la géométrie de la page ; ici, tout ce qui concerne le CONTENU et le cadre d'une page.
import { layoutCss } from '../layout/index.js';

export const REPORT_CSS = `
:root{
  --primary:#2563EB; --dark:#1F2937; --secondary:#4B5563; --gray:#6B7280; --line:#E5E7EB; --soft:#F3F4F6; --softer:#F9FAFB;
  --green:#10B981; --yellow:#F59E0B; --purple:#8B5CF6; --red:#EF4444; --pink:#DB2777; --brand-green:#16A34A;
  --green-t:#047857; --red-t:#B91C1C; --amber-t:#B45309; --blue-t:#1D4ED8;
  --green-bg:#D1FAE5; --red-bg:#FEE2E2; --amber-bg:#FEF3C7; --blue-bg:#DBEAFE; --pink-bg:#FCE7F3; --purple-bg:#EDE9FE;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
.rl-page{font-family:Helvetica,Arial,"Segoe UI",sans-serif;font-size:9.4pt;line-height:1.4;color:var(--dark);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rl-measure,.rl-body{font-family:Helvetica,Arial,"Segoe UI",sans-serif;font-size:9.4pt;line-height:1.4;color:var(--dark)}
svg text{font-family:Helvetica,Arial,sans-serif}
/* cadre d'une page */
.rl-head .phead{position:absolute;left:0;right:0;top:0;height:35mm;border-bottom:.35mm solid var(--primary)}
.rl-head .phead::after{content:"";position:absolute;left:0;bottom:-.35mm;width:34mm;height:.9mm;background:var(--brand-green)}
.phead .co{position:absolute;left:0;top:11mm;font-size:19pt;font-weight:700;line-height:1}
.phead .sub{position:absolute;left:0;top:21mm;font-size:10.5pt;color:var(--gray)}
.phead .sub b{color:var(--primary);font-weight:700}
.phead img{position:absolute;right:0;top:9mm;height:21mm;max-width:60mm;object-fit:contain}
.rl-foot{font-size:7pt;color:var(--gray)}
.rl-page.std::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3.2mm;background:linear-gradient(90deg,var(--primary) 0 72%,var(--brand-green) 72% 100%)}
/* bandeau de chapitre */
.chap{background:var(--primary);color:#fff;border-radius:2mm;padding:3.4mm 5mm;display:flex;gap:5mm;align-items:center;margin-bottom:3.5mm}
.chap .num{font-size:30pt;font-weight:700;line-height:1;opacity:.95;min-width:11mm}
.chap .t{font-size:14pt;font-weight:700;line-height:1.15}
.chap .q{font-size:8.6pt;opacity:.92;margin-top:1mm}
h3.s{font-size:11pt;color:var(--primary);margin:3.5mm 0 1.8mm;font-weight:700;display:flex;justify-content:flex-start;align-items:baseline;gap:1mm}
h3.s small{font-size:7.5pt;color:var(--gray);font-weight:400;margin-left:auto}
.is-dense h3.s{margin:2.6mm 0 1.4mm}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:2.4mm}
.tile{background:var(--softer);border:.25mm solid var(--line);border-radius:2mm;padding:2.4mm 3mm;display:flex;flex-direction:column;justify-content:space-between;min-height:21mm}
.tile .l{font-size:7.6pt;color:var(--secondary)}
.tile .v{font-size:17pt;font-weight:700;line-height:1.1;margin-top:1mm}
.tile .c{font-size:7.2pt;margin-top:.8mm}
.ok{color:var(--green-t)}.bad{color:var(--red-t)}.warn{color:var(--amber-t)}.mut{color:var(--gray)}
table.tb{width:100%;border-collapse:collapse;font-size:8.3pt}
table.tb th{background:var(--secondary);color:#fff;font-weight:700;text-align:center;padding:1.3mm 1.8mm}
table.tb td:first-child{text-align:left}
table.tb td{padding:var(--pad,1.7mm) 1.8mm;border-bottom:.2mm solid var(--line);text-align:right}
table.tb tr:nth-child(even) td{background:var(--softer)}
table.tb tfoot td{font-weight:700;background:var(--soft)!important;border-top:.3mm solid var(--secondary)}
table.tb.green th{background:var(--green)} table.tb.yellow th{background:var(--yellow);color:var(--dark)} table.tb.pink th{background:var(--pink)} table.tb.blue th{background:var(--primary)}
table.tb td.l{text-align:left}
.is-dense table.tb{--pad:1.1mm}
.heat{font-weight:700}
.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.card{border:.25mm solid var(--line);border-radius:2mm;padding:2.6mm 3.2mm;background:#fff}
.card h4{margin:0 0 1.4mm;font-size:8.6pt}
.fcol{border-left:1mm solid;border-radius:0 1.6mm 1.6mm 0;padding:2mm 3mm}
.fcol.f{background:#ECFDF5;border-color:var(--green)} .fcol.w{background:#FEF2F2;border-color:var(--red)}
.fcol h5{margin:0 0 1mm;font-size:8.2pt}.fcol.f h5{color:var(--green-t)}.fcol.w h5{color:var(--red-t)}
.fcol ul{list-style:none;margin:0;padding:0}.fcol li{margin:0 0 1.4mm;font-size:8.2pt;line-height:1.3}
.fcol li b{display:block;font-size:7.9pt}.fcol li span{color:var(--secondary)} .fcol li i{color:var(--gray);font-style:normal;font-size:7pt}
.is-dense .fcol li{font-size:7.3pt;margin-bottom:.9mm}.is-dense .fcol li b{font-size:7.5pt}
.grpt{font-size:8.4pt;font-weight:700;color:var(--secondary);margin:2mm 0 1mm}
.hb{display:grid;grid-template-columns:50mm 1fr 20mm;gap:2mm;align-items:center;font-size:8.3pt;margin:.9mm 0}
.hb .tr{background:var(--soft);border-radius:.8mm;height:4.2mm;position:relative}
.hb .fi{position:absolute;left:0;top:0;bottom:0;border-radius:0 1mm 1mm 0}
.hb .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb .vl{text-align:right;font-weight:700}
.stack{display:flex;height:7mm;border-radius:1.4mm;overflow:hidden;gap:.5mm}
.stack div{display:flex;align-items:center;justify-content:center;color:#fff;font-size:7pt;font-weight:700;white-space:nowrap}
.legend{display:flex;flex-wrap:wrap;gap:1mm 4mm;font-size:7.3pt;color:var(--secondary);margin-top:1.4mm}
.legend i{display:inline-block;width:2.6mm;height:2.6mm;border-radius:.5mm;margin-right:1.2mm;vertical-align:-.4mm}
.mx{display:grid;grid-template-columns:7mm 1fr 1fr;grid-template-rows:auto 1fr 1fr 6mm;gap:1.6mm;min-height:88mm}
.mx .q{border-radius:2mm;padding:2.4mm 3mm;border:.3mm solid}
.mx .q h4{margin:0;font-size:9.5pt}.mx .q small{display:block;font-size:7.2pt;color:var(--secondary);margin:.4mm 0 1.2mm}
.mx .q ul{margin:0;padding-left:3.6mm;font-size:7.7pt}
.mx .ax{font-size:7.2pt;color:var(--gray);display:flex;align-items:center;justify-content:center}
.mx .axy{writing-mode:vertical-rl;transform:rotate(180deg)}
.q.star{background:#DBEFFF;border-color:#93C5FD}.q.que{background:#FEF3E2;border-color:#FDE047}.q.cow{background:#F3F4F6;border-color:#D1D5DB}.q.dog{background:#FEE2E2;border-color:#FCA5A5}
.mt{display:grid;gap:1.2mm;font-size:7.6pt}
.mt .h{font-weight:700;color:var(--secondary);padding:1mm}.mt .c{border-radius:1.4mm;padding:1.4mm 2mm;text-align:center}
.mt .c small{display:block;font-weight:400;font-size:7pt}
.src{font-size:6.8pt;color:var(--gray);margin-top:1.4mm}
.fiche-head{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;margin-bottom:2.6mm}
.is-dense .fiche-head{margin-bottom:1.4mm}
.badge{display:inline-block;padding:.6mm 2.4mm;border-radius:99px;font-size:7.6pt;font-weight:700}
.badge.cow{background:#E5E7EB;color:#374151}.badge.star{background:#DBEFFF;color:#1E40AF}.badge.que{background:#FEF3E2;color:#92400E}.badge.dog{background:#FEE2E2;color:#991B1B}
.toc{list-style:none;margin:0;padding:0}
.toc li{display:grid;grid-template-columns:9mm 1fr 10mm;gap:2mm;align-items:baseline;padding:2mm 0;border-bottom:.2mm dotted #9CA3AF}
.toc .n{font-size:16pt;font-weight:700;color:var(--brand-green)}
.toc .t{font-size:10.5pt;font-weight:700}.toc .q{font-size:7.8pt;color:var(--gray)}.toc .p{text-align:right;font-weight:700;color:var(--primary);font-size:10.5pt}
.toc .tab{display:inline-block;font-size:6.8pt;background:var(--soft);border-radius:1mm;padding:0 1.4mm;margin-left:1.4mm;color:var(--secondary)}
.cover .frame{position:absolute;left:10mm;top:10mm;right:10mm;bottom:10mm;border:.5mm solid var(--gray)}
.cf{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
.cfi{border-left:1mm solid;border-radius:0 1.4mm 1.4mm 0;padding:1.6mm 2.6mm;font-size:7.8pt;line-height:1.3}.cfi b{display:block}.cfi span{color:var(--secondary)}
.cfi.f{background:#ECFDF5;border-color:#10B981}.cfi.w{background:#FEF2F2;border-color:#EF4444}.cfi.n{background:#F3F4F6;border-color:#9CA3AF}
.cmt{margin-top:4mm;border:.3mm solid #9CA3AF;border-radius:2mm;padding:2.4mm 3.4mm;font-size:8pt;color:var(--secondary)}.cmt p{margin:1.4mm 0 0;color:var(--dark);white-space:pre-wrap}
.tiles4{display:grid;gap:2.4mm}
table.bs{width:100%;border-collapse:collapse;font-size:7.8pt;border:.25mm solid var(--line)}
table.bs thead th{background:#F3F4F6;text-align:center;padding:1.3mm 2mm;font-size:8pt}table.bs thead th:first-child{text-align:center;font-size:7.2pt;color:var(--gray)}
table.bs th.sec{background:#F3F4F6;text-align:left;font-style:italic;font-size:7pt;color:#6B7280;padding:1mm 2mm}
table.bs tbody th{text-align:left;font-weight:500;color:#4B5563;padding:.6mm 2mm;border-top:.2mm solid #F3F4F6}
table.bs td{text-align:right;padding:.6mm 2mm;border-top:.2mm solid #F3F4F6;color:#4B5563}
table.bs td.b{font-weight:700}table.bs td.ind{color:#4338CA}
table.bs tr.emph th,table.bs tr.emph td{background:#EEF2FF}
.rc{border:.25mm solid var(--line);border-radius:2mm;padding:2mm 2.6mm;margin-bottom:2.2mm}
.rcg{display:grid;grid-template-columns:1.2fr 1fr 1.1fr;gap:2.4mm}.rcg td:not(.l){white-space:nowrap}
.idx{display:grid;grid-template-columns:1fr 1fr;gap:0 7mm}.idx div{display:flex;justify-content:space-between;gap:3mm;border-bottom:.2mm dotted #9CA3AF;padding:1.1mm 0;font-size:8pt}.idx b{color:var(--primary)}
.fiche-head.nx{border-top:0;padding-top:0;margin-top:0}
` + layoutCss();
