// Annexes du rapport PDF (phase 4 de la refonte de l'export, 22/11) : A ingrédients, B emballages, C équipe (facultative : salaires individuels), D glossaire et repères.
import { f, usd, esc } from './format.js';
import { h3, mark } from './ui.js';
import { REPORT_THRESHOLDS as T } from '../../engine/reportThresholds.js';

const CLASS_BG = { A: 'var(--red-bg)', B: 'var(--amber-bg)', C: 'var(--green-bg)' };

const catalogueTable = (label, rows) => {
    const sorted = [...rows].sort((a, b) => (a.cls || 'Z').localeCompare(b.cls || 'Z', 'fr') || a.name.localeCompare(b.name, 'fr'));
    return `<table class="tb" data-split="rows" style="font-size:7.8pt"><thead><tr><th style="text-align:left">${label}</th><th>Classe</th><th style="text-align:left">Fournisseur</th><th>Format d’achat</th><th>Prix d’achat</th><th>Perte</th><th>Prix unitaire</th></tr></thead><tbody>`
        + sorted.map(i => `<tr><td class="l"><b>${esc(i.name)}</b></td><td${i.cls ? ` style="background:${CLASS_BG[i.cls]}"` : ''}><b>${i.cls || '—'}</b></td><td class="l">${esc(i.provider)}</td><td>${f(Number(i.purchaseFormat), 0)} ${esc(i.unit || '')}</td><td>${usd(Number(i.purchasePrice), 2)}</td><td>${f(i.loss)} %</td><td>${usd(Number(i.unitPrice), 2)}/${esc(i.unit || '')}</td></tr>`).join('') + `</tbody></table>`;
};

export const annexA = (m) => (m.catalogues.ingredients.length
    ? mark('annA') + h3('Annexe A — Ingrédients', `${m.catalogues.ingredients.length} lignes, classées A, B, C`, { first: true }) + catalogueTable('Ingrédient', m.catalogues.ingredients) : '');
export const annexB = (m, first) => (m.catalogues.packaging.length
    ? mark('annB') + h3('Annexe B — Emballages', `${m.catalogues.packaging.length} lignes, classées A, B, C`, { first }) + catalogueTable('Emballage', m.catalogues.packaging) : '');

/** Annexe C : seulement si l'entrepreneur coche « Inclure les salaires individuels » (un rapport transmis à un banquier ne doit pas les contenir sans l'avoir voulu). */
export const annexC = (m, first) => {
    const posts = m.labor.posts.filter(p => p.employees.length);
    if (!posts.length) return '';
    return mark('annC') + h3('Annexe C — Équipe', 'salaires individuels', { first })
        + `<table class="tb" data-split="rows" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Employé</th><th>Salaire horaire</th><th>Charges</th><th>Vacances</th><th>Heures payées</th><th>Coût chargé</th></tr></thead><tbody>`
        + posts.map(p => `<tr><td class="l" colspan="6" style="background:#E5E7EB;font-weight:700">${esc(p.name)}</td></tr>` + p.employees.map(e => `<tr><td class="l">${esc(e.name)}</td><td>${usd(e.rate, 2)}</td><td>${f(e.charges)} %</td><td>${f(e.vacation)} %</td><td>${f(e.hours)} h</td><td>${usd(e.loaded)}</td></tr>`).join('')).join('') + `</tbody></table>`;
};

/** Annexe D : glossaire (termes employés) et repères des seuils des constats, lus dans le fichier des seuils au moment de l'export. */
export const annexD = (glossary, glossaryTotal, first) => {
    if (!glossary.length) return '';
    const p = (r) => `${f(r * 100)} %`;
    const marks = [
        ['Marge de sécurité confortable · mince', `≥ ${p(T.safetyMarginComfortable)} · < ${p(T.safetyMarginLow)}`],
        ['Dépendance à un fournisseur (part des achats)', `≥ ${p(T.providerDependency)}`],
        ['Dépendance à un canal (part des revenus)', `≥ ${p(T.channelDependency)}`],
        ['Perte stock élevée · faible (part des achats)', `≥ ${p(T.lossShareHigh)} · < ${p(T.lossShareLow)}`],
        ['Paie non utilisée élevée · faible', `≥ ${p(T.unusedPayHigh)} · ≤ ${p(T.unusedPayLow)}`],
        ['Marge nette très faible', `< ${p(T.lowNetMargin)}`],
    ];
    return mark('annD') + h3('Annexe D — Glossaire', `${glossary.length} termes employés dans ce rapport, sur ${glossaryTotal} dans le guide`, { first })
        + `<table class="tb" data-split="rows" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Terme</th><th style="text-align:left">Définition</th></tr></thead><tbody>`
        + glossary.map(d => `<tr><td class="l" style="white-space:nowrap;vertical-align:top"><b>${esc(d.term)}</b></td><td class="l">${esc(d.def)}</td></tr>`).join('') + `</tbody></table>`
        + h3('Repères utilisés par les constats clés', 'ordres de grandeur de gestion, non des normes')
        + `<table class="tb" data-split="rows" style="font-size:7.6pt"><thead><tr><th style="text-align:left">Repère</th><th>Seuil</th></tr></thead><tbody>${marks.map(([a, b]) => `<tr><td class="l">${esc(a)}</td><td>${b}</td></tr>`).join('')}</tbody></table>`
        + `<div class="src">Ces chiffres sont des prévisions fondées sur vos recettes, prix et volumes saisis. Ils ne remplacent pas des états financiers vérifiés.</div>`;
};
