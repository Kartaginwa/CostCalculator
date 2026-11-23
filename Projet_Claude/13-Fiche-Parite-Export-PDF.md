# Fiche de parité — ancien PDF et nouveau rapport

Statut : **à valider par l'utilisateur** (phase 0 du plan `12-Plan-Export-PDF.md`, 22/11/2026). Source de l'ancien PDF : `src/reports/generatePdf.js`. Nouveau rapport : `Maquette-Rapport-PDF.html`.

Statuts : **Conservé** (même information, même endroit) · **Amélioré** · **Déplacé** · **Retiré** (avec la raison). La colonne « Perte » dit s'il y a une perte de granularité.

## Pages générales

| Élément de l'ancien PDF | Dans le nouveau rapport | Statut | Perte |
|---|---|---|---|
| Couverture (cadre, logo de l'application, titre, « présenté à », date) | Identique | Conservé | Non |
| En-tête de page : nom de l'entreprise, titre de page, logo de l'entreprise (étiré en 40 × 15 mm) | Nom, chapitre, logo aux proportions respectées, segment vert | Amélioré | Non |
| Pied de page : date de génération, « Page n sur N » (sauf couverture) | Idem + chapitre, bandeau bleu et vert | Conservé | Non |
| Paramètres généraux : période (dates brutes aaaa-mm-jj) | Page 2, en toutes lettres, **omise si les dates sont absentes** | Amélioré | Non |
| Paramètres généraux : frais indirects (total) | Cascade « du revenu au bénéfice » (frais fixes) | Déplacé | Non |
| Paramètres généraux : coût de main-d'œuvre de production | Cascade (main-d'œuvre) et masse salariale (chapitre 6) | Déplacé | Non |
| KPI globaux (coût matière, emballage, main-d'œuvre, marge brute, point mort) | Six tuiles (+ marge de sécurité), avec cible ou repère | Amélioré | Non |
| Classement par contribution (5 premiers) | Classement complet (12) | Amélioré | Non |
| Matrice stratégique (4 boîtes en liste) | Matrice 2 × 2 avec axes nommés | Amélioré | Non |
| ABC des ingrédients (A et B complets, C : 8 premiers) | ABC complet, ingrédients **et** emballages, avec la part de chaque classe | Amélioré | Non |
| Synthèse des achats (3 totaux) | Tuiles (coût net, perte stock, achat requis) + fournisseurs, perte stock, prix volatils | Amélioré | Non |
| Rapport de productivité par poste | Même tableau + masse salariale, paie non utilisée, coût réel d'une heure | Amélioré | Non |
| Évolution globale (3 lignes : marge brute, coût matière, main-d'œuvre) | 4 lignes comme l'application (**emballage ajouté**) + tableau 3 relevés / 12 mois | Amélioré | Non |
| Page de titre vide de la « partie 2 » | Supprimée | Retiré (aucune information) | Non |

## Fiche d'un produit (deux pages par format dans l'ancien PDF)

| Élément de l'ancien PDF | Dans le nouveau rapport | Statut | Perte |
|---|---|---|---|
| Paramètres : prix de vente, unités produites, format par portion, statut, allergènes | PDS, unités, format, statut, allergènes ; **prix de vente par canal** dans la cascade | Conservé / déplacé | Non |
| Matières premières : quantité, unité, coût de base, coût de perte, rendement %, total, par ligne ; totaux base et perte | Petit tableau : quantité, total par ligne ; total des matières avec la perte | Amélioré en lisibilité | **Oui : base, perte et rendement par ligne** (décision D2 : acceptée) |
| Emballage : base, perte, total par ligne | Petit tableau : quantité, total par ligne ; total | Conservé en partie | **Oui : base et perte par ligne** (D2) |
| Main-d'œuvre : étape, personnel (« 2x poste »), durée, coût direct, indirect, total ; totaux direct et indirect | Étape, personnel (N×), durée, total ; total | Conservé en partie | **Oui : coût direct et indirect par étape** (vocabulaire à changer) |
| Frais indirects : méthode d'attribution et montant par portion | Charges fixes de la cascade (Général, Activité, Canal, total) ; **méthode non affichée** | Déplacé | **Oui : le nom de la méthode** (décision du 22/11 : le modèle passe aux CICI) |
| KPI du produit : prix de vente, ratios matière / emballage / main-d'œuvre, coût de revient, marge de contribution, marge brute, marge nette | Tuiles de coût avec ratios, marge de contribution, cascade par canal (brute, coût net, nette) | Déplacé | Non |
| Point mort et classification (canal principal seulement) | Point mort **de chaque canal** + pastille de classe | Amélioré | Non |
| Deux camemberts (prix de vente, coût de revient) | Remplacés par les tuiles et la cascade | Retiré (information chiffrée conservée) | Visuel seulement |
| Évolution du produit : 4 lignes en % ; repli en $/unité sans prix | **5 lignes comme l'application** (emballage ajouté) ; le repli en $/unité est prévu au développement (le démo n'a pas de produit sans prix) | Amélioré | Non |

## Annexes

| Élément de l'ancien PDF | Dans le nouveau rapport | Statut | Perte |
|---|---|---|---|
| Annexe A : tableau récapitulatif (prix de vente, coût total, marge brute $ et %, marge nette $ et %, **tous canaux**) | Tableau « du PDS à la marge nette » (chapitre 3) : PDS, coût de production, prix et **marge nette par canal**, classe, renvoi à la fiche ; marges brutes et nettes en $ et % par canal dans les fiches | Déplacé | **Question ouverte** : la marge brute et la marge nette **agrégées tous canaux** d'un format ne sont plus imprimées |
| Annexe B : ingrédients (fournisseur, format, prix d'achat, perte, prix unitaire) | Annexe A : mêmes colonnes + classe ABC ; annexe B : emballages, mêmes colonnes | Amélioré | Non |
| Annexe C : employés | Annexe C, **optionnelle** (case décochée par défaut) | Conservé | Non |

## Éléments nouveaux (sans équivalent dans l'ancien PDF)
Sommaire et chapitres ; constats clés (tous, puis par chapitre) ; classement des constats (portée, gravité) ; marge de sécurité ; réconciliation réel / théorique ; cascade du revenu au bénéfice ; « sur chaque dollar de vente » ; marges par canal et par activité, matrice activité × canal ; achats par fournisseur et dépendance ; perte stock ; prix volatils ; emballages (mêmes modules que les ingrédients) ; paie non utilisée, coût réel d'une heure, marge de croissance, rentabilité à l'heure ; constats du produit ; blocs « Ce que cela veut dire » ; commentaires de la direction ; glossaire des termes employés.

## Corrections de la maquette faites en phase 0 (22/11)
- Courbe d'évolution globale : ajout de la ligne **Coût emballage** (variables de l'application : marge brute, matière, emballage, main-d'œuvre) et de la ligne correspondante dans le tableau 3 relevés / 12 mois.
- Courbe d'évolution d'un produit : ajout de la ligne **Emballage** (variables de l'application : matière, emballage, main-d'œuvre, frais, marge nette).
- Palette de la maquette conservée (D9) ; courbes de prix par ingrédient non reprises (D8).

## Questions à trancher pour la fiche
1. **Marge « tous canaux » d'un format** : l'ajouter comme colonne du tableau de la page 9 (comble la seule perte non voulue) ou s'en passer ?
2. **Libellé de la troisième ligne de la courbe d'un produit** : l'application dit « Coût frais indirects » ; la maquette dit « Frais fixes ». Garder « Frais fixes » (cohérent avec la cascade) ou reprendre le libellé de l'application ?
3. **Courbe en $/unité d'un produit sans prix** : prévue au développement ; elle ne peut pas figurer dans la maquette (aucun produit sans prix dans le démo). Rien à décider, à vérifier à la phase 7.

## Réalisation (phase 4, 22/11)
- Les trois petits tableaux de la recette (matières, emballage, main-d'œuvre par étape) sont imprimés avec le coût de chaque ligne, lu dans le moteur (`calculateCostLines`) : la ligne « principaux ingrédients » est réalisée. Toujours absents, comme convenu : base, perte et rendement par ligne, coût direct et indirect par étape, nom de la méthode d'attribution.
- Le rapport complet du démo (44 pages) est dans `Exemple-Rapport-Phase4.pdf`.

## Vérification de la parité (phase 7, 22/11)
Le test `e2e/report-parity.spec.js` imprime le rapport complet du démo et relit le PDF (pdfjs) : **chaque ligne de ce tableau au statut « conservé », « amélioré » ou « déplacé » y est vérifiée**, et les éléments « retirés » sont vérifiés **absents** (la perte est assumée, jamais accidentelle).
- Pages générales : titre, « présenté à », date de la couverture ; nom de l'entreprise en en-tête ; date de génération et « Page n sur N » ; frais fixes et main-d'œuvre dans la cascade, masse salariale ; six indicateurs ; classement par contribution **complet** (12 produits) ; matrice 2 × 2 avec ses quatre consignes ; ABC de **tous** les ingrédients et emballages ; achats (coût net, perte stock, achat requis, fournisseurs) ; rapport de productivité (mêmes colonnes, tous les postes) ; évolution globale à quatre lignes (emballage ajouté) avec le tableau 3 relevés / 12 mois ; plus de page de titre vide.
- Chaque fiche (12 formats) : nom, PDS, unités, format par portion, statut, allergènes ; chaque ligne de matières, d'emballage et chaque étape de la recette ; coûts et marge de contribution ; cascade jusqu'à la marge nette et au point mort ; courbe d'évolution.
- Annexes : A (ingrédients), B (emballages), C (équipe, sur demande), D (glossaire), mêmes colonnes que l'ancien PDF.
- Retiré et vérifié absent : nom de la méthode d'attribution, camemberts, vocabulaire « coût direct » de la main-d'œuvre, rendement par ligne.
- Réponses aux questions de la fiche : (1) marge « tous canaux » d'un format : non ajoutée (décision du 22/11, l'ancien PDF calculait autrement) ; (2) libellé « Frais fixes » conservé ; (3) courbe en $/unité d'un format sans prix : **vérifiée** (cas « un format sans prix » : quatre lignes en $/unité, aucun pourcentage du prix imprimé).
