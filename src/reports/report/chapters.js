// Chapitres 1 à 6 du rapport PDF (phase 4 de la refonte de l'export, 22/11). Chaque fonction reçoit le modèle (model.js), la carte des pages (renvois) et le
// commentaire de la direction ; elle rend du HTML qui suit le contrat du moteur de mise en page. Une donnée absente rend la section muette, jamais un zéro.
import { f, usd, pc, sgn, esc, marginCell } from './format.js';
import { hbars, lineChart, niceScale, waterfall } from './charts.js';
import { h3, grpTitle, mark, pageRef, commentBox, reading, findingsSection, shortName, tile } from './ui.js';
import { CLASSES, FINDING_GROUP_LABELS, LABELS, TARGET } from './strings.js';

const C = { green: '#10B981', pink: '#DB2777', yellow: '#F59E0B', purple: '#8B5CF6', grey: '#9CA3AF', blue: '#2563EB' };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const seriesOf = (m, key) => m.trend.series.map(s => s[key]);

// Indicateur de coût comparé à sa cible (la règle de l'écran : au plus la cible = respectée).
const costTile = (label, ratio, target) => {
    const note = !target ? 'cible non saisie' : ratio * 100 <= target ? `${TARGET.below} (${f(target)} %)` : `${TARGET.above} (${f(target)} %)`;
    return tile({ label, value: pc(ratio, 2), note, noteClass: !target ? 'mut' : ratio * 100 <= target ? 'ok' : 'bad' });
};
const safetyTile = (k) => {
    if (!k.safety) return tile({ label: 'Marge de sécurité', value: '—', note: 'point mort non calculable', noteClass: 'mut' });
    const r = k.safety.ratio;
    const [cls, text] = r < 0 ? ['bad', '● Sous le point mort']
        : r < k.safetyLow ? ['bad', `● Sous le seuil mince (${f(k.safetyLow * 100)} %)`]
        : r >= k.safetyComfortable ? ['ok', `● Au-dessus du repère confortable (${f(k.safetyComfortable * 100)} %)`]
        : ['warn', `● Entre le seuil mince (${f(k.safetyLow * 100)} %) et confortable (${f(k.safetyComfortable * 100)} %)`];
    return tile({ label: 'Marge de sécurité', value: pc(r, 2), note: text, noteClass: cls });
};

// ---------- Chapitre 1 : synthèse ----------
const ONE_DOLLAR_COLOR = { material: C.green, packaging: C.pink, labor: C.yellow, subcontracting: C.grey, fixed: C.purple, net: C.blue };

const findingColumns = (list, map) => {
    const li = (x) => `<li><b>${esc(x.title)}</b><span>${esc(x.detail)}</span> <i>→ ${pageRef(map, x.mark)}</i></li>`;
    return (label, forces, faiblesses, a, b) => `${grpTitle(label, `· ${forces.length} + ${faiblesses.length} constats`)}`
        + `<div class="two" data-split="columns" style="gap:2.4mm"><div class="fcol f" data-col><h5>${esc(a)}</h5><ul>${forces.map(li).join('') || `<li class="mut">${LABELS.noFinding}</li>`}</ul></div>`
        + `<div class="fcol w" data-col><h5>${esc(b)}</h5><ul>${faiblesses.map(li).join('') || `<li class="mut">${LABELS.noFinding}</li>`}</ul></div></div>`;
};

export function chapter1(m, map, comment) {
    const k = m.kpis, t = m.targets;
    const tiles = `<div class="tiles">`
        + costTile('Coût matière', k.material, t.material) + costTile('Coût d’emballage', k.packaging, t.packaging) + costTile('Coût de main-d’œuvre', k.labor, t.labor)
        + tile({ label: 'Marge brute', value: pc(k.grossMargin, 2), note: 'moyenne pondérée' })
        + tile({ label: 'Point mort', value: usd(k.breakEven), note: k.revenue ? `ventes prévues : ${usd(k.revenue)}` : '' })
        + safetyTile(k) + `</div>`;
    let h = mark('synth') + h3('Indicateurs clés de rentabilité', 'moyennes pondérées par le mix de ventes', { first: true }) + tiles;
    if (m.cascade) {
        const c = m.cascade, d = c.perDollar.filter(x => x.value > 0);
        h += h3('Sur chaque dollar de vente, où va l’argent ?', `ventes prévues : ${usd(c.revenue)}`)
            + `<div class="stack" data-keep="next">${d.map(x => `<div style="flex:${x.value};background:${ONE_DOLLAR_COLOR[x.key]}">${x.share > 0.06 ? f(x.share * 100, 0) + ' ¢' : ''}</div>`).join('')}</div>`
            + `<div class="legend">${c.perDollar.map(x => `<span><i style="background:${ONE_DOLLAR_COLOR[x.key]}"></i>${esc(x.label)} ${f(x.share * 100, 1)} ¢</span>`).join('')}</div>`;
    }
    const gm = seriesOf(m, 'Marge Brute Moyenne');
    if (gm.filter(finite).length >= 2) {
        const sc = niceScale(gm, { ticks: 3 }), last = [...gm].reverse().find(finite);
        h += h3('Évolution de la marge brute', `${m.trend.count} points de référence`)
            + lineChart({ h: 100, labels: m.trend.labels, series: [{ name: 'Marge brute', color: C.blue, vals: gm, endLabel: `${f(last, 1)} %` }], ymin: sc.min, ymax: sc.max, ystep: sc.step, yfmt: v => `${f(v)} %`, xEvery: Math.max(1, Math.ceil(m.trend.count / 6)) });
    }
    // Constats clés : tous les constats majeurs, par groupe (le rapport ne coupe pas à trois par colonne : sur papier, il n'y a pas de « Voir tout »)
    const group = findingColumns(null, map);
    const parts = FINDING_GROUP_LABELS.map(([g, label, a, b]) => {
        const forces = m.findings.forces.filter(x => x.group === g), faiblesses = m.findings.faiblesses.filter(x => x.group === g);
        return forces.length || faiblesses.length ? group(label, forces, faiblesses, a, b) : '';
    }).join('');
    h += mark('constats') + h3('Constats clés', 'les plus graves ; le détail est dans chaque chapitre') + (parts || `<div class="mut">Aucun constat majeur pour l’instant.</div>`) + commentBox(comment);
    return h;
}

// ---------- Chapitre 2 : résultats ----------
export function chapter2(m, map, comment) {
    let h = mark('resultats');
    const c = m.cascade;
    if (c) {
        const steps = c.steps.map(s => ({ label: s.label, value: s.value, total: !!s.total, color: { revenue: C.blue, material: C.green, packaging: C.pink, labor: C.yellow, subcontracting: C.grey, gross: '#1E40AF', fixed: C.purple, aging: '#C4B5FD', net: '#047857' }[s.key] }));
        h += h3('Du revenu au bénéfice net', 'ventes prévues', { first: true }) + `<div data-keep="next">${waterfall(steps, { w: 650, h: 250 })}</div>`;
    }
    h += h3('Réconciliation réel / théorique');
    if (m.recon) {
        h += `<table class="tb blue" data-split="rows"><thead><tr><th style="text-align:left">Poste</th><th>Réel</th><th>Théorique (modèle)</th><th>Écart $</th><th>Écart %</th></tr></thead><tbody>`
            + m.recon.map(r => `<tr><td class="l"><b>${esc(r.label)}</b></td><td>${usd(r.real)}</td><td>${usd(r.theoretical)}</td><td>${sgn(r.diff)}${' '}$</td><td><b>${r.diffPercent == null ? '—' : (r.diffPercent > 0 ? '+' : '') + pc(r.diffPercent)}</b></td></tr>`).join('') + `</tbody></table>`;
        if (c && c.aging > 0) h += `<div class="src">Le bénéfice net théorique inclut ${usd(c.aging)} de vieillissement, absent du réel saisi.</div>`;
        h += reading(m.readings.reconciliation);
    } else {
        h += `<div class="card mut">${esc(LABELS.noRealData)}</div>`;
    }
    h += mark('tendance');
    const gm = seriesOf(m, 'Marge Brute Moyenne');
    if (gm.filter(finite).length >= 2) {
        const keys = [['Marge Brute Moyenne', 'Marge brute', C.blue], ['Coût Matière Moyen', 'Coût matière', C.green], ['Coût Emballage Moyen', 'Coût emballage', C.pink], ["Coût Main-d'œuvre Moyen", 'Coût main-d’œuvre', C.yellow]];
        const all = keys.flatMap(([key]) => seriesOf(m, key));
        const sc = niceScale(all, { ticks: 5, includeZero: true });
        const hi = gm.indexOf(Math.max(...gm.filter(finite))), lo = gm.indexOf(Math.min(...gm.filter(finite)));
        const lastOf = (key) => [...seriesOf(m, key)].reverse().find(finite);
        const marks = hi !== lo ? [{ i: hi, s: 0, t: `${f(gm[hi], 1)} % (${m.trend.labels[hi]})` }, { i: lo, s: 0, t: `${f(gm[lo], 1)} % (${m.trend.labels[lo]})`, below: true }] : [];
        h += h3('Évolution des indicateurs', `${m.trend.count} points de référence`)
            + `<div data-keep="next">${lineChart({ labels: m.trend.labels, series: keys.map(([key, name, color]) => ({ name, color, vals: seriesOf(m, key), endLabel: `${f(lastOf(key), 1)} %` })), ymin: sc.min, ymax: sc.max, ystep: sc.step, yfmt: v => `${f(v)} %`, xEvery: Math.max(1, Math.ceil(m.trend.count / 6)), padR: 112, marks })}</div>`
            + `<div class="legend">${keys.map(([, name, color]) => `<span><i style="background:${color}"></i>${name}</span>`).join('')}</div>`;
        const rows = m.trend.rows.filter(r => r.threeBack || r.yearAgo);
        if (rows.length) {
            const lbl = (key) => rows.find(r => r[key])?.[key]?.label;
            const cell = (r, cmp) => {
                if (!cmp) return '<td>—</td>';
                const val = r.kind === 'rel' ? usd(cmp.value) : pc(cmp.value);
                const d = cmp.delta == null ? '' : r.kind === 'rel' ? `${cmp.delta > 0 ? '+' : ''}${pc(cmp.delta, 1)}` : `${sgn(cmp.delta * 100, 1)} pt`;
                return `<td>${val} <span class="mut">(${d})</span></td>`;
            };
            h += `<table class="tb" data-split="rows" style="margin-top:2.4mm"><thead><tr><th style="text-align:left">Indicateur</th><th>Aujourd’hui</th><th>Il y a 3 relevés${lbl('threeBack') ? ` <span style="font-weight:400">(${esc(lbl('threeBack'))})</span>` : ''}</th><th>Il y a 12 mois${lbl('yearAgo') ? ` <span style="font-weight:400">(${esc(lbl('yearAgo'))})</span>` : ''}</th></tr></thead><tbody>`
                + rows.map(r => `<tr><td class="l"><b>${esc(r.label)}</b></td><td><b>${r.kind === 'rel' ? usd(r.now) : pc(r.now)}</b></td>${cell(r, r.threeBack)}${cell(r, r.yearAgo)}</tr>`).join('') + `</tbody></table>`;
        }
        h += reading(m.readings.evolution);
    }
    h += findingsSection('Constats de ce chapitre', m.findings.chapters[2], 'tous les niveaux de gravité') + commentBox(comment);
    return h;
}

// ---------- Chapitre 3 : produits ----------
export function chapter3(m, map, comment) {
    // Chaque quadrant montre au plus 15 produits : la liste complète, avec la classe de chacun, est dans le tableau qui suit (un grand projet ferait déborder la matrice).
    const menu = m.portfolio.menu, MAX_PER_QUADRANT = 15;
    const li = (list) => { const l = list || []; return l.slice(0, MAX_PER_QUADRANT).map(p => `<li>${esc(p.displayName)}</li>`).join('') + (l.length > MAX_PER_QUADRANT ? `<li class="mut">… et ${l.length - MAX_PER_QUADRANT} autres (voir le tableau, ${pageRef(map, 'skutable')})</li>` : ''); };
    const quad = (k, col, row) => `<div class="q ${CLASSES[k].css}" style="grid-column:${col};grid-row:${row}"><h4>${CLASSES[k].plural}</h4><small>${esc(CLASSES[k].hint)}</small><ul>${li(menu[k])}</ul></div>`;
    const clsOf = new Map(); Object.entries(menu).forEach(([k, list]) => (list || []).forEach(p => clsOf.set(p.displayName, k)));
    const total = m.portfolio.contributionTotal;
    let h = mark('portefeuille') + h3('Matrice stratégique', 'popularité (part des ventes) × marge', { first: true })
        + `<div class="mx" data-keep="next"><div class="ax axy" style="grid-row:2/4">Marge →</div>${quad('questions', 2, 2)}${quad('stars', 3, 2)}${quad('dogs', 2, 3)}${quad('cows', 3, 3)}`
        + `<div class="ax" style="grid-column:2;grid-row:4">← Popularité plus faible</div><div class="ax" style="grid-column:3;grid-row:4">Popularité plus forte →</div></div>`;
    if (m.portfolio.contribution.length && total > 0) {
        h += h3('Classement par contribution totale au profit', `bénéfice brut total : ${usd(total)}`)
            + hbars(m.portfolio.contribution.map(c => ({ n: c.name, v: c.total, color: clsOf.get(c.name) === 'stars' ? '#2563EB' : clsOf.get(c.name) === 'dogs' ? '#FCA5A5' : '#93C5FD' })), { nameW: 62, valueW: 27, fmt: v => `${usd(v)} · ${f(v / total * 100, 0)}${' '}%` })
            + `<div class="legend"><span><i style="background:#2563EB"></i>Étoile</span><span><i style="background:#93C5FD"></i>Autre</span><span><i style="background:#FCA5A5"></i>Poids mort</span></div>`;
    }
    h += findingsSection('Constats du portefeuille', m.findings.chapters[3].filter(x => x.link?.subTab === 'portfolio'), 'tous les niveaux de gravité');
    // Du PDS à la marge nette : une ligne par format, les canaux côte à côte
    const cols = m.portfolio.channelCols, n = cols.length;
    h += mark('skutable') + h3('Du PDS à la marge nette, produit par produit', 'une ligne par format') ;
    h += `<table class="tb" data-split="rows"><thead><tr><th style="text-align:left"${n ? ' rowspan="2"' : ''}>Produit</th><th${n ? ' rowspan="2"' : ''} style="text-align:center">Classe</th><th${n ? ' rowspan="2"' : ''}>PDS</th><th${n ? ' rowspan="2"' : ''}>Coût de prod.</th>`
        + (n ? `<th colspan="${n}" style="text-align:center">Prix de vente</th><th colspan="${n}" style="text-align:center">Marge nette</th>` : '') + `<th${n ? ' rowspan="2"' : ''}>Fiche</th></tr>`
        + (n ? `<tr>${[...cols, ...cols].map(c => `<th style="font-size:6.8pt">${esc(shortName(c.name, 16))}</th>`).join('')}</tr>` : '') + `</thead><tbody>`
        + m.portfolio.skuTable.map(r => `<tr><td class="l"><b>${esc(r.name)}</b></td><td style="text-align:center">${r.cls ? `<span class="badge ${CLASSES[r.cls].css}" style="font-size:6.4pt;white-space:nowrap">${CLASSES[r.cls].label}</span>` : '—'}</td><td>${usd(r.pds, 2)}</td><td>${usd(r.cost, 2)}</td>`
            + r.channels.map(c => `<td>${c ? usd(c.netPrice, 2) : '—'}</td>`).join('') + r.channels.map(c => (c ? `<td class="heat" style="${marginCell(c.netMargin)}">${pc(c.netMargin, 1)}</td>` : '<td>—</td>')).join('')
            + `<td>${pageRef(map, 'fiche:' + r.id)}</td></tr>`).join('') + `</tbody></table>`
        + `<div class="src">Un produit sans PDS saisi affiche « — » dans sa colonne de PDS, jamais un zéro.</div>`;
    h += findingsSection('Autres constats sur les produits', m.findings.chapters[3].filter(x => x.link?.subTab !== 'portfolio'), 'tous les niveaux de gravité; le détail de chaque format est dans sa fiche') + commentBox(comment);
    return h;
}

// ---------- Chapitre 4 : canaux et activités ----------
export function chapter4(m, map, comment) {
    const head = (label) => `<thead><tr><th style="text-align:left">${label}</th><th>Revenus</th><th>Part</th><th>Marge brute</th><th>Bénéfice net</th><th>Marge nette</th><th>Point mort</th><th>Marge de sécurité</th></tr></thead>`;
    const rows = (list) => list.map(c => `<tr><td class="l"><b>${esc(c.name)}</b></td><td>${usd(c.revenueTotal)}</td><td>${pc(c.share, 0)}</td><td>${pc(c.margeBrutePercent)}</td><td><b>${usd(c.margeNetteTotal)}</b></td><td class="heat" style="${marginCell(c.margeNettePercent)}">${pc(c.margeNettePercent)}</td><td>${usd(c.breakEvenRevenue)}</td><td>${pc(c.safety)}</td></tr>`).join('');
    const seg = m.segments;
    let h = mark('canaux') + h3('Les canaux de vente', null, { first: true }) + `<table class="tb blue" data-split="rows">${head('Canal')}<tbody>${rows(seg.channels)}</tbody></table>`;
    if (seg.activities.length) h += h3('Les activités de production') + `<table class="tb blue" data-split="rows">${head('Activité')}<tbody>${rows(seg.activities)}</tbody></table>`;
    if (seg.matrixRows.length && seg.matrixCols.length) {
        h += h3('Marge nette par activité et par canal') + `<div class="mt" style="grid-template-columns:34mm repeat(${seg.matrixCols.length},1fr)"><div></div>${seg.matrixCols.map(c => `<div class="h">${esc(shortName(c.name, 24))}</div>`).join('')}`
            + seg.matrixRows.map(a => `<div class="h">${esc(a.name)}</div>` + a.cells.map(cell => (cell ? `<div class="c" style="${marginCell(cell.margeNettePercent)}"><b>${pc(cell.margeNettePercent)}</b><small>${sgn(cell.margeNetteTotal)}${' '}$</small></div>` : '<div class="c">—</div>')).join('')).join('') + `</div>`;
        h += reading(m.readings.cells);
    }
    h += findingsSection('Constats de ce chapitre', m.findings.chapters[4], 'tous les niveaux de gravité') + commentBox(comment);
    return h;
}

// ---------- Chapitre 5 : approvisionnement (ingrédients et emballages : mêmes modules) ----------
const CLASS_BG = { A: 'var(--red-bg)', B: 'var(--amber-bg)', C: 'var(--green-bg)' };
function supplyHtml(s, comment, first) {
    const label = s.isIng ? 'Ingrédients' : 'Emballages', low = label.toLowerCase();
    if (!s.hasData) return '';
    const abcRow = (cls) => `<tr><td style="background:${CLASS_BG[cls]}"><b>${cls}</b></td><td style="white-space:nowrap">${f(s.abc.totals[cls], 1)}${' '}%</td><td class="l">${s.abc[cls].map(x => esc(x.name)).join(', ')}</td></tr>`;
    const max = Math.max(...s.providers.map(r => (r.share || 0) * 100), s.dependency * 100) * 1.1;
    let h = mark(s.isIng ? 'ingr' : 'emb') + `<h3 class="s" data-heading data-keep="next" style="${first ? 'margin-top:0' : 'margin-top:5mm;border-top:.4mm solid var(--primary);padding-top:3mm'}">${label} <small data-drop-on-continue>achats : ${usd(s.total)}</small></h3>`
        + `<div class="tiles">${tile({ label: `Coût net (${low})`, value: usd(s.net), small: true })}${tile({ label: 'Perte stock prévue', value: usd(s.loss), note: s.lossShare == null ? '' : `${pc(s.lossShare)} des achats`, small: true })}${tile({ label: `Achat requis (${low})`, value: usd(s.total), small: true })}</div>`
        + h3('Fournisseurs', 'part des achats')
        + hbars(s.providers.map(r => ({ n: r.provider, v: (r.share || 0) * 100, color: r.isDependent ? '#F59E0B' : '#93C5FD', mark: s.dependency * 100 })), { max: Math.ceil(max / 10) * 10, nameW: 52, fmt: v => `${f(v)} %` })
        + `<div class="src">Repère noir : seuil de dépendance (${f(s.dependency * 100)} % des achats).</div>`
        + h3('Classement ABC', `${s.abc.A.length} + ${s.abc.B.length} + ${s.abc.C.length} ${low}`)
        + `<table class="tb" style="font-size:7.4pt" data-keep="next"><thead><tr><th>Classe</th><th>Valeur</th><th style="text-align:left">${label}</th></tr></thead><tbody>${abcRow('A')}${abcRow('B')}${abcRow('C')}</tbody></table>`;
    if (s.topLoss) h += h3('Perte stock', 'prévue, non mesurée') + `<div class="card"><div style="font-size:15pt;font-weight:700">${usd(s.loss)}</div><div class="mut">${pc(s.lossShare)} des achats</div><p style="margin:1mm 0 0">La plus coûteuse : <b>${esc(s.topLoss.name)}, ${usd(s.topLoss.loss)}</b>.</p></div>`;
    if (s.hasEnoughData) {
        h += h3('Prix volatils', `amplitude sur ${s.pointCount} relevés`) + `<table class="tb yellow" data-split="rows"><thead><tr><th style="text-align:left">${label.slice(0, -1)}</th><th style="text-align:left">Fournisseur</th><th>Prix actuel</th><th>Amplitude</th><th>Tendance</th><th style="text-align:left">Volatilité</th></tr></thead><tbody>`
            + (s.volatile.length ? s.volatile.map(v => `<tr><td class="l"><b>${esc(v.name)}</b></td><td class="l">${esc(v.provider || '')}</td><td>${usd(v.currentPrice, 2)}</td><td><b>${f(v.amplitudePercent)} %</b></td><td>${sgn(v.trendPercent, 1)} %</td><td class="l">${v.tier === 'elevee' ? 'élevée' : 'modérée'}</td></tr>`).join('') : `<tr><td class="l" colspan="6">Aucun prix volatil.</td></tr>`) + `</tbody></table>`;
    }
    return h + findingsSection(`Constats : ${low}`, s.findings, 'tous les niveaux de gravité') + (s.isIng ? '' : commentBox(comment));
}
export function chapter5(m, map, comment) {
    const ing = supplyHtml(m.supply.ing, comment, true), pkg = supplyHtml(m.supply.pkg, comment, !ing);
    return ing + pkg + (m.supply.pkg.hasData ? '' : commentBox(comment));
}

// ---------- Chapitre 6 : main-d'œuvre ----------
export function chapter6(m, map, comment) {
    const L = m.labor, cs = L.cascade;
    let h = mark('mo1');
    if (L.productivity.length) {
        h += h3('Rapport de productivité par poste', null, { first: true }) + `<table class="tb yellow" data-split="rows"><thead><tr><th style="text-align:left">Poste</th><th>Heures attendues</th><th>Heures réelles</th><th>Différence</th><th>Taux d’utilisation</th></tr></thead><tbody>`
            + L.productivity.map(r => `<tr><td class="l"><b>${esc(r.postName)}</b></td><td>${f(r.expected, 2)} h</td><td>${f(r.actual, 2)} h</td><td>${f(r.difference, 2)} h</td><td><b>${f(r.utilization, 2)} %</b></td></tr>`).join('') + `</tbody>`
            + (L.totals ? `<tfoot><tr><td class="l">Total</td><td>${f(L.totals.expected, 2)} h</td><td>${f(L.totals.actual, 2)} h</td><td>${f(L.totals.difference, 2)} h</td><td>${f(L.totals.utilization, 2)} %</td></tr></tfoot>` : '') + `</table>`;
    }
    if (cs.payroll > 0) {
        h += h3('Utilisation de la masse salariale', usd(cs.payroll))
            + `<div class="stack" data-keep="next"><div style="flex:${Math.max(cs.costUsed, 0)};background:#047857">Production réelle ${pc(cs.costUsed / cs.payroll, 0)}</div><div style="flex:${Math.max(cs.costIdle, 0)};background:var(--yellow);color:var(--dark)">${cs.costIdle / cs.payroll < 0.18 ? '' : 'Capacité inutilisée '}${pc(cs.costIdle / cs.payroll, 0)}</div><div style="flex:${Math.max(cs.costNonProductive, 0)};background:#9CA3AF">Non prod.</div></div>`
            + `<div class="legend"><span><i style="background:#047857"></i>Production réelle : ${usd(cs.costUsed)} (${f(cs.usedHours, 1)} h)</span><span><i style="background:var(--yellow)"></i>Capacité inutilisée : ${usd(cs.costIdle)}</span><span><i style="background:#9CA3AF"></i>Temps non productif : ${usd(cs.costNonProductive)}</span></div>`
            + `<div class="tiles" style="margin-top:2.4mm">${tile({ label: 'Paie non utilisée', value: usd(cs.unusedPay), note: `${pc(cs.unusedShare)} de la paie`, style: 'min-height:20mm' })}`
            + tile({ label: 'Coût réel d’une heure productive', value: cs.effectiveHourlyCost == null ? '—' : `${usd(cs.effectiveHourlyCost, 2)}/h`, note: cs.averageLoadedRate == null ? '' : `taux moyen payé : ${usd(cs.averageLoadedRate, 2)}/h`, style: 'min-height:20mm' })
            + tile({ label: 'Marge de croissance', value: L.growth ? `${f(L.growth.freeHours, 1)} h` : '—', note: L.growth ? `≈ ${usd(Math.round(L.growth.additionalRevenue / 100) * 100)} de ventes (estimation)` : 'aucune heure libre', style: 'min-height:20mm' }) + `</div>`;
        if (L.growth) h += `<div class="src">Marge de croissance : heures productives libres des postes de production, au revenu et au bénéfice brut moyens par heure de production (estimation indicative ; suppose que la demande existe).</div>`;
        h += reading(m.readings.labor);
    }
    h += mark('mo2');
    const avgNote = L.average != null ? `Repère noir : moyenne de l’équipe, ${usd(L.average, 2)}/h (toutes les heures de production, sous-recettes comprises).` : '';
    const color = (v) => (L.average == null ? '#93C5FD' : v >= L.average ? '#10B981' : '#F59E0B');
    if (L.activityHour.length) {
        h += h3('Bénéfice brut par heure de production', 'par activité') + hbars(L.activityHour.map(x => ({ n: x.activityName, v: x.grossProfitPerHour, color: color(x.grossProfitPerHour), mark: L.average })), { nameW: 52, fmt: v => `${usd(v, 2)}/h` }) + (avgNote ? `<div class="src">${avgNote}</div>` : '');
    }
    if (L.productHour.length) {
        h += h3('Classement des produits', 'bénéfice brut par heure, produits de revente exclus') + hbars(L.productHour.map(x => ({ n: x.name, v: x.grossProfitPerHour, color: color(x.grossProfitPerHour), mark: L.average })), { nameW: 62, fmt: v => `${usd(v, 0)}/h` })
            + (L.average != null ? `<div class="legend"><span><i style="background:#10B981"></i>Au-dessus de la moyenne</span><span><i style="background:#F59E0B"></i>Sous la moyenne</span></div>` : '');
    }
    h += findingsSection('Constats de ce chapitre', m.findings.chapters[6], 'tous les niveaux de gravité') + commentBox(comment);
    return h;
}
