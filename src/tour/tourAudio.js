// Voix humaine facultative de la visite guidée. Chaque fichier audio déposé dans src/tour/audio/ et nommé comme une scène
// (par exemple « accueil.mp3 », « indicateurs.mp3 ») est joué au début de cette scène, et la scène attend la fin de la voix
// avant de passer à la suivante. Sans fichier, la visite reste muette (sous-titres seulement), exactement comme avant.
// Vite regroupe les fichiers à la compilation : aucune requête réseau, et cela fonctionne aussi dans l'application installée.
// Voir src/tour/audio/LISEZMOI.md pour la marche à suivre (texte à lire, nom des fichiers, réglage du rythme des gestes).
const files = import.meta.glob('./audio/*.{mp3,m4a,ogg,wav}', { eager: true, query: '?url', import: 'default' });

export const TOUR_AUDIO = Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url]),
);
