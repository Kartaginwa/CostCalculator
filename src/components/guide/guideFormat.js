// Outils de mise en forme du guide d'utilisation (typographie française, montants, pourcentages).
// Les textes du guide sont écrits au naturel ; la typographie (espaces insécables avant « : ; ? ! % $ »
// et à l'intérieur des guillemets français) est appliquée ici, une seule fois, à l'affichage.

export const NBSP = ' ';

// Espaces insécables : « Marge : 20 % » ne se coupe jamais entre le mot et le signe.
export const frTypo = (text) => String(text)
    .replace(/ ([:;?!%$»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`);

const groupThousands = (intString) => intString.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

// Montant en format français : 1 234,56 $ (virgule décimale, espace insécable des milliers).
export const money = (value, decimals = 2) => {
    const n = Number(value);
    const fixed = Math.abs(n).toFixed(decimals);
    const [int, dec] = fixed.split('.');
    const sign = n < 0 ? '−' : '';
    return `${sign}${groupThousands(int)}${dec ? ',' + dec : ''}${NBSP}$`;
};

// Nombre simple (sans devise) : 1 234,5
export const num = (value, decimals = 0) => {
    const n = Number(value);
    const fixed = Math.abs(n).toFixed(decimals);
    const [int, dec] = fixed.split('.');
    return `${n < 0 ? '−' : ''}${groupThousands(int)}${dec ? ',' + dec : ''}`;
};

// Pourcentage : 46,9 % (reçoit un ratio 0.469 ou un pourcentage déjà multiplié selon `isRatio`).
export const pct = (value, decimals = 1, isRatio = true) => {
    const n = isRatio ? Number(value) * 100 : Number(value);
    return `${num(n, decimals)}${NBSP}%`;
};

// Valeur lue À L'ÉCRAN dans l'application (« 3.75 $ », « 1 234.50 $ », « 85.76 % ») → format du guide.
export const fromApp = (screenValue) => String(screenValue)
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/ /g, NBSP);
