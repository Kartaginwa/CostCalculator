# Voix de la visite guidée

La visite est muette par défaut (sous-titres seulement). Pour lui donner une **voix humaine**, déposez ici un fichier audio par scène :

- **Nom du fichier = identifiant de la scène** : `accueil.mp3`, `ordre.mp3`, `entreprise.mp3`… (formats : mp3, m4a, ogg, wav). Chaque **carte de titre de chapitre** a aussi sa voix : `intro-bienvenue.mp3`, `intro-entreprise.mp3`, `intro-intrants.mp3`… (`intro-` suivi de l'identifiant du chapitre, voir `CHAPTERS` dans `tourScript.js`).
- Le texte à lire, clip par clip, est dans `Projet_Claude/11-Narration-Visite.md` (généré depuis `src/tour/tourScript.js`). Il contient les repères `[pause]` à coller avec le texte ; les sous-titres affichés ne les contiennent pas.
- Les anciennes voix d'essai (sans licence commerciale) sont rangées dans `_essai-non-commercial/` : ce dossier est ignoré par le lecteur et par Git.
- Une scène sans fichier reste muette ; la visite continue normalement.

Ce que fait le lecteur quand un fichier existe :

- la voix d'une carte de titre démarre avec la carte, qui reste affichée tant qu'elle parle puis s'efface en fondu ;
- la voix d'une scène démarre quand la scène commence (après la carte de titre du chapitre et le changement d'onglet) ;
- la scène **attend la fin de la voix** avant de passer à la suivante ;
- pause, reprise, vitesse (0,75×, 1×, 1,5×), scène précédente / suivante et « Quitter » commandent aussi la voix.

À régler après l'enregistrement (ou le remplacement) des voix :

- Une voix **plus longue** que sa scène est attendue automatiquement. Une voix **plus courte** laisse un silence : la scène dure son temps prévu.
- Les gestes (pointeur, saisie, étiquettes) sont minutés en dur (`at`, en millisecondes depuis le début de la scène dans `src/tour/tourScript.js`). Ils ne s'adaptent pas à la voix. Une voix très différente décale donc les étiquettes.
- Pour mesurer l'écart, jouer la visite avec les voix et comparer, scène par scène, la durée de la voix à celle de la scène (dernier geste + 1,8 s). Viser une scène de 1 à 2 s plus longue que sa voix, et une étiquette qui apparaît au moment où la voix parle de son sujet (position estimée au prorata des mots).
- Pour les voix, prévoir de courtes pauses à la génération (ponctuation ou balise de pause du service) avant un chiffre clé ou après une question.

Les fichiers sont intégrés à l'application à la compilation (aucune requête réseau). Ne déposez ici que des fichiers audio dont vous détenez les droits.
