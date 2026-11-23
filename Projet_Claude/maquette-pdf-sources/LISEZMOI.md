# Sources de la maquette du rapport PDF (22/11/2026)

Référence pour les phases 3 et 4 du plan `../12-Plan-Export-PDF.md`. **Ce n'est pas du code de l'application** : ces fichiers ont produit `../Maquette-Rapport-PDF.html`.

- `pages3.js` : le contenu des chapitres, les gabarits (tableaux, graphiques SVG, fiches) et **le moteur de pagination** (mesure DOM, coupures aux lignes, titres collés, saut forcé avant chaque fiche, numéros de page en plusieurs passes). C'est le point de départ du moteur de mise en page de la phase 3.
- `tail3.js` : couverture, sommaire, introduction, montage.
- `template.html` : styles et fonctions de dessin (barres, courbes, cascade).
- `build3.js` : assemble les données du démo (`donnees-demo/`, extraites du moteur de l'application) et produit le fichier HTML.
- Les logos (en base 64) ne sont pas conservés ici : ils sont dans le fichier HTML final.
