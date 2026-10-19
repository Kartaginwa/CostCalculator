# Journal des décisions

Format : date, décision, alternatives considérées, justification.

---

### 2026-09-22 — Circuits de vente multiples

**Décision** : un même produit pourra être vendu par plusieurs circuits (boutique, épicerie,
marché public, etc.) à des prix et volumes distincts, plutôt qu'un prix de vente unique par
produit.

**Alternative écartée** : garder un prix unique par produit (scope plus contenu, focalisé sur
packaging + comptabilité).

**Justification** : c'est la réalité de vente d'un transformateur — contrairement à un
restaurant qui vend au même prix à sa table, un transformateur vend souvent le même produit à
des prix différents selon le canal (gros, détail, distributeur).

**Impact** : touche le modèle de données central (`products`), le moteur de calcul (marges par
circuit), et tous les écrans qui affichent prix/marge (Résumé, Recette & Calcul, rapports). Phase
la plus invasive du projet — planifiée en dernier (voir feuille de route) pour s'appuyer sur les
fondations Packaging + Comptabilité déjà en place.

---

### 2026-09-22 — Répartition des frais indirects par groupe de produits

**Décision** : possibilité de créer des groupes de produits et d'assigner une méthode de
répartition des frais indirects différente à chaque groupe, plutôt qu'une seule méthode globale
pour toute l'entreprise.

**Alternative écartée** : garder une seule règle globale (comme aujourd'hui), éventuellement
enrichie d'options supplémentaires (ex. au prorata des charges directes).

**Justification** : donnée après explication en langage clair (sans jargon comptable) des 5
méthodes possibles (ventes, temps de production, charges directes, volume, superficie) et de
l'exemple concret montrant qu'une seule règle peut fausser le coût de produits très différents
(ex. un produit long à cuire vs un produit rapide à assembler). L'utilisateur souhaite un outil
utilisable par un entrepreneur non-CPA — l'implémentation devra donc présenter ce choix en
langage concret et métier, jamais en jargon comptable ("coefficient d'imputation" à éviter dans
l'UI), avec un bon défaut pour qui ne veut pas s'en soucier (un seul groupe = comportement actuel).

**Impact** : touche `calculateCosts.js` (logique d'indirects), le modèle de données produit
(rattachement à un groupe), et l'UI de configuration (nouvel onglet Comptabilité).

---

### 2026-09-22 — L'onglet Comptabilité remplace le champ simple "Frais indirects totaux"

**Décision** : remplacement complet — le champ `generalInfo.totalIndirects` saisi à plat dans
Paramètres disparaît au profit d'un état de résultats catégorisé dans le nouvel onglet
Comptabilité.

**Alternative écartée** : garder le champ simple dans Paramètres pour un usage rapide, et offrir
l'onglet Comptabilité comme mode avancé optionnel en parallèle.

**Justification** : choix explicite de l'utilisateur pour une cohérence unique de la donnée
(éviter que deux sources de frais indirects puissent diverger).

**Impact** : migration nécessaire pour les projets existants (un `totalIndirects` à plat devra
être converti ou redemandé lors de l'ouverture d'un ancien projet). À traiter dans la phase de
migration/rétrocompatibilité.

---

### 2026-09-22 — Nouvel onglet Packaging

**Décision** : catalogue d'emballages séparé (`basePackaging`), structure miroir de
`baseIngredients`, rattachable à une recette comme un ingrédient mais comptabilisé comme un poste
de coût distinct (`totalPackagingCost`) dans `calculateCosts`.

**Justification** : le packaging est aujourd'hui absent comme poste de coût dédié ; il ne peut
être saisi que bricolé comme un "ingrédient", ce qui mélange les coûts et ne reflète pas la
réalité d'un transformateur.

**Impact** : nouvel onglet, nouvelle tranche d'état, nouveau poste de coût dans le moteur, mise à
jour du récapitulatif de recette, du Résumé et des rapports.

---

### 2026-09-22 — Refonte approfondie suite aux précisions de l'utilisateur

Quatre décisions supplémentaires, prises après l'explication détaillée du modèle dans
`04-Conception-Modele.md`. Ensemble, elles font passer le projet d'un simple ajout de deux
onglets à une refonte structurante du modèle produit.

**a) Cascade de prix par circuit : éditable à n'importe quel maillon.**
Alternative écartée : sens unique fixe (saisir le net producteur seulement, ou le prix
consommateur seulement). Justification : les deux besoins sont réels (partir du coût connu, ou
d'un prix tablette visé par la concurrence) ; un seul maillon actif à la fois par circuit,
recalcul automatique des autres.

**b) Base des marges par maillon : cascade standard uniquement** (marge calculée sur le prix payé
au maillon précédent, pas de base configurable par maillon).
Alternative écartée : base configurable (ancrer une marge directement sur le coût de revient,
indépendamment des maillons en aval). Justification : priorité à la simplicité et à la
compréhension pour un entrepreneur non-CPA ; la cascade standard couvre la très large majorité
des cas réels.

**c) Formats de vente : vrai système de formats** — un produit devient une recette mère avec
plusieurs formats de vente rattachés (chacun son emballage, son rendement, son prix par circuit).
Alternative écartée : garder l'approche actuelle (un format = une recette dupliquée).
Justification : fidélité à la réalité d'un transformateur qui vend le même produit en plusieurs
formats. **Impact majeur** : restructure `products` (recette mère + `formats[]`),
`calculateCosts.js` (coût par format), et tous les écrans qui affichent un produit — devient la
fondation à construire en premier, avant Packaging et Comptabilité qui s'y rattachent.

**d) Main-d'œuvre hors-recette : module léger** (répartition en % du temps par employé entre
production hors-recette, administration, vente — pas de réplique complète du système MAPAQ avec
répartition par circuit de vente).
Justification : le système actuel de calcul ascendant par étape de recette est déjà plus précis
que celui du MAPAQ pour la main-d'œuvre de production ; seul le temps non capturé par une recette
(supervision, admin, vente) manque, et c'est tout ce que ce module doit couvrir.

**Correction du 14/10** — décision (d) abandonnée avant d'être construite. Une fois Frais fixes
(Phase 4.1-4.6) en place, l'utilisateur a questionné la rigueur comptable de ce module : un salaire
n'est jamais scindé par % de temps estimé dans une vraie comptabilité (livres de paie/état des
résultats) — c'est une technique de comptabilité de gestion (allocation de coûts), pas un fait
comptable. L'automatiser aurait cassé le principe fondateur de Frais fixes (Phase 4.1 : « l'état
des résultats réel, tel qu'il apparaît dans la vraie comptabilité ») en risquant un double compte
ou un écart permanent inexpliqué contre les vrais livres de l'utilisateur. Conclusion : la saisie
manuelle d'une ligne Frais fixes (déjà disponible depuis la 4.1) est la méthode la PLUS rigoureuse
pour couvrir ce besoin, pas un pis-aller en attendant ce module — rien à construire. Voir
`03-Feuille-de-route.md`, section Phase 5.

**Impact global sur la feuille de route** : voir `03-Feuille-de-route.md`, réordonnée en
conséquence (formats de vente + activités de production deviennent la Phase 1).

---

### 2026-09-22 — Refonte des assistants d'import

Deux constats de l'utilisateur, détaillés dans `05-Imports-Integrations.md`.

**a) Import des ventes (actuellement « POS ») — à valider ensemble.**
L'assistant actuel (`PosImportWizardModal.jsx`) vise un export de système de caisse, pertinent
pour un restaurant mais pas pour un transformateur (qui reçoit plutôt des rapports de vente par
distributeur/circuit, ou l'état des résultats). **Pas encore décidé** : le format exact à
supporter et la logique de mapping vers formats × circuits. Repris après les Phases 1 et 5.

**b) Import de l'état des résultats dans l'onglet Comptabilité — décidé dans son principe.**
Un assistant d'import dédié doit permettre d'importer les lignes de dépenses catégorisées (et
les revenus, quand disponibles) depuis un état des résultats externe. Nuance retenue : les
revenus ventilés par SKU sont *souhaitables* mais *rarement présents* dans un état des résultats
réel — l'assistant doit donc bien fonctionner avec des revenus agrégés (cas courant) et accepter
une ventilation par SKU en option quand la source le permet. Conception détaillée pendant la
Phase 3.

**Impact** : tâche ajoutée à la Phase 3 (import état des résultats) et à la Phase 5 (refonte
import des ventes, détail à valider ensemble) — voir `03-Feuille-de-route.md`.

---

### 2026-09-22 — Analyse du chiffrier SymbiOse et ajustements finaux du plan

Suite à la lecture complète du chiffrier personnel de l'utilisateur (`06-Analyse-Chiffrier-SymbiOse.md`,
fourni comme inspiration, pas comme modèle à reproduire), plusieurs précisions ont été apportées :

**a) Cascade à maillons illimités pour les circuits de vente : confirmée (pas de changement).**
Le chiffrier SymbiOse utilise un modèle plus simple (deux étages : PDS + marge détaillant +
frais de mise en marché), mais l'utilisateur préfère garder la cascade générale décidée le 22/09
(elle peut reproduire le modèle simple avec seulement deux maillons configurés, et reste capable
de représenter des intermédiaires qui fixent leur propre prix de revente, pas seulement des frais
en pourcentage).

**b) Frais fixes : clés de répartition (style MAPAQ) en méthode principale, montant manuel en
option, plus la possibilité de créer ses propres clés.**
Ajustement par rapport à la proposition initiale (calquée sur SymbiOse, qui privilégiait la saisie
manuelle) : le MAPAQ permet déjà les deux nativement (Étape 7 de son guide). Décision : clés
prédéfinies (ventes, temps de MO, charges directes) + clés personnalisées créées par l'utilisateur
(comme dans le MAPAQ) comme méthode principale, montant manuel disponible en option pour les
comptes dont le montant exact est connu. Allocation sur deux axes (activité de production ET canal
de vente), validée par le chiffrier SymbiOse.

**c) Sous-traitance et vieillissement : masqués par défaut.**
Les deux nouveaux postes de coût (sous-traitance confirmée par SymbiOse, vieillissement rappelé du
MAPAQ) sont révélés par une case à cocher plutôt qu'affichés par défaut dans la fiche de recette —
même patron que les cases « sous-recette »/« produit de revente » existantes, pour ne pas
alourdir l'interface des recettes qui n'en ont pas besoin.

**d) Rendement : module autonome, pas une réutilisation des étapes de production existantes.**
La proposition initiale suggérait de réutiliser le composant de liste des étapes de production
(qui gère aujourd'hui le personnel et le Gantt de main-d'œuvre) pour y ajouter le suivi du
rendement matière. Rejetée : ça aurait mélangé deux mécanismes différents (temps vs quantité/masse)
dans le même composant, au risque de complexifier un moteur qui fonctionne déjà bien pour les
plats. Décision : un module séparé et autonome par format de vente, avec sa propre liste d'étapes
nommées à effet en %, réordonnable — même rigueur que la cascade du MAPAQ (rendement + pertes de
fabrication), sans être limité à des champs fixes, et sans risque pour le moteur existant. Un taux
de rejet des produits finis (inspiré de SymbiOse) reste distinct, appliqué après la cascade.

**e) UI/UX : principe transversal, pas une note ponctuelle à une phase.**
Chaque phase doit livrer une qualité UI/UX au moins équivalente au reste de l'app ; les bonnes
idées doivent se propager aux écrans existants. Une **Phase 7** dédiée (distincte du QA technique
de la Phase 6) revalide l'ensemble de l'app une fois tout construit.

**f) Info-bulles et guide d'utilisation : ajoutés comme principes transversaux.**
Chaque fonctionnalité livrée inclut ses info-bulles dès sa sortie. Le guide (`InstructionModal`)
est mis à jour à chaque phase, avec une consolidation pédagogique finale en Phase 7.

**Impact** : `03-Feuille-de-route.md` et `04-Conception-Modele.md` mis à jour en conséquence —
ajout d'une section « Principes transversaux », d'une Phase 7, et détail des sous-étapes 1.4
(rendement, sous-traitance, vieillissement) et Phase 3 (clés + manuel + deux axes).

---

### 2026-09-22 — Catégories de frais : retenues, avec axe suggéré non contraignant

**Décision** : quatre catégories de frais (généraux de production, vente/mise en marché,
administration, financiers), chacune avec un axe d'allocation **suggéré par défaut** (production
pour les frais généraux, canal pour les frais de vente, général pour admin/financiers) mais jamais
imposé — l'utilisateur peut toujours ventiler manuellement vers l'autre axe si sa situation le
justifie (ex. un loyer partiellement dédié à une ligne, comme dans SymbiOse).

**Justification** : les catégories ne sont pas que pour se repérer visuellement. Elles évitent
qu'un coût de vente/marketing soit erronément absorbé dans le taux horaire d'une ligne de
production (faussant le coût de revient réel) et permettent un rapprochement propre avec un état
des résultats comptable réel, nécessaire pour l'assistant d'import de la Phase 3.

**Impact** : conception détaillée dans `04-Conception-Modele.md`, section « Activité de
production ».

---

### 2026-10-07 — Matrice BCG : popularité basée sur le volume réel agrégé, et exclusion des SKU sans volume réel

Suite à un retour utilisateur (un produit apparaissait « poids mort » en tous-canaux sans jamais
l'être dans aucun canal pris séparément — détail dans `03-Feuille-de-route.md`, correctifs du
06/10 et 07/10).

**a) Popularité « tous canaux » = part du volume réel agrégé à travers les canaux, pas `salesMix`.**
Alternative écartée : garder `salesMix` (part du menu global, déjà utilisée pour les KPIs
pondérés) comme axe de popularité de la matrice BCG. Justification : `salesMix` est dilué par le
% fixe des formats en mode manuel (volume nul sur tous les canaux), alors que chaque vue limitée
à un seul canal calcule déjà sa popularité à partir du volume réel de ce canal — les deux vues
comparaient donc des grandeurs différentes, un SKU pouvant franchir le seuil de son propre canal
tout en restant sous le seuil du menu global dilué (effet d'agrégation, apparenté au paradoxe de
Simpson). Repli sur `salesMix` conservé si aucun produit actif n'a de volume réel sur aucun canal
(projet n'utilisant pas les circuits de vente).

**b) Un SKU sans AUCUN volume réel sur aucun canal est exclu de la matrice, jamais classé à 0 %.**
Alternative écartée (mon premier correctif, révisé après retour utilisateur) : l'inclure avec 0 %
de popularité. Justification de l'utilisateur : un produit qui n'est pas vraiment vendu (son
exemple : un format gardé en mode manuel sans historique de vente) n'a pas de performance de
vente à classer, et l'inclure à 0 % fausse quand même le seuil de popularité des AUTRES SKU
(le seuil se calcule sur le nombre de lignes incluses). Même principe que `channelBreakdown`
(une donnée absente reste absente, jamais forcée) appliqué à la matrice BCG.

**Impact** : `analysisData.js` (`computeAnalysisData`, fonction `computeMenuEngineeringQuadrants`
inchangée) et `SummaryTable.jsx` (vue par canal). Aucune régression sur les projets n'utilisant pas
les circuits de vente (repli sur l'ancien calcul inchangé dans ce cas).
