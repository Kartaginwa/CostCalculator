# Conception du modèle — version approfondie

Ce document remplace la vision simplifiée du 22/09 (« groupe de produits ») par un modèle plus
complet, suite aux précisions de l'utilisateur et à l'analyse des deux chiffriers d'inspiration
(MAPAQ, SymbiOse — voir `01-Analyse-Besoins.md` et `06-Analyse-Chiffrier-SymbiOse.md`). **Statut :
validé.** Ce document reflète le modèle final.

**Principe méthodologique retenu** : ni le MAPAQ ni le chiffrier SymbiOse ne sont reproduits tels
quels — les deux sont des sources d'inspiration. Pour chaque décision de méthode, la question est
« quelle est l'approche la plus juste sur le plan du calcul », puis « comment la rendre utilisable
par un entrepreneur non-CPA » — jamais l'inverse. La qualité de l'app se mesure à la justesse de
ses calculs et à la souplesse de son approche, pas à sa simplicité apparente.

**Principe UI/UX transversal** : ce principe s'applique à toutes les phases, pas à une seule.
Chaque nouvel écran doit être au moins équivalent, idéalement meilleur, que le reste de l'app en
qualité visuelle et en expérience. Une bonne idée introduite dans une phase (un patron
d'interaction, une façon de présenter un calcul) doit être évaluée pour propagation aux écrans
existants plutôt que de rester isolée. Une phase dédiée (Phase 7, voir `03-Feuille-de-route.md`)
revalide l'ensemble de l'app une fois tout construit.

## Entités du modèle

### 1. Activité de production *(nouvelle entité, remplace « groupe de produits »)*

Terminologie alignée sur le MAPAQ à la demande de l'utilisateur. Une activité de production
regroupe des produits qui partagent une même ligne de fabrication (ex. « Confitures »,
« Produits séchés », « Mises en conserve »). Chaque produit est rattaché à **une** activité.

L'activité de production (ainsi que le canal de vente, disponible depuis la Phase 3) est le point
d'ancrage de l'allocation des dépenses de l'entreprise (section Frais fixes). **Méthodologie
revalidée le 12/10** en relisant directement les formules des deux chiffriers d'inspiration
(`Agro-Calculateur-...xlsm` onglet `Rev-Dep`, `Coût de revient_SymbiOse.xlsx` onglet
`6 - Rep. charges fixes` et `Rapport - Coût Revient unit.`) et contre les règles de comptabilité de
gestion — voir le raisonnement complet dans l'échange du 12/10 archivé en session, résumé ici :

- **Saisie manuelle du montant $, méthode principale** : chaque poste de dépense catégorisé est
  réparti par **saisie directe du montant $** dans le bon contenant — Général, une activité de
  production précise, ou un canal de vente précis (validé par le chiffrier SymbiOse, voir
  `06-Analyse-Chiffrier-SymbiOse.md`, section 3) — avec une vérification en temps réel que la somme
  des contenants égale le montant total du poste (comme la colonne « VÉRIFICATION » de SymbiOse).
  Une **clé de répartition** (prédéfinie : au prorata des ventes ou des charges directes ; ou
  personnalisée, nommée par l'utilisateur comme dans le MAPAQ) reste disponible comme **raccourci
  optionnel** qui pré-remplit la grille proportionnellement — modifiable ensuite cellule par
  cellule. Le montant manuel est mis en avant, pas la clé, parce que c'est ce qui se vérifie et se
  comprend le plus facilement pour un entrepreneur non-CPA (confirmé par l'usage réel de SymbiOse).
  Langage concret dans l'UI, jamais « CICI » ou jargon comptable.
- **Général n'est pas un 3e axe symétrique à Activité/Canal.** Activité et Canal sont des
  **regroupements intermédiaires** : leur pool doit ensuite être reconverti en taux par produit
  selon une méthode propre au groupe (voir plus bas). Général est une **allocation directe au
  produit, à une seule étape**, sans regroupement intermédiaire. Ce n'est pas une facilité de
  chiffrier : ça correspond au concept reconnu en comptabilité de gestion (coûts ABC, Cooper &
  Kaplan) de **« facility-sustaining cost »** — un poste qui soutient l'entreprise dans son
  ensemble sans lien de causalité avec une ligne ou un canal précis (salaire de direction,
  assurance générale...). Preuve algébrique : répartir un poste via Général avec la clé « ventes »
  donne, par produit, exactement `montant × (part du produit dans le CA total)` ; faire transiter
  ce même poste par une activité qui reconvertit ensuite SON pool selon les ventes **à l'intérieur
  de l'activité** donne le même résultat (les parts s'annulent) — mais dès que cette activité choisit
  une méthode de conversion différente (temps de MO, charges directes), les deux résultats
  divergent, et seul Général préserve une allocation non distordue pour un poste qui n'a réellement
  aucun lien avec cette activité. C'est pourquoi le MAPAQ — qui n'a qu'une seule dimension de
  regroupement (les activités) et pas de vrais circuits de vente — n'a pas besoin de cette
  catégorie : sa clé « ventes » joue déjà ce rôle neutre en l'absence d'une deuxième dimension à
  protéger.
- **Conversion du pool en taux par produit — trois mécanismes distincts selon le contenant :**
  - **Général** : conversion directe à une étape — pool × part du produit (ventes, charges
    directes, ou montant manuel) ÷ son propre volume. C'est la méthode déjà présente dans
    RestoCalculateur (`indirectCostMethod` global dans `calculateCosts.js`), réutilisée sans
    modification pour ce pool précis.
  - **Activité de production** : une fois son pool connu, reconverti en taux par produit selon une
    méthode choisie **pour cette activité** (au prorata des ventes, du temps de main-d'œuvre, ou du
    coût direct de ses propres produits) — même mécanisme que ci-dessus, simplement re-scopé aux
    produits de cette activité plutôt qu'à tout le menu.
  - **Canal de vente** *(mécanisme ajouté le 12/10 — absent de la version précédente de ce
    document)* : une fois son pool connu, reconverti en un **taux plat par unité** = pool du canal
    ÷ volume total vendu dans ce canal, tous produits confondus (`channelPrices[].volume`) — validé
    directement dans les formules du « Rapport - Coût Revient unit. » de SymbiOse (la part propre
    du produit s'annule algébriquement, donnant un taux uniforme pour tout SKU vendu par ce canal).
    Un format vendu par plusieurs canaux absorbe une moyenne pondérée par sa propre répartition de
    volume entre canaux — réutilise `blendAcrossChannels` (Phase 3) plutôt que de construire un
    second mécanisme de pondération en parallèle.

**Catégories de frais — nécessaires, pas juste pour se repérer.** Chaque poste de dépense de
l'état de résultats appartient à une catégorie, qui a deux effets concrets (pas seulement
organisationnels) : (1) elle suggère un **contenant par défaut**, sans l'imposer — un frais de
vente n'a normalement aucune raison de se répartir entre les lignes de production, un frais général
de production n'a normalement aucune raison de se répartir entre les canaux, mais rien n'empêche
une exception manuelle (ex. un loyer partiellement dédié à une ligne, comme dans le chiffrier
SymbiOse) ; (2) elle permet un **rapprochement propre avec un état des résultats comptable réel**,
nécessaire pour l'assistant d'import (voir `05-Imports-Integrations.md`) et pour un tableau de bord
type « d'où viennent mes coûts ». Quatre catégories retenues :

| Catégorie | Contenant suggéré par défaut |
|---|---|
| Frais généraux de production | Général ou Activité de production |
| Frais de vente / mise en marché | Général ou Canal de vente |
| Frais d'administration | Général (ventilable manuellement si pertinent) |
| Frais financiers | Général (rarement rattachable à une ligne/canal) |

C'est un modèle à **un étage** pour Général (allocation directe) et à **deux étages** pour
Activité/Canal (entreprise → groupe → produit), fidèle aux mécanismes validés dans le MAPAQ et
SymbiOse, mais présenté avec un vocabulaire métier et une réconciliation exacte automatique (pas de
vérification manuelle ±10 % comme chez MAPAQ) — avec, en prime, la vérification en temps réel du
total réparti (comme la colonne « VÉRIFICATION » du chiffrier SymbiOse).

**Implémentation (Phase 4.5, terminée le 13/10)** — précisions tranchées pendant la construction,
non anticipées dans le texte ci-dessus :
- **Deux axes INDÉPENDANTS, pas une grille croisée** : Général vit dans le même espace de
  contenants que les activités (`activityAllocations`, même structure que `revenueLines.amounts`
  en 4.2 — Général + chaque activité) ; Canal est un second axe séparé (`channelAllocations`),
  sans contenant Général équivalent. Une même dépense peut donc avoir une partie répartie par
  activité ET une partie (indépendante) répartie par canal — ce sont deux ventilations parallèles
  du même montant, pas une matrice 2D croisée (activité × canal) comme un tableau croisé dynamique.
  Chaque axe a sa propre vérification contre le Montant de la ligne.
- **La vérification ne bloque jamais, et ne force aucun axe à être complété** : une dépense qui ne
  s'applique naturellement qu'à un seul axe (ex. un loyer n'a aucune raison de se répartir par
  canal) peut rester incomplète sur l'autre en permanence — l'indicateur (coche verte si les 2 axes
  sont à 100 %, avertissement sinon, avec le détail du manque/surplus par axe en infobulle) est
  purement diagnostique, jamais une condition pour sauvegarder ou avancer.
- **« Clé de répartition » limitée à Manuel / Selon les ventes / Selon les charges directes** pour
  cette livraison — la clé **personnalisée nommée** évoquée plus haut est **reportée**. Les clés
  prédéfinies réutilisent directement les sous-totaux déjà calculés pour Revenus (4.2) et Charges
  directes réelles (4.3bis) — aucun nouveau calcul moteur, juste une lecture des totaux déjà
  affichés plus haut dans l'onglet.
- **Reconciliation à la sauvegarde/chargement** : un id d'activité orphelin (activité supprimée)
  refond son montant dans Général, comme pour `revenueLines` (jamais perdu). Un id de canal orphelin
  n'a pas d'équivalent neutre côté canal — conservé tel quel dans les données (toujours compté dans
  la vérification), simplement sans colonne visible pour ce canal disparu.

**Révision (Phase 4.5bis, 14/10)** — quatre retours utilisateur après usage réel de la 4.5 ont fait
évoluer le modèle ci-dessus :
- **Clé ≠ Manuel verrouille désormais la grille**, au lieu de rester un pré-remplissage ponctuel
  toujours éditable : avec une liste de dépenses réelle, laisser une cellule pré-remplie mais
  modifiable créait un risque de double-saisie silencieuse (modifier la cellule sans changer la clé,
  ou l'inverse). Conséquence directe : la grille d'une ligne non-Manuel n'est **plus une valeur
  stockée** — elle est recalculée EN DIRECT à chaque rendu (`expenseLineEffectiveAllocations`, dans
  IncomeStatementTab.jsx) à partir du Montant courant, pour ne jamais figer un nombre qui
  deviendrait faux si le Montant change ensuite après coup. Revenir à Manuel fige (« bake in ») la
  dernière valeur calculée comme point de départ, de nouveau librement éditable.
- **Sélection directe d'une seule activité ou d'un seul canal** (inspirée de la colonne
  « Répartition » de l'Agro-Calculateur, onglet Rev-Dep, qui liste aussi chaque poste individuel —
  pas seulement des méthodes globales) : la liste « Clé de répartition » propose désormais, en plus
  de Manuel/Selon les ventes/Selon les charges directes, chaque activité (dont Général) et chaque
  canal individuellement. Choisir une activité (ou un canal) précis attribue 100 % du Montant à
  cette seule colonne.
  - Clé stockée comme chaîne préfixée : `activity:<bucketKey>` / `channel:<channelId>` /
    `custom:<id>` (en plus de `manual`/`sales`/`directCosts`).
- **Clé personnalisée nommée, livrée** (la UI de gestion dédiée anticipée comme bloquant en 4.5
  s'est avérée une simple fenêtre modale, pas un nouvel onglet) : une clé définit un % par activité
  et/ou un % par canal, gérée dans `repartitionKeys` (nouvelle tranche d'état, nouveau fichier de
  projet) via une fenêtre modale dédiée (bouton en haut de l'onglet) plutôt qu'en ligne dans le
  tableau, car une clé est réutilisable sur plusieurs lignes de frais fixes — pas une donnée d'une
  seule ligne. Réconciliation au chargement : une part d'activité orpheline refond dans Général
  (même principe que `activityAllocations`) ; une part de canal orpheline est conservée telle quelle
  (même asymétrie que `channelAllocations`). Une clé personnalisée (ou un canal) supprimée pendant
  qu'une ligne la référence fait retomber cette ligne sur `manual` au chargement suivant — pas
  d'équivalent neutre à proposer pour une définition qui n'existe plus.
- **Montants arrondis à 2 décimales** (`round2`, `utils.js`) partout dans la grille Activités/
  Canaux — saisie manuelle au blur et toutes les valeurs dérivées (clés prédéfinies, sélection
  directe, clé personnalisée) — pour éviter les décimales résiduelles d'un calcul proportionnel.

**Correction (même jour, 14/10, suite à un nouveau retour utilisateur)** — le modèle « deux axes
INDÉPENDANTS » décrit plus haut (chaque axe réclamant séparément 100 % du Montant, avec sa propre
vérification) s'est avéré **une erreur** une fois testé contre un cas réel : il permettait à une
même dépense d'être comptée deux fois (une fois « complète » côté Activités, une fois « complète »
côté Canaux), ce qui aurait faussé toute agrégation ultérieure (Phase 4.6). Le modèle corrigé, plus
fidèle à SymbiOse (feuille « 6 - Rep. charges fixes », qui n'a jamais qu'UNE rangée de vérification
par dépense, pas une par axe) :
- **Activités et Canaux forment UN SEUL bassin partagé**, pas deux axes indépendants : la somme de
  TOUTES les cellules d'une ligne (contenants d'activité + contenants de canal confondus) ne doit
  jamais dépasser le Montant — jamais bloquant, mais signalé par un seul badge de vérification par
  ligne (`diff = Montant − Σ(Activités) − Σ(Canaux)`), pas deux diffs séparés comme avant.
- **« Selon les ventes »/« Selon les charges directes » ne touchent plus que l'axe Activités.** La
  ventilation par canal affichée dans les sections Revenus et Charges directes réelles est
  explicitement **indicative** (jamais un intrant de calcul, voir plus bas) — la réutiliser comme
  source réelle pour Frais fixes en aurait fait, à tort, une vraie donnée, en plus de doubler le
  montant compté si additionnée à l'axe Activités. Un montant ne peut désormais être attribué à un
  canal que par une sélection directe de ce canal, une clé personnalisée, ou une saisie manuelle.
- **Sélection directe d'une activité ou d'un canal verrouille toute la ligne** (pas seulement l'axe
  choisi) : le bassin étant partagé, 100 % du Montant dans une colonne d'activité ne laisse plus
  rien pour un canal, et vice-versa.
- `activityLocked`/`channelLocked` (deux indicateurs par ligne) remplacés par un seul `locked` ;
  `activityDiff`/`channelDiff` remplacés par un seul `diff`.

### 1bis. État des résultats (réel) et réconciliation avec le théorique *(ajouté le 12/10)*

Extension du raisonnement ci-dessus suite au retour utilisateur : les frais fixes catégorisés
(4.1) ne sont qu'un côté de l'état de résultats. Pour que la clé « selon les ventes » (allocation
des frais fixes par contenant) ait un chiffre d'affaires réel à utiliser — et plus largement, pour
que l'app reflète la vraie situation financière plutôt que seulement le modèle de recette — la
section se transforme en un **onglet « État des résultats »** (renomme « Frais fixes », qui en
devient une sous-section), avec trois nouveaux éléments :

- **Revenus réels** : même patron que les frais fixes (une ligne nommée = un poste de revenu,
  réparti par **montant $ direct** entre les mêmes contenants), avec deux différences volontaires :
  - **Seulement Général ou Activité** — pas de canal éditable. Un dollar de revenu provient
    toujours de la vente d'un produit, donc toujours d'une activité précise (ou, pour un revenu non
    rattachable à un produit modélisé — ex. revenu divers —, de Général, qui remplace ainsi
    l'ancien `menuRevenuePercentage` de façon plus flexible : une vraie ligne nommée plutôt qu'un
    pourcentage global unique).
  - **Le canal reste visible, mais à titre indicatif seulement, jamais dans un calcul** : pour
    chaque ligne, une ventilation par canal est **dérivée automatiquement** du montant entré, au
    prorata du chiffre d'affaires théorique par canal de l'activité concernée (`channelBreakdown`
    des formats de cette activité, déjà calculé par `analysisData.js`) — jamais saisie
    indépendamment. Une info-bulle précise explicitement que cette répartition est une estimation,
    pas une donnée réelle vérifiée, pour ne jamais laisser croire à une précision inexistante.
    Raison méthodologique : mélanger un chiffre de canal saisi indépendamment avec la clé de
    répartition « ventes » casserait la réconciliation exacte (deux sources qui devraient concorder
    mais pourraient diverger) — en le gardant purement dérivé, aucun risque.
  - **Limite assumée et documentée** : la répartition par ACTIVITÉ elle-même utilise le mix de
    vente déjà déclaré (`salesMix`/`channelPrices`) comme clé — donc le chiffre "revenu réel de
    cette activité" est un hybride (total réel × proportion théorique), pas une mesure indépendante
    à ce niveau de détail. La réconciliation réel/théorique (voir plus bas) reste pleinement
    rigoureuse **au niveau de l'entreprise entière** (deux totaux réels comparés sans hypothèse
    commune) ; au niveau de l'activité, l'écart est partiellement circulaire et doit être présenté
    comme indicatif, pas comme un signal de dérive fiable à ce grain-là.
  - **Mécanisme de répartition révisé le 13/10**, inspiré directement de la colonne « Répartition »
    de l'Agro-Calculateur MAPAQ (onglet `Rev-Dep`) : chaque ligne choisit une **répartition** parmi
    Général, une activité précise, ou **Saisie manuelle**. Hors saisie manuelle, le montant édité
    s'affiche tel quel dans la seule colonne de contenant correspondante (grille Général + une
    colonne par activité, affichée **avant** les colonnes de canal indicatives — même ordre que
    MAPAQ : contenants d'abord, canal ensuite) ; les autres colonnes affichent « — ». En Saisie
    manuelle, c'est l'inverse : chaque colonne de contenant devient directement éditable (une ligne
    peut alors se répartir sur plusieurs contenants à la fois, comme dans le chiffrier SymbiOse), et
    le Montant devient un total calculé en lecture seule. Modèle de données : `revenueLines[i] =
    { id, label, repartition: 'general' | <activityId> | 'manual', amounts: { [contenant]: montant
    } }` — `amounts` ne porte jamais plus d'une clé non nulle hors du mode manuel. La ventilation
    par canal (indicative, voir ci-dessus) se généralise à la somme pondérée de tous les contenants
    non-Général de la ligne, pour couvrir aussi bien une ligne à un seul contenant qu'une ligne
    manuelle répartie sur plusieurs activités.
- **Colonnes harmonisées entre les 3 tableaux (ajouté le 13/10)** : Revenus, Charges directes
  réelles et Frais fixes partagent désormais le même jeu de colonnes de tête — **Poste | Catégorie
  | Clé de répartition | Montant ($)** — même quand l'une d'elles ne sert pas encore à un tableau
  donné (affichée alors comme une cellule neutre « — », jamais retirée ni fusionnée avec l'autre,
  ces deux colonnes répondant à des questions différentes : « quelle est la nature comptable de ce
  poste » vs « comment ce montant se distribue dans l'entreprise »). Revenus n'a pas de concept de
  Catégorie (une vente n'a pas de nature comptable à classer) ; Charges directes n'a pas de Clé de
  répartition éditable (toujours dérivée automatiquement, voir plus bas) ; Frais fixes aura les
  deux une fois la Phase 4.5 implémentée (Catégorie existe déjà depuis 4.1, Clé de répartition est
  pour l'instant un espace réservé).
- **Charges directes réelles** : ventilées par **type de coût** — Matière première, Main-d'œuvre
  directe, Emballage, Sous-traitance — réutilisant le vocabulaire déjà présent dans
  `calculateCosts.js` (`totalIngredientsCost`/`totalLaborCost`/`totalPackagingCost`/
  `totalSubcontractingCost`), **pas** les 4 catégories de frais fixes (qui décrivent une fonction
  d'entreprise, pas une nature de coût de production) ni la typologie du MAPAQ. Constat en relisant
  l'Agro-Calculateur (`Rev-Dep`, ligne 108) : le MAPAQ ne catégorise d'ailleurs pas du tout ses
  charges directes manuellement — il rapatrie automatiquement le total déjà calculé par sa feuille
  de coût de production (`Coût Prod.`), confirmant que la bonne source de vérité théorique est déjà
  le moteur de recette, pas une nouvelle catégorisation à inventer. La ventilation par type permet
  une comparaison réel/théorique plus fine (par type, en plus du total), mais **si ce total sert un
  jour de base à une clé de répartition ailleurs dans l'app (ex. « selon les charges directes »),
  c'est toujours le total agrégé réel qui est utilisé** — jamais la ventilation par type, qui reste
  un outil de diagnostic.
- **Répartition par activité puis par canal de vente, indicative (ajoutée le 13/10)** : contrairement
  aux revenus, une charge directe réelle n'arrive pas en comptabilité déjà rattachée à une activité
  précise — impossible de la saisir par contenant comme pour les revenus. Chaque ligne est donc
  ventilée **automatiquement**, par un driver théorique **apparié à son propre type de coût**
  (jamais un type croisé — ex. de l'emballage réel ne se répartit jamais avec une clé de
  main-d'œuvre théorique, ce qui serait arbitraire) :

  | Catégorie (réelle) | Driver théorique (`costs`, `calculateCosts.js`) |
  |---|---|
  | Matière première | `costMatierePerPortion` |
  | Main-d'œuvre directe | `costLaborPerPortion` |
  | Emballage | `costPackagingPerPortion` |
  | Sous-traitance | `costSubcontractingPerPortion` |

  Le driver choisi est un coût (pas un prix/revenu) parce qu'une charge directe suit la production
  (volume), pas le prix de vente — une clé « ventes » ferait absorber plus de charge matière à une
  activité à prix élevé mais petit volume qu'à une activité à bas prix mais gros volume, ce qui
  fausserait l'analyse. Mécanique (`computeDirectCostAllocation`, `analysisData.js`) : part par
  activité = coût théorique du type ÷ coût théorique total du type (toutes activités confondues) ;
  part par canal au sein d'une activité = même ratio appliqué au volume réel par canal
  (`channelBreakdown[].volume`). Les deux parts normalisent à 100 %, donc le montant réel appliqué
  reconstitue toujours exactement son propre total — réconciliation exacte par construction, même
  principe que la ventilation canal des revenus. Une activité sans aucune donnée théorique de ce
  type (ex. 100 % revente, pas de coût de main-d'œuvre directe) en est simplement absente — jamais
  une part forcée à 0. Si AUCUNE activité n'a de donnée théorique pour un type (ex. une charge de
  sous-traitance réelle saisie sans qu'aucune recette n'ait d'item de sous-traitance configuré), le
  montant retombe intégralement sur **Général** plutôt que de forcer une répartition inventée.

  Affiché **ligne par ligne** (pas seulement au sous-total) : deux lignes de même catégorie
  affichent la même répartition en % (le driver dépend de la catégorie, pas du contenu de la
  ligne), mais c'est exactement le même principe déjà appliqué à la ventilation canal des revenus
  (dérivée au niveau de l'activité, répétée sur chaque ligne qui s'y rattache) — jamais signalé
  comme un problème là-bas, pas une raison de s'en écarter ici. Le sous-total par colonne
  (`<tfoot>`, même patron que Revenus) suffit à donner les totaux agrégés.
- **Comparaison avec MAPAQ (`Rev-Dep`, ligne 108)** : MAPAQ ne répartit pas du tout ses charges
  directes par activité/canal — sa ligne « Charges directes » est simplement rapatriée telle quelle
  depuis sa feuille de coût de production (`Coût Prod.`), qui calcule déjà nativement un coût par
  SKU (donc par activité). MAPAQ n'a donc pas besoin d'étape de répartition parce qu'il n'essaie pas
  de faire correspondre ce chiffre à un total réel saisi à ce niveau de détail. RestoCalculateur va
  un cran plus loin (dériver les PARTS du théorique mais les appliquer au MONTANT RÉEL) précisément
  parce que la réconciliation exacte par construction est déjà un principe établi du projet
  (supérieur à la vérification manuelle ±10 % de MAPAQ — voir `01-Analyse-Besoins.md`).
- **Tableau de réconciliation réel/théorique** (bas de l'onglet, une fois les sections remplies) :
  compare, au niveau de l'entreprise, le réel saisi (Revenus, Charges directes, et par construction
  la Marge) au théorique implicite du modèle de recettes (Σ `prixVente` × volumes du modèle,
  Σ coûts calculés par `calculateCosts.js`). Mesure directement la qualité des hypothèses du modèle
  (mix des ventes, coûts de recette) contre la réalité comptable — extension du patron déjà présent
  dans l'app pour la main-d'œuvre (rapport de productivité, « heures attendues » vs « heures
  réelles nécessaires »), pas un concept étranger.

**Conséquence** : `generalInfo.menuRevenuePercentage` (et la notion de « revenu du menu analysé »)
disparaît — remplacé par une ligne de revenu « Général » quand une part du chiffre d'affaires n'est
pas rattachable à une activité modélisée. Champ touché dans 9 fichiers (`calculateCosts.js`,
`analysisData.js`, `App.jsx`, sérialisation, tests...), à retirer proprement, pas en silence.

**Frais fixes par unité = pool réel ÷ unités théoriques** (celles du modèle de recettes/mix des
ventes, pas les unités réellement vendues) — cohérent avec la logique de taux prédéterminé déjà
en place (`indirectCostMethod`), simplement nourri par un pool réel plutôt que par une seule saisie
globale. **Précision ajoutée le 13/10, après une mauvaise lecture de cette note en 4.4** : ceci
décrit le mécanisme du contenant **Général** uniquement (Phase 4.6 — `indirectCostMethod` réutilisé
tel quel, calcul **par produit**, à l'intérieur de `calculateCosts.js`) — jamais une seule moyenne
globale (pool total de frais fixes ÷ total d'unités de l'entreprise). Les contenants Activité et
Canal ont chacun leur propre conversion en taux (voir Phase 4.6, `03-Feuille-de-route.md`), toujours
par contenant et par produit. Les frais fixes ne figurent donc jamais dans le tableau de
réconciliation réel/théorique (4.4, qui ne compare que Revenus/Charges directes/Marge) : leur
conversion en taux appartient entièrement à 4.5/4.6, et son résultat final s'affiche dans le rapport
par SKU — pas comme une statistique isolée dans l'État des résultats.

**Assistant d'import (voir `05-Imports-Integrations.md`)** : devra éventuellement lire un état des
résultats fourni en PDF et reconstituer automatiquement chaque poste (revenu ou dépense). Portée
honnête : fiable pour un PDF **textuel** (export d'un logiciel comptable, le cas le plus fréquent en
pratique) ; un PDF **scanné/image** demanderait de l'OCR, une technologie nettement plus lourde et
moins fiable dans une appli desktop client-side — traité comme une amélioration future, pas un
prérequis de la Phase 4.

### 1ter. Conversion des frais fixes en taux par produit (Phase 4.6, ajouté le 14/10)

Avant d'implémenter, l'utilisateur a explicitement demandé une vérification de rigueur comptable —
pas juste reproduire la mécanique des deux chiffriers de référence. Démarche suivie :

**1. Formules réelles extraites des deux chiffriers** (pas seulement leur structure) :
- SymbiOse (`Rapport - Coût Revient unit.`, lignes 39-41) : `Charges fixes générales/unité =
  (Pool_Général × % du produit dans les ventes totales) / unités du produit`. Comme ce % est
  *défini* comme `unités du produit / unités totales`, la formule se simplifie algébriquement,
  **toujours**, à `Pool_Général / unités totales du menu` — un taux PLAT, malgré son apparence de
  prorata pondéré. Même chose pour Activité (`Pool_activité / unités à produire de cette activité`,
  une vraie formule de table croisée dans « Rapport - Capacité de prod ») et Canal (le volume du
  produit s'annule dans la formule, ne laissant que `Pool_canal / volume total du canal`).
- Agro-Calculateur (`Synthèse`, « Coefficient d'imputation ») : même principe — `Coût de production
  par unité = (charges directes + charges indirectes de l'activité) / volume produit par cette
  activité`. Le « coefficient » vu dans la section recette n'est PAS un choix libre par produit :
  c'est juste la **sélection de l'activité**, dont le driver et le taux sont déjà fixés en amont
  (`Rev-Dep`, liste de drivers : charges directes / main-d'œuvre / volume / superficie).

**2. Confrontation aux principes de comptabilité de gestion (ABC, Cooper & Kaplan)** : un driver
purement volumétrique (« pool ÷ nombre d'unités ») suppose une économie d'unité homogène — invalide
dès que les formats varient en taille, ce que les DEUX chiffriers ignorent mais que
RestoCalculateur ne peut pas se permettre d'ignorer (un format 220 g et un format 1 kg de la même
recette, exactement comme chez SymbiOse, absorberaient le même montant par unité avec un driver
« par tête », alors que le format 1 kg consomme nettement plus de ressources). Le driver doit
refléter la consommation RÉELLE de ressources, pas un décompte brut.

**3. Décision finale** — même structure à 3 contenants que les deux références (ABC : Général =
coût *facility-sustaining*, Activité = coût *product-line-sustaining*, Canal = coût
*customer-sustaining* — RestoCalculateur, avec son contenant Général, est plus rigoureux qu'un
Agro-Calculateur qui force tout dans une activité/un canal), mais une mécanique de conversion
différente :
- **Général** : mécanisme `indirectCostMethod` existant (ventes ou temps de MO), inchangé — déjà
  mathématiquement équivalent à SymbiOse en usage normal (sans override manuel de
  `portionsSold`) — appliqué à un pool réduit à sa seule part Général.
- **Activité** : driver choisi **par activité** (Paramètres → Activités de production), parmi
  **« Selon les charges directes »** (matière + emballage + main-d'œuvre + sous-traitance
  COMBINÉS — pas un seul composant isolé, défaut recommandé car il capture à la fois le volume et
  la complexité d'un produit) ou **« Selon le temps de main-d'œuvre »** (préférable quand le coût
  indirect suit la cadence/le temps machine plutôt qu'une pure valeur d'intrants). Les deux sont
  déjà calculés par format (`calculateCosts.js`) — pas besoin d'inventer un nouveau concept de
  données (« unités produites ») que l'app ne suit pas, contrairement aux deux chiffriers.
  Normalisation : `taux = pool_activité ÷ Σ(driver × volume vendu, pour les produits de CETTE
  activité SEULEMENT)` — deux activités peuvent choisir des drivers différents sans que la
  réconciliation en souffre, chaque pool se normalisant contre ses propres produits.
- **Canal** : **AUCUN driver au choix** (contrairement à Activité) — toujours une **majoration %
  sur le coût de production** déjà établi à l'activité. `taux_canal = pool_canal ÷ Σ(coût de
  production × volume RÉEL de `format.channelPrices`, pour TOUS les produits de ce canal)` ;
  `part_canal_d'un_produit = son propre coût de production × taux_canal`. Un canal sans aucun
  volume réel saisi nulle part reste simplement sans part de canal calculable, jamais un 0 inventé.
- **Limite assumée (Activité seulement)** : la rigueur à ce niveau de granularité (un driver par
  ACTIVITÉ, pas par ligne de frais fixes individuelle) dépend de l'homogénéité des coûts qu'une
  activité regroupe — un pool mélangeant des natures de coût très différentes (ex. électricité ET
  salaire de supervision) n'a pas de driver parfait pour les deux à la fois. Responsabilité
  partagée avec le tableau « contenant suggéré par catégorie » (section 1bis) au moment de
  l'allocation (4.5/4.5bis) — une ABC parfaitement pure irait jusqu'à un sous-pool par nature de
  coût, hors de portée de cette phase.

**4. Correction (même jour, 14/10, 2e retour utilisateur)** — ma première proposition pour Canal
offrait elle aussi un driver au choix (ventes/charges directes/temps de MO), par analogie avec
Activité. L'utilisateur a repoussé cette idée, se rappelant que dans l'Agro-Calculateur, le CICI ne
se choisit **qu'à l'activité**, jamais par circuit. Vérification formule par formule (pas juste la
structure, cette fois) de la matrice « Coût de revient complet » (`Synthèse`, lignes 27+) :
```
E27 = D27 + (D27 × ('Rev-Dep'!AD107 / SOMMEPROD(coût_production_unitaire, volume_vendu_ce_circuit, TOUS les SKU)))
```
où `D27` = coût de production du produit (déjà établi via LE SEUL CICI, celui de son activité).
**Il n'y a aucun sélecteur de driver par circuit dans l'Agro-Calculateur** — le circuit prend le
coût de production déjà établi (peu importe quel CICI/driver l'a produit) et lui applique une
majoration % **uniforme pour tout le circuit**, toujours proportionnelle à ce même coût de
production — jamais aux ventes, jamais au temps de MO, jamais un choix indépendant. C'est la
méthode traditionnelle de comptabilité de gestion dite **« majoration sur coût de production »**
(percentage of production/prime cost), qui :
- **hérite automatiquement de la fidélité déjà établie à l'activité** (un produit plus cher/complexe
  à produire absorbe proportionnellement plus de frais de canal — le problème « pot 220 g vs 1 kg »
  ne revient pas par la porte d'en arrière, puisque le coût de production l'a déjà résolu) ;
- **se réconcilie exactement** par construction (`Σ(coût_i × taux × volume_i) = taux × Σ(coût_i ×
  volume_i) = taux × dénominateur = pool`, toujours) ;
- a une limite honnête déjà documentée : si un pool de canal contient un vrai coût proportionnel
  aux ventes (ex. une commission), cette méthode reste une approximation — mais c'est précisément
  pour cette raison que SymbiOse traite les commissions **séparément** de ses charges fixes
  (feuille « 7 - Frais de mise en marché », % direct du prix, jamais dans le pool de charges
  fixes) ; RestoCalculateur n'a pas encore ce mécanisme dédié (hors scope de 4.6, déjà noté
  ci-dessus) — l'approximation par coût de production reste la meilleure option disponible avec les
  briques déjà en place, pas une erreur de conception.

Supprimé en conséquence : le sélecteur de driver par canal (Paramètres → Circuits de vente), le
champ `indirectCostDriver` sur `salesChannels`, et la branche `driver` de
`computeChannelBreakdown`/`computeIndirectCostDriverTotals` (un seul total par canal désormais, pas
un par driver).

**Implémentation** : calcul en deux passes dans `App.jsx` (`computeAnalysisData` sans pools pour
lire les coûts directs/volumes déjà fiables → pools construits → `computeAnalysisData` à nouveau
avec les pools). `indirectPools` est un paramètre optionnel en toute fin de signature (absent =
comportement strictement inchangé). Chaque canal d'un format reçoit sa PROPRE part de canal (en
plus de Général+Activité, communs à tous ses canaux) — une marge nette différente par canal, pas
seulement à cause du prix. Voir `03-Feuille-de-route.md`, section 4.6, pour le détail des fichiers
touchés et les tests.

**Conséquence sur Recette & Calcul / Rapport** (demandé le 14/10) : Recette & Calcul ne montre plus
que le COÛT DE PRODUCTION (matière + emballage + main-d'œuvre + sous-traitance) — la section
« Frais indirects » en a été retirée. Le coût de revient complet (avec Général/Activité/Canal, la
marge nette et le point mort) vit entièrement dans Rapport → Par SKU, qui affiche désormais le
détail des trois contenants ligne par ligne (inspiré du rapport « Coût de revient unit. » de
SymbiOse), avant le total déjà affiché depuis le 06/10.

### 2. Packaging *(nouveau module, PAS un ingrédient)*

- Catalogue séparé `basePackaging` (miroir structurel de `baseIngredients` : fournisseur, format
  d'achat, unité, prix, perte %).
- Dans l'onglet Recette & Calcul : une **section dédiée**, visuellement et structurellement
  distincte de la section Ingrédients (même table de rendu, autre en-tête, autre couleur de
  section — comme les sections actuelles Ingrédients/Main-d'œuvre/Indirects). Rattachée au
  **format de vente** (voir section 2bis), pas directement à la recette mère, puisque chaque
  format a son propre emballage.
- Poste de coût **séparé** dans `calculateCosts.js` : `totalPackagingCost` /
  `costPackagingPerPortion` / `costPackagingPercent`, jamais fusionné dans le coût matière.
- Le récapitulatif de recette affichera donc 4 % (et non 3) : matière, **emballage**,
  main-d'œuvre, indirects — chacun comme part du coût de revient total, calculé par format.

### 2bis. Recette mère et formats de vente *(décision : vrai système de formats)*

Un **produit** (la recette) est un **regroupement organisationnel** (nom, catégorie, ligne de
production) qui rassemble un ou plusieurs **formats de vente** apparentés — ex. « Confiture de
fraises » → formats 250 ml et 500 ml. C'est le format, pas le produit, qui est l'unité réelle de
coûtation : chaque format porte sa **propre fiche recette complète et autonome** — ingrédients,
étapes de production/main-d'œuvre, rendement, sous-traitance/vieillissement, prix, mix des ventes,
statut revente. Deux formats du même produit peuvent avoir des ingrédients et des étapes de
fabrication entièrement différents.

**Vocabulaire précisé le 04/10 (retour utilisateur) : le format n'est pas le SKU.**
- **Format** = l'emballage et la quantité (ex. « 250 ml », « 1 kg »). C'est l'attribut qu'une
  personne choisit, et c'est la continuité directe de ce qui existait déjà dans RestoCalculateur
  sous le nom de « quantité par portion » (`portionSize`/`portionUnit`) — pas un concept ajouté en
  parallèle.
- **SKU** = un numéro/code de référence **dérivé** de la recette + du format (ex. SymbiOse :
  `TEM-01-TU` = ligne + catégorie + produit + **format**). Ce n'est pas une donnée saisie
  indépendamment ; il se génère automatiquement (`buildFormatSku`, combine le nom du produit et le
  format) et reste librement modifiable ensuite.
- Implication concrète : le format (quantité + unité) s'édite dans **Paramètres → Produits et
  SKUs** (nouvelle colonne Format) ; Recette & Calcul affiche le format — pas le SKU — comme
  étiquette de ses onglets, et ne garde plus de champs « Quantité par portion »/« Unité » séparés
  (c'était le format en double). Voir Phase 1.5quater dans `03-Feuille-de-route.md`.

**Décision tranchée le 23/09, après un premier essai erroné.** L'idée initiale — un seul lot de
recette mère partagé, avec son coût réparti entre formats au prorata du rendement de chacun — a
été abandonnée en cours d'implémentation : elle aurait fait porter à CHAQUE format 100 % du coût
du lot (comme si chaque format était fabriqué en lot séparé), une double comptabilisation dès
qu'un produit a plus d'un format actif. Confirmé sans ambiguïté par l'analyse du chiffrier
SymbiOse (`06-Analyse-Chiffrier-SymbiOse.md`, trouvaille n°1) : la feuille « Coût Prod. » y est un
**bloc répété par SKU**, chacun avec ses propres quantités de matières premières et son propre
rendement (poids/volume final obtenu ÷ matières premières engagées, puis un taux de rejet des
produits finis) — pas un lot commun réparti après coup. Confirmé également par « Rapport -
Capacité de prod », qui calcule les lots nécessaires **par SKU** : chaque SKU tourne ses propres
lots de production, il n'y a pas de lot partagé à l'échelle du produit. Le modèle retenu supprime
donc tout besoin d'allocation de coût entre formats : chaque format calcule son coût en entier,
à partir de sa propre liste.

Chaque format a également :
- un **code SKU dérivé** (auto-généré à partir de la recette + du format, éditable) — pratique
  professionnelle confirmée par le chiffrier SymbiOse (`LIGNE-CATEGORIE-PRODUIT-FORMAT`) ;
- son propre **emballage** (module Packaging, à venir — recoupe directement la notion de format) ;
- ses propres **prix par circuit de vente** (section 3, à venir).

C'est le changement le plus structurant du projet : il touche `products` (regroupement +
`formats[]`, chacun avec sa fiche recette), `calculateCosts.js` (coût calculé entièrement à partir
du format), et tous les écrans qui affichent un produit (Recette & Calcul, Résumé, Suivi, rapports,
POS import). **Fondation à construire en premier**, avant Packaging et Frais fixes, puisque ces
deux modules s'y rattachent.

**État d'implémentation (Phases 1.3-1.5 + correctifs du 23/09, terminées) :**
`products[i].formats[]` existe, chaque format porte sa propre fiche recette (`ingredients`,
`productionSteps`, `isResaleProduct`, `purchaseCost`, `manualAllergens` — déménagés du produit vers
le format ; `stripFormatOwnedFields`/`buildDefaultFormat` dans `initialState.js`), et
`calculateCosts.js` lit tout depuis le format sélectionné (voir `03-Feuille-de-route.md`).
**Répartition des responsabilités entre écrans** : la **gestion** des formats — création,
duplication, suppression, SKU, prix, mix des ventes, au menu — se fait dans **Paramètres →
Produits et SKUs** (`ProductInfo.jsx`), qui affiche une ligne par format/SKU, comme la feuille
« 1 - Produits » du chiffrier SymbiOse ; c'est là qu'on ajoute un format à un produit, pas dans
Recette & Calcul. `RecipeCalculator.jsx` garde un **sélecteur** de format (onglets cliquables) et
sert à éditer le détail d'un format déjà créé — recette, coûts, rendement,
sous-traitance/vieillissement. **Stratégie de transition délibérée** (limitée aux champs de
vente) : tant que les autres écrans (Résumé, Suivi, rapports, import POS) ne lisent pas encore
`formats[]` directement, éditer le format PAR DÉFAUT (index 0) — depuis Paramètres ou Recette &
Calcul — met aussi à jour en miroir les champs « à plat » historiques du produit (`prixVente`,
`nbPortions`, `portionSize`, `portionUnit`, `salesMix`, `onMenu`, constante partagée
`FORMAT_FLAT_MIRROR_FIELDS` dans `utils.js`) — ces écrans restent donc corrects sans modification.
Ce miroir ne s'applique **pas** à la fiche recette (ingrédients/étapes/revente) : celle-ci n'a
jamais existé « à plat » sur le produit dans les écrans non encore convertis, donc rien à y
mettre en miroir. Un format additionnel (au-delà du premier) n'apparaît que dans Paramètres et
Recette & Calcul jusqu'à la Phase 1.6, qui étendra tous les écrans consommateurs à `formats[]` et
pourra alors retirer le miroir des champs de vente. Le format par défaut (index 0) ne peut pas
être supprimé tant qu'il reste d'autres formats, précisément parce qu'il alimente ce miroir.

**Restructuration UI (Phase 1.5ter, terminée le 24/09) :** Paramètres → Produits et SKUs est une
vue groupée par recette (une section par produit, contenant la liste de ses formats). Recette &
Calcul a un sélecteur de format restylé (onglets soulignés, même langage visuel que la barre de
navigation principale), un bouton pour ajouter un format via une fenêtre modale (`AddFormatModal`,
dont les changements s'appliquent directement dans Paramètres — même état central, pas de copie,
via les gestionnaires `onAddFormat`/`onDuplicateFormat` partagés), et des contrôles « copier depuis
un autre format » (`CopyFromFormatControl`) à même chaque section (nombre d'unités/rendement,
ingrédients, production, coûts additionnels), invisibles s'il n'y a qu'un seul format. Le bouton
« dupliquer le format en bloc » qui vivait dans Recette & Calcul a été retiré de cet écran ; la
copie complète (« copier à la base ») reste offerte, mais seulement à la création d'un nouveau
format via la fenêtre modale.

**Correction de terminologie (Phase 1.5quater, terminée le 04/10) :** voir l'encadré « Vocabulaire
précisé le 04/10 » plus haut. En bref : le sélecteur et la modale affichaient le SKU comme
attribut principal alors que le format (quantité/unité) aurait dû l'être — corrigé sans toucher
`calculateCosts.js` ni aucune structure de calcul. Voir `03-Feuille-de-route.md` pour le détail des
deux sous-étapes.

### 3. Circuit de vente *(section Paramètres, au-delà du prix multiple)*

**Placement UI revu le 05/10** (suggestion de l'utilisateur) : un circuit de vente joue le même
rôle structurel qu'une activité de production (`productionActivities`, section 1) — une entité de
référence courte, modifiée occasionnellement, consommée par d'autres écrans. Géré dans **Paramètres**
(nouvelle section, juste après Activités de production), pas dans un onglet dédié comme envisagé
initialement. Le rattachement prix net/volumes par format × circuit s'ajoute à la section Produits
et SKUs existante, là où vivent déjà `prixVente`/`salesMix`/`onMenu` par format.

Un circuit n'est plus juste « un prix différent » — c'est une **chaîne de mise en marché** avec
des maillons (rôles) qui prennent chacun une marge :

```
Coût de revient (producteur)
   ↓ (marge du producteur)
Prix net producteur  ──────────────┐
   ↓ (commission courtier, si applicable)
   ↓ (marge distributeur, si applicable)
   ↓ (marge détaillant, si applicable)
Prix de vente suggéré au consommateur (PDSF)
```

- Chaque circuit est composé d'une liste ordonnée de **maillons** (ex. Producteur → Courtier →
  Distributeur → Détaillant → Consommateur), configurable par circuit — un circuit « Vente
  directe à la ferme » n'a qu'un maillon ; un circuit « Grande distribution » peut en avoir 3-4.
- Chaque maillon calcule sa marge/markup en % **sur le prix payé au maillon précédent**
  (cascade standard du commerce de détail — décision : pas de base configurable par maillon,
  pour rester simple et compréhensible).
- Distinction **markup vs marge** rendue explicite dans l'UI à chaque maillon (erreur classique :
  un markup de 30 % sur le coût ≠ une marge de 30 % sur le prix de vente) — l'outil doit calculer
  et étiqueter clairement les deux pour éviter la confusion à un entrepreneur non-CPA.
- **Cascade éditable à n'importe quel maillon** (décision) : l'utilisateur peut modifier le prix
  ou la marge à n'importe quel niveau de la chaîne (coût de revient, prix net producteur, prix
  courtier, prix distributeur, prix détaillant, prix consommateur) et les autres valeurs se
  recalculent automatiquement en respectant les % de marge définis — que l'entrepreneur parte
  d'un coût connu ou d'un prix tablette visé (ex. concurrence). Implémentation : un seul maillon
  « actif » (source de la saisie) à la fois par circuit ; changer de maillon actif recalcule toute
  la chaîne à partir de ce nouveau point d'ancrage.
- Le prix net réellement reçu par circuit (pour chaque format de vente) alimente le moteur de
  calcul existant (marges, point mort) — chaque circuit aura donc sa propre marge nette par
  format, cohérent avec la demande de circuits multiples.

### 4. Main-d'œuvre par activité *(extension ciblée, pas un doublon du système actuel)*

RestoCalculateur calcule déjà la main-d'œuvre de production de façon **ascendante** (bottom-up) :
temps par étape de recette × coût horaire du poste. C'est plus précis que l'approche MAPAQ (une
ligne « taux $/h × minutes » saisie à plat) — **à garder tel quel**, ne pas remplacer.

Ce qui manque : le temps du personnel **non directement attribuable à une recette** — supervision,
nettoyage général, administration, vente — qui chez MAPAQ est capturé par la répartition en % du
temps de chaque employé entre activités/administration/vente. C'est ce temps-là qui doit nourrir :
- la section Frais fixes (les salaires admin/vente deviennent des frais catégorisés, pas des
  coûts de recette) ;
- éventuellement la méthode « au prorata de la main-d'œuvre » d'une activité, si son pool
  d'indirects inclut de la supervision non capturée par les recettes.

**Décision : module léger.** Par employé, répartir son temps en % entre « Production (via
recettes — déjà calculé) », une ou plusieurs activités en supervision/temps non-recette,
« Administration » et « Vente ». Ne réplique pas le système complet du MAPAQ (pas de répartition
par circuit de vente pour la main-d'œuvre) — reste focalisé sur nourrir la section Frais fixes.

### 5. Module de rendement de transformation *(module autonome, distinct des étapes de recette)*

**Ne réutilise pas** la liste des étapes de production existante (celle qui gère le personnel et
le Gantt de main-d'œuvre) : cette dernière fonctionne déjà bien pour les plats et ne doit pas être
mise à risque en la surchargeant d'un second rôle (suivi de quantité/masse) qui n'a rien à voir
avec le suivi du temps.

À la place, un module séparé, propre à chaque format de vente, avec sa propre liste d'étapes
(nom libre + effet en % sur la quantité), réordonnable, aussi longue que nécessaire — même niveau
de rigueur que la cascade du MAPAQ (rendement %, pertes de fabrication), sans être limité à des
champs fixes (« Perte 1 », « Perte 2 »), et sans jargon. Le total se met à jour en direct au fur
et à mesure de l'ajout d'étapes, jusqu'au nombre d'unités de vente obtenues pour ce format.

**Séparément**, un **taux de rejet des produits finis**, appliqué après la cascade de rendement
(inspiré du chiffrier SymbiOse) : distinct méthodologiquement, puisqu'un rejet de contrôle qualité
survient après la transformation, pas pendant — les mélanger fausserait l'analyse de chacun.

**Correctif du 05/10 — la « quantité produite » n'est pas toujours un compte entier.** Retour
utilisateur : un producteur alimentaire (ex. transformation de viande) vend parfois au poids, pas
à la pièce — un lot donné peut légitimement produire 47,3 kg, pas un nombre entier d'« unités ».
Or la saisie manuelle de `nbPortions` (quand la grille de rendement est désactivée) exigeait un
entier dans tous les cas, forçant un contournement (activer la grille de rendement juste pour
obtenir une valeur décimale) même quand aucun rendement en cascade n'était nécessaire.

Décision : la contrainte « entier obligatoire » ne s'applique plus qu'aux formats dont l'unité
(`portionUnit`) est une unité de **compte** (« unité ») ; les formats en unité de **mesure**
continue (kg, g, L, ml) acceptent une quantité produite décimale, saisie manuellement OU calculée
par la grille de rendement — les deux chemins restent disponibles comme avant, seule la
contrainte d'arrondi change. Classification portée directement par `CONVERSION_FACTORS`
(`utils.js`, champ `type: 'discrete' | 'continuous'`) plutôt que par un réglage séparé à
maintenir en parallèle — une unité absente de cette table reste discrète par défaut
(comportement historique, le plus prudent). Voir `isDiscreteUnit`/`isValidPositiveNumber`
(`utils.js`) et `03-Feuille-de-route.md`.

**Idée explicitement écartée (même échange)** : un facteur d'échelle qui multiplierait
proportionnellement toutes les quantités d'ingrédients d'un format pour simuler un lot plus
gros/petit (« règle de trois »). Rejetée à la demande de l'utilisateur : en alimentaire, les
pertes de transformation, temps de cuisson et rendements ne scalent pas linéairement avec la
taille du lot — un multiplicateur automatique donnerait une fausse précision. Un changement de
taille de lot reste donc une saisie manuelle assumée (dupliquer un format via
`CopyFromFormatControl`/« copier à la base », puis ajuster chaque quantité), jamais un calcul
automatique. Un **journal des lots de production réels** (distinct de la recette de référence,
à la manière des points de suivi) a aussi été envisagé puis écarté : hors du périmètre voulu pour
l'application, qui n'est pas un ERP de suivi de production.

### 6. Sous-traitance et vieillissement *(postes de coût optionnels, masqués par défaut)*

Deux nouveaux postes de coût direct dans le moteur de calcul par format :
- **Sous-traitance** : coût d'une opération donnée à l'externe (nom du sous-traitant, opération,
  coût) — confirmé par le chiffrier SymbiOse.
- **Vieillissement** : charges d'intérêt de portage pour un produit qui doit affiner/vieillir en
  inventaire avant la vente (taux d'intérêt × durée) — confirmé par le guide MAPAQ, pertinent pour
  la fermentation/l'affinage.

**Décision : les deux sont masqués par défaut** dans la fiche de recette, révélés seulement par
une case à cocher ou un sélecteur — même patron que les cases « sous-recette » / « produit de
revente » déjà présentes dans l'app. Évite d'alourdir l'interface pour les recettes qui n'en ont
pas besoin (la majorité).

**Rattachement tranché en Phase 1.4 : les deux vivent sur le FORMAT, pas sur la recette mère.**
La sous-traitance est typiquement une opération propre à un format précis (ex. l'embouteillage du
format 4 L confié à un tiers, mais pas les pots de 250 ml faits maison) ; le vieillissement dépend
aussi du format (un format vrac peut affiner plus longtemps qu'un format détail). Implémenté dans
`calculateCosts.js` : la sous-traitance rejoint les charges directes (donc la marge brute) ; le
vieillissement reste à part, comme au MAPAQ (calculé sur le total des charges directes du lot,
inclus dans la marge nette mais pas dans la marge brute).

## Raffinements professionnels transversaux

- **Rentabilité et point mort par circuit** : puisque chaque circuit a un prix net différent, le
  Résumé et le Suivi devront pouvoir montrer marge et point mort **par circuit**, pas seulement
  globalement.
- **Étiquetage clair markup vs marge** partout dans l'app où un pourcentage de profit est saisi
  ou affiché — cohérence terminologique pour un utilisateur non-CPA.
- **Info-bulles dès la livraison** : chaque nouvelle fonctionnalité (à partir de la Phase 1)
  inclut ses info-bulles au moment de sa livraison, jamais remises à une passe finale.
- **Guide d'utilisation** : mise à jour incrémentale à chaque phase, avec une passe finale de
  consolidation pédagogique en Phase 7 (voir `03-Feuille-de-route.md`) — le guide doit expliquer
  le pourquoi, pas seulement où cliquer, et couvrir l'ensemble des nouvelles fonctionnalités.

## Impact sur la feuille de route

L'« activité de production » devient une fondation transversale (Frais fixes en dépend
directement) — elle doit être introduite tôt. Voir `03-Feuille-de-route.md` pour le plan complet
(y compris le réordonnancement du 05/10 : Circuits de vente avant Frais fixes), incluant la Phase 7
de revalidation UI/UX transversale.
