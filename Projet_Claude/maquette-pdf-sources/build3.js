const fs = require('fs');
const sp = process.argv[2];
const rd = (f) => JSON.parse(fs.readFileSync(sp + f, 'utf8'));
const d1 = rd('dump.json'), d2 = rd('dump2.json'), d3 = rd('dump3.json'), d4 = rd('dump4.json'), d5 = rd('dump5.json'), d6 = rd('dump6.json'), d7 = rd('dump7.json'), d8 = rd('dump8.json'), d9 = rd('dump9.json'), d10 = rd('dump10.json'), gl = rd('gloss.json');
Object.keys(d9.out).forEach(n => d9.out[n].series.forEach((s, i) => { if (s) s.pkg = d10.out[n][i]; }));
const GL = ["Amplitude","Analyse ABC","Constat clé","Contribution totale","Coût d'achat requis","Coût de production","Coût réel d'une heure productive","Dépendance (fournisseur)","Maillon","Marge brute","Marge de croissance","Marge de sécurité","Marge nette","Matrice stratégique (matrice BCG)","Moyenne pondérée","Paie non utilisée","Palier de volatilité","PDS (prix de détail suggéré)","Perte stock","Point de référence","Point mort (seuil de rentabilité)","Popularité","Prix net","Réconciliation","Réel","Taux d'utilisation","Théorique","Volatilité"];
const r6 = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
const DATA = r6({
  company: d1.company, kpis: d1.kpis, contribution: d1.contribution, bcg: d1.bcg,
  abc: { A: d1.abc.A, nB: d1.abc.B, nC: d1.abc.C },
  purchasing: { net: d1.purchasing.totalNet, loss: d1.purchasing.totalLoss, total: d1.purchasing.totalPurchase },
  productivity: d1.productivity,
  tracking: d2.kpis.map(k => ({ n: k.n.replace('Relevé ', ''), gm: k.gm * 100, mc: k.mc * 100, lc: k.lc * 100, pk: d10.glob[d2.kpis.indexOf(k)] })),
  chiliTrack: d2.chiliTrack.map(x => x && { cost: x.cost, net: x.net * 100 }),
  prices: d2.priceHistory, products: d1.products, channels: d1.channelSummaries, activities: d1.activitySummaries,
  ingShares: d1.ingredientShares, pkgShares: d1.packagingShares, cascade: d1.cascade, recon: d1.reconciliation, vol: d1.volatility,
  findings: d1.findings.map(x => ({ ...x, detail: x.detail.replace(/Environ 8[s  ]000/, "Environ 6 500").replace("108 $", "87 $").replace("(moyenne : 108 $)", "(moyenne : 87 $)") })), hourRows: d3.rows, matrix: d3.m, ingr: d3.ingr.map(i => ({ ...i, cls: d4.cls[i.n] })), pk: d4.pk.map(p => ({ ...p, cls: d6.cls[p.n] })), labor: d4.labor,
  fiches: d5,
  trends: d8,
  pxtra: d9.out,
  method: d9.method,
  supply: { ing: { net: d6.ing.purchase, loss: d6.ing.loss, total: d6.ing.total, items: d7.ing.items, abc: d7.ing.abc }, pkg: { net: d6.pkg.purchase, loss: d6.pkg.loss, total: d6.pkg.total, items: d7.pkg.items, abc: d7.pkg.abc }, volIng: d7.volIng, volPkg: d7.volPkg },
  gloss: gl,
});
let t = fs.readFileSync(sp + 'template.html', 'utf8');
const a = t.indexOf('/* =========================== PAGE 1 : COUVERTURE');
let pre = t.slice(0, a);
const rep = (x, y) => { if (!pre.includes(x)) { console.log('MISSING', x.slice(0, 60)); return; } pre = pre.split(x).join(y); };
rep('const TOTAL = 29;', 'const TOTAL = 32;');
rep('Où en est l’entreprise, et que faire en premier ?', 'Où en est l’entreprise : rentabilité, solidité, direction ?');
rep(`const PAGE_OF = { "Vue d'ensemble": 5, 'Simulation': 6, 'Portefeuille': 7, 'Par SKU': 8, 'Par Canal': 9, 'Par Activité': 9, 'Ingrédients': 10, 'Emballages': 11, "Main-d'œuvre": 12 };`, `const PAGE_OF = { "Vue d'ensemble": 6, 'Simulation': 7, 'Portefeuille': 8, 'Par SKU': 9, 'Par Canal': 10, 'Par Activité': 10, 'Ingrédients': 11, 'Emballages': 12, "Main-d'œuvre": 13 };`);
[['p: 3, tab: "Vue d’ensemble"', 'p: 3, tab: "Vue d’ensemble"'], ['p: 5, tab', 'p: 6, tab'], ['p: 7, tab', 'p: 8, tab'], ['p: 9, tab', 'p: 10, tab'], ['p: 10, tab', 'p: 11, tab'], ['p: 12, tab', 'p: 13, tab'], ['p: 14, tab', 'p: 15, tab'], ['p: 27, tab', 'p: 27, tab']].reverse().forEach(([x, y]) => rep(x, y));
rep("tab: 'Recette et calcul · Par SKU'", "tab: 'Par SKU · Recette et calcul'");
// ordre: remplacements en cascade évités par inversion ci-dessus
rep("const tags = { new: ['new', 'Nouveau'], rich: ['rich', 'Enrichi'], old: ['old', 'Repris du PDF actuel'] }[tag] || ['old', ''];", '');
rep('<aside class="note"><span class="pill ${tags[0]}">${tags[1]}</span>${note}</aside>', '<aside class="note">${note}</aside>');
rep('D.products.forEach((p, i) => FP[p.name] = 15 + i);', '');
rep('function sheet(n, { c, chapLabel, body, note, tag, full, dense }) {', 'function sheet(n, { c, chapLabel, body, note, tag, full, dense, footTxt }) {');
rep('${foot(n, C ? \'Chap. \' + C.n : \'\')}', '${footTxt ? `<div class="pfoot"><span>Rapport généré le 21 novembre 2026</span><span>${footTxt}</span><span>${C ? \'Chap. \' + C.n : \'\'}</span></div>` : foot(n, C ? \'Chap. \' + C.n : \'\')}');
rep('<a href="#p14">Fiches</a><a href="#p22">Exemple de fiche</a>', '<a href="#p21">Fiches</a>');
rep('<a href="#p27">Annexes</a>', '<a href="#p27">Annexes</a>');
const css = `.prov{margin:4px 0 0;padding:0;list-style:none}.prov li{margin:6px 0}.prov .pill{font-size:10px}
.cf{display:grid;grid-template-columns:1fr 1fr;gap:2mm}.cfi{border-left:1mm solid;border-radius:0 1.4mm 1.4mm 0;padding:1.6mm 2.6mm;font-size:7.8pt;line-height:1.3}.cfi b{display:block}.cfi span{color:var(--secondary)}
.cfi.f{background:#ECFDF5;border-color:#10B981}.cfi.w{background:#FEF2F2;border-color:#EF4444}.cfi.n{background:#F3F4F6;border-color:#9CA3AF}
.cmt{margin-top:4mm;border:.3mm dashed #9CA3AF;border-radius:2mm;padding:2.4mm 3.4mm;font-size:8pt;color:var(--secondary)}.cmt i{color:var(--gray);font-size:7.4pt}.cmt .ln{border-bottom:.2mm solid #D1D5DB;height:5mm}
.tiles4{display:grid;gap:2.4mm}
.pbody.dense .fcol li{font-size:7.3pt;margin-bottom:.9mm}.pbody.dense .fcol li b{font-size:7.5pt}
table.bs{width:100%;border-collapse:collapse;font-size:7.8pt;border:.25mm solid var(--line)}
table.bs thead th{background:#F3F4F6;text-align:right;padding:1.3mm 2mm;font-size:8pt}table.bs thead th:first-child{text-align:left;font-size:7.2pt;color:var(--gray)}
table.bs th.sec{background:#F3F4F6;text-align:left;font-style:italic;font-size:7pt;color:#6B7280;padding:1mm 2mm}
table.bs tbody th{text-align:left;font-weight:500;color:#4B5563;padding:.6mm 2mm;border-top:.2mm solid #F3F4F6}
table.bs td{text-align:right;padding:.6mm 2mm;border-top:.2mm solid #F3F4F6;color:#4B5563}
table.bs td.b{font-weight:700}table.bs td.ind{color:#4338CA}
table.bs tr.emph th,table.bs tr.emph td{background:#EEF2FF}
.rc{border:.25mm solid var(--line);border-radius:2mm;padding:2mm 2.6mm;margin-bottom:2.2mm}.rch{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.2mm;font-size:8pt}.rcg{display:grid;grid-template-columns:1.2fr 1fr 1.1fr;gap:2.4mm}.rcg td:not(.l){white-space:nowrap}.pbody.dense .fiche-head{margin-bottom:1.4mm}.pbody.dense h3.s{margin:2.6mm 0 1.4mm}
/* marque : touche de vert (couleur des marges de l'application et du logo) */
:root{--brand-green:#16A34A}
.toc .n{color:var(--brand-green)}
.phead::after{content:"";position:absolute;left:0;bottom:-.35mm;width:34mm;height:.9mm;background:var(--brand-green)}
.page.std::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3.2mm;background:linear-gradient(90deg,var(--primary) 0 72%,var(--brand-green) 72% 100%)}
/* mise en page */
.page.mw{position:absolute;left:-99999px;top:0;height:auto;overflow:visible;box-shadow:none}
.pbody.measure{position:static;display:flow-root;width:182mm;margin-left:14mm;height:auto;overflow:visible}
.idx{display:grid;grid-template-columns:1fr 1fr;gap:0 7mm}.idx div{display:flex;justify-content:space-between;gap:3mm;border-bottom:.2mm dotted #9CA3AF;padding:1.1mm 0;font-size:8pt}.idx b{color:var(--primary)}
.fiche-head.nx{border-top:0;padding-top:0;margin-top:0}
.note{max-height:calc(100vh - 70px);overflow:auto}.note hr{border:0;border-top:1px solid #FDE68A;margin:10px 0}
</style>`;
pre = pre.replace('</style>', css);
const pages = fs.readFileSync(sp + 'pages3.js', 'utf8');
let tail = fs.readFileSync(sp + 'tail3.js', 'utf8').split('const SHEETS = ').join('const SHEETS2 = ').split('INTRO + SHEETS.join').join('INTRO + SHEETS2.join').replace('42 pages au complet : 15 de synthèse et d’analyse, 25 de fiches (12 formats × 2 pages, plus l’index) et 3 d’annexes.', '42 pages au complet : ');
let out = pre.replace('__DATA__', () => JSON.stringify(DATA)).replace('__APP_LOGO__', () => 'data:image/png;base64,' + fs.readFileSync(sp + 'app_logo.b64', 'utf8')).replace('__CO_LOGO__', () => 'data:image/png;base64,' + fs.readFileSync(sp + 'demo_logo.b64', 'utf8')) + pages + '\n' + tail;
out = out.replace('<title>Maquette du rapport PDF</title>', '<title>Maquette rapport PDF</title>');
fs.writeFileSync(sp + 'v3.html', out);
console.log('ok', out.length);
