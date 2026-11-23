/* ============ Pages fixes (couverture, sommaire) et montage ============ */
initMeasure();
let OUT = null;
for (let i = 0; i < 6; i++) {
  OUT = renderAll();
  const same = JSON.stringify(OUT.newMap) === JSON.stringify(PM);
  PM.seg = OUT.newMap.seg; PM.chap = OUT.newMap.chap; PM.total = OUT.newMap.total;
  if (same) break;
}
document.body.removeChild(MW);

const indirectLabel = { directCost: 'Au prorata des coûts directs', laborTime: 'Au prorata du temps de production', volume: 'Au prorata du volume physique' }[D.method] || '';
const sheetFixed = (n, sub, body, note, full) => `<section class="sheet" id="p${n}"><div class="page${full ? '' : ' std'}">${full ? `<div class="pbody full">${body}</div>` : `${head(sub)}<div class="pbody dense">${body}</div><div class="pfoot"><span>Rapport généré le 21 novembre 2026</span><span>Page ${n} sur ${PM.total}</span><span></span></div>`}</div><aside class="note">${note}</aside></section>`;
const COVER = sheetFixed(1, '', `<div class="cover"><div class="frame"></div>
   <img src="${APP_LOGO}" alt="" style="position:absolute;top:80mm;width:120mm;left:45mm">
   <div style="position:absolute;top:140mm;left:20mm;right:20mm;text-align:center;font-size:28pt;font-weight:700;line-height:1.15">Rapport d’analyse du coût de revient</div>
   <div style="position:absolute;top:196mm;left:20mm;right:20mm;text-align:center;font-size:18pt;color:var(--secondary)">Préparer à l’attention des gestionnaires de ${esc(CO)}</div>
   <div style="position:absolute;bottom:30mm;left:0;right:0;text-align:center;font-size:12pt;color:var(--gray)">Date : 21 novembre 2026</div></div>`,
  `<h5>Page de garde</h5><p>Reprise telle quelle de la page actuelle : cadre, logo de l’application, titre, « présenté à », date.</p>${prov([['pdf', 'toute la page']])}`, true);
const TOC = sheetFixed(2, '<b>Sommaire</b> et guide de lecture', `<h3 class="s" style="margin-top:0">Sommaire</h3>
   <ul class="toc">${CHAPS.map(c => `<li><span class="n">${c.n}</span><span><span class="t">${c.t}</span><span class="tab">${c.tab}</span><br><span class="q">${c.q}</span></span><span class="p">${PM.chap[c.n]}</span></li>`).join('')}</ul>
   <div class="two" style="margin-top:5mm">
    <div class="card"><h4>À propos de ce rapport</h4>
      <table class="tb" style="font-size:7.6pt"><tbody>
       <tr><td class="l">Période analysée</td><td>du 1<sup>er</sup> au 31 octobre 2026 <span class="mut">(exemple)</span></td></tr>
       <tr><td class="l">Portée</td><td>12 produits · 3 canaux · 3 activités</td></tr>
       <tr><td class="l">Intrants suivis</td><td>18 ingrédients · 8 emballages</td></tr>
       <tr><td class="l">Équipe</td><td>4 postes · 8 employés</td></tr>
       <tr><td class="l">Points de référence</td><td>19 (mai 2025 à nov. 2026)</td></tr>
       <tr><td class="l">Cibles de coûts saisies</td><td>matière 32 % · emballage 8 % · MO 22 %</td></tr>
       <tr><td class="l">Chiffres réels saisis</td><td>oui</td></tr>
      </tbody></table></div>
    <div class="card"><h4>Comment lire les chiffres</h4>
      <p style="margin:0 0 1.4mm"><b>Prévu</b> : calculé à partir de vos recettes, prix et volumes de ventes.<br><b>Réel</b> : ce que vous avez saisi dans l’État des résultats.<br><b>PDS</b> : prix de détail suggéré, point de départ de la cascade de prix.<br><b>Marge nette</b> : après frais fixes.</p>
      <div class="legend"><span><i style="background:var(--green)"></i>Matières</span><span><i style="background:var(--pink)"></i>Emballage</span><span><i style="background:var(--yellow)"></i>Main-d’œuvre</span><span><i style="background:var(--purple)"></i>Frais fixes</span><span><i style="background:var(--primary)"></i>Marge / bénéfice</span></div>
      <p style="margin:1.6mm 0 0;color:var(--gray)">Une couleur est toujours accompagnée d’un chiffre, d’un mot ou d’un signe (+ / −).</p></div>
   </div>`,
  `<h5>Sommaire</h5><p>Le PDF actuel n’a ni sommaire ni chapitres. Chaque chapitre porte une question de gestion ; la pastille grise rappelle l’onglet de l’application. Les numéros de page sont calculés par la mise en page.</p><p><b>Période :</b> elle vient des dates de début et de fin saisies dans l’État des résultats (ou lues à l’import), imprimées en toutes lettres. Sans dates saisies, la ligne est omise, jamais remplacée par une valeur inventée. Le projet démo n’a pas de dates : celles de cette page sont un <b>exemple</b>. Le PDF actuel imprimait les deux dates brutes (aaaa-mm-jj).</p>${prov([['calc', 'sommaire et numéros de page'], ['app', 'cibles, nombre de produits, relevés : lus dans votre projet']])}`, false);

const SHEETS = [COVER, TOC].concat(OUT.pagesOf.map(p => pageHTML(p.n, p.c, p.nodes, p.dense, p.keys.map(k => NOTES[k]).filter(Boolean).join('<hr>') || NOTE_SUITE)));

const INTRO = `<div class="intro" id="intro">
<h1>Rapport PDF : la maquette</h1>
<p style="margin-top:0;color:#6B7280">Données du projet démo (${esc(CO)}), calculées par le moteur de l’application. Aucun fichier de l’application n’a été modifié. Rapport complet : ${PM.total} pages.</p>

<h2>1. Décisions retenues</h2>
<ul>
<li><b>La mise en page coule :</b> le contenu passe d’une page à l’autre sans vide. Seul le début d’un chapitre commence une nouvelle page. Les tableaux se coupent par lignes (en-tête répété, « suite » au titre), les listes de constats ligne par ligne, la cascade d’une fiche entre deux sections ; un titre n’est jamais seul en bas de page. Les pages de cette maquette sont <b>calculées</b> par ce moteur de mise en page, pas dessinées à la main.</li>
<li><b>Les constats démarrent dès la première page du chapitre 1</b>, juste après les tuiles.</li>
<li><b>Exception : chaque fiche commence sur sa propre page.</b> Le chapitre 7 s’ouvre sur un guide de lecture et la liste des fiches avec leur page.</li>
<li><b>Ingrédients et emballages ont les mêmes modules</b>, dans le même ordre : tuiles (coût net, perte stock, achat requis), achats par fournisseur, ABC avec la liste de tous les éléments, perte stock, prix volatils, constats. Le même composant les alimente dans l’application.</li>
<li><b>Fiches produits depuis le PDS</b>, comme l’écran Par SKU, une par format : bandeau, constats du produit, coût de production, cascade de marge par canal, puis le détail de la recette, en trois petits tableaux côte à côte (matières, emballage, main-d’œuvre), et la courbe de marge nette.</li>
<li><b>Un seul tableau de produits</b> (chapitre 3) : du PDS à la marge nette, avec la classe et le renvoi à la fiche.</li>
<li><b>Annexe D : seulement les termes du glossaire du guide qui figurent dans le rapport</b>, mot pour mot. La sélection est automatique et suit les chapitres inclus.</li>
<li><b>Commentaire de la direction</b> : imprimé seulement si l’entrepreneur l’a saisi à l’export. Sans commentaire, aucune case ni aucun espace n’est réservé (la synthèse n’en a donc pas ici ; le chapitre 2 montre un exemple saisi).</li></ul>

<h2>2. Sans IA : ce qui existe, ce qu’il faudrait développer</h2>
<p>Rien dans ce rapport n’est écrit par une IA. Voici l’état de chaque élément, pour que vous voyiez ce que l’application fait déjà et ce qui reste à construire, toujours avec des règles fixes :</p>
<table><tr><th>Élément</th><th>État</th></tr>
<tr><td>Tuiles, constats clés, matrices, tableaux, courbes, réconciliation, achats, ABC, main-d’œuvre, cascade par SKU</td><td><span class="pill rich">Existe</span> dans Rapport et suivi (le rapport les imprime)</td></tr>
<tr><td>Glossaire, seuils des constats</td><td><span class="pill rich">Existe</span> (guide, fichier des seuils) ; le rapport les reprend tels quels</td></tr>
<tr><td>Cascade du revenu au bénéfice, « sur chaque dollar de vente », colonnes part et marge de sécurité par canal, tableau 3 relevés / 12 mois</td><td><span class="pill new">Calcul simple</span> : division ou mise en série de chiffres déjà affichés</td></tr>
<tr><td><b>Constats du produit</b> (en tête de chaque fiche)</td><td><span class="pill new">À développer</span> : les règles existantes (classe, produit déficitaire, coût matière au-dessus de la cible, bénéfice brut par heure, écart entre formats) appliquées à un seul format</td></tr>
<tr><td><b>« Ce que cela veut dire »</b> (4 blocs : réconciliation, évolution, activité × canal, main-d’œuvre)</td><td><span class="pill new">À développer</span> : phrases à gabarit avec un seuil (± 5 %), un sommet, un creux ; aucune cause affirmée en dehors de celles que l’application cite déjà</td></tr>
<tr><td>Ligne « principaux ingrédients » de la fiche</td><td><span class="pill new">À développer</span> : tri des trois lignes les plus coûteuses</td></tr>
<tr><td>Sélection automatique des termes du glossaire (recherche dans le texte du rapport)</td><td><span class="pill new">À développer</span></td></tr>
<tr><td>Fenêtre d’export : chapitres, <b>commentaire par chapitre (imprimé seulement s’il est saisi)</b>, annexe des salaires ; et moteur de mise en page (saut de page forcé avant chaque fiche)</td><td><span class="pill new">À développer</span></td></tr></table>

<h2>3. Provenance des éléments</h2>
<p><span class="pill rich">Écran de l’application</span> repris d’un écran de Rapport et suivi, avec ses chiffres.<br>
<span class="pill rich">Glossaire du guide</span> définition reprise mot pour mot.<br>
<span class="pill new">Calcul simple</span> assemblage ou division de chiffres déjà affichés.<br>
<span class="pill new">Texte par règle (à développer)</span> phrase à gabarit dont le contenu dépend des chiffres.<br>
<span class="pill old">Repris du PDF actuel</span> déjà exporté aujourd’hui.</p>

<h2>4. Fenêtre d’export proposée <span style="font-weight:400;font-size:13px;color:#6B7280">(non réalisée)</span></h2>
<ul><li>Titre et « présenté à » (inchangés).</li><li>Chapitres à inclure : tous cochés ; un chapitre sans donnée est grisé, avec la raison.</li><li>Un champ « Commentaire de la direction » par chapitre. Un chapitre sans commentaire n’imprime rien.</li><li><b>Inclure les salaires individuels</b> (annexe C) : décoché.</li></ul>
<p style="color:#6B7280;font-size:13px">Les pages ci-dessous sont à l’échelle (A4).</p>
</div>`;
document.getElementById('main').innerHTML = INTRO + SHEETS.join('');
document.getElementById('nav').innerHTML = `<h4>Navigation</h4><a href="#intro">La réflexion</a><div class="grp"><a href="#p1">1 · Couverture</a><a href="#p2">2 · Sommaire</a></div>` + CHAPS.map(c => `<div class="grp"><a href="#p${PM.chap[c.n]}"><b>${c.n}</b> · ${c.t}</a></div>`).join('');
document.getElementById('tgl').addEventListener('change', e => document.body.classList.toggle('hide-notes', !e.target.checked));
window.__PM = PM;
</script>
</body>
</html>
