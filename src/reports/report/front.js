// Couverture, sommaire et cadre des pages du rapport PDF (phase 4 de la refonte de l'export, 22/11).
import { esc, f, longDate, shortMonth } from './format.js';
import { h3 } from './ui.js';
import { CHAPTERS, COVER } from './strings.js';

const company = (m) => m.company.name || 'l’entreprise';

/** Couverture : la page de garde actuelle reprise (cadre, logo de l'application, titre, « présenté à », date). */
export function coverHtml(m, o) {
    const who = (o.presentedTo || '').trim();
    return `<div class="cover"><div class="frame"></div>`
        + (o.appLogo ? `<img src="${esc(o.appLogo)}" alt="" style="position:absolute;top:80mm;left:45mm;width:120mm">` : '')
        + `<div style="position:absolute;top:140mm;left:20mm;right:20mm;text-align:center;font-size:28pt;font-weight:700;line-height:1.15">${esc((o.title || '').trim() || COVER.title)}</div>`
        + `<div style="position:absolute;top:196mm;left:20mm;right:20mm;text-align:center;font-size:18pt;color:var(--secondary)">${esc(who ? COVER.presentedTo(who) : COVER.defaultLine(company(m)))}</div>`
        + `<div style="position:absolute;bottom:30mm;left:0;right:0;text-align:center;font-size:12pt;color:var(--gray)">Date : ${esc(longDate(o.generatedOn))}</div></div>`;
}

const row = (label, value) => `<tr><td class="l">${esc(label)}</td><td>${value}</td></tr>`;

/** Sommaire (numéros de page de la carte des pages) et « À propos de ce rapport ». Les chapitres exclus n'y figurent pas. */
export function tocHtml(m, map, included) {
    const s = m.scope, t = m.targets;
    const targets = [['matière', t.material], ['emballage', t.packaging], ['MO', t.labor], ['marge brute min.', t.grossMargin]].filter(([, v]) => v).map(([n, v]) => `${n} ${f(v)} %`).join(' · ');
    const about = [
        m.period ? row('Période analysée', esc(m.period)) : '',
        row('Portée', `${f(s.products)} produit${s.products > 1 ? 's' : ''} · ${f(s.channels)} canal${s.channels > 1 ? 'ux' : ''} · ${f(s.activities)} activité${s.activities > 1 ? 's' : ''}`),
        row('Intrants suivis', `${f(s.ingredients)} ingrédient${s.ingredients > 1 ? 's' : ''} · ${f(s.packaging)} emballage${s.packaging > 1 ? 's' : ''}`),
        s.posts ? row('Équipe', `${f(s.posts)} poste${s.posts > 1 ? 's' : ''} · ${f(s.employees)} employé${s.employees > 1 ? 's' : ''}`) : '',
        s.points ? row('Points de référence', `${f(s.points)} (${esc(shortMonth(s.firstPoint))} à ${esc(shortMonth(s.lastPoint))})`) : row('Points de référence', 'aucun'),
        row('Objectifs principaux saisis', targets ? esc(targets) : 'aucune'),
        row('Chiffres réels saisis', s.hasRealData ? 'oui' : 'non'),
    ].join('');
    const list = CHAPTERS.filter(c => included.includes(c.id) && map.chapters[`ch${c.id}`]);
    return h3('Sommaire', null, { first: true })
        + `<ul class="toc">${list.map(c => `<li><span class="n">${esc(c.n)}</span><span><span class="t">${esc(c.title)}</span><span class="tab">${esc(c.tab)}</span><br><span class="q">${esc(c.question)}</span></span><span class="p">${map.chapters[`ch${c.id}`]}</span></li>`).join('')}</ul>`
        + `<div class="two" style="margin-top:5mm"><div class="card"><h4>À propos de ce rapport</h4><table class="tb" style="font-size:7.6pt"><tbody>${about}</tbody></table></div>`
        + `<div class="card"><h4>Comment lire les chiffres</h4><p style="margin:0 0 1.4mm"><b>Prévu</b> : calculé à partir de vos recettes, prix et volumes de ventes.<br><b>Réel</b> : ce que vous avez saisi dans l’État des résultats.<br><b>PDS</b> : prix de détail suggéré, point de départ de la cascade de prix.<br><b>Marge nette</b> : après frais fixes.</p>`
        + `<div class="legend"><span><i style="background:var(--green)"></i>Matières</span><span><i style="background:var(--pink)"></i>Emballage</span><span><i style="background:var(--yellow)"></i>Main-d’œuvre</span><span><i style="background:var(--purple)"></i>Frais fixes</span><span><i style="background:var(--primary)"></i>Marge / bénéfice</span></div>`
        + `<p style="margin:1.6mm 0 0;color:var(--gray)">Une couleur est toujours accompagnée d’un chiffre, d’un mot ou d’un signe (+ / −).</p></div></div>`;
}

/** En-tête d'une page de contenu : nom de l'entreprise, chapitre, logo de l'entreprise. */
export const headerHtml = (m, chapterId) => {
    const c = CHAPTERS.find(x => x.id === String(chapterId));
    const label = chapterId === 'A' ? '<b>Annexes</b>' : c ? `<b>Chapitre ${esc(c.n)}</b> · ${esc(c.title)}` : '<b>Sommaire</b> et guide de lecture';
    return `<div class="phead"><div class="co">${esc(m.company.name)}</div><div class="sub">${label}</div>${m.company.logo ? `<img src="${esc(m.company.logo)}" alt="">` : ''}</div>`;
};
export const footerHtml = (generatedOn, n, total, chapterId) => `<span>Rapport généré le ${esc(longDate(generatedOn))}</span><span>Page ${n} sur ${total}</span><span>${chapterId ? (chapterId === 'A' ? 'Annexes' : `Chap. ${esc(chapterId)}`) : ''}</span>`;
