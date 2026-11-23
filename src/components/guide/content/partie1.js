import { money, num, pct } from '../guideFormat.js';
import {
    BARRES, BOISSON, FROMAGE, CAROTTES, LAITIER, CROUSTILLES, BOISSON_VEG, CASCADE, PATES, MIX, FARINE, ABC, CAPACITE, BOEUF,
} from '../guideNumbers.js';

// Partie 1 — Comprendre le coût de revient.
// Chaque chapitre : définition simple, exemple chiffré (jamais le même secteur deux fois de suite),
// « À retenir » et « Les mots du chapitre ». Tous les chiffres viennent de guideNumbers.js.

const efficaceB = (prix, perte) => prix / (1 - perte);

export const partie1 = {
    id: 'guide-partie-1',
    title: 'Partie 1 — Comprendre le coût de revient',
    lead: 'Les notions de base, sans écran. Chaque chapitre dure quelques minutes et s\'appuie sur un exemple chiffré.',
    chapters: [
        // =====================================================================================
        {
            id: 'guide-concept-cout-de-revient',
            title: '1. Le coût de revient, c\'est quoi ?',
            blocks: [
                { type: 'p', text: 'Le **coût de revient** d\'un produit est la somme de tout ce qu\'il a fallu dépenser pour qu\'une unité de ce produit existe et soit prête à être vendue : les matières, l\'emballage, le travail des personnes qui le fabriquent, mais aussi une part des dépenses qui font fonctionner l\'entreprise (loyer de l\'usine, électricité, assurances, administration). On l\'exprime presque toujours **par unité vendue** : combien coûte une barre, une bouteille, un plateau, un kilogramme.' },
                { type: 'p', text: 'On connaît spontanément le prix des ingrédients. On oublie presque toujours le reste. C\'est l\'erreur la plus fréquente en affaires : fixer un prix à partir du seul coût des matières, puis s\'étonner que l\'entreprise ne dégage aucun profit alors que les ventes se portent bien.' },
                { type: 'callout', kind: 'pourquoi', text: 'Le coût de revient est la base de presque toutes les décisions d\'une entreprise qui fabrique : fixer ou réviser un prix, négocier avec un fournisseur ou un client, savoir quels produits garder, promouvoir ou abandonner, et estimer combien il faut vendre pour être rentable.' },

                { type: 'h', id: 'guide-concept-cout-exemple', text: 'Un exemple, étape par étape' },
                { type: 'p', text: `Un fabricant de barres protéinées produit par **lots de ${num(BARRES.lot)} barres**. Voici ce que coûte un lot, poste par poste.` },
                {
                    type: 'table', caption: `Coût direct d'un lot de ${num(BARRES.lot)} barres`, head: ['Poste', 'Pour le lot', 'Par barre'], rows: [
                        ['Matières (ingrédients)', money(BARRES.matieres), money(BARRES.matieres / BARRES.lot)],
                        ['Emballage (pellicule individuelle et boîte)', money(BARRES.emballage), money(BARRES.emballage / BARRES.lot)],
                        ['Main-d\'œuvre (4 personnes × 5 h × 30 $/h)', money(BARRES.mo), money(BARRES.mo / BARRES.lot)],
                        ['Total des coûts directs', money(BARRES.directLot), money(BARRES.directUnit)],
                    ], boldLast: true,
                },
                { type: 'p', text: `Ce total de ${money(BARRES.directUnit)} par barre ne tient pas compte de l'usine elle-même. Or, chaque mois, l'entreprise paie en plus : un loyer de ${money(BARRES.fixes.loyer, 0)}, ${money(BARRES.fixes.electricite, 0)} d'électricité et de réfrigération, ${money(BARRES.fixes.assurance, 0)} d'assurances, ${money(BARRES.fixes.administration, 0)} d'administration et ${money(BARRES.fixes.entretien, 0)} d'entretien, soit **${money(BARRES.fixesMois, 0)} par mois**. Elle fabrique ${num(BARRES.volumeMois)} barres par mois : cela représente ${money(BARRES.fixesUnit)} par barre.` },
                {
                    type: 'table', caption: 'Du coût direct au coût de revient complet', head: ['Élément', 'Par barre'], rows: [
                        ['Coûts directs (matières, emballage, main-d\'œuvre)', money(BARRES.directUnit)],
                        ['Part des frais de l\'usine (18 000 $ ÷ 60 000 barres)', money(BARRES.fixesUnit)],
                        ['Coût de revient complet', money(BARRES.coutRevient)],
                    ], boldLast: true,
                },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Si l'entreprise vend la barre ${money(BARRES.prixBas)}, chaque vente couvre bien ses propres coûts directs (${money(BARRES.directUnit)}), mais pas sa part de l'usine : l'entreprise perd ${money(BARRES.perteUnit)} par barre, soit **${money(BARRES.perteMois, 0)} par mois**, sans que rien ne le montre dans les ventes.` },
                    { type: 'p', text: `À ${money(BARRES.prix)}, le profit est de ${money(BARRES.margeNette)} par barre, soit ${money(BARRES.margeNette * BARRES.volumeMois, 0)} par mois. Le même produit, la même recette, la même usine : seul le prix change, et il faut connaître le coût de revient complet pour le fixer.` },
                ] },
                { type: 'callout', kind: 'retenir', text: 'Coût de revient complet = coûts directs par unité + part des frais fixes par unité. Se baser sur les seuls ingrédients, ou même sur les seuls coûts directs, conduit presque toujours à des prix trop bas.' },
                { type: 'words', items: [
                    { term: 'Coût de revient', def: 'ce qu\'il en coûte, au total, pour fabriquer et vendre une unité d\'un produit.' },
                    { term: 'Lot', def: 'une production d\'un seul tenant (ici 5 000 barres). Dans l\'application, les recettes sont saisies pour un lot.' },
                    { term: 'Coûts directs', def: 'les coûts qu\'on peut rattacher à un produit précis (voir [[guide-concept-directs-fixes|chapitre 4]]).' },
                    { term: 'Frais fixes', def: 'les dépenses de l\'entreprise qui ne sont pas liées à un produit précis (loyer, assurances…).' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-familles',
            title: '2. Les familles de coûts',
            blocks: [
                { type: 'p', text: 'Pour comprendre d\'où vient un coût de revient, on le découpe en **familles**. L\'application en distingue cinq. Les quatre premières sont des coûts directs ; la cinquième est une charge financière. Ce découpage n\'est pas qu\'un classement : chaque famille se négocie, se mesure et se contrôle autrement, et l\'application les affiche séparément pour que vous voyiez où vont vos dollars.' },
                {
                    type: 'table', head: ['Famille', 'Ce que c\'est', 'Exemple', 'Nature'], wrapCells: true, rows: [
                        ['Matières', 'Les ingrédients et matières premières qui entrent dans le produit.', 'Farine, viande, concentré de jus, huile', 'Charge directe'],
                        ['Emballage', 'Tout ce qui contient, protège ou présente le produit.', 'Bouteille, bouchon, étiquette, boîte, palette', 'Charge directe'],
                        ['Main-d\'œuvre', 'Le temps de travail consacré à fabriquer le produit, au coût réel de l\'employeur.', 'Opérateur de ligne, cuisinier, contrôleur qualité', 'Charge directe'],
                        ['Sous-traitance', 'Une opération de fabrication confiée à un tiers.', 'Pasteurisation externe, surgélation, embouteillage', 'Charge directe'],
                        ['Vieillissement', 'Le coût d\'immobiliser de l\'argent dans un produit qui doit mûrir avant d\'être vendu.', 'Fromage affiné, salaison, vin', 'Charge financière'],
                    ],
                },

                { type: 'h', id: 'guide-concept-familles-matieres-emballage', text: 'Matières et emballage : deux postes séparés' },
                { type: 'p', text: 'L\'emballage est volontairement distinct des matières. Il a ses propres fournisseurs, ses propres variations de prix, et son propre pourcentage dans vos rapports : un coût d\'emballage qui monte ne doit pas se cacher dans un coût matière stable. Pour chacune de ces familles, l\'application tient compte des **pertes** (voir [[guide-concept-pertes-rendement|chapitre 3]]).' },

                { type: 'h', id: 'guide-concept-familles-mo', text: 'La main-d\'œuvre : un coût « chargé »' },
                { type: 'p', text: 'Le salaire horaire que vous versez n\'est pas le coût réel d\'une heure de travail. À ce salaire s\'ajoutent les **charges sociales** de l\'employeur (assurance-emploi, régimes publics, cotisations diverses) et la part de rémunération mise de côté pour les **vacances**. L\'application les applique en cascade : coût horaire chargé = salaire × (1 + charges) × (1 + vacances). Ensuite, le coût de la main-d\'œuvre d\'une recette se calcule à partir du temps que chaque étape de production mobilise et du nombre de personnes affectées. La [[guide-concept-capacite|capacité de main-d\'œuvre]] ajoute une subtilité importante, expliquée plus loin.' },

                { type: 'h', id: 'guide-concept-familles-soustraitance', text: 'La sous-traitance : produire sans tout faire soi-même' },
                { type: 'p', text: 'Quand une opération est confiée à un tiers (pasteurisation, surgélation, embouteillage), elle coûte un montant que vous saisissez directement, sans passer par vos employés. C\'est une charge directe : elle s\'ajoute aux matières, à l\'emballage et à la main-d\'œuvre, et réduit donc la marge brute.' },

                { type: 'h', id: 'guide-concept-familles-vieillissement', text: 'Le vieillissement : le coût du temps' },
                { type: 'p', text: `Certains produits ne se vendent pas tout de suite : un fromage s'affine, une salaison sèche, un vin vieillit. Pendant ce temps, l'argent déjà dépensé pour les ingrédients et la main-d'œuvre est immobilisé dans un stock, au lieu d'être disponible ou de rapporter. Ce **coût de portage** est un intérêt sur l'argent immobilisé. L'application le calcule ainsi : coûts directs du lot × taux d'intérêt annuel ÷ 12 × nombre de mois, puis divise le résultat par le nombre d'unités du lot.` },
                { type: 'callout', kind: 'exemple', text: `Un lot de ${num(FROMAGE.meules)} meules de fromage a coûté ${money(FROMAGE.directs, 0)} en coûts directs. Il affine ${FROMAGE.mois} mois, et l'argent immobilisé est évalué à ${pct(FROMAGE.tauxAnnuel, 0)} par an. Coût de portage : ${money(FROMAGE.directs, 0)} × ${pct(FROMAGE.tauxAnnuel, 0)} ÷ 12 × ${FROMAGE.mois} = **${money(FROMAGE.portage, 0)}**, soit ${money(FROMAGE.portageParMeule)} par meule.` },
                { type: 'callout', kind: 'attention', text: 'Ce traitement est une approximation prudente : l\'intérêt est simple (non composé) et le lot est supposé immobilisé en entier pendant toute la durée, ce qui surestime légèrement le coût, surtout au-delà de 12 mois. En comptabilité financière, les frais d\'intérêt sont en principe une charge de la période, hors du coût des stocks (norme IAS 2) ; leur capitalisation n\'est permise que pour un actif exigeant une longue préparation (norme IAS 23). Pour décider de ce qui s\'applique à votre entreprise, validez le traitement avec votre comptable. Dans l\'application, le vieillissement réduit la marge nette, mais pas la marge brute.' },
                { type: 'p', text: 'Le vieillissement est un **coût d\'opportunité** : il ne correspond à aucune dépense réelle de votre comptabilité. Les intérêts que vous payez vraiment à votre banque se trouvent déjà dans vos frais fixes. On le compte ici pour établir un prix qui rémunère l\'argent immobilisé. Voici où il intervient :' },
                { type: 'ul', items: [
                    { label: 'La marge brute.', text: 'Il n\'y entre pas : elle ne retire que les coûts directs.' },
                    { label: 'La marge nette.', text: 'Il s\'y soustrait à part, en plus des frais fixes. Il se calcule sur les coûts directs seulement : les frais fixes n\'y entrent pas.' },
                    { label: 'Le point mort.', text: 'Il est retiré de la marge de contribution, comme un coût qui grandit avec chaque unité produite. Sans cela, la marge nette serait encore négative au volume du point mort.' },
                    { label: 'Les sous-recettes.', text: 'Si une recette utilise une sous-recette qui vieillit, le coût de portage de cette dernière s\'ajoute à la ligne « vieillissement » du produit, jamais à ses coûts directs.' },
                    { label: 'La réconciliation.', text: 'Le bénéfice net théorique le soustrait, mais votre comptabilité n\'a rien d\'équivalent. Une petite part de l\'écart entre le réel et le théorique vient donc de lui, et c\'est normal.' },
                ] },

                { type: 'h', id: 'guide-concept-familles-exemple', text: 'Un exemple complet' },
                { type: 'p', text: `Un embouteilleur de boissons remplit des lots de **${num(BOISSON.lot)} bouteilles**. Voici le coût direct d'un lot, famille par famille.` },
                {
                    type: 'table', head: ['Famille', 'Pour le lot', 'Par bouteille'], rows: [
                        ['Matières (concentré, sucre, eau traitée)', money(BOISSON.matieres, 0), money(BOISSON.matieres / BOISSON.lot)],
                        ['Emballage (bouteille, bouchon, étiquette : 0,22 $ chacune)', money(BOISSON.emballage, 0), money(BOISSON.emballage / BOISSON.lot)],
                        ['Main-d\'œuvre (3 opérateurs × 8 h × 25 $/h)', money(BOISSON.mo, 0), money(BOISSON.mo / BOISSON.lot)],
                        ['Sous-traitance (pasteurisation externe)', money(BOISSON.sousTraitance, 0), money(BOISSON.sousTraitance / BOISSON.lot)],
                        ['Coût direct total', money(BOISSON.total, 0), money(BOISSON.unit)],
                    ], boldLast: true,
                },
                { type: 'p', text: 'On voit immédiatement que l\'emballage pèse presque autant que les matières, et bien plus que la main-d\'œuvre : si vous cherchez à réduire vos coûts, c\'est donc du côté des bouteilles et des matières qu\'il faut regarder en premier, pas des salaires.' },
                { type: 'callout', kind: 'retenir', text: 'Matières, emballage, main-d\'œuvre et sous-traitance sont les coûts directs ; le vieillissement est une charge financière. L\'application les montre séparément pour que vous sachiez quelle famille fait monter le coût de revient, et laquelle négocier en premier.' },
                { type: 'words', items: [
                    { term: 'Charges sociales', def: 'les cotisations que l\'employeur verse en plus du salaire.' },
                    { term: 'Coût horaire chargé', def: 'le coût réel d\'une heure de travail pour l\'employeur, charges et vacances comprises.' },
                    { term: 'Sous-traitance', def: 'une opération de fabrication confiée à un tiers.' },
                    { term: 'Coût de portage (vieillissement)', def: 'l\'intérêt sur l\'argent immobilisé dans un stock qui doit mûrir.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-pertes-rendement',
            title: '3. Pertes et rendement : acheter plus que ce qu\'on utilise',
            blocks: [
                { type: 'p', text: 'Quand vous achetez 10 kg de légumes, vous n\'en mettez pas 10 kg dans votre produit : une partie est jetée à l\'épluchage, une autre se perd en entrepôt avant même d\'être utilisée. Ces pertes ont un coût, et ne pas les compter fait paraître vos produits moins chers qu\'ils ne le sont. L\'application distingue **deux** moments de perte, parce qu\'ils n\'ont pas la même cause ni le même remède.' },
                {
                    type: 'table', head: ['', 'Perte en stock', 'Rendement'], wrapCells: true, rows: [
                        ['Quand ?', 'Avant la production', 'Pendant la production'],
                        ['Cause typique', 'Péremption, casse, produit abîmé, déclassement', 'Épluchage, parage, cuisson, évaporation'],
                        ['Où la saisir ?', 'Dans la fiche de l\'ingrédient ou de l\'emballage (champ {{Taux de perte (%)}})', 'Sur chaque ligne de la recette (champ {{Rendement (%)}})'],
                        ['Un même ingrédient peut-il avoir…', 'Un seul taux, pour toutes ses recettes', 'Un rendement différent dans chaque recette'],
                    ],
                },

                { type: 'h', id: 'guide-concept-prix-unitaire', text: 'Du prix d\'achat au prix unitaire' },
                { type: 'p', text: `Un ingrédient s'achète souvent par format : un sac de 25 kg, un seau de 5 L. Pour calculer le coût d'une recette, il faut son **prix unitaire** : le prix d'achat divisé par la quantité du format. Exemple tiré du projet démo : un format de ${BOEUF.format} kg de bœuf haché à ${money(BOEUF.prixAchat)} donne un prix unitaire de ${money(BOEUF.prixAchat)} ÷ ${BOEUF.format} = **${money(BOEUF.prixUnitaire)} le kilogramme**.` },

                { type: 'h', id: 'guide-concept-prix-efficace', text: 'Le prix efficace : ce que coûte vraiment un kilo utilisable' },
                { type: 'p', text: `Si 8 % de ce bœuf se perd avant utilisation, vous n'avez payé ${money(BOEUF.prixUnitaire)} que pour 92 % de ce que vous avez acheté. Le **prix efficace** est le prix d'un kilogramme qui arrive réellement à la production : prix unitaire ÷ (1 − taux de perte) = ${money(BOEUF.prixUnitaire)} ÷ 0,92 = **${money(BOEUF.prixUnitaire / (1 - BOEUF.perte))}**.` },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Deux fournisseurs vendent le même ingrédient. Le fournisseur A affiche ${money(9.75)} le kilogramme avec 8 % de perte ; le fournisseur B affiche ${money(10.1)} avec 2 % de perte (produit plus frais, mieux emballé).` },
                    { type: 'p', text: `Prix efficace de A : ${money(efficaceB(9.75, 0.08))}. Prix efficace de B : ${money(efficaceB(10.1, 0.02))}. Le fournisseur qui paraît plus cher est en réalité **moins cher** d'environ ${money(efficaceB(9.75, 0.08) - efficaceB(10.1, 0.02))} par kilogramme utilisable. C'est exactement ce que l'outil de comparaison de l'onglet Ingrédients vous montre.` },
                ] },

                { type: 'h', id: 'guide-concept-rendement', text: 'Le rendement : ce qui reste après la transformation' },
                { type: 'p', text: `Le rendement s'applique **pendant** la production. Il indique quelle part de l'ingrédient acheté se retrouve réellement dans le produit. Dans l'application, la quantité saisie sur une ligne de recette est la quantité **nécessaire au produit** ; le rendement indique donc combien il faut en acheter de plus.` },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Une recette demande ${num(CAROTTES.quantite)} kg de carottes épluchées. Les carottes coûtent ${money(CAROTTES.prix)} le kilogramme et le taux de perte en stock est de ${pct(CAROTTES.perte, 0)}. L'épluchage laisse ${pct(CAROTTES.rendement, 0)} du poids : le rendement est de ${pct(CAROTTES.rendement, 0)}.` },
                    {
                        type: 'table', head: ['Étape', 'Calcul', 'Résultat'], rows: [
                            ['Coût de base', `${num(CAROTTES.quantite)} kg × ${money(CAROTTES.prix)}`, money(CAROTTES.base)],
                            ['Avec la perte en stock (5 %)', `${money(CAROTTES.base)} ÷ (1 − 0,05)`, money(CAROTTES.apresPerte)],
                            ['Avec le rendement (80 %)', `${money(CAROTTES.apresPerte)} ÷ 0,80`, money(CAROTTES.final)],
                        ], boldLast: true,
                    },
                    { type: 'p', text: `Il faut donc acheter ${num(CAROTTES.kgAcheter, 1)} kg de carottes pour en obtenir ${num(CAROTTES.quantite)} kg épluchés, et la recette coûte ${money(CAROTTES.final)}, non ${money(CAROTTES.base)}.` },
                ] },
                { type: 'callout', kind: 'attention', text: 'Ne comptez pas la même perte deux fois. L\'épluchage appartient au rendement (sur la ligne de la recette), pas au taux de perte de la fiche de l\'ingrédient. Le taux de perte de la fiche ne sert qu\'à ce qui se perd **avant** la production : péremption, casse, déclassement.' },
                { type: 'callout', kind: 'retenir', text: 'Prix unitaire = prix d\'achat ÷ quantité du format. Prix efficace = prix unitaire ÷ (1 − perte en stock). Dans une recette, un rendement inférieur à 100 % augmente la quantité à acheter. Ces deux pertes sont distinctes : ne les confondez pas.' },
                { type: 'words', items: [
                    { term: 'Format d\'achat', def: 'la quantité contenue dans l\'unité que vous achetez (ex. 25 kg par sac).' },
                    { term: 'Prix unitaire', def: 'le prix d\'achat ramené à l\'unité de base (ex. au kilogramme).' },
                    { term: 'Prix efficace', def: 'le prix unitaire corrigé du taux de perte en stock.' },
                    { term: 'Rendement', def: 'la part de l\'ingrédient qui reste après la transformation.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-directs-fixes',
            title: '4. Coûts directs et frais fixes',
            blocks: [
                { type: 'p', text: 'Tous les coûts d\'une entreprise ne se rattachent pas aussi facilement à un produit. On les sépare en deux grands groupes.' },
                { type: 'ul', items: [
                    { label: 'Les coûts directs.', text: 'On peut dire précisément combien un produit en a consommé : les matières de sa recette, son emballage, les heures de travail de sa fabrication, l\'opération sous-traitée pour lui.' },
                    { label: 'Les frais fixes (ou charges indirectes).', text: 'Ils servent à toute l\'entreprise sans pouvoir être attribués à un produit précis : le loyer de l\'usine, l\'électricité, les assurances, la comptabilité, le marketing, le salaire de la direction. L\'application emploie les deux expressions : « frais fixes » insiste sur le fait que ces coûts ne varient pas avec le volume ; « charges indirectes » insiste sur le fait qu\'on ne peut pas les rattacher directement à un produit.' },
                ] },
                { type: 'p', text: 'Vous les retrouverez sous quatre catégories dans l\'application : frais généraux de production (loyer et énergie de l\'usine, par exemple), frais de vente et de mise en marché (marketing, commissions, livraison), frais d\'administration (direction, assurances, comptabilité) et frais financiers (intérêts, frais bancaires).' },

                { type: 'h', id: 'guide-concept-repartition', text: 'Pourquoi et comment répartir les frais fixes' },
                { type: 'p', text: 'Un produit ne vit pas dans le vide : il utilise l\'usine, l\'équipe de direction, les camions. Pour connaître son vrai coût de revient, il doit porter **une part** de ces frais fixes. La question est : quelle part ? L\'application procède en deux temps.' },
                { type: 'ol', items: [
                    'Elle découpe d\'abord vos frais fixes en **bassins** : un bassin « Général » (les frais de toute l\'entreprise), un bassin par **activité de production** (les frais propres à une ligne de fabrication) et un bassin par **canal de vente** (les frais propres à un circuit de distribution).',
                    'Elle répartit ensuite chaque bassin entre les produits qui l\'utilisent, selon une **règle de répartition**. Cette règle s\'appelle le CICI (coefficient d\'imputation des charges indirectes).',
                ] },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Un transformateur laitier fabrique du yogourt et du fromage frais. Ses frais fixes communs sont de ${money(LAITIER.poolTotal, 0)} par mois (loyer ${money(LAITIER.pool.loyer, 0)}, électricité et réfrigération ${money(LAITIER.pool.electricite, 0)}, administration ${money(LAITIER.pool.administration, 0)}, assurances ${money(LAITIER.pool.assurances, 0)}). Ses coûts directs sont de ${money(LAITIER.directsYogourt, 0)} pour le yogourt et de ${money(LAITIER.directsFromage, 0)} pour le fromage.` },
                    { type: 'p', text: `Règle choisie : répartir **au prorata des coûts directs**. Le yogourt représente 60 % des coûts directs, le fromage 40 %. Le yogourt reçoit donc ${money(LAITIER.poolYogourt, 0)} de frais fixes, le fromage ${money(LAITIER.poolFromage, 0)}. Comme il se vend ${num(LAITIER.unitsYogourt)} pots de yogourt et ${num(LAITIER.unitsFromage)} fromages, la part de frais fixes est de ${money(LAITIER.parPot)} par pot et de ${money(LAITIER.parFromage)} par fromage.` },
                ] },
                { type: 'p', text: 'Trois règles de répartition sont possibles. Chacune convient à une situation différente :' },
                { type: 'ul', items: [
                    { label: 'Au prorata des coûts directs.', text: 'Les produits chers à fabriquer portent plus de frais. C\'est la règle par défaut, valable dans la plupart des cas.' },
                    { label: 'Au prorata du temps de production.', text: 'Les produits qui occupent davantage la main-d\'œuvre en portent plus. Elle convient quand le frais suit le travail.' },
                    { label: 'Au prorata du volume physique.', text: 'La répartition se fait selon les kilogrammes ou les litres vendus. Elle convient quand le frais suit l\'encombrement, comme l\'entreposage réfrigéré.' },
                ] },
                { type: 'p', text: 'Le chapitre [[guide-ff-cici|Coefficient d\'imputation]] détaille ces règles et la façon de les choisir.' },

                { type: 'h', id: 'guide-concept-mo-directe-ou-fixe', text: 'Où classer la main-d\'œuvre ?' },
                { type: 'p', text: 'C\'est une question qui revient toujours : le travail des employés de production est-il un coût direct ou un frais fixe ? La réponse dépend de la manière dont vous le **modélisez**. Les employés que vous décrivez dans l\'onglet Main-d\'œuvre, et que vous affectez aux étapes de vos recettes, sont comptés dans le coût de chaque produit : ce sont des coûts directs. Les personnes qui ne participent pas directement à la fabrication (direction, administration, ventes) sont des frais fixes. Un même coût ne doit jamais être compté dans les deux : voir l\'exemple chiffré du [[guide-ff-liste|chapitre État des résultats]].' },
                { type: 'callout', kind: 'retenir', text: 'Les coûts directs se rattachent à un produit ; les frais fixes se répartissent entre les produits selon une règle. Le coût de revient complet est la somme des deux. Un coût ne doit apparaître qu\'une seule fois, dans l\'une ou l\'autre catégorie.' },
                { type: 'words', items: [
                    { term: 'Bassin (« pool »)', def: 'un ensemble de frais fixes destiné à être réparti : général, par activité ou par canal.' },
                    { term: 'Règle de répartition (CICI)', def: 'la façon de diviser un bassin entre les produits : selon les coûts directs, le temps de production ou le volume physique.' },
                    { term: 'Activité de production', def: 'une ligne de fabrication ou un groupe de produits qui partagent un même procédé.' },
                    { term: 'Au prorata de', def: 'proportionnellement à : celui qui a le plus de « poids » reçoit la plus grande part.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-fixe-variable',
            title: '5. Coûts fixes, coûts variables et volume',
            blocks: [
                { type: 'p', text: 'Un coût est **variable** s\'il augmente quand vous produisez davantage : plus de sachets de croustilles, plus de pommes de terre, plus d\'huile, plus d\'emballages. Un coût est **fixe** s\'il reste le même, que vous fabriquiez peu ou beaucoup : le loyer, les assurances, le salaire de la direction. Cette distinction explique un phénomène essentiel : **le coût de revient par unité dépend du volume**.' },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Un fabricant de croustilles dépense ${money(CROUSTILLES.variableUnit)} par sac en matières et emballage (coût variable), et ${money(CROUSTILLES.fixes, 0)} par mois en frais fixes. Voici ce que coûte un sac selon le volume produit.` },
                    {
                        type: 'table', head: ['Sacs par mois', 'Coût variable total', 'Frais fixes', 'Coût total', 'Coût par sac'],
                        rows: CROUSTILLES.lignes.map((l) => [num(l.volume), money(CROUSTILLES.variableUnit * l.volume, 0), money(CROUSTILLES.fixes, 0), money(l.total, 0), money(l.unit)]),
                    },
                    { type: 'p', text: `Quand le volume passe de ${num(CROUSTILLES.lignes[0].volume)} à ${num(CROUSTILLES.lignes[2].volume)} sacs, la part des frais fixes tombe de ${money(CROUSTILLES.lignes[0].fixesUnit)} à ${money(CROUSTILLES.lignes[2].fixesUnit)} par sac. Le coût de revient passe de ${money(CROUSTILLES.lignes[0].unit)} à ${money(CROUSTILLES.lignes[2].unit)}, sans que la recette ait changé.` },
                ] },
                { type: 'p', text: 'C\'est ce qu\'on appelle une **économie d\'échelle** : plus l\'usine produit, plus les frais fixes se diluent. À l\'inverse, un produit qui se vend moins que prévu porte une part de frais fixes plus lourde que prévu, et peut devenir déficitaire alors que ses coûts directs n\'ont pas bougé.' },
                { type: 'h', id: 'guide-concept-couts-mixtes', text: 'Les coûts entre les deux' },
                { type: 'p', text: 'La réalité est rarement aussi nette. Un opérateur payé à l\'heure est variable si vous réduisez ses heures quand la production baisse, mais fixe s\'il est salarié à temps plein. Un coût peut aussi être « fixe par paliers » : le loyer ne change pas tant que vous restez dans le même bâtiment, puis saute quand vous en louez un second. Ce qui compte, c\'est le comportement du coût **pour la période et les volumes que vous regardez**.' },
                { type: 'callout', kind: 'pourquoi', text: 'Savoir ce qui est fixe et ce qui est variable permet de répondre à deux questions de natures différentes : « combien me coûte un produit ? » (on répartit tout sur l\'unité) et « combien dois-je vendre pour ne plus perdre d\'argent ? » (on sépare ce qui ne bouge pas de ce qui bouge).' },
                { type: 'h', id: 'guide-concept-deux-regards', text: 'Les deux regards de l\'application sur la main-d\'œuvre' },
                { type: 'p', text: 'Pour calculer le **coût d\'un produit**, l\'application attribue à chaque recette le coût des heures qu\'elle consomme : c\'est le regard « par unité ». Pour calculer le **point mort**, elle traite en revanche la main-d\'œuvre de production comme un coût fixe de la période, parce que votre personnel est payé qu\'il fabrique 100 ou 1 000 unités. Ce n\'est pas une contradiction : ce sont deux questions différentes, qui appellent deux façons de regarder le même coût.' },
                { type: 'callout', kind: 'retenir', text: 'Les frais fixes se diluent quand le volume augmente : le coût de revient par unité baisse. C\'est pourquoi un produit qui se vend moins que prévu coûte plus cher à fabriquer que prévu.' },
                { type: 'words', items: [
                    { term: 'Coût variable', def: 'un coût qui augmente avec le volume produit.' },
                    { term: 'Coût fixe', def: 'un coût qui ne change pas avec le volume, sur la période considérée.' },
                    { term: 'Économie d\'échelle', def: 'la baisse du coût par unité quand le volume augmente, parce que les frais fixes se répartissent sur plus d\'unités.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-marges',
            title: '6. Le prix de vente et les marges',
            blocks: [
                { type: 'p', text: 'La **marge** est la part du prix de vente qui reste après avoir payé certains coûts. Elle s\'exprime en dollars par unité et en pourcentage du prix. Selon les coûts que l\'on soustrait, on obtient des marges différentes, qui répondent à des questions différentes. L\'application en affiche trois.' },
                { type: 'ul', items: [
                    { label: 'La marge de contribution.', text: 'Prix de vente moins le coût matière seul. Elle indique ce qui reste pour payer tout le reste : emballage, main-d\'œuvre, frais fixes et profit. C\'est un premier réflexe de lecture, rapide à calculer.' },
                    { label: 'La marge brute.', text: 'Prix de vente moins l\'ensemble des coûts directs (matières, emballage, main-d\'œuvre de production, sous-traitance). Elle indique ce que le produit « rapporte » avant de payer les frais fixes de l\'entreprise.' },
                    { label: 'La marge nette.', text: 'Prix de vente moins le coût de revient complet : les coûts directs, la part de frais fixes et, s\'il y a lieu, le coût de vieillissement. C\'est le profit réel que dégage une unité vendue.' },
                ] },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Une boisson végétale se vend ${money(BOISSON_VEG.prix)}. Elle coûte ${money(BOISSON_VEG.matiere)} en matières, ${money(BOISSON_VEG.emballage)} en emballage, ${money(BOISSON_VEG.mo)} en main-d'œuvre, et porte ${money(BOISSON_VEG.fixes)} de frais fixes.` },
                    {
                        type: 'table', head: ['Marge', 'Calcul', 'En $', 'En % du prix'], rows: [
                            ['Contribution', `${money(BOISSON_VEG.prix)} − ${money(BOISSON_VEG.matiere)}`, money(BOISSON_VEG.contribution), pct(BOISSON_VEG.contribution / BOISSON_VEG.prix)],
                            ['Brute', `${money(BOISSON_VEG.prix)} − (${money(BOISSON_VEG.matiere)} + ${money(BOISSON_VEG.emballage)} + ${money(BOISSON_VEG.mo)})`, money(BOISSON_VEG.brute), pct(BOISSON_VEG.brute / BOISSON_VEG.prix)],
                            ['Nette', `${money(BOISSON_VEG.brute)} − ${money(BOISSON_VEG.fixes)}`, money(BOISSON_VEG.nette), pct(BOISSON_VEG.nette / BOISSON_VEG.prix)],
                        ],
                    },
                ] },
                { type: 'callout', kind: 'attention', text: 'Dans l\'application, la marge de contribution se calcule avec le seul coût matière, ce qui est plus étroit que la définition de certains manuels (qui soustraient tous les coûts variables). Les trois marges de l\'application sont donc emboîtées : contribution, puis brute, puis nette. Retenez cette définition pour comparer vos chiffres à ceux d\'autres outils.' },

                { type: 'h', id: 'guide-concept-marge-majoration', text: 'Marge ou majoration ? Deux façons de parler du même profit' },
                { type: 'p', text: 'C\'est la confusion la plus coûteuse de tout le calcul de prix. Les deux pourcentages décrivent le même profit, mais ne le comparent pas au même montant :' },
                { type: 'ul', items: [
                    { label: 'La marge', text: 'compare le profit au **prix de vente** : marge = profit ÷ prix de vente.' },
                    { label: 'La majoration', text: 'compare le profit au **coût** : majoration = profit ÷ coût.' },
                ] },
                { type: 'callout', kind: 'exemple', text: `Un produit coûte ${money(BOISSON_VEG.cout)} et se vend ${money(BOISSON_VEG.prixMajore)}. Le profit est de ${money(BOISSON_VEG.profit)}. Marge : ${money(BOISSON_VEG.profit)} ÷ ${money(BOISSON_VEG.prixMajore)} = **${pct(BOISSON_VEG.margeSurPrix, 0)}**. Majoration : ${money(BOISSON_VEG.profit)} ÷ ${money(BOISSON_VEG.cout)} = **${pct(BOISSON_VEG.majorationSurCout, 0)}**. Pour le même profit, la majoration est toujours plus élevée que la marge.` },
                { type: 'p', text: 'Confondre les deux a des conséquences concrètes. Partir d\'un coût de 3,00 $ :' },
                {
                    type: 'table', head: ['Vous voulez…', 'Prix à demander', 'Ce que vous obtenez réellement'], wrapCells: true, rows: [
                        ['40 % de **majoration**', `${money(BOISSON_VEG.cout40)} × 1,40 = ${money(BOISSON_VEG.prixMajoration40)}`, `Une marge de ${pct(BOISSON_VEG.margeEquivalente40)} seulement`],
                        ['40 % de **marge**', `${money(BOISSON_VEG.cout40)} ÷ (1 − 0,40) = ${money(BOISSON_VEG.prixMarge40)}`, `Une majoration de ${pct(BOISSON_VEG.majorationEquivalente40)}`],
                    ],
                },
                { type: 'callout', kind: 'retenir', text: 'Dans toute l\'application, un pourcentage de **marge** se calcule sur le **prix de vente**. La **majoration** n\'apparaît que dans les maillons des canaux de vente, où vous choisissez entre les deux (voir [[guide-concept-canaux|chapitre suivant]]). En français comptable européen, on parle parfois de « taux de marge » pour la majoration et de « taux de marque » pour la marge sur le prix ; l\'application suit l\'usage courant au Québec.' },
                { type: 'words', items: [
                    { term: 'Marge de contribution', def: 'prix de vente moins le coût matière.' },
                    { term: 'Marge brute', def: 'prix de vente moins les coûts directs.' },
                    { term: 'Marge nette', def: 'prix de vente moins le coût de revient complet.' },
                    { term: 'Majoration (« markup »)', def: 'le profit exprimé en pourcentage du coût, non du prix.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-canaux',
            title: '7. Les canaux de vente : un même produit, plusieurs prix nets',
            blocks: [
                { type: 'p', text: 'Un produit ne se vend pas toujours directement au consommateur. Il peut passer par un distributeur, puis par un détaillant, avant d\'arriver en tablette. Chacun garde une part. Le **prix de détail suggéré** (PDS) est le prix que paie le consommateur ; le **prix net** est ce qui revient réellement à votre entreprise une fois que chaque intermédiaire a pris sa part. Cette chaîne d\'intermédiaires s\'appelle un **canal de vente**, et chaque intermédiaire y est un **maillon**.' },
                { type: 'p', text: 'Chaque maillon applique soit une **marge** (un pourcentage du prix auquel il revend), soit une **majoration** (un pourcentage du prix auquel il a acheté), comme au chapitre précédent. L\'application part du PDS et « redescend » la chaîne, maillon par maillon, pour retrouver votre prix net.' },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Un produit se vend ${money(CASCADE.pds, 0)} en rayon (PDS). Le détaillant applique une marge de ${pct(CASCADE.margeDetaillant, 0)} ; le distributeur, une majoration de ${pct(CASCADE.majorationDistributeur, 0)}.` },
                    {
                        type: 'table', head: ['Étape', 'Calcul', 'Prix'], rows: [
                            ['Prix payé par le consommateur (PDS)', '', money(CASCADE.pds)],
                            ['Prix payé par le détaillant (il garde 30 % de son prix de vente)', `${money(CASCADE.pds)} × (1 − 0,30)`, money(CASCADE.prixAuDetaillant)],
                            ['Prix net pour le producteur (le distributeur ajoute 12 % à son coût d\'achat)', `${money(CASCADE.prixAuDetaillant)} ÷ 1,12`, money(CASCADE.prixNetProducteur)],
                        ], boldLast: true,
                    },
                    { type: 'p', text: `Sur ${money(CASCADE.pds, 0)} payés en magasin, le détaillant garde ${money(CASCADE.margeDetaillantDollar)}, le distributeur ${money(CASCADE.margeDistributeurDollar)} et le producteur ${money(CASCADE.prixNetProducteur)}, soit ${pct(CASCADE.part)} du prix en tablette.` },
                ] },
                { type: 'callout', kind: 'pourquoi', text: 'Le même produit a donc des prix nets différents selon le canal, donc des marges différentes, alors que le coût de fabrication est identique. Un produit rentable en vente directe peut perdre de l\'argent en grande distribution : c\'est ce que vous découvrirez dans le rapport Par SKU. Chaque canal peut aussi porter ses propres frais (commissions, livraison), qui s\'ajoutent au coût de revient de ce canal.' },
                { type: 'callout', kind: 'retenir', text: 'PDS = prix payé par le consommateur. Prix net = ce qui vous revient après les maillons. La marge d\'un produit se calcule sur le prix net de chaque canal, pas sur le PDS.' },
                { type: 'words', items: [
                    { term: 'PDS (prix de détail suggéré)', def: 'le prix proposé au consommateur final.' },
                    { term: 'Prix net', def: 'le prix qui revient au producteur dans un canal donné.' },
                    { term: 'Canal de vente', def: 'la chaîne d\'intermédiaires entre vous et le consommateur.' },
                    { term: 'Maillon', def: 'un intermédiaire du canal (distributeur, grossiste, détaillant) qui applique une marge ou une majoration.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-point-mort',
            title: '8. Le point mort : combien vendre pour ne pas perdre d\'argent',
            blocks: [
                { type: 'p', text: 'Le **point mort** (ou seuil de rentabilité) est le volume de ventes à partir duquel l\'entreprise ne perd plus d\'argent. En dessous, vos ventes ne couvrent pas vos coûts fixes ; au-dessus, chaque unité supplémentaire rapporte un profit. C\'est l\'un des indicateurs les plus utiles pour décider de lancer un produit, d\'investir ou de réviser un prix.' },
                { type: 'p', text: 'Le principe est simple. Chaque unité vendue « rapporte » sa **marge de contribution** : ce qui reste du prix de vente une fois payés ses propres coûts variables. Cet argent sert à couvrir les frais fixes. Quand les frais fixes sont entièrement couverts, vous êtes au point mort :' },
                { type: 'callout', kind: 'retenir', text: 'Point mort (en unités) = frais fixes ÷ marge de contribution par unité.' },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Un fabricant de pâtes vend sa boîte ${money(PATES.prix)} (prix net). Matières et emballage coûtent ${money(PATES.variable)} par boîte : chaque boîte rapporte ${money(PATES.contribution)}. Ses frais fixes sont de ${money(PATES.fixes, 0)} par mois, auxquels s'ajoute la paie de sa main-d'œuvre de production, ${money(PATES.mo, 0)}, qui ne varie pas avec le volume : ${money(PATES.total, 0)} à couvrir.` },
                    { type: 'p', text: `Point mort : ${money(PATES.total, 0)} ÷ ${money(PATES.contribution)} = **${num(PATES.pointMort)} boîtes** par mois, soit environ ${money(PATES.revenuPointMort, 0)} de ventes.` },
                    { type: 'p', text: `À ${num(30000)} boîtes, l'entreprise perd ${money(-PATES.perte30, 0)} ; à ${num(50000)} boîtes, elle gagne ${money(PATES.profit50, 0)}. Chaque boîte au-delà du point mort rapporte ${money(PATES.contribution)} de profit.` },
                ] },
                { type: 'h', id: 'guide-concept-point-mort-app', text: 'Ce que l\'application fait de particulier' },
                { type: 'ul', items: [
                    { label: 'La main-d\'œuvre de production est traitée comme un coût fixe.', text: 'Votre personnel est payé qu\'il fabrique beaucoup ou peu. Elle sort donc de la marge de contribution et s\'ajoute aux frais fixes à couvrir, comme dans l\'exemple ci-dessus.' },
                    { label: 'Le vieillissement est retiré de la marge de contribution.', text: 'Un produit qui doit mûrir porte un coût de portage qui grandit avec chaque unité produite : il se soustrait donc du prix comme un coût variable, ce qui allonge le point mort (voir le chapitre 2).' },
                    { label: 'Le point mort existe à plusieurs niveaux.', text: 'Par format de produit et par canal de vente (en unités), par activité et par canal (en dollars de revenu), et pour l\'ensemble des produits actifs (en dollars de revenu). Ce dernier est exprimé en dollars parce que des produits très différents n\'ont pas d\'unité commune.' },
                    { label: 'Il dépend de vos hypothèses.', text: 'Des volumes réels saisis, d\'une répartition des frais fixes et d\'un prix net : si l\'un change, le point mort change aussi.' },
                ] },
                { type: 'callout', kind: 'attention', text: 'Un point mort n\'a de sens que s\'il est atteignable. Comparez-le à ce que vous pouvez réellement produire et vendre : un point mort de 40 000 boîtes par mois est une bonne nouvelle si votre ligne peut en fabriquer 80 000, et une mauvaise si elle plafonne à 35 000.' },
                { type: 'words', items: [
                    { term: 'Point mort (seuil de rentabilité)', def: 'le volume de ventes où les revenus égalent exactement les coûts.' },
                    { term: 'Marge de contribution unitaire', def: 'ce que rapporte une unité vendue pour payer les frais fixes.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-mix',
            title: '9. La répartition des ventes et la moyenne pondérée',
            blocks: [
                { type: 'p', text: 'Une entreprise vend rarement un seul produit. Le **répartition des ventes** décrit la part de chaque produit dans les ventes : par exemple, 40 % de produit A, 30 % de produit B et 30 % de produit C. Il compte pour deux raisons. D\'abord parce qu\'il donne le « poids » de chaque produit quand on veut une vue d\'ensemble. Ensuite parce que sa somme doit faire 100 % : si elle ne le fait pas, la vue d\'ensemble est faussée.' },
                { type: 'p', text: 'Pour résumer plusieurs produits en un seul chiffre (une marge moyenne des produits actifs, un coût matière moyen), on calcule une **moyenne pondérée** : chaque produit y compte selon son importance, non à égalité avec les autres. La difficulté est de choisir le poids.' },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: 'Trois produits ont les ventes suivantes.' },
                    {
                        type: 'table', head: ['Produit', 'Prix', 'Marge unitaire', 'Marge en %', 'Unités vendues', 'Revenu', 'Marge totale'],
                        rows: MIX.produits.map((p) => [p.nom, money(p.prix), money(p.margeUnit), pct(p.margePct, 0), num(p.volume), money(p.revenu, 0), money(p.margeTotale, 0)]),
                    },
                    {
                        type: 'table', head: ['Méthode', 'Marge moyenne des produits actifs'], rows: [
                            ['Moyenne simple des pourcentages (chacun compte pareil)', pct(MIX.moyenneSimple)],
                            ['Pondérée par les unités vendues', pct(MIX.ponderUnites)],
                            ['Pondérée par le revenu (total des marges ÷ total des revenus)', pct(MIX.ponderRevenu)],
                        ],
                    },
                    { type: 'p', text: `Trois méthodes, trois résultats. Le bon est le dernier : ${money(MIX.margeTotale, 0)} de marge pour ${money(MIX.revenu, 0)} de ventes, soit ${pct(MIX.ponderRevenu)}. Pondérer par les unités donnerait trop de poids au produit A, très vendu mais peu cher ; la moyenne simple traiterait le produit B, qui pèse peu, comme les deux autres.` },
                ] },
                { type: 'callout', kind: 'retenir', text: 'Pour résumer la marge d\'un ensemble de produits, pondérez par le revenu : cela revient à diviser le total des marges par le total des ventes. C\'est ce que fait l\'application dans ses indicateurs pondérés de la vue d\'ensemble.' },
                { type: 'words', items: [
                    { term: 'Part des ventes', def: 'la part de chaque produit dans les ventes, en pourcentage. La somme des produits « actif » doit être de 100 %.' },
                    { term: 'Moyenne pondérée', def: 'une moyenne où chaque élément compte selon son poids.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-capacite',
            title: '10. La main-d\'œuvre et sa capacité',
            blocks: [
                { type: 'p', text: 'Payer une personne pour 160 heures ne veut pas dire qu\'elle fabrique 160 heures. Une partie de son temps est **non productive** (nettoyage, réunions, administration), et une autre partie du temps **productif** peut rester sans emploi faute de production à faire. L\'application répartit le coût des deux sur vos produits : toutes les heures que vous payez se retrouvent dans leur coût. Comprendre cette mécanique évite bien des surprises dans le coût de la main-d\'œuvre affiché par chaque recette.' },
                { type: 'h', id: 'guide-concept-capacite-vocabulaire', text: 'Trois quantités d\'heures' },
                { type: 'ol', items: [
                    { label: 'Les heures travaillées.', text: 'Ce pour quoi vous payez une personne pendant la période.' },
                    { label: 'Les heures productives attendues.', text: 'Les heures travaillées multipliées par le **pourcentage de temps productif** de la personne : le temps qu\'elle est censée passer à fabriquer.' },
                    { label: 'Les heures productives réelles (nécessaires).', text: 'Les heures que vos recettes demandent vraiment, compte tenu de ce que vous vendez : durée des étapes × nombre de lots à produire, y compris les lots de sous-recettes que vos produits consomment.' },
                ] },
                { type: 'p', text: `Le rapport entre les deux dernières est le **taux d'utilisation** : heures nécessaires ÷ heures productives attendues. Un taux de 100 % signifie que toute la capacité de production payée est employée ; un taux de ${pct(CAPACITE.utilisation, 0)} signifie qu'un quart de cette capacité ne sert à rien.` },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `${CAPACITE.operateurs} opérateurs travaillent chacun ${CAPACITE.heuresTravaillees} h dans le mois, avec ${pct(CAPACITE.tempsProductif, 0)} de temps productif. Leur coût chargé est de ${money(CAPACITE.tauxChargeHoraire, 0)} l'heure.` },
                    {
                        type: 'table', head: ['Quantité', 'Calcul', 'Résultat'], rows: [
                            ['Heures productives attendues', `${CAPACITE.operateurs} × ${CAPACITE.heuresTravaillees} × ${pct(CAPACITE.tempsProductif, 0)}`, `${num(CAPACITE.disponibles)} h`],
                            ['Heures nécessaires aux recettes', 'selon le volume vendu', `${num(CAPACITE.necessaires)} h`],
                            ['Taux d\'utilisation', `${num(CAPACITE.necessaires)} ÷ ${num(CAPACITE.disponibles)}`, pct(CAPACITE.utilisation, 0)],
                        ],
                    },
                ] },
                { type: 'h', id: 'guide-concept-capacite-absorption', text: 'Ce que l\'application fait de la capacité inutilisée' },
                { type: 'p', text: `Toutes les heures que vous payez sont un coût réel : les heures employées, la capacité productive qui ne sert pas, et le temps non productif. Plutôt que d'en ignorer une partie, l'application les **répartit sur vos produits** : elle divise le coût direct de la main-d'œuvre de chaque recette par le **taux d'absorption**, soit le coût des heures nécessaires ÷ la paie de **tous les postes** de l'onglet Main-d'œuvre (${money(CAPACITE.coutDirect, 0)} ÷ ${money(CAPACITE.masseSalariale, 0)} = ${pct(CAPACITE.tauxAbsorption, 1)}). Dans l'exemple, les ${num(CAPACITE.necessaires)} heures nécessaires coûtent ${money(CAPACITE.coutDirect, 0)} (${num(CAPACITE.necessaires)} × ${money(CAPACITE.tauxChargeHoraire, 0)}) ; divisé par ${pct(CAPACITE.tauxAbsorption, 1)}, le coût absorbé par les recettes est de ${money(CAPACITE.coutAbsorbe, 0)}, ce qui correspond exactement à la paie de toutes les heures payées (${num(CAPACITE.heuresPayees)} × ${money(CAPACITE.tauxChargeHoraire, 0)}). Chaque heure effectivement utilisée est ainsi comptée à ${money(CAPACITE.majorationHoraire)} au lieu de ${money(CAPACITE.tauxChargeHoraire)}. Un poste qui n'a aucune étape de recette est lui aussi absorbé : sa paie est répartie sur les produits au prorata de leur coût de main-d'œuvre.` },
                { type: 'p', text: 'Dans l\'écran Production, le coût d\'une étape se décompose donc en deux : le **coût du temps productif** (le salaire des heures employées) et le **coût du temps non productif** (la part de capacité inutilisée et de temps non productif que cette étape absorbe). Les deux sont de la main-d\'œuvre de production : le second n\'est pas un frais indirect, c\'est le coût des heures payées qui ne produisent pas.' },
                { type: 'callout', kind: 'exemple', text: `Le coût absorbé de ${money(CAPACITE.coutAbsorbe, 0)} se décompose ainsi : ${money(CAPACITE.coutDirect, 0)} pour les heures employées, ${money(CAPACITE.coutInutilise, 0)} pour la capacité productive inutilisée (${num(CAPACITE.heuresInutilisees)} h) et ${money(CAPACITE.coutNonProductif, 0)} pour le temps non productif (${CAPACITE.operateurs} × ${CAPACITE.heuresTravaillees} × ${pct(1 - CAPACITE.tempsProductif, 0)} = ${num(CAPACITE.heuresNonProductives)} h : nettoyage, réunions, administration). Vous n'avez pas à saisir ce dernier temps ailleurs : le **% de temps productif attendu** de chaque employé suffit. Ne l'ajoutez surtout pas aux frais fixes, il serait compté deux fois.` },
                { type: 'callout', kind: 'pourquoi', text: 'Le taux d\'absorption est calculé pour toute l\'équipe, pas pour chaque produit. Un produit n\'est donc pas seul responsable de son coût de main-d\'œuvre : si vous ajoutez un nouveau produit qui occupe des heures auparavant inutilisées, le taux monte et le coût de main-d\'œuvre de **tous** vos produits baisse. Remplir sa capacité est l\'un des leviers de rentabilité les plus puissants.' },
                { type: 'callout', kind: 'retenir', text: 'Taux d\'utilisation = heures nécessaires ÷ heures productives attendues (il signale la capacité inutilisée). Taux d\'absorption = coût des heures nécessaires ÷ paie de tous les postes : il sert à répartir toute la paie, capacité inutilisée et temps non productif compris, sur vos produits.' },
                { type: 'words', items: [
                    { term: 'Temps productif (%)', def: 'la part des heures travaillées censée être consacrée à la production.' },
                    { term: 'Taux d\'utilisation', def: 'la part de la capacité productive payée qui est réellement employée.' },
                    { term: 'Taux d\'absorption', def: 'le coût des heures nécessaires divisé par la paie de tous les postes : la part de la paie que les recettes utilisent directement ; le reste est réparti sur les produits.' },
                    { term: 'Capacité', def: 'ce que votre équipe est en mesure de produire pendant la période.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-suivi',
            title: '11. Suivre dans le temps : points de référence, volatilité, analyse ABC',
            blocks: [
                { type: 'p', text: 'Un coût de revient n\'est pas figé : les prix des fournisseurs bougent, les salaires changent, les recettes évoluent. Pour savoir si vos décisions portent leurs fruits, il faut pouvoir comparer « avant » et « après ». L\'application vous y aide de trois façons.' },
                { type: 'h', id: 'guide-concept-points-reference', text: 'Les points de référence : des photos de votre projet' },
                { type: 'p', text: 'Un **point de référence** est une photo de votre projet à un moment donné : vos prix d\'achat, vos coûts, vos marges. Vous en créez un avant un changement important (nouveau fournisseur, révision de prix), puis un autre après. Les rapports comparent ensuite les points entre eux et en tirent des graphiques d\'évolution.' },
                { type: 'h', id: 'guide-concept-volatilite', text: 'La volatilité : un prix stable ou capricieux ?' },
                { type: 'p', text: 'À partir de plusieurs points de référence, l\'application reconstitue la série de prix de chaque ingrédient et de chaque emballage, puis calcule deux mesures.' },
                { type: 'ul', items: [
                    { label: 'La tendance.', text: 'La variation entre le premier et le dernier prix : (dernier − premier) ÷ premier. Elle dit où va le prix.' },
                    { label: 'L\'amplitude.', text: 'L\'écart entre le prix le plus haut et le plus bas, ramené au prix moyen : (maximum − minimum) ÷ moyenne. Elle dit à quel point le prix bouge.' },
                ] },
                { type: 'p', text: 'Selon l\'amplitude, l\'application attribue un **palier** : faible (moins de 10 %), modéré (10 % à moins de 20 %) ou élevé (20 % et plus). Il faut au moins deux points de référence pour que ces mesures existent.' },
                { type: 'callout', kind: 'exemple', text: `Le prix de la farine, relevé cinq fois : ${FARINE.prix.map((p) => money(p)).join(', ')}. Tendance : (${money(FARINE.prix[4])} − ${money(FARINE.prix[0])}) ÷ ${money(FARINE.prix[0])} = ${pct(FARINE.tendance)}. Prix moyen : ${money(FARINE.moyenne, 3)}. Amplitude : (${money(1.02)} − ${money(0.82)}) ÷ ${money(FARINE.moyenne, 3)} = ${pct(FARINE.amplitude)}, donc un palier **élevé**. La farine est un ingrédient dont le prix monte vite : à surveiller de près.` },
                { type: 'h', id: 'guide-concept-abc', text: 'L\'analyse ABC : où concentrer vos efforts' },
                { type: 'p', text: 'Tous les ingrédients ne méritent pas la même attention. L\'analyse ABC, fondée sur le **principe de Pareto** (une minorité de causes produit la majorité des effets), les classe par importance financière. On les trie du plus coûteux au moins coûteux, puis on additionne leurs parts :' },
                { type: 'ul', items: [
                    { label: 'Catégorie A.', text: 'Les premiers ingrédients, jusqu\'à ce que le total cumulé atteigne ou dépasse 70 % du coût total. Peu nombreux, très importants : à négocier et à surveiller de près.' },
                    { label: 'Catégorie B.', text: 'Ceux qui amènent le total de 70 % à 90 %. Importance moyenne.' },
                    { label: 'Catégorie C.', text: 'Tous les autres, qui représentent les derniers 10 % environ. Un contrôle plus souple suffit.' },
                ] },
                { type: 'callout', kind: 'exemple', blocks: [
                    { type: 'p', text: `Un transformateur achète dix ingrédients pour ${money(ABC.total, 0)} sur la période.` },
                    {
                        type: 'table', head: ['Rang', 'Valeur', 'Part', 'Cumul', 'Catégorie'],
                        rows: ABC.lignes.map((l) => [String(l.rang), money(l.valeur, 0), pct(l.pct / 100, 0), pct(l.cumul / 100, 0), l.classe]),
                    },
                    { type: 'p', text: `Les quatre premiers ingrédients forment la catégorie A (${pct(ABC.A.pct / 100, 0)} du coût) : le quatrième en fait partie parce que le cumul avant lui (62 %) n'avait pas encore atteint 70 %. Quatre ingrédients de la catégorie B pèsent ${pct(ABC.B.pct / 100, 0)}, et deux de la catégorie C ${pct(ABC.C.pct / 100, 0)}. Négocier 5 % de rabais sur les ingrédients A rapporte bien plus que négocier 20 % sur ceux de la catégorie C.` },
                ] },
                { type: 'callout', kind: 'pourquoi', text: 'Croiser l\'analyse ABC et la volatilité donne vos priorités d\'approvisionnement : un ingrédient de catégorie A dont le prix est volatil est celui qui peut le plus facilement déséquilibrer vos marges, et celui pour lequel un contrat à prix fixe, ou un second fournisseur, vaut le plus d\'efforts.' },
                { type: 'callout', kind: 'retenir', text: 'Prenez des points de référence régulièrement. La tendance dit où va un prix, l\'amplitude dit s\'il est capricieux, et l\'analyse ABC dit quels ingrédients comptent le plus. Les trois ensemble désignent ce qu\'il faut surveiller.' },
                { type: 'words', items: [
                    { term: 'Tendance', def: 'la variation d\'un prix entre le premier et le dernier relevé.' },
                    { term: 'Amplitude', def: 'l\'écart entre le prix maximal et minimal, rapporté au prix moyen.' },
                    { term: 'Palier', def: 'la classe de volatilité : faible, modéré ou élevé.' },
                    { term: 'Principe de Pareto', def: 'l\'observation qu\'une minorité d\'éléments (souvent 20 %) explique la majorité (souvent 80 %) d\'un résultat.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-menu',
            title: '12. Quels produits mettre en avant ? La matrice stratégique',
            blocks: [
                { type: 'p', text: 'Pour décider quels produits promouvoir, améliorer ou abandonner, il ne suffit pas de regarder les ventes : un produit très vendu mais à peine rentable occupe votre usine sans enrichir l\'entreprise. La **matrice stratégique** (ou analyse BCG, d\'après la matrice du Boston Consulting Group) croise deux questions pour chaque produit : se vend-il beaucoup ? rapporte-t-il beaucoup ?' },
                { type: 'ul', items: [
                    { label: 'La popularité.', text: 'Un produit est « populaire » si sa part des ventes atteint au moins 70 % de la part moyenne d\'un produit. (Avec dix produits, la part moyenne est de 10 % : le seuil est de 7 %.)' },
                    { label: 'La rentabilité.', text: 'Un produit est « rentable » si sa marge brute en dollars par unité atteint au moins la marge brute moyenne des produits actifs, pondérée par les volumes vendus.' },
                ] },
                {
                    type: 'table', head: ['', 'Rentable', 'Peu rentable'], wrapCells: true, rows: [
                        ['**Populaire**', '**Étoile** — vos piliers : protégez leur qualité, leur visibilité et leur rentabilité.', '**Vache à lait** — ils se vendent bien mais rapportent peu : cherchez à réduire leur coût ou à relever légèrement leur prix.'],
                        ['**Peu populaire**', '**Dilemme** — rentables mais peu vendus : travaillez leur visibilité, leur présentation, leur promotion.', '**Poids mort** — ils se vendent peu et rapportent peu : réinventez-les ou retirez-les pour simplifier la production.'],
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'La classification est relative : un produit est « rentable » par rapport à la moyenne **de vos produits**, pas par rapport à un standard extérieur. Un ensemble de produits tous sont très rentables aura quand même des « poids morts », puisque la moyenne bougera. Utilisez la matrice pour comparer vos produits entre eux, pas pour juger la santé absolue de l\'entreprise.' },
                { type: 'callout', kind: 'retenir', text: 'Étoiles : à protéger. Vaches à lait : à améliorer en marge. Dilemmes : à mieux vendre. Poids morts : à repenser ou à retirer. Le chapitre [[guide-rapport-vue-ensemble|Vue d\'ensemble]] montre la matrice du projet démo.' },
                { type: 'words', items: [
                    { term: 'Matrice stratégique', def: 'méthode qui classe les produits selon leur popularité et leur rentabilité.' },
                    { term: 'Popularité', def: 'la part d\'un produit dans les ventes.' },
                ] },
            ],
        },

        // =====================================================================================
        {
            id: 'guide-concept-reel-theorique',
            title: '13. Le réel et le théorique',
            blocks: [
                { type: 'p', text: 'L\'application fonctionne avec **deux sources de chiffres** qu\'il faut apprendre à distinguer.' },
                { type: 'ul', items: [
                    { label: 'Le théorique, ou « modèle ».', text: 'Ce que vos recettes, vos prix et vos volumes impliquent : le coût de chaque produit calculé à partir des ingrédients, des étapes de production, des prix de vente. C\'est une prévision fondée sur vos hypothèses.' },
                    { label: 'Le réel.', text: 'Ce que votre comptabilité a effectivement enregistré pour la période : vos vrais revenus, vos vraies charges directes, vos vrais frais fixes. C\'est un constat.' },
                ] },
                { type: 'p', text: 'L\'onglet État des résultats reçoit le réel. L\'application compare ensuite les deux, au niveau de l\'entreprise entière : c\'est la **réconciliation**. Un grand écart n\'est pas une erreur de calcul : c\'est un signal que le modèle ne reflète plus la réalité.' },
                { type: 'h', id: 'guide-concept-ecarts', text: 'D\'où viennent les écarts ?' },
                { type: 'ul', items: [
                    'Des **prix** ou des **volumes** du modèle qui ne sont plus à jour : vous avez augmenté un prix en magasin sans modifier la fiche, ou vendu plus que ce que vous avez saisi.',
                    'Des **coûts de recette** trop optimistes : un rendement meilleur que la réalité, un temps de production sous-estimé.',
                    'Des **coûts réels absents du modèle** : des rebuts, des pertes qui ne sont pas dans les fiches.',
                    'Des **ventes réelles sans volume saisi** par canal : le modèle n\'en tient pas compte.',
                    'Une **classification différente** : une dépense rangée en frais fixes dans la comptabilité mais comptée en coût direct dans les recettes (voir [[guide-ff-liste|Frais fixes]]).',
                ] },
                { type: 'callout', kind: 'pourquoi', text: 'Plus le modèle colle à la réalité, plus vous pouvez vous fier aux marges par produit pour décider. Réconcilier régulièrement, c\'est vérifier que vos fiches de coût de revient décrivent encore votre entreprise telle qu\'elle fonctionne aujourd\'hui.' },
                { type: 'callout', kind: 'retenir', text: 'Le théorique est ce que vos fiches prévoient ; le réel est ce que votre comptabilité constate. L\'écart mesure la qualité de votre modèle : un écart important signale des fiches à revoir.' },
                { type: 'words', items: [
                    { term: 'Réel', def: 'les chiffres de votre comptabilité pour la période.' },
                    { term: 'Théorique', def: 'les chiffres que prévoit le modèle de recettes.' },
                    { term: 'Réconciliation', def: 'la comparaison du réel et du théorique.' },
                ] },
            ],
        },
    ],
};
