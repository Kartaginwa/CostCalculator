# Voix de la visite guidée

La visite est muette par défaut (sous-titres seulement). Pour lui donner une **voix humaine**, déposez ici un fichier audio par scène :

- **Nom du fichier = identifiant de la scène** : `accueil.mp3`, `ordre.mp3`, `entreprise.mp3`… (formats : mp3, m4a, ogg, wav).
- Le texte à lire, scène par scène, est dans `Projet_Claude/11-Narration-Visite.md` (généré depuis `src/tour/tourScript.js`).
- Une scène sans fichier reste muette ; la visite continue normalement.

Ce que fait le lecteur quand un fichier existe :

- la voix démarre quand la scène commence (après la carte de titre du chapitre et le changement d'onglet) ;
- la scène **attend la fin de la voix** avant de passer à la suivante ;
- pause, reprise, vitesse (0,75×, 1×, 1,5×), scène précédente / suivante et « Quitter » commandent aussi la voix.

À régler après l'enregistrement : les gestes (pointeur, saisie, étiquettes) sont minutés pour la lecture des sous-titres. Si une voix est
nettement plus lente ou plus rapide, ajustez les valeurs `at` (en millisecondes depuis le début de la scène) dans `src/tour/tourScript.js`,
puis relancez la visite pour vérifier que chaque étiquette arrive au moment où la voix en parle.

Les fichiers sont intégrés à l'application à la compilation (aucune requête réseau). Ne déposez ici que des fichiers audio dont vous détenez les droits.
