// Chapitre 7 du rapport PDF : une fiche par format (phase 4 de la refonte de l'export, 22/11). Chaque fiche commence sur sa propre page (data-break) ; ses tableaux
// se coupent entre deux lignes et la cascade entre deux sections. Les chiffres viennent du moteur : cascade du SKU, coûts, détail de recette, séries d'évolution.
import { f, usd, pc, esc, marginCell } from './format.js';
import { lineChart, niceScale } from './charts.js';
import { h3, mark, pageRef, findingCards } from './ui.js';
import { CLASSES, LABELS } from './strings.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const c2 = (v) => usd(v, 2);
const orDash = (v, fn) => (finite(v) ? fn(v) : '—');

/** Constats du produit : ceux des règles de l'application dont le sujet est ce format (classe, déficit, cible de coût, heure, autre format…). */
const productFindings = (F) => findingCards(F.findings);

/** Cascade de marge par canal : du PDS à la marge nette et au point mort, identique à l'écran Par SKU. */
function cascadeTable(F) {
    const { pds, linkRows, channels } = F.cascade;
    if (!channels.length) return '';
    const cols = channels.length + 1;
    const sec = (t) => `<tr><th colspan="${cols}" class="sec">${esc(t)}</th></tr>`;
    const row = (label, cells, emph) => `<tr${emph ? ' class="emph"' : ''}><th>${label}</th>${cells.join('')}</tr>`;
    const td = (v, style = '', cls = '') => `<td${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${v}</td>`;
    let h = `<table class="bs" data-split="rows" data-split-before="th.sec" data-split-min="1"><thead><tr><th>Canal</th>${channels.map(c => `<th>${esc(c.channelName)}</th>`).join('')}</tr></thead><tbody>`;
    h += sec('PDS et frais de mise en marché') + row('PDS', channels.map(() => td(pds > 0 ? c2(pds) : '—')));
    linkRows.forEach(l => { h += row(esc(l.label), channels.map(c => td(orDash(c.deltas[l.key], c2)))); });
    h += row('Frais de mise en marché totaux par unité', channels.map(c => td(orDash(c.totalDelta, c2), '', 'b')), true);
    h += sec('Marge brute') + row('Prix de vente', channels.map(c => td(c2(c.netPrice), '', 'b')))
        + row('Bénéfice brut', channels.map(c => td(c2(c.grossProfit), marginCell(c.grossMarginPercent), 'b')))
        + row('Marge brute', channels.map(c => td(pc(c.grossMarginPercent), marginCell(c.grossMarginPercent), 'b')));
    h += sec('Répartition des charges fixes') + row('Frais fixes — Général', channels.map(c => td(c2(c.fixedGeneral))))
        + row(`Frais fixes — Activité${F.activity ? ` (${esc(F.activity)})` : ''}`, channels.map(c => td(c2(c.fixedActivity))))
        + row('Frais fixes — Canal', channels.map(c => td(c2(c.fixedChannel))))
        + row('Frais fixes totaux par unité', channels.map(c => td(c2(c.fixedTotal), '', 'b')), true);
    h += sec('Coût net et marge nette');
    if (channels[0].aging > 0) h += row('Vieillissement', channels.map(c => td(c2(c.aging))));
    h += row('Coût net', channels.map(c => td(c2(c.netCost))))
        + row('Bénéfice net', channels.map(c => td(c2(c.netProfit), marginCell(c.netMarginPercent), 'b')))
        + row('Marge nette', channels.map(c => td(pc(c.netMarginPercent), marginCell(c.netMarginPercent), 'b')));
    h += sec('Seuil de rentabilité par canal de vente')
        + row('Revenu total', channels.map(c => td(orDash(c.revenueTotal, v => usd(v, 2)))))
        + row('Frais totaux', channels.map(c => td(orDash(c.costTotal, v => usd(v, 2)))))
        + row('Bénéfices / Pertes', channels.map(c => td(orDash(c.profitTotal, v => usd(v, 2)), finite(c.profitTotal) ? marginCell(c.netMarginPercent) : '', 'b')))
        + row('Point mort', channels.map(c => td(c.breakEvenUnits != null ? `${f(c.breakEvenUnits)} unités` : 'N/A', '', 'b ind')), true);
    return h + '</tbody></table>';
}

const recipeTable = (cls, head, rows, foot) => `<table class="tb ${cls}" style="font-size:6.6pt;--pad:.55mm"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody><tfoot><tr>${foot}</tr></tfoot></table>`;

/** Détail de la recette : trois petits tableaux côte à côte (matières, emballage, main-d'œuvre par étape), avec le coût de chaque ligne. */
function recipeDetail(F) {
    const { ingredients, packaging, steps } = F.lines;
    if (!ingredients.length && !packaging.length && !steps.length) return '';
    const k = F.costs;
    const ing = ingredients.length ? recipeTable('green', '<th style="text-align:left">Ingrédient</th><th>Qté</th><th>Total</th>',
        ingredients.map(i => `<tr><td class="l">${esc(i.name)}</td><td>${f(i.quantity, i.quantity % 1 ? 2 : 0)} ${esc(i.unit)}</td><td>${f(i.finalCost, 2)} $</td></tr>`).join(''),
        `<td class="l" colspan="2">Matières <span class="mut">(dont perte ${f(k.totalLoss, 2)} $)</span></td><td>${f(k.totalMaterial, 2)} $</td>`) : '';
    const pkg = packaging.length ? recipeTable('pink', '<th style="text-align:left">Emballage</th><th>Qté</th><th>Total</th>',
        packaging.map(i => `<tr><td class="l">${esc(i.name)}</td><td>${f(i.quantity, i.quantity % 1 ? 2 : 0)}</td><td>${f(i.finalCost, 2)} $</td></tr>`).join(''),
        `<td class="l" colspan="2">Emballage</td><td>${f(k.totalPackaging, 2)} $</td>`) : '';
    const lab = steps.length ? recipeTable('yellow', '<th style="text-align:left">Étape</th><th>Durée</th><th>Total</th>',
        steps.map(s => {
            const crew = Object.entries(s.postIds.reduce((q, x) => { q[x] = (q[x] || 0) + 1; return q; }, {})).map(([x, n]) => `${n}× ${esc(x)}`).join(', ');
            return `<tr><td class="l">${esc(s.name)}${crew ? `<br><span class="mut">${crew}</span>` : ''}</td><td>${f(s.durationSeconds / 60, 1)} min</td><td>${f(s.totalCost, 2)} $</td></tr>`;
        }).join(''), `<td class="l" colspan="2">Main-d’œuvre</td><td>${f(k.totalLabor, 2)} $</td>`) : '';
    return h3('Recette détaillée', `coût total par ligne, lot de ${f(F.nbPortions)}`) + `<div class="rc"><div class="rcg">${ing || '<div></div>'}<div>${pkg}</div><div>${lab}</div></div></div>`;
}

/** Évolution du produit : les variables de l'application (5 lignes en % du prix ; 4 lignes en $/unité pour un format sans prix). */
function evolution(F, m) {
    const ser = F.series;
    if (!ser.length || ser.filter(s => finite(s['Coût matière (%)']) || finite(s['Coût matière ($/u.)'])).length < 2) return '';
    const labels = m.trend.labels;
    const spec = F.priced
        ? [['Coût matière (%)', 'Coût matière', '#10B981', 0], ['Coût frais indirects (%)', 'Frais fixes', '#8B5CF6', 0], ['Marge nette (%)', 'Marge nette', '#2563EB', 0], ['Coût emballage (%)', 'Emballage', '#DB2777', -6], ["Coût main-d'œuvre (%)", 'Main-d’œuvre', '#F59E0B', 6]]
        : [['Coût matière ($/u.)', 'Coût matière', '#10B981', 0], ['Coût emballage ($/u.)', 'Emballage', '#DB2777', -6], ["Coût main-d'œuvre ($/u.)", 'Main-d’œuvre', '#F59E0B', 6], ['Coût de revient ($/u.)', 'Coût de revient', '#2563EB', 0]];
    const unit = F.priced ? '%' : '$';
    const all = spec.flatMap(([key]) => ser.map(s => s[key]));
    const sc = niceScale(all, { ticks: 4, includeZero: F.priced });
    const last = (key) => [...ser.map(s => s[key])].reverse().find(finite);
    const series = spec.map(([key, name, color, ly]) => ({ name: `${name} ${f(last(key), F.priced ? 1 : 2)} ${unit}`, color, vals: ser.map(s => s[key]), endLabel: '', ly }));
    return h3('Évolution des indicateurs du produit', F.priced ? `% du prix de vente, ${ser.length} relevés` : `$ par unité, ${ser.length} relevés`)
        + `<div>${lineChart({ h: 175, padR: 128, labels, series, ymin: sc.min, ymax: sc.max, ystep: sc.step, yfmt: v => (F.priced ? `${f(v)} %` : `${f(v, 2)} $`), xEvery: Math.max(1, Math.ceil(labels.length / 6)) })}</div>`;
}

/** Une fiche. Le premier bloc porte le saut de page forcé et le repère de la fiche. */
export function ficheHtml(F, m) {
    const k = F.costs, cls = F.cls ? CLASSES[F.cls] : null;
    const status = F.status === 'resale' ? LABELS.statusResale : F.status === 'sub' ? LABELS.statusSub : LABELS.statusFinished;
    const hasRecipe = F.lines.ingredients.length || F.lines.packaging.length || F.lines.steps.length;
    const top = F.topIngredients.length ? `Principaux ingrédients : ${F.topIngredients.map(i => `${esc(i.name)} ${c2(i.cost)}${i.share != null ? ` (${f(i.share * 100)} % de la matière)` : ''}`).join(' · ')}. ` : '';
    const comp = hasRecipe ? `<div style="margin:1.6mm 0 0;font-size:7.4pt;color:var(--secondary)">${top}${F.minutes > 0 ? `Main-d’œuvre : ${f(F.minutes, 1)} min par lot de ${f(F.nbPortions)}. ` : ''}${finite(k.contribution) ? `Marge de contribution : ${c2(k.contribution)}${finite(k.contributionPct) ? ` (${pc(k.contributionPct, 1)})` : ''}.` : ''}</div>` : '';
    const tileCost = (label, v, p) => `<div class="tile" style="min-height:10mm"><div class="l">${label}</div><div class="v" style="font-size:11pt">${c2(v)}</div>${finite(p) ? `<div class="c mut">${pc(p, 1)} du prix</div>` : ''}</div>`;
    let h = `<div data-break="before" data-keep="next">${mark(F.mark)}<div class="fiche-head nx"><div><div style="font-size:14pt;font-weight:700">${esc(F.name)}</div>`
        + `<div class="mut">Lot de ${f(F.nbPortions)} portions de ${esc(String(F.portionSize))} ${esc(F.portionUnit)}${F.activity ? ` · ${esc(F.activity)}` : ''}</div></div>${cls ? `<span class="badge ${cls.css}">${cls.label}</span>` : ''}</div></div>`;
    h += `<table class="tb" data-keep="next" style="font-size:7.8pt;margin-bottom:1.2mm;--pad:1.1mm"><tbody><tr><td class="l">PDS : <b>${F.pds ? c2(F.pds) : '—'}</b></td><td class="l">Unités produites : <b>${f(F.nbPortions)}</b></td><td class="l">Format par portion : <b>${esc(String(F.portionSize))} ${esc(F.portionUnit)}</b></td><td class="l">Statut : <b>${status}</b></td><td class="l">Allergènes : <b>${F.allergens.length ? esc(F.allergens.join(', ')) : LABELS.noAllergen}</b></td></tr></tbody></table>`;
    h += `<div class="mut" data-keep="next" style="font-size:7.2pt;margin:2.6mm 0 1mm">Coût de production (identique dans tous les canaux)</div>`
        + `<div class="tiles4" style="grid-template-columns:repeat(${k.subcontracting > 0 ? 5 : 4},1fr)">`
        + tileCost('Coût matière', k.material, k.materialPct) + tileCost('Emballage', k.packaging, k.packagingPct) + tileCost('Main-d’œuvre', k.labor, k.laborPct)
        + (k.subcontracting > 0 ? tileCost('Coûts additionnels', k.subcontracting) : '')
        + `<div class="tile" style="min-height:10mm;background:#fff;border:.5mm solid #9CA3AF"><div class="l">Coût de production (total)</div><div class="v" style="font-size:12pt">${c2(k.production)}</div></div></div>${comp}`;
    const casc = cascadeTable(F);
    if (casc) h += h3('Cascade de marge par canal', 'du PDS à la marge nette') + casc;
    // Les constats du produit viennent APRÈS la cascade : on lit d'abord les chiffres, puis ce que les règles de l'application en disent.
    if (F.findings.length) h += h3('Constats du produit', 'les règles de l’application, appliquées à ce format') + productFindings(F);
    h += recipeDetail(F) + evolution(F, m);
    return h;
}

/** Introduction du chapitre 7 : guide de lecture et liste des fiches avec leur page. */
export function ficheIntro(m, map) {
    return h3('Comment lire une fiche', null, { first: true }) + `<div class="card"><ol style="margin:0;padding-left:4.4mm">`
        + `<li><b>Bandeau</b> : le produit, son format, sa classe stratégique, ses paramètres (PDS, unités, statut, allergènes).</li>`
        + `<li><b>Coût de production</b>, puis la <b>cascade de marge par canal</b>, identique à l’écran Par SKU : du PDS jusqu’à la marge nette et au point mort.</li>`
        + `<li><b>Constats du produit</b> : les règles des constats clés, appliquées à ce format.</li>`
        + `<li><b>Détail de la recette</b> : matières premières, emballage, main-d’œuvre par étape, avec le coût de chaque ligne.</li>`
        + `<li><b>Évolution</b> du produit sur les points de référence.</li></ol>`
        + `<p style="margin:2mm 0 0"><b>Chaque fiche commence sur sa propre page.</b> Si une fiche est longue, ses tableaux se coupent proprement (en-tête répété, « suite » au titre) et la cascade ne se coupe qu’entre deux sections.</p></div>`
        + h3('Fiches de ce chapitre', `une par format ; marges et classes : tableau de la ${pageRef(map, 'skutable')}`)
        + `<div class="idx" data-split="items">${m.fiches.map(F => `<div><span>${esc(F.name)}</span><b>${pageRef(map, F.mark)}</b></div>`).join('')}</div>`;
}
