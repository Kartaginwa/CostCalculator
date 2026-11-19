// Partie 0 — Bien utiliser ce guide.
// Les montants viennent de guideNumbers.js ; rien n'est recopié à la main.

export const partie0 = {
    id: 'guide-partie-0',
    title: 'Bien utiliser ce guide',
    lead: 'À qui il s\'adresse, comment le lire, par où commencer et comment ne rien perdre de son travail.',
    chapters: [
        // ------------------------------------------------------------------------------------
        {
            id: 'guide-intro',
            title: 'À qui s\'adresse ce guide, et comment le lire',
            blocks: [
                { type: 'p', text: 'Cette application calcule le **coût de revient** de vos produits : ce qu\'il vous en coûte réellement pour les fabriquer et les mettre en marché. À partir de ce chiffre, elle vous montre vos marges, le nombre de ventes dont vous avez besoin pour être rentable, les produits qui font avancer votre entreprise et ceux qui la ralentissent. Elle s\'adresse aux entreprises de transformation alimentaire (usines, ateliers de production, conditionneurs), mais les principes valent pour toute entreprise qui fabrique quelque chose.' },
                { type: 'p', text: 'Ce guide poursuit deux objectifs. Le premier est de vous apprendre à **utiliser** l\'application, écran par écran. Le second, tout aussi important, est de vous apprendre à **comprendre** ce qu\'elle calcule : un chiffre que l\'on ne comprend pas ne sert à rien, alors qu\'un chiffre que l\'on comprend peut changer une décision.' },
                { type: 'p', text: 'Aucune connaissance préalable en comptabilité n\'est nécessaire. Les termes du métier sont volontairement conservés, parce que vous les rencontrerez à l\'écran, chez votre comptable et dans vos propres rapports. Chacun est expliqué la première fois qu\'il apparaît, et tous sont repris dans le [[guide-glossaire|glossaire]].' },

                { type: 'h', id: 'guide-intro-parties', text: 'Les quatre parties du guide' },
                {
                    type: 'ul', items: [
                        { label: 'Partie 1 — Comprendre le coût de revient.', text: 'Les notions de base, avec des exemples chiffrés tirés de différentes industries. Aucun écran de l\'application : seulement les idées.' },
                        { label: 'Partie 2 — Utiliser l\'application.', text: 'Un chapitre par onglet : à quoi il sert, comment le remplir, avec les chiffres du projet démo.' },
                        { label: 'Partie 3 — Lire vos résultats et décider.', text: 'Comment interpréter chaque rapport, et quoi faire quand un chiffre vous inquiète.' },
                        { label: 'Partie 4 — Aller plus loin.', text: 'Le glossaire, les questions fréquentes, et les limites du modèle à connaître avant de s\'y fier.' },
                    ],
                },

                { type: 'h', id: 'guide-intro-chemins', text: 'Quel chemin prendre ?' },
                {
                    type: 'table', head: ['Votre situation', 'Où aller'], wrapCells: true, rows: [
                        ['Je débute en coût de revient.', 'Lisez la [[guide-partie-1|Partie 1]] (une heure environ), puis remplissez l\'application avec la [[guide-partie-2|Partie 2]] sous les yeux.'],
                        ['Je connais déjà la comptabilité de gestion.', 'Passez directement à la [[guide-partie-2|Partie 2]] ; la Partie 1 sert de référence si un terme vous échappe.'],
                        ['Un chiffre à l\'écran m\'intrigue.', 'Utilisez la recherche en haut de cette fenêtre, ou consultez le [[guide-glossaire|glossaire]].'],
                        ['Je préfère voir avant de lire.', 'Ouvrez le projet démo (voir plus bas) et suivez les chapitres de la Partie 2 avec lui.'],
                    ],
                },

                { type: 'h', id: 'guide-intro-encadres', text: 'Les encadrés' },
                { type: 'p', text: 'Pour vous aider à retenir l\'essentiel, le guide utilise six sortes d\'encadrés. Les voici, avec leur rôle :' },
                { type: 'callout', kind: 'retenir', text: 'Le résumé d\'un chapitre ou d\'une notion, en quelques lignes. Si vous êtes pressé, lisez d\'abord ceux-là.' },
                { type: 'callout', kind: 'exemple', text: 'Une situation chiffrée qui montre la notion en action. Les calculs sont détaillés pour que vous puissiez les refaire.' },
                { type: 'callout', kind: 'attention', text: 'Une erreur fréquente, ou un piège qui fausse les résultats sans prévenir.' },
                { type: 'callout', kind: 'astuce', text: 'Une façon de gagner du temps ou de mieux utiliser l\'application.' },
                { type: 'callout', kind: 'pourquoi', text: 'La raison d\'être d\'une règle ou d\'un champ : ce qu\'il apporte à vos décisions.' },
                { type: 'words', items: [{ term: 'Les mots du chapitre', def: 'les termes spécialisés rencontrés dans le chapitre, avec une définition courte.' }] },

                { type: 'h', id: 'guide-intro-conventions', text: 'Quelques conventions' },
                {
                    type: 'ul', items: [
                        'Un texte présenté {{ainsi}} est un bouton, un champ ou un onglet tel qu\'il s\'affiche à l\'écran.',
                        'Les montants s\'écrivent avec la virgule décimale (3,75 $), à l\'écran comme dans ce guide ; à la saisie, vous pouvez utiliser l\'un ou l\'autre, y compris dans les fichiers que vous importez.',
                        'Les exemples de la Partie 1 sont **génériques** : ils viennent de différentes industries, avec des chiffres choisis pour que les calculs restent lisibles. Ceux des Parties 2 et 3 viennent du **projet démo** : vous pouvez les retrouver à l\'écran.',
                        'Les liens bleus soulignés renvoient à une autre section du guide ; cliquez dessus pour y aller.',
                    ],
                },

                { type: 'h', id: 'guide-intro-demo', text: 'Le projet démo' },
                { type: 'p', text: 'Le projet démo est une entreprise fictive complète, **Boréal Mets Préparés inc.**, qui fabrique des mets préparés surgelés, des soupes et des sauces. Il contient 11 produits (13 formats de vente), trois activités de production (mets principaux surgelés, soupes et potages, sauces et accompagnements), trois canaux de vente (vente directe en ligne, épiceries indépendantes, grandes surfaces), une base d\'ingrédients et d\'emballages, quatre postes de main-d\'œuvre, un état des résultats réel et une vingtaine de points de référence mensuels.' },
                { type: 'p', text: 'Pour l\'ouvrir, choisissez {{Explorer un projet démo}} à l\'écran d\'accueil de l\'application. Vous pouvez y modifier ce que vous voulez : rien n\'est conservé tant que vous n\'avez pas cliqué sur {{Sauvegarder}}.' },
                { type: 'callout', kind: 'astuce', text: 'Ouvrez le projet démo dans un onglet de votre navigateur ou une fenêtre de l\'application, et ce guide dans une autre. Suivez le chapitre d\'un onglet en regardant le même onglet du démo : les chiffres cités dans le guide y sont affichés tels quels.' },
            ],
        },

        // ------------------------------------------------------------------------------------
        {
            id: 'guide-demarrer',
            title: 'Par où commencer ? Les sept étapes',
            lead: 'Les onglets se lisent de gauche à droite, et c\'est aussi l\'ordre de saisie le plus efficace : chaque étape alimente les suivantes.',
            blocks: [
                { type: 'p', text: 'Vous n\'avez pas à tout remplir d\'un seul coup. Si une donnée manque, l\'application vous le signale : champs vides, avertissements, et le panneau « points à vérifier » en haut de {{Rapport et suivi}}. Mais pour que les résultats soient fiables, mieux vaut suivre l\'ordre ci-dessous, parce que chaque étape dépend de la précédente.' },
                {
                    type: 'steps', items: [
                        { label: '1. Paramètres.', text: 'Nommez votre entreprise, choisissez vos unités de mesure, créez vos **activités de production** et vos **canaux de vente**. __Pourquoi d\'abord ?__ Chaque produit sera rattaché à une activité, et chaque prix à un canal : ils doivent donc exister avant vos produits. Détails : [[guide-parametres|chapitre Paramètres]].' },
                        { label: '2. Ingrédients et Emballage.', text: 'Saisissez (ou importez) vos prix d\'achat et vos taux de perte. __Pourquoi ?__ Ce sont eux qui donnent le coût de chaque recette ; un prix manquant fausse tout le coût qui en dépend. Détails : [[guide-ingredients|Ingrédients]] et [[guide-emballage|Emballage]].' },
                        { label: '3. Main-d\'œuvre.', text: 'Créez vos postes et vos employés (salaire, charges, vacances, temps productif, heures travaillées). __Pourquoi ?__ Le coût de main-d\'œuvre d\'une recette est la durée de ses étapes multipliée par le coût horaire moyen du poste. Détails : [[guide-main-oeuvre|Main-d\'œuvre]].' },
                        { label: '4. Paramètres → Produits et SKUs.', text: 'Créez vos produits, leurs formats, leurs prix (PDS et prix nets par canal), leurs volumes et leur répartition des ventes. __Pourquoi ?__ Sans prix de vente, aucune marge ne peut être calculée. Détails : [[guide-param-produits|Produits et SKUs]].' },
                        { label: '5. Production.', text: 'Pour chaque format, assemblez la recette : ingrédients, emballage, étapes de production, coûts additionnels. __Pourquoi ?__ C\'est ici que le coût de production se construit. Détails : [[guide-production|Production]].' },
                        { label: '6. État des résultats.', text: 'Saisissez vos revenus et vos frais réels de la période. __Pourquoi ?__ Ils servent à répartir vos frais fixes sur chaque produit (le coût de revient complet) et à vérifier que votre modèle colle à la réalité. Détails : [[guide-etat-resultats|État des résultats]].' },
                        { label: '7. Rapport et suivi.', text: 'Lisez vos marges, comparez vos produits et vos canaux, simulez, puis créez un **point de référence**. __Pourquoi ?__ La valeur vient de la comparaison dans le temps : chaque point de référence est une photo à laquelle vous comparerez la suivante. Détails : [[guide-partie-3|Partie 3]].' },
                    ],
                },
                {
                    type: 'table', caption: 'Qui alimente qui ?', head: ['Onglet', 'A besoin de…', 'Alimente…'], wrapCells: true, rows: [
                        ['Paramètres', 'Rien (point de départ)', 'Tous les autres onglets'],
                        ['Ingrédients, Emballage', 'Les unités de mesure', 'Production, rapports d\'achats'],
                        ['Main-d\'œuvre', 'Rien', 'Production (coût des étapes), rapport de productivité'],
                        ['Production', 'Produits, ingrédients, emballage, main-d\'œuvre', 'Tous les rapports'],
                        ['État des résultats', 'Activités, canaux, produits', 'Frais fixes de chaque produit, réconciliation'],
                        ['Rapport et suivi', 'Tout ce qui précède', 'Vos décisions'],
                    ],
                },
                { type: 'callout', kind: 'attention', text: 'Le piège le plus courant : commencer par Production avant d\'avoir saisi les prix des ingrédients. L\'application accepte la recette, mais le coût affiché sera de 0 $ pour tout ce qui n\'a pas encore de prix, et les marges sembleront excellentes. Elles ne le sont pas : elles sont incomplètes.' },
                { type: 'callout', kind: 'astuce', text: 'Selon la taille de votre catalogue, un premier passage demande quelques heures, surtout pour rassembler vos prix d\'achat. Ensuite, vous n\'avez plus qu\'à mettre à jour ce qui change : un prix de fournisseur, un salaire, une recette.' },
            ],
        },

        // ------------------------------------------------------------------------------------
        {
            id: 'guide-gestion',
            title: 'Gestion de projet : sauvegarder, ouvrir, ne rien perdre',
            blocks: [
                { type: 'p', text: 'Un **projet** regroupe tout votre travail : entreprise, ingrédients, emballages, main-d\'œuvre, produits, recettes, état des résultats, points de référence et scénario de simulation. Il s\'enregistre dans un seul fichier, ce qui le rend facile à copier, à archiver et à partager.' },

                { type: 'h', id: 'guide-gestion-boutons', text: 'Les boutons du haut de l\'écran' },
                {
                    type: 'table', head: ['Bouton', 'Ce qu\'il fait'], wrapCells: true, rows: [
                        ['{{Guide d\'utilisation}} (icône « i »)', 'Ouvre ce guide.'],
                        ['{{Nouveau projet}}', 'Vide l\'application pour repartir d\'un projet vierge. Une confirmation est demandée, parce que l\'opération est irréversible.'],
                        ['{{Sauvegarder}}', 'Enregistre tout votre travail dans un fichier .json, dans le dossier où votre ordinateur place les téléchargements. Le nom du fichier commence par « projet_cout_revient_ » suivi du nom de votre entreprise.'],
                        ['{{Ouvrir}}', 'Charge un projet sauvegardé. Il remplace le projet affiché ; si vous avez des modifications non sauvegardées, l\'application vous demande de confirmer.'],
                    ],
                },

                { type: 'h', id: 'guide-gestion-sauvegarde', text: 'Rien n\'est enregistré automatiquement' },
                { type: 'p', text: 'C\'est le point le plus important de ce chapitre. L\'application **ne sauvegarde jamais seule** : votre travail n\'existe qu\'en mémoire tant que vous n\'avez pas cliqué sur {{Sauvegarder}}. Si vous fermez la fenêtre ou si l\'ordinateur s\'éteint avant, ce qui n\'a pas été sauvegardé est perdu.' },
                { type: 'p', text: 'Pour vous aider, une pastille ambre, {{Modifications non sauvegardées}}, apparaît à côté des boutons dès que vous modifiez quelque chose, et disparaît après la sauvegarde. L\'application vous prévient aussi quand vous fermez la fenêtre ou ouvrez un autre projet dans cet état.' },
                { type: 'callout', kind: 'astuce', text: 'Sauvegardez à la fin de chaque séance de saisie, et conservez des copies datées du fichier (par exemple en ajoutant la date à son nom). Si vous faites une erreur importante, vous pourrez revenir à une version antérieure. Ne modifiez jamais le fichier à la main : seule l\'application sait le relire correctement.' },

                { type: 'h', id: 'guide-gestion-accueil', text: 'L\'écran d\'accueil et le tutoriel' },
                { type: 'p', text: 'Au démarrage, l\'application propose trois choix : {{Créer un nouveau projet}}, {{Ouvrir un projet}} sauvegardé, ou {{Explorer un projet démo}}. À la création d\'un nouveau projet, un **tutoriel guidé** vous est proposé : il surligne les principaux éléments de chaque onglet, étape par étape. Vous pouvez l\'accepter ({{Commencer le guide}}) ou le passer ({{Explorer par moi-même}}).' },

                { type: 'h', id: 'guide-gestion-confort', text: 'Les petits conforts à connaître' },
                {
                    type: 'ul', items: [
                        { label: 'Annuler une suppression.', text: 'Supprimer un ingrédient, un poste, un produit, une ligne, etc. affiche une notification avec un bouton {{Annuler}} pendant quelques secondes. Passé ce délai, la suppression est définitive.' },
                        { label: 'Fermer une fenêtre.', text: 'La touche Échap ferme la fenêtre ouverte (ce guide, un assistant d\'importation, la gestion des unités, etc.), comme la croix.' },
                        { label: 'Barre d\'onglets fixe.', text: 'La barre d\'onglets reste en haut de l\'écran quand vous faites défiler une page longue, pour changer d\'onglet sans remonter.' },
                        { label: 'Filtres et sélections mémorisés.', text: 'Quand vous changez d\'onglet puis que vous revenez, vos filtres, vos tris, le produit sélectionné et vos choix dans le rapport sont retrouvés. Cette mémoire n\'est pas enregistrée dans le fichier : un nouveau projet, l\'ouverture d\'un fichier ou le projet démo repartent de zéro.' },
                        { label: 'Éléments sans nom.', text: 'Un produit dont vous n\'avez pas encore saisi le nom s\'affiche « Sans nom 1 », « Sans nom 2 », etc. Un message « Requis. » n\'apparaît qu\'après que vous avez quitté le champ laissé vide.' },
                        { label: 'Nombres.', text: 'Vous pouvez saisir le point ou la virgule comme séparateur décimal (12,5 ou 12.5), et des espaces dans les milliers (1 234,56). Cela vaut aussi pour les fichiers importés.' },
                    ],
                },
                { type: 'words', items: [
                    { term: 'Projet', def: 'l\'ensemble de vos données, enregistré dans un fichier .json.' },
                    { term: 'Point de référence', def: 'une « photo » de votre projet à une date donnée, pour comparer plus tard (voir [[guide-points-reference|Points de référence]]).' },
                ] },
            ],
        },
    ],
};
