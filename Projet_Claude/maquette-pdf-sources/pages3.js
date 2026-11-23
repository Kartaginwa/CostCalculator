/* ============ Moteur de mise en page : le contenu coule d'une page à l'autre ============ */
const PILL = { rule: ['new', 'Texte par règle (à développer)'], app: ['rich', 'Écran de l’application'], calc: ['new', 'Calcul simple'], pdf: ['old', 'Repris du PDF actuel'], doc: ['rich', 'Glossaire du guide'] };
const prov = (items) => '<h5>Provenance</h5><ul class="prov">' + items.map(([k, t]) => `<li><span class="pill ${PILL[k][0]}">${PILL[k][1]}</span> ${t}</li>`).join('') + '</ul>';
const mcell = (m) => { if (m == null || !isFinite(m) || m === 0) return 'background:#fff;color:#000'; const a = Math.min(Math.abs(m) / 0.8, 1) * 0.85 + 0.15; const tc = a > 0.6 ? '#fff' : '#000'; return m > 0 ? `background:rgba(22,163,74,${a});color:${tc}` : `background:rgba(220,38,38,${a});color:${tc}`; };
const mt = (r, d = 2) => f(r * 100, d) + NBSP + '%';
const FI = Object.fromEntries(D.fiches.map(x => [x.name, x]));
const T = D.tracking, lab = T.map(t => { const [m, y] = t.n.split(' '); return m.slice(0, 4) + (m.length > 4 ? '.' : '') + ' ' + y.slice(2); });
const cm = D.kpis.weightedMaterialCost, cp = D.kpis.weightedPackagingCost, cl = D.kpis.weightedLaborCost;
const baseName = (n) => n.replace(/\s*\([^)]*\)\s*$/, '');
const fmtName = (n) => (n.match(/\(([^)]*)\)\s*$/) || [])[1];
const HAVG = 87.39;

const PM = { seg: {}, chap: {}, total: 0 };               // carte des pages (remplie à chaque passe)
const SEG_OF = { "Vue d'ensemble": 'resultats', 'Simulation': 'tendance', 'Portefeuille': 'portefeuille', 'Par SKU': 'skutable', 'Par Canal': 'canaux', 'Par Activité': 'canaux', 'Ingrédients': 'ingr', 'Emballages': 'emb', "Main-d'œuvre": 'mo1' };
const pgOf = (link) => PM.seg[SEG_OF[link]] || 0;
const pgFiche = (name) => PM.seg['fiche:' + name] || 0;
let CH_SEGS = {}, NOTES = {};
const seg = (c, key, html, note, pb) => { (CH_SEGS[c] = CH_SEGS[c] || []).push(`<div class="nmark" data-k="${key}"${pb ? ' data-pb="1"' : ''}></div>` + html); NOTES[key] = note; };

const cfind = (pred, max = 4) => {
  const L = D.findings.filter(pred).slice(0, max);
  if (!L.length) return '';
  return `<h3 class="s">Constats clés liés à ce chapitre <small>textes de l’application</small></h3><div class="cf">${L.map(x => `<div class="cfi ${x.tone === 'force' ? 'f' : 'w'}"><b>${x.tone === 'force' ? 'Force' : 'Faiblesse'} · ${esc(x.title)}</b><span>${esc(x.detail)}</span></div>`).join('')}</div>`;
};
const byLabel = (...labels) => (x) => labels.includes(x.link);
// Un commentaire n'est imprimé que si l'entrepreneur l'a saisi dans la fenêtre d'export : sans commentaire, aucune case, aucun espace.
const commentBox = () => '';
const commentExample = () => `<div class="cmt"><b>Commentaire de la direction</b> <i>exemple : texte saisi par l’entrepreneur à l’export ; absent si rien n’est saisi</i><p style="margin:1.4mm 0 0;color:var(--dark)">« Le creux d’août suit la hausse du prix du bœuf. Nous renégocions le contrat avec la Boucherie Nordique d’ici la fin de l’année. »</p></div>`;
const reading = (items) => items.length ? '<div class="card" style="margin-top:3mm;background:var(--softer)"><h4>Ce que cela veut dire <span class="mut" style="font-weight:400;font-size:7pt">texte produit par des règles, à partir de vos chiffres</span></h4><ul style="margin:0;padding-left:4mm">' + items.map(s => '<li>' + s + '</li>').join('') + '</ul></div>' : '';

/* ---- pagination ---- */
let MW, MB, AVAIL;
function initMeasure() {
  MW = document.createElement('div'); MW.className = 'page mw'; MB = document.createElement('div'); MB.className = 'pbody measure'; MW.appendChild(MB);
  const probe = document.createElement('div'); probe.style.height = '243mm'; MW.appendChild(probe); document.body.appendChild(MW);
  AVAIL = probe.getBoundingClientRect().height; MW.removeChild(probe);
}
const H = () => MB.getBoundingClientRect().height;
const fits = () => H() <= AVAIL + 0.5;
const isKn = (n) => n.dataset && n.dataset.kn === '1';
function prep(nodes) {
  nodes.forEach((n, i) => {
    if (n.matches('h3.s, .grpt, .fiche-head, .nmark, .stack')) n.dataset.kn = '1';
    if (n.matches('.hb') && nodes[i + 1] && nodes[i + 1].matches('.hb')) n.dataset.kn = '1';
  });
}
const clip = (el) => el.cloneNode(true);
function contHeads(pre) {
  const out = [];
  pre.forEach(n => {
    if (n.matches('h3.s')) { const c = clip(n); c.querySelectorAll('small').forEach(s => s.remove()); c.querySelectorAll('span.mut').forEach(s => { if (/suite/.test(s.textContent)) s.remove(); }); c.insertAdjacentHTML('beforeend', ' <span class="mut" style="font-weight:400">(suite)</span>'); c.dataset.kn = '1'; out.push(c); }
    else if (n.matches('.grpt')) { const c = clip(n); c.querySelectorAll('span.mut').forEach(s => { if (/suite/.test(s.textContent)) s.remove(); }); c.insertAdjacentHTML('beforeend', ' <span class="mut" style="font-weight:400">(suite)</span>'); c.dataset.kn = '1'; out.push(c); }
  });
  return out;
}
const isTable = (n) => n.tagName === 'TABLE' && n.tBodies.length;
const isCf = (n) => n.classList && n.classList.contains('cf');
const isCols = (n) => n.classList && n.classList.contains('two') && n.querySelector(':scope > .fcol');
const splittable = (n) => (isTable(n) && n.tBodies[0].rows.length > 2) || (isCf(n) && n.children.length > 2) || isCols(n);

function tableBuild(n, k) {
  const rows = [...n.tBodies[0].rows], a = clip(n), b = clip(n);
  a.tBodies[0].replaceChildren(...rows.slice(0, k).map(clip)); if (a.tFoot) a.tFoot.remove();
  b.tBodies[0].replaceChildren(...rows.slice(k).map(clip));
  return [a, b];
}
function colsBuild(n, ca, cb) {
  const cols = [...n.querySelectorAll(':scope > .fcol')], mk = (counts, from) => { const c = clip(n); [...c.querySelectorAll(':scope > .fcol')].forEach((col, i) => { const lis = [...cols[i].querySelectorAll('li')]; const ul = col.querySelector('ul'); const sel = from ? lis.slice(counts[i]) : lis.slice(0, counts[i]); ul.replaceChildren(...sel.map(clip)); }); return c; };
  const pcs2 = mk([ca, cb], false), rest = mk([ca, cb], true); [...rest.querySelectorAll(':scope > .fcol')].forEach(c => { if (!c.querySelector('li')) c.remove(); }); if (rest.querySelectorAll(':scope > .fcol').length === 1) rest.style.gridTemplateColumns = '1fr'; return [pcs2, rest];
}
function trySplit(pre, last) {
  pre.forEach(p => { MB.appendChild(clip(p)); });
  const undo = () => { for (let i = 0; i < pre.length; i++) MB.removeChild(MB.lastChild); };
  let best = null;
  const test = (piece) => { MB.appendChild(piece); const ok = fits(); MB.removeChild(piece); return ok; };
  if (isTable(last)) {
    const rows = [...last.tBodies[0].rows], bs = last.classList.contains('bs'), n = rows.length;
    for (let k = n - 1; k >= (bs ? 1 : 2); k--) {
      if (bs && !rows[k].querySelector('th.sec')) continue;
      const [a, b] = tableBuild(last, k); if (test(a)) { best = { piece: a, rest: b }; break; }
    }
  } else if (isCf(last)) {
    const items = [...last.children];
    for (let k = items.length - 1; k >= 2; k--) { const a = clip(last), b = clip(last); a.replaceChildren(...items.slice(0, k).map(clip)); b.replaceChildren(...items.slice(k).map(clip)); if (test(a)) { best = { piece: a, rest: b }; break; } }
  } else if (isCols(last)) {
    const cols = [...last.querySelectorAll(':scope > .fcol')], tot = cols.map(c => c.querySelectorAll('li').length);
    let ca = 0, cb = 0, okAny = false;
    while (ca < tot[0] || cb < tot[1]) {
      const [pa] = colsBuild(last, ca, cb); MB.appendChild(pa); const cs = [...pa.querySelectorAll(':scope > .fcol')].map(c => c.getBoundingClientRect().height); MB.removeChild(pa);
      const order = (cs[0] <= cs[1] ? [0, 1] : [1, 0]); let moved = false;
      for (const c of order) {
        if ((c === 0 ? ca : cb) >= tot[c]) continue;
        const na = ca + (c === 0 ? 1 : 0), nb = cb + (c === 1 ? 1 : 0), [p] = colsBuild(last, na, nb);
        if (test(p)) { ca = na; cb = nb; moved = true; break; }
      }
      if (!moved) break; okAny = true;
    }
    if (okAny && (ca < tot[0] || cb < tot[1]) && ca + cb > 0) { const [a, b] = colsBuild(last, ca, cb); best = { piece: a, rest: b }; }
  }
  undo();
  return best;
}
function paginateChapter(nodes, dense) {
  prep(nodes);
  MB.className = 'pbody measure' + (dense ? ' dense' : ''); MB.innerHTML = '';
  const pages = []; let cur = [], guard = 0; const Q = [...nodes];
  const append = (arr) => arr.forEach(n => { const c = clip(n); MB.appendChild(c); cur.push(c); });
  const drop = (k) => { for (let i = 0; i < k; i++) { MB.removeChild(MB.lastChild); cur.pop(); } };
  const newPage = () => { pages.push(cur); cur = []; MB.innerHTML = ''; };
  while (Q.length && guard++ < 6000) {
    let cnt = 0; while (cnt < Q.length - 1 && isKn(Q[cnt])) cnt++; cnt++; cnt = Math.min(cnt, Q.length);
    const group = Q.slice(0, cnt), last = group[group.length - 1], pre = group.slice(0, -1);
    if (group[0].dataset && group[0].dataset.pb === '1' && cur.length) { newPage(); continue; }
    append(group);
    if (fits()) { Q.splice(0, cnt); continue; }
    drop(group.length);
    if (splittable(last)) {
      const r = trySplit(pre, last);
      if (r) { append(pre); cur.push(r.piece); MB.appendChild(r.piece); Q.splice(0, cnt); Q.unshift(...contHeads(pre), r.rest); newPage(); continue; }
    }
    if (cur.length) { newPage(); continue; }
    append(group); Q.splice(0, cnt); newPage();
  }
  if (cur.length) pages.push(cur);
  return pages;
}

const CHAP_LABEL = (c) => c === 'A' ? '<b>Annexes</b>' : `<b>Chapitre ${c}</b> · ${CHAPS.find(x => x.n === c).t}`;
function pageHTML(n, c, nodes, dense, notes) {
  const html = nodes.map(x => x.outerHTML).join('');
  return `<section class="sheet" id="p${n}"><div class="page std">${head(CHAP_LABEL(c))}<div class="pbody ${dense ? 'dense' : ''}">${html}</div><div class="pfoot"><span>Rapport généré le 21 novembre 2026</span><span>Page ${n} sur ${PM.total || '…'}</span><span>${c === 'A' ? 'Annexes' : 'Chap. ' + c}</span></div></div><aside class="note">${notes}</aside></section>`;
}
const NOTE_SUITE = '<h5>Suite</h5><p>Suite de la section précédente : le contenu coule d’une page à l’autre, sans saut de page ni vide. Seul le début d’un chapitre commence une nouvelle page.</p>';

/* ============ Contenu ============ */
function defineContent() {
  CH_SEGS = {}; NOTES = {};
  const tot = sum(CH, c => c.revenueTotal);
  const FG = [['objectif', 'Objectifs stratégiques', 'Objectifs atteints', 'Objectifs à atteindre'], ['evolution', 'Amélioration / détérioration', 'Améliorations', 'Détériorations'], ['structure', 'Forces et faiblesses', 'Forces', 'Faiblesses']];
  const fl = (g, tone) => D.findings.filter(x => x.group === g && x.tone === tone);
  const fli = x => `<li><b>${esc(x.title)}</b><span>${esc(x.detail)}</span> <i>→ p. ${pgOf(x.link)}</i></li>`;
  const none = '<li class="mut">Aucun constat pour l’instant.</li>';
  const fblock = ([g, label, a, b]) => `<div class="grpt">${label} <span class="mut" style="font-weight:400">· ${fl(g, 'force').length} + ${fl(g, 'faiblesse').length} constats</span></div><div class="two" style="gap:2.4mm"><div class="fcol f"><h5>${a}</h5><ul>${fl(g, 'force').map(fli).join('') || none}</ul></div><div class="fcol w"><h5>${b}</h5><ul>${fl(g, 'faiblesse').map(fli).join('') || none}</ul></div></div>`;

  /* ---------- Chapitre 1 ---------- */
  const oneDollar = [['Matières', mat, 'var(--green)'], ['Emballage', pkg, 'var(--pink)'], ['Main-d’œuvre', mo, 'var(--yellow)'], ['Sous-traitance', st, '#9CA3AF'], ['Frais fixes', fixed + aging, 'var(--purple)'], ['Bénéfice net', net, 'var(--primary)']];
  seg(1, 'synth', `
   <h3 class="s" style="margin-top:0">Indicateurs clés de rentabilité <small>moyennes pondérées par le mix de ventes</small></h3>
   <div class="tiles">
    <div class="tile"><div class="l">Coût matière</div><div><div class="v">${pc(cm, 2)}</div><div class="c bad">▲ Au-dessus de la cible (32 %)</div></div></div>
    <div class="tile"><div class="l">Coût d’emballage</div><div><div class="v">${pc(cp, 2)}</div><div class="c ok">▼ Sous la cible (8 %)</div></div></div>
    <div class="tile"><div class="l">Coût de main-d’œuvre</div><div><div class="v">${pc(cl, 2)}</div><div class="c ok">▼ Sous la cible (22 %)</div></div></div>
    <div class="tile"><div class="l">Marge brute</div><div><div class="v">${pc(D.kpis.weightedGrossMargin, 2)}</div><div class="c mut">moyenne pondérée</div></div></div>
    <div class="tile"><div class="l">Point mort</div><div><div class="v">${usd(BE)}</div><div class="c mut">ventes prévues : ${usd(REV)}</div></div></div>
    <div class="tile"><div class="l">Marge de sécurité</div><div><div class="v">${pc(SAFE, 2)}</div><div class="c mut">(ventes prévues − point mort) ÷ ventes prévues</div></div></div>
   </div>
   <h3 class="s">Sur chaque dollar de vente, où va l’argent ? <small>ventes prévues : ${usd(REV)}</small></h3>
   <div class="stack">${oneDollar.map(([n, v, c]) => `<div style="flex:${v};background:${c}">${v / REV > 0.06 ? f(v / REV * 100, 0) + ' ¢' : ''}</div>`).join('')}</div>
   <div class="legend">${oneDollar.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n} ${f(v / REV * 100, 1)} ¢</span>`).join('')}</div>
   <h3 class="s">Évolution de la marge brute <small>19 points de référence</small></h3>
   ${lineChart({ h: 120, labels: lab, series: [{ name: 'Marge brute', color: '#2563EB', vals: T.map(t => t.gm), endLabel: f(T[18].gm, 1) + ' %' }], ymin: 40, ymax: 48, ystep: 4, yfmt: v => v + ' %', xEvery: 3 })}`,
   `<h5>Pourquoi cette page</h5><p>Les six tuiles de la Vue d’ensemble avec leur repère (cible ou seuil), puis deux lectures graphiques. Aucun texte interprétatif : les constats suivent immédiatement.</p>${prov([['app', 'les six tuiles « Indicateurs clés de rentabilité » ; l’évolution de la marge brute'], ['calc', '« Sur chaque dollar de vente » : chaque poste divisé par les ventes prévues'], ['pdf', 'les KPI pondérés étaient déjà exportés, en tableau texte']])}`);
  seg(1, 'constats', `<h3 class="s">Constats clés</h3>${fblock(FG[0])}${fblock(FG[1])}${fblock(FG[2])}${commentBox()}`,
   `<h5>Constats clés : tout est imprimé</h5><p>L’écran n’affiche que trois constats par colonne, le reste est derrière « Voir tout ». Sur papier, il n’y a pas de clic : le rapport imprime <b>tous</b> les constats, avec « → p. N » à la place du lien.</p><p>Les constats <b>commencent dès la première page du chapitre</b> et se coupent ligne par ligne d’une page à l’autre.</p>${prov([['app', 'les constats, mot pour mot (règles et seuils de l’application, même ordre)'], ['calc', 'le renvoi de page remplace le lien']])}`);

  /* ---------- Chapitre 2 ---------- */
  const wf = [{ l: 'Ventes prévues', v: REV, total: 1, color: '#2563EB' }, { l: 'Matières', v: mat, color: '#10B981' }, { l: 'Emballage', v: pkg, color: '#DB2777' }, { l: 'Main-d’œuvre', v: mo, color: '#F59E0B' }, { l: 'Sous-traitance', v: st, color: '#9CA3AF' }, { l: 'Bénéfice brut', v: gross, total: 1, color: '#1E40AF' }, { l: 'Frais fixes', v: fixed, color: '#8B5CF6' }, { l: 'Vieillis- sement', v: aging, color: '#C4B5FD' }, { l: 'Bénéfice net', v: net, total: 1, color: '#047857' }];
  const rc = D.recon.rows;
  const readRecon = (rows) => {
    const [rev, dir, , nt] = rows, s = [], TH = 0.05;
    s.push(Math.abs(rev.diffPercent) < TH ? `Les revenus réels sont alignés sur le modèle (${pcs(rev.diffPercent)}).` : `Les revenus réels sont ${rev.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(rev.diff))} (${pcs(rev.diffPercent)}).`);
    s.push(Math.abs(dir.diffPercent) >= TH ? `Les charges directes réelles sont ${dir.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(dir.diff))} (${pcs(dir.diffPercent)})${dir.diff > 0 ? ' : pertes, rendements ou prix payés plus élevés que prévu, à vérifier' : ''}.` : `Les charges directes réelles sont alignées sur le modèle (${pcs(dir.diffPercent)}).`);
    s.push(`Le bénéfice net réel (${usd(nt.real)}) est ${nt.diff > 0 ? 'au-dessus du' : 'sous le'} modèle de ${usd(Math.abs(nt.diff))} ; l’écart vient surtout ${Math.abs(rev.diff) > Math.abs(dir.diff) ? 'des revenus' : 'des charges directes'}.`);
    return s;
  };
  seg(2, 'resultats', `
   <h3 class="s" style="margin-top:0">Du revenu au bénéfice net <small>ventes prévues, période</small></h3>
   ${waterfall(wf, { w: 650, h: 250 })}
   <h3 class="s">Réconciliation réel / théorique</h3>
   <table class="tb blue"><thead><tr><th style="text-align:left">Poste</th><th>Réel</th><th>Théorique (modèle)</th><th>Écart $</th><th>Écart %</th></tr></thead><tbody>
    ${rc.map(r => `<tr><td class="l"><b>${r.label}</b></td><td>${usd(r.real)}</td><td>${usd(r.theoretical)}</td><td>${sgn(r.diff)}${NBSP}$</td><td><b>${pcs(r.diffPercent)}</b></td></tr>`).join('')}
   </tbody></table>
   <div class="src">Le bénéfice net théorique inclut ${usd(aging)} de vieillissement, absent du réel saisi.</div>
   ${reading(readRecon(rc))}
   ${cfind(x => x.id.startsWith('rec-') || x.id === 'net-theoretical', 5)}`,
   `<h5>Pourquoi cette page</h5><p>La cascade montre le modèle en une image ; la réconciliation dit si le modèle colle à vos chiffres réels. Sans chiffres réels saisis : « Saisissez vos chiffres réels », jamais des zéros.</p>${prov([['app', 'la réconciliation réel / théorique (Vue d’ensemble) et ses constats'], ['calc', 'la cascade : les totaux par canal du Rapport mis en série'], ['rule', '« Ce que cela veut dire » : trois phrases à gabarit, seuil de ± 5 % ; la liste de causes (pertes, rendements, prix) est celle du constat existant']])}`);
  const tr = (name, key) => ({ name, now: T[T.length - 1][key], q: T[T.length - 4][key], y: T[T.length - 13][key] });
  const trows = [tr('Marge brute', 'gm'), tr('Coût matière', 'mc'), tr('Coût emballage', 'pk'), tr('Coût main-d’œuvre', 'lc')];
  const readTrend = () => {
    const g = T.map(x => x.gm), hi = g.indexOf(Math.max(...g)), lo = g.indexOf(Math.min(...g)), now = g[g.length - 1], y = g[g.length - 13], s = [];
    s.push(`La marge brute a culminé à ${f(g[hi], 1)} % (${lab[hi]}) et touché son creux à ${f(g[lo], 1)} % (${lab[lo]}).`);
    if (lo < g.length - 1) s.push(`Depuis son creux, elle ${now >= g[lo] ? 'remonte' : 'recule'} de ${f(Math.abs(now - g[lo]), 1)} point.`);
    s.push(`Elle est ${f(Math.abs(now - y), 1)} point${Math.abs(now - y) >= 2 ? 's' : ''} ${now >= y ? 'au-dessus de' : 'sous'} son niveau d’il y a 12 mois.`);
    return s;
  };
  seg(2, 'tendance', `
   <h3 class="s">Évolution sur 19 points de référence <small>mai 2025 → novembre 2026</small></h3>
   ${lineChart({ labels: lab, series: [{ name: 'Marge brute', color: '#2563EB', vals: T.map(t => t.gm), endLabel: f(T[18].gm, 1) + ' %' }, { name: 'Coût matière', color: '#10B981', vals: T.map(t => t.mc), endLabel: f(T[18].mc, 1) + ' %' }, { name: 'Coût emballage', color: '#DB2777', vals: T.map(t => t.pk), endLabel: f(T[18].pk, 1) + ' %' }, { name: 'Coût main-d’œuvre', color: '#F59E0B', vals: T.map(t => t.lc), endLabel: f(T[18].lc, 1) + ' %' }], ymin: 0, ymax: 50, ystep: 10, yfmt: v => v + ' %', xEvery: 3, padR: 112, marks: [{ i: 8, s: 0, t: '46,0 % (janv. 26)' }, { i: 15, s: 0, t: '41,5 % (août 26)', below: true }] })}
   <div class="legend"><span><i style="background:#2563EB"></i>Marge brute moyenne pondérée</span><span><i style="background:#10B981"></i>Coût matière moyen pondéré</span><span><i style="background:#DB2777"></i>Coût d’emballage moyen pondéré</span><span><i style="background:#F59E0B"></i>Coût de main-d’œuvre moyen pondéré</span></div>
   <table class="tb" style="margin-top:2.4mm"><thead><tr><th style="text-align:left">Indicateur</th><th>Aujourd’hui</th><th>Il y a 3 relevés (août 26)</th><th>Il y a 12 mois (nov. 25)</th></tr></thead><tbody>
    ${trows.map(r => `<tr><td class="l"><b>${r.name}</b></td><td><b>${f(r.now, 1)} %</b></td><td>${f(r.q, 1)} % <span class="mut">(${sgn(r.now - r.q, 1)} pt)</span></td><td>${f(r.y, 1)} % <span class="mut">(${sgn(r.now - r.y, 1)} pt)</span></td></tr>`).join('')}
    <tr><td class="l"><b>Marge nette</b></td><td><b>7,9 %</b></td><td>6,3 % <span class="mut">(+1,6 pt)</span></td><td>10,1 % <span class="mut">(−2,2 pt)</span></td></tr>
   </tbody></table>
   ${reading(readTrend())}
   ${cfind(x => x.id.startsWith('history-') || x.id.startsWith('sens-'), 8)}
   ${commentExample()}`,
   `<h5>Évolution</h5><p>Le graphique existe déjà dans le PDF et à l’écran ; le tableau ajoute les deux comparaisons que l’application fait dans ses constats (3 relevés, 12 mois).</p>${prov([['app', 'le graphique, les constats « amélioration / détérioration » et de simulation (+5 %)'], ['calc', 'le tableau : valeurs lues dans les points de référence'], ['rule', '« Ce que cela veut dire » : sommet, creux et écarts, calculés sur les relevés']])}`);

  /* ---------- Chapitre 3 ---------- */
  const contrib = D.contribution, ctot = sum(contrib, x => x.total);
  const li = (arr) => arr.map(n => `<li>${esc(n)}</li>`).join('');
  seg(3, 'portefeuille', `
   <h3 class="s" style="margin-top:0">Matrice stratégique <small>popularité (part des ventes) × marge</small></h3>
   <div class="mx" style="height:88mm">
    <div class="ax axy" style="grid-row:2/4">Marge →</div>
    <div class="q que" style="grid-column:2;grid-row:2"><h4>Dilemmes</h4><small>Rentables mais peu populaires. Envisagez de les promouvoir.</small><ul>${li(D.bcg.questions)}</ul></div>
    <div class="q star" style="grid-column:3;grid-row:2"><h4>Étoiles</h4><small>Très populaires et très rentables. Mettez-les en avant !</small><ul>${li(D.bcg.stars)}</ul></div>
    <div class="q dog" style="grid-column:2;grid-row:3"><h4>Poids morts</h4><small>Peu populaires et peu rentables. Pensez à les retirer.</small><ul>${li(D.bcg.dogs)}</ul></div>
    <div class="q cow" style="grid-column:3;grid-row:3"><h4>Vaches à lait</h4><small>Très populaires mais peu rentables. Optimisez leurs coûts.</small><ul>${li(D.bcg.cows)}</ul></div>
    <div class="ax" style="grid-column:2;grid-row:4">← Popularité plus faible</div><div class="ax" style="grid-column:3;grid-row:4">Popularité plus forte →</div>
   </div>
   <h3 class="s">Classement par contribution totale au profit <small>bénéfice brut total : ${usd(ctot)}</small></h3>
   ${hbars(contrib.map(c => ({ n: c.name, v: c.total, color: D.bcg.stars.includes(c.name) ? '#2563EB' : D.bcg.dogs.includes(c.name) ? '#FCA5A5' : '#93C5FD' })), { nameW: 62, fmt: v => usd(v) + ' · ' + f(v / ctot * 100, 0) + '%' }).replace(/grid-template-columns:62mm 1fr 20mm/g, 'grid-template-columns:62mm 1fr 27mm')}
   <div class="legend"><span><i style="background:#2563EB"></i>Étoile</span><span><i style="background:#93C5FD"></i>Autre</span><span><i style="background:#FCA5A5"></i>Poids mort</span></div>
   ${cfind(byLabel('Portefeuille'), 3)}`,
   `<h5>Portefeuille</h5><p>Le PDF actuel montre la matrice en liste de quatre boîtes et limite le classement aux 5 premiers. Ici : la vraie matrice 2 × 2 avec axes nommés (comme à l’écran) et le classement complet.</p>${prov([['app', 'la matrice stratégique, le classement par contribution (complet), les consignes de chaque quadrant'], ['pdf', 'mêmes quatre quadrants et mêmes consignes']])}`);
  const badge = (F) => { const c = CLSNAME[CLS[F.name]]; return `<span class="badge ${c[0]}" style="font-size:6.4pt;white-space:nowrap">${c[1]}</span>`; };
  seg(3, 'skutable', `
   <h3 class="s">Du PDS à la marge nette, produit par produit <small>prix de vente = prix net producteur · une ligne par format</small></h3>
   <table class="tb"><thead><tr><th style="text-align:left" rowspan="2">Produit</th><th rowspan="2" style="text-align:center">Classe</th><th rowspan="2">PDS</th><th rowspan="2">Coût de prod.</th><th colspan="3" style="text-align:center">Prix de vente</th><th colspan="3" style="text-align:center">Marge nette</th><th rowspan="2">Fiche</th></tr>
   <tr>${['Directe', 'Épiceries', 'Gr. surf.', 'Directe', 'Épiceries', 'Gr. surf.'].map(h => `<th style="font-size:6.8pt">${h}</th>`).join('')}</tr></thead><tbody>
   ${D.fiches.map(F => `<tr><td class="l"><b>${esc(F.name)}</b></td><td style="text-align:center">${badge(F)}</td><td>${usd(F.pds, 2)}</td><td>${usd(F.costs.prod, 2)}</td>${F.channels.map(c => `<td>${usd(c.netPrice, 2)}</td>`).join('')}${F.channels.map(c => `<td class="heat" style="${mcell(c.netP)}">${mt(c.netP, 1)}</td>`).join('')}<td>p. ${pgFiche(F.name)}</td></tr>`).join('')}
   </tbody></table>
   <div class="src">Un produit sans PDS saisi afficherait « — » dans ses colonnes de prix, jamais un zéro.</div>
   ${cfind(byLabel('Par SKU'), 3)}`,
   `<h5>Du PDS à la marge nette</h5><p>Chaque produit est suivi du PDS jusqu’à sa marge nette dans chaque canal : on voit où il bascule en perte. Les cellules de marge ont les couleurs de l’écran.</p>${prov([['app', 'le PDS, le prix de vente par canal, la marge nette par canal (Par SKU) ; les couleurs de marge'], ['calc', 'les trois canaux côte à côte pour les 12 produits']])}<p>Ce tableau est le seul récapitulatif des produits : il porte la classe, le PDS, les prix, les marges et le renvoi à la fiche.</p>`);

  /* ---------- Chapitre 4 ---------- */
  const segRows = (rows, nameOf) => rows.map(c => { const sm = (c.revenueTotal - c.breakEvenRevenue) / c.revenueTotal; return `<tr><td class="l"><b>${esc(nameOf(c))}</b></td><td>${usd(c.revenueTotal)}</td><td>${pc(c.revenueTotal / tot, 0)}</td><td>${pc(c.margeBrutePercent)}</td><td><b>${usd(c.margeNetteTotal)}</b></td><td class="heat" style="${mcell(c.margeNettePercent)}">${pc(c.margeNettePercent)}</td><td>${usd(c.breakEvenRevenue)}</td><td>${pc(sm)}</td></tr>`; }).join('');
  const segHead = (n) => `<thead><tr><th style="text-align:left">${n}</th><th>Revenus</th><th>Part</th><th>Marge brute</th><th>Bénéfice net</th><th>Marge nette</th><th>Point mort</th><th>Marge de sécurité</th></tr></thead>`;
  const readCells = () => { const neg = []; AC.forEach(a => CH.forEach(c => { const m = D.matrix[a.activityId][c.channelId]; if (m && m.margeNetteTotal < 0) neg.push(`${a.activityName.toLowerCase()} en ${SHORT[c.channelName].toLowerCase()} (${usd(m.margeNetteTotal)})`); })); return [neg.length ? `${neg.length === 1 ? 'Une seule combinaison perd' : neg.length + ' combinaisons perdent'} de l’argent : ${neg.join(', ')}.` : 'Aucune combinaison activité × canal ne perd d’argent.']; };
  seg(4, 'canaux', `
   <h3 class="s" style="margin-top:0">Les trois canaux de vente</h3>
   <table class="tb blue">${segHead('Canal')}<tbody>${segRows(CH, c => SHORT[c.channelName])}</tbody></table>
   <h3 class="s">Les trois activités de production</h3>
   <table class="tb blue">${segHead('Activité')}<tbody>${segRows(AC, c => c.activityName)}</tbody></table>
   <h3 class="s">Marge nette par activité et par canal</h3>
   <div class="mt"><div></div>${CH.map(c => `<div class="h">${SHORT[c.channelName]}</div>`).join('')}
   ${AC.map(a => `<div class="h">${esc(a.activityName)}</div>` + CH.map(c => { const m = D.matrix[a.activityId][c.channelId]; return `<div class="c" style="${mcell(m.margeNettePercent)}"><b>${pc(m.margeNettePercent)}</b><small>${sgn(m.margeNetteTotal)}${NBSP}$</small></div>`; }).join('')).join('')}</div>
   ${reading(readCells())}
   ${cfind(byLabel('Par Canal', 'Par Activité'), 4)}
   ${commentBox()}`,
   `<h5>Canaux et activités</h5><p>Deux découpages du même chiffre d’affaires, côte à côte, avec la matrice qui les croise.</p>${prov([['app', 'les deux tableaux (Par Canal, Par Activité) et la matrice Activité × Canal'], ['calc', 'colonnes « Part » et « Marge de sécurité » : revenus ÷ total, (revenus − point mort) ÷ revenus'], ['rule', '« Ce que cela veut dire » : liste des cases en perte']])}`);

  /* ---------- Chapitre 5 : ingrédients et emballages, mêmes modules ---------- */
  const SUP = D.supply;
  const supply = (kind) => {
    const S = SUP[kind], isIng = kind === 'ing', label = isIng ? 'Ingrédients' : 'Emballages', shares = isIng ? D.ingShares : D.pkgShares;
    const vol = (isIng ? SUP.volIng : SUP.volPkg).filter(v => v.isVolatile);
    const top = [...S.items].sort((a, b) => b.loss - a.loss)[0];
    const row = (cls, bg, pctv, names) => `<tr><td style="background:${bg}"><b>${cls}</b></td><td style="white-space:nowrap">${f(pctv, 1)} %</td><td class="l">${names.map(esc).join(', ')}</td></tr>`;
    return `
   <h3 class="s" style="${isIng ? 'margin-top:0' : 'margin-top:5mm;border-top:.4mm solid var(--primary);padding-top:3mm'}">${label} <small>achats : ${usd(S.total)}</small></h3>
   <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
    <div class="tile" style="min-height:17mm"><div class="l">Coût net (${label.toLowerCase()})</div><div class="v" style="font-size:13pt">${usd(S.net)}</div></div>
    <div class="tile" style="min-height:17mm"><div class="l">Perte stock prévue</div><div><div class="v" style="font-size:13pt">${usd(S.loss)}</div><div class="c mut">${pc(S.loss / S.total)} des achats</div></div></div>
    <div class="tile" style="min-height:17mm"><div class="l">Achat requis (${label.toLowerCase()})</div><div class="v" style="font-size:13pt">${usd(S.total)}</div></div>
   </div>
   <h3 class="s">Fournisseurs <small>part des achats</small></h3>
   ${hbars(shares.rows.map(r => ({ n: r.provider, v: r.share * 100, color: r.isDependent ? '#F59E0B' : '#93C5FD', mark: 30 })), { max: isIng ? 60 : 100, nameW: 52, fmt: v => f(v, 0) + ' %' })}
   <div class="src">Repère noir : seuil de dépendance (30 % des achats).</div>
   <div class="two" style="margin-top:2mm"><div>
    <h3 class="s">Classement ABC <small>${S.abc.A.length} + ${S.abc.B.length} + ${S.abc.C.length} ${label.toLowerCase()}</small></h3>
    <table class="tb" style="font-size:7.4pt"><thead><tr><th>Classe</th><th>Valeur</th><th style="text-align:left">${label}</th></tr></thead><tbody>
     ${row('A', 'var(--red-bg)', S.abc.totals.A, S.abc.A.map(x => x[0]))}${row('B', 'var(--amber-bg)', S.abc.totals.B, S.abc.B.map(x => x[0]))}${row('C', 'var(--green-bg)', S.abc.totals.C, S.abc.C.map(x => x[0]))}</tbody></table></div>
   <div><h3 class="s">Perte stock <small>prévue, non mesurée</small></h3>
    <div class="card"><div style="font-size:15pt;font-weight:700">${usd(S.loss)}</div><div class="mut">${pc(S.loss / S.total)} des achats</div><p style="margin:1mm 0 0">La plus coûteuse : <b>${esc(top.n)}, ${usd(top.loss)}</b>.</p></div></div></div>
   <h3 class="s">Prix volatils <small>amplitude sur 19 relevés</small></h3>
   <table class="tb yellow"><thead><tr><th style="text-align:left">${label.slice(0, -1)}</th><th style="text-align:left">Fournisseur</th><th>Prix actuel</th><th>Amplitude</th><th>Tendance</th><th style="text-align:left">Volatilité</th></tr></thead><tbody>
   ${vol.length ? vol.slice(0, 5).map(v => `<tr><td class="l"><b>${esc(v.name)}</b></td><td class="l">${esc(v.provider)}</td><td>${usd(v.currentPrice, 2)}</td><td><b>${f(v.amplitudePercent, 0)} %</b></td><td>${sgn(v.trendPercent, 1)} %</td><td class="l">${v.tier === 'elevee' ? 'élevée' : 'modérée'}</td></tr>`).join('') : '<tr><td class="l" colspan="6">Aucun prix volatil.</td></tr>'}</tbody></table>
   ${cfind(byLabel(label), 5)}`;
  };
  seg(5, 'ingr', supply('ing'),
   `<h5>Ingrédients</h5><p>Le PDF actuel exporte l’ABC et trois totaux. Il omet les achats par fournisseur, la dépendance, la perte stock par ligne et les prix volatils, que l’onglet Ingrédients affiche.</p>${prov([['app', 'coût net, perte stock, achat requis, achats par fournisseur (dépendance à 30 %), ABC, prix volatils'], ['pdf', 'l’ABC et les totaux d’achats']])}`);
  seg(5, 'emb', supply('pkg') + commentBox(),
   `<h5>Emballages : mêmes modules que les ingrédients</h5><p>Le même composant de l’application alimente les deux onglets : tuiles, achats par fournisseur, ABC avec la liste de tous les éléments, perte stock, prix volatils, constats. Le rapport imprime donc les mêmes modules, dans le même ordre.</p>${prov([['app', 'les mêmes modules que les ingrédients, avec les chiffres des emballages']])}`);

  /* ---------- Chapitre 6 ---------- */
  const cs = D.cascade, prod = D.productivity;
  const readLabor = () => {
    const s = [`${pc(cs.unusedShare)} de la paie (${usd(cs.unusedPay)}) ne sert pas à produire : temps non productif et capacité inutilisée.`];
    const gap = cs.effectiveHourlyCost / cs.averageLoadedRate - 1;
    if (gap > 0.05) s.push(`Une heure productive coûte ${f(gap * 100, 0)} % de plus que le taux moyen payé (${usd(cs.effectiveHourlyCost, 2)} contre ${usd(cs.averageLoadedRate, 2)}).`);
    s.push(`${f(32.3, 1)} heures de production sont libres : environ ${usd(Math.round(32.3 * 200.79 / 100) * 100)} de ventes possibles sans embauche (estimation).`);
    return s;
  };
  seg(6, 'mo1', `
   <h3 class="s" style="margin-top:0">Rapport de productivité par poste</h3>
   <table class="tb yellow"><thead><tr><th style="text-align:left">Poste</th><th>Heures attendues</th><th>Heures réelles</th><th>Différence</th><th>Taux d’utilisation</th></tr></thead><tbody>
   ${prod.map(r => `<tr><td class="l"><b>${esc(r.postName)}</b></td><td>${f(r.expected, 2)} h</td><td>${f(r.actual, 2)} h</td><td>${f(r.difference, 2)} h</td><td><b>${f(r.utilization, 2)} %</b></td></tr>`).join('')}</tbody>
   <tfoot><tr><td class="l">Total</td><td>393,72 h</td><td>344,42 h</td><td>49,30 h</td><td>87,48 %</td></tr></tfoot></table>
   <h3 class="s">Utilisation de la masse salariale <small>${usd(cs.payroll)}</small></h3>
   <div class="stack"><div style="flex:${cs.costUsed};background:#047857">Production réelle ${pc(cs.costUsed / cs.payroll, 0)}</div><div style="flex:${cs.costIdle};background:var(--yellow);color:var(--dark)">Capacité inutilisée ${pc(cs.costIdle / cs.payroll, 0)}</div><div style="flex:${cs.costNonProductive};background:#9CA3AF">Non prod.</div></div>
   <div class="legend"><span><i style="background:#047857"></i>Production réelle : ${usd(cs.costUsed)} (${f(cs.usedHours, 1)} h)</span><span><i style="background:var(--yellow)"></i>Capacité inutilisée : ${usd(cs.costIdle)}</span><span><i style="background:#9CA3AF"></i>Temps non productif : ${usd(cs.costNonProductive)}</span></div>
   <div class="tiles" style="margin-top:2.4mm">
    <div class="tile" style="min-height:20mm"><div class="l">Paie non utilisée</div><div><div class="v">${usd(cs.unusedPay)}</div><div class="c mut">${pc(cs.unusedShare)} de la paie</div></div></div>
    <div class="tile" style="min-height:20mm"><div class="l">Coût réel d’une heure productive</div><div><div class="v">${usd(cs.effectiveHourlyCost, 2)}/h</div><div class="c mut">taux moyen payé : ${usd(cs.averageLoadedRate, 2)}/h</div></div></div>
    <div class="tile" style="min-height:20mm"><div class="l">Marge de croissance</div><div><div class="v">32,3 h</div><div class="c mut">≈ 6 500 $ de ventes (estimation)</div></div></div>
   </div>
   <div class="src">Marge de croissance : 49,3 h de différence − 17,0 h de postes sans étape de recette (le Responsable de production).</div>
   ${reading(readLabor())}`,
   `<h5>Main-d’œuvre</h5><p>Le PDF actuel ne contient qu’un tableau de productivité. L’onglet dit maintenant combien de la paie n’est pas utilisée et ce que coûte réellement une heure productive. Les salaires individuels n’apparaissent qu’en annexe, et seulement si l’on coche l’option.</p>${prov([['app', 'productivité par poste, masse salariale, paie non utilisée, coût réel d’une heure, marge de croissance'], ['pdf', 'le tableau de productivité (mêmes colonnes)'], ['rule', '« Ce que cela veut dire » : phrases à gabarit (pourcentage de paie, écart de taux, heures libres)']])}`);
  const hr = D.hourRows;
  seg(6, 'mo2', `
   <h3 class="s">Bénéfice brut par heure de production <small>par activité</small></h3>
   ${hbars([{ n: 'Mets principaux surgelés', v: 164.46 }, { n: 'Sauces et accompagnements', v: 86.47 }, { n: 'Soupes et potages', v: 40.92 }].map(x => ({ ...x, color: x.v >= HAVG ? '#10B981' : '#F59E0B', mark: HAVG })), { max: 180, nameW: 52, fmt: v => usd(v, 2) + '/h' })}
   <div class="src">Repère noir : moyenne de l’équipe, ${usd(HAVG, 2)}/h (toutes les heures de production, sous-recettes comprises).</div>
   <h3 class="s">Classement des produits <small>bénéfice brut par heure, produits de revente exclus</small></h3>
   ${hbars(hr.map(r => ({ n: r.n, v: r.gph, color: r.gph >= HAVG ? '#10B981' : '#F59E0B', mark: HAVG })), { max: 280, nameW: 62, fmt: v => usd(v, 0) + '/h' })}
   <div class="legend"><span><i style="background:#10B981"></i>Au-dessus de la moyenne</span><span><i style="background:#F59E0B"></i>Sous la moyenne</span></div>
   ${cfind(byLabel("Main-d'œuvre"), 6)}
   ${commentBox()}`,
   `<h5>Rentabilité de l’heure</h5>${prov([['app', 'bénéfice brut par heure par activité et par produit ; revente exclue ; moyenne de l’équipe (classement paginé à l’écran, imprimé en entier)']])}`);

  /* ---------- Chapitre 7 : fiches ---------- */
  const prodFindings = (F) => {
    const out = [], k = CLS[F.name];
    const DESC = { stars: 'Très populaire et très rentable : à mettre en avant.', questions: 'Rentable, mais peu populaire : à promouvoir.', cows: 'Très populaire, mais peu rentable : à optimiser.', dogs: 'Peu populaire et peu rentable : à repenser ou retirer.' };
    if (k) out.push([k === 'stars' ? 'f' : k === 'questions' ? 'n' : 'w', CLSNAME[k][1], DESC[k]]);
    const ch = F.channels, neg = ch.filter(c => c.netD < 0);
    out.push(!neg.length ? ['f', 'Rentable dans tous ses canaux', `Marge nette de ${f(Math.min(...ch.map(c => c.netP)) * 100, 1)} % à ${f(Math.max(...ch.map(c => c.netP)) * 100, 1)} %.`] : ['w', neg.length === ch.length ? 'Déficitaire dans tous ses canaux' : `Perd de l’argent dans ${neg.length} canal${neg.length > 1 ? 'ux' : ''} sur ${ch.length}`, neg.map(c => `${SHORT[c.name]} : ${f(c.netP * 100, 1)} % (${f(c.netD * c.vol, 0)} $)`).join(' · ')]);
    if (F.costs.matPct > 0.32) out.push(['w', 'Coût matière au-dessus de la cible', `${f(F.costs.matPct * 100, 1)} % contre une cible de 32 %.`]);
    const h = D.hourRows.find(x => x.n === F.name);
    if (h) out.push([h.gph >= HAVG ? 'f' : 'w', h.gph >= HAVG ? 'Bon usage du temps' : 'Rapporte peu à l’heure', `${f(h.gph, 0)} $ de bénéfice brut par heure, contre ${f(HAVG, 0)} $ en moyenne.`]);
    const me = D.products.find(p => p.name === F.name);
    D.products.filter(p => baseName(p.name) === baseName(F.name) && p.name !== F.name).forEach(p => out.push(['n', 'Autre format du même produit', `${fmtName(p.name)} : marge nette de ${f(p.nette * 100, 1)} % contre ${f(me.nette * 100, 1)} % pour ce format (tous canaux).`]));
    return out;
  };
  const cascade = (F) => {
    const ch = F.channels, cols = ch.length + 1, c2 = (v) => usd(v, 2);
    const sec = (t) => `<tr><th colspan="${cols}" class="sec">${t}</th></tr>`;
    const row = (label, cells, emph) => `<tr class="${emph ? 'emph' : ''}"><th>${label}</th>${cells.join('')}</tr>`;
    const td = (v, st2 = '', cls = '') => `<td class="${cls}" style="${st2}">${v}</td>`;
    const names = []; ch.forEach(c => { for (let i = c.deltas.length - 1; i >= 0; i--) if (!names.includes(c.deltas[i].name)) names.push(c.deltas[i].name); });
    const fixedTot = (c) => c.brutD - c.netD - F.costs.aging;
    let h = `<table class="bs"><thead><tr><th>Canal</th>${ch.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>`;
    h += sec('PDS et frais de mise en marché');
    h += row('PDS', ch.map(() => td(F.pds > 0 ? c2(F.pds) : '—')));
    names.forEach(n => { h += row(esc(n), ch.map(c => { const d = c.deltas.find(x => x.name === n); return td(d && d.delta != null ? c2(d.delta) : '—'); })); });
    h += row('Frais de mise en marché totaux par unité', ch.map(c => td(c.totalDelta != null ? c2(c.totalDelta) : '—', '', 'b')), true);
    h += sec('Marge brute');
    h += row('Prix de vente', ch.map(c => td(c2(c.netPrice), '', 'b')));
    h += row('Bénéfice brut', ch.map(c => td(c2(c.brutD), mcell(c.brutP), 'b')));
    h += row('Marge brute', ch.map(c => td(mt(c.brutP), mcell(c.brutP), 'b')));
    h += sec('Répartition des charges fixes');
    h += row('Frais fixes — Général', ch.map(() => td(c2(F.costs.ffGen))));
    h += row(`Frais fixes — Activité (${esc(F.activity || '')})`, ch.map(() => td(c2(F.costs.ffAct))));
    h += row('Frais fixes — Canal', ch.map(c => td(c2(c.ffCanal))));
    h += row('Frais fixes totaux par unité', ch.map(c => td(c2(fixedTot(c)), '', 'b')), true);
    h += sec('Coût net et marge nette');
    if (F.costs.aging > 0) h += row('Vieillissement', ch.map(() => td(c2(F.costs.aging))));
    h += row('Coût net', ch.map(c => td(c2(c.netPrice - c.netD))));
    h += row('Bénéfice net', ch.map(c => td(c2(c.netD), mcell(c.netP), 'b')));
    h += row('Marge nette', ch.map(c => td(mt(c.netP), mcell(c.netP), 'b')));
    h += sec('Seuil de rentabilité par canal de vente');
    h += row('Revenu total', ch.map(c => td(c.vol > 0 ? usd(c.netPrice * c.vol, 2) : '—')));
    h += row('Frais totaux', ch.map(c => td(c.vol > 0 ? usd((c.netPrice - c.netD) * c.vol, 2) : '—')));
    h += row('Bénéfices / Pertes', ch.map(c => td(c.vol > 0 ? usd(c.netD * c.vol, 2) : '—', c.vol > 0 ? mcell(c.netP) : '', 'b')));
    h += row('Point mort', ch.map(c => td(c.be != null ? f(c.be) + ' unités' : 'N/A', '', 'b ind')), true);
    return h + '</tbody></table>';
  };
  const recT = (cls, head2, rows, foot) => `<table class="tb ${cls}" style="font-size:7.8pt"><thead><tr>${head2}</tr></thead><tbody>${rows}</tbody><tfoot><tr>${foot}</tr></tfoot></table>`;
  const ficheHTML = (F) => {
    const cl2 = CLSNAME[CLS[F.name]], pf = prodFindings(F), k = F.costs;
    const status = F.isIngredient ? 'Sous-recette' : F.isResale ? 'Produit de revente' : 'Produit fini';
    const X = D.pxtra[F.name], ser = X && X.series.every(s => s) ? X.series : null;
    const topIng = [...F.ings].sort((x, y) => y.total - x.total).slice(0, 3), mins = F.steps.reduce((q, s) => q + s.sec, 0) / 60;
    const comp = F.ings.length ? `<div style="margin:1.6mm 0 0;font-size:7.4pt;color:var(--secondary)">Principaux ingrédients : ${topIng.map(i => `${esc(i.n)} ${usd(i.total, 2)} (${f(i.total / k.totalIngr * 100, 0)} % de la matière)`).join(' · ')}. Main-d’œuvre : ${f(mins, 1)} min par lot de ${F.nbPortions}. Marge de contribution : ${usd(X.contribD, 2)} (${pc(X.contribP, 1)}).</div>` : '';
    let h = `<div class="nmark" data-k="fiche:${esc(F.name)}"></div><div class="fiche-head nx"><div><div style="font-size:14pt;font-weight:700">${esc(F.name)}</div><div class="mut">Lot de ${F.nbPortions} portions de ${esc(String(F.portionSize))} ${esc(F.portionUnit || '')} · ${esc(F.activity || '')}</div></div><span class="badge ${cl2[0]}">${cl2[1]}</span></div>
     <table class="tb" data-kn="1" style="font-size:7.8pt;margin-bottom:1.2mm;--pad:1.1mm"><tbody><tr><td class="l">PDS : <b>${usd(F.pds, 2)}</b></td><td class="l">Unités produites : <b>${F.nbPortions}</b></td><td class="l">Format par portion : <b>${esc(String(F.portionSize))} ${esc(F.portionUnit || '')}</b></td><td class="l">Statut : <b>${status}</b></td><td class="l">Allergènes : <b>${F.allergens.length ? esc(F.allergens.join(', ')) : 'Aucun'}</b></td></tr></tbody></table>
     <h3 class="s">Constats du produit</h3>
     <div class="cf">${pf.map(([t, a, b]) => `<div class="cfi ${t}"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>
     <div class="mut" data-kn="1" style="font-size:7.2pt;margin:2.6mm 0 1mm">Coût de production (identique dans tous les canaux)</div>
     <div class="tiles4" style="grid-template-columns:repeat(${k.st > 0 ? 5 : 4},1fr)">
      <div class="tile" style="min-height:10mm"><div class="l">Coût matière</div><div class="v" style="font-size:11pt">${usd(k.mat, 2)}</div><div class="c mut">${pc(X.matP, 1)} du prix</div></div>
      <div class="tile" style="min-height:10mm"><div class="l">Emballage</div><div class="v" style="font-size:11pt">${usd(k.pkg, 2)}</div><div class="c mut">${pc(X.pkgP, 1)} du prix</div></div>
      <div class="tile" style="min-height:10mm"><div class="l">Main-d’œuvre</div><div class="v" style="font-size:11pt">${usd(k.mo, 2)}</div><div class="c mut">${pc(X.moP, 1)} du prix</div></div>
      ${k.st > 0 ? `<div class="tile" style="min-height:10mm"><div class="l">Coûts additionnels</div><div class="v" style="font-size:11pt">${usd(k.st, 2)}</div></div>` : ''}
      <div class="tile" style="min-height:10mm;background:#fff;border:.5mm solid #9CA3AF"><div class="l">Coût de production (total)</div><div class="v" style="font-size:12pt">${usd(k.prod, 2)}</div></div>
     </div>${comp}
     <h3 class="s">Cascade de marge par canal <small>du PDS à la marge nette</small></h3>${cascade(F)}`;
    if (F.ings.length || F.pk.length) {
      const rcT = (cls, head2, rows, foot) => `<table class="tb ${cls}" style="font-size:6.6pt;--pad:.55mm"><thead><tr>${head2}</tr></thead><tbody>${rows}</tbody><tfoot><tr>${foot}</tr></tfoot></table>`;
      const ing = rcT('green', '<th style="text-align:left">Ingrédient</th><th>Qté</th><th>Total</th>', F.ings.map(i => `<tr><td class="l">${esc(i.n)}</td><td>${f(parseFloat(i.q))} ${esc(i.u)}</td><td>${f(i.total, 2)} $</td></tr>`).join(''), `<td class="l" colspan="2">Matières <span class="mut">(dont perte ${f(k.totalLoss, 2)} $)</span></td><td>${f(k.totalIngr, 2)} $</td>`);
      const pkc = rcT('pink', '<th style="text-align:left">Emballage</th><th>Qté</th><th>Total</th>', F.pk.map(i => `<tr><td class="l">${esc(i.n)}</td><td>${f(parseFloat(i.q))}</td><td>${f(i.total, 2)} $</td></tr>`).join(''), `<td class="l" colspan="2">Emballage</td><td>${f(k.totalPkg, 2)} $</td>`);
      const moc = rcT('yellow', '<th style="text-align:left">Étape</th><th>Durée</th><th>Total</th>', F.steps.map(s => `<tr><td class="l">${esc(s.n)}<br><span class="mut">${esc(Object.entries(s.posts.reduce((q, x) => { q[x] = (q[x] || 0) + 1; return q; }, {})).map(([x, n]) => n + '× ' + x).join(', '))}</span></td><td>${f(s.sec / 60, 1)} min</td><td>${f(s.total, 2)} $</td></tr>`).join(''), `<td class="l" colspan="2">Main-d’œuvre</td><td>${f(k.totalLabor, 2)} $</td>`);
      h += `<h3 class="s">Recette détaillée <small>coût total par ligne, lot de ${F.nbPortions}</small></h3><div class="rc"><div class="rcg">${ing}<div>${pkc}</div><div>${moc}</div></div></div>`;
    }
    if (ser) {
      const ys = ser.flatMap(s => [s.mat, s.pkg, s.mo, s.ind, s.net]), lo = Math.min(0, Math.floor(Math.min(...ys) / 10) * 10), hi = Math.ceil(Math.max(...ys) / 10) * 10;
      const L = ser[ser.length - 1], ln = (name, color, key, ly) => ({ name: name + ' ' + f(L[key], 1) + ' %', color, vals: ser.map(s => s[key]), endLabel: '', ly });
      h += `<h3 class="s">Évolution des indicateurs du produit <small>% du prix de vente, 19 relevés</small></h3>` + lineChart({ h: 200, padR: 128, labels: lab, series: [ln('Coût matière', '#10B981', 'mat', 0), ln('Frais fixes', '#8B5CF6', 'ind', 0), ln('Marge nette', '#2563EB', 'net', 0), ln('Emballage', '#DB2777', 'pkg', -6), ln('Main-d’œuvre', '#F59E0B', 'mo', 6)], ymin: lo, ymax: hi, ystep: 10, yfmt: v => v + ' %', xEvery: 3 });
    }
    return h;
  };
  seg(7, 'fiches-intro', `
   <h3 class="s" style="margin-top:0">Comment lire une fiche</h3>
   <div class="card"><ol style="margin:0;padding-left:4.4mm">
    <li><b>Bandeau</b> : le produit, son format, sa classe stratégique, ses paramètres (PDS, unités, statut, allergènes).</li>
    <li><b>Constats du produit</b> : les règles des constats clés, appliquées à ce format.</li>
    <li><b>Coût de production</b>, puis la <b>cascade de marge par canal</b>, identique à l’écran Par SKU : du PDS jusqu’à la marge nette et au point mort.</li>
    <li><b>Détail de la recette</b> : matières premières, emballage, main-d’œuvre par étape, avec le coût de chaque ligne.</li>
    <li><b>Marge nette</b> du produit sur les points de référence.</li></ol>
    <p style="margin:2mm 0 0"><b>Chaque fiche commence sur sa propre page.</b> Si une fiche est longue, ses tableaux se coupent proprement (en-tête répété, « suite » au titre) et la cascade ne se coupe qu’entre deux sections.</p></div>
   <h3 class="s">Fiches de ce chapitre <small>une par format ; marges et classes : tableau de la page ${PM.seg.skutable || ''}</small></h3>
   <div class="idx">${D.fiches.map(F => `<div><span>${esc(F.name)}</span><b>p. ${pgFiche(F.name)}</b></div>`).join('')}</div>`,
   `<h5>Début du chapitre 7</h5><p>Le chapitre garde son bandeau de départ, suivi d’un guide de lecture et d’une liste des fiches avec leur page (les marges et la classe sont dans le tableau de la page ${PM.seg.skutable || '…'}).</p>${prov([['calc', 'texte fixe, identique pour tous les projets']])}`);
  D.fiches.forEach(F => seg(7, 'fiche:' + F.name, ficheHTML(F).replace(/^<div class="nmark"[^>]*><\/div>/, ''),
   `<h5>Fiche « ${esc(F.name)} »</h5><p>Le bloc central reproduit l’écran Par SKU : cinq sections, couleurs de marge de l’application. Le détail de la recette suit, puis la courbe de marge nette.</p>${prov([['app', 'la cascade PDS → marge nette → point mort, les tuiles de coût de production, le statut et les allergènes, l’évolution du produit'], ['pdf', 'les paramètres du produit et les trois tableaux de recette (mêmes colonnes)'], ['rule', 'les constats du produit : mêmes seuils que les constats clés, appliqués à un seul format ; la ligne « principaux ingrédients »']])}<p><b>Chaque fiche commence sur sa propre page</b> (exception à la règle du texte fluide).</p>`, true));

  /* ---------- Annexes ---------- */
  const CBG = { A: 'var(--red-bg)', B: 'var(--amber-bg)', C: 'var(--green-bg)' };
  const catHead = (first) => `<thead><tr><th style="text-align:left">${first}</th><th>Classe</th><th style="text-align:left">Fournisseur</th><th>Format d’achat</th><th>Prix d’achat</th><th>Perte</th><th>Prix unitaire</th></tr></thead>`;
  const catRows = (rows) => [...rows].sort((a, b) => (a.cls > b.cls ? 1 : a.cls < b.cls ? -1 : 0)).map(i => `<tr><td class="l"><b>${esc(i.n)}</b></td><td style="background:${CBG[i.cls]}"><b>${i.cls}</b></td><td class="l">${esc(i.p)}</td><td>${i.f} ${i.u}</td><td>${usd(i.pr, 2)}</td><td>${i.l} %</td><td>${usd(i.up, 2)}/${i.u}</td></tr>`).join('');
  seg('A', 'annA', `<h3 class="s" style="margin-top:0">Annexe A — Ingrédients <small>${D.ingr.length} lignes, classées A, B, C</small></h3><table class="tb" style="font-size:7.8pt">${catHead('Ingrédient')}<tbody>${catRows(D.ingr)}</tbody></table>`,
   `<h5>Annexes A et B : même tableau</h5><p>Ingrédients et emballages ont les mêmes colonnes et le même style, avec la classe ABC que l’application calcule pour les deux.</p>${prov([['pdf', 'la liste et ses colonnes (annexe B actuelle)'], ['app', 'la classe ABC (onglets Ingrédients et Emballages)']])}`);
  seg('A', 'annB', `<h3 class="s">Annexe B — Emballages <small>${D.pk.length} lignes, classées A, B, C</small></h3><table class="tb" style="font-size:7.8pt">${catHead('Emballage')}<tbody>${catRows(D.pk)}</tbody></table>`, '<h5>Annexe B</h5><p>Mêmes colonnes que l’annexe A.</p>');
  seg('A', 'annC', `<h3 class="s">Annexe C — Équipe <span class="pill old" style="font-size:7pt">Option : salaires individuels</span></h3>
   <table class="tb" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Employé</th><th>Salaire horaire</th><th>Charges</th><th>Vacances</th><th>Heures payées</th><th>Coût chargé</th></tr></thead><tbody>
   ${D.labor.map(p => `<tr><td class="l" colspan="6" style="background:#E5E7EB;font-weight:700">${esc(p.post)}</td></tr>` + p.emps.map(e => `<tr><td class="l">${esc(e.n)}</td><td>${usd(e.r, 2)}</td><td>${e.c} %</td><td>${e.v} %</td><td>${e.h} h</td><td>${usd(e.r * (1 + e.c / 100) * (1 + e.v / 100) * e.h)}</td></tr>`).join('')).join('')}</tbody></table>`,
   `<h5>Annexe C : optionnelle</h5><p>Les salaires individuels n’apparaissent que si la case « Inclure les salaires individuels » est cochée (décochée par défaut) : un rapport transmis à un banquier ou à un investisseur ne doit pas les contenir sans que l’entrepreneur l’ait voulu.</p>${prov([['pdf', 'liste des employés (mêmes colonnes)']])}`);
  // sélection automatique : un terme du glossaire n'est imprimé que s'il figure dans le texte du rapport (hors glossaire)
  const norm = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;|&nbsp;|\u00a0|\u202f/g, ' ').replace(/[’‘]/g, "'").toLowerCase();
  const reportText = norm(Object.values(CH_SEGS).flat().join(' '));
  const baseOf = tm => tm.replace(/\s*\(.*\)\s*/, '').trim();
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ALIAS = { 'Analyse ABC': ['abc'] };
  const used = D.gloss.filter(d => (ALIAS[d.term] || [baseOf(d.term)]).some(b => { const re = new RegExp("(^|[^a-zà-ÿ0-9])" + norm(b).split(/\s+/).map(w => escRe(w) + 's?').join('\\s+') + "(?![a-zà-ÿ0-9])"); return re.test(reportText); }));
  seg('A', 'annD', `<h3 class="s">Annexe D — Glossaire <small>${used.length} termes employés dans ce rapport, sur ${D.gloss.length} dans le guide</small></h3>
   <table class="tb" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Terme</th><th style="text-align:left">Définition</th></tr></thead><tbody>
   ${used.map(d => `<tr><td class="l" style="white-space:nowrap;vertical-align:top"><b>${esc(d.term)}</b></td><td class="l">${esc(d.def)}</td></tr>`).join('')}</tbody></table>
   <h3 class="s">Repères utilisés par les constats clés <small>ordres de grandeur de gestion, non des normes</small></h3>
   <table class="tb" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Repère</th><th>Seuil</th></tr></thead><tbody>
    <tr><td class="l">Marge de sécurité confortable · mince</td><td>≥ 20 % · < 10 %</td></tr>
    <tr><td class="l">Dépendance à un fournisseur (part des achats)</td><td>≥ 30 %</td></tr>
    <tr><td class="l">Dépendance à un canal (part des revenus)</td><td>≥ 40 %</td></tr>
    <tr><td class="l">Perte stock élevée · faible (part des achats)</td><td>≥ 3 % · < 1 %</td></tr>
    <tr><td class="l">Paie non utilisée élevée · faible</td><td>≥ 15 % · ≤ 10 %</td></tr>
    <tr><td class="l">Marge nette très faible</td><td>< 3 %</td></tr></tbody></table>
   <div class="src">Ces chiffres sont des prévisions fondées sur vos recettes, prix et volumes saisis. Ils ne remplacent pas des états financiers vérifiés.</div>`,
   `<h5>Glossaire : seulement les termes employés</h5><p>Les définitions sont celles du <b>glossaire du guide</b> (partie 4), mot pour mot. Le rapport n’imprime que les termes <b>qui figurent dans son propre texte</b> : la sélection se fait automatiquement, en cherchant chaque terme du glossaire (au singulier ou au pluriel) dans les chapitres inclus. Un chapitre exclu fait donc disparaître ses termes.</p><p>Ici : ${used.length} termes sur ${D.gloss.length}.</p><p>Les <b>repères</b> sont lus dans le fichier des seuils au moment de l’export.</p>${prov([['doc', 'les définitions (guide, glossaire)'], ['app', 'les seuils (fichier des seuils)'], ['rule', 'la sélection des termes selon les chapitres inclus']])}`);
}

/* ============ Assemblage ============ */
function renderAll() {
  defineContent();
  const sheets = [], newMap = { seg: {}, chap: {}, total: 0 };
  let pageNo = 3; const DENSE = { 1: true, 7: true, A: true };
  const pagesOf = [];
  CHAPS.forEach(C => {
    const c = C.n, banner = chap(c, false), html = banner + (CH_SEGS[c] || []).join('');
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const pages = paginateChapter([...tmp.children], !!DENSE[c]);
    newMap.chap[c] = pageNo;
    pages.forEach(nodes => {
      const keys = nodes.flatMap(n => n.matches && n.matches('.nmark') ? [n.dataset.k] : [...(n.querySelectorAll ? n.querySelectorAll('.nmark') : [])].map(x => x.dataset.k));
      keys.forEach(k => { if (!(k in newMap.seg)) newMap.seg[k] = pageNo; });
      pagesOf.push({ n: pageNo, c, nodes, keys, dense: !!DENSE[c] });
      pageNo++;
    });
  });
  newMap.total = pageNo - 1;
  return { pagesOf, newMap };
}
